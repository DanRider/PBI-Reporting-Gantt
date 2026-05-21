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

export function rangeToWindow(range: SliderRange, today: Date): { fromMs: number; toMs: number } | null {
    if (range.kind === "all") return null;
    const todayQ = quarterStart(today);
    const startQ = offsetQuarter(todayQ, range.startOffset);
    const endQStart = offsetQuarter(todayQ, range.endOffset);
    const endQEnd = offsetQuarter(endQStart, 1);
    return { fromMs: startQ.getTime(), toMs: endQEnd.getTime() - 1 };
}
