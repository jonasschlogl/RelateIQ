// Builds every non-home, non-blog-article page in the current design from pages-src/ + sections of index.html.
// Runs after build-blog.mjs (it imports this file). Output: clean URLs like /partner-practice/.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { page, homeSection, LANDING, esc } from "./shell.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "pages-src");
const read = (n) => fs.readFileSync(path.join(SRC, n), "utf8");
const write = (rel, html) => { const f = path.join(LANDING, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); };

const URL_OF = { practice: "/partner-practice/", coach: "/coach-chat/", message: "/message-check/", more: "/other-tools/", support: "/contact/", "blog-all": "/blog/",
  "blog-attachment": "/blog/topic/attachment-styles/", "blog-communication": "/blog/topic/communication/", "blog-conflict": "/blog/topic/conflict/",
  "blog-repair": "/blog/topic/repairing-a-relationship/", "blog-overthinking": "/blog/topic/overthinking/" };

/** Turn a modal panel into normal page content: visible, real links, no modal-only attributes. */
function panelHtml(id) {
  let h = read(`panel-${id}.html`);
  h = h.replace(/\shidden(?=[\s>])/, "");
  h = h.replace(/<button type="button" class="fm-next([^"]*)" data-go="([a-z-]+)">([\s\S]*?)<\/button>/g, (m, c, go, inner) => `<a class="fm-next${c}" href="${URL_OF[go]}">${inner}</a>`);
  h = h.replace(/href="#learn-([a-z-]+)"(\s+data-feature="[a-z-]+")?/g, (m, k) => `href="${URL_OF[k] || "/"}"`);
  h = h.replace(/\sdata-fclose/g, "").replace(/\sdata-feature="[a-z-]+"/g, "");
  h = h.replace(/href="#join"/g, 'href="https://app.relationshipaiadvice.com/register.html"').replace(/href="#faq"/g, 'href="/faq/"').replace(/href="#pricing"/g, 'href="/pricing/"');
  return h;
}
const JOIN_CTA = `<section class="sp-end"><div class="hx-wrap"><div class="sp-end-card"><h2>Your next conversation can go <em>better.</em></h2><p>Create a free account and talk it through tonight. No card needed.</p><a class="hx-btn" href="https://app.relationshipaiadvice.com/register.html" data-umami-event="cta-page-end">Try it free</a></div></div></section>`;

const PAGES = [
  { slug: "partner-practice", panel: "practice", title: "Partner Practice: rehearse the hard conversation | RelationshipAI", desc: "An AI plays your partner, in character, so you can rehearse a hard conversation, get a debrief and a readiness score, and walk in knowing how it can go." },
  { slug: "coach-chat", panel: "coach", title: "Coach Chat: a relationship coach that remembers your story | RelationshipAI", desc: "Talk it through at 2am. Coach Chat remembers your partner and your past chats, so you never start from zero." },
  { slug: "message-check", panel: "message", title: "Message check: read it the way they will | RelationshipAI", desc: "Paste a message before you send it. See how it may land and get a calmer, warmer or more direct version." },
  { slug: "other-tools", panel: "more", title: "More tools for the moments in between | RelationshipAI", desc: "Everything else inside RelationshipAI: after a fight, daily check-ins, weekly focus, talk plans, therapist summaries and more." },
  { slug: "contact", panel: "support", title: "Contact RelationshipAI", desc: "Questions, feedback or a bug? Write to us by email or on Instagram and we will get back to you." },
  { slug: "blog/topic/attachment-styles", panel: "blog-attachment", title: "Attachment styles: articles | RelationshipAI", desc: "Articles on attachment style: the pattern you learned for getting close to people, and how you react when closeness feels uncertain." },
  { slug: "blog/topic/communication", panel: "blog-communication", title: "Communication in relationships: articles | RelationshipAI", desc: "Practical articles on communicating in a relationship: how to say hard things, apologise and be heard." },
  { slug: "blog/topic/conflict", panel: "blog-conflict", title: "Conflict in relationships: articles | RelationshipAI", desc: "Articles on arguments, recurring fights and how to handle conflict without making it worse." },
  { slug: "blog/topic/repairing-a-relationship", panel: "blog-repair", title: "Repairing a relationship: articles | RelationshipAI", desc: "Articles on rebuilding trust and repairing a relationship after a fight or a rough patch." },
  { slug: "blog/topic/overthinking", panel: "blog-overthinking", title: "Overthinking in a relationship: articles | RelationshipAI", desc: "Articles on stopping the spiral: how to stop overthinking in a relationship." },
];

for (const p of PAGES) {
  const cls = p.panel.startsWith("blog") ? "sp-topic" : "sp-feature";
  write(`${p.slug}/index.html`, page({ title: p.title, description: p.desc, path: `/${p.slug}/`, cls,
    body: `<div class="sp-panel">${panelHtml(p.panel)}</div>\n${p.panel.startsWith("blog") || p.panel === "support" ? "" : JOIN_CTA}` }));
}

// about
write("about/index.html", page({ title: "About RelationshipAI | Built for the 2am moment", description: "RelationshipAI was founded by Jonas, who wanted calm, structured help for the hardest conversations, available at 2am.", path: "/about/", cls: "sp-about",
  body: `<div class="sp-wrap">${read("about.html").replace('href="#join"', 'href="https://app.relationshipaiadvice.com/register.html"').replace('href="method.html"', 'href="/method/"').replace(/\sdata-close/g, "")}</div>` }));

// legal + method (existing copy, new shell)
const LEGAL = { method: ["Our Method | RelationshipAI", "The research RelationshipAI's coaching is grounded in (the Gottman Method, attachment theory, and Nonviolent Communication) with sources, not just name-dropping.", "sp-method"],
  privacy: ["Privacy Policy | RelationshipAI", "How RelationshipAI collects, uses and protects your information, including your conversations and partner profiles. Plain language, no selling of data, no AI training on your chats.", "sp-legal"],
  terms: ["Terms of Service | RelationshipAI", "The rules for using RelationshipAI: what the service is and isn't, your account, acceptable use, plans and billing, and limits of liability.", "sp-legal"] };
for (const [k, [t, d, c]] of Object.entries(LEGAL)) write(`${k}/index.html`, page({ title: t, description: d, path: `/${k}/`, cls: c, body: read(`${k}.html`) }));

// sections lifted from the home page, so they never drift apart
for (const [slug, id, title, desc] of [
  ["pricing", "pricing", "Pricing | RelationshipAI", "Start free. Upgrade when it helps. Pro and Premium plans for RelationshipAI, billed monthly or yearly."],
  ["faq", "faq", "FAQ | RelationshipAI", "Answers to common questions about RelationshipAI: privacy, therapy, partners, plans and more."],
  ["early-access", "join", "Try RelationshipAI free | RelationshipAI", "Create a free RelationshipAI account in about a minute. No card needed."],
]) {
  let sec = homeSection(id);
  if (!sec) { console.warn(`pages: section #${id} not found in index.html`); continue; }
  sec = sec.replace(/href="#join"/g, 'href="https://app.relationshipaiadvice.com/register.html"').replace(/href="#faq"/g, 'href="/faq/"');
  write(`${slug}/index.html`, page({ title, description: desc, path: `/${slug}/`, cls: `sp-sec sp-${slug}`, body: sec }));
}
console.log(`pages: ${PAGES.length + 1 + Object.keys(LEGAL).length + 3} pages written`);
