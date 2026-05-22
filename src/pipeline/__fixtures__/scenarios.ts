// Test fixtures. The named compare-against scenarios the end-to-end
// pipeline test folds over: a budget pair, a forecast pair, two forecasts,
// and a non-calendar fiscal year. Each returns a fully-formed
// DataViewMatrix with date-bucketed depth-2 columns and a populated rows
// tree, plus the FormatOptions the scenario exercises. They build on the
// low-level matrix.ts builders; this file only composes them into the
// blueprint's named cases so individual tests stay terse.

import powerbi from 'powerbi-visuals-api';

import type { FormatOptions } from '../../model/formatOptions';
import {
  dateGroup,
  matrixWithRows,
  rowLeaf,
  root,
  source,
  synthOpts,
} from './matrix';

import DataViewMatrix = powerbi.DataViewMatrix;

export interface Scenario {
  readonly name: string;
  readonly matrix: DataViewMatrix;
  readonly opts: FormatOptions;
}

// Local-time month anchor — coerceToDate parses ISO strings as UTC, which
// shifts back a month at the boundary in a negative-offset zone, so every
// fixture stamps its buckets with explicit Date objects.
function m(year: number, month1: number): Date {
  return new Date(year, month1 - 1, 1);
}

// fixture-01 — the AvA baseline. One Sales measure across Jan–Mar 2026,
// prior-year compare, so the pipeline synthesizes MTD/QTD/YTD with a
// prior-year companion and Δ/%Δ per pair off a single bound source.
export function fixture01SingleMeasureMonthly(): Scenario {
  const matrix = matrixWithRows(
    root([
      dateGroup(m(2026, 1), [0]),
      dateGroup(m(2026, 2), [0]),
      dateGroup(m(2026, 3), [0]),
    ]),
    [source({ displayName: 'Sales', queryName: 'Sales.Amount', format: '$#,##0' })],
    [
      rowLeaf('USA', { 0: 100, 1: 200, 2: 300 }),
      rowLeaf('EMEA', { 0: 50, 1: 60, 2: 70 }),
    ],
  );
  return {
    name: 'fixture-01-single-measure-monthly',
    matrix,
    opts: synthOpts({ compareAgainstMode: 'priorYear' }),
  };
}

// fixture-06 — format edge cases. Three measures whose source format
// strings stress detectFormatHints (currency, percent, integer) and a
// thousands denomination so the value path scales in JS. AvA so the
// windowing stays simple and the fixture's stress is purely formatting.
export function fixture06FormatEdgeCases(): Scenario {
  const matrix = matrixWithRows(
    root([
      dateGroup(m(2026, 1), [0, 1, 2]),
      dateGroup(m(2026, 2), [0, 1, 2]),
      dateGroup(m(2026, 3), [0, 1, 2]),
    ]),
    [
      source({ displayName: 'Revenue', queryName: 'Revenue.Amount', format: '$#,##0.00' }),
      source({ displayName: 'Margin %', queryName: 'Margin.Pct', format: '0.0%' }),
      source({ displayName: 'Units', queryName: 'Units.Count', format: '#,##0' }),
    ],
    [
      rowLeaf('USA', {
        0: 1_250_000, 1: 0.42, 2: 9000,
        3: 2_500_000, 4: 0.45, 5: 9800,
        6: 3_750_000, 7: 0.48, 8: 10_500,
      }),
    ],
  );
  return {
    name: 'fixture-06-format-edge-cases',
    matrix,
    opts: synthOpts({ compareAgainstMode: 'priorYear', denomination: 'thousands', decimals: 1 }),
  };
}

// fixture-02 — BvA. Sales + Budget across Jan–Mar 2026, both under the
// "Plan" group label, classified by queryName so the mode filter pairs
// them. Δ = Sales − Budget per period.
export function fixture02BvaBudgetPair(): Scenario {
  const matrix = matrixWithRows(
    root([
      dateGroup(m(2026, 1), [0, 1]),
      dateGroup(m(2026, 2), [0, 1]),
      dateGroup(m(2026, 3), [0, 1]),
    ]),
    [
      source({ displayName: 'Sales', queryName: 'Sales.Amount', format: '$#,##0', groupLabel: 'Plan' }),
      source({ displayName: 'Budget', queryName: 'Budget.Amount', format: '$#,##0', groupLabel: 'Plan' }),
    ],
    [
      // leafIdx layout per bucket: 0=Sales 1=Budget
      rowLeaf('USA', { 0: 100, 1: 90, 2: 200, 3: 180, 4: 300, 5: 280 }),
      rowLeaf('EMEA', { 0: 50, 1: 55, 2: 60, 3: 58, 4: 70, 5: 75 }),
    ],
  );
  return {
    name: 'fixture-02-bva-budget-pair',
    matrix,
    opts: synthOpts({ compareAgainstMode: 'budget' }),
  };
}

