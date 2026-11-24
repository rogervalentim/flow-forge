# SPEC.md — FlowForge UI (Phase 3: Streaming Playground, MSW, E2E & Portfolio Docs)

## 1. Objective (Phase 3)

Complete **FlowForge UI** by adding real-time Server-Sent Events (SSE) execution, resilient stream state management (`useStreamResponse`), realistic network mocking via Mock Service Worker (MSW), prompt snapshot diffing, Playwright E2E tests, and executive-grade documentation.

---

## 2. Advanced Streaming Hook (`src/hooks/useStreamResponse.ts`)

Implement with strict TypeScript and zero external streaming dependencies:

- **Signature:** `useStreamResponse()` returning `{ status, content, metrics, error, executeStream, abort }`.
- **Status Union:** `'idle' | 'connecting' | 'streaming' | 'completed' | 'aborted' | 'error'`.
- **Stream Processing:** Consumes `ReadableStream` via `TextDecoder` parsing `data: ...` SSE chunks.
- **Render Optimization (RAF Batching):** Accumulate incoming tokens in a `useRef` buffer and flush to React state inside `requestAnimationFrame` to cap re-renders at 60fps regardless of token arrival frequency.
- **Cancellation:** Uses `AbortController` to immediately terminate in-flight streams when `abort()` is called or when a new execution starts.
- **Live Telemetry (`metrics`):** Tracks `ttftMs` (Time to First Token), `totalLatencyMs`, `tokenCount`, and `tokensPerSecond`.

---

## 3. Realistic SSE Mock Layer (`src/mocks/`)

Configure **Mock Service Worker (`msw`)** running seamlessly in browser development and production demo builds:

- **`handlers.ts`:** Intercepts `POST /api/v1/workflows/execute`.
- **Topological Execution Simulation:** Reads the submitted `WorkflowNode[]` and `WorkflowEdge[]`, executes nodes in dependency order, and streams SSE events (`node_start`, `token`, `node_complete`, `done`).
- **Chaos / Failure Simulation:** Supports a header `x-mock-scenario: 'normal' | 'slow' | 'rate-limit'`:
  - `'normal'`: Realistic ~25ms per token stream.
  - `'slow'`: 1500ms initial latency before first token.
  - `'rate-limit'`: Returns HTTP `429 Too Many Requests` with `Retry-After: 3` header to test UI error boundaries and retry states.

---

## 4. Playground, Live Canvas Sync & Diff Viewer (`src/features/`)

Using Phase 1 Design System components (`Button`, `Badge`, `Modal`, `NodeCard`):

1. **`ExecutionConsole.tsx` (`src/features/playground/`):**
   - Collapsible bottom/side terminal panel (`#121215`, `1px` border).
   - Controls: `Run Workflow` button, `Stop` button (active during streaming), and `Network Mode` selector (`Normal`, `Slow`, `429 Error`).
   - Live Telemetry Bar: Monospace badges showing `TTFT`, `Tokens/s`, `Total Tokens`, and HTTP status (`200 OK` / `429 RATE LIMIT`).
   - Synchronizes active node execution state back to `CanvasBoard` so the currently executing `NodeCard` highlights with `status="running"` and transitions to `status="success"` or `status="error"`.
2. **`SnapshotDiffModal.tsx` (`src/features/versioning/`):**
   - Allows saving named workflow snapshots in `localStorage` and viewing a clean line-by-line monospace diff comparing prompt changes between two versions.

---

## 5. End-to-End Tests (`tests/e2e/workflow.spec.ts`) & CI Integration

- Configure **Playwright** (`playwright.config.ts`).
- Write `tests/e2e/workflow.spec.ts` covering the critical user journey:
  1. Load canvas and add a `Prompt` node and an `Evaluator` node.
  2. Connect nodes and edit the prompt text in `NodeInspector`.
  3. Trigger `Run Workflow`, verify streaming text appears in `ExecutionConsole`, and verify live metrics update.
  4. Test stream cancellation (`Stop` button) and undo action (`Control+z`).
- Update `.github/workflows/ci.yml` to run Playwright E2E tests as part of the Pull Request quality gate.

---

## 6. Portfolio-Ready `README.md`

Generate a comprehensive `README.md` at the repository root containing:

- Project overview and Swiss Industrial design philosophy.
- **Mermaid.js Architecture Diagram** illustrating data flow between `CanvasViewport` (ref-driven), `useWorkflowGraph` (undo/redo reducer), `useStreamResponse` (RAF-batched SSE), and `MSW`.
- **One-Command Quickstart:** `docker compose up --build` (exposing App on `:3000` and Storybook on `:6006`).
- Technical Engineering Highlights section explaining why custom hooks and `1px` border elevation were chosen over off-the-shelf templates.

---

## 7. Execution Constraints

- Ensure `msw/browser` worker (`public/mockServiceWorker.js`) is properly initialized so the Dockerized production build (`nginx:alpine`) works 100% standalone without an external backend.
- Verify `npm run lint`, `npx tsc --noEmit`, `npm run test:ci`, `npm run build-storybook`, `npx playwright test`, and `docker compose build` all exit with code `0`.
