// L2 pipeline. The stage that appends a Δ and a %Δ column after every
// two-leaf comparison cluster. A cluster is a run of consecutive leaves
// that share one non-empty group label; only a run of EXACTLY two leaves
// (a current and a prior, or two paired plans) gets variance columns. The
// synthetic carries a syntheticPair of the two real leaves' row-values
// indices so render subtracts them directly; when both cluster leaves are
// period synthetics (whose value is itself a sum) it instead carries a
// periodSourcePair so render sums each side first, then subtracts. The
// within-cluster render order is fixed at [delta, deltaPct]: that is
// achieved by pushing deltaPct BEFORE delta, then sorting the pending
// inserts by descending position and splicing — each splice at the same
// index pushes the earlier insert one slot right, so the reverse push
// order yields the intended visual order. v0.1 drops the IBCS indicator
// leaves and the custom Δ/%Δ header text the parent design carried; the
// labels are always "Δ" and "%Δ". Pure: returns the input tree unchanged
// when no cluster qualifies or both toggles are off.

import powerbi from 'powerbi-visuals-api';
import { valueFormatter } from 'powerbi-visuals-utils-formattingutils';

import { denominationSpec } from '../primitives/format/denomination';
import {
  inheritedFormat,
  type FormatHintInput,
} from '../primitives/format/inheritedFormat';
import type {
  ColumnLeaf,
  ColumnLevelEntry,
  ColumnTree,
  PeriodSourcePair,
  ValueFormatter,
} from '../model/columnTree';
import type { FormatOptions } from '../model/formatOptions';
import type { PipelineStage } from '../model/pipelineStage';

import DataViewMatrix = powerbi.DataViewMatrix;
import DataViewMatrixNode = powerbi.DataViewMatrixNode;
import DataViewMetadataColumn = powerbi.DataViewMetadataColumn;

// Fixed synthetic header text. The parent design exposed these as format-
// pane slices; v0.1 deletes that surface and always renders these glyphs.
const DELTA_LABEL = 'Δ';
const DELTA_PCT_LABEL = '%Δ';

// Exactly this many leaves in a same-label run makes a variance cluster:
// one current side and one prior/paired side.
const CLUSTER_SIZE = 2;

interface PendingInsert {
  insertAt: number;
  leaf: ColumnLeaf;
}

function levelSourceIndexOf(node: DataViewMatrixNode): number {
  const withIdx = node as DataViewMatrixNode & { levelSourceIndex?: number };
  return withIdx.levelSourceIndex ?? 0;
}

// The period-source index arrays, present only when BOTH cluster leaves
// are period synthetics (each has periodSourceIdxs and no single value
// index). Otherwise undefined and render falls back to syntheticPair.
function periodSourcePairFor(
  currentLeaf: ColumnLeaf,
  priorLeaf: ColumnLeaf,
): PeriodSourcePair | undefined {
  if (
    currentLeaf.isPeriodSynthesis &&
    priorLeaf.isPeriodSynthesis &&
    currentLeaf.periodSourceIdxs &&
    priorLeaf.periodSourceIdxs
  ) {
    return {
      currentLeafIdxs: currentLeaf.periodSourceIdxs,
      priorLeafIdxs: priorLeaf.periodSourceIdxs,
    };
  }
  return undefined;
}

function deltaFormatter(
  hint: FormatHintInput | undefined,
  opts: FormatOptions,
): ValueFormatter {
  const base = hint ? inheritedFormat(hint, 'delta').format : undefined;
  const spec = denominationSpec(base, opts.denomination, opts.decimals, opts.showLetter);
  const inner = valueFormatter.create({ format: spec.format });
  const scale = spec.scale;
  return (value) => {
    if (value == null) {
      return '';
    }
    if (typeof value === 'number' && scale !== 1) {
      return inner.format(value * scale);
    }
    return inner.format(value);
  };
}

function deltaPctFormatter(hint: FormatHintInput | undefined): ValueFormatter {
  // %Δ always forces a percent format via inheritedFormat's deltaPct kind;
  // wrap as a three-section mask so a negative renders parenthesized,
  // matching the value-column convention.
  const pctBase = inheritedFormat(hint, 'deltaPct').format;
  const inner = valueFormatter.create({
    format: `${pctBase};(${pctBase});${pctBase}`,
  });
  return (value) => (value == null ? '' : inner.format(value));
}

