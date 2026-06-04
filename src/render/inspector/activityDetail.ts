// v2.1 audit-fix #17 — activity Inspector with milestone GALLERY.
//
// Replaces the prior ✓ Most-recent / ⏭ Next-upcoming summary with a
// gallery of ALL milestones for the activity, sorted by date. Each
// milestone tile is fronted by a type-colored ★ (matching the top legend's
// Major/Minor stars) + the milestone label + type · date. Clicking a tile
// drills the selection down to that milestone.
//
// Orchestrator: "lets ditch this most recent and next upcoming.... bring
// over the star colors as a legend and lets just make this a styalized
// gallery of all items."

import type { Milestone, RoadmapViewModel } from "../../viewmodel";
import {
    fmtDate, fmtRelative, makeH3, makeP,
    activityProgressPct, INSPECTOR_FONT,
    makeBreadcrumb, OnSelect, makeColorBubble,
    type ProgressBarSource,
} from "./shared";

// INF-3815 — operator-controlled slide-out progress bar behavior. Both
// fields default to current behavior when the caller doesn't supply opts
// (showProgressBar=true, progressBarSource="auto").
export interface ActivityInspectorRenderOptions {
    showProgressBar?: boolean;
    progressBarSource?: ProgressBarSource;
}

// v2.1 audit-fix #20 — time slicer REMOVED from activity Inspector
// (orchestrator: "i ONLY want it at the swim lane level"). The gallery
// here always shows ALL milestones for the activity, ascending by date.

