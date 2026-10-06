// Static blog generator for the RelationshipAI landing page.
//
//   blog-posts/*.md   ->   ../landing-page/blog/index.html
//                          ../landing-page/blog/<slug>/index.html
//                          + "From the blog" block on ../landing-page/index.html
//                          + ../landing-page/sitemap.xml
//
// No dependencies, plain Node. Runs automatically before every deploy
// (see "build" in wrangler.jsonc), and can also be run by hand: node build-blog.mjs
//
// A post is a Markdown file with a small header:
//
//   ---
//   title: How to fix a relationship
//   date: 2026-10-06
//   description: One or two sentences for Google and for the blog cards.
//   tags: relationship advice, communication
//   draft: true            (optional - draft posts are not published)
//   ---
//   Your text here ...

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LANDING = process.env.LANDING_DIR || path.resolve(HERE, "../landing-page");
const POSTS_DIR = process.env.POSTS_DIR || path.join(HERE, "blog-posts");

const INSTAGRAM = "https://www.instagram.com/relationshipai_official/";

const CONFIG = {
  domain: "relationshipaiadvice.com",
  siteName: "RelationshipAI",
  umami: "62eda2bd-4092-439e-9668-755fa2ca5aea",
  staticPages: ["", "method.html", "privacy.html"],
};
const SITE = `https://${CONFIG.domain}`;

// ---------------------------------------------------------------- helpers
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slugify = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const fmtDate = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

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
    // fenced code
    if (/^```/.test(line)) {
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`);
      continue;
    }
    // headings (# and ## both become h2 — the post title is the only h1)
    let m = line.match(/^(#{1,4})\s+(.*)$/);
    if (m) {
      const level = m[1].length <= 2 ? 2 : m[1].length;
      const id = slugify(m[2]);
      headings.push({ level, id, text: m[2] });
      out.push(`<h${level} id="${id}">${inline(m[2])}</h${level}>`);
      i++; continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { out.push("<hr />"); i++; continue; }
    // blockquote
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`);
      continue;
    }
    // lists
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
    // paragraph
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|>|```|\s*[-*]\s+|\s*\d+[.)]\s+|-{3,}\s*$)/.test(lines[i])) buf.push(lines[i++]);
    if (!buf.length) { i++; continue; }
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  return { html: out.join("\n"), headings };
}

// ------------------------------------------------------------ load the posts
function loadPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  const posts = [];
  for (const file of fs.readdirSync(POSTS_DIR)) {
    if (!file.endsWith(".md") || file.startsWith("_")) continue;
    try {
      const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
      const { meta, body } = parseFrontMatter(raw);
      if (/^(true|yes|1)$/i.test(meta.draft || "")) { console.log(`skip draft: ${file}`); continue; }
      if (!meta.title) throw new Error("missing 'title:'");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date || "")) throw new Error("missing or invalid 'date:' (use YYYY-MM-DD)");
      const slug = slugify(meta.slug || file.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, ""));
      const { html } = markdown(body);
      const words = body.split(/\s+/).filter(Boolean).length;
      const tags = (meta.tags || "").split(",").map((t) => t.trim()).filter(Boolean);
      const description = meta.description || body.replace(/[#*_>`\[\]()-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 155);
      posts.push({ slug, title: meta.title, date: meta.date, description, tags, html, minutes: Math.max(1, Math.round(words / 210)) });
    } catch (e) {
      console.warn(`WARNING: skipped ${file}: ${e.message}`);
    }
  }
  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)));
  return posts;
}

// ------------------------------------------------------------------ templates
const NAV = `  <header class="site-nav">
    <a href="/" class="brand"><img class="brand-mark" src="/favicon.svg" alt="" width="30" height="30" style="display:inline-block;vertical-align:middle;margin:-4px 10px 0 0;border-radius:8px" />Relationship<span>AI</span></a>
    <button class="nav-toggle" id="nav-toggle" aria-label="Menu">☰</button>
    <nav class="nav-links" id="nav-menu">
      <a href="/#coach">Coach Chat</a>
      <a href="/#practice">Partner Practice</a>
      <a href="/#pricing">Pricing</a>
      <a href="/blog/">Blog</a>
      <a href="#" class="btn btn-gradient btn-sm" data-cta data-umami-event="cta-blog-nav">Get early access</a>
    </nav>
  </header>`;

