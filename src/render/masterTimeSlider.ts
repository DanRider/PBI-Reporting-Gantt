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

// INF-3736 — anchor at top:1, height:24, align-items:center. Everything inside
// (icon, slider rail, text labels, checkboxes) center-aligns to visual y=13 to
// match the Gantt/Table toggle row centerline. timeSlider's railCenterY was
// changed to true geometric center so no extra nudge is needed.
const ANCHOR_TOP_PX = 1;
const ANCHOR_HEIGHT_PX = 24;
const ANCHOR_RIGHT_PX = 6;
const STRIP_Z_INDEX = 11;
const STRIP_MAX_WIDTH_PX = 1440;
const SLIDER_MIN_WIDTH_PX = 600;
const STRIP_TRANSITION_MS = 1120;  // INF-3736 — 4x slower fold/fly for a deliberate, polished feel
const ICON_SIZE_PX = 24;
const GREY_ACCENT = "#6b7280";
const HOVER_BLUE = "#3b82f6";
const INDICATOR_BLUE = "#2563eb";

export interface MasterScope {
    readonly filtersGantt: boolean;
    readonly filtersTable: boolean;
}

export interface MasterTimeSliderOptions {
    onChange: (next: SliderRange) => void;
    onScopeChange: (next: MasterScope) => void;
}

export interface MasterTimeSliderEnvelope {
    readonly pastMonths: number;
    readonly futureMonths: number;
}

