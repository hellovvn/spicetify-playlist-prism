// Builds Prism's guide website (GitHub Pages) from site/pages/*.md into site-dist/.
// Every page gets the same banner, sidebar and previous/next links (site/template.html).
// Run: npm run site   then open site-dist/index.html in a browser.
import { marked } from "marked";
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pagesDir = join(root, "site", "pages");
const out = join(root, "site-dist");

// Sidebar order. Each page is site/pages/<id>.md and becomes <id>.html.
export const NAV = [
  {
    title: "Start",
    pages: [
      ["index", "Home"],
      ["install", "Install"],
      ["settings", "Settings"],
      ["lastfm-key", "Last.fm key"],
    ],
  },
  {
    title: "Features",
    pages: [
      ["grow", "Grow a playlist"],
      ["remix", "Remix into moods"],
      ["merge", "Merge playlists"],
      ["add-with-prism", "Add with Prism"],
      ["tone", "Playlist tone"],
      ["stats", "Playlist stats"],
      ["side-panel", "Stats beside your music"],
      ["themes", "Playlist themes"],
    ],
  },
  {
    title: "More",
    pages: [
      ["how-it-works", "How songs are matched"],
      ["what-prism-changes", "What Prism changes"],
      ["development", "Development"],
      ["support", "Support and credits"],
    ],
  },
];

const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Headings get ids so pages can link to a section (page.html#section).
marked.use({
  gfm: true,
  renderer: {
    heading({ tokens, depth, text }) {
      return `<h${depth} id="${slug(text)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
    },
  },
});

function navHtml(current) {
  return NAV.map(
    (group) =>
      `<div class="nav-group"><div class="nav-title"><span class="nav-star" aria-hidden="true"></span>${group.title}</div>` +
      group.pages
        .map(([id, label]) => {
          const active = id === current ? ' class="active" aria-current="page"' : "";
          return `<a href="${id}.html"${active}>${escape(label)}</a>`;
        })
        .join("") +
      "</div>",
  ).join("");
}

function pagerHtml(index, flat) {
  const prev = flat[index - 1];
  const next = flat[index + 1];
  const link = (p, dir) =>
    p ? `<a class="pager-${dir}" href="${p[0]}.html"><span>${dir === "prev" ? "Previous" : "Next"}</span>${escape(p[1])}</a>` : "<span></span>";
  return `<nav class="pager" aria-label="Previous and next page">${link(prev, "prev")}${link(next, "next")}</nav>`;
}

function build() {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, "media"), { recursive: true });

  const template = readFileSync(join(root, "site", "template.html"), "utf8");
  const flat = NAV.flatMap((g) => g.pages);
  const listed = new Set(flat.map((p) => p[0] + ".md"));
  for (const file of readdirSync(pagesDir)) {
    if (!listed.has(file)) throw new Error(`site/pages/${file} isn't in the sidebar (NAV in scripts/site.mjs)`);
  }

  flat.forEach(([id, label], i) => {
    const md = readFileSync(join(pagesDir, id + ".md"), "utf8");
    const descMatch = md.match(/^<!--\s*description:\s*(.+?)\s*-->/);
    const body = marked.parse(md.replace(/^<!--[\s\S]*?-->\s*/, ""));
    const title = id === "index" ? "Prism: grow, remix and theme your Spotify playlists" : `${label} · Prism`;
    const html = template
      .replaceAll("{{title}}", escape(title))
      .replaceAll("{{description}}", escape(descMatch ? descMatch[1] : "Prism, a Spotify companion made with Spicetify."))
      .replace("{{nav}}", navHtml(id))
      .replace("{{content}}", body)
      .replace("{{pager}}", pagerHtml(i, flat));
    writeFileSync(join(out, id + ".html"), html);
  });

  copyFileSync(join(root, "site", "style.css"), join(out, "style.css"));
  for (const file of readdirSync(join(root, "docs", "media"))) {
    if (/\.(webp|svg|png)$/.test(file)) copyFileSync(join(root, "docs", "media", file), join(out, "media", file));
  }
  copyFileSync(join(root, "src", "assets", "prism.svg"), join(out, "media", "prism-icon.svg"));
  writeFileSync(join(out, ".nojekyll"), "");
  console.log(`Site built: ${flat.length} pages in site-dist/`);
}

build();
