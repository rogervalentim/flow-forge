import * as React from "react";

import { useCanvasViewport } from "../../hooks/useCanvasViewport";
import type { NodeStatus } from "../../design-system";
import type { NodePosition, WorkflowEdge, WorkflowNode } from "../../types/workflow";
import { GraphNode } from "./GraphNode";
import { bezierPath, inPort, outPort } from "./nodeLayout";

export interface CanvasBoardProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onMoveNode: (nodeId: string, position: NodePosition) => void;
  onCommitNodeMove: (nodeId: string, position: NodePosition) => void;
  onRemoveNode: (nodeId: string) => void;
  /** Live execution state per node, written by the execution console. */
  nodeStatuses?: Record<string, NodeStatus>;
  failureReason?: string | null;
  /** Exposes the viewport controls (zoom, reset) to the toolbar. */
  onViewportReady?: (viewport: CanvasViewportHandle) => void;
}

export interface CanvasViewportHandle {
  zoomPercent: number;
  zoomIn: () => void;
  zoomOut: () => void;
  resetViewport: () => void;
}

interface DragState {
  nodeId: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
  moved: boolean;
}

/**
 * CanvasBoard — the dot-grid viewport.
 *
 * Pan and zoom are handled by `useCanvasViewport` (DOM transforms, no React
 * re-render per frame). Nodes are absolutely positioned in graph space inside
 * the transformed layer; edges are one `<svg>` layer beneath them.
 */
export function CanvasBoard({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onMoveNode,
  onCommitNodeMove,
  onRemoveNode,
  nodeStatuses,
  failureReason = null,
  onViewportReady,
}: CanvasBoardProps) {
  const viewport = useCanvasViewport();
  const { layerRef, surfaceRef, zoomPercent, zoomIn, zoomOut, resetViewport } = viewport;

  const dragRef = React.useRef<DragState | null>(null);

  // Publish the controls upward without re-creating them each render.
  const readyRef = React.useRef(onViewportReady);
  React.useLayoutEffect(() => {
    readyRef.current = onViewportReady;
  }, [onViewportReady]);

  React.useEffect(() => {
    readyRef.current?.({ zoomPercent, zoomIn, zoomOut, resetViewport });
  }, [zoomPercent, zoomIn, zoomOut, resetViewport]);

  const nodeById = React.useMemo(() => {
    const map = new Map<string, WorkflowNode>();
    for (const node of nodes) map.set(node.id, node);
    return map;
  }, [nodes]);

  const degree = React.useMemo(() => {
    const counts = new Map<string, { in: number; out: number }>();
    for (const node of nodes) counts.set(node.id, { in: 0, out: 0 });
    for (const edge of edges) {
      const source = counts.get(edge.sourceNodeId);
      const target = counts.get(edge.targetNodeId);
      if (source !== undefined) source.out += 1;
      if (target !== undefined) target.in += 1;
    }
    return counts;
  }, [nodes, edges]);

  const handleDragStart = React.useCallback(
    (nodeId: string, event: React.PointerEvent<HTMLDivElement>) => {
      const node = nodeById.get(nodeId);
      if (node === undefined) return;

      dragRef.current = {
        nodeId,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        originX: node.position.x,
        originY: node.position.y,
        moved: false,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [nodeById],
  );

  const handleDrag = React.useCallback(
    (nodeId: string, event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (drag === null || drag.nodeId !== nodeId || drag.pointerId !== event.pointerId) return;

      const dx = (event.clientX - drag.startClientX) / viewport.zoom;
      const dy = (event.clientY - drag.startClientY) / viewport.zoom;
      if (!drag.moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) return;

      drag.moved = true;
      onMoveNode(nodeId, { x: drag.originX + dx, y: drag.originY + dy });
    },
    [onMoveNode, viewport.zoom],
  );

  const handleDragEnd = React.useCallback(
    (nodeId: string, event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (drag === null || drag.nodeId !== nodeId || drag.pointerId !== event.pointerId) return;

      dragRef.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);

      if (!drag.moved) return;

      const dx = (event.clientX - drag.startClientX) / viewport.zoom;
      const dy = (event.clientY - drag.startClientY) / viewport.zoom;
      onCommitNodeMove(nodeId, { x: drag.originX + dx, y: drag.originY + dy });
    },
    [onCommitNodeMove, viewport.zoom],
  );

  const handleBackgroundPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-canvas-node]") === null) onSelectNode(null);
  };

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-bg-canvas">
      <div
        ref={surfaceRef}
        data-testid="canvas-surface"
        className="absolute inset-0 cursor-grab bg-dot-grid active:cursor-grabbing"
        onPointerDown={handleBackgroundPointerDown}
      >
        <div
          ref={layerRef}
          data-testid="canvas-layer"
          className="absolute left-0 top-0 origin-top-left will-change-transform"
          style={{ width: 1, height: 1 }}
        >
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 overflow-visible"
            width={1}
            height={1}
          >
            {edges.map((edge) => {
              const source = nodeById.get(edge.sourceNodeId);
              const target = nodeById.get(edge.targetNodeId);
              if (source === undefined || target === undefined) return null;

              const active =
                selectedNodeId === source.id || selectedNodeId === target.id;

              return (
                <g key={edge.id} data-edge-id={edge.id}>
                  <path
                    d={bezierPath(outPort(source), inPort(target))}
                    fill="none"
                    stroke={active ? "#0070F3" : "rgba(255,255,255,0.16)"}
                    strokeWidth={1.5}
                  />
                </g>
              );
            })}
          </svg>

          {nodes.map((node) => {
            const counts = degree.get(node.id) ?? { in: 0, out: 0 };
            return (
              <GraphNode
                key={node.id}
                node={node}
                selected={selectedNodeId === node.id}
                status={nodeStatuses?.[node.id] ?? "idle"}
                failureReason={failureReason}
                inDegree={counts.in}
                outDegree={counts.out}
                onSelect={onSelectNode}
                onDragStart={handleDragStart}
                onDrag={handleDrag}
                onDragEnd={handleDragEnd}
                onRemove={onRemoveNode}
              />
            );
          })}
        </div>
      </div>

      {nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 rounded-md border border-border-subtle bg-bg-panel/80 px-6 py-5">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">
              empty canvas
            </span>
            <span className="text-[12px] text-text-secondary">
              Add a Prompt, Tool or Evaluator from the toolbar.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
