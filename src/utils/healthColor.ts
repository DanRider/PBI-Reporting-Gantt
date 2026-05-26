// v2.2 B3 — reusable health/status -> color resolver.
//
// Maps both LITERAL color names ("Green" / "Yellow" / "Red") AND common
// SEMANTIC-status strings ("On Track" / "At Risk" / "Off Track" /
// "Blocked" / "Complete" / "Done" / etc.) to a user-configurable
// Green/Yellow/Red palette. Falls back to a neutral grey for unrecognized
// values or null/empty input.
//
// Replaces the hardcoded inline regex at milestoneDetail.ts (which only
// matched literal color names, so real-data semantic values like "On
// Track" fell through to grey). Will also back S1's status dots when
// PR-2 lands the activityHealth role.

export interface HealthColorPalette {
    green:    string;
    yellow:   string;
    red:      string;
    fallback: string;
}

export const DEFAULT_HEALTH_PALETTE: HealthColorPalette = {
    green:    "#2ca02c",
    yellow:   "#e6b800",
    red:      "#d62728",
    fallback: "#888888",
};

// Patterns are intentionally LIBERAL — match the user's natural-language
// vocabulary for status. Word-boundary anchors on \bok\b / \bbad\b avoid
// false matches inside larger words ("oktoberfest" / "badass"). The
// [\s_-]* between words tolerates "On Track" / "on-track" / "OnTrack".
const GREEN_PATTERN  = /^g$|green|on[\s_-]*track|\bok\b|complete|done|good/i;
const YELLOW_PATTERN = /^y$|yellow|amber|at[\s_-]*risk|warning|caution/i;
const RED_PATTERN    = /^r$|red|off[\s_-]*track|blocked|critical|\bbad\b/i;

export function healthColor(
    value: string | null,
    palette: HealthColorPalette = DEFAULT_HEALTH_PALETTE,
): string {
    if (value == null) return palette.fallback;
    const trimmed = value.trim();
    if (trimmed.length === 0) return palette.fallback;
    if (GREEN_PATTERN.test(trimmed))  return palette.green;
    if (YELLOW_PATTERN.test(trimmed)) return palette.yellow;
    if (RED_PATTERN.test(trimmed))    return palette.red;
    return palette.fallback;
}
