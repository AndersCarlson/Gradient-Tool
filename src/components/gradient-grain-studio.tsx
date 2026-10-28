"use client"

import * as React from "react"
import { CheckIcon, CopyIcon, DownloadIcon, PlusIcon, RotateCcwIcon, ShuffleIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import {
  BLEND_MODES,
  COLOR_SPACES,
  GRADIENT_TYPES,
  NOISE_TILE,
  exportCss,
  gradientBackgroundColor,
  gradientCss,
  isHex,
  noiseDataUri,
  renderToBlob,
  type BlendMode,
  type ColorSpace,
  type GradientType,
  type StudioConfig,
} from "@/lib/gradient-grain"
import { defaultConfig, presets, randomConfig, uid } from "@/lib/gradient-presets"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

// The value doubles as the label, so SelectValue reads right without a map.
const EXPORT_SIZES = ["1920 × 1080", "2560 × 1440", "1200 × 1200", "1080 × 1920", "800 × 400"]

function parseSize(label: string): [number, number] {
  const [w, h] = label.split("×").map((part) => Number(part.trim()))
  return [w, h]
}

/** Base UI hands back a scalar or an array depending on thumb count. */
function one(value: number | readonly number[]): number {
  return Array.isArray(value) ? value[0] : (value as number)
}

function many(value: number | readonly number[]): number[] {
  return Array.isArray(value) ? [...value] : [value as number]
}

function Field({
  label,
  readout,
  children,
}: {
  label: string
  readout?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {readout ? (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{readout}</span>
        ) : null}
      </div>
      {children}
    </div>
  )
}

/**
 * The kit has no color picker, so this wraps the native one rather than
 * inventing a new primitive — the swatch is the visible control, the input
 * sits transparent on top of it.
 */
function ColorWell({
  value,
  onChange,
  className,
  label,
}: {
  value: string
  onChange: (hex: string) => void
  className?: string
  label: string
}) {
  return (
    <span
      className={cn(
        "relative inline-flex size-8 shrink-0 overflow-hidden rounded-md border border-border shadow-xs",
        className
      )}
      style={{ backgroundColor: value }}
    >
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="size-full cursor-pointer opacity-0"
      />
    </span>
  )
}

/** Keeps a free-text draft so a half-typed hex doesn't blow away the color. */
function HexInput({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [draft, setDraft] = React.useState(value)
  React.useEffect(() => setDraft(value), [value])

  return (
    <Input
      value={draft}
      spellCheck={false}
      aria-label="Hex value"
      onChange={(event) => {
        const next = event.target.value
        setDraft(next)
        if (isHex(next)) onChange(next.toLowerCase())
      }}
      onBlur={() => setDraft(value)}
      className="w-[6.5rem] font-mono text-xs"
    />
  )
}

export function GradientGrainStudio() {
  const [config, setConfig] = React.useState<StudioConfig>(defaultConfig)
  const [exportSize, setExportSize] = React.useState<string>(EXPORT_SIZES[0])
  const [copied, setCopied] = React.useState(false)
  const [rendering, setRendering] = React.useState(false)

  const { gradient, grain } = config

  const setGradient = React.useCallback(
    (patch: Partial<StudioConfig["gradient"]>) =>
      setConfig((prev) => ({ ...prev, gradient: { ...prev.gradient, ...patch } })),
    []
  )
  const setGrain = React.useCallback(
    (patch: Partial<StudioConfig["grain"]>) =>
      setConfig((prev) => ({ ...prev, grain: { ...prev.grain, ...patch } })),
    []
  )

  // Stops stay sorted so the multi-thumb slider maps straight onto them.
  const sortStops = (stops: StudioConfig["gradient"]["stops"]) =>
    [...stops].sort((a, b) => a.position - b.position)

  const backgroundImage = React.useMemo(() => gradientCss(gradient), [gradient])
  const backgroundColor = gradientBackgroundColor(gradient)
  const noiseUrl = React.useMemo(() => noiseDataUri(grain), [grain])
  const css = React.useMemo(() => exportCss(config), [config])
  const rampPreview = React.useMemo(
    () =>
      `linear-gradient(90deg, ${sortStops(gradient.stops)
        .map((s) => `${s.color} ${s.position}%`)
        .join(", ")})`,
    [gradient.stops]
  )

  const usesStops = gradient.type !== "mesh"
  const usesAngle = gradient.type === "linear" || gradient.type === "conic"
  const usesCenter = gradient.type === "radial" || gradient.type === "conic"

  async function copyCss() {
    try {
      await navigator.clipboard.writeText(css)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
      toast.success("CSS copied to clipboard")
    } catch {
      toast.error("Couldn't reach the clipboard")
    }
  }

  async function downloadPng() {
    const [w, h] = parseSize(exportSize)
    setRendering(true)
    try {
      const blob = await renderToBlob(config, w, h)
      if (!blob) throw new Error("render failed")
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `gradient-grain-${w}x${h}.png`
      link.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${w} × ${h} PNG`)
    } catch {
      toast.error("Export failed — try a smaller size")
    } finally {
      setRendering(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      {/* ------------------------------------------------------- preview -- */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-20">
        <div
          className="relative isolate aspect-[16/10] w-full overflow-hidden rounded-xl border border-border shadow-sm"
          style={{ backgroundColor, backgroundImage }}
        >
          {grain.opacity > 0 ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: `url("${noiseUrl}")`,
                backgroundSize: `${NOISE_TILE}px ${NOISE_TILE}px`,
                opacity: grain.opacity / 100,
                mixBlendMode: grain.blend,
              }}
            />
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfig(randomConfig(config))}>
            <ShuffleIcon />
            Randomize
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConfig(defaultConfig)}>
            <RotateCcwIcon />
            Reset
          </Button>
          <Button variant="outline" size="sm" onClick={copyCss}>
            {copied ? <CheckIcon /> : <CopyIcon />}
            Copy CSS
          </Button>

          <div className="ml-auto flex items-center gap-2">
            <Select
              value={exportSize}
              onValueChange={(value) => setExportSize(String(value))}
            >
              <SelectTrigger size="sm" className="w-[9.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPORT_SIZES.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={downloadPng} disabled={rendering}>
              <DownloadIcon />
              {rendering ? "Rendering…" : "PNG"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.name}
              type="button"
              title={preset.note}
              onClick={() => setConfig(preset.config)}
              className="group flex items-center gap-2 rounded-lg border border-border bg-card p-1 pr-2.5 text-xs font-medium transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span
                className="size-6 rounded-md border border-border"
                style={{
                  backgroundColor: gradientBackgroundColor(preset.config.gradient),
                  backgroundImage: gradientCss(preset.config.gradient),
                }}
              />
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------ controls -- */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Tabs defaultValue="gradient">
            <div className="border-b px-4 py-3">
              <TabsList className="w-full">
                <TabsTrigger value="gradient" className="flex-1">
                  Gradient
                </TabsTrigger>
                <TabsTrigger value="grain" className="flex-1">
                  Grain
                </TabsTrigger>
                <TabsTrigger value="code" className="flex-1">
                  Code
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ---------------------------------------------- gradient -- */}
            <TabsContent value="gradient" className="flex flex-col gap-5 p-4">
              <Field label="Type">
                <ToggleGroup
                  variant="outline"
                  size="sm"
                  spacing={0}
                  value={[gradient.type]}
                  onValueChange={(value) => {
                    const next = (value as string[])[0] as GradientType | undefined
                    if (next) setGradient({ type: next })
                  }}
                >
                  {GRADIENT_TYPES.map((type) => (
                    <ToggleGroupItem key={type} value={type} className="flex-1 capitalize">
                      {type}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>

              {usesAngle ? (
                <Field
                  label={gradient.type === "conic" ? "Start angle" : "Angle"}
                  readout={`${gradient.angle}°`}
                >
                  <Slider
                    value={[gradient.angle]}
                    min={0}
                    max={360}
                    onValueChange={(value) => setGradient({ angle: one(value) })}
                  />
                </Field>
              ) : null}

              {usesCenter ? (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Center X" readout={`${gradient.centerX}%`}>
                    <Slider
                      value={[gradient.centerX]}
                      onValueChange={(value) => setGradient({ centerX: one(value) })}
                    />
                  </Field>
                  <Field label="Center Y" readout={`${gradient.centerY}%`}>
                    <Slider
                      value={[gradient.centerY]}
                      onValueChange={(value) => setGradient({ centerY: one(value) })}
                    />
                  </Field>
                </div>
              ) : null}

              {usesStops ? (
                <>
                  <Field label="Interpolation">
                    <Select
                      value={gradient.space}
                      onValueChange={(value) => setGradient({ space: value as ColorSpace })}
                    >
                      <SelectTrigger size="sm" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COLOR_SPACES.map((space) => (
                          <SelectItem key={space} value={space}>
                            {space === "srgb" ? "sRGB (legacy)" : space}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Separator />

                  <Field label="Stops" readout={`${gradient.stops.length}`}>
                    <div className="flex flex-col gap-3">
                      <div
                        className="h-5 w-full rounded-md border border-border"
                        style={{ backgroundImage: rampPreview }}
                      />
                      <Slider
                        value={sortStops(gradient.stops).map((s) => s.position)}
                        min={0}
                        max={100}
                        onValueChange={(value) => {
                          const next = many(value)
                          setGradient({
                            stops: sortStops(gradient.stops).map((stop, i) => ({
                              ...stop,
                              position: Math.round(next[i] ?? stop.position),
                            })),
                          })
                        }}
                      />
                    </div>
                  </Field>

                  <div className="flex flex-col gap-2">
                    {sortStops(gradient.stops).map((stop) => (
                      <div key={stop.id} className="flex items-center gap-2">
                        <ColorWell
                          label={`Stop color at ${stop.position}%`}
                          value={stop.color}
                          onChange={(hex) =>
                            setGradient({
                              stops: gradient.stops.map((s) =>
                                s.id === stop.id ? { ...s, color: hex } : s
                              ),
                            })
                          }
                        />
                        <HexInput
                          value={stop.color}
                          onChange={(hex) =>
                            setGradient({
                              stops: gradient.stops.map((s) =>
                                s.id === stop.id ? { ...s, color: hex } : s
                              ),
                            })
                          }
                        />
                        <Badge variant="secondary" className="font-mono tabular-nums">
                          {stop.position}%
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="ml-auto"
                          aria-label="Remove stop"
                          disabled={gradient.stops.length <= 2}
                          onClick={() =>
                            setGradient({
                              stops: gradient.stops.filter((s) => s.id !== stop.id),
                            })
                          }
                        >
                          <XIcon />
                        </Button>
                      </div>
                    ))}

                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-1 w-full"
                      disabled={gradient.stops.length >= 8}
                      onClick={() => {
                        const sorted = sortStops(gradient.stops)
                        const last = sorted[sorted.length - 1]
                        const prev = sorted[sorted.length - 2] ?? last
                        setGradient({
                          stops: sortStops([
                            ...gradient.stops,
                            {
                              id: uid("stop"),
                              color: last.color,
                              position: Math.min(
                                100,
                                Math.round((prev.position + last.position) / 2) + 1
                              ),
                            },
                          ]),
                        })
                      }}
                    >
                      <PlusIcon />
                      Add stop
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Field label="Base">
                    <div className="flex items-center gap-2">
                      <ColorWell
                        label="Mesh base color"
                        value={gradient.meshBase}
                        onChange={(hex) => setGradient({ meshBase: hex })}
                      />
                      <HexInput
                        value={gradient.meshBase}
                        onChange={(hex) => setGradient({ meshBase: hex })}
                      />
                      <span className="text-xs text-muted-foreground">
                        Fills behind the blobs
                      </span>
                    </div>
                  </Field>

                  <Separator />

                  <div className="flex flex-col gap-5">
                    {gradient.blobs.map((blob, index) => (
                      <div key={blob.id} className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <ColorWell
                            label={`Blob ${index + 1} color`}
                            value={blob.color}
                            onChange={(hex) =>
                              setGradient({
                                blobs: gradient.blobs.map((b) =>
                                  b.id === blob.id ? { ...b, color: hex } : b
                                ),
                              })
                            }
                          />
                          <HexInput
                            value={blob.color}
                            onChange={(hex) =>
                              setGradient({
                                blobs: gradient.blobs.map((b) =>
                                  b.id === blob.id ? { ...b, color: hex } : b
                                ),
                              })
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="ml-auto"
                            aria-label={`Remove blob ${index + 1}`}
                            disabled={gradient.blobs.length <= 1}
                            onClick={() =>
                              setGradient({
                                blobs: gradient.blobs.filter((b) => b.id !== blob.id),
                              })
                            }
                          >
                            <XIcon />
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {(["x", "y", "size"] as const).map((key) => (
                            <Field
                              key={key}
                              label={key === "size" ? "Size" : key.toUpperCase()}
                              readout={`${blob[key]}%`}
                            >
                              <Slider
                                value={[blob[key]]}
                                min={key === "size" ? 10 : 0}
                                max={100}
                                onValueChange={(value) =>
                                  setGradient({
                                    blobs: gradient.blobs.map((b) =>
                                      b.id === blob.id ? { ...b, [key]: one(value) } : b
                                    ),
                                  })
                                }
                              />
                            </Field>
                          ))}
                        </div>
                      </div>
                    ))}

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={gradient.blobs.length >= 6}
                      onClick={() =>
                        setGradient({
                          blobs: [
                            ...gradient.blobs,
                            {
                              id: uid("blob"),
                              color: gradient.blobs[0]?.color ?? "#6366f1",
                              x: Math.round(20 + Math.random() * 60),
                              y: Math.round(20 + Math.random() * 60),
                              size: 50,
                            },
                          ],
                        })
                      }
                    >
                      <PlusIcon />
                      Add blob
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

            {/* ------------------------------------------------- grain -- */}
            <TabsContent value="grain" className="flex flex-col gap-5 p-4">
              <Field label="Amount" readout={`${grain.opacity}%`}>
                <Slider
                  value={[grain.opacity]}
                  onValueChange={(value) => setGrain({ opacity: one(value) })}
                />
              </Field>

              <Field label="Grain size" readout={grain.size < 34 ? "fine" : grain.size < 67 ? "medium" : "coarse"}>
                <Slider
                  value={[grain.size]}
                  onValueChange={(value) => setGrain({ size: one(value) })}
                />
              </Field>

              <Field label="Contrast" readout={`${grain.contrast}%`}>
                <Slider
                  value={[grain.contrast]}
                  min={20}
                  max={200}
                  onValueChange={(value) => setGrain({ contrast: one(value) })}
                />
              </Field>

              <Field label="Octaves" readout={`${grain.octaves}`}>
                <Slider
                  value={[grain.octaves]}
                  min={1}
                  max={6}
                  step={1}
                  onValueChange={(value) => setGrain({ octaves: one(value) })}
                />
              </Field>

              <Separator />

              <Field label="Noise">
                <ToggleGroup
                  variant="outline"
                  size="sm"
                  spacing={0}
                  value={[grain.type]}
                  onValueChange={(value) => {
                    const next = (value as string[])[0]
                    if (next === "fractalNoise" || next === "turbulence") setGrain({ type: next })
                  }}
                >
                  <ToggleGroupItem value="fractalNoise" className="flex-1">
                    Film
                  </ToggleGroupItem>
                  <ToggleGroupItem value="turbulence" className="flex-1">
                    Turbulent
                  </ToggleGroupItem>
                </ToggleGroup>
              </Field>

              <Field label="Blend mode">
                <Select
                  value={grain.blend}
                  onValueChange={(value) => setGrain({ blend: value as BlendMode })}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BLEND_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {mode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                <div className="flex flex-col gap-0.5">
                  <Label className="text-sm">Monochrome</Label>
                  <span className="text-xs text-muted-foreground">
                    Off keeps the RGB speckle of color film
                  </span>
                </div>
                <Switch
                  checked={grain.mono}
                  onCheckedChange={(checked) => setGrain({ mono: Boolean(checked) })}
                />
              </div>
            </TabsContent>

            {/* -------------------------------------------------- code -- */}
            <TabsContent value="code" className="flex flex-col gap-3 p-4">
              <p className="text-xs text-muted-foreground">
                Drop this straight in — the grain rides on a <code className="font-mono">::after</code>{" "}
                overlay so it never tints the element&apos;s own content.
              </p>
              <pre className="max-h-96 overflow-auto rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap wrap-anywhere">
                <code>{css}</code>
              </pre>
              <Button variant="outline" size="sm" onClick={copyCss}>
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied ? "Copied" : "Copy CSS"}
              </Button>
              <p className="text-xs text-muted-foreground">
                PNG export interpolates in sRGB — an oklch gradient can read a shade
                differently in the file than it does in the browser.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
