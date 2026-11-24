# SPEC.md — FlowForge UI (Phase 2: Graph Engine, Advanced Hooks & Canvas)

## 1. Objective (Phase 2)

Build the interactive node-graph canvas, strict domain typing, and custom high-performance React hooks (`useUndoRedo`, `useCanvasViewport`, `useWorkflowGraph`) on top of the Phase 1 Design System (`src/design-system`).

---

## 2. Domain Types & Validation (`src/types/workflow.ts`)

- Define strict TypeScript **Discriminated Unions** for nodes:
  - `PromptNode`: `{ type: 'prompt'; data: { model: 'gpt-4o' | 'claude-3-7-sonnet' | 'gemini-2.5-pro'; systemPrompt: string; temperature: number } }`
  - `ToolNode`: `{ type: 'tool'; data: { toolName: 'web_search' | 'http_request' | 'sql_query'; endpoint?: string; timeoutMs: number } }`
  - `EvaluatorNode`: `{ type: 'evaluator'; data: { criteria: string; passThreshold: number } }`
- Define `WorkflowEdge`: `{ id: string; sourceNodeId: string; targetNodeId: string }`.
- Define `WorkflowState`: `{ id: string; name: string; nodes: WorkflowNode[]; edges: WorkflowEdge[]; updatedAt: string }`.
- Create **Zod schemas** (`workflowSchema`) to validate state hydration from `localStorage` and JSON import/export.

---

## 3. Advanced Custom Hooks (`src/hooks/`)

Implement with zero external state libraries (pure React + TypeScript strict mode):

1. **`useUndoRedo<T>(initialPresent: T, maxHistory = 50)`:**
   - Uses `useReducer` managing `{ past: T[], present: T, future: T[] }`.
   - Exposes `{ state, set, undo, redo, canUndo, canRedo, reset }`.
   - Registers `keydown` listener for `Ctrl+Z`/`Cmd+Z` (undo) and `Ctrl+Shift+Z`/`Cmd+Y` (redo), **strictly ignoring** events when `document.activeElement` is an `INPUT`, `TEXTAREA`, or `contentEditable`.
2. **`useCanvasViewport()`:**
   - Manages `pan` (`{ x, y }`) and `zoom` (`0.4` to `1.8`) via `useRef` + direct DOM `transform: translate3d(...) scale(...)` updates to guarantee 60fps without React re-renders during drag/wheel events.
   - Exposes debounced `zoomPercent` state for UI display and `resetViewport()`.
3. **`useWorkflowGraph(initialWorkflow: WorkflowState)`:**
   - Wraps `useUndoRedo<WorkflowState>`.
   - Actions: `addNode`, `updateNodeData`, `moveNodeTransient` (updates position without pushing history), `commitNodeMove` (pushes single history entry on pointer release), `removeNode` (also cleans up connected edges), `connectNodes` (prevents self-loops and duplicate edges), `removeEdge`.
   - Auto-persists to `localStorage` (`flowforge:workflow:v1`) with 400ms debounce.

---

## 4. Canvas & Inspector UI (`src/features/canvas/`)

Using exclusively Phase 1 Design System components (`Button`, `Badge`, `Input`, `Modal`, `NodeCard`):

- **`CanvasBoard.tsx`:** Renders the dot-grid viewport (`#0A0A0B`), interactive draggable `NodeCard` items, and an `<svg>` layer drawing smooth cubic Bezier curves (`<path>`) between connected node ports.
- **`NodeInspector.tsx`:** Right-hand panel (`320px`, `#121215`, `1px` border) rendering type-specific form controls when a node is selected (model selector, temperature slider, prompt textarea, or tool config).
- **`CanvasToolbar.tsx`:** Top bar displaying workflow title, node creation triggers (`+ Prompt`, `+ Tool`, `+ Evaluator`), Undo/Redo buttons with live `canUndo`/`canRedo` states and `<kbd>` hints, zoom indicator, and `Export JSON` modal trigger.

---

## 5. Unit Tests (`src/hooks/*.test.ts`)

Write comprehensive Vitest suites (`@testing-library/react` `renderHook`):

- `useUndoRedo.test.ts`: Tests history stack push, undo, redo, future truncation on new action, `maxHistory` cap, and keyboard shortcut suppression when an `<input>` is focused.
- `useWorkflowGraph.test.ts`: Tests node creation, edge validation (rejecting self-loops), cascading edge deletion when a node is removed, and Zod schema validation.

---

## 6. Execution Constraints

- Do NOT implement SSE streaming or Playwright E2E tests yet (reserved for Phase 3).
- Ensure `npm run lint`, `npx tsc --noEmit`, `npm run test:ci`, and `npm run build` pass with zero errors.
