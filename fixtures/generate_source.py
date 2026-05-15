"""Generate a demo Excel data source for the Reporting Gantt visual.

Outputs `fixtures/Demo-Roadmap-Source.xlsx` with two sheets:
  - Activities  (Activity, Area, Start Date, End Date, SortOrder)
  - Milestones  (Activity, Milestone Date, Milestone Type, Milestone Label, Label Position)

Demonstrates:
  - Multiple areas (4 here — visual handles N dynamically)
  - Two milestone types (visual caps at 2; if you add a 3rd, it gets dropped with a console warning)
  - L/R/none label positions
  - Dense + sparse rows (auto-flip + truncation behaviors)
  - Phantom milestones for activities-without-real-milestones (PBI relationship cross-join workaround)

Run:
    python fixtures/generate_source.py

Requires: openpyxl (`pip install openpyxl`)
"""
from __future__ import annotations
from datetime import date
from pathlib import Path

from openpyxl import Workbook

OUTPUT = Path(__file__).parent / "Demo-Roadmap-Source.xlsx"

# Quarter boundaries — Q1 = Jan-Mar, etc. Adjust to your fiscal calendar if needed.
def Q(year: int, q: int, end: bool = False) -> date:
    """Quarter start (q=1..4, end=False) or end (end=True)."""
    if end:
        month_end = {1: (3, 31), 2: (6, 30), 3: (9, 30), 4: (12, 31)}[q]
        return date(year, month_end[0], month_end[1])
    return date(year, (q - 1) * 3 + 1, 1)


# (Activity, Area, Start, End)
ACTIVITIES = [
    # Engineering
    ("Auth Service v2",                "Engineering", Q(2026, 1),       Q(2026, 3, end=True)),
    ("Data Pipeline Refactor",         "Engineering", Q(2026, 1),       Q(2026, 4, end=True)),
    ("API Gateway Migration",          "Engineering", Q(2026, 2),       Q(2027, 1, end=True)),
    ("Mobile SDK 3.0",                 "Engineering", Q(2026, 3),       Q(2027, 2, end=True)),
    # Product
    ("Onboarding Redesign",            "Product",     Q(2026, 1),       Q(2026, 2, end=True)),
    ("Pricing Page A/B",               "Product",     Q(2026, 2),       Q(2026, 3, end=True)),
    ("Self-Serve Trial Flow",          "Product",     Q(2026, 2),       Q(2027, 1, end=True)),
    # Marketing
    ("Q2 Brand Refresh",               "Marketing",   Q(2026, 1),       Q(2026, 2, end=True)),
    ("Annual Conference",              "Marketing",   Q(2026, 3),       Q(2026, 3, end=True)),
    ("ABM Pilot Cohort",               "Marketing",   Q(2026, 2),       Q(2027, 2, end=True)),
    # Operations
    ("SOC2 Type II Audit",             "Operations",  Q(2026, 1),       Q(2026, 4, end=True)),
    ("Vendor Consolidation",           "Operations",  Q(2026, 2),       Q(2027, 1, end=True)),
]

