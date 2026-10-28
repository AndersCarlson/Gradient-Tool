import type { NextConfig } from "next"

/**
 * GitHub Pages serves this repo from a subpath, not a domain root, and it
 * serves static files only — so the production build is a static export that
 * knows it lives under /Gradient-Tool.
 *
 * The basePath is production-only on purpose: `next dev` stays at the root, so
 * local work doesn't have to remember the prefix. `next build` sets NODE_ENV to
 * production, so a local build still exercises exactly what gets deployed.
 */
const isProduction = process.env.NODE_ENV === "production"

const nextConfig: NextConfig = {
  output: "export",
  basePath: isProduction ? "/Gradient-Tool" : "",
  // The export has no server behind it to optimize images on request.
  images: { unoptimized: true },
}

export default nextConfig
