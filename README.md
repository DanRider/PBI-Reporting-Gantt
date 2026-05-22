# Reporting Gantt

A presentation-quality timeline visual for Power BI. Activity swim lanes, chevron time axis, milestone markers with conditional left/right labels, and per-row status notes shown on hover. Data-driven against any (Activity, Area, Start, End, Milestone Activity, Milestone Date, Milestone Type, Milestone Label, Label Position, Activity Note, Milestone Note)-shaped dataset.

**v2.1** adds an interactive controls panel: a compact master time slider, click-to-drill lane Inspector with per-activity milestone lists, hide-region toggles, and a resizable Gantt/Table split.

MIT licensed. Open source on GitHub.

![Reporting Gantt rendering with bundled demo data](docs/screenshot.png)

## Quick start

Four ways to see it running, from least to most setup:

### 1. Download `PBI-Reporting-Gantt.pbix` (one file, double-click)

Grab [`PBI-Reporting-Gantt.pbix`](PBI-Reporting-Gantt.pbix) from the repo root. Double-click in Power BI Desktop. The custom visual is embedded in the .pbix; demo data is inline. Zero setup, zero clone.

### 2. Try the demo fixture (zero setup, zero dependencies)

Clone this repo and open `fixtures/PBI-Reporting-Gantt.pbip` in Power BI Desktop. **Demo data is embedded inline in the .pbip's M code** — no external file, no internet, no setup. The visual renders immediately on first refresh.

The bundled demo is a generic project-portfolio dataset for an industrial equipment manufacturer (24 activities across Production / Product Development / Supply Chain, 64 milestones, Q4 2025 → Q4 2027 timeline).

**To use your own data**: open Power Query Editor → Advanced Editor on the Activities or Milestones query → comment out the `Source = #table(...)` block → uncomment the `EXCEL SOURCE` block at the bottom → set `YOUR_FILE_PATH` to your `.xlsx` location. `fixtures/Demo-Roadmap-Source.xlsx` is included as a schema reference for the expected column layout.

### 3. Import the `.pbiviz` into an existing report

