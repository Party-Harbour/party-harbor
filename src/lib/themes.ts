import type { Event } from "@/db/schema";

export type ThemeKey = Event["theme"];

export type Theme = {
  key: ThemeKey;
  label: string;
  blurb: string;
  /** Headings, primary buttons on guest pages. */
  accent: string;
  accentDeep: string;
  /** "You're invited!" script colour. */
  highlight: string;
  /** Soft panel background. */
  soft: string;
  /** Page background. */
  bg: string;
  /** Chip / badge background. */
  chip: string;
  /** Cover gradient when no photo is set. */
  gradient: [string, string, string];
  /** Decorative glyphs for the cover fallback. */
  glyphs: string;
};

/** The four palettes from the PRD mock-ups (section 7). */
export const THEMES: Record<ThemeKey, Theme> = {
  coastal: {
    key: "coastal",
    label: "Coastal Classic",
    blurb: "Clean, friendly and timeless. Works for any event.",
    accent: "#244d70",
    accentDeep: "#1a3a56",
    highlight: "#e2655a",
    soft: "#e3f2f8",
    bg: "#fff6ee",
    chip: "#a9d6e5",
    gradient: ["#a9d6e5", "#f6bba7", "#fa8b80"],
    glyphs: "⛵🌅",
  },
  sunset: {
    key: "sunset",
    label: "Sunset Warmth",
    blurb: "Warm and inviting. Great for casual and outdoor parties.",
    accent: "#c9463b",
    accentDeep: "#9f3429",
    highlight: "#e8524f",
    soft: "#fbe3de",
    bg: "#fff4ec",
    chip: "#fbd2b3",
    gradient: ["#f7a07a", "#f26d6d", "#4f7d5e"],
    glyphs: "🌴🎈",
  },
  celebration: {
    key: "celebration",
    label: "Celebration Bright",
    blurb: "Playful and festive. Perfect for holidays, birthdays and special occasions.",
    accent: "#5b43a8",
    accentDeep: "#44317f",
    highlight: "#e2559a",
    soft: "#efe9fb",
    bg: "#fdf6ff",
    chip: "#fbd7e6",
    gradient: ["#c9b6f2", "#f27db4", "#bfe3f7"],
    glyphs: "🎉🍪",
  },
  earth: {
    key: "earth",
    label: "Modern Earth",
    blurb: "Sophisticated and cosy. Great for fall and winter events.",
    accent: "#3b6b4a",
    accentDeep: "#2a4f36",
    highlight: "#b97e5a",
    soft: "#e6efe0",
    bg: "#f8f4ec",
    chip: "#e9d7bf",
    gradient: ["#b7d4c0", "#e9d7bf", "#b97e5a"],
    glyphs: "🔥🌲",
  },
};

export function getTheme(key: string | null | undefined): Theme {
  return THEMES[(key ?? "coastal") as ThemeKey] ?? THEMES.coastal;
}

/** Inline CSS custom properties so a subtree can be themed without new classes. */
export function themeVars(theme: Theme): React.CSSProperties {
  return {
    "--t-accent": theme.accent,
    "--t-accent-deep": theme.accentDeep,
    "--t-highlight": theme.highlight,
    "--t-soft": theme.soft,
    "--t-bg": theme.bg,
    "--t-chip": theme.chip,
    "--t-g1": theme.gradient[0],
    "--t-g2": theme.gradient[1],
    "--t-g3": theme.gradient[2],
  } as React.CSSProperties;
}
