import { describe, it, expect } from 'vitest';

import {
  APPEARANCE_OPTIONS,
  APPEARANCE_THEMES,
  resolveAppearanceTheme,
} from './themes';

describe('APPEARANCE_THEMES — four self-contained palettes', () => {
  it('ships exactly the four named palettes', () => {
    expect(Object.keys(APPEARANCE_THEMES).sort()).toEqual(
      ['bloomberg', 'launch', 'newsprint', 'quartz'],
    );
  });

  it('every palette carries both matrix and panel color groups', () => {
    for (const theme of Object.values(APPEARANCE_THEMES)) {
      expect(theme.matrix.headerBg).toMatch(/^#/);
      expect(theme.matrix.bodyFg).toMatch(/^#/);
      expect(theme.panel.bg).toMatch(/^#/);
      expect(theme.panel.accent).toMatch(/^#/);
      expect(theme.rootBg).toMatch(/^#/);
      expect(theme.label.length).toBeGreaterThan(0);
    }
  });
});

describe('resolveAppearanceTheme — total resolution', () => {
  it('a known name returns its own palette', () => {
    expect(resolveAppearanceTheme('quartz').name).toBe('quartz');
    expect(resolveAppearanceTheme('newsprint').name).toBe('newsprint');
  });

  it('undefined falls back to Bloomberg (the default)', () => {
    expect(resolveAppearanceTheme(undefined).name).toBe('bloomberg');
  });

  it('an empty string falls back to Bloomberg', () => {
    expect(resolveAppearanceTheme('').name).toBe('bloomberg');
  });

  it('an unknown / stale name falls back to Bloomberg', () => {
    expect(resolveAppearanceTheme('terminal-classic').name).toBe('bloomberg');
  });
});

describe('APPEARANCE_OPTIONS — dropdown source', () => {
  it('lists all four with Bloomberg first', () => {
    expect(APPEARANCE_OPTIONS).toHaveLength(4);
    expect(APPEARANCE_OPTIONS[0][0]).toBe('bloomberg');
  });

  it('every option value resolves back to its palette', () => {
    for (const [value] of APPEARANCE_OPTIONS) {
      expect(resolveAppearanceTheme(value).name).toBe(value);
    }
  });
});
