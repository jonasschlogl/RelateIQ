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
import { sendEmail, emailShell, escapeForEmail } from "./lib/email.js";
import webpush from "web-push";

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
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), async (req, res) => {
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
        const wasFree = user.plan === "free" || !user.plan;
        user.stripeCustomerId = session.customer;
        user.stripeSubscriptionId = session.subscription;
        user.subscriptionStatus = "active";
        if (session.metadata?.plan) user.plan = session.metadata.plan;
        writeDb(db);

        // First time this user has ever converted to paid — this is the
        // one moment a referral reward can fire, so it can't be triggered
        // more than once per referred user.
        if (wasFree && session.metadata?.plan) {
          const priceId = PLAN_TO_STRIPE_PRICE[session.metadata.plan];
          if (priceId) await grantReferralRewardIfDue(db, user, priceId);
        }
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

// Free-plan limits BEYOND the shared daily AI-message pool above. Coach
// Chat (the everyday "come back and talk it through" habit loop) stays
// generous — that's what gets people using this enough to tell a friend.
// The scarce resources on Free are the higher-"wow", more shareable
// moments: attaching an actual screenshot of a conversation with your
// partner for RelateIQ to read, and a full Partner Practice rehearsal —
// these are lifetime counts (not daily), so a Free account gets a real
// taste of each before hitting the upgrade prompt. Deliberately not set to
// "1 and never again" this early — a brand-new product still needs people
// to experience enough value to want to come back and tell someone else;
// tighten these once there's real signal on where people drop off vs.
// convert.
const FREE_LIFETIME_ATTACHMENT_LIMIT = 3; // files/photos a Free account can ever attach, combined across all conversations
const FREE_LIFETIME_PRACTICE_CONVERSATIONS = 1; // Partner Practice rehearsals a Free account can start
const FREE_LIFETIME_MESSAGE_COACH_USES = 3; // Message Coach rewrites/proposals a Free account can request from the website tool
// (the browser extension's automatic smart-reply chips are deliberately left
// off this cap and stay on the general daily AI pool below — they fire
// passively while chatting, so a lifetime cap this small would burn out in
// minutes rather than reflecting a deliberate "try the feature" choice)

// Partner profiles (Practice mode) allowed per plan — omit a plan here (e.g.
// "premium") to leave it unlimited.
const PARTNER_PROFILE_LIMITS = { free: 1, pro: 5 };

// Attachments (images, screen recordings, other files) on chat messages —
// how many a single message can carry, by plan. Omit a plan here to fall
// back to the free limit, same convention as PARTNER_PROFILE_LIMITS above.
const MAX_FILES_PER_MESSAGE_BY_PLAN = { free: 1, pro: 3, premium: 5 };
const MAX_TOTAL_UPLOAD_MB = 15;
const MAX_TOTAL_UPLOAD_BYTES = MAX_TOTAL_UPLOAD_MB * 1024 * 1024;

// Premium's headline differentiator: the live, interactive coaching
// surfaces (Coach Chat, Partner Practice, Message Coach) call a noticeably
// stronger model for Premium subscribers — real, felt quality (more
// specific, more nuanced replies), not just a bigger usage cap. Free and
// Pro share the fast/inexpensive model everywhere. Insights, the therapist
// summary, and the public demo stay on the fast model regardless of plan —
// they're extraction/summarization tasks, not the "hear me out and
// respond" moments where model quality is actually noticeable, and keeping
// them off the pricier model keeps the cost of those unlimited-on-Pro+
// features predictable.
const STANDARD_MODEL = "gpt-4o-mini";
const PREMIUM_MODEL = "gpt-4o";
function modelForPlan(plan) {
  return plan === "premium" ? PREMIUM_MODEL : STANDARD_MODEL;
}
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
if (!process.env.DB_PATH) {
  console.warn(
    "⚠️  DB_PATH is not set — data/db.json is being stored inside the app's own container filesystem. " +
      "On Railway this does NOT survive a redeploy unless you've mounted a persistent Volume and pointed " +
      "DB_PATH at a file inside it. See README for setup."
  );
}
if (!process.env.RESEND_API_KEY) {
  console.warn("⚠️  RESEND_API_KEY is not set — check-in reminder and weekly digest emails will not be sent.");
}
if (!process.env.ADMIN_EMAILS) {
  console.warn("⚠️  ADMIN_EMAILS is not set — the /admin.html growth dashboard will refuse everyone.");
}

// Web Push (browser notifications) — optional, same pattern as Resend
// above: without both VAPID keys set, sendPushToUser() below just no-ops
// instead of throwing, so the rest of the app runs fine without it.
let pushConfigured = false;
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:support@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  pushConfigured = true;
} else {
  console.warn("⚠️  VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY are not set — browser push notifications will not be sent.");
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

You may be given a draft message to rewrite, or recent messages from the conversation (a transcript, oldest first, each line labeled "Them:" or "Me:"), or both.

- If a draft is given: rewrite THAT draft. Use the transcript (if given) only to understand tone and context, not to change what the user is trying to say.
- If NO draft is given but a transcript is: the user hasn't written anything yet and wants a suggestion for what to send next. Read the transcript and propose one natural, appropriate reply to the other person's most recent message, written as if it were the user's own words in their voice. Put that proposed reply in "rewrite" exactly as you would a rewritten draft.

Never diagnose, moralize, or lecture. If the draft or transcript describes abuse directed at the user, gently note that in "why" and suggest professional support instead of just rewriting it.

Always write both fields in the same language as the draft message (or, if none was given, the same language as the transcript) — detect it automatically, the same way ChatGPT does, without asking or mentioning it.

Respond with ONLY a JSON object, no other text before or after it, in exactly this shape:
{"rewrite": "<the rewritten or proposed message only, ready to send — no labels, no quotes around it, no explanation mixed in>", "why": "<2-4 short plain-text sentences explaining what changed and why, or why you proposed this reply, no bullet points>"}`;

// Suggests 2-3 short, distinct reply options based on a recent chat
// transcript alone (no draft) — powers the browser extension's automatic
// "smart reply" chips, which appear near the compose box on WhatsApp
// Web / Messenger / Instagram DMs after the other person sends a message.
// Kept as a separate prompt/endpoint from message-coach (which always
// returns exactly one rewrite) since chips need several short options at
// once, in a lighter, more scannable style than a full coached message.
const CHAT_SUGGEST_SYSTEM_PROMPT = `You suggest short, natural reply options for someone in the middle of a real conversation with their partner, based on the recent messages of that conversation (a transcript, oldest first, each line labeled "Them:" or "Me:").

Propose 2 to 3 DIFFERENT short replies to the other person's most recent message — different in substance or tone (e.g. one warmer/more affirming, one that asks a clarifying question, one that sets a boundary or names a need), not just reworded versions of each other. Each should be something the user could tap and send as-is, in their own natural voice — casual chat length, not an essay. Ground them in Nonviolent Communication and the Gottman Method where relevant, but don't make every option sound therapy-speak — at least one should just be a normal, warm, everyday reply.

Never diagnose, moralize, or lecture. If the transcript describes abuse directed at the user, respond with just ONE suggestion that gently acknowledges it and suggests reaching out to a trusted person or professional, instead of proposing casual replies.

Write every suggestion in the same language as the transcript — detect it automatically, without asking or mentioning it.

Respond with ONLY a JSON object, no other text before or after it, in exactly this shape:
{"suggestions": ["<first reply option, ready to send>", "<second reply option, ready to send>"]}`;

// Turns the extension's [{from:"me"|"them", text}] transcript array into the
// compact "Them: ...\nMe: ..." text block both prompts above expect. Shared
// by /api/message-coach (when called with `messages` instead of/alongside a
// draft) and /api/message-coach/suggestions. Trims to the last N messages
// and caps each message's length so a very long conversation or a hostile
// payload can't blow up the prompt (or the OpenAI bill).
const CHAT_TRANSCRIPT_MAX_MESSAGES = 16;
const CHAT_TRANSCRIPT_MAX_CHARS_PER_MESSAGE = 600;

function buildChatTranscript(messages) {
  if (!Array.isArray(messages)) return "";
  const trimmed = messages.slice(-CHAT_TRANSCRIPT_MAX_MESSAGES);
  return trimmed
    .map((m) => {
      const from = m && m.from === "me" ? "Me" : "Them";
      const text = String((m && m.text) || "")
        .trim()
        .slice(0, CHAT_TRANSCRIPT_MAX_CHARS_PER_MESSAGE);
      return text ? `${from}: ${text}` : null;
    })
    .filter(Boolean)
    .join("\n");
}

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
    // Undefined/missing means "not yet opted out" — treat as true so
    // accounts created before this feature existed default to opted-in,
    // same as brand-new ones.
    emailCheckinReminders: user.emailCheckinReminders !== false,
    emailWeeklyDigest: user.emailWeeklyDigest !== false,
    // Lifetime, Free-plan-only allowances — null on Pro/Premium (unlimited,
    // nothing to show). Missing/undefined counts as 0 for accounts created
    // before these fields existed.
    attachments: user.plan === "free" ? { used: user.lifetimeAttachmentCount || 0, limit: FREE_LIFETIME_ATTACHMENT_LIMIT } : null,
    practiceConversations:
      user.plan === "free" ? { used: user.lifetimePracticeConversations || 0, limit: FREE_LIFETIME_PRACTICE_CONVERSATIONS } : null,
    messageCoachUses:
      user.plan === "free" ? { used: user.lifetimeMessageCoachUses || 0, limit: FREE_LIFETIME_MESSAGE_COACH_USES } : null,
    isAdmin: (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .includes(user.email),
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

// Gates /api/admin/* — must already be authMiddleware'd (needs req.user).
// Deliberately simple: a comma-separated allowlist of emails in an env var,
// not a role stored in the db, so granting/revoking admin access is a
// Railway env change, not a data migration.
function adminMiddleware(req, res, next) {
  const allowed = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.includes(req.user.email)) {
    return res.status(403).json({ error: "Not authorized." });
  }
  next();
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

// Message Coach (paste a draft, or open a conversation and ask for a
// proposed reply) is a Free-plan lifetime allowance, separate from and much
// smaller than the daily AI-message pool above. This is the "send a
// screenshot of your argument, see what RelateIQ suggests" moment — the
// feature most likely to make someone want to keep using this, so Free
// gets a real taste of it before the upgrade prompt.
function isOverMessageCoachLifetimeLimit(user, res) {
  if (user.plan !== "free") return false;
  if ((user.lifetimeMessageCoachUses || 0) >= FREE_LIFETIME_MESSAGE_COACH_USES) {
    res.status(403).json({
      error: `You've used all ${FREE_LIFETIME_MESSAGE_COACH_USES} free Message Coach uses included in the Free plan. Upgrade to Pro for unlimited use.`,
      upgradeRequired: true,
    });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Referrals — invite a friend, both get a free month once they subscribe