export interface MasterTimeSliderHandle {
    update(envelope: MasterTimeSliderEnvelope, value: SliderRange, scope: MasterScope): void;
    /** Show or hide the entire anchor (icon + strip). Caller hides when
     *  the visual is in a state where time filtering makes no sense at
     *  all (e.g., no data). Auto-collapse to icon (when scope=0,0) is a
     *  separate concern handled inside the component. */
    setVisible(visible: boolean): void;
    /** v2.2 INF-3739 — compress the slider's right anchor by N px so the
     *  comprehensive filter sidebar can occupy the right edge full-height
     *  without overlap. 0 = original right:6 anchor. */
    setRightReserve(px: number): void;
    /** v2.2 INF-3739 — push the slider's top anchor down by N px so the
     *  dedicated slicer container above it occupies row 0. 0 = original
     *  top:1 anchor. */
    setTopOffset(px: number): void;
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
            "padding:0",
            // INF-3736 — exact-match toggle font: 10px Segoe UI 600 #555.
            "font-family:'Segoe UI',system-ui,sans-serif",
            "font-size:10px",
            "font-weight:600",
            `color:${active ? "#555" : "#aaa"}`,
            // line-height equals the anchor height so vertical centering is pixel-perfect.
            `line-height:${ANCHOR_HEIGHT_PX}px`,
            "cursor:pointer",
            "border:none",
            "background:transparent",
            "flex-shrink:0",
            "user-select:none",
            "white-space:nowrap",
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

function buildIcon(onClick: () => void): { btn: HTMLButtonElement; setIndicator: (visible: boolean) => void } {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = "Time filter — click to expand/collapse";
    btn.textContent = "🕒";
    btn.style.cssText = [
        `width:${ICON_SIZE_PX}px`,
        `height:${ICON_SIZE_PX}px`,
        "padding:0",
        "border-radius:4px",
        "border:none",
        "background:transparent",
        "cursor:pointer",
        "font-family:'Segoe UI',system-ui,sans-serif",
        "font-size:14px",
        // line-height equals the box height for pixel-perfect vertical centering.
        `line-height:${ICON_SIZE_PX}px`,
        "text-align:center",
        "display:block",
        "flex-shrink:0",
        "user-select:none",
        "position:relative",
        "color:#555",
        "transition:background 150ms ease, color 150ms ease",
    ].join(";");
    btn.addEventListener("mouseenter", () => { btn.style.background = "#e9efff"; btn.style.color = HOVER_BLUE; });
    btn.addEventListener("mouseleave", () => { btn.style.background = "transparent"; btn.style.color = "#555"; });
    btn.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });

    // INF-3736 — small dot in the top-right of the icon when slider is collapsed
    // AND a range filter is active. Tells the user "you have a filter applied
    // even though the slider isn't visible." Hidden otherwise.
    const dot = document.createElement("span");
    dot.style.cssText = [
        "position:absolute",
        "top:1px",
        "right:1px",
        "width:6px",
        "height:6px",
        "border-radius:50%",
        `background:${INDICATOR_BLUE}`,
        "pointer-events:none",
        "display:none",
    ].join(";");
    btn.appendChild(dot);

    return {
        btn,
        setIndicator: (visible: boolean): void => { dot.style.display = visible ? "block" : "none"; },
    };
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
        `height:${ANCHOR_HEIGHT_PX}px`,
        `z-index:${STRIP_Z_INDEX}`,
        "pointer-events:auto",
        "display:flex",
        "flex-direction:row",
        "align-items:center",
        "overflow:visible",
        "gap:6px",
    ].join(";");
    anchor.addEventListener("click", (e) => { e.stopPropagation(); });
    root.appendChild(anchor);

    let expanded = true;
    let curScope: MasterScope = { filtersGantt: true, filtersTable: true };
    // Track the slider's current value so the icon indicator can light up when
    // the strip is collapsed AND a range filter is active.
    let curValue: SliderRange | null = null;
    function updateIndicator(): void {
        const hasRange = curValue != null && curValue.kind === "range";
        iconHandle.setIndicator(!expanded && hasRange);
    }

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
        // INF-3736 — 4x slower transition for a deliberate, polished fold/fly.
        // Opacity slightly faster so content fades before width fully collapses
        // (prevents content overflow during the last moments of collapse).
        `transition:max-width ${STRIP_TRANSITION_MS}ms ease, opacity ${Math.round(STRIP_TRANSITION_MS * 0.8)}ms ease`,
        `max-width:${STRIP_MAX_WIDTH_PX}px`,
        "opacity:1",
    ].join(";");

    const ganttCheck = buildScopeCheckbox("Roadmap", true, (next) => {
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
        updateIndicator();
    }
    function applyAutoCollapse(): void {
        // Fold into the icon when scope has no useful target.
        if (!curScope.filtersGantt && !curScope.filtersTable) {
            setExpanded(false);
        }
    }

    const iconHandle = buildIcon(() => {
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
            pastMonths: envelope.pastMonths,
            futureMonths: envelope.futureMonths,
            value,
            onChange: (next: SliderRange) => {
                // INF-3736 — keep curValue in sync so the icon indicator
                // can react INSTANTLY to drag/all-toggle (no need to wait
                // for the next update() round-trip).
                curValue = next;
                updateIndicator();
                options.onChange(next);
            },
            compact: true,
            colorAccent: GREY_ACCENT,
        });
        sliderContainer = slider.element;
        sliderContainer.style.flex = "1";
        sliderContainer.style.minWidth = `${SLIDER_MIN_WIDTH_PX}px`;
        sliderContainer.style.margin = "0";
        // INF-3736 — no transform nudge needed: railCenterY is now RAIL_HEIGHT/2
        // (true geometric center), so the slider's rail naturally aligns with
        // the flex-centered text labels and the anchor's centerline.
        strip.insertBefore(sliderContainer, ganttCheck);
        lastEnvelope = { p: envelope.pastMonths, f: envelope.futureMonths };
    }

    strip.appendChild(ganttCheck);
    strip.appendChild(tableCheck);
    anchor.appendChild(strip);
    anchor.appendChild(iconHandle.btn);

    return {
        update(envelope, value, scope): void {
            if (lastEnvelope == null
                || lastEnvelope.p !== envelope.pastMonths
                || lastEnvelope.f !== envelope.futureMonths) {
                remountSlider(envelope, value);
            }
            if (scope.filtersGantt !== curScope.filtersGantt) {
                (ganttCheck as HTMLButtonElement & { setActive: (a: boolean) => void }).setActive(scope.filtersGantt);
            }
            if (scope.filtersTable !== curScope.filtersTable) {
                (tableCheck as HTMLButtonElement & { setActive: (a: boolean) => void }).setActive(scope.filtersTable);
            }
            curScope = scope;
            curValue = value;
            applyAutoCollapse();
            updateIndicator();
        },
        setVisible(visible): void {
            anchor.style.display = visible ? "flex" : "none";
        },
        setRightReserve(px: number): void {
            anchor.style.right = (ANCHOR_RIGHT_PX + Math.max(0, px)) + "px";
        },
        setTopOffset(px: number): void {
            anchor.style.top = (ANCHOR_TOP_PX + Math.max(0, px)) + "px";
        },
        element: anchor,
    };
}
