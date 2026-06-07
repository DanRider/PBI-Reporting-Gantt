# Security Policy

## Supported versions

The latest released version of Reporting Gantt is the supported version
for security updates. Older versions do not receive backports.

| Version | Supported |
|---------|-----------|
| v3.0.x  | ✅ Yes (current) |
| v2.x    | ❌ Please upgrade |
| v1.x    | ❌ Please upgrade |

## Reporting a vulnerability

If you discover a security vulnerability in Reporting Gantt, please
report it **privately** so we can address it before it becomes public.

**Do not** open a public GitHub Issue for security reports.

### Where to report

Email: **daniel.rider@hotmail.com**

Include in your report:
- A description of the vulnerability
- Steps to reproduce, including:
  - The Power BI Desktop version
  - The Reporting Gantt version (visible in visual tooltip)
  - The data roles bound and any relevant Format Pane configuration
  - A minimal `.pbix` file demonstrating the issue (anonymized data only)
- The potential impact (data exposure, DOM injection, persistence
  abuse, etc.)
- Whether you believe the issue is exploitable in Power BI Service
  (cloud) or only in Power BI Desktop (local).

### What to expect

- Acknowledgment within 5 business days
- A status update within 14 business days, including whether the issue
  is accepted, the severity assessment, and an estimated fix timeline
- Credit in the fix release (if you wish), or anonymous acknowledgment

### Scope

In scope:
- Cross-site scripting (XSS) via data-bound content
- DOM mutation that escapes the Power BI sandbox
- Persistent state manipulation that affects other users' views
- Privilege escalation or data leakage between visuals on the same
  report
- Dependency vulnerabilities in the compiled binary

Out of scope:
- Power BI Desktop or Power BI Service vulnerabilities not specific to
  this visual (report those to Microsoft)
- Theoretical timing attacks without practical exploit
- Self-XSS that requires the victim to paste content into their own
  visual configuration
- Denial of service via deliberately malformed data input (the visual
  will degrade gracefully but is not expected to handle arbitrary
  malicious input)

### Coordinated disclosure

We follow a 90-day coordinated disclosure timeline. Once a fix is
released, you are free to publish your findings. If circumstances
require an extended embargo, we will discuss directly.

---

**Reporting Gantt** © 2026 Daniel Rider. All rights reserved.
