import { describe, it, expect, vi } from 'vitest';
import powerbi from 'powerbi-visuals-api';
import { SelectionWiring } from './selectionWiring';

import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionId = powerbi.visuals.ISelectionId;
import DataViewMatrixNode = powerbi.DataViewMatrixNode;

// A selection id whose identity is a string tag, with the API `equals`.
function makeId(tag: string): ISelectionId {
  return {
    equals: (other: ISelectionId) =>
      (other as unknown as { tag?: string }).tag === tag,
    tag,
  } as unknown as ISelectionId;
}

// Host double: builder threads (node, levels) and stamps a tagged id;
// manager records select/clear calls and answers a fixed selection set.
function makeHost(selected: ISelectionId[] = []) {
  const builtId = makeId('row-built');
  const withMatrixNode = vi.fn().mockReturnThis();
  const createSelectionId = vi.fn(() => builtId);
  const builder = { withMatrixNode, createSelectionId };

  const select = vi.fn(() => Promise.resolve(selected));
  const clear = vi.fn(() => Promise.resolve({}));
  const getSelectionIds = vi.fn(() => selected);
  const manager = { select, clear, getSelectionIds };

  const host = {
    createSelectionManager: () => manager,
    createSelectionIdBuilder: () => builder,
  } as unknown as IVisualHost;

  return { host, builder, manager, builtId };
}

const NODE = { value: 'r' } as unknown as DataViewMatrixNode;

describe('SelectionWiring', () => {
  it('idForRowNode threads node + levels through the builder and returns the built id', () => {
    const { host, builder, builtId } = makeHost();
    const wiring = new SelectionWiring(host);
    const id = wiring.idForRowNode(NODE, []);
    expect(builder.withMatrixNode).toHaveBeenCalledWith(NODE, []);
    expect(builder.createSelectionId).toHaveBeenCalledTimes(1);
    expect(id).toBe(builtId);
  });

  it('select delegates to the manager with (id, multi)', () => {
    const { host, manager } = makeHost();
    const wiring = new SelectionWiring(host);
    const id = makeId('x');
    wiring.select(id, true);
    expect(manager.select).toHaveBeenCalledWith(id, true);
  });

  it('clear delegates to the manager', () => {
    const { host, manager } = makeHost();
    const wiring = new SelectionWiring(host);
    wiring.clear();
    expect(manager.clear).toHaveBeenCalledTimes(1);
  });

  it('getSelectionIds returns the manager selection set', () => {
    const sel = [makeId('a'), makeId('b')];
    const { host } = makeHost(sel);
    const wiring = new SelectionWiring(host);
    expect(wiring.getSelectionIds()).toEqual(sel);
  });

  it('isSelected is true when a stored id equals() the probe', () => {
    const { host } = makeHost([makeId('keep')]);
    const wiring = new SelectionWiring(host);
    expect(wiring.isSelected(makeId('keep'))).toBe(true);
  });

  it('isSelected is false when no stored id matches', () => {
    const { host } = makeHost([makeId('other')]);
    const wiring = new SelectionWiring(host);
    expect(wiring.isSelected(makeId('missing'))).toBe(false);
  });
});
