// Cortex Excel export — entry module for v3.0 epic.
//
// Two-path dispatch with optional local-helper-first / PBI-native-fallback:
//
//   (a) LOCAL HELPER PATH (optional — for dev environments that opt in):
//       Delegated to ./local/exportHelper.ts (tryLocalExportHelper). The
//       published stub returns false; developer machines may override
//       locally to call a sibling on-disk helper. See ./local/exportHelper.ts
//       for the override workflow.
//
//   (b) NATIVE PATH (default + fallback):
//       host.downloadService.exportVisualsContent(base64, filename,
//       "base64", description). Hits PBI's tenant-policy gate; in
//       PBI Desktop without sign-in or with custom-visual downloads
//       disabled, users will see PBI's "Download unavailable" dialog.
//
// PBI custom visuals run with sandbox="allow-scripts" only — direct blob
// downloads (URL.createObjectURL + anchor.click) silently no-op. Both
// paths above sidestep that.
//
// Native-path requirements:
//   - capabilities.json: privileges contains {name:"ExportContent",essential:true}
//   - pbiviz.json: apiVersion >= 4.5.0 (we ship at 5.11.0 — fine)
//   - PBI Service: tenant admin "Allow downloads from custom visuals" enabled
//   - PBI Desktop: signed in + tenant policy permits

/// <reference path="./types/exceljs-min.d.ts" />
import powerbi from "powerbi-visuals-api";
import { tryLocalExportHelper } from "./local/exportHelper";
import type { ExportDiagnostic } from "./excel.types";

export type { ExportDiagnostic } from "./excel.types";

// Browser-bundle entry — PBI iframe has no Node globals, so the default
// "exceljs" entry's Node-only requires would throw on import. The
// prebuilt browser bundle at exceljs/dist/exceljs.min.js has no .d.ts
// of its own; src/types/exceljs-min.d.ts re-exports the regular ExcelJS
// types under that path so call sites stay fully typed.
import * as ExcelJS from "exceljs/dist/exceljs.min.js";

type IVisualHost = powerbi.extensibility.visual.IVisualHost;

const STATUS_NAMES: Record<number, string> = {
    0: "Allowed",
    1: "NotSupported",
    2: "NotDeclared",
    3: "DisabledByAdmin",
};


export async function exportToExcel(
    host: IVisualHost,
    filename: string = "cortex-hello-world.xlsx",
    onDiag: (d: ExportDiagnostic) => void = () => { /* no-op default */ },
): Promise<void> {
    onDiag({ kind: "started" });

    const wb = new ExcelJS.Workbook();
    wb.creator = "Cortex Reporting-Roadmap";
    wb.created = new Date();

    // Hub sheet — analyst entry point with a forward hyperlink.
    const hub = wb.addWorksheet("Hub", {
        properties: { tabColor: { argb: "FF1F77B4" } },
    });
    hub.getCell("A1").value = "Cortex Excel Export — Hello, World!";
    hub.getCell("A1").font = { size: 18, bold: true, color: { argb: "FF1F77B4" } };
    hub.getCell("A3").value = "If this opens cleanly with both sheets visible and the hyperlinks below navigate, the pipeline is proven.";
    hub.getCell("A3").alignment = { wrapText: true };
    hub.getCell("A5").value = { hyperlink: "#Detail!A1", text: "→ Go to Detail sheet" };
    hub.getCell("A5").font = { color: { argb: "FF1F77B4" }, underline: true };
    hub.getColumn(1).width = 80;

    // Detail sheet — back hyperlink + tiny Excel Table.
    const detail = wb.addWorksheet("Detail", {
        properties: { tabColor: { argb: "FF888888" } },
    });
    detail.getCell("A1").value = "Detail sheet";
    detail.getCell("A1").font = { size: 14, bold: true };
    detail.getCell("A3").value = { hyperlink: "#Hub!A1", text: "← Back to Hub" };
    detail.getCell("A3").font = { color: { argb: "FF1F77B4" }, underline: true };
    detail.addTable({
        name: "tblHelloWorldChecks",
        ref: "A5",
        headerRow: true,
        style: { theme: "TableStyleMedium2", showRowStripes: true },
        columns: [{ name: "Item" }, { name: "Status" }],
        rows: [
            ["Pipeline test", "OK if you see this"],
            ["Hyperlink test", "OK if clicking 'Back to Hub' returns you"],
            ["Sheet tabs", "OK if Hub tab is blue and Detail tab is grey"],
        ],
    });
    detail.getColumn(1).width = 20;
    detail.getColumn(2).width = 60;

    // Serialize → ArrayBuffer → base64.
    const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    onDiag({ kind: "workbook-built", bytes: buffer.byteLength });
    const base64 = arrayBufferToBase64(buffer);

    // PATH (a) — optional local export helper. Stub returns false in the
    // published build; developer-machine overrides may bypass PBI's
    // tenant-policy gate entirely. See ./local/exportHelper.ts.
    if (await tryLocalExportHelper(base64, filename, onDiag)) {
        onDiag({ kind: "success" });
        return;
    }

    // PATH (b) — PBI native fallback. Helper unreachable; run status
    // gate then submit through host.downloadService.
    onDiag({ kind: "native-fallback" });
    const status = await host.downloadService.exportStatus();
    const statusName = STATUS_NAMES[status] ?? `Unknown(${status})`;
    onDiag({ kind: "status-checked", status, statusName });

    if (status !== powerbi.PrivilegeStatus.Allowed) {
        const msg = `Native export blocked: ${statusName} (status=${status}). ` +
            (status === 3 ? "Tenant 'Allow downloads from custom visuals' off OR not signed in OR Pro/PPU required." :
             status === 2 ? "capabilities.json missing privileges:[{name:'ExportContent',essential:true}] — rebuild + republish." :
             status === 1 ? "PBI host doesn't support this API in current context." :
             "Unknown blocker.");
        console.error("[cortex-export]", msg);
        onDiag({ kind: "blocked", status, statusName, message: msg });
        return;
    }

    onDiag({ kind: "submitted-to-host" });
    await host.downloadService.exportVisualsContent(
        base64,
        filename,
        "base64",                                  // signal binary content; NOT "xlsx"
        "Cortex Reporting-Roadmap Hello-World export",
    );
    onDiag({ kind: "success" });
}

/** Chunked ArrayBuffer → base64. The naive String.fromCharCode(...uint8)
 *  spread overflows the call stack at ~125K bytes; chunking by 8KB is the
 *  standard-safe pattern. */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const uint8 = new Uint8Array(buffer);
    const CHUNK = 8192;
    let binary = "";
    for (let i = 0; i < uint8.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, Array.from(uint8.subarray(i, i + CHUNK)));
    }
    return btoa(binary);
}
