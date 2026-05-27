// Type shim for the ExcelJS prebuilt browser bundle.
//
// The `exceljs` npm package ships ambient .d.ts types for its main entry
// but the prebuilt browser bundle at `exceljs/dist/exceljs.min.js` (which
// avoids Node globals so it loads in the PBI iframe sandbox) has no
// .d.ts of its own. Map the bundle path to the regular ExcelJS namespace
// so callers stay typed via a normal namespace import.
declare module "exceljs/dist/exceljs.min.js" {
    export * from "exceljs";
}
