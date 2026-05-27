// v2.2 T2 + S2 — resolve the user-bound column displayName for a given
// capability role. Use at all user-visible label sites so a report whose
// author binds an "Workstream" column to the activity role sees
// "Workstream" in tooltips and Inspector text — not the static "Activity"
// from capabilities.json.
//
// Resolution order:
//   1. Bound column's displayName from dataView.metadata.columns[i] where
//      .roles[role] is truthy.
//   2. fallback (typically the capability's static displayName, e.g.
//      "Activity" or "Swim Lane").
//
// A future enhancement can layer a Format-pane override on top of (1) —
// not in PR-1 scope.

import powerbi from "powerbi-visuals-api";
import { RoleName } from "../columns";

export function bindingDisplayName(
    role: RoleName,
    dataView: powerbi.DataView | undefined,
    fallback: string,
): string {
    const columns = dataView?.metadata?.columns;
    if (!columns) return fallback;
    for (const col of columns) {
        if (col.roles && Boolean(col.roles[role])) {
            const name = col.displayName;
            if (name && name.length > 0) return name;
            break;
        }
    }
    return fallback;
}

// Naive English pluralization. Sufficient for typical column-name nouns
// (Activity -> Activities, Workstream -> Workstreams, Process ->
// Processes). Doesn't handle irregular plurals (Person -> People) — if a
// report uses an irregular column name, the singular form is still
// correct everywhere else; only the count-suffix line in laneDetail is
// imperfect, which is an acceptable trade for not shipping an English
// inflection library.
export function pluralize(noun: string): string {
    if (/y$/i.test(noun)) return noun.slice(0, -1) + "ies";
    if (/(s|x|z|sh|ch)$/i.test(noun)) return noun + "es";
    return noun + "s";
}
