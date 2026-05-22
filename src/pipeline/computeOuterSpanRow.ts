// L2 pipeline. A pure function (not a stage) that decides whether and
// where the synthetic group-label row renders, and what spans it holds.
// It reads only the immutable ColumnTree — never PBI metadata. When no
// leaf carries a group label there is no row ('none'). Otherwise the row
// sits at the TOP when the header has a single data level (nothing above
// the leaves to nest under) and BELOW the outer level when the header is
// already multi-level (so the data-driven hierarchy stays first). Spans
// are formed by merging runs of adjacent leaves that share the same group
// label; a run of label-less leaves collapses to one empty span.

import type { ColumnTree } from '../model/columnTree';

// One cell in the group-label row. Adjacent same-label leaves merge into
// a single cell; label-less leaves form an empty-label cell of their run
// width so the row stays column-aligned with the leaf row beneath it.
export interface OuterSpan {
  label: string;
  colspan: number;
}

export type OuterSpanPosition = 'top' | 'belowOuter' | 'none';

export interface OuterSpanRowSpec {
  position: OuterSpanPosition;
  // Left-to-right cells. Empty only when position is 'none'.
  spans: OuterSpan[];
}

function hasGroupLabel(label: string | undefined): boolean {
  return label != null && label.length > 0;
}

export function computeOuterSpanRow(tree: ColumnTree): OuterSpanRowSpec {
  const leaves = tree.leaves;
  if (!leaves.some((leaf) => hasGroupLabel(leaf.groupLabel))) {
    return { position: 'none', spans: [] };
  }

  const position: OuterSpanPosition = tree.levels.length >= 2 ? 'belowOuter' : 'top';

  const spans: OuterSpan[] = [];
  let start = 0;
  while (start < leaves.length) {
    const label = leaves[start].groupLabel ?? '';
    let end = start + 1;
    while (end < leaves.length && (leaves[end].groupLabel ?? '') === label) {
      end += 1;
    }
    spans.push({ label, colspan: end - start });
    start = end;
  }
  return { position, spans };
}
