# Changelog

All notable changes to Reporting Gantt are documented here. Versions
follow a four-part scheme: **major.minor.patch.build**.

---

## v3.0.5.14 — 2026-07-15 (current release)

### Improved
- **Milestones in the activity and swim-lane inspector panels now use a compact single-line format:** the milestone's marker, its date, how far that date is from today (shown as "(9mo)" for past, "+9mo" for upcoming, or "Today"), then the milestone name. Major/Minor is conveyed by the marker itself. Long names are shrunk to fit and shortened only when necessary, with the full name on hover. Font size and minimum size are adjustable in the Format pane.

---

## v3.0.5.13 — 2026-07-15

### Fixed
- **Milestone markers are now always drawn on top of the bars and background bands, so a marker can never be hidden behind another element.** A build-time check and a runtime diagnostic now flag any marker that would be visually covered, and a new "Semi-transparent bars" option (Format pane, off by default) lets you see markers through the bars when checking a report.

---

## v3.0.5.12 — 2026-07-15

### Fixed
- **The chart now shows every milestone in the data — no milestone is ever left off the chart.** Records that previously could not be placed (an activity reference that matches no activity, or an unreadable date) are no longer dropped: they are matched to the closest activity when possible, otherwise shown in a clearly-marked "Unresolved" area, and flagged as a non-blocking warning. The Diagnostics panel shows the exact source rows behind any warning (every column, as delivered) with the problem highlighted, so the underlying data can be corrected — but the chart never waits on that and never hides a record.

## v3.0.5.11 — 2026-07-15

### Fixed
- **Milestone markers could disappear from the chart after repeatedly changing filters**, returning only after a full refresh. The chart matched markers to their data by a value that was reassigned on every refresh, so filter changes could make the chart rebuild markers instead of updating them in place and occasionally drop one. Markers are now matched by a stable identity, so they persist correctly across filter changes.

## v3.0.5.10 — 2026-07-15

### Improved
- **The Diagnostics panel now names the exact records it could not use.** When a milestone is dropped, the panel and the downloadable log show that milestone's label, its raw activity reference, the reason, and the closest matching activity — so a data mismatch (for example a reference that points at an ID or a name that does not exist among the activities) is identifiable directly from the panel instead of only a category count.

## v3.0.5.9 — 2026-07-15

### Fixed
- **Milestone markers that appeared in the detail table could be missing from the chart** when a milestone's activity value differed from the activity's name by only whitespace, letter case, or invisible characters. The chart matched milestones to their row by an exact text match, so a stray space or case difference dropped the marker from the chart while the table still showed it. The chart now matches tolerantly (ignoring surrounding/repeated spaces, case, and invisible characters), so any milestone shown in the table also renders on the chart; genuinely unmatched milestones are surfaced rather than silently removed, and the Diagnostics panel names the unmatched value and its closest activity.

## v3.0.5.8 — 2026-07-15

### Fixed
- **Milestones no longer disappear when their date is in a format the chart did not previously recognize.** The date reader now understands more formats commonly found in enterprise data — including spreadsheet serial numbers, fiscal-quarter text (e.g. "Q1 2026"), and date/time values — and treats explicit placeholders (e.g. "TBD", "N/A") as intentionally-undated rather than errors. Milestones that are genuinely undated are surfaced instead of silently removed, and the Diagnostics panel now shows the actual value of anything it still cannot read, so a data question is answerable at a glance.

## v3.0.5.7 — 2026-07-14

Version restamp of v3.0.5.6 to ensure a clean download; no functional changes.

## v3.0.5.6 — 2026-07-14

**Fix + diagnostics release.**

### Fixed
- **A milestone could silently fail to appear on the chart when two milestones on the same activity shared the same label** — the chart's rendering keyed milestones by activity and label, so identically-labeled milestones collapsed into a single marker. Markers are now keyed by their full identity (activity, label, date, type), so every milestone renders.

### Improved
- **The Diagnostics panel now opens to a faults-only view**, like a vehicle fault-code readout: healthy updates collapse to a single heartbeat line, and problems appear as deduplicated fault cards (code, plain-English description, key numbers, occurrence count). The full raw trail remains one toggle away, and downloaded logs now begin with a fault summary.

## v3.0.5.5 — 2026-07-14

Version restamp of v3.0.5.4 to ensure Power BI loads the updated visual; no functional changes.

## v3.0.5.4 — 2026-07-14

**Fix + diagnostics release.**

### Fixed
- **The first row's milestone markers could become invisible after filtering in the Power BI service** while the row's bar remained visible; a browser refresh restored them. Filter interactions in the service could leave the chart's scroll position slightly displaced, clipping the first row's markers at the chart's top edge. The chart now reserves headroom above the first row sized to the largest configured marker (with hover growth), and corrects any displaced scroll position on every update.

### Improved
- **Diagnostics panel** readability and utility: dark theme, larger monospace log text, a maximize control that expands the log to the full visual, selectable text, and the panel now renders above the time-slider controls.
- **Diagnostics log detail:** per-row milestone accounting (data delivered vs markers rendered, per row) and rendered-geometry checks that report whether any markers sit outside the visible chart area — making layout issues diagnosable directly from a downloaded log.

## v3.0.5.3 — 2026-07-14

**Resilience + diagnostics release.**

### Fixed
- **The chart could go blank until a page refresh after filtering in the
  Power BI service** (via external slicers or the visual's built-in filters).
  The service occasionally delivers a momentary empty data frame mid-filter;
  the visual previously tore down the rendered chart on that frame and could
  be left waiting for data that never arrived. The chart now keeps its last
  rendered state through momentary empty frames, asks the host to re-send data
  if it does not arrive within a few seconds (with retries, and again when the
  window regains focus), and only shows the "bind fields" message when fields
  are genuinely disconnected.

### Added
- **Diagnostics panel** (Format pane → Diagnostics, off by default): an
  expandable panel showing a live log of the visual's data updates, with a
  Download-log button that exports the log as a text file to attach to support
  reports. Uses Power BI's export API (tenant export permissions apply); falls
  back to an on-screen view where export is blocked.

---

## v3.0.5.2 — 2026-07-13

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

## v3.0.5.2 — 2026-07-13

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
