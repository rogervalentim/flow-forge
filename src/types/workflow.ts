import { z } from "zod";

/* ────────────────────────────────────────────────────────────────────────────
 * Domain primitives
 * ──────────────────────────────────────────────────────────────────────────── */

/** Canvas coordinates in graph space (unzoomed, untranslated pixels). */
export interface NodePosition {
  x: number;
  y: number;
}

export interface BaseNode {
  id: string;
  position: NodePosition;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Node variants — discriminated on `type`
 * ──────────────────────────────────────────────────────────────────────────── */

export const PROMPT_MODELS = ["gpt-4o", "claude-3-7-sonnet", "gemini-2.5-pro"] as const;
export type PromptModel = (typeof PROMPT_MODELS)[number];

export const TOOL_NAMES = ["web_search", "http_request", "sql_query"] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export interface PromptNode extends BaseNode {
  type: "prompt";
  data: {
    model: PromptModel;
    systemPrompt: string;
    /** 0 – 2, one decimal step. */
    temperature: number;
  };
}

export interface ToolNode extends BaseNode {
  type: "tool";
  data: {
    toolName: ToolName;
    /** Required for `http_request`, optional otherwise. */
    endpoint?: string;
    /** 100 – 120_000 ms. */
    timeoutMs: number;
  };
}

export interface EvaluatorNode extends BaseNode {
  type: "evaluator";
  data: {
    criteria: string;
    /** 0 – 1, the score a run must reach to pass. */
    passThreshold: number;
  };
}

export type WorkflowNode = PromptNode | ToolNode | EvaluatorNode;
export type WorkflowNodeType = WorkflowNode["type"];
export type WorkflowNodeData<T extends WorkflowNodeType> = Extract<
  WorkflowNode,
  { type: T }
>["data"];

export interface WorkflowEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
}

