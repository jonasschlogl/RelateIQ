// Free relationship quizzes: /quiz/ (hub) and /quiz/<slug>/ (one interactive quiz each).
// Imported at the end of build-pages.mjs. Quiz logic lives in /js/quiz.js, styles in /css/quiz.css.
// The first 3 questions of every quiz match the Instagram/TikTok quiz reels, so people recognise them.
import fs from "node:fs";
import path from "node:path";
import { page, LANDING, esc } from "./shell.mjs";

const write = (rel, html) => { const f = path.join(LANDING, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); };
const HEAD = `  <link rel="stylesheet" href="/css/quiz.css?v=3" />`;
const REG = "https://app.relationshipaiadvice.com/register.html";

export const QUIZZES = [
  {
    slug: "attachment-style",
    tint: "#f4b8c4",
    kicker: "Attachment style quiz",
    h: "What's your <em>attachment style?</em>",
    sub: "Seven quick questions about how you act when love feels close, or uncertain. Answer with your first instinct, not the answer you wish was true.",
    title: "Attachment style quiz: what's your attachment style? | RelationshipAI",
    desc: "Free 2-minute attachment style quiz. Find out if you lean secure, anxious, avoidant or fearful-avoidant, what it means for your relationship and what to try this week.",
    card: "Secure, anxious, avoidant or a mix of both? Find the pattern behind how you love.",
    note: "This quiz is for self-reflection. It is not a clinical assessment or a diagnosis.",
    qs: [
      ["They take 5 hours to text back. You…", ["Assume they're just busy", "Reread your last message 10 times", "Feel fine, you like your space", "Start pulling away first"]],
      ["After a fight, what do you need most?", ["To talk it through calmly", "Reassurance, right now", "Time alone before anything", "To act like you don't care"]],
      ["Things are getting serious. You feel…", ["Safe and excited", "Scared it won't last", "The urge to step back", "Like you want it and fear it"]],
      ["Your partner has a night out without you. You…", ["Tell them to have fun", "Check your phone all evening", "Enjoy the quiet time alone", "Say it's fine, then feel hurt"]],
      ["When something upsets you, you usually…", ["Say what's wrong", "Need them to notice and fix it fast", "Keep it to yourself", "Push them away, then want them back"]],
      ["They say \"I love you\" first. You…", ["Say it back when you mean it", "Finally relax, now you know", "Feel a little trapped", "Feel happy, then start doubting it"]],
      ["Your biggest fear in love is…", ["Not much, you trust it can work", "Being left", "Losing your freedom", "Getting hurt the way you were before"]],
    ],
    results: [
      { name: "Secure", line: "You can be close without losing yourself.",
        text: "You trust that love can be steady. You say what you need, you give space without panicking, and a fight does not feel like the end of the world. Secure does not mean perfect. It means you can repair.",
        good: ["You say what you feel without games", "You can give space without feeling rejected", "You make repair after a fight feel safe"],
        watch: ["You may not notice when your partner feels insecure", "Patience can turn into carrying the relationship alone"],
        tip: "Ask your partner one question tonight: \"What helps you feel safe with me when we argue?\" Their answer tells you their style." },
      { name: "Anxious", line: "You love deeply and you notice everything.",
        text: "When love feels uncertain, your mind fills the silence with worst-case stories. A late reply can feel like a warning sign. That is not neediness. It is a nervous system that learned closeness can disappear.",
        good: ["You are warm, loyal and very attuned", "You notice small changes before anyone else", "You put real effort into the relationship"],
        watch: ["Overthinking a slow reply and over-texting", "Seeking reassurance instead of asking for what you need"],
        tip: "Next time you feel the spiral, wait 20 minutes, then send one calm sentence: \"I missed you today, can we talk tonight?\" instead of five worried ones." },
      { name: "Avoidant", line: "You value your freedom and you protect it.",
        text: "Closeness can start to feel like pressure, so you pull back to feel like yourself again. You are not cold. You learned early that relying on people was risky, so you rely on yourself.",
        good: ["You are calm and steady in a crisis", "You respect your partner's independence", "You don't create drama"],
        watch: ["Going quiet when things get emotional", "Partners reading your need for space as rejection"],
        tip: "When you need space, say it out loud with a time: \"I need an hour to think, then I want to talk.\" Space with a return time feels safe to a partner." },
      { name: "Fearful-avoidant", line: "You want closeness and you fear it at the same time.",
        text: "Part of you reaches for love and part of you braces for getting hurt. It can feel like push and pull, even to you. Often this comes from love that once felt both safe and painful.",
        good: ["You feel deeply and understand pain", "You are very self-aware once you feel safe", "You fight hard for what matters"],
        watch: ["Pulling away right after a close moment", "Testing your partner instead of telling them what you need"],
        tip: "Notice the moment you want to pull back. Name it instead of acting on it: \"I'm feeling scared right now, not angry. Give me a minute.\"" },
    ],
    article: ["/blog/how-attachment-styles-work-in-relationships/", "How attachment styles work in relationships"],
    tool: ["/coach-chat/", "Talk it through with Coach Chat", "Coach Chat remembers your story and helps you handle the moments your attachment style makes hard."],
  },
  {
    slug: "love-language",
    tint: "#f7d99a",
    kicker: "Love language quiz",
    h: "How do you really need <em>to be loved?</em>",
    sub: "Pick fast and don't overthink. Seven questions show which of the five love languages feels most like love to you.",
    title: "Love language quiz: how do you need to be loved? | RelationshipAI",
    desc: "Free 2-minute love language quiz. Find out if you need words, touch, acts of service, gifts or quality time, and how to tell your partner without sounding demanding.",
    card: "Words, touch, help, gifts or time? Find out what actually makes you feel loved.",
    note: "Love languages are a simple way to talk about what you need. Most people have a mix.",
    qs: [
      ["Worst day ever. What fixes it?", ["Hearing \"I'm proud of you\"", "A long, quiet hug", "They handle dinner and dishes", "A small surprise on the way home", "Their full attention, phone away"]],
      ["The moment you felt most loved was…", ["Something they said", "Falling asleep on their chest", "When they took care of everything", "A tiny gift that meant a lot", "A whole day, just the two of you"]],
      ["What hurts you the most?", ["Harsh words in a fight", "No affection for days", "Promises they don't keep", "Forgetting a special day", "Them scrolling while you talk"]],
      ["They're away for a week. What helps most?", ["Sweet texts every day", "Counting down to the first hug", "They sorted things at home before leaving", "A note or gift they left behind", "A nightly call with full attention"]],
      ["Your perfect birthday includes…", ["A heartfelt card you'll keep", "Lots of cuddles", "Them planning everything for you", "A gift that shows they listened", "A whole day together, no phones"]],
      ["After a fight, what makes it right?", ["A real, spoken apology", "Being held", "Them fixing what went wrong", "A small peace offering", "Sitting down and really talking"]],
      ["You show love most by…", ["Telling them what you love about them", "Hugs, kisses, a hand on their back", "Doing things that make their life easier", "Bringing home things that remind you of them", "Making time, even when you're busy"]],
    ],
    results: [
      { name: "Words of affirmation", line: "You feel loved when love is said out loud.",
        text: "Compliments, \"I'm proud of you\" and sweet texts land deep with you. Silence or harsh words in a fight hit just as deep. You don't need speeches, you need to hear it.",
        good: ["You remember the kind things people say", "You are good at encouraging your partner"],
        watch: ["Criticism can feel like rejection", "You may wait for words your partner shows in other ways"],
        tip: "Tell your partner: \"It means a lot when you tell me what you like about us. Even one line a day.\" Specific asks are easier to give." },
      { name: "Physical touch", line: "You feel loved when you feel close.",
        text: "A hug, a hand on your back, falling asleep next to each other. Touch is how you feel safe and connected. Days without affection can make you feel far apart, even when nothing is wrong.",
        good: ["You make your partner feel warm and wanted", "You calm down faster when someone holds you"],
        watch: ["Distance after a fight hurts you more than the fight", "Your partner may not know touch matters this much"],
        tip: "Ask for one daily ritual: a long hug when you see each other after work. Twenty seconds is enough to feel it." },
      { name: "Acts of service", line: "You feel loved when someone makes life lighter.",
        text: "Dinner handled, the car fixed, the thing you hate doing already done. For you, love is a verb. Broken promises and \"I'll do it later\" feel like you don't matter.",
        good: ["You notice and appreciate effort", "You show love in practical, reliable ways"],
        watch: ["Doing everything yourself and quietly resenting it", "Reading a forgotten task as not caring"],
        tip: "Instead of hinting, pick one thing: \"It would mean a lot if you handled dinner on Thursdays.\" Clear beats hoping." },
      { name: "Receiving gifts", line: "You feel loved when someone was thinking of you.",
        text: "It's never about the price. A note, a snack you love, something they saw and thought of you. The gift is proof you were on their mind. Forgotten special days can sting.",
        good: ["You give thoughtful, personal gifts", "You treasure small things for years"],
        watch: ["A forgotten date can feel bigger than it is", "Partners may think you want expensive things"],
        tip: "Tell your partner it's the thought: \"The small things you bring me mean more than any big present.\" It takes the pressure off." },
      { name: "Quality time", line: "You feel loved when you have their full attention.",
        text: "Phones away, a long walk, a real conversation. Time together is how you feel connected. A partner scrolling while you talk can feel like being alone in the same room.",
        good: ["You are fully present with people you love", "You create the best memories in the relationship"],
        watch: ["Busy weeks can make you feel unloved", "Distracted moments feel personal"],
        tip: "Suggest one phone-free hour each week, same day, same time. Protected time beats random good intentions." },
    ],
    article: ["/blog/love-languages/", "The 5 love languages, explained"],
    tool: ["/message-check/", "Ask for what you need with Message check", "Write how you want to ask for more of your love language, and see how it will land before you send it."],
  },
  {
    slug: "fight-style",
    tint: "#f8c7a3",
    kicker: "Conflict style quiz",
    h: "What kind of partner are you <em>in a fight?</em>",
    sub: "Be honest, nobody's watching. Seven questions show your conflict style, what it does to your relationship and what to say next time.",
    title: "Conflict style quiz: what kind of partner are you in a fight? | RelationshipAI",
    desc: "Free 2-minute conflict style quiz for couples. Find out if you escalate, shut down, people-please or repair, and get one thing to say in your next argument.",
    card: "Do you get louder, go quiet, give in or repair? See your fight style and what to say next time.",
    note: "Inspired by research on how couples argue, including the Gottman Method. For self-reflection, not a diagnosis.",
    qs: [
      ["In the middle of an argument, you usually…", ["Get louder so they hear you", "Go quiet and shut down", "Apologize just to end it", "Stay calm and look for a fix"]],
      ["They say \"you always do this.\" You…", ["List what THEY always do", "Leave the room", "Say sorry right away", "Ask what they really mean"]],
      ["Two hours after the fight, you're…", ["Still replaying who was right", "Waiting for them to come first", "Overthinking if they're still mad", "Ready to talk it out"]],
      ["The same old topic comes up again. You…", ["Bring up every past time too", "Change the subject", "Agree with whatever they say", "Suggest a new way to talk about it"]],
      ["During a fight, your body feels…", ["Heart racing, ready to argue", "Numb, like you checked out", "Tight stomach, you just want it over", "Tense, but you can still listen"]],
      ["Who usually makes up first?", ["You, once you've said your piece", "Them, you wait it out", "You, even when you weren't wrong", "Whoever is ready first"]],
      ["Your partner starts crying in a fight. You…", ["Feel it's unfair, you're upset too", "Freeze and don't know what to do", "Drop everything and apologize", "Slow down and ask what they need"]],
    ],
    results: [
      { name: "The Fire Starter", line: "You fight to be heard.",
        text: "When it matters, you push. Your voice gets louder because you are scared the problem won't get solved. The trouble is that criticism and blame make the other person defend, not listen.",
        good: ["You don't let problems hide", "You care enough to fight for the relationship"],
        watch: ["\"You always\" and \"you never\" start a second fight", "Winning the argument while losing the connection"],
        tip: "Start with \"I feel ___ about ___, and I need ___\" instead of \"You always ___\". Same message, half the defence." },
      { name: "The Wall", line: "You go quiet to keep things from getting worse.",
        text: "When a fight heats up, your body floods and you shut down. To your partner it can look like you don't care, when really you are overwhelmed. Researchers call this stonewalling.",
        good: ["You rarely say things you regret", "You stay calm on the outside"],
        watch: ["Silence feels like punishment to your partner", "Problems come back because they never got solved"],
        tip: "Instead of walking away, say: \"I'm overwhelmed. I need 20 minutes, then I'll come back.\" Then come back." },
      { name: "The Peacekeeper", line: "You end fights fast, even when it costs you.",
        text: "You apologize first, agree quickly and let it go, because conflict feels unsafe. Peace returns, but your own needs never get said, and resentment quietly builds.",
        good: ["You calm things down quickly", "You are kind even when you're hurt"],
        watch: ["Saying sorry for things that weren't your fault", "Your partner never learns what you need"],
        tip: "Next time, before you apologize, add one honest sentence: \"I want to fix this, and I also felt ___ when ___.\"" },
      { name: "The Repairer", line: "You fight to fix it, not to win.",
        text: "You can stay in a hard conversation, listen and look for a way back to each other. Couples who repair well are the ones who last. Your job is to stay patient when your partner can't do it yet.",
        good: ["You make repair attempts that land", "You can listen while upset"],
        watch: ["Pushing to solve it before your partner is ready", "Carrying all the repair work yourself"],
        tip: "Ask: \"Do you want to solve this now, or do you need a bit of time first?\" Matching their pace is part of repair." },
    ],
    article: ["/blog/how-to-rebuild-trust-after-a-fight/", "How to rebuild trust after a fight"],
    tool: ["/partner-practice/", "Rehearse your next hard talk", "Partner Practice plays your partner so you can try a calmer way to say it before the real conversation."],
  },
];

