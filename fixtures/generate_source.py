"""Generate a generic project-tracking demo dataset for the Reporting Gantt visual.

Scenario: a 2.5-year operational modernization program at a mid-size industrial
equipment manufacturer — production lines, OT networks, ISO 9001 recertification,
supplier consolidation, fleet refresh. Industry-flavored content makes the demo
concrete; the visual itself works against any project-portfolio dataset.

Outputs Demo-Roadmap-Source.xlsx with:
  - 3 swim lanes: Production (9) / Product Development (4) / Supply Chain (11)
  - 24 activities total
  - 64 real milestones across 2 types (Major / Minor)
  - 2 phantom rows (Warehouse Move, Inventory Audit Cycle) to keep
    activity-without-milestones rows visible through PBI's relationship cross-join
  - Date range Q4 2025 -> Q4 2027

Run:
    python fixtures/generate_source.py
    pip install openpyxl   # one-time
"""
from __future__ import annotations
from datetime import date
from pathlib import Path

from openpyxl import Workbook

HERE = Path(__file__).parent.resolve()
OUTPUT = HERE / "Demo-Roadmap-Source.xlsx"


def Q(year: int, q: int, *, end: bool = False) -> date:
    if end:
        m, d = {1: (3, 31), 2: (6, 30), 3: (9, 30), 4: (12, 31)}[q]
        return date(year, m, d)
    return date(year, (q - 1) * 3 + 1, 1)


# (Activity, Area, Start, End)
ACTIVITIES: list[tuple[str, str, date, date]] = [
    # Production (9)
    ("Line 3 Automation",            "Production",          Q(2026, 1), Q(2026, 3, end=True)),
    ("Plant 2 Expansion",            "Production",          Q(2025, 4), Q(2026, 4, end=True)),
    ("MES Pipeline Refresh",         "Production",          Q(2026, 1), Q(2027, 1, end=True)),
    ("Mobile Operator Console",      "Production",          Q(2026, 2), Q(2027, 2, end=True)),
    ("Vision Inspection Rollout",    "Production",          Q(2026, 3), Q(2027, 1, end=True)),
    ("Sensor Telemetry Rollout",     "Production",          Q(2025, 4), Q(2026, 3, end=True)),
    ("Edge Compute Buildout",        "Production",          Q(2026, 2), Q(2026, 4, end=True)),
    ("Robotics Cell Network",        "Production",          Q(2026, 3), Q(2027, 4, end=True)),
    ("Plant Historian Migration",    "Production",          Q(2026, 1), Q(2027, 3, end=True)),
    # Product Development (4)
    ("Compact Series Redesign",      "Product Development", Q(2026, 1), Q(2026, 2, end=True)),
    ("Heavy-Duty Variant Launch",    "Product Development", Q(2026, 2), Q(2026, 3, end=True)),
    ("Sustainable Materials Program","Product Development", Q(2026, 2), Q(2027, 1, end=True)),
    ("CAD System Migration",         "Product Development", Q(2026, 4), Q(2027, 2, end=True)),
    # Supply Chain (11)
    ("ISO 9001 Recertification",     "Supply Chain",        Q(2026, 1), Q(2026, 4, end=True)),
    ("Supplier Consolidation",       "Supply Chain",        Q(2026, 2), Q(2027, 1, end=True)),
    ("Warehouse Move",               "Supply Chain",        Q(2026, 3), Q(2027, 1, end=True)),    # phantom
    ("Fleet Refresh",                "Supply Chain",        Q(2026, 4), Q(2027, 2, end=True)),
    ("Procurement Workflow",         "Supply Chain",        Q(2026, 1), Q(2026, 4, end=True)),
    ("Safety Training Refresh",      "Supply Chain",        Q(2025, 4), Q(2026, 2, end=True)),
    ("Business Continuity Program",  "Supply Chain",        Q(2026, 2), Q(2027, 1, end=True)),
    ("Plant Incident Response",      "Supply Chain",        Q(2026, 3), Q(2027, 1, end=True)),
    ("OT Network Segmentation",      "Supply Chain",        Q(2026, 1), Q(2027, 4, end=True)),
    ("3PL Renegotiation",            "Supply Chain",        Q(2026, 4), Q(2027, 2, end=True)),
    ("Inventory Audit Cycle",        "Supply Chain",        Q(2025, 4), Q(2026, 1, end=True)),    # phantom
]

