// scripts/rename-pbiviz.js
// Runs after `pbiviz package` to give the built .pbiviz a human-readable name.
// pbiviz outputs <guid>.<version>.pbiviz by default — that filename is opaque
// to users importing the visual into PBI Desktop. This rewrites it to
// `<displayName>-v<version>.pbiviz` (e.g., Reporting-Gantt-v1.8.0.0.pbiviz).
// The package's internal GUID is unchanged — PBI binds on that, not the file name.

const fs = require("fs");
const path = require("path");

const pbiviz = JSON.parse(fs.readFileSync("pbiviz.json", "utf-8"));
const guid = pbiviz.visual.guid;
const version = pbiviz.version;
const displayName = (pbiviz.visual.displayName || pbiviz.visual.name).replace(/\s+/g, "-");

const distDir = path.join(process.cwd(), "dist");
const oldName = `${guid}.${version}.pbiviz`;
const newName = `${displayName}-v${version}.pbiviz`;
const oldPath = path.join(distDir, oldName);
const newPath = path.join(distDir, newName);

if (!fs.existsSync(oldPath)) {
    console.error(`  rename-pbiviz: source not found at ${oldPath}`);
    process.exit(1);
}

// If the friendly name already exists, overwrite it
if (fs.existsSync(newPath)) {
    fs.unlinkSync(newPath);
}
fs.renameSync(oldPath, newPath);
console.log(`  renamed: ${oldName} -> ${newName}`);
