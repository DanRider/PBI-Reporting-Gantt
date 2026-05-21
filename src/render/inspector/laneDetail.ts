// W1.5c of INF-3730 — Inspector lane detail.
//
// Rendered when the user clicks a swim-lane label. Shows the lane name,
// activity + milestone counts, and per-activity ✓ most-recent / ⏭ next
// milestone summary lines.

import type { RoadmapViewModel } from "../../viewmodel";
import { fmtDate, makeH3, makeP, makeLabeledLine, partitionMilestones, INSPECTOR_FONT } from "./shared";

export function renderLaneDetail(laneName: string, vm: RoadmapViewModel): HTMLElement {
    const root = document.createElement("div");
    root.className = "inspector-lane";
    root.style.cssText = `font-family:${INSPECTOR_FONT};`;

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
        item.style.cssText = "margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #eee;";

        const nameLine = document.createElement("div");
        nameLine.textContent = activity.name;
        nameLine.style.cssText = "font-weight:600;font-size:12px;color:#222;margin-bottom:4px;";
        item.appendChild(nameLine);

        const { mostRecent, next } = partitionMilestones(vm.milestones, activity.name, today);
        if (mostRecent) {
            item.appendChild(makeLabeledLine(
                "\u2713",
                `${mostRecent.label ?? "(unlabeled)"} · ${fmtDate(mostRecent.date)}`,
            ));
        } else {
            item.appendChild(makeLabeledLine("\u2713", "(none yet)"));
        }
        if (next) {
            item.appendChild(makeLabeledLine(
                "\u23ed",
                `${next.label ?? "(unlabeled)"} · ${fmtDate(next.date)}`,
            ));
        } else {
            item.appendChild(makeLabeledLine("\u23ed", "(none upcoming)"));
        }

        list.appendChild(item);
    }

    root.appendChild(list);
    return root;
}
