// Quarterly time slider — offset-preserving drag, rAF repaint, snap-on-pointerup, 10px thumb / 30px hit-zone,
// All toggle, compact mode (suppress floating labels — endpoints become live readouts).

import { SliderRange, quarterStart, offsetQuarter, quarterLabel, rangeToWindow } from "./timeSliderMath";
export { SliderRange, quarterLabel, rangeToWindow } from "./timeSliderMath";

export interface TimeSliderOptions {
    readonly pastQuarters: number;
    readonly futureQuarters: number;
    readonly value: SliderRange;
    readonly onChange: (next: SliderRange) => void;
    /** Compact mode (audit-fix #24b): suppress the floating value labels
     *  above thumbs; the LEFT/RIGHT endpoint labels become live readouts
     *  of the currently selected range instead of the envelope edges. */
    readonly compact?: boolean;
    /** Accent color override (audit-fix #24c). Default is the blue
     *  ACCENT; master slider passes a grey. */
    readonly colorAccent?: string;
}

export interface TimeSliderHandle {
    readonly element: HTMLElement;
}

const TRACK_HEIGHT = 6;
const BAND_HEIGHT = 8;
const TICK_SIZE = 5;
const TICK_TODAY_SIZE = 8;
const THUMB_SIZE = 10;           // matches inspector makeColorBubble — page-wide circle convention
const HIT_ZONE_SIZE = 30;        // transparent grabable area around the visible thumb
const RAIL_HEIGHT = 44;          // total slider control height including labels
const LABEL_LIFT = 22;           // px above the rail center for the value label

const ACCENT = "#1968c8";
const ACCENT_DIM = "#bcd4ef";
const TRACK_BG = "#e2e2e6";
const TICK_COLOR = "#aaa";
const TICK_TODAY_COLOR = "#666";
const THUMB_FILL = "#ffffff";
const THUMB_SHADOW = "0 1px 3px rgba(0,0,0,0.2)";
const THUMB_SHADOW_HOVER = "0 2px 6px rgba(0,0,0,0.25)";

