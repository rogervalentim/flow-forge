import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../utils/cn";

export type ModalSize = "sm" | "md" | "lg";

export interface ModalProps {
  /** Controlled open state. */
  open: boolean;
  /** Called on Escape, overlay click or close button. */
  onOpenChange: (open: boolean) => void;
  /** Dialog title — always required, also used as the accessible name. */
  title: string;
  /** Optional supporting line under the title. */
  description?: string;
  /** Body content. */
  children?: React.ReactNode;
  /** Footer actions, right-aligned. */
  footer?: React.ReactNode;
  /** Max width of the panel. */
  size?: ModalSize;
  /** Hides the top-right close control for destructive confirmation flows. */
  hideClose?: boolean;
  /** Class applied to the panel. */
  className?: string;
}

const SIZES: Record<ModalSize, string> = {
  sm: "max-w-[400px]",
  md: "max-w-[520px]",
  lg: "max-w-[680px]",
};

/**
 * Modal — elevated command surface built on Radix Dialog.
 *
 * Sharp 6px geometry, 1px strong border, flat dark elevation (no blur, no
 * shadow stack). Focus is trapped, Escape closes, overlay is a flat scrim.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  hideClose = false,
  className,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-40 bg-[rgba(10,10,11,0.72)]",
            "data-[state=open]:animate-[fade-in_120ms_ease-out]",
          )}
        />
        <Dialog.Content
          data-testid="modal-panel"
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2",
            "rounded-md border border-border-strong bg-bg-elevated",
            "focus:outline-none",
            SIZES[size],
            className,
          )}
        >
          <header className="flex items-start justify-between gap-4 border-b border-border-subtle px-4 py-3">
            <div className="flex min-w-0 flex-col gap-1">
              <Dialog.Title className="truncate text-[13px] font-semibold tracking-[-0.01em] text-text-primary">
                {title}
              </Dialog.Title>
              {description !== undefined && (
                <Dialog.Description className="text-[11px] leading-relaxed text-text-secondary">
                  {description}
                </Dialog.Description>
              )}
            </div>

            {!hideClose && (
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Close dialog"
                  className={cn(
                    "-mr-1 -mt-1 flex size-6 shrink-0 items-center justify-center rounded-sm",
                    "text-text-muted transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-text-primary",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-primary",
                  )}
                >
                  <X size={14} strokeWidth={1.5} />
                </button>
              </Dialog.Close>
            )}
          </header>

          <div className="px-4 py-4 text-[12px] leading-relaxed text-text-secondary">{children}</div>

          {footer !== undefined && (
            <footer className="flex items-center justify-end gap-2 border-t border-border-subtle px-4 py-3">
              {footer}
            </footer>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const ModalTrigger = Dialog.Trigger;
export const ModalClose = Dialog.Close;
