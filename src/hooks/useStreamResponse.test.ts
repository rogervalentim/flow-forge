import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { parseSseChunk, tokenText, useStreamResponse } from "./useStreamResponse";

/** Builds a `Response` whose body streams the given chunks. */
function streamingResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status, headers: { "Content-Type": "text/event-stream" } });
}

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

describe("parseSseChunk", () => {
  it("splits complete frames and keeps the remainder", () => {
    const { frames, rest } = parseSseChunk(
      `event: node_start\ndata: {"nodeId":"n1"}\n\nevent: token\ndata: {"token":"Hel"}\n\nevent: tok`,
    );

    expect(frames).toHaveLength(2);
    expect(frames[0]).toEqual({ event: "node_start", data: '{"nodeId":"n1"}' });
    expect(frames[1]?.event).toBe("token");
    expect(rest).toBe("event: tok");
  });

  it("joins multi-line data and skips comments", () => {
    const { frames } = parseSseChunk(": keep-alive\ndata: line one\ndata: line two\n\n");
    expect(frames[0]).toEqual({ event: "message", data: "line one\nline two" });
  });
});

describe("tokenText", () => {
  it("extracts token fields from JSON payloads", () => {
    expect(tokenText('{"token":"Hello"}')).toBe("Hello");
    expect(tokenText('{"text":" world"}')).toBe(" world");
    expect(tokenText('{"delta":"!"}')).toBe("!");
  });

  it("falls back to the raw frame", () => {
    expect(tokenText("plain text")).toBe("plain text");
  });
});

describe("useStreamResponse", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Flush synchronously so assertions do not depend on the frame clock.
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("starts idle with empty metrics", () => {
    const { result } = renderHook(() => useStreamResponse());

    expect(result.current.status).toBe("idle");
    expect(result.current.content).toBe("");
    expect(result.current.metrics).toEqual({
      ttftMs: null,
      totalLatencyMs: null,
      tokenCount: 0,
      tokensPerSecond: 0,
    });
  });

  it("streams tokens, records metrics and completes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      streamingResponse([
        sse("node_start", { nodeId: "n1" }),
        sse("token", { token: "Hello" }),
        sse("token", { token: " world" }),
        sse("node_complete", { nodeId: "n1" }),
        sse("done", { nodes: 1 }),
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const events: string[] = [];
    const onSettled = vi.fn();
    const { result } = renderHook(() => useStreamResponse());

    await act(async () => {
      await result.current.executeStream({
        body: { nodes: [], edges: [] },
        onEvent: (event) => events.push(event.event),
        onSettled,
      });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/workflows/execute",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.current.status).toBe("completed");
    expect(result.current.content).toBe("Hello world");
    expect(result.current.httpStatus).toBe(200);
    expect(result.current.metrics.tokenCount).toBe(2);
    expect(result.current.metrics.ttftMs).not.toBeNull();
    expect(result.current.metrics.totalLatencyMs).not.toBeNull();
    // A synchronous mock body settles in ~0 ms, so tokens/s is reported as 0
    // rather than Infinity; the field must still be a finite number.
    expect(Number.isFinite(result.current.metrics.tokensPerSecond)).toBe(true);
    expect(events).toEqual(["node_start", "token", "token", "node_complete", "done"]);
    expect(onSettled).toHaveBeenCalledWith("completed");
  });

  it("forwards the scenario header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(streamingResponse([sse("done", {})]));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useStreamResponse());

    await act(async () => {
      await result.current.executeStream({ headers: { "x-mock-scenario": "slow" } });
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toMatchObject({ "x-mock-scenario": "slow" });
  });

  it("surfaces a 429 with Retry-After as an error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Too Many Requests", {
        status: 429,
        headers: { "Retry-After": "3" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useStreamResponse());

    await act(async () => {
      await result.current.executeStream({ headers: { "x-mock-scenario": "rate-limit" } });
    });

    expect(result.current.status).toBe("error");
    expect(result.current.httpStatus).toBe(429);
    expect(result.current.error).toContain("429");
    expect(result.current.error).toContain("3");
  });

  it("aborts an in-flight stream", async () => {
    // A body that never closes until the request is aborted.
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      const signal = init.signal;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(sse("token", { token: "partial" })));
          signal?.addEventListener("abort", () => {
            controller.error(new DOMException("Aborted", "AbortError"));
          });
        },
      });
      return Promise.resolve(new Response(body, { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useStreamResponse());

    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current.executeStream({});
    });

    await act(async () => {
      await Promise.resolve();
      result.current.abort();
      await pending;
    });

    expect(result.current.status).toBe("aborted");
  });

  it("cancels the previous stream when a new one starts", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(streamingResponse([sse("token", { token: "first" })]))
      .mockResolvedValueOnce(streamingResponse([sse("token", { token: "second" })]));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useStreamResponse());

    await act(async () => {
      await result.current.executeStream({});
      await result.current.executeStream({});
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.content).toBe("second");
  });

  it("reports a network failure as an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const { result } = renderHook(() => useStreamResponse());

    await act(async () => {
      await result.current.executeStream({});
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("offline");
  });

  it("resets back to idle", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(streamingResponse([sse("token", { token: "x" })])),
    );

    const { result } = renderHook(() => useStreamResponse());

    await act(async () => {
      await result.current.executeStream({});
    });
    expect(result.current.content).toBe("x");

    act(() => result.current.reset());

    expect(result.current.status).toBe("idle");
    expect(result.current.content).toBe("");
    expect(result.current.metrics.tokenCount).toBe(0);
  });
});
