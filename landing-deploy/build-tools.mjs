// Free tool pages (/tools/...): keyword landing pages for US search, each built around the free
// Message check widget (no account). Imported by build-pages.mjs. English only.
import fs from "node:fs";
import path from "node:path";
import { page, checker, esc, LANDING, SITE } from "./shell.mjs";

const write = (rel, html) => { const f = path.join(LANDING, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); };
const REG = "https://app.relationshipaiadvice.com/register.html";

const SRC = {
  kruger: `Kruger, J., Epley, N., Parker, J., & Ng, Z.-W. (2005). Egocentrism over e-mail: Can we communicate as well as we think? <em>Journal of Personality and Social Psychology</em>, 89(6), 925-936. Summary from the <a href="https://www.apa.org/monitor/feb06/egos" rel="noopener">American Psychological Association</a>`,
  klin: `Gunraj, D. N., Drumm-Hewitt, A. M., Dashow, E. M., Upadhyay, S. S. N., & Klin, C. M. (2016). Texting insincerely: The role of the period in text messaging. <em>Computers in Human Behavior</em>, 55, 1067-1075. <a href="https://www.eurekalert.org/news-releases/570442" rel="noopener">Binghamton University release</a>`,
  lewicki: `Lewicki, R. J., Polin, B., & Lount, R. B. (2016). An exploration of the structure of effective apologies. <em>Negotiation and Conflict Management Research</em>, 9(2), 177-196. <a href="https://news.osu.edu/the-6-elements-of-an-effective-apology-according-to-science/" rel="noopener">Ohio State University summary</a>`,
};

const swap = (rows) => `<div class="tl-swap">${rows.map(([b, g]) => `<div><p class="b"><small>Before</small>${b}</p><p class="g"><small>After</small>${g}</p></div>`).join("")}</div>`;
const steps = (items) => `<ol class="tl-steps">${items.map((s) => `<li>${s}</li>`).join("")}</ol>`;