export function mountTimeSlider(opts: TimeSliderOptions): TimeSliderHandle {
    const totalTicks = opts.pastQuarters + opts.futureQuarters + 1;
    const today = new Date();
    const todayQ = quarterStart(today);
    const idxToOffset = (idx: number): number => idx - opts.pastQuarters;
    const offsetToIdx = (offset: number): number => offset + opts.pastQuarters;

    const accent = opts.colorAccent ?? ACCENT;       // #24c — master overrides w/ grey
    const accentDim = opts.colorAccent ?? ACCENT_DIM;
    let curRange: SliderRange = opts.value;
    const initStart = curRange.kind === "range" ? offsetToIdx(curRange.startOffset) : 0;
    const initEnd = curRange.kind === "range" ? offsetToIdx(curRange.endOffset) : totalTicks - 1;
    let startIdx = Math.max(0, Math.min(totalTicks - 1, Math.min(initStart, initEnd)));
    let endIdx = Math.max(0, Math.min(totalTicks - 1, Math.max(initStart, initEnd)));

    // During drag the thumb tracks a fractional position (snapped only on
    // pointerup). These hold the live fractional indexes per thumb.
    let liveStartIdx = startIdx;
    let liveEndIdx = endIdx;
    const root = document.createElement("div");
    root.className = "time-slider";
    root.style.cssText = "display:flex;align-items:center;gap:8px;margin:6px 0 12px 0;font-family:'Segoe UI', system-ui, sans-serif;";
    root.addEventListener("click", (e) => { e.stopPropagation(); });

    // Show-All button
    const allBtn = document.createElement("button");
    allBtn.type = "button";
    const restyleAll = (): void => {
        const active = curRange.kind === "all";
        // INF-3736 — button label communicates the ACTION on next click.
        // range mode → click goes to "All" (show everything).
        // all mode   → click restores "Last" filtered range.
        allBtn.textContent = active ? "Last" : "All";
        allBtn.title = active
            ? "Restore the last filtered range"
            : "Show all milestones (clear window filter)";
        allBtn.style.cssText = [
            "padding:2px 8px",
            "font-size:10px",
            "line-height:1.3",
            "border-radius:10px",
            "cursor:pointer",
            `border:1px solid ${active ? accent : "#ccc"}`,
            `background:${active ? "#e6f0fb" : "#ffffff"}`,
            `color:${active ? accent : "#555"}`,
            `font-weight:${active ? "600" : "400"}`,
            "flex-shrink:0",
        ].join(";");
    };
    restyleAll();
    root.appendChild(allBtn);

    // Left endpoint label
    // audit-fix #24b — endpoint labels; compact mode makes them live readouts (see repaint).
    // INF-3736 — pointer-events:none so the right thumb's hit zone, which extends
    // 15px past the rail's right edge into rightLabel's flex space, isn't stolen
    // by the label catching clicks. Labels are display-only — never interactive.
    const LABEL_CSS = opts.compact
        ? `font-size:9px;color:${opts.colorAccent ?? ACCENT};font-weight:600;flex-shrink:0;font-variant-numeric:tabular-nums;pointer-events:none;`
        : "font-size:9px;color:#666;flex-shrink:0;font-variant-numeric:tabular-nums;pointer-events:none;";
    const leftLabel = document.createElement("span");
    leftLabel.textContent = quarterLabel(offsetQuarter(todayQ, -opts.pastQuarters));
    leftLabel.style.cssText = LABEL_CSS;
    root.appendChild(leftLabel);
    const rightLabel = document.createElement("span");
    rightLabel.textContent = quarterLabel(offsetQuarter(todayQ, opts.futureQuarters));
    rightLabel.style.cssText = LABEL_CSS;
    // rightLabel appended to root AFTER the rail (below) so flex order
    // is: [All] [leftLabel] [rail flex:1] [rightLabel].

    // Rail (grows to fill available width)
    const rail = document.createElement("div");
    rail.style.cssText = `position:relative;flex:1;height:${RAIL_HEIGHT}px;cursor:pointer;touch-action:none;`;
    root.appendChild(rail);

    const railCenterY = RAIL_HEIGHT - HIT_ZONE_SIZE / 2 - 4;

    // Track (background line)
    const track = document.createElement("div");
    track.style.cssText = [
        "position:absolute",
        "left:0",
        "right:0",
        `top:${railCenterY - TRACK_HEIGHT / 2}px`,
        `height:${TRACK_HEIGHT}px`,
        `background:${TRACK_BG}`,
        "border-radius:3px",
        "pointer-events:none",
    ].join(";");
    rail.appendChild(track);

    // Selected band
    const band = document.createElement("div");
    band.style.cssText = [
        "position:absolute",
        `top:${railCenterY - BAND_HEIGHT / 2}px`,
        `height:${BAND_HEIGHT}px`,
        `background:${accent}`,
        "border-radius:4px",
        "pointer-events:none",
    ].join(";");
    rail.appendChild(band);

    // Ticks
    for (let i = 0; i < totalTicks; i++) {
        const isToday = i === opts.pastQuarters;
        const size = isToday ? TICK_TODAY_SIZE : TICK_SIZE;
        const tick = document.createElement("div");
        tick.style.cssText = [
            "position:absolute",
            `top:${railCenterY - size / 2}px`,
            `width:${size}px`,
            `height:${size}px`,
            "border-radius:50%",
            `background:${isToday ? TICK_TODAY_COLOR : TICK_COLOR}`,
            "transform:translateX(-50%)",
            `left:${(i / (totalTicks - 1)) * 100}%`,
            "pointer-events:none",
            "z-index:1",
        ].join(";");
        const tickQ = offsetQuarter(todayQ, idxToOffset(i));
        tick.title = isToday ? `${quarterLabel(tickQ)} (current)` : quarterLabel(tickQ);
        // Hover via a wider invisible hit zone (since the dot is only 5-8px)
        const tickHit = document.createElement("div");
        tickHit.style.cssText = [
            "position:absolute",
            `top:${railCenterY - 8}px`,
            `height:16px`,
            "width:14px",
            "transform:translateX(-50%)",
            `left:${(i / (totalTicks - 1)) * 100}%`,
            "pointer-events:auto",
            "z-index:1",
            "cursor:default",
        ].join(";");
        tickHit.title = tick.title;
        rail.appendChild(tickHit);
        rail.appendChild(tick);
    }

    // Build a thumb (visible 18px circle + transparent 30px hit-zone).
    const makeThumb = (): { hit: HTMLDivElement; visible: HTMLDivElement; label: HTMLDivElement } => {
        const hit = document.createElement("div");
        hit.style.cssText = [
            "position:absolute",
            `top:${railCenterY - HIT_ZONE_SIZE / 2}px`,
            `width:${HIT_ZONE_SIZE}px`,
            `height:${HIT_ZONE_SIZE}px`,
            "transform:translateX(-50%)",
            "cursor:grab",
            "touch-action:none",
            "z-index:3",
            "border-radius:50%",
            "display:flex",
            "align-items:center",
            "justify-content:center",
        ].join(";");
        const visible = document.createElement("div");
        visible.style.cssText = [
            `width:${THUMB_SIZE}px`,
            `height:${THUMB_SIZE}px`,
            "box-sizing:border-box",
            "border-radius:50%",
            `background:${THUMB_FILL}`,
            `border:2px solid ${accent}`,
            `box-shadow:${THUMB_SHADOW}`,
            "transition:transform 80ms ease, box-shadow 80ms ease",
            "pointer-events:none",
        ].join(";");
        hit.addEventListener("mouseenter", () => { visible.style.transform = "scale(1.1)"; visible.style.boxShadow = THUMB_SHADOW_HOVER; });
        hit.addEventListener("mouseleave", () => { visible.style.transform = "scale(1)"; visible.style.boxShadow = THUMB_SHADOW; });
        hit.appendChild(visible);

        // Persistent value label above the thumb (Tableau-style — no mystery
        // about which quarter the thumb is on).
        const label = document.createElement("div");
        label.style.cssText = [
            "position:absolute",
            `top:${railCenterY - HIT_ZONE_SIZE / 2 - LABEL_LIFT}px`,
            "transform:translateX(-50%)",
            "font-size:9px",
            "font-weight:600",
            `color:${accent}`,
            "font-variant-numeric:tabular-nums",
            "pointer-events:none",
            "white-space:nowrap",
            "background:#ffffff",
            `border:1px solid ${accentDim}`,
            "border-radius:3px",
            "padding:1px 5px",
            "z-index:4",
        ].join(";");
        return { hit, visible, label };
    };
    const startT = makeThumb();
    const endT = makeThumb();
    rail.appendChild(startT.hit);
    rail.appendChild(endT.hit);
    // audit-fix #24b — compact suppresses floating ghost labels; endpoint labels become live readouts.
    if (!opts.compact) {
        rail.appendChild(startT.label);
        rail.appendChild(endT.label);
    }

    // INF-3736 — smooth transition + 3 explicit states (all/range/empty); thumbs NEVER move on toggle.
    band.style.transition = "opacity 180ms ease, left 180ms ease, width 180ms ease";
    let rafPending = false;
    function repaint(): void {
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(() => {
            rafPending = false;
            // INF-3736 — slicer-style: band ALWAYS shows current selection at full
            // opacity. In "all" mode thumbs+band sit at envelope endpoints (everything
            // selected = band fills rail). In "range" mode thumbs+band sit at the user's
            // saved range. No ghosting, no opacity tricks — what you see IS what's selected.
            const isAll = curRange.kind === "all";
            const sIdx = isAll ? 0 : liveStartIdx;
            const eIdx = isAll ? totalTicks - 1 : liveEndIdx;
            const sPct = (sIdx / (totalTicks - 1)) * 100;
            const ePct = (eIdx / (totalTicks - 1)) * 100;
            startT.hit.style.left = `${sPct}%`;
            endT.hit.style.left = `${ePct}%`;
            startT.label.style.left = `${sPct}%`;
            endT.label.style.left = `${ePct}%`;
            band.style.left = `${sPct}%`;
            band.style.width = `${ePct - sPct}%`;
            band.style.opacity = "1";
            startT.visible.style.opacity = "1";
            endT.visible.style.opacity = "1";
            const sLabelQ = offsetQuarter(todayQ, idxToOffset(Math.round(sIdx)));
            const eLabelQ = offsetQuarter(todayQ, idxToOffset(Math.round(eIdx)));
            startT.label.textContent = quarterLabel(sLabelQ);
            endT.label.textContent = quarterLabel(eLabelQ);
            if (opts.compact) {
                leftLabel.textContent = quarterLabel(sLabelQ);
                rightLabel.textContent = quarterLabel(eLabelQ);
            }
        });
    }
    repaint();
    function clientXToFractionalIdx(clientX: number): number {
        const rect = rail.getBoundingClientRect();
        if (rect.width <= 0) return 0;
        const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return pct * (totalTicks - 1);
    }

    function snapAndCommit(): void {
        const sIdx = Math.max(0, Math.min(totalTicks - 1, Math.round(liveStartIdx)));
        const eIdx = Math.max(0, Math.min(totalTicks - 1, Math.round(liveEndIdx)));
        startIdx = Math.min(sIdx, eIdx);
        endIdx = Math.max(sIdx, eIdx);
        liveStartIdx = startIdx;
        liveEndIdx = endIdx;
        if (curRange.kind === "all") {
            // Dragging implicitly exits "all" mode.
            curRange = { kind: "range", startOffset: idxToOffset(startIdx), endOffset: idxToOffset(endIdx) };
        } else {
            curRange = { kind: "range", startOffset: idxToOffset(startIdx), endOffset: idxToOffset(endIdx) };
        }
        restyleAll();
        repaint();
        opts.onChange(curRange);
    }
    function attachDrag(thumb: ReturnType<typeof makeThumb>, side: "start" | "end"): void {
        thumb.hit.addEventListener("pointerdown", (e: PointerEvent) => {
            e.stopPropagation();
            e.preventDefault();
            thumb.hit.setPointerCapture(e.pointerId);
            thumb.hit.style.cursor = "grabbing";
            thumb.visible.style.transform = "scale(1.15)";
            thumb.visible.style.boxShadow = THUMB_SHADOW_HOVER;

            // Offset-preserving drag: capture the cursor's fractional index
            // at pointerdown, and the thumb's own fractional index. Maintain
            // the delta during pointermove.
            const cursorStartIdx = clientXToFractionalIdx(e.clientX);
            const thumbStartIdx = side === "start" ? liveStartIdx : liveEndIdx;
            const grabOffset = cursorStartIdx - thumbStartIdx;

            const onMove = (mv: PointerEvent): void => {
                if (!thumb.hit.hasPointerCapture(mv.pointerId)) return;
                const cursorIdx = clientXToFractionalIdx(mv.clientX);
                let nextIdx = cursorIdx - grabOffset;
                nextIdx = Math.max(0, Math.min(totalTicks - 1, nextIdx));
                if (side === "start") {
                    if (nextIdx > liveEndIdx) nextIdx = liveEndIdx;  // don't cross
                    liveStartIdx = nextIdx;
                } else {
                    if (nextIdx < liveStartIdx) nextIdx = liveStartIdx;
                    liveEndIdx = nextIdx;
                }
                repaint();
            };
            const onUp = (up: PointerEvent): void => {
                if (thumb.hit.hasPointerCapture(up.pointerId)) {
                    thumb.hit.releasePointerCapture(up.pointerId);
                }
                thumb.hit.style.cursor = "grab";
                thumb.visible.style.transform = "scale(1)";
                thumb.visible.style.boxShadow = THUMB_SHADOW;
                thumb.hit.removeEventListener("pointermove", onMove);
                thumb.hit.removeEventListener("pointerup", onUp);
                snapAndCommit();
            };
            thumb.hit.addEventListener("pointermove", onMove);
            thumb.hit.addEventListener("pointerup", onUp);
        });
    }
    attachDrag(startT, "start");
    attachDrag(endT, "end");
    rail.addEventListener("pointerdown", (e: PointerEvent) => {
        // If a thumb already grabbed the pointer, skip.
        const target = e.target as HTMLElement;
        if (target === startT.hit || target === endT.hit ||
            startT.hit.contains(target) || endT.hit.contains(target)) {
            return;
        }
        e.stopPropagation();
        const cursorIdx = clientXToFractionalIdx(e.clientX);
        const distStart = Math.abs(cursorIdx - liveStartIdx);
        const distEnd = Math.abs(cursorIdx - liveEndIdx);
        // Whichever thumb is closer jumps to the cursor's snapped position.
        const snapped = Math.max(0, Math.min(totalTicks - 1, Math.round(cursorIdx)));
        if (distStart <= distEnd) {
            liveStartIdx = Math.min(snapped, liveEndIdx);
        } else {
            liveEndIdx = Math.max(snapped, liveStartIdx);
        }
        if (curRange.kind === "all") {
            curRange = { kind: "range", startOffset: idxToOffset(Math.round(liveStartIdx)), endOffset: idxToOffset(Math.round(liveEndIdx)) };
        }
        snapAndCommit();
    });

    // Show-All button
    allBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (curRange.kind === "all") {
            // Toggle back to range
            curRange = { kind: "range", startOffset: idxToOffset(startIdx), endOffset: idxToOffset(endIdx) };
        } else {
            curRange = { kind: "all" };
        }
        restyleAll();
        repaint();
        opts.onChange(curRange);
    });

    // Right endpoint label
    root.appendChild(rightLabel);

    return { element: root };
}
