"""Generate a generic project-tracking demo dataset for the Reporting Gantt visual.

Outputs Demo-Roadmap-Source.xlsx with:
  - 3 swim lanes (Engineering / Product / Operations)
  - 24 activities total (9 / 4 / 11 distribution)
  - 64 milestones across 2 types (Major / Minor)
  - Date range Q4 2025 → Q4 2027 (matches the original fixture so existing .pbip
    files render with the same time axis layout)
  - Includes phantom milestone rows for activities without real milestones
    (PBI relationship cross-join workaround)

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
    # Engineering (9)
    ("Auth Service v2",            "Engineering", Q(2026, 1),        Q(2026, 3, end=True)),
    ("API Gateway Migration",      "Engineering", Q(2025, 4),        Q(2026, 4, end=True)),
    ("Data Pipeline Refactor",     "Engineering", Q(2026, 1),        Q(2027, 1, end=True)),
    ("Mobile SDK 3.0",             "Engineering", Q(2026, 2),        Q(2027, 2, end=True)),
    ("Search Indexing",            "Engineering", Q(2026, 3),        Q(2027, 1, end=True)),
    ("Logging Pipeline",           "Engineering", Q(2025, 4),        Q(2026, 3, end=True)),
    ("Cache Layer Redesign",       "Engineering", Q(2026, 2),        Q(2026, 4, end=True)),
    ("Service Mesh Adoption",      "Engineering", Q(2026, 3),        Q(2027, 4, end=True)),
    ("Database Sharding",          "Engineering", Q(2026, 1),        Q(2027, 3, end=True)),
    # Product (4)
    ("Onboarding Redesign",        "Product",     Q(2026, 1),        Q(2026, 2, end=True)),
    ("Pricing Page A/B",           "Product",     Q(2026, 2),        Q(2026, 3, end=True)),
    ("Self-Serve Trial Flow",      "Product",     Q(2026, 2),        Q(2027, 1, end=True)),
    ("Settings Console Refresh",   "Product",     Q(2026, 4),        Q(2027, 2, end=True)),
    # Operations (11)
    ("SOC2 Type II Audit",         "Operations",  Q(2026, 1),        Q(2026, 4, end=True)),
    ("Vendor Consolidation",       "Operations",  Q(2026, 2),        Q(2027, 1, end=True)),
    ("Office Move",                "Operations",  Q(2026, 3),        Q(2027, 1, end=True)),    # phantom
    ("Equipment Refresh",          "Operations",  Q(2026, 4),        Q(2027, 2, end=True)),
    ("Procurement Workflow",       "Operations",  Q(2026, 1),        Q(2026, 4, end=True)),
    ("Compliance Training",        "Operations",  Q(2025, 4),        Q(2026, 2, end=True)),
    ("Disaster Recovery Plan",     "Operations",  Q(2026, 2),        Q(2027, 1, end=True)),
    ("Incident Response Playbook", "Operations",  Q(2026, 3),        Q(2027, 1, end=True)),
    ("Security Hardening",         "Operations",  Q(2026, 1),        Q(2027, 4, end=True)),
    ("Vendor SLA Renegotiation",   "Operations",  Q(2026, 4),        Q(2027, 2, end=True)),
    ("Performance Review Cycle",   "Operations",  Q(2025, 4),        Q(2026, 1, end=True)),    # phantom
]

# (Activity, Date, Type, Label, LabelPos)
MILESTONES: list[tuple[str, date, str, str | None, str]] = [
    # Auth Service v2 (3)
    ("Auth Service v2",            date(2026, 2, 15), "Major", "Design review",          "R"),
    ("Auth Service v2",            date(2026, 3, 10), "Minor", "Code freeze",            "L"),
    ("Auth Service v2",            date(2026, 3, 28), "Major", "GA",                      "R"),
    # API Gateway Migration (4)
    ("API Gateway Migration",      date(2026, 1, 15), "Minor", "Canary 10%",              "R"),
    ("API Gateway Migration",      date(2026, 5, 20), "Major", "50% traffic",             "R"),
    ("API Gateway Migration",      date(2026, 9, 15), "Major", "100% traffic",            "R"),
    ("API Gateway Migration",      date(2026, 12, 20),"Minor", "Legacy off",              "L"),
    # Data Pipeline Refactor (3)
    ("Data Pipeline Refactor",     date(2026, 2, 28), "Minor", "Schema lock",             "R"),
    ("Data Pipeline Refactor",     date(2026, 6, 15), "Major", "Cutover",                 "R"),
    ("Data Pipeline Refactor",     date(2026, 11, 30),"Major", "Decommission old",        "L"),
    # Mobile SDK 3.0 (3)
    ("Mobile SDK 3.0",             date(2026, 9, 10), "Minor", "Beta release",            "R"),
    ("Mobile SDK 3.0",             date(2026, 12, 1), "Major", "GA",                      "R"),
    ("Mobile SDK 3.0",             date(2027, 4, 20), "Major", "Adoption target met",     "R"),
    # Search Indexing (2)
    ("Search Indexing",            date(2026, 10, 15),"Major", "Index built",             "R"),
    ("Search Indexing",            date(2027, 1, 30), "Major", "Production",              "R"),
    # Logging Pipeline (3)
    ("Logging Pipeline",           date(2026, 1, 10), "Minor", "Schema design",           "R"),
    ("Logging Pipeline",           date(2026, 4, 15), "Major", "Live",                    "R"),
    ("Logging Pipeline",           date(2026, 8, 20), "Major", "Volume target met",       "R"),
    # Cache Layer Redesign (2)
    ("Cache Layer Redesign",       date(2026, 7, 1),  "Minor", "Architecture review",     "R"),
    ("Cache Layer Redesign",       date(2026, 11, 15),"Major", "Live",                    "R"),
    # Service Mesh Adoption (4)
    ("Service Mesh Adoption",      date(2026, 11, 1), "Minor", "POC complete",            "R"),
    ("Service Mesh Adoption",      date(2027, 3, 1),  "Major", "First service migrated",  "R"),
    ("Service Mesh Adoption",      date(2027, 8, 15), "Major", "50% services",            "R"),
    ("Service Mesh Adoption",      date(2027, 12, 1), "Major", "100% services",           "R"),
    # Database Sharding (3)
    ("Database Sharding",          date(2026, 5, 1),  "Minor", "Shard key chosen",        "R"),
    ("Database Sharding",          date(2026, 11, 1), "Major", "Shard 1 live",            "R"),
    ("Database Sharding",          date(2027, 6, 1),  "Major", "All shards migrated",     "R"),
    # Onboarding Redesign (3)
    ("Onboarding Redesign",        date(2026, 1, 25), "Minor", "Mockups",                 "R"),
    ("Onboarding Redesign",        date(2026, 3, 1),  "Major", "Live to 100%",            "R"),
    ("Onboarding Redesign",        date(2026, 5, 15), "Minor", "Iteration 2",             "R"),
    # Pricing Page A/B (2)
    ("Pricing Page A/B",           date(2026, 5, 1),  "Minor", "Variant launched",        "R"),
    ("Pricing Page A/B",           date(2026, 8, 5),  "Major", "Winner declared",         "R"),
    # Self-Serve Trial Flow (4)
    ("Self-Serve Trial Flow",      date(2026, 5, 20), "Minor", "Design freeze",           "R"),
    ("Self-Serve Trial Flow",      date(2026, 7, 20), "Minor", "MVP",                     "R"),
    ("Self-Serve Trial Flow",      date(2026, 12, 10),"Major", "Public launch",           "R"),
    ("Self-Serve Trial Flow",      date(2027, 2, 28), "Major", "Conversion target met",   "L"),
    # Settings Console Refresh (2)
    ("Settings Console Refresh",   date(2026, 12, 15),"Minor", "Phase 1",                 "R"),
    ("Settings Console Refresh",   date(2027, 5, 1),  "Major", "Phase 2 GA",              "R"),
    # SOC2 Type II Audit (3)
    ("SOC2 Type II Audit",         date(2026, 4, 1),  "Minor", "Evidence collection",     "R"),
    ("SOC2 Type II Audit",         date(2026, 8, 1),  "Minor", "Auditor on-site",         "R"),
    ("SOC2 Type II Audit",         date(2026, 11, 15),"Major", "Report received",         "R"),
    # Vendor Consolidation (3)
    ("Vendor Consolidation",       date(2026, 6, 1),  "Minor", "Vendor list approved",    "R"),
    ("Vendor Consolidation",       date(2026, 10, 1), "Major", "First 5 consolidated",    "R"),
    ("Vendor Consolidation",       date(2027, 1, 15), "Major", "Final wave complete",     "R"),
    # Equipment Refresh (2)
    ("Equipment Refresh",          date(2027, 1, 15), "Minor", "PO approved",             "R"),
    ("Equipment Refresh",          date(2027, 5, 1),  "Major", "Rollout complete",        "R"),
    # Procurement Workflow (3)
    ("Procurement Workflow",       date(2026, 3, 15), "Minor", "Process designed",        "R"),
    ("Procurement Workflow",       date(2026, 7, 1),  "Major", "Live in 1 BU",            "R"),
    ("Procurement Workflow",       date(2026, 11, 30),"Major", "Org-wide rollout",        "R"),
    # Compliance Training (2)
    ("Compliance Training",        date(2025, 12, 15),"Minor", "Curriculum approved",     "R"),
    ("Compliance Training",        date(2026, 6, 1),  "Major", "100% completion",         "R"),
    # Disaster Recovery Plan (3)
    ("Disaster Recovery Plan",     date(2026, 5, 1),  "Minor", "Tabletop exercise",       "R"),
    ("Disaster Recovery Plan",     date(2026, 10, 1), "Major", "Live failover test",      "R"),
    ("Disaster Recovery Plan",     date(2027, 1, 1),  "Major", "Cert renewal",            "L"),
    # Incident Response Playbook (3)
    ("Incident Response Playbook", date(2026, 9, 1),  "Minor", "v1 draft",                "R"),
    ("Incident Response Playbook", date(2026, 12, 1), "Major", "v1 ratified",             "R"),
    ("Incident Response Playbook", date(2027, 3, 15), "Major", "Drill executed",          "R"),
    # Security Hardening (5)
    ("Security Hardening",         date(2026, 3, 1),  "Minor", "Baseline scan",           "R"),
    ("Security Hardening",         date(2026, 7, 15), "Major", "Phase 1 complete",        "R"),
    ("Security Hardening",         date(2026, 11, 1), "Minor", "Pentest engaged",         "R"),
    ("Security Hardening",         date(2027, 5, 1),  "Major", "Phase 2 complete",        "R"),
    ("Security Hardening",         date(2027, 11, 30),"Major", "Pentest pass",            "R"),
    # Vendor SLA Renegotiation (2)
    ("Vendor SLA Renegotiation",   date(2027, 1, 15), "Minor", "Initial terms",           "R"),
    ("Vendor SLA Renegotiation",   date(2027, 5, 1),  "Major", "Contracts signed",        "R"),
]

# Activities without real milestones — need phantom rows so PBI's relationship
# cross-join doesn't drop them. The viewmodel filters Milestone Type === "__phantom".
PHANTOM_ACTIVITIES = ["Office Move", "Performance Review Cycle"]


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
    for activity in PHANTOM_ACTIVITIES:
        ws_m.append([activity, date(2026, 1, 1), "__phantom", None, "none"])

    wb.save(OUTPUT)

    types = sorted({t for _, _, t, _, _ in MILESTONES})
    areas = sorted({a for _, a, _, _ in ACTIVITIES})
    type_counts = {t: sum(1 for _, _, mt, _, _ in MILESTONES if mt == t) for t in types}
    area_counts = {a: sum(1 for _, ar, _, _ in ACTIVITIES if ar == a) for a in areas}

    print(f"Wrote {OUTPUT}")
    print(f"  Activities: {len(ACTIVITIES)} ({', '.join(f'{a}={n}' for a, n in area_counts.items())})")
    print(f"  Milestones: {len(MILESTONES)} real + {len(PHANTOM_ACTIVITIES)} phantom = {len(MILESTONES) + len(PHANTOM_ACTIVITIES)} rows")
    print(f"  Types: {', '.join(f'{t}={n}' for t, n in type_counts.items())}")


if __name__ == "__main__":
    main()
