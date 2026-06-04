# Reporting-Roadmap v2.3.0.0

Operator-feedback round on shipped `v2.2.0.3`. Triaged via the `/iterate` PBI custom-visual harness (INF-3805 / INF-3814), shipped across `feature/v22-feedback-sweep` in two commits.

## New data roles

- **Swim Lane Color** (`areaColor`) — Bind a hex column from your dimension model to color swim lanes per area. Scales to any cardinality; overrides the legacy 8-slot palette + INF-3782 hash-wrap fallback. Power-user path for brand or category-colored reports. (INF-3823)
- **Percent Complete** (`percentComplete`) — Bind a numeric column for operator-supplied 0-100 completion per activity. Activity Inspector slide-out reads it when the new `progressBarSource` Format Pane setting is set to `User field`; defaults to the existing elapsed-time auto-calc. (INF-3815)

## New Format Pane controls

- **Activity Inspector** card — Hide the % complete bar entirely (`showProgressBar`) OR switch its source between auto-elapsed-time and the new `percentComplete` data role (`progressBarSource`). (INF-3815)
- **Swim Lanes → Truncate label at** (`labelMaxChars`) — Truncate swim-lane names beyond N characters with a Unicode ellipsis; full name revealed on hover via SVG `<title>`. Codepoint-safe (no truncation mid-emoji). 0 = off (default). (INF-3821)
- **Gantt Layout → Hidden region** — The chrome's "Show Roadmap" / "Show Table" toggles now persist via `host.persistProperties` so the operator's choice survives reload + publish-to-Service. (INF-3819 — fixes a critical bug in v2.2.0.3 where the table toggle silently reset on publish)

## UX clarifications

- **Chrome toggles relabeled** from "Roadmap" / "Table" to "Show Roadmap" / "Show Table" with operator-prose `title` attributes. Pure cosmetic change; behavior unchanged. (INF-3816)
- **Filter Dimensions cap visibility** — The `filterDimensions` role description now cites the 8-cap explicitly. The filter-panel controller emits a single `console.warn` listing dropped column names when an operator binds more than 8 dimensions; previously the overflow was silently dropped. (INF-3817 Option C scope)

## Rendering fixes

- **Swim lane label overflow** — Multi-line swim-lane labels in narrow lanes no longer bleed into adjacent lanes. Per-lane SVG `<clipPath>` bounded by lane height. (INF-3820)
- **Swim lane color wrap >8 lanes** — Verified that INF-3782's `stableHashUint(area) % palette.length` deterministic wrap (shipped in v2.2.0.3) is in this cut. Lanes 9+ never render grey. (INF-3818)

## Backward compatibility

All new data roles are **optional**. Reports built against `v2.2.0.3` render identically — no operator action required. Toggle persistence (`ganttLayout.hiddenMode`) is additive; existing reports default to "Show both" until the operator toggles.

## Testing

- 649 unit tests passing across 55 files (`npm test`)
- `tsc --noEmit` clean (strict mode)
- Build artifact: `Reporting-Roadmap-v2.3.0.0.pbiviz` (72 KB)
- Pre-commit gates green (eslint, madge cycle check, file-size cap, commit-msg format)

## Known follow-ups (deferred to v2.3.x or v3.x)

- **INF-3824** — Per-instance Format Pane color controls (one picker per swim lane, no 8-slot cap). Filed; supersedes the v3.x deferral of INF-3817 Option A. Operator-pickable per-area; persists via per-instance selectors.
- **INF-3825** — Sibling work for `activityHealthIcons` (5-slot cap → per-instance). Same architectural lift, different card.
- **INF-3822** — Strategic decision: native PBI Filter Pane + Slicer Tile integration vs custom filter mechanic. v3.x scoping pending.

## Commit history

- `0c9a7e8` — operator feedback round (bundles INF-3815/3816/3817/3818/3819/3820/3821)
- `d1917ca` — INF-3823: `areaColor` data role + 25-lane stress fixture extension

Co-Authored-By: Claude Opus 4.7 (1M context) `<noreply@anthropic.com>`
