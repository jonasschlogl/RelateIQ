const QUESTIONS = [
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

let currentIndex = 0;
const tally = { secure: 0, anxious: 0, avoidant: 0, disorganized: 0 };

document.addEventListener("DOMContentLoaded", () => {
  requireAuth();
  document.getElementById("logout-btn")?.addEventListener("click", logout);
  renderQuestion();
});

function renderQuestion() {
  const progressBar = document.getElementById("progress-bar");
  progressBar.style.width = `${Math.round((currentIndex / QUESTIONS.length) * 100)}%`;

  const question = QUESTIONS[currentIndex];
  const body = document.getElementById("quiz-body");
  body.innerHTML = `
    <div class="quiz-question">
      <h3>${escapeHtml(question.q)}</h3>
      <div class="quiz-options" id="quiz-options"></div>
    </div>
  `;

  const optionsDiv = document.getElementById("quiz-options");
  question.options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "quiz-option";
    btn.textContent = opt.text;
    btn.addEventListener("click", () => answer(opt.style));
    optionsDiv.appendChild(btn);
  });
}

function answer(style) {
  tally[style] += 1;
  currentIndex += 1;

  if (currentIndex >= QUESTIONS.length) {
    finish();
  } else {
    renderQuestion();
  }
}

async function finish() {
  document.getElementById("progress-bar").style.width = "100%";

  let topStyle = "secure";
  let topCount = -1;
  Object.entries(tally).forEach(([style, count]) => {
    if (count > topCount) {
      topStyle = style;
      topCount = count;
    }
  });

  const body = document.getElementById("quiz-body");
  body.innerHTML = '<div class="quiz-question"><p class="text-muted" style="margin:0;">Saving your result…</p></div>';

  try {
    const res = await authFetch("/api/quiz/attachment", {
      method: "POST",
      body: JSON.stringify({ style: topStyle }),
    });
    const data = await safeJson(res);

    if (!res.ok) {
      body.innerHTML = `<div class="quiz-question"><p class="text-muted" style="margin:0;">${escapeHtml(data.error || "Couldn't save your result, but here it is anyway.")}</p></div>`;
    }

    renderResult(data.name || topStyle, data.desc || "");
  } catch (err) {
    renderResult(topStyle, "");
  }
}

function renderResult(name, desc) {
  const body = document.getElementById("quiz-body");
  body.innerHTML = `
    <div class="quiz-question">
      <div class="quiz-result">
        <span class="section-tag">Your result</span>
        <div class="style-name">${escapeHtml(name)}</div>
        <p class="quiz-result-desc">${escapeHtml(desc)}</p>
        <p class="quiz-result-desc" style="font-size:13px; color:var(--text-faint);">This is a lightweight self-reflection tool, not a clinical assessment. Attachment styles can also shift over time and vary by relationship.</p>

        <div class="quiz-compare-box">
          <h3 style="font-size:16px; margin-bottom:6px;">See how your styles interact</h3>
          <p class="text-muted" style="font-size:13.5px; margin-bottom:14px;">Send your partner a link — they take a short version of this quiz (no account needed), and once they answer, you'll both see how your two styles tend to interact.</p>
          <button class="btn btn-gradient btn-sm" id="make-compare-btn" type="button">Get a link for my partner</button>
          <div id="compare-link-area"></div>
        </div>

        <div class="hero-cta">
          <a href="dashboard.html" class="btn btn-gradient">Go to my account</a>
          <button class="btn btn-ghost" id="retake-btn" type="button">Retake quiz</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById("retake-btn").addEventListener("click", () => {
    currentIndex = 0;
    tally.secure = 0;
    tally.anxious = 0;
    tally.avoidant = 0;
    tally.disorganized = 0;
    renderQuestion();
  });
  document.getElementById("make-compare-btn").addEventListener("click", createCompareLink);
}

async function createCompareLink() {
  const btn = document.getElementById("make-compare-btn");
  const area = document.getElementById("compare-link-area");
  btn.disabled = true;
  btn.textContent = "Creating link…";
  try {
    const res = await authFetch("/api/compare", { method: "POST" });
    const data = await safeJson(res);
    if (!res.ok) {
      area.innerHTML = `<p class="form-error" style="display:block; margin-top:12px;">${escapeHtml(data.error || "Couldn't create that link. Please try again.")}</p>`;
      btn.disabled = false;
      btn.textContent = "Get a link for my partner";
      return;
    }
    const link = `${window.location.origin}/compare-view.html?token=${encodeURIComponent(data.token)}`;
    btn.style.display = "none";
    area.innerHTML = `
      <div class="share-link-box" style="margin-top:14px; margin-bottom:0;">
        <span id="compare-link-text">${escapeHtml(link)}</span>
        <button class="btn btn-gradient btn-sm" id="copy-compare-link-btn" type="button">Copy link</button>
      </div>
      <p class="text-muted" style="font-size:12.5px; margin-top:10px; margin-bottom:0;">Save this link somewhere — once your partner answers, you can reopen it yourself anytime to see the result.</p>
    `;
    document.getElementById("copy-compare-link-btn").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(link);
        const copyBtn = document.getElementById("copy-compare-link-btn");
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = "Copy link"; }, 1800);
      } catch (e) {
        // Clipboard API can be unavailable (e.g. non-HTTPS) — the link text is
        // still selectable/visible, so this is a soft failure, not a dead end.
      }
    });
  } catch (err) {
    area.innerHTML = `<p class="form-error" style="display:block; margin-top:12px;">Couldn't create that link. Please try again.</p>`;
    btn.disabled = false;
    btn.textContent = "Get a link for my partner";
  }
}
