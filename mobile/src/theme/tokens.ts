/**
 * "Two Skies" design tokens, ported from the web app's globals.css.
 * One sky split across two time zones: warm dusk → cool dawn over deep night.
 * The mobile app ships the dark "night" palette as its single look.
 */
export const colors = {
  ink: "#0b0c1a",
  ink2: "#10122a",
  bg: "#0b0c1a",
  bgSoft: "#14162c",
  card: "#181a34", // opaque equivalent of the web's translucent card
  cardSolid: "#161834",

  // Dusk (evening) → Dawn (morning)
  dusk: "#ffae73",
  duskDeep: "#ff7a8a",
  dawn: "#8fa6ff",
  dawnDeep: "#6ce0d0",

  accent: "#ff7a8a",
  accentStrong: "#ffb38a",
  accentSoft: "rgba(255, 122, 138, 0.14)",

  text: "#f3eee7",
  textDim: "#c5c4dd",
  muted: "#8d8fb4",
  danger: "#ff8d9b",

  border: "rgba(159, 169, 232, 0.16)",
  borderStrong: "rgba(159, 169, 232, 0.32)",

  // Solid ink used as text/icon color on top of the horizon gradient.
  onAccent: "#1a0f1c",
} as const;

/** The signature horizon sweep, as a stop array for expo-linear-gradient. */
export const horizon = {
  colors: [colors.duskDeep, colors.dusk, colors.dawn, colors.dawnDeep] as const,
  locations: [0, 0.35, 0.72, 1] as const,
  start: { x: 0, y: 0 },
  end: { x: 1, y: 0 },
};

export const radius = {
  lg: 18,
  md: 11,
  pill: 999,
};

export const space = (n: number) => n * 8;
