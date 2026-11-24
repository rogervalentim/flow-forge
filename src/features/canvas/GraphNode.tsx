import * as React from "react";

import { NodeCard, type NodeStatus } from "../../design-system";
import type { WorkflowNode } from "../../types/workflow";
import { nodeSubtitle, nodeTitle } from "../../types/workflow";
import { NODE_ICON, NODE_KIND, NODE_WIDTH } from "./nodeLayout";

export interface GraphNodeProps {
  node: WorkflowNode;
  selected: boolean;
  status?: NodeStatus;
  /** Degree counts rendered as telemetry in the card footer. */
  inDegree: number;
  outDegree: number;
  onSelect: (nodeId: string) => void;
  onDragStart: (nodeId: string, event: React.PointerEvent<HTMLDivElement>) => void;
  onDrag: (nodeId: string, event: React.PointerEvent<HTMLDivElement>) => void;
  onDragEnd: (nodeId: string, event: React.PointerEvent<HTMLDivElement>) => void;
  onRemove: (nodeId: string) => void;
}

/**
 * GraphNode — a positioned `NodeCard` with drag affordances.
 *
 * Absolute placement comes from the graph state; the visual language is
 * entirely the Phase 1 `NodeCard` (no local styling overrides beyond layout).
 */
export const GraphNode = React.memo(function GraphNode({
  node,
  selected,
  status = "idle",
  inDegree,
  outDegree,
  onSelect,
  onDragStart,
  onDrag,
  onDragEnd,
  onRemove,
}: GraphNodeProps) {
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    onSelect(node.id);
    onDragStart(node.id, event);
  };

  return (
    <div
      data-canvas-node=""
      data-node-id={node.id}
      data-node-type={node.type}
      style={{ left: node.position.x, top: node.position.y, width: NODE_WIDTH }}
      className="absolute select-none touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={(event) => onDrag(node.id, event)}
      onPointerUp={(event) => onDragEnd(node.id, event)}
      onPointerCancel={(event) => onDragEnd(node.id, event)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(node.id);
        }
        if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          onRemove(node.id);
        }
      }}
      role="group"
      aria-label={`${node.type} node ${nodeTitle(node)}`}
      tabIndex={0}
    >
      <NodeCard
        kind={NODE_KIND[node.type]}
        title={nodeTitle(node)}
        subtitle={nodeSubtitle(node)}
        status={status}
        icon={NODE_ICON[node.type]}
        selected={selected}
        metrics={[
          { label: "in", value: String(inDegree) },
          { label: "out", value: String(outDegree) },
        ]}
      />
    </div>
  );
});
