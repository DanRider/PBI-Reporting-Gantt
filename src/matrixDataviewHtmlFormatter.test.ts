// @vitest-environment jsdom
//
// L4 integration. The whole stack, end to end: every named fixture folded
// through MatrixDataviewHtmlFormatter.format — which runs the
// detectFormatHints pre-pass, the three hardcoded pipeline stages over
// EMPTY_TREE, and the render orchestrator — across every compare-against
// mode. This is the wave's behavioral proof that cards/settings/entry
// wiring produces a coherent DOM for all six blueprint fixtures without a
// real Power BI host.

import { describe, it, expect } from 'vitest';

import powerbi from 'powerbi-visuals-api';

import { MatrixDataviewHtmlFormatter } from './matrixDataviewHtmlFormatter';
import type { CompareAgainstMode, FormatOptions } from './model/formatOptions';
import { allScenarios } from './pipeline/__fixtures__/scenarios';
import type { Scenario } from './pipeline/__fixtures__/scenarios';
import type { ResolvedTheme } from './primitives/theme';

import DataViewMatrix = powerbi.DataViewMatrix;
import ISelectionId = powerbi.visuals.ISelectionId;

const MODES: readonly CompareAgainstMode[] = [
  'priorYear',
  'budget',
  'forecast',
  'forecastVsForecast',
];

function theme(): ResolvedTheme {
  return {
    headerBg: '#101010',
    headerFg: '#f0f0f0',
    bodyFg: '#d0d0d0',
    borderFg: '#404040',
    altRowBg: '#1c1c1c',
    ibcsPositive: '#1aa260',
    ibcsNegative: '#c0392b',
    ibcsNeutral: '#808080',
  };
}

// A no-op selection stand-in shaped like SelectionWiring — the render
// orchestrator only calls clear() off the empty-chrome click path here.
class StubSelection {
  clearCalls = 0;
  idForRowNode(): ISelectionId {
    return { equals: () => false } as unknown as ISelectionId;
  }
  select(): Promise<ISelectionId[]> {
    return Promise.resolve([]);
  }
  clear(): Promise<void> {
    this.clearCalls += 1;
    return Promise.resolve();
  }
  getSelectionIds(): ISelectionId[] {
    return [];
  }
  isSelected(): boolean {
    return false;
  }
}

// Promotes a pipeline-only scenario's FormatOptions to a render-capable
// one: real theme + a stub selection, mode overridden per case. The
// scenario's synthesis knobs (periods, fiscal start, denomination) pass
// straight through.
function renderable(sc: Scenario, mode: CompareAgainstMode): FormatOptions {
  return {
    ...sc.opts,
    theme: theme(),
    selection: new StubSelection() as unknown as FormatOptions['selection'],
    compareAgainstMode: mode,
  };
}

function format(matrix: DataViewMatrix, opts: FormatOptions): HTMLElement {
  return MatrixDataviewHtmlFormatter.format(matrix, opts);
}

describe('MatrixDataviewHtmlFormatter — all six fixtures × four modes', () => {
  for (const sc of allScenarios()) {
    for (const mode of MODES) {
      it(`${sc.name} renders a coherent table in mode=${mode}`, () => {
        const root = format(sc.matrix, renderable(sc, mode));

        expect(root.classList.contains('rg-matrix-lt2')).toBe(true);
        expect(root.querySelector('.rg-controls')).not.toBeNull();
        const table = root.querySelector('.rg-matrix-table table');
        expect(table).not.toBeNull();

        // The colgroup has the corner col plus exactly one col per leaf;
        // the leaf header row carries the same corner spacer + a th per
        // leaf, so the two counts agree.
        const cols = root.querySelectorAll('colgroup col');
        const leafRowCells = root.querySelectorAll('thead tr:last-child th');
        expect(cols.length).toBeGreaterThan(1);
        expect(cols.length).toBe(leafRowCells.length);
        expect(cols[0].classList.contains('rg-col-corner')).toBe(true);

        // Every fixture binds at least one row, so the body is non-empty
        // and each body row carries one value cell per leaf.
        const bodyRows = root.querySelectorAll('tbody tr');
        expect(bodyRows.length).toBeGreaterThan(0);
        const firstRowCells = bodyRows[0].querySelectorAll('td');
        expect(firstRowCells.length).toBe(cols.length - 1);

        // Synthesis ran: the leaf count exceeds the bound source count
        // (period + variance columns were appended by the pipeline).
        const sources = sc.matrix.valueSources.length;
        expect(cols.length - 1).toBeGreaterThan(sources);
      });
    }
  }
});

describe('MatrixDataviewHtmlFormatter — orchestrator contract', () => {
  it('returns a valid tagged empty container when the matrix is absent', () => {
    const root = MatrixDataviewHtmlFormatter.format(undefined, renderable(
      allScenarios()[0],
      'priorYear',
    ));
    expect(root.className).toBe('rg-matrix-lt2');
    expect(root.querySelector('table')).toBeNull();
  });

  it('does not mutate the caller FormatOptions (formatHints stays the seed)', () => {
    const sc = allScenarios()[0];
    const opts = renderable(sc, 'priorYear');
    const seededHints = opts.formatHints;
    format(sc.matrix, opts);
    expect(opts.formatHints).toBe(seededHints);
  });

  it('never emits a tfoot when showGrandTotal is off', () => {
    for (const sc of allScenarios()) {
      const root = format(sc.matrix, renderable(sc, 'priorYear'));
      expect(root.querySelector('tfoot')).toBeNull();
    }
  });

  it('applies the selected appearance theme to the root', () => {
    const sc = allScenarios()[0];
    const root = format(sc.matrix, {
      ...renderable(sc, 'priorYear'),
      appearanceTheme: 'newsprint',
    });
    expect(root.classList.contains('rg-theme-newsprint')).toBe(true);
  });
});
