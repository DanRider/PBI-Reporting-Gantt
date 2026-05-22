import { describe, it, expect } from 'vitest';
import {
  computeWindow,
  isInWindow,
  periodSum,
  priorPeriodSum,
  delta,
  deltaPct,
  sparklinePoints,
  trendSlope,
  runRate,
  TimeSeries,
  DatePoint,
} from './timeSeries';

// 12 monthly points (first of each month) at a flat value; reporting date
// is Dec 1 of the year so every period kind has samples to find.
function makeConstantSeries(
  rowKey: string,
  year: number,
  perMonth: number,
): TimeSeries {
  const pts: DatePoint[] = [];
  for (let m = 0; m < 12; m++) {
    pts.push({ date: new Date(year, m, 1), value: perMonth });
  }
  return {
    series: new Map([[rowKey, pts]]),
    reportingDate: new Date(year, 11, 1),
    fyStartMonth: 1,
    granularity: 'month',
    kind: 'date-bucketed',
  };
}

// Two stacked years: 12 prior-year months then 12 current-year months.
function makeTwoYearSeries(
  rowKey: string,
  year: number,
  currentPerMonth: number,
  priorPerMonth: number,
): TimeSeries {
  const pts: DatePoint[] = [];
  for (let m = 0; m < 12; m++) {
    pts.push({ date: new Date(year - 1, m, 1), value: priorPerMonth });
  }
  for (let m = 0; m < 12; m++) {
    pts.push({ date: new Date(year, m, 1), value: currentPerMonth });
  }
  return {
    series: new Map([[rowKey, pts]]),
    reportingDate: new Date(year, 11, 1),
    fyStartMonth: 1,
    granularity: 'month',
    kind: 'date-bucketed',
  };
}

const REF = new Date(2026, 11, 1);

describe('computeWindow — period semantics', () => {
  it('MTD current is [Dec 1, Dec 1]', () => {
    const w = computeWindow('mtd', 'current', REF, 1, 0);
    expect(w.start).toEqual(new Date(2026, 11, 1));
    expect(w.end).toEqual(new Date(2026, 11, 1));
  });

  it('QTD current (calendar FY) is [Oct 1, Dec 1]', () => {
    const w = computeWindow('qtd', 'current', REF, 1, 0);
    expect(w.start).toEqual(new Date(2026, 9, 1));
    expect(w.end).toEqual(new Date(2026, 11, 1));
  });

  it('YTD current is [Jan 1, Dec 1]', () => {
    const w = computeWindow('ytd', 'current', REF, 1, 0);
    expect(w.start).toEqual(new Date(2026, 0, 1));
    expect(w.end).toEqual(new Date(2026, 11, 1));
  });

  it('FY current is [Jan 1, Dec 31]', () => {
    const w = computeWindow('fy', 'current', REF, 1, 0);
    expect(w.start).toEqual(new Date(2026, 0, 1));
    expect(w.end).toEqual(new Date(2026, 11, 31));
  });

  it('FY with fyStartMonth=7 wraps Jul 2026 -> Jun 2027', () => {
    const w = computeWindow('fy', 'current', REF, 7, 0);
    expect(w.start).toEqual(new Date(2026, 6, 1));
    expect(w.end).toEqual(new Date(2027, 5, 30));
  });

  it('prior variant shifts back 12 months', () => {
    const w = computeWindow('mtd', 'prior', REF, 1, 0);
    expect(w.start).toEqual(new Date(2025, 11, 1));
    expect(w.end).toEqual(new Date(2025, 11, 1));
  });

  it('offsetYears stacks with the prior variant', () => {
    const w = computeWindow('mtd', 'prior', REF, 1, 1);
    expect(w.start).toEqual(new Date(2024, 11, 1));
  });
});

describe('isInWindow — inclusive boundaries', () => {
  const win = computeWindow('mtd', 'current', new Date(2026, 11, 15), 1, 0);

  it('start boundary is in', () => {
    expect(isInWindow(new Date(2026, 11, 1), win)).toBe(true);
  });

  it('end boundary is in', () => {
    expect(isInWindow(new Date(2026, 11, 15), win)).toBe(true);
  });

  it('one day before start is out', () => {
    expect(isInWindow(new Date(2026, 10, 30), win)).toBe(false);
  });

  it('one day after end is out', () => {
    expect(isInWindow(new Date(2026, 11, 16), win)).toBe(false);
  });
});

describe('periodSum — deterministic value assertions ($100/month x 12)', () => {
  const ts = makeConstantSeries('r', 2026, 100);

  it('MTD current = $100 (only Dec 1 in window)', () => {
    expect(periodSum(ts, 'r', 'mtd')).toBe(100);
  });

  it('QTD current = $300 (Oct, Nov, Dec)', () => {
    expect(periodSum(ts, 'r', 'qtd')).toBe(300);
  });

  it('YTD current = $1200 (all 12 months)', () => {
    expect(periodSum(ts, 'r', 'ytd')).toBe(1200);
  });

  it('FY current = $1200 (Jan 1 - Dec 31 covers the same months)', () => {
    expect(periodSum(ts, 'r', 'fy')).toBe(1200);
  });

  it('MTD, QTD, YTD are NOT all equal', () => {
    expect(periodSum(ts, 'r', 'mtd')).not.toBe(periodSum(ts, 'r', 'qtd'));
    expect(periodSum(ts, 'r', 'qtd')).not.toBe(periodSum(ts, 'r', 'ytd'));
  });

  it('unknown row returns null', () => {
    expect(periodSum(ts, 'missing', 'mtd')).toBeNull();
  });
});

