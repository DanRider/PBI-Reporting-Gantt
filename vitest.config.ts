// reporting-gantt v2.0 vitest config. passWithNoTests so the pre-commit
// gate does not block Wave 0 commits before test files exist. The
// jsdom environment is mounted so the matrix render layer (HTML-DOM)
// can be exercised against a fake browser DOM in Wave 1+.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    environment: 'jsdom',
  },
});
