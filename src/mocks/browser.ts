import { setupWorker } from "msw/browser";

import { handlers } from "./handlers";

/**
 * Browser worker for the demo build.
 *
 * Registered from `main.tsx` before the first render so a Dockerised nginx
 * image serves a fully standalone app — no backend required. The worker file
 * is emitted to `public/mockServiceWorker.js` by `npx msw init public`.
 */
export const worker = setupWorker(...handlers);

let started = false;

export async function startMockServiceWorker(): Promise<boolean> {
  if (started) return true;

  try {
    await worker.start({
      serviceWorker: { url: "/mockServiceWorker.js" },
      quiet: true,
      onUnhandledFrame: "bypass",
    });
    started = true;
    return true;
  } catch (cause) {
    console.warn("[msw] mock worker failed to start; streams will hit the network", cause);
    return false;
  }
}
