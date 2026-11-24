import { useState } from "react";
import { Activity, Layers, Settings2 } from "lucide-react";

import { Badge, Button } from "./design-system";
import { CanvasPage } from "./features/canvas/CanvasPage";

/**
 * App — application shell.
 *
 * The topbar carries product identity and the global run action; everything
 * below it is the Phase 2 canvas (toolbar, graph board, inspector).
 */
export default function App() {
  const [runState, setRunState] = useState<"idle" | "armed">("idle");

  return (
    <div className="flex h-dvh flex-col bg-bg-canvas text-text-primary">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border-subtle bg-bg-panel px-3">
        <div className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded-sm border border-border-strong bg-bg-elevated">
            <Layers size={12} strokeWidth={1.5} className="text-accent-primary" />
          </span>
          <span className="text-[12px] font-semibold tracking-[-0.01em] text-text-primary">
            FlowForge
          </span>
        </div>

        <span className="h-4 w-px bg-border-subtle" />

        <span className="hidden items-center gap-2 font-mono text-[11px] text-text-muted md:flex">
          <span className="text-text-secondary">acme</span>
          <span>/</span>
          <span className="text-text-secondary">support</span>
        </span>

        <Badge tone="success" mono dot>
          v0.2.0
        </Badge>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-md border border-border-subtle bg-bg-canvas px-2 py-1 font-mono text-[10px] text-text-muted md:flex">
            <Activity size={12} strokeWidth={1.5} />
            <span>{runState === "idle" ? "no active run" : "run armed"}</span>
          </span>
          <Button size="sm" variant="ghost" leadingIcon={<Settings2 size={14} strokeWidth={1.5} />}>
            Settings
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setRunState((current) => (current === "idle" ? "armed" : "idle"))}
          >
            {runState === "idle" ? "Run" : "Cancel run"}
          </Button>
        </div>
      </header>

      <CanvasPage />
    </div>
  );
}
