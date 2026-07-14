# Changelog

All notable changes to Reporting Gantt are documented here. Versions
follow a four-part scheme: **major.minor.patch.build**.

---

## v3.0.5.2 — 2026-07-13 (current release)

**Fix release.**

### Fixed
- **Milestone markers in the activity and swim-lane inspector panels now
  match the legend.** Each marker uses its milestone type's configured
  symbol shape and color (the same rendering the legend and chart use),
  sized for the panel's compact layout — previously the panels showed a
  generic star that ignored the type's configured symbol and, in the
  swim-lane view, was tinted with the activity color instead of the
  type color.

---

## v3.0.5.1 — 2026-07-13

**Fix release.**

### Fixed
- **The activity inspector panel could show a stale "in time window" milestone
  count** after the time window was narrowed and then extended (or a window
  scope toggle was changed) while the panel was open — e.g. the panel showing
  "0 in time window" while the chart and the detail table showed the
  milestones. The chart, the detail table, and the inspector panel now always
  filter by the same time window on every update, so the three views can no
  longer disagree.

---

## v3.0.5.0 — 2026-07-13

**Fix release.**

### Fixed
- **Milestone markers could intermittently disappear from the chart while
  remaining in the detail table** when the time-window slider was applied to
  the chart only. The window could be silently narrowed by an unrelated slicer
  interaction, hiding markers until a refresh. The time window now changes
  only in response to direct user action.
- Milestones of every type now render on the chart. Previously, three or more
  distinct milestone types dropped the extra types' markers from the chart
  while still listing them in the table.

### New
- **Up to 10 milestone types** can be styled individually (color, symbol,
  size, markers). Types beyond 10 render with a default marker, never hidden.
- The visual reconciles delivered vs. drawn markers every update and surfaces
  any data it could not read, so records can no longer go missing silently.

---

## v3.0.4.0 — 2026-07-13

**Fix release.**

### Fixed
- **Milestones could disappear from the chart while remaining visible in
  the detail table**, depending on how Power BI delivered date values to
  the visual (numeric or regional string formats). Date handling is now
  a single, tolerant parser shared by every part of the visual: native
  dates, numeric timestamps, ISO strings, and regional day-first /
  month-first strings (following the report locale) all render
  identically everywhere. Reported by users as intermittent missing
  milestone markers that a browser refresh appeared to fix.
- Regional date strings could previously land on the wrong month
  (day/month transposed) in edge cases; dates with an unambiguous
  day (13 or higher) are now always read correctly, and ambiguous
  dates follow the report's locale.

### Reliability
- The visual now continuously reconciles the number of milestones
  delivered, processed, and drawn on every update, and reports any
  discrepancy to the developer console — data can no longer go
  missing silently.

---

---

## v3.0.5.2 — 2026-07-13 (current release)

**Fix release.**

### Fixed
- **Milestone markers in the activity and swim-lane inspector panels now
  match the legend.** Each marker uses its milestone type's configured
  symbol shape and color (the same rendering the legend and chart use),
  sized for the panel's compact layout — previously the panels showed a
  generic star that ignored the type's configured symbol and, in the
  swim-lane view, was tinted with the activity color instead of the
  type color.

---

## v3.0.5.1 — 2026-07-13

**Fix release.**

### Fixed
- **The activity inspector panel could show a stale "in time window" milestone
  count** after the time window was narrowed and then extended (or a window
  scope toggle was changed) while the panel was open — e.g. the panel showing
  "0 in time window" while the chart and the detail table showed the
  milestones. The chart, the detail table, and the inspector panel now always
  filter by the same time window on every update, so the three views can no
  longer disagree.

---

## v3.0.5.0 — 2026-07-13

**Fix release.**

### Fixed
- **Milestone markers could intermittently disappear from the chart while
  remaining in the detail table** when the time-window slider was applied to
  the chart only. The window could be silently narrowed by an unrelated
  slicer interaction, hiding markers until a refresh. The time window now
  changes only in response to direct user action.
- Milestones of every type now render on the chart. Previously, with three or
  more distinct milestone types, markers of the extra types were dropped from
  the chart while still listed in the table.

### New
- **Up to 10 milestone types** can be styled individually (color, symbol,
  size, markers). Types beyond 10 render with a default marker, never hidden.
- The visual reconciles delivered vs. drawn markers every update and surfaces
  any data it could not read, so records can no longer go missing silently.


## v3.0.3.0 — 2026-07-12

**Fix release.**

### Fixed
- Fixed a crash that could blank the visual on very large datasets
  (roughly 500,000+ rows / ~1M date values): the date-range computation
  exceeded an engine argument limit. Ranges are now computed with a
  single-pass scan at any scale.

