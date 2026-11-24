import * as React from "react";
import { cn } from "../../utils/cn";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "error";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Semantic tone. `neutral` is structural, the rest map to status tokens:
   * success (`200 OK`), warning (token limit), error (`429 Rate Limit`).
   */
  tone?: BadgeTone;
  /** Uppercase monospace label for telemetry values (IDs, status codes, counts). */
  mono?: boolean;
  /** 6px dot on the left edge — the only non-textual status carrier. */
  dot?: boolean;
  /** Renders a 1px border instead of a filled surface. */
  outlined?: boolean;
}

const TONES: Record<BadgeTone, { text: string; ring: string; fill: string; dot: string }> = {
  neutral: {
    text: "text-text-secondary",
    ring: "border-border-subtle",
    fill: "bg-[rgba(255,255,255,0.04)]",
    dot: "bg-text-muted",
  },
  accent: {
    text: "text-[#7cb8ff]",
    ring: "border-[rgba(0,112,243,0.32)]",
    fill: "bg-[rgba(0,112,243,0.12)]",
    dot: "bg-accent-primary",
  },
  success: {
    text: "text-status-success",
    ring: "border-[rgba(16,185,129,0.32)]",
    fill: "bg-[rgba(16,185,129,0.1)]",
    dot: "bg-status-success",
  },
  warning: {
    text: "text-status-warning",
    ring: "border-[rgba(245,158,11,0.32)]",
    fill: "bg-[rgba(245,158,11,0.1)]",
    dot: "bg-status-warning",
  },
  error: {
    text: "text-status-error",
    ring: "border-[rgba(239,68,68,0.32)]",
    fill: "bg-[rgba(239,68,68,0.1)]",
    dot: "bg-status-error",
  },
};

/**
 * Badge — compact status / metadata chip.
 *
 * 6px radius, 1px border, monospace option for telemetry. Never used as a
 * button: badges carry state, they do not trigger it.
 */
export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { tone = "neutral", mono = false, dot = false, outlined = false, className, children, ...rest },
  ref,
) {
  const palette = TONES[tone];

  return (
    <span
      ref={ref}
      data-tone={tone}
      className={cn(
        "inline-flex h-[18px] items-center gap-1.5 rounded-sm border px-1.5",
        "text-[10px] font-medium leading-none whitespace-nowrap",
        palette.text,
        palette.ring,
        outlined ? "bg-transparent" : palette.fill,
        mono ? "font-mono uppercase tracking-[0.06em] tnum" : "font-sans tracking-[0.01em]",
        className,
      )}
      {...rest}
    >
      {dot && (
        <span aria-hidden="true" className={cn("size-1 shrink-0 rounded-full", palette.dot)} />
      )}
      {children}
    </span>
  );
});
