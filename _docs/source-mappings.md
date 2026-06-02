# Source-System Field Mappings — Reporting-Gantt v2.3+

The Reporting-Gantt visual ingests project / portfolio data from any
source system via Power BI data-binding configuration. From v2.3.0.0
onward the visual supports a four-state activity model on each row:

| Visual binding | Semantic | Required? |
|----------------|----------|-----------|
| `startDate`    | Current forecast (or as-of) start | Yes |
| `endDate`      | Current forecast (or as-of) end   | Yes |
| `baselineStart`| Committed (planning-time) start | Optional |
| `baselineEnd`  | Committed (planning-time) end   | Optional |
| `actualStart`  | Recorded (real) start | Optional |
| `actualEnd`    | Recorded (real) end   | Optional |

When the optional baseline / actual columns are bound, the glide-path
render layers (baseline outline + actual segment + slip-magnitude
chevron) appear automatically. When unbound, the visual renders the
existing single-bar shape — graceful degradation.

This document maps the bindings to common source systems. **Rows below
are split by confidence tier; medium-confidence rows are pending
verification against current source-system documentation and should be
treated as guidance, not contract.**

---

## High-confidence mappings (verified)

### Microsoft Project

| Source field | → Visual binding | Notes |
|--------------|------------------|-------|
| `Baseline Start`  | `baselineStart` | Available on the saved Baseline (any of Baseline through Baseline10) |
| `Baseline Finish` | `baselineEnd`   | Same — pick the Baseline N your organization uses for the published plan |
| `Actual Start`    | `actualStart`   | Populated when work is marked started |
| `Actual Finish`   | `actualEnd`     | Populated when work is marked complete |
| `Start` or `Scheduled Start` | `startDate` | Current schedule (may equal Baseline if no replan) |
| `Finish` or `Scheduled Finish` | `endDate` | Current schedule |

MS Project's native baseline + actual fields map cleanly to all four
optional bindings. Slip-magnitude chevron renders automatically when the
current `endDate` diverges from the bound `baselineEnd`.

### Asana

| Source field | → Visual binding | Notes |
|--------------|------------------|-------|
| `Start date` | `startDate` | Native field |
| `Due date`   | `endDate`   | Native field |

No native baseline or actual fields in Asana's project model. Glide-path
layers do not appear unless a custom field is added to capture baseline
or recorded-completion dates.

### Monday.com

| Source field | → Visual binding | Notes |
|--------------|------------------|-------|
| `Timeline` column (start) | `startDate` | Decompose the Timeline column to start/end dates |
| `Timeline` column (end)   | `endDate`   | Same |

No native baseline or actual fields. Baseline can be modeled via a
second `Timeline` column ("Baseline Timeline") then bound to
`baselineStart`/`baselineEnd`.

### Plane (self-hosted)

| Source field | → Visual binding | Notes |
|--------------|------------------|-------|
| `start_date` (work item) | `startDate` | From `v_work_items` view |
| `target_date` (work item) | `endDate`  | From `v_work_items` view |

No native baseline or actual fields in Plane's schema as of the
2026-Q1 release. Baseline can be derived from a milestone-tagged
snapshot if your workflow captures plan freezes.

### ClickUp

| Source field | → Visual binding | Notes |
|--------------|------------------|-------|
| `Start date` | `startDate` | Native field |
| `Due date`   | `endDate`   | Native field |

No native baseline or actual fields. Custom Fields can be added to
capture baseline/actual dates and bound to the optional layers.

---

## Medium-confidence mappings (TBD — needs verification)

The following source systems are believed to support a baseline /
actual concept but the exact native field names or template-column
names have NOT been verified against current vendor documentation in
this release. Treat the proposed bindings as guidance pending a
research pass against live docs.

| Source system | Proposed binding | Status |
|---------------|------------------|--------|
| Primavera P6  | `BL1 Start` / `BL1 Finish` → `baselineStart` / `baselineEnd` | TBD — verify BL1 vs BL2..BL11 conventions and the "Project Baseline" toggle. |
| Primavera P6  | `Actual Start` / `Actual Finish` → `actualStart` / `actualEnd` | TBD — verify column names in current Primavera Web vs P6 Pro builds. |
| Smartsheet    | Project template `Baseline Start` / `Baseline End` columns → `baselineStart` / `baselineEnd` | TBD — verify column naming in current Project Tracking templates. |
| Jira Advanced Roadmaps | `Target start` / `Target end` → `startDate` / `endDate` (current forecast) | TBD — verify whether Target dates are the forecast or the commit. |
| Jira Align    | Commit-date fields (hard / soft) → `baselineEnd` (hard) / `endDate` (soft) | TBD — verify field names and which represents the published commit. |

Once verified, these rows will be promoted to the high-confidence
section in a subsequent patch release.

---

## Notes on the four-state model

- **Two states present (start + end only):** equivalent to a v2.2.0.3
  single-bar render. No baseline / actual / slip indication.
- **Three states present (baseline + forecast):** baseline outline +
  forecast bar render together. Slip-magnitude chevron renders if the
  forecast end differs from the baseline end by more than the
  negligible threshold (default 2 days, configurable in the Glide Path
  Format-pane card).
- **Four states present (baseline + actual + forecast):** full
  glide-path layered render — committed plan, real progress, current
  projection, and drift indicator all on the same row.

The slip-magnitude thresholds and color palette are exposed in the
visual's Format pane under the **Glide Path** card.

---

## Adding a new source system

If your source system isn't listed above, the binding contract is
straightforward: identify columns in your data that map to the six
visual roles (`startDate`, `endDate`, `baselineStart`, `baselineEnd`,
`actualStart`, `actualEnd`). The visual renders glide-path layers
proportional to which optional bindings are populated. Activities
without baseline data render as single bars (graceful degradation).
