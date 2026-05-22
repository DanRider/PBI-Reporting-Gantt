// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

import { styleHeader } from './themeApplication';
import { testTheme } from './__fixtures__/tree';

describe('styleHeader — paints a header cell from the resolved palette', () => {
  it('writes background, color, bottom rule, and weight inline', () => {
    const theme = testTheme();
    const th = document.createElement('th');
    styleHeader(th, theme);
    expect(th.style.background).toBe('rgb(17, 17, 17)');
    expect(th.style.color).toBe('rgb(238, 238, 238)');
    expect(th.style.borderBottom).toBe('1px solid rgb(68, 68, 68)');
    expect(th.style.fontWeight).toBe('600');
  });

  it('mutates the passed element and creates no children', () => {
    const th = document.createElement('th');
    styleHeader(th, testTheme());
    expect(th.childNodes).toHaveLength(0);
  });
});
