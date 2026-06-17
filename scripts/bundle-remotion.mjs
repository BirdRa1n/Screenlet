import { bundle } from "@remotion/bundler";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const entryPoint = path.join(__dirname, "../src/remotion/Root.tsx");
const outDir = path.join(__dirname, "../dist/remotion-bundle");

if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true });

console.log("Bundling Remotion compositions...");
await bundle({
  entryPoint,
  outDir,
  publicDir: path.join(__dirname, "../public"),
});
console.log("Remotion bundle ready at dist/remotion-bundle");
