import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Stripe from "stripe";
import { readDb, writeDb, generateId } from "./lib/store.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Railway (and most hosts) put the app behind a reverse proxy, so without
// this Express sees every request as coming from that proxy's internal IP —
// which would make the per-IP demo rate limit below apply to the whole site
// at once instead of per visitor. This makes req.ip read the real client IP
// from X-Forwarded-For.
app.set("trust proxy", true);

// Stripe is optional at boot — if STRIPE_SECRET_KEY isn't set yet, the app
// still starts and every billing route replies with a clear 503 instead of
// crashing. Set STRIPE_SECRET_KEY (and the price/webhook vars below) in
// .env once you've created your Stripe account and products — see README.
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const APP_URL = (process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, "");
const PLAN_TO_STRIPE_PRICE = { pro: process.env.STRIPE_PRICE_PRO, premium: process.env.STRIPE_PRICE_PREMIUM };
const STRIPE_PRICE_TO_PLAN = {};
for (const [plan, priceId] of Object.entries(PLAN_TO_STRIPE_PRICE)) {
  if (priceId) STRIPE_PRICE_TO_PLAN[priceId] = plan;
}

app.use(cors());

// Stripe webhook needs the raw, unparsed request body to verify its
// signature, so this route is registered BEFORE the global express.json()
// parser below (which would otherwise consume the body and break
// verification). It's the one route in this file that isn't JSON-parsed.
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).end();

  let event;
  try {
    const sig = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const db = readDb();

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.client_reference_id || session.metadata?.userId;
      const user = db.users.find((u) => u.id === userId);
      if (user && session.subscription) {
        user.stripeCustomerId = session.customer;
        user.stripeSubscriptionId = session.subscription;
        user.subscriptionStatus = "active";
        if (session.metadata?.plan) user.plan = session.metadata.plan;
        writeDb(db);
      }
    } else if (event.type === "customer.subscription.updated") {
      const sub = event.data.object;
      const user = db.users.find((u) => u.stripeCustomerId === sub.customer);
      if (user) {
        const priceId = sub.items?.data?.[0]?.price?.id;
        const mappedPlan = STRIPE_PRICE_TO_PLAN[priceId];
        user.stripeSubscriptionId = sub.id;
        user.subscriptionStatus = sub.status;
        if (sub.status === "active" || sub.status === "trialing") {
          if (mappedPlan) user.plan = mappedPlan;
        } else if (["canceled", "unpaid", "incomplete_expired"].includes(sub.status)) {
          user.plan = "free";
        }
        writeDb(db);
      }
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const user = db.users.find((u) => u.stripeCustomerId === sub.customer);
      if (user) {
        user.plan = "free";
        user.subscriptionStatus = "canceled";
        user.stripeSubscriptionId = null;
        writeDb(db);
      }
    }
  } catch (err) {
    console.error("Stripe webhook handling error:", err);
  }

  res.json({ received: true });
});

// Raised from the default 100kb so chat messages can carry image/file
// attachments (sent as base64 data URLs) — see the attachment limits below.
app.use(express.json({ limit: "25mb" }));
app.use(
  express.static(path.join(__dirname, "public"), {
    etag: false,
    lastModified: false,
    setHeaders: (res) => {
      // Prevent the browser from caching HTML/CSS/JS during development —
      // otherwise it can keep serving an old version of a file after you've
      // updated it, which looks exactly like a bug that isn't there.
      res.setHeader("Cache-Control", "no-store");
    },
  })
);

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me-in-production";
const FREE_DAILY_LIMIT = 8;

// Partner profiles (Practice mode) allowed per plan — omit a plan here (e.g.
// "premium") to leave it unlimited.
const PARTNER_PROFILE_LIMITS = { free: 1, pro: 5 };

// Attachments (images, screen recordings, other files) on chat messages —
// how many a single message can carry, by plan. Omit a plan here to fall
// back to the free limit, same convention as PARTNER_PROFILE_LIMITS above.
const MAX_FILES_PER_MESSAGE_BY_PLAN = { free: 1, pro: 3, premium: 3 };
const MAX_TOTAL_UPLOAD_MB = 15;
const MAX_TOTAL_UPLOAD_BYTES = MAX_TOTAL_UPLOAD_MB * 1024 * 1024;
// Defaults to public/uploads for local dev. On a host with a persistent
// volume (so uploaded files survive a redeploy), set UPLOADS_DIR to a path
// inside that volume — the /uploads route below serves straight from here
// regardless, so the URLs the app hands out never change.
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, "public", "uploads");
app.use(
  "/uploads",
  express.static(UPLOADS_DIR, {
    etag: false,
    lastModified: false,
    setHeaders: (res) => res.setHeader("Cache-Control", "no-store"),
  })
);
const TEXT_LIKE_EXTENSIONS = [".txt", ".md", ".markdown", ".csv", ".log", ".json"];

