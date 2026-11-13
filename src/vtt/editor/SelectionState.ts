import type { ID } from '../scene/SceneTypes';

export type SelectionListener = (selectedIds: ReadonlySet<ID>) => void;

/**
 * Every mutation replaces the Set instead of editing it in place. Listeners hand the
 * set to React state, and React skips the update if it gets the same reference.
 */
export class SelectionState {
  private ids = new Set<ID>();
  private listeners = new Set<SelectionListener>();

  get(): ReadonlySet<ID> {
    return this.ids;
  }

  has(id: ID): boolean {
    return this.ids.has(id);
  }

  set(ids: Iterable<ID> | null): void {
    this.ids = ids ? new Set(ids) : new Set();
    this.notify();
  }

  setSingle(id: ID | null): void {
    this.ids = id ? new Set([id]) : new Set();
    this.notify();
  }

  add(id: ID): void {
    if (this.ids.has(id)) return;
    this.ids = new Set(this.ids).add(id);
    this.notify();
  }

  remove(id: ID): void {
    if (!this.ids.has(id)) return;
    const next = new Set(this.ids);
    next.delete(id);
    this.ids = next;
    this.notify();
  }

  toggle(id: ID): void {
    const next = new Set(this.ids);
    if (!next.delete(id)) next.add(id);
    this.ids = next;
    this.notify();
  }

  clear(): void {
    if (this.ids.size === 0) return;
    this.ids = new Set();
    this.notify();
  }

  subscribe(listener: SelectionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const l of this.listeners) l(this.ids);
  }
}
