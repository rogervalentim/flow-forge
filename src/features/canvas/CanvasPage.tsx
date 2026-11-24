import * as React from "react";
import { Activity, Command, Layers, Link2, Trash2 } from "lucide-react";

import { Badge, Button } from "../../design-system";
import { CanvasBoard, type CanvasViewportHandle } from "./CanvasBoard";
import { CanvasToolbar } from "./CanvasToolbar";
import { NodeInspector } from "./NodeInspector";
import { shortId } from "./nodeLayout";
import { createSeedWorkflow } from "./seedWorkflow";
import { useWorkflowGraph } from "../../hooks/useWorkflowGraph";
import {
  nodeTitle,
  parseWorkflowJson,
  type NodePosition,
  type WorkflowEdge,
  type WorkflowNodeType,
} from "../../types/workflow";

export interface CanvasPageProps {
  /** Passed through to the graph engine; `null` disables persistence. */
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
}

/**
 * CanvasPage — Phase 2 shell: toolbar, node-graph board and inspector wired to
 * `useWorkflowGraph` (undo/redo, validation, localStorage persistence).
 */
export function CanvasPage({ storage }: CanvasPageProps) {
  const initialWorkflow = React.useMemo(() => createSeedWorkflow(), []);
  const graph = useWorkflowGraph(
    initialWorkflow,
    storage === undefined ? {} : { storage },
  );

  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [viewport, setViewport] = React.useState<CanvasViewportHandle>({
    zoomPercent: 100,
    zoomIn: () => undefined,
    zoomOut: () => undefined,
    resetViewport: () => undefined,
  });
  const [connectMode, setConnectMode] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const selectedNode = React.useMemo(
    () => graph.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [graph.nodes, selectedNodeId],
  );

  const handleViewportReady = React.useCallback((handle: CanvasViewportHandle) => {
    setViewport(handle);
  }, []);

  const handleAddNode = (type: WorkflowNodeType) => {
    // Cascade new nodes to the right of the current selection, otherwise in a
    // tidy column so the graph never stacks cards on top of each other.
    const anchor = graph.nodes[graph.nodes.length - 1];
    const position: NodePosition =
      anchor === undefined
        ? { x: 120, y: 96 }
        : { x: anchor.position.x, y: anchor.position.y + 132 };

    const node = graph.addNode(type, position);
    setSelectedNodeId(node.id);
  };

  const handleUpdateNodeData = (nodeId: string, patch: Record<string, unknown>) => {
    graph.updateNodeData(nodeId, patch);
  };

  const handleRemoveNode = (nodeId: string) => {
    graph.removeNode(nodeId);
    setSelectedNodeId((current) => (current === nodeId ? null : current));
    setConnectMode((current) => (current === nodeId ? null : current));
  };

  const handleImport = (json: string): { ok: boolean; error?: string } => {
    const parsed = parseWorkflowJson(json);
    if (!parsed.success) return { ok: false, error: parsed.error };
    graph.replaceWorkflow(parsed.data);
    setSelectedNodeId(null);
    setNotice(`Imported ${parsed.data.nodes.length} nodes`);
    return { ok: true };
  };

  const startConnect = () => {
    if (selectedNodeId === null) return;
    setConnectMode(selectedNodeId);
  };

  const completeConnect = (targetNodeId: string) => {
    if (connectMode === null) return;

    const result = graph.connectNodes(connectMode, targetNodeId);
    if (!result.ok) {
      const messages: Record<typeof result.reason, string> = {
        "self-loop": "A node cannot connect to itself",
        duplicate: "These nodes are already connected",
        "missing-node": "Node no longer exists",
        cycle: "That edge would create a cycle",
      };
      setNotice(messages[result.reason]);
      setConnectMode(null);
      return;
    }

    setNotice(`Connected ${shortId(connectMode)} → ${shortId(targetNodeId)}`);
    setConnectMode(null);
  };

  const lastEdge: WorkflowEdge | undefined = graph.edges[graph.edges.length - 1];

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg-canvas text-text-primary">
      <CanvasToolbar
        workflow={graph.workflow}
        nodeCount={graph.nodes.length}
        edgeCount={graph.edges.length}
        canUndo={graph.canUndo}
        canRedo={graph.canRedo}
        zoomPercent={viewport.zoomPercent}
        onUndo={graph.undo}
        onRedo={graph.redo}
        onAddNode={handleAddNode}
        onZoomIn={viewport.zoomIn}
        onZoomOut={viewport.zoomOut}
        onResetViewport={viewport.resetViewport}
        onRename={graph.renameWorkflow}
        onImport={handleImport}
      />

      <div className="flex min-h-0 flex-1">
        <div className="relative flex min-w-0 flex-1 flex-col">
          <CanvasBoard
            nodes={graph.nodes}
            edges={graph.edges}
            selectedNodeId={selectedNodeId}
            onSelectNode={(nodeId) => {
              if (connectMode !== null && nodeId !== null && nodeId !== connectMode) {
                completeConnect(nodeId);
                return;
              }
              setSelectedNodeId(nodeId);
            }}
            onMoveNode={graph.moveNodeTransient}
            onCommitNodeMove={graph.commitNodeMove}
            onRemoveNode={handleRemoveNode}
            onViewportReady={handleViewportReady}
          />

          {/* Floating connect affordance — appears with a selection. */}
          {selectedNode !== null && (
            <div className="pointer-events-auto absolute bottom-3 left-3 flex items-center gap-2 rounded-md border border-border-subtle bg-bg-panel px-2 py-1.5">
              <Badge tone={connectMode !== null ? "accent" : "neutral"} mono dot>
                {connectMode !== null ? "pick target" : "selected"}
              </Badge>
              <span className="max-w-[180px] truncate font-mono text-[10px] text-text-secondary">
                {nodeTitle(selectedNode)}
              </span>
              <Button
                size="sm"
                variant={connectMode !== null ? "ghost" : "secondary"}
                leadingIcon={<Link2 size={12} strokeWidth={1.5} />}
                onClick={() => {
                  if (connectMode !== null) {
                    setConnectMode(null);
                    return;
                  }
                  startConnect();
                }}
              >
                {connectMode !== null ? "Cancel" : "Connect"}
              </Button>
              {lastEdge !== undefined && connectMode === null && (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Remove last edge"
                  leadingIcon={<Trash2 size={12} strokeWidth={1.5} />}
                  onClick={() => graph.removeEdge(lastEdge.id)}
                />
              )}
            </div>
          )}

          {notice !== null && (
            <div
              role="status"
              className="absolute bottom-3 right-3 flex items-center gap-2 rounded-md border border-border-subtle bg-bg-panel px-2 py-1.5"
            >
              <span className="font-mono text-[10px] text-text-secondary">{notice}</span>
              <Button size="sm" variant="ghost" onClick={() => setNotice(null)}>
                Dismiss
              </Button>
            </div>
          )}
        </div>

        <NodeInspector
          node={selectedNode}
          onChange={handleUpdateNodeData}
          onRemove={handleRemoveNode}
        />
      </div>

      <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-border-subtle bg-bg-panel px-3 font-mono text-[10px] tnum text-text-muted">
        <span className="flex items-center gap-1.5">
          <Layers size={10} strokeWidth={1.5} />
          <span className="uppercase tracking-[0.08em]">nodes</span>
          <span className="text-text-primary">{graph.nodes.length}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Link2 size={10} strokeWidth={1.5} />
          <span className="uppercase tracking-[0.08em]">edges</span>
          <span className="text-text-primary">{graph.edges.length}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Activity size={10} strokeWidth={1.5} />
          <span className="uppercase tracking-[0.08em]">history</span>
          <span className={graph.canUndo ? "text-status-success" : "text-text-muted"}>
            {graph.canUndo ? "undo ready" : "clean"}
          </span>
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <Command size={10} strokeWidth={1.5} />
          <span>phase 2 · graph engine</span>
        </span>
      </footer>
    </div>
  );
}

