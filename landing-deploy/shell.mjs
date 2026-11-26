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
    .replace(/<a href="\/#blog">Blog<\/a>/, '<a href="/blog/">Blog</a>').replace(/href="\/#join"/, 'href="https://app.relationshipaiadvice.com/register.html"');
  const footer = (h.match(/<footer class="hx-foot">[\s\S]*?<\/footer>/) || [""])[0]
    .replace(/href="index\.html"/g, 'href="/"').replace(/src="logo-tile\.svg"/g, 'src="/logo-tile.svg"');
  const section = (id) => { const m = h.match(new RegExp(`<section class="hx-sec" id="${id}">[\\s\\S]*?<\\/section>`)); return m ? m[0] : ""; };
  cache = { nav, footer, section };
  return cache;
}
export const homeSection = (id) => parts().section(id);

/** Wrap `body` (the <main> contents) into a full page in the current design. */
export function page({ title, description, path: p, type = "website", body, jsonld, image = `${SITE}/og-image.png?v=2`, cls = "", noindex = false, head = "" }) {
  const { nav, footer } = parts();
  const canonical = `${SITE}${p}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${canonical}" />${noindex ? '\n  <meta name="robots" content="noindex" />' : '\n  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />'}
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
  <link rel="stylesheet" href="/css/f-skin.css?v=10" />
  <link rel="stylesheet" href="/css/pages.css?v=3" />
  <link rel="stylesheet" href="/css/light.css?v=10" />
  <link rel="stylesheet" href="/css/light-pages.css?v=1" />
  <link rel="stylesheet" href="/css/mobile-pages.css?v=11" />
  <link rel="stylesheet" href="/css/mobile-sheet.css?v=6" />
  <link rel="stylesheet" href="/css/mobile-acc.css?v=4" />
  <link rel="stylesheet" href="/css/blog-pages.css?v=10" />
  <link rel="stylesheet" href="/css/try.css?v=9" />
  <meta name="theme-color" content="#3b2218" />${head ? "\n" + head : ""}
  <script defer src="https://cloud.umami.is/script.js" data-website-id="62eda2bd-4092-439e-9668-755fa2ca5aea"></script>
${jsonld ? `  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>\n` : ""}</head>
<body class="hx spg ${cls}">
<div class="f-cur" aria-hidden="true"><svg viewBox="0 0 100 100"><path d="M50 88 C20 64 6 46 6 30 C6 16 17 8 29 8 C38 8 46 13 50 21 C54 13 62 8 71 8 C83 8 94 16 94 30 C94 46 80 64 50 88 Z" fill="#f58fab"/></svg></div>
${nav}

  <main class="sp-main">
${body}
  </main>

  ${footer}
  <script src="/js/home.js?v=8"></script><script defer src="/js/f.js?v=6"></script><script defer src="/js/pages.js?v=5"></script><script defer src="/js/mobile-pages.js?v=1"></script><script defer src="/js/mobile-acc.js?v=1"></script><script defer src="/js/carousel-dots.js?v=3"></script><script defer src="/js/table-sheet.js?v=1"></script>
</body>
</html>
`;
}

// ------------------------------------------------------------ free checker widget
// The free Message check (no account) as an inline card, for tool pages and blog posts.
// It talks to the public endpoint through /js/try.js; one widget per page (fixed ids).
export const CHECKERS = {
  tone: {
    kicker: "Text tone checker", title: "Not sure how your text sounds?",
    sub: "Paste it here. See how it may land and get a calmer or clearer version. Free, no sign-up, nothing saved.",
    intro: "Paste the text you're about to send. I'll read it the way they will.",
    examples: ["Fine. Do whatever you want.", "K.", "We need to talk."],
  },
  apology: {
    kicker: "Apology text checker", title: "Check your apology before you send it",
    sub: "Paste your sorry text. See if it sounds sincere or defensive, and get a version that owns it. Free, no sign-up.",
    intro: "Paste your apology. I'll tell you how it may land and suggest a version that sounds like you mean it.",
    examples: ["I'm sorry you feel that way.", "Sorry, but you overreacted too.", "I'm sorry I snapped at you last night. That wasn't fair to you."],
  },
  fight: {
    kicker: "After-a-fight text check", title: "Check the first text after the fight",
    sub: "The first message after an argument sets the tone. Paste yours and see if it opens the door or starts round two.",
    intro: "Paste the text you want to send after the fight. I'll read it the way they will.",
    examples: ["Are you still mad?", "Can we talk later? I hate how we left it.", "I'm not apologizing for being upset."],
  },
  passive: {
    kicker: "Passive-aggressive checker", title: "Is your text passive-aggressive?",
    sub: "Paste it in. See if it reads as calm or as a jab, which words do it, and get a version that says what you mean.",
    intro: "Paste the text. I'll tell you if it reads as passive-aggressive and why.",
    examples: ["Thanks for finally replying.", "No worries, I'll just do it myself.", "Per my last message..."],
  },
};
export function checker(kind, where) {
  const c = CHECKERS[kind] || CHECKERS.tone;
  const ex = c.examples.map((e) => `<button type="button" data-ex="${esc(e)}">&ldquo;${esc(e)}&rdquo;</button>`).join("");
  return `<div class="tw tw-in" id="try-card" data-where="${esc(where)}" data-mode="${esc(kind)}">
  <div class="tw-in-head"><span class="f-tag"><b>${esc(c.kicker)}</b></span>
    <p class="tw-in-h">${esc(c.title)}</p>
    <p class="tw-in-sub">${esc(c.sub)}</p></div>
  <div class="tw-ex" role="group" aria-label="Example messages"><span>Or try one</span>${ex}</div>
  <div class="tw-scr">
    <div class="tw-top"><span class="tw-pt"><i></i>${esc(c.kicker)}</span><span class="tw-left" id="try-left"></span></div>
    <div class="tw-msgs" id="try-msgs" aria-live="polite"><div class="tw-b ai">${esc(c.intro)}</div></div>
    <p class="tw-err" id="try-err" role="alert" hidden></p>
    <div class="tw-bar">
      <textarea id="try-draft" maxlength="800" rows="1" placeholder="Type or paste your message&hellip;" aria-label="The message you are thinking of sending"></textarea>
      <button type="button" id="try-go" class="tw-send" aria-label="Check my message"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
    </div>
  </div>
  <p class="tw-in-foot">The full check, with their likely reply and a tip, is in the app. <a href="https://app.relationshipaiadvice.com/register.html?src=try-${esc(where)}" data-umami-event="try-${esc(where)}-foot">Create a free account</a></p>
  <script defer src="/js/try.js?v=6"></script>
</div>`;
}
