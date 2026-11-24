import * as React from "react";
import { History } from "lucide-react";

import { Badge, Button, Input, Modal } from "../../design-system";
import type { WorkflowNode } from "../../types/workflow";
import {
  collectPrompts,
  diffLines,
  loadSnapshots,
  saveSnapshots,
  type DiffKind,
  type WorkflowSnapshot,
} from "./snapshotStore";

const LINE_STYLE: Record<DiffKind, string> = {
  same: "text-text-muted",
  added: "bg-[rgba(16,185,129,0.08)] text-status-success",
  removed: "bg-[rgba(239,68,68,0.08)] text-status-error",
};

const LINE_MARK: Record<DiffKind, string> = { same: " ", added: "+", removed: "−" };

/* ────────────────────────────────────────────────────────────────────────────
 * Modal
 * ──────────────────────────────────────────────────────────────────────────── */

export interface SnapshotDiffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: WorkflowNode[];
}

/**
 * SnapshotDiffModal — named snapshots in `localStorage` and a line-by-line
 * monospace diff of the prompt text between any two versions.
 */
export function SnapshotDiffModal({ open, onOpenChange, nodes }: SnapshotDiffModalProps) {
  const [snapshots, setSnapshots] = React.useState<WorkflowSnapshot[]>(() => loadSnapshots());
  const [name, setName] = React.useState("");
  const [beforeId, setBeforeId] = React.useState<string>("");
  const [afterId, setAfterId] = React.useState<string>("current");

  const currentPrompts = React.useMemo(() => collectPrompts(nodes), [nodes]);

  const persist = (next: WorkflowSnapshot[]) => {
    setSnapshots(next);
    saveSnapshots(next);
  };

  const saveCurrent = () => {
    const trimmed = name.trim();
    if (trimmed === "") return;

    const snapshot: WorkflowSnapshot = {
      id: `snap_${Date.now().toString(36)}`,
      name: trimmed,
      createdAt: new Date().toISOString(),
      prompts: currentPrompts,
      nodeCount: nodes.length,
    };

    persist([snapshot, ...snapshots]);
    setName("");
    if (afterId === "current") setBeforeId(snapshot.id);
  };

  const removeSnapshot = (id: string) => {
    persist(snapshots.filter((snapshot) => snapshot.id !== id));
    if (beforeId === id) setBeforeId("");
    if (afterId === id) setAfterId("current");
  };

  const beforeText = React.useMemo(() => {
    if (beforeId === "") return "";
    const snapshot = snapshots.find((candidate) => candidate.id === beforeId);
    return snapshot === undefined ? "" : promptsToText(snapshot.prompts);
  }, [beforeId, snapshots]);

  const afterText = React.useMemo(() => {
    if (afterId === "current") return promptsToText(currentPrompts);
    const snapshot = snapshots.find((candidate) => candidate.id === afterId);
    return snapshot === undefined ? "" : promptsToText(snapshot.prompts);
  }, [afterId, snapshots, currentPrompts]);

  const diff = React.useMemo(() => diffLines(beforeText, afterText), [beforeText, afterText]);
  const changed = diff.filter((line) => line.kind !== "same").length;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Prompt snapshots"
      description="Save named versions and diff prompt text line by line. Snapshots live in localStorage."
      footer={
        <>
          <Badge tone={changed === 0 ? "neutral" : "accent"} mono>
            {changed} changed lines
          </Badge>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <Input
            label="Snapshot name"
            placeholder="v1 — tighter criteria"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") saveCurrent();
            }}
          />
          <Button
            variant="primary"
            leadingIcon={<History size={14} strokeWidth={1.5} />}
            onClick={saveCurrent}
            disabled={name.trim() === ""}
          >
            Save current
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] text-text-secondary">Compare from</span>
            <select
              aria-label="Compare from"
              value={beforeId}
              onChange={(event) => setBeforeId(event.target.value)}
              className="h-8 rounded-md border border-border-subtle bg-bg-canvas px-2 font-mono text-[11px] text-text-primary outline-none focus:border-accent-primary"
            >
              <option value="" className="bg-bg-elevated">
                — select a snapshot —
              </option>
              {snapshots.map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id} className="bg-bg-elevated">
                  {snapshot.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] text-text-secondary">Compare to</span>
            <select
              aria-label="Compare to"
              value={afterId}
              onChange={(event) => setAfterId(event.target.value)}
              className="h-8 rounded-md border border-border-subtle bg-bg-canvas px-2 font-mono text-[11px] text-text-primary outline-none focus:border-accent-primary"
            >
              <option value="current" className="bg-bg-elevated">
                current canvas
              </option>
              {snapshots.map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id} className="bg-bg-elevated">
                  {snapshot.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div
          data-testid="snapshot-diff"
          className="max-h-[220px] overflow-auto rounded-sm border border-border-subtle bg-bg-canvas py-1 font-mono text-[10px] leading-relaxed"
        >
          {beforeId === "" ? (
            <p className="px-2 py-1 text-text-muted">Select a snapshot to see the diff.</p>
          ) : (
            diff.map((line, index) => (
              <div
                key={`${line.kind}-${index}`}
                data-kind={line.kind}
                className={`flex gap-2 px-2 ${LINE_STYLE[line.kind]}`}
              >
                <span className="w-8 shrink-0 select-none text-right opacity-60">
                  {line.beforeLine ?? ""}
                </span>
                <span className="w-8 shrink-0 select-none text-right opacity-60">
                  {line.afterLine ?? ""}
                </span>
                <span className="w-2 shrink-0 select-none">{LINE_MARK[line.kind]}</span>
                <span className="whitespace-pre-wrap break-words">{line.text}</span>
              </div>
            ))
          )}
        </div>

        {snapshots.length > 0 && (
          <ul className="flex flex-col gap-1">
            {snapshots.map((snapshot) => (
              <li
                key={snapshot.id}
                className="flex items-center gap-2 rounded-sm border border-border-subtle bg-bg-canvas px-2 py-1"
              >
                <span className="truncate font-mono text-[10px] text-text-primary">
                  {snapshot.name}
                </span>
                <span className="font-mono text-[10px] tnum text-text-muted">
                  {snapshot.nodeCount} nodes · {new Date(snapshot.createdAt).toLocaleString("pt-BR")}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  aria-label={`Delete snapshot ${snapshot.name}`}
                  onClick={() => removeSnapshot(snapshot.id)}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function promptsToText(prompts: Record<string, string>): string {
  return Object.entries(prompts)
    .map(([nodeId, prompt]) => `# ${nodeId}\n${prompt}`)
    .join("\n");
}
