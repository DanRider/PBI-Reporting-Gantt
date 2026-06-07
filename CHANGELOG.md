# Changelog

All notable changes to Reporting Gantt are documented here. Versions
follow a four-part scheme: **major.minor.patch.build**.

---

## v3.0.0.0 — 2026-06-07 (current release)

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
- Operator feedback round (INF-3815/3816/3817/3818/3820/3821) bundled.

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
