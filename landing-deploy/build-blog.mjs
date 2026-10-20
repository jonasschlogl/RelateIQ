// Static site generator for the RelationshipAI landing page (blog + languages).
//
//   blog-posts/*.md            ->  ../landing-page/blog/index.html
//                                  ../landing-page/blog/<slug>/index.html
//   blog-posts/<code>/*.md     ->  ../landing-page/<code>/blog/...   (translated posts)
//   i18n/<code>.json           ->  ../landing-page/<code>/index.html  (translated home page)
//   + "From the blog" block on every home page, language switcher, hreflang tags
//   + ../landing-page/sitemap.xml
//
// No dependencies, plain Node. Runs automatically before every deploy
// (see "build" in wrangler.jsonc), and can also be run by hand: node build-blog.mjs
//
// English is the source. Another language is just data:
//   1. add it to i18n/langs.json
//   2. add i18n/<code>.json   ( { "English text": "Translated text", ... } )
//   3. optionally add blog-posts/<code>/<same file name>.md with translated text
// Anything that is not translated yet simply stays English.
//
// Helper commands:
//   node build-blog.mjs --extract     writes i18n/_source.json (every English text that can be translated)
//   node build-blog.mjs --check       lists missing translations per language
//
// A post is a Markdown file with a small header:
//
//   ---
//   title: How to fix a relationship
//   date: 2026-10-06
//   description: One or two sentences for Google and for the blog cards.
//   tags: relationship advice, communication
//   slug: optional-url-name        (translated posts: ASCII letters, digits and dashes only)
//   draft: true                    (optional: draft posts are not published)
//   ---
//   Your text here ...

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractSegments, translateHtml } from "./i18n/translate.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LANDING = process.env.LANDING_DIR || path.resolve(HERE, "../landing-page");
const POSTS_DIR = process.env.POSTS_DIR || path.join(HERE, "blog-posts");
const I18N_DIR = path.join(HERE, "i18n");

const INSTAGRAM = "https://www.instagram.com/relationshipai_/";

const CONFIG = {
  domain: "relationshipaiadvice.com",
  siteName: "RelationshipAI",
  umami: "62eda2bd-4092-439e-9668-755fa2ca5aea",
  staticPages: ["", "method.html", "privacy.html", "terms.html"],
  cssVersion: "26",
  jsVersion: "21",
};
const SITE = `https://${CONFIG.domain}`;

// ---------------------------------------------------------------- English UI texts
// Every text below can be translated: add the same English text as a key in i18n/<code>.json.
const EN = {
  features: "Features",
  pricing: "Pricing",
  blog: "Blog",
  faq: "FAQ",
  cta: "Get early access",
  menu: "Menu",
  language: "Language",
  disclaimer:
    "RelationshipAI is an AI tool for personal growth and does not replace professional psychological or therapeutic care. If you're in a crisis, please contact a professional or a helpline in your country.",
  privacy: "Privacy",
  terms: "Terms",
  blogTitle: "Relationship Advice & Tips from an AI Coach | RelationshipAI Blog",
  blogDesc:
    "Practical relationship advice: how to communicate better, fix relationship problems and have the hard conversations. Inspired by the Gottman Method, attachment theory and Nonviolent Communication.",
  blogTag: "The blog",
  blogH1: "Relationship advice you can use tonight",
  blogSub: "Practical guides on communication, conflict and connection, drawing on methods real therapists use.",
  blogEmpty: "New articles are on the way.",
  bannerH2: "Ready for a clearer head?",
  bannerP: "Be among the first to try Coach Chat and Partner Practice. Free to start, no card needed.",
  readArticle: "Read article",
  minRead: "{n} min read",
  back: "← All articles",
  keepReading: "Keep reading",
  articleNote:
    "This article is general information for personal growth and not a substitute for professional advice. If you feel unsafe in your relationship, please contact a local support service or helpline.",
  ctaH2: "Want help applying this to your own relationship?",
  ctaP: "Talk it through in Coach Chat, then rehearse the conversation in Partner Practice. Free to start, opening soon.",
  ctaIg: "Or get daily tips on",
  homeTag: "From the blog",
  homeH2: "Relationship advice, tips & guides",
  homeP: "Fresh, practical articles on communication, conflict and connection.",
  seeAll: "See all articles",
  by: "By",
  tocTitle: "In this article",
  moreArticles: "More articles",
  shareLabel: "Share this article",
  copyLink: "Copy link",
  linkCopied: "Link copied",
  adCheckTitle: "Check it before you send",
  adCheckText: "See how your message will land, then get a calmer version.",
  adCoachTitle: "A coach that knows your story",
  adCoachText: "Talk it through any time, even at 2am.",
  adPracticeTitle: "Rehearse the hard talk",
  adPracticeText: "Practice with an AI that plays your partner. Completely private.",
  adNote: "Free to start · No card needed",
};
const AUTHOR = "Jonáš Schlögl";
// which tool the sidebar card promotes, per article (default: Coach Chat)
const AD_BY_POST = {
  "2026-10-08-how-to-apologize-to-your-partner": "check",
  "2026-10-05-relationship-advice-communication-habits": "check",
  "2026-10-03-relationship-problems-that-keep-coming-back": "practice",
  "2026-10-04-how-to-fix-a-relationship": "practice",
};

