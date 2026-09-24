// Public, no-account page a partner opens from a comparison link. Shows the
// short quiz first (their own answers are never sent anywhere until they
// finish), then reveals both styles and how they tend to interact — but
// only once they've answered, since this is meant to be a two-way exchange,
// not a one-sided peek at someone else's result.

// Same four questions and scoring logic as js/quiz.js (duplicated rather
// than shared, since this page has no account/auth context of its own —
// see MAX_FILES_PER_MESSAGE_BY_PLAN in chat.js for the same pattern
// elsewhere in this codebase). Keep the two in sync if either changes.
const COMPARE_QUESTIONS = [
  {
    q: "When your partner is quiet or distant for a day, you usually…",
    options: [
      { text: "Trust it's probably nothing and check in later if it continues.", style: "secure" },
      { text: "Start replaying recent conversations, wondering what you did wrong.", style: "anxious" },
      { text: "Don't think much of it — everyone needs space sometimes.", style: "avoidant" },
      { text: "Feel both worried and irritated, and aren't sure whether to reach out or pull back too.", style: "disorganized" },
    ],
  },
  {
    q: "During an argument, your instinct is to…",
    options: [
      { text: "Stay present and work toward a resolution, even if it's uncomfortable.", style: "secure" },
      { text: "Push to resolve things right away — silence or distance feels unbearable.", style: "anxious" },
      { text: "Want to end the conversation and think it through alone first.", style: "avoidant" },
      { text: "Feel flooded and unsure whether to fight for the relationship or protect yourself from it.", style: "disorganized" },
    ],
  },
  {
    q: "How do you feel about depending on a partner?",
    options: [
      { text: "Comfortable — it's normal to need each other sometimes.", style: "secure" },
      { text: "I want to depend on them more than I feel I'm allowed to.", style: "anxious" },
      { text: "I'd rather handle things myself; relying on someone else feels risky.", style: "avoidant" },
      { text: "Part of me wants to depend on them, part of me doesn't trust it.", style: "disorganized" },
    ],
  },
  {
    q: "When things are going really well in a relationship, you…",
    options: [
      { text: "Enjoy it and trust it can last.", style: "secure" },
      { text: "Start bracing for it to change or end.", style: "anxious" },
      { text: "Feel a bit boxed in, or start noticing what's missing.", style: "avoidant" },
      { text: "Feel happy but also suspicious, like it's too good to be true.", style: "disorganized" },
    ],
  },
  {
    q: "A partner asks for more emotional closeness than you're currently giving. You…",
    options: [
      { text: "Ask what they need and try to meet them partway.", style: "secure" },
      { text: "Feel relieved — you've probably been wanting the same thing.", style: "anxious" },
      { text: "Feel pressured, like something is being demanded of you.", style: "avoidant" },
      { text: "Want to give it, but also feel an urge to withdraw.", style: "disorganized" },
    ],
  },
  {
    q: "What role does trust play for you?",
    options: [
      { text: "It's earned, and once it's there, I don't need constant proof of it.", style: "secure" },
      { text: "I trust them but still need reassurance to actually feel it.", style: "anxious" },
      { text: "I don't examine it much — I just handle things myself either way.", style: "avoidant" },
      { text: "I want to trust fully, but part of me is always braced for it to break.", style: "disorganized" },
    ],
  },
  {
    q: "After a breakup or a big conflict, you tend to…",
    options: [
      { text: "Feel the pain but know you'll be okay, with time.", style: "secure" },
      { text: "Struggle to stop thinking about it, and fear being truly alone.", style: "anxious" },
      { text: "Move on quickly — sometimes surprising others with how unaffected you seem.", style: "avoidant" },
      { text: "Feel a confusing mix of relief and grief that's hard to untangle.", style: "disorganized" },
    ],
  },
  {
    q: "How do you usually show love?",
    options: [
      { text: "Directly — words, time, small consistent gestures.", style: "secure" },
      { text: "Intensely — I give a lot and hope it's reciprocated the same way.", style: "anxious" },
      { text: "Through actions more than words — I'm not big on grand emotional displays.", style: "avoidant" },
      { text: "It depends on the day — sometimes I lean in hard, sometimes I pull back without meaning to.", style: "disorganized" },
    ],
  },
];

let compareToken = null;
let compareIndex = 0;
const compareTally = { secure: 0, anxious: 0, avoidant: 0, disorganized: 0 };

document.addEventListener("DOMContentLoaded", loadCompareView);

