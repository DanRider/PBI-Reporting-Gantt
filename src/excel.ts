// Cortex Excel export — entry module for v3.0 epic.
//
// Today: single Hello-World pipeline test that proves ExcelJS bundles
// into the .pbiviz, runs cleanly inside the PBI iframe sandbox, Blob →
// anchor-click download flows, and internal sheet-to-sheet hyperlinks
// survive (the load-bearing pattern for the nav-driven template design).
//
// Future: this module is the public entry. exportToExcel(templateId?)
// dispatches to per-template builders once real templates ship in
// src/excelExport/templates/. Hello World stays as the default fallback
// and the smoke-test fixture.

import * as ExcelJS from "exceljs";

export async function exportToExcel(): Promise<void> {
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

    // Detail sheet — small data table + back hyperlink.
    const detail = wb.addWorksheet("Detail", {
        properties: { tabColor: { argb: "FF888888" } },
    });
    detail.getCell("A1").value = "Detail sheet";
    detail.getCell("A1").font = { size: 14, bold: true };
    detail.getCell("A3").value = { hyperlink: "#Hub!A1", text: "← Back to Hub" };
    detail.getCell("A3").font = { color: { argb: "FF1F77B4" }, underline: true };

    // Tiny Excel Table to prove banded rows + autofilter survive.
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

    // Serialize to buffer → Blob → anchor click. This is the PBI iframe
    // download mechanism — well-supported but worth confirming in both
    // PBI Desktop and PBI Service.
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cortex-hello-world.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
