// v2.1 audit-fix #22 — quarterly time-range slider.
//
// Two-thumb slider that snaps to quarter boundaries. Replaces the chip
// row (which wrapped at narrow widths). Visible span = ±N quarters from
// today's quarter; user picks a contiguous range by dragging the thumbs.
// Hover any tick to see its quarter label (Q3 '25 etc.) — only endpoints
// are labeled by default so the slider stays readable at narrow widths.
//
// "Show All" button to the left disables the window filter entirely.

export type SliderRange =
    | { readonly kind: "all" }
    | { readonly kind: "range"; readonly startOffset: number; readonly endOffset: number };

export interface TimeSliderOptions {
    /** Quarters visible to the left of today (inclusive). Default 4. */
    readonly pastQuarters: number;
    /** Quarters visible to the right of today (inclusive). Default 4. */
    readonly futureQuarters: number;
    /** Current range. */
    readonly value: SliderRange;
    /** Called when the user drags a thumb or clicks Show All. */
    readonly onChange: (next: SliderRange) => void;
}

export interface TimeSliderHandle {
    readonly element: HTMLElement;
}

const TRACK_HEIGHT_PX = 4;
const TICK_SIZE_PX = 8;
const TICK_SIZE_TODAY_PX = 10;
const THUMB_SIZE_PX = 14;
const BAND_HEIGHT_PX = 6;
const SELECTED_COLOR = "#1968c8";
const TRACK_BG = "#dcdcdc";
const TICK_COLOR = "#999";
const TICK_TODAY_COLOR = "#666";
const ENDPOINT_LABEL_COLOR = "#666";
const ALL_BTN_BG_ACTIVE = "#e6f0fb";
const ALL_BTN_BORDER_ACTIVE = "#1968c8";

/** Snap a percentage along the track (0..1) to the nearest tick index. */
function snapToTick(pct: number, totalTicks: number): number {
    const idx = Math.round(pct * (totalTicks - 1));
    return Math.max(0, Math.min(totalTicks - 1, idx));
}

