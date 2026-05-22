// v2.1 audit-fix #24 — master time slider mount in top chrome row.
//
// Minimal — no chrome of its own. The slider sits inline in the same
// horizontal band as the Gantt/Table toggles, sized to fill the remaining
// horizontal space after toggle area + controls panel. Uses mountTimeSlider
// in compact mode (no floating value-above labels; endpoint labels are
// live readouts of the selected range).
//
// Pure DOM. Remounts the inner slider when envelope changes (cheap —
// the slider's DOM is replaced wholesale; state survives on the
// caller's masterRange field).

import { mountTimeSlider } from "./inspector/timeSlider";
import { SliderRange } from "./inspector/timeSliderMath";

// audit-fix #24c — host top:-12 vertically aligns the slider rail center
// (which lives at y=25 inside the 44px rail container) with the toggle
// row center (y=13). The hit zone extends 2px above the visual top edge
// but visible thumbs stay in-band.
const STRIP_TOP_PX = -12;
const STRIP_Z_INDEX = 11;
const STRIP_MIN_WIDTH = 200;
// audit-fix #24c — grey accent so the slider doesn't fight the chart
// colors for attention. Matches the toggle thumb's grey border family.
const GREY_ACCENT = "#6b7280";

export interface MasterTimeSliderOptions {
    onChange: (next: SliderRange) => void;
}

export interface MasterTimeSliderEnvelope {
    readonly pastQuarters: number;
    readonly futureQuarters: number;
}

export interface MasterTimeSliderHandle {
    update(envelope: MasterTimeSliderEnvelope, value: SliderRange): void;
    /** Set the slider host's absolute left + width in pixels. PBI custom
     *  visuals do NOT propagate a CSS width to root — chrome must size
     *  itself from viewport.width via JS. */
    setBounds(leftPx: number, widthPx: number): void;
    element: HTMLElement;
}

export function mountMasterTimeSlider(
    root: HTMLElement,
    options: MasterTimeSliderOptions,
): MasterTimeSliderHandle {
    const host = document.createElement("div");
    host.className = "master-time-slider";
    host.style.cssText = [
        "position:absolute",
        `top:${STRIP_TOP_PX}px`,
        "left:200px",
        "width:300px",
        `z-index:${STRIP_Z_INDEX}`,
        "pointer-events:auto",
        "display:flex",
        "align-items:center",
    ].join(";");
    host.addEventListener("click", (e) => { e.stopPropagation(); });
    root.appendChild(host);

    let last: { p: number; f: number } | null = null;

    return {
        update(envelope, value): void {
            if (last == null || last.p !== envelope.pastQuarters || last.f !== envelope.futureQuarters) {
                while (host.firstChild) host.removeChild(host.firstChild);
                const slider = mountTimeSlider({
                    pastQuarters: envelope.pastQuarters,
                    futureQuarters: envelope.futureQuarters,
                    value,
                    onChange: options.onChange,
                    compact: true,        // #24b — no ghost labels
                    colorAccent: GREY_ACCENT,  // #24c — grey, not blue
                });
                slider.element.style.flex = "1";
                slider.element.style.width = "100%";
                slider.element.style.margin = "0";
                host.appendChild(slider.element);
                last = { p: envelope.pastQuarters, f: envelope.futureQuarters };
            }
        },
        setBounds(leftPx, widthPx): void {
            host.style.left = `${leftPx}px`;
            host.style.width = `${Math.max(STRIP_MIN_WIDTH, widthPx)}px`;
        },
        element: host,
    };
}