const TOOLS = [
  {
    slug: "text-tone-checker", kind: "tone",
    title: "Text Tone Checker: How Does My Text Sound? (Free)",
    desc: "Free text message tone checker. Paste a text before you send it, see how it may come across, which words could backfire, and get a calmer version.",
    card: ["Text tone checker", "See how your text sounds before you send it, and get a calmer or clearer version."],
    h1: "Text tone checker: see how your text sounds before you send it",
    lead: "You know what you meant. The problem is they only get the words. Paste your text below and see how it is likely to land, before you hit send.",
    body: `
<h2>How to use the text tone checker</h2>
${steps(["Paste the text you are about to send, or tap one of the examples.", "Read how it is likely to come across: a risk level, what they may hear between the lines, and a five-point tone checklist.", "Copy a better version. With a free account you also see their likely reply, a second version and a tip for your exact situation."])}
<p>It works for any personal message: a partner, a date, a friend, a family member. It answers in the language you write in.</p>

<h2>Why texts get misread so often</h2>
<p>In a set of experiments, psychologists Justin Kruger, Nicholas Epley and colleagues asked people to write short messages that were either serious or sarcastic. The writers expected their tone to be read correctly about 78% of the time. The readers got it right about 56% of the time, not much better than a coin flip.</p>
<p>The reason is simple: when you write, you hear your own voice in your head. The other person hears nothing. They fill the gap with their mood, your history and whatever they are worried about that day.</p>
<p>Even punctuation does work you did not plan. In a Binghamton University study, one-word text replies like "Okay." or "Sure." were rated as less sincere when they ended with a period than when they did not.</p>

<h2>Before and after: small changes that change the tone</h2>
${swap([
  ["Fine. Do whatever you want.", "I'm frustrated, and I need a bit of time. Can we talk tonight?"],
  ["K.", "Okay, sounds good!"],
  ["We need to talk.", "Can we talk tonight about the weekend plans? Nothing bad, I just want us on the same page."],
  ["You never listen to me.", "I felt unheard earlier. Can I try explaining it again?"],
])}
<p>The point stays the same in each pair. What changes is how much the other person has to guess.</p>

<h2>What the checker looks for</h2>
<ul>
<li><strong>Absolutes</strong> like "always" and "never", which invite the other person to defend themselves instead of listening.</li>
<li><strong>Short replies</strong> that can read as cold, annoyed or uninterested, even when you are just busy.</li>
<li><strong>Sarcasm and jokes</strong> that only work if they can hear your voice.</li>
<li><strong>Blame</strong> that starts with "you" when the real message is how you feel.</li>
<li><strong>Vague alarm</strong>, like "we need to talk", that makes someone anxious for hours.</li>
</ul>
<p>If a text is about something big, a message may not be the right place for it at all. Our guide to <a href="/blog/relationship-advice-communication-habits/">communication habits in a relationship</a> covers when to talk instead of type.</p>

<h2>Quick answers</h2>
<h3>Is the text tone checker free?</h3>
<p>Yes. You get one free check a day without an account. A free account adds their likely reply, a second version and a tip for your situation.</p>
<h3>Is my message saved?</h3>
<p>No. The text you paste is not stored. Only a usage counter is kept, so the free checks can be limited per day.</p>
<h3>How is this different from Grammarly's tone detector?</h3>
<p>Grammarly's tone detector is a general writing tool, used mostly for work and school. This checker is built for personal messages: it reads how a text may make the other person feel, and how they might react, not just whether it sounds formal or friendly.</p>
<h3>Does it work in other languages?</h3>
<p>Yes. Write in your language and the read and the new versions come back in the same language.</p>

<h2>Read next</h2>
<ul class="tl-others">
<li><a href="/blog/what-to-text-after-a-fight/">What to text after a fight</a></li>
<li><a href="/blog/how-to-apologize-to-your-partner/">How to apologize to your partner</a></li>
<li><a href="/blog/silent-treatment-vs-needing-space/">Silent treatment vs needing space</a></li>
</ul>`,
    sources: ["kruger", "klin"],
    faq: [
      ["Is the text tone checker free?", "Yes. You get one free check a day without an account. A free account adds their likely reply, a second version and a tip for your situation."],
      ["Is my message saved?", "No. The text you paste is not stored. Only a usage counter is kept, so the free checks can be limited per day."],
      ["How is this different from Grammarly's tone detector?", "Grammarly's tone detector is a general writing tool, used mostly for work and school. This checker is built for personal messages: it reads how a text may make the other person feel, and how they might react."],
      ["Does it work in other languages?", "Yes. Write in your language and the read and the new versions come back in the same language."],
    ],
  },
  {
    slug: "apology-text-checker", kind: "apology",
    title: "Apology Text Checker: Will Your Sorry Text Land? (Free)",
    desc: "Free apology text checker. Paste your sorry text to your girlfriend, boyfriend or partner, see if it sounds sincere or defensive, and get a better version.",
    card: ["Apology text checker", "See if your sorry text sounds sincere or defensive, and get a version that owns it."],
    h1: "Apology text checker: will your sorry text actually land?",
    lead: "Most apology texts fail on one word: \"but\". Paste yours below, to your girlfriend, boyfriend or anyone else, and see if it sounds sincere before you send it.",
    body: `
<h2>How to use the apology text checker</h2>
${steps(["Paste your apology as you would send it, or start from one of the examples.", "See how it is likely to land, checked against the six parts research links to apologies that work, plus what they may hear between the lines.", "Copy a version that keeps your words but takes clear responsibility. A free account adds their likely reply, a second version and a tip."])}

<h2>What makes an apology work, according to research</h2>
<p>Researchers at Ohio State University, led by Roy Lewicki, tested six parts of an apology with 755 people: expressing regret, explaining what went wrong, acknowledging responsibility, declaring repentance, offering to repair, and asking for forgiveness.</p>
<p>The most important part by far was <strong>acknowledging responsibility</strong>: saying clearly that it was your fault. The second was an <strong>offer of repair</strong>. The least important was asking for forgiveness. In other words, "please forgive me" matters less than "I did this, and here is what I'll do".</p>

<h2>Apology texts that backfire, and better versions</h2>
${swap([
  ["I'm sorry you feel that way.", "I'm sorry I said that. It was unfair, and I can see why it hurt."],
  ["Sorry, but you overreacted too.", "I'm sorry I raised my voice. We can talk about the rest later, but this part was on me."],
  ["I said sorry, what else do you want?", "I know one sorry doesn't fix it. What would help you feel better about this?"],
  ["Sorry if I upset you.", "I'm sorry I canceled last minute. Can I make it up to you on Saturday?"],
])}
<p>Notice what changes: no "but", no "if", no "you feel". The better version names the thing you did and, where it fits, offers something concrete.</p>

<h2>When a text is the right place to say sorry</h2>
<p>A text works well for small things, or as a first step when the other person needs space. For something bigger, use the text to open the door, then apologize properly in person: "I owe you a real apology. Can we talk tonight?" Our guide on <a href="/blog/how-to-apologize-to-your-partner/">how to apologize to your partner</a> walks through the full conversation, and <a href="/blog/what-to-say-when-you-hurt-your-partners-feelings/">what to say when you hurt your partner's feelings</a> has more lines you can use.</p>

<h2>Quick answers</h2>
<h3>How do I apologize over text to my girlfriend or boyfriend?</h3>
<p>Keep it short, name what you did, take responsibility without "but", and offer something concrete, like talking tonight. Avoid long explanations in the first message. They read as excuses.</p>
<h3>Should I apologize over text or in person?</h3>
<p>For small things, a text is fine. For something that really hurt, use a text to say you are sorry and ask for a time to talk, then apologize in person.</p>
<h3>Is the apology checker free and private?</h3>
<p>Yes. One check a day is free without an account, and the text you paste is not saved. A free account adds their likely reply, a second version and a tip.</p>

<h2>Read next</h2>
<ul class="tl-others">
<li><a href="/blog/how-to-apologize-to-your-partner/">How to apologize to your partner</a></li>
<li><a href="/blog/what-to-text-after-a-fight/">What to text after a fight</a></li>
<li><a href="/blog/how-to-rebuild-trust-after-a-fight/">How to rebuild trust after a fight</a></li>
</ul>`,
    sources: ["lewicki", "kruger"],
    faq: [
      ["How do I apologize over text to my girlfriend or boyfriend?", "Keep it short, name what you did, take responsibility without \"but\", and offer something concrete, like talking tonight. Avoid long explanations in the first message."],
      ["Should I apologize over text or in person?", "For small things, a text is fine. For something that really hurt, use a text to say you are sorry and ask for a time to talk, then apologize in person."],
      ["Is the apology checker free and private?", "Yes. One check a day is free without an account, and the text you paste is not saved. A free account adds their likely reply, a second version and a tip."],
    ],
  },
  {
    slug: "passive-aggressive-text-checker", kind: "passive",
    title: "Is My Text Passive-Aggressive? Free Checker",
    desc: "Free passive-aggressive text checker. Paste a message and see if it reads as calm or as a jab, which words cause it, and get a version that says what you mean.",
    card: ["Passive-aggressive checker", "Find out if your text reads as a jab, and get a version that says what you mean."],
    h1: "Is my text passive-aggressive? Check it before you send it",
    lead: "Passive-aggressive texts usually are not planned. You are annoyed, you try to sound fine, and it leaks out anyway. Paste your message and see how it reads.",
    body: `
<h2>How to use the passive-aggressive checker</h2>
${steps(["Paste the message, or try one of the examples.", "See whether it reads as calm or as a jab, which words tip it over and what they may hear between the lines.", "Copy a version that says the real thing directly and kindly. A free account adds their likely reply, a second version and a tip."])}

<h2>Common passive-aggressive phrases, and what to say instead</h2>
${swap([
  ["Thanks for finally replying.", "Thanks for getting back to me. I was starting to worry."],
  ["No worries, I'll just do it myself.", "I'd really like some help with this. Could you take the dishes tonight?"],
  ["Per my last message...", "Just checking you saw my message about Friday?"],
  ["Must be nice.", "I'm a bit jealous, honestly. I wish I had a free weekend too."],
  ["Fine.", "I'm not okay with it, but I don't want to argue over text. Can we talk later?"],
])}
<p>The pattern is the same every time: the passive-aggressive version hides a feeling inside a polite sentence. The direct version names the feeling or the request, so the other person does not have to decode it.</p>

<h2>Why texts sound more passive-aggressive than you meant</h2>
<p>Written messages lose your tone of voice, and readers tend to fill the gap with the worst reading when they already feel tension. In experiments by Justin Kruger and Nicholas Epley, people believed others would read their tone correctly about 78% of the time. In reality, readers got it right about 56% of the time.</p>
<p>Small signals carry a lot. A Binghamton University study found that one-word replies like "Okay." were seen as less sincere when they ended with a period. That is why "Fine." can sound like a door closing.</p>

<h2>What to do if you are actually annoyed</h2>
<p>Being annoyed is fine. The problem is when it comes out sideways. Try this structure: what happened, how you feel, what you would like. For example: "When plans changed last minute, I felt a bit brushed off. Next time, can you give me a heads-up?" If the same thing keeps happening, our guide on <a href="/blog/relationship-problems-that-keep-coming-back/">relationship problems that keep coming back</a> can help you break the loop.</p>

<h2>Quick answers</h2>
<h3>What makes a text passive-aggressive?</h3>
<p>A text is passive-aggressive when it hides annoyance or criticism inside a polite or neutral sentence, for example "Thanks for finally replying" or "No worries, I'll do it myself". The other person feels the jab but can't easily respond to it.</p>
<h3>Is "K" or "Fine." passive-aggressive?</h3>
<p>Often it is read that way, especially in a tense moment, even if you did not mean it. A few more words, or an exclamation mark, usually fixes it.</p>
<h3>Is the checker free?</h3>
<p>Yes. One check a day is free without an account, and the text you paste is not saved. A free account adds their likely reply, a second version and a tip.</p>

<h2>Read next</h2>
<ul class="tl-others">
<li><a href="/blog/relationship-advice-communication-habits/">Communication habits that help a relationship</a></li>
<li><a href="/blog/silent-treatment-vs-needing-space/">Silent treatment vs needing space</a></li>
<li><a href="/blog/what-to-text-after-a-fight/">What to text after a fight</a></li>
</ul>`,
    sources: ["kruger", "klin"],
    faq: [
      ["What makes a text passive-aggressive?", "A text is passive-aggressive when it hides annoyance or criticism inside a polite or neutral sentence, for example \"Thanks for finally replying\". The other person feels the jab but can't easily respond to it."],
      ["Is \"K\" or \"Fine.\" passive-aggressive?", "Often it is read that way, especially in a tense moment, even if you did not mean it. A few more words, or an exclamation mark, usually fixes it."],
      ["Is the checker free?", "Yes. One check a day is free without an account, and the text you paste is not saved. A free account adds their likely reply, a second version and a tip."],
    ],
  },
];

