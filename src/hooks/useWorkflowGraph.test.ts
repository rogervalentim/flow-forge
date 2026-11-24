import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import {
  PERSIST_DEBOUNCE_MS,
  WORKFLOW_STORAGE_KEY,
  hydrateWorkflow,
  useWorkflowGraph,
  wouldCreateCycle,
  type WorkflowGraphStorage,
} from "./useWorkflowGraph";
import {
  createEmptyWorkflow,
  createNode,
  parseWorkflow,
  workflowSchema,
  type WorkflowState,
} from "../types/workflow";

/** In-memory Storage double. */
function createStorage(): WorkflowGraphStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

function twoNodeWorkflow(): WorkflowState {
  return {
    ...createEmptyWorkflow("wf_test", "Test workflow"),
    nodes: [
      createNode("prompt", "n1", { x: 0, y: 0 }),
      createNode("tool", "n2", { x: 300, y: 0 }),
    ],
  };
}

describe("useWorkflowGraph", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates nodes with defaults and typed data", () => {
    const { result } = renderHook(() =>
      useWorkflowGraph(createEmptyWorkflow(), { storage: null }),
    );

    let id = "";
    act(() => {
      const node = result.current.addNode("prompt", { x: 40, y: 60 });
      id = node.id;
    });

    expect(result.current.nodes).toHaveLength(1);
    const node = result.current.nodes[0];
    expect(node?.id).toBe(id);
    expect(node?.type).toBe("prompt");
    expect(node?.position).toEqual({ x: 40, y: 60 });
    if (node?.type === "prompt") {
      expect(node.data.model).toBe("gpt-4o");
      expect(node.data.temperature).toBe(0.7);
    }
    expect(result.current.canUndo).toBe(true);
  });

  it("updates node data without changing the node type", () => {
    const { result } = renderHook(() =>
      useWorkflowGraph(twoNodeWorkflow(), { storage: null }),
    );

    act(() => {
      result.current.updateNodeData("n1", { temperature: 1.4, systemPrompt: "Be terse." });
    });

    const node = result.current.nodes.find((candidate) => candidate.id === "n1");
    expect(node?.type).toBe("prompt");
    if (node?.type === "prompt") {
      expect(node.data.temperature).toBe(1.4);
      expect(node.data.systemPrompt).toBe("Be terse.");
      expect(node.data.model).toBe("gpt-4o");
    }
  });

  it("keeps transient moves out of history until the move is committed", () => {
    const { result } = renderHook(() =>
      useWorkflowGraph(twoNodeWorkflow(), { storage: null }),
    );

    act(() => {
      result.current.moveNodeTransient("n1", { x: 10, y: 10 });
    });
    act(() => {
      result.current.moveNodeTransient("n1", { x: 20, y: 20 });
    });

    expect(result.current.nodes.find((node) => node.id === "n1")?.position).toEqual({
      x: 20,
      y: 20,
    });
    expect(result.current.canUndo).toBe(false);

    act(() => {
      result.current.commitNodeMove("n1", { x: 30, y: 30 });
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.nodes.find((node) => node.id === "n1")?.position).toEqual({
      x: 30,
      y: 30,
    });

    act(() => result.current.undo());
    // Undo returns to the pre-drag position, not to an intermediate frame.
    expect(result.current.nodes.find((node) => node.id === "n1")?.position).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("rejects self-loops", () => {
    const { result } = renderHook(() =>
      useWorkflowGraph(twoNodeWorkflow(), { storage: null }),
    );

    let outcome: ReturnType<typeof result.current.connectNodes> | undefined;
    act(() => {
      outcome = result.current.connectNodes("n1", "n1");
    });

    expect(outcome).toEqual({ ok: false, reason: "self-loop" });
    expect(result.current.edges).toHaveLength(0);
  });

  it("rejects duplicate edges", () => {
    const { result } = renderHook(() =>
      useWorkflowGraph(twoNodeWorkflow(), { storage: null }),
    );

    act(() => {
      result.current.connectNodes("n1", "n2");
    });
    let outcome: ReturnType<typeof result.current.connectNodes> | undefined;
    act(() => {
      outcome = result.current.connectNodes("n1", "n2");
    });

    expect(outcome).toEqual({ ok: false, reason: "duplicate" });
    expect(result.current.edges).toHaveLength(1);
  });

  it("rejects edges between missing nodes", () => {
    const { result } = renderHook(() =>
      useWorkflowGraph(twoNodeWorkflow(), { storage: null }),
    );

    let outcome: ReturnType<typeof result.current.connectNodes> | undefined;
    act(() => {
      outcome = result.current.connectNodes("n1", "ghost");
    });

    expect(outcome).toEqual({ ok: false, reason: "missing-node" });
  });

  it("accepts valid edges and removes them by id", () => {
    const { result } = renderHook(() =>
      useWorkflowGraph(twoNodeWorkflow(), { storage: null }),
    );

    let edgeId = "";
    act(() => {
      const outcome = result.current.connectNodes("n1", "n2");
      if (outcome.ok) edgeId = outcome.edge.id;
    });

    expect(result.current.edges).toHaveLength(1);
    expect(result.current.edges[0]?.sourceNodeId).toBe("n1");
    expect(result.current.edges[0]?.targetNodeId).toBe("n2");

    act(() => {
      result.current.removeEdge(edgeId);
    });

    expect(result.current.edges).toHaveLength(0);
  });

  it("cascades edge deletion when a node is removed", () => {
    const base = twoNodeWorkflow();
    const workflow: WorkflowState = {
      ...base,
      nodes: [...base.nodes, createNode("evaluator", "n3", { x: 600, y: 0 })],
      edges: [
        { id: "e1", sourceNodeId: "n1", targetNodeId: "n2" },
        { id: "e2", sourceNodeId: "n2", targetNodeId: "n3" },
        { id: "e3", sourceNodeId: "n1", targetNodeId: "n3" },
      ],
    };

    const { result } = renderHook(() => useWorkflowGraph(workflow, { storage: null }));

    act(() => {
      result.current.removeNode("n2");
    });

    expect(result.current.nodes.map((node) => node.id)).toEqual(["n1", "n3"]);
    expect(result.current.edges.map((edge) => edge.id)).toEqual(["e3"]);
  });

  it("detects cycles before adding an edge", () => {
    const edges = [
      { id: "e1", sourceNodeId: "a", targetNodeId: "b" },
      { id: "e2", sourceNodeId: "b", targetNodeId: "c" },
    ];

    expect(wouldCreateCycle(edges, "c", "a")).toBe(true);
    expect(wouldCreateCycle(edges, "a", "c")).toBe(false);
    expect(wouldCreateCycle(edges, "a", "a")).toBe(true);

    const base = twoNodeWorkflow();
    const { result } = renderHook(() =>
      useWorkflowGraph(
        {
          ...base,
          edges: [{ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" }],
        },
        { storage: null },
      ),
    );

    let outcome: ReturnType<typeof result.current.connectNodes> | undefined;
    act(() => {
      outcome = result.current.connectNodes("n2", "n1");
    });
    // n1 → n2 exists, so n2 → n1 would close a loop.
    expect(outcome).toEqual({ ok: false, reason: "cycle" });
  });

  it("persists to storage with a debounce", () => {
    const storage = createStorage();
    const { result } = renderHook(() =>
      useWorkflowGraph(createEmptyWorkflow("wf_persist", "Persisted"), {
        storage,
        debounceMs: PERSIST_DEBOUNCE_MS,
      }),
    );

    act(() => {
      result.current.addNode("evaluator", { x: 1, y: 2 });
    });

    // Not written yet — the debounce is still pending.
    expect(storage.data.has(WORKFLOW_STORAGE_KEY)).toBe(false);

    act(() => {
      vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS + 10);
    });

    const raw = storage.data.get(WORKFLOW_STORAGE_KEY);
    expect(raw).toBeTypeOf("string");

    const parsed = parseWorkflow(JSON.parse(raw ?? "null"));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.id).toBe("wf_persist");
      expect(parsed.data.nodes).toHaveLength(1);
    }
  });

  it("hydrates a valid stored workflow and ignores an invalid one", () => {
    const storage = createStorage();
    const stored = twoNodeWorkflow();
    storage.data.set(WORKFLOW_STORAGE_KEY, JSON.stringify(stored));

    expect(hydrateWorkflow(createEmptyWorkflow(), storage)).toEqual(stored);

    storage.data.set(WORKFLOW_STORAGE_KEY, '{"id":"broken"}');
    const fallback = createEmptyWorkflow("wf_fallback", "Fallback");
    expect(hydrateWorkflow(fallback, storage)).toEqual(fallback);

    storage.data.set(WORKFLOW_STORAGE_KEY, "not json at all");
    expect(hydrateWorkflow(fallback, storage)).toEqual(fallback);
  });

  it("renames the workflow and ignores blank names", () => {
    const { result } = renderHook(() =>
      useWorkflowGraph(createEmptyWorkflow("wf", "Original"), { storage: null }),
    );

    act(() => result.current.renameWorkflow("  Renamed  "));
    expect(result.current.workflow.name).toBe("Renamed");

    act(() => result.current.renameWorkflow("   "));
    expect(result.current.workflow.name).toBe("Renamed");
  });

  it("replaces the workflow and clears history", () => {
    const { result } = renderHook(() =>
      useWorkflowGraph(createEmptyWorkflow("wf_old", "Old"), { storage: null }),
    );

    act(() => {
      result.current.addNode("tool", { x: 0, y: 0 });
    });
    expect(result.current.canUndo).toBe(true);

    const imported = twoNodeWorkflow();
    act(() => {
      result.current.replaceWorkflow(imported);
    });

    expect(result.current.workflow.id).toBe("wf_test");
    expect(result.current.nodes).toHaveLength(2);
    expect(result.current.canUndo).toBe(false);
  });

  it("undoes node creation", () => {
    const { result } = renderHook(() =>
      useWorkflowGraph(createEmptyWorkflow(), { storage: null }),
    );

    act(() => {
      result.current.addNode("prompt", { x: 0, y: 0 });
    });
    expect(result.current.nodes).toHaveLength(1);

    act(() => result.current.undo());
    expect(result.current.nodes).toHaveLength(0);
  });
});

