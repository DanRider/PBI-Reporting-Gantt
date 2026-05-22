// L3 render. The single definition of how a leaf's number is produced
// from a values bag. The grand-total foot and every body row resolve a
// cell through this one function so the four branches can never drift
// apart between the two call sites. The branch order is an invariant: a
// delta over two period synthetics carries BOTH a periodSourcePair and a
// sentinel (-1) syntheticPair, so periodSourcePair must win before the
// syntheticPair arm is reached.

import powerbi from 'powerbi-visuals-api';

import type { ColumnLeaf } from '../../model/columnTree';

import DataViewMatrixNodeValue = powerbi.DataViewMatrixNodeValue;
import PrimitiveValue = powerbi.PrimitiveValue;

// The per-node cell map PBI parks values under. Indexed by a leaf's
// row-values position.
export type ValuesBag = { [index: number]: DataViewMatrixNodeValue };

// A slot counts only when it holds a real number — a null or a string in
// a sparse slot reads as absent so sums and subtractions stay honest.
function numberAt(values: ValuesBag, index: number): number | null {
  const cell = values[index];
  const v = cell ? cell.value : null;
  return typeof v === 'number' ? v : null;
}

// An all-empty index set is absent (formats blank), not zero — a zero
// here would read as a real reported total of nothing.
function sumIndices(values: ValuesBag, indices: number[]): number | null {
  let total = 0;
  let sawNumber = false;
  for (const i of indices) {
    const n = numberAt(values, i);
    if (n != null) {
      total += n;
      sawNumber = true;
    }
  }
  return sawNumber ? total : null;
}

function divideForPct(current: number, prior: number): number | null {
  return prior === 0 ? null : (current - prior) / prior;
}

// Resolves one leaf against one values bag. The same call serves a body
// row's per-node bag and the foot's root bag.
export function resolveLeafValue(
  leaf: ColumnLeaf,
  values: ValuesBag,
): PrimitiveValue | null {
  if (leaf.isPeriodSynthesis && leaf.periodSourceIdxs) {
    return sumIndices(values, leaf.periodSourceIdxs);
  }
  if (leaf.isSynthetic && leaf.periodSourcePair) {
    const current = sumIndices(values, leaf.periodSourcePair.currentLeafIdxs);
    const prior = sumIndices(values, leaf.periodSourcePair.priorLeafIdxs);
    if (current == null || prior == null) {
      return null;
    }
    return leaf.isSynthetic === 'delta' ? current - prior : divideForPct(current, prior);
  }
  if (leaf.isSynthetic && leaf.syntheticPair) {
    const current = numberAt(values, leaf.syntheticPair.currentLeafIdx);
    const prior = numberAt(values, leaf.syntheticPair.priorLeafIdx);
    if (current == null || prior == null) {
      return null;
    }
    return leaf.isSynthetic === 'delta' ? current - prior : divideForPct(current, prior);
  }
  return numberAt(values, leaf.leafIndex);
}