const AD = {
  tone: ["Get it tailored to them", "The app remembers who you are writing to and how they react, with more checks and three rewrites."],
  apology: ["Rehearse the apology first", "Say it out loud to an AI that plays your partner, and see how they might respond. Completely private."],
  passive: ["Say the hard thing calmly", "Talk it through with a coach that remembers your story, then find the words that won't start a fight."],
};
const adCard = (kind, extra = "") => `<div class="ad-card ${extra}">
          <div class="ad-body">
            <span class="ad-ic" aria-hidden="true"></span>
            <h3>${AD[kind][0]}</h3>
            <p>${AD[kind][1]}</p>
            <a href="${REG}?src=tool-${kind}" class="btn btn-gradient" data-umami-event="cta-tool-${kind}-${extra ? "mobile-bar" : "sidebar"}">Get started free</a>
            <small>Free to start · No card needed</small>
          </div>
        </div>`;

const others = (slug) => [
  ...TOOLS.filter((t) => t.slug !== slug).map((t) => [`/tools/${t.slug}/`, t.card[0]]),
  ["/quiz/", "Free relationship quizzes"],
];

for (const t of TOOLS) {
  const url = `${SITE}/tools/${t.slug}/`;
  const toc = [...t.body.matchAll(/<h2>([^<]+)<\/h2>/g)].map((m) => m[1]);
  const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  let body = t.body.replace(/<h2>([^<]+)<\/h2>/g, (m, h) => `<h2 id="${slugify(h)}">${h}</h2>`);
  body += `\n<h2 id="sources">Sources</h2>\n<ul class="sources">${t.sources.map((k) => `<li>${SRC[k]}</li>`).join("")}</ul>`;
  let html = page({
    title: t.title, description: t.desc, path: `/tools/${t.slug}/`, cls: "sp-blog tl-page",
    jsonld: { "@context": "https://schema.org", "@graph": [
      { "@type": "WebApplication", name: t.card[0], url, applicationCategory: "LifestyleApplication", operatingSystem: "Any", description: t.desc, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, publisher: { "@type": "Organization", name: "RelationshipAI", url: SITE } },
      { "@type": "FAQPage", mainEntity: t.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Free tools", item: `${SITE}/tools/` }, { "@type": "ListItem", position: 2, name: t.card[0], item: url }] },
    ] },
    body: `  <main>
    <article class="article">
      <div class="container article-layout">
        <div class="article-wrap article-main">
          <a href="/tools/" class="article-back">← Free tools</a>
          <div class="article-tags"><span class="post-tag">Free tool</span><span class="post-tag">No sign-up</span></div>
          <h1>${esc(t.h1)}</h1>
          <p class="tl-lead">${t.lead}</p>
          ${checker(t.kind, `tool-${t.kind}`)}
          <div class="article-body">
${body}
          </div>
        </div>
        <aside class="article-aside">
          ${adCard(t.kind)}
          <nav class="toc" aria-label="More free tools">
            <p class="toc-title">More free tools</p>
            <ol>${others(t.slug).map(([u, n]) => `<li><a href="${u}">${esc(n)}</a></li>`).join("")}</ol>
          </nav>
        </aside>
      </div>
    </article>
  </main>`,
  });
  // mobile: the same card pinned to the bottom of the screen; it must sit outside <main class="sp-main">
  const i = html.lastIndexOf("</main>");
  html = html.slice(0, i + 7) + "\n  " + adCard(t.kind, "ad-mobile") + html.slice(i + 7);
  write(`tools/${t.slug}/index.html`, html);
}

// hub
const cards = [
  ...TOOLS.map((t) => [`/tools/${t.slug}/`, "Free tool", t.card[0], t.card[1]]),
  ["/quiz/", "Free quizzes", "Relationship quizzes", "Attachment style, love language, fight style and more. Two minutes each."],
  ["/message-check/", "In the app", "Message check", "The full version: tailored to the person, with more checks and rewrites."],
];
write("tools/index.html", page({
  title: "Free Relationship Tools: Text Checkers and Quizzes | RelationshipAI",
  description: "Free tools for the hard moments in a relationship: check how a text sounds, fix an apology, spot a passive-aggressive message, and take a quiz. No sign-up.",
  path: "/tools/", cls: "sp-blog tl-page tl-hub",
  body: `  <main>
    <article class="article">
      <div class="container">
        <div class="article-wrap">
          <h1>Free relationship tools</h1>
          <p class="tl-lead">Quick help for the moments that matter: check a text before you send it, fix an apology, or learn something about how you love. Free, no sign-up, nothing you paste is saved.</p>
          <div class="tl-grid">${cards.map(([u, k, n, d]) => `<a class="tl-card" href="${u}"><i>${k}</i><b>${esc(n)}</b><span>${esc(d)}</span></a>`).join("")}</div>
        </div>
      </div>
    </article>
  </main>`,
}));
console.log(`tools: ${TOOLS.length + 1} pages written`);
export const TOOL_PATHS = ["tools/", ...TOOLS.map((t) => `tools/${t.slug}/`)];
