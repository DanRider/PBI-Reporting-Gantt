import { describe, it, expect } from 'vitest';

import {
  DEFAULT_COLUMN_FAVORABILITY,
  DEFAULT_FORMAT_HINTS,
  type CompareAgainstMode,
  type FavorabilityDirection,
  type IbcsArrowStyle,
} from './formatOptions';

describe('DEFAULT_FORMAT_HINTS', () => {
  it('is an empty map', () => {
    expect(DEFAULT_FORMAT_HINTS.size).toBe(0);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(DEFAULT_FORMAT_HINTS)).toBe(true);
  });

  it('rejects own-property additions (frozen object surface)', () => {
    expect(() => {
      Object.defineProperty(DEFAULT_FORMAT_HINTS, 'injected', { value: 1 });
    }).toThrow();
  });

  it('is shared as a single instance, not rebuilt per import', () => {
    expect(DEFAULT_FORMAT_HINTS).toBe(DEFAULT_FORMAT_HINTS);
  });
});

describe('DEFAULT_COLUMN_FAVORABILITY', () => {
  it('is an empty map', () => {
    expect(DEFAULT_COLUMN_FAVORABILITY.size).toBe(0);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(DEFAULT_COLUMN_FAVORABILITY)).toBe(true);
  });

  it('rejects own-property additions (frozen object surface)', () => {
    expect(() => {
      Object.defineProperty(DEFAULT_COLUMN_FAVORABILITY, 'injected', { value: 'neutral' });
    }).toThrow();
  });
});

describe('re-exported enums are usable as a single import surface', () => {
  it('FavorabilityDirection accepts the three documented directions', () => {
    const dirs: FavorabilityDirection[] = ['higherIsBetter', 'lowerIsBetter', 'neutral'];
    expect(dirs).toHaveLength(3);
  });

  it('CompareAgainstMode accepts the four compare modes', () => {
    const modes: CompareAgainstMode[] = [
      'priorYear',
      'budget',
      'forecast',
      'forecastVsForecast',
    ];
    expect(modes).toHaveLength(4);
  });

  it('IbcsArrowStyle accepts classic and minimal', () => {
    const styles: IbcsArrowStyle[] = ['classic', 'minimal'];
    expect(styles).toEqual(['classic', 'minimal']);
  });
});
