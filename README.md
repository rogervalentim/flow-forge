# FlowForge UI

**AI Agent & Prompt Workflow Orchestrator** — Phase 1: Foundation, Design System & DevOps.

A dark, Swiss-Industrial / precision-tooling interface for building, running and
inspecting prompt workflows. Flat surfaces, 1px structural borders, 6px geometry,
monospace telemetry.

---

## Stack

| Concern        | Choice                                                            |
| -------------- | ----------------------------------------------------------------- |
| Framework      | React 19 + Vite + TypeScript (`strict`, `noUncheckedIndexedAccess`) |
| Styling        | Tailwind CSS v4 (`@theme` tokens, no config file)                  |
| Fonts          | Inter (UI) · JetBrains Mono (metrics, IDs, latency) — self-hosted  |
| Primitives     | Radix Dialog, Radix Tabs · `lucide-react` (`strokeWidth={1.5}`)     |
| Docs & tests   | Storybook 10 (`play` interaction tests) + Vitest (jsdom + browser)  |
| Delivery       | Multi-stage Docker + Compose · GitHub Actions CI/CD                |

## Getting started

```bash
npm ci
npm run dev            # app        → http://localhost:5173
npm run storybook      # design sys → http://localhost:6006
```

## Scripts

| Script                  | What it does                                                |
| ----------------------- | ----------------------------------------------------------- |
| `npm run dev`           | Vite dev server with HMR                                    |
| `npm run build`         | `tsc --noEmit` then production bundle into `dist/`          |
| `npm run preview`       | Serve the production bundle on `:4173`                      |
| `npm run typecheck`     | Strict TypeScript, no emit                                  |
| `npm run test`          | Vitest unit/component tests (jsdom) + JUnit report          |
| `npm run test:stories`  | Storybook `play` interactions in headless Chromium          |
| `npm run test:all`      | Both suites                                                 |
| `npm run storybook`     | Storybook dev server                                        |
| `npm run build-storybook` | Static Storybook into `storybook-static/`                 |

## Design system

Tokens live in [`src/design-system/tokens.css`](src/design-system/tokens.css) and are the
single source of truth. Components never hardcode a colour, radius or shadow.

| Token                    | Value                     | Use                                   |
| ------------------------ | ------------------------- | ------------------------------------- |
| `--color-bg-canvas`      | `#0A0A0B`                 | viewport, dot-grid canvas             |
| `--color-bg-panel`       | `#121215`                 | sidebar, inspector, topbar            |
| `--color-bg-elevated`    | `#18181C`                 | node cards, modals, dropdowns         |
| `--color-border-subtle`  | `rgba(255,255,255,.08)`   | structural hairline                   |
| `--color-border-strong`  | `rgba(255,255,255,.16)`   | hover / emphasis hairline             |
| `--color-text-primary`   | `#FAFAFA`                 | primary text                          |
| `--color-text-secondary` | `#A1A1AA`                 | secondary text                        |
| `--color-text-muted`     | `#71717A`                 | labels, telemetry keys                |
| `--color-accent-primary` | `#0070F3`                 | selection, focus ring, primary CTA    |
| `--color-status-success` | `#10B981`                 | `200 OK`, active stream               |
| `--color-status-warning` | `#F59E0B`                 | token-limit warning                   |
| `--color-status-error`   | `#EF4444`                 | `429 Rate Limit`, failed node         |
| `--radius-sm` / `-md`    | `4px` / `6px`             | chips / controls and cards            |
| `--font-sans` / `-mono`  | Inter / JetBrains Mono    | UI / telemetry                        |

Utilities: `bg-dot-grid` (24px dot lattice) and `tnum` (tabular figures).

### Components

`Button` · `Badge` · `Input` · `Modal` · `NodeCard` — each with a story and a `play`
interaction test. Everything is exported from `src/design-system/index.ts`.

```tsx
import { Button, NodeCard } from "./design-system";
```

### Anti-generic rules

Rejected in review: purple/neon gradients, glassmorphism blobs, heavy drop shadows,
oversized radii. Selection and state are expressed with borders and colour tokens.

## Docker

```bash
docker compose --profile prod up -d --build     # web :3000 · storybook :6006
docker compose --profile dev up web-dev storybook-dev
```

- `docker/Dockerfile.web` — `deps` → `development` → `build` → `runtime` (nginx, non-root, `:8080`, `/healthz`)
- `docker/Dockerfile.storybook` — same shape, serving `storybook-static`
- Both runtime stages run `read_only` with tmpfs mounts and `no-new-privileges`.

## CI / CD

- **`.github/workflows/ci.yml`** — typecheck → unit → Storybook interaction tests →
  builds → Docker build + container smoke test, gated by the `CI success` job.
- **`.github/workflows/cd.yml`** — on `v*.*.*` tags: verify → publish both images to
  GHCR (provenance + SBOM) → Trivy scan → environment-gated deploy → GitHub Release.

Required repository secrets/vars: `DEPLOY_HOOK_URL` (optional), `DEPLOY_URL` (environment URL).

## Structure

```text
src/
├── design-system/
│   ├── tokens.css        # @theme palette, geometry, base layer, utilities
│   ├── index.ts          # public surface of the design system
│   ├── utils/cn.ts
│   └── components/{Button,Badge,Input,Modal,NodeCard}/
├── App.tsx               # Phase 1 shell: topbar, sidebar, canvas, inspector, status bar
└── main.tsx
```
