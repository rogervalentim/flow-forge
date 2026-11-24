import { useCallback, useEffect, useRef, useState } from "react";

export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 1.8;
export const ZOOM_STEP = 0.1;
/** Delay before the zoom readout is pushed to React state. */
export const ZOOM_DEBOUNCE_MS = 120;

export interface Point {
  x: number;
  y: number;
}

export interface CanvasViewportOptions {
  initialPan?: Point;
  initialZoom?: number;
  minZoom?: number;
  maxZoom?: number;
  debounceMs?: number;
}

export interface UseCanvasViewportResult {
  /** Attach to the transformed layer. */
  layerRef: React.RefObject<HTMLDivElement | null>;
  /** Attach to the pannable background (drag to pan). */
  surfaceRef: React.RefObject<HTMLDivElement | null>;
  /** Debounced zoom readout for UI display (e.g. `125%`). */
  zoomPercent: number;
  /** Immediate zoom value — updated on every wheel tick, without transform churn. */
  zoom: number;
  /** Live pan value (updated by pointer drags). */
  pan: Point;
  isPanning: boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  resetViewport: () => void;
  /** Applies an absolute transform immediately (used after a state change). */
  applyTransform: () => void;
  screenToCanvas: (clientX: number, clientY: number) => Point;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * `useCanvasViewport` — pan & zoom without re-rendering on every frame.
 *
 * The transform lives in refs and is written straight to the DOM
 * (`translate3d(...) scale(...)`), so dragging and wheeling never go through
 * React. Only the debounced `zoomPercent` readout is state.
 */
export function useCanvasViewport(
  options: CanvasViewportOptions = {},
): UseCanvasViewportResult {
  const {
    initialPan = { x: 0, y: 0 },
    initialZoom = 1,
    minZoom = MIN_ZOOM,
    maxZoom = MAX_ZOOM,
    debounceMs = ZOOM_DEBOUNCE_MS,
  } = options;

  const layerRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  const panRef = useRef<Point>({ ...initialPan });
  const zoomRef = useRef<number>(clamp(initialZoom, minZoom, maxZoom));

  // Mirrored into state so the returned values are render-safe; the hot path
  // still reads the refs and writes the DOM directly.
  const [zoomPercent, setZoomPercent] = useState(() => Math.round(clamp(initialZoom, minZoom, maxZoom) * 100));
  const [zoom, setZoom] = useState(() => clamp(initialZoom, minZoom, maxZoom));
  const [pan, setPan] = useState<Point>(() => ({ ...initialPan }));
  const [isPanning, setIsPanning] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(
    null,
  );

  const writeTransform = useCallback(() => {
    const layer = layerRef.current;
    if (layer === null) return;
    const { x, y } = panRef.current;
    layer.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${zoomRef.current})`;
  }, []);

  const scheduleZoomReadout = useCallback(() => {
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      setZoomPercent(Math.round(zoomRef.current * 100));
    }, debounceMs);
  }, [debounceMs]);

  const applyZoom = useCallback(
    (next: number, anchor?: Point) => {
      const clamped = clamp(next, minZoom, maxZoom);
      if (clamped === zoomRef.current) return;

      const surface = surfaceRef.current;
      const rect = surface?.getBoundingClientRect();

      // Zoom around the pointer (or the viewport centre) so the graph does not
      // jump away from the cursor.
      if (rect !== undefined && rect.width > 0 && rect.height > 0) {
        const px = (anchor?.x ?? rect.width / 2);
        const py = (anchor?.y ?? rect.height / 2);
        const ratio = clamped / zoomRef.current;
        panRef.current = {
          x: px - (px - panRef.current.x) * ratio,
          y: py - (py - panRef.current.y) * ratio,
        };
      }

      zoomRef.current = clamped;
      writeTransform();
      setZoom(clamped);
      scheduleZoomReadout();
    },
    [maxZoom, minZoom, scheduleZoomReadout, writeTransform],
  );

  const zoomIn = useCallback(() => {
    applyZoom(zoomRef.current + ZOOM_STEP);
  }, [applyZoom]);

  const zoomOut = useCallback(() => {
    applyZoom(zoomRef.current - ZOOM_STEP);
  }, [applyZoom]);

  const resetViewport = useCallback(() => {
    panRef.current = { ...initialPan };
    zoomRef.current = clamp(initialZoom, minZoom, maxZoom);
    writeTransform();
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    debounceRef.current = null;
    setZoomPercent(Math.round(zoomRef.current * 100));
    setZoom(zoomRef.current);
    setPan({ ...panRef.current });
  }, [initialPan, initialZoom, maxZoom, minZoom, writeTransform]);

  const screenToCanvas = useCallback((clientX: number, clientY: number): Point => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    const left = rect?.left ?? 0;
    const top = rect?.top ?? 0;
    return {
      x: (clientX - left - panRef.current.x) / zoomRef.current,
      y: (clientY - top - panRef.current.y) / zoomRef.current,
    };
  }, []);

  // Initial paint once the layer is mounted.
  useEffect(() => {
    writeTransform();
  }, [writeTransform]);

  // Wheel zoom — non-passive listener so the browser page never scrolls.
  useEffect(() => {
    const surface = surfaceRef.current;
    if (surface === null) return;

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        // Trackpad pinch: native browser zoom must not fire.
        event.preventDefault();
      }
      event.preventDefault();

      const rect = surface.getBoundingClientRect();
      const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const intensity = event.deltaMode === 1 ? 16 : 1;
      const delta = -event.deltaY * intensity;
      const next = zoomRef.current * (1 + Math.sign(delta) * ZOOM_STEP);
      applyZoom(next, anchor);
    };

    surface.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      surface.removeEventListener("wheel", onWheel);
    };
  }, [applyZoom]);

  // Pointer drag panning.
  useEffect(() => {
    const surface = surfaceRef.current;
    if (surface === null) return;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      // Nodes and controls own their own pointer gestures.
      if (target?.closest("[data-canvas-node],button,a,input,textarea,select") !== null) return;

      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: panRef.current.x,
        originY: panRef.current.y,
      };
      surface.setPointerCapture(event.pointerId);
      setIsPanning(true);
    };

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (drag === null || drag.pointerId !== event.pointerId) return;

      panRef.current = {
        x: drag.originX + (event.clientX - drag.startX),
        y: drag.originY + (event.clientY - drag.startY),
      };
      writeTransform();
      setPan({ ...panRef.current });
    };

    const endDrag = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (drag === null || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      if (surface.hasPointerCapture(event.pointerId)) {
        surface.releasePointerCapture(event.pointerId);
      }
      setIsPanning(false);
    };

    surface.addEventListener("pointerdown", onPointerDown);
    surface.addEventListener("pointermove", onPointerMove);
    surface.addEventListener("pointerup", endDrag);
    surface.addEventListener("pointercancel", endDrag);
    return () => {
      surface.removeEventListener("pointerdown", onPointerDown);
      surface.removeEventListener("pointermove", onPointerMove);
      surface.removeEventListener("pointerup", endDrag);
      surface.removeEventListener("pointercancel", endDrag);
    };
  }, [writeTransform]);

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    };
  }, []);

  return {
    layerRef,
    surfaceRef,
    zoomPercent,
    zoom,
    pan,
    isPanning,
    zoomIn,
    zoomOut,
    resetViewport,
    applyTransform: writeTransform,
    screenToCanvas,
  };
}