// Texts used by landing.js (the waitlist dialog and the mobile helpers).
const JS_TEXTS = [
  "What's included",
  "Hide details",
  "We open soon. Want a heads-up?",
  "RelationshipAI isn't open just yet. Leave your email and we'll write to you once, the day it opens. Your click already helps us decide how fast to open.",
  "Email address",
  "Notify me",
  'One email when we open. No spam. See our <a href="/privacy.html">privacy notice</a>.',
  "<strong>You're on the list.</strong> We'll email you once, when RelationshipAI opens. Thank you for being early.",
  "Not now",
  "Close",
  "Thank you",
  "Please enter a valid email address.",
  "Sorry, that didn't go through. Please try again in a moment.",
  "vs. AI chatbot",
  "vs. couples therapy",
  "swipe",
  "Show all {n} questions",
  "Show fewer questions",
];

// ---------------------------------------------------------------- languages
const LANGS = fs.existsSync(path.join(I18N_DIR, "langs.json")) ? JSON.parse(fs.readFileSync(path.join(I18N_DIR, "langs.json"), "utf8")) : [];
const EN_LANG = { code: "en", htmlLang: "en", hreflang: "en", name: "English", short: "EN", locale: "en-GB" };

function loadDict(code) {
  const f = path.join(I18N_DIR, `${code}.json`);
  if (!fs.existsSync(f)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(f, "utf8"));
    const d = {};
    for (const [k, v] of Object.entries(raw)) d[k.replace(/\s+/g, " ").trim()] = v;
    return d;
  } catch (e) {
    console.warn(`WARNING: i18n/${code}.json is not valid JSON, ${code} skipped: ${e.message}`);
    return null;
  }
}

// ---------------------------------------------------------------- helpers
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// like esc(), but leaves entities that are already there (&amp;, &#39; ...) alone
const attr = (s) => String(s).replace(/&(?!#?[a-zA-Z0-9]+;)/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const slugify = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const fmtDate = (iso, locale) => new Date(iso + "T12:00:00Z").toLocaleDateString(locale || "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function parseFrontMatter(raw) {
  const m = raw.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return { meta, body: m[2] };
}

// ------------------------------------------------------- tiny Markdown -> HTML
function inline(text) {
  let s = esc(text);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
    const external = /^https?:\/\//i.test(u) && !u.includes(CONFIG.domain);
    return `<a href="${u}"${external ? ' target="_blank" rel="noopener nofollow"' : ""}>${t}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
  s = s.replace(/(^|[\s(])_([^_\s][^_]*)_(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
  return s;
}

function markdown(src) {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  const headings = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^```/.test(line)) {
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`);
      continue;
    }
    // headings (# and ## both become h2: the post title is the only h1)
    let m = line.match(/^(#{1,4})\s+(.*)$/);
    if (m) {
      const level = m[1].length <= 2 ? 2 : m[1].length;
      const id = slugify(m[2]);
      headings.push({ level, id, text: m[2] });
      out.push(`<h${level} id="${id}">${inline(m[2])}</h${level}>`);
      i++; continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { out.push("<hr />"); i++; continue; }
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ""));
      out.push("<ul>" + items.map((t) => `<li>${inline(t)}</li>`).join("") + "</ul>");
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ""));
      out.push("<ol>" + items.map((t) => `<li>${inline(t)}</li>`).join("") + "</ol>");
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|>|```|\s*[-*]\s+|\s*\d+[.)]\s+|-{3,}\s*$)/.test(lines[i])) buf.push(lines[i++]);
    if (!buf.length) { i++; continue; }
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  return { html: out.join("\n"), headings };
}

