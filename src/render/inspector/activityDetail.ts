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
    GalleryTimeRange, computeRangeWindow,
} from "./shared";

const RANGE_PRESETS: ReadonlyArray<readonly [GalleryTimeRange, string]> = [
    ["past-qtr",  "Past Qtr"],
    ["both-qtrs", "\u00b11 Qtr"],
    ["next-qtr",  "Next Qtr"],
    ["all",       "All"],
];

export function renderActivityDetail(
    activityName: string,
    vm: RoadmapViewModel,
    onSelect?: OnSelect,
    activityColors?: Record<string, string>,
    typeColors?: Record<string, string>,
    galleryRange?: GalleryTimeRange,
    onGalleryRangeChange?: (next: GalleryTimeRange) => void,
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

    // v2.1 audit-fix #18 — time slicer preset chips. Filters the gallery
    // only (not Gantt / table). Default = "both-qtrs" (±1 Qtr).
    const activeRange: GalleryTimeRange = galleryRange ?? "both-qtrs";
    const window = computeRangeWindow(activeRange, today);

    const slicerRow = document.createElement("div");
    slicerRow.style.cssText = "display:flex;gap:4px;align-items:center;margin:8px 0 6px 0;flex-wrap:wrap;";
    const slicerLabel = document.createElement("span");
    slicerLabel.textContent = "Window:";
    slicerLabel.style.cssText = "font-size:10px;color:#666;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;margin-right:4px;";
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
            "cursor:pointer",
            "border:1px solid " + (isActive ? "#1968c8" : "#ccc"),
            "background:" + (isActive ? "#e6f0fb" : "#ffffff"),
            "color:" + (isActive ? "#1968c8" : "#555"),
            "font-weight:" + (isActive ? "600" : "400"),
        ].join(";");
        if (onGalleryRangeChange && !isActive) {
            chip.addEventListener("click", (e) => {
                e.stopPropagation();
                onGalleryRangeChange(rangeKey);
            });
        } else if (isActive) {
            chip.style.cursor = "default";
        }
        slicerRow.appendChild(chip);
    }
    root.appendChild(slicerRow);

    // v2.1 audit-fix #17/18 — milestone GALLERY. Filter to this activity
    // AND the slicer window. Sort ascending by date.
    const activityMilestones: readonly Milestone[] = vm.milestones
        .filter(m => m.activity === activity.name)
        .filter(m => m.date.getTime() >= window.fromMs && m.date.getTime() <= window.toMs)
        .slice()
        .sort((a, b) => a.date.getTime() - b.date.getTime());

    // Show total vs windowed count so user knows the slicer is filtering.
    const totalForActivity = vm.milestones.filter(m => m.activity === activity.name).length;
    const headingText = activeRange === "all" || activityMilestones.length === totalForActivity
        ? `Milestones (${activityMilestones.length})`
        : `Milestones (${activityMilestones.length} of ${totalForActivity})`;

    const galleryHeading = document.createElement("div");
    galleryHeading.style.cssText = "font-size:11px;font-weight:600;color:#555;letter-spacing:0.04em;text-transform:uppercase;margin:0 0 6px 0;";
    galleryHeading.textContent = headingText;
    root.appendChild(galleryHeading);

    if (activityMilestones.length === 0) {
        const empty = document.createElement("div");
        empty.style.cssText = "font-size:11px;color:#888;font-style:italic;padding:4px 0;";
        empty.textContent = totalForActivity === 0 ? "(no milestones)" : "(none in selected window)";
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

        // v2.1 audit-fix #18 — meta line includes relative-time so the
        // user doesn't compute "how far away is this?" in their head.
        const meta = document.createElement("div");
        meta.textContent = `${m.type} · ${fmtDate(m.date)} · ${fmtRelative(m.date, today)}`;
        meta.style.cssText = "font-size:10px;color:#666;line-height:1.3;";
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
