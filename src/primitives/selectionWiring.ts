// L1 primitive. The visual's only door to Power BI cross-filtering: it
// turns a matrix row node into a stable ISelectionId and forwards clicks
// to the host selection manager so other visuals on the page filter. It
// holds no DOM and no render state — render code calls it, never the
// reverse. (v0.1 deliberately ships no right-click context menu.)

import powerbi from 'powerbi-visuals-api';

import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISelectionId = powerbi.visuals.ISelectionId;
import DataViewMatrixNode = powerbi.DataViewMatrixNode;
import DataViewHierarchyLevel = powerbi.DataViewHierarchyLevel;

export class SelectionWiring {
  private readonly host: IVisualHost;
  private readonly manager: ISelectionManager;

  constructor(host: IVisualHost) {
    this.host = host;
    this.manager = host.createSelectionManager();
  }

  // Built from the row's hierarchy node so the id stays stable across
  // re-renders of the same data — required for selection to persist.
  idForRowNode(
    node: DataViewMatrixNode,
    levels: DataViewHierarchyLevel[],
  ): ISelectionId {
    return this.host
      .createSelectionIdBuilder()
      .withMatrixNode(node, levels)
      .createSelectionId();
  }

  // `multi` is the additive (ctrl/cmd-click) path; the host owns the
  // resulting selection state and echoes it back to every visual. The
  // manager yields the bare extensibility.ISelectionId; we surface the
  // richer visuals.ISelectionId (same runtime object) — the same
  // boundary cast getSelectionIds() uses.
  select(id: ISelectionId, multi: boolean): powerbi.IPromise<ISelectionId[]> {
    return this.manager.select(id, multi) as powerbi.IPromise<ISelectionId[]>;
  }

  // Clears page-wide cross-filter, e.g. when the user clicks empty space.
  clear(): powerbi.IPromise<object> {
    return this.manager.clear();
  }

  getSelectionIds(): ISelectionId[] {
    return this.manager.getSelectionIds() as ISelectionId[];
  }

  // `equals` is the API's identity check; the `c === id` arm is defensive
  // for hosts that hand back plain ids without the method.
  isSelected(id: ISelectionId): boolean {
    const current = this.getSelectionIds();
    return current.some((c) => (c.equals ? c.equals(id) : c === id));
  }
}
