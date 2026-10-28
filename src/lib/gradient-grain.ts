/**
 * Core model for the Gradient + Grain studio.
 *
 * Everything here is pure: the same config produces the same CSS, the same
 * SVG noise tile, and the same canvas render. The page only holds state —
 * all of the math lives here so the preview, the copied CSS, and the exported
 * PNG can never drift apart.
 */

export const GRADIENT_TYPES = ["linear", "radial", "conic", "mesh"] as const
export type GradientType = (typeof GRADIENT_TYPES)[number]

export const COLOR_SPACES = ["srgb", "oklab", "oklch"] as const
export type ColorSpace = (typeof COLOR_SPACES)[number]

export const BLEND_MODES = [
  "overlay",
  "soft-light",
  "multiply",
  "screen",
  "hard-light",
  "color-burn",
  "difference",
  "normal",
] as const
export type BlendMode = (typeof BLEND_MODES)[number]

export const NOISE_TYPES = ["fractalNoise", "turbulence"] as const
export type NoiseType = (typeof NOISE_TYPES)[number]

export type Stop = { id: string; color: string; position: number }
export type Blob = { id: string; color: string; x: number; y: number; size: number }

export type GradientConfig = {
  type: GradientType
  /** Linear: direction. Conic: `from` angle. Degrees, CSS semantics (0 = up). */
  angle: number
  /** Radial / conic origin, in percent of the box. */
  centerX: number
  centerY: number
  space: ColorSpace
  stops: Stop[]
  meshBase: string
  blobs: Blob[]
}

export type GrainConfig = {
  /** Overlay opacity, 0–100. */
  opacity: number
  /** Perceptual grain size, 0 (fine) – 100 (coarse). Maps to baseFrequency. */
  size: number
  octaves: number
  contrast: number
  mono: boolean
  type: NoiseType
  blend: BlendMode
}

export type StudioConfig = { gradient: GradientConfig; grain: GrainConfig }

/** The noise tile is a fixed square so the CSS and the canvas tile identically. */
export const NOISE_TILE = 256

/* ---------------------------------------------------------------- color -- */

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "")
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.padEnd(6, "0").slice(0, 6)
  const int = Number.parseInt(full, 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

/** Same color, zero alpha — so a mesh blob fades out without a gray halo. */
export function transparentOf(hex: string): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, 0)`
}

export function hslToHex(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const v = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(255 * v)
      .toString(16)
      .padStart(2, "0")
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

export function isHex(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
}

/* ------------------------------------------------------------- gradient -- */

function interpolation(space: ColorSpace): string {
  return space === "srgb" ? "" : ` in ${space}`
}

function stopList(stops: Stop[]): string {
  return [...stops]
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.color} ${s.position}%`)
    .join(", ")
}

/** The `background-image` value — one layer, or several for a mesh. */
export function gradientCss(g: GradientConfig): string {
  if (g.type === "mesh") {
    return g.blobs
      .map(
        (b) =>
          `radial-gradient(circle at ${b.x}% ${b.y}%, ${b.color} 0%, ${transparentOf(b.color)} ${b.size}%)`
      )
      .join(",\n    ")
  }

  const stops = stopList(g.stops)
  const space = interpolation(g.space)

  if (g.type === "linear") return `linear-gradient(${g.angle}deg${space}, ${stops})`
  if (g.type === "radial")
    return `radial-gradient(circle at ${g.centerX}% ${g.centerY}%${space}, ${stops})`
  return `conic-gradient(from ${g.angle}deg at ${g.centerX}% ${g.centerY}%${space}, ${stops})`
}

/** Mesh needs a base fill under the blobs; the others paint edge to edge. */
export function gradientBackgroundColor(g: GradientConfig): string | undefined {
  return g.type === "mesh" ? g.meshBase : undefined
}

/* ---------------------------------------------------------------- grain -- */

/** Coarse grain is low-frequency turbulence; the curve keeps the slider even. */
export function baseFrequency(size: number): number {
  const freq = 2 * Math.pow(0.06, Math.min(100, Math.max(0, size)) / 100)
  return Math.round(freq * 1000) / 1000
}

