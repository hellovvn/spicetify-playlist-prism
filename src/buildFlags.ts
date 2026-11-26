// Build switches.
//
// DEV_TOOLS = the developer extras: the `window.__prism` debug hook the
// smoke test drives, and the demo screens (?go=demo-scan / demo-stats).
// It is ALWAYS true in the repo, so `npm run build` / `npm run watch` keep them.
// `npm run release` (scripts/release.mjs) flips it to false only while it builds
// the public zip, then puts this file back. Don't change it by hand.
export const DEV_TOOLS = true;
