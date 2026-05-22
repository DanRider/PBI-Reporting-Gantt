// Render-layer test fixtures. The render layer consumes a finished
// ColumnTree plus the matrix rows tree and a resolved FormatOptions — it
// never runs the pipeline — so these builders fabricate those three
// inputs directly. They deliberately do NOT import the pipeline's
// __fixtures__: the eslint layer rule forbids render/ (tests included)
// from reaching into pipeline/, and the render contract is the tree
// type, not how the tree was produced. Power BI's public types refuse to
// expose `values`/`level` on DataViewMatrixNode even though the runtime
// carries them, so the construction casts are confined to this one file.

import powerbi from 'powerbi-visuals-api';

import type {
  ColumnLeaf,
  ColumnLevelEntry,
  ColumnTree,
  ValueFormatter,
} from '../../model/columnTree';
import type { FormatOptions } from '../../model/formatOptions';
import type { ResolvedTheme } from '../../primitives/theme';

import DataViewMatrix = powerbi.DataViewMatrix;
import DataViewMatrixNode = powerbi.DataViewMatrixNode;
import ISelectionId = powerbi.visuals.ISelectionId;
import PrimitiveValue = powerbi.PrimitiveValue;

// A plain two-decimal stringifier so a test can assert on the exact text
// a cell renders without depending on PBI's real formatter.
export const plainFormatter: ValueFormatter = (v) =>
  v == null ? '' : typeof v === 'number' ? v.toFixed(2) : String(v);

// A high-contrast theme whose slots are all distinct so a test can read
// back which slot painted which element.
export function testTheme(): ResolvedTheme {
  return {
    headerBg: '#111111',
    headerFg: '#eeeeee',
    bodyFg: '#cccccc',
    borderFg: '#444444',
    altRowBg: '#222222',
    ibcsPositive: '#00aa00',
    ibcsNegative: '#cc0000',
    ibcsNeutral: '#888888',
  };
}

// A stub selection id whose equality is reference identity — enough for
// the repaint pass to round-trip a stashed id.
function stubId(token: string): ISelectionId {
  const id = {
    token,
    equals(other: unknown): boolean {
      return (other as { token?: string })?.token === token;
    },
  };
  return id as unknown as ISelectionId;
}

// A SelectionWiring stand-in. `selectedToken` decides which row reads as
// selected during a repaint; select/clear record their calls so a test
// can assert the click path fired.
export class FakeSelection {
  selectedToken: string | null = null;
  readonly selectCalls: Array<{ multi: boolean }> = [];
  clearCalls = 0;

  idForRowNode(node: DataViewMatrixNode): ISelectionId {
    return stubId(String((node as { value?: PrimitiveValue }).value ?? ''));
  }

  select(id: ISelectionId, multi: boolean): Promise<ISelectionId[]> {
    this.selectCalls.push({ multi });
    this.selectedToken = (id as unknown as { token: string }).token;
    return Promise.resolve([id]);
  }

  clear(): Promise<void> {
    this.clearCalls += 1;
    this.selectedToken = null;
    return Promise.resolve();
  }

  getSelectionIds(): ISelectionId[] {
    return this.selectedToken ? [stubId(this.selectedToken)] : [];
  }

  isSelected(id: ISelectionId): boolean {
    const token = (id as unknown as { token: string }).token;
    return this.selectedToken === token;
  }
}

interface LeafInit {
  label: string;
  leafIndex?: number;
  groupLabel?: string;
  isSynthetic?: 'delta' | 'deltaPct';
  isPeriodSynthesis?: 'mtd' | 'qtd' | 'ytd' | 'fy';
  syntheticPair?: { currentLeafIdx: number; priorLeafIdx: number };
  periodSourcePair?: { currentLeafIdxs: number[]; priorLeafIdxs: number[] };
  periodSourceIdxs?: number[];
  sourceIndex?: number;
  formatter?: ValueFormatter;
}

// Builds one ColumnLeaf with a borrowed node carrying the source index
// the favorability lookup reads.
export function leaf(init: LeafInit): ColumnLeaf {
  const node = {
    level: 1,
    levelSourceIndex: init.sourceIndex ?? 0,
  } as unknown as DataViewMatrixNode;
  return {
    node,
    leafIndex: init.leafIndex ?? -1,
    formatter: init.formatter ?? plainFormatter,
    defaultLabel: init.label,
    visible: true,
    groupLabel: init.groupLabel,
    isSynthetic: init.isSynthetic,
    isPeriodSynthesis: init.isPeriodSynthesis,
    syntheticPair: init.syntheticPair,
    periodSourcePair: init.periodSourcePair,
    periodSourceIdxs: init.periodSourceIdxs,
  };
}

