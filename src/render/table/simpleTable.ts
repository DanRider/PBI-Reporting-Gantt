// L3 render — minimal HTML table for the v2.0 composed-visual bottom region.
// Renders directly from dataView.table.rows (the existing v1.8 binding shape),
// so the matrix region mounts below the Gantt WITHOUT needing additional
// wells bound. The full rg-matrix substrate renderer can replace this
// later once matrix-shaped well bindings are wired; for now this gets the
// composed visual visibly working in PBI Desktop.

import powerbi from "powerbi-visuals-api";
import { indexMap } from "../../columns";

type DataView = powerbi.DataView;
type Row = powerbi.DataViewTableRow;
type Col = powerbi.DataViewMetadataColumn;

const STRIPE_ODD = "#ffffff";
const STRIPE_EVEN = "#fafafa";
const HOVER_BG = "#e8f3ff";
// v2.1 audit-fix #10 — selection signal is now activity-color (no blue
// override). Stronger alpha + left edge stripe preserves the row's
// identity color while clearly indicating "this is the selected one."
const TINT_ALPHA_LO = 0.10;
const TINT_ALPHA_HI = 0.14;
const TINT_ALPHA_SELECTED = 0.30;
const SELECTED_BORDER_PX = 4;

function hexToRgba(hex: string, alpha: number): string {
    const h = hex.replace("#", "");
    if (h.length !== 6) return hex;
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    if ([r, g, b].some(n => Number.isNaN(n))) return hex;
    return `rgba(${r},${g},${b},${alpha})`;
}

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
    /** v2.1 audit-fix — when set, ONLY rows whose Activity column matches
     *  one of these names are rendered. When undefined, all rows render. */
    readonly filterActivityNames?: readonly string[];
    /** v2.1 audit-fix — when set, ONLY rows whose Area column matches
     *  one of these areas are rendered. Combined with filterActivityNames
     *  by intersection — a row passes only if it passes BOTH filters.
     *  When undefined, the area filter is bypassed. */
    readonly filterAreaNames?: readonly string[];
    /** v2.1 audit-fix — visual breadcrumb. Row whose Activity column
     *  matches this name gets a stronger background tint. */
    readonly highlightActivityName?: string;
    /** v2.1 audit-fix #8 — row background tint by activity color (lane
     *  focus) OR by area color (default). Map keyed by exact column value.
     *  Each row gets a low-opacity background; alternating opacity within
     *  the same group gives band texture without big solid color blocks. */
    readonly rowTintByActivity?: Record<string, string>;
    readonly rowTintByArea?: Record<string, string>;
    /** audit-fix #24g — when set, rows whose Milestone Date column falls
     *  OUTSIDE [fromMs, toMs] are filtered out. Drives the Inspector lane
     *  slider's window into the table when a lane is focused. */
    readonly filterMilestoneDateMs?: { fromMs: number; toMs: number };
}

