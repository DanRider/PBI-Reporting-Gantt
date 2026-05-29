// Shared chrome label style — the small text labels that decorate the
// visual's top-row controls: "Roadmap"/"Table" toggle labels in
// topRightControls.ts and dim cluster labels ("Activity:", "Milestone Type:")
// in filterPanel/topSlicerStrip.ts.
//
// Centralized here so the two surfaces stay visually identical without
// having to remember to update both files when one is tuned. A single
// CHROME_LABEL_CSS export bundles the four properties (color / weight /
// size / family) into one CSS-text fragment ready to be concatenated
// into an inline style declaration.

export const CHROME_LABEL_COLOR = "#555";
export const CHROME_LABEL_FONT_WEIGHT = "600";
export const CHROME_LABEL_FONT_SIZE_PX = 10;
export const CHROME_LABEL_FONT_FAMILY = "'Segoe UI',system-ui,sans-serif";

export const CHROME_LABEL_CSS = [
    `color:${CHROME_LABEL_COLOR}`,
    `font-weight:${CHROME_LABEL_FONT_WEIGHT}`,
    `font-size:${CHROME_LABEL_FONT_SIZE_PX}px`,
    `font-family:${CHROME_LABEL_FONT_FAMILY}`,
].join(";");
