// W1.5c of INF-3730 — Inspector milestone detail.
//
// Rendered when the user clicks a milestone star (or its hit target).
// Shows full milestone metadata: label, type, activity, lane, date,
// optional note. W1.5d will extend this to render Owner / Status /
// Health / External URL when those bindings exist.

import type { RoadmapViewModel } from "../../viewmodel";
import { fmtDate, makeH3, makeP, makeLabeledLine, INSPECTOR_FONT, makeBreadcrumb, OnSelect } from "./shared";

export function renderMilestoneDetail(
    milestoneLabel: string,
    activityName: string,
    vm: RoadmapViewModel,
    onSelect?: OnSelect,
): HTMLElement {
    const root = document.createElement("div");
    root.className = "inspector-milestone";
    root.style.cssText = `font-family:${INSPECTOR_FONT};`;

    // Breadcrumb back to the activity that owns this milestone.
    if (onSelect && activityName) {
        root.appendChild(makeBreadcrumb(activityName, () => {
            onSelect({ kind: "activity", activityName });
        }));
    }

    // Match by label + activity. (label, activity) is a near-unique key in
    // practice; for true uniqueness in pathological data (same label twice
    // on the same activity), we'd need Milestone.id from the click event.
    // Future enhancement: extend Selection to carry milestone.id.
    const milestone = vm.milestones.find(m =>
        (m.label ?? "(unlabeled)") === milestoneLabel && m.activity === activityName,
    );
    if (!milestone) {
        root.appendChild(makeH3(milestoneLabel));
        root.appendChild(makeP(`(milestone not found in current viewmodel: activity=${activityName})`, { muted: true }));
        return root;
    }

    const activity = vm.activities.find(a => a.name === activityName);
    const laneName = activity?.area ?? "(unknown lane)";

    root.appendChild(makeH3(milestone.label ?? "(unlabeled)"));
    root.appendChild(makeP(`${milestone.type} · ${activityName} · ${laneName}`, { muted: true, small: true }));

    const fields = document.createElement("div");
    fields.style.cssText = "margin-top:10px;";

    fields.appendChild(makeLabeledLine("Date:", fmtDate(milestone.date)));

    // v2.1 W1.5d — optional metadata fields. Each only renders when the
    // corresponding well is bound AND the row value is non-null/non-empty.
    if (milestone.status) {
        fields.appendChild(makeLabeledLine("Status:", milestone.status));
    }
    if (milestone.owner) {
        fields.appendChild(makeLabeledLine("Owner:", milestone.owner));
    }
    if (milestone.health) {
        const healthColor =
            /green/i.test(milestone.health) ? "#2ca02c" :
            /yellow|amber/i.test(milestone.health) ? "#e6b800" :
            /red/i.test(milestone.health) ? "#d62728" : "#888";
        const healthDiv = document.createElement("div");
        healthDiv.style.cssText = "margin:0 0 4px 0;font-family:inherit;font-size:12px;color:#222;line-height:1.4;display:flex;align-items:center;gap:6px;";
        const lab = document.createElement("span");
        lab.textContent = "Health:";
        lab.style.cssText = "font-weight:600;color:#555;";
        const dot = document.createElement("span");
        dot.textContent = "\u25cf"; // ●
        dot.style.cssText = `color:${healthColor};font-size:14px;`;
        const val = document.createElement("span");
        val.textContent = milestone.health;
        healthDiv.appendChild(lab);
        healthDiv.appendChild(dot);
        healthDiv.appendChild(val);
        fields.appendChild(healthDiv);
    }
    if (milestone.externalUrl) {
        const linkDiv = document.createElement("div");
        linkDiv.style.cssText = "margin:6px 0 4px 0;font-family:inherit;font-size:12px;line-height:1.4;";
        const link = document.createElement("a");
        link.href = milestone.externalUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Open external link \u2197";
        link.style.cssText = "color:#1968c8;text-decoration:none;";
        link.addEventListener("mouseenter", () => { link.style.textDecoration = "underline"; });
        link.addEventListener("mouseleave", () => { link.style.textDecoration = "none"; });
        linkDiv.appendChild(link);
        fields.appendChild(linkDiv);
    }

    if (milestone.note) {
        const noteWrap = document.createElement("div");
        noteWrap.style.cssText = "margin-top:8px;padding:8px;background:#fafafa;border-left:3px solid #d0d0d0;font-size:12px;line-height:1.5;color:#333;";
        const noteLabel = document.createElement("div");
        noteLabel.textContent = "Notes";
        noteLabel.style.cssText = "font-weight:600;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;";
        noteWrap.appendChild(noteLabel);
        const noteBody = document.createElement("div");
        noteBody.textContent = milestone.note;
        noteWrap.appendChild(noteBody);
        fields.appendChild(noteWrap);
    }

    // W1.5d will append: Status / Owner / Health / External URL rows
    // conditionally based on new optional bindings in the viewmodel.

    root.appendChild(fields);
    return root;
}