// ------------------------------------------------------------ blog images
// Each post has three illustrations: /img/blog/<file-name>-1.svg (also the card thumbnail and the share image),
// -2.svg and -3.svg (placed inside the article). Translated posts use the same images (same file name).
const IMG_DIR = path.join(LANDING, "img", "blog");
const IMG_V = "3"; // bump when the illustrations change (cache busting)
const imgFile = (key, n, ext = "svg") => `/img/blog/${key}-${n}.${ext}${ext === "svg" ? `?v=${IMG_V}` : ""}`;
const hasImgs = (key) => fs.existsSync(path.join(IMG_DIR, `${key}-1.svg`));
const figure = (key, n) => `<figure class="article-fig"><img src="${imgFile(key, n)}" alt="" width="800" height="450" loading="lazy" decoding="async" /></figure>`;
// put illustration 2 and 3 before the headings at one third and two thirds of the article
function withImages(p) {
  if (!hasImgs(p.key)) return p.html;
  const at = [...p.html.matchAll(/<h2[\s>]/g)].map((m) => m.index);
  if (at.length < 3) return p.html;
  const i1 = Math.max(1, Math.round(at.length / 3)), i2 = Math.min(at.length - 1, Math.max(i1 + 1, Math.round((at.length * 2) / 3)));
  const pos = [[at[i1], 2], [at[i2], 3]].sort((a, b) => b[0] - a[0]);
  let h = p.html;
  for (const [idx, n] of pos) h = h.slice(0, idx) + figure(p.key, n) + "\n" + h.slice(idx);
  return h;
}

// ------------------------------------------------------------ load the posts
// dir: folder with the .md files. englishByKey: used to inherit the date of a translated post.
function loadPosts(dir, englishByKey) {
  if (!fs.existsSync(dir)) return [];
  const posts = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".md") || file.startsWith("_")) continue;
    try {
      const raw = fs.readFileSync(path.join(dir, file), "utf8");
      const { meta, body } = parseFrontMatter(raw);
      if (/^(true|yes|1)$/i.test(meta.draft || "")) { console.log(`skip draft: ${file}`); continue; }
      const key = file.replace(/\.md$/, "");
      const en = englishByKey && englishByKey.get(key);
      if (englishByKey && !en) throw new Error("no English post with this file name");
      if (!meta.title) throw new Error("missing 'title:'");
      const date = meta.date || (en && en.date);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) throw new Error("missing or invalid 'date:' (use YYYY-MM-DD)");
      const slug = slugify(meta.slug || key.replace(/^\d{4}-\d{2}-\d{2}-/, "")) || (en && en.slug);
      const { html } = markdown(body);
      const words = body.split(/\s+/).filter(Boolean).length;
      const tags = (meta.tags || "").split(",").map((t) => t.trim()).filter(Boolean);
      const description = meta.description || body.replace(/[#*_>`\[\]()-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 155);
      posts.push({ key, slug, title: meta.title, date, description, tags, html, minutes: Math.max(1, Math.round(words / 210)) });
    } catch (e) {
      console.warn(`WARNING: skipped ${dir}/${file}: ${e.message}`);
    }
  }
  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)));
  return posts;
}

// ------------------------------------------------------------------ context per language
// ctx = { lang, T(englishText) -> text, prefix ("" or "/sv"), posts, locale }
function makeCtx(lang, dict, posts) {
  const T = (en) => {
    if (!dict) return en;
    const k = en.replace(/\s+/g, " ").trim();
    const v = dict[k];
    return typeof v === "string" && v ? v : en;
  };
  return { lang, dict, T, prefix: lang.code === "en" ? "" : `/${lang.code}`, posts, locale: lang.locale };
}

let ctxList = []; // languages that are live (have a dictionary or posts)

// ------------------------------------------------------------------ language switcher
const GLOBE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 4 5.7 4 9s-1.4 6.4-4 9c-2.6-2.6-4-5.7-4-9s1.4-6.4 4-9z"/></svg>`;
const liveLangs = () => [EN_LANG, ...ctxList.map((c) => c.lang)];

// targets: { [code]: url } for every language incl. "en"
function switcher(current, targets, ctx) { return ""; } // language switcher disabled (English only)
function switcherOld(current, targets, ctx) {
  const items = liveLangs()
    .filter((l) => targets[l.code])
    .map(
      (l) =>
        `<li><a href="${targets[l.code]}" hreflang="${l.hreflang}" lang="${l.htmlLang}"${l.code === current.code ? ' aria-current="true"' : ""} data-umami-event="lang-${l.code}">${l.name}</a></li>`
    )
    .join("");
  return `<details class="lang-switch"><summary aria-label="${attr(ctx.T(EN.language))}">${GLOBE}<span>${current.short}</span></summary><ul class="lang-list">${items}</ul></details>`;
}

function alternatesHtml(targets) { return ""; } // hreflang disabled (English only)
function alternatesHtmlOld(targets) {
  const links = [];
  for (const l of liveLangs()) if (targets[l.code]) links.push(`<link rel="alternate" hreflang="${l.hreflang}" href="${SITE}${targets[l.code]}" />`);
  if (targets.en) links.push(`<link rel="alternate" hreflang="x-default" href="${SITE}${targets.en}" />`);
  return links.join("\n  ");
}