async function loadCompareView() {
  const stateEl = document.getElementById("compare-state");
  const params = new URLSearchParams(window.location.search);
  compareToken = params.get("token");

  if (!compareToken) {
    stateEl.innerHTML = '<div class="tool-header"><h1>Nothing to show</h1><p class="text-muted">This link is missing its code.</p></div>';
    return;
  }

  try {
    const res = await fetch(`/api/public/compare/${encodeURIComponent(compareToken)}`);
    const data = await safeJson(res);
    if (!res.ok) {
      stateEl.innerHTML = `<div class="tool-header"><h1>Link not available</h1><p class="text-muted">${escapeHtml(data.error || "This link isn't available.")}</p></div>`;
      return;
    }
    if (data.answered) {
      renderCompareResult(data);
    } else {
      renderIntro();
    }
  } catch (e) {
    stateEl.innerHTML = '<div class="tool-header"><h1>Something went wrong</h1><p class="text-muted">Couldn\'t load this right now. Please try again.</p></div>';
  }
}

function renderIntro() {
  const stateEl = document.getElementById("compare-state");
  stateEl.innerHTML = `
    <div class="tool-header">
      <span class="section-tag">Someone shared this with you</span>
      <h1>Compare attachment styles</h1>
      <p class="text-muted">Someone using RelateIQ took a short quiz about how they connect in relationships, and wants to compare results with you. Answer the same 8 questions honestly — you'll both see the result once you're done. No account needed.</p>
    </div>
    <div class="quiz-question" style="text-align:center;">
      <button class="btn btn-gradient" id="start-compare-btn" type="button">Start the quiz</button>
    </div>
  `;
  document.getElementById("start-compare-btn").addEventListener("click", () => {
    document.getElementById("compare-progress").style.display = "block";
    renderCompareQuestion();
  });
}

function renderCompareQuestion() {
  const progressBar = document.getElementById("compare-progress-bar");
  progressBar.style.width = `${Math.round((compareIndex / COMPARE_QUESTIONS.length) * 100)}%`;

  const question = COMPARE_QUESTIONS[compareIndex];
  const stateEl = document.getElementById("compare-state");
  stateEl.innerHTML = `
    <div class="quiz-question">
      <h3>${escapeHtml(question.q)}</h3>
      <div class="quiz-options" id="compare-options"></div>
    </div>
  `;

  const optionsDiv = document.getElementById("compare-options");
  question.options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "quiz-option";
    btn.textContent = opt.text;
    btn.addEventListener("click", () => answerCompare(opt.style));
    optionsDiv.appendChild(btn);
  });
}

function answerCompare(style) {
  compareTally[style] += 1;
  compareIndex += 1;

  if (compareIndex >= COMPARE_QUESTIONS.length) {
    submitCompareAnswer();
  } else {
    renderCompareQuestion();
  }
}

async function submitCompareAnswer() {
  document.getElementById("compare-progress-bar").style.width = "100%";

  let topStyle = "secure";
  let topCount = -1;
  Object.entries(compareTally).forEach(([style, count]) => {
    if (count > topCount) {
      topStyle = style;
      topCount = count;
    }
  });

  const stateEl = document.getElementById("compare-state");
  stateEl.innerHTML = '<div class="quiz-question"><p class="text-muted" style="margin:0;">Comparing your results…</p></div>';

  try {
    const res = await fetch(`/api/public/compare/${encodeURIComponent(compareToken)}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ style: topStyle }),
    });
    const data = await safeJson(res);
    if (!res.ok) {
      stateEl.innerHTML = `<div class="tool-header"><h1>Something went wrong</h1><p class="text-muted">${escapeHtml(data.error || "Couldn't save your answer. Please try again.")}</p></div>`;
      return;
    }
    renderCompareResult(data);
  } catch (e) {
    stateEl.innerHTML = '<div class="tool-header"><h1>Something went wrong</h1><p class="text-muted">Couldn\'t save your answer. Please try again.</p></div>';
  }
}

function renderCompareResult(data) {
  document.getElementById("compare-progress").style.display = "none";
  const stateEl = document.getElementById("compare-state");
  stateEl.innerHTML = `
    <div class="quiz-question">
      <div class="quiz-result">
        <span class="section-tag">Your combined result</span>
        <div class="compat-pair">
          <span class="compat-style-name">${escapeHtml(data.ownerStyle.name)}</span>
          <span class="compat-plus">+</span>
          <span class="compat-style-name">${escapeHtml(data.partnerStyle.name)}</span>
        </div>
        <p class="quiz-result-desc">${escapeHtml(data.compatText)}</p>
        <p class="quiz-result-desc" style="font-size:13px; color:var(--text-faint);">This is a lightweight self-reflection tool, not a clinical assessment — a starting point for a conversation, not a verdict on your relationship.</p>
        <div class="hero-cta">
          <a href="register.html" class="btn btn-gradient">Try RelateIQ free</a>
        </div>
      </div>
    </div>
  `;
}
