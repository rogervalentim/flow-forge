import * as React from "react";
import { AlertTriangle, CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { Badge, type BadgeTone } from "../Badge/Badge";
import { cn } from "../../utils/cn";

export type NodeStatus = "idle" | "running" | "success" | "warning" | "error";

export interface NodeMetric {
  /** Monospace label, e.g. `LAT`, `TOK`, `COST`. */
  label: string;
  /** Monospace value, e.g. `142ms`, `1.2k`, `$0.0031`. */
  value: string;
  /** Optional status tone for the value. */
  tone?: "default" | "success" | "warning" | "error";
}

export interface NodeCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Node kind, shown as an uppercase monospace tag. */
  kind: string;
  /** Human node name, e.g. `Summarize transcript`. */
  title: string;
  /** Model or provider line, e.g. `gpt-4o-mini · temp 0.2`. */
  subtitle?: string;
  /** Execution state of the node. */
  status?: NodeStatus;
  /** Telemetry readouts rendered in the footer. */
  metrics?: NodeMetric[];
  /** Icon rendered in the leading square. */
  icon?: React.ReactNode;
  /** Node port hint — shows in/out anchors on the left/right edges. */
  ports?: boolean;
  /** Highlights the card as the current canvas selection. */
  selected?: boolean;
  /** 0–100 progress bar under the header, visible while running. */
  progress?: number;
}

const STATUS_META: Record<
  NodeStatus,
  { label: string; tone: BadgeTone; icon: React.ReactNode; dot: string }
> = {
  idle: {
    label: "IDLE",
    tone: "neutral",
    icon: <Circle size={12} strokeWidth={1.5} />,
    dot: "bg-text-muted",
  },
  running: {
    label: "RUNNING",
    tone: "accent",
    icon: <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />,
    dot: "bg-accent-primary",
  },
  success: {
    label: "200 OK",
    tone: "success",
    icon: <CheckCircle2 size={12} strokeWidth={1.5} />,
    dot: "bg-status-success",
  },
  warning: {
    label: "TOK LIMIT",
    tone: "warning",
    icon: <AlertTriangle size={12} strokeWidth={1.5} />,
    dot: "bg-status-warning",
  },
  error: {
    label: "429 LIMIT",
    tone: "error",
    icon: <XCircle size={12} strokeWidth={1.5} />,
    dot: "bg-status-error",
  },
};

const METRIC_TONE = {
  default: "text-text-secondary",
  success: "text-status-success",
  warning: "text-status-warning",
  error: "text-status-error",
} as const;

/**
 * NodeCard — a single step in the workflow canvas.
 *
 * The card is the primary canvas object: 6px radius, 1px structural border,
 * flat elevated surface, monospace telemetry footer. Selection is expressed by
 * a 1px accent border, never by a glow or scale transform.
 */
export const NodeCard = React.forwardRef<HTMLDivElement, NodeCardProps>(function NodeCard(
  {
    kind,
    title,
    subtitle,
    status = "idle",
    metrics,
    icon,
    ports = true,
    selected = false,
    progress,
    className,
    ...rest
  },
  ref,
) {
  const meta = STATUS_META[status];
  const showProgress = status === "running" && typeof progress === "number";

  return (
    <div
      ref={ref}
      data-status={status}
      data-selected={selected || undefined}
      aria-selected={selected}
      className={cn(
        "group relative w-[248px] rounded-md border bg-bg-elevated",
        "transition-colors duration-100",
        selected
          ? "border-accent-primary"
          : "border-border-subtle hover:border-border-strong",
        status === "error" && !selected && "border-[rgba(239,68,68,0.4)]",
        className,
      )}
      {...rest}
    >
      {ports && (
        <>
          <span
            aria-hidden="true"
            className="absolute -left-[3px] top-1/2 size-1.5 -translate-y-1/2 rounded-full border border-border-strong bg-bg-panel"
          />
          <span
            aria-hidden="true"
            className="absolute -right-[3px] top-1/2 size-1.5 -translate-y-1/2 rounded-full border border-border-strong bg-bg-panel"
          />
        </>
      )}

      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <span
          aria-hidden="true"
          className={cn(
            "mt-px flex size-6 shrink-0 items-center justify-center rounded-sm border",
            "border-border-subtle bg-bg-panel text-text-secondary",
            selected && "border-[rgba(0,112,243,0.4)] text-accent-primary",
          )}
        >
          {icon ?? <Circle size={12} strokeWidth={1.5} />}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-text-muted">
            {kind}
          </span>
          <span className="truncate text-[12px] font-medium leading-tight text-text-primary">
            {title}
          </span>
          {subtitle !== undefined && (
            <span className="truncate font-mono text-[10px] leading-tight text-text-muted">
              {subtitle}
            </span>
          )}
        </div>
      </div>

      {showProgress && (
        <div className="mx-3 mb-2 h-px w-[calc(100%-1.5rem)] bg-border-subtle">
          <div
            className="h-px bg-accent-primary transition-[width] duration-200"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border-subtle px-3 py-1.5">
        <Badge tone={meta.tone} mono dot>
          {meta.label}
        </Badge>

        {metrics !== undefined && metrics.length > 0 && (
          <div className="flex items-center gap-2.5">
            {metrics.map((metric) => (
              <span
                key={metric.label}
                className="flex items-baseline gap-1 font-mono text-[10px] tnum leading-none"
              >
                <span className="uppercase tracking-[0.06em] text-text-muted">{metric.label}</span>
                <span className={METRIC_TONE[metric.tone ?? "default"]}>{metric.value}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
