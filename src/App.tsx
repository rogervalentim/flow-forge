import { useState } from "react";
import {
  Activity,
  ArrowRight,
  Bot,
  Braces,
  Command,
  GitBranch,
  Layers,
  PanelLeft,
  Play,
  Plus,
  Search,
  Settings2,
  Webhook,
} from "lucide-react";
import {
  Badge,
  Button,
  Input,
  Modal,
  NodeCard,
  type NodeStatus,
} from "./design-system";

type WorkflowNode = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  status: NodeStatus;
  icon: React.ReactNode;
  metrics: { label: string; value: string; tone?: "default" | "success" | "warning" | "error" }[];
  progress?: number;
};

const NODES: WorkflowNode[] = [
  {
    id: "01",
    kind: "trigger.webhook",
    title: "Inbound webhook",
    subtitle: "POST /v1/runs",
    status: "success",
    icon: <Webhook size={12} strokeWidth={1.5} />,
    metrics: [{ label: "req", value: "1" }],
  },
  {
    id: "02",
    kind: "prompt.render",
    title: "Render system prompt",
    subtitle: "system.v3 · 7.9k tok",
    status: "warning",
    icon: <Braces size={12} strokeWidth={1.5} />,
    metrics: [{ label: "tok", value: "7.9k/8k", tone: "warning" }],
  },
  {
    id: "03",
    kind: "agent.step",
    title: "Retrieve context",
    subtitle: "vector · top_k 8",
    status: "running",
    icon: <GitBranch size={12} strokeWidth={1.5} />,
    progress: 62,
    metrics: [{ label: "tok", value: "812" }],
  },
  {
    id: "04",
    kind: "llm.call",
    title: "Summarize transcript",
    subtitle: "gpt-4o-mini · temp 0.2",
    status: "success",
    icon: <Bot size={12} strokeWidth={1.5} />,
    metrics: [
      { label: "lat", value: "142ms" },
      { label: "tok", value: "1.2k" },
    ],
  },
  {
    id: "05",
    kind: "llm.call",
    title: "Classify intent",
    subtitle: "claude-sonnet · retry 2/3",
    status: "error",
    icon: <Bot size={12} strokeWidth={1.5} />,
    metrics: [
      { label: "lat", value: "1.8s", tone: "error" },
      { label: "tok", value: "0" },
    ],
  },
];

const TELEMETRY = [
  { label: "Runs today", value: "1,284", tone: "text-text-primary" },
  { label: "p95 latency", value: "842ms", tone: "text-text-primary" },
  { label: "Tokens", value: "3.1M", tone: "text-status-warning" },
  { label: "Error rate", value: "0.42%", tone: "text-status-error" },
] as const;

const RUN_LOG = [
  { t: "12:04:18", level: "ok", text: "trigger.webhook 200 OK", tone: "success" },
  { t: "12:04:18", level: "warn", text: "prompt.render tokens 7901/8000", tone: "warning" },
  { t: "12:04:19", level: "info", text: "agent.step retrieve context · top_k 8", tone: "accent" },
  { t: "12:04:19", level: "err", text: "llm.call 429 rate limit · retry 2/3", tone: "error" },
] as const;

function TopBar({ onRun }: { onRun: () => void }) {
  return (
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

      <div className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-text-muted">
        <span className="text-text-secondary">acme</span>
        <span>/</span>
        <span className="text-text-secondary">support</span>
        <span>/</span>
        <span className="truncate text-text-primary">wf_summarize-ticket</span>
        <Badge tone="success" mono dot>
          v1.4.0
        </Badge>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden items-center gap-1.5 rounded-md border border-border-subtle bg-bg-canvas px-2 py-1 font-mono text-[10px] text-text-muted md:flex">
          <Search size={12} strokeWidth={1.5} />
          <span>Search</span>
          <kbd className="rounded-sm border border-border-subtle px-1 text-[9px] text-text-secondary">
            ⌘K
          </kbd>
        </div>
        <Button size="sm" variant="ghost" leadingIcon={<Settings2 size={14} strokeWidth={1.5} />}>
          Settings
        </Button>
        <Button
          size="sm"
          variant="primary"
          leadingIcon={<Play size={12} strokeWidth={1.5} />}
          onClick={onRun}
        >
          Run
        </Button>
      </div>
    </header>
  );
}

