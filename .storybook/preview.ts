import type { Preview } from "@storybook/react-vite";

import "../src/index.css";

/**
 * FlowForge UI — Storybook preview.
 *
 * Every story renders on the canvas surface with the dot-grid, so the design
 * system is reviewed in its real context rather than on a neutral white page.
 */
const preview: Preview = {
  parameters: {
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
      expanded: true,
    },
    backgrounds: {
      options: {
        canvas: { name: "canvas", value: "#0A0A0B" },
        panel: { name: "panel", value: "#121215" },
        elevated: { name: "elevated", value: "#18181C" },
      },
    },
    viewport: {
      options: {
        canvas: { name: "Canvas", styles: { width: "1280px", height: "800px" }, type: "desktop" },
      },
    },
    layout: "centered",
    options: {
      storySort: {
        order: ["Design System", ["Tokens", "*"]],
      },
    },
  },
  initialGlobals: {
    backgrounds: { value: "canvas" },
  },
};

export default preview;
