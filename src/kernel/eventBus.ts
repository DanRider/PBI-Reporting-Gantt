// L0 kernel. A synchronous, in-process, topic-keyed publish/subscribe
// bus, instance-scoped (no module-level state). It has NO consumer today
// — it is kept as a forward slot so later versions can hang cross-stage
// decorations or telemetry off a stable pub/sub shape without re-deriving
// it. Per CLAUDE.md: do not introduce coupling to it in v0.1. Pure infra:
// it imports nothing from the rest of src.

// A topic listener. The generic is the contract at the API boundary; the
// internal store erases the payload type (storage cannot stay generic).
export type Listener<T> = (payload: T) => void;

// Returned by subscribe(); calling it removes that one listener. Idempotent
// so callers can dispose freely without tracking whether they already did.
export type Unsubscribe = () => void;

export class EventBus {
  // Insertion-ordered Set per topic so dispatch order == subscribe order.
  // The stored signature is the type-erased form; subscribe()'s generic
  // restores per-call typing. Bivariant param check (strict:false) lets a
  // Listener<T> land here without a cast.
  private readonly listeners = new Map<string, Set<(payload: unknown) => void>>();

  // The returned closure guards on a `live` flag so a double-dispose is a
  // no-op rather than a second (wrong) delete.
  subscribe<T>(topic: string, listener: Listener<T>): Unsubscribe {
    let bucket = this.listeners.get(topic);
    if (!bucket) {
      bucket = new Set();
      this.listeners.set(topic, bucket);
    }
    bucket.add(listener);

    let live = true;
    return () => {
      if (!live) {
        return;
      }
      live = false;
      bucket.delete(listener);
    };
  }

  // A throwing listener is intentionally NOT caught: a publish failure
  // must surface to the publisher rather than be silently swallowed, so
  // the exception propagates and aborts the remaining dispatch.
  publish<T>(topic: string, payload: T): void {
    const bucket = this.listeners.get(topic);
    if (!bucket) {
      return;
    }
    for (const listener of bucket) {
      listener(payload);
    }
  }

  // No argument clears every topic; a topic clears just that one. Used by
  // teardown paths that must not leak listeners across visual re-creation.
  clear(topic?: string): void {
    if (topic === undefined) {
      this.listeners.clear();
      return;
    }
    this.listeners.delete(topic);
  }

  listenerCount(topic: string): number {
    return this.listeners.get(topic)?.size ?? 0;
  }

  topics(): string[] {
    return Array.from(this.listeners.keys());
  }
}