if (!process.env.OPENAI_API_KEY) {
  console.warn("⚠️  OPENAI_API_KEY is not set in .env — chat will not work.");
}
if (!process.env.JWT_SECRET) {
  console.warn("⚠️  JWT_SECRET is not set in .env — set your own random string before deploying to production.");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------------------------------------------------------------------------
// prompts
// ---------------------------------------------------------------------------

const COACH_SYSTEM_PROMPT = `You are RelateIQ, an empathetic but direct AI relationship coach. You draw on proven approaches — the Gottman Method, attachment theory, and Nonviolent Communication (NVC).

Your style:
- Ask short follow-up questions when you don't understand the situation well enough, instead of guessing.
- Give concrete, actionable steps, not generic phrases like "communicate more."
- Be honest even when it means an uncomfortable truth — but always with respect and without moralizing.
- Never diagnose mental health conditions, and never claim to replace professional therapy.
- If the user describes signs of violence, abuse, or self-harm, respond with calm and empathy, take it seriously, and gently suggest seeking a professional or a helpline in their country.
- Always reply in the same language as the user's most recent message — detect it automatically from what they write, the same way ChatGPT does. Never ask which language to use, and never mention that you're doing this. If they switch languages mid-conversation, switch with them.
- Keep answers focused and readable — favor shorter, clear responses over long essays.`;

const MESSAGE_COACH_SYSTEM_PROMPT = `You help people rewrite a draft message before they send it to their partner, so it lands better — clearer and calmer, less likely to trigger defensiveness — while keeping their real meaning and intent intact. Ground the rewrite in Nonviolent Communication and the Gottman Method: replace criticism/contempt with "I" statements and specific requests, and soften blame without erasing the user's actual feelings.

Never diagnose, moralize, or lecture. If the draft describes abuse directed at the user, gently note that in "why" and suggest professional support instead of just rewriting it.

Always write both fields in the same language as the draft message — detect it automatically, the same way ChatGPT does, without asking or mentioning it.

Respond with ONLY a JSON object, no other text before or after it, in exactly this shape:
{"rewrite": "<the rewritten message only, ready to send — no labels, no quotes around it, no explanation mixed in>", "why": "<2-4 short plain-text sentences explaining what changed and why, no bullet points>"}`;

const THERAPIST_SUMMARY_SYSTEM_PROMPT = `You are turning a transcript of an AI relationship-coaching conversation into a short written summary the user can hand to their own licensed therapist or counselor, to catch them up quickly. Write for a professional reader: factual, neutral, and easy to skim in under a minute — not therapeutic advice, and not a diagnosis.

Structure the summary as four short, clearly labeled sections, in this order:

What's going on
2-4 sentences summarizing the situation(s) discussed, in the user's own framing — don't editorialize.

Recurring themes
A short bullet list (dash-prefixed lines) of anything that came up more than once across the conversation. If nothing recurs, write "Nothing that recurred within this conversation" for this section instead of inventing a pattern.

What they've already tried or considered
1-3 short bullet points. Omit this whole section (including its label) if the transcript doesn't contain anything like this.

Possible discussion points for a session
2-4 short bullet points phrased as open options ("Might be worth exploring...", "Could be worth naming...") rather than directives or conclusions.

Rules:
- Never diagnose a mental health or relationship condition, and never use clinical labels or jargon beyond terms the user themselves used.
- Never invent details, quotes, or patterns that aren't actually in the transcript.
- Plain text only — no markdown symbols like ** or #, just the section labels and dash-prefixed bullets exactly as shown above.
- Keep the whole thing under roughly 300 words.
- Write the summary in the same language as the transcript — detect it automatically, the same way ChatGPT does.`;

// Renders a conversation's messages as compact plain text for the summary
// prompt above. Caps both the number of turns and each turn's length so a
// very long conversation still produces a bounded, affordable request.
function buildConversationTranscript(conv) {
  const turns = (conv.messages || []).slice(-120);
  return turns
    .map((m) => {
      const speaker = m.role === "user" ? "User" : "Coach";
      const text = String(m.content || "").slice(0, 1500);
      return `${speaker}: ${text || "(no text — attachment only)"}`;
    })
    .join("\n\n");
}

const INSIGHTS_SYSTEM_PROMPT = `You are looking across several separate AI relationship-coaching conversations from the SAME user, spread out over time, to notice recurring patterns — not summarizing any single conversation. Think of this the way a therapist would after seeing a client several times and starting to notice "we keep coming back to this."

Respond with ONLY a JSON object, no other text before or after it, in exactly this shape:
{"patterns": [{"title": "<short label for the pattern, 3-6 words, in the user's language>", "description": "<2-3 plain-text sentences describing the pattern and, if it's reasonably clear, a gentle guess at why it might keep showing up>"}], "note": "<1-2 short, warm, non-clinical sentences overall, or an empty string if nothing meaningful stood out>"}

Rules:
- Only include a pattern if it genuinely shows up across more than one of the conversations below — never invent one just to fill space. Returning fewer than 4 patterns, or even zero, is completely fine if that's honestly what's there.
- Never diagnose a mental health or relationship condition, and never use clinical jargon or labels the user hasn't used themselves.
- Never quote a conversation word-for-word — paraphrase everything.
- Return at most 4 patterns, ordered by how often they show up.
- Write everything in the same language the conversations are mostly written in — detect it automatically, the same way ChatGPT does.`;

// Builds a compact, per-conversation digest across several Coach Chat
// conversations for the insights prompt above. Caps both how many
// conversations are considered and how much of each is included, so this
// stays a bounded, affordable request even for a very active user — this
// is about spotting recurring themes, not a full transcript review.
function buildInsightsDigest(conversations) {
  const recent = conversations.slice(0, 15); // caller sorts newest-first
  return recent
    .map((conv, i) => {
      const date = conv.createdAt ? String(conv.createdAt).slice(0, 10) : "undated";
      const userLines = (conv.messages || [])
        .filter((m) => m.role === "user")
        .slice(0, 12)
        .map((m) => String(m.content || "").slice(0, 300))
        .filter(Boolean);
      return `Conversation ${i + 1} (${date}):\n${userLines.join("\n") || "(no text)"}`;
    })
    .join("\n\n---\n\n");
}

function buildPartnerSystemPrompt(partner) {
  const traits = (partner.traits || "").trim() || "a warm but sometimes distracted long-term partner";
  const context = (partner.context || "").trim();
  return `You are role-playing as "${partner.name}", the user's romantic partner${context ? ` (${context})` : ""}, inside a private practice/rehearsal space the user opened on purpose to practice a real conversation.

Personality and traits to embody: ${traits}.

Rules:
- Stay fully in character as ${partner.name}. Speak in first person, casually, the way a real partner texts — short, natural, imperfect. Not like an assistant.
- Never break character to give advice, disclaimers, or meta-commentary about the roleplay, unless the user explicitly asks to pause/stop it, or the conversation touches on real self-harm, abuse, or a genuine crisis — in that case, gently step out of character and respond with care instead of continuing the scene.
- React the way someone with these traits realistically would, including realistic friction, defensiveness, or distance when that fits the personality — this is what makes the practice useful. But never model abuse, cruelty for its own sake, or anything humiliating.
- Keep replies texting-length — a sentence or two, occasionally more if the moment calls for it. Not essays.
- Always reply in the same language the user writes in — detect it automatically, the same way ChatGPT does. Never ask which language to use. If they switch languages mid-conversation, switch with them.`;
}

// ---------------------------------------------------------------------------
// attachments (images, screen recordings, other files on chat messages)
// ---------------------------------------------------------------------------

function sanitizeFilename(name) {
  const base = String(name || "file")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .trim();
  return base.slice(0, 120) || "file";
}

function attachmentKind(mimeType, filename) {
  const mime = String(mimeType || "");
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("text/") || mime === "application/json") return "text";
  if (TEXT_LIKE_EXTENSIONS.includes(path.extname(filename).toLowerCase())) return "text";
  return "file";
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Decodes+saves the attachments a client sent (as base64 data URLs) to disk
// under public/uploads/<userId>/, and returns their saved metadata. Throws
// a { status, message } object on any validation failure, which callers
// turn straight into an HTTP error response.
function saveIncomingAttachments(user, rawAttachments) {
  const incoming = Array.isArray(rawAttachments) ? rawAttachments : [];
  if (incoming.length === 0) return [];

  const limit = MAX_FILES_PER_MESSAGE_BY_PLAN[user.plan] ?? MAX_FILES_PER_MESSAGE_BY_PLAN.free;
  if (incoming.length > limit) {
    const upgradeHint = user.plan === "free" ? " Upgrade to Pro for up to 3 files per message." : "";
    throw { status: 400, message: `You can attach up to ${limit} file${limit === 1 ? "" : "s"} per message.${upgradeHint}` };
  }

  const userDir = path.join(UPLOADS_DIR, user.id);
  fs.mkdirSync(userDir, { recursive: true });

  let totalBytes = 0;
  const saved = [];

  for (const att of incoming) {
    if (!att || typeof att.dataUrl !== "string" || !att.name) {
      throw { status: 400, message: "One of the attached files couldn't be read." };
    }
    const match = /^data:([^;]+);base64,(.+)$/s.exec(att.dataUrl);
    if (!match) {
      throw { status: 400, message: `Couldn't read the file "${att.name}".` };
    }

    const mimeType = att.mimeType || match[1] || "application/octet-stream";
    const buffer = Buffer.from(match[2], "base64");
    totalBytes += buffer.length;
    if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) {
      throw { status: 400, message: `Attachments are limited to ${MAX_TOTAL_UPLOAD_MB}MB total per message.` };
    }

    const id = generateId("att");
    const safeName = sanitizeFilename(att.name);
    const filename = `${id}_${safeName}`;
    fs.writeFileSync(path.join(userDir, filename), buffer);

    saved.push({
      id,
      name: String(att.name).slice(0, 150),
      mimeType,
      size: buffer.length,
      kind: attachmentKind(mimeType, safeName),
      url: `/uploads/${userId}/${filename}`,
      // Not persisted to the DB — only used for this one OpenAI call below,
      // so images/text files can be fed to the model without re-reading
      // from disk (and without ever storing raw base64 in data/db.json).
      _dataUrl: att.dataUrl,
    });
  }

  return saved;
}

