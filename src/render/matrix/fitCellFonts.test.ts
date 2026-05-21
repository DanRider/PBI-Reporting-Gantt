// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

import { fitCellFonts, fitTableToContainer } from './fitCellFonts';

// jsdom does not lay out, so offsetWidth/clientWidth are forced to the
// values each scenario needs.
function fixGeometry(el: HTMLElement, prop: 'offsetWidth' | 'clientWidth', px: number): void {
  Object.defineProperty(el, prop, { configurable: true, value: px });
}

function containerWithTable(containerW: number, tableW: number): HTMLElement {
  const container = document.createElement('div');
  const table = document.createElement('table');
  container.appendChild(table);
  fixGeometry(container, 'clientWidth', containerW);
  fixGeometry(table, 'offsetWidth', tableW);
  return container;
}

describe('fitTableToContainer — whole-table responsive scaling', () => {
  it('no transform when the table fits', () => {
    const container = containerWithTable(1000, 800);
    fitTableToContainer(container);
    const table = container.querySelector('table') as HTMLTableElement;
    expect(table.style.transform).toBe('');
  });

  it('scales by the container/table ratio when the table overflows', () => {
    const container = containerWithTable(800, 1600);
    fitTableToContainer(container);
    const table = container.querySelector('table') as HTMLTableElement;
    expect(table.style.transform).toBe('scale(0.5)');
    expect(table.style.transformOrigin).toBe('top left');
    expect(table.style.width).toBe('1600px');
  });

  it('never shrinks below the 0.4 floor', () => {
    const container = containerWithTable(100, 1000);
    fitTableToContainer(container);
    const table = container.querySelector('table') as HTMLTableElement;
    expect(table.style.transform).toBe('scale(0.4)');
  });

  it('is idempotent — re-running from a fitting state clears the transform', () => {
    const container = containerWithTable(800, 1600);
    fitTableToContainer(container);
    fixGeometry(container, 'clientWidth', 2000);
    fitTableToContainer(container);
    const table = container.querySelector('table') as HTMLTableElement;
    expect(table.style.transform).toBe('');
  });

  it('no-ops when there is no table', () => {
    const container = document.createElement('div');
    expect(() => fitTableToContainer(container)).not.toThrow();
  });

  it('the fitCellFonts alias delegates to the table scaler', () => {
    const container = containerWithTable(500, 1000);
    fitCellFonts(container);
    const table = container.querySelector('table') as HTMLTableElement;
    expect(table.style.transform).toBe('scale(0.5)');
  });
});
