import { describe, it, expect } from 'vitest';

import { EMPTY_TREE } from '../model/pipelineStage';
import { BuildColumnTreeStage } from './buildColumnTree';
import { SynthesizePeriodLeavesStage } from './synthesizePeriodLeaves';
import {
  dateBucket,
  dateGroup,
  matrixWithRows,
  rowLeaf,
  root,
  source,
  synthOpts,
} from './__fixtures__/matrix';

const build = new BuildColumnTreeStage();
const period = new SynthesizePeriodLeavesStage();

function d(year: number, month1: number): Date {
  return new Date(year, month1 - 1, 1);
}

// Run buildColumnTree then synthesizePeriodLeaves over the same matrix.
function run(m: Parameters<typeof period.apply>[1], o: Parameters<typeof period.apply>[2]) {
  const base = build.apply(EMPTY_TREE, m, o);
  return period.apply(base, m, o);
}

// A single-measure 3-month depth-1 binding (AvA shape).
function avaMatrix() {
  return matrixWithRows(
    root([dateBucket(d(2026, 1)), dateBucket(d(2026, 2)), dateBucket(d(2026, 3))]),
    [source({ displayName: 'Sales', queryName: 'qSales', format: '$#,##0' })],
    [rowLeaf('USA', { 0: 100, 1: 200, 2: 300 })],
  );
}

// A two-measure depth-2 binding (paired-mode shape).
function pairedMatrix(secondName: string) {
  return matrixWithRows(
    root([dateGroup(d(2026, 1), [0, 1]), dateGroup(d(2026, 2), [0, 1])]),
    [
      source({ displayName: 'Sales', queryName: 'Sales.Amount' }),
      source({ displayName: secondName, queryName: `${secondName}.Amount` }),
    ],
    [rowLeaf('USA', { 0: 100, 1: 90, 2: 110, 3: 95 })],
  );
}

describe('SynthesizePeriodLeavesStage — guards', () => {
  it('returns the input tree when no period toggle is on', () => {
    const m = avaMatrix();
    const o = synthOpts({ showMtd: false, showQtd: false, showYtd: false, showFy: false });
    const base = build.apply(EMPTY_TREE, m, o);
    expect(period.apply(base, m, o)).toBe(base);
  });

  it('returns the input tree when columns are not date-driven', () => {
    const m = matrixWithRows(
      root([dateBucket('Sales')]),
      [source({ displayName: 'S' })],
      [rowLeaf('R', { 0: 1 })],
    );
    const o = synthOpts();
    const base = build.apply(EMPTY_TREE, m, o);
    expect(period.apply(base, m, o)).toBe(base);
  });

  it('the stage name is synthesizePeriodLeaves', () => {
    expect(period.name).toBe('synthesizePeriodLeaves');
  });
});

describe('SynthesizePeriodLeavesStage — AvA (priorYear)', () => {
  it('emits MTD/QTD/YTD with a current + prior companion each', () => {
    const tree = run(avaMatrix(), synthOpts({ compareAgainstMode: 'priorYear' }));
    const kinds = tree.leaves.map((l) => [l.isPeriodSynthesis, l.periodVariant]);
    expect(kinds).toEqual([
      ['mtd', 'current'], ['mtd', 'prior'],
      ['qtd', 'current'], ['qtd', 'prior'],
      ['ytd', 'current'], ['ytd', 'prior'],
    ]);
  });

  it('skips FY in AvA (structurally Dec YTD)', () => {
    const tree = run(avaMatrix(), synthOpts({ compareAgainstMode: 'priorYear', showFy: true }));
    expect(tree.leaves.some((l) => l.isPeriodSynthesis === 'fy')).toBe(false);
  });

  it('prior-year off drops the prior companions', () => {
    const tree = run(
      avaMatrix(),
      synthOpts({ compareAgainstMode: 'priorYear', showPriorYear: false }),
    );
    expect(tree.leaves.every((l) => l.periodVariant === 'current')).toBe(true);
    expect(tree.leaves).toHaveLength(3);
  });

  it('every synthetic leaf carries periodSourceIdxs and a group label', () => {
    const tree = run(avaMatrix(), synthOpts({ compareAgainstMode: 'priorYear' }));
    for (const l of tree.leaves) {
      expect(Array.isArray(l.periodSourceIdxs)).toBe(true);
      expect(l.groupLabel && l.groupLabel.length > 0).toBe(true);
    }
  });

  it('MTD current window selects only the reporting-month leaf index', () => {
    // Reporting date = max bucket = Mar (leafIdx 2). MTD current = [2].
    const tree = run(avaMatrix(), synthOpts({ compareAgainstMode: 'priorYear' }));
    const mtdCur = tree.leaves.find(
      (l) => l.isPeriodSynthesis === 'mtd' && l.periodVariant === 'current',
    )!;
    expect(mtdCur.periodSourceIdxs).toEqual([2]);
  });

  it('YTD current window spans all three month leaves', () => {
    const tree = run(avaMatrix(), synthOpts({ compareAgainstMode: 'priorYear' }));
    const ytdCur = tree.leaves.find(
      (l) => l.isPeriodSynthesis === 'ytd' && l.periodVariant === 'current',
    )!;
    expect(ytdCur.periodSourceIdxs).toEqual([0, 1, 2]);
  });

  it('group labels carry smart period context', () => {
    const tree = run(avaMatrix(), synthOpts({ compareAgainstMode: 'priorYear' }));
    const mtd = tree.leaves.find((l) => l.isPeriodSynthesis === 'mtd')!;
    const ytd = tree.leaves.find((l) => l.isPeriodSynthesis === 'ytd')!;
    expect(mtd.groupLabel).toBe('MTD · Mar 2026');
    expect(ytd.groupLabel).toBe('YTD · Mar 2026');
  });

  it('rewrites the tree to a single header level', () => {
    const tree = run(avaMatrix(), synthOpts({ compareAgainstMode: 'priorYear' }));
    expect(tree.levels).toHaveLength(1);
    expect(tree.levels[0]).toHaveLength(tree.leaves.length);
  });
});

