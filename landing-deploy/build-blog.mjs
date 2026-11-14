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

import { page as shellPage } from "./shell.mjs";
const CONFIG = {
  domain: "relationshipaiadvice.com",
  siteName: "RelationshipAI",
  umami: "62eda2bd-4092-439e-9668-755fa2ca5aea",
  staticPages: ["", "partner-practice/", "coach-chat/", "message-check/", "other-tools/", "about/", "contact/", "pricing/", "faq/", "early-access/", "start/", "method/", "privacy/", "terms/", "blog/topic/attachment-styles/", "blog/topic/communication/", "blog/topic/conflict/", "blog/topic/repairing-a-relationship/", "blog/topic/overthinking/"],
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
  cta: "Try it free",
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
  bannerP: "Try Coach Chat, Partner Practice and Message check. Free to start, no card needed.",
  readArticle: "Read article",
  minRead: "{n} min read",
  back: "← All articles",
  keepReading: "Keep reading",
  articleNote:
    "This article is general information for personal growth and not a substitute for professional advice. If you feel unsafe in your relationship, please contact a local support service or helpline.",
  ctaH2: "Want help applying this to your own relationship?",
  ctaP: "Talk it through in Coach Chat, then rehearse the conversation in Partner Practice. Free to start, no card needed.",
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
  glance: "At a glance",
  updated: "Updated",
  sayTry: "Try saying",
  sayInstead: "Instead of",
  copy: "Copy",
  copied: "Copied",
  sayCheck: "Check how it lands",
  faqTitle: "Quick answers",
  shareTitle: "Found this useful? Share it",
};
const AUTHOR = "Jonáš Schlögl";
// which tool the sidebar card promotes, per article (default: Coach Chat)
const AD_BY_POST = {
  "2026-10-08-how-to-apologize-to-your-partner": "check",
  "2026-10-05-relationship-advice-communication-habits": "check",
  "2026-10-03-relationship-problems-that-keep-coming-back": "practice",
  "2026-10-04-how-to-fix-a-relationship": "practice",
  "2026-11-09-breadcrumbing": "check",
  "2026-11-09-clear-coding-dating": "check",
  "2026-11-09-love-bombing": "check",
  "2026-10-08-how-to-stop-overthinking-in-a-relationship": "check",
  "2026-11-13-relationship-anxiety": "check",
  "2026-11-09-how-to-talk-about-money-with-your-partner": "practice",
  "2026-11-07-holidays-with-your-partners-family": "practice",
  "2026-11-11-meeting-your-partners-parents": "practice",
  "2026-10-26-how-to-rebuild-trust-after-a-fight": "practice",
  "2026-11-11-emotionally-unavailable-partner": "practice",
};
const APP_SIGNUP = "https://app.relationshipaiadvice.com/register.html";

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
// English only: translations stay in i18n/ but are not built. To bring languages back, restore the line below.
// const LANGS = fs.existsSync(path.join(I18N_DIR, "langs.json")) ? JSON.parse(fs.readFileSync(path.join(I18N_DIR, "langs.json"), "utf8")) : [];
const LANGS = [];
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
    if (i > 0) meta[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "").replace(/\\"/g, '"');
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

// ----- "what to say" lines: copyable script cards
const QUOTE_RE = /^["\u201c][^"\u201c\u201d]{12,}["\u201d]\.?$/;
const SAY_RE = /^(Try|Try saying|Say|Say it simply|Instead of|You could say|Ask|Something like)\s*:\s*(["\u201c].{8,}["\u201d]\.?)$/i;
const unq = (q) => q.trim().replace(/\.$/, "").replace(/^["\u201c]|["\u201d]$/g, "");
function sayCard(q, label, actions = true) {
  const t = unq(q);
  return `<div class="say"><span class="say-k">${esc(label)}</span><p class="say-q">\u201c${inline(t)}\u201d</p>${actions ? `<div class="say-a"><button type="button" class="say-copy" data-copy="${attr(t)}" data-done="${attr(EN.copied)}">${esc(EN.copy)}</button><a class="say-try" href="${APP_SIGNUP}" data-umami-event="blog-say-check">${esc(EN.sayCheck)} \u2192</a></div>` : ""}</div>`;
}
function swapCard(a, b) {
  const x = unq(a), y = unq(b);
  return `<div class="say say-swap"><div class="say-row say-bad"><span class="say-k">${esc(EN.sayInstead)}</span><p class="say-q">\u201c${inline(x)}\u201d</p></div><div class="say-row say-good"><span class="say-k">${esc(EN.sayTry)}</span><p class="say-q">\u201c${inline(y)}\u201d</p><div class="say-a"><button type="button" class="say-copy" data-copy="${attr(y)}" data-done="${attr(EN.copied)}">${esc(EN.copy)}</button><a class="say-try" href="${APP_SIGNUP}" data-umami-event="blog-say-check">${esc(EN.sayCheck)} \u2192</a></div></div></div>`;
}

// lines inside a paragraph: 'Try: "..."' or 'Instead of "...", try "..."' are lifted out into cards
const INLINE_SAY = /(^|[.!?]\s+|["\u201d]\s+|\*\*\s+)((?:try(?: something like| saying)?|say(?: it simply| to your partner| something like)?|you (?:could|can) say|something like|for example)\s*:?\s*)["\u201c]([^"\u201c\u201d]{12,260})["\u201d][.,]?/i;
const INLINE_SWAP = /(^|[.!?]\s+)instead of\s*:?\s*["\u201c]([^"\u201c\u201d]{8,200})["\u201d],?\s*try(?: saying)?\s*:?\s*["\u201c]([^"\u201c\u201d]{8,260})["\u201d][.,]?/i;
function sayInline(para, depth = 0) {
  if (depth > 2) return `<p>${inline(para)}</p>`;
  const sw = para.match(INLINE_SWAP), sy = para.match(INLINE_SAY);
  const m = sw && (!sy || sw.index <= sy.index) ? sw : sy;
  if (!m) return `<p>${inline(para)}</p>`;
  const start = m.index + m[1].length, end = m.index + m[0].length;
  const before = para.slice(0, start).trim(), after = para.slice(end).trim();
  const card = m === sw ? swapCard(`"${m[2]}"`, `"${m[3]}"`) : sayCard(`"${m[3]}"`, EN.sayTry, true);
  return (before ? `<p>${inline(before)}</p>` : "") + card + (after ? sayInline(after, depth + 1) : "");
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
    // GitHub-style table: | a | b | followed by |---|---|
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(line); i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(`<div class="table-scroll"><table><thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      // "> **Example: ...**" becomes a scenario box, "> **Why it works**" an explainer box
      const bm = buf[0].match(/^\*\*(Example|Why (?:it|this) works)([^*]*)\*\*\s*(.*)$/i);
      if (bm) {
        const kind = /^example/i.test(bm[1]) ? "scenario" : "why";
        const title = (bm[1] + bm[2]).replace(/:\s*$/, "").trim();
        const paras = []; let cur = [bm[3]];
        for (const l of buf.slice(1)) { if (!l.trim()) { paras.push(cur.join(" ").trim()); cur = []; } else cur.push(l); }
        paras.push(cur.join(" ").trim());
        const body = paras.filter(Boolean).map((t) => {
          const q = t.match(/^(Try|Instead of)\s*:\s*(["\u201c].+["\u201d]\.?)$/i);
          return q ? sayCard(q[2], /^instead/i.test(q[1]) ? EN.sayInstead : EN.sayTry, !/^instead/i.test(q[1])) : `<p>${inline(t)}</p>`;
        }).join("");
        const ic = kind === "scenario"
          ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'
          : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
        out.push(`<aside class="xbox x-${kind}"><p class="xbox-k">${ic}<span>${inline(title)}</span></p>${body}</aside>`);
        continue;
      }
      out.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ""));
      // a list made only of quoted lines becomes a stack of copyable lines
      if (items.length > 1 && items.every((t) => QUOTE_RE.test(t.trim()))) { out.push(`<div class="say-stack">${items.map((t) => sayCard(t.trim(), EN.sayTry, true)).join("")}</div>`); continue; }
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
    const para = buf.join(" ").trim();
    // "Instead of: ..." followed by "Try: ..." becomes one before/after card
    const sm = para.match(SAY_RE);
    if (sm && /^instead of/i.test(sm[1])) {
      let j = i; while (j < lines.length && !lines[j].trim()) j++;
      const next = j < lines.length ? lines[j].trim().match(SAY_RE) : null;
      if (next && !/^instead of/i.test(next[1])) { out.push(swapCard(sm[2], next[2])); i = j + 1; continue; }
    }
    if (sm) { out.push(sayCard(sm[2], /^instead of/i.test(sm[1]) ? EN.sayInstead : EN.sayTry, !/^instead of/i.test(sm[1]))); continue; }
    if (QUOTE_RE.test(para) && para.length < 420) { out.push(sayCard(para, EN.sayTry, true)); continue; }
    const lab = para.match(/^\*\*([^*]{3,80})\*\*\s*(["\u201c][^"\u201c\u201d]{12,}["\u201d]\.?)$/);
    if (lab) { out.push(sayCard(lab[2], lab[1].replace(/[.:]$/, ""), true)); continue; }
    out.push(sayInline(para));
  }
  return { html: out.join("\n"), headings };
}

// ------------------------------------------------------------ blog images
// Each post has three illustrations: /img/blog/<file-name>-1.svg (also the card thumbnail and the share image),
// -2.svg and -3.svg (placed inside the article). Translated posts use the same images (same file name).
const IMG_DIR = path.join(LANDING, "img", "blog");
const IMG_V = "6"; // bump when the illustrations change (cache busting)
// photos (.jpg, from Pexels) win over the older illustrations (.svg) when both exist
const imgExt = (key) => (fs.existsSync(path.join(IMG_DIR, `${key}-1.jpg`)) ? "jpg" : "svg");
const imgFile = (key, n, ext = imgExt(key)) => `/img/blog/${key}-${n}.${ext}${ext === "png" ? "" : `?v=${IMG_V}`}`;
const hasImgs = (key) => fs.existsSync(path.join(IMG_DIR, `${key}-1.jpg`)) || fs.existsSync(path.join(IMG_DIR, `${key}-1.svg`));
// Optional alt text for in-article images (e.g. infographics): blog-posts/_figure-alts.json { "<file-name>-2": "..." }
const FIG_ALTS = (() => { try { return JSON.parse(fs.readFileSync(path.join(POSTS_DIR, "_figure-alts.json"), "utf8")); } catch (_) { return {}; } })();
const figAlt = (key, n) => String(FIG_ALTS[`${key}-${n}`] || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const figure = (key, n) => `<figure class="article-fig"><img src="${imgFile(key, n)}" alt="${figAlt(key, n)}" width="800" height="450" loading="lazy" decoding="async" /></figure>`;
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
      const updated = /^\d{4}-\d{2}-\d{2}$/.test(meta.updated || "") ? meta.updated : null;
      posts.push({ key, slug, title: meta.title, date, updated, description, tags, html, minutes: Math.max(1, Math.round(words / 210)) });
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

function page(ctx, { title, description, path: pagePath, type = "website", body, jsonld, image = `${SITE}/og-image.png` }) {
  return shellPage({ title, description, path: pagePath, type, body, jsonld, image, cls: "sp-blog" });
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
  <a href="https://app.relationshipaiadvice.com/register.html" class="btn btn-gradient" data-umami-event="${event}">${ctx.T(EN.cta)}</a>
  <p class="ig-line soc-line">${ctx.T(EN.ctaIg)} <span class="soc-row"><a href="https://www.instagram.com/relationshipai_/" target="_blank" rel="noopener noreferrer" aria-label="Instagram @relationshipai_" title="Instagram @relationshipai_" data-umami-event="click-instagram-article"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6" fill="currentColor"/></svg></a><a href="https://www.pinterest.com/Relationshipaiadvice/" target="_blank" rel="noopener noreferrer" aria-label="Pinterest @Relationshipaiadvice" title="Pinterest @Relationshipaiadvice" data-umami-event="click-pinterest-article"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.972 5.367 18.605 0 12.017 0z"/></svg></a><a href="https://www.youtube.com/@relationshipai_advice" target="_blank" rel="noopener noreferrer" aria-label="YouTube @relationshipai_advice" title="YouTube @relationshipai_advice" data-umami-event="click-youtube-article"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></a><a href="https://www.tiktok.com/@relationshipai_" target="_blank" rel="noopener noreferrer" aria-label="TikTok @relationshipai_" title="TikTok @relationshipai_" data-umami-event="click-tiktok-article"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg></a></span></p>
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
        <a href="https://app.relationshipaiadvice.com/register.html" class="btn" data-umami-event="cta-blog-banner">${T(EN.cta)}</a>
      </div>
    </section>
  </main>`,
    jsonld: { "@context": "https://schema.org", "@type": "Blog", name: `${CONFIG.siteName} Blog`, url: `${SITE}${ctx.prefix}/blog/`, inLanguage: ctx.lang.htmlLang },
  });
}

// ----- article enhancements: at-a-glance box, early tool card, FAQ accordion, callouts
const TOOL = {
  check: { k: "Message check", title: "Not sure how your text will land?", text: "Paste it in and see how it may read to them, plus a calmer version you can send.",
    demo: '<div class="tc-b me">Fine. Do whatever you want.</div><div class="tc-tag">Likely to read as: cold</div><div class="tc-b ai">I\u2019m upset and need a bit of time. Can we talk tonight?</div>' },
  practice: { k: "Partner Practice", title: "Rehearse this conversation first", text: "An AI plays your partner so you can try the words before the real talk. Then you get feedback.",
    demo: '<div class="tc-b me">Can we talk about this weekend? I want us to plan it together.</div><div class="tc-b them">Sure. What\u2019s on your mind?</div><div class="tc-tag">Feedback: calm start, clear ask</div>' },
  coach: { k: "Coach Chat", title: "Talk it through with a coach", text: "Tell it what happened and get calm, concrete next steps. Private, any time, even at 2am.",
    demo: '<div class="tc-b me">We had the same fight again and I don\u2019t know what to say.</div><div class="tc-b ai">Let\u2019s slow it down. What did you most want them to hear?</div>' },
};
function toolCard(p) {
  const kind = AD_BY_POST[p.key] || "coach", t = TOOL[kind];
  return `<aside class="tool-card tc-${kind}"><div class="tc-copy"><span class="tc-k">${t.k} \u00b7 Free</span><p class="tc-h">${t.title}</p><p class="tc-p">${t.text}</p><a class="btn btn-gradient" href="${APP_SIGNUP}" data-umami-event="cta-blog-inline-${kind}">Try it free</a><small>No card needed</small></div><div class="tc-demo" aria-hidden="true">${t.demo}</div></aside>`;
}
// "Add as preferred source" box: lets readers see our articles first in Google's Top Stories
const G_LOGO = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s.9 7.4 2.6 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.2 0-11.5-4.2-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';
function prefSource() {
  return `<aside class="pref-src"><div class="ps-copy"><p class="ps-h">Make Google show you more of this.</p><p class="ps-p">Add RelationshipAI as a preferred source and see our new guides first in your Google feed.</p></div><a class="ps-btn" href="https://www.google.com/preferences/source?q=${CONFIG.domain}" target="_blank" rel="noopener" data-umami-event="blog-preferred-source">${G_LOGO}<span>Add as preferred source</span></a></aside>`;
}
function enhance(p) {
  let h = p.html;
  // FAQ: an H2 like "Quick answers" / "FAQ" followed by H3 questions becomes an accordion
  const faq = [];
  h = h.replace(/(<h2 id="[^"]+">[^<]*(?:quick answers|faq|frequently asked|common questions)[^<]*<\/h2>)([\s\S]*?)(?=<h2[\s>]|$)/i, (m, head, body) => {
    const parts = body.split(/(?=<h3[\s>])/);
    const pre = parts[0].startsWith("<h3") ? "" : parts.shift();
    const items = parts.map((x) => {
      const q = (x.match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || [, ""])[1];
      const a = x.replace(/<h3[^>]*>[\s\S]*?<\/h3>/, "").trim();
      faq.push({ q: stripTags(q), a: stripTags(a) });
      return `<details class="faq-item"><summary>${q}</summary><div class="faq-a">${a}</div></details>`;
    });
    return `${head}${pre}<div class="faq-list">${items.join("")}</div>\n`;
  });
  // callouts
  h = h.replace(/(<h2 id="[^"]+">A note on safety<\/h2>)([\s\S]*?)(?=<h2[\s>]|<p><em>|$)/i, '<section class="callout callout-safety">$1$2</section>\n');
  h = h.replace(/(<h2 id="sources">Sources<\/h2>)([\s\S]*?)$/i, '<section class="sources-box">$1$2</section>');
  // at a glance: numbered headings (## 1. / ### 1.)
  const nums = [...h.matchAll(/<h([23]) id="([^"]+)">\s*(\d+)[.)]\s*([\s\S]*?)<\/h\1>/g)].map((m) => ({ id: m[2], n: m[3], text: stripTags(m[4]) }));
  const glance = nums.length >= 3 ? `<nav class="glance" aria-label="${attr(EN.glance)}"><p class="glance-k">${EN.glance}</p><ol>${nums.map((x) => `<li><a href="#${x.id}">${esc(x.text)}</a></li>`).join("")}</ol></nav>` : "";
  const first = h.search(/<h2[\s>]/);
  const insert = prefSource() + glance + toolCard(p);
  h = first > 0 ? h.slice(0, first) + insert + "\n" + h.slice(first) : insert + h;
  return { html: h, faq };
}
function shareBar(p, url) {
  const u = encodeURIComponent(url), t = encodeURIComponent(p.title);
  const img = hasImgs(p.key) ? encodeURIComponent(`${SITE}${imgFile(p.key, 1)}`) : "";
  const ic = {
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    wa: '<path d="M4 20l1.3-4A8 8 0 1 1 8 19z"/><path d="M9 9.5c.3 1.7 2 3.7 4.5 4.5l1-1.2 1.8.8c-.2 1-1 1.6-2 1.6A6.5 6.5 0 0 1 7.6 9c0-1 .6-1.8 1.6-2l.8 1.8z"/>',
    pin: '<circle cx="12" cy="12" r="9"/><path d="M11 8.5c2.6-.6 4.6.8 4.2 3.2-.3 2-2 3.2-3.6 2.4M11.5 9.5L9.5 19"/>',
    fb: '<path d="M14 8h2V5h-2.5C11.6 5 10.5 6.2 10.5 8v2H8.5v3h2v7h3v-7h2.3l.4-3h-2.7V8.4c0-.3.2-.4.5-.4z"/>',
    x: '<path d="M5 5l14 14M19 5L5 19"/>',
  };
  const b = (k, href, label, extra = "") => `<a class="sb-btn" ${href ? `href="${href}" target="_blank" rel="noopener noreferrer"` : 'href="#" role="button"'} aria-label="${label}" title="${label}" ${extra} data-umami-event="share-${k}"><svg viewBox="0 0 24 24" aria-hidden="true">${ic[k]}</svg></a>`;
  return `<div class="share-bar"><p>${EN.shareTitle}</p><div class="sb-row">${b("link", "", "Copy link", `data-copy="${attr(url)}" data-done="${attr(EN.linkCopied)}"`)}${b("wa", `https://wa.me/?text=${t}%20${u}`, "Share on WhatsApp")}${b("pin", `https://www.pinterest.com/pin/create/button/?url=${u}&media=${img}&description=${t}`, "Save on Pinterest")}${b("fb", `https://www.facebook.com/sharer/sharer.php?u=${u}`, "Share on Facebook")}${b("x", `https://x.com/intent/post?url=${u}&text=${t}`, "Share on X")}</div></div>`;
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
          <div class="ad-body">
            <span class="ad-ic" aria-hidden="true"></span>
            <h3>${title}</h3>
            <p>${text}</p>
            <a href="https://app.relationshipaiadvice.com/register.html" class="btn btn-gradient" data-umami-event="cta-blog-sidebar">${T(EN.cta)}</a>
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

function postPage(ctx, p0, all) {
  const { T, posts } = ctx;
  const enh = enhance(p0);
  const p = { ...p0, html: enh.html };
  const others = posts.filter((x) => x.slug !== p.slug).slice(0, 3);
  const { exact, fallback } = switcherTargets("post", p.key, all);
  const url = `${SITE}${ctx.prefix}/blog/${p.slug}/`;
  const toc = tocOf(p);
  const tocList = toc.map((h) => `<li><a href="#${h.id}">${esc(h.text)}</a></li>`).join("");
  const avatar = fs.existsSync(path.join(LANDING, "img", "jonas.jpg"))
    ? `<img class="avatar" src="/img/jonas.jpg" alt="" width="64" height="64" />`
    : `<img class="avatar" src="/logo-tile.svg" alt="" width="64" height="64" />`;
  const ogPng = imgExt(p.key) === "jpg" && hasImgs(p.key) ? `${SITE}${imgFile(p.key, 1, "jpg")}` : hasImgs(p.key) && fs.existsSync(path.join(IMG_DIR, `${p.key}-1.png`)) ? `${SITE}${imgFile(p.key, 1, "png")}` : null;
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
            <a href="/about/" class="avatar-link" aria-label="About us">${avatar}</a>
            <p>${T(EN.by)} <a href="/about/" class="author" data-umami-event="click-author">${AUTHOR}</a><span class="dot">·</span>${p.updated ? `${T(EN.updated)} ${fmtDate(p.updated, ctx.locale)}` : fmtDate(p.date, ctx.locale)}<span class="dot">·</span>${T(EN.minRead).replace("{n}", p.minutes)}</p>
          </div>
          ${toc.length > 2 ? `<details class="toc-mobile"><summary>${T(EN.tocTitle)}</summary><ol>${tocList}</ol></details>` : ""}
          ${hasImgs(p.key) ? `<figure class="article-fig article-hero"><img src="${imgFile(p.key, 1)}" alt="" width="800" height="450" decoding="async" fetchpriority="high" /></figure>` : ""}
          <div class="article-body">
${withImages(p)}
          </div>
          ${methodBox(ctx, p)}
          ${ctaBox(ctx, "cta-blog-article")}
          ${shareBar(p, url)}
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
    jsonld: enh.faq.length ? { "@context": "https://schema.org", "@graph": [articleLd(ctx, p, url, ogPng), { "@type": "FAQPage", mainEntity: enh.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }] } : { "@context": "https://schema.org", ...articleLd(ctx, p, url, ogPng) },
  });
}
function methodBox(ctx, p) {
  const { T } = ctx;
  const nSrc = (p.html.match(/<h2 id="sources">[\s\S]*$/i)?.[0].match(/<li>/g) || []).length;
  const when = fmtDate(p.updated || p.date, ctx.locale);
  const li = [
    "We start from peer-reviewed studies and established couples therapy methods, such as the Gottman Method, attachment research and Nonviolent Communication.",
    nSrc ? `Numbers and study results are linked to their sources (${nSrc} in this guide).` : "Numbers and study results are linked to their sources.",
    "Examples and scenarios are illustrative composites, not real people or clients.",
    p.updated ? "Drafted with AI assistance, then checked against the cited sources before publishing." : "Drafted with AI assistance, based on the sources listed below.",
  ];
  return `<aside class="method-box" aria-label="${attr(T("About this guide"))}">
            <div class="mb-head">
              <img class="mb-av" src="/logo-tile.svg" alt="" width="44" height="44" />
              <div><p class="mb-k">${T("About this guide")}</p><p class="mb-by">${T("Written by")} <a href="/about/">${AUTHOR}</a>, ${T("founder of RelationshipAI")}</p></div>
            </div>
            <p class="mb-t">${T("How we make our guides")}</p>
            <ul>${li.map((t) => `<li>${T(t)}</li>`).join("")}</ul>
            <p class="mb-foot"><span>${p.updated ? T("Last reviewed") : T("Published")} ${when}</span><a href="/method/" data-umami-event="blog-method-link">${T("Our method")} \u2192</a></p>
          </aside>`;
}
function articleLd(ctx, p, url, ogPng) {
  return {
      "@type": "Article", headline: p.title, description: p.description,
      datePublished: p.date, dateModified: p.updated || p.date, mainEntityOfPage: url,
      inLanguage: ctx.lang.htmlLang,
      image: ogPng || `${SITE}/og-image.png`,
      author: { "@type": "Person", name: AUTHOR, url: INSTAGRAM },
      publisher: { "@type": "Organization", name: CONFIG.siteName, sameAs: [INSTAGRAM], logo: { "@type": "ImageObject", url: `${SITE}/icon-512.png` } },
  };
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
        <p class="blog-all"><a href="${ctx.prefix ? `${ctx.prefix}/blog/` : "/blog/"}" class="btn btn-ghost">${T(EN.seeAll)}</a> <a href="${INSTAGRAM}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost" aria-label="Instagram @relationshipai_" data-umami-event="click-instagram-blog-home"><img src="/img/instagram.svg" alt="" width="20" height="20" style="display:inline-block;vertical-align:-5px;margin-right:7px;border-radius:6px;flex-shrink:0" />@relationshipai_</a></p>
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
    // (no blog section on the home page anymore: the blog lives in the footer only)
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
try { await import("./build-pages.mjs"); } catch (e) { console.error("pages build failed:", e); }