function buildRow(
    row: Row,
    rowIndex: number,
    cols: readonly Col[],
    activityColIndex: number,
    areaColIndex: number,
    indexWithinGroup: number,
    onSelectActivity: ((activityName: string) => void) | undefined,
    highlightActivityName: string | undefined,
    rowTintByActivity: Record<string, string> | undefined,
    rowTintByArea: Record<string, string> | undefined,
): HTMLTableRowElement {
    const tr = document.createElement("tr");
    const rowActivity = activityColIndex >= 0 ? String(row[activityColIndex] ?? "").trim() : "";
    const rowArea = areaColIndex >= 0 ? String(row[areaColIndex] ?? "").trim() : "";
    const isHighlighted = highlightActivityName != null && rowActivity === highlightActivityName;

    // v2.1 audit-fix #10 — tint logic with within-group alternation.
    // Selection NO LONGER swaps to blue background — it bumps the same tint
    // color to a stronger alpha + adds a 4px left-edge stripe so the row's
    // identity color is preserved. Alternation indexes by position within
    // the same-color group (not global row index), so group boundaries don't
    // create the bacon-stripe effect.
    const tintHex = (rowTintByActivity && rowActivity && rowTintByActivity[rowActivity])
        ?? (rowTintByArea && rowArea && rowTintByArea[rowArea])
        ?? null;
    let baseBg: string;
    let borderLeftCss = "";
    if (tintHex) {
        const alpha = isHighlighted
            ? TINT_ALPHA_SELECTED
            : (indexWithinGroup % 2 === 0 ? TINT_ALPHA_LO : TINT_ALPHA_HI);
        baseBg = hexToRgba(tintHex, alpha);
        if (isHighlighted) {
            borderLeftCss = `border-left:${SELECTED_BORDER_PX}px solid ${tintHex};`;
        }
    } else {
        baseBg = rowIndex % 2 === 0 ? STRIPE_ODD : STRIPE_EVEN;
    }
    tr.style.cssText = `background:${baseBg}; ${borderLeftCss} cursor:${onSelectActivity ? "pointer" : "default"}; height:18px;`;
    tr.addEventListener("mouseenter", () => { tr.style.background = HOVER_BG; });
    tr.addEventListener("mouseleave", () => { tr.style.background = baseBg; });
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
        // v2.1 audit-fix — compact paddings, tighter line-height, no
        // right-border (visual noise on a dense P&L grid).
        td.style.cssText = `padding:2px 6px; vertical-align:middle; text-align:${align}; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;`;
        td.textContent = text;
        td.title = text;
        tr.appendChild(td);
    });
    return tr;
}

function renderBody(
    tbody: HTMLTableSectionElement,
    rows: readonly Row[],
    cols: readonly Col[],
    activityColIndex: number,
    areaColIndex: number,
    onSelectActivity: ((activityName: string) => void) | undefined,
    highlightActivityName: string | undefined,
    rowTintByActivity: Record<string, string> | undefined,
    rowTintByArea: Record<string, string> | undefined,
): void {
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
    // v2.1 audit-fix #10 — count rows within each same-color group so the
    // alternation parity resets at group boundaries. "Same color group"
    // means same activity (lane focus) or same area (default mode). Reset
    // detection uses the resolved group-key per row.
    let prevGroupKey: string | null = null;
    let indexWithinGroup = 0;
    rows.forEach((row, ri) => {
        const rowActivity = activityColIndex >= 0 ? String(row[activityColIndex] ?? "").trim() : "";
        const rowArea = areaColIndex >= 0 ? String(row[areaColIndex] ?? "").trim() : "";
        const groupKey = (rowTintByActivity && rowActivity && rowTintByActivity[rowActivity])
            ? rowActivity
            : (rowTintByArea && rowArea ? rowArea : "");
        if (groupKey !== prevGroupKey) {
            indexWithinGroup = 0;
            prevGroupKey = groupKey;
        } else {
            indexWithinGroup += 1;
        }
        tbody.appendChild(
            buildRow(row, ri, cols, activityColIndex, areaColIndex,
                     indexWithinGroup,
                     onSelectActivity, highlightActivityName,
                     rowTintByActivity, rowTintByArea),
        );
    });
}