describe("workflowSchema (Zod)", () => {
  it("accepts a valid workflow", () => {
    const result = workflowSchema.safeParse(twoNodeWorkflow());
    expect(result.success).toBe(true);
  });

  it("rejects an unknown node type", () => {
    const result = workflowSchema.safeParse({
      ...createEmptyWorkflow(),
      nodes: [{ id: "x", type: "unknown", position: { x: 0, y: 0 }, data: {} }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-range temperature", () => {
    const result = workflowSchema.safeParse({
      ...createEmptyWorkflow(),
      nodes: [
        {
          id: "x",
          type: "prompt",
          position: { x: 0, y: 0 },
          data: { model: "gpt-4o", systemPrompt: "", temperature: 3 },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects edges that reference unknown nodes", () => {
    const result = parseWorkflow({
      ...createEmptyWorkflow(),
      edges: [{ id: "e1", sourceNodeId: "a", targetNodeId: "b" }],
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("unknown node");
  });

  it("rejects self-loop edges at the schema level", () => {
    const base = twoNodeWorkflow();
    const result = workflowSchema.safeParse({
      ...base,
      edges: [{ id: "e1", sourceNodeId: "n1", targetNodeId: "n1" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid timestamp", () => {
    const result = workflowSchema.safeParse({ ...createEmptyWorkflow(), updatedAt: "yesterday" });
    expect(result.success).toBe(false);
  });
});