The built visual binary lives at `dist/Reporting-Gantt-v2.1.0.0.pbiviz` — download it from the repo (or from the [GitHub Releases](https://github.com/DanRider/PBI-Reporting-Gantt/releases) page when published).

In Power BI Desktop: Visualizations pane → ⋯ → **Get more visuals** → **Import a visual from a file**. Pick the `.pbiviz` file. The visual appears in the Visualizations pane as **Reporting Gantt**. Bind your own (Activity, Area, Start, End) + (Milestone Activity, Milestone Date, Milestone Type, Milestone Label, Label Position) columns from your existing model. Activity Note / Milestone Note are optional v1.8.0.0+ fields for tooltip status text.

### 4. Build from source

```
npm install
npm run package
```

Outputs `dist/<guid>.<version>.pbiviz`.

## Data contract

Two related tables joined by activity name.

### Activities

| Column | Type | Required | Notes |
|---|---|---|---|
| `Activity` | text | ✓ | Primary key; one bar per distinct value |
| `Area` (Swim Lane) | text | ✓ | Groups bars into swim lanes; first-seen-in-data sort order; cap 8 distinct values |
| `Start Date` | date | ✓ | Bar start |
| `End Date` | date | ✓ | Bar end |
| `SortOrder` | number | optional | Preserves source-row ordering through PBI's rebucketing |
| `Activity Note` | text | optional | Status note shown in tooltip on hover (v1.8.0.0+) |

### Milestones

| Column | Type | Required | Notes |
|---|---|---|---|
| `Activity` | text | ✓ | Foreign key → `Activities[Activity]` |
| `Milestone Date` | date | ✓ | Marker position along the bar |
| `Milestone Type` | text | ✓ | Marker classifier; cap 2 distinct values (first 2 bind to slots 1/2; rest dropped with console warning) |
| `Milestone Label` | text | optional | Text shown next to the marker |
| `Label Position` | text | optional | `L` / `R` / `none` — author-controlled side of marker; `none` hides label (per-row hide mechanism) |
| `Milestone Note` | text | optional | Status note shown in tooltip on hover (v1.8.0.0+) |

### PBI quirks worked around

- **Activities without matching milestone rows** get dropped by PBI's relationship cross-join. Workaround: emit one phantom row per such activity with `Milestone Type = "__phantom"`. The viewmodel filters phantom rows before render. The demo's `fixtures/generate_source.py` shows the pattern.
- **Multi-year date-span filtering** via `Calendar → Activities[Start Date]` alone breaks for activities spanning past the start year. If you need date-span filtering, build a Calendar bridge table (activity × date row per active day) — the demo's TMDL shows this.

## Format pane reference

Eight cards organize all the controls. Defaults are sensible for most use cases — open the cards to customize.

### Title (Power BI built-in)

![Title card](docs/format-pane/PBI-Ghantt-Title.png)

Power BI Desktop's standard built-in title. **Off by default** — declaring this object's `show` default as `false` in the visual's capabilities suppresses Power BI's auto-concatenation of data role names as the title (which is the ugly default behavior for visuals that don't declare a title object).

Turn this on to render a simple text title above the visual viewport with a single color and alignment. For richer styling (font family/size/bold/italic/underline), use **Chart Title** below instead.

### Chart Title (custom — presentation quality)

![Chart Title card](docs/format-pane/PBI-Ghantt-ChartTitle.png)

A custom in-SVG title with full styling control: **Show toggle**, **Title text**, **Color**, **Font family**, **Size**, **Bold / Italic / Underline**, **Alignment** (left / center / right). Renders inside the visual viewport so it travels with the visual when exported. Use this for PowerPoint-quality output — the demo uses **Segoe UI Semibold, 22pt, bold, #1F2937 (dark charcoal), centered**.

### Size and style (Power BI built-in)

![Size and style card](docs/format-pane/PBI-Ghantt-SizeandStyle.png)

Power BI Desktop's standard visual container controls — background, border, lock aspect, padding, visual header. Not part of the Reporting Gantt code; included here for completeness so you know where to find these settings.

### Layout

![Layout card](docs/format-pane/PBI-Ghantt-Layout.png)

Four outer margins as percentages of the visual viewport width — Top / Bottom / Left / Right. Defaults are 1% on every side. Use this to push the chart inward from the visual container edge for breathing room.

### Swim Lanes

![Swim Lanes card](docs/format-pane/PBI-Ghantt-SwimLanes.png)

Three collapsible groups inside one card:

- **Layout** — Show toggle, swim-lane column width (% of visual), rail alignment (left / center / right of label), text wrapping.
- **Label styling** — Use swim-lane color for label (default on); custom label color; font family / size / bold / italic / underline.
- **Colors** — One color picker per slot (8 slots total). Slot 1's display name auto-binds to the first distinct Area value found in data; Slot 2 to the second; etc. Unused slots are hidden from the Format pane to keep it tidy.

### Activity Labels

![Activity Labels card](docs/format-pane/PBI-Ghantt-ActivityLabels.png)

Row labels (one per activity bar). Controls: Show toggle, label column width (%), text wrap (2 lines), overflow behavior (truncate with … / hide / overflow), fill mode (dark grey or swim-lane color), custom color, full font controls. Staggered horizontal "lollipop" connectors link each label to its bar.

### Milestones

A composite card with five groups across two screenshots:

![Milestones card — hover, labels, legend](docs/format-pane/PBI-Ghantt-Milestones1.png)

- **Hover behavior** — Hover target expansion (% beyond the marker edge); larger = easier to land tooltips on small markers.
- **Labels** — Overflow mode (truncate / hide colliding / overflow), label color, full font controls. Auto-flip on right-edge overflow is always on (viewport-correctness, not stylistic).
- **Legend** — Show toggle (default on); legend renders in the upper-left corner of the header band. Full font + color controls.

![Milestones card — Type 1 and Type 2 marker config](docs/format-pane/PBI-Ghantt-Milestones2.png)

- **Type 1** and **Type 2** — Each marker type bound from data gets its own collapsible group with: **Color**, **Symbol** (star / circle / triangle / square / diamond), **Size** (pixels), **Show markers** toggle. Hiding markers compounds: a hidden marker hides its label too.

### Time Axis

A composite card with seven groups across three screenshots:

![Time Axis card — chevron style, Year, Quarter](docs/format-pane/PBI-Ghantt-TimeAxis.png)

- **Chevron style** — Nested arrow / Pentagon / Rectangle.
- **Year band** — Show toggle, fill color.
- **Quarter band** — Show toggle, fill color, gridline controls (show, color, opacity, style: solid / dashed / dotted).

![Time Axis card — Month, TODAY marker, shading](docs/format-pane/PBI-Ghantt-TimeAxis2.png)

- **Month band** — Show toggle (default off), fill color, gridlines.
- **TODAY marker** — Vertical dashed line at today's date, "TODAY" label, color.
- **Past / future shading** — Tints the chart area on either side of TODAY with configurable color and opacity. Past shading on by default at 10% black; future shading off by default.

![Time Axis card — font](docs/format-pane/PBI-Ghantt-TimeAxis3.png)

- **Font** — Family / size / bold / italic / underline. Applied to all axis labels (year / quarter / month).

### Tooltip

![Tooltip card](docs/format-pane/PBI-Ghantt-ToolTip.png)

Controls hover-tooltip behavior. Three controls:

- **Show Note row** (default on) — whether the Note row appears in tooltips at all.
- **Hide row when no note** (default off) — if on, omit the Note row entirely when the bound Note column is empty/null for a row; if off, show the placeholder text instead.
- **Placeholder for empty notes** (default `(no note recorded)`) — text shown when Note row is on AND the row has no note.

## Selection & filtering (v2.1)

Three interactive surfaces layer onto the chart:

- **Master time slider** — compact slider in the top chrome row narrows the visible chart window globally. Drag the thumbs to scope a date range; activities clip at the window edges, milestones outside the window are filtered from chart + table. Auto-derives its tick range from the data envelope (earliest activity start → latest activity end, snapped to quarters, pivoted on today). "All" restores the full envelope.
- **Gantt / Table toggles** — two pill switches in the top-left hide either region; drag the horizontal splitter to resize.
- **Lane Inspector** — click any swim-lane label to open a side panel showing the lane's full activity roster with per-activity milestone lists (past = ✓, future = ⏭, color-coded per activity). A second slider inside the Inspector scopes milestones for that lane; the chart + table react live and stay in sync.

Drag the panel's right edge to resize; × or whitespace click dismisses.

## Source / dev

- TypeScript + SVG (no third-party visual code forked)
- Architectural patterns informed by reading source of MIT-licensed Microsoft visuals (`microsoft/powerbi-visuals-gantt`, `microsoft/powerbi-visuals-timeline`)
- Build: `npm run package` → `dist/<guid>.<version>.pbiviz`
- Test: drop the .pbiviz into any PBI Desktop report's `CustomVisuals/<guid>/` folder, kill PBIDesktop, relaunch — or use the bundled demo `.pbip`.

## License

MIT — see [LICENSE](LICENSE).