// URL of the same page in every language: kind = "home" | "blog" | "post". Missing = null.
function targetsFor(kind, key, all) {
  const t = {};
  for (const c of all) {
    const p = c.prefix;
    if (kind === "home") t[c.lang.code] = c.lang.code === "en" || c.dict ? `${p}/` : null;
    else if (kind === "blog") t[c.lang.code] = c.posts.length || c.lang.code === "en" ? `${p}/blog/` : null;
    else {
      const post = c.posts.find((x) => x.key === key);
      t[c.lang.code] = post ? `${p}/blog/${post.slug}/` : null;
    }
  }
  return t;
}
// For the switcher a language with no matching page links to its blog index or home instead
function switcherTargets(kind, key, all) {
  const exact = targetsFor(kind, key, all);
  const fallback = {};
  for (const c of all) {
    fallback[c.lang.code] =
      exact[c.lang.code] || (kind === "post" && c.posts.length ? `${c.prefix}/blog/` : c.lang.code === "en" || c.dict ? `${c.prefix}/` : null);
  }
  return { exact, fallback };
}

// ------------------------------------------------------------------ templates
function navHtml(ctx, targets) {
  const { T, prefix } = ctx;
  return `  <header class="site-nav">
    <a href="${prefix || ""}/" class="brand"><img class="brand-mark" src="/logo-tile.svg" alt="" width="38" height="38" style="display:inline-block;vertical-align:middle;margin:-5px 10px 0 0" />Relationship<span>AI</span></a>
    <button class="nav-toggle" id="nav-toggle" aria-label="${attr(T(EN.menu))}">☰</button>
    <nav class="nav-links" id="nav-menu">
      <a href="${prefix}/#features">${T(EN.features)}</a>
      <a href="${prefix}/#pricing">${T(EN.pricing)}</a>
      <a href="${prefix}/blog/">${T(EN.blog)}</a>
      <a href="${prefix}/#faq">${T(EN.faq)}</a>
      ${switcher(ctx.lang, targets, ctx)}
      <a href="#" class="btn btn-gradient btn-sm" data-cta data-umami-event="cta-blog-nav">${T(EN.cta)}</a>
    </nav>
  </header>`;
}

function footerHtml(ctx) {
  const { T, prefix } = ctx;
  return `  <footer class="site-footer">
    <p class="footer-disclaimer">
      ${T(EN.disclaimer)}
    </p>
    <p class="footer-copy">© ${new Date().getUTCFullYear()} ${CONFIG.siteName} · <a href="${prefix}/blog/">${T(EN.blog)}</a> · <a href="${INSTAGRAM}" target="_blank" rel="noopener noreferrer" aria-label="Instagram @relationshipai_" data-umami-event="click-instagram-footer"><img src="/img/instagram.svg" alt="" width="20" height="20" style="display:inline-block;vertical-align:-5px;margin-right:7px;border-radius:6px;flex-shrink:0" />@relationshipai_</a> · <a href="/privacy.html">${T(EN.privacy)}</a> · <a href="/terms.html">${T(EN.terms)}</a></p>
  </footer>
  <a href="#" class="floating-cta" id="floating-cta" data-cta data-umami-event="cta-blog-floating">${T(EN.cta)}</a>`;
}

// the dictionary for landing.js (only the texts it needs)
function jsDict(ctx) {
  if (!ctx.dict) return "";
  const o = {};
  for (const k of JS_TEXTS) { const v = ctx.T(k); if (v !== k) o[k] = v; }
  return Object.keys(o).length ? `<script>window.RAI_T=${JSON.stringify(o).replace(/</g, "\\u003c")};</script>\n  ` : "";
}

function page(ctx, { title, description, path: pagePath, type = "website", body, jsonld, targets, altTargets, image = `${SITE}/og-image.png` }) {
  const canonical = `${SITE}${pagePath}`;
  return `<!DOCTYPE html>
<html lang="${ctx.lang.htmlLang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${attr(title)}</title>
  <meta name="description" content="${attr(description)}" />
  <link rel="canonical" href="${canonical}" />
  ${alternatesHtml(altTargets || targets)}
  <meta property="og:title" content="${attr(title)}" />
  <meta property="og:description" content="${attr(description)}" />
  <meta property="og:type" content="${type}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:locale" content="${ctx.lang.locale.replace("-", "_")}" />
  <meta property="og:image" content="${image}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${attr(title)}" />
  <meta name="twitter:description" content="${attr(description)}" />
  <meta name="twitter:image" content="${image}" />
  <link rel="icon" href="/favicon.ico" sizes="48x48" />
  <link rel="icon" href="/favicon.svg?v=3" type="image/svg+xml" />
  <link rel="icon" href="/favicon-48.png?v=3" sizes="48x48" type="image/png" />
  <link rel="icon" href="/favicon-32.png?v=3" sizes="32x32" type="image/png" />
  <link rel="icon" href="/favicon-16.png?v=3" sizes="16x16" type="image/png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=3" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600&family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/css/style.css?v=72" />
  <link rel="stylesheet" href="/css/landing.css?v=${CONFIG.cssVersion}" />
  <script defer src="https://cloud.umami.is/script.js" data-website-id="${CONFIG.umami}"></script>
${jsonld ? `  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>\n` : ""}</head>
<body class="lp blog">

${navHtml(ctx, targets)}

${body}

${footerHtml(ctx)}

  ${jsDict(ctx)}<script src="/js/landing.js?v=${CONFIG.jsVersion}"></script>
</body>
</html>
`;
}