function stripInternalFields(attachment) {
  const { _dataUrl, ...rest } = attachment;
  return rest;
}

// Builds the "content" the model actually receives for the newest user
// message: plain text for text-only messages, or a multimodal array when
// there are images to look at. Non-image attachments are described in
// plain text instead, since gpt-4o-mini can't open video/files directly.
function buildModelContent(message, savedAttachments) {
  const imageParts = [];
  let extraText = "";

  for (const att of savedAttachments) {
    if (att.kind === "image") {
      imageParts.push({ type: "image_url", image_url: { url: att._dataUrl } });
    } else if (att.kind === "text") {
      const base64 = att._dataUrl.split(",")[1] || "";
      const decoded = Buffer.from(base64, "base64").toString("utf-8").slice(0, 6000);
      extraText += `\n\n[Attached file: ${att.name}]\n"""\n${decoded}\n"""`;
    } else {
      const label = att.kind === "video" ? "video" : "file";
      extraText += `\n\n[Attached ${label}: ${att.name} (${att.mimeType}, ${formatBytes(att.size)}) — I can't open this file directly, so please describe what's relevant in it if it matters.]`;
    }
  }

  const text = (message || "") + extraText;

  if (imageParts.length === 0) return text;
  return [{ type: "text", text: text || "(see attached image)" }, ...imageParts];
}

const ATTACHMENT_STYLES = {
  secure: {
    name: "Secure",
    desc: "You're generally comfortable with closeness and independence alike. You can voice needs directly, trust isn't a constant battle, and conflict feels survivable rather than threatening.",
  },
  anxious: {
    name: "Anxious",
    desc: "You crave closeness and reassurance, and you're quick to notice small shifts in your partner's attention. Distance can feel alarming even when nothing is actually wrong, which can make it hard to self-soothe while waiting for reassurance.",
  },
  avoidant: {
    name: "Avoidant",
    desc: "You value independence and can feel crowded by too much closeness or emotional intensity. You tend to handle stress by pulling inward rather than leaning on a partner, which can read as distance even when you do care.",
  },
  disorganized: {
    name: "Disorganized (Fearful-Avoidant)",
    desc: "You want closeness but it can feel unsafe, so you may find yourself pulled between wanting connection and pushing it away. Relationships can feel unpredictable, swinging between craving intimacy and needing to protect yourself from it.",
  },
};

const CHECKIN_QUESTIONS = [
  "What's one small thing your partner did recently that you appreciated, even if you didn't say it out loud?",
  "Is there something you've been meaning to bring up but keep putting off? What's stopping you?",
  "On a scale of 1-10, how connected have you felt to your partner this week — and what would move that number up by one point?",
  "What's a need of yours that's gone unspoken lately?",
  "When did you last feel truly listened to by your partner? What made it feel that way?",
  "Is there a small resentment building up that's still small enough to name calmly?",
  "What's one thing you could do today to make your partner's day a little easier?",
  "How did you handle the last disagreement you had — and is there anything you'd do differently now?",
  "What's something about your relationship you're quietly grateful for right now?",
  "Have you and your partner had any real, undistracted time together this week?",
  "What's a boundary you've been meaning to set, with your partner or with someone else?",
  "If your partner described how you've been lately in one word, what do you think they'd say?",
  "What's one assumption you're making about your partner right now that you haven't actually checked?",
  "How are you doing outside of the relationship — sleep, stress, work? It shapes more of this than it gets credit for.",
  "What's one thing you wish your partner understood about you that they might not fully grasp yet?",
];

