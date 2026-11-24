import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import App from "./App";

const container = document.getElementById("root");

if (container === null) {
  throw new Error("FlowForge UI: #root container is missing from index.html");
}

const root = createRoot(container);

/**
 * Boots the MSW worker in every environment (dev, preview, Dockerised nginx) so
 * the demo is fully standalone. The UI is rendered regardless of the worker:
 * if it fails to register, streams surface a network error instead of a blank
 * screen. E2E tests wait for `window.__FLOWFORGE_MOCK__`.
 */
async function bootstrap() {
  const { startMockServiceWorker } = await import("./mocks/browser");
  const ok = await startMockServiceWorker();
  (window as unknown as { __FLOWFORGE_MOCK__?: boolean }).__FLOWFORGE_MOCK__ = ok;

  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
