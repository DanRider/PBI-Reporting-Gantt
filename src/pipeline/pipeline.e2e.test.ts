import { describe, it, expect } from 'vitest';

import powerbi from 'powerbi-visuals-api';

import type { ColumnTree } from '../model/columnTree';
import type { FormatOptions } from '../model/formatOptions';
import { EMPTY_TREE } from '../model/pipelineStage';
import { BuildColumnTreeStage } from './buildColumnTree';
import { SynthesizePeriodLeavesStage } from './synthesizePeriodLeaves';
import { SynthesizeDeltaLeavesStage } from './synthesizeDeltaLeaves';
import {
  dateBucket,
  matrixWithRows,
  rowLeaf,
  root,
  source,
  synthOpts,
} from './__fixtures__/matrix';
import {
  allScenarios,
  fixture02BvaBudgetPair,
  fixture03FvaForecastPair,
  fixture04FvfTwoForecasts,
  fixture05FiscalYearJulStart,
} from './__fixtures__/scenarios';

import DataViewMatrix = powerbi.DataViewMatrix;

// The v0.1 hardcoded pipeline, folded over EMPTY_TREE exactly as the
// orchestrator will compose it in Wave 5.
const PIPELINE = [
  new BuildColumnTreeStage(),
  new SynthesizePeriodLeavesStage(),
  new SynthesizeDeltaLeavesStage(),
];

function runPipeline(matrix: DataViewMatrix, opts: FormatOptions): ColumnTree {
  return PIPELINE.reduce<ColumnTree>(
    (tree, stage) => stage.apply(tree, matrix, opts),
    EMPTY_TREE,
  );
}

describe('full pipeline — folds over EMPTY_TREE on every scenario', () => {
  for (const sc of allScenarios()) {
    it(`${sc.name} produces a non-empty, well-formed ColumnTree`, () => {
      const tree = runPipeline(sc.matrix, sc.opts);
      expect(tree.leaves.length).toBeGreaterThan(0);
      // Every header level aligns with the leaf count (depth-1 after synth).
      expect(tree.levels).toHaveLength(1);
      expect(tree.levels[0]).toHaveLength(tree.leaves.length);
      // Every synthetic leaf carries the indices it computes its value from.
      for (const leaf of tree.leaves) {
        if (leaf.isPeriodSynthesis) {
          expect(Array.isArray(leaf.periodSourceIdxs)).toBe(true);
        }
        if (leaf.isSynthetic) {
          expect(
            leaf.syntheticPair !== undefined || leaf.periodSourcePair !== undefined,
          ).toBe(true);
        }
      }
    });
  }
});

describe('fixture-02 — BvA budget pair', () => {
  it('pairs Sales + Budget per period and emits Δ/%Δ after each cluster', () => {
    const sc = fixture02BvaBudgetPair();
    const tree = runPipeline(sc.matrix, sc.opts);
    // Non-FY periods (MTD/QTD/YTD) each: Sales + Budget + Δ + %Δ.
    const mtd = tree.leaves.filter((l) => l.isPeriodSynthesis === 'mtd');
    expect(mtd).toHaveLength(2);
    const order = tree.leaves
      .filter((l) => l.groupLabel === mtd[0].groupLabel)
      .map((l) => l.isSynthetic);
    expect(order).toEqual([undefined, undefined, 'delta', 'deltaPct']);
  });

  it('the "Plan" source group label is superseded by the period group label', () => {
    const sc = fixture02BvaBudgetPair();
    const tree = runPipeline(sc.matrix, sc.opts);
    // synthesizePeriodLeaves rebuilds leaves; the period group label (not
    // the raw "Plan" source label) drives clustering downstream.
    expect(tree.leaves.every((l) => l.groupLabel !== 'Plan')).toBe(true);
  });
});

describe('fixture-03 — FvA forecast pair with FY override', () => {
  it('the FY column locks Forecast LEFT and hides the prior-Actual leaf', () => {
    const sc = fixture03FvaForecastPair();
    const tree = runPipeline(sc.matrix, sc.opts);
    const fy = tree.leaves.filter((l) => l.isPeriodSynthesis === 'fy');
    expect(fy.length).toBeGreaterThan(0);
    // Forecast is the first (LEFT) FY leaf; the Actual-prior companion is
    // emitted but suppressed (visible:false) while still carrying idxs.
    expect(fy[0].periodVariant).toBe('current');
    const hidden = fy.find((l) => !l.visible);
    expect(hidden).toBeDefined();
    expect(Array.isArray(hidden!.periodSourceIdxs)).toBe(true);
  });

  it('Δ/%Δ still synthesize for the FY cluster despite the hidden leaf', () => {
    const sc = fixture03FvaForecastPair();
    const tree = runPipeline(sc.matrix, sc.opts);
    const fyLabel = tree.leaves.find((l) => l.isPeriodSynthesis === 'fy')!.groupLabel;
    const fyCluster = tree.leaves.filter((l) => l.groupLabel === fyLabel);
    expect(fyCluster.some((l) => l.isSynthetic === 'delta')).toBe(true);
    expect(fyCluster.some((l) => l.isSynthetic === 'deltaPct')).toBe(true);
  });
});

