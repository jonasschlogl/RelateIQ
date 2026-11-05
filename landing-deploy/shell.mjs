// Shared page shell for every page except the home page: same nav + footer as index.html (single source of truth).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const LANDING = process.env.LANDING_DIR || path.resolve(HERE, "../landing-page");
export const SITE = "https://relationshipaiadvice.com";
export const esc = (s) => String(s).replace(/&(?!#?[a-zA-Z0-9]+;)/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

let cache = null;
function parts() {
  if (cache) return cache;
  const h = fs.readFileSync(path.join(LANDING, "index.html"), "utf8");
  const nav = (h.match(/<header class="hx-nav"[\s\S]*?<\/header>/) || [""])[0]
    .replace(/href="#/g, 'href="/#').replace(/href="index\.html"/g, 'href="/"').replace(/src="logo-tile\.svg"/g, 'src="/logo-tile.svg"')
    .replace(/ data-nogate/g, "").replace(/<a href="\/#faq">FAQ<\/a>/, '<a href="/faq/">FAQ</a>').replace(/<a href="\/#pricing">Pricing<\/a>/, '<a href="/pricing/">Pricing</a>')
    .replace(/<a href="\/#blog">Blog<\/a>/, '<a href="/blog/">Blog</a>').replace(/href="\/#join"/, 'href="/early-access/"');
  const footer = (h.match(/<footer class="hx-foot">[\s\S]*?<\/footer>/) || [""])[0]
    .replace(/href="index\.html"/g, 'href="/"').replace(/src="logo-tile\.svg"/g, 'src="/logo-tile.svg"');
  const section = (id) => { const m = h.match(new RegExp(`<section class="hx-sec" id="${id}">[\\s\\S]*?<\\/section>`)); return m ? m[0] : ""; };
  cache = { nav, footer, section };
  return cache;
}
export const homeSection = (id) => parts().section(id);

/** Wrap `body` (the <main> contents) into a full page in the current design. */
export function page({ title, description, path: p, type = "website", body, jsonld, image = `${SITE}/og-image.png`, cls = "", noindex = false }) {
  const { nav, footer } = parts();
  const canonical = `${SITE}${p}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${canonical}" />${noindex ? '\n  <meta name="robots" content="noindex" />' : ""}
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:type" content="${type}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${image}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${image}" />
  <link rel="icon" href="/favicon.ico" sizes="48x48" />
  <link rel="icon" href="/favicon.svg?v=3" type="image/svg+xml" />
  <link rel="icon" href="/favicon-48.png?v=3" sizes="48x48" type="image/png" />
  <link rel="icon" href="/favicon-32.png?v=3" sizes="32x32" type="image/png" />
  <link rel="icon" href="/favicon-16.png?v=3" sizes="16x16" type="image/png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=3" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,400..700,0..100&family=DM+Sans:opsz,wght@9..40,400..700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/css/home.css?v=153" />
  <link rel="stylesheet" href="/css/premium.css?v=5" />
  <link rel="stylesheet" href="/css/f-skin.css?v=5" />
  <link rel="stylesheet" href="/css/pages.css?v=2" />
  <meta name="theme-color" content="#3b2218" />
  <script defer src="https://cloud.umami.is/script.js" data-website-id="62eda2bd-4092-439e-9668-755fa2ca5aea"></script>
${jsonld ? `  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>\n` : ""}</head>
<body class="hx spg ${cls}">
<div class="f-cur" aria-hidden="true"><svg viewBox="0 0 100 100"><path d="M50 88 C20 64 6 46 6 30 C6 16 17 8 29 8 C38 8 46 13 50 21 C54 13 62 8 71 8 C83 8 94 16 94 30 C94 46 80 64 50 88 Z" fill="#f58fab"/></svg></div>
${nav}

  <main class="sp-main">
${body}
  </main>

  ${footer}
  <script src="/js/home.js?v=5"></script><script defer src="/js/f.js?v=5"></script><script defer src="/js/pages.js?v=1"></script>
</body>
</html>
`;
}
