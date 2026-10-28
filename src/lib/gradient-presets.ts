/**
 * Starting points for the Gradient + Grain studio.
 *
 * The hex values here are *content*, not UI styling — they are the artwork the
 * tool edits, the same way a photo editor ships sample images. Everything that
 * styles the studio's own chrome still comes from tokens.
 */

import {
  hslToHex,
  type Blob,
  type GradientConfig,
  type GrainConfig,
  type Stop,
  type StudioConfig,
} from "./gradient-grain"

export type Preset = { name: string; note: string; config: StudioConfig }

let seq = 0
export function uid(prefix = "id"): string {
  seq += 1
  return `${prefix}-${seq}-${Math.random().toString(36).slice(2, 7)}`
}

function stops(...colors: string[]) {
  return colors.map((color, i) => ({
    id: `s${i}`,
    color,
    position: colors.length === 1 ? 0 : Math.round((i / (colors.length - 1)) * 100),
  }))
}

const defaultGrain: GrainConfig = {
  opacity: 18,
  size: 34,
  octaves: 4,
  contrast: 100,
  mono: true,
  type: "fractalNoise",
  blend: "overlay",
}

function gradient(partial: Partial<GradientConfig>): GradientConfig {
  return {
    type: "linear",
    angle: 135,
    centerX: 50,
    centerY: 50,
    space: "oklch",
    stops: stops("#6366f1", "#ec4899"),
    meshBase: "#111827",
    blobs: [],
    ...partial,
  }
}

export const presets: Preset[] = [
  {
    name: "Dusk",
    note: "Linear, oklch — the default soft two-stop sweep.",
    config: {
      gradient: gradient({ angle: 135, stops: stops("#5b4bdb", "#c84b8f", "#f2a65a") }),
      grain: { ...defaultGrain, opacity: 20, size: 32 },
    },
  },
  {
    name: "Paper",
    note: "Near-neutral with heavy mono grain — print stock, not a screen.",
    config: {
      gradient: gradient({ angle: 180, space: "oklab", stops: stops("#f6f1e7", "#ded5c4") }),
      grain: { ...defaultGrain, opacity: 42, size: 12, contrast: 130, blend: "multiply" },
    },
  },
  {
    name: "Ember",
    note: "Radial falloff from a hot off-center core.",
    config: {
      gradient: gradient({
        type: "radial",
        centerX: 32,
        centerY: 24,
        stops: stops("#ffb347", "#d6295e", "#1b0b1f"),
      }),
      grain: { ...defaultGrain, opacity: 24, size: 40, blend: "soft-light" },
    },
  },
  {
    name: "Aurora",
    note: "Four mesh blobs over a deep base — the look you can't get from one gradient.",
    config: {
      gradient: gradient({
        type: "mesh",
        meshBase: "#0b1220",
        blobs: [
          { id: "b1", color: "#2dd4bf", x: 18, y: 24, size: 58 },
          { id: "b2", color: "#6366f1", x: 78, y: 18, size: 54 },
          { id: "b3", color: "#ec4899", x: 70, y: 76, size: 50 },
          { id: "b4", color: "#22d3ee", x: 24, y: 82, size: 46 },
        ],
      }),
      grain: { ...defaultGrain, opacity: 22, size: 36 },
    },
  },
  {
    name: "Spool",
    note: "Conic sweep — a color wheel with the edge taken off.",
    config: {
      gradient: gradient({
        type: "conic",
        angle: 215,
        stops: stops("#f97316", "#a855f7", "#0ea5e9", "#f97316"),
      }),
      grain: { ...defaultGrain, opacity: 26, size: 28, blend: "soft-light" },
    },
  },
  {
    name: "Monad",
    note: "Grayscale, system-native — reads as a surface, not as decoration.",
    config: {
      gradient: gradient({ angle: 160, space: "oklab", stops: stops("#2a2a2a", "#0b0b0b") }),
      grain: { ...defaultGrain, opacity: 30, size: 22, contrast: 115 },
    },
  },
]

export const defaultConfig: StudioConfig = presets[0].config

/**
 * The palettes "Reset colors" restores. They are kept apart from the presets so
 * resetting colors leaves the gradient type, geometry, and grain exactly as the
 * user left them — only the colors go back.
 */
export const defaultPalette = ["#5b4bdb", "#c84b8f", "#f2a65a"]
export const defaultMeshPalette = {
  base: "#0b1220",
  colors: ["#2dd4bf", "#6366f1", "#ec4899", "#22d3ee"],
}

/**
 * A pleasing-by-construction palette: one hue family, controlled spread, and a
 * consistent light-to-dark direction, rather than `count` independent darts.
 * The returned `base` suits a mesh backdrop for the same family.
 */
export function randomPalette(count: number): { colors: string[]; base: string } {
  const n = Math.max(1, count)
  const hue = Math.floor(Math.random() * 360)
  const spread = 40 + Math.random() * 90
  const dark = Math.random() > 0.55

  const colors = Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : i / (n - 1)
    return hslToHex(
      (hue + t * spread) % 360,
      55 + Math.random() * 35,
      dark ? 18 + t * 40 : 70 - t * 35
    )
  })

  return { colors, base: dark ? hslToHex(hue, 35, 10) : hslToHex(hue, 25, 92) }
}

/**
 * Carry a stop palette into mesh mode, so switching type never costs the user
 * the colors they picked. Positions are spread around the box rather than
 * stacked, which is the whole point of a mesh.
 */
export function meshFromStops(stops: Stop[]): Blob[] {
  const spots: [number, number][] = [
    [22, 26],
    [76, 22],
    [70, 74],
    [26, 78],
    [50, 48],
    [86, 54],
  ]
  return stops.map((stop, i) => ({
    id: uid("blob"),
    color: stop.color,
    x: spots[i % spots.length][0],
    y: spots[i % spots.length][1],
    size: 54,
  }))
}

/** Randomize geometry and colors together, in whichever mode is active. */
export function randomConfig(current: StudioConfig): StudioConfig {
  const isMesh = current.gradient.type === "mesh"
  const stopCount = 3 + Math.floor(Math.random() * 2)
  const blobCount = Math.max(1, current.gradient.blobs.length || 4)
  const { colors, base } = randomPalette(isMesh ? blobCount : stopCount)

  return {
    gradient: {
      ...current.gradient,
      angle: Math.round(Math.random() * 360),
      centerX: Math.round(25 + Math.random() * 50),
      centerY: Math.round(25 + Math.random() * 50),
      meshBase: isMesh ? base : current.gradient.meshBase,
      stops: isMesh
        ? current.gradient.stops
        : colors.map((color, i) => ({
            id: uid("stop"),
            color,
            position: Math.round((i / (colors.length - 1)) * 100),
          })),
      blobs: isMesh
        ? Array.from({ length: blobCount }, (_, i) => ({
            id: uid("blob"),
            color: colors[i % colors.length],
            x: Math.round(15 + Math.random() * 70),
            y: Math.round(15 + Math.random() * 70),
            size: Math.round(40 + Math.random() * 25),
          }))
        : current.gradient.blobs,
    },
    grain: {
      ...current.grain,
      opacity: Math.round(14 + Math.random() * 24),
      size: Math.round(18 + Math.random() * 30),
    },
  }
}