const card = (ctx, p) => `<a class="post-card" href="${ctx.prefix}/blog/${p.slug}/">
  ${hasImgs(p.key) ? `<span class="post-thumb"><img src="${imgFile(p.key, 1)}" alt="" width="800" height="450" loading="lazy" decoding="async" /></span>\n  ` : ""}  <div class="post-card-top">${p.tags[0] ? `<span class="post-tag">${esc(p.tags[0])}</span>` : "<span></span>"}<span class="post-meta">${fmtDate(p.date, ctx.locale)} · ${ctx.T(EN.minRead).replace("{n}", p.minutes)}</span></div>
  <h3>${esc(p.title)}</h3>
  <p>${esc(p.description)}</p>
  <span class="post-more">${ctx.T(EN.readArticle)} <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
</a>`;

const ctaBox = (ctx, event) => `<div class="article-cta">
  <h2>${ctx.T(EN.ctaH2)}</h2>
  <p>${ctx.T(EN.ctaP)}</p>
  <a href="#" class="btn btn-gradient" data-cta data-umami-event="${event}">${ctx.T(EN.cta)}</a>
  <p class="ig-line">${ctx.T(EN.ctaIg)} <a href="${INSTAGRAM}" target="_blank" rel="noopener noreferrer" aria-label="Instagram @relationshipai_" data-umami-event="click-instagram-article"><img src="/img/instagram.svg" alt="" width="20" height="20" style="display:inline-block;vertical-align:-5px;margin-right:7px;border-radius:6px;flex-shrink:0" />@relationshipai_</a></p>
</div>`;

// -------------------------------------------------------------------- output
function write(rel, content) {
  const f = path.join(LANDING, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
}

function blogIndexPage(ctx, all) {
  const { T, posts } = ctx;
  const { exact, fallback } = switcherTargets("blog", null, all);
  return page(ctx, {
    title: T(EN.blogTitle),
    description: T(EN.blogDesc),
    path: `${ctx.prefix}/blog/`,
    targets: fallback,
    altTargets: exact,
    body: `  <main>
    <section class="blog-hero">
      <div class="container">
        <span class="section-tag">${T(EN.blogTag)}</span>
        <h1>${T(EN.blogH1)}</h1>
        <p>${T(EN.blogSub)}</p>
      </div>
    </section>
    <section class="blog-list">
      <div class="container">
        ${posts.length ? `<div class="post-grid">${posts.map((p) => card(ctx, p)).join("\n")}</div>` : `<p class="blog-empty">${T(EN.blogEmpty)}</p>`}
      </div>
    </section>
    <section>
      <div class="cta-banner">
        <h2>${T(EN.bannerH2)}</h2>
        <p>${T(EN.bannerP)}</p>
        <a href="#" class="btn" data-cta data-umami-event="cta-blog-banner">${T(EN.cta)}</a>
      </div>
    </section>
  </main>`,
    jsonld: { "@context": "https://schema.org", "@type": "Blog", name: `${CONFIG.siteName} Blog`, url: `${SITE}${ctx.prefix}/blog/`, inLanguage: ctx.lang.htmlLang },
  });
}

// ----- article extras: table of contents, sidebar card, share icons
const stripTags = (h) => h.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
function tocOf(p) {
  return [...p.html.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)].map((m) => ({ id: m[1], text: stripTags(m[2]) }));
}
function adCard(ctx, p, extra = "") {
  const { T } = ctx;
  const kind = AD_BY_POST[p.key] || "coach";
  const title = T(EN[`ad${kind[0].toUpperCase()}${kind.slice(1)}Title`]);
  const text = T(EN[`ad${kind[0].toUpperCase()}${kind.slice(1)}Text`]);
  const img = kind === "check" ? "check" : kind === "practice" ? "practice" : "coach";
  return `<div class="ad-card ${extra}">
          <img class="ad-img" src="/img/scene-${img}.svg?v=2" alt="" width="360" height="470" loading="lazy" />
          <div class="ad-body">
            <h3>${title}</h3>
            <p>${text}</p>
            <a href="#" class="btn btn-gradient" data-cta data-umami-event="cta-blog-sidebar">${T(EN.cta)}</a>
            <small>${T(EN.adNote)}</small>
          </div>
        </div>`;
}
function shareRow(ctx, p, url) {
  const { T } = ctx;
  const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.6" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="6" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="19" r="2.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.3 10.8l7.4-4.4M8.3 13.2l7.4 4.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  return `<div class="share">
          <button type="button" class="share-btn" data-share="${attr(url)}" data-title="${attr(p.title)}" data-done="${attr(T(EN.linkCopied))}" aria-label="${attr(T(EN.shareLabel))}" title="${attr(T(EN.shareLabel))}" data-umami-event="share-article">${icon}</button>
        </div>`;
}

