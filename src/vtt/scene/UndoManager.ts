import type { Scene } from './SceneTypes';
import type { SceneStore } from './SceneStore';

/** A reversible operation pair: apply executes a change, inverse undoes it. */
export type Operation = {
  /** Human-readable label (for debugging) */
  label: string;
  /** Apply (or re-apply) this operation to the store */
  apply: (store: SceneStore) => void;
  /** Undo this operation (the exact inverse) */
  inverse: (store: SceneStore) => void;
};

const MAX_STACK = 100;

/**
 * Manages undo/redo history for the VTT scene.
 *
 * Usage:
 *   - Wrap every user mutation with `undoManager.execute(op)` instead of
 *     calling SceneStore directly. This records the inverse automatically.
 *   - Call `undo()` / `redo()` (e.g., from keyboard shortcuts).
 *
 * The manager stores inverse operations, NOT full scene snapshots, to keep
 * memory overhead low. Each operation describes exactly how to reverse itself.
 */
export class UndoManager {
  private undoStack: Operation[] = [];
  private redoStack: Operation[] = [];
  private store: SceneStore;

  constructor(store: SceneStore) {
    this.store = store;
  }

  /**
   * Executes `op.apply()` against the store, then records the operation
   * so it can be undone. Clears the redo stack (consistent with standard UX).
   */
  execute(op: Operation): void {
    op.apply(this.store);
    this.undoStack.push(op);
    if (this.undoStack.length > MAX_STACK) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  /**
   * Executes an inverse operation without recording it to the undo stack.
   * Useful for bulk scene loads (replace) where we don't want history.
   */
  executeQuiet(fn: (store: SceneStore) => void): void {
    fn(this.store);
  }

  /**
   * Undoes the last operation. If the undo stack is empty, does nothing.
   * Returns true if an undo was performed.
   */
  undo(): boolean {
    const op = this.undoStack.pop();
    if (!op) return false;
    op.inverse(this.store);
    this.redoStack.push(op);
    return true;
  }

  /**
   * Re-applies the last undone operation. If the redo stack is empty, does nothing.
   * Returns true if a redo was performed.
   */
  redo(): boolean {
    const op = this.redoStack.pop();
    if (!op) return false;
    op.apply(this.store);
    this.undoStack.push(op);
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Clears all history (e.g., after loading a new scene). */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  /**
   * Records a pre-applied operation into the undo history without calling apply().
   * Use this when the operation has already been applied (e.g., live token drag).
   */
  pushOperation(op: Operation): void {
    this.undoStack.push(op);
    if (this.undoStack.length > MAX_STACK) this.undoStack.shift();
    this.redoStack = [];
  }

  /**
   * Creates a snapshot-based operation for cases where computing
   * a precise inverse is complex (e.g., bulk operations).
   * Warning: stores a full scene clone — use sparingly.
   */
  static snapshotOp(label: string, before: Scene, after: Scene): Operation {
    return {
      label,
      apply: (store) => store.replace(after),
      inverse: (store) => store.replace(before),
    };
  }
}

// ── Helpers to build common operations ─────────────────────────────────────

export function opAddWall(
  input: Parameters<SceneStore['addWall']>[0],
): Operation & { id?: string } {
  let createdId: string | undefined;
  return {
    label: 'Add Wall',
    apply(store) { createdId = store.addWall(input)?.id; },
    inverse(store) { if (createdId) store.removeWall(createdId); },
  };
}

export function opRemoveWall(id: string, wallData: Parameters<SceneStore['addWall']>[0]): Operation {
  return {
    label: 'Remove Wall',
    apply(store) { store.removeWall(id); },
    inverse(store) { store.addWall(wallData); },
  };
}

export function opAddDoor(input: Parameters<SceneStore['addDoor']>[0]): Operation {
  let createdId: string | undefined;
  return {
    label: 'Add Door',
    apply(store) { createdId = store.addDoor(input)?.id; },
    inverse(store) { if (createdId) store.removeDoor(createdId); },
  };
}

export function opRemoveDoor(id: string, doorData: Parameters<SceneStore['addDoor']>[0]): Operation {
  return {
    label: 'Remove Door',
    apply(store) { store.removeDoor(id); },
    inverse(store) { store.addDoor(doorData); },
  };
}

export function opUpdateDoor(
  id: string,
  patch: Parameters<SceneStore['updateDoor']>[1],
  prevPatch: Parameters<SceneStore['updateDoor']>[1],
): Operation {
  return {
    label: 'Update Door',
    apply(store) { store.updateDoor(id, patch); },
    inverse(store) { store.updateDoor(id, prevPatch); },
  };
}

export function opAddToken(input: Parameters<SceneStore['addToken']>[0]): Operation {
  let createdId: string | undefined;
  return {
    label: 'Add Token',
    apply(store) { createdId = store.addToken(input).id; },
    inverse(store) { if (createdId) store.removeToken(createdId); },
  };
}

export function opRemoveToken(id: string, tokenData: Parameters<SceneStore['addToken']>[0]): Operation {
  return {
    label: 'Remove Token',
    apply(store) { store.removeToken(id); },
    inverse(store) { store.addToken(tokenData); },
  };
}

export function opMoveToken(
  id: string,
  newX: number, newY: number,
  oldX: number, oldY: number,
): Operation {
  return {
    label: 'Move Token',
    apply(store) { store.updateToken(id, { x: newX, y: newY }); },
    inverse(store) { store.updateToken(id, { x: oldX, y: oldY }); },
  };
}

export function opAddLight(input: Parameters<SceneStore['addLight']>[0]): Operation {
  let createdId: string | undefined;
  return {
    label: 'Add Light',
    apply(store) { createdId = store.addLight(input).id; },
    inverse(store) { if (createdId) store.removeLight(createdId); },
  };
}

export function opRemoveLight(id: string, lightData: Parameters<SceneStore['addLight']>[0]): Operation {
  return {
    label: 'Remove Light',
    apply(store) { store.removeLight(id); },
    inverse(store) { store.addLight(lightData); },
  };
}

export function opAddWindow(input: Parameters<SceneStore['addWindow']>[0]): Operation {
  let createdId: string | undefined;
  return {
    label: 'Add Window',
    apply(store) { createdId = store.addWindow(input)?.id; },
    inverse(store) { if (createdId) store.removeWindow(createdId); },
  };
}

export function opRemoveWindow(id: string, winData: Parameters<SceneStore['addWindow']>[0]): Operation {
  return {
    label: 'Remove Window',
    apply(store) { store.removeWindow(id); },
    inverse(store) { store.addWindow(winData); },
  };
}
