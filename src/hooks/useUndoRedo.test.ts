import { describe, expect, it } from "vitest";
import { act, fireEvent, renderHook } from "@testing-library/react";

import { useUndoRedo } from "./useUndoRedo";

describe("useUndoRedo", () => {
  it("starts with the initial present and empty stacks", () => {
    const { result } = renderHook(() => useUndoRedo(0));

    expect(result.current.state).toBe(0);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.historySize).toBe(0);
  });

  it("pushes history entries and exposes undo/redo", () => {
    const { result } = renderHook(() => useUndoRedo(0));

    act(() => result.current.set(1));
    act(() => result.current.set(2));

    expect(result.current.state).toBe(2);
    expect(result.current.historySize).toBe(2);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.state).toBe(1);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.state).toBe(0);
    expect(result.current.canUndo).toBe(false);

    act(() => result.current.redo());
    act(() => result.current.redo());
    expect(result.current.state).toBe(2);
    expect(result.current.canRedo).toBe(false);
  });

  it("accepts functional updates", () => {
    const { result } = renderHook(() => useUndoRedo({ count: 0 }));

    act(() => result.current.set((current) => ({ count: current.count + 1 })));
    act(() => result.current.set((current) => ({ count: current.count + 1 })));

    expect(result.current.state.count).toBe(2);
  });

  it("truncates the future branch on a new action after undo", () => {
    const { result } = renderHook(() => useUndoRedo(0));

    act(() => result.current.set(1));
    act(() => result.current.set(2));
    act(() => result.current.undo());

    expect(result.current.state).toBe(1);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.set(9));

    expect(result.current.state).toBe(9);
    expect(result.current.canRedo).toBe(false);
  });

  it("caps the undo stack at maxHistory", () => {
    const { result } = renderHook(() => useUndoRedo(0, 3));

    act(() => result.current.set(1));
    act(() => result.current.set(2));
    act(() => result.current.set(3));
    act(() => result.current.set(4));
    act(() => result.current.set(5));

    expect(result.current.state).toBe(5);
    expect(result.current.historySize).toBe(3);

    act(() => result.current.undo());
    act(() => result.current.undo());
    act(() => result.current.undo());

    // Only the last three steps are reachable: 4 → 3 → 2.
    expect(result.current.state).toBe(2);
    expect(result.current.canUndo).toBe(false);
  });

  it("does not record a step for an identical value", () => {
    const { result } = renderHook(() => useUndoRedo("a"));

    act(() => result.current.set("a"));

    expect(result.current.historySize).toBe(0);
    expect(result.current.canUndo).toBe(false);
  });

  it("resets history and present", () => {
    const { result } = renderHook(() => useUndoRedo(0));

    act(() => result.current.set(1));
    act(() => result.current.reset(42));

    expect(result.current.state).toBe(42);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  describe("keyboard shortcuts", () => {
    it("undoes with Ctrl+Z and redoes with Ctrl+Shift+Z", () => {
      const { result } = renderHook(() => useUndoRedo(0));

      act(() => result.current.set(1));
      act(() => result.current.set(2));

      act(() => {
        fireEvent.keyDown(document, { key: "z", ctrlKey: true });
      });
      expect(result.current.state).toBe(1);

      act(() => {
        fireEvent.keyDown(document, { key: "Z", ctrlKey: true, shiftKey: true });
      });
      expect(result.current.state).toBe(2);
    });

    it("redoes with Ctrl+Y", () => {
      const { result } = renderHook(() => useUndoRedo(0));

      act(() => result.current.set(1));
      act(() => result.current.undo());

      act(() => {
        fireEvent.keyDown(document, { key: "y", ctrlKey: true });
      });

      expect(result.current.state).toBe(1);
    });

    it("supports Cmd on macOS", () => {
      const { result } = renderHook(() => useUndoRedo(0));

      act(() => result.current.set(1));

      act(() => {
        fireEvent.keyDown(document, { key: "z", metaKey: true });
      });

      expect(result.current.state).toBe(0);
    });

    it("is suppressed while an <input> is focused", () => {
      const { result } = renderHook(() => useUndoRedo(0));
      const input = document.createElement("input");
      document.body.append(input);
      input.focus();

      act(() => result.current.set(1));

      act(() => {
        fireEvent.keyDown(document, { key: "z", ctrlKey: true });
      });

      expect(result.current.state).toBe(1);
      expect(result.current.canUndo).toBe(true);

      input.remove();
    });

    it("is suppressed inside a contentEditable region", () => {
      const { result } = renderHook(() => useUndoRedo(0));
      const editable = document.createElement("div");
      editable.setAttribute("contenteditable", "true");
      editable.tabIndex = 0;
      editable.textContent = "typing here";
      document.body.append(editable);
      editable.focus();
      expect(document.activeElement).toBe(editable);

      act(() => result.current.set(1));
      act(() => {
        fireEvent.keyDown(document, { key: "z", ctrlKey: true });
      });

      expect(result.current.state).toBe(1);
      editable.remove();
    });

    it("can be detached with keyboard: false", () => {
      const { result } = renderHook(() => useUndoRedo(0, 50, { keyboard: false }));

      act(() => result.current.set(1));
      act(() => {
        fireEvent.keyDown(document, { key: "z", ctrlKey: true });
      });

      expect(result.current.state).toBe(1);
    });
  });
});
