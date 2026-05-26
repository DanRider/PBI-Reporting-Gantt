// Master time slider — anchored top-right, expands leftward from a time-filter icon.
//
// Two visual parts:
//  - Icon button (top:6 right:6) — always visible, clickable. Identifies
//    the time-filter affordance and toggles strip expansion.
//  - Strip (left of icon) — slider + two scope checkboxes. Max-width
//    animates 0 ↔ fixed on expansion. Content slides + fades.
//
// Auto-collapse rule (INF-3736): when both scope checkboxes are
// unchecked, the strip collapses into the icon. Reopening either by
// icon click or programmatically (caller's setExpanded(true)) re-checks
// at least one scope to make the strip meaningful.

import { mountTimeSlider } from "./inspector/timeSlider";
import { SliderRange } from "./inspector/timeSliderMath";

const ANCHOR_TOP_PX = 6;
const ANCHOR_RIGHT_PX = 6;
const STRIP_Z_INDEX = 11;
const STRIP_MAX_WIDTH_PX = 720;
const STRIP_TRANSITION_MS = 280;
const ICON_SIZE_PX = 24;
const GREY_ACCENT = "#6b7280";

export interface MasterScope {
    readonly filtersGantt: boolean;
    readonly filtersTable: boolean;
}

export interface MasterTimeSliderOptions {
    onChange: (next: SliderRange) => void;
    onScopeChange: (next: MasterScope) => void;
}

export interface MasterTimeSliderEnvelope {
    readonly pastQuarters: number;
    readonly futureQuarters: number;
}

export interface MasterTimeSliderHandle {
    update(envelope: MasterTimeSliderEnvelope, value: SliderRange, scope: MasterScope): void;
    /** Show or hide the entire anchor (icon + strip). Caller hides when
     *  the visual is in a state where time filtering makes no sense at
     *  all (e.g., no data). Auto-collapse to icon (when scope=0,0) is a
     *  separate concern handled inside the component. */
    setVisible(visible: boolean): void;
    element: HTMLElement;
}

function buildScopeCheckbox(label: string, initialActive: boolean, onClick: (next: boolean) => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    let active = initialActive;
    const restyle = (): void => {
        btn.textContent = `${active ? "☑" : "☐"} ${label}`;
        btn.title = `${active ? "Filter applies to" : "Filter does NOT apply to"} ${label}`;
        btn.style.cssText = [
            "padding:2px 4px",
            "font-size:11px",
            "line-height:1.3",
            "cursor:pointer",
            "border:none",
            "background:transparent",
            `color:${active ? "#333" : "#999"}`,
            `font-weight:${active ? "600" : "400"}`,
            "flex-shrink:0",
            "user-select:none",
            "font-family:inherit",
        ].join(";");
    };
    restyle();
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        active = !active;
        restyle();
        onClick(active);
    });
    (btn as HTMLButtonElement & { setActive: (a: boolean) => void }).setActive = (a) => { active = a; restyle(); };
    return btn;
}

function buildIcon(onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = "Time filter — click to expand/collapse";
    btn.textContent = "🕒";
    btn.style.cssText = [
        `width:${ICON_SIZE_PX}px`,
        `height:${ICON_SIZE_PX}px`,
        "padding:0",
        "border-radius:4px",
        `border:1px solid ${GREY_ACCENT}`,
        "background:#ffffff",
        "cursor:pointer",
        "font-size:14px",
        "line-height:1",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "flex-shrink:0",
        "user-select:none",
        "transition:background 150ms ease",
    ].join(";");
    btn.addEventListener("mouseenter", () => { btn.style.background = "#f4f4f6"; });
    btn.addEventListener("mouseleave", () => { btn.style.background = "#ffffff"; });
    btn.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
    return btn;
}

