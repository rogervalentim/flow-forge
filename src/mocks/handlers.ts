import { delay, http, HttpResponse } from "msw";

import type { WorkflowEdge, WorkflowNode } from "../types/workflow";

/* ────────────────────────────────────────────────────────────────────────────
 * Scenario handling
 * ──────────────────────────────────────────────────────────────────────────── */

export const MOCK_SCENARIOS = ["normal", "slow", "rate-limit"] as const;
export type MockScenario = (typeof MOCK_SCENARIOS)[number];

export const SCENARIO_HEADER = "x-mock-scenario";
export const EXECUTE_ENDPOINT = "*/api/v1/workflows/execute";

const TOKEN_DELAY_MS = 25;
const SLOW_FIRST_TOKEN_MS = 1500;
const RETRY_AFTER_SECONDS = 3;

function parseScenario(value: string | null): MockScenario {
  return MOCK_SCENARIOS.find((scenario) => scenario === value) ?? "normal";
}

/* ────────────────────────────────────────────────────────────────────────────
 * Topological execution
 * ──────────────────────────────────────────────────────────────────────────── */

/** Kahn's algorithm; nodes caught in a cycle are appended in declaration order. */
export function topologicalOrder(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): WorkflowNode[] {
  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  const byId = new Map<string, WorkflowNode>();

  for (const node of nodes) {
    indegree.set(node.id, 0);
    byId.set(node.id, node);
  }

  for (const edge of edges) {
    if (!byId.has(edge.sourceNodeId) || !byId.has(edge.targetNodeId)) continue;
    indegree.set(edge.targetNodeId, (indegree.get(edge.targetNodeId) ?? 0) + 1);
    const list = adjacency.get(edge.sourceNodeId) ?? [];
    list.push(edge.targetNodeId);
    adjacency.set(edge.sourceNodeId, list);
  }

  const queue = nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id);
  const ordered: WorkflowNode[] = [];

  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined) continue;
    const node = byId.get(id);
    if (node === undefined) continue;

    ordered.push(node);
    for (const next of adjacency.get(id) ?? []) {
      const remaining = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }

  // Cycle or disconnected tail: keep deterministic order rather than dropping nodes.
  for (const node of nodes) {
    if (!ordered.includes(node)) ordered.push(node);
  }

  return ordered;
}

/** Deterministic-ish prose per node type, so the console reads like a real run. */
export function nodeNarration(node: WorkflowNode): string {
  switch (node.type) {
    case "prompt":
      return [
        `model=${node.data.model}`,
        `temperature=${node.data.temperature.toFixed(1)}`,
        node.data.systemPrompt.trim() === ""
          ? "no system prompt"
          : `prompt="${node.data.systemPrompt.trim().slice(0, 48)}"`,
      ].join(" · ");
    case "tool":
      return [
        `tool=${node.data.toolName}`,
        node.data.endpoint !== undefined && node.data.endpoint !== ""
          ? `endpoint=${node.data.endpoint}`
          : `timeout=${node.data.timeoutMs}ms`,
      ].join(" · ");
    case "evaluator":
      return [
        `threshold=${node.data.passThreshold.toFixed(2)}`,
        node.data.criteria.trim() === ""
          ? "no criteria"
          : `criteria="${node.data.criteria.trim().slice(0, 48)}"`,
      ].join(" · ");
  }
}

const SENTENCES = [
  "Reading the incoming request",
  "Resolving context from the graph",
  "Drafting the response",
  "Checking the answer against the criteria",
  "Finalising output",
];

function tokensFor(node: WorkflowNode): string[] {
  const narration = nodeNarration(node);
  const words = `${node.type} node · ${narration} · ${SENTENCES.join(" · ")}`.split(" ");
  return words.map((word, index) => (index === 0 ? word : ` ${word}`));
}

/* ────────────────────────────────────────────────────────────────────────────
 * Handlers
 * ──────────────────────────────────────────────────────────────────────────── */

export const handlers = [
  http.post(EXECUTE_ENDPOINT, async ({ request }) => {
    const scenario = parseScenario(request.headers.get(SCENARIO_HEADER));

    if (scenario === "rate-limit") {
      return new HttpResponse(
        JSON.stringify({ error: "Too Many Requests", retryAfter: RETRY_AFTER_SECONDS }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(RETRY_AFTER_SECONDS),
          },
        },
      );
    }

    let payload: { nodes?: WorkflowNode[]; edges?: WorkflowEdge[] } = {};
    try {
      payload = (await request.json()) as typeof payload;
    } catch {
      payload = {};
    }

    const nodes = payload.nodes ?? [];
    const edges = payload.edges ?? [];
    const ordered = topologicalOrder(nodes, edges);

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          if (scenario === "slow") {
            await delay(SLOW_FIRST_TOKEN_MS);
          }

          for (const node of ordered) {
            send("node_start", { nodeId: node.id, type: node.type });
            await delay(TOKEN_DELAY_MS * 4);

            for (const token of tokensFor(node)) {
              send("token", { nodeId: node.id, token });
              await delay(scenario === "slow" ? TOKEN_DELAY_MS * 2 : TOKEN_DELAY_MS);
            }

            send("node_complete", { nodeId: node.id, type: node.type });
            await delay(TOKEN_DELAY_MS * 2);
          }

          send("done", { nodes: ordered.length, edges: edges.length });
          controller.close();
        } catch {
          controller.close();
        }
      },
    });

    return new HttpResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }),
];