// A single-level tree (leaf row only) — the shape after the pipeline
// flattens period + delta synthetics.
export function flatTree(leaves: ColumnLeaf[]): ColumnTree {
  const level: ColumnLevelEntry[] = leaves.map((l) => ({ node: l.node, leafCount: 1 }));
  return { levels: [level], leaves };
}

// A two-level tree: one parent header spanning all leaves, then the leaf
// level — exercises the belowOuter span-row placement.
export function nestedTree(parentLabel: string, leaves: ColumnLeaf[]): ColumnTree {
  const parentNode = { level: 0, value: parentLabel } as unknown as DataViewMatrixNode;
  const parentLevel: ColumnLevelEntry[] = [{ node: parentNode, leafCount: leaves.length }];
  const leafLevel: ColumnLevelEntry[] = leaves.map((l) => ({ node: l.node, leafCount: 1 }));
  return { levels: [parentLevel, leafLevel], leaves };
}

// One body row carrying a values bag keyed by leaf/source index.
export function rowLeaf(label: string, cells: Record<number, number>): DataViewMatrixNode {
  const values: Record<number, { value: number }> = {};
  for (const k of Object.keys(cells)) {
    values[Number(k)] = { value: cells[Number(k)] };
  }
  return { level: 0, value: label, values } as unknown as DataViewMatrixNode;
}

// A rows tree: a root (no level — the DFS sentinel) holding the given
// leaf rows, with an optional values bag on the root for the grand total.
export function rowsRoot(
  rows: DataViewMatrixNode[],
  rootValues?: Record<number, number>,
): DataViewMatrixNode {
  const node: Record<string, unknown> = { children: rows };
  if (rootValues) {
    const values: Record<number, { value: number }> = {};
    for (const k of Object.keys(rootValues)) {
      values[Number(k)] = { value: rootValues[Number(k)] };
    }
    node.values = values;
  }
  return node as unknown as DataViewMatrixNode;
}

// A DataViewMatrix whose only populated part is the rows tree — render
// reads nothing else off the matrix.
export function matrixOf(rows: DataViewMatrixNode): DataViewMatrix {
  return {
    columns: { root: { children: [] } },
    valueSources: [],
    rows: { root: rows, levels: [] },
  } as unknown as DataViewMatrix;
}

interface OptsInit {
  showGrandTotal?: boolean;
  ibcsEnabled?: boolean;
  ibcsArrowStyle?: 'classic' | 'minimal';
  appearanceTheme?: string;
  compareAgainstMode?: 'priorYear' | 'budget' | 'forecast' | 'forecastVsForecast';
  denomination?: 'dollars' | 'thousands' | 'millions';
  decimals?: number;
  showLetter?: boolean;
  showMtd?: boolean;
  showQtd?: boolean;
  showYtd?: boolean;
  showFy?: boolean;
  selectedDate?: string;
  availableMonths?: readonly string[];
  columnFavorability?: ReadonlyMap<string, 'higherIsBetter' | 'lowerIsBetter' | 'neutral'>;
  valueSourceQueryNames?: readonly string[];
  selection?: FakeSelection;
  host?: powerbi.extensibility.visual.IVisualHost;
  bodyFontSize?: number;
}

// A FormatOptions for render tests. theme + selection are real stand-ins;
// every optional knob the caller does not set stays absent so each
// render call site's own absent-means-default rule is what gets tested.
export function renderOpts(init: OptsInit = {}): FormatOptions {
  const out: Record<string, unknown> = {
    theme: testTheme(),
    selection: init.selection ?? new FakeSelection(),
    rowHeight: 24,
    showGrandTotal: init.showGrandTotal ?? false,
    formatHints: new Map(),
  };
  const keys: (keyof OptsInit)[] = [
    'ibcsEnabled', 'ibcsArrowStyle', 'appearanceTheme', 'compareAgainstMode',
    'denomination', 'decimals', 'showLetter', 'showMtd', 'showQtd', 'showYtd',
    'showFy', 'selectedDate', 'availableMonths', 'columnFavorability',
    'valueSourceQueryNames', 'host', 'bodyFontSize',
  ];
  for (const k of keys) {
    if (init[k] !== undefined) {
      out[k] = init[k];
    }
  }
  return out as unknown as FormatOptions;
}

// A persistProperties-capturing host stub for the controls-panel tests.
export class FakeHost {
  readonly persisted: Array<{ objectName: string; properties: Record<string, unknown> }> = [];

  persistProperties(payload: {
    merge?: Array<{ objectName: string; properties: Record<string, unknown> }>;
  }): void {
    for (const m of payload.merge ?? []) {
      this.persisted.push({ objectName: m.objectName, properties: m.properties });
    }
  }
}
