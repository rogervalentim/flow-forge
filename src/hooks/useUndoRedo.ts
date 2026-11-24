import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from "react";

/* ────────────────────────────────────────────────────────────────────────────
 * Reducer
 * ──────────────────────────────────────────────────────────────────────────── */

export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export type HistoryAction<T> =
  | { type: "set"; value: T | ((current: T) => T); maxHistory: number; record?: boolean }
  | { type: "commit"; base: T; value: T; maxHistory: number }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; value: T };

export function historyReducer<T>(
  state: HistoryState<T>,
  action: HistoryAction<T>,
): HistoryState<T> {
  switch (action.type) {
    case "set": {
      const next =
        typeof action.value === "function"
          ? (action.value as (current: T) => T)(state.present)
          : action.value;

      if (Object.is(next, state.present)) return state;

      // Transient updates (pointer moves) replace the present without touching
      // the history stack; the release is committed as one entry.
      if (action.record === false) {
        return { ...state, present: next };
      }

      // A new action truncates the redo branch and caps the undo stack.
      const past = [...state.past, state.present].slice(-Math.max(1, action.maxHistory));
      return { past, present: next, future: [] };
    }

    case "commit": {
      // Records `base` as the step before `value` in a single dispatch, so a
      // pointer drag lands as exactly one undoable entry.
      if (Object.is(action.value, state.present)) return state;

      const past = [...state.past, action.base].slice(-Math.max(1, action.maxHistory));
      return { past, present: action.value, future: [] };
    }

    case "undo": {
      const previous = state.past[state.past.length - 1];
      if (previous === undefined) return state;

      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      };
    }

    case "redo": {
      const [next, ...rest] = state.future;
      if (next === undefined) return state;

      return {
        past: [...state.past, state.present],
        present: next,
        future: rest,
      };
    }

    case "reset":
      return { past: [], present: action.value, future: [] };
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Hook
 * ──────────────────────────────────────────────────────────────────────────── */

export type SetStateAction<T> = T | ((current: T) => T);

export interface UseUndoRedoOptions {
  /** Set false to detach the keyboard listener (e.g. while a modal owns focus). */
  keyboard?: boolean;
  /** Element the listener is attached to. Defaults to `document`. */
  target?: Document | HTMLElement | null;
}

export interface UseUndoRedoResult<T> {
  state: T;
  /** Replaces the present and pushes a history entry. */
  set: (value: SetStateAction<T>) => void;
  /** Replaces the present without recording history (high-frequency updates). */
  setTransient: (value: SetStateAction<T>) => void;
  /** Records one history entry whose undo target is `base`. */
  commit: (base: T, value: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Clears the history and replaces the present. */
  reset: (value: T) => void;
  /** Number of undoable steps (useful for UI hints and tests). */
  historySize: number;
}

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** True when typing inside a field must not be intercepted by shortcuts. */
export function isEditableElement(element: Element | null): boolean {
  if (element === null) return false;

  // `isContentEditable` is not implemented by every DOM (jsdom included), so
  // the attribute is checked as well — including on ancestors.
  if (
    element instanceof HTMLElement &&
    (element.isContentEditable || element.closest('[contenteditable="true"]') !== null)
  ) {
    return true;
  }

  return EDITABLE_TAGS.has(element.tagName);
}

/**
 * `useUndoRedo` — reducer-backed history with keyboard shortcuts.
 *
 * Shortcuts: `Ctrl/Cmd+Z` undo, `Ctrl/Cmd+Shift+Z` and `Ctrl/Cmd+Y` redo.
 * Events fired from an `INPUT`, `TEXTAREA`, `SELECT` or `contentEditable`
 * element are ignored so native text undo keeps working.
 */
export function useUndoRedo<T>(
  initialPresent: T,
  maxHistory = 50,
  options: UseUndoRedoOptions = {},
): UseUndoRedoResult<T> {
  const { keyboard = true, target } = options;

  const [history, dispatch] = useReducer(historyReducer<T>, {
    past: [],
    present: initialPresent,
    future: [],
  });

  const set = useCallback(
    (value: SetStateAction<T>) => {
      dispatch({ type: "set", value, maxHistory });
    },
    [maxHistory],
  );

  const setTransient = useCallback(
    (value: SetStateAction<T>) => {
      dispatch({ type: "set", value, maxHistory, record: false });
    },
    [maxHistory],
  );

  const commit = useCallback(
    (base: T, value: T) => {
      dispatch({ type: "commit", base, value, maxHistory });
    },
    [maxHistory],
  );

  const undo = useCallback(() => {
    dispatch({ type: "undo" });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: "redo" });
  }, []);

  const reset = useCallback((value: T) => {
    dispatch({ type: "reset", value });
  }, []);

  // Keyboard shortcuts — re-attached only when the listener target changes.
  const handlers = useRef({ undo, redo });
  useLayoutEffect(() => {
    handlers.current = { undo, redo };
  }, [undo, redo]);

  useEffect(() => {
    if (!keyboard) return;

    const host: Document | HTMLElement | null =
      target ?? (typeof document === "undefined" ? null : document);
    if (host === null) return;

    const onKeyDown = (event: Event) => {
      const { key, ctrlKey, metaKey, shiftKey, altKey } = event as KeyboardEvent;
      if (!(ctrlKey || metaKey) || altKey) return;
      if (isEditableElement(document.activeElement)) return;

      const lower = key.toLowerCase();

      if (lower === "z" && !shiftKey) {
        event.preventDefault();
        handlers.current.undo();
        return;
      }

      if ((lower === "z" && shiftKey) || (lower === "y" && !shiftKey)) {
        event.preventDefault();
        handlers.current.redo();
      }
    };

    host.addEventListener("keydown", onKeyDown);
    return () => {
      host.removeEventListener("keydown", onKeyDown);
    };
  }, [keyboard, target]);

  return useMemo(
    () => ({
      state: history.present,
      set,
      setTransient,
      commit,
      undo,
      redo,
      reset,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      historySize: history.past.length,
    }),
    [history, set, setTransient, commit, undo, redo, reset],
  );
}