function postPage(ctx, p, all) {
  const { T, posts } = ctx;
  const others = posts.filter((x) => x.slug !== p.slug).slice(0, 3);
  const { exact, fallback } = switcherTargets("post", p.key, all);
  const url = `${SITE}${ctx.prefix}/blog/${p.slug}/`;
  const toc = tocOf(p);
  const tocList = toc.map((h) => `<li><a href="#${h.id}">${esc(h.text)}</a></li>`).join("");
  const avatar = fs.existsSync(path.join(LANDING, "img", "jonas.jpg"))
    ? `<img class="avatar" src="/img/jonas.jpg" alt="" width="64" height="64" />`
    : `<img class="avatar" src="/logo-tile.svg" alt="" width="64" height="64" />`;
  const ogPng = hasImgs(p.key) && fs.existsSync(path.join(IMG_DIR, `${p.key}-1.png`)) ? `${SITE}${imgFile(p.key, 1, "png")}` : null;
  return page(ctx, {
    title: `${p.title} | ${CONFIG.siteName}`,
    description: p.description,
    path: `${ctx.prefix}/blog/${p.slug}/`,
    type: "article",
    image: ogPng || undefined,
    targets: fallback,
    altTargets: exact,
    body: `  <main>
    <article class="article">
      <div class="container article-layout">
        <div class="article-wrap article-main">
          <a href="${ctx.prefix}/blog/" class="article-back">${T(EN.back)}</a>
          <div class="article-tags">${p.tags.map((t) => `<span class="post-tag">${esc(t)}</span>`).join("")}</div>
          <h1>${esc(p.title)}</h1>
          <div class="article-byline">
            <a href="/#about" class="avatar-link" aria-label="About us">${avatar}</a>
            <p>${T(EN.by)} <a href="/#about" class="author" data-umami-event="click-author">${AUTHOR}</a><span class="dot">·</span>${fmtDate(p.date, ctx.locale)}<span class="dot">·</span>${T(EN.minRead).replace("{n}", p.minutes)}</p>
          </div>
          ${toc.length > 2 ? `<details class="toc-mobile"><summary>${T(EN.tocTitle)}</summary><ol>${tocList}</ol></details>` : ""}
          ${hasImgs(p.key) ? `<figure class="article-fig article-hero"><img src="${imgFile(p.key, 1)}" alt="" width="800" height="450" decoding="async" fetchpriority="high" /></figure>` : ""}
          <div class="article-body">
${withImages(p)}
          </div>
          ${ctaBox(ctx, "cta-blog-article")}
          <p class="article-note">${T(EN.articleNote)}</p>
          ${adCard(ctx, p, "ad-mobile")}
        </div>
        <aside class="article-aside">
          ${toc.length > 2 ? `<nav class="toc" aria-label="${attr(T(EN.tocTitle))}"><p class="toc-title">${T(EN.tocTitle)}</p><ol>${tocList}</ol></nav>` : ""}
          ${adCard(ctx, p)}
        </aside>
      </div>
    </article>
    ${others.length ? `<section class="blog-list more-posts">
      <div class="container">
        <div class="more-head">
          <h2>${T(EN.moreArticles)}</h2>
          ${shareRow(ctx, p, url)}
        </div>
        <div class="post-grid">${others.map((x) => card(ctx, x)).join("\n")}</div>
      </div>
    </section>` : ""}
  </main>`,
    jsonld: {
      "@context": "https://schema.org", "@type": "Article", headline: p.title, description: p.description,
      datePublished: p.date, dateModified: p.date, mainEntityOfPage: url,
      inLanguage: ctx.lang.htmlLang,
      image: ogPng || `${SITE}/og-image.png`,
      author: { "@type": "Person", name: AUTHOR, url: INSTAGRAM },
      publisher: { "@type": "Organization", name: CONFIG.siteName, sameAs: [INSTAGRAM], logo: { "@type": "ImageObject", url: `${SITE}/icon-512.png` } },
    },
  });
}