const FOOTER = `  <footer class="site-footer">
    <p class="footer-disclaimer">
      RelationshipAI is an AI tool for personal growth and does not replace professional psychological or therapeutic
      care. If you're in a crisis, please contact a professional or a helpline in your country.
    </p>
    <p class="footer-copy">© ${new Date().getUTCFullYear()} ${CONFIG.siteName} · <a href="/blog/">Blog</a> · <a href="${INSTAGRAM}" target="_blank" rel="noopener noreferrer" data-umami-event="click-instagram-footer">Instagram</a> · <a href="/privacy.html">Privacy</a></p>
  </footer>
  <a href="#" class="floating-cta" id="floating-cta" data-cta data-umami-event="cta-blog-floating">Get early access</a>`;

function page({ title, description, canonical, type = "website", body, jsonld }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:type" content="${type}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${SITE}/og-image.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${SITE}/og-image.png" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;0,600;1,500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/css/style.css?v=51" />
  <link rel="stylesheet" href="/css/landing.css?v=3" />
  <script defer src="https://cloud.umami.is/script.js" data-website-id="${CONFIG.umami}"></script>
${jsonld ? `  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>\n` : ""}</head>
<body class="lp blog">

${NAV}

${body}

${FOOTER}

  <script src="/js/landing.js?v=6"></script>
</body>
</html>
`;
}

const card = (p) => `<a class="post-card" href="/blog/${p.slug}/">
  <div class="post-card-top">${p.tags[0] ? `<span class="post-tag">${esc(p.tags[0])}</span>` : "<span></span>"}<span class="post-meta">${fmtDate(p.date)} · ${p.minutes} min read</span></div>
  <h3>${esc(p.title)}</h3>
  <p>${esc(p.description)}</p>
  <span class="post-more">Read article <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
</a>`;

const ctaBox = (event) => `<div class="article-cta">
  <h2>Want help applying this to your own relationship?</h2>
  <p>Talk it through in Coach Chat, then rehearse the conversation in Partner Practice. Free to start, opening soon.</p>
  <a href="#" class="btn btn-gradient" data-cta data-umami-event="${event}">Get early access</a>
  <p class="ig-line">Or get daily tips on <a href="${INSTAGRAM}" target="_blank" rel="noopener noreferrer" data-umami-event="click-instagram-article">Instagram @relationshipai_official</a></p>
</div>`;

// -------------------------------------------------------------------- output
function write(rel, content) {
  const f = path.join(LANDING, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
}

function build() {
  if (!fs.existsSync(LANDING)) { console.error(`landing dir not found: ${LANDING}`); process.exit(0); }
  const posts = loadPosts();
  console.log(`blog: ${posts.length} published post(s)`);

  // clean old generated post folders (so deleted/renamed posts disappear)
  const blogDir = path.join(LANDING, "blog");
  fs.rmSync(blogDir, { recursive: true, force: true });

  // blog index
  write("blog/index.html", page({
    title: `Relationship Advice & Tips from an AI Coach — ${CONFIG.siteName} Blog`,
    description: "Practical relationship advice: how to communicate better, fix relationship problems and have the hard conversations — grounded in the Gottman Method, attachment theory and Nonviolent Communication.",
    canonical: `${SITE}/blog/`,
    body: `  <main>
    <section class="blog-hero">
      <div class="container">
        <span class="section-tag">The blog</span>
        <h1>Relationship advice you can use tonight</h1>
        <p>Practical guides on communication, conflict and connection — grounded in methods real therapists use.</p>
      </div>
    </section>
    <section class="blog-list">
      <div class="container">
        ${posts.length ? `<div class="post-grid">${posts.map(card).join("\n")}</div>` : `<p class="blog-empty">New articles are on the way.</p>`}
      </div>
    </section>
    <section>
      <div class="cta-banner">
        <h2>Ready for a clearer head?</h2>
        <p>Be among the first to try Coach Chat and Partner Practice. Free to start, no card needed.</p>
        <a href="#" class="btn" data-cta data-umami-event="cta-blog-banner">Get early access</a>
      </div>
    </section>
  </main>`,
    jsonld: { "@context": "https://schema.org", "@type": "Blog", name: `${CONFIG.siteName} Blog`, url: `${SITE}/blog/` },
  }));

  // posts
  for (const p of posts) {
    const others = posts.filter((x) => x.slug !== p.slug).slice(0, 3);
    write(`blog/${p.slug}/index.html`, page({
      title: `${p.title} — ${CONFIG.siteName}`,
      description: p.description,
      canonical: `${SITE}/blog/${p.slug}/`,
      type: "article",
      body: `  <main>
    <article class="article">
      <div class="container article-wrap">
        <a href="/blog/" class="article-back">← All articles</a>
        <div class="article-tags">${p.tags.map((t) => `<span class="post-tag">${esc(t)}</span>`).join("")}</div>
        <h1>${esc(p.title)}</h1>
        <p class="article-meta">${fmtDate(p.date)} · ${p.minutes} min read</p>
        <div class="article-body">
${p.html}
        </div>
        ${ctaBox("cta-blog-article")}
        <p class="article-note">This article is general information for personal growth and not a substitute for professional advice. If you feel unsafe in your relationship, please contact a local support service or helpline.</p>
      </div>
    </article>
    ${others.length ? `<section class="blog-list more-posts">
      <div class="container">
        <h2>Keep reading</h2>
        <div class="post-grid">${others.map(card).join("\n")}</div>
      </div>
    </section>` : ""}
  </main>`,
      jsonld: {
        "@context": "https://schema.org", "@type": "Article", headline: p.title, description: p.description,
        datePublished: p.date, dateModified: p.date, mainEntityOfPage: `${SITE}/blog/${p.slug}/`,
        image: `${SITE}/og-image.png`,
        author: { "@type": "Organization", name: CONFIG.siteName },
        publisher: { "@type": "Organization", name: CONFIG.siteName, sameAs: [INSTAGRAM], logo: { "@type": "ImageObject", url: `${SITE}/apple-touch-icon.png` } },
      },
    }));
  }

  // "From the blog" block on the home page (between markers)
  const homeFile = path.join(LANDING, "index.html");
  if (fs.existsSync(homeFile)) {
    let home = fs.readFileSync(homeFile, "utf8");
    const block = posts.length ? `<section id="blog" class="blog-latest">
      <div class="container">
        <div class="section-head">
          <span class="section-tag">From the blog</span>
          <h2>Relationship advice, tips &amp; guides</h2>
          <p>Fresh, practical articles on communication, conflict and connection.</p>
        </div>
        <div class="post-grid">${posts.slice(0, 3).map(card).join("\n")}</div>
        <p class="blog-all"><a href="/blog/" class="btn btn-ghost">See all articles</a> <a href="${INSTAGRAM}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost" data-umami-event="click-instagram-blog-home">Follow on Instagram</a></p>
      </div>
    </section>` : "";
    const re = /<!--BLOG-LATEST-->[\s\S]*?<!--\/BLOG-LATEST-->/;
    if (re.test(home)) {
      home = home.replace(re, `<!--BLOG-LATEST-->\n    ${block}\n    <!--/BLOG-LATEST-->`);
      fs.writeFileSync(homeFile, home);
    } else console.warn("WARNING: BLOG-LATEST markers not found in index.html");
  }

  // sitemap
  const urls = [
    ...CONFIG.staticPages.map((p) => `  <url><loc>${SITE}/${p}</loc></url>`),
    `  <url><loc>${SITE}/blog/</loc></url>`,
    ...posts.map((p) => `  <url><loc>${SITE}/blog/${p.slug}/</loc><lastmod>${p.date}</lastmod></url>`),
  ];
  write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);
}

try { build(); } catch (e) { console.error("blog build failed (site will deploy without blog changes):", e); }
