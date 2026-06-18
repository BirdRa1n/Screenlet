/**
 * install-cross-compositors.mjs
 *
 * Downloads all Remotion compositor binaries needed for cross-arch builds
 * using `npm pack` (which bypasses npm's os/cpu platform checks).
 *
 * On macOS: installs both arm64 and x64 compositors so we can produce
 * separate DMGs for Apple Silicon and Intel from a single machine.
 *
 * Run: node scripts/install-cross-compositors.mjs
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Read the Remotion version from the installed @remotion/renderer package
// so we always pull the exact same version.
const rendererPkg = JSON.parse(
  (await import("node:fs")).readFileSync(
    join(ROOT, "node_modules", "@remotion", "renderer", "package.json"),
    "utf8"
  )
);
const VERSION = rendererPkg.version;

const NEEDED = {
  darwin: [
    "@remotion/compositor-darwin-arm64",
    "@remotion/compositor-darwin-x64",
  ],
  win32: ["@remotion/compositor-win32-x64-msvc"],
  linux: [
    "@remotion/compositor-linux-x64-gnu",
    "@remotion/compositor-linux-arm64-gnu",
  ],
}[process.platform] ?? [];

let installed = 0;
let skipped = 0;

for (const fullPkg of NEEDED) {
  const shortName = fullPkg.replace("@remotion/", "");
  const destDir = join(ROOT, "node_modules", "@remotion", shortName);

  if (existsSync(destDir)) {
    console.log(`  ✓  ${fullPkg} (already present)`);
    skipped++;
    continue;
  }

  console.log(`  ⬇  ${fullPkg}@${VERSION}`);

  const tmp = join(tmpdir(), `remotion-${shortName}-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });

  try {
    // npm pack downloads the tarball from the registry without any os/cpu checks.
    const packResult = spawnSync(
      "npm",
      ["pack", `${fullPkg}@${VERSION}`, "--pack-destination", tmp, "--json"],
      { encoding: "utf8", cwd: ROOT }
    );

    if (packResult.status !== 0) {
      throw new Error(packResult.stderr || "npm pack failed");
    }

    const tarballs = JSON.parse(packResult.stdout.trim());
    const tarball = join(tmp, tarballs[0].filename);

    // Extract; npm tarballs always have a top-level "package/" directory.
    execFileSync("tar", ["-xzf", tarball, "-C", tmp]);

    mkdirSync(destDir, { recursive: true });
    cpSync(join(tmp, "package"), destDir, { recursive: true });

    console.log(`  ✓  Installed ${fullPkg}`);
    installed++;
  } catch (err) {
    console.warn(`  ⚠  Could not install ${fullPkg}: ${err.message}`);
  } finally {
    try { rmSync(tmp, { recursive: true, force: true }); } catch {}
  }
}

if (installed > 0 || skipped === NEEDED.length) {
  console.log(`\n  Compositors ready (${skipped} cached, ${installed} fetched).`);
} else {
  process.exit(1);
}
