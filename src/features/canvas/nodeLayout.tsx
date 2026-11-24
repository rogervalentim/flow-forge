import { Bot, CheckSquare, Wrench } from "lucide-react";

import type { WorkflowNode, WorkflowNodeType } from "../../types/workflow";

export const NODE_WIDTH = 248;
export const NODE_HEIGHT = 88;

export const NODE_ICON = {
  prompt: <Bot size={12} strokeWidth={1.5} />,
  tool: <Wrench size={12} strokeWidth={1.5} />,
  evaluator: <CheckSquare size={12} strokeWidth={1.5} />,
} as const satisfies Record<WorkflowNodeType, React.ReactNode>;

export const NODE_KIND: Record<WorkflowNodeType, string> = {
  prompt: "prompt.call",
  tool: "tool.invoke",
  evaluator: "evaluator.grade",
};

export interface Point {
  x: number;
  y: number;
}

/** Centre of the right-hand output port, in graph coordinates. */
export function outPort(node: WorkflowNode): Point {
  return { x: node.position.x + NODE_WIDTH, y: node.position.y + NODE_HEIGHT / 2 };
}

/** Centre of the left-hand input port, in graph coordinates. */
export function inPort(node: WorkflowNode): Point {
  return { x: node.position.x, y: node.position.y + NODE_HEIGHT / 2 };
}

/**
 * Smooth cubic Bezier between two ports: control points push horizontally so
 * edges leave and enter perpendicular to the card — no diagonal shortcuts.
 */
export function bezierPath(from: Point, to: Point): string {
  const distance = Math.abs(to.x - from.x);
  const curve = Math.max(32, Math.min(160, distance * 0.5));
  return [
    `M ${from.x} ${from.y}`,
    `C ${from.x + curve} ${from.y},`,
    `${to.x - curve} ${to.y},`,
    `${to.x} ${to.y}`,
  ].join(" ");
}

/** Short id for status lines. */
export function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 10)}…` : id;
}