function homeBlock(ctx) {
  const { T, posts } = ctx;
  if (!posts.length) return "";
  return `<section id="blog" class="blog-latest">
      <div class="container">
        <div class="section-head">
          <span class="section-tag">${T(EN.homeTag)}</span>
          <h2>${T(EN.homeH2)}</h2>
          <p>${T(EN.homeP)}</p>
        </div>
        <div class="post-grid">${posts.slice(0, 3).map((p) => card(ctx, p)).join("\n")}</div>
        <p class="blog-all"><a href="${ctx.prefix}/blog/" class="btn btn-ghost">${T(EN.seeAll)}</a> <a href="${INSTAGRAM}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost" aria-label="Instagram @relationshipai_" data-umami-event="click-instagram-blog-home"><img src="/img/instagram.svg" alt="" width="20" height="20" style="display:inline-block;vertical-align:-5px;margin-right:7px;border-radius:6px;flex-shrink:0" />@relationshipai_</a></p>
      </div>
    </section>`;
}

const BLOCK_RE = /<!--BLOG-LATEST-->[\s\S]*?<!--\/BLOG-LATEST-->/;
const ALTS_RE = /<!--LANG-ALTS-->[\s\S]*?<!--\/LANG-ALTS-->/;
const SWITCH_RE = /<!--LANG-SWITCH-->[\s\S]*?<!--\/LANG-SWITCH-->/;

function altsBlock(all) {
  const { exact } = switcherTargets("home", null, all);
  return `<!--LANG-ALTS-->\n  ${alternatesHtml(exact)}\n  <!--/LANG-ALTS-->`;
}
function switchBlock(ctx, all) {
  const { fallback } = switcherTargets("home", null, all);
  return `<!--LANG-SWITCH-->${switcher(ctx.lang, fallback, ctx)}<!--/LANG-SWITCH-->`;
}

