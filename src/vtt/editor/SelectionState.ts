import type { ID } from '../scene/SceneTypes';

export type SelectionListener = (selectedId: ID | null) => void;

export class SelectionState {
  private id: ID | null = null;
  private listeners = new Set<SelectionListener>();

  get(): ID | null {
    return this.id;
  }

  set(id: ID | null): void {
    if (this.id === id) return;
    this.id = id;
    for (const l of this.listeners) l(id);
  }

  subscribe(listener: SelectionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  clear(): void {
    this.set(null);
  }
}