/** The noise tile as standalone SVG markup. */
export function noiseSvg(grain: GrainConfig, tile = NOISE_TILE): string {
  const freq = baseFrequency(grain.size)
  const slope = grain.contrast / 100
  const intercept = 0.5 - slope / 2
  const desaturate = grain.mono ? '<feColorMatrix type="saturate" values="0"/>' : ""
  const transfer = ["R", "G", "B"]
    .map((c) => `<feFunc${c} type="linear" slope="${slope}" intercept="${intercept}"/>`)
    .join("")

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="${tile}" viewBox="0 0 ${tile} ${tile}">` +
    `<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="${grain.type}" baseFrequency="${freq}" numOctaves="${grain.octaves}" stitchTiles="stitch"/>` +
    desaturate +
    `<feComponentTransfer>${transfer}<feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer>` +
    `</filter>` +
    `<rect width="100%" height="100%" filter="url(#grain)"/>` +
    `</svg>`
  )
}

export function noiseDataUri(grain: GrainConfig, tile = NOISE_TILE): string {
  return `data:image/svg+xml,${encodeURIComponent(noiseSvg(grain, tile))}`
}

/* --------------------------------------------------------------- export -- */

/** A drop-in CSS rule: the gradient on the element, the grain on ::after. */
export function exportCss(config: StudioConfig, selector = ".gradient-grain"): string {
  const { gradient, grain } = config
  const base = gradientBackgroundColor(gradient)
  const lines = [
    `${selector} {`,
    `  position: relative;`,
    `  isolation: isolate;`,
  ]
  if (base) lines.push(`  background-color: ${base};`)
  lines.push(`  background-image: ${gradientCss(gradient)};`, `}`)

  if (grain.opacity > 0) {
    lines.push(
      ``,
      `${selector}::after {`,
      `  content: "";`,
      `  position: absolute;`,
      `  inset: 0;`,
      `  pointer-events: none;`,
      `  background-image: url("${noiseDataUri(grain)}");`,
      `  background-size: ${NOISE_TILE}px ${NOISE_TILE}px;`,
      `  opacity: ${(grain.opacity / 100).toFixed(2)};`,
      `  mix-blend-mode: ${grain.blend};`,
      `}`
    )
  }

  return lines.join("\n")
}

/* --------------------------------------------------------------- canvas -- */

function compositeFor(blend: BlendMode): GlobalCompositeOperation {
  return blend === "normal" ? "source-over" : (blend as GlobalCompositeOperation)
}

function addStops(ramp: CanvasGradient, stops: Stop[]) {
  for (const stop of [...stops].sort((a, b) => a.position - b.position)) {
    ramp.addColorStop(Math.min(1, Math.max(0, stop.position / 100)), stop.color)
  }
}

/**
 * Paint the gradient onto a 2D context. Canvas only interpolates in sRGB, so an
 * oklch/oklab gradient renders slightly differently here than in the browser —
 * the UI says so next to the download button.
 */
export function paintGradient(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  g: GradientConfig
) {
  ctx.clearRect(0, 0, w, h)

  if (g.type === "mesh") {
    ctx.fillStyle = g.meshBase
    ctx.fillRect(0, 0, w, h)
    for (const blob of g.blobs) {
      const cx = (blob.x / 100) * w
      const cy = (blob.y / 100) * h
      const radius = (blob.size / 100) * Math.max(w, h)
      const ramp = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, radius))
      ramp.addColorStop(0, blob.color)
      ramp.addColorStop(1, transparentOf(blob.color))
      ctx.fillStyle = ramp
      ctx.fillRect(0, 0, w, h)
    }
    return
  }

  const cx = (g.centerX / 100) * w
  const cy = (g.centerY / 100) * h

  if (g.type === "linear") {
    // CSS: 0deg points up, angles run clockwise; the line is long enough that
    // the 0% and 100% stops land exactly on the box edges.
    const rad = (g.angle * Math.PI) / 180
    const dx = Math.sin(rad)
    const dy = -Math.cos(rad)
    const length = Math.abs(w * dx) + Math.abs(h * dy)
    const ramp = ctx.createLinearGradient(
      w / 2 - (dx * length) / 2,
      h / 2 - (dy * length) / 2,
      w / 2 + (dx * length) / 2,
      h / 2 + (dy * length) / 2
    )
    addStops(ramp, g.stops)
    ctx.fillStyle = ramp
    ctx.fillRect(0, 0, w, h)
    return
  }

  if (g.type === "radial") {
    // farthest-corner, matching the CSS default sizing keyword.
    const radius = Math.max(
      Math.hypot(cx, cy),
      Math.hypot(w - cx, cy),
      Math.hypot(cx, h - cy),
      Math.hypot(w - cx, h - cy)
    )
    const ramp = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, radius))
    addStops(ramp, g.stops)
    ctx.fillStyle = ramp
    ctx.fillRect(0, 0, w, h)
    return
  }

  // Conic: canvas starts at 3 o'clock, CSS at 12 o'clock.
  const ramp = ctx.createConicGradient((((g.angle - 90) % 360) * Math.PI) / 180, cx, cy)
  addStops(ramp, g.stops)
  ctx.fillStyle = ramp
  ctx.fillRect(0, 0, w, h)
}

/** Fallback when the browser refuses to rasterize a filtered SVG into canvas. */
function paintWhiteNoise(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  grain: GrainConfig
) {
  const scratch = document.createElement("canvas")
  scratch.width = NOISE_TILE
  scratch.height = NOISE_TILE
  const sctx = scratch.getContext("2d")
  if (!sctx) return
  const image = sctx.createImageData(NOISE_TILE, NOISE_TILE)
  const slope = grain.contrast / 100
  for (let i = 0; i < image.data.length; i += 4) {
    const base = Math.random()
    const value = Math.round(255 * Math.min(1, Math.max(0, 0.5 + (base - 0.5) * slope)))
    image.data[i] = value
    image.data[i + 1] = grain.mono ? value : Math.round(255 * Math.random())
    image.data[i + 2] = grain.mono ? value : Math.round(255 * Math.random())
    image.data[i + 3] = 255
  }
  sctx.putImageData(image, 0, 0)
  const pattern = ctx.createPattern(scratch, "repeat")
  if (!pattern) return
  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, w, h)
}

export async function paintGrain(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  grain: GrainConfig
) {
  if (grain.opacity <= 0) return

  ctx.save()
  ctx.globalAlpha = grain.opacity / 100
  ctx.globalCompositeOperation = compositeFor(grain.blend)

  try {
    const img = new Image()
    img.src = noiseDataUri(grain)
    await img.decode()
    const pattern = ctx.createPattern(img, "repeat")
    if (!pattern) throw new Error("pattern unavailable")
    ctx.fillStyle = pattern
    ctx.fillRect(0, 0, w, h)
  } catch {
    paintWhiteNoise(ctx, w, h, grain)
  }

  ctx.restore()
}

export async function renderToBlob(
  config: StudioConfig,
  w: number,
  h: number
): Promise<Blob_ | null> {
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  paintGradient(ctx, w, h, config.gradient)
  await paintGrain(ctx, w, h, config.grain)

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"))
}

// `Blob` is taken by the mesh type above, so the DOM one gets an alias.
type Blob_ = globalThis.Blob
