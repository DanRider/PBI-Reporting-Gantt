// v2.1 audit-fix #24 — master time slider in top row.
//
// Mounts a positioned strip ABOVE the Gantt/Table toggles (which move
// from top:6 to top:40 to make room). The strip spans the full chart
// width and hosts a TimeSlider whose pastQuarters/futureQuarters are
// derived from the data envelope (vm.dateExtent snapped to quarters,
// pivoted on today). The visual owns the SliderRange state; this module
// is pure chrome + plumbing.
//
// 24a scope: mount + envelope plumbing + state passthrough. Activity
// tear rendering lands in 24b; milestone filter in 24c (or this same
// commit since it's trivial).
//
// Pure DOM. Remounts the inner slider when envelope changes (cheap —
// the slider's DOM is replaced wholesale; state survives on the
// caller's masterRange field).

import { mountTimeSlider } from "./inspector/timeSlider";
import { SliderRange } from "./inspector/timeSliderMath";

const STRIP_HEIGHT_PX = 32;
const STRIP_TOP_PX = 6;
const STRIP_LEFT_DEFAULT_PX = 6;
const STRIP_RIGHT_PX = 6;
const STRIP_Z_INDEX = 11;
const STRIP_BG = "rgba(255,255,255,0.92)";
const STRIP_BORDER = "#e0e0e0";

export interface MasterTimeSliderOptions {
    /** Called when the user drags or clicks the slider. Visual stores the
     *  new range and triggers requestRerender. */
    onChange: (next: SliderRange) => void;
}

export interface MasterTimeSliderEnvelope {
    readonly pastQuarters: number;
    readonly futureQuarters: number;
}

export interface MasterTimeSliderHandle {
    /** Set envelope (from data) + current value. Remounts the inner
     *  slider iff envelope changed since last call. */
    update(envelope: MasterTimeSliderEnvelope, value: SliderRange): void;
    /** Caller sets when the controls panel opens/closes, so the strip
     *  starts to the right of the panel. */
    setLeftOffset(leftPx: number): void;
    element: HTMLElement;
}

export function mountMasterTimeSlider(
    root: HTMLElement,
    options: MasterTimeSliderOptions,
): MasterTimeSliderHandle {
    const strip = document.createElement("div");
    strip.className = "master-time-slider";
    strip.style.cssText = [
        "position:absolute",
        `top:${STRIP_TOP_PX}px`,
        `left:${STRIP_LEFT_DEFAULT_PX}px`,
        `right:${STRIP_RIGHT_PX}px`,
        `height:${STRIP_HEIGHT_PX}px`,
        `z-index:${STRIP_Z_INDEX}`,
        "pointer-events:auto",
        `background:${STRIP_BG}`,
        `border:1px solid ${STRIP_BORDER}`,
        "border-radius:4px",
        "padding:0 8px",
        "box-sizing:border-box",
        "display:flex",
        "align-items:center",
    ].join(";");
    // Clicks inside the strip must NOT bubble to root whitespace handler
    // (which clears selection). The slider itself stops propagation but
    // the strip padding around it doesn't, so guard at this level too.
    strip.addEventListener("click", (e) => { e.stopPropagation(); });
    root.appendChild(strip);

    let last: { p: number; f: number } | null = null;

    return {
        update(envelope, value): void {
            if (last == null || last.p !== envelope.pastQuarters || last.f !== envelope.futureQuarters) {
                while (strip.firstChild) strip.removeChild(strip.firstChild);
                const slider = mountTimeSlider({
                    pastQuarters: envelope.pastQuarters,
                    futureQuarters: envelope.futureQuarters,
                    value,
                    onChange: options.onChange,
                });
                strip.appendChild(slider.element);
                last = { p: envelope.pastQuarters, f: envelope.futureQuarters };
            }
        },
        setLeftOffset(leftPx): void {
            strip.style.left = `${Math.max(STRIP_LEFT_DEFAULT_PX, leftPx + STRIP_LEFT_DEFAULT_PX)}px`;
        },
        element: strip,
    };
}