const heart = `<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.4C.9 8 2.8 4.5 6.2 4.5c2.1 0 3.7 1.2 4.6 2.7.4.6 1.4.6 1.8 0 .9-1.5 2.5-2.7 4.6-2.7 3.4 0 5.3 3.5 3.8 7.1C19.5 16.4 12 21 12 21z"/></svg>`;
const floats = `<div class="fl" aria-hidden="true">${[1, 2, 3, 4, 5, 6, 7].map((i) => `<span class="f${i}">${heart}</span>`).join("")}</div>`;
const arrow = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;

// hub
const cards = QUIZZES.map((q) => `<a class="qz-card" href="/quiz/${q.slug}/" style="--tint:${q.tint}" data-umami-event="quiz-hub-${q.slug}">
  <span class="qz-card-top"><span class="qz-pill">${esc(q.kicker)}</span><span class="qz-meta">7 questions · 2 min</span></span>
  <h3>${q.h}</h3>
  <p>${esc(q.card)}</p>
  <span class="qz-go">Take the quiz ${arrow}</span>
</a>`).join("\n");

write("quiz/index.html", page({
  title: "Free relationship quizzes | RelationshipAI",
  description: "Free 2-minute relationship quizzes: attachment style, love language and conflict style. Get your result and one thing to try with your partner this week.",
  path: "/quiz/", cls: "sp-feature qz-page", head: HEAD,
  body: `<div class="sp-panel"><article class="fm-panel pg qz-hub" style="--tint:#f4b8c4"><div class="pg-hero">${floats}<span class="fm-kick"><b>Free quizzes</b><span>2 minutes each</span></span><h2>Get to know <em>how you love.</em></h2><p class="fm-sub">Short psychology quizzes about you and your relationship. Answer honestly, get your result and one thing to try with your partner this week.</p></div>
<div class="fm-body"><section class="pg-sec"><div class="qz-grid">
${cards}
</div><p class="qz-foot-note">More quizzes every week. Seen one in our videos? Your full result is here.</p></section></div></article></div>`,
}));

