// v2.1 W1.5a — selection state model.
//
// One immutable Selection record per "what the user currently has selected."
// The discriminated union on `kind` enforces "every Selection carries the
// right subset of identifying fields for its kind at compile time" — no
// untagged optional fields, no kind-without-fields footguns.
//
// SelectionStore is the single source of truth for the visual instance.
// The panel and the renderers subscribe; the click handlers + persistence
// rehydration write. Pure TS — no DOM, no PBI imports.

export type Selection =
    | { readonly kind: "none" }
    | { readonly kind: "lane"; readonly laneName: string }
    | { readonly kind: "activity"; readonly activityName: string }
    | { readonly kind: "milestone"; readonly milestoneLabel: string; readonly activityName: string };

export type SelectionListener = (next: Selection) => void;

export interface SelectionStore {
    /** Current selection. */
    get(): Selection;
    /** Replace selection. Notifies all listeners synchronously. No-op if
     *  the new Selection is structurally equal to the current one. */
    set(next: Selection): void;
    /** Subscribe to changes. Returns an unsubscribe fn. */
    subscribe(listener: SelectionListener): () => void;
}

function selectionsEqual(a: Selection, b: Selection): boolean {
    if (a.kind !== b.kind) return false;
    switch (a.kind) {
        case "none":
            return true;
        case "lane":
            return a.laneName === (b as { laneName: string }).laneName;
        case "activity":
            return a.activityName === (b as { activityName: string }).activityName;
        case "milestone": {
            const bm = b as { milestoneLabel: string; activityName: string };
            return a.milestoneLabel === bm.milestoneLabel && a.activityName === bm.activityName;
        }
    }
}

export function createSelectionStore(initial: Selection): SelectionStore {
    let current: Selection = initial;
    const listeners = new Set<SelectionListener>();
    return {
        get: () => current,
        set(next: Selection): void {
            if (selectionsEqual(current, next)) return;
            current = next;
            for (const l of listeners) l(next);
        },
        subscribe(listener: SelectionListener): () => void {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
    };
}
