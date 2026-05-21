// L1 primitive. The single source of truth for time intelligence: given a
// per-row series of (date, value) points plus a reporting date and fiscal
// calendar, it answers period sums (MTD/QTD/YTD/FY), prior-period sums,
// deltas, trend slope, sparkline windows, and a linear run-rate. Pure: no
// Power BI imports, no DOM, no state — every export is a function of its
// arguments so both depth-1 and depth-2 matrix shapes converge here.

export type RowKey = string;
export type PeriodKind = 'mtd' | 'qtd' | 'ytd' | 'fy';
export type PeriodVariant = 'current' | 'prior';
export type Granularity = 'day' | 'month' | 'quarter' | 'year';
export type TimeSeriesKind = 'date-bucketed' | 'calc-group-evaluated';
export type FyStartMonth = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface DatePoint {
  readonly date: Date;
  readonly value: number;
}

export interface TimeSeries {
  readonly series: ReadonlyMap<RowKey, readonly DatePoint[]>;
  readonly reportingDate: Date;
  readonly fyStartMonth: FyStartMonth;
  readonly granularity: Granularity;
  readonly kind: TimeSeriesKind;
}

export interface PeriodWindow {
  readonly period: PeriodKind;
  readonly variant: PeriodVariant;
  readonly start: Date;
  readonly end: Date;
}

export interface PeriodSumOpts {
  readonly offsetYears?: number;
}

const ONE_DAY = 24 * 60 * 60 * 1000;

// runRate compares "elapsed so far" against the full enclosing period. For
// a year-to-date measure that enclosing period is the whole fiscal year.
const FULL_WINDOW_KIND: Record<PeriodKind, PeriodKind> = {
  mtd: 'mtd',
  qtd: 'qtd',
  ytd: 'fy',
  fy: 'fy',
};

function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// Walk back from the date to its fiscal-quarter start. The quarter start
// month can land in the prior calendar year (e.g. an Oct fiscal-year start
// makes Jan fall in the quarter that began the previous October).
function firstOfFiscalQuarter(d: Date, fyStartMonth: number): Date {
  const fyStart0 = (fyStartMonth - 1 + 12) % 12;
  const monthsSinceFyStart = (d.getMonth() - fyStart0 + 12) % 12;
  const quarterIdx = Math.floor(monthsSinceFyStart / 3);
  const quarterStartMonth0 = (fyStart0 + quarterIdx * 3) % 12;
  let year = d.getFullYear();
  if (quarterStartMonth0 > d.getMonth()) {
    year = d.getFullYear() - 1;
  }
  return new Date(year, quarterStartMonth0, 1);
}

function firstOfFiscalYear(d: Date, fyStartMonth: number): Date {
  const fyStart0 = (fyStartMonth - 1 + 12) % 12;
  if (d.getMonth() >= fyStart0) {
    return new Date(d.getFullYear(), fyStart0, 1);
  }
  return new Date(d.getFullYear() - 1, fyStart0, 1);
}

// Last day of the fiscal year = one day before the next fiscal year's
// start. The subtraction handles month/year rollover without a table.
function lastOfFiscalYear(d: Date, fyStartMonth: number): Date {
  const fyStart = firstOfFiscalYear(d, fyStartMonth);
  const nextStart = new Date(
    fyStart.getFullYear() + 1,
    fyStart.getMonth(),
    1,
  );
  return new Date(nextStart.getTime() - ONE_DAY);
}

function shiftBackYears(d: Date, years: number): Date {
  return new Date(d.getFullYear() - years, d.getMonth(), d.getDate());
}

// `null` (not 0) when a row has no points in the window: a real zero and
// "no samples" must stay distinguishable for downstream delta math.
function sumInWindow(
  points: readonly DatePoint[],
  window: PeriodWindow,
): number | null {
  let sum = 0;
  let hasValue = false;
  for (const p of points) {
    if (isInWindow(p.date, window)) {
      sum += p.value;
      hasValue = true;
    }
  }
  return hasValue ? sum : null;
}

// The prior variant is just a 12-month shift; offsetYears stacks on top so
// callers can ask for "two years before prior" without new period kinds.
export function computeWindow(
  period: PeriodKind,
  variant: PeriodVariant,
  reportingDate: Date,
  fyStartMonth = 1,
  offsetYears = 0,
): PeriodWindow {
  const yearShift = (variant === 'prior' ? 1 : 0) + offsetYears;
  const refDate =
    yearShift === 0 ? reportingDate : shiftBackYears(reportingDate, yearShift);

  let start: Date;
  let end: Date;
  switch (period) {
    case 'mtd':
      start = firstOfMonth(refDate);
      end = refDate;
      break;
    case 'qtd':
      start = firstOfFiscalQuarter(refDate, fyStartMonth);
      end = refDate;
      break;
    case 'ytd':
      start = firstOfFiscalYear(refDate, fyStartMonth);
      end = refDate;
      break;
    case 'fy':
      start = firstOfFiscalYear(refDate, fyStartMonth);
      end = lastOfFiscalYear(refDate, fyStartMonth);
      break;
  }
  return { period, variant, start, end };
}