function Sidebar() {
  return (
    <aside className="hidden w-[216px] shrink-0 flex-col border-r border-border-subtle bg-bg-panel md:flex">
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-muted">
          Workflows
        </span>
        <Button size="sm" variant="ghost" aria-label="New workflow">
          <Plus size={12} strokeWidth={1.5} />
        </Button>
      </div>

      <nav className="flex flex-col gap-px px-1.5">
        {[
          { name: "wf_summarize-ticket", active: true, runs: "1.2k" },
          { name: "wf_ingest-docs", active: false, runs: "84" },
          { name: "wf_eval-regression", active: false, runs: "12" },
          { name: "wf_oncall-triage", active: false, runs: "0" },
        ].map((item) => (
          <button
            key={item.name}
            type="button"
            className={[
              "flex h-7 items-center justify-between rounded-sm px-2 text-left font-mono text-[11px] transition-colors",
              item.active
                ? "border border-border-strong bg-bg-elevated text-text-primary"
                : "border border-transparent text-text-secondary hover:bg-[rgba(255,255,255,0.03)] hover:text-text-primary",
            ].join(" ")}
          >
            <span className="truncate">{item.name}</span>
            <span className="ml-2 shrink-0 tnum text-[10px] text-text-muted">{item.runs}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto border-t border-border-subtle px-3 py-2.5">
        <div className="mb-1.5 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.1em] text-text-muted">
          <span>Token budget</span>
          <span className="tnum text-status-warning">98%</span>
        </div>
        <div className="h-1 w-full rounded-sm bg-bg-elevated">
          <div className="h-1 rounded-sm bg-status-warning" style={{ width: "98%" }} />
        </div>
      </div>
    </aside>
  );
}

function Canvas() {
  return (
    <main className="relative min-h-0 flex-1 overflow-auto bg-bg-canvas bg-dot-grid">
      <div className="flex min-h-full flex-col items-start gap-4 p-6">
        <div className="flex items-center gap-2">
          <Badge tone="neutral" mono outlined>
            canvas
          </Badge>
          <span className="font-mono text-[10px] text-text-muted">
            5 nodes · 4 edges · autosaved 12:04:19
          </span>
        </div>

        {NODES.map((node, index) => (
          <div key={node.id} className="flex flex-col items-start">
            <NodeCard
              kind={node.kind}
              title={node.title}
              subtitle={node.subtitle}
              status={node.status}
              icon={node.icon}
              metrics={node.metrics}
              selected={index === 2}
              {...(node.progress !== undefined ? { progress: node.progress } : {})}
            />
            {index < NODES.length - 1 && (
              <span className="ml-6 flex h-4 items-center text-text-muted">
                <ArrowRight size={12} strokeWidth={1.5} className="rotate-90" />
              </span>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}

function Inspector() {
  return (
    <aside className="hidden w-[264px] shrink-0 flex-col border-l border-border-subtle bg-bg-panel lg:flex">
      <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2.5">
        <PanelLeft size={12} strokeWidth={1.5} className="text-text-muted" />
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-muted">
          Inspector
        </span>
      </div>

      <div className="flex flex-col gap-3 p-3">
        <Input label="Node name" defaultValue="Retrieve context" mono size="sm" />
        <Input label="Model" defaultValue="gpt-4o-mini" mono size="sm" />
        <Input
          label="Temperature"
          defaultValue="0.20"
          mono
          size="sm"
          trailingSlot={<span className="font-mono text-[10px]">t</span>}
        />
        <Input
          label="Webhook URL"
          defaultValue="http://internal/hook"
          mono
          size="sm"
          invalid
          hint="Must start with https://"
        />
      </div>

      <div className="mt-auto border-t border-border-subtle p-3">
        <div className="mb-2 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-text-muted">
          <Activity size={11} strokeWidth={1.5} />
          <span>Run log</span>
        </div>
        <ul className="flex flex-col gap-1">
          {RUN_LOG.map((line) => (
            <li key={line.t + line.text} className="flex items-start gap-2 font-mono text-[10px]">
              <span className="tnum shrink-0 text-text-muted">{line.t}</span>
              <Badge tone={line.tone} mono>
                {line.level}
              </Badge>
              <span className="truncate text-text-secondary">{line.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

export default function App() {
  const [runOpen, setRunOpen] = useState(false);

  return (
    <div className="flex h-dvh flex-col bg-bg-canvas text-text-primary">
      <TopBar onRun={() => setRunOpen(true)} />

      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <Canvas />
        <Inspector />
      </div>

      <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-border-subtle bg-bg-panel px-3 font-mono text-[10px] tnum text-text-muted">
        {TELEMETRY.map((item) => (
          <span key={item.label} className="flex items-baseline gap-1.5">
            <span className="uppercase tracking-[0.08em]">{item.label}</span>
            <span className={item.tone}>{item.value}</span>
          </span>
        ))}
        <span className="ml-auto flex items-center gap-1.5">
          <Command size={10} strokeWidth={1.5} />
          <span>phase 1 · design system</span>
        </span>
      </footer>

      <Modal
        open={runOpen}
        onOpenChange={setRunOpen}
        title="Start run"
        description="Runs the published version v1.4.0 against the selected input set."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRunOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              leadingIcon={<Play size={12} strokeWidth={1.5} />}
              onClick={() => setRunOpen(false)}
            >
              Run v1.4.0
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Input label="Input set" defaultValue="fixtures/support-tickets.jsonl" mono />
          <Input label="Max tokens" defaultValue="4096" mono />
        </div>
      </Modal>
    </div>
  );
}