// ---------------------------------------------------------------------------

function generateUniqueReferralCode(db) {
  let code;
  do {
    code = crypto.randomBytes(4).toString("hex");
  } while (db.users.some((u) => u.referralCode === code));
  return code;
}

// Ensures a Stripe customer exists for this user and applies a negative
// balance transaction to it — Stripe automatically applies a credit balance
// to the customer's *next* invoice, whether or not they have an active
// subscription yet, so this works even for a referrer who's still on Free.
async function creditOneMonth(db, targetUser, amountCents, description) {
  let customerId = targetUser.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: targetUser.email,
      name: targetUser.name,
      metadata: { userId: targetUser.id },
    });
    customerId = customer.id;
    targetUser.stripeCustomerId = customerId;
  }
  await stripe.customers.createBalanceTransaction(customerId, {
    amount: -Math.abs(amountCents),
    currency: "usd",
    description,
  });
}

// Called right after a user's checkout completes for the very first time
// (free -> paid). If they were referred, credits BOTH accounts one free
// month — valued at the price of the plan that was just subscribed to,
// since that's the plan action that actually triggered the reward. Never
// fires twice for the same referred user (referralRewardGranted guards it).
async function grantReferralRewardIfDue(db, user, priceId) {
  if (!stripe || !user.referredBy || user.referralRewardGranted) return;
  const referrer = db.users.find((u) => u.id === user.referredBy);
  if (!referrer) return;

  try {
    const price = await stripe.prices.retrieve(priceId);
    const amount = price?.unit_amount;
    if (!amount) return;

    await creditOneMonth(db, user, amount, "Thanks for joining through a RelateIQ invite — 1 month on us");
    await creditOneMonth(db, referrer, amount, "Thanks for inviting a friend to RelateIQ — 1 month on us");

    user.referralRewardGranted = true;
    writeDb(db);
  } catch (err) {
    console.error("Referral reward error:", err);
  }
}