function localizeHome(enHome, ctx, all, stats) {
  const L = ctx.lang;
  // 1. cut the generated blocks out, so their English texts are not counted as missing
  let h = enHome.replace(BLOCK_RE, "<!--BLOGSLOT-->").replace(ALTS_RE, "<!--ALTSLOT-->").replace(SWITCH_RE, "<!--SWITCHSLOT-->");
  // 2. translate every text
  h = translateHtml(h, ctx.dict || {}, stats);
  // 3. language specific head
  h = h.replace(/<html lang="en">/, `<html lang="${L.htmlLang}">`);
  h = h.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${SITE}/${L.code}/$2`);
  h = h.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${SITE}/${L.code}/$2`);
  h = h.replace(/(<meta property="og:type" content="website" \/>)/, `$1\n  <meta property="og:locale" content="${L.locale.replace("-", "_")}" />`);
  h = h.replace(/("@type":"WebSite","name":"RelationshipAI","url":"[^"]*")/, `$1,"inLanguage":"${L.htmlLang}"`);
  // 4. relative file paths only work from "/", so make them absolute
  h = h.replace(/\b(href|src)="(?!https?:|\/|#|mailto:|tel:|data:)([^"]*)"/g, (all0, a, v) => (v === "index.html" ? `${a}="${ctx.prefix}/"` : `${a}="/${v}"`));
  h = h.replace(/href="\/blog\/"/g, `href="${ctx.posts.length ? ctx.prefix : ""}/blog/"`);
  // 5. generated blocks
  h = h.replace("<!--BLOGSLOT-->", `<!--BLOG-LATEST-->\n    ${homeBlock(ctx)}\n    <!--/BLOG-LATEST-->`);
  h = h.replace("<!--ALTSLOT-->", altsBlock(all));
  h = h.replace("<!--SWITCHSLOT-->", switchBlock(ctx, all));
  // 6. texts for landing.js
  h = h.replace(/(<script src="\/js\/landing\.js)/, `${jsDict(ctx)}$1`);
  return h;
}

// every English text that can be translated (home page + blog templates + landing.js)
function sourceTexts(enHome) {
  const base = enHome.replace(BLOCK_RE, "").replace(ALTS_RE, "").replace(SWITCH_RE, "");
  const list = extractSegments(base);
  const seen = new Set(list);
  const add = (s) => { const k = s.replace(/\s+/g, " ").trim(); if (k && !seen.has(k)) { seen.add(k); list.push(k); } };
  Object.values(EN).forEach(add);
  JS_TEXTS.forEach(add);
  return list;
}

function build() {
  if (!fs.existsSync(LANDING)) { console.error(`landing dir not found: ${LANDING}`); process.exit(0); }

  const enPosts = loadPosts(POSTS_DIR);
  console.log(`blog: ${enPosts.length} published post(s) in English`);
  const enByKey = new Map(enPosts.map((p) => [p.key, p]));

  // which languages are live
  const all = [makeCtx(EN_LANG, null, enPosts)];
  for (const L of LANGS) {
    const dict = loadDict(L.code);
    const posts = loadPosts(path.join(POSTS_DIR, L.code), enByKey);
    if (!dict && !posts.length) continue;
    all.push(makeCtx(L, dict, posts));
  }
  ctxList = all.slice(1);

  // links between articles: point /blog/<english-slug>/ to the translated article when there is one
  for (const ctx of ctxList) {
    for (const p of ctx.posts) {
      p.html = p.html.replace(/href="\/blog\/([a-z0-9-]+)\/"/g, (m, slug) => {
        const en = enPosts.find((x) => x.slug === slug);
        const tr = en && ctx.posts.find((x) => x.key === en.key);
        return tr ? `href="${ctx.prefix}/blog/${tr.slug}/"` : m;
      });
    }
  }
  console.log(`languages live: en${ctxList.map((c) => ", " + c.lang.code).join("")}`);

  // clean old generated folders (so deleted/renamed posts disappear)
  fs.rmSync(path.join(LANDING, "blog"), { recursive: true, force: true });
  for (const L of LANGS) fs.rmSync(path.join(LANDING, L.code), { recursive: true, force: true });

  // blogs (English first, then every language)
  for (const ctx of all) {
    const base = ctx.prefix ? `${ctx.prefix.slice(1)}/` : "";
    if (ctx.lang.code === "en" || ctx.posts.length) {
      write(`${base}blog/index.html`, blogIndexPage(ctx, all));
      for (const p of ctx.posts) write(`${base}blog/${p.slug}/index.html`, postPage(ctx, p, all));
    }
  }

  // English home page
  const homeFile = path.join(LANDING, "index.html");
  let enHome = fs.existsSync(homeFile) ? fs.readFileSync(homeFile, "utf8") : "";
  if (enHome) {
    if (BLOCK_RE.test(enHome)) enHome = enHome.replace(BLOCK_RE, `<!--BLOG-LATEST-->\n    ${homeBlock(all[0])}\n    <!--/BLOG-LATEST-->`);
    else console.warn("WARNING: BLOG-LATEST markers not found in index.html");
    if (!ALTS_RE.test(enHome) || !SWITCH_RE.test(enHome)) console.warn("WARNING: LANG-ALTS / LANG-SWITCH markers not found in index.html");
    enHome = enHome.replace(ALTS_RE, altsBlock(all)).replace(SWITCH_RE, switchBlock(all[0], all));
    fs.writeFileSync(homeFile, enHome);

    // translated home pages
    for (const ctx of ctxList) {
      if (!ctx.dict) continue;
      const stats = { hit: 0, miss: new Set() };
      write(`${ctx.lang.code}/index.html`, localizeHome(enHome, ctx, all, stats));
      const missing = [...stats.miss];
      console.log(`  ${ctx.lang.code}: ${stats.hit} texts translated, ${missing.length} missing, ${ctx.posts.length} post(s)`);
      if (missing.length && process.env.SHOW_MISSING) missing.slice(0, 20).forEach((m) => console.log(`      - ${m.slice(0, 90)}`));
    }
  }

  // sitemap, with language alternates
  const alt = (targets) => {
    const out = [];
    for (const c of all) if (targets[c.lang.code]) out.push(`    <xhtml:link rel="alternate" hreflang="${c.lang.hreflang}" href="${SITE}${targets[c.lang.code]}"/>`);
    if (targets.en) out.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${targets.en}"/>`);
    return out.length > 2 ? "\n" + out.join("\n") + "\n  " : "";
  };
  const urls = [];
  const homeT = targetsFor("home", null, all);
  for (const c of all) if (homeT[c.lang.code]) urls.push(`  <url><loc>${SITE}${homeT[c.lang.code]}</loc>${alt(homeT)}</url>`);
  for (const p of CONFIG.staticPages.filter(Boolean)) urls.push(`  <url><loc>${SITE}/${p}</loc></url>`);
  const blogT = targetsFor("blog", null, all);
  for (const c of all) if (blogT[c.lang.code]) urls.push(`  <url><loc>${SITE}${blogT[c.lang.code]}</loc>${alt(blogT)}</url>`);
  for (const c of all) {
    for (const p of c.posts) {
      const t = targetsFor("post", p.key, all);
      urls.push(`  <url><loc>${SITE}${t[c.lang.code]}</loc><lastmod>${p.date}</lastmod>${alt(t)}</url>`);
    }
  }
  write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`);

  // helper commands
  if (process.argv.includes("--extract")) {
    const src = sourceTexts(enHome);
    fs.writeFileSync(path.join(I18N_DIR, "_source.json"), JSON.stringify(src, null, 1) + "\n");
    console.log(`i18n/_source.json: ${src.length} texts`);
  }
  if (process.argv.includes("--check")) {
    const src = sourceTexts(enHome);
    for (const ctx of ctxList) {
      const miss = src.filter((k) => !ctx.dict || typeof ctx.dict[k] !== "string" || !ctx.dict[k]);
      console.log(`${ctx.lang.code}: ${src.length - miss.length}/${src.length} translated`);
      miss.slice(0, 40).forEach((m) => console.log(`   - ${m.slice(0, 100)}`));
    }
  }
}

try { build(); } catch (e) { console.error("site build failed (site will deploy without these changes):", e); }