// fixture-03 — FvA. Sales + Forecast across Jan–Mar 2026. FY override
// applies (Forecast LEFT vs prior-year Actual when no budget bound).
export function fixture03FvaForecastPair(): Scenario {
  const matrix = matrixWithRows(
    root([
      dateGroup(m(2026, 1), [0, 1]),
      dateGroup(m(2026, 2), [0, 1]),
      dateGroup(m(2026, 3), [0, 1]),
    ]),
    [
      source({ displayName: 'Sales', queryName: 'Sales.Amount', format: '$#,##0' }),
      source({ displayName: 'Forecast', queryName: 'Forecast.Amount', format: '$#,##0' }),
    ],
    [
      rowLeaf('USA', { 0: 100, 1: 110, 2: 200, 3: 190, 4: 300, 5: 320 }),
    ],
  );
  return {
    name: 'fixture-03-fva-forecast-pair',
    matrix,
    opts: synthOpts({ compareAgainstMode: 'forecast' }),
  };
}

// fixture-04 — FvF. Two forecast cycles (Mar and Sep re-plans) across
// Jan–Mar 2026; the mode filter must pick both forecasts and pair them.
export function fixture04FvfTwoForecasts(): Scenario {
  const matrix = matrixWithRows(
    root([
      dateGroup(m(2026, 1), [0, 1, 2]),
      dateGroup(m(2026, 2), [0, 1, 2]),
      dateGroup(m(2026, 3), [0, 1, 2]),
    ]),
    [
      source({ displayName: 'Sales', queryName: 'Sales.Amount', format: '$#,##0' }),
      source({ displayName: 'Forecast Mar', queryName: 'Forecast_Mar.Amount', format: '$#,##0' }),
      source({ displayName: 'Forecast Sep', queryName: 'Forecast_Sep.Amount', format: '$#,##0' }),
    ],
    [
      // leafIdx per bucket: 0=Sales 1=Fcst_Mar 2=Fcst_Sep
      rowLeaf('USA', { 0: 100, 1: 105, 2: 102, 3: 200, 4: 210, 5: 205, 6: 300, 7: 295, 8: 310 }),
    ],
  );
  return {
    name: 'fixture-04-fvf-two-forecasts',
    matrix,
    opts: synthOpts({ compareAgainstMode: 'forecastVsForecast' }),
  };
}

// fixture-05 — non-calendar fiscal year starting July. The reporting date
// is Sep 2026, so QTD/YTD/FY windows wrap around the calendar-year
// boundary (FY2027 = Jul 2026 → Jun 2027). Single-measure AvA so the
// windowing math is what the fixture stresses.
export function fixture05FiscalYearJulStart(): Scenario {
  const matrix = matrixWithRows(
    root([
      dateGroup(m(2026, 7), [0]),
      dateGroup(m(2026, 8), [0]),
      dateGroup(m(2026, 9), [0]),
    ]),
    [source({ displayName: 'Sales', queryName: 'Sales.Amount', format: '$#,##0' })],
    [rowLeaf('USA', { 0: 700, 1: 800, 2: 900 })],
  );
  return {
    name: 'fixture-05-fiscal-year-jul-start',
    matrix,
    opts: synthOpts({ compareAgainstMode: 'priorYear', fyStartMonth: 7, showFy: true }),
  };
}

export function allScenarios(): Scenario[] {
  return [
    fixture01SingleMeasureMonthly(),
    fixture02BvaBudgetPair(),
    fixture03FvaForecastPair(),
    fixture04FvfTwoForecasts(),
    fixture05FiscalYearJulStart(),
    fixture06FormatEdgeCases(),
  ];
}
