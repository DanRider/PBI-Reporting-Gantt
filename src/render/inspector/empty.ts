// v2.1 W1.5c — Inspector empty state.
//
// Reserved for a future "panel open but nothing selected" state.
// The current architecture closes the panel when selection.kind = "none",
// so this layout is never mounted from the standard subscriber path.
// Kept as a stable export so future code (e.g. a "show panel without
// selection" toggle) can mount it without re-implementing the shell.

export function renderEmptyInspector(): HTMLElement {
    const div = document.createElement("div");
    div.className = "inspector-empty";
    div.style.cssText = "color:#888;font-size:12px;padding:8px;font-style:italic;";
    div.textContent = "(nothing selected)";
    return div;
}
