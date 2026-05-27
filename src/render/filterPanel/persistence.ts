// INF-3739 — host-persistence + filter-pushback helpers.
//
// Extracted from controller.ts to keep that file under the 400-LOC cap.
// Pure side-effect helpers: applyJsonFilter pushback to PBI's filter context,
// persistProperties round-trips for selections + per-slot pinned state.

import powerbi from "powerbi-visuals-api";
import { FilterDimBinding, FilterState } from "./state";

type IVisualHost = powerbi.extensibility.visual.IVisualHost;

interface QualifiedColumn { table: string; column: string; }

function columnTarget(col: powerbi.DataViewMetadataColumn): QualifiedColumn | null {
    const qn = col.queryName;
    if (!qn) return null;
    const dot = qn.indexOf(".");
    if (dot < 0) return null;
    return { table: qn.slice(0, dot), column: qn.slice(dot + 1) };
}

export function pushFilters(
    host: IVisualHost,
    state: FilterState,
    bindings: ReadonlyArray<FilterDimBinding>,
): void {
    const byName = new Map(bindings.map(b => [b.dimName, b]));
    const filters: powerbi.IFilter[] = [];
    for (const [dimName, values] of state.entries()) {
        const b = byName.get(dimName);
        if (b === undefined) continue;
        const target = columnTarget(b.columnRef);
        if (target === null) continue;
        const filter = {
            // eslint-disable-next-line powerbi-visuals/no-http-string
            $schema: "http://powerbi.com/product/schema#basic",
            target,
            operator: "In",
            values: Array.from(values),
            filterType: 1,
        } as unknown as powerbi.IFilter;
        filters.push(filter);
    }
    try {
        host.applyJsonFilter(filters as unknown as powerbi.IFilter, "general", "filter", 1);
    } catch { /* harmless */ }
}

export function persistSelections(host: IVisualHost, state: FilterState): void {
    try {
        host.persistProperties({
            merge: [{
                objectName: "filterPanelLayout",
                selector: undefined as unknown as powerbi.data.Selector,
                properties: { selectionsJson: JSON.stringify(state.toJSON()) },
            }],
        });
    } catch { /* harmless */ }
}

export function persistPin(host: IVisualHost, slotIndex: number, pinned: boolean): void {
    const prop = `slot${slotIndex + 1}Pinned`;
    try {
        host.persistProperties({
            merge: [{
                objectName: "filterSlots",
                selector: undefined as unknown as powerbi.data.Selector,
                properties: { [prop]: pinned },
            }],
        });
    } catch { /* harmless */ }
}
