// W1.5c of INF-3730 — Inspector lane detail.
//
// Rendered when the user clicks a swim-lane label. Shows the lane name,
// activity + milestone counts, and per-activity ✓ most-recent / ⏭ next
// milestone summary lines.

import type { Milestone, RoadmapViewModel } from "../../viewmodel";
import {
    fmtDate, fmtRelative, makeH3, makeP, makeLabeledLine,
    INSPECTOR_FONT, OnSelect, makeBreadcrumb, makeColorBubble,
    GalleryTimeRange, computeRangeWindow,
} from "./shared";

const RANGE_PRESETS: ReadonlyArray<readonly [GalleryTimeRange, string]> = [
    ["past-qtr",  "Past Qtr"],
    ["both-qtrs", "\u00b11 Qtr"],
    ["next-qtr",  "Next Qtr"],
    ["all",       "All"],
];

export function renderLaneDetail(
    laneName: string,
    vm: RoadmapViewModel,
    onSelect?: OnSelect,
    activityColors?: Record<string, string>,
    timeRange?: GalleryTimeRange,
    onTimeRangeChange?: (next: GalleryTimeRange) => void,
): HTMLElement {
    const root = document.createElement("div");
    root.className = "inspector-lane";
    root.style.cssText = `font-family:${INSPECTOR_FONT};`;

    // Breadcrumb back to the unfiltered "all lanes" view.
    if (onSelect) {
        root.appendChild(makeBreadcrumb("All lanes", () => {
            onSelect({ kind: "none" });
        }));
    }

    root.appendChild(makeH3(laneName));

    const activitiesInLane = vm.activities.filter(a => a.area === laneName);
    const activityNamesInLane = new Set(activitiesInLane.map(a => a.name));
    const milestonesInLane = vm.milestones.filter(m => activityNamesInLane.has(m.activity));

    // v2.1 audit-fix #20 — time slicer at the LANE level. Filters which
    // milestones appear in the per-activity ✓ / ⏭ summary lines AND in
    // the count badges. Default "±1 Qtr". Affects only this panel; main
    // Gantt + table are unchanged.
    const today = new Date();
    const activeRange: GalleryTimeRange = timeRange ?? "both-qtrs";
    const window = computeRangeWindow(activeRange, today);
    const inWindow = (m: Milestone): boolean =>
        m.date.getTime() >= window.fromMs && m.date.getTime() <= window.toMs;
    const milestonesInLaneWindowed = milestonesInLane.filter(inWindow);

    root.appendChild(makeP(
        `${activitiesInLane.length} ${activitiesInLane.length === 1 ? "activity" : "activities"} · ` +
        `${milestonesInLaneWindowed.length} of ${milestonesInLane.length} ` +
        `${milestonesInLane.length === 1 ? "milestone" : "milestones"} in window`,
        { muted: true, small: true },
    ));

    const slicerRow = document.createElement("div");
    slicerRow.style.cssText = "display:flex;gap:4px;align-items:center;margin:6px 0 10px 0;flex-wrap:wrap;";
    const slicerLabel = document.createElement("span");
    slicerLabel.textContent = "WINDOW:";
    slicerLabel.style.cssText = "font-size:9px;color:#666;font-weight:600;letter-spacing:0.04em;margin-right:4px;";
    slicerRow.appendChild(slicerLabel);
    for (const [rangeKey, labelText] of RANGE_PRESETS) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.textContent = labelText;
        const isActive = activeRange === rangeKey;
        chip.style.cssText = [
            "padding:2px 8px",
            "font-size:10px",
            "line-height:1.3",
            "border-radius:10px",
            "cursor:" + (isActive ? "default" : "pointer"),
            "border:1px solid " + (isActive ? "#1968c8" : "#ccc"),
            "background:" + (isActive ? "#e6f0fb" : "#ffffff"),
            "color:" + (isActive ? "#1968c8" : "#555"),
            "font-weight:" + (isActive ? "600" : "400"),
        ].join(";");
        if (onTimeRangeChange && !isActive) {
            chip.addEventListener("click", (e) => {
                e.stopPropagation();
                onTimeRangeChange(rangeKey);
            });
        }
        slicerRow.appendChild(chip);
    }
    root.appendChild(slicerRow);

    if (activitiesInLane.length === 0) {
        root.appendChild(makeP("(no activities in this lane)", { muted: true }));
        return root;
    }

    const list = document.createElement("div");
    list.style.cssText = "margin-top:10px;";

    for (const activity of activitiesInLane) {
        const item = document.createElement("div");
        // v2.1 audit-fix — compact, clickable activity row in the lane
        // Inspector. Click narrows focus to that activity; the activity
        // detail will render with a "← {laneName}" breadcrumb back.
        const isClickable = onSelect != null;
        item.style.cssText = [
            "margin-bottom:6px",
            "padding:4px 6px",
            "border-bottom:1px solid #f0f0f0",
            "border-radius:3px",
            isClickable ? "cursor:pointer" : "cursor:default",
            "transition:background 100ms ease",
        ].join(";");
        if (isClickable) {
            item.addEventListener("mouseenter", () => { item.style.background = "#f4f7fb"; });
            item.addEventListener("mouseleave", () => { item.style.background = "transparent"; });
            item.addEventListener("click", (e) => {
                e.stopPropagation();
                onSelect!({ kind: "activity", activityName: activity.name });
            });
        }

        // v2.1 audit-fix #8 — color bubble next to each activity name in the
        // lane Inspector. Matches the bullet on the Gantt rail + table tint.
        const nameLine = document.createElement("div");
        nameLine.style.cssText = "display:flex;align-items:center;gap:6px;margin-bottom:2px;line-height:1.3;";
        const activityHex = activityColors?.[activity.name];
        if (activityHex) {
            nameLine.appendChild(makeColorBubble(activityHex, 8));
        }
        const nameSpan = document.createElement("span");
        nameSpan.textContent = activity.name;
        nameSpan.style.cssText = "font-weight:600;font-size:11px;color:#222;flex:1;";
        nameLine.appendChild(nameSpan);
        // v2.1 audit-fix #20 — count badge reflects the WINDOW count (vs
        // total) so the user knows the slicer is filtering this activity.
        // Format: "3" if all milestones are in window, "1/3" if filtered.
        const activityMilestonesAll = vm.milestones.filter(m => m.activity === activity.name);
        const activityMilestonesWindowed = activityMilestonesAll.filter(inWindow);
        if (activityMilestonesAll.length > 0) {
            const countBadge = document.createElement("span");
            const inWin = activityMilestonesWindowed.length;
            const total = activityMilestonesAll.length;
            countBadge.textContent = inWin === total ? `${total}` : `${inWin}/${total}`;
            countBadge.title = inWin === total
                ? `${total} milestone${total === 1 ? "" : "s"}`
                : `${inWin} of ${total} milestone${total === 1 ? "" : "s"} in current window`;
            countBadge.style.cssText = "font-size:9px;color:#666;background:#eee;padding:1px 5px;border-radius:8px;font-weight:600;flex-shrink:0;";
            nameLine.appendChild(countBadge);
        }
        item.appendChild(nameLine);

        // v2.1 audit-fix #20 — partition within the SLICER WINDOW.
        // Most-recent = latest in-window past milestone for this activity.
        // Next-upcoming = earliest in-window future milestone for this activity.
        const myMs = activityMilestonesWindowed;
        let mostRecent: Milestone | null = null;
        let next: Milestone | null = null;
        for (const m of myMs) {
            if (m.date.getTime() <= today.getTime()) {
                if (!mostRecent || m.date > mostRecent.date) mostRecent = m;
            } else {
                if (!next || m.date < next.date) next = m;
            }
        }
        const compactLines = document.createElement("div");
        compactLines.style.cssText = "font-size:10px;line-height:1.5;";

        const buildSummaryLine = (icon: string, iconColor: string, label: string, date: Date): HTMLDivElement => {
            const d = document.createElement("div");
            const iconSpan = document.createElement("span");
            iconSpan.textContent = `${icon} `;
            // v2.1 audit-fix #20 — ⏭ gets the activity's dimension color
            // (spider-web weaving — same color as the bubble + rail bullet
            // + table tint + bar). ✓ stays muted (past, less actionable).
            iconSpan.style.color = iconColor;
            iconSpan.style.fontWeight = "600";
            d.appendChild(iconSpan);

            const labelEl = document.createElement("strong");
            labelEl.textContent = label;
            labelEl.style.cssText = "color:#222;font-weight:600;";
            d.appendChild(labelEl);

            const dashEl = document.createElement("span");
            dashEl.textContent = " \u2014 ";
            dashEl.style.color = "#bbb";
            d.appendChild(dashEl);

            const relEl = document.createElement("span");
            relEl.textContent = fmtRelative(date, today);
            relEl.style.color = "#666";
            d.appendChild(relEl);

            const dateEl = document.createElement("span");
            dateEl.textContent = ` (${fmtDate(date)})`;
            dateEl.style.color = "#999";
            d.appendChild(dateEl);

            return d;
        };

        const dimColor = activityHex ?? "#666";
        if (mostRecent) {
            compactLines.appendChild(buildSummaryLine("\u2713", "#666", mostRecent.label ?? "(unlabeled)", mostRecent.date));
        }
        if (next) {
            // ⏭ uses the activity's dimension color to weave the legend.
            compactLines.appendChild(buildSummaryLine("\u23ed", dimColor, next.label ?? "(unlabeled)", next.date));
        }
        if (!mostRecent && !next) {
            const d = document.createElement("div");
            d.textContent = activityMilestonesAll.length > 0
                ? "(none in window)"
                : "(no milestones)";
            d.style.cssText = "font-style:italic;color:#888;";
            compactLines.appendChild(d);
        }
        item.appendChild(compactLines);

        list.appendChild(item);
    }

    root.appendChild(list);
    return root;
}
