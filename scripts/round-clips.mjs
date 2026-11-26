// Rounded corners for the demo clips (docs/media/*.webp), baked into the files as see-through
// pixels: a README can't carry CSS (GitHub strips it, and the Marketplace shows GitHub's HTML),
// so this is the only way the clips match the banner's rounded corners everywhere.
// The radius is a share of the clip's width, so every clip shows the same ~16px corner as the
// banner (rx 24 of 1280) once it's displayed at its usual size (720px on the site and README).
//
// Usage: node scripts/round-clips.mjs   rounds every clip in docs/media that isn't rounded yet
//        (re-encoding a lossy clip costs a little quality, so rounded ones are skipped).
// scripts/record-demos.mjs uses roundCornersFilter, so new recordings come out rounded.
import { execFileSync } from "node:child_process";
import { readdirSync, renameSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CORNER_SHARE = 0.0225; // corner radius / clip width (18px on an 800px clip)

// ffmpeg filter that turns the corners see-through with a soft (anti-aliased) edge.
// Put it last in a -vf chain and encode with -pix_fmt yuva420p.
export function roundCornersFilter(width) {
  const r = Math.round(width * CORNER_SHARE);
  const dx = `max(max(${r}-X-0.5\\,X+0.5-W+${r})\\,0)`;
  const dy = `max(max(${r}-Y-0.5\\,Y+0.5-H+${r})\\,0)`;
  const alpha = `255*clip(${r}+0.5-hypot(${dx}\\,${dy})\\,0\\,1)`;
  return `format=rgba,geq=r=r(X\\,Y):g=g(X\\,Y):b=b(X\\,Y):a=${alpha}`;
}

function main() {
  const ffmpeg = process.env.FFMPEG || "ffmpeg";
  const ffprobe = ffmpeg.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1");
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", "media");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".webp"))) {
    const src = path.join(dir, file);
    // Already rounded? Then the top-left pixel of the first frame is see-through.
    // (The whole frame is read: a crop filter fails on animated WebP input.)
    const frame = execFileSync(ffmpeg, ["-v", "error", "-i", src, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { maxBuffer: 64 * 1024 * 1024 });
    if (frame[3] < 128) {
      console.log(`${file}: already rounded, skipped`);
      continue;
    }
    const width = parseInt(execFileSync(ffprobe, ["-v", "error", "-show_entries", "stream=width", "-of", "csv=p=0", src]).toString(), 10);
    const tmp = src.replace(/\.webp$/, ".rounding.webp");
    execFileSync(ffmpeg, [
      "-y", "-loglevel", "error", "-i", src,
      "-vf", roundCornersFilter(width),
      "-c:v", "libwebp", "-quality", "82", "-compression_level", "6", "-preset", "picture",
      "-pix_fmt", "yuva420p", "-loop", "0", tmp,
    ]);
    renameSync(tmp, src);
    console.log(`${file}: rounded (${(statSync(src).size / 1024 / 1024).toFixed(2)} MB)`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
