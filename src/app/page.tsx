import { GradientGrainStudio } from "@/components/gradient-grain-studio"

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Gradient + Grain</h1>
        <p className="max-w-2xl text-muted-foreground">
          Four gradient models, SVG turbulence for the grain, and two ways out:
          a CSS rule you can paste, or a rendered PNG. The preview, the CSS, and
          the export all read the same config, so what you see is what ships.
        </p>
      </header>
      <GradientGrainStudio />
    </div>
  )
}
