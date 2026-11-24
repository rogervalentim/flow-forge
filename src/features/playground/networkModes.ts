/** Network conditions exposed by the mock layer (`x-mock-scenario`). */
export const NETWORK_MODES = [
  { value: "normal", label: "Normal" },
  { value: "slow", label: "Slow" },
  { value: "rate-limit", label: "429 Error" },
] as const;

export type NetworkMode = (typeof NETWORK_MODES)[number]["value"];
