import { useCallback, useEffect, useRef, useState } from "react";

/* ────────────────────────────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────────────────────────────── */

export type StreamStatus =
  | "idle"
  | "connecting"
  | "streaming"
  | "completed"
  | "aborted"
  | "error";

export interface StreamMetrics {
  /** Time to first token, in ms. */
  ttftMs: number | null;
  /** Total wall-clock latency of the request, in ms. */
  totalLatencyMs: number | null;
  tokenCount: number;
  tokensPerSecond: number;
}

/** One parsed SSE frame. */
export interface StreamEvent {
  /** SSE `event:` name, defaults to `message`. */
  event: string;
  /** Raw `data:` payload, already joined across multi-line frames. */
  data: string;
}

export interface ExecuteStreamOptions {
  /** Absolute or relative endpoint. Defaults to the mock execute route. */
  url?: string;
  method?: "POST" | "GET";
  body?: unknown;
  headers?: Record<string, string>;
  /** Called for every parsed SSE frame, outside React state. */
  onEvent?: (event: StreamEvent) => void;
  /** Called once when the stream settles (completed, aborted or failed). */
  onSettled?: (status: StreamStatus) => void;
}

export interface UseStreamResponseResult {
  status: StreamStatus;
  /** Accumulated text, flushed at most once per animation frame. */
  content: string;
  metrics: StreamMetrics;
  error: string | null;
  /** HTTP status of the response, when it is known. */
  httpStatus: number | null;
  executeStream: (options?: ExecuteStreamOptions) => Promise<void>;
  abort: () => void;
  /** Clears content, metrics and status back to idle. */
  reset: () => void;
}

export const DEFAULT_STREAM_URL = "/api/v1/workflows/execute";

const EMPTY_METRICS: StreamMetrics = {
  ttftMs: null,
  totalLatencyMs: null,
  tokenCount: 0,
  tokensPerSecond: 0,
};

/* ────────────────────────────────────────────────────────────────────────────
 * SSE parsing
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Splits an SSE buffer into complete frames and returns the remainder.
 * Frames are separated by a blank line; `data:` lines are joined with `\n`.
 */
export function parseSseChunk(buffer: string): { frames: StreamEvent[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const parts = normalized.split("\n\n");
  const rest = parts.pop() ?? "";

  const frames: StreamEvent[] = [];
  for (const part of parts) {
    if (part.trim() === "") continue;

    let event = "message";
    const data: string[] = [];

    for (const line of part.split("\n")) {
      if (line.startsWith(":")) continue;
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
        continue;
      }
      if (line.startsWith("data:")) {
        data.push(line.slice(5).replace(/^ /, ""));
      }
    }

    frames.push({ event, data: data.join("\n") });
  }

  return { frames, rest };
}