// each quiz
for (const q of QUIZZES) {
  const data = { slug: q.slug, kicker: q.kicker, tint: q.tint, qs: q.qs, results: q.results, article: q.article, tool: q.tool, reg: REG };
  const others = QUIZZES.filter((o) => o.slug !== q.slug).map((o) => `<a href="/quiz/${o.slug}/" data-umami-event="quiz-next-${o.slug}">${esc(o.kicker)} ${arrow}</a>`).join("");
  write(`quiz/${q.slug}/index.html`, page({
    title: q.title, description: q.desc, path: `/quiz/${q.slug}/`, cls: "sp-feature qz-page", head: HEAD,
    jsonld: { "@context": "https://schema.org", "@type": "Quiz", name: q.kicker, about: q.desc, educationalUse: "self-reflection", url: `https://relationshipaiadvice.com/quiz/${q.slug}/` },
    body: `<div class="sp-panel"><article class="fm-panel pg qz-one" style="--tint:${q.tint}"><div class="pg-hero">${floats}<nav class="bl-crumb" aria-label="Breadcrumb"><a href="/quiz/">Quizzes</a><i>/</i><b>${esc(q.kicker)}</b></nav><span class="fm-kick"><b>${esc(q.kicker)}</b><span>2 min</span></span><h2>${q.h}</h2><p class="fm-sub">${esc(q.sub)}</p></div>
<div class="fm-body"><section class="pg-sec qz-sec">
  <div class="qz-box" id="quiz" data-quiz="${q.slug}" aria-live="polite">
    <noscript><p>Please turn on JavaScript to take the quiz.</p></noscript>
  </div>
  <p class="qz-note">${esc(q.note)}</p>
  <div class="qz-more"><span>More quizzes</span>${others}<a href="/quiz/">All quizzes ${arrow}</a></div>
</section></div></article></div>
<script type="application/json" id="quiz-data">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>
<script defer src="/js/quiz.js?v=2"></script>`,
  }));
}
// ---------- /links/: the page behind the link in bio ----------
// FEATURED = the quiz from the newest video. Change it when a new quiz video goes out.
const FEATURED = "attachment-style";
function latestPost() {
  const dir = path.join(path.dirname(new URL(import.meta.url).pathname), "blog-posts");
  const posts = fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(f)).map((f) => {
    const t = fs.readFileSync(path.join(dir, f), "utf8"); const fm = (t.match(/^---\n([\s\S]*?)\n---/) || [, ""])[1];
    const get = (k) => ((fm.match(new RegExp(`^${k}:\\s*(.*)$`, "m")) || [, ""])[1] || "").trim().replace(/^"(.*)"$/, "$1").replace(/\\"/g, '"');
    return { file: f, date: get("date"), title: get("title"), draft: /^(true|yes)$/i.test(get("draft")), slug: get("slug") || f.slice(11, -3) };
  }).filter((p) => !p.draft && p.date && p.date <= new Date().toISOString().slice(0, 10)).sort((a, b) => (a.date < b.date ? 1 : -1));
  return posts[0];
}
{
  const f = QUIZZES.find((q) => q.slug === FEATURED) || QUIZZES[0];
  const rest = QUIZZES.filter((q) => q !== f);
  const post = latestPost();
  const item = (href, ev, tint, k, h, p, big = false) => `<a class="lk-item${big ? " lk-big" : ""}" href="${href}" style="--tint:${tint}" data-umami-event="${ev}"><span class="lk-k">${k}</span><span class="lk-h">${h}</span>${p ? `<span class="lk-p">${p}</span>` : ""}<span class="lk-go">${arrow}</span></a>`;
  const body = `<div class="lk-wrap">
  <div class="lk-head"><img src="/logo-tile.svg" alt="" width="64" height="64" /><h1>Relationship<b>AI</b></h1><p>Free quizzes and calm help for the hard conversations.</p></div>
  ${item(`/quiz/${f.slug}/`, `links-featured-${f.slug}`, f.tint, "The quiz from our video", f.h, "7 questions · 2 minutes · get your full result", true)}
  <p class="lk-label">More quizzes</p>
  ${rest.map((q) => item(`/quiz/${q.slug}/`, `links-quiz-${q.slug}`, q.tint, esc(q.kicker), q.h, "")).join("\n  ")}
  <p class="lk-label">Try the coach</p>
  ${item(REG, "links-try-free", "#3b2218", "Free, no card needed", "Rehearse a hard conversation <em>before it's real</em>", "An AI plays your partner so you can practise what to say.")}
  ${post ? `<p class="lk-label">New on the blog</p>\n  ${item(`/blog/${post.slug}/`, "links-latest-article", "#f9cfae", "Latest article", esc(post.title), "")}` : ""}
  <p class="lk-foot"><a href="/" data-umami-event="links-home">relationshipaiadvice.com</a> · <a href="/quiz/" data-umami-event="links-all-quizzes">All quizzes</a> · <a href="/blog/" data-umami-event="links-blog">Blog</a></p>
</div>
<script>try{var s=new URLSearchParams(location.search).get("utm_source");if(s)sessionStorage.setItem("ra_src",s)}catch(e){}</script>`;
  write("links/index.html", page({ title: "RelationshipAI: free relationship quizzes", description: "The quiz from our video, more free relationship quizzes and the AI coach for hard conversations.", path: "/links/", cls: "lk-page", head: HEAD, noindex: true, body }));
}
console.log(`quiz: ${QUIZZES.length + 2} pages written`);
