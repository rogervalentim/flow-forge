import "@testing-library/jest-dom/vitest";

// `play` interaction tests run in a real browser, so the browser APIs Radix
// relies on are present natively. This file exists to register the DOM
// matchers (toBeVisible, toHaveAttribute, ...) used inside `play` functions.
