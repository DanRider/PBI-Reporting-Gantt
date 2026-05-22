// L2 pipeline. The root stage. It ignores its incoming tree and walks the
// live matrix column hierarchy to produce the first ColumnTree: one leaf
// per non-root terminal column plus the header-level index above them.
// v0.1 deletes the parent design's header-template resolution chain
// entirely — a leaf's label is simply its source displayName. Visibility
// and group label are read from the SOURCE objects only (the per-measure
// {metadata: queryName} selector); there is no node-level dual path. Each
// leaf binds a denomination-aware formatter: scaling happens in JS before
// the formatter runs, never via the format string. Hidden leaves are
// filtered out and every ancestor's column span is decremented to match.

import powerbi from 'powerbi-visuals-api';
import { valueFormatter } from 'powerbi-visuals-utils-formattingutils';

import { denominationSpec } from '../primitives/format/denomination';
import type { ColumnLeaf, ColumnLevelEntry, ColumnTree } from '../model/columnTree';
import type { FormatOptions } from '../model/formatOptions';
import type { PipelineStage } from '../model/pipelineStage';

import DataViewMatrix = powerbi.DataViewMatrix;
import DataViewMatrixNode = powerbi.DataViewMatrixNode;
import DataViewMetadataColumn = powerbi.DataViewMetadataColumn;
import DataViewObjects = powerbi.DataViewObjects;
import PrimitiveValue = powerbi.PrimitiveValue;

// The subset of a source's objects bag this stage reads. Power BI types
// `objects` loosely, so the columnVisibility/columnHeaders shape is named
// explicitly here rather than cast through `unknown`.
interface SourceObjects {
  columnVisibility?: { visible?: PrimitiveValue };
  columnHeaders?: { groupLabel?: PrimitiveValue };
}

function objectsOf(source: DataViewMetadataColumn | undefined): SourceObjects | undefined {
  const withObjs = source as (DataViewMetadataColumn & { objects?: DataViewObjects }) | undefined;
  return withObjs?.objects as SourceObjects | undefined;
}

// A leaf is visible unless the source explicitly set visible to false;
// absent or any non-false value keeps it shown.
function readSourceVisible(source: DataViewMetadataColumn | undefined): boolean {
  return objectsOf(source)?.columnVisibility?.visible !== false;
}

function readSourceGroupLabel(source: DataViewMetadataColumn | undefined): string | undefined {
  const value = objectsOf(source)?.columnHeaders?.groupLabel;
  return value == null ? undefined : String(value);
}

function isRootNode(node: DataViewMatrixNode): boolean {
  return typeof node.level === 'undefined' || node.level === null;
}

// Build the parent lookup once so hidden-leaf span decrement can climb
// from each hidden node up to the root.
function indexParents(root: DataViewMatrixNode): Map<DataViewMatrixNode, DataViewMatrixNode | null> {
  const parentOf = new Map<DataViewMatrixNode, DataViewMatrixNode | null>();
  const visit = (node: DataViewMatrixNode, parent: DataViewMatrixNode | null): void => {
    parentOf.set(node, parent);
    if (node.children) {
      for (const child of node.children) visit(child, node);
    }
  };
  visit(root, null);
  return parentOf;
}

export class BuildColumnTreeStage implements PipelineStage {
  readonly name = 'buildColumnTree';

  apply(_tree: ColumnTree, matrix: DataViewMatrix, opts: FormatOptions): ColumnTree {
    const valueSources: DataViewMetadataColumn[] = matrix.valueSources || [];
    const levels: ColumnLevelEntry[][] = [];
    const leaves: ColumnLeaf[] = [];

    const walk = (node: DataViewMatrixNode): number => {
      const root = isRootNode(node);
      const hasChildren = !!(node.children && node.children.length > 0);
      let leafCount: number;

      if (!hasChildren) {
        if (!root) {
          const withIdx = node as DataViewMatrixNode & { levelSourceIndex?: number };
          const sourceIdx = withIdx.levelSourceIndex ?? 0;
          const source = valueSources[sourceIdx];
          // JS-side scaling: pre-multiply the raw value, then format with
          // the literal K/M letter. PBI's scaling-comma is unreliable.
          const spec = denominationSpec(
            source?.format,
            opts.denomination,
            opts.decimals,
            opts.showLetter,
          );
          const formatter = valueFormatter.create({ format: spec.format });
          const scale = spec.scale;
          leaves.push({
            node,
            leafIndex: leaves.length,
            formatter: (value) => {
              if (value == null) return '';
              if (typeof value === 'number' && scale !== 1) {
                return formatter.format(value * scale);
              }
              return formatter.format(value);
            },
            defaultLabel: source?.displayName ?? (node.value == null ? '' : String(node.value)),
            visible: readSourceVisible(source),
            groupLabel: readSourceGroupLabel(source),
          });
        }
        leafCount = 1;
      } else {
        leafCount = 0;
        for (const child of node.children!) leafCount += walk(child);
      }

      if (!root) {
        const lvl = node.level!;
        if (!levels[lvl]) levels[lvl] = [];
        levels[lvl].push({ node, leafCount });
      }
      return leafCount;
    };

    walk(matrix.columns.root);

    // A level can be left undefined if the hierarchy skipped a depth;
    // densify so render can index every row.
    for (let i = 0; i < levels.length; i++) {
      if (!levels[i]) levels[i] = [];
    }

    const hiddenLeaves = leaves.filter((leaf) => !leaf.visible);
    if (hiddenLeaves.length > 0) {
      const hiddenNodes = new Set(hiddenLeaves.map((leaf) => leaf.node));
      const parentOf = indexParents(matrix.columns.root);
      for (const hidden of hiddenLeaves) {
        let cursor = parentOf.get(hidden.node);
        while (cursor && !isRootNode(cursor)) {
          const entry = levels[cursor.level!]?.find((e) => e.node === cursor);
          if (entry) entry.leafCount -= 1;
          cursor = parentOf.get(cursor);
        }
      }
      for (let i = 0; i < levels.length; i++) {
        levels[i] = levels[i].filter((e) => !hiddenNodes.has(e.node) && e.leafCount > 0);
      }
    }

    return { levels, leaves: leaves.filter((leaf) => leaf.visible) };
  }
}