// ---------------------------------------------------------------------------
// Check-in streak
// ---------------------------------------------------------------------------

function dateKeyFor(date) {
  return date.toISOString().slice(0, 10);
}

// Counts consecutive answered days up to today. If today isn't answered
// yet, counting starts from yesterday instead — so an in-progress streak
// doesn't visibly drop to 0 before the day is even over.
function computeCheckinStreak(checkins, userId) {
  const answeredDates = new Set(checkins.filter((c) => c.userId === userId && c.answer).map((c) => c.date));
  if (!answeredDates.size) return 0;

  const cursor = new Date();
  if (!answeredDates.has(dateKeyFor(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  let streak = 0;
  while (answeredDates.has(dateKeyFor(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

// ---------------------------------------------------------------------------
// Email unsubscribe links — a signed, scoped token (not a login token) so
// clicking it from an inbox can flip one preference off without a session.
// ---------------------------------------------------------------------------

function unsubscribeLink(user, kind) {
  const token = jwt.sign({ sub: user.id, scope: "email-unsub", kind }, JWT_SECRET, { expiresIn: "365d" });
  return `${APP_URL}/api/email/unsubscribe?token=${encodeURIComponent(token)}`;
}

// ---------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------

app.post("/api/auth/register", (req, res) => {
  try {
    const { email, password, name, referralCode } = req.body || {};
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

    let referrer = null;
    if (referralCode) {
      referrer = db.users.find((u) => u.referralCode === String(referralCode).trim().toLowerCase()) || null;
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
      referralCode: generateUniqueReferralCode(db),
      referredBy: referrer ? referrer.id : null,
      referralRewardGranted: false,
      emailCheckinReminders: true,
      emailWeeklyDigest: true,
      lifetimeAttachmentCount: 0,
      lifetimePracticeConversations: 0,
      lifetimeMessageCoachUses: 0,
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

app.post("/api/me/email-preferences", authMiddleware, (req, res) => {
  const db = req.db;
  const { checkinReminders, weeklyDigest } = req.body || {};
  if (checkinReminders !== undefined) req.user.emailCheckinReminders = !!checkinReminders;
  if (weeklyDigest !== undefined) req.user.emailWeeklyDigest = !!weeklyDigest;
  writeDb(db);
  res.json({
    emailCheckinReminders: req.user.emailCheckinReminders !== false,
    emailWeeklyDigest: req.user.emailWeeklyDigest !== false,
  });
});

// ---------------------------------------------------------------------------
// Referrals
// ---------------------------------------------------------------------------

app.get("/api/referrals", authMiddleware, (req, res) => {
  const db = req.db;
  // Backfills a code for accounts created before this feature existed.
  if (!req.user.referralCode) {
    req.user.referralCode = generateUniqueReferralCode(db);
    writeDb(db);
  }

  const referred = db.users.filter((u) => u.referredBy === req.user.id);
  res.json({
    code: req.user.referralCode,
    link: `${APP_URL}/register.html?ref=${req.user.referralCode}`,
    referredCount: referred.length,
    rewardedCount: referred.filter((u) => u.referralRewardGranted).length,
  });
});

// ---------------------------------------------------------------------------
// Push notifications — browser subscription management. Sending happens
// from the scheduled jobs below (sendPushToUser); these routes only manage
// the subscription record itself.
// ---------------------------------------------------------------------------

// Public: the frontend needs this to construct a PushManager.subscribe()
// call, before the visitor is necessarily logged in to anything sensitive.
app.get("/api/push/vapid-public-key", (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
});

app.post("/api/push/subscribe", authMiddleware, (req, res) => {
  const db = req.db;
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: "Invalid push subscription." });
  }

  const existingIdx = db.pushSubscriptions.findIndex(
    (s) => s.userId === req.user.id && s.subscription.endpoint === subscription.endpoint
  );
  const record = {
    id: existingIdx >= 0 ? db.pushSubscriptions[existingIdx].id : generateId("push"),
    userId: req.user.id,
    subscription,
    createdAt: new Date().toISOString(),
  };
  if (existingIdx >= 0) db.pushSubscriptions[existingIdx] = record;
  else db.pushSubscriptions.push(record);
  writeDb(db);
  res.json({ ok: true });
});

app.post("/api/push/unsubscribe", authMiddleware, (req, res) => {
  const db = req.db;
  const { endpoint } = req.body || {};
  db.pushSubscriptions = db.pushSubscriptions.filter(
    (s) => !(s.userId === req.user.id && (!endpoint || s.subscription.endpoint === endpoint))
  );
  writeDb(db);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin / growth stats — gated by adminMiddleware (ADMIN_EMAILS). Everything
// here is computed on the fly from the existing collections; nothing extra
// is tracked or stored just for this dashboard.
// ---------------------------------------------------------------------------

app.get("/api/admin/stats", authMiddleware, adminMiddleware, (req, res) => {
  const db = req.db;
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  const totalUsers = db.users.length;
  const newToday = db.users.filter((u) => (u.createdAt || "").slice(0, 10) === todayKey()).length;
  const newThisWeek = db.users.filter((u) => u.createdAt && now - new Date(u.createdAt).getTime() < 7 * DAY).length;

  const planCounts = { free: 0, pro: 0, premium: 0 };
  db.users.forEach((u) => {
    planCounts[u.plan] = (planCounts[u.plan] || 0) + 1;
  });
  const payingCount = (planCounts.pro || 0) + (planCounts.premium || 0);
  const conversionRate = totalUsers ? payingCount / totalUsers : 0;

  // "Active this week" = did something (sent a coach/practice message, or
  // checked in) in the last 7 days. The closest proxy to WAU this app has,
  // since there's no separate session/analytics tracking.
  const activeUserIds = new Set();
  db.conversations.forEach((c) => {
    const lastMsgAt = (c.messages || []).reduce((max, m) => {
      const t = m.at ? new Date(m.at).getTime() : 0;
      return t > max ? t : max;
    }, 0);
    if (lastMsgAt && now - lastMsgAt < 7 * DAY) activeUserIds.add(c.userId);
  });
  db.checkins.forEach((c) => {
    if (c.date && now - new Date(c.date).getTime() < 7 * DAY) activeUserIds.add(c.userId);
  });

  const referredTotal = db.users.filter((u) => u.referredBy).length;
  const referredRewarded = db.users.filter((u) => u.referralRewardGranted).length;

  const conversationsTotal = db.conversations.length;
  const coachConvos = db.conversations.filter((c) => c.mode !== "practice").length;
  const practiceConvos = conversationsTotal - coachConvos;

  const sharesTotal = db.shares.length;
  const shareItemsTotal = db.shares.reduce((sum, s) => sum + (s.items ? s.items.length : 0), 0);

  // Daily signups for the last 30 days, oldest first — feeds the chart.
  const signupsByDay = [];
  for (let i = 29; i >= 0; i--) {
    const key = new Date(now - i * DAY).toISOString().slice(0, 10);
    const count = db.users.filter((u) => (u.createdAt || "").slice(0, 10) === key).length;
    signupsByDay.push({ date: key, count });
  }

  res.json({
    totalUsers,
    newToday,
    newThisWeek,
    planCounts,
    payingCount,
    conversionRate,
    activeThisWeek: activeUserIds.size,
    referredTotal,
    referredRewarded,
    conversationsTotal,
    coachConvos,
    practiceConvos,
    sharesTotal,
    shareItemsTotal,
    pushSubCount: db.pushSubscriptions.length,
    signupsByDay,
  });
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

    if (req.user.plan === "free" && (req.user.lifetimePracticeConversations || 0) >= FREE_LIFETIME_PRACTICE_CONVERSATIONS) {
      return res.status(403).json({
        error: `The Free plan includes ${FREE_LIFETIME_PRACTICE_CONVERSATIONS} Partner Practice rehearsal${FREE_LIFETIME_PRACTICE_CONVERSATIONS === 1 ? "" : "s"} to try it out. Upgrade to Pro for unlimited Partner Practice.`,
        upgradeRequired: true,
      });
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
  if (isPractice && req.user.plan === "free") {
    req.user.lifetimePracticeConversations = (req.user.lifetimePracticeConversations || 0) + 1;
  }
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

  if (hasAttachments && user.plan === "free") {
    const usedSoFar = user.lifetimeAttachmentCount || 0;
    if (usedSoFar + rawAttachments.length > FREE_LIFETIME_ATTACHMENT_LIMIT) {
      const remaining = Math.max(0, FREE_LIFETIME_ATTACHMENT_LIMIT - usedSoFar);
      return res.status(403).json({
        error:
          remaining > 0
            ? `The Free plan includes ${FREE_LIFETIME_ATTACHMENT_LIMIT} file/photo attachments total, and you have ${remaining} left — try attaching fewer files, or upgrade to Pro for unlimited attachments.`
            : `You've used all ${FREE_LIFETIME_ATTACHMENT_LIMIT} file/photo attachments included in the Free plan. Upgrade to Pro for unlimited attachments.`,
        upgradeRequired: true,
      });
    }
  }

  let savedAttachments;
  try {
    savedAttachments = saveIncomingAttachments(user, rawAttachments);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message || "Couldn't process the attached file(s)." });
  }

  if (hasAttachments && user.plan === "free") {
    user.lifetimeAttachmentCount = (user.lifetimeAttachmentCount || 0) + savedAttachments.length;
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
      model: modelForPlan(user.plan),
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

    const { patterns, note } = await generateInsightsRaw(coachConversations);
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

// Bare OpenAI call for the insights feature, with no caching or usage-limit
// logic of its own — both the /api/insights route (user-triggered, gated by
// isOverDailyLimit) and the weekly digest cron job (background, its own
// staleness check) call this and layer their own caching on top.
async function generateInsightsRaw(coachConversations) {
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
  return {
    patterns: Array.isArray(parsed.patterns) ? parsed.patterns.slice(0, 4) : [],
    note: String(parsed.note || "").trim(),
  };
}

// Used by the weekly digest job only: reuses cached insights if they were
// generated within the last 6 days, otherwise generates fresh ones. Doesn't
// touch user.usage — a background digest shouldn't eat into someone's daily
// AI-message limit the way an action they took themselves would.
async function generateInsightsForDigest(db, user, coachConversations) {
  if (user.insights && user.insightsAt) {
    const ageMs = Date.now() - new Date(user.insightsAt).getTime();
    if (ageMs < 6 * 24 * 60 * 60 * 1000) {
      return { patterns: user.insights.patterns, note: user.insights.note };
    }
  }

  const { patterns, note } = await generateInsightsRaw(coachConversations);
  user.insights = { patterns, note };
  user.insightsAt = new Date().toISOString();
  writeDb(db);
  return { patterns, note };
}

// ---------------------------------------------------------------------------
// Message Coach — one-off rewrite tool, not tied to a saved conversation
// ---------------------------------------------------------------------------

app.post("/api/message-coach", authMiddleware, async (req, res) => {
  try {
    const { draft, context, messages } = req.body || {};
    const trimmedDraft = String(draft || "").trim();
    const transcript = buildChatTranscript(messages);

    // Either a draft to rewrite, or a chat transcript to propose a reply
    // from, is required — both empty means there's nothing to work with.
    if (!trimmedDraft && !transcript) {
      return res.status(400).json({ error: "Paste a message, or open a conversation with a few messages in it, to get feedback." });
    }

    const db = req.db;
    const user = db.users.find((u) => u.id === req.user.id);
    if (isOverDailyLimit(user, res)) return;
    if (isOverMessageCoachLifetimeLimit(user, res)) return;

    const contextBlock = [String(context || "").trim(), transcript].filter(Boolean).join("\n\n") || "(none given)";
    const userContent = trimmedDraft
      ? `Context (optional, may be empty):\n${contextBlock}\n\nDraft message:\n"""${trimmedDraft}"""`
      : `No draft was written yet. Propose a reply based on this conversation so far:\n${contextBlock}`;

    const completion = await openai.chat.completions.create({
      model: modelForPlan(user.plan),
      messages: [
        { role: "system", content: MESSAGE_COACH_SYSTEM_PROMPT },
        { role: "user", content: userContent },
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

    if (user.plan === "free") {
      user.usage.count += 1;
      user.lifetimeMessageCoachUses = (user.lifetimeMessageCoachUses || 0) + 1;
    }
    writeDb(db);

    res.json({ rewrite, why, usage: user.usage });
  } catch (err) {
    console.error("Message coach error:", err.message);
    res.status(500).json({ error: "Couldn't get feedback right now. Please try again." });
  }
});

// Powers the browser extension's automatic "smart reply" chips: given the
// last few messages of a WhatsApp/Messenger/Instagram conversation, returns
// 2-3 short, distinct reply options the user can tap to insert (never
// auto-sent). Deliberately its own endpoint rather than a mode of
// /api/message-coach above, since it always returns several short options
// instead of one full rewrite. Shares the same free-plan daily cap —
// counted as ordinary AI usage, same as any other coaching call.
app.post("/api/message-coach/suggestions", authMiddleware, async (req, res) => {
  try {
    const { messages } = req.body || {};
    const transcript = buildChatTranscript(messages);
    if (!transcript) {
      return res.status(400).json({ error: "No conversation messages were given to suggest a reply from." });
    }

    const db = req.db;
    const user = db.users.find((u) => u.id === req.user.id);
    if (isOverDailyLimit(user, res)) return;

    const completion = await openai.chat.completions.create({
      model: modelForPlan(user.plan),
      messages: [
        { role: "system", content: CHAT_SUGGEST_SYSTEM_PROMPT },
        { role: "user", content: `Conversation so far:\n${transcript}` },
      ],
      temperature: 0.85,
      response_format: { type: "json_object" },
    });

    let parsed = {};
    try {
      parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    } catch (err) {
      parsed = {};
    }
    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.map((s) => String(s || "").trim()).filter(Boolean).slice(0, 3)
      : [];

    if (!suggestions.length) {
      return res.status(500).json({ error: "Couldn't come up with suggestions right now. Please try again." });
    }

    if (user.plan === "free") user.usage.count += 1;
    writeDb(db);

    res.json({ suggestions, usage: user.usage });
  } catch (err) {
    console.error("Chat suggestions error:", err.message);
    res.status(500).json({ error: "Couldn't get suggestions right now. Please try again." });
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
  const streak = computeCheckinStreak(req.db.checkins, req.user.id);

  if (existing) {
    return res.json({
      date: today,
      question: existing.question || question,
      answered: !!existing.answer,
      skipped: !!existing.skipped,
      answer: existing.answer || null,
      streak,
    });
  }

  res.json({ date: today, question, answered: false, skipped: false, answer: null, streak });
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

// ---------------------------------------------------------------------------
// Email unsubscribe — reached straight from an inbox, so no login required.
// The token is scope-limited (see unsubscribeLink above) and only ever
// flips one preference off for the one user it was signed for.
// ---------------------------------------------------------------------------

app.get("/api/email/unsubscribe", (req, res) => {
  const rawToken = req.query.token;
  try {
    const payload = jwt.verify(String(rawToken || ""), JWT_SECRET);
    if (payload.scope !== "email-unsub") throw new Error("wrong token scope");

    const db = readDb();
    const user = db.users.find((u) => u.id === payload.sub);
    if (user) {
      if (payload.kind === "digest") user.emailWeeklyDigest = false;
      else user.emailCheckinReminders = false;
      writeDb(db);
    }

    res.send(`<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif; background:#17130f; color:#f6efe4; padding:60px 20px; text-align:center;">
  <h2 style="font-family:Georgia,serif;">You're unsubscribed</h2>
  <p style="color:#b6a795;">You won't get this email again. You can turn it back on anytime from your RelateIQ account page.</p>
</body></html>`);
  } catch (err) {
    res.status(400).send("This unsubscribe link is invalid or has expired.");
  }
});

// ---------------------------------------------------------------------------
// Scheduled emails — daily check-in reminder, weekly insights digest. No
// external cron needed: this always-on web service just checks every 15
// minutes whether it's time to run today's/this week's job, using a marker
// persisted in the db so a redeploy/restart never causes a duplicate send
// within the same day.
// ---------------------------------------------------------------------------

const DAILY_REMINDER_HOUR_UTC = 17;
const WEEKLY_DIGEST_DAY_UTC = 1; // Monday (0 = Sunday)
const WEEKLY_DIGEST_HOUR_UTC = 9;

// Sends a browser push to every subscription this user has (usually one,
// but a person can subscribe from more than one browser/device). A 404/410
// from the push service means that browser has permanently invalidated the
// subscription (uninstalled, cleared site data, etc.) — those get pruned;
// anything else is just logged, since one bad subscription shouldn't stop
// the rest of the batch.
async function sendPushToUser(db, userId, { title, body, url }) {
  if (!pushConfigured) return;
  const subs = db.pushSubscriptions.filter((s) => s.userId === userId);
  if (!subs.length) return;

  const payload = JSON.stringify({ title, body, url: url || "/dashboard.html" });
  let changed = false;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub.subscription, payload);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        db.pushSubscriptions = db.pushSubscriptions.filter((s) => s.id !== sub.id);
        changed = true;
      } else {
        console.error("Push send error:", err.message);
      }
    }
  }

  if (changed) writeDb(db);
}

async function runDailyCheckinReminders() {
  const db = readDb();
  const today = todayKey();
  const question = checkinQuestionForDate(today);

  // Anyone who hasn't checked in today is a candidate — email and push are
  // independent channels, each only sent if that user is actually opted
  // into (or, for push, subscribed to) it.
  const notYetCheckedIn = db.users.filter((u) => !db.checkins.some((c) => c.userId === u.id && c.date === today));

  for (const user of notYetCheckedIn) {
    if (user.email && user.emailCheckinReminders !== false) {
      const html = emailShell({
        unsubscribeUrl: unsubscribeLink(user, "checkin"),
        bodyHtml: `
          <p>Hey ${escapeForEmail(user.name)},</p>
          <p>Today's check-in question:</p>
          <p style="font-style:italic; color:#d1a05a;">"${escapeForEmail(question)}"</p>
          <p><a href="${APP_URL}/dashboard.html" style="display:inline-block; margin-top:8px; background:linear-gradient(135deg,#d1a05a,#a8455c); color:#1a1410; text-decoration:none; padding:10px 20px; border-radius:100px; font-weight:600;">Answer it →</a></p>
        `,
      });
      await sendEmail({ to: user.email, subject: "Today's RelateIQ check-in", html });
    }

    await sendPushToUser(db, user.id, {
      title: "Today's RelateIQ check-in",
      body: question,
      url: "/dashboard.html",
    });
  }
}

async function runWeeklyInsightsDigest() {
  const db = readDb();
  // The automated weekly digest (email and/or push) is a Pro+ perk — Free
  // users can still generate Insights manually in-app once they have
  // enough conversations, but RelateIQ coming to them proactively every
  // week is part of what upgrading buys. A user is a candidate if they're
  // on a paid plan AND either delivery channel is live for them — email
  // opt-in or an active push subscription — since the two are independent
  // below.
  const candidates = db.users.filter(
    (u) =>
      u.plan !== "free" &&
      ((u.email && u.emailWeeklyDigest !== false) || db.pushSubscriptions.some((s) => s.userId === u.id))
  );

  for (const user of candidates) {
    const coachConversations = db.conversations
      .filter(
        (c) => c.userId === user.id && c.mode !== "practice" && (c.messages || []).some((m) => m.role === "user")
      )
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (coachConversations.length < INSIGHTS_MIN_CONVERSATIONS) continue;

    try {
      const { patterns } = await generateInsightsForDigest(db, user, coachConversations);
      if (!patterns.length) continue;

      if (user.email && user.emailWeeklyDigest !== false) {
        const itemsHtml = patterns
          .map(
            (p) =>
              `<p style="margin:0 0 12px;"><strong style="color:#f6efe4;">${escapeForEmail(p.title)}</strong><br/><span style="color:#b6a795;">${escapeForEmail(p.description)}</span></p>`
          )
          .join("");

        const html = emailShell({
          unsubscribeUrl: unsubscribeLink(user, "digest"),
          bodyHtml: `
            <p>Hey ${escapeForEmail(user.name)},</p>
            <p>Here's what RelateIQ noticed across your conversations this week:</p>
            ${itemsHtml}
            <p><a href="${APP_URL}/insights.html" style="display:inline-block; margin-top:8px; background:linear-gradient(135deg,#d1a05a,#a8455c); color:#1a1410; text-decoration:none; padding:10px 20px; border-radius:100px; font-weight:600;">See full insights →</a></p>
          `,
        });
        await sendEmail({ to: user.email, subject: "Your weekly RelateIQ insights", html });
      }

      await sendPushToUser(db, user.id, {
        title: "Your weekly RelateIQ insights",
        body: patterns[0]?.title || "New patterns spotted across your conversations this week.",
        url: "/insights.html",
      });
    } catch (err) {
      console.error(`Weekly digest failed for user ${user.id}:`, err.message);
    }
  }
}

function emailJobsDueCheck() {
  const db = readDb();
  const now = new Date();
  const today = todayKey();

  if (now.getUTCHours() >= DAILY_REMINDER_HOUR_UTC && db.emailJobs.lastDailyReminder !== today) {
    db.emailJobs.lastDailyReminder = today;
    writeDb(db);
    runDailyCheckinReminders().catch((err) => console.error("Daily reminder job failed:", err));
  }

  if (
    now.getUTCDay() === WEEKLY_DIGEST_DAY_UTC &&
    now.getUTCHours() >= WEEKLY_DIGEST_HOUR_UTC &&
    db.emailJobs.lastWeeklyDigest !== today
  ) {
    db.emailJobs.lastWeeklyDigest = today;
    writeDb(db);
    runWeeklyInsightsDigest().catch((err) => console.error("Weekly digest job failed:", err));
  }
}

setInterval(emailJobsDueCheck, 15 * 60 * 1000);

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
