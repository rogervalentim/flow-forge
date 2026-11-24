import * as React from "react";
import { cn } from "../../utils/cn";

export type InputSize = "sm" | "md";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Optional field label rendered above the control. */
  label?: string;
  /** Helper or validation message rendered below the control. */
  hint?: string;
  /** Marks the field invalid: 1px error border and error-coloured hint. */
  invalid?: boolean;
  /** Monospace value — for IDs, model names, tokens and numeric telemetry. */
  mono?: boolean;
  /** Adornment rendered inside the field, before the text. */
  leadingIcon?: React.ReactNode;
  /** Adornment rendered inside the field, after the text (kbd hint, unit, suffix). */
  trailingSlot?: React.ReactNode;
  /** Control height. */
  size?: InputSize;
  /** Class applied to the outermost wrapper. */
  wrapperClassName?: string;
}

const SIZES: Record<InputSize, string> = {
  sm: "h-7 px-2 text-[11px]",
  md: "h-8 px-2.5 text-[12px]",
};

/**
 * Input — single-line field for a precision tooling surface.
 *
 * Flat dark surface, 1px hairline border, 6px radius. Focus raises the border
 * to the accent token and shows a 1px ring; there is no glow or shadow.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    invalid = false,
    mono = false,
    leadingIcon,
    trailingSlot,
    size = "md",
    className,
    wrapperClassName,
    id,
    disabled,
    ...rest
  },
  ref,
) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const hasHint = Boolean(hint);

  return (
    <div className={cn("flex w-full flex-col gap-1.5", wrapperClassName)}>
      {label !== undefined && (
        <label
          htmlFor={inputId}
          className="text-[11px] font-medium tracking-[0.01em] text-text-secondary"
        >
          {label}
        </label>
      )}

      <div
        className={cn(
          "group flex items-center gap-2 rounded-md border bg-bg-canvas px-2",
          "transition-colors duration-100",
          "focus-within:border-accent-primary",
          invalid
            ? "border-status-error focus-within:border-status-error"
            : "border-border-subtle hover:border-border-strong focus-within:border-accent-primary",
          disabled && "opacity-40",
          SIZES[size],
          "px-0",
        )}
      >
        {leadingIcon !== undefined && (
          <span
            aria-hidden="true"
            className="flex shrink-0 items-center pl-2 text-text-muted group-focus-within:text-text-secondary"
          >
            {leadingIcon}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={hasHint ? hintId : undefined}
          className={cn(
            "min-w-0 flex-1 bg-transparent text-text-primary outline-none",
            "placeholder:text-text-muted",
            "selection:bg-accent-primary/30",
            mono ? "font-mono tnum tracking-[-0.01em]" : "font-sans",
            leadingIcon !== undefined ? "pl-0" : "pl-2",
            trailingSlot !== undefined ? "pr-0" : "pr-2",
            "h-full",
            "disabled:cursor-not-allowed",
            className,
          )}
          {...rest}
        />

        {trailingSlot !== undefined && (
          <span className="flex shrink-0 items-center pr-2 text-text-muted">{trailingSlot}</span>
        )}
      </div>

      {hasHint && (
        <p
          id={hintId}
          className={cn(
            "text-[11px] leading-tight",
            invalid ? "text-status-error" : "text-text-muted",
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
});
