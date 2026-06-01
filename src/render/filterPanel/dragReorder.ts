// INF-3758 — drag-to-reorder controller for the comprehensive filter sidebar.
//
// Pointer-based drag (not HTML5 dragstart/dragend) for cross-platform style
// control. Tracks the source dim block, shows a 2px drop indicator line at
// the target insertion position, and on drop computes a compact 0..N-1
// sortOrders array and fires the operator's onReorder callback.
//
// Lives outside comprehensivePanel.ts to keep that file under the 400-LOC cap.

const MAX_FILTER_DIMENSIONS = 8;
const DRAG_THRESHOLD_PX = 5;
const DROP_INDICATOR_COLOR = "#1F77B4";

export interface DragReorderControllerOptions {
    /** Returns the current visible slotIndex list, in render order. Called
     *  on drop to compute the new sortOrders. */
    getVisibleSlotIndices: () => ReadonlyArray<number>;
    /** Called with an 8-element sortOrders array (slot index → sortOrder).
     *  Visible dragged slots get 0..N-1; unmoved slots get sortOrder >= 1000
     *  so they sort after the visible set. */
    onReorder: (newSortOrders: ReadonlyArray<number>) => void;
}

export interface DragReorderController {
    /** Wire a grab handle to start a drag. blockEl is the dim block element
     *  that gets ghosted during drag. slotIndex identifies which slot the
     *  block represents (used to compute the post-drop ordering). */
    attachDragHandle(handle: HTMLElement, blockEl: HTMLElement, slotIndex: number): void;
}