export class SynthesizeDeltaLeavesStage implements PipelineStage {
  readonly name = 'synthesizeDeltaLeaves';

  apply(tree: ColumnTree, matrix: DataViewMatrix, opts: FormatOptions): ColumnTree {
    const showDelta = opts.showDelta !== false;
    const showDeltaPct = opts.showDeltaPct !== false;
    if (!showDelta && !showDeltaPct) {
      return tree;
    }

    const valueSources: DataViewMetadataColumn[] = matrix.valueSources || [];
    const leaves: ColumnLeaf[] = tree.leaves.slice();
    const pending: PendingInsert[] = [];
    const ancestorBumps: DataViewMatrixNode[] = [];

    let i = 0;
    while (i < leaves.length) {
      const label = leaves[i].groupLabel ?? '';
      let end = i + 1;
      while (end < leaves.length && (leaves[end].groupLabel ?? '') === label) {
        end += 1;
      }

      if (label.length > 0 && end - i === CLUSTER_SIZE) {
        const currentLeaf = leaves[i];
        const priorLeaf = leaves[i + 1];

        const sourceIdx = levelSourceIndexOf(currentLeaf.node);
        const source = valueSources[sourceIdx];
        const hintKey = source?.queryName ?? source?.displayName ?? '';
        const hint = opts.formatHints.get(hintKey);

        const periodSourcePair = periodSourcePairFor(currentLeaf, priorLeaf);
        const syntheticPair = {
          currentLeafIdx: currentLeaf.leafIndex,
          priorLeafIdx: priorLeaf.leafIndex,
        };

        // Push deltaPct BEFORE delta. The descending-position splice below
        // reverses push order into render order, so this yields the fixed
        // within-cluster order [delta, deltaPct].
        if (showDeltaPct) {
          pending.push({
            insertAt: end,
            leaf: {
              node: priorLeaf.node,
              leafIndex: -1,
              formatter: deltaPctFormatter(hint),
              defaultLabel: DELTA_PCT_LABEL,
              visible: true,
              groupLabel: label,
              isSynthetic: 'deltaPct',
              syntheticPair,
              periodSourcePair,
            },
          });
          ancestorBumps.push(priorLeaf.node);
        }
        if (showDelta) {
          pending.push({
            insertAt: end,
            leaf: {
              node: priorLeaf.node,
              leafIndex: -1,
              formatter: deltaFormatter(hint, opts),
              defaultLabel: DELTA_LABEL,
              visible: true,
              groupLabel: label,
              isSynthetic: 'delta',
              syntheticPair,
              periodSourcePair,
            },
          });
          ancestorBumps.push(priorLeaf.node);
        }
      }
      i = end;
    }

    if (pending.length === 0) {
      return tree;
    }

    pending.sort((a, b) => b.insertAt - a.insertAt);
    for (const { insertAt, leaf } of pending) {
      leaves.splice(insertAt, 0, leaf);
    }

    const levels: ColumnLevelEntry[][] = tree.levels.map((lvl) => lvl.slice());
    const leafLevel = levels.length - 1;
    if (leafLevel >= 0 && levels[leafLevel]) {
      levels[leafLevel] = leaves.map((l) => ({ node: l.node, leafCount: 1 }));
    }

    if (ancestorBumps.length > 0) {
      const parentOf = new Map<DataViewMatrixNode, DataViewMatrixNode | null>();
      const indexParents = (
        n: DataViewMatrixNode,
        parent: DataViewMatrixNode | null,
      ): void => {
        parentOf.set(n, parent);
        if (n.children) {
          for (const c of n.children) {
            indexParents(c, n);
          }
        }
      };
      indexParents(matrix.columns.root, null);

      for (const synthNode of ancestorBumps) {
        let cursor = parentOf.get(synthNode);
        while (cursor && typeof cursor.level !== 'undefined' && cursor.level !== null) {
          const entry = levels[cursor.level]?.find((e) => e.node === cursor);
          if (entry) {
            entry.leafCount += 1;
          }
          cursor = parentOf.get(cursor);
        }
      }
    }

    return { levels, leaves };
  }
}