# (Activity, Date, Type, Label, LabelPos)
MILESTONES: list[tuple[str, date, str, str | None, str]] = [
    # Line 3 Automation (3)
    ("Line 3 Automation",            date(2026, 2, 15), "Major", "Cell design review",          "R"),
    ("Line 3 Automation",            date(2026, 3, 10), "Minor", "Equipment delivered",         "L"),
    ("Line 3 Automation",            date(2026, 3, 28), "Major", "Line live",                   "R"),
    # Plant 2 Expansion (4)
    ("Plant 2 Expansion",            date(2026, 1, 15), "Minor", "Groundbreaking",              "R"),
    ("Plant 2 Expansion",            date(2026, 5, 20), "Major", "Foundation poured",           "R"),
    ("Plant 2 Expansion",            date(2026, 9, 15), "Major", "Equipment installed",         "R"),
    ("Plant 2 Expansion",            date(2026, 12, 20),"Minor", "Commissioning",               "L"),
    # MES Pipeline Refresh (3)
    ("MES Pipeline Refresh",         date(2026, 2, 28), "Minor", "Schema lock",                 "R"),
    ("MES Pipeline Refresh",         date(2026, 6, 15), "Major", "MES cutover",                 "R"),
    ("MES Pipeline Refresh",         date(2026, 11, 30),"Major", "Legacy SCADA off",            "L"),
    # Mobile Operator Console (3)
    ("Mobile Operator Console",      date(2026, 9, 10), "Minor", "Pilot floor rollout",         "R"),
    ("Mobile Operator Console",      date(2026, 12, 1), "Major", "Full deployment",             "R"),
    ("Mobile Operator Console",      date(2027, 4, 20), "Major", "Adoption target met",         "R"),
    # Vision Inspection Rollout (2)
    ("Vision Inspection Rollout",    date(2026, 10, 15),"Major", "Cameras installed",           "R"),
    ("Vision Inspection Rollout",    date(2027, 1, 30), "Major", "Inspection live",             "R"),
    # Sensor Telemetry Rollout (3)
    ("Sensor Telemetry Rollout",     date(2026, 1, 10), "Minor", "Tag mapping complete",        "R"),
    ("Sensor Telemetry Rollout",     date(2026, 4, 15), "Major", "Telemetry live",              "R"),
    ("Sensor Telemetry Rollout",     date(2026, 8, 20), "Major", "Coverage target met",         "R"),
    # Edge Compute Buildout (2)
    ("Edge Compute Buildout",        date(2026, 7, 1),  "Minor", "Reference architecture",      "R"),
    ("Edge Compute Buildout",        date(2026, 11, 15),"Major", "Edge nodes live",             "R"),
    # Robotics Cell Network (4)
    ("Robotics Cell Network",        date(2026, 11, 1), "Minor", "POC cell complete",           "R"),
    ("Robotics Cell Network",        date(2027, 3, 1),  "Major", "First cell migrated",         "R"),
    ("Robotics Cell Network",        date(2027, 8, 15), "Major", "50% cells migrated",          "R"),
    ("Robotics Cell Network",        date(2027, 12, 1), "Major", "All cells migrated",          "R"),
    # Plant Historian Migration (3)
    ("Plant Historian Migration",    date(2026, 5, 1),  "Minor", "Plant 1 tag mapping",         "R"),
    ("Plant Historian Migration",    date(2026, 11, 1), "Major", "Plant 1 cut over",            "R"),
    ("Plant Historian Migration",    date(2027, 6, 1),  "Major", "All plants migrated",         "R"),
    # Compact Series Redesign (3)
    ("Compact Series Redesign",      date(2026, 1, 25), "Minor", "Concept review",              "R"),
    ("Compact Series Redesign",      date(2026, 3, 1),  "Major", "Pilot production run",        "R"),
    ("Compact Series Redesign",      date(2026, 5, 15), "Minor", "V2 spec released",            "R"),
    # Heavy-Duty Variant Launch (2)
    ("Heavy-Duty Variant Launch",    date(2026, 5, 1),  "Minor", "Prototype A complete",        "R"),
    ("Heavy-Duty Variant Launch",    date(2026, 8, 5),  "Major", "Launch approved",             "R"),
    # Sustainable Materials Program (4)
    ("Sustainable Materials Program",date(2026, 5, 20), "Minor", "Material spec frozen",        "R"),
    ("Sustainable Materials Program",date(2026, 7, 20), "Minor", "First test batch",            "R"),
    ("Sustainable Materials Program",date(2026, 12, 10),"Major", "Customer shipments begin",    "R"),
    ("Sustainable Materials Program",date(2027, 2, 28), "Major", "Adoption target met",         "L"),
    # CAD System Migration (2)
    ("CAD System Migration",         date(2026, 12, 15),"Minor", "Engineering pilot",           "R"),
    ("CAD System Migration",         date(2027, 5, 1),  "Major", "Org-wide rollout",            "R"),
    # ISO 9001 Recertification (3)
    ("ISO 9001 Recertification",     date(2026, 4, 1),  "Minor", "Internal audit complete",     "R"),
    ("ISO 9001 Recertification",     date(2026, 8, 1),  "Minor", "External auditor on-site",    "R"),
    ("ISO 9001 Recertification",     date(2026, 11, 15),"Major", "Certificate received",        "R"),
    # Supplier Consolidation (3)
    ("Supplier Consolidation",       date(2026, 6, 1),  "Minor", "Supplier list approved",      "R"),
    ("Supplier Consolidation",       date(2026, 10, 1), "Major", "First 5 consolidated",        "R"),
    ("Supplier Consolidation",       date(2027, 1, 15), "Major", "Final wave complete",         "R"),
    # Fleet Refresh (2)
    ("Fleet Refresh",                date(2027, 1, 15), "Minor", "PO approved",                 "R"),
    ("Fleet Refresh",                date(2027, 5, 1),  "Major", "Fleet replacement complete",  "R"),
    # Procurement Workflow (3)
    ("Procurement Workflow",         date(2026, 3, 15), "Minor", "Process designed",            "R"),
    ("Procurement Workflow",         date(2026, 7, 1),  "Major", "Pilot site live",             "R"),
    ("Procurement Workflow",         date(2026, 11, 30),"Major", "Org-wide rollout",            "R"),
    # Safety Training Refresh (2)
    ("Safety Training Refresh",      date(2025, 12, 15),"Minor", "Curriculum approved",         "R"),
    ("Safety Training Refresh",      date(2026, 6, 1),  "Major", "100% completion",             "R"),
    # Business Continuity Program (3)
    ("Business Continuity Program",  date(2026, 5, 1),  "Minor", "Tabletop exercise",           "R"),
    ("Business Continuity Program",  date(2026, 10, 1), "Major", "Plant failover test",         "R"),
    ("Business Continuity Program",  date(2027, 1, 1),  "Major", "Recertification complete",    "L"),
    # Plant Incident Response (3)
    ("Plant Incident Response",      date(2026, 9, 1),  "Minor", "v1 draft",                    "R"),
    ("Plant Incident Response",      date(2026, 12, 1), "Major", "v1 ratified",                 "R"),
    ("Plant Incident Response",      date(2027, 3, 15), "Major", "Cross-plant drill",           "R"),
    # OT Network Segmentation (5)
    ("OT Network Segmentation",      date(2026, 3, 1),  "Minor", "Baseline scan",               "R"),
    ("OT Network Segmentation",      date(2026, 7, 15), "Major", "Plant 1 segmented",           "R"),
    ("OT Network Segmentation",      date(2026, 11, 1), "Minor", "Pentest engaged",             "R"),
    ("OT Network Segmentation",      date(2027, 5, 1),  "Major", "All plants segmented",        "R"),
    ("OT Network Segmentation",      date(2027, 11, 30),"Major", "Pentest pass",                "R"),
    # 3PL Renegotiation (2)
    ("3PL Renegotiation",            date(2027, 1, 15), "Minor", "Initial terms",               "R"),
    ("3PL Renegotiation",            date(2027, 5, 1),  "Major", "Contracts signed",            "R"),
]

