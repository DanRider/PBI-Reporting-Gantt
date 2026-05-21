// W1.5c of INF-3730 — Inspector lane detail.
//
// Rendered when the user clicks a swim-lane label. Shows the lane name,
// activity + milestone counts, and per-activity ✓ most-recent / ⏭ next
// milestone summary lines.

import type { RoadmapViewModel } from "../../viewmodel";
import { fmtDate, fmtRelative, makeH3, makeP, makeLabeledLine, partitionMilestones, INSPECTOR_FONT, OnSelect, makeBreadcrumb, makeColorBubble } from "./shared";

export function renderLaneDetail(
    laneName: string,
    vm: RoadmapViewModel,
    onSelect?: OnSelect,
    activityColors?: Record<string, string>,
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

    root.appendChild(makeP(
        `${activitiesInLane.length} ${activitiesInLane.length === 1 ? "activity" : "activities"} · ` +
        `${milestonesInLane.length} ${milestonesInLane.length === 1 ? "milestone" : "milestones"}`,
        { muted: true, small: true },
    ));

    if (activitiesInLane.length === 0) {
        root.appendChild(makeP("(no activities in this lane)", { muted: true }));
        return root;
    }

    const today = new Date();
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
        // v2.1 audit-fix #11 — per-activity milestone count badge.
        const activityMilestoneCount = vm.milestones.filter(m => m.activity === activity.name).length;
        if (activityMilestoneCount > 0) {
            const countBadge = document.createElement("span");
            countBadge.textContent = `${activityMilestoneCount}`;
            countBadge.title = `${activityMilestoneCount} milestone${activityMilestoneCount === 1 ? "" : "s"}`;
            countBadge.style.cssText = "font-size:9px;color:#666;background:#eee;padding:1px 5px;border-radius:8px;font-weight:600;flex-shrink:0;";
            nameLine.appendChild(countBadge);
        }
        item.appendChild(nameLine);

        const { mostRecent, next } = partitionMilestones(vm.milestones, activity.name, today);
        const compactLines = document.createElement("div");
        compactLines.style.cssText = "font-size:10px;color:#666;line-height:1.4;";
        // v2.1 audit-fix #18 — relative-time label (e.g. "4 mos ago", "in 2
        // wks") appended to each summary line so the user doesn't do date
        // math in their head.
        if (mostRecent) {
            const d = document.createElement("div");
            d.textContent = `\u2713 ${mostRecent.label ?? "(unlabeled)"} \u00b7 ${fmtDate(mostRecent.date)} \u00b7 ${fmtRelative(mostRecent.date, today)}`;
            compactLines.appendChild(d);
        }
        if (next) {
            const d = document.createElement("div");
            d.textContent = `\u23ed ${next.label ?? "(unlabeled)"} \u00b7 ${fmtDate(next.date)} \u00b7 ${fmtRelative(next.date, today)}`;
            compactLines.appendChild(d);
        }
        if (!mostRecent && !next) {
            const d = document.createElement("div");
            d.textContent = "(no milestones)";
            d.style.fontStyle = "italic";
            compactLines.appendChild(d);
        }
        item.appendChild(compactLines);

        list.appendChild(item);
    }

    root.appendChild(list);
    return root;
}
