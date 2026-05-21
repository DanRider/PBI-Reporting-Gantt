/*
 *  cortex-matrix-lt2 — Vitest global setup.
 *
 *  buildColumnTree is the first module to consume
 *  powerbi-visuals-utils-formattingutils (via valueFormatter.create). That
 *  package ships ESM-syntax .js inside a CommonJS envelope with
 *  extensionless internal re-exports, which Vitest's Vite resolver cannot
 *  load without pool gymnastics that proved fragile. So we mock it.
 *
 *  The mock is a deliberately thin, shape-preserving stub: it returns a
 *  formatter whose output is just rich enough that pipeline tests can
 *  assert on the denomination suffix (K / M) and the percent shape without
 *  asserting on exact PBI numeric formatting. Real PBI formatter behavior
 *  is covered by the PBI Desktop fixture regression at the render waves,
 *  not here.
 */

import { vi } from 'vitest';

vi.mock('powerbi-visuals-utils-formattingutils', () => {
  const create = (options: { format?: string } = {}): { format: (v: unknown) => string } => {
    const mask = options.format ?? '';
    return {
      format: (value: unknown): string => {
        if (value == null) return '';
        if (typeof value !== 'number') return String(value);
        if (/%/.test(mask)) return `${(value * 100).toFixed(1)}%`;
        let out = value.toFixed(2);
        if (/"K"/.test(mask)) out += 'K';
        else if (/"M"/.test(mask)) out += 'M';
        return out;
      },
    };
  };
  return { valueFormatter: { create } };
});
