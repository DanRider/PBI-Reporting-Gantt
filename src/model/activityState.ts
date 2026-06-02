"use strict";

import { Activity } from "../viewmodel";

// INF-3787 Phase 3 — glide-path model layer.
//
// Pure functions for deriving slip semantics + activity state. No
// rendering concerns (colors, geometry); render verbs map magnitude/
// direction to their own visual encoding. No d3, no DOM, no PBI runtime
// — testable in isolation.
//
// Decision #3 (INF-3791 build brief) default thresholds (days):
//   |slip| <= 2  → negligible (on-track)
//   |slip| <= 7  → minor
//   |slip| <= 30 → major
//   |slip| >  30 → critical
//
// Thresholds are constants here; Phase 4 wires a Format-pane card that
// passes overrides through. Until then these are the single source of
// truth and slipChevron / future glide-path consumers MUST import from
// here (no inline duplicates — Phase 2's slipChevron inline categorize
// was a temporary self-containedness measure that gets deleted in the
// same commit as this file lands).

const MS_PER_DAY = 86_400_000;

export const SLIP_NEGLIGIBLE_DAYS = 2;
export const SLIP_MINOR_DAYS = 7;
export const SLIP_MAJOR_DAYS = 30;

/**
 * Magnitude-band thresholds in days. Decision #3 ships defaults but
 * exposes the values via a Format-pane card (Phase 4). The render path
 * (settings → glidePath orchestrator → slipChevron verb → computeSlip)
 * threads the user-overridden thresholds through; tests + non-format-
 * pane callers omit the arg and pick up DEFAULT_SLIP_THRESHOLDS.
 */
export interface SlipThresholds {
    /** |slip| <= this value → "negligible" magnitude / "on-track" direction */
    negligibleDays: number;
    /** |slip| in (negligibleDays, minorDays] → "minor" */
    minorDays: number;
    /** |slip| in (minorDays, majorDays] → "major"; > majorDays → "critical" */
    majorDays: number;
}

export const DEFAULT_SLIP_THRESHOLDS: SlipThresholds = {
    negligibleDays: SLIP_NEGLIGIBLE_DAYS,
    minorDays: SLIP_MINOR_DAYS,
    majorDays: SLIP_MAJOR_DAYS,
};

export type SlipDirection = "slipping" | "on-track" | "pulled-in";
export type SlipMagnitude = "negligible" | "minor" | "major" | "critical";

export interface SlipResult {
    /** Signed: positive = slipping later, negative = pulled in earlier. */
    days: number;
    direction: SlipDirection;
    magnitude: SlipMagnitude;
}

export interface ActivityWithState {
    base: Activity;
    hasBaseline: boolean;
    hasActual: boolean;
    /** null when baselineEnd is unbound (slip undefined). */
    slip: SlipResult | null;
}

/**
 * Signed slip days + direction + magnitude band for an activity.
 * Returns null when baselineEnd is missing (slip is undefined without
 * a committed baseline to compare against).
 *
 * forecastEnd is required because Activity.end is non-optional in this
 * codebase — there is always a current forecast.
 */
export function computeSlip(
    baselineEnd: Date | undefined,
    forecastEnd: Date,
    thresholds: SlipThresholds = DEFAULT_SLIP_THRESHOLDS
): SlipResult | null {
    if (baselineEnd == null) return null;
    const days = (forecastEnd.getTime() - baselineEnd.getTime()) / MS_PER_DAY;
    return categorizeSlip(days, thresholds);
}

/**
 * Categorize a signed slip-day count into direction + magnitude band.
 * Negligible slips collapse to "on-track" direction regardless of sign
 * — within the no-noise threshold (±2d default), drift is treated as
 * uninteresting.
 */
export function categorizeSlip(
    slipDays: number,
    thresholds: SlipThresholds = DEFAULT_SLIP_THRESHOLDS
): SlipResult {
    const abs = Math.abs(slipDays);
    let magnitude: SlipMagnitude;
    if (abs <= thresholds.negligibleDays)      magnitude = "negligible";
    else if (abs <= thresholds.minorDays)      magnitude = "minor";
    else if (abs <= thresholds.majorDays)      magnitude = "major";
    else                                       magnitude = "critical";

    let direction: SlipDirection;
    if (magnitude === "negligible") direction = "on-track";
    else                            direction = slipDays > 0 ? "slipping" : "pulled-in";

    return { days: slipDays, direction, magnitude };
}

/**
 * Enrich an Activity with presence flags + computed slip. Pure.
 *
 * `today` is accepted for forward compatibility with Phase 4+ TODAY-
 * aware logic (e.g., bounding actualEnd to today for in-progress work,
 * or distinguishing "this activity is late and has no recorded
 * progress" from "this activity is in-progress and ahead of plan").
 * Currently unused by the body but kept in the signature so callers
 * pass today consistently and the contract is stable across phases.
 */
export function deriveState(
    activity: Activity,
    _today: Date,
    thresholds: SlipThresholds = DEFAULT_SLIP_THRESHOLDS
): ActivityWithState {
    const hasBaseline = activity.baselineStart != null && activity.baselineEnd != null;
    const hasActual = activity.actualStart != null && activity.actualEnd != null;
    const slip = computeSlip(activity.baselineEnd, activity.end, thresholds);
    return { base: activity, hasBaseline, hasActual, slip };
}
