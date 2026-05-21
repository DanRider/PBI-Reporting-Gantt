// L3 render — minimal HTML table for the v2.0 composed-visual bottom region.
// Renders directly from dataView.table.rows (the existing v1.8 binding shape),
// so the matrix region mounts below the Gantt WITHOUT needing additional
// wells bound. The full cortex-matrix substrate renderer can replace this
// later once matrix-shaped well bindings are wired; for now this gets the
// composed visual visibly working in PBI Desktop.

import powerbi from "powerbi-visuals-api";

type DataView = powerbi.DataView;
type Row = powerbi.DataViewTableRow;
type Col = powerbi.DataViewMetadataColumn;

const STRIPE_ODD = "#ffffff";
const STRIPE_EVEN = "#fafafa";
const HOVER_BG = "#e8f3ff";

function formatCell(cell: powerbi.PrimitiveValue, col: Col | undefined): { text: string; align: "left" | "right" } {
    if (cell == null) return { text: "", align: "left" };
    if (col?.type?.dateTime) {
        const d = new Date(String(cell));
        if (!isNaN(d.getTime())) {
            return { text: d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }), align: "left" };
        }
    }
    if (col?.type?.numeric) {
        return { text: String(cell), align: "right" };
    }
    return { text: String(cell), align: "left" };
}

export interface SimpleTableOptions {
    /** Called when the user clicks a row. The activity name is resolved
     *  from the row's "Activity" column (case-insensitive name match).
     *  If the row doesn't have an identifiable Activity value, the
     *  callback is NOT invoked. Click also stopPropagation's so it
     *  doesn't bubble to the root-level whitespace handler. */
    readonly onSelectActivity?: (activityName: string) => void;
}

function buildRow(
    row: Row,
    rowIndex: number,
    cols: readonly Col[],
    activityColIndex: number,
    onSelectActivity: ((activityName: string) => void) | undefined,
): HTMLTableRowElement {
    const tr = document.createElement("tr");
    const baseBg = rowIndex % 2 === 0 ? STRIPE_ODD : STRIPE_EVEN;
    tr.style.cssText = `border-bottom:1px solid #f0f0f0; background:${baseBg}; cursor:${onSelectActivity ? "pointer" : "default"};`;
    // Hover handlers attached EVERY row build (initial + re-renders after
    // sort) so the highlight persists across sort interactions.
    tr.addEventListener("mouseenter", () => { tr.style.background = HOVER_BG; });
    tr.addEventListener("mouseleave", () => { tr.style.background = baseBg; });
    // v2.1 W1.5b — selection: clicking the row sets activity selection.
    // stopPropagation so the click doesn't bubble to root and clear.
    if (onSelectActivity && activityColIndex >= 0) {
        tr.addEventListener("click", (e) => {
            e.stopPropagation();
            const activityName = String(row[activityColIndex] ?? "").trim();
            if (activityName) onSelectActivity(activityName);
        });
    }

    row.forEach((cell, ci) => {
        const td = document.createElement("td");
        const { text, align } = formatCell(cell, cols[ci]);
        td.style.cssText = `padding:6px 12px; border-right:1px solid #f4f4f4; vertical-align:top; text-align:${align};`;
        td.textContent = text;
        tr.appendChild(td);
    });
    return tr;
}

function renderBody(
    tbody: HTMLTableSectionElement,
    rows: readonly Row[],
    cols: readonly Col[],
    activityColIndex: number,
    onSelectActivity: ((activityName: string) => void) | undefined,
): void {
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
    rows.forEach((row, ri) => tbody.appendChild(buildRow(row, ri, cols, activityColIndex, onSelectActivity)));
}

export function renderSimpleTable(
    container: HTMLElement,
    dataView: DataView | undefined,
    options?: SimpleTableOptions,
): void {
    while (container.firstChild) container.removeChild(container.firstChild);

    const cols = dataView?.table?.columns ?? [];
    const rows = dataView?.table?.rows ?? [];
    if (cols.length === 0) {
        const empty = document.createElement("div");
        empty.style.cssText = "padding:24px; color:#888; font-family:'Segoe UI', system-ui, sans-serif; font-size:13px;";
        empty.textContent = "No table data available — bind the Gantt wells to populate the detail table.";
        container.appendChild(empty);
        return;
    }

    const table = document.createElement("table");
    table.style.cssText = [
        "width: 100%",
        "border-collapse: collapse",
        "font-family: 'Segoe UI', system-ui, sans-serif",
        "font-size: 12px",
        "color: #222",
    ].join(";");

    // Header row — sticky so it stays pinned to the top of matrixDiv when
    // the table scrolls vertically. position:sticky on each <th> (not the
    // <tr>) is the reliable cross-browser pattern; background MUST live on
    // the th so it stays opaque over scrolling rows underneath.
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const headerCells: HTMLTableCellElement[] = [];
    cols.forEach((col, i) => {
        const th = document.createElement("th");
        th.style.cssText = [
            "position:sticky",
            "top:0",
            "z-index:5",
            "padding:8px 12px",
            "text-align:left",
            "font-weight:600",
            "color:#444",
            "background:#f5f5f7",
            "border-right:1px solid #e6e6e6",
            "border-bottom:2px solid #d0d0d0",
            "white-space:nowrap",
            "cursor:pointer",
            "user-select:none",
        ].join(";");
        th.textContent = col.displayName || `Column ${i + 1}`;
        th.dataset.colIndex = String(i);
        headerRow.appendChild(th);
        headerCells.push(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // v2.1 W1.5b — find the "Activity" column once at render time. The
    // table is bound with two role groups (activity-side + milestone-side)
    // each carrying an Activity column; either is acceptable for selection.
    // Case-insensitive name match — works without forcing capabilities.json
    // to declare a `roles.activity` flag.
    const activityColIndex = cols.findIndex(c => /^activity$/i.test(c.displayName ?? ""));
    const onSelectActivity = options?.onSelectActivity;

    // Body rows (initial render)
    const tbody = document.createElement("tbody");
    renderBody(tbody, rows, cols, activityColIndex, onSelectActivity);
    table.appendChild(tbody);

    // Sort handler — click a header to sort by that column ascending; click
    // the same header again to reverse. Re-renders the body via the shared
    // buildRow helper so hover handlers are attached on the new rows too.
    const sortState: { col: number; asc: boolean } = { col: -1, asc: true };
    headerCells.forEach((th, _i) => {
        th.addEventListener("click", () => {
            const idx = parseInt(th.dataset.colIndex || "0", 10);
            sortState.asc = sortState.col === idx ? !sortState.asc : true;
            sortState.col = idx;
            const sorted: Row[] = [...rows].sort((a, b) => {
                const av = a[idx], bv = b[idx];
                if (av == null && bv == null) return 0;
                if (av == null) return 1;
                if (bv == null) return -1;
                const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
                return sortState.asc ? cmp : -cmp;
            });
            renderBody(tbody, sorted, cols, activityColIndex, onSelectActivity);
            // Update header sort indicators
            headerCells.forEach((h, hi) => {
                const baseName = cols[hi]?.displayName || `Column ${hi + 1}`;
                h.textContent = hi === idx ? `${baseName} ${sortState.asc ? "▲" : "▼"}` : baseName;
            });
        });
    });

    container.appendChild(table);
}
