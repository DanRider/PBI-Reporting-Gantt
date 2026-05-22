// v2.1 W1.5c — Inspector shared helpers.
//
// Tiny utilities used by laneDetail / activityDetail / milestoneDetail.
// Date formatting, milestone partitioning by date, basic style constants.

import type { Activity, Milestone } from "../../viewmodel";
import type { Selection } from "../../model/selection";

export const INSPECTOR_FONT = "'Segoe UI', system-ui, sans-serif";

/** Callback handed into each Inspector renderer so the user can navigate
 *  by clicking items WITHIN the panel (e.g. activity row in lane detail
 *  → activity detail; ⬅ breadcrumb → parent). */
export type OnSelect = (sel: Selection) => void;

/** Breadcrumb element that sits at the top of activity / milestone
 *  detail. Click fires onSelect with the parent. Always rendered;
 *  arrow + parent label only. */
export function makeBreadcrumb(parentLabel: string, onClick: () => void): HTMLElement {
    const a = document.createElement("a");
    a.href = "#";
    a.className = "inspector-breadcrumb";
    a.textContent = `\u2190 ${parentLabel}`;
    a.style.cssText = [
        "display:inline-block",
        "margin:0 0 8px 0",
        `font-family:${INSPECTOR_FONT}`,
        "font-size:11px",
        "color:#1968c8",
        "text-decoration:none",
        "cursor:pointer",
    ].join(";");
    a.addEventListener("mouseenter", () => { a.style.textDecoration = "underline"; });
    a.addEventListener("mouseleave", () => { a.style.textDecoration = "none"; });
    a.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
    });
    return a;
}

export function fmtDate(d: Date): string {
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** audit-fix #24e — short numeric form for the lane Inspector activity tile,
 *  where vertical milestone lists need horizontal compactness. "2/15/26". */
export function fmtDateShort(d: Date): string {
    return d.toLocaleDateString(undefined, { year: "2-digit", month: "numeric", day: "numeric" });
}

/** v2.1 audit-fix #18 — relative-time label so users don't do time math
 *  in their head. Past dates → "X ago"; future dates → "X until".
 *  Unit picked by magnitude: <1 wk → days, <8 wks → weeks, else months.
 *  "today" rendered as "today" rather than "0 days". */
export function fmtRelative(date: Date, today: Date): string {
    const ms = date.getTime() - today.getTime();
    const absDays = Math.round(Math.abs(ms) / (1000 * 60 * 60 * 24));
    if (absDays === 0) return "today";
    const isFuture = ms > 0;
    if (absDays < 7) {
        const u = absDays === 1 ? "day" : "days";
        return isFuture ? `${absDays} ${u} until` : `${absDays} ${u} ago`;
    }
    if (absDays < 60) {
        const weeks = Math.round(absDays / 7);
        const u = weeks === 1 ? "wk" : "wks";
        return isFuture ? `${weeks} ${u} until` : `${weeks} ${u} ago`;
    }
    const months = Math.round(absDays / 30);
    const u = months === 1 ? "mo" : "mos";
    return isFuture ? `${months} ${u} until` : `${months} ${u} ago`;
}

// v2.1 audit-fix #22 — chip-preset enum (GalleryTimeRange) +
// computeRangeWindow REMOVED. Replaced by the SliderRange / rangeToWindow
// pair in timeSlider.ts. Lane Inspector now uses a two-thumb quarterly
// slider with Show-All toggle instead of the chip row.

export function makeH3(text: string): HTMLHeadingElement {
    const h = document.createElement("h3");
    h.textContent = text;
    h.style.cssText = `margin:0 0 8px 0;font-family:${INSPECTOR_FONT};font-size:15px;color:#222;`;
    return h;
}

/** v2.1 audit-fix #8 — small color bubble for the inspector. Matches the
 *  bullet next to activity labels on the Gantt rail so the user can
 *  visually correlate panel → rail → table. */
export function makeColorBubble(color: string, size: number = 10): HTMLSpanElement {
    const dot = document.createElement("span");
    dot.style.cssText = [
        "display:inline-block",
        `width:${size}px`,
        `height:${size}px`,
        "border-radius:50%",
        `background:${color}`,
        "flex-shrink:0",
        "vertical-align:middle",
    ].join(";");
    return dot;
}

/** v2.1 audit-fix #8 — hex (#rrggbb) to rgba string with the given alpha.
 *  Used for table row tinting (low-opacity activity/lane color backgrounds). */
export function hexToRgba(hex: string, alpha: number): string {
    const h = hex.replace("#", "");
    if (h.length !== 6) return hex;
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    if ([r, g, b].some(n => Number.isNaN(n))) return hex;
    return `rgba(${r},${g},${b},${alpha})`;
}

export function makeP(text: string, opts?: { muted?: boolean; small?: boolean }): HTMLParagraphElement {
    const p = document.createElement("p");
    p.textContent = text;
    const color = opts?.muted ? "#666" : "#222";
    const size = opts?.small ? "11px" : "12px";
    p.style.cssText = `margin:0 0 6px 0;font-family:${INSPECTOR_FONT};font-size:${size};color:${color};line-height:1.4;`;
    return p;
}

export function makeLabeledLine(prefix: string, body: string): HTMLDivElement {
    const div = document.createElement("div");
    div.style.cssText = `margin:0 0 4px 0;font-family:${INSPECTOR_FONT};font-size:12px;color:#222;line-height:1.4;`;
    const pSpan = document.createElement("span");
    pSpan.textContent = prefix + " ";
    pSpan.style.cssText = "font-weight:600;color:#555;";
    const bSpan = document.createElement("span");
    bSpan.textContent = body;
    div.appendChild(pSpan);
    div.appendChild(bSpan);
    return div;
}

/** Partition milestones for an activity into ✓ most-recent (date <= today) and
 *  ⏭ next-upcoming (date > today). Returns null for either if no qualifying
 *  milestone exists. */
export function partitionMilestones(
    milestones: readonly Milestone[],
    activityName: string,
    today: Date,
): { mostRecent: Milestone | null; next: Milestone | null } {
    let mostRecent: Milestone | null = null;
    let next: Milestone | null = null;
    for (const m of milestones) {
        if (m.activity !== activityName) continue;
        if (m.date.getTime() <= today.getTime()) {
            if (!mostRecent || m.date > mostRecent.date) mostRecent = m;
        } else {
            if (!next || m.date < next.date) next = m;
        }
    }
    return { mostRecent, next };
}

export function activityProgressPct(activity: Activity, today: Date): number {
    const span = activity.end.getTime() - activity.start.getTime();
    if (span <= 0) return today >= activity.end ? 100 : 0;
    const elapsed = today.getTime() - activity.start.getTime();
    if (elapsed <= 0) return 0;
    if (elapsed >= span) return 100;
    return Math.round((elapsed / span) * 100);
}
