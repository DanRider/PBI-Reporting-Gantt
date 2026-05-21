// W1.5c of INF-3730 — Inspector activity detail.
//
// Rendered when the user clicks an activity bar (Gantt) or a table row.
// Shows the activity name, swim lane, start/end dates, progress %, and
// ✓ most-recent / ⏭ next milestone for this activity.

import type { RoadmapViewModel } from "../../viewmodel";
import {
    fmtDate, makeH3, makeP, makeLabeledLine,
    partitionMilestones, activityProgressPct, INSPECTOR_FONT,
} from "./shared";

export function renderActivityDetail(activityName: string, vm: RoadmapViewModel): HTMLElement {
    const root = document.createElement("div");
    root.className = "inspector-activity";
    root.style.cssText = `font-family:${INSPECTOR_FONT};`;

    const activity = vm.activities.find(a => a.name === activityName);
    if (!activity) {
        root.appendChild(makeH3(activityName));
        root.appendChild(makeP("(activity not found in current viewmodel)", { muted: true }));
        return root;
    }

    root.appendChild(makeH3(activity.name));
    root.appendChild(makeP(
        `${activity.area} · ${fmtDate(activity.start)} – ${fmtDate(activity.end)}`,
        { muted: true, small: true },
    ));

    const today = new Date();
    const pct = activityProgressPct(activity, today);

    // Progress bar — visual indicator above the numeric percentage.
    const barOuter = document.createElement("div");
    barOuter.style.cssText = "background:#eee;height:6px;border-radius:3px;overflow:hidden;margin:8px 0 4px 0;";
    const barInner = document.createElement("div");
    barInner.style.cssText = `background:#4a90e2;height:100%;width:${pct}%;transition:width 200ms ease;`;
    barOuter.appendChild(barInner);
    root.appendChild(barOuter);

    const progressLabel = document.createElement("div");
    progressLabel.style.cssText = "font-size:11px;color:#666;margin-bottom:12px;";
    progressLabel.textContent = `Progress: ${pct}% (today: ${fmtDate(today)})`;
    root.appendChild(progressLabel);

    if (activity.note) {
        const noteP = makeP(activity.note);
        noteP.style.cssText += "padding:6px 8px;background:#fafafa;border-left:3px solid #d0d0d0;margin-bottom:10px;";
        root.appendChild(noteP);
    }

    const milestoneSection = document.createElement("div");
    milestoneSection.style.cssText = "margin-top:8px;";

    const { mostRecent, next } = partitionMilestones(vm.milestones, activity.name, today);
    if (mostRecent) {
        milestoneSection.appendChild(makeLabeledLine(
            "\u2713 Most recent:",
            `${mostRecent.label ?? "(unlabeled)"} · ${mostRecent.type} · ${fmtDate(mostRecent.date)}`,
        ));
    } else {
        milestoneSection.appendChild(makeLabeledLine("\u2713 Most recent:", "(none yet)"));
    }
    if (next) {
        milestoneSection.appendChild(makeLabeledLine(
            "\u23ed Next upcoming:",
            `${next.label ?? "(unlabeled)"} · ${next.type} · ${fmtDate(next.date)}`,
        ));
    } else {
        milestoneSection.appendChild(makeLabeledLine("\u23ed Next upcoming:", "(none upcoming)"));
    }

    root.appendChild(milestoneSection);
    return root;
}