export function renderActivityDetail(
    activityName: string,
    vm: RoadmapViewModel,
    onSelect?: OnSelect,
    activityColors?: Record<string, string>,
    typeColors?: Record<string, string>,
    inspectorOpts?: ActivityInspectorRenderOptions,
): HTMLElement {
    const root = document.createElement("div");
    root.className = "inspector-activity";
    root.style.cssText = `font-family:${INSPECTOR_FONT};`;

    const activity = vm.activities.find(a => a.name === activityName);
    if (!activity) {
        root.appendChild(makeH3(activityName));
        root.appendChild(makeP("(activity not found in current viewmodel)", { muted: true }));
        return root;
    }

    // Breadcrumb back to the lane that owns this activity.
    if (onSelect && activity.area) {
        root.appendChild(makeBreadcrumb(activity.area, () => {
            onSelect({ kind: "lane", laneName: activity.area });
        }));
    }

    // Activity h3 with leading color bubble matching the Gantt rail bullet
    // + the table row tint.
    const h3 = makeH3(activity.name);
    const activityHex = activityColors?.[activity.name];
    if (activityHex) {
        h3.style.display = "flex";
        h3.style.alignItems = "center";
        h3.style.gap = "8px";
        h3.insertBefore(makeColorBubble(activityHex, 12), h3.firstChild);
    }
    root.appendChild(h3);
    root.appendChild(makeP(
        `${activity.area} · ${fmtDate(activity.start)} – ${fmtDate(activity.end)}`,
        { muted: true, small: true },
    ));

    // INF-3815 — operator can hide the progress bar entirely OR switch its
    // source from auto elapsed-time to the user-bound percentComplete column.
    // Defaults preserve the v2.2.0.3 behavior when inspectorOpts is omitted.
    // `today` is hoisted out of the conditional because later code below the
    // progress-bar block (relative-date labels on milestone tiles) reads it.
    const showProgressBar = inspectorOpts?.showProgressBar ?? true;
    const progressBarSource = inspectorOpts?.progressBarSource ?? "auto";
    const today = new Date();
    if (showProgressBar) {
        const pct = activityProgressPct(activity, today, progressBarSource);

        // Progress bar — visual indicator above the numeric percentage.
        const barOuter = document.createElement("div");
        barOuter.style.cssText = "background:#eee;height:6px;border-radius:3px;overflow:hidden;margin:8px 0 4px 0;";
        const barInner = document.createElement("div");
        barInner.style.cssText = `background:#4a90e2;height:100%;width:${pct}%;transition:width 200ms ease;`;
        barOuter.appendChild(barInner);
        root.appendChild(barOuter);

        // Label shows the source — "user field" reveal helps operators sanity
        // check that their bound column is reaching the slide-out.
        const sourceTag = progressBarSource === "userField" && activity.percentComplete != null
            ? "user field"
            : "elapsed time";
        const progressLabel = document.createElement("div");
        progressLabel.style.cssText = "font-size:11px;color:#666;margin-bottom:12px;";
        progressLabel.textContent = `Progress: ${pct}% (${sourceTag}; today: ${fmtDate(today)})`;
        root.appendChild(progressLabel);
    }

    if (activity.note) {
        const noteP = makeP(activity.note);
        noteP.style.cssText += "padding:6px 8px;background:#fafafa;border-left:3px solid #d0d0d0;margin-bottom:10px;";
        root.appendChild(noteP);
    }

    // v2.1 audit-fix #17 — milestone GALLERY shows ALL milestones for the
    // activity, sorted ascending by date. (Slicer moved to lane Inspector
    // per audit-fix #20.)
    const activityMilestones: readonly Milestone[] = vm.milestones
        .filter(m => m.activity === activity.name)
        .slice()
        .sort((a, b) => a.date.getTime() - b.date.getTime());

    const galleryHeading = document.createElement("div");
    galleryHeading.style.cssText = "font-size:11px;font-weight:600;color:#555;letter-spacing:0.04em;text-transform:uppercase;margin:8px 0 6px 0;";
    galleryHeading.textContent = `Milestones (${activityMilestones.length})`;
    root.appendChild(galleryHeading);

    if (activityMilestones.length === 0) {
        const empty = document.createElement("div");
        empty.style.cssText = "font-size:11px;color:#888;font-style:italic;padding:4px 0;";
        empty.textContent = "(no milestones)";
        root.appendChild(empty);
        return root;
    }

    const gallery = document.createElement("ul");
    gallery.style.cssText = "list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:4px;";

    for (const m of activityMilestones) {
        const isPast = m.date.getTime() <= today.getTime();
        const typeHex = typeColors?.[m.type] ?? "#888";

        const tile = document.createElement("li");
        tile.style.cssText = [
            "display:flex",
            "align-items:flex-start",
            "gap:8px",
            "padding:5px 8px",
            "border-radius:4px",
            "background:#fafafa",
            "border:1px solid #eee",
            "transition:background 100ms ease",
            onSelect ? "cursor:pointer" : "cursor:default",
        ].join(";");
        if (onSelect) {
            tile.addEventListener("mouseenter", () => { tile.style.background = "#eef4fb"; });
            tile.addEventListener("mouseleave", () => { tile.style.background = "#fafafa"; });
            tile.addEventListener("click", (e) => {
                e.stopPropagation();
                onSelect({
                    kind: "milestone",
                    milestoneLabel: m.label ?? "(unlabeled)",
                    activityName: activity.name,
                });
            });
        }

        // Colored ★ matching the Gantt legend's type colors.
        const star = document.createElement("span");
        star.textContent = "\u2605"; // ★
        star.style.cssText = `color:${typeHex};font-size:16px;line-height:1;flex-shrink:0;margin-top:1px;`;
        // If the milestone is in the past, show a tiny ✓ overlay-ish
        // affordance via opacity + add a unicode ✓ in front of the label.
        if (isPast) {
            star.style.opacity = "0.75";
        }
        tile.appendChild(star);

        const textWrap = document.createElement("div");
        textWrap.style.cssText = "display:flex;flex-direction:column;gap:1px;min-width:0;flex:1;";

        const label = document.createElement("div");
        label.textContent = `${isPast ? "\u2713 " : ""}${m.label ?? "(unlabeled)"}`;
        label.style.cssText = "font-size:11px;font-weight:600;color:#222;line-height:1.3;overflow:hidden;text-overflow:ellipsis;";
        textWrap.appendChild(label);

        // v2.1 audit-fix #19 — meta line with visual hierarchy. Type +
        // em-dash + relative-time (medium) + date in parens (light).
        // Single em-dash per line; date as supporting fine-print.
        const meta = document.createElement("div");
        meta.style.cssText = "font-size:10px;line-height:1.3;";
        const typeSpan = document.createElement("span");
        typeSpan.textContent = m.type;
        typeSpan.style.color = "#666";
        meta.appendChild(typeSpan);
        const dashSpan = document.createElement("span");
        dashSpan.textContent = " \u2014 ";
        dashSpan.style.color = "#bbb";
        meta.appendChild(dashSpan);
        const relSpan = document.createElement("span");
        relSpan.textContent = fmtRelative(m.date, today);
        relSpan.style.color = "#666";
        meta.appendChild(relSpan);
        const dateSpan = document.createElement("span");
        dateSpan.textContent = ` (${fmtDate(m.date)})`;
        dateSpan.style.color = "#999";
        meta.appendChild(dateSpan);
        textWrap.appendChild(meta);

        if (m.note) {
            const note = document.createElement("div");
            note.textContent = m.note;
            note.style.cssText = "font-size:10px;color:#777;font-style:italic;line-height:1.35;margin-top:2px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;";
            textWrap.appendChild(note);
        }

        tile.appendChild(textWrap);
        gallery.appendChild(tile);
    }

    root.appendChild(gallery);
    return root;
}
