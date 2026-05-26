// v2.1 W1.5c — Inspector lane detail.
//
// Rendered when the user clicks a swim-lane label. Shows the lane name,
// activity + milestone counts, and a sorted milestone list per activity.
//
// INF-3736: the lane Inspector's own time slider was removed when the
// master slider gained scope toggles (the dual-slider UX was redundant).
// vm arriving here is already filtered by the master slider where
// applicable; this view just renders what's in it.

import type { RoadmapViewModel } from "../../viewmodel";
import {
    fmtDateShort, fmtRelative, makeH3, makeP,
    INSPECTOR_FONT, OnSelect, makeBreadcrumb, makeColorBubble,
} from "./shared";
import { pluralize } from "../../utils/bindingNames";

export function renderLaneDetail(
    laneName: string,
    vm: RoadmapViewModel,
    onSelect?: OnSelect,
    activityColors?: Record<string, string>,
    // v2.2 T2 + S2 — bound-field nouns for the count summary line. Caller
    // (visual.ts) passes bindingDisplayName("activity", ...) /
    // bindingDisplayName("milestoneActivity", ...) so labels reflect the
    // user's column names ("Initiative" / "Milestone"). Optional for
    // backward compat — undefined falls back to "activity" / "milestone".
    activityNoun?: string,
    milestoneNoun?: string,
): HTMLElement {
    const root = document.createElement("div");
    root.className = "inspector-lane";
    root.style.cssText = `font-family:${INSPECTOR_FONT};`;

    if (onSelect) {
        root.appendChild(makeBreadcrumb("All lanes", () => {
            onSelect({ kind: "none" });
        }));
    }

    root.appendChild(makeH3(laneName));

    const activitiesInLane = vm.activities.filter(a => a.area === laneName);
    const activityNamesInLane = new Set(activitiesInLane.map(a => a.name));
    const milestonesInLane = vm.milestones.filter(m => activityNamesInLane.has(m.activity));
    const today = new Date();

    // v2.2 T2 + S2 — use bound-field nouns when available, fall back to
    // generic "activity" / "milestone" otherwise.
    const aNoun = activityNoun ?? "activity";
    const mNoun = milestoneNoun ?? "milestone";
    const aText = activitiesInLane.length === 1 ? aNoun : pluralize(aNoun);
    const mText = milestonesInLane.length === 1 ? mNoun : pluralize(mNoun);
    root.appendChild(makeP(
        `${activitiesInLane.length} ${aText} · ${milestonesInLane.length} ${mText}`,
        { muted: true, small: true },
    ));

    if (activitiesInLane.length === 0) {
        root.appendChild(makeP("(no activities in this lane)", { muted: true }));
        return root;
    }

    const list = document.createElement("div");
    list.style.cssText = "margin-top:10px;";

    for (const activity of activitiesInLane) {
        const item = document.createElement("div");
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
        const myMs = vm.milestones
            .filter(m => m.activity === activity.name)
            .slice()
            .sort((a, b) => a.date.getTime() - b.date.getTime());
        if (myMs.length > 0) {
            const countBadge = document.createElement("span");
            countBadge.textContent = `${myMs.length}`;
            countBadge.title = `${myMs.length} milestone${myMs.length === 1 ? "" : "s"}`;
            countBadge.style.cssText = "font-size:9px;color:#666;background:#eee;padding:1px 5px;border-radius:8px;font-weight:600;flex-shrink:0;";
            nameLine.appendChild(countBadge);
        }
        item.appendChild(nameLine);

        const compactLines = document.createElement("div");
        compactLines.style.cssText = "font-size:10px;line-height:1.5;";

        const buildSummaryLine = (icon: string, iconColor: string, label: string, date: Date): HTMLDivElement => {
            const d = document.createElement("div");
            const iconSpan = document.createElement("span");
            iconSpan.textContent = `${icon} `;
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
            dateEl.textContent = ` (${fmtDateShort(date)})`;
            dateEl.style.color = "#999";
            d.appendChild(dateEl);
            return d;
        };

        const dimColor = activityHex ?? "#666";
        for (const m of myMs) {
            const isPast = m.date.getTime() <= today.getTime();
            compactLines.appendChild(buildSummaryLine(
                isPast ? "\u2713" : "\u23ed",
                isPast ? "#666" : dimColor,
                m.label ?? "(unlabeled)",
                m.date,
            ));
        }
        if (myMs.length === 0) {
            const d = document.createElement("div");
            d.textContent = "(no milestones)";
            d.style.cssText = "font-style:italic;color:#888;";
            compactLines.appendChild(d);
        }
        item.appendChild(compactLines);
        list.appendChild(item);
    }

    root.appendChild(list);
    return root;
}