function checkinQuestionForDate(dateKey) {
  let hash = 0;
  for (const ch of dateKey) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return CHECKIN_QUESTIONS[hash % CHECKIN_QUESTIONS.length];
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    createdAt: user.createdAt,
    usage: user.usage,
    usageLimit: FREE_DAILY_LIMIT,
    attachmentStyle: user.attachmentStyle || null,
    hasBilling: !!user.stripeCustomerId,
    subscriptionStatus: user.subscriptionStatus || null,
  };
}

function publicPartner(p) {
  return { id: p.id, name: p.name, traits: p.traits, context: p.context, createdAt: p.createdAt };
}

function planLabel(plan) {
  return { free: "Free", pro: "Pro", premium: "Premium" }[plan] || "Free";
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function signToken(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "30d" });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "You need to be logged in." });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const db = readDb();
    const user = db.users.find((u) => u.id === payload.sub);
    if (!user) return res.status(401).json({ error: "Invalid session." });
    req.user = user;
    req.db = db;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session." });
  }
}

// Shared free-tier gate for every endpoint that makes an OpenAI call.
// Returns true (and has already sent a 429) if the user is blocked.
function isOverDailyLimit(user, res) {
  if (user.plan !== "free") return false;
  const today = todayKey();
  if (!user.usage || user.usage.date !== today) {
    user.usage = { date: today, count: 0 };
  }
  if (user.usage.count >= FREE_DAILY_LIMIT) {
    res.status(429).json({
      error: `You've reached the Free plan's daily limit of ${FREE_DAILY_LIMIT} AI messages. Try again tomorrow, or upgrade to Pro.`,
    });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------

app.post("/api/auth/register", (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const db = readDb();
    const normalizedEmail = String(email).trim().toLowerCase();
    if (db.users.some((u) => u.email === normalizedEmail)) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const user = {
      id: generateId("user"),
      email: normalizedEmail,
      name: (name || "").trim() || normalizedEmail.split("@")[0],
      passwordHash: bcrypt.hashSync(password, 10),
      plan: "free",
      createdAt: new Date().toISOString(),
      usage: { date: todayKey(), count: 0 },
      attachmentStyle: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionStatus: null,
    };

    db.users.push(user);
    writeDb(db);

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Something went wrong while creating your account. Please try again." });
  }
});

app.post("/api/auth/login", (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const db = readDb();
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = db.users.find((u) => u.email === normalizedEmail);

    if (!user || !user.passwordHash || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Something went wrong while logging you in. Please try again." });
  }
});

app.get("/api/me", authMiddleware, (req, res) => {
  res.json(publicUser(req.user));
});

// ---------------------------------------------------------------------------
// billing (Stripe) — upgrading/downgrading a plan and self-serve subscription
// management. The plan itself only ever changes here or from the webhook
// above, once a real payment has actually gone through.
// ---------------------------------------------------------------------------

app.post("/api/billing/checkout", authMiddleware, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: "Payments aren't set up on this server yet." });
  }
  try {
    const { plan } = req.body || {};
    const priceId = PLAN_TO_STRIPE_PRICE[plan];
    if (!priceId) {
      return res.status(400).json({ error: "That's not a valid paid plan." });
    }

    const db = req.db;
    const user = req.user;

    if (user.stripeSubscriptionId && user.subscriptionStatus === "active") {
      return res.status(400).json({
        error: "You already have an active subscription. Manage or change your plan from your account page.",
        usePortal: true,
      });
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      writeDb(db);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${APP_URL}/dashboard.html?upgraded=1`,
      cancel_url: `${APP_URL}/index.html#pricing`,
      metadata: { userId: user.id, plan },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Checkout session error:", err);
    res.status(500).json({ error: "Couldn't start checkout. Please try again." });
  }
});