/** Extracts the text payload of a token frame. */
export function tokenText(data: string): string {
  try {
    const parsed: unknown = JSON.parse(data);
    if (typeof parsed === "string") return parsed;
    if (parsed !== null && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      const candidate = record["token"] ?? record["text"] ?? record["delta"];
      if (typeof candidate === "string") return candidate;
    }
  } catch {
    // Not JSON: the frame is the literal text.
  }
  return data;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Hook
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * `useStreamResponse` — resilient SSE consumption.
 *
 * Tokens are buffered in a ref and flushed inside `requestAnimationFrame`, so a
 * 200 token/s stream still re-renders at most 60 times per second. An
 * `AbortController` cancels the in-flight request; starting a new execution
 * aborts the previous one.
 */
export function useStreamResponse(): UseStreamResponseResult {
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [content, setContent] = useState("");
  const [metrics, setMetrics] = useState<StreamMetrics>(EMPTY_METRICS);
  const [error, setError] = useState<string | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const bufferRef = useRef("");
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const ttftRef = useRef<number | null>(null);
  const tokenRef = useRef(0);
  const settledRef = useRef<((status: StreamStatus) => void) | undefined>(undefined);
  const errorRef = useRef<string | null>(null);

  const flush = useCallback(() => {
    frameRef.current = null;
    if (bufferRef.current === "") return;

    const chunk = bufferRef.current;
    bufferRef.current = "";
    setContent((current) => current + chunk);

    const elapsed = performance.now() - startRef.current;
    setMetrics({
      ttftMs: ttftRef.current,
      totalLatencyMs: null,
      tokenCount: tokenRef.current,
      tokensPerSecond: elapsed > 0 ? (tokenRef.current / elapsed) * 1000 : 0,
    });
  }, []);

  const scheduleFlush = useCallback(() => {
    if (frameRef.current !== null) return;
    if (typeof requestAnimationFrame !== "function") {
      flush();
      return;
    }
    frameRef.current = requestAnimationFrame(flush);
  }, [flush]);

  const cancelFrame = useCallback(() => {
    if (frameRef.current !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = null;
  }, []);

  const settle = useCallback(
    (next: StreamStatus) => {
      cancelFrame();
      flush();

      const elapsed = performance.now() - startRef.current;
      setMetrics((current) => ({
        ...current,
        ttftMs: ttftRef.current,
        totalLatencyMs: elapsed,
        tokenCount: tokenRef.current,
        tokensPerSecond: elapsed > 0 ? (tokenRef.current / elapsed) * 1000 : 0,
      }));
      setStatus(next);
      settledRef.current?.(next);
      settledRef.current = undefined;
    },
    [cancelFrame, flush],
  );

  const abort = useCallback(() => {
    const controller = controllerRef.current;
    if (controller === null) return;
    controller.abort();
    controllerRef.current = null;
  }, []);

  const reset = useCallback(() => {
    abort();
    cancelFrame();
    bufferRef.current = "";
    tokenRef.current = 0;
    ttftRef.current = null;
    setContent("");
    setMetrics(EMPTY_METRICS);
    setError(null);
    setHttpStatus(null);
    setStatus("idle");
  }, [abort, cancelFrame]);

  const executeStream = useCallback(
    async (options: ExecuteStreamOptions = {}) => {
      // A new execution supersedes any in-flight stream.
      abort();
      cancelFrame();

      const {
        url = DEFAULT_STREAM_URL,
        method = "POST",
        body,
        headers = {},
        onEvent,
        onSettled,
      } = options;

      bufferRef.current = "";
      tokenRef.current = 0;
      ttftRef.current = null;
      settledRef.current = onSettled;
      startRef.current = performance.now();

      setContent("");
      setMetrics(EMPTY_METRICS);
      errorRef.current = null;
      setError(null);
      setHttpStatus(null);
      setStatus("connecting");

      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const response = await fetch(url, {
          method,
          headers: {
            Accept: "text/event-stream",
            ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
            ...headers,
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
          signal: controller.signal,
        });

        setHttpStatus(response.status);

        if (!response.ok) {
          const retryAfter = response.headers.get("Retry-After");
          const detail = await response.text().catch(() => "");
          const message =
            response.status === 429
              ? `429 Too Many Requests${retryAfter !== null ? ` · retry in ${retryAfter}s` : ""}`
              : `HTTP ${response.status}${detail !== "" ? ` · ${detail.slice(0, 160)}` : ""}`;
          errorRef.current = message;
          setError(message);
          settle("error");
          return;
        }

        if (response.body === null) {
          errorRef.current = "Response has no body";
          setError("Response has no body");
          settle("error");
          return;
        }

        setStatus("streaming");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let pending = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          pending += decoder.decode(value, { stream: true });
          const { frames, rest } = parseSseChunk(pending);
          pending = rest;

          for (const frame of frames) {
            onEvent?.(frame);

            if (frame.event === "token" || frame.event === "message") {
              const text = tokenText(frame.data);
              if (text === "") continue;

              if (ttftRef.current === null) {
                ttftRef.current = performance.now() - startRef.current;
              }
              tokenRef.current += 1;
              bufferRef.current += text;
              scheduleFlush();
              continue;
            }

            if (frame.event === "error") {
              const detail = tokenText(frame.data);
              errorRef.current = detail === "" ? "Stream failed" : detail;
              setError(errorRef.current);
            }
          }
        }

        if (controller.signal.aborted) {
          settle("aborted");
          return;
        }

        const tail = decoder.decode();
        if (tail !== "") {
          const { frames } = parseSseChunk(pending + tail);
          for (const frame of frames) onEvent?.(frame);
        }

        settle(errorRef.current === null ? "completed" : "error");
      } catch (cause) {
        if (controller.signal.aborted) {
          settle("aborted");
          return;
        }
        const message = cause instanceof Error ? cause.message : "Network error";
        errorRef.current = message;
        setError(message);
        settle("error");
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null;
      }
    },
    // Every dependency here is stable (refs + useCallback with no changing
    // inputs), so the callback identity survives re-renders and the buffered
    // stream is never torn down mid-flight.
    [abort, cancelFrame, scheduleFlush, settle],
  );

  // Abort the stream when the consumer unmounts.
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      if (frameRef.current !== null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return { status, content, metrics, error, httpStatus, executeStream, abort, reset };
}