# Activities without real milestones — need phantom rows so PBI's relationship
# cross-join doesn't drop them. The viewmodel filters Milestone Type === "__phantom".
PHANTOM_ACTIVITIES = ["Warehouse Move", "Inventory Audit Cycle"]

# Sparse Activity Notes — keyed by activity name. Status notes shown in tooltip
# on hover for the bar. Most activities have no note (realistic — not every
# project has a current status callout). v1.8.0.0 feature.
ACTIVITY_NOTES: dict[str, str] = {
    "Plant 2 Expansion":            "Permits cleared; foundation contractor confirmed for May start.",
    "Mobile Operator Console":      "Pilot floor adoption running ahead of target — 38 of 40 operators trained.",
    "Robotics Cell Network":        "Vendor SLA renegotiation may push final cell migration into Q1 2028.",
    "Sustainable Materials Program":"Material spec frozen after 3 rounds with engineering and procurement.",
    "ISO 9001 Recertification":     "External auditor confirmed for Aug 1–4; evidence binders 80% ready.",
    "OT Network Segmentation":      "Pentest scope expanded to include the new robotics cell network.",
    "Business Continuity Program":  "Tabletop exercise revealed gap in supplier-escalation path; remediation in v1.1.",
    "Procurement Workflow":         "Pilot site (Plant 1) live and stable; org-wide rollout cleared for Nov.",
}

