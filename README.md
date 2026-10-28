# Gradient + Grain

A small tool for building a gradient, laying film grain over it, and taking it
away as CSS or a PNG.

## What it does

- **Four gradient models** — linear, radial, conic, and mesh (layered radial
  blobs over a base color, which is how you get the multi-point look a single
  CSS gradient can't give you).
- **Modern interpolation** — sRGB, oklab, or oklch, so a two-stop ramp doesn't
  pass through mud on the way.
- **Grain from SVG turbulence** — amount, grain size, contrast, octaves, film
  vs. turbulent noise, blend mode, and a monochrome switch (turn it off for the
  RGB speckle of color film).
- **Two ways out** — a paste-ready CSS rule, or a rendered PNG at five sizes.

The grain rides on an `::after` overlay rather than on the element itself, so
it never tints the element's own content.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## How it's put together

Every pure function lives in [`src/lib/gradient-grain.ts`](src/lib/gradient-grain.ts) —
CSS generation, the SVG noise tile, and the canvas painter. The component holds
nothing but state, so the preview, the copied CSS, and the exported PNG all read
one config and can't drift apart.

One caveat worth knowing: canvas only interpolates in sRGB, so an oklch gradient
can read a shade differently in the exported PNG than it does in the browser.
The tool says so next to the export.

## Built on Monad

The UI is the Monad design system — Next.js (App Router),
Tailwind v4, Base UI via shadcn/ui, and `next-themes`. This repo carries only
the slice of the kit the tool actually imports; the components in
`src/components/ui/` are copied-in source, yours to change.