export function mountDragController(
    body: HTMLElement,
    options: DragReorderControllerOptions,
): DragReorderController {
    body.style.position = "relative";

    const dropIndicator = document.createElement("div");
    dropIndicator.style.cssText = [
        "position:absolute",
        "left:8px",
        "right:8px",
        "height:2px",
        `background:${DROP_INDICATOR_COLOR}`,
        "border-radius:1px",
        "z-index:100",
        "pointer-events:none",
        "display:none",
    ].join(";");
    body.appendChild(dropIndicator);

    let dragState: {
        sourceSlotIndex: number;
        sourceEl: HTMLElement;
        pointerDownY: number;
        dragging: boolean;
        targetIndex: number;
        /** INF-3778 — snapshot of getVisibleSlotIndices() at pointerdown.
         *  Pre-fix: drop math used the CURRENT visible-slots list at
         *  pointerup; if FilterState mutated mid-drag (repaint fires →
         *  lastBindings updates → getVisibleSlotIndices returns new array),
         *  the drop landed in the WRONG slot or computed bad indices.
         *  Post-fix: snapshot frozen at drag-start drives drop math; if
         *  snapshot differs from current at drop time, abort with a warn
         *  so the drop never produces an incorrect reorder. */
        snapshotSlotIndices: ReadonlyArray<number>;
    } | null = null;

    function visibleBlocks(): HTMLElement[] {
        return Array.from(body.children).filter(
            c => c instanceof HTMLElement && c !== dropIndicator,
        ) as HTMLElement[];
    }

    function updateDropIndicator(targetIdx: number): void {
        const blocks = visibleBlocks();
        if (blocks.length === 0) {
            dropIndicator.style.display = "none";
            return;
        }
        let topPx: number;
        if (targetIdx <= 0) {
            topPx = blocks[0].offsetTop - 1;
        } else if (targetIdx >= blocks.length) {
            const last = blocks[blocks.length - 1];
            topPx = last.offsetTop + last.offsetHeight - 1;
        } else {
            const above = blocks[targetIdx - 1];
            topPx = above.offsetTop + above.offsetHeight - 1;
        }
        dropIndicator.style.top = topPx + "px";
        dropIndicator.style.display = "block";
    }

    function findTargetIndex(clientY: number): number {
        const blocks = visibleBlocks();
        for (let i = 0; i < blocks.length; i++) {
            const rect = blocks[i].getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            if (clientY < midY) return i;
        }
        return blocks.length;
    }

    function cleanup(): void {
        if (dragState !== null) {
            dragState.sourceEl.style.opacity = "";
        }
        document.body.style.cursor = "";
        dropIndicator.style.display = "none";
        dragState = null;
    }

    function attachDragHandle(
        handle: HTMLElement,
        blockEl: HTMLElement,
        slotIndex: number,
    ): void {
        handle.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            try { handle.setPointerCapture(e.pointerId); } catch { /* ok */ }
            dragState = {
                sourceSlotIndex: slotIndex,
                sourceEl: blockEl,
                pointerDownY: e.clientY,
                dragging: false,
                targetIndex: -1,
                // INF-3778 — freeze the visible-slot order NOW so drop math
                // is computed against the binding list the user started
                // dragging against, not against any mid-drag refresh.
                snapshotSlotIndices: Array.from(options.getVisibleSlotIndices()),
            };
        });

        handle.addEventListener("pointermove", (e) => {
            if (dragState === null) return;
            const dy = Math.abs(e.clientY - dragState.pointerDownY);
            if (!dragState.dragging && dy < DRAG_THRESHOLD_PX) return;
            if (!dragState.dragging) {
                dragState.dragging = true;
                dragState.sourceEl.style.opacity = "0.4";
                document.body.style.cursor = "grabbing";
            }
            const targetIdx = findTargetIndex(e.clientY);
            dragState.targetIndex = targetIdx;
            updateDropIndicator(targetIdx);
        });

        handle.addEventListener("pointerup", (e) => {
            if (dragState === null) return;
            try { handle.releasePointerCapture(e.pointerId); } catch { /* ok */ }
            const wasDragging = dragState.dragging;
            const sourceSlot = dragState.sourceSlotIndex;
            const targetIdx = dragState.targetIndex;
            // INF-3778 — pull snapshot out of dragState BEFORE cleanup() nulls it.
            const snapshotSlots = dragState.snapshotSlotIndices;
            cleanup();
            if (!wasDragging) return;

            // INF-3778 — verify the binding list didn't mutate during the drag.
            // If it did, the user's intent is ambiguous — recomputing drop
            // index math against the new list could land the dropped dim in
            // the wrong slot. Abort with a warn; user re-drags if they meant it.
            const currentSlots = options.getVisibleSlotIndices();
            const snapshotChanged =
                snapshotSlots.length !== currentSlots.length ||
                !snapshotSlots.every((s, i) => s === currentSlots[i]);
            if (snapshotChanged) {
                console.warn(
                    "[dragReorder] visible bindings changed mid-drag, aborting drop",
                    { snapshot: snapshotSlots, current: Array.from(currentSlots) },
                );
                return;
            }

            // Compute new ordering against the SNAPSHOT (which we've now
            // verified equals current). Remove source slot, insert at
            // targetIdx — adjusting for the fact that targetIdx was
            // measured against a list that INCLUDED the source.
            const visibleSlots = Array.from(snapshotSlots);
            const sourceVisualPos = visibleSlots.indexOf(sourceSlot);
            const without = visibleSlots.filter(s => s !== sourceSlot);
            let insertAt = targetIdx;
            if (sourceVisualPos !== -1 && sourceVisualPos < targetIdx) {
                insertAt -= 1;
            }
            insertAt = Math.max(0, Math.min(without.length, insertAt));
            without.splice(insertAt, 0, sourceSlot);

            // Build 8-element sortOrders array. Visible slots get 0..N-1 in
            // new visual order. Slots not in the visible set get 1000+ as a
            // high-number placeholder so they sort AFTER visible ones.
            const newSortOrders: number[] = new Array(MAX_FILTER_DIMENSIONS).fill(0);
            for (let i = 0; i < MAX_FILTER_DIMENSIONS; i++) {
                newSortOrders[i] = 1000 + i;
            }
            for (let order = 0; order < without.length; order++) {
                newSortOrders[without[order]] = order;
            }
            options.onReorder(newSortOrders);
        });

        handle.addEventListener("pointercancel", () => {
            cleanup();
        });
    }

    return { attachDragHandle };
}
