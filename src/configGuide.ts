// L4 entry — configuration-guide banner. Renders an in-visual help card
// when required wells are not bound, so a user debugging the visual on
// their own (without an agent looking over their shoulder) sees exactly
// what's missing and what's optional. The card hides itself when the
// v1.8 Gantt has the minimum required wells bound (Activity, Start Date,
// End Date) and lets the Gantt render normally.
//
// Lives at src/ root (L4 entry) per the layer-DAG; it reads DataView
// directly and writes to an HTMLElement passed from visual.ts — not part
// of the rg-matrix substrate render layer.

import powerbi from "powerbi-visuals-api";

type DataView = powerbi.DataView;

interface WellSpec {
    readonly role: string;
    readonly displayName: string;
    readonly required: boolean;
    readonly description: string;
}

// Source of truth for what the Gantt needs vs offers. Mirrors
// capabilities.json dataRoles. Required wells are the v1.8 Gantt
// minimum to render even a single bar; everything else enriches.
const WELLS: readonly WellSpec[] = [
    { role: "activity",           displayName: "Activity",            required: true,  description: "One bar per unique value." },
    { role: "startDate",          displayName: "Start Date",          required: true,  description: "When each bar begins (date column)." },
    { role: "endDate",            displayName: "End Date",            required: true,  description: "When each bar ends (date column)." },
    { role: "area",               displayName: "Swim Lane",           required: false, description: "Optional grouping that segments bars into swim lanes." },
    { role: "milestoneActivity",  displayName: "Milestone Activity",  required: false, description: "FK to parent activity name for each milestone." },
    { role: "milestoneDate",      displayName: "Milestone Date",      required: false, description: "When each milestone marker is placed." },
    { role: "milestoneType",      displayName: "Milestone Type",      required: false, description: "Marker classifier (e.g. 'Major', 'Minor')." },
    { role: "milestoneLabel",     displayName: "Milestone Label",     required: false, description: "Optional milestone text shown next to the marker." },
    { role: "labelPosition",      displayName: "Label Position",      required: false, description: "L | R | none — controls label side per milestone." },
    { role: "activityNote",       displayName: "Activity Note",       required: false, description: "Per-activity status text shown on hover." },
    { role: "milestoneNote",      displayName: "Milestone Note",      required: false, description: "Per-milestone status text shown on hover." },
    { role: "tableActivityRows",  displayName: "Activity (Table)",    required: false, description: "v2.0 — parent row for the optional table region below the Gantt." },
    { role: "tableMilestoneRows", displayName: "Milestone (Table)",   required: false, description: "v2.0 — child rows under each Activity in the table region." },
    { role: "tableValues",        displayName: "Values",              required: false, description: "v2.0 — measure columns for the table region. Required if Activity (Table) is bound." },
];

function isRoleBound(dataView: DataView | undefined, role: string): boolean {
    const cols = dataView?.metadata?.columns ?? [];
    return cols.some(c => c.roles ? c.roles[role] === true : false);
}

// True when the v1.8 minimum (Activity + Start Date + End Date) is bound
// — enough for the Gantt render path to produce something meaningful.
export function ganttRequirementsMet(dataView: DataView | undefined): boolean {
    return isRoleBound(dataView, "activity")
        && isRoleBound(dataView, "startDate")
        && isRoleBound(dataView, "endDate");
}

// Build the guide DOM into the supplied container. Idempotent — clears
// the container's children first. Styling is inline because PBI Desktop's
// iframe blocks external stylesheets reliably and `.less` files only
// apply to the SVG render layer in this codebase.
export function renderConfigurationGuide(container: HTMLElement, dataView: DataView | undefined): void {
    while (container.firstChild) container.removeChild(container.firstChild);

    const card = document.createElement("div");
    card.style.cssText = [
        "max-width: 720px",
        "margin: 24px",
        "padding: 28px 32px",
        "background: #ffffff",
        "border: 1px solid #d6d6d6",
        "border-radius: 8px",
        "box-shadow: 0 4px 16px rgba(0,0,0,0.08)",
        "font-family: 'Segoe UI', system-ui, -apple-system, sans-serif",
        "color: #222",
        "line-height: 1.45",
        "pointer-events: auto",
    ].join(";");

    const requiredBound = ganttRequirementsMet(dataView);
    const missingRequired = WELLS.filter(w => w.required && !isRoleBound(dataView, w.role));

    const heading = document.createElement("h2");
    heading.style.cssText = "margin:0 0 6px 0; font-size:20px; font-weight:600; color:#222;";
    heading.textContent = requiredBound
        ? "Reporting Gantt — well bindings (all required met)"
        : "Reporting Gantt — bind the required wells to render the chart";
    card.appendChild(heading);

    const subtitle = document.createElement("p");
    subtitle.style.cssText = "margin:0 0 16px 0; font-size:13px; color:#666;";
    subtitle.textContent = requiredBound
        ? "The chart is rendering. Optional wells below add features like swim lanes, milestones, notes, and the v2.0 table region."
        : `Required wells not yet bound: ${missingRequired.map(w => w.displayName).join(", ")}. Drag the matching columns from your data model onto the wells in the Build pane.`;
    card.appendChild(subtitle);

    const table = document.createElement("table");
    table.style.cssText = "width:100%; border-collapse:collapse; font-size:13px;";

    const renderSection = (title: string, items: readonly WellSpec[]): void => {
        const sectionRow = document.createElement("tr");
        const sectionCell = document.createElement("td");
        sectionCell.colSpan = 3;
        sectionCell.style.cssText = "padding:14px 0 6px 0; font-weight:600; font-size:11px; color:#888; text-transform:uppercase; letter-spacing:0.04em;";
        sectionCell.textContent = title;
        sectionRow.appendChild(sectionCell);
        table.appendChild(sectionRow);

        items.forEach(w => {
            const bound = isRoleBound(dataView, w.role);
            const tr = document.createElement("tr");
            tr.style.cssText = "border-top:1px solid #f0f0f0;";

            const statusTd = document.createElement("td");
            statusTd.style.cssText = "padding:8px 12px 8px 0; width:24px; font-size:16px; vertical-align:top;";
            statusTd.textContent = bound ? "✓" : (w.required ? "✗" : "○");
            statusTd.style.color = bound ? "#2ca02c" : (w.required ? "#d62728" : "#bbb");
            tr.appendChild(statusTd);

            const nameTd = document.createElement("td");
            nameTd.style.cssText = "padding:8px 12px 8px 0; vertical-align:top; white-space:nowrap; font-weight:" + (w.required ? "600" : "400") + "; color:#222;";
            nameTd.textContent = w.displayName;
            tr.appendChild(nameTd);

            const descTd = document.createElement("td");
            descTd.style.cssText = "padding:8px 0; vertical-align:top; color:#555;";
            descTd.textContent = w.description;
            tr.appendChild(descTd);

            table.appendChild(tr);
        });
    };

    renderSection("Required", WELLS.filter(w => w.required));
    renderSection("Optional — v1.8 enrichment", WELLS.filter(w => !w.required && !w.role.startsWith("table")));
    renderSection("Optional — v2.0 table region", WELLS.filter(w => w.role.startsWith("table")));

    card.appendChild(table);

    const footer = document.createElement("p");
    footer.style.cssText = "margin:16px 0 0 0; font-size:11px; color:#999;";
    footer.textContent = "Reporting Gantt v2.0 — composed timeline + matrix table custom visual. Bind v2.0 wells to mount the table region below the Gantt.";
    card.appendChild(footer);

    container.appendChild(card);
}