/** Compute a quarter Date from today + offset quarters. */
function quarterStart(d: Date): Date {
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

/** Compute window milliseconds for a SliderRange. Returns null for "all". */
export function rangeToWindow(range: SliderRange, today: Date): { fromMs: number; toMs: number } | null {
    if (range.kind === "all") return null;
    const todayQ = quarterStart(today);
    const startQ = offsetQuarter(todayQ, range.startOffset);
    const endQStart = offsetQuarter(todayQ, range.endOffset);
    const endQEnd = offsetQuarter(endQStart, 1);  // first day of the quarter AFTER endOffset
    return { fromMs: startQ.getTime(), toMs: endQEnd.getTime() - 1 };
}

export function mountTimeSlider(opts: TimeSliderOptions): TimeSliderHandle {
    const past = opts.pastQuarters;
    const future = opts.futureQuarters;
    const totalTicks = past + future + 1;  // includes today's quarter

    const today = new Date();
    const todayQ = quarterStart(today);

    // Convert offset (-past..+future) → tick index (0..totalTicks-1).
    const offsetToIdx = (offset: number): number => offset + past;
    const idxToOffset = (idx: number): number => idx - past;

    let curRange: SliderRange = opts.value;
    const isAll = curRange.kind === "all";
    const startIdx = curRange.kind === "range" ? offsetToIdx(curRange.startOffset) : 0;
    const endIdx = curRange.kind === "range" ? offsetToIdx(curRange.endOffset) : totalTicks - 1;
    let curStartIdx = Math.min(startIdx, endIdx);
    let curEndIdx = Math.max(startIdx, endIdx);

    const root = document.createElement("div");
    root.className = "time-slider";
    root.style.cssText = "display:flex;align-items:center;gap:8px;margin:6px 0 10px 0;font-family:'Segoe UI', system-ui, sans-serif;";

    // "Show All" toggle button on the left.
    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.textContent = "All";
    allBtn.title = "Show all milestones (clear window filter)";
    const styleAllBtn = (): void => {
        const active = curRange.kind === "all";
        allBtn.style.cssText = [
            "padding:2px 8px",
            "font-size:10px",
            "line-height:1.3",
            "border-radius:10px",
            "cursor:pointer",
            "border:1px solid " + (active ? ALL_BTN_BORDER_ACTIVE : "#ccc"),
            "background:" + (active ? ALL_BTN_BG_ACTIVE : "#ffffff"),
            "color:" + (active ? ALL_BTN_BORDER_ACTIVE : "#555"),
            "font-weight:" + (active ? "600" : "400"),
            "flex-shrink:0",
        ].join(";");
    };
    styleAllBtn();
    allBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (curRange.kind === "all") {
            // Toggle off → restore the last range thumbs.
            curRange = { kind: "range", startOffset: idxToOffset(curStartIdx), endOffset: idxToOffset(curEndIdx) };
        } else {
            curRange = { kind: "all" };
        }
        styleAllBtn();
        applyThumbs();
        opts.onChange(curRange);
    });
    root.appendChild(allBtn);

    // Endpoint label (left)
    const leftLabel = document.createElement("span");
    leftLabel.textContent = quarterLabel(offsetQuarter(todayQ, -past));
    leftLabel.style.cssText = `font-size:9px;color:${ENDPOINT_LABEL_COLOR};flex-shrink:0;font-variant-numeric:tabular-nums;`;
    root.appendChild(leftLabel);

    // Slider rail container (grows to fill available width).
    const rail = document.createElement("div");
    rail.style.cssText = `position:relative;flex:1;height:${THUMB_SIZE_PX + 4}px;cursor:pointer;`;
    root.appendChild(rail);

    // Track background line.
    const track = document.createElement("div");
    track.style.cssText = [
        "position:absolute",
        "left:0",
        "right:0",
        `top:${(THUMB_SIZE_PX + 4) / 2 - TRACK_HEIGHT_PX / 2}px`,
        `height:${TRACK_HEIGHT_PX}px`,
        `background:${TRACK_BG}`,
        "border-radius:2px",
        "pointer-events:none",
    ].join(";");
    rail.appendChild(track);

    // Selected band (between the two thumbs).
    const band = document.createElement("div");
    band.style.cssText = [
        "position:absolute",
        `top:${(THUMB_SIZE_PX + 4) / 2 - BAND_HEIGHT_PX / 2}px`,
        `height:${BAND_HEIGHT_PX}px`,
        `background:${SELECTED_COLOR}`,
        "border-radius:3px",
        "pointer-events:none",
    ].join(";");
    rail.appendChild(band);

    // Ticks (one per quarter). Each tick has a title attr with the
    // quarter label so hover reveals the identity. Today's tick gets a
    // slightly larger size + darker color so the user has an anchor.
    for (let i = 0; i < totalTicks; i++) {
        const isToday = i === past;
        const tick = document.createElement("div");
        const size = isToday ? TICK_SIZE_TODAY_PX : TICK_SIZE_PX;
        tick.style.cssText = [
            "position:absolute",
            `top:${(THUMB_SIZE_PX + 4) / 2 - size / 2}px`,
            `width:${size}px`,
            `height:${size}px`,
            "border-radius:50%",
            `background:${isToday ? TICK_TODAY_COLOR : TICK_COLOR}`,
            "transform:translateX(-50%)",
            "pointer-events:auto",
            "cursor:pointer",
            "z-index:1",
        ].join(";");
        tick.style.left = `${(i / (totalTicks - 1)) * 100}%`;
        const tickQ = offsetQuarter(todayQ, idxToOffset(i));
        tick.title = isToday ? `${quarterLabel(tickQ)} (current)` : quarterLabel(tickQ);
        rail.appendChild(tick);
    }

    // Thumbs (start and end).
    const makeThumb = (): HTMLDivElement => {
        const thumb = document.createElement("div");
        thumb.style.cssText = [
            "position:absolute",
            `top:${(THUMB_SIZE_PX + 4) / 2 - THUMB_SIZE_PX / 2}px`,
            `width:${THUMB_SIZE_PX}px`,
            `height:${THUMB_SIZE_PX}px`,
            "border-radius:50%",
            `background:#ffffff`,
            `border:2px solid ${SELECTED_COLOR}`,
            "cursor:grab",
            "transform:translateX(-50%)",
            "touch-action:none",
            "z-index:2",
            "box-shadow:0 1px 2px rgba(0,0,0,0.15)",
        ].join(";");
        return thumb;
    };
    const startThumb = makeThumb();
    const endThumb = makeThumb();
    rail.appendChild(startThumb);
    rail.appendChild(endThumb);

    // Layout the thumbs + band per current indexes.
    function applyThumbs(): void {
        const isAllNow = curRange.kind === "all";
        const sIdx = isAllNow ? 0 : curStartIdx;
        const eIdx = isAllNow ? totalTicks - 1 : curEndIdx;
        const startPct = (sIdx / (totalTicks - 1)) * 100;
        const endPct = (eIdx / (totalTicks - 1)) * 100;
        startThumb.style.left = `${startPct}%`;
        endThumb.style.left = `${endPct}%`;
        band.style.left = `${startPct}%`;
        band.style.width = `${endPct - startPct}%`;
        // Dim the band when "all" — visual cue that the filter is off.
        band.style.opacity = isAllNow ? "0.4" : "1";
    }
    applyThumbs();

    // Drag handler factory. Both thumbs share the logic; the "side"
    // tells us which index to update on drag.
    const attachThumbDrag = (thumb: HTMLDivElement, side: "start" | "end"): void => {
        thumb.addEventListener("pointerdown", (e: PointerEvent) => {
            e.stopPropagation();
            e.preventDefault();
            thumb.setPointerCapture(e.pointerId);
            thumb.style.cursor = "grabbing";

            const onMove = (mv: PointerEvent): void => {
                if (!thumb.hasPointerCapture(mv.pointerId)) return;
                const rect = rail.getBoundingClientRect();
                if (rect.width <= 0) return;
                const pct = Math.max(0, Math.min(1, (mv.clientX - rect.left) / rect.width));
                const newIdx = snapToTick(pct, totalTicks);
                if (side === "start") {
                    if (newIdx > curEndIdx) return;  // don't cross the other thumb
                    if (newIdx === curStartIdx) return;
                    curStartIdx = newIdx;
                } else {
                    if (newIdx < curStartIdx) return;
                    if (newIdx === curEndIdx) return;
                    curEndIdx = newIdx;
                }
                // Dragging implicitly exits "all" mode.
                curRange = { kind: "range", startOffset: idxToOffset(curStartIdx), endOffset: idxToOffset(curEndIdx) };
                styleAllBtn();
                applyThumbs();
                opts.onChange(curRange);
            };
            const onUp = (up: PointerEvent): void => {
                if (thumb.hasPointerCapture(up.pointerId)) {
                    thumb.releasePointerCapture(up.pointerId);
                }
                thumb.style.cursor = "grab";
                thumb.removeEventListener("pointermove", onMove);
                thumb.removeEventListener("pointerup", onUp);
            };
            thumb.addEventListener("pointermove", onMove);
            thumb.addEventListener("pointerup", onUp);
        });
    };
    attachThumbDrag(startThumb, "start");
    attachThumbDrag(endThumb, "end");

    // Endpoint label (right)
    const rightLabel = document.createElement("span");
    rightLabel.textContent = quarterLabel(offsetQuarter(todayQ, future));
    rightLabel.style.cssText = `font-size:9px;color:${ENDPOINT_LABEL_COLOR};flex-shrink:0;font-variant-numeric:tabular-nums;`;
    root.appendChild(rightLabel);

    // Stop click bubbling from inside the slider to the root whitespace
    // handler (which would clear selection and close the panel).
    root.addEventListener("click", (e) => { e.stopPropagation(); });

    void isAll;  // silence unused — initial state already captured via curRange

    return { element: root };
}
