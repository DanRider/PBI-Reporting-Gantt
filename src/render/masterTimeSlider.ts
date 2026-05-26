// Master time slider mount — top chrome row.
// One slider, user-selectable scope. Two pill toggles ([▣ Chart] [▣ Table])
// to the right of the rail let the user pick which regions the window
// filters. Caller passes setVisible() to auto-hide when the slider's
// scope makes it pointless (no scope OR target region hidden).
//
// Uses mountTimeSlider (the reusable library component) in compact mode
// with a grey accent so it doesn't fight the chart for attention.

import { mountTimeSlider } from "./inspector/timeSlider";
import { SliderRange } from "./inspector/timeSliderMath";

// INF-3736 polish — host top:-12 vertically aligns the slider rail center with the toggle row center.
const STRIP_TOP_PX = -12;
const STRIP_Z_INDEX = 11;
const STRIP_MIN_WIDTH = 200;
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
    setBounds(leftPx: number, widthPx: number): void;
    setVisible(visible: boolean): void;
    element: HTMLElement;
}

// INF-3736 — checkbox-style scope toggle. Visually distinct from the
// Gantt/Table pill SLIDERS in topRightControls (which look like switch toggles).
// A real checkbox communicates "binary opt-in", different control class.
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
    // Expose a "set" so the caller can sync from persisted state without firing onClick.
    (btn as HTMLButtonElement & { setActive: (a: boolean) => void }).setActive = (a) => { active = a; restyle(); };
    return btn;
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
        "gap:6px",
    ].join(";");
    host.addEventListener("click", (e) => { e.stopPropagation(); });
    root.appendChild(host);

    // Scope pills — created once, sit to the right of the rail. State sync via setActive.
    let curScope: MasterScope = { filtersGantt: true, filtersTable: true };
    const ganttPill = buildScopeCheckbox("Chart", true, (next) => {
        curScope = { ...curScope, filtersGantt: next };
        options.onScopeChange(curScope);
    });
    const tablePill = buildScopeCheckbox("Table", true, (next) => {
        curScope = { ...curScope, filtersTable: next };
        options.onScopeChange(curScope);
    });

    let lastEnvelope: { p: number; f: number } | null = null;
    let sliderContainer: HTMLElement | null = null;

    function remountSlider(envelope: MasterTimeSliderEnvelope, value: SliderRange): void {
        // Wipe the host's slider region (keep pills, which sit AFTER the slider).
        if (sliderContainer && sliderContainer.parentElement === host) {
            host.removeChild(sliderContainer);
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
        sliderContainer.style.width = "100%";
        sliderContainer.style.margin = "0";
        host.insertBefore(sliderContainer, ganttPill);
        lastEnvelope = { p: envelope.pastQuarters, f: envelope.futureQuarters };
    }

    // Mount pills first; slider gets inserted before them when update() is called.
    host.appendChild(ganttPill);
    host.appendChild(tablePill);

    return {
        update(envelope, value, scope): void {
            if (lastEnvelope == null
                || lastEnvelope.p !== envelope.pastQuarters
                || lastEnvelope.f !== envelope.futureQuarters) {
                remountSlider(envelope, value);
            }
            if (scope.filtersGantt !== curScope.filtersGantt) {
                (ganttPill as HTMLButtonElement & { setActive: (a: boolean) => void }).setActive(scope.filtersGantt);
            }
            if (scope.filtersTable !== curScope.filtersTable) {
                (tablePill as HTMLButtonElement & { setActive: (a: boolean) => void }).setActive(scope.filtersTable);
            }
            curScope = scope;
        },
        setBounds(leftPx, widthPx): void {
            host.style.left = `${leftPx}px`;
            host.style.width = `${Math.max(STRIP_MIN_WIDTH, widthPx)}px`;
        },
        setVisible(visible): void {
            host.style.display = visible ? "flex" : "none";
        },
        element: host,
    };
}
