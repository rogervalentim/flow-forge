import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";

import {
  createNode,
  parseWorkflow,
  type NodePosition,
  type WorkflowEdge,
  type WorkflowNode,
  type WorkflowNodeData,
  type WorkflowNodeType,
  type WorkflowState,
} from "../types/workflow";
import { useUndoRedo, type UseUndoRedoOptions } from "./useUndoRedo";

export const WORKFLOW_STORAGE_KEY = "flowforge:workflow:v1";
export const PERSIST_DEBOUNCE_MS = 400;

let sequence = 0;

/** Monotonic, collision-free ids for nodes and edges. */
export function createId(prefix: string): string {
  sequence += 1;
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${sequence.toString(36)}${random}`;
}

export type ConnectResult =
  | { ok: true; edge: WorkflowEdge }
  | { ok: false; reason: "self-loop" | "duplicate" | "missing-node" | "cycle" };

export type WorkflowGraphStorage = Pick<Storage, "getItem" | "setItem">;

export interface UseWorkflowGraphOptions extends UseUndoRedoOptions {
  /** Pass `null` to disable persistence (tests, Storybook). */
  storage?: WorkflowGraphStorage | null;
  storageKey?: string;
  debounceMs?: number;
  maxHistory?: number;
}

export interface UseWorkflowGraphResult {
  workflow: WorkflowState;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  addNode: (type: WorkflowNodeType, position: NodePosition) => WorkflowNode;
  updateNodeData: <T extends WorkflowNodeType>(
    nodeId: string,
    patch: Partial<WorkflowNodeData<T>>,
  ) => void;
  /** Position update that never touches the history stack (pointer move). */
  moveNodeTransient: (nodeId: string, position: NodePosition) => void;
  /** Single history entry for a finished drag (pointer up). */
  commitNodeMove: (nodeId: string, position: NodePosition) => void;
  removeNode: (nodeId: string) => void;
  connectNodes: (sourceNodeId: string, targetNodeId: string) => ConnectResult;
  removeEdge: (edgeId: string) => void;
  renameWorkflow: (name: string) => void;
  /** Replaces the whole graph and clears history (import / reset). */
  replaceWorkflow: (workflow: WorkflowState) => void;
}

/** True when adding `source → target` would close a directed cycle. */
export function wouldCreateCycle(
  edges: readonly WorkflowEdge[],
  sourceNodeId: string,
  targetNodeId: string,
): boolean {
  if (sourceNodeId === targetNodeId) return true;

  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.sourceNodeId);
    if (list === undefined) {
      adjacency.set(edge.sourceNodeId, [edge.targetNodeId]);
    } else {
      list.push(edge.targetNodeId);
    }
  }

  // Walk forward from the target: if we can reach the source, the new edge closes a loop.
  const seen = new Set<string>();
  const stack = [targetNodeId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) continue;
    if (current === sourceNodeId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const next of adjacency.get(current) ?? []) stack.push(next);
  }

  return false;
}

function resolveStorage(storage: WorkflowGraphStorage | null | undefined): WorkflowGraphStorage | null {
  if (storage === null) return null;
  if (storage !== undefined) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Reads the persisted graph, falling back to the initial workflow when the
 * payload is missing or fails Zod validation.
 */
export function hydrateWorkflow(
  initialWorkflow: WorkflowState,
  storage: WorkflowGraphStorage | null,
  storageKey = WORKFLOW_STORAGE_KEY,
): WorkflowState {
  if (storage === null) return initialWorkflow;

  let raw: string | null;
  try {
    raw = storage.getItem(storageKey);
  } catch {
    return initialWorkflow;
  }
  if (raw === null || raw === "") return initialWorkflow;

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return initialWorkflow;
  }

  const result = parseWorkflow(parsedJson);
  return result.success ? result.data : initialWorkflow;
}

/**
 * `useWorkflowGraph` — the graph engine.
 *
 * Wraps `useUndoRedo<WorkflowState>` with domain actions, keeps pointer-driven
 * moves out of the history stack, and persists to `localStorage` with a
 * debounce so a drag never writes on every frame.
 */
export function useWorkflowGraph(
  initialWorkflow: WorkflowState,
  options: UseWorkflowGraphOptions = {},
): UseWorkflowGraphResult {
  const {
    storage: storageOption,
    storageKey = WORKFLOW_STORAGE_KEY,
    debounceMs = PERSIST_DEBOUNCE_MS,
    maxHistory = 50,
    keyboard,
    target,
  } = options;

  const storage = useMemo(() => resolveStorage(storageOption), [storageOption]);
  const hydrated = useMemo(
    () => hydrateWorkflow(initialWorkflow, storage, storageKey),
    // Hydration is intentionally evaluated once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const history = useUndoRedo<WorkflowState>(hydrated, maxHistory, {
    ...(keyboard !== undefined ? { keyboard } : {}),
    ...(target !== undefined ? { target } : {}),
  });
  const { state: workflow, set, setTransient, commit } = history;

  // Last graph recorded in history. Transient drag frames never update it, so
  // the pre-drag state can be re-recorded as the base of a single undo step.
  const committedRef = useRef(workflow);
  const transientRef = useRef(false);

  // Latest graph reachable from callbacks that must answer synchronously
  // (`connectNodes` returns a result). Kept in a ref so they stay stable.
  const workflowRef = useRef(workflow);
  useLayoutEffect(() => {
    workflowRef.current = workflow;
  }, [workflow]);


  const touch = useCallback((current: WorkflowState): WorkflowState => {
    return { ...current, updatedAt: new Date().toISOString() };
  }, []);

  /** Records `next` and remembers it as the history base. */
  const record = useCallback(
    (next: WorkflowState | ((current: WorkflowState) => WorkflowState)) => {
      if (typeof next === "function") {
        set((current) => {
          const value = next(current);
          // Skip no-op updates so they never open a history step.
          committedRef.current = value === current ? current : value;
          return committedRef.current;
        });
        return;
      }
      committedRef.current = next;
      set(next);
    },
    [set],
  );

  const addNode = useCallback(
    (type: WorkflowNodeType, position: NodePosition): WorkflowNode => {
      // Built outside the updater so the caller can select the new node.
      const id = createId(type);
      const node = createNode(type, id, position);
      record((current) => touch({ ...current, nodes: [...current.nodes, node] }));
      return node;
    },
    [record, touch],
  );

  const updateNodeData = useCallback(
    <T extends WorkflowNodeType>(nodeId: string, patch: Partial<WorkflowNodeData<T>>) => {
      record((current) => {
        const index = current.nodes.findIndex((node) => node.id === nodeId);
        if (index === -1) return current;

        const nodes = current.nodes.slice();
        const node = nodes[index];
        if (node === undefined) return current;

        nodes[index] = { ...node, data: { ...node.data, ...patch } } as WorkflowNode;
        return touch({ ...current, nodes });
      });
    },
    [record, touch],
  );

  const moveNodeTransient = useCallback(
    (nodeId: string, position: NodePosition) => {
      // High-frequency path: writes the present without touching history.
      // `commitNodeMove` records the single entry on pointer release.
      transientRef.current = true;
      setTransient((current) => {
        const index = current.nodes.findIndex((node) => node.id === nodeId);
        if (index === -1) return current;
        const nodes = current.nodes.slice();
        const node = nodes[index];
        if (node === undefined) return current;
        nodes[index] = { ...node, position };
        return { ...current, nodes };
      });
    },
    [setTransient],
  );

  const commitNodeMove = useCallback(
    (nodeId: string, position: NodePosition) => {
      // One history entry for the whole drag: the recorded "present" is the
      // pre-drag snapshot, so a single undo restores where the node started.
      const snapshot = committedRef.current;
      const index = snapshot.nodes.findIndex((node) => node.id === nodeId);
      const node = index === -1 ? undefined : snapshot.nodes[index];
      if (node === undefined) return;

      const nodes = snapshot.nodes.slice();
      nodes[index] = { ...node, position };
      const next = { ...snapshot, nodes };

      committedRef.current = next;
      transientRef.current = false;
      // Undo target is the pre-drag snapshot, whatever frames were written.
      commit(snapshot, next);
    },
    [commit],
  );

  const removeNode = useCallback(
    (nodeId: string) => {
      record((current) => {
        if (!current.nodes.some((node) => node.id === nodeId)) return current;
        return touch({
          ...current,
          nodes: current.nodes.filter((node) => node.id !== nodeId),
          // Cascade: every edge touching the removed node goes with it.
          edges: current.edges.filter(
            (edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId,
          ),
        });
      });
    },
    [record, touch],
  );

  const connectNodes = useCallback(
    (sourceNodeId: string, targetNodeId: string): ConnectResult => {
      const current = workflowRef.current;

      if (sourceNodeId === targetNodeId) {
        return { ok: false, reason: "self-loop" };
      }

      const nodeIds = new Set(current.nodes.map((node) => node.id));
      if (!nodeIds.has(sourceNodeId) || !nodeIds.has(targetNodeId)) {
        return { ok: false, reason: "missing-node" };
      }

      if (
        current.edges.some(
          (edge) => edge.sourceNodeId === sourceNodeId && edge.targetNodeId === targetNodeId,
        )
      ) {
        return { ok: false, reason: "duplicate" };
      }

      if (wouldCreateCycle(current.edges, sourceNodeId, targetNodeId)) {
        return { ok: false, reason: "cycle" };
      }

      const edge: WorkflowEdge = {
        id: createId("edge"),
        sourceNodeId,
        targetNodeId,
      };

      record((state) => touch({ ...state, edges: [...state.edges, edge] }));
      return { ok: true, edge };
    },
    [record, touch],
  );

  const removeEdge = useCallback(
    (edgeId: string) => {
      record((current) => {
        if (!current.edges.some((edge) => edge.id === edgeId)) return current;
        return touch({ ...current, edges: current.edges.filter((edge) => edge.id !== edgeId) });
      });
    },
    [record, touch],
  );

  const renameWorkflow = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (trimmed === "" || trimmed === workflow.name) return;
      record((current) => touch({ ...current, name: trimmed }));
    },
    [record, touch, workflow.name],
  );

  const replaceWorkflow = useCallback(
    (next: WorkflowState) => {
      history.reset(touch(next));
    },
    [history, touch],
  );

  // Debounced persistence.
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (storage === null) return;

    if (persistTimer.current !== null) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      persistTimer.current = null;
      try {
        storage.setItem(storageKey, JSON.stringify(workflow));
      } catch {
        // Quota or private mode: persistence is best-effort.
      }
    }, debounceMs);

    return () => {
      if (persistTimer.current !== null) clearTimeout(persistTimer.current);
    };
  }, [workflow, storage, storageKey, debounceMs]);

  return {
    workflow,
    nodes: workflow.nodes,
    edges: workflow.edges,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    undo: history.undo,
    redo: history.redo,
    addNode,
    updateNodeData,
    moveNodeTransient,
    commitNodeMove,
    removeNode,
    connectNodes,
    removeEdge,
    renameWorkflow,
    replaceWorkflow,
  };
}