# Sparse Milestone Notes — keyed by (activity, milestone date, type). ~10 of 64
# milestones have notes. Status callouts for specific events.
MILESTONE_NOTES: dict[tuple[str, date, str], str] = {
    ("Plant 2 Expansion",         date(2026, 5, 20),  "Major"): "Concrete pour delayed 3 days due to weather; on critical path.",
    ("Plant 2 Expansion",         date(2026, 9, 15),  "Major"): "Two CNC mills arriving Q3 from Yamazaki; install crew booked.",
    ("MES Pipeline Refresh",      date(2026, 6, 15),  "Major"): "Cutover plan reviewed with operations; rollback path documented.",
    ("Mobile Operator Console",   date(2026, 12, 1),  "Major"): "Hardware refresh (Zebra TC52) ordered alongside software rollout.",
    ("ISO 9001 Recertification",  date(2026, 8, 1),   "Minor"): "Lead auditor: Mary Chen, KPMG. 4-day on-site engagement.",
    ("ISO 9001 Recertification",  date(2026, 11, 15), "Major"): "Certificate valid through November 2029 (3-year cycle).",
    ("OT Network Segmentation",   date(2026, 7, 15),  "Major"): "VLAN inventory complete; 47 firewall rule changes approved.",
    ("OT Network Segmentation",   date(2026, 11, 1),  "Minor"): "External pentest firm: Praetorian Security; SOW signed.",
    ("Plant Incident Response",   date(2026, 12, 1),  "Major"): "v1 ratified by ops council; rollout to all 3 plants begins Q1.",
    ("Supplier Consolidation",    date(2026, 10, 1),  "Major"): "First 5 consolidated: ~12% spend reduction realized in Q4.",
}


def main() -> None:
    wb = Workbook()
    ws_a = wb.active
    ws_a.title = "Activities"
    ws_a.append(["Activity", "Area", "Start Date", "End Date", "SortOrder", "Activity Note"])
    for i, (name, area, start, end) in enumerate(ACTIVITIES):
        ws_a.append([name, area, start, end, i, ACTIVITY_NOTES.get(name)])

    ws_m = wb.create_sheet("Milestones")
    ws_m.append(["Activity", "Milestone Date", "Milestone Type", "Milestone Label", "Label Position", "Milestone Note"])
    for activity, mdate, mtype, label, pos in MILESTONES:
        ws_m.append([activity, mdate, mtype, label, pos, MILESTONE_NOTES.get((activity, mdate, mtype))])
    for activity in PHANTOM_ACTIVITIES:
        ws_m.append([activity, date(2026, 1, 1), "__phantom", None, "none", None])

    wb.save(OUTPUT)

    types = sorted({t for _, _, t, _, _ in MILESTONES})
    areas = sorted({a for _, a, _, _ in ACTIVITIES})
    type_counts = {t: sum(1 for _, _, mt, _, _ in MILESTONES if mt == t) for t in types}
    area_counts = {a: sum(1 for _, ar, _, _ in ACTIVITIES if ar == a) for a in areas}
    activity_notes_filled = sum(1 for name, _, _, _ in ACTIVITIES if name in ACTIVITY_NOTES)
    milestone_notes_filled = sum(1 for activity, mdate, mtype, _, _ in MILESTONES if (activity, mdate, mtype) in MILESTONE_NOTES)

    print(f"Wrote {OUTPUT}")
    print(f"  Activities: {len(ACTIVITIES)} ({', '.join(f'{a}={n}' for a, n in area_counts.items())})")
    print(f"  Milestones: {len(MILESTONES)} real + {len(PHANTOM_ACTIVITIES)} phantom = {len(MILESTONES) + len(PHANTOM_ACTIVITIES)} rows")
    print(f"  Types: {', '.join(f'{t}={n}' for t, n in type_counts.items())}")
    print(f"  Notes: {activity_notes_filled}/{len(ACTIVITIES)} activities + {milestone_notes_filled}/{len(MILESTONES)} milestones populated")


if __name__ == "__main__":
    main()
