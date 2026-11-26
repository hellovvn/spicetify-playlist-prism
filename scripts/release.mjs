// npm run release: builds the PUBLIC version of Prism into release/.
//
// Same code as the dev build, minus the developer extras (src/buildFlags.ts:
// the window.__prism debug hook and the demo screens). It never touches
// Spotify's CustomApps folder, so it's safe while a watcher is running.
//
// Output:
//   release/prism/       the custom app folder people copy into CustomApps
//   release/prism-<version>.zip
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const flagsFile = path.join(root, "src", "buildFlags.ts");
const outDir = path.join(root, "release", "prism");
const tmpDir = path.join(root, "build-tmp"); // see CLAUDE.md "BUILDING FROM A WORKTREE"
const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
const zipFile = path.join(root, "release", `prism-${version}.zip`);

function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}

const original = fs.readFileSync(flagsFile, "utf8");
if (!/export const DEV_TOOLS = true;/.test(original)) fail("src/buildFlags.ts doesn't say DEV_TOOLS = true; fix it first.");

fs.rmSync(outDir, { recursive: true, force: true });
fs.rmSync(zipFile, { force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(tmpDir, { recursive: true });

let result;
try {
  fs.writeFileSync(flagsFile, original.replace("DEV_TOOLS = true", "DEV_TOOLS = false"));
  result = spawnSync("npx", ["spicetify-creator", "--out=release/prism", "--minify"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, TMP: tmpDir, TEMP: tmpDir, TMPDIR: tmpDir },
  });
} finally {
  fs.writeFileSync(flagsFile, original); // always put the dev switch back
}
if (result.status !== 0) fail("the build failed (see above).");

// Check the debug hook really is gone. It lives in the always-on script
// (prism.js), which esbuild strips completely. The page (index.js) still holds
// the demo screens' code, but behind DEV_TOOLS = false, so it never runs.
const alwaysOn = path.join(outDir, "prism.js");
if (!fs.existsSync(alwaysOn)) fail("prism.js (the always-on script) is missing.");
// (Other markers like `el.__prismThemeWatched` stay: only `.__prism` itself counts.)
if (/\.__prism(?!\w)/.test(fs.readFileSync(alwaysOn, "utf8"))) fail("prism.js still contains the debug hook.");

// Windows' own tar (bsdtar) writes the zip with "/" paths. PowerShell 5.1's
// Compress-Archive writes "\" paths, which unzip into wrong file names on macOS/Linux.
const tar = process.platform === "win32" ? path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe") : "zip";
const zip =
  process.platform === "win32"
    ? spawnSync(tar, ["-a", "-cf", zipFile, "-C", path.dirname(outDir), path.basename(outDir)], { stdio: "inherit" })
    : spawnSync("zip", ["-r", zipFile, path.basename(outDir)], { cwd: path.dirname(outDir), stdio: "inherit" });
if (zip.status !== 0) fail("couldn't make the zip.");

console.log(`release: done -> ${path.relative(root, zipFile)}`);
