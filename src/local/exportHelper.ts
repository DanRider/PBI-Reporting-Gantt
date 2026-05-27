// Local export-helper interface — STUB for the published GitHub build.
//
// The published version of this file returns false unconditionally, which
// causes excel.ts to fall through to PBI's native host.downloadService
// path. The native path hits PBI's tenant-policy gate ("Allow downloads
// from custom visuals") so users will see PBI's standard prompt if their
// tenant has restricted custom-visual downloads.
//
// Local-dev workflow (per-developer override):
//   1. Run the cortex-export-helper sibling project (a tiny local HTTPS
//      service that writes Blob payloads to your Downloads folder).
//   2. Replace this file's body with a fetch() implementation pointing at
//      your local helper's URL. The function should return true on a
//      successful write and false on any failure (so excel.ts falls back
//      to the native PBI path cleanly).
//   3. `git update-index --skip-worktree src/local/exportHelper.ts` — git
//      will ignore your local diff. The committed stub stays clean in the
//      published source.
//   4. To pull upstream changes to this file later:
//      `git update-index --no-skip-worktree src/local/exportHelper.ts`,
//      pull, re-apply your local implementation, re-skip.
//
// Why this lives in src/local/ : the directory name is a convention that
// signals "developer-machine overrides" — analogous to the .local
// suffix used elsewhere in the ecosystem.

import type { ExportDiagnostic } from "../excel.types";

export async function tryLocalExportHelper(
    _base64: string,
    _filename: string,
    _onDiag: (d: ExportDiagnostic) => void,
): Promise<boolean> {
    return false;
}
