import { Play, Square, Trash2 } from "lucide-react";

import { Badge, Button } from "../../design-system";
import { useStreamResponse, type StreamMetrics, type StreamStatus } from "../../hooks/useStreamResponse";
import type { WorkflowEdge, WorkflowNode } from "../../types/workflow";

import { NETWORK_MODES, type NetworkMode } from "./networkModes";

export interface ExecutionConsoleProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  networkMode: NetworkMode;
  onNetworkModeChange: (mode: NetworkMode) => void;
  /** Active node during a run — drives `status="running"` on the canvas. */
  activeNodeId: string | null;
  onActiveNodeChange: (nodeId: string | null) => void;
  /** Terminal outcome per node for the current run. */
  nodeOutcomes: Record<string, "success" | "error">;
  onNodeOutcome: (nodeId: string, outcome: "success" | "error") => void;
  onRunStart: () => void;
  onRunEnd: () => void;
}

function statusTone(status: StreamStatus): "neutral" | "accent" | "success" | "warning" | "error" {
  switch (status) {
    case "connecting":
      return "warning";
    case "streaming":
      return "accent";
    case "completed":
      return "success";
    case "aborted":
      return "warning";
    case "error":
      return "error";
    case "idle":
      return "neutral";
  }
}

function TelemetryBar({
  metrics,
  httpStatus,
  status,
}: {
  metrics: StreamMetrics;
  httpStatus: number | null;
  status: StreamStatus;
}) {
  const http =
    httpStatus === null
      ? { label: "— —", tone: "neutral" as const }
      : httpStatus === 200
        ? { label: "200 OK", tone: "success" as const }
        : httpStatus === 429
          ? { label: "429 RATE LIMIT", tone: "error" as const }
          : { label: String(httpStatus), tone: "warning" as const };

  return (
    <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] tnum">
      <span className="flex items-baseline gap-1.5">
        <span className="uppercase tracking-[0.08em] text-text-muted">ttft</span>
        <span className="text-text-primary">
          {metrics.ttftMs === null ? "—" : `${Math.round(metrics.ttftMs)}ms`}
        </span>
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="uppercase tracking-[0.08em] text-text-muted">tok/s</span>
        <span className="text-text-primary">{metrics.tokensPerSecond.toFixed(1)}</span>
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="uppercase tracking-[0.08em] text-text-muted">tokens</span>
        <span className="text-text-primary">{metrics.tokenCount}</span>
      </span>
      <Badge tone={http.tone} mono dot>
        {http.label}
      </Badge>
      <Badge tone={statusTone(status)} mono>
        {status}
      </Badge>
    </div>
  );
}

/**
 * ExecutionConsole — the streaming terminal.
 *
 * Owns the SSE hook and maps `node_start` / `node_complete` frames back to the
 * canvas, so the executing `NodeCard` flips to `running` and then to `success`
 * (or `error` on a failed request).
 */
export function ExecutionConsole({
  nodes,
  edges,
  open,
  onOpenChange,
  networkMode,
  onNetworkModeChange,
  activeNodeId,
  onActiveNodeChange,
  nodeOutcomes,
  onNodeOutcome,
  onRunStart,
  onRunEnd,
}: ExecutionConsoleProps) {
  const stream = useStreamResponse();
  const isRunning = stream.status === "connecting" || stream.status === "streaming";

  const handleRun = () => {
    onRunStart();

    void stream.executeStream({
      body: { nodes, edges },
      headers: { "x-mock-scenario": networkMode },
      onEvent: (event) => {
        if (event.event === "node_start") {
          const payload = safeParse(event.data);
          const nodeId = typeof payload?.["nodeId"] === "string" ? payload["nodeId"] : null;
          onActiveNodeChange(nodeId);
          return;
        }

        if (event.event === "node_complete") {
          const payload = safeParse(event.data);
          const nodeId = typeof payload?.["nodeId"] === "string" ? payload["nodeId"] : null;
          if (nodeId !== null) onNodeOutcome(nodeId, "success");
          onActiveNodeChange(null);
        }
      },
      onSettled: () => {
        onActiveNodeChange(null);
        onRunEnd();
      },
    });
  };

  const handleStop = () => {
    stream.abort();
  };

  return (
    <section
      aria-label="Execution console"
      className="flex shrink-0 flex-col border-t border-border-subtle bg-bg-panel"
    >
      <div className="flex h-10 items-center gap-2 px-3">
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-muted">
          execution console
        </span>

        <div className="ml-2 flex items-center gap-1">
          <Button
            size="sm"
            variant="primary"
            leadingIcon={<Play size={12} strokeWidth={1.5} />}
            onClick={handleRun}
            disabled={isRunning || nodes.length === 0}
          >
            Run Workflow
          </Button>
          <Button
            size="sm"
            variant="danger"
            leadingIcon={<Square size={12} strokeWidth={1.5} />}
            onClick={handleStop}
            disabled={!isRunning}
          >
            Stop
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Clear console"
            leadingIcon={<Trash2 size={12} strokeWidth={1.5} />}
            onClick={stream.reset}
            disabled={isRunning || stream.content === ""}
          />
        </div>

        <label className="ml-2 flex items-center gap-1.5 font-mono text-[10px] text-text-muted">
          <span className="uppercase tracking-[0.08em]">network</span>
          <select
            aria-label="Network mode"
            value={networkMode}
            onChange={(event) => onNetworkModeChange(event.target.value as NetworkMode)}
            className="h-7 appearance-none rounded-md border border-border-subtle bg-bg-canvas px-1.5 font-mono text-[10px] text-text-primary outline-none hover:border-border-strong focus:border-accent-primary"
          >
            {NETWORK_MODES.map((mode) => (
              <option key={mode.value} value={mode.value} className="bg-bg-elevated">
                {mode.label}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto flex items-center gap-3">
          <TelemetryBar metrics={stream.metrics} httpStatus={stream.httpStatus} status={stream.status} />
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={open}
            onClick={() => onOpenChange(!open)}
          >
            {open ? "Collapse" : "Expand"}
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border-subtle">
          <div
            data-testid="console-output"
            className="h-[168px] overflow-auto whitespace-pre-wrap px-3 py-2 font-mono text-[11px] leading-relaxed text-text-secondary"
          >
            {stream.error !== null ? (
              <span role="alert" className="text-status-error">
                {stream.error}
              </span>
            ) : stream.content === "" ? (
              <span className="text-text-muted">
                {isRunning ? "waiting for first token…" : "Run the workflow to stream execution."}
              </span>
            ) : (
              <span data-testid="console-content" className="text-text-primary">
                {stream.content}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 border-t border-border-subtle px-3 py-1.5 font-mono text-[10px] tnum text-text-muted">
            <span className="uppercase tracking-[0.08em]">nodes</span>
            <span className="text-text-primary">{nodes.length}</span>
            <span className="uppercase tracking-[0.08em]">edges</span>
            <span className="text-text-primary">{edges.length}</span>
            <span className="uppercase tracking-[0.08em]">active</span>
            <span className={activeNodeId !== null ? "text-accent-primary" : "text-text-primary"}>
              {activeNodeId ?? "none"}
            </span>
            <span className="uppercase tracking-[0.08em]">outcomes</span>
            <span className="text-text-primary">
              {Object.keys(nodeOutcomes).length}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

function safeParse(data: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(data);
    return parsed !== null && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