// Both ends inclusive: a point dated exactly on the reporting date counts.
export function isInWindow(d: Date, window: PeriodWindow): boolean {
  return (
    d.getTime() >= window.start.getTime() &&
    d.getTime() <= window.end.getTime()
  );
}

export function periodSum(
  ts: TimeSeries,
  row: RowKey,
  kind: PeriodKind,
  opts?: PeriodSumOpts,
): number | null {
  const points = ts.series.get(row);
  if (!points || points.length === 0) {
    return null;
  }
  const window = computeWindow(
    kind,
    'current',
    ts.reportingDate,
    ts.fyStartMonth,
    opts?.offsetYears ?? 0,
  );
  return sumInWindow(points, window);
}

export function priorPeriodSum(
  ts: TimeSeries,
  row: RowKey,
  kind: PeriodKind,
): number | null {
  const points = ts.series.get(row);
  if (!points || points.length === 0) {
    return null;
  }
  const window = computeWindow(
    kind,
    'prior',
    ts.reportingDate,
    ts.fyStartMonth,
    0,
  );
  return sumInWindow(points, window);
}

// Returns the current value even when deltaPct is undefined (prior == 0);
// only a missing side (no samples) collapses delta itself to null.
export function delta(
  ts: TimeSeries,
  row: RowKey,
  kind: PeriodKind,
): number | null {
  const cur = periodSum(ts, row, kind);
  const pri = priorPeriodSum(ts, row, kind);
  if (cur == null || pri == null) {
    return null;
  }
  return cur - pri;
}

// Guarded against divide-by-zero AND a missing prior: a percentage change
// off a zero base is undefined, not infinite.
export function deltaPct(
  ts: TimeSeries,
  row: RowKey,
  kind: PeriodKind,
): number | null {
  const cur = periodSum(ts, row, kind);
  const pri = priorPeriodSum(ts, row, kind);
  if (cur == null || pri == null || pri === 0) {
    return null;
  }
  return (cur - pri) / pri;
}

// No window = the row's whole series, returned in adapter order (the
// adapter, not this primitive, owns chronological ordering).
export function sparklinePoints(
  ts: TimeSeries,
  row: RowKey,
  window?: PeriodKind,
): readonly DatePoint[] {
  const points = ts.series.get(row);
  if (!points || points.length === 0) {
    return [];
  }
  if (window === undefined) {
    return points;
  }
  const w = computeWindow(
    window,
    'current',
    ts.reportingDate,
    ts.fyStartMonth,
    0,
  );
  return points.filter((p) => isInWindow(p.date, w));
}

// Least-squares slope over the bucket index (x = 0..n-1). A flat series
// yields exactly 0; fewer than two points or a degenerate x-spread is
// null because a slope is not meaningful there.
export function trendSlope(
  ts: TimeSeries,
  row: RowKey,
  window?: PeriodKind,
): number | null {
  const points = sparklinePoints(ts, row, window);
  const n = points.length;
  if (n < 2) {
    return null;
  }
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    const y = points[i].value;
    sumX += i;
    sumY += y;
    sumXY += i * y;
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) {
    return null;
  }
  return (n * sumXY - sumX * sumY) / denom;
}

// Pure arithmetic annualization: scale what has accrued by the ratio of
// the full enclosing period's days to the days elapsed. Not a forecast.
export function runRate(
  ts: TimeSeries,
  row: RowKey,
  kind: PeriodKind,
): number | null {
  const cur = periodSum(ts, row, kind);
  if (cur == null) {
    return null;
  }
  const win = computeWindow(
    kind,
    'current',
    ts.reportingDate,
    ts.fyStartMonth,
    0,
  );
  const fullWindow = computeWindow(
    FULL_WINDOW_KIND[kind],
    'current',
    ts.reportingDate,
    ts.fyStartMonth,
    0,
  );
  const daysElapsed =
    Math.floor((win.end.getTime() - win.start.getTime()) / ONE_DAY) + 1;
  const daysInPeriod =
    Math.floor(
      (fullWindow.end.getTime() - fullWindow.start.getTime()) / ONE_DAY,
    ) + 1;
  if (daysElapsed === 0) {
    return null;
  }
  return (cur * daysInPeriod) / daysElapsed;
}