export function mountMasterTimeSlider(
    root: HTMLElement,
    options: MasterTimeSliderOptions,
): MasterTimeSliderHandle {
    // Anchor — flex row reversed so icon sits on the right, strip extends leftward.
    const anchor = document.createElement("div");
    anchor.className = "master-time-anchor";
    anchor.style.cssText = [
        "position:absolute",
        `top:${ANCHOR_TOP_PX}px`,
        `right:${ANCHOR_RIGHT_PX}px`,
        `z-index:${STRIP_Z_INDEX}`,
        "pointer-events:auto",
        "display:flex",
        "flex-direction:row",
        "align-items:center",
        "gap:6px",
    ].join(";");
    anchor.addEventListener("click", (e) => { e.stopPropagation(); });
    root.appendChild(anchor);

    let expanded = true;
    let curScope: MasterScope = { filtersGantt: true, filtersTable: true };

    // Strip — holds the slider + checkboxes. Sits to the left of the icon
    // (DOM order: strip first, then icon, since flex-direction is row).
    // max-width transition gives the slide-left feel.
    const strip = document.createElement("div");
    strip.className = "master-time-strip";
    strip.style.cssText = [
        "display:flex",
        "flex-direction:row",
        "align-items:center",
        "gap:6px",
        "overflow:hidden",
        "white-space:nowrap",
        `transition:max-width ${STRIP_TRANSITION_MS}ms ease, opacity ${STRIP_TRANSITION_MS - 30}ms ease`,
        `max-width:${STRIP_MAX_WIDTH_PX}px`,
        "opacity:1",
    ].join(";");

    const ganttCheck = buildScopeCheckbox("Chart", true, (next) => {
        curScope = { ...curScope, filtersGantt: next };
        options.onScopeChange(curScope);
        applyAutoCollapse();
    });
    const tableCheck = buildScopeCheckbox("Table", true, (next) => {
        curScope = { ...curScope, filtersTable: next };
        options.onScopeChange(curScope);
        applyAutoCollapse();
    });

    function setExpanded(next: boolean): void {
        if (next === expanded) return;
        expanded = next;
        strip.style.maxWidth = expanded ? `${STRIP_MAX_WIDTH_PX}px` : "0px";
        strip.style.opacity = expanded ? "1" : "0";
    }
    function applyAutoCollapse(): void {
        // Fold into the icon when scope has no useful target.
        if (!curScope.filtersGantt && !curScope.filtersTable) {
            setExpanded(false);
        }
    }

    const icon = buildIcon(() => {
        // Icon click — toggle. If expanding from collapsed-by-auto state with
        // both scopes false, default-on Chart so the slider has SOMETHING to do.
        if (!expanded) {
            if (!curScope.filtersGantt && !curScope.filtersTable) {
                curScope = { ...curScope, filtersGantt: true };
                (ganttCheck as HTMLButtonElement & { setActive: (a: boolean) => void }).setActive(true);
                options.onScopeChange(curScope);
            }
            setExpanded(true);
        } else {
            setExpanded(false);
        }
    });

    let lastEnvelope: { p: number; f: number } | null = null;
    let sliderContainer: HTMLElement | null = null;

    function remountSlider(envelope: MasterTimeSliderEnvelope, value: SliderRange): void {
        if (sliderContainer && sliderContainer.parentElement === strip) {
            strip.removeChild(sliderContainer);
        }
        const slider = mountTimeSlider({
            pastQuarters: envelope.pastQuarters,
            futureQuarters: envelope.futureQuarters,
            value,
            onChange: options.onChange,
            compact: true,
            colorAccent: GREY_ACCENT,
        });
        sliderContainer = slider.element;
        sliderContainer.style.flex = "1";
        sliderContainer.style.minWidth = "300px";
        sliderContainer.style.margin = "0";
        strip.insertBefore(sliderContainer, ganttCheck);
        lastEnvelope = { p: envelope.pastQuarters, f: envelope.futureQuarters };
    }

    strip.appendChild(ganttCheck);
    strip.appendChild(tableCheck);
    anchor.appendChild(strip);
    anchor.appendChild(icon);

    return {
        update(envelope, value, scope): void {
            if (lastEnvelope == null
                || lastEnvelope.p !== envelope.pastQuarters
                || lastEnvelope.f !== envelope.futureQuarters) {
                remountSlider(envelope, value);
            }
            if (scope.filtersGantt !== curScope.filtersGantt) {
                (ganttCheck as HTMLButtonElement & { setActive: (a: boolean) => void }).setActive(scope.filtersGantt);
            }
            if (scope.filtersTable !== curScope.filtersTable) {
                (tableCheck as HTMLButtonElement & { setActive: (a: boolean) => void }).setActive(scope.filtersTable);
            }
            curScope = scope;
            applyAutoCollapse();
        },
        setVisible(visible): void {
            anchor.style.display = visible ? "flex" : "none";
        },
        element: anchor,
    };
}