describe('SynthesizePeriodLeavesStage — BvA / FvA paired modes', () => {
  it('BvA renders both Sales and Budget current for non-FY periods', () => {
    // FY off so the BvA-no-forecast FY fallback (Budget+Actual-prior) does
    // not introduce a prior variant; MTD/QTD/YTD are all paired-current.
    const tree = run(
      pairedMatrix('Budget'),
      synthOpts({ compareAgainstMode: 'budget', showFy: false }),
    );
    expect(tree.leaves.every((l) => l.periodVariant === 'current')).toBe(true);
    const mtd = tree.leaves.filter((l) => l.isPeriodSynthesis === 'mtd');
    expect(mtd).toHaveLength(2);
  });

  it('BvA includes FY (not skipped in paired modes)', () => {
    const tree = run(
      pairedMatrix('Budget'),
      synthOpts({ compareAgainstMode: 'budget', showFy: true }),
    );
    expect(tree.leaves.some((l) => l.isPeriodSynthesis === 'fy')).toBe(true);
  });

  it('FvA hides the Actual leaf in the FY column but keeps its source idxs', () => {
    const tree = run(
      pairedMatrix('Forecast'),
      synthOpts({ compareAgainstMode: 'forecast', showFy: true }),
    );
    const fyLeaves = tree.leaves.filter((l) => l.isPeriodSynthesis === 'fy');
    // FY override pairs Forecast (left) + Actual-prior (right); Actual leaf
    // is hidden but still carries period source indices for the Δ stage.
    const hidden = fyLeaves.find((l) => !l.visible);
    expect(hidden).toBeDefined();
    expect(Array.isArray(hidden!.periodSourceIdxs)).toBe(true);
  });

  it('non-actual paired leaf is labelled by its measure name', () => {
    const tree = run(pairedMatrix('Budget'), synthOpts({ compareAgainstMode: 'budget' }));
    const mtd = tree.leaves.filter((l) => l.isPeriodSynthesis === 'mtd');
    const labels = mtd.map((l) => l.defaultLabel);
    expect(labels).toContain('Budget');
  });
});

describe('SynthesizePeriodLeavesStage — reporting date override', () => {
  it('selectedDate ISO matching a bucket month overrides max(date)', () => {
    // Pick Feb (leafIdx 1) instead of the Mar max. MTD current = [1].
    const tree = run(
      avaMatrix(),
      synthOpts({ compareAgainstMode: 'priorYear', selectedDate: '2026-02-15' }),
    );
    const mtdCur = tree.leaves.find(
      (l) => l.isPeriodSynthesis === 'mtd' && l.periodVariant === 'current',
    )!;
    expect(mtdCur.periodSourceIdxs).toEqual([1]);
  });

  it('an out-of-range selectedDate falls back to max(date)', () => {
    const tree = run(
      avaMatrix(),
      synthOpts({ compareAgainstMode: 'priorYear', selectedDate: '2099-09-01' }),
    );
    const mtdCur = tree.leaves.find(
      (l) => l.isPeriodSynthesis === 'mtd' && l.periodVariant === 'current',
    )!;
    expect(mtdCur.periodSourceIdxs).toEqual([2]);
  });
});