describe('fixture-04 — FvF two forecasts', () => {
  it('pairs the two forecast cycles, excluding the Actual measure', () => {
    const sc = fixture04FvfTwoForecasts();
    const tree = runPipeline(sc.matrix, sc.opts);
    const mtd = tree.leaves.filter((l) => l.isPeriodSynthesis === 'mtd');
    // FvF mode pairs the two forecasts only — two leaves per period.
    expect(mtd).toHaveLength(2);
    expect(mtd.every((l) => l.periodVariant === 'current')).toBe(true);
  });

  it('every period cluster gets a Δ and %Δ', () => {
    const sc = fixture04FvfTwoForecasts();
    const tree = runPipeline(sc.matrix, sc.opts);
    const synth = tree.leaves.filter((l) => l.isSynthetic);
    // MTD/QTD/YTD/FY × {Δ,%Δ} — FvF keeps FY (not AvA). 4 periods × 2 = 8.
    expect(synth.filter((l) => l.isSynthetic === 'delta')).toHaveLength(4);
    expect(synth.filter((l) => l.isSynthetic === 'deltaPct')).toHaveLength(4);
  });
});

describe('fixture-05 — July fiscal-year wraparound', () => {
  it('QTD at Sep with a Jul FY start spans Jul–Sep (the fiscal Q1)', () => {
    const sc = fixture05FiscalYearJulStart();
    const tree = runPipeline(sc.matrix, sc.opts);
    const qtdCur = tree.leaves.find(
      (l) => l.isPeriodSynthesis === 'qtd' && l.periodVariant === 'current',
    )!;
    // Buckets: leafIdx 0=Jul 1=Aug 2=Sep — the fiscal quarter Jul–Sep.
    expect(qtdCur.periodSourceIdxs).toEqual([0, 1, 2]);
  });

  it('YTD at Sep with a Jul FY start also spans Jul–Sep', () => {
    const sc = fixture05FiscalYearJulStart();
    const tree = runPipeline(sc.matrix, sc.opts);
    const ytdCur = tree.leaves.find(
      (l) => l.isPeriodSynthesis === 'ytd' && l.periodVariant === 'current',
    )!;
    expect(ytdCur.periodSourceIdxs).toEqual([0, 1, 2]);
  });

  it('the QTD group label reports fiscal Q1 of FY2027', () => {
    const sc = fixture05FiscalYearJulStart();
    const tree = runPipeline(sc.matrix, sc.opts);
    const qtd = tree.leaves.find((l) => l.isPeriodSynthesis === 'qtd')!;
    expect(qtd.groupLabel).toBe('QTD · Q1 2027');
  });

  it('AvA still skips FY even with a non-calendar fiscal start', () => {
    const sc = fixture05FiscalYearJulStart();
    const tree = runPipeline(sc.matrix, sc.opts);
    expect(tree.leaves.some((l) => l.isPeriodSynthesis === 'fy')).toBe(false);
  });
});

describe('full pipeline — all four modes over one binding', () => {
  // A single 3-month Sales+Budget+Forecast depth-1-per-measure binding
  // exercised through every compare-against mode without crashing and
  // always yielding a coherent tree.
  function tripleMatrix(): DataViewMatrix {
    return matrixWithRows(
      root([
        dateBucket(new Date(2026, 0, 1), 0),
        dateBucket(new Date(2026, 0, 1), 1),
        dateBucket(new Date(2026, 0, 1), 2),
        dateBucket(new Date(2026, 1, 1), 0),
        dateBucket(new Date(2026, 1, 1), 1),
        dateBucket(new Date(2026, 1, 1), 2),
      ]),
      [
        source({ displayName: 'Sales', queryName: 'Sales.Amount', format: '$#,##0' }),
        source({ displayName: 'Budget', queryName: 'Budget.Amount', format: '$#,##0' }),
        source({ displayName: 'Forecast', queryName: 'Forecast.Amount', format: '$#,##0' }),
      ],
      [rowLeaf('USA', { 0: 10, 1: 9, 2: 11, 3: 20, 4: 18, 5: 22 })],
    );
  }

  for (const mode of ['priorYear', 'budget', 'forecast', 'forecastVsForecast'] as const) {
    it(`mode=${mode} yields a non-empty coherent tree`, () => {
      const tree = runPipeline(tripleMatrix(), synthOpts({ compareAgainstMode: mode }));
      expect(tree.leaves.length).toBeGreaterThan(0);
      expect(tree.levels[0]).toHaveLength(tree.leaves.length);
    });
  }
});