# (Activity, Date, Type, Label, LabelPos)
# Two types: "Major" (gold, slot 1 default) and "Minor" (black, slot 2 default).
MILESTONES = [
    # Auth Service v2
    ("Auth Service v2",          date(2026, 2, 15), "Major", "Design review",     "R"),
    ("Auth Service v2",          date(2026, 3, 10), "Minor", "Code freeze",       "L"),
    ("Auth Service v2",          date(2026, 3, 28), "Major", "GA",                "R"),
    # Data Pipeline Refactor
    ("Data Pipeline Refactor",   date(2026, 2, 28), "Minor", "Schema lock",       "R"),
    ("Data Pipeline Refactor",   date(2026, 6, 15), "Major", "Cutover",           "R"),
    ("Data Pipeline Refactor",   date(2026, 11, 30),"Major", "Decommission old",  "L"),
    # API Gateway Migration
    ("API Gateway Migration",    date(2026, 5, 20), "Minor", "Canary 10%",        "R"),
    ("API Gateway Migration",    date(2026, 9, 15), "Major", "100% traffic",      "R"),
    ("API Gateway Migration",    date(2027, 2, 28), "Major", "Legacy gateway off", "R"),
    # Mobile SDK 3.0
    ("Mobile SDK 3.0",           date(2026, 9, 10), "Minor", "Beta release",      "R"),
    ("Mobile SDK 3.0",           date(2027, 4, 20), "Major", "GA",                "R"),
    # Onboarding Redesign
    ("Onboarding Redesign",      date(2026, 3, 1),  "Major", "Live to 100%",      "R"),
    ("Onboarding Redesign",      date(2026, 5, 15), "Minor", "Iteration 2",       "R"),
    # Pricing Page A/B
    ("Pricing Page A/B",         date(2026, 8, 5),  "Major", "Winner declared",   "R"),
    # Self-Serve Trial Flow
    ("Self-Serve Trial Flow",    date(2026, 7, 20), "Minor", "MVP",               "R"),
    ("Self-Serve Trial Flow",    date(2026, 12, 10),"Major", "Public launch",     "R"),
    ("Self-Serve Trial Flow",    date(2027, 2, 28), "Major", "Conversion target met", "L"),
    # Q2 Brand Refresh
    ("Q2 Brand Refresh",         date(2026, 5, 1),  "Major", "Site live",         "R"),
    # Annual Conference
    ("Annual Conference",        date(2026, 9, 22), "Major", "Day 1 keynote",     "R"),
    # ABM Pilot Cohort
    ("ABM Pilot Cohort",         date(2026, 9, 1),  "Minor", "Wave 1 launch",     "R"),
    ("ABM Pilot Cohort",         date(2027, 3, 15), "Major", "Renewal target",    "R"),
    # SOC2 Type II Audit
    ("SOC2 Type II Audit",       date(2026, 4, 1),  "Minor", "Evidence collection", "R"),
    ("SOC2 Type II Audit",       date(2026, 11, 15),"Major", "Report received",   "R"),
    # Vendor Consolidation — no real milestones, gets a phantom row to anchor it in the cross-join
]

# Activities without milestones need phantom rows so PBI's relationship cross-join doesn't drop them.
# The viewmodel filters Milestone Type === "__phantom" before render.
ACTIVITIES_NEEDING_PHANTOMS = ["Vendor Consolidation"]


def main() -> None:
    wb = Workbook()
    ws_a = wb.active
    ws_a.title = "Activities"
    ws_a.append(["Activity", "Area", "Start Date", "End Date", "SortOrder"])
    for i, (name, area, start, end) in enumerate(ACTIVITIES):
        ws_a.append([name, area, start, end, i])

    ws_m = wb.create_sheet("Milestones")
    ws_m.append(["Activity", "Milestone Date", "Milestone Type", "Milestone Label", "Label Position"])
    for activity, mdate, mtype, label, pos in MILESTONES:
        ws_m.append([activity, mdate, mtype, label, pos])
    # Phantom rows
    for activity in ACTIVITIES_NEEDING_PHANTOMS:
        ws_m.append([activity, date(2026, 1, 1), "__phantom", None, "none"])

    wb.save(OUTPUT)
    print(f"Wrote {OUTPUT}")
    print(f"  Activities: {len(ACTIVITIES)} rows ({len(set(a for _, a, _, _ in ACTIVITIES))} distinct areas)")
    print(f"  Milestones: {len(MILESTONES)} real + {len(ACTIVITIES_NEEDING_PHANTOMS)} phantom = {len(MILESTONES) + len(ACTIVITIES_NEEDING_PHANTOMS)} rows")
    print(f"  Distinct types: {sorted(set(t for _, _, t, _, _ in MILESTONES))}")


if __name__ == "__main__":
    main()
