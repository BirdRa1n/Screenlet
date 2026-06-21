/**
 * Resolves a stored asset path to a URL usable in a raw <img>/<video> `src`.
 *
 * Stored asset paths are relative (e.g. "uploads/123.png", "exports/x.mp4",
 * "project-thumbs/y.jpg"). Under the App Router every page lives at a sub-path
 * (e.g. /editor/), so a bare relative path would resolve against that sub-path
 * (`/editor/uploads/123.png`) and 404. Forcing a leading slash makes it resolve
 * at the origin root — which the dev rewrites and the prod `app://` protocol
 * both serve. Absolute/data/blob/http URLs are returned untouched.
 *
 * (Remotion's <Player> doesn't need this — it uses `staticFile()`.)
 */
export function assetUrl(path?: string | null): string {
  if (!path) return "";
  if (/^(https?:|data:|blob:|file:|\/)/.test(path)) return path;
  return "/" + path;
}
