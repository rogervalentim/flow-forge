import {
  createEmptyWorkflow,
  createNode,
  type NodePosition,
  type WorkflowState,
} from "../../types/workflow";

const SEED_IDS = {
  prompt: "node_prompt_seed",
  tool: "node_tool_seed",
  evaluator: "node_evaluator_seed",
} as const;

const SEED_POSITIONS: Record<keyof typeof SEED_IDS, NodePosition> = {
  prompt: { x: 120, y: 96 },
  tool: { x: 470, y: 96 },
  evaluator: { x: 820, y: 96 },
};

/** A small, valid graph so the canvas is not empty on first load. */
export function createSeedWorkflow(): WorkflowState {
  return {
    ...createEmptyWorkflow("wf_support-triage", "Support triage"),
    nodes: [
      createNode("prompt", SEED_IDS.prompt, SEED_POSITIONS.prompt, {
        model: "gpt-4o",
        systemPrompt: "Classify the incoming ticket and extract the requested action.",
        temperature: 0.2,
      }),
      createNode("tool", SEED_IDS.tool, SEED_POSITIONS.tool, {
        toolName: "web_search",
        timeoutMs: 8000,
      }),
      createNode("evaluator", SEED_IDS.evaluator, SEED_POSITIONS.evaluator, {
        criteria: "Answer cites at least one source and stays under 120 words.",
        passThreshold: 0.8,
      }),
    ],
    edges: [
      { id: "edge_seed_1", sourceNodeId: SEED_IDS.prompt, targetNodeId: SEED_IDS.tool },
      { id: "edge_seed_2", sourceNodeId: SEED_IDS.tool, targetNodeId: SEED_IDS.evaluator },
    ],
  };
}