export function renderSimpleTable(
    container: HTMLElement,
    dataView: DataView | undefined,
    options?: SimpleTableOptions,
): void {
    while (container.firstChild) container.removeChild(container.firstChild);

    const cols = dataView?.table?.columns ?? [];
    const allRows = dataView?.table?.rows ?? [];
    // v2.1 audit-fix — filter by selection. filterActivityNames and
    // filterAreaNames are AND'd. Row passes iff Activity matches the
    // activity filter (when set) AND Area matches the area filter (when set).
    //
    // v2.2 B1 — column lookup is ROLE-BASED, not displayName-regex. The
    // prior regex (`/^activity$/i`, `/^area$|/swim/i`) only worked when the
    // user's bound column happened to be named "Activity" / "Area" / "Swim
    // Lane". With real data where columns are bound with names like
    // "Workstream" or "Department", the regex missed, areaCol = -1, rowArea
    // = "", and the rowTintByArea lookup silently fell back to neutral
    // stripes — the table lost its responsive coloring entirely.
    const idx = indexMap(dataView?.table);
    const activityCol = idx.activity;
    const areaCol = idx.area;
    const msDateCol = idx.milestoneDate;
    const actFilter = options?.filterActivityNames;
    const areaFilter = options?.filterAreaNames;
    const msFilter = options?.filterMilestoneDateMs;
    const rows = (actFilter == null && areaFilter == null && msFilter == null)
        ? allRows
        : allRows.filter(r => {
            if (actFilter != null && activityCol >= 0) {
                const v = String(r[activityCol] ?? "").trim();
                if (!actFilter.includes(v)) return false;
            }
            if (areaFilter != null && areaCol >= 0) {
                const v = String(r[areaCol] ?? "").trim();
                if (!areaFilter.includes(v)) return false;
            }
            if (msFilter != null && msDateCol >= 0) {
                const raw = r[msDateCol];
                const d = raw instanceof Date ? raw : (raw != null ? new Date(raw as string | number) : null);
                if (d == null || isNaN(d.getTime())) return false;
                const t = d.getTime();
                if (t < msFilter.fromMs || t > msFilter.toMs) return false;
            }
            return true;
        });
    if (cols.length === 0) {
        const empty = document.createElement("div");
        empty.style.cssText = "padding:24px; color:#888; font-family:'Segoe UI', system-ui, sans-serif; font-size:13px;";
        empty.textContent = "No table data available — bind the Gantt wells to populate the detail table.";
        container.appendChild(empty);
        return;
    }

    const table = document.createElement("table");
    // v2.1 audit-fix — compact P&L density: 11px font, tight cells, fixed
    // table-layout so columns share width evenly across the full container
    // and don't reflow on selection-driven filter changes.
    table.style.cssText = [
        "width: 100%",
        "border-collapse: collapse",
        "table-layout: auto",
        "font-family: 'Segoe UI', system-ui, sans-serif",
        "font-size: 11px",
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
        // v2.1 audit-fix — compact header: 3px vertical padding, single
        // bottom border (no per-column right border), 11px uppercase-ish
        // styling to match a finance-grade dense grid.
        th.style.cssText = [
            "position:sticky",
            "top:0",
            "z-index:5",
            "padding:3px 6px",
            "text-align:left",
            "font-weight:600",
            "font-size:10px",
            "letter-spacing:0.02em",
            "color:#555",
            "background:#f5f5f7",
            "border-bottom:1px solid #c8c8c8",
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
    const activityColIndex = activityCol;
    const areaColIndex = areaCol;
    const onSelectActivity = options?.onSelectActivity;
    const highlightActivityName = options?.highlightActivityName;
    const rowTintByActivity = options?.rowTintByActivity;
    const rowTintByArea = options?.rowTintByArea;

    // Body rows (initial render)
    const tbody = document.createElement("tbody");
    renderBody(tbody, rows, cols, activityColIndex, areaColIndex,
               onSelectActivity, highlightActivityName,
               rowTintByActivity, rowTintByArea);
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
            renderBody(tbody, sorted, cols, activityColIndex, areaColIndex,
                       onSelectActivity, highlightActivityName,
                       rowTintByActivity, rowTintByArea);
            // Update header sort indicators
            headerCells.forEach((h, hi) => {
                const baseName = cols[hi]?.displayName || `Column ${hi + 1}`;
                h.textContent = hi === idx ? `${baseName} ${sortState.asc ? "▲" : "▼"}` : baseName;
            });
        });
    });

    container.appendChild(table);
}
