/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === "development";

// Port of the Electron-side dev static server (see electron/main.cjs).
// In dev the renderer is served by `next dev` on :3000, so user assets
// (uploads/exports/project-thumbs) are proxied to Electron. In production the
// app:// protocol serves these paths directly, so these rewrites are not needed
// (and `output: "export"` ignores them — they only run under `next dev`).
const DEV_ASSET_BASE = "http://127.0.0.1:7096";

const nextConfig = {
  output: "export",
  distDir: "out",
  trailingSlash: true,
  images: { unoptimized: true },

  // Type errors fail the build (the tree type-checks clean — see `tsc --noEmit`).
  // ESLint is run via `npm run lint`, not at build time: the strict
  // react-hooks v7 ruleset flags some pre-existing ref/effect patterns that are
  // correct at runtime, so it shouldn't gate the production build.
  eslint: { ignoreDuringBuilds: true },

  async rewrites() {
    if (!isDev) return [];
    return [
      { source: "/uploads/:path*", destination: `${DEV_ASSET_BASE}/uploads/:path*` },
      { source: "/exports/:path*", destination: `${DEV_ASSET_BASE}/exports/:path*` },
      { source: "/project-thumbs/:path*", destination: `${DEV_ASSET_BASE}/project-thumbs/:path*` },
    ];
  },
};

export default nextConfig;