app.post("/api/billing/portal", authMiddleware, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: "Payments aren't set up on this server yet." });
  }
  try {
    const user = req.user;
    if (!user.stripeCustomerId) {
      return res.status(400).json({ error: "No billing account yet — upgrade to a paid plan first." });
    }
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${APP_URL}/dashboard.html`,
    });
    res.json({ url: portalSession.url });
  } catch (err) {
    console.error("Billing portal error:", err);
    res.status(500).json({ error: "Couldn't open the billing portal. Please try again." });
  }
});

// ---------------------------------------------------------------------------
// partner profiles (used by Practice mode)
// ---------------------------------------------------------------------------

app.get("/api/partners", authMiddleware, (req, res) => {
  const list = req.db.partnerProfiles
    .filter((p) => p.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(publicPartner);
  res.json(list);
});

app.post("/api/partners", authMiddleware, (req, res) => {
  try {
    const { name, traits, context } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Give your partner profile a name." });
    }

    const db = req.db;
    const limit = PARTNER_PROFILE_LIMITS[req.user.plan];
    if (limit != null) {
      const existingCount = db.partnerProfiles.filter((p) => p.userId === req.user.id).length;
      if (existingCount >= limit) {
        return res.status(403).json({
          error: `The ${planLabel(req.user.plan)} plan includes ${limit} partner profile${limit === 1 ? "" : "s"}. Upgrade to add more.`,
          limitReached: true,
        });
      }
    }

    const partner = {
      id: generateId("partner"),
      userId: req.user.id,
      name: String(name).trim().slice(0, 60),
      traits: String(traits || "").trim().slice(0, 500),
      context: String(context || "").trim().slice(0, 200),
      createdAt: new Date().toISOString(),
    };
    db.partnerProfiles.push(partner);
    writeDb(db);
    res.json(publicPartner(partner));
  } catch (err) {
    console.error("Create partner error:", err);
    res.status(500).json({ error: "Couldn't save that partner profile. Please try again." });
  }
});

app.delete("/api/partners/:id", authMiddleware, (req, res) => {
  const db = req.db;
  const idx = db.partnerProfiles.findIndex((p) => p.id === req.params.id && p.userId === req.user.id);
  if (idx === -1) return res.status(404).json({ error: "Partner profile not found." });
  db.partnerProfiles.splice(idx, 1);
  writeDb(db);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// conversations (Coach mode + Practice mode)
// ---------------------------------------------------------------------------

app.get("/api/conversations", authMiddleware, (req, res) => {
  const list = req.db.conversations
    .filter((c) => c.userId === req.user.id)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map((c) => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt,
      createdAt: c.createdAt,
      mode: c.mode || "coach",
      partnerName: c.partnerName || null,
    }));
  res.json(list);
});

app.post("/api/conversations", authMiddleware, (req, res) => {
  const db = req.db;
  const { mode, partnerProfileId } = req.body || {};
  const isPractice = mode === "practice";

  let partner = null;
  if (isPractice) {
    partner = db.partnerProfiles.find((p) => p.id === partnerProfileId && p.userId === req.user.id);
    if (!partner) {
      return res.status(400).json({ error: "Select or create a partner profile to start a practice conversation." });
    }
  }

  const conv = {
    id: generateId("conv"),
    userId: req.user.id,
    mode: isPractice ? "practice" : "coach",
    partnerProfileId: partner ? partner.id : null,
    partnerName: partner ? partner.name : null,
    partnerTraits: partner ? partner.traits : null,
    partnerContext: partner ? partner.context : null,
    title: isPractice ? `Practice with ${partner.name}` : "New conversation",
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.conversations.push(conv);
  writeDb(db);
  res.json(conv);
});

app.get("/api/conversations/:id", authMiddleware, (req, res) => {
  const conv = req.db.conversations.find((c) => c.id === req.params.id && c.userId === req.user.id);
  if (!conv) return res.status(404).json({ error: "Conversation not found." });
  res.json(conv);
});

app.delete("/api/conversations/:id", authMiddleware, (req, res) => {
  const db = req.db;
  const idx = db.conversations.findIndex((c) => c.id === req.params.id && c.userId === req.user.id);
  if (idx === -1) return res.status(404).json({ error: "Conversation not found." });
  db.conversations.splice(idx, 1);
  writeDb(db);
  res.json({ ok: true });
});

app.post("/api/conversations/:id/messages", authMiddleware, async (req, res) => {
  const { message, attachments: rawAttachments } = req.body || {};
  const text = message ? String(message).trim() : "";
  const hasText = text.length > 0;
  const hasAttachments = Array.isArray(rawAttachments) && rawAttachments.length > 0;

  if (!hasText && !hasAttachments) {
    return res.status(400).json({ error: "Write a message or attach a file." });
  }

  const db = req.db;
  const conv = db.conversations.find((c) => c.id === req.params.id && c.userId === req.user.id);
  if (!conv) return res.status(404).json({ error: "Conversation not found." });

  const user = db.users.find((u) => u.id === req.user.id);
  if (isOverDailyLimit(user, res)) return;

  let savedAttachments;
  try {
    savedAttachments = saveIncomingAttachments(user, rawAttachments);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message || "Couldn't process the attached file(s)." });
  }

  conv.messages.push({
    role: "user",
    content: text,
    attachments: savedAttachments.map(stripInternalFields),
    at: new Date().toISOString(),
  });

  const isPractice = conv.mode === "practice";
  const systemPrompt = isPractice
    ? buildPartnerSystemPrompt({ name: conv.partnerName || "your partner", traits: conv.partnerTraits, context: conv.partnerContext })
    : COACH_SYSTEM_PROMPT;

  try {
    // Prior turns are sent as plain text (their attachments are just noted
    // in the stored content, not re-uploaded); only the newest message gets
    // full multimodal treatment, so images aren't re-sent to the model on
    // every follow-up turn.
    const priorHistory = conv.messages.slice(-21, -1).map((m) => ({ role: m.role, content: m.content }));
    const latestContent = buildModelContent(text, savedAttachments);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...priorHistory, { role: "user", content: latestContent }],
      temperature: isPractice ? 0.95 : 0.8,
    });

    const reply = completion.choices[0]?.message?.content?.trim() || "Sorry, I can't respond right now. Please try again.";

    conv.messages.push({ role: "assistant", content: reply, at: new Date().toISOString() });
    conv.updatedAt = new Date().toISOString();
    if (conv.title === "New conversation") {
      if (hasText) {
        conv.title = text.slice(0, 48) + (text.length > 48 ? "…" : "");
      } else if (savedAttachments.length > 0) {
        conv.title = `📎 ${savedAttachments[0].name}`.slice(0, 48);
      }
    }

    if (user.plan === "free") {
      user.usage.count += 1;
    }

    writeDb(db);
    res.json({
      reply,
      title: conv.title,
      mode: conv.mode,
      partnerName: conv.partnerName,
      attachments: savedAttachments.map(stripInternalFields),
      usage: user.usage,
    });
  } catch (err) {
    console.error("OpenAI error:", err.message);
    conv.updatedAt = new Date().toISOString();
    writeDb(db); // keep the user's message even if the AI call failed
    res.status(500).json({ error: "Couldn't get a response from the AI. Please try again." });
  }
});

// ---------------------------------------------------------------------------
// Therapist summary — turns a Coach Chat conversation into a short,
// professional-reader summary the user can export/print to bring to a real
// therapist. Cached on the conversation after first generation so re-opening
// it doesn't cost another AI call or another day's free-tier usage; pass
// { regenerate: true } to force a fresh one.
// ---------------------------------------------------------------------------

app.post("/api/conversations/:id/summary", authMiddleware, async (req, res) => {
  try {
    const db = req.db;
    const conv = db.conversations.find((c) => c.id === req.params.id && c.userId === req.user.id);
    if (!conv) return res.status(404).json({ error: "Conversation not found." });

    if (conv.mode === "practice") {
      return res.status(400).json({
        error: "Summaries are available for Coach Chat conversations — Partner Practice is a rehearsal, not a real conversation with your partner, so it isn't something to bring to a therapist as fact.",
      });
    }

    const userMessageCount = (conv.messages || []).filter((m) => m.role === "user").length;
    if (userMessageCount === 0) {
      return res.status(400).json({ error: "Add a bit more to the conversation before exporting a summary." });
    }

    const regenerate = !!(req.body && req.body.regenerate);
    if (conv.therapistSummary && !regenerate) {
      return res.json({
        summary: conv.therapistSummary,
        generatedAt: conv.therapistSummaryAt,
        conversationTitle: conv.title,
        cached: true,
      });
    }

    const user = db.users.find((u) => u.id === req.user.id);
    if (isOverDailyLimit(user, res)) return;

    const transcript = buildConversationTranscript(conv);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: THERAPIST_SUMMARY_SYSTEM_PROMPT },
        { role: "user", content: `Conversation transcript:\n"""\n${transcript}\n"""` },
      ],
      temperature: 0.4,
    });

    const summary = completion.choices[0]?.message?.content?.trim() || "Couldn't generate a summary right now.";
    const generatedAt = new Date().toISOString();

    conv.therapistSummary = summary;
    conv.therapistSummaryAt = generatedAt;
    if (user.plan === "free") user.usage.count += 1;
    writeDb(db);

    res.json({ summary, generatedAt, conversationTitle: conv.title, cached: false, usage: user.usage });
  } catch (err) {
    console.error("Therapist summary error:", err.message);
    res.status(500).json({ error: "Couldn't generate a summary right now. Please try again." });
  }
});

// ---------------------------------------------------------------------------
// Insights — looks across a user's Coach Chat conversations (not Practice,
// which is rehearsal rather than real events) for recurring patterns.
// Cached on the user record and regenerated on demand, same shape as the
// therapist summary above.
// ---------------------------------------------------------------------------

const INSIGHTS_MIN_CONVERSATIONS = 3;

app.post("/api/insights", authMiddleware, async (req, res) => {
  try {
    const db = req.db;
    const user = db.users.find((u) => u.id === req.user.id);

    const coachConversations = db.conversations
      .filter(
        (c) => c.userId === req.user.id && c.mode !== "practice" && (c.messages || []).some((m) => m.role === "user")
      )
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (coachConversations.length < INSIGHTS_MIN_CONVERSATIONS) {
      return res.json({
        notEnoughData: true,
        conversationCount: coachConversations.length,
        needed: INSIGHTS_MIN_CONVERSATIONS,
      });
    }

    const regenerate = !!(req.body && req.body.regenerate);
    if (user.insights && !regenerate) {
      return res.json({
        patterns: user.insights.patterns,
        note: user.insights.note,
        generatedAt: user.insightsAt,
        conversationCount: coachConversations.length,
        cached: true,
      });
    }

    if (isOverDailyLimit(user, res)) return;

    const digest = buildInsightsDigest(coachConversations);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: INSIGHTS_SYSTEM_PROMPT },
        { role: "user", content: `Conversations (newest first):\n"""\n${digest}\n"""` },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    let parsed = {};
    try {
      parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    } catch (err) {
      parsed = {};
    }
    const patterns = Array.isArray(parsed.patterns) ? parsed.patterns.slice(0, 4) : [];
    const note = String(parsed.note || "").trim();
    const generatedAt = new Date().toISOString();

    user.insights = { patterns, note };
    user.insightsAt = generatedAt;
    if (user.plan === "free") user.usage.count += 1;
    writeDb(db);

    res.json({
      patterns,
      note,
      generatedAt,
      conversationCount: coachConversations.length,
      cached: false,
      usage: user.usage,
    });
  } catch (err) {
    console.error("Insights error:", err.message);
    res.status(500).json({ error: "Couldn't generate insights right now. Please try again." });
  }
});

// ---------------------------------------------------------------------------
// Message Coach — one-off rewrite tool, not tied to a saved conversation
// ---------------------------------------------------------------------------

app.post("/api/message-coach", authMiddleware, async (req, res) => {
  try {
    const { draft, context } = req.body || {};
    if (!draft || !String(draft).trim()) {
      return res.status(400).json({ error: "Paste a message to get feedback on." });
    }

    const db = req.db;
    const user = db.users.find((u) => u.id === req.user.id);
    if (isOverDailyLimit(user, res)) return;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: MESSAGE_COACH_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Context (optional, may be empty): ${String(context || "").trim() || "(none given)"}\n\nDraft message:\n"""${String(draft).trim()}"""`,
        },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    // Structured JSON (rather than a labeled-text block) so callers — the
    // website, and the browser extension's WhatsApp/Messenger integration —
    // can reliably pull out just the rewrite to use, in any language,
    // without parsing labels that themselves get translated.
    let parsed = {};
    try {
      parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    } catch (err) {
      parsed = {};
    }
    const rewrite = String(parsed.rewrite || "").trim();
    const why = String(parsed.why || "").trim();

    if (!rewrite) {
      return res.status(500).json({ error: "Couldn't generate a rewrite right now. Please try again." });
    }

    if (user.plan === "free") user.usage.count += 1;
    writeDb(db);

    res.json({ rewrite, why, usage: user.usage });
  } catch (err) {
    console.error("Message coach error:", err.message);
    res.status(500).json({ error: "Couldn't get feedback right now. Please try again." });
  }
});

