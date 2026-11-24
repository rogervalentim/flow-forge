import type { WorkflowNode } from "../../types/workflow";

export const SNAPSHOT_STORAGE_KEY = "flowforge:snapshots:v1";

export interface WorkflowSnapshot {
  id: string;
  name: string;
  /** ISO-8601 timestamp. */
  createdAt: string;
  /** Prompt text per prompt-node id, in node order. */
  prompts: Record<string, string>;
  nodeCount: number;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Storage
 * ──────────────────────────────────────────────────────────────────────────── */

export function storageAvailable(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function collectPrompts(nodes: WorkflowNode[]): Record<string, string> {
  const prompts: Record<string, string> = {};
  for (const node of nodes) {
    if (node.type === "prompt") prompts[node.id] = node.data.systemPrompt;
  }
  return prompts;
}

export function loadSnapshots(): WorkflowSnapshot[] {
  const storage = storageAvailable();
  if (storage === null) return [];

  try {
    const raw = storage.getItem(SNAPSHOT_STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSnapshot);
  } catch {
    return [];
  }
}

function isSnapshot(value: unknown): value is WorkflowSnapshot {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record["id"] === "string" &&
    typeof record["name"] === "string" &&
    typeof record["createdAt"] === "string" &&
    typeof record["nodeCount"] === "number" &&
    typeof record["prompts"] === "object" &&
    record["prompts"] !== null
  );
}

export function saveSnapshots(snapshots: WorkflowSnapshot[]): void {
  const storage = storageAvailable();
  if (storage === null) return;
  try {
    storage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshots.slice(0, 20)));
  } catch {
    // Quota exceeded: snapshots are best-effort.
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Diff
 * ──────────────────────────────────────────────────────────────────────────── */

export type DiffKind = "same" | "added" | "removed";

export interface DiffLine {
  kind: DiffKind;
  text: string;
  /** Line number in the previous text (1-based), null for additions. */
  beforeLine: number | null;
  /** Line number in the next text (1-based), null for removals. */
  afterLine: number | null;
}

/**
 * Classic LCS diff over lines — small inputs (prompts), so the O(n·m) table is
 * fine and keeps the implementation dependency-free.
 */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );

  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      const row = table[i];
      const nextRow = table[i + 1];
      if (row === undefined || nextRow === undefined) continue;
      row[j] =
        a[i] === b[j]
          ? (nextRow[j + 1] ?? 0) + 1
          : Math.max(nextRow[j] ?? 0, row[j + 1] ?? 0);
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      lines.push({ kind: "same", text: a[i] ?? "", beforeLine: i + 1, afterLine: j + 1 });
      i += 1;
      j += 1;
      continue;
    }

    const down = table[i + 1]?.[j] ?? 0;
    const right = table[i]?.[j + 1] ?? 0;

    if (down >= right) {
      lines.push({ kind: "removed", text: a[i] ?? "", beforeLine: i + 1, afterLine: null });
      i += 1;
    } else {
      lines.push({ kind: "added", text: b[j] ?? "", beforeLine: null, afterLine: j + 1 });
      j += 1;
    }
  }

  while (i < a.length) {
    lines.push({ kind: "removed", text: a[i] ?? "", beforeLine: i + 1, afterLine: null });
    i += 1;
  }
  while (j < b.length) {
    lines.push({ kind: "added", text: b[j] ?? "", beforeLine: null, afterLine: j + 1 });
    j += 1;
  }

  return lines;
}

