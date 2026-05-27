// Shared types for the Excel export pipeline.
//
// Lives in its own file so both src/excel.ts and src/local/exportHelper.ts
// can import the diagnostic union without creating a circular dependency
// (excel.ts depends on exportHelper for the dispatch, exportHelper needs
// the diagnostic type for its callback signature — without this split,
// madge flags a cycle even though the type import is erased at compile
// time).

/** Diagnostic shape the visual renders into the export status banner.
 *  Every state transition emits a distinct kind so failure modes (sandbox
 *  block, privilege denial, helper unreachable, ExcelJS error) surface
 *  individually instead of collapsing into a single opaque "didn't work"
 *  state. */
export type ExportDiagnostic =
    | { kind: "started" }
    | { kind: "workbook-built"; bytes: number }
    | { kind: "helper-attempt"; url: string }
    | { kind: "helper-success"; path: string; bytes: number }
    | { kind: "helper-failed"; message: string }
    | { kind: "native-fallback" }
    | { kind: "status-checked"; status: number; statusName: string }
    | { kind: "blocked"; status: number; statusName: string; message: string }
    | { kind: "submitted-to-host" }
    | { kind: "success" }
    | { kind: "error"; message: string };