// ---------------------------------------------------------------------------
// Public Message Coach demo — no login required, lets a visitor try the
// rewrite on the landing page itself before signing up. Rate-limited per IP
// (in memory — resets on redeploy/restart, which is fine for a demo) rather
// than per account, since there's no account yet. Kept deliberately separate
// from /api/message-coach above rather than sharing a helper, so tightening
// or removing this public route later can never accidentally affect the
// authenticated one.
// ---------------------------------------------------------------------------

const DEMO_DAILY_LIMIT = 3;
const DEMO_MAX_CHARS = 400;
const demoUsageByIp = new Map(); // ip -> { date: "YYYY-MM-DD", count }

function demoUsageToday(ip) {
  const today = new Date().toISOString().slice(0, 10);
  const entry = demoUsageByIp.get(ip);
  if (!entry || entry.date !== today) return 0;
  return entry.count;
}

function recordDemoUsage(ip) {
  const today = new Date().toISOString().slice(0, 10);
  const entry = demoUsageByIp.get(ip);
  const count = entry && entry.date === today ? entry.count + 1 : 1;
  demoUsageByIp.set(ip, { date: today, count });
  return count;
}

app.post("/api/public/message-coach-demo", async (req, res) => {
  try {
    const ip = req.ip || "unknown";
    const usedSoFar = demoUsageToday(ip);
    if (usedSoFar >= DEMO_DAILY_LIMIT) {
      return res.status(429).json({
        error: "You've used all 3 free demo rewrites for today. Create a free account for 8 a day, every day.",
        limitReached: true,
      });
    }

    const draft = String((req.body || {}).draft || "").trim();
    if (!draft) {
      return res.status(400).json({ error: "Paste a message to get feedback on." });
    }
    if (draft.length > DEMO_MAX_CHARS) {
      return res.status(400).json({ error: `Keep the demo message under ${DEMO_MAX_CHARS} characters — the full app has no limit.` });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: MESSAGE_COACH_SYSTEM_PROMPT },
        { role: "user", content: `Context (optional, may be empty): (none given)\n\nDraft message:\n"""${draft}"""` },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    let parsed = {};
    try {
      parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    } catch (err) {
      parsed = {};
    }
    const rewrite = String(parsed.rewrite || "").trim();
    const why = String(parsed.why || "").trim();

    if (!rewrite) {
      return res.status(500).json({ error: "Couldn't generate a rewrite right now. Please try again." });
    }

    const usedNow = recordDemoUsage(ip);
    res.json({ rewrite, why, remaining: Math.max(0, DEMO_DAILY_LIMIT - usedNow) });
  } catch (err) {
    console.error("Message coach demo error:", err.message);
    res.status(500).json({ error: "Couldn't get feedback right now. Please try again." });
  }
});

