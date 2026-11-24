import * as React from "react";
import { cn } from "../../utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual weight. `primary` is the single accent CTA on a surface. */
  variant?: ButtonVariant;
  /** Control height. `md` is the default for toolbars. */
  size?: ButtonSize;
  /** Optional leading icon (lucide-react, strokeWidth 1.5). */
  leadingIcon?: React.ReactNode;
  /** Optional trailing icon, e.g. a keyboard hint or chevron. */
  trailingIcon?: React.ReactNode;
  /** Renders a spinner and blocks interaction. */
  loading?: boolean;
  /** Stretches the button to the container width. */
  fullWidth?: boolean;
}

const BASE =
  "relative inline-flex select-none items-center justify-center gap-2 rounded-md border " +
  "font-sans font-medium whitespace-nowrap transition-colors duration-100 " +
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-primary " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-bg-canvas " +
  "disabled:pointer-events-none disabled:opacity-40";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "border-accent-primary bg-accent-primary text-text-primary " +
    "hover:border-[#2b8cff] hover:bg-[#2b8cff] active:bg-[#0062d6] active:border-[#0062d6]",
  secondary:
    "border-border-strong bg-bg-elevated text-text-primary " +
    "hover:border-[rgba(255,255,255,0.24)] hover:bg-[#1f1f24] active:bg-[#141418]",
  ghost:
    "border-transparent bg-transparent text-text-secondary " +
    "hover:bg-[rgba(255,255,255,0.04)] hover:text-text-primary active:bg-[rgba(255,255,255,0.06)]",
  danger:
    "border-status-error bg-transparent text-status-error " +
    "hover:bg-[rgba(239,68,68,0.1)] active:bg-[rgba(239,68,68,0.16)]",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-7 px-2 text-[11px] tracking-[0.01em]",
  md: "h-8 px-3 text-[12px] tracking-[0.01em]",
  lg: "h-10 px-4 text-[13px]",
};

const ICON_SIZE: Record<ButtonSize, number> = { sm: 12, md: 14, lg: 16 };

function Spinner({ size }: { size: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block animate-spin rounded-full border-current border-t-transparent"
      style={{ width: size, height: size, borderWidth: 1.5 }}
    />
  );
}

/**
 * Button — precision tooling control.
 *
 * Sharp 6px geometry, 1px border, no shadow, no gradient. The accent variant
 * is reserved for the single primary action of a surface.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "secondary",
      size = "md",
      leadingIcon,
      trailingIcon,
      loading = false,
      fullWidth = false,
      className,
      disabled,
      type = "button",
      children,
      ...rest
    },
    ref,
  ) {
    const iconSize = ICON_SIZE[size];

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled === true || loading}
        aria-busy={loading || undefined}
        data-variant={variant}
        data-size={size}
        className={cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && "w-full", className)}
        {...rest}
      >
        {loading ? <Spinner size={iconSize} /> : leadingIcon}
        {children !== undefined && <span className="truncate">{children}</span>}
        {trailingIcon}
      </button>
    );
  },
);
