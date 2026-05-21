// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

import { fitPanelToContainer } from './fitPanelToContainer';

function fix(el: HTMLElement, prop: string, px: number): void {
  Object.defineProperty(el, prop, { configurable: true, value: px });
}

function pair(
  slotW: number,
  slotH: number,
  contentW: number,
  contentH: number,
): { container: HTMLElement; content: HTMLElement } {
  const container = document.createElement('div');
  const content = document.createElement('div');
  container.appendChild(content);
  fix(container, 'clientWidth', slotW);
  fix(container, 'clientHeight', slotH);
  fix(content, 'scrollWidth', contentW);
  fix(content, 'scrollHeight', contentH);
  return { container, content };
}

describe('fitPanelToContainer — rail inner-content scaling', () => {
  it('no transform when the content already fits both axes', () => {
    const { container, content } = pair(200, 600, 180, 500);
    fitPanelToContainer(container, content);
    expect(content.style.transform).toBe('');
  });

  it('uses the more aggressive ratio so both axes fit', () => {
    // width ratio 0.9, height ratio 0.5 → height is binding
    const { container, content } = pair(180, 300, 200, 600);
    fitPanelToContainer(container, content);
    expect(content.style.transform).toBe('scale(0.5)');
    expect(content.style.width).toBe('200px');
    expect(content.style.height).toBe('600px');
  });

  it('never shrinks below the 0.5 floor', () => {
    const { container, content } = pair(100, 100, 1000, 1000);
    fitPanelToContainer(container, content);
    expect(content.style.transform).toBe('scale(0.5)');
  });

  it('is idempotent — re-running from a fitting state clears the transform', () => {
    const { container, content } = pair(180, 300, 200, 600);
    fitPanelToContainer(container, content);
    fix(container, 'clientHeight', 2000);
    fix(container, 'clientWidth', 2000);
    fitPanelToContainer(container, content);
    expect(content.style.transform).toBe('');
  });
});