export interface WorkflowState {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  /** ISO-8601 timestamp. */
  updatedAt: string;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Zod schemas — hydration from localStorage and JSON import/export
 * ──────────────────────────────────────────────────────────────────────────── */

export const nodePositionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

const nodeIdSchema = z.string().min(1).max(64);
const nodeBaseShape = {
  id: nodeIdSchema,
  position: nodePositionSchema,
};

export const promptNodeSchema = z.object({
  ...nodeBaseShape,
  type: z.literal("prompt"),
  data: z.object({
    model: z.enum(PROMPT_MODELS),
    systemPrompt: z.string().max(20_000),
    temperature: z.number().min(0).max(2),
  }),
});

export const toolNodeSchema = z.object({
  ...nodeBaseShape,
  type: z.literal("tool"),
  data: z.object({
    toolName: z.enum(TOOL_NAMES),
    endpoint: z.string().max(2_000).optional(),
    timeoutMs: z.number().int().min(100).max(120_000),
  }),
});

export const evaluatorNodeSchema = z.object({
  ...nodeBaseShape,
  type: z.literal("evaluator"),
  data: z.object({
    criteria: z.string().max(20_000),
    passThreshold: z.number().min(0).max(1),
  }),
});

export const workflowNodeSchema = z.discriminatedUnion("type", [
  promptNodeSchema,
  toolNodeSchema,
  evaluatorNodeSchema,
]);

export const workflowEdgeSchema = z
  .object({
    id: z.string().min(1).max(64),
    sourceNodeId: nodeIdSchema,
    targetNodeId: nodeIdSchema,
  })
  .refine((edge) => edge.sourceNodeId !== edge.targetNodeId, {
    message: "An edge cannot connect a node to itself",
    path: ["targetNodeId"],
  });

export const workflowStateSchema = z
  .object({
    id: z.string().min(1).max(64),
    name: z.string().min(1).max(120),
    nodes: z.array(workflowNodeSchema),
    edges: z.array(workflowEdgeSchema),
    updatedAt: z.iso.datetime(),
  })
  .superRefine((state, ctx) => {
    const nodeIds = new Set(state.nodes.map((node) => node.id));

    if (nodeIds.size !== state.nodes.length) {
      ctx.addIssue({
        code: "custom",
        message: "Node ids must be unique",
        path: ["nodes"],
      });
    }

    state.edges.forEach((edge, index) => {
      for (const end of ["sourceNodeId", "targetNodeId"] as const) {
        if (!nodeIds.has(edge[end])) {
          ctx.addIssue({
            code: "custom",
            message: `Edge ${edge.id} references unknown node ${edge[end]}`,
            path: ["edges", index, end],
          });
        }
      }
    });
  });

/** Alias required by the spec. */
export const workflowSchema = workflowStateSchema;

export type WorkflowSchemaInput = z.input<typeof workflowStateSchema>;

/* ────────────────────────────────────────────────────────────────────────────
 * Factories
 * ──────────────────────────────────────────────────────────────────────────── */

export const DEFAULT_NODE_DATA = {
  prompt: { model: "gpt-4o", systemPrompt: "", temperature: 0.7 },
  tool: { toolName: "web_search", timeoutMs: 10_000 },
  evaluator: { criteria: "", passThreshold: 0.8 },
} as const satisfies { [K in WorkflowNodeType]: WorkflowNodeData<K> };

export function createNode<T extends WorkflowNodeType>(
  type: T,
  id: string,
  position: NodePosition,
  data?: Partial<WorkflowNodeData<T>>,
): Extract<WorkflowNode, { type: T }> {
  const base = { id, position };

  switch (type) {
    case "prompt":
      return {
        ...base,
        type: "prompt",
        data: { ...DEFAULT_NODE_DATA.prompt, ...data },
      } as Extract<WorkflowNode, { type: T }>;
    case "tool":
      return {
        ...base,
        type: "tool",
        data: { ...DEFAULT_NODE_DATA.tool, ...data },
      } as Extract<WorkflowNode, { type: T }>;
    case "evaluator":
      return {
        ...base,
        type: "evaluator",
        data: { ...DEFAULT_NODE_DATA.evaluator, ...data },
      } as Extract<WorkflowNode, { type: T }>;
  }
}

export function createEmptyWorkflow(
  id = "wf_untitled",
  name = "Untitled workflow",
): WorkflowState {
  return {
    id,
    name,
    nodes: [],
    edges: [],
    updatedAt: new Date().toISOString(),
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Presentation helpers
 * ──────────────────────────────────────────────────────────────────────────── */

export const NODE_TYPE_LABEL: Record<WorkflowNodeType, string> = {
  prompt: "Prompt",
  tool: "Tool",
  evaluator: "Evaluator",
};

/** Uppercase monospace tag rendered in the NodeCard header. */
export const NODE_TYPE_KIND: Record<WorkflowNodeType, string> = {
  prompt: "prompt.call",
  tool: "tool.invoke",
  evaluator: "evaluator.grade",
};

export function nodeTitle(node: WorkflowNode): string {
  switch (node.type) {
    case "prompt":
      return node.data.systemPrompt.trim().slice(0, 40) || "Untitled prompt";
    case "tool":
      return node.data.toolName;
    case "evaluator":
      return node.data.criteria.trim().slice(0, 40) || "Untitled evaluator";
  }
}

export function nodeSubtitle(node: WorkflowNode): string {
  switch (node.type) {
    case "prompt":
      return `${node.data.model} · temp ${node.data.temperature.toFixed(1)}`;
    case "tool":
      return node.data.endpoint !== undefined && node.data.endpoint !== ""
        ? node.data.endpoint
        : `${node.data.timeoutMs}ms timeout`;
    case "evaluator":
      return `pass ≥ ${node.data.passThreshold.toFixed(2)}`;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Parsing
 * ──────────────────────────────────────────────────────────────────────────── */

export type ParseResult =
  | { success: true; data: WorkflowState }
  | { success: false; error: string };

/** Parses and validates a workflow coming from disk, the network or storage. */
export function parseWorkflow(input: unknown): ParseResult {
  const result = workflowStateSchema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const [issue] = result.error.issues;
  const path = issue?.path.join(".") ?? "workflow";
  const message = issue?.message ?? "Invalid workflow";
  return { success: false, error: `${path}: ${message}` };
}

/** Parses a JSON string into a workflow. */
export function parseWorkflowJson(json: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { success: false, error: "Not valid JSON" };
  }
  return parseWorkflow(raw);
}