// ---------------------------------------------------------------------------
// Attachment style quiz — scored client-side, optional, just saves the result
// ---------------------------------------------------------------------------

app.post("/api/quiz/attachment", authMiddleware, (req, res) => {
  try {
    const { style } = req.body || {};
    if (!ATTACHMENT_STYLES[style]) {
      return res.status(400).json({ error: "Unknown attachment style." });
    }

    const db = req.db;
    const user = db.users.find((u) => u.id === req.user.id);
    user.attachmentStyle = style;
    user.attachmentQuizAt = new Date().toISOString();
    writeDb(db);

    res.json({ attachmentStyle: style, ...ATTACHMENT_STYLES[style] });
  } catch (err) {
    console.error("Quiz save error:", err);
    res.status(500).json({ error: "Couldn't save your result. Please try again." });
  }
});

// ---------------------------------------------------------------------------
// Daily check-in — always optional/skippable, never gates anything
// ---------------------------------------------------------------------------

app.get("/api/checkin/today", authMiddleware, (req, res) => {
  const today = todayKey();
  const question = checkinQuestionForDate(today);
  const existing = req.db.checkins.find((c) => c.userId === req.user.id && c.date === today);

  if (existing) {
    return res.json({
      date: today,
      question: existing.question || question,
      answered: !!existing.answer,
      skipped: !!existing.skipped,
      answer: existing.answer || null,
    });
  }

  res.json({ date: today, question, answered: false, skipped: false, answer: null });
});

app.post("/api/checkin", authMiddleware, (req, res) => {
  try {
    const { answer, skip } = req.body || {};
    const db = req.db;
    const today = todayKey();
    const question = checkinQuestionForDate(today);

    let entry = db.checkins.find((c) => c.userId === req.user.id && c.date === today);
    if (!entry) {
      entry = {
        id: generateId("checkin"),
        userId: req.user.id,
        date: today,
        question,
        answer: null,
        skipped: false,
        createdAt: new Date().toISOString(),
      };
      db.checkins.push(entry);
    }

    if (skip) {
      entry.skipped = true;
    } else if (answer && String(answer).trim()) {
      entry.answer = String(answer).trim().slice(0, 2000);
      entry.answeredAt = new Date().toISOString();
    } else {
      return res.status(400).json({ error: "Write a short answer, or skip for today." });
    }

    writeDb(db);
    res.json({ date: entry.date, question: entry.question, answered: !!entry.answer, skipped: entry.skipped, answer: entry.answer });
  } catch (err) {
    console.error("Checkin error:", err);
    res.status(500).json({ error: "Couldn't save your check-in. Please try again." });
  }
});

// ---------------------------------------------------------------------------
// Partner sharing — a read-only link the user builds by hand, item by item.
// The partner never needs an account. Nothing here is ever populated
// automatically from a conversation or summary — every item is text the
// user explicitly wrote or pasted in, because a Coach Chat conversation can
// contain complaints about the partner that were never meant for them to
// read. Keep it that way: this feature must never gain a "share this whole
// conversation/summary" shortcut without a real reconsideration of privacy.
// ---------------------------------------------------------------------------

const MAX_SHARES_PER_USER = 10;
const MAX_ITEMS_PER_SHARE = 30;
const SHARE_ITEM_TYPES = new Set(["note", "message-rewrite", "debrief", "conversation"]);

function publicShare(share) {
  return {
    id: share.id,
    title: share.title,
    token: share.token,
    items: share.items,
    revoked: !!share.revoked,
    createdAt: share.createdAt,
    updatedAt: share.updatedAt,
  };
}

