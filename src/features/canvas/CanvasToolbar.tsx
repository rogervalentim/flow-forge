import * as React from "react";
import {
  Bot,
  CheckSquare,
  Download,
  Minus,
  Plus,
  Redo2,
  RotateCcw,
  Undo2,
  Wrench,
} from "lucide-react";

import { Badge, Button, Modal } from "../../design-system";
import type { WorkflowNodeType, WorkflowState } from "../../types/workflow";

export interface CanvasToolbarProps {
  workflow: WorkflowState;
  nodeCount: number;
  edgeCount: number;
  canUndo: boolean;
  canRedo: boolean;
  zoomPercent: number;
  onUndo: () => void;
  onRedo: () => void;
  onAddNode: (type: WorkflowNodeType) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetViewport: () => void;
  onRename: (name: string) => void;
  onImport: (json: string) => { ok: boolean; error?: string };
}

const CREATE_ACTIONS: { type: WorkflowNodeType; label: string; icon: React.ReactNode }[] = [
  { type: "prompt", label: "+ Prompt", icon: <Bot size={12} strokeWidth={1.5} /> },
  { type: "tool", label: "+ Tool", icon: <Wrench size={12} strokeWidth={1.5} /> },
  { type: "evaluator", label: "+ Evaluator", icon: <CheckSquare size={12} strokeWidth={1.5} /> },
];

const IS_MAC =
  typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.userAgent);
const MOD = IS_MAC ? "⌘" : "Ctrl";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-sm border border-border-subtle bg-bg-canvas px-1 font-mono text-[9px] leading-4 text-text-muted">
      {children}
    </kbd>
  );
}

/**
 * CanvasToolbar — workflow title, node creation, history, zoom and export.
 *
 * Undo/Redo reflect `canUndo`/`canRedo` live and carry `<kbd>` hints that match
 * the shortcuts registered by `useUndoRedo`.
 */
export function CanvasToolbar({
  workflow,
  nodeCount,
  edgeCount,
  canUndo,
  canRedo,
  zoomPercent,
  onUndo,
  onRedo,
  onAddNode,
  onZoomIn,
  onZoomOut,
  onResetViewport,
  onRename,
  onImport,
}: CanvasToolbarProps) {
  const [title, setTitle] = React.useState(workflow.name);
  const [trackedName, setTrackedName] = React.useState(workflow.name);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [importValue, setImportValue] = React.useState("");
  const [importError, setImportError] = React.useState<string | null>(null);

  if (trackedName !== workflow.name) {
    setTrackedName(workflow.name);
    setTitle(workflow.name);
  }

  const json = React.useMemo(() => JSON.stringify(workflow, null, 2), [workflow]);

  const commitTitle = () => {
    if (title.trim() === "") {
      setTitle(workflow.name);
      return;
    }
    onRename(title);
  };

  const submitImport = () => {
    const result = onImport(importValue);
    if (!result.ok) {
      setImportError(result.error ?? "Invalid workflow");
      return;
    }
    setImportError(null);
    setImportValue("");
    setImportOpen(false);
  };

  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border-subtle bg-bg-panel px-3">
      <div className="flex min-w-0 items-center gap-2">
        <input
          aria-label="Workflow name"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={commitTitle}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          className="min-w-0 max-w-[220px] truncate rounded-sm border border-transparent bg-transparent px-1 py-0.5 text-[12px] font-semibold tracking-[-0.01em] text-text-primary outline-none transition-colors hover:border-border-subtle focus:border-accent-primary"
        />
        <Badge tone="neutral" mono outlined>
          {nodeCount} nodes · {edgeCount} edges
        </Badge>
      </div>

      <span className="h-4 w-px bg-border-subtle" />

      <div className="flex items-center gap-1">
        {CREATE_ACTIONS.map((action) => (
          <Button
            key={action.type}
            size="sm"
            variant="secondary"
            leadingIcon={action.icon}
            onClick={() => onAddNode(action.type)}
          >
            {action.label}
          </Button>
        ))}
      </div>

      <span className="h-4 w-px bg-border-subtle" />

      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          aria-label="Undo"
          disabled={!canUndo}
          onClick={onUndo}
          leadingIcon={<Undo2 size={14} strokeWidth={1.5} />}
          title={`Undo (${MOD}+Z)`}
        />
        <Button
          size="sm"
          variant="ghost"
          aria-label="Redo"
          disabled={!canRedo}
          onClick={onRedo}
          leadingIcon={<Redo2 size={14} strokeWidth={1.5} />}
          title={`Redo (${MOD}+Shift+Z)`}
        />
        <span className="hidden items-center gap-1 md:flex">
          <Kbd>{MOD}</Kbd>
          <Kbd>Z</Kbd>
          <span className="ml-1 text-[10px] text-text-muted">undo</span>
          <Kbd>{MOD}</Kbd>
          <Kbd>⇧Z</Kbd>
          <span className="ml-1 text-[10px] text-text-muted">redo</span>
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <div className="flex items-center gap-0.5 rounded-md border border-border-subtle bg-bg-canvas px-1 py-0.5">
          <Button
            size="sm"
            variant="ghost"
            aria-label="Zoom out"
            onClick={onZoomOut}
            leadingIcon={<Minus size={12} strokeWidth={1.5} />}
          />
          <span className="w-10 text-center font-mono text-[10px] tnum text-text-secondary">
            {zoomPercent}%
          </span>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Zoom in"
            onClick={onZoomIn}
            leadingIcon={<Plus size={12} strokeWidth={1.5} />}
          />
          <Button
            size="sm"
            variant="ghost"
            aria-label="Reset viewport"
            onClick={onResetViewport}
            leadingIcon={<RotateCcw size={12} strokeWidth={1.5} />}
          />
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => setImportOpen(true)}
          leadingIcon={<Download size={14} strokeWidth={1.5} className="rotate-180" />}
        >
          Import
        </Button>

        <Button
          size="sm"
          variant="primary"
          onClick={() => setExportOpen(true)}
          leadingIcon={<Download size={14} strokeWidth={1.5} />}
        >
          Export JSON
        </Button>
      </div>

      <Modal
        open={exportOpen}
        onOpenChange={setExportOpen}
        size="lg"
        title="Export workflow"
        description="Validated snapshot of the current graph. Paste it into a run configuration or commit it as a fixture."
        footer={
          <>
            <Button variant="ghost" onClick={() => setExportOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                void navigator.clipboard?.writeText(json);
              }}
            >
              Copy JSON
            </Button>
          </>
        }
      >
        <pre className="max-h-[320px] overflow-auto rounded-sm border border-border-subtle bg-bg-canvas p-2 font-mono text-[10px] leading-relaxed text-text-secondary">
          {json}
        </pre>
      </Modal>

      <Modal
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open);
          if (!open) setImportError(null);
        }}
        size="lg"
        title="Import workflow"
        description="Paste a workflow JSON. It is validated with Zod before replacing the current graph."
        footer={
          <>
            <Button variant="ghost" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitImport} disabled={importValue.trim() === ""}>
              Import
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <textarea
            aria-label="Workflow JSON"
            value={importValue}
            onChange={(event) => {
              setImportValue(event.target.value);
              setImportError(null);
            }}
            rows={8}
            placeholder='{ "id": "wf_…", "nodes": [], "edges": [] }'
            className="w-full resize-y rounded-md border border-border-subtle bg-bg-canvas px-2 py-1.5 font-mono text-[11px] leading-relaxed text-text-primary outline-none placeholder:text-text-muted focus:border-accent-primary"
          />
          {importError !== null && (
            <p role="alert" className="font-mono text-[10px] text-status-error">
              {importError}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
