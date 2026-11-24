import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

// Radix primitives read these APIs; jsdom does not implement them.
if (typeof window !== "undefined") {
  Object.assign(window.HTMLElement.prototype, {
    scrollIntoView: () => undefined,
    hasPointerCapture: () => false,
    releasePointerCapture: () => undefined,
    setPointerCapture: () => undefined,
  });
  if (typeof window.matchMedia !== "function") {
    const matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: matchMedia,
    });
  }
}