### New features
- **Data-limit notice** — when Power BI itself stops delivering data at
  its per-visual memory ceiling (~1,048,576 rows or 100 MB, whichever
  comes first), the visual now shows a dismissible in-canvas notice
  with the exact number of rows delivered. The visual imposes no data
  limits of its own; this notice makes the platform's limit visible
  instead of silent.

---

## v3.0.2.0 — 2026-07-12

**Fix release.**

### Fixed
- Large datasets now render: the previous 5,000-row cap could blank
  reports over that limit; data now loads progressively and
  automatically (30k-row windowing).
- Milestone icons no longer disappear intermittently after slicer
  changes (time-window state could be corrupted by a filter round-trip).
- The Activity Inspector check mark reflects Milestone Status when the
  "Milestone Status" field well is bound; the previous date-based
  behavior is preserved when unbound.
- Swim-lane labels now display for lanes containing a single activity.
- The detail table no longer shows the activity name twice.
- Fixed a crash that blanked the visual with 9 or more swim lanes;
  lanes 9+ receive automatic palette colors.

### Changed
- Visualizations-pane name is now "Reporting Gantt" (was
  "Reporting Roadmap").

---

## v3.0.0.0 — 2026-06-07

**Major release.** Unlimited per-area swim lane colors via Format Pane;
filter dimensions raised from 8 to 256; activity health icons with
per-value binding; new persistent state primitives (splitter ratio,
sort orders, hidden regions); drag-to-reorder filter pane; accent
color theming; baseline/actual glide-path with variance escalation.

### New features
- **Unlimited swim lane colors** — Format Pane now exposes one
  ColorPicker per bound area (no 8-cap). v2.x slot1Color..slot8Color
  reports migrate automatically on first open.
- **Filter dimensions raised 8 → 256** — pin and configure up to 256
  filter dimensions per visual (limited by data role binding cap).
- **Filter pane drag-to-reorder** with carried-card UX, cancel paths,
  and auto-scroll on edge proximity.
- **Activity health icons** with per-value binding — choose icon
  (warning, blocked, paused, off-track, on-track, circle) and color
  per health value.
- **Drag-to-resize** swim lane region and activity section.
- **Splitter ratio persists** across report republish and tab close.
- **Read-only mode** awareness — visual respects view-only contexts.
- **Studio Mode** entry point declared (interactive scheduling layer
  in development).
- **Accent color picker** for filter panel chrome.
- **Activity inspector** with slide-out details, milestones gallery,
  metadata surfacing.
- **% complete** as operator-bindable data role (overrides time-elapsed
  default).
- **Swim lane name truncation** with Unicode ellipsis at configurable
  character count.
- **Multiple filter widget types** — pills (single + multi), dropdown,
  search chips, range slider, auto.

### Improvements
- Per-area color cycling when palette is exhausted (no more grey lanes
  past slot 8).
- Bullet-chart redesign for milestone variance display (MS Project
  Tracking Gantt convention).
- Time axis chevron alignment improvements.
- Filter override maps correctly clear on slot rebind.
- Persist sink unification — all property writes route through a
  single debounced channel.

### Migration
- v2.x reports with `slot1Color`..`slot8Color` populated migrate on
  first open under v3.0; original slot values preserved in the
  persisted bag for hypothetical rollback.
- v2.x reports with `slot1..slot5` activity health icon configs
  migrate to per-value entries.
- Format Pane controls reorganize — operators may need to re-locate
  some settings under the new card layouts.

### Known limitations
- AppSource certification pending.
- Studio Mode interactive scheduling is declared at the SDK level but
  the UI scaffold is in active development.

---

## v2.3.0.0 — 2026-05-XX

- areaColor data role for per-row color overrides.
- 25-lane stress fixture for past-cap testing.
- Operator feedback round (six usability fixes) bundled.

## v2.2.0.3 — 2026-04-XX

- Operator feedback patch round.

## v2.2.0.1 — 2026-03-XX

- Bug fixes from v2.2.0.0 community feedback.

## v2.2.0.0 — 2026-03-XX

- Sortable table region below the Gantt SVG.
- `rg-matrix-substrate` for tabular drill-down.

## v2.1.0.0 — 2025-XX-XX

- Initial public release.
- Controls panel + filter primitives.
- Basic swim lane rendering, chevron time axis, milestone markers.

---

For the precise feature set in each release, see the corresponding
[GitHub Release page](https://github.com/DanRider/PBI-Reporting-Gantt/releases).
