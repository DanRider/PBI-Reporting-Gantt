// v2.1 audit-fix #23 — pure quarter math extracted from timeSlider.ts to
// keep the slider file under the 400-LOC cap. No DOM, no state — just the
// SliderRange shape and the four quarter-arithmetic helpers.

export type SliderRange =
    | { readonly kind: "all" }
    | { readonly kind: "range"; readonly startOffset: number; readonly endOffset: number };

export function quarterStart(d: Date): Date {
    const m = Math.floor(d.getMonth() / 3) * 3;
    return new Date(d.getFullYear(), m, 1);
}

export function offsetQuarter(base: Date, offset: number): Date {
    const d = new Date(base);
    d.setMonth(d.getMonth() + offset * 3);
    return d;
}

export function quarterLabel(d: Date): string {
    const q = Math.floor(d.getMonth() / 3) + 1;
    const yy = String(d.getFullYear()).slice(-2);
    return `Q${q} '${yy}`;
}

/** Year × 4 + quarter — monotonic, supports subtraction to count whole quarters
 *  between any two dates. */
export function quarterIndex(d: Date): number {
    return d.getFullYear() * 4 + Math.floor(d.getMonth() / 3);
}

/** INF-3736 — month-level granularity for the master slider. */
export function offsetMonth(base: Date, offset: number): Date {
    const d = new Date(base);
    d.setMonth(d.getMonth() + offset);
    return d;
}

/** Year × 12 + month — monotonic, supports subtraction to count whole months. */
export function monthIndex(d: Date): number {
    return d.getFullYear() * 12 + d.getMonth();
}

/** "Feb '26" style. */
export function monthLabel(d: Date): string {
    const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const yy = String(d.getFullYear()).slice(-2);
    return `${names[d.getMonth()]} '${yy}`;
}

export function monthStart(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** INF-3736 — narrow validator for JSON-stringified SliderRange from PBI
 *  objects bag. Returns null on any malformation so callers can fall back
 *  to in-memory defaults silently. No exceptions ever escape. */
export function parseSliderRange(s: string): SliderRange | null {
    let v: unknown;
    try { v = JSON.parse(s); } catch { return null; }
    if (!v || typeof v !== "object") return null;
    const obj = v as { kind?: unknown; startOffset?: unknown; endOffset?: unknown };
    if (obj.kind === "all") return { kind: "all" };
    if (obj.kind === "range"
        && typeof obj.startOffset === "number" && Number.isFinite(obj.startOffset)
        && typeof obj.endOffset === "number" && Number.isFinite(obj.endOffset)) {
        return { kind: "range", startOffset: obj.startOffset, endOffset: obj.endOffset };
    }
    return null;
}

/** INF-3736 — SliderRange offsets are now MONTHS (was: quarters). The window
 *  spans from the start month's first day to the end month's last instant. */
export function rangeToWindow(range: SliderRange, today: Date): { fromMs: number; toMs: number } | null {
    if (range.kind === "all") return null;
    const todayM = monthStart(today);
    const startM = offsetMonth(todayM, range.startOffset);
    const endMStart = offsetMonth(todayM, range.endOffset);
    const endMEnd = offsetMonth(endMStart, 1);
    return { fromMs: startM.getTime(), toMs: endMEnd.getTime() - 1 };
}