describe('priorPeriodSum — 12-month shift', () => {
  const ts = makeTwoYearSeries('r', 2026, 100, 80);

  it('prior MTD = $80 (Dec 1 2025 value)', () => {
    expect(priorPeriodSum(ts, 'r', 'mtd')).toBe(80);
  });

  it('prior YTD = $960 (12 x $80 in 2025)', () => {
    expect(priorPeriodSum(ts, 'r', 'ytd')).toBe(960);
  });

  it('row missing returns null', () => {
    expect(priorPeriodSum(ts, 'missing', 'mtd')).toBeNull();
  });
});

describe('delta + deltaPct — pure arithmetic', () => {
  const ts = makeTwoYearSeries('r', 2026, 100, 80);

  it('MTD delta = $20 ($100 - $80)', () => {
    expect(delta(ts, 'r', 'mtd')).toBe(20);
  });

  it('YTD delta = $240 ($1200 - $960)', () => {
    expect(delta(ts, 'r', 'ytd')).toBe(240);
  });

  it('MTD deltaPct = 0.25 (20 / 80)', () => {
    expect(deltaPct(ts, 'r', 'mtd')).toBeCloseTo(0.25);
  });

  it('deltaPct guards prior == 0 (null) while delta still returns 100', () => {
    const zeroPrior = makeTwoYearSeries('r', 2026, 100, 0);
    expect(deltaPct(zeroPrior, 'r', 'mtd')).toBeNull();
    expect(delta(zeroPrior, 'r', 'mtd')).toBe(100);
  });

  it('delta with a missing prior series is null', () => {
    const currentOnly = makeConstantSeries('r', 2026, 100);
    expect(delta(currentOnly, 'r', 'mtd')).toBeNull();
  });
});

describe('sparklinePoints + trendSlope', () => {
  const flat = makeConstantSeries('r', 2026, 100);

  it('sparklinePoints with no window returns the whole series (12 points)', () => {
    expect(sparklinePoints(flat, 'r').length).toBe(12);
  });

  it('sparklinePoints with a QTD window returns Oct/Nov/Dec', () => {
    const pts = sparklinePoints(flat, 'r', 'qtd');
    expect(pts.length).toBe(3);
    expect(pts[0].date).toEqual(new Date(2026, 9, 1));
  });

  it('trendSlope on a constant series is exactly 0', () => {
    expect(trendSlope(flat, 'r')).toBe(0);
  });

  it('trendSlope on a strictly increasing series is +10/bucket', () => {
    const pts: DatePoint[] = [];
    for (let m = 0; m < 12; m++) {
      pts.push({ date: new Date(2026, m, 1), value: (m + 1) * 10 });
    }
    const ts: TimeSeries = {
      series: new Map([['r', pts]]),
      reportingDate: new Date(2026, 11, 1),
      fyStartMonth: 1,
      granularity: 'month',
      kind: 'date-bucketed',
    };
    const slope = trendSlope(ts, 'r');
    expect(slope).not.toBeNull();
    expect(slope as number).toBeGreaterThan(0);
    expect(slope as number).toBeCloseTo(10, 5);
  });

  it('trendSlope with fewer than 2 points is null', () => {
    const single: TimeSeries = {
      series: new Map([['r', [{ date: new Date(2026, 5, 1), value: 7 }]]]),
      reportingDate: new Date(2026, 11, 1),
      fyStartMonth: 1,
      granularity: 'month',
      kind: 'date-bucketed',
    };
    expect(trendSlope(single, 'r')).toBeNull();
  });
});

describe('runRate — pure annualization arithmetic', () => {
  const ts = makeConstantSeries('r', 2026, 100);

  it('YTD runRate is roughly a full year of accrual', () => {
    const rr = runRate(ts, 'r', 'ytd');
    expect(rr).not.toBeNull();
    expect(rr as number).toBeGreaterThan(1200);
    expect(rr as number).toBeLessThan(1400);
  });

  it('runRate on a missing row is null', () => {
    expect(runRate(ts, 'missing', 'ytd')).toBeNull();
  });
});

describe('Multi-row TimeSeries — series map isolation', () => {
  function twoRow(): TimeSeries {
    const canada: DatePoint[] = [];
    const usa: DatePoint[] = [];
    for (let m = 0; m < 12; m++) {
      canada.push({ date: new Date(2026, m, 1), value: 100 });
      usa.push({ date: new Date(2026, m, 1), value: 500 });
    }
    return {
      series: new Map([
        ['Canada', canada],
        ['USA', usa],
      ]),
      reportingDate: new Date(2026, 11, 1),
      fyStartMonth: 1,
      granularity: 'month',
      kind: 'date-bucketed',
    };
  }

  it('per-row YTD sums are independent', () => {
    const ts = twoRow();
    expect(periodSum(ts, 'Canada', 'ytd')).toBe(1200);
    expect(periodSum(ts, 'USA', 'ytd')).toBe(6000);
  });

  it('per-row MTD differs across rows', () => {
    const ts = twoRow();
    expect(periodSum(ts, 'Canada', 'mtd')).toBe(100);
    expect(periodSum(ts, 'USA', 'mtd')).toBe(500);
  });
});

describe('calc-group-evaluated kind — primitive shape compatibility', () => {
  const ts: TimeSeries = {
    series: new Map([['USA', [{ date: new Date(2026, 11, 1), value: 470170 }]]]),
    reportingDate: new Date(2026, 11, 1),
    fyStartMonth: 1,
    granularity: 'month',
    kind: 'calc-group-evaluated',
  };

  it('kind field roundtrips', () => {
    expect(ts.kind).toBe('calc-group-evaluated');
  });

  it('periodSum still works structurally on the calc-group shape', () => {
    expect(periodSum(ts, 'USA', 'mtd')).toBe(470170);
  });
});
