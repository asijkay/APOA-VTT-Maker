import type { ID } from '../scene/SceneTypes';

export type SelectionListener = (selectedIds: ReadonlySet<ID>) => void;

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
    this.ids.add(id);
    this.notify();
  }

  remove(id: ID): void {
    if (!this.ids.has(id)) return;
    this.ids.delete(id);
    this.notify();
  }

  toggle(id: ID): void {
    if (this.ids.has(id)) this.ids.delete(id);
    else this.ids.add(id);
    this.notify();
  }

  clear(): void {
    if (this.ids.size === 0) return;
    this.ids.clear();
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
