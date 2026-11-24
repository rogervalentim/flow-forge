import { describe, expect, it } from "vitest";

import { nodeNarration, topologicalOrder } from "./handlers";
import { createNode, type WorkflowEdge } from "../types/workflow";

function edge(sourceNodeId: string, targetNodeId: string): WorkflowEdge {
  return { id: `${sourceNodeId}->${targetNodeId}`, sourceNodeId, targetNodeId };
}

describe("topologicalOrder", () => {
  it("orders a linear chain source → sink", () => {
    const a = createNode("prompt", "a", { x: 0, y: 0 });
    const b = createNode("tool", "b", { x: 0, y: 0 });
    const c = createNode("evaluator", "c", { x: 0, y: 0 });

    const ordered = topologicalOrder([c, a, b], [edge("a", "b"), edge("b", "c")]);

    expect(ordered.map((node) => node.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps every node when the graph has a cycle", () => {
    const a = createNode("prompt", "a", { x: 0, y: 0 });
    const b = createNode("prompt", "b", { x: 0, y: 0 });

    const ordered = topologicalOrder([a, b], [edge("a", "b"), edge("b", "a")]);

    expect(ordered).toHaveLength(2);
  });

  it("ignores edges pointing at unknown nodes", () => {
    const a = createNode("prompt", "a", { x: 0, y: 0 });

    expect(topologicalOrder([a], [edge("a", "ghost")])).toHaveLength(1);
  });
});

describe("nodeNarration", () => {
  it("describes each node type from its data", () => {
    const prompt = createNode("prompt", "p", { x: 0, y: 0 });
    const tool = createNode("tool", "t", { x: 0, y: 0 });
    const evaluator = createNode("evaluator", "e", { x: 0, y: 0 });

    expect(nodeNarration(prompt)).toContain("model=");
    expect(nodeNarration(tool)).toContain("tool=");
    expect(nodeNarration(evaluator)).toContain("threshold=");
  });
});
