// reporting-gantt v2.0 vitest config.
//
// setupFiles loads vitest.setup.ts, which mocks
// powerbi-visuals-utils-formattingutils — pipeline/buildColumnTree.ts is
// the first module to import it (via valueFormatter.create), and that
// package ships ESM-syntax .js inside a CommonJS envelope with
// extensionless internal re-exports that Vitest's Vite resolver cannot
// load without pool gymnastics. So we mock it. Pattern lifted from
// cortex-matrix-lt2 vitest.setup.ts.
//
// jsdom environment is mounted so the matrix render layer (HTML-DOM)
// can be exercised against a fake browser DOM.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    passWithNoTests: true,
    environment: 'jsdom',
  },
});
