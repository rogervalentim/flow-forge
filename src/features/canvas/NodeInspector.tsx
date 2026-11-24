import * as React from "react";
import { ChevronDown, Trash2 } from "lucide-react";

import { Badge, Button, Input } from "../../design-system";
import {
  PROMPT_MODELS,
  TOOL_NAMES,
  type WorkflowNode,
} from "../../types/workflow";
import { NODE_KIND } from "./nodeLayout";

export interface NodeInspectorProps {
  node: WorkflowNode | null;
  onChange: (nodeId: string, patch: Record<string, unknown>) => void;
  onRemove: (nodeId: string) => void;
  /**
   * Below `lg` the panel overlays the canvas instead of taking a column, so it
   * needs an explicit close affordance.
   */
  onClose?: () => void;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium tracking-[0.01em] text-text-secondary">{label}</span>
      {children}
      {hint !== undefined && <span className="text-[10px] text-text-muted">{hint}</span>}
    </label>
  );
}

function Select({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full appearance-none rounded-md border border-border-subtle bg-bg-canvas px-2 pr-7 font-mono text-[12px] text-text-primary outline-none transition-colors hover:border-border-strong focus:border-accent-primary"
      >
        {options.map((option) => (
          <option key={option} value={option} className="bg-bg-elevated">
            {option}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        size={12}
        strokeWidth={1.5}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted"
      />
    </div>
  );
}

function Slider({
  value,
  min,
  max,
  step,
  onChange,
  label,
  readout,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  label: string;
  readout: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium tracking-[0.01em] text-text-secondary">
          {label}
        </span>
        <span className="font-mono text-[11px] tnum text-text-primary">{readout}</span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-sm bg-border-subtle accent-accent-primary"
      />
    </div>
  );
}

function TextArea({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}) {
  // Controlled with local echo so the caret never jumps while typing fast.
  const [draft, setDraft] = React.useState(value);
  const [tracked, setTracked] = React.useState(value);
  if (tracked !== value) {
    setTracked(value);
    setDraft(value);
  }

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium tracking-[0.01em] text-text-secondary">{label}</span>
      <textarea
        aria-label={label}
        data-testid={`inspector-field-${label.toLowerCase().replace(/\s+/g, "-")}`}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          onChange(event.target.value);
        }}
        placeholder={placeholder}
        rows={5}
        className="w-full resize-y rounded-md border border-border-subtle bg-bg-canvas px-2 py-1.5 font-mono text-[11px] leading-relaxed text-text-primary outline-none transition-colors placeholder:text-text-muted hover:border-border-strong focus:border-accent-primary"
      />
    </label>
  );
}

/**
 * NodeInspector — the 320px right-hand panel.
 *
 * Renders type-specific controls for the selected node. Every control writes
 * through `onChange`, which lands in the graph history as one undoable step
 * per keystroke group (the hook dedupes identical values).
 */
export function NodeInspector({ node, onChange, onRemove, onClose }: NodeInspectorProps) {
  return (
    <aside
      aria-label="Node inspector"
      data-testid="node-inspector"
      className="absolute inset-y-0 right-0 z-20 flex w-[320px] max-w-full shrink-0 flex-col border-l border-border-subtle bg-bg-panel lg:static lg:z-auto"
    >
      <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2.5">
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-muted">
          Inspector
        </span>
        <div className="flex items-center gap-2">
          {node !== null && (
            <Badge tone="accent" mono>
              {NODE_KIND[node.type]}
            </Badge>
          )}
          {onClose !== undefined && (
            <Button
              size="sm"
              variant="ghost"
              aria-label="Close inspector"
              className="lg:hidden"
              onClick={onClose}
            >
              Close
            </Button>
          )}
        </div>
      </div>

      {node === null ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">
            no selection
          </span>
          <span className="text-[11px] leading-relaxed text-text-secondary">
            Select a node on the canvas to edit its configuration.
          </span>
        </div>
      ) : (
        <>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
            <div className="flex items-center justify-between gap-2 rounded-sm border border-border-subtle bg-bg-canvas px-2 py-1.5">
              <span className="truncate font-mono text-[10px] text-text-muted">{node.id}</span>
              <Badge tone="neutral" mono outlined>
                {node.type}
              </Badge>
            </div>

            {node.type === "prompt" && (
              <>
                <Field label="Model">
                  <Select
                    label="Model"
                    value={node.data.model}
                    options={PROMPT_MODELS}
                    onChange={(value) => onChange(node.id, { model: value })}
                  />
                </Field>

                <Slider
                  label="Temperature"
                  min={0}
                  max={2}
                  step={0.1}
                  value={node.data.temperature}
                  readout={node.data.temperature.toFixed(1)}
                  onChange={(value) => onChange(node.id, { temperature: value })}
                />

                <TextArea
                  label="System prompt"
                  value={node.data.systemPrompt}
                  placeholder="You are a precise support agent…"
                  onChange={(value) => onChange(node.id, { systemPrompt: value })}
                />
              </>
            )}

            {node.type === "tool" && (
              <>
                <Field label="Tool">
                  <Select
                    label="Tool"
                    value={node.data.toolName}
                    options={TOOL_NAMES}
                    onChange={(value) => onChange(node.id, { toolName: value })}
                  />
                </Field>

                <Input
                  key={`${node.id}-endpoint`}
                  label="Endpoint"
                  mono
                  placeholder="https://api.internal/search"
                  defaultValue={node.data.endpoint ?? ""}
                  onChange={(event) => onChange(node.id, { endpoint: event.target.value })}
                  invalid={node.data.toolName === "http_request" && !node.data.endpoint}
                  hint={
                    node.data.toolName === "http_request"
                      ? "Required for http_request"
                      : "Optional for this tool"
                  }
                />

                <Input
                  key={`${node.id}-timeout`}
                  label="Timeout"
                  mono
                  size="sm"
                  defaultValue={String(node.data.timeoutMs)}
                  trailingSlot={<span className="font-mono text-[10px] uppercase">ms</span>}
                  onChange={(event) =>
                    onChange(node.id, { timeoutMs: Number(event.target.value) || 0 })
                  }
                />
              </>
            )}

            {node.type === "evaluator" && (
              <>
                <TextArea
                  label="Criteria"
                  value={node.data.criteria}
                  placeholder="Answer must cite a source and stay under 120 words."
                  onChange={(value) => onChange(node.id, { criteria: value })}
                />

                <Slider
                  label="Pass threshold"
                  min={0}
                  max={1}
                  step={0.01}
                  value={node.data.passThreshold}
                  readout={node.data.passThreshold.toFixed(2)}
                  onChange={(value) => onChange(node.id, { passThreshold: value })}
                />
              </>
            )}

            <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-3">
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-muted">
                Position
              </span>
              <span className="font-mono text-[10px] tnum text-text-secondary">
                x {Math.round(node.position.x)} · y {Math.round(node.position.y)}
              </span>
            </div>
          </div>

          <div className="border-t border-border-subtle p-3">
            <Button
              variant="danger"
              fullWidth
              leadingIcon={<Trash2 size={14} strokeWidth={1.5} />}
              onClick={() => onRemove(node.id)}
            >
              Delete node
            </Button>
          </div>
        </>
      )}
    </aside>
  );
}
