export const APP_NAME = "tl.chat";

export const THEME_OPTIONS = [
  { value: "warm-light", label: "Warm Light" },
  { value: "graphite-dark", label: "Graphite Dark" },
  { value: "system", label: "System" },
] as const;

export type ThemePreference = (typeof THEME_OPTIONS)[number]["value"];

export const DEFAULT_THEME: ThemePreference = "warm-light";