app.get("/api/shares", authMiddleware, (req, res) => {
  const list = req.db.shares
    .filter((s) => s.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(publicShare);
  res.json(list);
});

app.post("/api/shares", authMiddleware, (req, res) => {
  try {
    const { title } = req.body || {};
    const db = req.db;
    const existingCount = db.shares.filter((s) => s.userId === req.user.id).length;
    if (existingCount >= MAX_SHARES_PER_USER) {
      return res.status(403).json({
        error: `You can have up to ${MAX_SHARES_PER_USER} shares at once. Delete an old one to make room.`,
      });
    }

    const now = new Date().toISOString();
    const share = {
      id: generateId("share"),
      userId: req.user.id,
      title: String(title || "").trim().slice(0, 80) || "Untitled share",
      token: crypto.randomBytes(24).toString("hex"),
      items: [],
      revoked: false,
      createdAt: now,
      updatedAt: now,
    };
    db.shares.push(share);
    writeDb(db);
    res.json(publicShare(share));
  } catch (err) {
    console.error("Create share error:", err);
    res.status(500).json({ error: "Couldn't create that share. Please try again." });
  }
});

app.get("/api/shares/:id", authMiddleware, (req, res) => {
  const share = req.db.shares.find((s) => s.id === req.params.id && s.userId === req.user.id);
  if (!share) return res.status(404).json({ error: "Share not found." });
  res.json(publicShare(share));
});

app.patch("/api/shares/:id", authMiddleware, (req, res) => {
  try {
    const db = req.db;
    const share = db.shares.find((s) => s.id === req.params.id && s.userId === req.user.id);
    if (!share) return res.status(404).json({ error: "Share not found." });

    const { title, revoked } = req.body || {};
    if (title !== undefined) {
      if (!String(title).trim()) return res.status(400).json({ error: "Give this share a title." });
      share.title = String(title).trim().slice(0, 80);
    }
    if (revoked !== undefined) share.revoked = !!revoked;
    share.updatedAt = new Date().toISOString();
    writeDb(db);
    res.json(publicShare(share));
  } catch (err) {
    console.error("Update share error:", err);
    res.status(500).json({ error: "Couldn't update that share. Please try again." });
  }
});

app.delete("/api/shares/:id", authMiddleware, (req, res) => {
  const db = req.db;
  const idx = db.shares.findIndex((s) => s.id === req.params.id && s.userId === req.user.id);
  if (idx === -1) return res.status(404).json({ error: "Share not found." });
  db.shares.splice(idx, 1);
  writeDb(db);
  res.json({ ok: true });
});

app.post("/api/shares/:id/items", authMiddleware, (req, res) => {
  try {
    const db = req.db;
    const share = db.shares.find((s) => s.id === req.params.id && s.userId === req.user.id);
    if (!share) return res.status(404).json({ error: "Share not found." });

    const { text, type } = req.body || {};
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: "Write something to add first." });
    }
    if (share.items.length >= MAX_ITEMS_PER_SHARE) {
      return res.status(403).json({ error: `A share can hold up to ${MAX_ITEMS_PER_SHARE} items.` });
    }

    const item = {
      id: generateId("item"),
      type: SHARE_ITEM_TYPES.has(type) ? type : "note",
      text: String(text).trim().slice(0, 3000),
      createdAt: new Date().toISOString(),
    };
    share.items.push(item);
    share.updatedAt = new Date().toISOString();
    writeDb(db);
    res.json(publicShare(share));
  } catch (err) {
    console.error("Add share item error:", err);
    res.status(500).json({ error: "Couldn't add that. Please try again." });
  }
});

// Adds an entire conversation to a share, as a point-in-time snapshot — not
// a live link to the conversation. This matters: if it were live, a message
// the user writes into that same conversation *after* sharing the link
// would silently become visible to the partner too, without the user ever
// choosing to share it. The frontend also requires the user to preview the
// full transcript before calling this, so nothing goes out unseen.
app.post("/api/shares/:id/items/from-conversation", authMiddleware, (req, res) => {
  try {
    const db = req.db;
    const share = db.shares.find((s) => s.id === req.params.id && s.userId === req.user.id);
    if (!share) return res.status(404).json({ error: "Share not found." });

    const { conversationId } = req.body || {};
    const conv = db.conversations.find((c) => c.id === conversationId && c.userId === req.user.id);
    if (!conv) return res.status(404).json({ error: "Conversation not found." });

    if (share.items.length >= MAX_ITEMS_PER_SHARE) {
      return res.status(403).json({ error: `A share can hold up to ${MAX_ITEMS_PER_SHARE} items.` });
    }

    const messages = (conv.messages || [])
      .filter((m) => m && m.content && String(m.content).trim())
      .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: String(m.content).trim() }));

    if (!messages.length) {
      return res.status(400).json({ error: "This conversation doesn't have any messages yet." });
    }

    const item = {
      id: generateId("item"),
      type: "conversation",
      text: conv.title || "Conversation",
      messages,
      createdAt: new Date().toISOString(),
    };
    share.items.push(item);
    share.updatedAt = new Date().toISOString();
    writeDb(db);
    res.json(publicShare(share));
  } catch (err) {
    console.error("Add conversation share item error:", err);
    res.status(500).json({ error: "Couldn't add that conversation. Please try again." });
  }
});

app.delete("/api/shares/:id/items/:itemId", authMiddleware, (req, res) => {
  const db = req.db;
  const share = db.shares.find((s) => s.id === req.params.id && s.userId === req.user.id);
  if (!share) return res.status(404).json({ error: "Share not found." });
  const idx = share.items.findIndex((i) => i.id === req.params.itemId);
  if (idx === -1) return res.status(404).json({ error: "Item not found." });
  share.items.splice(idx, 1);
  share.updatedAt = new Date().toISOString();
  writeDb(db);
  res.json(publicShare(share));
});

// Public, unauthenticated — this is what the partner opens. Gated by the
// share's token (a long random string, not sequential/guessable) rather
// than its id, and only ever returns items the user explicitly added.
app.get("/api/public/shares/:token", (req, res) => {
  const db = readDb();
  const share = db.shares.find((s) => s.token === req.params.token);
  if (!share || share.revoked) {
    return res.status(404).json({ error: "This share link isn't available. It may have been removed or revoked." });
  }
  res.json({
    title: share.title,
    items: share.items.map((i) => ({
      type: i.type,
      text: i.text,
      messages: i.type === "conversation" ? i.messages : undefined,
      createdAt: i.createdAt,
    })),
    updatedAt: share.updatedAt,
  });
});

// Safety net: catches anything not already handled by a route's own
// try/catch (e.g. a thrown error in a synchronous helper) so the client
// always gets a valid JSON response instead of a broken/empty one.
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (res.headersSent) return next(err);
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({ error: `That's too large — please keep attachments under ${MAX_TOTAL_UPLOAD_MB}MB total per message.` });
  }
  res.status(500).json({ error: "Unexpected server error. Please try again." });
});

app.listen(PORT, () => {
  console.log(`🔥 RelateIQ server running on http://localhost:${PORT}`);
});
