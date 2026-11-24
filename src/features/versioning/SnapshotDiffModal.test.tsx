import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { collectPrompts, diffLines, loadSnapshots, SNAPSHOT_STORAGE_KEY, saveSnapshots } from "./snapshotStore";
import { SnapshotDiffModal } from "./SnapshotDiffModal";
import { createNode, type WorkflowNode } from "../../types/workflow";

function promptNode(id: string, systemPrompt: string): WorkflowNode {
  return createNode("prompt", id, { x: 0, y: 0 }, { systemPrompt });
}

describe("diffLines", () => {
  it("marks identical lines as same", () => {
    const lines = diffLines("a\nb", "a\nb");
    expect(lines.every((line) => line.kind === "same")).toBe(true);
  });

  it("detects added and removed lines", () => {
    const lines = diffLines("keep\nold", "keep\nnew");
    expect(lines.map((line) => line.kind)).toEqual(["same", "removed", "added"]);
  });

  it("tracks line numbers on both sides", () => {
    const lines = diffLines("one", "one\ntwo");
    expect(lines[0]).toMatchObject({ beforeLine: 1, afterLine: 1 });
    expect(lines[1]).toMatchObject({ kind: "added", beforeLine: null, afterLine: 2 });
  });

  it("handles an empty source", () => {
    // An empty string is still one empty line, which is removed before "only".
    expect(diffLines("", "only")).toEqual([
      { kind: "removed", text: "", beforeLine: 1, afterLine: null },
      { kind: "added", text: "only", beforeLine: null, afterLine: 1 },
    ]);
  });
});

describe("snapshot store", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("collects only prompt nodes", () => {
    const nodes = [promptNode("p1", "be terse"), createNode("tool", "t1", { x: 0, y: 0 })];
    expect(collectPrompts(nodes)).toEqual({ p1: "be terse" });
  });

  it("round-trips snapshots through localStorage", () => {
    const snapshot = {
      id: "s1",
      name: "v1",
      createdAt: new Date().toISOString(),
      prompts: { p1: "hello" },
      nodeCount: 1,
    };

    saveSnapshots([snapshot]);

    expect(window.localStorage.getItem(SNAPSHOT_STORAGE_KEY)).not.toBeNull();
    expect(loadSnapshots()).toEqual([snapshot]);
  });

  it("returns an empty list for corrupt payloads", () => {
    window.localStorage.setItem(SNAPSHOT_STORAGE_KEY, "{not json");
    expect(loadSnapshots()).toEqual([]);
  });
});

describe("SnapshotDiffModal", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("saves a snapshot and shows the diff against the canvas", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <SnapshotDiffModal
        open
        onOpenChange={onOpenChange}
        nodes={[promptNode("p1", "line one")]}
      />,
    );

    await user.type(screen.getByLabelText("Snapshot name"), "v1");
    await user.click(screen.getByRole("button", { name: /save current/i }));

    // The saved snapshot becomes the default "compare from" side.
    expect(loadSnapshots()).toHaveLength(1);
    expect(screen.getByTestId("snapshot-diff")).toBeTruthy();
    expect(screen.getByText("0 changed lines")).toBeTruthy();
  });

  it("asks for a snapshot before diffing", () => {
    render(<SnapshotDiffModal open onOpenChange={() => undefined} nodes={[]} />);
    expect(screen.getByText(/select a snapshot to see the diff/i)).toBeTruthy();
  });

  it("renders changed lines when the canvas differs from the snapshot", async () => {
    const user = userEvent.setup();

    window.localStorage.setItem(
      SNAPSHOT_STORAGE_KEY,
      JSON.stringify([
        {
          id: "s1",
          name: "v1",
          createdAt: new Date().toISOString(),
          prompts: { p1: "old text" },
          nodeCount: 1,
        },
      ]),
    );

    render(<SnapshotDiffModal open onOpenChange={() => undefined} nodes={[promptNode("p1", "new text")]} />);

    await act(async () => {
      await user.selectOptions(screen.getByLabelText("Compare from"), "s1");
    });

    expect(screen.getByText("2 changed lines")).toBeTruthy();
    const diff = screen.getByTestId("snapshot-diff");
    expect(diff.querySelectorAll('[data-kind="added"]').length).toBeGreaterThan(0);
    expect(diff.querySelectorAll('[data-kind="removed"]').length).toBeGreaterThan(0);
  });
});
