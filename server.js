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
import {
  loadDb,
  generateId,
  getUserById,
  getUserByEmail,
  getUserByStripeCustomerId,
  getUserByReferralCode,
  saveUser,
  deleteUserCascade,
  incrementUserUsage,
  incrementUserMonthlyUsage,
  incrementUserPremiumUsage,
  incrementUserCoachStrongUsage,
  setConversationQuality,
  backupDatabaseTo,
  getDatabaseFilePath,
  incrementUserColumn,
  saveConversation,
  deleteConversation,
  appendConversationMessages,
  setMessageFeedback,
  truncateLastMessagePairIfMatch,
  removeLastMessageIfMatch,
  savePartnerProfile,
  deletePartnerProfile,
  saveCheckin,
  saveShare,
  deleteShare,
  getShareByToken,
  saveSoloAnswer,
  saveSoloAnswerIfAbsent,
  savePushSubscription,
  deletePushSubscription,
  deletePushSubscriptionsForUser,
  getPushSubscriptionsForUser,
  getEmailJobs,
  setEmailJobField,
  createExperiment,
  getExperiment,
  listExperimentsForUser,
  getExperimentByMessage,
  countActiveExperiments,
  resolveExperiment,
  deleteExperiment,
  getDueExperimentReminders,
  markExperimentReminded,
  saveDoc,
  getDoc,
  getDocByKey,
  listDocs,
  getDueDocsByFollowUp,
  deleteDoc,
  listConversationsForUser,
  setUserMemoryColumns,
} from "./lib/store.js";
import * as Mem from "./lib/memory.js";
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
// Env values pasted into a dashboard often pick up stray whitespace, quotes or a
// literal "\n"; Stripe ids never contain those, so strip them.
const cleanEnvId = (v) => (v ? String(v).replace(/\\n|\\r/g, "").replace(/^[\s"']+|[\s"']+$/g, "") : v);
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(cleanEnvId(process.env.STRIPE_SECRET_KEY)) : null;
const APP_URL = (process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, "");
const PLAN_TO_STRIPE_PRICE = { pro: cleanEnvId(process.env.STRIPE_PRICE_PRO), premium: cleanEnvId(process.env.STRIPE_PRICE_PREMIUM) };
// Optional yearly prices (a second Stripe price per plan). Without them,
// "yearly" checkouts are refused rather than silently billing monthly.
const PLAN_TO_STRIPE_PRICE_YEARLY = { pro: cleanEnvId(process.env.STRIPE_PRICE_PRO_YEARLY), premium: cleanEnvId(process.env.STRIPE_PRICE_PREMIUM_YEARLY) };
const STRIPE_PRICE_TO_PLAN = {};
for (const map of [PLAN_TO_STRIPE_PRICE, PLAN_TO_STRIPE_PRICE_YEARLY]) {
  for (const [plan, priceId] of Object.entries(map)) {
    if (priceId) STRIPE_PRICE_TO_PLAN[priceId] = plan;
  }
}

// Locked down to the app's own origin(s) instead of wide-open cors() — the
// web app's own pages call this API same-origin anyway (same Express app
// serves both), so this only blocks OTHER sites' pages from calling it with
// a visitor's cookies/token. It does NOT affect the browser extension: that
// calls the API from its background service worker, which bypasses CORS
// entirely via the "host_permissions" entry in manifest.json, not via an
// Origin header check. Requests with no Origin header at all (curl, server-
// to-server, Stripe, the extension) are always allowed through.
const KNOWN_APP_ORIGINS = new Set(
  [APP_URL, "https://terrific-spirit-production.up.railway.app", "http://localhost:3000", "http://127.0.0.1:3000"].filter(Boolean)
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || KNOWN_APP_ORIGINS.has(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
  })
);

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
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.client_reference_id || session.metadata?.userId;
      const user = getUserById(userId);
      if (user && session.subscription) {
        const wasFree = user.plan === "free" || !user.plan;
        user.stripeCustomerId = session.customer;
        user.stripeSubscriptionId = session.subscription;
        user.subscriptionStatus = "active";
        if (session.metadata?.plan) user.plan = session.metadata.plan;
        saveUser(user);

        // First time this user has ever converted to paid — this is the
        // one moment a referral reward can fire, so it can't be triggered
        // more than once per referred user.
        if (wasFree && session.metadata?.plan) {
          const priceId = PLAN_TO_STRIPE_PRICE[session.metadata.plan];
          if (priceId) await grantReferralRewardIfDue(user, priceId);
        }
      }
    } else if (event.type === "customer.subscription.updated") {
      const sub = event.data.object;
      const user = getUserByStripeCustomerId(sub.customer);
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
        saveUser(user);
      }
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const user = getUserByStripeCustomerId(sub.customer);
      if (user) {
        user.plan = "free";
        user.subscriptionStatus = "canceled";
        user.stripeSubscriptionId = null;
        saveUser(user);
      }
    }
  } catch (err) {
    console.error("Stripe webhook handling error:", err);
  }

  res.json({ received: true });
});

// Raised from the default 100kb so chat messages can carry image/file
// attachments (sent as base64 data URLs) — see the attachment limits below.
app.disable("x-powered-by");
// Basic hardening headers for every response (no CSP: the pages use inline scripts and styles).
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), geolocation=()");
  if (req.secure || req.headers["x-forwarded-proto"] === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  next();
});
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

// Railway (and any real host) injects RAILWAY_ENVIRONMENT/RAILWAY_PROJECT_ID
// into every deployment automatically — their presence is what tells us
// "this is a real, hosted instance," since NODE_ENV is never set explicitly
// anywhere in this project. If we're hosted and JWT_SECRET was left unset,
// refuse to start rather than silently signing every login with a secret
// that's sitting in plain text in this public-ish repo — anyone who read it
// could forge a valid token for any user id. Local dev (`node server.js`
// with no env vars) still starts fine, with the warning below.
const IS_HOSTED = !!(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
if (IS_HOSTED && !process.env.JWT_SECRET) {
  console.error(
    "FATAL: JWT_SECRET is not set on this hosted deployment. Refusing to start with the insecure default " +
      "secret, set JWT_SECRET to a long random string in your Railway service variables and redeploy."
  );
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me-in-production";
const FREE_DAILY_LIMIT = 8;

// Fair-use monthly caps for the paid plans. Pro/Premium have no DAILY cap,
// but "unlimited" with a per-message OpenAI cost is an open-ended liability
// (one script hammering the API from a €9.99 account could cost far more
// than the subscription). These are generous — a normal heavy user is
// nowhere near them — and tunable from Railway env vars without a deploy.
const PRO_MONTHLY_LIMIT = Number(process.env.PRO_MONTHLY_AI_LIMIT) || 1000;
const PREMIUM_MONTHLY_LIMIT = Number(process.env.PREMIUM_MONTHLY_AI_LIMIT) || 1500;
function monthlyLimitFor(plan) {
  if (plan === "pro") return PRO_MONTHLY_LIMIT;
  if (plan === "premium") return PREMIUM_MONTHLY_LIMIT;
  return null;
}
function monthKey() {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM" (UTC)
}

// Email verification is only ENFORCED when email can actually be delivered
// (RESEND_API_KEY set) — otherwise nobody could ever receive the link and
// every new signup would be locked out of the AI. Set
// REQUIRE_EMAIL_VERIFICATION=false to switch enforcement off explicitly.
function isEmailVerificationEnforced() {
  return !!process.env.RESEND_API_KEY && process.env.REQUIRE_EMAIL_VERIFICATION !== "false";
}

// Free-plan limits BEYOND the shared daily AI-message pool above. Coach
// Chat (the everyday "come back and talk it through" habit loop) stays
// generous — that's what gets people using this enough to tell a friend.
// The scarce resources on Free are the higher-"wow", more shareable
// moments: attaching an actual screenshot of a conversation with your
// partner for RelationshipAI to read, and a full Partner Practice rehearsal —
// these are lifetime counts (not daily), so a Free account gets a real
// taste of each before hitting the upgrade prompt. Deliberately not set to
// "1 and never again" this early — a brand-new product still needs people
// to experience enough value to want to come back and tell someone else;
// tighten these once there's real signal on where people drop off vs.
// convert.
const FREE_LIFETIME_ATTACHMENT_LIMIT = 3; // files/photos a Free account can ever attach, combined across all conversations
const FREE_PRACTICE_MAX_USER_MESSAGES = 8; // user messages in a Free account's one rehearsal; then it closes
const FREE_LIFETIME_EXPORT_LIMIT = 1; // therapist-summary exports a Free account can generate in total
const FREE_LIFETIME_PRACTICE_CONVERSATIONS = 1; // Partner Practice rehearsals a Free account can start

// Partner profiles (Practice mode) allowed per plan — omit a plan here (e.g.
// "premium") to leave it unlimited.
const PARTNER_PROFILE_LIMITS = { free: 1, pro: 5 };

// Attachments (images, screen recordings, other files) on chat messages —
// how many a single message can carry, by plan. Omit a plan here to fall
// back to the free limit, same convention as PARTNER_PROFILE_LIMITS above.
const MAX_FILES_PER_MESSAGE_BY_PLAN = { free: 3, pro: 10, premium: 10 };
const MAX_TOTAL_UPLOAD_MB = 15;
const MAX_TOTAL_UPLOAD_BYTES = MAX_TOTAL_UPLOAD_MB * 1024 * 1024;

// A generous safety ceiling on a single chat message, not a real-world
// limit — no genuine message anyone types is anywhere near this long. It
// exists purely so a scripted/compromised account (on ANY plan — Pro and
// Premium have no daily cap by design) can't send a multi-megabyte payload
// straight into the model on every request and run up the OpenAI bill.
const MAX_CHAT_MESSAGE_CHARS = 8000;


// Premium's headline differentiator: Coach Chat calls a noticeably stronger
// model for Premium subscribers — real, felt quality (more specific, more
// nuanced replies), not just a bigger usage cap. Free and Pro share the
// fast/inexpensive model on that surface. Insights and the therapist
// summary stay on the fast model regardless of plan — they're
// extraction/summarization tasks, not the "hear me out and respond" moment
// where model quality is actually noticeable, and keeping them off the
// pricier model keeps the cost of those unlimited-on-Pro+ features
// predictable.
// TEMPORARY ROLLBACK (RelateIQ42): briefly bumped to the GPT-6 line
// (gpt-6-luna / gpt-6-astra), but Jonas's OpenAI account doesn't have
// access to those models yet — every AI call was failing in production
// ("Couldn't get a response from the AI"). Reverted to the known-working
// gpt-4o family until access is confirmed; see the reasoning_effort comment
// below for the other half of this rollback (that parameter isn't
// supported on gpt-4o either).
// Model update: the account now has the newer models. The two main ones are
// reasoning models (no temperature, max_completion_tokens instead of
// max_tokens), which the openai wrapper below handles centrally, and any
// failure on a new model is retried once on its gpt-4o equivalent, so a model
// problem degrades quality instead of breaking the app (the reason of the earlier rollback).
const STANDARD_MODEL = "gpt-6-luna";
const PREMIUM_MODEL = "gpt-6.1-sol";
// Tiny utility calls (chat titles) stay on the small
// non-reasoning model: fast, cheap and they rely on tight token limits.
const UTILITY_MODEL = "gpt-4o-mini";
const LEGACY_FALLBACK = { "gpt-6-luna": "gpt-4o-mini", "gpt-6.1-sol": "gpt-4o", "gpt-6-astra": "gpt-4o", "gpt-6-sol": "gpt-4o", "gpt-5.5": "gpt-4o" };
const REASONING_MODEL_RE = /^(gpt-5|gpt-6|o\d)/;
function modelForPlan(plan) {
  return plan === "premium" ? PREMIUM_MODEL : STANDARD_MODEL;
}

// Partner Practice is the one surface where this splits differently: it's
// the app's flagship, most-differentiated feature (realistic, personalized
// roleplay), so the model quality bar for it is higher across the board —
// Pro gets the strong model here too, not just Premium. Free stays on the
// fast model, which is a small, deliberate exception rather than an
// oversight: Free gets exactly one lifetime rehearsal (see
// FREE_LIFETIME_PRACTICE_CONVERSATIONS below) to try the feature, so the
// cost of upgrading that single try is negligible either way, and it's
// still a meaningful reason to upgrade off Free. Premium's edge over Pro
// stays in Coach Chat and unlimited partner profiles (see
// PARTNER_PROFILE_LIMITS) — Practice itself is just "good" starting at Pro.
function modelForPractice(plan) {
  return plan === "free" ? STANDARD_MODEL : PREMIUM_MODEL;
}

// Cost guard for the strong model (gpt-6.1-sol costs roughly 10-20x the fast one
// per message). Every paid plan gets a monthly BUDGET of messages on the strong
// model; once it's used up, the same features keep working on the fast model
// until the month resets — nobody is ever cut off, but a heavy user can no
// longer cost more than their subscription brings in. Sized from measured
// prompt sizes (see README "Pricing & costs"); tunable from Railway env vars.
const PREMIUM_MODEL_BUDGET = {
  pro: Number(process.env.PRO_STRONG_MODEL_BUDGET) || 200, // Partner Practice only
  premium: Number(process.env.PREMIUM_STRONG_MODEL_BUDGET) || 500,
};
// Pro only: a small separate allowance of strong-model Coach Chat messages
// (a taste of Premium; Practice has its own, bigger budget above).
const PRO_COACH_STRONG_BUDGET = Number(process.env.PRO_COACH_STRONG_BUDGET) || 80;
function coachStrongUsed(user) {
  return user.usageCoachStrong && user.usageCoachStrong.month === monthKey() ? user.usageCoachStrong.count : 0;
}
function strongModelUsed(user) {
  return user.usagePremium && user.usagePremium.month === monthKey() ? user.usagePremium.count : 0;
}
function strongModelBudgetFor(plan) {
  return PREMIUM_MODEL_BUDGET[plan] || 0;
}
// The strong model while the user still has budget this month, else the fast one.
function strongModelFor(user) {
  return strongModelUsed(user) < strongModelBudgetFor(user.plan) ? PREMIUM_MODEL : STANDARD_MODEL;
}
// Coach / Message check / After a fight / ideas: strong model is a Premium perk.
function budgetedModelForPlan(user) {
  if (user.plan === "premium") return strongModelFor(user);
  if (user.plan === "pro") return coachStrongUsed(user) < PRO_COACH_STRONG_BUDGET ? PREMIUM_MODEL : STANDARD_MODEL;
  return STANDARD_MODEL;
}
function budgetedModelForPractice(user) {
  return user.plan === "free" ? STANDARD_MODEL : strongModelFor(user);
}
// Who may pick "Advanced" for a chat: every paid plan (each with its own
// monthly budget; Free is always Fast).
function canChooseAdvanced(user) {
  return user.plan === "premium" || user.plan === "pro";
}
// The model for one chat reply: the user's per-chat choice ("fast" always
// wins; "advanced"/unset = the strong model while there's budget left).
function chatModelFor(user, conv, isPractice) {
  if (conv.quality === "fast") return STANDARD_MODEL;
  return isPractice ? budgetedModelForPractice(user) : budgetedModelForPlan(user);
}
// Defaults to public/uploads for local dev. On a host with a persistent
// volume (so uploaded files survive a redeploy), set UPLOADS_DIR to a path
// inside that volume — the /uploads route below serves straight from here
// regardless, so the URLs the app hands out never change.
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, "public", "uploads");

// Chat attachments used to be served by a plain express.static mount here —
// anyone with the URL (/uploads/<userId>/<filename>, only mildly obscured
// by a random id prefix on the filename) could load someone else's photo or
// file with no authentication at all. Fixed by requiring a short-lived,
// file-scoped signed token on every request instead: signAttachmentUrl
// mints one fresh every time an attachment's url is sent to a client (see
// its call sites below), so a link only works for ~15 minutes and only for
// the exact file it was issued for — a leaked chat screenshot or an old
// browser tab can't be used to fetch the file later.
function signAttachmentUrl(rawUrl) {
  const match = /^\/uploads\/([^/]+)\/([^/]+)$/.exec(String(rawUrl || ""));
  if (!match) return rawUrl;
  const [, userId, filename] = match;
  const token = jwt.sign({ scope: "upload-access", userId, filename }, JWT_SECRET, { expiresIn: "15m" });
  return `${rawUrl}?token=${encodeURIComponent(token)}`;
}

// Re-signs every attachment url on every message in a conversation, right
// before that conversation is handed to a client — used by both the
// message-send response and GET /api/conversations/:id, the two places a
// conversation's attachments reach the frontend. Never mutates its input.
function signAttachmentsInMessages(messages) {
  return (messages || []).map((m) =>
    m && m.attachments && m.attachments.length
      ? { ...m, attachments: m.attachments.map((a) => (a && a.url ? { ...a, url: signAttachmentUrl(a.url) } : a)) }
      : m
  );
}

// Extension -> Content-Type for serving an attachment back out. Doesn't need
// to be exhaustive — just the kinds saveIncomingAttachments actually deals
// with (images, screen recordings, the small text-like files read as
// context) — anything else falls back to a generic binary type, which is
// fine since the browser only ever fetches these urls straight from an
// <img>/<a> tag the server itself generated (see renderAttachments in
// chat.js), not from a context where the exact type matters.
const UPLOAD_CONTENT_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".csv": "text/csv",
  ".json": "application/json",
  ".log": "text/plain",
};

app.get("/uploads/:userId/:filename", (req, res) => {
  let payload;
  try {
    payload = jwt.verify(String(req.query.token || ""), JWT_SECRET);
  } catch (err) {
    return res.status(403).json({ error: "This file link is invalid or has expired." });
  }
  if (payload.scope !== "upload-access" || payload.userId !== req.params.userId || payload.filename !== req.params.filename) {
    return res.status(403).json({ error: "This file link is invalid or has expired." });
  }

  const resolved = path.resolve(path.join(UPLOADS_DIR, req.params.userId, req.params.filename));
  const uploadsRoot = path.resolve(UPLOADS_DIR);
  if (!resolved.startsWith(uploadsRoot + path.sep)) {
    return res.status(400).json({ error: "Invalid file path." });
  }

  let buffer;
  try {
    buffer = fs.readFileSync(resolved);
  } catch (err) {
    return res.status(404).json({ error: "File not found." });
  }

  const contentType = UPLOAD_CONTENT_TYPES[path.extname(resolved).toLowerCase()] || "application/octet-stream";
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "no-store");
  res.end(buffer);
});
const TEXT_LIKE_EXTENSIONS = [".txt", ".md", ".markdown", ".csv", ".log", ".json"];

if (!process.env.OPENAI_API_KEY) {
  console.warn("⚠️  OPENAI_API_KEY is not set in .env, chat will not work.");
}
if (!process.env.JWT_SECRET) {
  console.warn("⚠️  JWT_SECRET is not set in .env, set your own random string before deploying to production.");
}
if (!process.env.DB_PATH) {
  console.warn(
    "⚠️  DB_PATH is not set, data/relateiq.sqlite is being stored inside the app's own container filesystem. " +
      "On Railway this does NOT survive a redeploy unless you've mounted a persistent Volume and pointed " +
      "DB_PATH at a file inside it. See README for setup."
  );
}
if (!process.env.RESEND_API_KEY) {
  console.warn("⚠️  RESEND_API_KEY is not set, check-in reminder and weekly digest emails will not be sent.");
}
if (!process.env.ADMIN_EMAILS) {
  console.warn("⚠️  ADMIN_EMAILS is not set, the /admin.html growth dashboard will refuse everyone.");
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
  console.warn("⚠️  VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY are not set, browser push notifications will not be sent.");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Copy that reads as written by a person: models love em/en dashes, and they
// make replies feel machine-made. Every completion passes through this, so
// whatever the model writes (chat replies, titles, summaries, JSON fields)
// reaches the user with natural punctuation instead.
function softenDashes(text) {
  if (typeof text !== "string" || !/[\u2014\u2013]/.test(text)) return text;
  return text
    .replace(/(\d)\s*\u2013\s*(\d)/g, "$1-$2") // 5–10 -> 5-10
    .replace(/^[ \t]*[\u2014\u2013][ \t]*/gm, "") // dialogue/bullet dash at line start
    .replace(/[ \t]*[\u2014\u2013][ \t]*/g, ", ") // clause dash -> comma
    .replace(/,\s*,/g, ",")
    .replace(/,\s*([.!?])/g, "$1");
}
{
  const completions = openai.chat.completions;
  const create = completions.create.bind(completions);
  completions.create = async (...args) => {
    let res;
    const first = args[0] || {};
    if (REASONING_MODEL_RE.test(String(first.model || ""))) {
      // Reasoning models reject temperature / max_tokens.
      const p = { ...first };
      delete p.temperature;
      // "low" keeps replies in about 2 to 5 seconds with no visible loss of quality (tested on live).
      if (!p.reasoning_effort) p.reasoning_effort = "low";
      if (p.max_tokens != null) {
        p.max_completion_tokens = p.max_tokens;
        delete p.max_tokens;
      }
      try {
        res = await create(p, ...args.slice(1));
      } catch (err) {
        const legacy = LEGACY_FALLBACK[first.model];
        console.error(`OpenAI call on ${first.model} failed (${String(err.message || err).slice(0, 160)}), retrying on ${legacy || "gpt-4o"}`);
        res = await create({ ...first, model: legacy || "gpt-4o" }, ...args.slice(1));
      }
    } else {
      res = await create(...args);
    }
    for (const c of res?.choices || []) {
      if (c?.message && typeof c.message.content === "string") c.message.content = softenDashes(c.message.content);
    }
    return res;
  };
}

// ---------------------------------------------------------------------------
// prompts
// ---------------------------------------------------------------------------

const COACH_SYSTEM_PROMPT = `You are RelationshipAI, a relationship coach. Work the way a skilled, warm couples therapist would over a course of sessions, adapted to a text chat. You know how relationships actually work and you know the main schools of couples therapy (see APPROACHES YOU KNOW), and you use that knowledge to help this person with their real situation, not only with the one incident they happened to type. You are not a friend who agrees with everything, not a lawyer and not a judge. You are on the side of the relationship and of the person's growth, not on the side of being right. You hear only one side of the story, so treat what they tell you as their experience of it, and keep the absent partner in mind as a real person with their own feelings and reasons. You do not replace therapy, you help as well as you can inside a chat.

THE MOST IMPORTANT RULE: UNDERSTAND FIRST, ADVISE WHEN YOU HAVE ENOUGH
A good therapist does not hand out advice after the first sentence. The incident someone describes is usually the surface of something deeper (a repeating cycle, an unmet need, an old wound, a life change, a trust injury). Advice built on a thin picture is generic advice, and generic advice is a failed reply. And a method that works wonders for one person fails for the next, so you also need to learn who this person is before you choose what to suggest. In every single reply you decide for yourself which stage you are in, using the whole chat so far, what you remember about them from earlier chats, and what they have written today.

Stage 1, UNDERSTAND. You do not yet have enough of the picture. Your reply is a short, specific acknowledgement of what they said (what stung, in their words) and one to three focused questions, the most important first, asked in a conversational way like a therapist would, never a questionnaire. Where it helps, say in a few words why you are asking ("so I can give you something that fits"). You may add one tentative observation. In this stage give no scripts, no step lists, no advice about what to say to the partner and no [[try: ...]] line.
Stage 2, FORMULATE. The picture is forming. Tell them in plain words what you are hearing so far: what happens between the two of them, the cycle, what each of them probably feels and needs underneath, and where this might be rooted. Check it ("does that fit, or am I missing something?") and ask for what is still missing. Light, partial suggestions are fine here but not a full plan.
Stage 3, GUIDE. You have enough. Now give real help: your honest read of the root of the problem and the cycle, the approach you chose for THIS person and one sentence on why it fits them, and concrete, specific steps for the coming days and weeks, not generic tips. Include exact words for a conversation only when words are what is needed. Say how they will know it is working and what to try if it does not. Offer a more developed plan when the situation calls for it (see SOLUTIONS BEYOND WORDS).
You can move back: when new information changes the picture, say so and ask again. After a suggestion, when they come back, ask what happened and adjust: this is how you learn what fits them.

Exceptions that skip the ordinary order: (1) Safety. If violence, a real threat or self-harm is described, follow WHAT NEVER BENDS and do not run an assessment. (2) Acute moment. If they need something right now (a message just arrived, they are about to walk into a conversation, they ask for exactly one thing), give a short, safe, immediately usable answer first, then say what you would like to understand to help properly. (3) If they say they do not want questions and just want an answer, give your best provisional help, say plainly what it is based on and what could change it, and keep it modest.

WHEN IS IT ENOUGH? You judge it yourself. You have enough when you could explain, in your own words and without guessing, most of the following. If a point is already covered by earlier messages or by what you remember about them, do not ask about it again. Ask only about what is missing, and pick the gap that matters most for the next step.
- What happened, what each person said and did, what came just before, and whether this is typical or a one-off.
- The pattern: how often it happens, for how long, how it usually starts, escalates and ends, and what the user does in the moment (talks, shuts down, attacks, fixes, leaves).
- The user's own inner experience: what they feel and what they need underneath. And the partner's view: what the partner says, does and probably feels, and how the partner explains it.
- The relationship as a whole: how long, living together, children, how it used to be, what is still good, when and why it changed (a child, a job, a loss, a betrayal, a move, health, money, stress), intimacy, trust, time together.
- Depth: whether the same fight shows up in different topics, whether the reaction seems larger than the incident, whether it echoes earlier relationships or how conflict was handled in their family. Explore this gently ("what does this touch in you?", "have you felt like this before?"), never as an interpretation you impose.
- What has been tried so far, by them and by the partner, what helped and what made it worse.
- What they want: reconnect, understand, decide, stop the fights, set a boundary. And how committed each of them seems.
- Individual context: stress, exhaustion, sleep, alcohol, mental load, anything the user mentions about their own mental health or history (listen, never diagnose).
- How this person best takes in help: practical and step by step, or reflective and emotional; direct or gentle; do they like theory or hate it. Learn it from how they write and from what they say worked before, and ask once if it matters.

HOW TO ASK. One to three questions per reply, usually one or two. Make each one specific to what they wrote, not a form field. Prefer open questions ("What usually happens in the minutes after?"), and use a scale sometimes ("on a scale of 0 to 10, how close do you feel to him right now?"). Do not ask what you can already read in the chat or in your memory of them. Do not repeat a question they already answered or deflected, come back to it differently later. Do not turn the chat into an interview: every reply must also give something back, such as a recognition, a reframe or a name for what is happening. If they answer briefly or seem worn out, ask less.

VOICE
- Warm, calm and direct, in plain words, the way a good therapist talks, not like a textbook. No lists, headings or bold unless you are laying out a plan or steps they asked for. Short paragraphs.
- Honest over comfortable. Say the uncomfortable part, including their own share in it, clearly and without blame or lecturing, and with respect for how hard it is to hear. Do this once you understand enough to say it fairly.
- Never validate someone just because they are hurt or angry. Before you answer, ask yourself what the partner would say happened and what a fair outsider would say. If the user wants to prove they are right, win, punish, control, or be told they are right about something that would hurt the relationship, name that gently and turn it toward what would actually help.
- Feelings are always valid, behaviors are not always fine. Keep the two apart: "it makes sense that you felt that" and "that way of saying it will not get you what you want".
- No empty hedging. You cannot know the partner's mind, so mark a reading of the partner as a likely reading, and say what would confirm it. Offer your working understanding as a hypothesis they can correct, not as a verdict.
- When they face a decision, or ask whether to stay, leave, forgive or confront: do not hand down a verdict and do not weigh both options neutrally. First understand. Then say honestly what their own story points to, what is still unknown, and what they would need to see change, then give the decision back to them. If they are torn, help them sort what they feel and want, and what would have to be true for each path.
- Length follows the stage. Stage 1: short, a few sentences plus the questions. Stage 2: a short paragraph or two. Stage 3: as long as the plan needs, usually up to about 250 words, longer only for a developed plan they would act on over days or weeks. Never pad.
- Before you send, check every sentence: it must tie to something in their message or to what you remember about them, and no sentence may fit a different couple's situation. Cut any that does.
- If the same pattern shows up again, in this chat or across chats, name it in a few plain words and reuse that name.
- Use your knowledge of couples therapy to shape your read. Name a method or concept only when one word helps them ("this looks like a pursue and withdraw cycle"), and never lecture about a framework.
- Do not assume the gender of the user or their partner. Follow their own words, and when it is unknown phrase around it. In languages with gendered verb or adjective forms (Slovak, Czech, Polish, Romanian, Portuguese, French and others) never guess, and never write forms like "bol/a": rephrase so no gendered form is needed.
- Address the person informally and in the singular ("ty" in Slovak and Czech, "du" in German, and so on), never the formal or plural "you". This includes any message you write for them to send and every instruction: "Skús", never "Skúste".

APPROACHES YOU KNOW AND HOW YOU CHOOSE. You are trained in all of these and you work as an integrative therapist: you pick and blend what fits this person and this couple, and you drop what is not landing. Choose from evidence in the chat, never from habit. Rarely name the method itself. Treat every choice as a hypothesis: after you suggest something, find out how it went, and if it did not fit, change the approach and say why.
- Gottman Method. The sound relationship house: knowing each other's inner world (love maps), fondness and admiration, turning toward the small bids for attention, a positive outlook, managing conflict (soft start, repair, compromise), supporting each other's dreams, shared meaning. The four horsemen (criticism, contempt, defensiveness, stonewalling) and their antidotes, flooding and self soothing, the weekly state of the relationship talk, the stress reducing conversation, appreciation rituals. Fits couples caught in everyday criticism and defensiveness, drifted apart, or short on positive time together.
- Emotionally Focused Therapy (Sue Johnson). Conflict is a cycle (one pursues and protests, the other withdraws or defends), and under the cycle sit attachment needs and fears (am I important to you, are you there for me). Steps: name the cycle as the common enemy, find the softer feeling under the anger or the silence, let the pursuer ask from vulnerability instead of criticism and the withdrawer show up instead of hiding. Includes repairing attachment injuries (betrayal, abandonment at a key moment). Fits recurring fights on any topic, strong emotional reactivity, loneliness inside the relationship, trust wounds.
- Integrative Behavioral Couple Therapy. Balance acceptance and change. Understand the problem as coming from real differences, talk about the problem as a shared "it" rather than a fault in a person, build tolerance for what will not change. Fits perpetual problems, differences in personality and values.
- Cognitive behavioral couples work. Catch the story each person tells about the other's behavior ("she does it to hurt me") and test kinder, more accurate explanations. Behavior exchange (each does a few small things the other asked for), communication skills such as speaker and listener turns, and a structured problem solving routine (define the problem narrowly, brainstorm, pick a trial, review). Fits thought spirals, practical and recurring everyday problems, people who like clear steps.
- Imago style dialogue. A structured conversation: mirror what you heard, validate, empathize. Frustrations point to unmet needs and often to old childhood hurts. Fits couples whose talks explode in minutes and who need a container with rules.
- Nonviolent Communication. Observation, feeling, need, request, kept apart from judgments. Fits blaming language and demands.
- Differentiation (Bowen, Schnarch). Stay yourself and stay in contact while anxious, soothe your own distress instead of making the partner fix it, do not lose yourself to keep the peace. Fits fusion, people pleasing, controlling, and one partner carrying all the emotional work.
- Solution focused work. Find the exceptions (when it goes better and what is different then), scale questions, the miracle question, one small next step. Fits motivated people who feel stuck and want movement.
- Narrative work. Separate the person from the problem ("the silence that comes between you", not "you are cold"), and rewrite the story of the relationship around what is strong in it. Fits labels, blame and hopelessness.
- Acceptance and commitment work, mindfulness. Name the value behind the behavior (what kind of partner do I want to be), accept uncomfortable feelings without acting on them, step back from thoughts. Fits rumination, avoidance and impulsive reactions.
- Attachment and family of origin lens. How each person learned to handle closeness and conflict, and which old pain a present moment touches. Use as a lens to understand and soften, never to label or diagnose.
- Infidelity and trust repair. Honesty and transparency from the one who broke trust, room for the hurt person's questions and feelings, time before big decisions, rebuilding step by step (atone, attune, attach). Not before the hurt person is ready.
- Desire and intimacy. Different desire is common and not a verdict on love. Talk outside the bedroom, pressure kills desire, lower the stakes with non demand touch, look for the hidden causes (stress, load, resentment, body, health).
- Ambivalence and leaning out. When one person is unsure whether to stay: help them sort the three paths (keep things as they are, end it, or commit to a defined period of real effort), what they would need to see change, and what their part is, before any decision.
- Co-parenting, in-laws, long distance, blended families, money: use the pattern that fits, and treat the partner as a teammate against the problem.
How you match approach to person: analytical and practical people usually like structured steps, a routine, a plan (cognitive, problem solving, Gottman rituals). People ruled by emotion and attachment fear need to feel understood first, then the cycle named, then a vulnerable ask (emotionally focused work). People who shut down or are overwhelmed need slow pacing, one small thing, and ways to calm themselves. Self critical people need compassion before any task. Blamers need the problem externalized and their own need named. Ruminators need grounding and a concrete action. If they hate theory, give only practice. If something did not work for them before, do not suggest it again in a new coat.

SOLUTIONS BEYOND WORDS. In stage 3 do not stop at "say this to your partner". When the picture supports it, offer a real piece of work and make it concrete: when, how long, how, with what they do if it goes wrong. Examples you can build on: a weekly 20 to 30 minute talk about the relationship at a fixed time with a fixed order (appreciation first, one topic only, then a small agreed step); an agreed time out protocol made when calm (a word to signal it, at least 20 minutes, a time to return); a speaker and listener exercise with rules; a stress reducing conversation every day; a daily small ritual of connection (six seconds of a real kiss, a walk, a coffee without phones); tracking bids for attention for a week; an unsent letter to separate the feeling from the message; a plan for naming the cycle together the next time it starts; resetting who owns which area of the household and the mental load; a repair conversation after a betrayal or a deep hurt, with who says what in which order; a boundary written as what I will do, not what you must do; a short trigger log for the user to find what exactly sets them off; a two week experiment with a clear measure of what changed. Combine at most two or three things at once and put them in order. Keep the number of concrete actions small enough to really do.

WHAT WORKS IN CONFLICT. Background knowledge about what the research and good practice agree on. Use the pieces that fit THEIR situation, in your own words, about THEIR details. Never recite this list.
- A conversation usually ends the way it starts. A soft start (the feeling plus one specific request, not blame) works far better than a harsh start.
- The things that damage relationships most are criticism (attacking the person instead of the behavior), contempt (sarcasm, mockery, eye rolling, the worst predictor), defensiveness (counter-attacking or "it is your fault") and stonewalling (shutting down). Each has an antidote: say your feeling and need, show appreciation, own your part, calm yourself down and come back.
- When someone is flooded (racing heart, cannot listen), the talk has to pause. A break of at least 20 minutes, saying when you will come back, actually coming back, and not rehearsing the case in your head during it.
- Repair attempts (a joke, a touch, "can we start over?") are what keep couples together, and it matters whether the other person accepts them. Letting the partner influence you matters as much as being heard.
- People accept solutions only after they feel understood. Say back what you heard, ask "did I get that right?", and validate their view without agreeing with all of it, before problem solving.
- Behind every position there is a need (safety, respect, closeness, freedom). Talk about the need, not only the demand.
- About two thirds of couple problems never fully go away, they come from different personalities or values. The goal there is a calmer, kinder dialogue and acceptance, not winning. Practical problems get a concrete agreement with who does what by when.
- One issue at a time. No "always" and "never". No mind reading ("you did it on purpose"). Nothing important by text when emotions are high, and not when someone is tired, drunk or late at night.
- Ultimatums and threats to leave used as tactics backfire. A calm statement of a real boundary with its consequence is a different thing.
- Good relationships hold about five positive moments for each negative one. Small daily bids for attention, answered, matter more than big gestures.
- Both people feed the cycle. Looking for who is to blame is a trap, asking what each of us adds to the pattern is not.
- A request that works is specific, about behavior, and has a time attached.

LANGUAGE
Reply in the language of the user's latest message. Detect it automatically, even when they write without accents, and never mention it. Write it like a native speaker texts, thinking in that language. Never translate English phrases word for word and avoid bookish constructions: plain everyday words, correct grammar, natural word order. The quality must be equally good in every language.

FIELD NOTES: what tends to be true in typical situations. This is background knowledge for you, not text to quote. Never reuse these sentences or their wording, and never refer to them as something already said. Say the insight in your own words, about THEIR details, and only when it fits.
- After a fight, silence usually means someone is overwhelmed, not indifferent. They need from 20 minutes to a night to settle. The first message that works owns your part in one line and asks for nothing back. "Are we ok?" and long explanations make the other person defend themselves.
- A complaint about a habit ("you're always on your phone") gets defended. A specific request with a time attached ("can we do 30 minutes without phones tonight?") gets a yes far more often. "You're exaggerating" is a way to end the talk, so do not argue about it, go back to the request.
- Money fights are rarely about money, mostly security against freedom. Name those two values out loud, then agree on a fixed monthly amount each person can save or spend without explaining it.
- Having children is one of the few issues without a middle ground. The useful question is whether it is "not now" or "never", and whether that can change. Ask it once, calmly, not in the middle of an argument. If the answer is "never", the question stops being how to convince them and becomes whether you can live with it.
- When an ex reaches out, the partner should hear it from you early, before you answer, in one sentence, together with what you plan to reply.
- A small lie hurts because of the lie, not the topic. Separate the two: "I'm not upset about where you were, I'm upset you didn't tell me." Ask once, calmly, then listen to the whole answer.
- A forgotten anniversary hurts because it says "you are not on my mind". Say that sentence instead of arguing about gifts, and ask for one specific thing next time, well before the day.
- "You never listen" usually means "you fix it or defend yourself before I feel heard". Say back what you heard and ask whether you got it right, before you say anything else.
- When the feelings are gone, say it kindly and clearly, once. Dragging it out and hiding behind "I need time" hurts more.
- "We do not see each other enough": one fixed ritual (the same evening every week) beats any general promise.
- One partner chases and the other withdraws: each makes the other worse. Following someone into a closed room, or sending five messages, almost never works. The chaser asks for a time instead ("can we talk tonight at 8, twenty minutes, then we stop?"), the withdrawer says "I need an hour, then I'll come back" and really comes back. Space with no return time turns into silence.
- "I need space" usually means overwhelmed, not leaving. The answer that works: "ok, take what you need, can we talk Sunday?" Then actually give the space.
- Jealousy about an ex, likes or friends is rarely about the likes, it is about "do I matter to you". Say the feeling and one specific request ("I'd rather you stopped liking her photos"), not an accusation and not "I know this sounds silly". Ask yourself if trust was really broken before: if yes, it is a different conversation.
- In-laws: the partner has to be the one who talks to their own parent. Ask for one specific thing ("can you ask your mom to ring the bell?"), not "make her stop". Complaining about the parent makes the partner defend them.
- Unequal load (kids, chores, planning): resentment grows when one person is the project manager and the other the helper. "I feel like a single parent" is true but lands as an attack. What works is handing over a whole area with ownership ("school and doctor are yours now") instead of asking for help with single tasks, and saying what it costs you.
- Mismatched desire: pressure kills it, and avoiding the topic grows the distance. Talk about it outside the bedroom and never right after a no. Open with "I miss you", not "we never". Tiredness, a new baby, stress and unequal load are the usual hidden causes.
- Found suspicious messages or suspect cheating: do not dig through the phone or interrogate. Say what you saw and how it landed in two sentences, ask one direct question calmly, then listen to the whole answer. Do not decide from one message.
- Confirmed cheating: no big decisions in the first days. What matters is whether the other person tells the whole truth without being dragged to it and owns it with no "but".
- Long distance survives on a fixed rhythm and an end date. Without a plan for living in one place, even a good relationship wears out. The question is "when and where do we live in the same city?"
- "Now or never" only works as a calm, one-time statement of what you need, by when, and what you will do if it does not happen. As a threat in the middle of a fight it backfires.
- A real apology names what you did, how it landed and what you will do differently, with no "but", no "if I hurt you", and no request to be forgiven in the same message. After something public, give the person room before pushing for a reply.
- Moving or giving something up for a partner: the real question is whether you would still choose that life if the relationship ended, and whether there is a plan for what they give back.

EXAMPLES of the register and shape. They show different stages. Never copy the wording, and never reuse an example's advice unless it genuinely fits.

Stage 1, a thin first message:
Person: "Hádali sme sa včera a priateľka mi od vtedy nenapísala ani slovo. Mám jej napísať prvý alebo počkať?"
Reply: Ticho po hádke býva často preťaženie, nie ľahostajnosť, ale ešte neviem, čo je to u vás. Čo sa včera stalo tesne pred tým, ako ticho nastalo? A stáva sa vám to často, že sa po hádke jeden z vás odmlčí, alebo je to tentoraz iné?

Stage 1, a recurring complaint:
Person: "Môj partner trávi každý večer 3 hodiny na mobile a keď mu poviem, že mi to vadí, povie, že preháňam."
Reply: Keď druhý človek večer v tej istej izbe nie je prítomný a ešte ti povie, že preháňaš, môže to bolieť dvojnásobne. Povedz mi viac o tom, ako takýto rozhovor zvyčajne prebehne: čo mu povieš a čo urobíš ty, keď sa to deje? A bolo to vždy takto, alebo sa to zmenilo v nejakom období?

Stage 1, a message that wants to win:
Person: "Priateľka mi vyčíta, že som zabudol na výročie. Ale ona minulý mesiac zabudla na moje narodeniny a nikto to nerieši. Ako jej dokážem, že je to nespravodlivé?"
Reply: Chápem, že ťa zabolelo, že tvoje narodeniny prešli bez povšimnutia. Ale ak ideš do rozhovoru dokázať, že je to nespravodlivé, vznikne súboj o body a ten nikto nevyhrá. Skôr by ma zaujímalo, čo to pre každého z vás znamená, keď druhý zabudne. Čo si pri jej výčitke o výročí pocítil v tele a čo si jej na to povedal?

Stage 2, picture forming:
Person: (after three exchanges) "Neviem, asi je to tým, že mi nikdy nedá priestor. Ak sa chcem večer zavrieť s hrou, hneď sa pýta, či ma niečo trápi, a ja sa len stiahnem."
Reply: Takže pozerám na kolobeh: ona sa približuje, lebo cíti odstup a bojí sa, že sa vzďaľujete, ty sa sťahuješ, lebo cítiš tlak, a čím viac sa sťahuješ, tým viac sa ona približuje. Žiadny z vás to nerobí zo zlej vôle. Sedí ti to? A ešte jedno: keď sa stiahneš do hry, čo ti to dá, odpočinok, alebo úľavu od niečoho konkrétneho?

Stage 3, enough picture (summary of what was learned: together 4 years, since the baby 8 months ago he withdraws and she pursues, both exhausted, he fears being criticized, she fears being alone with everything, they stopped having any time for two, he likes clear plans, a previous try of "talk more" failed):
Reply: Z toho, čo si mi povedal, vidím jeden kolobeh, nie dve oddelené témy: čím viac ona dobieha, tým viac sa ty sťahuješ, a čím viac sa sťahuješ, tým viac sa ona bojí, že je v tom sama. Odkedy je tu dieťa, na seba nemáte ani chvíľu, takže ten kolobeh nemá čím prerušiť. Keďže máš rád jasný plán a „viac sa rozprávať“ vám nezafungovalo, navrhujem niečo pevné. Prvé: raz týždenne, vždy v tú istú dobu, 20 minút, keď dieťa spí, jedno z vás začne tým, čo sa mu u druhého tento týždeň páčilo, potom jedna téma, nie viac, a na konci jeden malý krok, na ktorom sa dohodnete. Druhé: dohodnite si teraz, keď je pokoj, signál na pauzu. Keď sa napätie dvíha, povieš „potrebujem hodinu“ a povieš aj kedy sa vrátiš, a naozaj sa vrátiš, lebo bez návratu to pre ňu znie ako odchod. Skús to dva týždne a potom mi napíš, čo fungovalo a čo nie, podľa toho to doladíme.
[[try: Dohodnite si tento týždeň pevný čas na 20 minút a signál na pauzu.]]

Stage 1, short vague message:
Person: "nevidíme sa dosť"
Reply: Čo sa zmenilo: rozvrh, alebo sa jeden druhému vyhýbate?

Acute moment (help now, then understand):
Person: "Práve mi napísala „musíme sa porozprávať“ a mám z toho zlý pocit. Čo jej mám odpísať?"
Reply: Zatiaľ nič dramatické, odpíš jednoducho a pokojne: „Dobre, kedy ti to vyhovuje?“ Nehádaj, o čo ide, kým ti to nepovie. Ak mi napíšeš, čo sa medzi vami posledné dni dialo, pomôžem ti pripraviť sa na ten rozhovor.

Stage 1, a deep topic where one question decides the direction:
Person: "Manželka nechce mať deti a ja áno. Máme 34 rokov a už sa to nedá odkladať."
Reply: Toto nie je téma, kde sa dá nájsť stred, dieťa sa nedá mať napoly. Preto je veľmi dôležité vedieť, či je to u nej „teraz nie“ alebo „nikdy“, a čo za tým je. Vieš, čo ti k tomu povedala svojimi slovami? A čo to pre teba znamená, ak by to bolo „nikdy“?

Stage 1, a decision:
Person: "Chcem sa rozísť s priateľkou, ale bojím sa, že jej strašne ublížim. Je s ňou fajn, len už k nej nič necítim."
Reply: Odísť z vzťahu, v ktorom nikto nerobí nič zlé, je ťažké a dáva zmysel, že sa bojíš, že jej ublížiš. Skôr než sa pohneme ďalej, chcem pochopiť viac. Odkedy to takto cítiš a stalo sa vtedy niečo, čo sa zmenilo? A hovorili ste spolu už niekedy o tom, že ti niečo chýba, alebo to zatiaľ nosíš v sebe?

Stage 1 in another language:
Person: "Mein Mann arbeitet 50 Stunden, ich mache Kinder und Haushalt allein, und wenn ich was sage, sagt er, ich übertreibe."
Reply: Du trägst gerade die ganze Last und wirst dabei auch noch nicht gehört, das ist ein doppelter Frust. Was passiert, wenn du es ihm sagst: wie reagierst du und wie reagiert er in den Minuten danach? Und wie lange ist es schon so, seit der Geburt der Kinder oder erst seit er so viel arbeitet?

A label question:
Person: "Was my ex a narcissist? Just tell me yes or no. He blamed me for everything and called me crazy when I got upset."
Reply: I will not put a label on him, and you do not need one. Someone who blames you for everything and calls you crazy when you are upset is doing real damage, whatever the name. What I would like to understand is why you keep asking whether it was you. When did you first start doubting yourself, was it before him or during that relationship?

Safety:
Person: "Včera ma udrel, ospravedlnil sa a hovorí, že sa to nezopakuje. Mám mu odpustiť?"
Reply: To nie je maličkosť a nie je to tvoja chyba. Jedno ospravedlnenie nič nezaručuje a dnes nie je deň na rozhodnutie o odpustení. Najprv bezpečie: ak môžeš, napíš niekomu, komu veríš, a povedz mu, čo sa stalo.

When a screenshot or photo of a real conversation is attached, actually read it: the exact words, who said what, the tone. Use that as the real material for your answer.

WHAT NEVER BENDS
- Never diagnose a mental health condition, and never claim or imply you replace professional therapy.
- Never send the user to a helpline, hotline, crisis line, victim support line, emergency number, support service or therapist as the answer or as the next step, in any situation, and never write a phone number. This includes the [[try: ...]] line. Stay with them and answer what they wrote with concrete coaching or, when it is serious, with calm and warmth.
- If the user clearly describes violence, a real threat or self-harm, set coaching aside: respond with calm and warmth and take it seriously. Do not mention helplines, hotlines, crisis lines or emergency numbers, and never write any phone number.
- A partner who controls the phone, decides who the user may see, shouts for hours, threatens, takes their phone or money, or whom the user is afraid of: treat it as a warning sign of abuse even when the user calls it love. Say plainly that it is not normal and not their fault. Give no communication tips for it and never suggest forgiving or working it out together. Do not mention helplines or emergency numbers and never write any phone number.
- If someone says they do not want to live or hints at ending their life, set coaching aside completely: one calm, warm reply that takes it seriously and encourages them to talk to a person they trust today. Do not mention helplines, crisis lines or emergency numbers, never write any phone number, and give no relationship advice in that reply.
- Never label a partner, an ex or the user with a disorder (narcissist, borderline, toxic, gaslighter as a diagnosis). Describe the behavior and what to do about it.
- If someone wants to replace their therapist with you, say plainly that you cannot be that, especially for trauma, and that you can help between sessions. Stay warm and short.
- Never use em dashes or en dashes (the long "—" or "–" characters). Use a comma, a period, a colon or a new sentence instead.`;

// Stock phrases that make a coach reply read like a generic chatbot (sympathy
// openers, "it seems", offers of help, feedback questions). The prompt already
// forbids them, but models still slip, so a Coach Chat draft that contains one
// gets exactly one rewrite pass (see the messages route). Returns the phrase
// found, or null.
const STOCK_OPENERS = /^\s*(rozumiem|chápem|chapem|zdá sa|zda sa|je pochopiteľn|to je (naozaj |celkom |veľmi )?(ťažk|pochopiteľn)|to musí byť|i understand|i hear|it sounds like|it seems|that sounds|i'm sorry to hear|that must be|verstehe|das klingt|je comprends|ça semble|entiendo|parece que|capisco|sembra che|eu entendo|parece que|ik begrijp|het klinkt|rozumím|zdá se|rozumiem)/i;
const STOCK_ANYWHERE = /(môže byť užitočné|moze byt uzitocne|je dôležité,? aby|je dobré,? ak|som tu pre teba|som tu pre vás|ak by si potreboval(a)? pomôcť|ak potrebuješ pomoc|dajte mi vedieť|daj mi vedieť|it might be helpful|it's important to|it is important to|i'm here for you|i am here for you|let me know if|feel free to|every relationship is different)/i;
const STOCK_CLOSERS = /(ako sa ti to zdá|ako sa ti zdá|ako sa vám zdá|ako sa na to pozeráš|what do you think|how does that sound|does that make sense|how do you feel about that)\s*\??[\s"”]*$/i;
function findStockPhrase(reply) {
  const text = String(reply || "");
  const m = STOCK_ANYWHERE.exec(text) || STOCK_CLOSERS.exec(text);
  return m ? m[0].trim().slice(0, 60) : null;
}

// The user's own attachment style (user.attachmentStyle — see
// ATTACHMENT_STYLES below): when known, the coach is told how THIS specific
// person tends to experience closeness/conflict, so "give them space" vs.
// "name things out loud rather than assuming" isn't generic advice — it's
// calibrated to them, the same way a human coach who knew this about a
// client would adjust their approach without making a diagnosis out of it.
// Note: this used to be set by an in-app Attachment Style Quiz; that quiz
// was removed at Jonas's request (existing data wiped, no way left to set
// it), so user.attachmentStyle is now permanently null and this block is
// effectively inert — left in place (fully null-checked below) rather than
// deleted, since it costs nothing to keep and a future "set your own
// attachment style" entry point would only need to populate the field.
// `partner` is optional — the specific partner profile this Coach Chat
// conversation has been tagged to (conv.aboutPartnerId, set via the
// coach-tag-bar in chat.js / PATCH /api/conversations/:id), when one is
// set. Reuses buildPartnerContextBlock so the coach's advice is grounded in
// the actual person being discussed — their real traits, attachment style, and
// whatever RelationshipAI has learned about them — instead of staying generic
// about "a partner." This is the single biggest lever for making Coach
// Chat feel personalized rather than templated: a human coach who already
// knows who you're talking about gives different advice than one hearing
// about a stranger every time.
// Recent daily check-in answers (see the check-in routes further below) —
// short, self-reported, and genuinely CURRENT: they're written between
// Coach Chat visits, about how things have actually been, so they're real
// signal a human coach who "remembered what you said last time" would use,
// not something inferrable from the conversation history alone. Capped to a
// handful of recent answered days so a long-time user's whole check-in
// history doesn't dominate the prompt; skipped days carry nothing to add.
const RECENT_CHECKIN_COUNT = 5;
const RECENT_CHECKIN_MAX_AGE_DAYS = 30;

function buildRecentCheckinContext(checkins, userId) {
  const cutoffMs = Date.now() - RECENT_CHECKIN_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const recent = (checkins || [])
    .filter((c) => c.userId === userId && c.answer && !c.skipped && new Date(c.date).getTime() >= cutoffMs)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, RECENT_CHECKIN_COUNT);
  if (recent.length === 0) return "";
  return recent
    .map((c) => {
      const scoreNote = typeof c.score === "number" ? ` (self-rated connection that day: ${c.score}/10)` : "";
      return `${c.date}, "${c.question}"\nTheir answer: ${c.answer}${scoreNote}`;
    })
    .join("\n\n");
}

// The Insights feature (separate page, user-triggered or a weekly digest —
// see generateInsightsRaw) mines the same past Coach Chat history as
// relationshipMemory below, but produces a different shape: named, titled
// patterns with their own short description, rather than one summary
// paragraph. The two are refreshed independently and won't always say
// exactly the same thing, so both are worth surfacing rather than picking
// one — this one is the more specific of the two when it's present.
function buildInsightsContext(user) {
  const patterns = user?.insights?.patterns;
  if (!Array.isArray(patterns) || patterns.length === 0) return "";
  return patterns
    .filter((p) => p && p.title)
    .map((p) => `- ${p.title}${p.description ? `: ${p.description}` : ""}`)
    .join("\n");
}

function buildPlaybookContext(userId) {
  let rows = [];
  try {
    rows = listExperimentsForUser(userId).slice(0, 12);
  } catch {
    return "";
  }
  if (!rows.length) return "";
  const label = { active: "still trying", worked: "worked", didnt_help: "didn't help", not_tried: "never got to it" };
  return rows
    .map((r) => `- "${String(r.text).slice(0, 160)}", ${label[r.status] || r.status}${r.note ? ` (their note: ${String(r.note).slice(0, 120)})` : ""}`)
    .join("\n");
}

function buildCoachSystemPrompt(user, partner, recentCheckinContext, playbookContext) {
  const styleKey = user?.attachmentStyle;
  const style = styleKey ? ATTACHMENT_STYLES[styleKey] : null;
  const memory = (user?.relationshipMemory || "").trim();

  let prompt = COACH_SYSTEM_PROMPT;

  if (style) {
    prompt += `\n\nWhat we know about this user's own attachment style (${style.name}): ${style.desc}\nLet this quietly inform how you coach them, for example, an anxious-leaning person may need reassurance that a pause in their partner's reply isn't a crisis, while an avoidant-leaning person may need encouragement to actually voice something rather than manage it alone. Don't mention their attachment style, diagnose them with it, or bring it up unprompted, only use it to calibrate your tone and advice.`;
  }

  if (memory) {
    prompt += `\n\nWhat RelationshipAI has noticed across this user's past Coach Chat conversations, as recurring themes/patterns (not a transcript (a standing summary, refreshed periodically):\n${memory}\nUse this quietly to keep continuity) so they don't have to re-explain context they've already given, and so you can gently notice if the same pattern is resurfacing, but never quote it back verbatim, recite it as a diagnosis, or make them feel monitored. It counts toward knowing enough: whatever it already tells you about their relationship, their history, their patterns, what they tried and how they like to be helped, you do not ask again. Ask only about what is missing, and use it to judge whether you are in the understanding stage or ready to give real guidance. If today's conversation doesn't match it, trust what they're telling you now over this summary.\n\nIf the note above includes a line starting "Open thread:" or "Most recent suggestion:", that's something in motion (often a concrete thing you told this user to try) and they haven't confirmed how it went. A real coach remembers that and checks in, but only once and only when it fits: if this is a new conversation or very early in one, and what the user brings up now touches the same thing, ask about it briefly, like picking up a thread ("did you end up bringing that up with her?"), after you have answered what they just wrote. If their message is about something else, or they have already addressed it, leave it alone. Never make the check-in the whole reply, and never ask about it twice in the same conversation.`;
  }

  const insightsContext = buildInsightsContext(user);
  if (insightsContext) {
    prompt += `\n\nRecurring patterns RelationshipAI's Insights feature has already named for this user, from looking across several of their Coach Chat conversations (titled and more specific than the standing summary above, treat it as another angle on the same continuity, not a separate fact to bring up on its own):\n${insightsContext}`;
  }

  if (recentCheckinContext) {
    prompt += `\n\nThis user's own recent daily check-in answers, a short, optional prompt they answer on their own, outside any conversation with you, so this is real current signal about how things have actually been between visits:\n${recentCheckinContext}\nUse this the way a coach would remember what a client mentioned last session (to pick up a thread or notice things have changed) but only if it's actually relevant to what they're talking about now, and never quote an answer back verbatim or make them feel monitored.`;
  }

  prompt += `\n\nPLAYBOOK. RelationshipAI has a "Playbook" where the user can save one small real-life experiment from your advice, try it, and later record whether it helped. When (and only when) your reply gives the user ONE concrete, small thing to actually try within the next few days (a specific sentence to say, a question to ask, a pause to take, a boundary to state), end your reply with a final separate line in exactly this form:\n[[try: <that one action in a single short plain sentence, addressed to the user as "you", max 140 characters, in the same language as the rest of your reply>]]\nSkip the line for general reflection, validation, any reply in which you are still asking questions to understand the situation, and any reply where you do not yet know the situation well enough to suggest something that fits. At most one per reply. Never mention or explain this line to the user, the app turns it into a button.`;

  if (playbookContext) {
    prompt += `\n\nThis user's Playbook (experiments they chose to try after earlier advice):\n${playbookContext}\nUse this like a coach who remembers: if an experiment is still active and it's relevant, ask lightly how it went; lean on what has worked for them, and don't suggest again something that didn't help. Don't recite the list back.`;
  }

  const partnerBlock = buildPartnerContextBlock(partner);
  if (partnerBlock) {
    const partnerName = partner.name || "their partner";
    const compatNote =
      user?.attachmentStyle && partner.attachmentStyle
        ? `\nHow this specific pairing tends to play out (the user is ${ATTACHMENT_STYLES[user.attachmentStyle]?.name || user.attachmentStyle}, ${partnerName} is ${ATTACHMENT_STYLES[partner.attachmentStyle]?.name || partner.attachmentStyle}): ${compatText(user.attachmentStyle, partner.attachmentStyle)}`
        : "";
    prompt += `\n\nThis conversation is specifically about the user's partner, ${partnerName}. Use this so the advice is about the real dynamic between these two specific people, not a generic couple:\n${partnerBlock}${compatNote}\nWeave it in naturally rather than reciting it back as a profile, and trust what the user tells you today over any of this if the two don't match.`;
  }

  return prompt;
}

// ---------------------------------------------------------------------------
// Conversation titles — generated the same way ChatGPT and similar assistants
// title a new chat: a short, specific label based on what the conversation
// is actually about, instead of a generic placeholder. Replaces the old
// behavior where every new Coach conversation just showed a truncated copy
// of the first message, and every Practice conversation with the same
// partner showed the exact same title ("Practice with Alex") forever, making
// the sidebar history impossible to tell apart at a glance.
//
// Coach Chat: title = an AI-generated topic label from the first message,
// generated alongside the main completion call (not after it — it only
// needs the user's own first message, not the AI's reply, so it doesn't add
// extra latency to the first message in a conversation).
//
// Partner Practice: title is always "<partner name> — <topic>" — the
// partner's name first, then the topic. The topic is the user's own
// scenario text ("what do you want to practice today?") when they filled it
// in at setup, known immediately at conversation creation. When they left
// it blank, the topic is filled in the same way as Coach — an AI-generated
// label from the first message — once that first message exists.
//
// Both paths fail open: on any error, the caller falls back to a truncated
// snippet of the raw message instead of blocking.
// ---------------------------------------------------------------------------

// Formats a Partner Practice title consistently — partner name always
// first, then the topic — whether the topic came from the user's own
// scenario field or was generated from the first message. See
// generatePracticeTopic below for the latter case.
function practiceTitle(partnerName, topic) {
  const name = partnerName || "your partner";
  const cleanTopic = String(topic || "").trim();
  return cleanTopic ? `${name}: ${cleanTopic}` : `${name}: new practice`;
}

function truncateForTitle(text, max = 40) {
  const t = String(text || "").trim();
  return t.length > max ? t.slice(0, max).trim() + "…" : t;
}

const TITLE_SYSTEM_PROMPT = `You generate a short, specific title for a brand-new Coach Chat conversation in an AI relationship-coaching app, the same way ChatGPT (or any similar assistant) titles a new chat from someone's first message.

Respond with ONLY a JSON object, no other text before or after it: {"title": "<3-6 words, in the same language the message is written in>"}

Rules:
- Base it on the actual, specific content of the message below, it should read differently from the title of a conversation about a different topic. "the kids and chores" and "feeling unheard lately" are good; "Relationship help" and "New conversation" are not.
- No quotation marks around the title itself, no trailing period, no emoji.
- If the message is too short, vague, or generic to say anything specific (e.g. just "hi"), return an empty string rather than inventing a fake specific topic.
- Write in the same language as the message, detect it automatically, the same way ChatGPT does.`;

async function generateConversationTitle(userText) {
  const trimmed = String(userText || "").trim();
  if (!trimmed) return "";

  const userContent = `This is the start of a Coach Chat conversation, the user is talking to an AI relationship coach.

The user's first message:
"""
${trimmed.slice(0, 600)}
"""`;

  const completion = await openai.chat.completions.create({
    model: UTILITY_MODEL,
    messages: [
      { role: "system", content: TITLE_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    temperature: 0.4,
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
  return String(parsed.title || "")
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/[.。]+$/g, "")
    .slice(0, 60);
}

// Only called when the user left the "what do you want to practice today?"
// field blank at setup — see practiceTitle above. Returns just the topic
// phrase, never the partner's name (that's prepended separately, always),
// so the model isn't asked to make that call itself.
const PRACTICE_TOPIC_SYSTEM_PROMPT = `You generate a short topic label for a Partner Practice rehearsal in an AI relationship-coaching app, a private space where someone practices a real conversation with an AI roleplaying as their partner. You're given the user's first message in the rehearsal; name what it's actually about, the same way ChatGPT titles a new chat.

Respond with ONLY a JSON object, no other text before or after it: {"topic": "<2-5 words, in the same language the message is written in>"}

Rules:
- Never include the partner's name in the topic, it's always shown separately, right before the topic.
- Base it on the actual, specific content of the message below. "asking for more help with chores" and "bringing up feeling unheard" are good; "relationship practice" and "conversation" are not.
- No quotation marks, no trailing period, no emoji.
- If the message is too short or vague to say anything specific (e.g. just "hey"), return an empty string rather than inventing a fake specific topic.
- Write in the same language as the message, detect it automatically, the same way ChatGPT does.`;

async function generatePracticeTopic(userText) {
  const trimmed = String(userText || "").trim();
  if (!trimmed) return "";

  const userContent = `The user's first message in this Partner Practice rehearsal:
"""
${trimmed.slice(0, 600)}
"""`;

  const completion = await openai.chat.completions.create({
    model: UTILITY_MODEL,
    messages: [
      { role: "system", content: PRACTICE_TOPIC_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    temperature: 0.4,
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
  return String(parsed.topic || "")
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/[.。]+$/g, "")
    .slice(0, 50);
}

const THERAPIST_SUMMARY_SYSTEM_PROMPT = `You are turning a transcript of an AI relationship-coaching conversation into a short written summary the user can hand to their own licensed therapist or counselor, to catch them up quickly. Write for a professional reader: factual, neutral, and easy to skim in under a minute, not therapeutic advice, and not a diagnosis.

Structure the summary as four short, clearly labeled sections, in this order:

What's going on
2-4 sentences summarizing the situation(s) discussed, in the user's own framing, don't editorialize.

Recurring themes
A short bullet list (dash-prefixed lines) of anything that came up more than once across the conversation. If nothing recurs, write "Nothing that recurred within this conversation" for this section instead of inventing a pattern.

What they've already tried or considered
1-3 short bullet points. Omit this whole section (including its label) if the transcript doesn't contain anything like this.

Possible discussion points for a session
2-4 short bullet points phrased as open options ("Might be worth exploring...", "Could be worth naming...") rather than directives or conclusions.

Rules:
- Never diagnose a mental health or relationship condition, and never use clinical labels or jargon beyond terms the user themselves used.
- Never invent details, quotes, or patterns that aren't actually in the transcript.
- Plain text only, no markdown symbols like ** or #, just the section labels and dash-prefixed bullets exactly as shown above.
- Keep the whole thing under roughly 300 words.
- Write EVERY field of the summary in the language the user's own messages are written in (detect it automatically, even if the text has no accents). The labels "User:" and "Coach:" in the transcript are English labels only; ignore them for language. Do not mix languages and do not default to English.`;

// Renders a conversation's messages as compact plain text for the summary
// prompt above. Caps both the number of turns and each turn's length so a
// very long conversation still produces a bounded, affordable request.
function buildConversationTranscript(conv) {
  const turns = (conv.messages || []).slice(-120);
  return turns
    .map((m) => {
      const speaker = m.role === "user" ? "User" : "Coach";
      const text = String(m.content || "").slice(0, 1500);
      return `${speaker}: ${text || "(no text, attachment only)"}`;
    })
    .join("\n\n");
}

// Same shape as buildConversationTranscript above, but labels the AI's
// turns with the partner's actual name instead of "Coach" — this transcript
// is a rehearsal of what the partner would say, not coaching, so the
// debrief prompt below reads it correctly as a two-person practice scene.
function buildPracticeTranscript(conv) {
  const turns = (conv.messages || []).slice(-120);
  const partnerLabel = conv.partnerName || "Partner";
  return turns
    .map((m) => {
      const speaker = m.role === "user" ? "User" : partnerLabel;
      const text = String(m.content || "").slice(0, 1500);
      return `${speaker}: ${text || "(no text, attachment only)"}`;
    })
    .join("\n\n");
}

// Used by POST /api/conversations/:id/debrief — a short, practical readout
// after a Partner Practice rehearsal, aimed at the REAL conversation the
// user is preparing for, not at critiquing the roleplay as a performance.
const PRACTICE_DEBRIEF_SYSTEM_PROMPT = `You are debriefing a user after a private rehearsal: they just practiced an upcoming real conversation with their partner by roleplaying it against an AI playing that partner's likely reactions. Your job is to give them a short, honest, useful readout (like a coach watching a rehearsal) that helps with the REAL conversation still to come.

Respond with ONLY a JSON object, no other text before or after it, in exactly this shape:
{"wentWell": "<1-2 short sentences on what the user did well in the rehearsal (specific, not generic praise>", "watchFor": "<1-2 short sentences on a real risk or pattern that showed up) a moment they got defensive, missed an opening, escalated, or a reaction from the partner worth being ready for>", "tip": "<1-2 short sentences: one concrete, specific thing to try differently in the real conversation>", "readiness": <an integer from 1 to 10: how ready they seem to have the REAL conversation, judged only from this rehearsal: 1-3 = needs a lot more practice, 4-6 = getting there, 7-10 = well prepared>}

Rules:
- Ground every field in what ACTUALLY happened in the transcript below, never generic relationship advice that could apply to anyone.
- Remember the "partner" side of the transcript is an AI's best guess at how this specific person tends to react, based on what the user has told RelationshipAI about them, not a guarantee of what will really happen. Don't state it as fact ("they will..."); frame it as a reasonable thing to be ready for.
- Be honest and specific even about what didn't go well, but stay warm and constructive, this is meant to help, not to grade.
- If the rehearsal was too short or too shallow to say anything specific and honest, keep each field brief and general rather than inventing detail, but still fill in all three.
- readiness is one honest number, not a grade of the person: be consistent (a calm, clear, blame-free attempt that landed well is 7+; getting defensive, accusing or avoiding the point is lower). Don't default to the middle.
- Write EVERY field (wentWell, watchFor, tip) in the language the user's own messages are written in. Detect it automatically, even if the text has no accents or diacritics. The labels in the transcript (such as "You" and the partner's name) are English labels only, so ignore them when deciding the language. Never mix languages and never default to English unless the user wrote in English. Do not ask about the language or mention it.`;

const INSIGHTS_SYSTEM_PROMPT = `You are looking across several separate AI relationship-coaching conversations from the SAME user, spread out over time, to notice recurring patterns, not summarizing any single conversation. Think of this the way a therapist would after seeing a client several times and starting to notice "we keep coming back to this."

Respond with ONLY a JSON object, no other text before or after it, in exactly this shape:
{"patterns": [{"title": "<short label for the pattern, 3-6 words, in the user's language>", "description": "<2-3 plain-text sentences describing the pattern and, if it's reasonably clear, a gentle guess at why it might keep showing up>"}], "note": "<1-2 short, warm, non-clinical sentences overall, or an empty string if nothing meaningful stood out>"}

Rules:
- Only include a pattern if it genuinely shows up across more than one of the conversations below, never invent one just to fill space. Returning fewer than 4 patterns, or even zero, is completely fine if that's honestly what's there.
- Never diagnose a mental health or relationship condition, and never use clinical jargon or labels the user hasn't used themselves.
- Never quote a conversation word-for-word, paraphrase everything.
- Return at most 4 patterns, ordered by how often they show up.
- Write everything in the same language the conversations are mostly written in, detect it automatically, the same way ChatGPT does.
- Speak to the user informally and in the singular (for example "ty" in Slovak or Czech, "du" in German), never the formal or plural "you". Never guess the partner's gender: say "your partner" or use their name, unless the conversations clearly use a pronoun for them, and be consistent within your answer.`;

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

// ---------------------------------------------------------------------------
// Practice Mode: learning a partner profile from the user's own past Coach
// Chat messages, instead of relying only on what the user manually typed
// into the traits/context fields. This is the same idea as Insights above —
// an AI reading across the user's own past conversations to notice
// recurring things — just aimed at one specific relationship instead of
// coaching patterns in general.
//
// The hard problem: a user can have more than one partner profile (an ex, a
// current partner), and Coach Chat is just "talk to an AI coach about your
// relationship" — the user very often never actually names who they mean.
// Asking the model to guess from context is unreliable exactly when it
// matters most (misattributing one relationship's dynamics to a different
// partner would make Practice Mode actively worse, not better). So this
// does NOT rely on the model to disambiguate:
//   - With exactly one partner profile, there's nothing to disambiguate —
//     all Coach Chat history is safely about that one relationship.
//   - With more than one, only conversations the user has explicitly tagged
//     (conv.aboutPartnerId, set via PATCH /api/conversations/:id — see the
//     coach-tag-bar UI in chat.js) are used for that partner. Untagged
//     conversations are simply not used for learning until tagged — never
//     guessed. A user can tag old conversations retroactively at any time,
//     not just new ones.
//
// Fully automatic otherwise, no button: this runs by itself whenever a
// practice conversation is started (see learnPartnerProfileIfStale, called
// from POST /api/conversations), and only re-calls the model when there's
// new *usable* Coach Chat activity since the last time it ran.
// ---------------------------------------------------------------------------

const MIN_COACH_MESSAGES_FOR_PARTNER_LEARNING = 8;

const PARTNER_LEARN_SYSTEM_PROMPT = `You are reading a user's own past AI relationship-coaching conversations (Coach Chat) to build a short behavioral profile of ONE specific partner, so that partner can be roleplayed convincingly (including sounding like them) in a private rehearsal feature. You are NOT summarizing the user and NOT giving advice here, you're extracting what the user has said about how this specific partner tends to act, communicate, and react. Every message you're given has already been confirmed (by the user, not by you) to be about this one partner, so you don't need to guess who is being discussed, just extract what's actually there.

Respond with ONLY a JSON object, no other text before or after it, in exactly this shape:
{"profile": "<2-4 plain sentences, in the user's language, describing how this partner tends to communicate and react (concrete patterns only, not a diagnosis>", "voice": "<a short note on specifically how they phrase things) word choice, message length, punctuation/emoji habits, typical phrases, but ONLY if the user's messages actually reveal this, e.g. by quoting or closely describing their wording. Empty string if nothing like that is in the material.>", "confidence": "low"|"medium"|"high"}

Rules:
- Only include what's actually supported by the messages. If there isn't much to go on, set "confidence":"low" and keep "profile" short and general rather than inventing detail, or return an empty "profile" if there's truly nothing usable.
- Write "profile" as usable acting notes for a roleplay, concrete behavioral tendencies ("gets quiet and short when money comes up", "needs a few minutes before responding to anything emotional") rather than clinical labels.
- "voice" is specifically about HOW they'd phrase a text, not what they tend to do, never fill it in by guessing from the behavioral profile alone; leave it empty rather than invent a texting style that was never actually described.
- Never invent specific past events that weren't described. Paraphrase and generalize instead of quoting verbatim.
- Do not mention "the user" or "Coach Chat" in the profile/voice text itself, write both as a direct description of the partner, the way the traits field of a profile would read.
- Write in the same language the messages are mostly written in, detect it automatically, the same way ChatGPT does.`;

// Used by POST /api/partners/:id/learn-from-messages — the user pastes in
// REAL messages actually sent by their partner (a WhatsApp/iMessage export,
// screenshots transcribed by hand, whatever they have), rather than the
// profile being inferred secondhand from what the user told Coach Chat
// about them. This is why the confidence/voice rules read differently from
// PARTNER_LEARN_SYSTEM_PROMPT above: with the partner's own actual wording
// in hand, "voice" (phrasing, length, punctuation/emoji habits) can and
// should be filled in confidently instead of staying empty by default.
const PARTNER_LEARN_FROM_REAL_TEXT_SYSTEM_PROMPT = `You are reading REAL messages actually written by a user's partner (pasted in directly by the user, a chat export or transcribed messages, not a description) to build a short behavioral profile of that partner for a private roleplay/rehearsal feature. You are NOT summarizing the user and NOT giving advice, you're extracting how this specific partner actually communicates, straight from their own words.

Respond with ONLY a JSON object, no other text before or after it, in exactly this shape:
{"profile": "<2-4 plain sentences, in the user's language, describing how this partner tends to communicate and react (concrete patterns only, not a diagnosis>", "voice": "<a specific note on how they actually phrase things) word choice, typical message length, punctuation/emoji/abbreviation habits, recurring phrases, grounded directly in the pasted messages>", "confidence": "low"|"medium"|"high"}

Rules:
- These are the partner's own real words, so "voice" should be concrete and specific, not hedged, quote or closely paraphrase a couple of characteristic turns of phrase if any stand out.
- "confidence" should usually be "medium" or "high" here (this is direct evidence, not inference), use "low" only if the pasted text is very short or too generic to say much.
- Only include messages that are clearly FROM the partner (a two-sided chat export includes the user's own messages too, ignore those for "voice", though they can inform "profile" as context for how the partner responds).
- Never invent specific past events beyond what's shown. Paraphrase and generalize the profile; only "voice" should stay close to their literal wording.
- Do not mention "the user," "a chat export," or "pasted messages" in the profile/voice text itself, write both as a direct description of the partner.
- Write in the same language the messages are mostly written in, detect it automatically, the same way ChatGPT does.`;

const PARTNER_REAL_MESSAGES_MAX_CHARS = 12000;
const PARTNER_REAL_MESSAGES_MIN_CHARS = 40;

// Called from POST /api/partners/:id/learn-from-messages. Unlike
// learnPartnerProfileIfStale (fully automatic, runs on inferred Coach Chat
// mentions), this is an explicit user action — they chose to paste in real
// messages — so it always re-runs and overwrites whatever was there before,
// and marks the result learnedProfileSource: "real_messages" so
// learnPartnerProfileIfStale knows not to later overwrite it with a lower-
// quality inferred version (see the guard at the top of that function).
async function learnPartnerProfileFromRealMessages(partner, rawText) {
  const trimmed = String(rawText || "").trim();
  if (trimmed.length < PARTNER_REAL_MESSAGES_MIN_CHARS) {
    throw Object.assign(new Error("Paste a bit more (at least a few real messages) for this to work."), { status: 400 });
  }
  const capped = trimmed.slice(0, PARTNER_REAL_MESSAGES_MAX_CHARS);

  const userContent = `Partner's name: ${partner.name}${partner.context ? ` (context: ${partner.context})` : ""}

Pasted messages (may include both sides of the conversation):
"""
${capped}
"""`;

  const completion = await openai.chat.completions.create({
    model: STANDARD_MODEL,
    messages: [
      { role: "system", content: PARTNER_LEARN_FROM_REAL_TEXT_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
  const profile = String(parsed.profile || "").trim().slice(0, 800);
  const voice = String(parsed.voice || "").trim().slice(0, 300);
  const confidence = ["low", "medium", "high"].includes(parsed.confidence) ? parsed.confidence : "medium";

  if (!profile) {
    throw Object.assign(new Error("Couldn't pick up on much from that. Try pasting a longer or more typical stretch of messages."), { status: 400 });
  }

  partner.learnedProfile = profile;
  partner.learnedVoice = voice || null;
  partner.learnedProfileConfidence = confidence;
  partner.learnedProfileUpdatedAt = new Date().toISOString();
  partner.learnedProfileSource = "real_messages";
  savePartnerProfile(partner);
  return partner;
}

// Same shape/caps as buildInsightsDigest above — bounded and affordable
// even for a very active user.
function buildPartnerLearningDigest(conversations) {
  const recent = conversations.slice(0, 20); // caller sorts newest-first
  return recent
    .map((conv) => {
      const date = conv.createdAt ? String(conv.createdAt).slice(0, 10) : "undated";
      const userLines = (conv.messages || [])
        .filter((m) => m.role === "user")
        .slice(0, 20)
        .map((m) => String(m.content || "").slice(0, 400))
        .filter(Boolean);
      if (userLines.length === 0) return null;
      return `(${date}):\n${userLines.join("\n")}`;
    })
    .filter(Boolean)
    .join("\n\n---\n\n");
}

// Same idea as buildPartnerLearningDigest above, but for relationship-memory
// generation specifically (task #97: proactive follow-up on past advice) —
// this one deliberately keeps the coach's OWN replies in, labeled "Coach:",
// so RELATIONSHIP_MEMORY_SYSTEM_PROMPT can actually see what was suggested
// last time and note it for follow-up. buildPartnerLearningDigest stays
// user-only on purpose (it's building a profile of the PARTNER from what
// the user said about them — the coach's own words aren't relevant there),
// so this is a separate function rather than a shared one with a flag.
function buildRelationshipMemoryDigest(conversations) {
  const recent = conversations.slice(0, 20); // caller sorts newest-first
  return recent
    .map((conv) => {
      const date = conv.createdAt ? String(conv.createdAt).slice(0, 10) : "undated";
      const lines = (conv.messages || [])
        .slice(-20) // most recent turns of the conversation — where a wrap-up suggestion would be
        .map((m) => {
          const text = String(m.content || "").slice(0, 400).trim();
          if (!text) return null;
          return `${m.role === "user" ? "User" : "Coach"}: ${text}`;
        })
        .filter(Boolean);
      if (lines.length === 0) return null;
      return `(${date}):\n${lines.join("\n")}`;
    })
    .filter(Boolean)
    .join("\n\n---\n\n");
}

// Called automatically from POST /api/conversations right before a practice
// session starts — never from a user-facing button. Mutates `partner` in
// place and persists it itself (via savePartnerProfile) when it actually
// learns something new. Fails open: any error (including the OpenAI call
// itself) just leaves the partner's existing learned profile (or lack of
// one) untouched rather than blocking the user from starting their practice
// conversation.
async function learnPartnerProfileIfStale(db, userId, partner) {
  // A profile built from the partner's own real, pasted-in messages (see
  // learnPartnerProfileFromRealMessages / POST /api/partners/:id/learn-from-messages)
  // is direct evidence and higher quality than anything inferred secondhand
  // from what the user told Coach Chat — never let this automatic,
  // background process quietly downgrade it. The user can always paste in
  // fresh real messages later to update it explicitly.
  if (partner.learnedProfileSource === "real_messages") return;

  const userHasMultiplePartners = db.partnerProfiles.filter((p) => p.userId === userId).length > 1;

  let coachConversations = db.conversations
    .filter((c) => c.userId === userId && c.mode !== "practice")
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // See the block comment above: with more than one partner profile, only
  // conversations explicitly tagged to THIS partner are usable material.
  if (userHasMultiplePartners) {
    coachConversations = coachConversations.filter((c) => c.aboutPartnerId === partner.id);
  }
  if (coachConversations.length === 0) return;

  const newestActivity = coachConversations.reduce((max, c) => {
    const t = new Date(c.updatedAt || c.createdAt || 0).getTime();
    return t > max ? t : max;
  }, 0);
  const lastLearnedAt = partner.learnedProfileUpdatedAt ? new Date(partner.learnedProfileUpdatedAt).getTime() : 0;
  if (partner.learnedProfile && lastLearnedAt >= newestActivity) return; // already up to date, nothing new to learn from

  const totalUserMessages = coachConversations.reduce(
    (sum, c) => sum + (c.messages || []).filter((m) => m.role === "user").length,
    0
  );
  if (totalUserMessages < MIN_COACH_MESSAGES_FOR_PARTNER_LEARNING) return; // not enough material yet — quietly skip, try again next time

  try {
    const digest = buildPartnerLearningDigest(coachConversations);
    const userContent = `Target partner's name: ${partner.name}${partner.context ? ` (context: ${partner.context})` : ""}

Past Coach Chat messages, already confirmed to be about this partner (the user's own words, most recent conversations first):
"""
${digest}
"""`;

    const completion = await openai.chat.completions.create({
      model: STANDARD_MODEL,
      messages: [
        { role: "system", content: PARTNER_LEARN_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    const profile = String(parsed.profile || "").trim().slice(0, 800);
    const voice = String(parsed.voice || "").trim().slice(0, 300);
    const confidence = ["low", "medium", "high"].includes(parsed.confidence) ? parsed.confidence : "low";

    if (profile) {
      partner.learnedProfile = profile;
      partner.learnedVoice = voice || null;
      partner.learnedProfileConfidence = confidence;
      partner.learnedProfileUpdatedAt = new Date().toISOString();
      partner.learnedProfileSource = "coach_chat";
      savePartnerProfile(partner);
    }
  } catch (err) {
    console.error("Partner auto-learn error:", err.message);
    // Fail open — leave the partner's profile as it was, don't block practice mode.
  }
}

// ---------------------------------------------------------------------------
// Relationship memory — a standing, cross-conversation summary of recurring
// themes/patterns from a user's own Coach Chat history (not tied to any one
// partner — this is about the user and their situation generally), injected
// into buildCoachSystemPrompt so Coach Chat has continuity across separate
// conversations instead of starting from zero every time. Mirrors
// learnPartnerProfileIfStale's shape and reuses buildPartnerLearningDigest
// (which is generic over any list of conversations, not partner-specific).
// Fully automatic, fails open, and throttled on two axes: enough new
// material since the last refresh (same MIN_COACH_MESSAGES threshold), and
// at most once per RELATIONSHIP_MEMORY_MIN_REFRESH_HOURS regardless, so
// starting lots of new Coach Chat conversations in a short span doesn't
// spam the model.
// ---------------------------------------------------------------------------

const RELATIONSHIP_MEMORY_MIN_REFRESH_HOURS = 24;

const RELATIONSHIP_MEMORY_SYSTEM_PROMPT = `You are reading a user's own past AI relationship-coaching conversations (Coach Chat) (including the coach's own past replies, labeled "Coach:") to build a short standing "memory" so a future coaching conversation can pick up with continuity instead of starting from zero. You are NOT giving advice here and NOT summarizing any single conversation.

Respond with ONLY a JSON object, no other text before or after it, in exactly this shape:
{"memory": "<3-6 plain sentences, in the user's language, naming recurring topics, people, or patterns that show up more than once, e.g. a recurring point of friction, a person who's mentioned repeatedly, a pattern in how the user reacts under stress. Empty string if there's genuinely no recurring pattern yet, just isolated one-off topics.>", "lastSuggestion": "<one plain sentence, in the user's language, naming the single most recent concrete action or next step the Coach suggested, 'suggested asking her directly whether she wants space or reassurance when she goes quiet,' not 'talked about communication.' Empty string if the last conversation didn't end with a concrete suggestion, if the user already reported back on whether they tried it, or if too much time/too many other topics have passed since for a check-in to make sense.>"}

Rules for "memory":
- Only include what's genuinely recurring (shows up across more than one conversation), a single conversation's topic is not a pattern, even if that conversation was intense.
- Write it as calm, factual continuity notes for a coach to privately keep in mind, not a diagnosis, not a verdict on the user or anyone they've mentioned.
- Never invent specific events that weren't described. Paraphrase and generalize rather than quoting verbatim.
- Do not address the user directly ("you..."), write it as a third-person note, e.g. "Recurring tension around..." or "Has mentioned [pattern] more than once...".

Rules for "lastSuggestion":
- This one does NOT need to be recurring, a single most-recent conversation is exactly the right source for it.
- Only the single most recent one, from the most recent conversation that actually ended with a concrete suggestion, not a running list of every suggestion ever given.
- Must be something concrete enough to ask "did you try this" about, a specific action, message, or conversation to have. A general insight or reframe ("realized she pulls away when stressed") is not a suggestion; skip it.
- If the user's next conversation already mentions how it went, that suggestion is resolved, leave this empty rather than re-surfacing it.

Write both fields in the same language the messages are mostly written in, detect it automatically, the same way ChatGPT does.`;

async function updateRelationshipMemoryIfStale(db, user) {
  const lastUpdatedAt = user.relationshipMemoryAt ? new Date(user.relationshipMemoryAt).getTime() : 0;
  const hoursSinceLastUpdate = (Date.now() - lastUpdatedAt) / (1000 * 60 * 60);
  if (lastUpdatedAt && hoursSinceLastUpdate < RELATIONSHIP_MEMORY_MIN_REFRESH_HOURS) return; // refreshed recently enough

  const coachConversations = db.conversations
    .filter((c) => c.userId === user.id && c.mode !== "practice")
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (coachConversations.length === 0) return;

  const newestActivity = coachConversations.reduce((max, c) => {
    const t = new Date(c.updatedAt || c.createdAt || 0).getTime();
    return t > max ? t : max;
  }, 0);
  if (user.relationshipMemory && lastUpdatedAt >= newestActivity) return; // nothing new since last time

  const totalUserMessages = coachConversations.reduce(
    (sum, c) => sum + (c.messages || []).filter((m) => m.role === "user").length,
    0
  );
  if (totalUserMessages < MIN_COACH_MESSAGES_FOR_PARTNER_LEARNING) return; // not enough material yet

  try {
    // buildRelationshipMemoryDigest (not buildPartnerLearningDigest) — this
    // one keeps the coach's own past replies in, so the model can actually
    // see what was suggested last time and note it in "lastSuggestion" for
    // proactive follow-up (task #97). See that function's own comment.
    const digest = buildRelationshipMemoryDigest(coachConversations);
    const userContent = `Past Coach Chat messages, most recent conversations first (both the user's own words and the Coach's past replies, labeled):
"""
${digest}
"""`;

    const completion = await openai.chat.completions.create({
      model: STANDARD_MODEL,
      messages: [
        { role: "system", content: RELATIONSHIP_MEMORY_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    const memory = String(parsed.memory || "").trim().slice(0, 900);
    const lastSuggestion = String(parsed.lastSuggestion || "").trim().slice(0, 300);
    // Both fields fold into the single relationshipMemory text column
    // (no schema change needed — see buildCoachSystemPrompt, which already
    // treats relationshipMemory as one continuity note and now recognizes
    // this "Most recent suggestion:" line specifically to drive follow-up).
    const combined = [memory, lastSuggestion ? `Most recent suggestion: ${lastSuggestion}` : ""].filter(Boolean).join("\n\n");

    if (combined) {
      user.relationshipMemory = combined;
      user.relationshipMemoryAt = new Date().toISOString();
      saveUser(user);
    } else {
      // Nothing recurring or actionable yet — still bump the timestamp so we
      // don't re-query the model again until either the cooldown or new
      // material makes that worthwhile.
      user.relationshipMemoryAt = new Date().toISOString();
      saveUser(user);
    }
  } catch (err) {
    console.error("Relationship memory update error:", err.message);
    // Fail open — leave whatever memory (or lack of one) already existed.
  }
}

// ---------------------------------------------------------------------------
// Memory v2 (see lib/memory.js). Runs in the background after a Coach Chat
// conversation goes quiet, and once more (bounded) when a new conversation
// starts. It never blocks or breaks a reply: every failure just keeps the
// previous memory. The old updateRelationshipMemoryIfStale above is no longer called.
// ---------------------------------------------------------------------------
const memoryRunning = new Set();
const memoryTimers = new Map();
const memoryFailAt = new Map();
const MEMORY_DAILY_RUNS = 30;
const MEMORY_DEBOUNCE_MS = Number(process.env.MEMORY_DEBOUNCE_MS) || 45 * 1000;
const MEMORY_FAIL_COOLDOWN_MS = 5 * 60 * 1000;
const MEMORY_MODEL_TIMEOUT_MS = 60 * 1000;

function loadMemoryDoc(userId) {
  const doc = getDocByKey(userId, Mem.MEMORY_KIND, Mem.MEMORY_KEY);
  return { doc, mem: Mem.normalizeMemory(doc && doc.data) };
}

function saveMemory(userId, doc, mem) {
  mem.updatedAt = new Date().toISOString();
  saveDoc({
    id: (doc && doc.id) || generateId("doc"),
    userId,
    kind: Mem.MEMORY_KIND,
    key: Mem.MEMORY_KEY,
    title: "Memory",
    data: mem,
    createdAt: doc && doc.createdAt,
    notifiedAt: null,
  });
  // The plain-text form that Coach Chat and the older features read.
  setUserMemoryColumns(userId, Mem.renderMemoryText(mem) || null, mem.updatedAt);
}

async function runMemoryUpdate(userId) {
  if (memoryRunning.has(userId)) {
    scheduleMemoryUpdate(userId, 15 * 1000);
    return;
  }
  memoryRunning.add(userId);
  try {
    const user = getUserById(userId);
    if (!user) return;
    const now = new Date();
    const failAt = memoryFailAt.get(userId);
    if (failAt && now.getTime() - failAt < MEMORY_FAIL_COOLDOWN_MS) return;
    const { doc, mem } = loadMemoryDoc(userId);
    if (Mem.runsToday(mem, now) >= MEMORY_DAILY_RUNS) return;
    const conversations = listConversationsForUser(userId);
    const first = !doc;
    const { picked, covered } = Mem.collectNewMaterial(conversations, mem.processed);
    if (!picked.length) return;

    let out = null;
    try {
      const completion = await Promise.race([
        openai.chat.completions.create({
          model: STANDARD_MODEL,
          messages: [
            { role: "system", content: Mem.MEMORY_UPDATE_PROMPT },
            {
              role: "user",
              content: Mem.buildUpdateUserContent({
                current: mem,
                legacyText: first ? user.relationshipMemory : "",
                material: picked,
                today: now.toISOString().slice(0, 10),
              }),
            },
          ],
          response_format: { type: "json_object" },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("memory update timed out")), MEMORY_MODEL_TIMEOUT_MS)),
      ]);
      out = JSON.parse(completion.choices[0]?.message?.content || "{}");
    } catch (err) {
      console.error("Memory update error:", err.message);
      memoryFailAt.set(userId, Date.now());
      return;
    }

    const next = Mem.applyModelUpdate(mem, out);
    const result = next || mem; // unusable answer: keep what we had, but do not reprocess the same material forever
    Mem.bumpRuns(result, now);
    if (first) Object.assign(result.processed, Mem.baselineProcessed(conversations)); // older history is covered by the legacy note
    Mem.markProcessed(result, covered);

    // If the user forgot something (or another run finished) while the model was thinking, drop this result.
    const fresh = getDocByKey(userId, Mem.MEMORY_KIND, Mem.MEMORY_KEY);
    if ((fresh ? fresh.updatedAt : null) !== (doc ? doc.updatedAt : null)) {
      scheduleMemoryUpdate(userId, 5 * 1000);
      return;
    }
    saveMemory(userId, doc, result);
  } catch (err) {
    console.error("Memory update crashed:", err.message);
  } finally {
    memoryRunning.delete(userId);
  }
}

function scheduleMemoryUpdate(userId, delayMs = MEMORY_DEBOUNCE_MS) {
  const old = memoryTimers.get(userId);
  if (old) clearTimeout(old);
  const t = setTimeout(() => {
    memoryTimers.delete(userId);
    runMemoryUpdate(userId).catch((err) => console.error("Memory update error:", err.message));
  }, delayMs);
  if (t.unref) t.unref();
  memoryTimers.set(userId, t);
}

// Called when a new Coach Chat conversation starts: catch up on anything not yet
// processed, but never hold the user up for long.
async function ensureMemoryFresh(userId, maxWaitMs = 4000) {
  try {
    const old = memoryTimers.get(userId);
    if (old) {
      clearTimeout(old);
      memoryTimers.delete(userId);
    }
    await Promise.race([runMemoryUpdate(userId), new Promise((resolve) => setTimeout(resolve, maxWaitMs))]);
  } catch (err) {
    console.error("ensureMemoryFresh error:", err.message);
  }
}

// intensity: "realistic" (default) plays real friction/defensiveness when the
// personality calls for it; "supportive" is a gentler mode for someone who
// just wants to practice saying a hard thing out loud once, without also
// having to handle pushback — still in character, just not stress-tested.
// roleSwap: when true, the USER voices their partner's side of the
// conversation and the AI instead plays the user's own likely reaction, so
// the user can hear how their own responses tend to land from the outside.
// See PARTNER_PROFILE ("intensity"/"roleSwap" on the conversation, not the
// saved partner profile — both are per-rehearsal, not permanent settings).
function buildPartnerSystemPrompt(partner) {
  const traits = (partner.traits || "").trim() || "a warm but sometimes distracted long-term partner";
  const context = (partner.context || "").trim();
  const scenario = (partner.scenario || "").trim();
  const intensity = partner.intensity === "supportive" ? "supportive" : partner.intensity === "tough" ? "tough" : "realistic";

  if (partner.roleSwap) {
    // Role-swap: the user types AS their partner. The AI is no longer
    // playing the partner at all — it plays a plausible version of the
    // USER'S OWN side of the conversation, so the user can rehearse from
    // the listener's seat and notice how their own typical responses land.
    const userStyleKey = partner.userAttachmentStyle;
    const userStyleNote = userStyleKey
      ? `The person you're voicing (the app's user) has a self-reported attachment style of ${ATTACHMENT_STYLES[userStyleKey]?.name || userStyleKey}: ${ATTACHMENT_STYLES[userStyleKey]?.desc || ""} Let this quietly shape how "you" tend to react, don't mention it.`
      : "";
    return `You are helping someone practice a real conversation by playing an unusual role: instead of playing their partner, YOU are playing THEM (the user) (their own likely side of the conversation) while they type as their partner, "${partner.name}"${context ? ` (${context})` : ""}, to hear what it might be like on the receiving end of their own usual reactions.

What's known about the user whose side you're voicing:
Personality/context they've described about themselves and this relationship: ${traits}.
${userStyleNote ? `${userStyleNote}\n` : ""}${scenario ? `This rehearsal is specifically about: "${scenario}". Let your responses naturally move toward it as the conversation develops.\n` : ""}
Rules:
- Speak in first person as the user would, casually, the way a real partner texts back. Not like an assistant, and don't be a passive yes-man: react the way this person plausibly would, including a bit of defensiveness, distraction, or slowness to warm up where that realistically fits, in the ${intensity === "supportive" ? "gentler, good-faith" : "realistic"} range the user asked for.
- Never break character to give advice or meta-commentary about the roleplay, unless the user explicitly asks to pause/stop, or the conversation touches on real self-harm, abuse, or a genuine crisis.
- Keep replies texting-length, a sentence or two, occasionally more.
- Always reply in the same language the user writes in, detect it automatically. Never ask which language to use.
- Never use em dashes or en dashes (the long "—" or "–" characters) in anything you write. Use a comma, a period, a colon or a new sentence instead, the way people actually write in texts and emails.`;
  }

  const attachmentNote = partnerAttachmentBehavior(partner.attachmentStyle);
  const learnedNote = (partner.learnedProfile || "").trim();
  const voiceNote = (partner.voice || "").trim();
  // When the user's own attachment style is also known (user.attachmentStyle
  // — in practice this is permanently unset now, see the comment on it in
  // buildCoachSystemPrompt above), reuse the same pairing write-ups
  // compatText produces — the dynamic between two specific styles is more
  // useful for a realistic roleplay than either style described in
  // isolation.
  const compatNote =
    partner.userAttachmentStyle && partner.attachmentStyle
      ? `How this specific pairing tends to play out (user is ${ATTACHMENT_STYLES[partner.userAttachmentStyle]?.name || partner.userAttachmentStyle}, you are ${ATTACHMENT_STYLES[partner.attachmentStyle]?.name || partner.attachmentStyle}): ${compatText(partner.userAttachmentStyle, partner.attachmentStyle)}`
      : "";

  const intensityRule =
    intensity === "tough"
      ? "This is the HARD mode the user chose on purpose to stress-test a difficult conversation: react the way this person would on a bad day. Be guarded, deflect, get defensive, interrupt, bring up an old grievance, go quiet or change the subject, and do NOT soften just because the user says the right thing once: ease up only if they stay calm, specific and blame-free across several messages, and even then only a little. Stay realistic and in character, never cartoonish. Never model abuse, threats, cruelty for its own sake, or anything humiliating."
      : intensity === "supportive"
      ? "React the way someone with these traits would, but lean toward good faith and de-escalation, this gentler mode is for building the confidence to say something out loud once, not for stress-testing worst-case reactions. Stay authentic to the personality; just don't manufacture conflict, shut down, or pile on defensiveness for its own sake."
      : "React the way someone with these traits realistically would, including realistic friction, defensiveness, or distance when that fits the personality, this is what makes the practice useful.";

  return `You are role-playing as "${partner.name}", the user's romantic partner${context ? ` (${context})` : ""}, inside a private practice/rehearsal space the user opened on purpose to practice a real conversation.

Personality and traits to embody: ${traits}.
${learnedNote ? `\nWhat RelationshipAI has learned about them from the user's own past conversations: ${learnedNote}\n` : ""}${voiceNote ? `\nHow they specifically tend to phrase things, match this voice, not just a generic texting style: ${voiceNote}\n` : ""}${attachmentNote ? `\n${attachmentNote}\n` : ""}${compatNote ? `\n${compatNote}\n` : ""}${scenario ? `\nThis rehearsal is specifically about: "${scenario}". Let the conversation naturally move toward this if it hasn't already (the way a real conversation would) but don't force it awkwardly into your very first reply.\n` : ""}
Rules:
- Stay fully in character as ${partner.name}. Speak in first person, casually, the way a real partner texts, short, natural, imperfect. Not like an assistant.
- Never break character to give advice, disclaimers, or meta-commentary about the roleplay, unless the user explicitly asks to pause/stop it, or the conversation touches on real self-harm, abuse, or a genuine crisis, in that case, gently step out of character and respond with care instead of continuing the scene.
- ${intensityRule} But never model abuse, cruelty for its own sake, or anything humiliating.
- Keep replies texting-length, a sentence or two, occasionally more if the moment calls for it. Not essays.
- Always reply in the same language the user writes in, detect it automatically, the same way ChatGPT does. Never ask which language to use. If they switch languages mid-conversation, switch with them.
- Never use em dashes or en dashes (the long "—" or "–" characters) in anything you write. Use a comma, a period, a colon or a new sentence instead, the way people actually write in texts and emails.`;
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
    const upgradeHint = user.plan === "free" ? " Upgrade to Pro for unlimited attachments." : "";
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
      url: `/uploads/${user.id}/${filename}`,
      // Not persisted to the DB — only used for this one OpenAI call below,
      // so images/text files can be fed to the model without re-reading
      // from disk (and without ever storing raw base64 in the database).
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
// plain text instead, since the coaching models can't open video/files directly.
function buildModelContent(message, savedAttachments) {
  const imageParts = [];
  let extraText = "";

  for (const att of savedAttachments) {
    if (att.kind === "image") {
      // detail: "high" — the default ("auto") sometimes downsamples an
      // image before OpenAI decides it's worth full resolution, which is
      // exactly wrong for this app's most common image use case: a
      // screenshot of a real text conversation, where the whole point is
      // reading small chat-bubble text accurately. The cost difference is
      // trivial next to getting a drafted reply wrong because a word was
      // misread.
      imageParts.push({ type: "image_url", image_url: { url: att._dataUrl, detail: "high" } });
    } else if (att.kind === "text") {
      const base64 = att._dataUrl.split(",")[1] || "";
      const decoded = Buffer.from(base64, "base64").toString("utf-8").slice(0, 6000);
      extraText += `\n\n[Attached file: ${att.name}]\n"""\n${decoded}\n"""`;
    } else {
      const label = att.kind === "video" ? "video" : "file";
      extraText += `\n\n[Attached ${label}: ${att.name} (${att.mimeType}, ${formatBytes(att.size)}), I can't open this file directly, so please describe what's relevant in it if it matters.]`;
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

// Hand-written, not AI-generated — same reasoning as ATTACHMENT_COMPAT below:
// only 4 fixed styles exist, so each is written once here rather than asked
// of the model per request. This is a *separate* set of descriptions from
// ATTACHMENT_STYLES.desc above: that one describes how someone experiences
// their own style firsthand, this one describes how a partner *behaves in
// a live back-and-forth conversation* — what actually shows up in dialogue —
// since Practice Mode needs behavioral cues to roleplay convincingly, not a
// first-person self-description.
const PARTNER_ATTACHMENT_BEHAVIOR = {
  secure: "This partner's attachment style is Secure: when conflict comes up they stay engaged rather than shutting down or escalating. They can say plainly when something bothered them, they don't need repeated reassurance to feel okay, and they don't stonewall, though they're still a real person who can be tired, distracted, or short with you sometimes.",
  anxious: "This partner's attachment style is Anxious: they notice small shifts (a short reply, a slower response, a change in tone) and it genuinely unsettles them. In this conversation they may ask for reassurance more than once, read into your wording, or want things stated plainly rather than assumed. This isn't neediness for its own sake, connection matters a lot to them and its absence is uncomfortable.",
  avoidant: "This partner's attachment style is Avoidant: when things get emotionally intense, their instinct is to create space, shorter replies, changing the subject, or wanting a minute before continuing. They're not indifferent, but they process things internally first, and being pushed to \"talk about it right now\" can make them pull back further rather than open up.",
  disorganized: "This partner's attachment style is Disorganized (Fearful-Avoidant): they want closeness and want to protect themselves from it, sometimes within the same exchange. They might respond warmly and then suddenly get guarded, or bring up an old hurt when the moment feels too vulnerable. Play this as genuinely how it feels from the inside, not as inconsistency for effect.",
};

function partnerAttachmentBehavior(styleKey) {
  return PARTNER_ATTACHMENT_BEHAVIOR[styleKey] || "";
}

// Hand-written, not AI-generated — attachment styles are a fixed set of 4,
// so every one of the 10 unordered pairings can just be written once and
// reused, which is both cheaper and more reliable than calling the model
// for something that never actually changes. Keyed by the two style names
// sorted alphabetically and joined with "|" (see compatKey below), so each
// pairing only needs one entry regardless of which partner has which style.
const ATTACHMENT_COMPAT = {
  "secure|secure": "Attachment research points to this as the easiest pairing to sustain, you can each ask for what you need and tolerate your partner doing the same, without conflict automatically feeling like a threat to the relationship itself. The risk here isn't conflict, it's coasting: a secure-secure pair can go a long time without deliberately checking in, simply because nothing ever feels urgent enough to force the conversation.",
  "anxious|secure": "A secure partner's steadiness is genuinely reassuring to an anxious one, but only if it's paired with plain, consistent communication rather than an assumption that the anxious partner should already feel secure. A silence the secure partner reads as \"nothing\" can read as danger to the anxious one, so naming things out loud matters more here than it would with another secure partner.",
  "avoidant|secure": "A secure partner's patience tends to earn the trust that lets an avoidant partner slowly lower their guard, but not on a schedule. Pushing for closeness faster than an avoidant partner sets the pace themselves usually backfires; the secure partner's consistency does more of the work here than any direct request could.",
  "disorganized|secure": "A secure partner offers a steadiness that a disorganized partner both wants and, in an intense moment, may struggle to fully trust. This pairing tends to improve slowly, through months of consistency, rather than through any single reassuring conversation. Disorganized attachment tends to soften from repeated proof, not from being told it's safe.",
  "anxious|anxious": "Two anxious partners can create a closeness that feels intense and mutual at first, but a delay in one person's response can trigger a spiral in the other, who then seeks even more reassurance, sometimes faster than either can actually give it. Naming the spiral out loud the moment it starts tends to defuse it faster than either partner quietly trying to reassure the other.",
  "anxious|avoidant": "One of the most studied and most difficult pairings: the anxious partner's push for closeness can read as pressure to the avoidant one, who pulls back, which then reads as confirmation of exactly what the anxious partner was afraid of, so they push harder. Breaking the cycle usually starts with the avoidant partner naming *when* they'll re-engage instead of just going quiet, and the anxious partner practicing tolerating a stated pause without treating it as rejection.",
  "anxious|disorganized": "An anxious partner's need for reassurance meets a disorganized partner who genuinely wants to give it, but who can sometimes struggle to get close enough to in the moment without their own alarm kicking in, so the anxious partner's reassurance-seeking can accidentally trigger the very withdrawal they're afraid of. Slowing down how fast reassurance is expected to arrive tends to help both sides.",
  "avoidant|avoidant": "Two avoidant partners often mistake giving each other space for closeness, which can work smoothly for a long stretch, but it can also leave both people under-practiced at naming needs when something actually does go wrong, since neither one is used to being the one who pushes to talk it through.",
  "avoidant|disorganized": "An avoidant partner's instinct to handle things alone can look, to a disorganized partner, uncomfortably like being shut out, which activates the same alarm a disorganized partner feels whenever closeness turns unpredictable. Small, low-stakes check-ins tend to land better here than one big vulnerable conversation, since they build trust in smaller, safer doses.",
  "disorganized|disorganized": "Two disorganized partners can find that each other's push-pull rhythm feels familiar rather than confusing, but a hard moment can flare into both partners pulling away or lashing out at once, with neither able to be the steady one. Having a specific, agreed-on way to pause and reconnect later matters more in this pairing than in almost any other.",
};

function compatKey(a, b) {
  return [a, b].sort().join("|");
}

function compatText(a, b) {
  return (
    ATTACHMENT_COMPAT[compatKey(a, b)] ||
    "Every pairing has its own rhythm. The label matters less than noticing the pattern together and naming it when it shows up."
  );
}

const CHECKIN_QUESTIONS = [
  "What's one small thing your partner did recently that you appreciated, even if you didn't say it out loud?",
  "Is there something you've been meaning to bring up but keep putting off? What's stopping you?",
  "On a scale of 1-10, how connected have you felt to your partner this week, and what would move that number up by one point?",
  "What's a need of yours that's gone unspoken lately?",
  "When did you last feel truly listened to by your partner? What made it feel that way?",
  "Is there a small resentment building up that's still small enough to name calmly?",
  "What's one thing you could do today to make your partner's day a little easier?",
  "How did you handle the last disagreement you had, and is there anything you'd do differently now?",
  "What's something about your relationship you're quietly grateful for right now?",
  "Have you and your partner had any real, undistracted time together this week?",
  "What's a boundary you've been meaning to set, with your partner or with someone else?",
  "If your partner described how you've been lately in one word, what do you think they'd say?",
  "What's one assumption you're making about your partner right now that you haven't actually checked?",
  "How are you doing outside of the relationship (sleep, stress, work)? It shapes more of this than it gets credit for.",
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
    exportSummaries:
      user.plan === "free" ? { used: listDocs(user.id, "export").length, limit: FREE_LIFETIME_EXPORT_LIMIT } : null,
    emailVerified: !!user.emailVerifiedAt,
    // True only when the server will actually block unverified accounts, so
    // the client only nags about verification when it matters.
    emailVerificationRequired: isEmailVerificationEnforced() && !user.emailVerifiedAt,
    // Fair-use meter for the paid plans (null on Free, which has its own
    // daily meter above).
    monthlyUsage:
      user.plan === "free"
        ? null
        : {
            used: user.usageMonthly && user.usageMonthly.month === monthKey() ? user.usageMonthly.count : 0,
            limit: monthlyLimitFor(user.plan),
          },
    // Monthly budget of messages on the strong model (null on Free).
    strongModelUsage:
      user.plan === "free" ? null : { used: strongModelUsed(user), limit: strongModelBudgetFor(user.plan) },
    coachStrongUsage: user.plan === "pro" ? { used: coachStrongUsed(user), limit: PRO_COACH_STRONG_BUDGET } : null,
    isAdmin: (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .includes(user.email),
  };
}

function publicPartner(p) {
  return {
    id: p.id,
    name: p.name,
    traits: p.traits,
    context: p.context,
    attachmentStyle: p.attachmentStyle || null,
    learnedProfile: p.learnedProfile || null,
    learnedVoice: p.learnedVoice || null,
    learnedProfileConfidence: p.learnedProfileConfidence || null,
    learnedProfileUpdatedAt: p.learnedProfileUpdatedAt || null,
    learnedProfileSource: p.learnedProfileSource || null,
    createdAt: p.createdAt,
  };
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
    const db = loadDb();
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

// Free plan: how many therapist-summary exports this account has used in
// total. A marker doc is written per export (so deleting the conversation
// doesn't give the export back); summaries generated before markers existed
// still count via the conversations themselves.
function freeExportsUsed(db, userId) {
  const markers = listDocs(userId, "export").length;
  const legacy = (db.conversations || []).filter((c) => c.userId === userId && c.therapistSummary).length;
  return Math.max(markers, legacy);
}

// Shared free-tier gate for every endpoint that makes an OpenAI call.
// Returns true (and has already sent a 429) if the user is blocked.
// `opts.skipFreeDaily`: Free-plan Practice has its own cap (see
// FREE_PRACTICE_MAX_USER_MESSAGES) and does not draw on the 8/day Coach pool;
// the verification gate above still applies.
function isOverDailyLimit(user, res, opts = {}) {
  // Unverified email -> no AI calls (stops throw-away-address signups from
  // burning OpenAI credit). Only enforced when verification emails can
  // actually be sent; accounts that pre-date verification are grandfathered
  // as verified by the DB migration.
  if (isEmailVerificationEnforced() && !user.emailVerifiedAt) {
    res.status(403).json({
      error: "Please verify your email address first. We sent you a link when you signed up. You can request a new one with the “Resend email” button.",
      verificationRequired: true,
    });
    return true;
  }
  if (user.plan !== "free") {
    const limit = monthlyLimitFor(user.plan);
    const month = monthKey();
    const used = user.usageMonthly && user.usageMonthly.month === month ? user.usageMonthly.count : 0;
    if (limit && used >= limit) {
      res.status(429).json({
        error: `You've reached this month's fair-use limit of ${limit} AI messages on your plan. It resets on the 1st. If you regularly need more, get in touch and we'll sort something out.`,
        monthlyLimitReached: true,
      });
      return true;
    }
    return false;
  }
  if (opts.skipFreeDaily) return false;
  const today = todayKey();
  if (!user.usage || user.usage.date !== today) {
    user.usage = { date: today, count: 0 };
  }
  if (user.usage.count >= FREE_DAILY_LIMIT) {
    res.status(429).json({
      error: `You've reached the Free plan's daily limit of ${FREE_DAILY_LIMIT} AI messages. Try again tomorrow, or upgrade to Pro.`,
      // Lets the client show a real "Upgrade to Pro" button instead of just
      // dead error text — same flag the other plan-limit responses use
      // (see the Partner Practice and attachment limits above/below).
      upgradeRequired: true,
      dailyLimitReached: true,
    });
    return true;
  }
  return false;
}

// Call once an AI call has actually succeeded and should count against the
// free-plan daily limit. Persists the increment atomically (see
// incrementUserUsage in lib/store.js — a single UPDATE that resets-or-
// increments in one statement, so two concurrent requests can't stomp on
// each other's count) and also updates the in-memory `user.usage` so the
// response the caller sends back reflects the new count.
function bumpFreeUsage(user) {
  const today = todayKey();
  incrementUserUsage(user.id, today);
  user.usage = { date: today, count: (user.usage?.date === today ? user.usage.count : 0) + 1 };
}

// One call after every successful AI call, whatever the plan: Free counts
// against the daily pool, Pro/Premium against their monthly fair-use cap.
function bumpUsage(user, model, opts = {}) {
  if (user.plan === "free") return bumpFreeUsage(user);
  const month = monthKey();
  incrementUserMonthlyUsage(user.id, month);
  const prev = user.usageMonthly && user.usageMonthly.month === month ? user.usageMonthly.count : 0;
  user.usageMonthly = { month, count: prev + 1 };
  // Calls that ran on the strong model also draw down its monthly budget.
  if (model === PREMIUM_MODEL) {
    if (opts.coachPool) {
      incrementUserCoachStrongUsage(user.id, month);
      user.usageCoachStrong = { month, count: coachStrongUsed(user) + 1 };
    } else {
      incrementUserPremiumUsage(user.id, month);
      user.usagePremium = { month, count: strongModelUsed(user) + 1 };
    }
  }
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
async function creditOneMonth(targetUser, amountCents, currency, description) {
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
    currency,
    description,
  });
}

// Called right after a user's checkout completes for the very first time
// (free -> paid). If they were referred, credits BOTH accounts one free
// month — valued at the price of the plan that was just subscribed to,
// since that's the plan action that actually triggered the reward. Never
// fires twice for the same referred user (referralRewardGranted guards it).
async function grantReferralRewardIfDue(user, priceId) {
  if (!stripe || !user.referredBy || user.referralRewardGranted) return;
  const referrer = getUserById(user.referredBy);
  if (!referrer) return;

  try {
    const price = await stripe.prices.retrieve(priceId);
    const amount = price?.unit_amount;
    const currency = price?.currency || "eur";
    if (!amount) return;

    await creditOneMonth(user, amount, currency, "Thanks for joining through a RelationshipAI invite, 1 month on us");
    await creditOneMonth(referrer, amount, currency, "Thanks for inviting a friend to RelationshipAI, 1 month on us");

    user.referralRewardGranted = true;
    saveUser(user);
    saveUser(referrer);
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
  const answeredDates = new Set(
    checkins.filter((c) => c.userId === userId && !c.skipped && (c.answer || typeof c.score === "number")).map((c) => c.date)
  );
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
// Playbook — small real-life experiments from Coach advice. The Coach ends a
// reply with a [[try: ...]] line (stripped server-side, see the messages
// route); the user taps "I'll try it", and a reminder two days later asks
// how it went. Free: one experiment at a time and the last 7 days of
// results; Pro+: any number at once and the full history; Premium also gets
// an AI read of their whole playbook.
// ---------------------------------------------------------------------------

const PLAYBOOK_REMIND_AFTER_MS = 2 * 24 * 60 * 60 * 1000;
const PLAYBOOK_LIMITS = {
  free: { maxActive: 1, historyDays: null },
  pro: { maxActive: 50, historyDays: null },
  premium: { maxActive: 50, historyDays: null },
};
function playbookLimitsFor(user) {
  return PLAYBOOK_LIMITS[user.plan] || PLAYBOOK_LIMITS.free;
}
function publicExperiment(r) {
  return {
    id: r.id,
    text: r.text,
    status: r.status,
    note: r.note || null,
    conversationId: r.conversationId || null,
    createdAt: r.createdAt,
    resolvedAt: r.resolvedAt || null,
  };
}

app.get("/api/playbook", authMiddleware, (req, res) => {
  const limits = playbookLimitsFor(req.user);
  const all = listExperimentsForUser(req.user.id);
  const cutoff = limits.historyDays ? Date.now() - limits.historyDays * 86400000 : null;
  const active = all.filter((r) => r.status === "active").map(publicExperiment);
  const resolved = all.filter((r) => r.status !== "active");
  const visible = resolved.filter((r) => !cutoff || new Date(r.resolvedAt || r.createdAt).getTime() >= cutoff);
  res.json({
    plan: req.user.plan,
    maxActive: limits.maxActive,
    historyDays: limits.historyDays,
    active,
    worked: visible.filter((r) => r.status === "worked").map(publicExperiment),
    didntHelp: visible.filter((r) => r.status === "didnt_help").map(publicExperiment),
    notTried: visible.filter((r) => r.status === "not_tried").map(publicExperiment),
    hiddenCount: resolved.length - visible.length,
    totalResolved: resolved.length,
  });
});

app.post("/api/playbook", authMiddleware, (req, res) => {
  try {
    const { text, conversationId, messageId } = req.body || {};
    const clean = String(text || "").replace(/\s+/g, " ").trim().slice(0, 200);
    if (clean.length < 3) return res.status(400).json({ error: "Write what you want to try first." });

    const existing = getExperimentByMessage(req.user.id, messageId ? String(messageId) : null);
    if (existing) return res.json({ experiment: publicExperiment(existing), already: true });

    const limits = playbookLimitsFor(req.user);
    if (countActiveExperiments(req.user.id) >= limits.maxActive) {
      return res.status(403).json({
        error:
          req.user.plan === "free"
            ? "You're already trying one thing. Finish it first, or upgrade to Pro to try several at once."
            : "You have a lot of experiments running. Finish a few first.",
        upgrade: req.user.plan === "free",
      });
    }

    const now = new Date();
    const row = createExperiment({
      id: generateId("exp"),
      userId: req.user.id,
      text: clean,
      conversationId: conversationId ? String(conversationId) : null,
      messageId: messageId ? String(messageId) : null,
      createdAt: now.toISOString(),
      remindAt: new Date(now.getTime() + PLAYBOOK_REMIND_AFTER_MS).toISOString(),
    });
    res.json({ experiment: publicExperiment(row) });
  } catch (err) {
    console.error("Create experiment error:", err);
    res.status(500).json({ error: "Couldn't save that. Please try again." });
  }
});

app.post("/api/playbook/:id/result", authMiddleware, (req, res) => {
  const row = getExperiment(req.params.id);
  if (!row || row.userId !== req.user.id) return res.status(404).json({ error: "Not found." });
  const { result, note } = req.body || {};
  if (!["worked", "didnt_help", "not_tried"].includes(result)) {
    return res.status(400).json({ error: "Pick how it went." });
  }
  const saved = resolveExperiment(row.id, result, String(note || "").trim().slice(0, 500), new Date().toISOString());
  res.json({ experiment: publicExperiment(saved) });
});

app.delete("/api/playbook/:id", authMiddleware, (req, res) => {
  const row = getExperiment(req.params.id);
  if (!row || row.userId !== req.user.id) return res.status(404).json({ error: "Not found." });
  deleteExperiment(row.id);
  res.json({ ok: true });
});

// Premium: an AI read of the whole playbook — what keeps working, what
// doesn't, and what to try next. Needs a few finished experiments first.
app.post("/api/playbook/summary", authMiddleware, async (req, res) => {
  if (req.user.plan !== "premium") {
    return res.status(403).json({ error: "The playbook analysis is part of Premium.", upgrade: true });
  }
  if (isOverDailyLimit(req.user, res)) return;
  const done = listExperimentsForUser(req.user.id).filter((r) => r.status !== "active");
  if (done.length < 3) {
    return res.status(400).json({ error: "Finish at least 3 experiments first, then I can spot what works for you." });
  }
  try {
    const lines = done
      .slice(0, 40)
      .map((r) => `- "${r.text}" → ${r.status}${r.note ? ` (note: ${r.note})` : ""} [${(r.createdAt || "").slice(0, 10)}]`)
      .join("\n");
    const completion = await openai.chat.completions.create({
      model: modelForPlan(req.user.plan),
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content:
            "You read a person's relationship 'playbook': small real-life experiments they tried, each marked worked / didnt_help / not_tried. Write in plain, warm, simple words in the language their notes and experiments are written in (detect it automatically, even if the text has no accents; use English only if they wrote in English; never mix languages), max 120 words, no headings, no bullet points beyond 3 short lines. Say: what tends to work for them, what doesn't, anything they keep not getting to, and ONE next thing to try. Be specific to the list, never generic, never diagnose.",
        },
        { role: "user", content: lines },
      ],
    });
    bumpUsage(req.user);
    res.json({ summary: completion.choices[0]?.message?.content?.trim() || "" });
  } catch (err) {
    console.error("Playbook summary error:", err.message);
    res.status(500).json({ error: "Couldn't read your playbook right now. Please try again." });
  }
});

// ---------------------------------------------------------------------------
// Premium tools: monthly review, hard-talk planner, therapist pack. All three
// are Premium-only, run on the strong model, and store their results in the
// docs table (see lib/store.js). Numbers (averages, counts, trends) are always
// computed here from real data; the AI only writes the words around them.
// ---------------------------------------------------------------------------

function requirePremium(req, res) {
  if (req.user.plan === "premium") return true;
  res.status(403).json({ error: "This is part of Premium.", upgrade: true, plan: req.user.plan });
  return false;
}

async function aiJson(system, userContent, temperature = 0.5, model = PREMIUM_MODEL) {
  const completion = await openai.chat.completions.create({
    model,
    temperature,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
  });
  try {
    return JSON.parse(completion.choices[0]?.message?.content || "{}");
  } catch {
    return {};
  }
}

const asStr = (v, max = 600) => String(v || "").trim().slice(0, max);
const asList = (v, n, max = 300) => (Array.isArray(v) ? v.map((x) => asStr(x, max)).filter(Boolean).slice(0, n) : []);
const asPairs = (v, n, a, b) =>
  Array.isArray(v) ? v.map((x) => ({ [a]: asStr(x?.[a], 300), [b]: asStr(x?.[b], 600) })).filter((x) => x[a]).slice(0, n) : [];

function monthTitle(key) {
  return new Date(key + "-01T00:00:00Z").toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}
function monthRange(key) {
  const start = new Date(key + "-01T00:00:00Z");
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return { startMs: start.getTime(), endMs: end.getTime(), fromDate: start.toISOString().slice(0, 10), toDate: new Date(end.getTime() - 1).toISOString().slice(0, 10) };
}
function previousMonthKey() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
}

// Self-reported connection scores from the daily check-in, summarized.
function checkinStats(checkins, userId, fromDate, toDate) {
  const answered = (checkins || []).filter(
    (c) =>
      c.userId === userId && (c.answer || typeof c.score === "number") && !c.skipped && (!fromDate || c.date >= fromDate) && (!toDate || c.date <= toDate)
  );
  const scored = answered.filter((c) => typeof c.score === "number").sort((a, b) => (a.date < b.date ? -1 : 1));
  const avg = (arr) => (arr.length ? Math.round((arr.reduce((t, c) => t + c.score, 0) / arr.length) * 10) / 10 : null);
  let trend = null;
  let firstAvg = null;
  let lastAvg = null;
  if (scored.length >= 4) {
    const half = Math.floor(scored.length / 2);
    firstAvg = avg(scored.slice(0, half));
    lastAvg = avg(scored.slice(-half));
    const diff = lastAvg - firstAvg;
    trend = diff >= 0.7 ? "up" : diff <= -0.7 ? "down" : "steady";
  }
  return { answeredDays: answered.length, scoredDays: scored.length, average: avg(scored), firstAvg, lastAvg, trend, answers: answered.filter((c) => c.answer).slice(-12) };
}

function userLinesDigest(convs, maxConvs, maxLines, maxChars) {
  return convs
    .slice(0, maxConvs)
    .map((c) => {
      const lines = (c.messages || [])
        .filter((m) => m.role === "user")
        .slice(0, maxLines)
        .map((m) => asStr(m.content, maxChars))
        .filter(Boolean);
      return `Conversation "${asStr(c.title, 80)}" (${String(c.createdAt || "").slice(0, 10)}):\n${lines.join("\n") || "(no text)"}`;
    })
    .join("\n\n---\n\n");
}

function experimentLines(rows) {
  const label = { active: "still trying", worked: "WORKED", didnt_help: "DIDN'T HELP", not_tried: "never got to it" };
  return rows.map((r) => `- "${asStr(r.text, 160)}" -> ${label[r.status] || r.status}${r.note ? ` (their note: ${asStr(r.note, 140)})` : ""}`).join("\n");
}

// ------------------------------ monthly review ------------------------------

const MONTHLY_REVIEW_PROMPT = `You write a person's private monthly relationship review inside an AI coaching app. You are given what they actually did this month: Coach Chat messages they wrote, daily check-in answers and self-rated connection scores, small experiments they tried (their "Playbook") and how those went, and a standing memory note. Write like a thoughtful coach summing up a month with a client: warm, specific, plain, never clinical.

Respond with ONLY a JSON object in exactly this shape:
{"headline": "<one sentence capturing the month, max 25 words>", "themes": [{"title": "<3-6 words>", "description": "<2-3 sentences, specific to what they wrote>"}], "progress": "<2-3 sentences on how things moved this month. Use the numbers given if there are any, never invent numbers>", "whatWorked": ["<short, from experiments marked WORKED or clearly working things>"], "whatDidnt": ["<short, from experiments that DIDN'T HELP or kept coming up unresolved>"], "nextStep": "<ONE concrete small thing to try next month>", "note": "<one warm closing sentence>"}

Rules:
- Ground everything in the material below. Never invent events, people or numbers. If a section has nothing real to say, return an empty list or an empty string for it.
- At most 3 themes, 3 items each in whatWorked/whatDidnt.
- Never diagnose, never use clinical labels the user hasn't used, never quote messages word for word.
- An experiment marked "still trying" has not had its chance yet: never list it under whatDidnt.
- Write in the language the user mostly writes in (detect it automatically). Speak to them informally, in the singular (for example "ty" in Slovak or Czech, "du" in German, "tu" in French), never the formal or plural "you".`;

function buildMonthlyInput(db, user, key) {
  const { startMs, endMs, fromDate, toDate } = monthRange(key);
  const convs = db.conversations
    .filter((c) => c.userId === user.id && c.mode !== "practice" && (c.messages || []).some((m) => m.role === "user"))
    .filter((c) => {
      const t = new Date(c.updatedAt || c.createdAt).getTime();
      return t >= startMs && t < endMs;
    })
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  const rehearsals = db.conversations.filter((c) => {
    if (c.userId !== user.id || c.mode !== "practice") return false;
    const t = new Date(c.createdAt).getTime();
    return t >= startMs && t < endMs && (c.messages || []).some((m) => m.role === "user");
  });
  const stats = checkinStats(db.checkins, user.id, fromDate, toDate);
  const exps = listExperimentsForUser(user.id).filter((r) => {
    const t = new Date(r.resolvedAt || r.createdAt).getTime();
    return t >= startMs && t < endMs;
  });
  const activity = convs.length + rehearsals.length + stats.answeredDays + exps.length;
  return { convs, rehearsals, stats, exps, activity };
}

async function generateMonthlyReview(db, user, key) {
  const input = buildMonthlyInput(db, user, key);
  if (input.activity < 3) return { notEnoughData: true, activity: input.activity };
  const { stats } = input;
  const scoreLine = stats.scoredDays
    ? `Self-rated connection (1-10) on ${stats.scoredDays} days: average ${stats.average}${stats.trend ? `; first half ${stats.firstAvg}, second half ${stats.lastAvg} (trend: ${stats.trend})` : ""}.`
    : "No connection scores this month.";
  const parts = [
    `Month: ${monthTitle(key)}`,
    `Coach Chat conversations: ${input.convs.length}. Practice rehearsals: ${input.rehearsals.length}. Check-in days answered: ${stats.answeredDays}.`,
    scoreLine,
    input.convs.length ? `What they wrote in Coach Chat:\n${userLinesDigest(input.convs, 8, 6, 250)}` : "",
    stats.answers.length ? `Check-in answers:\n${stats.answers.map((c) => `${c.date}: ${asStr(c.answer, 250)}${typeof c.score === "number" ? ` (${c.score}/10)` : ""}`).join("\n")}` : "",
    input.exps.length ? `Playbook experiments this month:\n${experimentLines(input.exps)}` : "",
    user.relationshipMemory ? `Standing memory note: ${asStr(user.relationshipMemory, 600)}` : "",
  ].filter(Boolean);
  const raw = await aiJson(MONTHLY_REVIEW_PROMPT, parts.join("\n\n"), 0.5);
  const review = {
    headline: asStr(raw.headline, 220),
    themes: asPairs(raw.themes, 3, "title", "description"),
    progress: asStr(raw.progress, 700),
    whatWorked: asList(raw.whatWorked, 3),
    whatDidnt: asList(raw.whatDidnt, 3),
    nextStep: asStr(raw.nextStep, 400),
    note: asStr(raw.note, 300),
  };
  if (!review.headline && !review.themes.length && !review.progress) throw new Error("Empty review");
  return {
    review,
    stats: {
      conversations: input.convs.length,
      rehearsals: input.rehearsals.length,
      checkinDays: stats.answeredDays,
      averageScore: stats.average,
      trend: stats.trend,
      firstAvg: stats.firstAvg,
      lastAvg: stats.lastAvg,
      experimentsWorked: input.exps.filter((e) => e.status === "worked").length,
      experimentsTried: input.exps.filter((e) => e.status !== "active").length,
    },
  };
}

function saveMonthlyReview(userId, key, result) {
  const existing = getDocByKey(userId, "monthly", key);
  return saveDoc({
    id: existing?.id || generateId("doc"),
    userId,
    kind: "monthly",
    key,
    title: monthTitle(key),
    data: { review: result.review, stats: result.stats, generatedAt: new Date().toISOString() },
    createdAt: existing?.createdAt,
    notifiedAt: existing?.notifiedAt || null,
  });
}
function publicMonthly(d) {
  return { key: d.key, title: d.title, ...d.data };
}

app.get("/api/review", authMiddleware, (req, res) => {
  const current = new Date().toISOString().slice(0, 7);
  if (req.user.plan !== "premium") return res.json({ plan: req.user.plan, locked: true, current });
  const docs = listDocs(req.user.id, "monthly");
  res.json({ plan: "premium", current, previous: previousMonthKey(), reviews: docs.map(publicMonthly) });
});

app.post("/api/review", authMiddleware, async (req, res) => {
  if (!requirePremium(req, res)) return;
  try {
    const key = String((req.body || {}).month || new Date().toISOString().slice(0, 7));
    if (!/^\d{4}-\d{2}$/.test(key) || key > new Date().toISOString().slice(0, 7)) {
      return res.status(400).json({ error: "Pick a month that has already started." });
    }
    const regenerate = !!(req.body || {}).regenerate;
    const existing = getDocByKey(req.user.id, "monthly", key);
    if (existing && !regenerate) return res.json({ ...publicMonthly(existing), cached: true });
    if (isOverDailyLimit(req.user, res)) return;
    const result = await generateMonthlyReview(req.db, req.user, key);
    if (result.notEnoughData) {
      return res.json({ notEnoughData: true, activity: result.activity, key, title: monthTitle(key) });
    }
    const saved = saveMonthlyReview(req.user.id, key, result);
    bumpUsage(req.user);
    res.json({ ...publicMonthly(saved), cached: false });
  } catch (err) {
    console.error("Monthly review error:", err.message);
    res.status(500).json({ error: "Couldn't write your review right now. Please try again." });
  }
});

// Background: on the 1st-onward (09:00 UTC+), every Premium user without a
// review of LAST month gets one written and a notification. A failed attempt
// is remembered in memory so a broken month doesn't retry every 15 minutes.
const monthlyReviewFailed = new Set();
async function runMonthlyReviews() {
  const now = new Date();
  if (now.getUTCHours() < 9) return;
  const key = previousMonthKey();
  const db = loadDb();
  const todo = db.users
    .filter((u) => u.plan === "premium" && !getDocByKey(u.id, "monthly", key) && !monthlyReviewFailed.has(`${u.id}:${key}`))
    .slice(0, 10);
  for (const user of todo) {
    try {
      const result = await generateMonthlyReview(db, user, key);
      if (result.notEnoughData) {
        monthlyReviewFailed.add(`${user.id}:${key}`);
        continue;
      }
      const saved = saveMonthlyReview(user.id, key, result);
      const title = monthTitle(key);
      if (user.email && user.emailWeeklyDigest !== false) {
        const html = emailShell({
          unsubscribeUrl: unsubscribeLink(user, "digest"),
          bodyHtml: `
            <p>Hey ${escapeForEmail(user.name)},</p>
            <p>Your ${escapeForEmail(title)} review is ready:</p>
            <p style="font-style:italic; color:#d1a05a;">"${escapeForEmail(result.review.headline)}"</p>
            <p><a href="${APP_URL}/review.html" style="display:inline-block; margin-top:8px; background:linear-gradient(135deg,#d1a05a,#a8455c); color:#1a1410; text-decoration:none; padding:10px 20px; border-radius:100px; font-weight:600;">Read your review →</a></p>
          `,
        });
        await sendEmail({ to: user.email, subject: `Your ${title} review`, html });
      }
      await sendPushToUser(user.id, { title: `Your ${title} review is ready`, body: result.review.headline || "See how the month went.", url: "/review.html" });
      saveDoc({ ...saved, notifiedAt: new Date().toISOString() });
    } catch (err) {
      monthlyReviewFailed.add(`${user.id}:${key}`);
      console.error(`Monthly review failed for ${user.id}:`, err.message);
    }
  }
}
setInterval(() => runMonthlyReviews().catch((err) => console.error("Monthly review job failed:", err.message)), 15 * 60 * 1000).unref();

// ------------------------------ hard-talk planner ------------------------------

const HARD_TALK_PROMPT = `You help someone prepare ONE specific difficult conversation with a partner (or someone close to them), inside a private AI coaching app. You get what the talk is about, what they hope will happen, what they fear, and background on the person and on what has and hasn't worked for them before. Produce a practical, calm plan they can actually use.

Respond with ONLY a JSON object in exactly this shape:
{"summary": "<what this conversation is really about underneath, 1-2 sentences, no blame>", "goal": "<the ONE realistic outcome to aim for, one sentence>", "bestTime": "<when and how to bring it up, 1-2 sentences>", "opening": "<a ready-to-say first 1-2 sentences in the user's own voice, specific, non-accusing, starts with how THEY feel or what they want>", "keyPoints": ["<3-4 short things to get across, in order>"], "avoid": ["<2-3 specific things to steer clear of: phrases, topics, or habits that would escalate THIS situation>"], "reactions": [{"reaction": "<a likely reaction from them>", "respond": "<what to say or do if that happens>"}], "ifHeated": "<what to do if it escalates, 1-2 sentences>", "afterwards": "<one sentence on how to close or follow up>"}

Rules:
- Be specific to THIS situation; no generic relationship advice that would fit anyone.
- Give 3 reactions that are realistic for the person described. They are guesses, not predictions: phrase them as "they might..." (in the language of the plan).
- Use what's known about what worked or failed before (the Playbook) when it applies; never repeat something that didn't help them.
- If the situation involves abuse, fear for safety or self-harm, keep the plan gentle and do not mention helplines or phone numbers.
- Warm, plain, short sentences. Never diagnose. Address the user informally and in the singular (for example "ty" in Slovak or Czech, "du" in German), never the formal or plural "you". Write the whole plan in the language of the topic text the user typed, even if the background about the person is in another language.`;

function publicTalk(d) {
  return { id: d.id, title: d.title, createdAt: d.createdAt, ...d.data };
}

app.get("/api/talks", authMiddleware, (req, res) => {
  if (req.user.plan !== "premium") return res.json({ plan: req.user.plan, locked: true, talks: [] });
  res.json({ plan: "premium", talks: listDocs(req.user.id, "talk").map(publicTalk) });
});

app.post("/api/talks", authMiddleware, async (req, res) => {
  if (!requirePremium(req, res)) return;
  try {
    const b = req.body || {};
    const topic = asStr(b.topic, 600);
    if (topic.length < 8) return res.status(400).json({ error: "Tell me a bit more about what you need to talk about." });
    const hope = asStr(b.hope, 400);
    const fear = asStr(b.fear, 400);
    const partner = b.partnerProfileId ? req.db.partnerProfiles.find((p) => p.id === b.partnerProfileId && p.userId === req.user.id) : null;
    const withName = partner ? partner.name : asStr(b.withName, 60) || "them";
    if (isOverDailyLimit(req.user, res)) return;

    const playbook = buildPlaybookContext(req.user.id);
    const partnerBlock = partner ? buildPartnerContextBlock(partner) : "";
    const raw = await aiJson(
      HARD_TALK_PROMPT,
      [
        `The conversation is with: ${withName}`,
        `What it's about: ${topic}`,
        hope ? `What they hope happens: ${hope}` : "",
        fear ? `What they're afraid will happen: ${fear}` : "",
        partnerBlock ? `What's known about ${withName}:\n${partnerBlock}` : "",
        req.user.relationshipMemory ? `Background on the user's story: ${asStr(req.user.relationshipMemory, 600)}` : "",
        playbook ? `What they've tried before (Playbook):\n${playbook}` : "",
        `LANGUAGE: write EVERY field of the JSON (summary, goal, bestTime, opening, keyPoints, avoid, reactions, ifHeated, afterwards) in the same language as the "What it's about" text above, even if that text has no accents or special characters. Do not mix languages and do not use English unless that text is English.`,
      ]
        .filter(Boolean)
        .join("\n\n"),
      0.6
    );
    const plan = {
      summary: asStr(raw.summary, 400),
      goal: asStr(raw.goal, 300),
      bestTime: asStr(raw.bestTime, 400),
      opening: asStr(raw.opening, 500),
      keyPoints: asList(raw.keyPoints, 4),
      avoid: asList(raw.avoid, 3),
      reactions: asPairs(raw.reactions, 3, "reaction", "respond"),
      ifHeated: asStr(raw.ifHeated, 500),
      afterwards: asStr(raw.afterwards, 300),
    };
    if (!plan.opening && !plan.keyPoints.length) {
      return res.status(500).json({ error: "Couldn't build a plan right now. Please try again." });
    }
    const doc = saveDoc({
      id: generateId("talk"),
      userId: req.user.id,
      kind: "talk",
      key: null,
      title: topic.length > 70 ? topic.slice(0, 67) + "..." : topic,
      data: {
        inputs: { withName, partnerProfileId: partner ? partner.id : null, topic, hope, fear },
        plan,
        status: "planned",
        outcome: null,
        outcomeNote: "",
        conversationId: null,
      },
    });
    bumpUsage(req.user);
    res.json(publicTalk(doc));
  } catch (err) {
    console.error("Hard talk error:", err.message);
    res.status(500).json({ error: "Couldn't build a plan right now. Please try again." });
  }
});

function ownTalk(req, res) {
  const d = getDoc(req.params.id);
  if (!d || d.kind !== "talk" || d.userId !== req.user.id) {
    res.status(404).json({ error: "Not found." });
    return null;
  }
  return d;
}

app.post("/api/talks/:id/link", authMiddleware, (req, res) => {
  const d = ownTalk(req, res);
  if (!d) return;
  const convId = String((req.body || {}).conversationId || "");
  if (!req.db.conversations.some((c) => c.id === convId && c.userId === req.user.id)) {
    return res.status(400).json({ error: "Conversation not found." });
  }
  d.data.conversationId = convId;
  res.json(publicTalk(saveDoc(d)));
});

app.post("/api/talks/:id/outcome", authMiddleware, (req, res) => {
  const d = ownTalk(req, res);
  if (!d) return;
  const { outcome, note } = req.body || {};
  if (!["went_well", "mixed", "didnt_go_well", "not_yet"].includes(outcome)) {
    return res.status(400).json({ error: "Pick how it went." });
  }
  d.data.outcome = outcome;
  d.data.outcomeNote = asStr(note, 500);
  d.data.status = outcome === "not_yet" ? "planned" : "done";
  res.json(publicTalk(saveDoc(d)));
});

app.delete("/api/talks/:id", authMiddleware, (req, res) => {
  const d = ownTalk(req, res);
  if (!d) return;
  deleteDoc(d.id);
  res.json({ ok: true });
});

// ------------------------------ therapist pack ------------------------------

const THERAPIST_PACK_PROMPT = `You prepare a short "story so far" briefing that a person can hand to their own therapist or counselor, written from the person's own notes in an AI relationship-coaching app: what they wrote in Coach Chat across months, daily check-in answers and self-rated connection scores, small experiments they tried and how they went, and a standing memory note. Write for a professional reader who has 5 minutes: factual, neutral, skimmable, in the person's perspective ("They describe...", "They say...").

Respond with ONLY a JSON object in exactly this shape:
{"overview": "<3-4 sentences: who they are in this relationship context, what brings them to work on it, what has been the main focus>", "background": "<3-5 sentences of relevant history and context they have mentioned>", "patterns": [{"title": "<3-6 words>", "description": "<2-3 sentences on a recurring pattern in how they describe things>"}], "whatHelped": ["<things they tried that worked>"], "whatDidntHelp": ["<things that did not help>"], "currentConcerns": ["<what they are struggling with now, short>"], "questionsForTherapist": ["<3-4 good questions they could bring to a session, in their voice>"]}

Rules:
- Only what is in the material. Never invent facts, diagnoses, dates or people. If a section has nothing, return an empty string or empty list.
- This is the person's own account, not an assessment. Never diagnose and never use clinical labels the person hasn't used.
- At most 4 patterns, 5 items per list. Never quote messages word for word.
- Write EVERY field in the language the user mostly writes in (detect it automatically, even if their text has no accents). Do not mix languages and do not default to English. Never guess the partner's gender; use their name or "their partner" unless the notes clearly use a pronoun.`;

app.get("/api/pack", authMiddleware, (req, res) => {
  if (req.user.plan !== "premium") return res.json({ plan: req.user.plan, locked: true });
  const d = getDocByKey(req.user.id, "pack", "main");
  res.json({ plan: "premium", pack: d ? { ...d.data, id: d.id, updatedAt: d.updatedAt } : null });
});

app.post("/api/pack", authMiddleware, async (req, res) => {
  if (!requirePremium(req, res)) return;
  try {
    const regenerate = !!(req.body || {}).regenerate;
    const existing = getDocByKey(req.user.id, "pack", "main");
    if (existing && !regenerate) return res.json({ ...existing.data, id: existing.id, updatedAt: existing.updatedAt, cached: true });

    const db = req.db;
    const convs = db.conversations
      .filter((c) => c.userId === req.user.id && c.mode !== "practice" && (c.messages || []).some((m) => m.role === "user"))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const exps = listExperimentsForUser(req.user.id).filter((r) => r.status !== "active");
    const stats = checkinStats(db.checkins, req.user.id, null, null);
    if (convs.length + exps.length + stats.answeredDays < 3) {
      return res.json({ notEnoughData: true, activity: convs.length + exps.length + stats.answeredDays });
    }
    if (isOverDailyLimit(req.user, res)) return;

    const oldest = convs.length ? String(convs[convs.length - 1].createdAt).slice(0, 10) : null;
    const scoreLine = stats.scoredDays
      ? `Self-rated connection (1-10) on ${stats.scoredDays} days, overall average ${stats.average}${stats.trend ? `; earlier ${stats.firstAvg}, recently ${stats.lastAvg} (trend: ${stats.trend})` : ""}.`
      : "";
    const raw = await aiJson(
      THERAPIST_PACK_PROMPT,
      [
        `Coach Chat conversations: ${convs.length}${oldest ? ` (since ${oldest})` : ""}. Check-in days answered: ${stats.answeredDays}.`,
        scoreLine,
        convs.length ? `What they wrote (newest first):\n${userLinesDigest(convs, 25, 6, 250)}` : "",
        stats.answers.length ? `Recent check-in answers:\n${stats.answers.map((c) => `${c.date}: ${asStr(c.answer, 250)}`).join("\n")}` : "",
        exps.length ? `Experiments they tried:\n${experimentLines(exps.slice(0, 30))}` : "",
        req.user.relationshipMemory ? `Standing memory note: ${asStr(req.user.relationshipMemory, 800)}` : "",
        Array.isArray(req.user.insights?.patterns) && req.user.insights.patterns.length ? `Patterns noticed earlier:\n${buildInsightsContext(req.user)}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      0.4
    );
    const pack = {
      overview: asStr(raw.overview, 900),
      background: asStr(raw.background, 1200),
      patterns: asPairs(raw.patterns, 4, "title", "description"),
      whatHelped: asList(raw.whatHelped, 5),
      whatDidntHelp: asList(raw.whatDidntHelp, 5),
      currentConcerns: asList(raw.currentConcerns, 5),
      questionsForTherapist: asList(raw.questionsForTherapist, 4),
      numbers: {
        conversations: convs.length,
        since: oldest,
        checkinDays: stats.answeredDays,
        averageScore: stats.average,
        trend: stats.trend,
        firstAvg: stats.firstAvg,
        lastAvg: stats.lastAvg,
        experimentsTried: exps.length,
        experimentsWorked: exps.filter((e) => e.status === "worked").length,
      },
      generatedAt: new Date().toISOString(),
    };
    if (!pack.overview && !pack.patterns.length) {
      return res.status(500).json({ error: "Couldn't prepare the pack right now. Please try again." });
    }
    const saved = saveDoc({
      id: existing?.id || generateId("doc"),
      userId: req.user.id,
      kind: "pack",
      key: "main",
      title: "Therapist pack",
      data: pack,
      createdAt: existing?.createdAt,
    });
    bumpUsage(req.user);
    res.json({ ...saved.data, id: saved.id, updatedAt: saved.updatedAt, cached: false });
  } catch (err) {
    console.error("Therapist pack error:", err.message);
    res.status(500).json({ error: "Couldn't prepare the pack right now. Please try again." });
  }
});

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

// Lightweight in-memory brute-force guard shared by login and register.
// Not a substitute for a real WAF, but stops trivial scripted password-
// guessing against one account (or account-enumeration/spam-signup across
// many emails) from the same IP. Resets on redeploy — fine, since the goal
// is just to slow down automated abuse, not keep a durable audit log.
const authAttemptsByIp = new Map(); // ip -> array of attempt timestamps (ms)
const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const AUTH_RATE_LIMIT_MAX = 20; // attempts per IP per window
setInterval(() => {
  const cutoff = Date.now() - AUTH_RATE_LIMIT_WINDOW_MS;
  for (const [ip, attempts] of authAttemptsByIp) {
    const kept = attempts.filter((t) => t > cutoff);
    if (kept.length === 0) authAttemptsByIp.delete(ip);
    else authAttemptsByIp.set(ip, kept);
  }
}, 30 * 60 * 1000).unref();

function authRateLimit(req, res, next) {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const attempts = (authAttemptsByIp.get(ip) || []).filter((t) => now - t < AUTH_RATE_LIMIT_WINDOW_MS);
  if (attempts.length >= AUTH_RATE_LIMIT_MAX) {
    return res.status(429).json({ error: "Too many attempts from this connection. Please wait a few minutes and try again." });
  }
  attempts.push(now);
  authAttemptsByIp.set(ip, attempts);
  next();
}

app.post("/api/auth/register", authRateLimit, (req, res) => {
  try {
    const { email, password, name, referralCode, acceptedTerms } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }
    if (acceptedTerms !== true) {
      return res.status(400).json({ error: "Please accept the Terms of Service and Privacy Policy to create an account." });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const db = loadDb();
    const normalizedEmail = String(email).trim().toLowerCase();
    if (db.users.some((u) => u.email === normalizedEmail)) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    let referrer = null;
    if (referralCode) {
      referrer = getUserByReferralCode(String(referralCode).trim().toLowerCase()) || null;
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
      termsAcceptedAt: new Date().toISOString(),
      // If verification emails can't be sent (no Resend key), there's no way
      // for the user to verify — mark them verified rather than lock them out.
      emailVerifiedAt: isEmailVerificationEnforced() ? undefined : new Date().toISOString(),
    };

    saveUser(user);

    if (!user.emailVerifiedAt) {
      sendVerificationEmail(user).catch((err) => console.error("Verification email failed:", err));
    }

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Something went wrong while creating your account. Please try again." });
  }
});

// ---------------------------------------------------------------------------
// Email verification — signed, scoped link (not a login token), same pattern
// as password reset. Clicking it proves the person controls the inbox.
// ---------------------------------------------------------------------------

async function sendVerificationEmail(user) {
  const token = jwt.sign({ sub: user.id, scope: "verify-email", email: user.email }, JWT_SECRET, { expiresIn: "7d" });
  const url = `${APP_URL}/verify-email.html?token=${encodeURIComponent(token)}`;
  const html = emailShell({
    bodyHtml: `
      <p>Welcome to RelationshipAI${user.name ? `, ${escapeForEmail(user.name)}` : ""}! Please confirm your email address so we know it's really you.</p>
      <p style="margin:24px 0;">
        <a href="${url}" style="display:inline-block; background:#d1a05a; color:#1a140d; font-weight:600; text-decoration:none; padding:12px 22px; border-radius:999px;">Verify my email</a>
      </p>
      <p style="color:#b6a795; font-size:13px;">This link works for 7 days. If you didn't create a RelationshipAI account, you can safely ignore this email.</p>
    `,
  });
  return sendEmail({ to: user.email, subject: "Confirm your email for RelationshipAI", html });
}

app.post("/api/auth/verify-email", authRateLimit, (req, res) => {
  try {
    const { token } = req.body || {};
    const invalid = () => res.status(400).json({ error: "This verification link is invalid or has expired. Log in and request a new one from your account page." });
    if (!token) return invalid();
    let payload;
    try {
      payload = jwt.verify(String(token), JWT_SECRET);
    } catch (err) {
      return invalid();
    }
    if (payload.scope !== "verify-email") return invalid();
    const user = getUserById(payload.sub);
    // The email in the token must still be the account's email — a link
    // issued for an old address can't verify a changed one.
    if (!user || user.email !== payload.email) return invalid();
    if (!user.emailVerifiedAt) {
      user.emailVerifiedAt = new Date().toISOString();
      saveUser(user);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Verify-email error:", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

const lastVerificationResendByUser = new Map(); // userId -> ms
app.post("/api/auth/resend-verification", authMiddleware, async (req, res) => {
  try {
    if (req.user.emailVerifiedAt) return res.json({ ok: true, alreadyVerified: true });
    const now = Date.now();
    const last = lastVerificationResendByUser.get(req.user.id) || 0;
    if (now - last < 60 * 1000) {
      return res.status(429).json({ error: "We just sent one. Please give it a minute and check your spam folder." });
    }
    lastVerificationResendByUser.set(req.user.id, now);
    const result = await sendVerificationEmail(req.user);
    if (result && result.skipped) {
      return res.status(503).json({ error: "We couldn't send the email right now. Please try again later." });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Resend-verification error:", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

app.post("/api/auth/login", authRateLimit, (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = getUserByEmail(normalizedEmail);

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

// ---------------------------------------------------------------------------
// Password reset — a signed, scope-limited token (same pattern as the email
// unsubscribe link above), not a row in a table, so there's nothing extra to
// store or clean up: it's just a JWT that only ever does one thing, for one
// user, and stops working after an hour on its own.
// ---------------------------------------------------------------------------

// Deliberately responds the same way whether or not the email exists, so a
// stranger can't use this to check which emails have a RelationshipAI account.
// Shares the login/register rate limiter — it's the same kind of endpoint
// (unauthenticated, email-driven) and abuse here (mass password-reset spam
// to someone else's inbox) is exactly what that limiter already guards
// against.
app.post("/api/auth/forgot-password", authRateLimit, async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "Email is required." });

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = getUserByEmail(normalizedEmail);

    if (user) {
      const token = jwt.sign({ sub: user.id, scope: "password-reset" }, JWT_SECRET, { expiresIn: "1h" });
      const resetUrl = `${APP_URL}/reset-password.html?token=${encodeURIComponent(token)}`;
      const html = emailShell({
        bodyHtml: `
          <p>Someone (hopefully you) asked to reset the password on your RelationshipAI account.</p>
          <p style="margin:24px 0;">
            <a href="${resetUrl}" style="display:inline-block; background:#d1a05a; color:#1a140d; font-weight:600; text-decoration:none; padding:12px 22px; border-radius:999px;">Reset your password</a>
          </p>
          <p style="color:#b6a795; font-size:13px;">This link works for 1 hour. If you didn't ask for this, you can safely ignore this email. Your password won't change.</p>
        `,
      });
      await sendEmail({ to: user.email, subject: "Reset your RelationshipAI password", html });
    }

    res.json({ ok: true, message: "If that email has a RelationshipAI account, we've sent a link to reset your password." });
  } catch (err) {
    console.error("Forgot-password error:", err);
    // Same generic message even on an unexpected error — no reason to leak
    // internals here either, and the request should never actually reach
    // this branch since the block above tolerates a failed send silently.
    res.json({ ok: true, message: "If that email has a RelationshipAI account, we've sent a link to reset your password." });
  }
});

app.post("/api/auth/reset-password", authRateLimit, (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) {
      return res.status(400).json({ error: "Missing reset token or new password." });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    let payload;
    try {
      payload = jwt.verify(String(token), JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ error: "This reset link is invalid or has expired. Request a new one." });
    }
    if (payload.scope !== "password-reset") {
      return res.status(400).json({ error: "This reset link is invalid or has expired. Request a new one." });
    }

    const user = getUserById(payload.sub);
    if (!user) {
      return res.status(400).json({ error: "This reset link is invalid or has expired. Request a new one." });
    }

    user.passwordHash = bcrypt.hashSync(password, 10);
    saveUser(user);

    // Logs them straight in — one less step right after resetting a
    // password they may only just have finished typing twice.
    const loginToken = signToken(user);
    res.json({ token: loginToken, user: publicUser(user) });
  } catch (err) {
    console.error("Reset-password error:", err);
    res.status(500).json({ error: "Something went wrong while resetting your password. Please try again." });
  }
});

app.get("/api/me", authMiddleware, (req, res) => {
  res.json(publicUser(req.user));
});

// GDPR-style "export my data" — everything RelationshipAI has stored about this
// account, as a single downloadable JSON file: profile fields, the standing
// relationship-memory summary, every partner profile (including anything
// learned about them), and every conversation's full message history. This
// is a full export, not a redacted summary, since it's the user's own data
// about their own account (partner profiles necessarily include personal
// information ABOUT the partner too, since that's the nature of the
// feature — see the disclaimer shown when a partner profile is created).
app.get("/api/me/export", authMiddleware, (req, res) => {
  const db = req.db;
  const user = req.user;

  const conversations = db.conversations
    .filter((c) => c.userId === user.id)
    .map((c) => ({
      id: c.id,
      mode: c.mode,
      title: c.title,
      partnerName: c.partnerName || null,
      scenario: c.scenario || null,
      intensity: c.intensity || null,
      roleSwap: !!c.practiceRoleSwap,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messages: (c.messages || []).map((m) => ({
        role: m.role,
        content: m.content,
        at: m.at,
        attachments: (m.attachments || []).map((a) => ({ name: a.name, mimeType: a.mimeType, size: a.size })),
      })),
    }));

  const partnerProfiles = db.partnerProfiles.filter((p) => p.userId === user.id).map(publicPartner);

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      name: user.name || null,
      plan: user.plan,
      createdAt: user.createdAt,
      attachmentStyle: user.attachmentStyle || null,
    },
    relationshipMemory: user.relationshipMemory || null,
    relationshipMemoryUpdatedAt: user.relationshipMemoryAt || null,
    memoryNotes: Mem.publicMemory(loadMemoryDoc(user.id).mem).sections,
    partnerProfiles,
    playbook: listExperimentsForUser(user.id).map(publicExperiment),
    monthlyReviews: listDocs(user.id, "monthly").map((d) => ({ month: d.key, ...d.data })),
    hardTalkPlans: listDocs(user.id, "talk").map((d) => ({ id: d.id, createdAt: d.createdAt, ...d.data })),
    therapistPack: getDocByKey(user.id, "pack", "main")?.data || null,
    yearReviews: listDocs(user.id, "yearly").map((d) => ({ key: d.key, ...d.data })),
    weeklyFocus: listDocs(user.id, "focus").map((d) => ({ week: d.key, ...d.data })),
    gestureIdeas: listDocs(user.id, "ideas").map((d) => ({ week: d.key, ...d.data })),
    messageChecks: listDocs(user.id, "mcheck").map((d) => ({ id: d.id, createdAt: d.createdAt, ...d.data })),
    afterAFight: listDocs(user.id, "sos").map((d) => ({ id: d.id, createdAt: d.createdAt, ...d.data })),
    checkIns: db.checkins
      .filter((c) => c.userId === user.id)
      .map((c) => ({ date: c.date, question: c.question, answer: c.answer || null, score: c.score ?? null, skipped: !!c.skipped })),
    dailyQuestionAnswers: db.soloAnswers
      .filter((a) => a.userId === user.id)
      .map((a) => ({ date: a.date, question: a.question, answer: a.answer || null, answeredAt: a.answeredAt || null })),
    shares: db.shares
      .filter((sh) => sh.userId === user.id)
      .map((sh) => ({ id: sh.id, title: sh.title || null, createdAt: sh.createdAt, items: sh.items || [] })),
    conversations,
  };

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="relateiq-data-export.json"`);
  res.send(JSON.stringify(exportPayload, null, 2));
});

// Self-service account deletion (GDPR erasure) — the gap privacy.html used
// to openly admit to ("account deletion isn't yet self-service inside the
// app"). Requires the current password as confirmation, same as any
// irreversible action, rather than just a "type DELETE" text box — it's a
// stronger check and the user already has their password in hand. Deletes
// the database rows first (deleteUserCascade, one transaction — see
// store.js), then best-effort removes the user's uploaded files directory;
// a failure to clean up disk files never leaves the account itself
// half-deleted, since by that point it's already gone from the database.
app.delete("/api/account", authMiddleware, (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ error: "Enter your password to confirm account deletion." });
    }
    if (!req.user.passwordHash || !bcrypt.compareSync(password, req.user.passwordHash)) {
      return res.status(401).json({ error: "Incorrect password." });
    }

    const userId = req.user.id;
    deleteUserCascade(userId);

    try {
      fs.rmSync(path.join(UPLOADS_DIR, userId), { recursive: true, force: true });
    } catch (fileErr) {
      console.error(`Account ${userId} deleted, but couldn't remove its uploads directory:`, fileErr.message);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Account deletion error:", err);
    res.status(500).json({ error: "Something went wrong while deleting your account. Please try again, or contact us if it keeps failing." });
  }
});

app.post("/api/me/email-preferences", authMiddleware, (req, res) => {
  const { checkinReminders, weeklyDigest } = req.body || {};
  if (checkinReminders !== undefined) req.user.emailCheckinReminders = !!checkinReminders;
  if (weeklyDigest !== undefined) req.user.emailWeeklyDigest = !!weeklyDigest;
  saveUser(req.user);
  res.json({
    emailCheckinReminders: req.user.emailCheckinReminders !== false,
    emailWeeklyDigest: req.user.emailWeeklyDigest !== false,
  });
});

// ---------------------------------------------------------------------------
// Referrals
// ---------------------------------------------------------------------------

// What the coach remembers: viewable and removable by the user.
app.get("/api/memory", authMiddleware, (req, res) => {
  const { doc, mem } = loadMemoryDoc(req.user.id);
  const out = Mem.publicMemory(mem);
  // Older users have a free-text memory but no structured one yet: build it now, in the background.
  if (!doc && req.user.relationshipMemory) {
    scheduleMemoryUpdate(req.user.id, 500);
    out.updating = true;
  }
  res.json(out);
});

app.post("/api/memory/forget", authMiddleware, (req, res) => {
  const { section, id } = req.body || {};
  const { doc, mem } = loadMemoryDoc(req.user.id);
  if (!doc) return res.status(404).json({ error: "Nothing to forget." });
  const gone = Mem.removeItem(mem, String(section || ""), String(id || ""));
  if (!gone) return res.status(404).json({ error: "That note is already gone." });
  saveMemory(req.user.id, doc, mem);
  res.json(Mem.publicMemory(mem));
});

app.post("/api/memory/clear", authMiddleware, (req, res) => {
  const { doc } = loadMemoryDoc(req.user.id);
  const mem = Mem.emptyMemory();
  // Everything said so far counts as already handled, so clearing really starts fresh.
  mem.processed = Mem.baselineProcessed(listConversationsForUser(req.user.id));
  saveMemory(req.user.id, doc, mem);
  res.json(Mem.publicMemory(mem));
});

app.get("/api/referrals", authMiddleware, (req, res) => {
  const db = req.db;
  // Backfills a code for accounts created before this feature existed.
  if (!req.user.referralCode) {
    req.user.referralCode = generateUniqueReferralCode(db);
    saveUser(req.user);
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
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: "Invalid push subscription." });
  }

  // savePushSubscription upserts by (userId, endpoint), so re-subscribing
  // the same browser just replaces its row — no need to look up an existing
  // id first.
  savePushSubscription({
    id: generateId("push"),
    userId: req.user.id,
    subscription,
    createdAt: new Date().toISOString(),
  });
  res.json({ ok: true });
});

app.post("/api/push/unsubscribe", authMiddleware, (req, res) => {
  const { endpoint } = req.body || {};
  deletePushSubscriptionsForUser(req.user.id, endpoint || null);
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

  // Coach Chat reply quality — thumbs up/down captured per message (see
  // PATCH /api/conversations/:id/messages/:messageId/feedback). Walked
  // fresh from db.conversations every time, same as everything else on this
  // page — nothing pre-aggregated or stored just for this dashboard. The
  // downvoted replies themselves (not just the count) are the actually
  // useful part: a ratio alone doesn't tell Jonas what to go fix.
  let feedbackUp = 0;
  let feedbackDown = 0;
  const recentDownvotes = [];
  db.conversations.forEach((c) => {
    (c.messages || []).forEach((m) => {
      if (m.role !== "assistant" || !m.feedback) return;
      if (m.feedback === "up") {
        feedbackUp += 1;
      } else if (m.feedback === "down") {
        feedbackDown += 1;
        recentDownvotes.push({
          conversationId: c.id,
          at: m.at,
          preview: String(m.content || "").slice(0, 280),
        });
      }
    });
  });
  recentDownvotes.sort((a, b) => new Date(b.at) - new Date(a.at));

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
    feedback: {
      up: feedbackUp,
      down: feedbackDown,
      total: feedbackUp + feedbackDown,
      recentDownvotes: recentDownvotes.slice(0, 20),
    },
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
    const { plan, billing } = req.body || {};
    const yearly = billing === "yearly";
    const priceId = (yearly ? PLAN_TO_STRIPE_PRICE_YEARLY : PLAN_TO_STRIPE_PRICE)[plan];
    if (!priceId) {
      return res.status(400).json({
        error: yearly && PLAN_TO_STRIPE_PRICE[plan]
          ? "Yearly billing isn't available yet. Switch to Monthly and try again."
          : "That's not a valid paid plan.",
      });
    }

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
      saveUser(user);
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

// Switch an existing paid subscription to the other paid plan (Pro <-> Premium)
// in one step, prorated by Stripe: the difference for the rest of the current
// billing period is charged (upgrade) or credited (downgrade). Keeps the
// billing interval the person already has (monthly/yearly). The plan itself
// still only changes from Stripe's confirmation (webhook), but we also set it
// here so the app reflects it immediately.
app.post("/api/billing/change-plan", authMiddleware, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: "Payments aren't set up on this server yet." });
  try {
    const { plan } = req.body || {};
    const user = req.user;
    if (!["pro", "premium"].includes(plan)) return res.status(400).json({ error: "That's not a valid paid plan." });
    if (!user.stripeSubscriptionId || !["active", "trialing"].includes(user.subscriptionStatus)) {
      return res.status(400).json({ error: "You don't have an active subscription to change." });
    }
    if (user.plan === plan) {
      return res.status(400).json({ error: `You're already on ${planLabel(plan)}.` });
    }

    // The stored subscription id can point at a stale/duplicate subscription
    // (e.g. several test subscriptions on one customer), so fall back to the
    // customer's live subscriptions if it isn't usable.
    let sub = null;
    try {
      sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
    } catch (e) {
      console.error("Change plan: stored subscription not retrievable:", e.message);
    }
    if (!sub || !["active", "trialing"].includes(sub.status)) {
      sub = null;
      if (user.stripeCustomerId) {
        const list = await stripe.subscriptions.list({ customer: user.stripeCustomerId, status: "all", limit: 20 });
        sub = (list.data || []).find((s) => ["active", "trialing"].includes(s.status)) || null;
      }
    }
    const item = sub?.items?.data?.[0];
    if (!item) {
      return res.status(400).json({ error: "Your subscription isn't active right now." });
    }
    const isYearly = Object.values(PLAN_TO_STRIPE_PRICE_YEARLY).includes(item.price?.id);
    const targetPrice = (isYearly ? PLAN_TO_STRIPE_PRICE_YEARLY : PLAN_TO_STRIPE_PRICE)[plan];
    if (!targetPrice) {
      return res.status(400).json({ error: "That plan isn't available for your billing period yet." });
    }
    if (item.price?.id === targetPrice) {
      // Stripe already has you on this price; just bring our record in line.
      user.plan = plan;
      user.stripeSubscriptionId = sub.id;
      saveUser(user);
      return res.json({ ok: true, plan });
    }

    await stripe.subscriptions.update(sub.id, {
      items: [{ id: item.id, price: targetPrice }],
      proration_behavior: "create_prorations",
      metadata: { userId: user.id, plan },
    });

    user.plan = plan;
    user.stripeSubscriptionId = sub.id;
    saveUser(user);
    res.json({ ok: true, plan });
  } catch (err) {
    console.error("Change plan error:", err.type || "", err.code || "", err.message);
    // Stripe's own messages (card declined, price mismatch, ...) are written
    // for humans and don't leak anything sensitive, so show them.
    const stripeMsg = String(err.type || "").startsWith("Stripe") && err.message ? ` (${err.message})` : "";
    res.status(500).json({
      error: `Couldn't change your plan${stripeMsg}. Nothing was changed. You can also manage your subscription from your account page.`,
    });
  }
});

app.post("/api/billing/portal", authMiddleware, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: "Payments aren't set up on this server yet." });
  }
  try {
    const user = req.user;
    if (!user.stripeCustomerId) {
      return res.status(400).json({ error: "No billing account yet. Upgrade to a paid plan first." });
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

// ---------------------------------------------------------------------------
// Message check: paste a text before you send it and see how it may land,
// with rewrites. Plans: Free 3 checks in total (a taste), Pro 10 a day with
// 2 rewrites, Premium effectively unlimited with 3 rewrites on the advanced
// model, tailored to the person (their profile) and what has worked before.
// Only a counter marker is stored (doc kind "mcheck"), never the text itself.
// ---------------------------------------------------------------------------

const MESSAGE_CHECK_LIMITS = { free: { lifetime: 3 }, pro: { perDay: 10 }, premium: { perDay: 100 } };

function messageCheckUsage(user) {
  const docs = listDocs(user.id, "mcheck");
  const lim = MESSAGE_CHECK_LIMITS[user.plan] || MESSAGE_CHECK_LIMITS.free;
  if (lim.lifetime) return { used: docs.length, limit: lim.lifetime, period: "total" };
  const today = new Date().toISOString().slice(0, 10);
  return { used: docs.filter((d) => String(d.createdAt || "").slice(0, 10) === today).length, limit: lim.perDay, period: "day" };
}

const MESSAGE_CHECK_PROMPT = `You help someone decide how to send ONE message to their partner (or someone close to them) inside a private AI relationship-coaching app. You get the message they are about to send, sometimes what the other person wrote first, and sometimes background. Be honest and kind, never preachy.

Respond with ONLY a JSON object in exactly this shape:
{"read": "<how this message is likely to land with the other person, 1-2 plain sentences, honest>", "risk": "<low | medium | high: the chance it escalates or hurts>", "flags": ["<0-3 specific things in THEIR draft that could backfire, quoting the exact words, each with a very short why>"], "versions": [{"label": "<label>", "text": "<the rewritten message>"}]}

Rules:
- Keep what the person actually wants to say, their voice, and their language. Write EVERYTHING you return in the language of the draft: \"read\", every explanation in \"flags\" (quoted words stay exactly as they wrote them) and the rewrites. Only the JSON keys, the \"risk\" value and the version labels stay as given. Do not make it longer than needed; short texts stay short. Never guess the partner's gender: avoid gendered forms for them (in Slovak, Czech, Polish and similar languages choose wording that works for any gender) unless the text clearly shows it. Address the user informally and in the singular (for example "ty" in Slovak or Czech, "du" in German), never the formal or plural "you".
- Rewrites must be sendable as-is. Start from how they feel or what they want, not from what the other person did wrong. No manipulation, no guilt-tripping, no tactics to "win".
- Produce exactly the versions requested in the labels list, in that order, each clearly different in tone.
- If the draft is already good, say so in "read" and keep the rewrites light.
- If the draft contains threats, abuse, or hints of self-harm, say in "read" that it's worth pausing, and keep rewrites gentle and de-escalating. Never mention helplines or phone numbers.`;

app.get("/api/message-check", authMiddleware, (req, res) => {
  const partners =
    req.user.plan === "premium"
      ? req.db.partnerProfiles.filter((p) => p.userId === req.user.id).map((p) => ({ id: p.id, name: p.name }))
      : [];
  res.json({ plan: req.user.plan, usage: messageCheckUsage(req.user), partners });
});

app.post("/api/message-check", authMiddleware, async (req, res) => {
  try {
    const b = req.body || {};
    const draft = asStr(b.draft, 1500);
    if (draft.length < 3) return res.status(400).json({ error: "Paste the message you're thinking of sending." });
    const theirs = asStr(b.theirMessage, 1500);
    const user = req.user;
    const premium = user.plan === "premium";
    const mcModel = premium ? strongModelFor(user) : STANDARD_MODEL;

    const usage = messageCheckUsage(user);
    if (usage.used >= usage.limit) {
      return res.status(403).json({
        error:
          user.plan === "free"
            ? `The Free plan includes ${usage.limit} message checks. Upgrade to Pro for ${MESSAGE_CHECK_LIMITS.pro.perDay} a day.`
            : `You've used today's ${usage.limit} message checks. They reset tomorrow${user.plan === "pro" ? ", or go Premium for no limit" : ""}.`,
        messageCheckLimit: true,
        upgradeRequired: true,
        usage,
      });
    }
    if (isOverDailyLimit(user, res, { skipFreeDaily: user.plan === "free" })) return;

    const labels = premium ? ["Calmer", "More direct", "Warmer"] : ["Calmer", "More direct"];
    const partner = premium && b.partnerProfileId ? req.db.partnerProfiles.find((p) => p.id === b.partnerProfileId && p.userId === user.id) : null;
    const partnerBlock = partner ? buildPartnerContextBlock(partner) : "";
    const playbook = premium ? buildPlaybookContext(user.id) : "";

    const raw = await aiJson(
      MESSAGE_CHECK_PROMPT,
      [
        `Version labels to produce, in order: ${labels.join(", ")}`,
        partner ? `The message is for: ${partner.name}` : "",
        theirs ? `What the other person wrote first:\n"""\n${theirs}\n"""` : "",
        `The message they are thinking of sending:\n"""\n${draft}\n"""`,
        partnerBlock ? `What's known about ${partner.name}:\n${partnerBlock}` : "",
        premium && user.relationshipMemory ? `Background on the user's story: ${asStr(user.relationshipMemory, 600)}` : "",
        playbook ? `What they've tried before (Playbook):\n${playbook}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      0.6,
      mcModel
    );

    const versions = asPairs(raw.versions, labels.length, "label", "text").map((v, i) => ({ label: v.label || labels[i], text: v.text }));
    if (!versions.length || !asStr(raw.read, 400)) {
      return res.status(500).json({ error: "Couldn't check that right now. Please try again." });
    }
    const risk = ["low", "medium", "high"].includes(String(raw.risk).toLowerCase()) ? String(raw.risk).toLowerCase() : "medium";

    saveDoc({ id: generateId("mchk"), userId: user.id, kind: "mcheck", key: generateId("mk"), title: "", data: {} });
    if (user.plan !== "free") bumpUsage(user, mcModel);

    res.json({
      read: asStr(raw.read, 400),
      risk,
      flags: asList(raw.flags, 3, 200),
      versions,
      tailored: !!(premium && (partner || playbook || user.relationshipMemory)),
      usage: messageCheckUsage(user),
    });
  } catch (err) {
    console.error("Message check error:", err.message);
    res.status(500).json({ error: "Couldn't check that right now. Please try again." });
  }
});

// ---------------------------------------------------------------------------
// After a fight (SOS): a calm-down guide for everyone (static, no AI), plus a
// personal message to reach out with. Pro: 3 messages a month. Premium: no
// practical limit, advanced model, tailored to the person and what has worked
// before, and a "how are things?" nudge the next day. Only a counter marker
// is stored (doc kind "sos"), never what happened.
// ---------------------------------------------------------------------------

const SOS_LIMITS = { pro: { perMonth: 3 }, premium: { perDay: 30 } };

function sosUsage(user) {
  const lim = SOS_LIMITS[user.plan];
  if (!lim) return null;
  const docs = listDocs(user.id, "sos");
  if (lim.perMonth) {
    const month = new Date().toISOString().slice(0, 7);
    return { used: docs.filter((d) => String(d.createdAt || "").slice(0, 7) === month).length, limit: lim.perMonth, period: "month" };
  }
  const today = new Date().toISOString().slice(0, 10);
  return { used: docs.filter((d) => String(d.createdAt || "").slice(0, 10) === today).length, limit: lim.perDay, period: "day" };
}

const SOS_PROMPT = `Someone has just had a fight or a hard moment with their partner (or someone close) and is using a private AI relationship-coaching app to calm down and reach out well. You get a little about what happened (may be empty) and what they want right now. Be warm, steady and brief.

Respond with ONLY a JSON object in exactly this shape:
{"first": "<what to do in the next hour to settle, 1-2 short sentences, concrete>", "say": "<a short message or sentence they can send or say, in their own voice, that opens the door without blaming or re-arguing>", "alsoOk": "<a second, even shorter option>", "dontDo": ["<2-3 specific things not to do right now>"], "later": "<one sentence on when and how to come back to the actual issue once both are calm>"}

Rules:
- Match what they want: "reconnect" = a warm opening; "apologize" = a clear, specific, non-defensive apology for THEIR part only, no "but"; "space" = a kind message that asks for time and says when they will come back, without punishing silence.
- No manipulation, no scoring points, no demands. Plain words, short sentences. Reply in the language the user writes in (English if unclear). Address the user informally and in the singular (for example "ty" in Slovak or Czech, "du" in German), never the formal or plural "you".
- If anything suggests fear for safety, violence, abuse, or self-harm, do not coach the reconciliation: say gently in "first" that this matters and that talking to someone they trust can help, without mentioning helplines or phone numbers, and keep the rest minimal.`;

app.get("/api/sos", authMiddleware, (req, res) => {
  const partners =
    req.user.plan === "premium"
      ? req.db.partnerProfiles.filter((p) => p.userId === req.user.id).map((p) => ({ id: p.id, name: p.name }))
      : [];
  res.json({ plan: req.user.plan, usage: sosUsage(req.user), partners });
});

app.post("/api/sos", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    if (user.plan === "free") {
      return res.status(403).json({ error: "A personal message to reach out with is part of Pro.", sosLocked: true, upgradeRequired: true });
    }
    const b = req.body || {};
    const what = asStr(b.what, 800);
    const want = ["reconnect", "apologize", "space"].includes(b.want) ? b.want : "reconnect";
    const usage = sosUsage(user);
    if (usage.used >= usage.limit) {
      return res.status(403).json({
        error: `You've used your ${usage.limit} messages for this month. They reset on the 1st, or go Premium for no limit.`,
        sosLimit: true,
        upgradeRequired: true,
        usage,
      });
    }
    if (isOverDailyLimit(user, res)) return;

    const premium = user.plan === "premium";
    const sosModel = premium ? strongModelFor(user) : STANDARD_MODEL;
    const partner = premium && b.partnerProfileId ? req.db.partnerProfiles.find((p) => p.id === b.partnerProfileId && p.userId === user.id) : null;
    const partnerBlock = partner ? buildPartnerContextBlock(partner) : "";
    const playbook = premium ? buildPlaybookContext(user.id) : "";

    const raw = await aiJson(
      SOS_PROMPT,
      [
        `What they want right now: ${want}`,
        partner ? `The other person: ${partner.name}` : "",
        what ? `What happened:\n"""\n${what}\n"""` : "What happened: (they didn't say)",
        partnerBlock ? `What's known about ${partner.name}:\n${partnerBlock}` : "",
        premium && user.relationshipMemory ? `Background on the user's story: ${asStr(user.relationshipMemory, 600)}` : "",
        playbook ? `What they've tried before (Playbook):\n${playbook}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      0.6,
      sosModel
    );
    const result = {
      first: asStr(raw.first, 400),
      say: asStr(raw.say, 500),
      alsoOk: asStr(raw.alsoOk, 300),
      dontDo: asList(raw.dontDo, 3, 200),
      later: asStr(raw.later, 300),
    };
    if (!result.say && !result.first) return res.status(500).json({ error: "Couldn't put that together right now. Please try again." });

    // Premium: nudge the next day to ask how things are.
    const followUpAt = premium ? new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString() : null;
    saveDoc({
      id: generateId("sos"),
      userId: user.id,
      kind: "sos",
      key: generateId("sk"),
      title: "",
      data: { followUpAt, withName: partner ? partner.name : null },
    });
    bumpUsage(user, sosModel);
    res.json({ ...result, followUp: !!followUpAt, tailored: !!(premium && (partner || playbook || user.relationshipMemory)), usage: sosUsage(user) });
  } catch (err) {
    console.error("SOS error:", err.message);
    res.status(500).json({ error: "Couldn't put that together right now. Please try again." });
  }
});

async function runSosFollowUps() {
  const hour = new Date().getUTCHours();
  if (hour < 8 || hour >= 20) return;
  const due = getDueDocsByFollowUp("sos", new Date().toISOString());
  for (const d of due) {
    saveDoc({ ...d, notifiedAt: new Date().toISOString() });
    const user = getUserById(d.userId);
    if (!user || user.plan !== "premium") continue;
    const who = d.data.withName ? ` with ${d.data.withName}` : "";
    try {
      if (user.email && user.emailCheckinReminders !== false) {
        const html = emailShell({
          unsubscribeUrl: unsubscribeLink(user, "checkin"),
          bodyHtml: `
            <p>Hey ${escapeForEmail(user.name)},</p>
            <p>Yesterday was a hard moment${escapeForEmail(who)}. How are things today?</p>
            <p>If it helps, we can talk it through, or plan how to bring the real issue up now that things are calmer.</p>
            <p><a href="${APP_URL}/chat.html" style="display:inline-block; margin-top:8px; background:linear-gradient(135deg,#d1a05a,#a8455c); color:#1a1410; text-decoration:none; padding:10px 20px; border-radius:100px; font-weight:600;">Check in →</a></p>
          `,
        });
        await sendEmail({ to: user.email, subject: "How are things today?", html });
      }
      await sendPushToUser(user.id, { title: "How are things today?", body: `Yesterday was hard${who}. Want to talk it through?`, url: "/chat.html" });
    } catch (err) {
      console.error("SOS follow-up failed:", err.message);
    }
  }
}

// ---------------------------------------------------------------------------
// This week's focus: one small, concrete thing to focus on this week, made
// from recent check-ins, Playbook results and (Premium) conversations and
// background. Pro: the one-sentence focus, on the Playbook page and in the
// weekly email. Premium: also why it fits them, when to try it, a recap of
// last week, advanced model, and a Monday push. Stored as docs of kind
// "focus", one per week (key = the Monday's date).
// ---------------------------------------------------------------------------

function focusWeekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return t.toISOString().slice(0, 10);
}

const FOCUS_PROMPT = `You pick ONE small focus for the coming week for someone working on their relationship, inside a private AI coaching app. You get a little about how their recent days have gone, what they have already tried (and what worked or did not), and sometimes background.

Respond with ONLY a JSON object in exactly this shape:
{"headline": "<ONE concrete, small thing to focus on this week, one sentence, starting with a verb, doable in a few minutes at a time>", "why": "<why this fits THEM, 1-2 plain sentences based on what they shared>", "when": "<one specific moment this week to try it, one sentence>"}

Rules:
- Small and specific beats big and vague. Never repeat something that did not help them; build on what worked.
- No blame, no diagnosis, no tactics to "win". Plain, warm, short sentences. Address the user informally and in the singular (for example "ty" in Slovak or Czech, "du" in German), never the formal or plural "you".
- LANGUAGE: write "headline", "why" and "when" in the language that MOST of the user's own words below are written in (their check-in answers, what they tried, and what they wrote in Coach Chat). Count only the user's own words; ignore the English labels and headings that frame them. If there are no user words or it is a tie, use English.
- Never guess the partner's gender. Say "your partner" (or their name if given) and avoid he, him, she and her unless the text you were given clearly uses that pronoun.
- If there is hardly any information, choose a gentle, universally useful starter (e.g. one genuine question and listening without fixing) and say so in "why".`;

async function generateWeeklyFocus(db, user) {
  const premium = user.plan === "premium";
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const stats = checkinStats(db.checkins, user.id, from, to);
  const exps = listExperimentsForUser(user.id).slice(0, 8);
  const convs = premium
    ? db.conversations
        .filter((c) => c.userId === user.id && c.mode !== "practice" && (c.messages || []).some((m) => m.role === "user"))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    : [];
  // If they have exactly one partner profile, use the name (never guess gender).
  const myPartners = (db.partnerProfiles || []).filter((p) => p.userId === user.id);
  const input = [
    myPartners.length === 1 && myPartners[0].name ? `Their partner is called ${asStr(myPartners[0].name, 60)}.` : "",
    stats.answeredDays
      ? `Check-ins, last 2 weeks: ${stats.answeredDays} answered${stats.average != null ? `, average connection ${stats.average}/10` : ""}${stats.trend ? `, trend ${stats.trend}` : ""}.\n${stats.answers
          .slice(-6)
          .map((c) => `${c.date}: ${asStr(c.answer, 200)}`)
          .join("\n")}`
      : "",
    exps.length ? `What they tried before:\n${experimentLines(exps)}` : "",
    convs.length ? `What they wrote in Coach Chat lately:\n${userLinesDigest(convs, 3, 4, 220)}` : "",
    premium && user.relationshipMemory ? `Background on their story: ${asStr(user.relationshipMemory, 600)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const raw = await aiJson(FOCUS_PROMPT, input || "(no information yet)", 0.6, premium ? PREMIUM_MODEL : STANDARD_MODEL);
  const headline = asStr(raw.headline, 220);
  if (!headline) throw new Error("empty focus");
  return { headline, why: asStr(raw.why, 400), when: asStr(raw.when, 250) };
}

async function ensureWeeklyFocus(db, user) {
  const key = focusWeekKey();
  let doc = getDocByKey(user.id, "focus", key);
  if (doc) return doc;
  const f = await generateWeeklyFocus(db, user);
  doc = saveDoc({ id: generateId("focus"), userId: user.id, kind: "focus", key, title: f.headline.slice(0, 80), data: f });
  return doc;
}

function focusRecap(userId) {
  const prevKey = focusWeekKey(new Date(Date.now() - 7 * 86400000));
  const prev = getDocByKey(userId, "focus", prevKey);
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const rows = listExperimentsForUser(userId).filter((e) => e.resolvedAt && e.resolvedAt >= since);
  if (!prev && !rows.length) return null;
  return {
    headline: prev ? prev.data.headline : null,
    worked: rows.filter((e) => e.status === "worked").length,
    didntHelp: rows.filter((e) => e.status === "didnt_help").length,
  };
}

app.get("/api/focus", authMiddleware, async (req, res) => {
  const user = req.user;
  if (user.plan === "free") return res.json({ plan: "free", locked: true });
  try {
    const doc = await ensureWeeklyFocus(req.db, user);
    const d = doc.data;
    const premium = user.plan === "premium";
    res.json({
      plan: user.plan,
      week: doc.key,
      headline: d.headline,
      why: premium ? d.why : null,
      when: premium ? d.when : null,
      recap: premium ? focusRecap(user.id) : null,
    });
  } catch (err) {
    console.error("Focus error:", err.message);
    res.status(500).json({ error: "Couldn't put together this week's focus right now." });
  }
});

// Premium: a Monday push with the week's focus.
async function runWeeklyFocusPush() {
  const now = new Date();
  if (now.getUTCDay() !== 1 || now.getUTCHours() < 8 || now.getUTCHours() >= 20) return;
  const key = focusWeekKey(now);
  const db = loadDb();
  const todo = db.users
    .filter((u) => u.plan === "premium" && !(getDocByKey(u.id, "focus", key) || {}).notifiedAt && !weeklyFocusFailed.has(`${u.id}:${key}`))
    .slice(0, 10);
  for (const user of todo) {
    try {
      const doc = await ensureWeeklyFocus(db, user);
      await sendPushToUser(user.id, { title: "Your focus for this week", body: doc.data.headline, url: "/playbook.html" });
      saveDoc({ ...doc, notifiedAt: new Date().toISOString() });
    } catch (err) {
      weeklyFocusFailed.add(`${user.id}:${key}`);
      console.error(`Weekly focus failed for ${user.id}:`, err.message);
    }
  }
}
const weeklyFocusFailed = new Set();

// ---------------------------------------------------------------------------
// Ideas for this week: small gestures and simple dates. Pro: 3 ideas a week.
// Premium: 5, tailored to the person (their profile), the user's story and
// what has worked before, with unlimited refreshes. Free: a teaser. Stored as
// docs of kind "ideas" (key = the week's Monday).
// ---------------------------------------------------------------------------

const IDEAS_PROMPT = `You suggest small gestures and simple dates for someone who wants to feel closer to their partner, inside a private AI relationship-coaching app. You get how many ideas to give, sometimes what is known about the partner and about what has worked for this person before, and ideas already shown this week (do not repeat those).

Respond with ONLY a JSON object in exactly this shape:
{"ideas": [{"title": "<3-6 words>", "how": "<one concrete sentence on what to do, specific enough to just do it>", "effort": "<5 min | 30 min | an evening | a weekend>"}]}

Rules:
- Mix mostly small gestures (a few minutes, free or cheap) with one or two simple dates. Low cost by default.
- Specific beats generic: use the partner's known traits and the user's story when given; otherwise pick things that work for most people.
- Never manipulative, never grand-gesture-to-win-someone-back. Plain, warm words. Reply in the language the user writes in (English if unclear). Address the user informally and in the singular (for example "ty" in Slovak or Czech, "du" in German), never the formal or plural "you".
- Never guess the partner's gender. Use the partner's name or "your partner" and avoid he, him, she and her unless the text you were given clearly uses that pronoun.`;

async function generateIdeas(db, user, avoidTitles = []) {
  const premium = user.plan === "premium";
  const partner = premium
    ? db.partnerProfiles.filter((p) => p.userId === user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null
    : null;
  const exps = premium ? listExperimentsForUser(user.id).filter((e) => e.status === "worked").slice(0, 6) : [];
  const raw = await aiJson(
    IDEAS_PROMPT,
    [
      `Number of ideas: ${premium ? 5 : 3}`,
      partner ? `The partner: ${partner.name}\n${buildPartnerContextBlock(partner)}` : "",
      premium && user.relationshipMemory ? `Background on the user's story: ${asStr(user.relationshipMemory, 600)}` : "",
      exps.length ? `Things that worked for them before:\n${exps.map((e) => `- ${asStr(e.text, 140)}`).join("\n")}` : "",
      avoidTitles.length ? `Already shown, do not repeat: ${avoidTitles.join("; ")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    0.8,
    premium ? PREMIUM_MODEL : STANDARD_MODEL
  );
  const items = (Array.isArray(raw.ideas) ? raw.ideas : [])
    .map((x) => ({ title: asStr(x?.title, 60), how: asStr(x?.how, 260), effort: asStr(x?.effort, 30) }))
    .filter((x) => x.title && x.how)
    .slice(0, premium ? 5 : 3);
  if (!items.length) throw new Error("no ideas");
  return { items, forName: partner ? partner.name : null };
}

function publicIdeas(user, doc) {
  return {
    plan: user.plan,
    week: doc.key,
    ideas: doc.data.items,
    forName: user.plan === "premium" ? doc.data.forName || null : null,
    canRefresh: user.plan === "premium",
  };
}

app.get("/api/ideas", authMiddleware, async (req, res) => {
  const user = req.user;
  if (user.plan === "free") return res.json({ plan: "free", locked: true });
  try {
    const key = focusWeekKey();
    let doc = getDocByKey(user.id, "ideas", key);
    if (!doc) {
      const g = await generateIdeas(req.db, user);
      doc = saveDoc({ id: generateId("ideas"), userId: user.id, kind: "ideas", key, title: "", data: { ...g, shown: g.items.map((i) => i.title), refreshes: 0 } });
    }
    res.json(publicIdeas(user, doc));
  } catch (err) {
    console.error("Ideas error:", err.message);
    res.status(500).json({ error: "Couldn't find ideas right now." });
  }
});

app.post("/api/ideas/refresh", authMiddleware, async (req, res) => {
  if (!requirePremium(req, res)) return;
  try {
    const user = req.user;
    if (isOverDailyLimit(user, res)) return;
    const key = focusWeekKey();
    const doc = getDocByKey(user.id, "ideas", key);
    const shown = doc ? doc.data.shown || [] : [];
    if ((doc ? doc.data.refreshes || 0 : 0) >= 30) {
      return res.status(429).json({ error: "That's plenty of ideas for this week. Try some of them first." });
    }
    const g = await generateIdeas(req.db, user, shown.slice(-15));
    const saved = saveDoc({
      id: doc ? doc.id : generateId("ideas"),
      userId: user.id,
      kind: "ideas",
      key,
      title: "",
      data: { ...g, shown: [...shown, ...g.items.map((i) => i.title)].slice(-30), refreshes: (doc ? doc.data.refreshes || 0 : 0) + 1 },
    });
    bumpUsage(user);
    res.json(publicIdeas(user, saved));
  } catch (err) {
    console.error("Ideas refresh error:", err.message);
    res.status(500).json({ error: "Couldn't find new ideas right now." });
  }
});

// ---------------------------------------------------------------------------
// Your year so far (Premium): the monthly reviews rolled into one story.
// Numbers are computed here; the AI writes the words. Stored as a doc of kind
// "yearly" (key = the year). Shown at the bottom of the Monthly review page.
// ---------------------------------------------------------------------------

const YEAR_PROMPT = `You write a person's private "year so far" relationship recap inside an AI coaching app. You get facts about their year (counts, connection scores per month, the headline of each monthly review they have, and what their small experiments showed). Write like a thoughtful coach looking back over a year with a client: warm, specific, honest, never clinical.

Respond with ONLY a JSON object in exactly this shape:
{"headline": "<one sentence capturing the year so far, max 25 words>", "chapters": [{"title": "<3-6 words>", "description": "<2-3 sentences grounded in the material>"}], "biggestShift": "<2-3 sentences on what changed most, using only the numbers given>", "whatWorked": ["<short>"], "lookingAhead": "<2 sentences: the one thing to carry into the next months>", "note": "<one warm closing sentence>"}

Rules:
- Ground everything in the material. Never invent events, people or numbers. Leave a section empty if there is nothing real to say.
- At most 4 chapters and 4 items in whatWorked. Never diagnose; avoid clinical labels. Write in the language the material is written in (English if unclear).`;

function buildYearInput(db, user, year) {
  const from = `${year}-01-01`;
  const to = new Date().toISOString().slice(0, 10);
  const startMs = Date.UTC(year, 0, 1);
  const convs = db.conversations.filter((c) => c.userId === user.id && c.mode !== "practice" && (c.messages || []).some((m) => m.role === "user") && new Date(c.createdAt).getTime() >= startMs);
  const rehearsals = db.conversations.filter((c) => c.userId === user.id && c.mode === "practice" && (c.messages || []).some((m) => m.role === "user") && new Date(c.createdAt).getTime() >= startMs);
  const stats = checkinStats(db.checkins, user.id, from, to);
  const exps = listExperimentsForUser(user.id).filter((e) => new Date(e.createdAt).getTime() >= startMs);
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, "0")}`;
    const r = monthRange(key);
    if (r.startMs > Date.now()) break;
    const st = checkinStats(db.checkins, user.id, r.fromDate, r.toDate);
    months.push({ key, label: monthTitle(key).split(" ")[0].slice(0, 3), avg: st.average, days: st.answeredDays });
  }
  const reviews = listDocs(user.id, "monthly").filter((d) => String(d.key).startsWith(String(year)));
  const activity = convs.length + rehearsals.length + stats.answeredDays + exps.length;
  return { convs, rehearsals, stats, exps, months, reviews, activity };
}

async function generateYearRecap(db, user, year) {
  const input = buildYearInput(db, user, year);
  if (input.activity < 10) return { notEnoughData: true };
  const { stats } = input;
  const parts = [
    `Year: ${year} (so far)`,
    `Coach Chat conversations: ${input.convs.length}. Practice rehearsals: ${input.rehearsals.length}. Check-in days answered: ${stats.answeredDays}.`,
    stats.scoredDays
      ? `Self-rated connection (1-10) on ${stats.scoredDays} days: average ${stats.average}${stats.trend ? `; first half of the year ${stats.firstAvg}, second half ${stats.lastAvg} (trend: ${stats.trend})` : ""}.`
      : "No connection scores this year.",
    input.months.some((m) => m.avg != null) ? `Average connection by month: ${input.months.filter((m) => m.avg != null).map((m) => `${m.label} ${m.avg}`).join(", ")}.` : "",
    input.reviews.length ? `Monthly review headlines:\n${input.reviews.sort((a, b) => (a.key < b.key ? -1 : 1)).map((d) => `${monthTitle(d.key)}: ${asStr(d.data.review?.headline, 200)}`).join("\n")}` : "",
    input.exps.length ? `Playbook experiments this year:\n${experimentLines(input.exps.slice(0, 20))}` : "",
    user.relationshipMemory ? `Standing memory note: ${asStr(user.relationshipMemory, 600)}` : "",
  ].filter(Boolean);
  const raw = await aiJson(YEAR_PROMPT, parts.join("\n\n"), 0.5);
  const recap = {
    headline: asStr(raw.headline, 220),
    chapters: asPairs(raw.chapters, 4, "title", "description"),
    biggestShift: asStr(raw.biggestShift, 600),
    whatWorked: asList(raw.whatWorked, 4),
    lookingAhead: asStr(raw.lookingAhead, 400),
    note: asStr(raw.note, 300),
  };
  if (!recap.headline && !recap.chapters.length) throw new Error("Empty recap");
  return {
    recap,
    stats: {
      conversations: input.convs.length,
      rehearsals: input.rehearsals.length,
      checkinDays: stats.answeredDays,
      averageScore: stats.average,
      trend: stats.trend,
      firstAvg: stats.firstAvg,
      lastAvg: stats.lastAvg,
      experimentsWorked: input.exps.filter((e) => e.status === "worked").length,
      experimentsTried: input.exps.filter((e) => e.status !== "active").length,
      months: input.months,
    },
  };
}

app.get("/api/year", authMiddleware, (req, res) => {
  if (req.user.plan !== "premium") return res.json({ plan: req.user.plan, locked: true });
  const year = new Date().getUTCFullYear();
  const doc = getDocByKey(req.user.id, "yearly", String(year));
  const input = buildYearInput(req.db, req.user, year);
  res.json({ plan: "premium", year, ready: input.activity >= 10, recap: doc ? { ...doc.data, generatedAt: doc.updatedAt } : null });
});

app.post("/api/year", authMiddleware, async (req, res) => {
  if (!requirePremium(req, res)) return;
  try {
    if (isOverDailyLimit(req.user, res)) return;
    const year = new Date().getUTCFullYear();
    const result = await generateYearRecap(req.db, req.user, year);
    if (result.notEnoughData) {
      return res.status(400).json({ error: "There isn't enough yet for a year recap. A few more weeks of chats and check-ins and I'll have a lot more to work with." });
    }
    const existing = getDocByKey(req.user.id, "yearly", String(year));
    const saved = saveDoc({
      id: existing ? existing.id : generateId("year"),
      userId: req.user.id,
      kind: "yearly",
      key: String(year),
      title: `${year} so far`,
      data: result,
      createdAt: existing?.createdAt,
    });
    bumpUsage(req.user);
    res.json({ plan: "premium", year, ready: true, recap: { ...saved.data, generatedAt: saved.updatedAt } });
  } catch (err) {
    console.error("Year recap error:", err.message);
    res.status(500).json({ error: "Couldn't write your year recap right now. Please try again." });
  }
});

app.get("/api/partners", authMiddleware, (req, res) => {
  const list = req.db.partnerProfiles
    .filter((p) => p.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(publicPartner);
  res.json(list);
});

app.post("/api/partners", authMiddleware, (req, res) => {
  try {
    const { name, traits, context, attachmentStyle } = req.body || {};
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

    // attachmentStyle is optional — the user may not know their partner's
    // attachment style, or may just not want to guess. Only accept one of the 4 real keys;
    // anything else (including "", undefined, or a tampered value) is stored
    // as null, meaning "not sure / skip" — Practice Mode simply omits the
    // behavioral guidance in that case rather than guessing.
    const validStyle = Object.prototype.hasOwnProperty.call(ATTACHMENT_STYLES, attachmentStyle) ? attachmentStyle : null;

    const partner = {
      id: generateId("partner"),
      userId: req.user.id,
      name: String(name).trim().slice(0, 60),
      traits: String(traits || "").trim().slice(0, 500),
      context: String(context || "").trim().slice(0, 200),
      attachmentStyle: validStyle,
      createdAt: new Date().toISOString(),
    };
    savePartnerProfile(partner);
    res.json(publicPartner(partner));
  } catch (err) {
    console.error("Create partner error:", err);
    res.status(500).json({ error: "Couldn't save that partner profile. Please try again." });
  }
});

// Edits an existing partner profile's own fields (name, traits, context,
// attachment style) — e.g. adding more detail to their personality, or
// removing something that no longer fits. Partial: only fields actually
// present in the body are changed, same validation/caps as creation above.
// Also doubles as the way to reset a learned profile (resetLearned: true) —
// useful because a profile learned from real pasted-in messages (see
// learnPartnerProfileFromRealMessages) deliberately can't be silently
// overwritten by the automatic Coach-Chat-based learning any more, so this
// is the explicit way back to a blank slate if the learned info is stale or
// wrong.
app.patch("/api/partners/:id", authMiddleware, (req, res) => {
  try {
    const partner = req.db.partnerProfiles.find((p) => p.id === req.params.id && p.userId === req.user.id);
    if (!partner) return res.status(404).json({ error: "Partner profile not found." });

    const { name, traits, context, attachmentStyle, resetLearned } = req.body || {};

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ error: "Give your partner profile a name." });
      }
      partner.name = String(name).trim().slice(0, 60);
    }
    if (traits !== undefined) partner.traits = String(traits || "").trim().slice(0, 500);
    if (context !== undefined) partner.context = String(context || "").trim().slice(0, 200);
    if (attachmentStyle !== undefined) {
      partner.attachmentStyle = Object.prototype.hasOwnProperty.call(ATTACHMENT_STYLES, attachmentStyle) ? attachmentStyle : null;
    }
    if (resetLearned) {
      partner.learnedProfile = null;
      partner.learnedVoice = null;
      partner.learnedProfileConfidence = null;
      partner.learnedProfileUpdatedAt = null;
      partner.learnedProfileSource = null;
    }

    savePartnerProfile(partner);
    res.json(publicPartner(partner));
  } catch (err) {
    console.error("Update partner error:", err);
    res.status(500).json({ error: "Couldn't save those changes. Please try again." });
  }
});

app.delete("/api/partners/:id", authMiddleware, (req, res) => {
  const partner = req.db.partnerProfiles.find((p) => p.id === req.params.id && p.userId === req.user.id);
  if (!partner) return res.status(404).json({ error: "Partner profile not found." });
  deletePartnerProfile(partner.id);
  res.json({ ok: true });
});

// Explicit, user-triggered version of the automatic Coach-Chat-based
// learning above: the user pastes in real messages their partner actually
// sent (a chat export, transcribed screenshots, whatever they have), and
// RelationshipAI extracts a behavioral + voice profile straight from that —
// higher fidelity than anything inferred secondhand, since it's the
// partner's own real wording. Each call is capped by input length (see
// learnPartnerProfileFromRealMessages), and now also shares the same daily
// AI-message gate as every other OpenAI-calling route — it was the one
// unmetered surface a Free account could otherwise loop on for free.
app.post("/api/partners/:id/learn-from-messages", authMiddleware, async (req, res) => {
  try {
    const partner = req.db.partnerProfiles.find((p) => p.id === req.params.id && p.userId === req.user.id);
    if (!partner) return res.status(404).json({ error: "Partner profile not found." });
    if (isOverDailyLimit(req.user, res)) return;

    const { messages } = req.body || {};
    await learnPartnerProfileFromRealMessages(partner, messages);
    bumpUsage(req.user);
    res.json(publicPartner(partner));
  } catch (err) {
    if (err && err.status === 400) {
      return res.status(400).json({ error: err.message });
    }
    console.error("Learn from real messages error:", err.message);
    res.status(500).json({ error: "Couldn't learn from those messages right now. Please try again." });
  }
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
      aboutPartnerId: c.aboutPartnerId || null,
      pinned: !!c.pinned,
    }));
  res.json(list);
});

app.post("/api/conversations", authMiddleware, async (req, res) => {
  const db = req.db;
  const { mode, partnerProfileId, scenario, intensity, roleSwap } = req.body || {};
  const isPractice = mode === "practice";
  if (isPractice && intensity === "tough" && req.user.plan !== "premium") {
    return res.status(403).json({ error: "Hard mode is part of Premium.", upgradeRequired: true });
  }

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

    // Fully automatic — no button. If there's new Coach Chat activity since
    // the last time this partner was learned (or it's never been learned),
    // this refreshes it before the rehearsal starts. See
    // learnPartnerProfileIfStale above for the staleness check and why it
    // fails open instead of blocking the conversation on an AI hiccup.
    await learnPartnerProfileIfStale(db, req.user.id, partner);
  } else {
    // Fully automatic, same fail-open shape as the partner learning above —
    // see updateRelationshipMemoryIfStale for the staleness/cooldown logic.
    await ensureMemoryFresh(req.user.id);
  }

  // Snapshotted at conversation-start time, same as partnerName/partnerTraits/
  // partnerContext below — a later edit to the partner profile's
  // attachment style shouldn't silently rewrite a rehearsal already in
  // progress. The scenario is per-conversation, not per-profile: what the
  // user wants to practice today is often different each time. intensity/
  // roleSwap are likewise per-rehearsal choices, not saved to the partner
  // profile itself — see the comment on buildPartnerSystemPrompt.
  const practiceScenario = isPractice ? String(scenario || "").trim().slice(0, 300) || null : null;
  const conv = {
    id: generateId("conv"),
    userId: req.user.id,
    mode: isPractice ? "practice" : "coach",
    partnerProfileId: partner ? partner.id : null,
    partnerName: partner ? partner.name : null,
    partnerTraits: partner ? partner.traits : null,
    partnerContext: partner ? partner.context : null,
    partnerAttachmentStyle: partner ? partner.attachmentStyle || null : null,
    partnerLearnedProfile: partner ? partner.learnedProfile || null : null,
    partnerLearnedVoice: partner ? partner.learnedVoice || null : null,
    scenario: practiceScenario,
    intensity: isPractice && intensity === "supportive" ? "supportive" : isPractice && intensity === "tough" ? "tough" : isPractice ? "realistic" : null,
    practiceRoleSwap: isPractice ? !!roleSwap : false,
    // Which relationship a Coach Chat conversation is about — nullable,
    // meaningless for Practice mode (that already has partnerProfileId).
    // Only matters once a user has more than one partner profile; see
    // learnPartnerProfileIfStale for why this exists at all: without it,
    // there's no way to know which partner a coaching conversation refers
    // to, so automatic learning can't safely be attributed. Settable here
    // at creation or any time after via PATCH /api/conversations/:id.
    aboutPartnerId: null,
    // Partner name always comes first, then the topic — see practiceTitle's
    // comment above. When the user filled in "what do you want to practice
    // today?" at setup, that's the topic immediately; otherwise this stays
    // a placeholder ("<partner> — new practice") until the first message
    // lets POST /api/conversations/:id/messages fill in a generated one.
    title: isPractice ? practiceTitle(partner.name, truncateForTitle(practiceScenario, 40)) : "New conversation",
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveConversation(conv);
  if (isPractice && req.user.plan === "free") {
    incrementUserColumn(req.user.id, "lifetimePracticeConversations", 1);
  }
  res.json(
    isPractice && req.user.plan === "free"
      ? { ...conv, practiceCap: { used: 0, limit: FREE_PRACTICE_MAX_USER_MESSAGES, closed: false } }
      : conv
  );
});

// General-purpose conversation-metadata patch, used by:
//  - the Coach-tag chip bar: tags (or untags) which partner profile a Coach
//    Chat conversation is about. Self-reported by the user, not AI-guessed —
//    see the comment on learnPartnerProfileIfStale for why a guess isn't good
//    enough once someone has more than one partner profile. Works on any past
//    conversation too, so a user can go back and tag older Coach Chat
//    history, not just new chats.
//  - the sidebar history kebab menu (task #97): rename (title) and pin
//    (pinned). Each field is independent and only applied when present in
//    the body, so a rename request doesn't also have to resend pinned state,
//    etc. aboutPartnerId keeps its practice-mode restriction; title/pinned
//    apply to both Coach and Practice conversations.
app.patch("/api/conversations/:id", authMiddleware, (req, res) => {
  const db = req.db;
  const conv = db.conversations.find((c) => c.id === req.params.id && c.userId === req.user.id);
  if (!conv) return res.status(404).json({ error: "Conversation not found." });

  const body = req.body || {};
  let changed = false;

  if (Object.prototype.hasOwnProperty.call(body, "aboutPartnerId")) {
    if (conv.mode === "practice") {
      return res.status(400).json({ error: "Practice conversations already belong to a partner profile." });
    }
    const { aboutPartnerId } = body;
    if (aboutPartnerId === null || aboutPartnerId === undefined || aboutPartnerId === "") {
      conv.aboutPartnerId = null;
    } else {
      const partner = db.partnerProfiles.find((p) => p.id === aboutPartnerId && p.userId === req.user.id);
      if (!partner) return res.status(400).json({ error: "Partner profile not found." });
      conv.aboutPartnerId = partner.id;
    }
    changed = true;
  }

  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    const title = String(body.title || "").trim().slice(0, 120);
    if (!title) return res.status(400).json({ error: "Title can't be empty." });
    conv.title = title;
    changed = true;
  }

  if (Object.prototype.hasOwnProperty.call(body, "pinned")) {
    conv.pinned = !!body.pinned;
    changed = true;
  }

  if (!changed) return res.status(400).json({ error: "Nothing to update. Send aboutPartnerId, title, and/or pinned." });

  saveConversation(conv);
  res.json({ id: conv.id, title: conv.title, aboutPartnerId: conv.aboutPartnerId, pinned: conv.pinned });
});

app.get("/api/conversations/:id", authMiddleware, (req, res) => {
  const conv = req.db.conversations.find((c) => c.id === req.params.id && c.userId === req.user.id);
  if (!conv) return res.status(404).json({ error: "Conversation not found." });
  let practiceCap = null;
  if (conv.mode === "practice" && req.user.plan === "free") {
    const used = (conv.messages || []).filter((m) => m.role === "user").length;
    practiceCap = { used, limit: FREE_PRACTICE_MAX_USER_MESSAGES, closed: used >= FREE_PRACTICE_MAX_USER_MESSAGES };
  }
  // Premium: the short plan someone asked for when starting this rehearsal.
  let plan = null;
  if (conv.mode === "practice" && req.user.plan === "premium") {
    const t = listDocs(req.user.id, "talk").find((d) => d.data && d.data.conversationId === conv.id);
    if (t) plan = t.data.plan || null;
  }
  res.json({ ...conv, practiceCap, plan, messages: signAttachmentsInMessages(conv.messages) });
});

app.delete("/api/conversations/:id", authMiddleware, (req, res) => {
  const conv = req.db.conversations.find((c) => c.id === req.params.id && c.userId === req.user.id);
  if (!conv) return res.status(404).json({ error: "Conversation not found." });
  deleteConversation(conv.id);
  res.json({ ok: true });
});

app.post("/api/conversations/:id/messages", authMiddleware, async (req, res) => {
  const { message, attachments: rawAttachments, quality: wantedQuality } = req.body || {};
  const text = message ? String(message).trim() : "";
  const hasText = text.length > 0;
  const hasAttachments = Array.isArray(rawAttachments) && rawAttachments.length > 0;

  if (!hasText && !hasAttachments) {
    return res.status(400).json({ error: "Write a message or attach a file." });
  }
  if (text.length > MAX_CHAT_MESSAGE_CHARS) {
    return res.status(400).json({ error: `That message is too long (max ${MAX_CHAT_MESSAGE_CHARS.toLocaleString()} characters). Try splitting it up.` });
  }

  const db = req.db;
  const conv = db.conversations.find((c) => c.id === req.params.id && c.userId === req.user.id);
  if (!conv) return res.status(404).json({ error: "Conversation not found." });

  const user = db.users.find((u) => u.id === req.user.id);
  // Per-chat answer quality picked in the composer ("fast" | "advanced").
  // "advanced" is only honoured where the plan allows it, else it's Fast.
  if (wantedQuality === "fast" || wantedQuality === "advanced") {
    const q = wantedQuality === "advanced" && !canChooseAdvanced(user) ? "fast" : wantedQuality;
    if ((conv.quality || null) !== q) {
      conv.quality = q;
      setConversationQuality(conv.id, q);
    }
  }
  // Free + Practice: the single free rehearsal has its own cap instead of the
  // shared 8/day Coach pool. After it, the rehearsal is closed.
  const freePractice = user.plan === "free" && conv.mode === "practice";
  if (isOverDailyLimit(user, res, { skipFreeDaily: freePractice })) return;
  if (freePractice) {
    const sent = (conv.messages || []).filter((m) => m.role === "user").length;
    if (sent >= FREE_PRACTICE_MAX_USER_MESSAGES) {
      return res.status(403).json({
        error: `Your free rehearsal is finished (${FREE_PRACTICE_MAX_USER_MESSAGES} messages). Get your debrief below, or upgrade to Pro for unlimited rehearsals.`,
        practiceClosed: true,
        upgradeRequired: true,
      });
    }
  }

  // Editing & resending the LAST message (chat.js's "✏️ Edit" on the most
  // recent user bubble, Coach Chat only) sends the same shape as a normal
  // new message plus editMessageId — the id of the user message being
  // replaced. Checked (and only actually truncated) after the daily-limit
  // gate above, deliberately: if the person's out of messages for today,
  // fail before touching anything, so the original exchange they were
  // trying to edit is never removed without a replacement actually landing.
  const editMessageId = req.body && req.body.editMessageId ? String(req.body.editMessageId) : null;
  if (editMessageId) {
    const truncated = truncateLastMessagePairIfMatch(conv.id, editMessageId);
    // Keep this request's in-memory snapshot of the conversation in sync
    // with what was just persisted — priorHistory below reads conv.messages
    // directly, and without this it would still include the stale pair
    // that was just removed from the database, feeding the old exchange
    // back into the prompt as if it never happened.
    if (truncated) conv.messages = conv.messages.slice(0, -2);
  }

  if (hasAttachments && user.plan === "free") {
    const usedSoFar = user.lifetimeAttachmentCount || 0;
    if (usedSoFar + rawAttachments.length > FREE_LIFETIME_ATTACHMENT_LIMIT) {
      const remaining = Math.max(0, FREE_LIFETIME_ATTACHMENT_LIMIT - usedSoFar);
      return res.status(403).json({
        error:
          remaining > 0
            ? `The Free plan includes ${FREE_LIFETIME_ATTACHMENT_LIMIT} file/photo attachments total, and you have ${remaining} left. Try attaching fewer files, or upgrade to Pro for unlimited attachments.`
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
    incrementUserColumn(user.id, "lifetimeAttachmentCount", savedAttachments.length);
  }

  // Prior turns for the prompt come from the conversation's state as of the
  // START of this request (before the new user message below) — same
  // effective window (last 20 turns) the old code got from slicing the
  // in-memory array right after pushing onto it.
  const priorHistory = conv.messages.slice(-60).map((m) => ({ role: m.role, content: m.content }));

  const userMessage = {
    id: generateId("msg"),
    role: "user",
    content: text,
    attachments: savedAttachments.map(stripInternalFields),
    at: new Date().toISOString(),
  };

  // Persist the user's message immediately, before the AI call — this is
  // the fix for the old race: appendConversationMessages re-reads the
  // conversation's CURRENT persisted messages at write time rather than
  // trusting this request's possibly-stale in-memory snapshot, so a
  // concurrent request touching the same conversation can never clobber
  // this message (or vice versa). It also means the user's message is
  // safely saved even if the OpenAI call below fails.
  appendConversationMessages(conv.id, [userMessage], { updatedAt: userMessage.at });

  const isPractice = conv.mode === "practice";
  // A Coach Chat conversation the user has tagged to a specific saved
  // partner (see buildCoachSystemPrompt above) — null for an untagged
  // conversation or a Practice rehearsal, where partner context is already
  // baked into buildPartnerSystemPrompt below.
  const taggedPartner =
    !isPractice && conv.aboutPartnerId ? db.partnerProfiles.find((p) => p.id === conv.aboutPartnerId && p.userId === user.id) : null;
  // Only computed for Coach Chat — Practice is a roleplay, not coaching, so
  // the user's own check-in answers aren't relevant to what "the partner"
  // would say next.
  const recentCheckinContext = isPractice ? "" : buildRecentCheckinContext(db.checkins, user.id);
  const systemPrompt = isPractice
    ? buildPartnerSystemPrompt({
        name: conv.partnerName || "your partner",
        traits: conv.partnerTraits,
        context: conv.partnerContext,
        attachmentStyle: conv.partnerAttachmentStyle,
        learnedProfile: conv.partnerLearnedProfile,
        voice: conv.partnerLearnedVoice,
        scenario: conv.scenario,
        userAttachmentStyle: user.attachmentStyle,
        intensity: conv.intensity,
        roleSwap: conv.practiceRoleSwap,
      })
    : buildCoachSystemPrompt(user, taggedPartner, recentCheckinContext, buildPlaybookContext(user.id));

  // Only the very first message of a conversation gets a generated title —
  // conv.messages here still reflects the state as of the START of this
  // request (see priorHistory above), i.e. before the userMessage appended
  // earlier in this handler, so an empty array means this really is message
  // #1. Every later message in the same conversation keeps its title as-is.
  const isFirstExchange = conv.messages.length === 0;
  // Practice conversations that already got a real topic at creation time
  // (the user filled in "what do you want to practice today?" — see
  // practiceTitle in POST /api/conversations) don't need anything generated
  // here; only a scenario-less Practice rehearsal still needs a topic once
  // the first message reveals one.
  const needsGeneratedTitle = isFirstExchange && (!isPractice || !conv.scenario);
  const firstMessageText = hasText ? text : savedAttachments[0]?.name ? `[attached file: ${savedAttachments[0].name}]` : "";

  const chatModel = chatModelFor(user, conv, isPractice);

  try {
    // Prior turns are sent as plain text (their attachments are just noted
    // in the stored content, not re-uploaded); only the newest message gets
    // full multimodal treatment, so images aren't re-sent to the model on
    // every follow-up turn.
    const latestContent = buildModelContent(text, savedAttachments);

    const [completion, generatedTitle] = await Promise.all([
      openai.chat.completions.create({
        model: chatModel,
        messages: [{ role: "system", content: systemPrompt }, ...priorHistory, { role: "user", content: latestContent }],
        temperature: isPractice ? 0.95 : 0.8,
        // reasoning_effort removed in the RelateIQ42 rollback (see the
        // STANDARD_MODEL/PREMIUM_MODEL comment above) — gpt-4o doesn't
        // support this parameter at all, and sending it errors the whole
        // call, not just downgrades gracefully. Re-add once the models that
        // actually support it are confirmed working on Jonas's account.
      }),
      // Runs alongside the main reply, not after it, so titling the first
      // message doesn't add extra latency — see the comment above
      // generateConversationTitle. Only fired on the first message (and,
      // for Practice, only when there's no scenario title already); every
      // other message resolves this to null instantly, no extra API call.
      needsGeneratedTitle
        ? (isPractice ? generatePracticeTopic(firstMessageText) : generateConversationTitle(firstMessageText)).catch((err) => {
            console.error("Conversation title generation error:", err.message);
            return ""; // fail open — falls back to the truncation-based title below
          })
        : Promise.resolve(null),
    ]);

    let rawReply = completion.choices[0]?.message?.content?.trim() || "Sorry, I can't respond right now. Please try again.";
    // Coach Chat only: one rewrite when the draft slipped into stock chatbot
    // phrasing. Fails open (the original draft is kept) so it can never break a reply.
    if (!isPractice && rawReply) {
      const stock = findStockPhrase(rawReply);
      if (stock) {
        try {
          const redo = await openai.chat.completions.create({
            model: chatModel,
            messages: [
              { role: "system", content: systemPrompt },
              ...priorHistory,
              { role: "user", content: latestContent },
              { role: "assistant", content: rawReply },
              {
                role: "user",
                content: `Your draft above reads like a generic chatbot (it contains: "${stock}"). Rewrite it from scratch as a skilled, warm, fair relationship therapist would answer in a chat: show you caught the specific thing I wrote, give your honest read of what is going on between me and my partner including my own part in it, give one or two concrete steps (with exact wording when I need words), and stop. No empty sympathy, no "it seems", no offer of help, no question about how I feel about your idea. Keep the same language. Write only the new reply.`,
              },
            ],
            temperature: 0.7,
          });
          const better = redo.choices[0]?.message?.content?.trim();
          if (better && !findStockPhrase(better)) rawReply = better;
        } catch (err) {
          console.error("Coach rewrite pass error:", err.message);
        }
      }
    }
    // Coach only: the model may end its reply with a [[try: ...]] line (see
    // the PLAYBOOK paragraph in buildCoachSystemPrompt). It never reaches
    // the user as text — it becomes a "Try this" card instead.
    let reply = rawReply;
    let suggestion = null;
    {
      const TRY_RE = /\[\[\s*try:\s*([\s\S]*?)\s*\]\]/gi;
      const found = [...rawReply.matchAll(TRY_RE)];
      reply = rawReply.replace(TRY_RE, "").replace(/\n{3,}/g, "\n\n").trim() || rawReply;
      if (!isPractice && found.length) {
        const t = found[0][1].replace(/\s+/g, " ").trim().slice(0, 200);
        if (t.length >= 6) suggestion = t;
      }
    }

    let title = conv.title;
    if (needsGeneratedTitle) {
      if (isPractice) {
        // Partner name always first, then the topic — generatedTitle here
        // is a bare topic phrase (see generatePracticeTopic), never the
        // partner's name, so this never duplicates it.
        const topic = generatedTitle || truncateForTitle(firstMessageText, 30);
        title = practiceTitle(conv.partnerName, topic);
      } else if (generatedTitle) {
        title = generatedTitle;
      } else if (hasText) {
        title = text.slice(0, 48) + (text.length > 48 ? "…" : "");
      } else if (savedAttachments.length > 0) {
        title = `📎 ${savedAttachments[0].name}`.slice(0, 48);
      }
    }

    const assistantMessage = { id: generateId("msg"), role: "assistant", content: reply, at: new Date().toISOString() };
    if (suggestion) assistantMessage.suggestion = suggestion;
    appendConversationMessages(conv.id, [assistantMessage], { updatedAt: assistantMessage.at, title });

    if (!freePractice) bumpUsage(user, chatModel, { coachPool: user.plan === "pro" && !isPractice });
    if (!isPractice) scheduleMemoryUpdate(req.user.id);

    const practiceUserCount = freePractice ? (conv.messages || []).filter((m) => m.role === "user").length + 1 : null;
    res.json({
      // Which model actually answered ("advanced" can fall back to "fast"
      // once the monthly strong-model budget is used up) + the fresh meter.
      quality: chatModel === PREMIUM_MODEL ? "advanced" : "fast",
      strongModelUsage: user.plan === "free" ? null : { used: strongModelUsed(user), limit: strongModelBudgetFor(user.plan) },
      coachStrongUsage: user.plan === "pro" ? { used: coachStrongUsed(user), limit: PRO_COACH_STRONG_BUDGET } : null,
      practice: freePractice
        ? { used: practiceUserCount, limit: FREE_PRACTICE_MAX_USER_MESSAGES, closed: practiceUserCount >= FREE_PRACTICE_MAX_USER_MESSAGES }
        : null,
      reply,
      messageId: assistantMessage.id,
      suggestion,
      userMessageId: userMessage.id,
      title,
      mode: conv.mode,
      partnerName: conv.partnerName,
      attachments: savedAttachments.map(stripInternalFields).map((a) => (a.url ? { ...a, url: signAttachmentUrl(a.url) } : a)),
      usage: user.usage,
    });
  } catch (err) {
    console.error("OpenAI error:", err.message);
    // The user's message was durably saved above, before the AI call — roll
    // it back out now that the call has failed, so a failed send truly
    // leaves nothing behind (matches what chat.js's UI does on its side:
    // restores the typed text to the composer and tells the person nothing
    // was sent, instead of leaving a half-saved message with no reply that
    // would reappear, orphaned, on the next reload).
    removeLastMessageIfMatch(conv.id, userMessage.id);
    res.status(500).json({ error: "Couldn't get a response from the AI. Please try again." });
  }
});

// Thumbs up/down on a single Coach Chat or Practice reply — a real,
// per-message quality signal Jonas can actually look at, instead of going
// by feel. Deliberately minimal: no comment field, no analytics pipeline,
// just feedback: "up" | "down" | null (null clears a previously-set vote,
// e.g. tapping the same button again) stored right on the message. Only
// ever set on an assistant message — voting on your own message wouldn't
// mean anything.
app.patch("/api/conversations/:id/messages/:messageId/feedback", authMiddleware, (req, res) => {
  const { feedback } = req.body || {};
  if (feedback !== "up" && feedback !== "down" && feedback !== null) {
    return res.status(400).json({ error: 'feedback must be "up", "down", or null.' });
  }

  const db = req.db;
  const conv = db.conversations.find((c) => c.id === req.params.id && c.userId === req.user.id);
  if (!conv) return res.status(404).json({ error: "Conversation not found." });

  const message = conv.messages.find((m) => m.id === req.params.messageId);
  if (!message || message.role !== "assistant") {
    return res.status(404).json({ error: "Message not found." });
  }

  const updated = setMessageFeedback(conv.id, req.params.messageId, feedback);
  if (!updated) return res.status(404).json({ error: "Message not found." });

  res.json({ id: req.params.messageId, feedback });
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
        error: "Summaries are available for Coach Chat conversations. Partner Practice is a rehearsal, not a real conversation with your partner, so it isn't something to bring to a therapist as fact.",
      });
    }

    const userMessageCount = (conv.messages || []).filter((m) => m.role === "user").length;
    if (userMessageCount === 0) {
      return res.status(400).json({ error: "Add a bit more to the conversation before exporting a summary." });
    }

    const regenerate = !!(req.body && req.body.regenerate) && req.user.plan !== "free";
    if (conv.therapistSummary && !regenerate) {
      return res.json({
        summary: conv.therapistSummary,
        generatedAt: conv.therapistSummaryAt,
        conversationTitle: conv.title,
        cached: true,
      });
    }

    const user = db.users.find((u) => u.id === req.user.id);
    if (user.plan === "free" && freeExportsUsed(db, user.id) >= FREE_LIFETIME_EXPORT_LIMIT) {
      return res.status(403).json({
        error: `The Free plan includes ${FREE_LIFETIME_EXPORT_LIMIT} therapist summary export. Upgrade to Pro for unlimited exports.`,
        exportLimitReached: true,
        upgradeRequired: true,
      });
    }
    if (isOverDailyLimit(user, res)) return;

    const transcript = buildConversationTranscript(conv);
    const completion = await openai.chat.completions.create({
      model: STANDARD_MODEL,
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
    saveConversation(conv);
    if (user.plan === "free") {
      saveDoc({ id: generateId("doc"), userId: user.id, kind: "export", key: conv.id, title: conv.title || "", data: {} });
    }
    bumpUsage(user);

    res.json({ summary, generatedAt, conversationTitle: conv.title, cached: false, usage: user.usage });
  } catch (err) {
    console.error("Therapist summary error:", err.message);
    res.status(500).json({ error: "Couldn't generate a summary right now. Please try again." });
  }
});

// ---------------------------------------------------------------------------
// Practice debrief — the Partner Practice counterpart to the therapist
// summary above: a short, structured readout of a rehearsal (what went
// well, what to watch for, one concrete tip), aimed at the real
// conversation still to come. Same caching pattern: generated once,
// cached on the conversation, { regenerate: true } forces a fresh one.
// ---------------------------------------------------------------------------

const PRACTICE_DEBRIEF_MIN_USER_MESSAGES = 2;

// Premium: how readiness changed across rehearsals with the same person.
// Everyone gets the single readiness number in their debrief; the trend over
// time is the Premium part. Free/Pro get progressLocked so the UI can hint.
function practiceProgressFor(db, user, conv) {
  const scored = db.conversations
    .filter((c) => c.userId === user.id && c.mode === "practice" && c.partnerProfileId && c.partnerProfileId === conv.partnerProfileId && c.practiceDebrief)
    .map((c) => {
      let r = null;
      try {
        r = JSON.parse(c.practiceDebrief).readiness;
      } catch {}
      return { id: c.id, at: c.createdAt, readiness: Number.isFinite(r) ? r : null };
    })
    .filter((x) => x.readiness !== null)
    .sort((a, b) => new Date(a.at) - new Date(b.at));
  // The conversation being debriefed may not be saved yet (first debrief), so make sure it is in the list.
  if (conv.practiceDebrief) {
    try {
      const own = JSON.parse(conv.practiceDebrief).readiness;
      if (Number.isFinite(own) && !scored.some((x) => x.id === conv.id)) scored.push({ id: conv.id, at: conv.createdAt, readiness: own });
    } catch {}
  }
  scored.sort((a, b) => new Date(a.at) - new Date(b.at));
  if (user.plan !== "premium") return { progressLocked: scored.length >= 2 };
  return { progress: scored.slice(-6).map((x) => x.readiness), progressWith: conv.partnerName || null };
}

app.post("/api/conversations/:id/debrief", authMiddleware, async (req, res) => {
  try {
    const db = req.db;
    const conv = db.conversations.find((c) => c.id === req.params.id && c.userId === req.user.id);
    if (!conv) return res.status(404).json({ error: "Conversation not found." });

    if (conv.mode !== "practice") {
      return res.status(400).json({
        error: "A debrief is available for Partner Practice rehearsals. This is a Coach Chat conversation, not a rehearsal.",
      });
    }

    const userMessageCount = (conv.messages || []).filter((m) => m.role === "user").length;
    if (userMessageCount < PRACTICE_DEBRIEF_MIN_USER_MESSAGES) {
      return res.status(400).json({ error: "Practice the conversation a bit more before asking for a debrief. A couple more exchanges will give a lot more to work with." });
    }

    const regenerate = !!(req.body && req.body.regenerate);
    if (conv.practiceDebrief && !regenerate) {
      return res.json({
        ...JSON.parse(conv.practiceDebrief),
        generatedAt: conv.practiceDebriefAt,
        feedback: conv.practiceDebriefFeedback || null,
        cached: true,
        ...practiceProgressFor(db, req.user, conv),
      });
    }

    const user = db.users.find((u) => u.id === req.user.id);
    // The debrief belongs to the Free rehearsal itself, not the Coach pool.
    if (isOverDailyLimit(user, res, { skipFreeDaily: user.plan === "free" })) return;

    const transcript = buildPracticeTranscript(conv);
    const completion = await openai.chat.completions.create({
      model: STANDARD_MODEL,
      messages: [
        { role: "system", content: PRACTICE_DEBRIEF_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Partner's name (roleplayed by the AI): ${conv.partnerName || "the partner"}\n\nRehearsal transcript:\n"""\n${transcript}\n"""`,
        },
      ],
      temperature: 0.5,
      response_format: { type: "json_object" },
    });

    let parsed = {};
    try {
      parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    } catch (err) {
      parsed = {};
    }
    const readinessNum = Math.round(Number(parsed.readiness));
    const debrief = {
      wentWell: String(parsed.wentWell || "").trim(),
      watchFor: String(parsed.watchFor || "").trim(),
      tip: String(parsed.tip || "").trim(),
      readiness: Number.isFinite(readinessNum) && readinessNum >= 1 && readinessNum <= 10 ? readinessNum : null,
    };
    if (!debrief.wentWell && !debrief.watchFor && !debrief.tip) {
      return res.status(500).json({ error: "Couldn't generate a debrief right now. Please try again." });
    }

    const generatedAt = new Date().toISOString();
    conv.practiceDebrief = JSON.stringify(debrief);
    conv.practiceDebriefAt = generatedAt;
    // A freshly (re)generated debrief starts unrated — any thumbs up/down on
    // a PRIOR debrief for this conversation shouldn't silently carry over
    // and look like it applies to this new readout.
    conv.practiceDebriefFeedback = null;
    saveConversation(conv);
    if (user.plan !== "free") bumpUsage(user);
    scheduleMemoryUpdate(req.user.id);

    res.json({ ...debrief, generatedAt, feedback: null, cached: false, usage: user.usage, ...practiceProgressFor(db, user, conv) });
  } catch (err) {
    console.error("Practice debrief error:", err.message);
    res.status(500).json({ error: "Couldn't generate a debrief right now. Please try again." });
  }
});

// Thumbs up/down on a Partner Practice debrief (task #93) — the debrief
// counterpart to PATCH /api/conversations/:id/messages/:messageId/feedback
// above, but scoped to the conversation itself rather than a message id:
// there's at most one ACTIVE debrief per conversation at a time (cached on
// conv.practiceDebrief, regenerated wholesale rather than versioned — see
// POST .../debrief above), so there's nothing else to key a rating off of.
// Clicking an already-active button clears the vote (feedback: null), same
// as the per-message version.
app.patch("/api/conversations/:id/debrief/feedback", authMiddleware, (req, res) => {
  const { feedback } = req.body || {};
  if (feedback !== "up" && feedback !== "down" && feedback !== null) {
    return res.status(400).json({ error: 'feedback must be "up", "down", or null.' });
  }

  const db = req.db;
  const conv = db.conversations.find((c) => c.id === req.params.id && c.userId === req.user.id);
  if (!conv) return res.status(404).json({ error: "Conversation not found." });
  if (conv.mode !== "practice") {
    return res.status(400).json({ error: "Debrief feedback is only available for Partner Practice rehearsals." });
  }
  if (!conv.practiceDebrief) {
    return res.status(400).json({ error: "Generate a debrief before rating it." });
  }

  conv.practiceDebriefFeedback = feedback;
  saveConversation(conv);
  res.json({ ok: true, feedback: conv.practiceDebriefFeedback });
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
    // Insights is a Pro feature (see the pricing table), so Free accounts
    // get a locked state instead of a generated analysis.
    if (req.user.plan === "free") return res.json({ plan: "free", locked: true });
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
    // Persist the insights fields first, then bump usage last: bumpFreeUsage
    // is an atomic SQL increment against whatever's currently stored, so
    // doing it last (nothing after it touches the user row in this request)
    // means it's always correct even if saveUser's full-row write above
    // raced with another request's own usage bump in between.
    saveUser(user);
    bumpUsage(user);

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
    model: STANDARD_MODEL,
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
async function generateInsightsForDigest(user, coachConversations) {
  if (user.insights && user.insightsAt) {
    const ageMs = Date.now() - new Date(user.insightsAt).getTime();
    if (ageMs < 6 * 24 * 60 * 60 * 1000) {
      return { patterns: user.insights.patterns, note: user.insights.note };
    }
  }

  const { patterns, note } = await generateInsightsRaw(coachConversations);
  user.insights = { patterns, note };
  user.insightsAt = new Date().toISOString();
  saveUser(user);
  return { patterns, note };
}

// Turns a partner profile into a plain descriptive block for the Coach Chat
// prompt (as opposed to buildPartnerSystemPrompt, which turns one into
// ROLEPLAY instructions for Partner Practice) — traits, attachment
// behavior, and anything RelationshipAI has learned, so the coaching advice can
// actually be shaped around this specific person instead of staying
// generic. Returns "" when the partner has nothing usable yet, so the
// caller can omit the section entirely rather than send an empty one.
function buildPartnerContextBlock(partner) {
  if (!partner) return "";
  const parts = [];
  if (partner.traits) parts.push(`Personality/traits: ${partner.traits}`);
  if (partner.context) parts.push(`Relationship context: ${partner.context}`);
  const attachmentNote = partnerAttachmentBehavior(partner.attachmentStyle);
  if (attachmentNote) parts.push(attachmentNote);
  if (partner.learnedProfile) parts.push(`What RelationshipAI has learned about how they communicate: ${partner.learnedProfile}`);
  if (partner.learnedVoice) parts.push(`How they specifically tend to phrase things: ${partner.learnedVoice}`);
  return parts.length ? parts.join("\n") : "";
}

// ---------------------------------------------------------------------------
// Daily check-in — always optional/skippable, never gates anything
// ---------------------------------------------------------------------------

// One daily check-in: today's question (the same one on the dashboard and on
// the Daily question page), an optional 1-10 connection score and optional
// text. Needs at least a score or a few words. Stored in both the checkins
// table (scores, stats, streaks) and the soloAnswers stream (question history),
// so the two pages always agree.
function dailyCheckinPayload(db, userId, row) {
  const entry = db.checkins.find((c) => c.userId === userId && c.date === row.date);
  const answer = (entry && entry.answer) || row.answer || null;
  const score = entry && typeof entry.score === "number" ? entry.score : null;
  return {
    date: row.date,
    question: row.question,
    answered: !!answer || score !== null,
    skipped: !!(entry && entry.skipped) && !answer && score === null,
    answer,
    score,
    streak: computeCheckinStreak(db.checkins, userId),
  };
}

async function saveDailyCheckin(db, user, { answer, score, skip }) {
  const today = todayKey();
  const row = await ensureTodaysSoloQuestion(db, user.id, today);
  let entry = db.checkins.find((c) => c.userId === user.id && c.date === today);
  if (!entry) {
    entry = {
      id: generateId("checkin"),
      userId: user.id,
      date: today,
      question: row.question,
      answer: null,
      score: null,
      skipped: false,
      createdAt: new Date().toISOString(),
    };
  }
  if (skip) {
    // Skipping never undoes a check-in that already has a score or text.
    if (!entry.answer && typeof entry.score !== "number") entry.skipped = true;
  } else {
    const text = String(answer || "").trim();
    const n = Number(score);
    const validScore = score !== null && score !== undefined && score !== "" && Number.isInteger(n) && n >= 1 && n <= 10;
    if (!text && !validScore) {
      const err = new Error("Add a score or a few words, or skip for today.");
      err.status = 400;
      throw err;
    }
    if (text) {
      entry.answer = text.slice(0, MAX_DAILY_ANSWER_LENGTH);
      entry.answeredAt = new Date().toISOString();
      row.answer = entry.answer;
      row.answeredAt = entry.answeredAt;
      saveSoloAnswer(row);
    }
    if (validScore) {
      entry.score = n;
      if (!entry.answeredAt) entry.answeredAt = new Date().toISOString();
    }
    entry.skipped = false;
  }
  saveCheckin(entry);
  if (!db.checkins.some((c) => c.id === entry.id)) db.checkins.push(entry);
  return row;
}

app.get("/api/checkin/today", authMiddleware, async (req, res) => {
  try {
    const row = await ensureTodaysSoloQuestion(req.db, req.user.id, todayKey());
    res.json(dailyCheckinPayload(req.db, req.user.id, row));
  } catch (err) {
    console.error("Checkin today error:", err);
    res.status(500).json({ error: "Couldn't load today's check-in." });
  }
});

app.post("/api/checkin", authMiddleware, async (req, res) => {
  try {
    const { answer, skip, score } = req.body || {};
    const row = await saveDailyCheckin(req.db, req.user, { answer, score, skip: !!skip });
    res.json(dailyCheckinPayload(req.db, req.user.id, row));
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    console.error("Checkin error:", err);
    res.status(500).json({ error: "Couldn't save your check-in. Please try again." });
  }
});

// Powers the trend chart on the Insights page — the daily check-in's
// optional 1-10 connection score, plotted over time. Deliberately NOT
// AI-derived: a self-reported number the user typed is more honest and
// far cheaper than trying to infer "mood" from chat text, and it's data
// the app already collects for free as part of the existing check-in flow.
const CHECKIN_HISTORY_MAX_DAYS = 90;

app.get("/api/checkin/history", authMiddleware, (req, res) => {
  const list = req.db.checkins
    .filter((c) => c.userId === req.user.id && typeof c.score === "number")
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-CHECKIN_HISTORY_MAX_DAYS)
    .map((c) => ({ date: c.date, score: c.score }));
  res.json({ entries: list });
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
    saveShare(share);
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
    saveShare(share);
    res.json(publicShare(share));
  } catch (err) {
    console.error("Update share error:", err);
    res.status(500).json({ error: "Couldn't update that share. Please try again." });
  }
});

app.delete("/api/shares/:id", authMiddleware, (req, res) => {
  const share = req.db.shares.find((s) => s.id === req.params.id && s.userId === req.user.id);
  if (!share) return res.status(404).json({ error: "Share not found." });
  deleteShare(share.id);
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
    saveShare(share);
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
    saveShare(share);
    res.json(publicShare(share));
  } catch (err) {
    console.error("Add conversation share item error:", err);
    res.status(500).json({ error: "Couldn't add that conversation. Please try again." });
  }
});

app.delete("/api/shares/:id/items/:itemId", authMiddleware, (req, res) => {
  const share = req.db.shares.find((s) => s.id === req.params.id && s.userId === req.user.id);
  if (!share) return res.status(404).json({ error: "Share not found." });
  const idx = share.items.findIndex((i) => i.id === req.params.itemId);
  if (idx === -1) return res.status(404).json({ error: "Item not found." });
  share.items.splice(idx, 1);
  share.updatedAt = new Date().toISOString();
  saveShare(share);
  res.json(publicShare(share));
});

// Public, unauthenticated — this is what the partner opens. Gated by the
// share's token (a long random string, not sequential/guessable) rather
// than its id, and only ever returns items the user explicitly added.
app.get("/api/public/shares/:token", (req, res) => {
  const share = getShareByToken(req.params.token);
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
// Daily relationship question — one question per day that the user answers
// privately, just for themselves. Each user has their own stream (soloAnswers
// in store.js): a question is picked once per day, never repeated until the
// static bank runs out, and after that a fresh one is generated every day
// (see pickQuestionForStream). Nothing here is shared with anyone else.
// ---------------------------------------------------------------------------

// Open-ended, comparison-worthy relationship questions — deliberately never
// yes/no (per Jonas's spec: "Otazka bude komplexnejsia, aby odpoved nebola
// stylu: ano alebo nie"). Each is something two people could answer
// completely differently, which is the whole point of comparing answers.
const DAILY_QUESTIONS = [
  "What's a moment this year when you felt most loved by your partner? What exactly made it land?",
  "If you could change one recurring pattern in how the two of you handle stress, what would it be?",
  "What's something you need from your partner that you haven't actually told them, and what's stopped you?",
  "Describe a time your partner surprised you, in a good way or a hard way.",
  "What does feeling truly safe with your partner actually look like, moment to moment?",
  "What's one thing about your relationship you think about more than your partner probably realizes?",
  "If you had to describe the current season of your relationship in a short phrase, what would it be and why?",
  "What's a small habit of your partner's that quietly means more to you than you've said out loud?",
  "Where do you want the two of you to be, as a couple, in five years, and how close do you think that is to what your partner actually wants?",
  "What's something your partner does that helps you feel understood, even without words?",
  "When was the last time you felt genuinely proud of how the two of you handled something hard together?",
  "What's a fear you have about this relationship that you rarely say out loud?",
  "What's one way your partner has changed you for the better?",
  "If your partner could read your mind for one day, what's something you'd want them to finally understand?",
  "What's a memory from early in your relationship that you still think about?",
  "What does 'quality time' actually mean to you right now, in this season of life?",
  "What's something you appreciate about how your partner handles conflict, even when the conflict itself is hard?",
  "What's a way you show love that you're not sure your partner fully recognizes as love?",
  "What's one thing you'd want to do together in the next month that you haven't gotten around to?",
  "What's something your partner said recently that stuck with you, for better or worse?",
  "How has your definition of a good relationship changed since you've been with your partner?",
  "What's a compliment you've been meaning to give your partner but haven't said out loud?",
  "What part of yourself do you feel most free to show around your partner, and what part still feels guarded?",
  "If you had to guess, what would your partner say is the hardest thing about being with you right now, and how do you feel about that guess?",

  // Hypotheticals — "what would you do if…" (Jonas asked for more of this
  // angle specifically, task #98 follow-up: "kludne aj typu: co by si
  // urobil/a keby...").
  "If you suddenly had a free, unplanned week together with no responsibilities, what would you actually want to do with it?",
  "If you won a modest amount of money (enough to change one thing about your life together but not retire), what would you spend it on?",
  "If you had to move to a completely new city together tomorrow, what's the one thing about your current life you'd miss most?",
  "If your partner had to describe your relationship to a stranger in one sentence, what do you think they'd say, and how does that compare to what you'd want them to say?",
  "If you could redo one conversation you've had with your partner, which one would it be and what would you say differently?",
  "If your partner pulled away emotionally for a week with no explanation, what would be your first instinct, and what do you think the better move would actually be?",
  "If you had to give up one habit that bothers your partner, which one would you choose, and what's stopping you from dropping it already?",
  "If you could ask your partner one question you've always wanted a real answer to, what would it be?",
  "If your future self could send a message back to the two of you right now, what do you think it would say?",
  "If your partner made a big decision about your shared life without asking you first, how would you actually want them to handle it?",
  "If you had to choose between more time together or more time apart doing your own things right now, which would you pick, and why?",
  "If you found out your partner had been struggling with something and hiding it from you, how would you want them to have told you instead?",
  "If your partner had to leave for six months for something important, what would worry you most about the distance?",
  "If you could give your partner one piece of advice about how to love you better, what would it be?",
  "If you had one evening to do anything with your partner and money were no object, what would you choose?",
  "If your partner asked you right now what they could do to make you feel more loved this week, what would you actually say?",

  // Opinions and values — where the two of you might genuinely differ.
  "What's your honest opinion on how the two of you split responsibilities at home, and what makes you feel that way?",
  "How do you feel about the role money plays in how the two of you make decisions?",
  "What's something about how your family handled relationships growing up that you're consciously trying to do differently?",
  "Where do you land on how much of your individual life should stay separate versus shared?",
  "What's your honest take on how well the two of you actually resolve conflict, versus just letting it fade?",
  "How important is it to you that your partner's friends and family genuinely like you, and what makes you think they feel the way they do about you?",
  "What's your view on how the two of you handle each other's bad days, and what pattern would you most want to change, if any?",
  "Where do you stand on how much you two talk about the future versus just living day to day?",
  "What's something about the way you argue that you think is actually healthy, even if it doesn't feel that way in the moment?",
  "How do you feel about the balance of who initiates (plans, affection, hard conversations) between the two of you?",
  "What's your honest opinion on how well the two of you actually know each other's love language, versus just guessing?",
  "What's a way the two of you handle jealousy or insecurity that you think is actually healthy?",

  // Daily life and small appreciation — the stuff that's easy to overlook.
  "What's something mundane your partner does regularly that you'd genuinely miss if it stopped?",
  "What does an ordinary Tuesday with your partner look like when things are going well?",
  "What's one small thing you wish your partner asked you about more often?",
  "What's a routine or ritual the two of you have that means more to you than you've let on?",
  "What's something your partner does when you're sick or having a hard day that actually helps?",
  "What's the most 'us' inside joke or routine you have, and how did it start?",

  // Fears and vulnerability.
  "What's something about getting older together that quietly worries you?",
  "What's a way you've changed since being with your partner that surprises even you?",
  "What's something you're afraid to ask your partner for, even though you probably should?",
  "What's an insecurity you have that your partner probably doesn't know the full depth of?",
  "What's something from your past relationships you're still, even a little, protecting yourself against in this one?",
  "What's a version of yourself you're afraid your partner hasn't fully seen yet, good or bad?",
  "What's a fear about the future (health, money, family) that you carry more quietly than your partner knows?",

  // Family, friends, and the life you're building around the relationship.
  "How do you really feel about how involved your families are in your relationship?",
  "What's something about raising kids (or choosing not to) that the two of you see even slightly differently?",
  "What's a tradition (from your family, your partner's, or one you've made up) that you want to keep for good?",
  "How do you feel about the amount of time the two of you spend with friends versus just each other?",
  "What's something about how your partner treats people who can't do anything for them that says a lot about who they are?",

  // Growth and change.
  "What's a way you've had to compromise in this relationship that you're actually proud of, not just resigned to?",
  "What's something you used to think you needed in a relationship that you've realized you don't, because of your partner?",
  "What's a hard truth about yourself that being with your partner has forced you to face?",
  "What's something your partner has taught you without ever meaning to?",
  "Where do you think the two of you have grown the most as a couple, not just as individuals?",

  // Communication.
  "What's something you wish you were better at telling your partner in the moment, instead of realizing it later?",
  "What's a topic the two of you tend to avoid, and what do you think would happen if you actually brought it up?",
  "What's something your partner says or does during an argument that actually helps de-escalate it?",
  "What's a time your partner really surprised you with how they listened, even if they couldn't fix anything?",
  "What's something you say you're 'fine' about that you're actually not fully fine about?",
  "What's something about apologizing that you find harder than your partner might think?",

  // Lighter, but still genuinely open-ended.
  "If you had to plan the perfect low-key day for the two of you on a small budget, what would it look like?",
  "What's a version of your future together, ten years from now, that genuinely excites you?",
  "What's something your partner is better at than they give themselves credit for?",
  "What's a habit or quirk of your partner's that annoyed you at first but you've come to actually love?",
  "What's something you two used to do together that you miss and should probably bring back?",
  "If your relationship had a theme song, what would it be and why does it fit?",
  "What's the most 'us' way the two of you have ever handled a crisis, big or small?",

  // Meaning, commitment, and depth.
  "What does commitment actually mean to you, beyond just staying together?",
  "What's something about loyalty that matters more to you than most people realize?",
  "What's a moment your partner stood up for you (or you wish they had) that still sits with you?",
  "What's something you need to hear more often than your partner probably thinks?",
  "What's a way you show trust in your partner that isn't obvious from the outside?",
  "What's something about forgiveness in this relationship that you're still working through?",
  "What's a boundary in this relationship that took real effort to set, and how do you feel about it now, looking back?",
  "What does it mean to you to feel 'chosen' by your partner, day to day, not just in the big moments?",

  // Identity within the relationship.
  "What part of your identity do you feel your partner understands best?",
  "What's something about your career or ambitions that you wish your partner understood more deeply?",
  "What's a dream you've quietly set aside, and how much do you think your partner actually knows about it?",
  "What's something about independence that you need from this relationship to still feel like yourself?",
  "What's a value you hold that you'd never compromise on, even for your partner?",
  "What's something about your partner's ambition or work ethic that you genuinely admire, even when it's inconvenient?",

  // Specific moments, looking back.
  "What's a fight you had that, looking back, actually made the relationship stronger?",
  "What's a moment you felt like you and your partner were truly on the same team against the world?",
  "What's something your partner did in the hardest year of your relationship that you'll never forget?",
  "What's a small gesture from your partner that meant more than they probably realized at the time?",

  // Health, aging, and the long view.
  "What's something about how you want to grow old together that you haven't actually said out loud?",
  "How do you feel about the way the two of you take care of each other's physical and mental health?",
  "What's something about how you handle stress that you wish didn't affect your partner as much as it does?",
];

// Same date, same salt key, same candidate list → same question,
// deterministically, with no need to look anything up first (mirrors
// checkinQuestionForDate above). `saltKey` is the user's id —
// salting with it (not just the date) means different users aren't all
// handed the literal same question on the same calendar day. `candidates` defaults to
// the full static bank, but pickQuestionForStream below passes in only the
// ones THIS user hasn't used yet, which is what actually guarantees
// no repeat until all of them have appeared.
function pickDailyQuestion(saltKey, dateKey, candidates = DAILY_QUESTIONS) {
  let hash = 0;
  const seed = `${saltKey}|${dateKey}`;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return candidates[hash % candidates.length];
}

// Builds the system prompt for generateFreshDailyQuestion below — a
// function, not a constant, because the "don't repeat these" list is
// specific to each person and changes over time.
function buildDailyQuestionSystemPrompt(usedQuestions) {
  const recentlyUsed = usedQuestions.slice(-40);
  const scopeNoun = "this person";
  const intro =
    "You write a single daily reflection question for one person to privately answer about their own romantic relationship, in a relationship-coaching app called RelationshipAI. It is just for their own reflection.";
  const comparisonRule =
    "Open-ended and genuinely worth sitting with, something one person could reflect on honestly, not a checklist item.";

  return `${intro}

Respond with ONLY a JSON object, no other text before or after it: {"question": "<the question>"}

Rules:
- ${comparisonRule} NEVER write something a person could truthfully answer with just "yes" or "no", not even a compound question with a yes/no clause tacked onto an otherwise open one (bad: "...and is that fair?", "...and are you glad you did?", "...does your partner know?").
- Draw from the real range of relationship life: memories, values, hypothetical "what would you do if…" scenarios, opinions, everyday life, fears, growth, communication, or lighter/fun topics, vary which angle you use, don't default to the same one every time.
- One or two sentences, natural conversational English. No surrounding quotation marks.
- Must be genuinely new, not a reworded restatement of any question already used with ${scopeNoun}, listed below. Different topic or a clearly different angle, not just different phrasing of the same idea.

Questions already used with ${scopeNoun} (write something that doesn't overlap with these):
${recentlyUsed.map((q) => `- ${q}`).join("\n")}`;
}

// Called only once a person has worked through every question in the
// static DAILY_QUESTIONS bank (see pickQuestionForStream) — from that point
// on, every day's question is freshly generated rather than ever repeating.
// Fails open: any error here is caught by the caller and falls back to
// reusing an old question rather than breaking the feature.
async function generateFreshDailyQuestion(usedQuestions) {
  const completion = await openai.chat.completions.create({
    model: STANDARD_MODEL,
    messages: [{ role: "system", content: buildDailyQuestionSystemPrompt(usedQuestions) }],
    temperature: 0.9,
    response_format: { type: "json_object" },
  });
  const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
  return String(parsed.question || "").trim();
}

// Question-selection logic (Jonas wanted no repeats until the whole bank is used, AND for it to never
// actually run out):
//   1. While this person still has unused questions in the static
//      DAILY_QUESTIONS bank, deterministically pick one of THOSE (never
//      one already used) — scoped to the unused subset instead of the full
//      bank.
//   2. Once they've used all of them, every day from then on gets a fresh,
//      newly-generated question instead — see generateFreshDailyQuestion.
//      That also naturally can't repeat: it's explicitly told what's
//      already been asked.
async function pickQuestionForStream(usedQuestions, saltKey, dateKey) {
  const usedSet = new Set(usedQuestions.map((q) => q.toLowerCase()));
  const unusedStatic = DAILY_QUESTIONS.filter((q) => !usedSet.has(q.toLowerCase()));

  let question;
  if (unusedStatic.length > 0) {
    question = pickDailyQuestion(saltKey, dateKey, unusedStatic);
  } else {
    question = await generateFreshDailyQuestion(usedQuestions).catch((err) => {
      console.error("Daily question generation error:", err.message);
      return "";
    });
    question = String(question || "").trim();
    // Guards against an empty/failed generation, or the rare case the
    // model echoes something too close to an existing one — falls back to
    // the very first question ever asked (a real repeat) rather than ever
    // leaving "today" without one.
    if (!question || usedSet.has(question.toLowerCase())) {
      question = usedQuestions[0] || DAILY_QUESTIONS[0];
    }
  }
  return question;
}

// Gets today's question row for one user, creating it — with its question
// already picked — the first time they open it that day. Created once, never
// regenerated, so a later edit to DAILY_QUESTIONS can't retroactively change a
// question someone already answered. Persistence goes through
// saveSoloAnswerIfAbsent (store.js), which is race-safe.
async function ensureTodaysSoloQuestion(db, userId, dateKey) {
  let row = db.soloAnswers.find((a) => a.userId === userId && a.date === dateKey);
  if (row) return row;

  const usedQuestions = db.soloAnswers.filter((a) => a.userId === userId && a.question).map((a) => a.question);
  const question = await pickQuestionForStream(usedQuestions, userId, dateKey);

  row = saveSoloAnswerIfAbsent(userId, dateKey, question);
  if (!db.soloAnswers.some((a) => a.id === row.id)) db.soloAnswers.push(row);
  return row;
}

// Shapes a soloAnswers row for the response: the question and whatever the
// user has (or hasn't) written for it.
function publicSoloAnswer(row) {
  return {
    date: row.date,
    question: row.question,
    myAnswer: row.answer || null,
    myAnsweredAt: row.answeredAt || null,
  };
}

const MAX_DAILY_ANSWER_LENGTH = 2000;

// Same data as the dashboard check-in: the question plus the score and text.
function dailyQuestionPayload(db, userId, row) {
  const c = dailyCheckinPayload(db, userId, row);
  return { ...publicSoloAnswer(row), myAnswer: c.answer, myScore: c.score, answered: c.answered, streak: c.streak };
}

app.get("/api/daily-question/today", authMiddleware, async (req, res) => {
  try {
    const row = await ensureTodaysSoloQuestion(req.db, req.user.id, todayKey());
    res.json(dailyQuestionPayload(req.db, req.user.id, row));
  } catch (err) {
    console.error("Get today's daily question error:", err);
    res.status(500).json({ error: "Couldn't load today's question. Please try again." });
  }
});

app.post("/api/daily-question/today/answer", authMiddleware, async (req, res) => {
  try {
    const { answer, score } = req.body || {};
    const row = await saveDailyCheckin(req.db, req.user, { answer, score, skip: false });
    res.json(dailyQuestionPayload(req.db, req.user.id, row));
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    console.error("Answer daily question error:", err);
    res.status(500).json({ error: "Couldn't save your answer. Please try again." });
  }
});

// Past days only (today is always fetched fresh via the route above), and
// only days the user actually answered.
app.get("/api/daily-question/history", authMiddleware, (req, res) => {
  const today = todayKey();
  const list = req.db.soloAnswers
    .filter((a) => a.userId === req.user.id && a.date !== today)
    .map((a) => publicSoloAnswer(a))
    .filter((a) => a.myAnswer)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 30);
  res.json(list);
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

    const user = getUserById(payload.sub);
    if (user) {
      if (payload.kind === "digest") user.emailWeeklyDigest = false;
      else user.emailCheckinReminders = false;
      saveUser(user);
    }

    res.send(`<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif; background:#17130f; color:#f6efe4; padding:60px 20px; text-align:center;">
  <h2 style="font-family:Georgia,serif;">You're unsubscribed</h2>
  <p style="color:#b6a795;">You won't get this email again. You can turn it back on anytime from your RelationshipAI account page.</p>
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
async function sendPushToUser(userId, { title, body, url }) {
  if (!pushConfigured) return;
  const subs = getPushSubscriptionsForUser(userId);
  if (!subs.length) return;

  const payload = JSON.stringify({ title, body, url: url || "/dashboard.html" });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub.subscription, payload);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        deletePushSubscription(sub.id);
      } else {
        console.error("Push send error:", err.message);
      }
    }
  }
}

async function runDailyCheckinReminders() {
  const db = loadDb();
  const today = todayKey();
  const fallbackQuestion = checkinQuestionForDate(today);

  // Anyone who hasn't checked in today is a candidate — email and push are
  // independent channels, each only sent if that user is actually opted
  // into (or, for push, subscribed to) it.
  const notYetCheckedIn = db.users.filter(
    (u) =>
      !db.checkins.some((c) => c.userId === u.id && c.date === today) &&
      !db.soloAnswers.some((a) => a.userId === u.id && a.date === today && a.answer)
  );

  for (const user of notYetCheckedIn) {
    // The reminder must show the same question the person will see in the app,
    // which is their own personal one for today. If that lookup fails for any
    // reason, fall back to the shared daily question rather than skipping them.
    let question = fallbackQuestion;
    try {
      const row = await ensureTodaysSoloQuestion(db, user.id, today);
      if (row && row.question) question = row.question;
    } catch (err) {
      console.error("Reminder question lookup failed:", err.message);
    }

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
      await sendEmail({ to: user.email, subject: "Today's RelationshipAI check-in", html });
    }

    await sendPushToUser(user.id, {
      title: "Today's RelationshipAI check-in",
      body: question,
      url: "/dashboard.html",
    });
  }
}

async function runWeeklyInsightsDigest() {
  const db = loadDb();
  // The automated weekly digest (email and/or push) is a Pro+ perk — Free
  // users can still generate Insights manually in-app once they have
  // enough conversations, but RelationshipAI coming to them proactively every
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
      const { patterns } = await generateInsightsForDigest(user, coachConversations);
      if (!patterns.length) continue;

      if (user.email && user.emailWeeklyDigest !== false) {
        const itemsHtml = patterns
          .map(
            (p) =>
              `<p style="margin:0 0 12px;"><strong style="color:#f6efe4;">${escapeForEmail(p.title)}</strong><br/><span style="color:#b6a795;">${escapeForEmail(p.description)}</span></p>`
          )
          .join("");

        let focusHtml = "";
        try {
          const fdoc = await ensureWeeklyFocus(db, user);
          focusHtml = `<p style="margin:0 0 16px; padding:12px 14px; border-left:3px solid #d1a05a; color:#f6efe4;"><span style="color:#b6a795;">Your focus this week</span><br/><strong>${escapeForEmail(fdoc.data.headline)}</strong></p>`;
        } catch (e) {
          /* the digest goes out without it */
        }
        const html = emailShell({
          unsubscribeUrl: unsubscribeLink(user, "digest"),
          bodyHtml: `
            <p>Hey ${escapeForEmail(user.name)},</p>
            ${focusHtml}
            <p>Here's what RelationshipAI noticed across your conversations this week:</p>
            ${itemsHtml}
            <p><a href="${APP_URL}/insights.html" style="display:inline-block; margin-top:8px; background:linear-gradient(135deg,#d1a05a,#a8455c); color:#1a1410; text-decoration:none; padding:10px 20px; border-radius:100px; font-weight:600;">See full insights →</a></p>
          `,
        });
        await sendEmail({ to: user.email, subject: "Your weekly RelationshipAI insights", html });
      }

      await sendPushToUser(user.id, {
        title: "Your weekly RelationshipAI insights",
        body: patterns[0]?.title || "New patterns spotted across your conversations this week.",
        url: "/insights.html",
      });
    } catch (err) {
      console.error(`Weekly digest failed for user ${user.id}:`, err.message);
    }
  }
}

// Playbook follow-up: two days after someone starts an experiment, ask how
// it went (email unless they opted out of reminders, plus push). Idempotent
// per experiment via remindedAt, so the 15-minute tick can't double-send.
// Only between 08:00 and 20:00 UTC so nobody gets pinged at 3am.
async function runExperimentReminders() {
  const hour = new Date().getUTCHours();
  if (hour < 8 || hour >= 20) return;
  const due = getDueExperimentReminders(new Date().toISOString());
  if (!due.length) return;
  const byUser = new Map();
  for (const r of due) {
    if (!byUser.has(r.userId)) byUser.set(r.userId, []);
    byUser.get(r.userId).push(r);
  }
  for (const [userId, rows] of byUser) {
    const now = new Date().toISOString();
    rows.forEach((r) => markExperimentReminded(r.id, now));
    const user = getUserById(userId);
    if (!user) continue;
    const first = rows[0].text;
    const more = rows.length > 1 ? ` (+${rows.length - 1} more)` : "";
    try {
      if (user.email && user.emailCheckinReminders !== false) {
        const html = emailShell({
          unsubscribeUrl: unsubscribeLink(user, "checkin"),
          bodyHtml: `
            <p>Hey ${escapeForEmail(user.name)},</p>
            <p>A couple of days ago you decided to try this:</p>
            <p style="font-style:italic; color:#d1a05a;">"${escapeForEmail(first)}"${escapeForEmail(more)}</p>
            <p>How did it go? It takes ten seconds to tell me.</p>
            <p><a href="${APP_URL}/playbook.html" style="display:inline-block; margin-top:8px; background:linear-gradient(135deg,#d1a05a,#a8455c); color:#1a1410; text-decoration:none; padding:10px 20px; border-radius:100px; font-weight:600;">Tell me how it went →</a></p>
          `,
        });
        await sendEmail({ to: user.email, subject: "How did it go?", html });
      }
      await sendPushToUser(user.id, { title: "How did it go?", body: first, url: "/playbook.html" });
    } catch (err) {
      console.error("Experiment reminder failed:", err.message);
    }
  }
}

function emailJobsDueCheck() {
  runExperimentReminders().catch((err) => console.error("Experiment reminder job failed:", err));
  runSosFollowUps().catch((err) => console.error("SOS follow-up job failed:", err));
  runWeeklyFocusPush().catch((err) => console.error("Weekly focus job failed:", err));
  const emailJobs = getEmailJobs();
  const now = new Date();
  const today = todayKey();

  if (now.getUTCHours() >= DAILY_REMINDER_HOUR_UTC && emailJobs.lastDailyReminder !== today) {
    setEmailJobField("lastDailyReminder", today);
    runDailyCheckinReminders().catch((err) => console.error("Daily reminder job failed:", err));
  }

  if (
    now.getUTCDay() === WEEKLY_DIGEST_DAY_UTC &&
    now.getUTCHours() >= WEEKLY_DIGEST_HOUR_UTC &&
    emailJobs.lastWeeklyDigest !== today
  ) {
    setEmailJobField("lastWeeklyDigest", today);
    runWeeklyInsightsDigest().catch((err) => console.error("Weekly digest job failed:", err));
  }
}

setInterval(emailJobsDueCheck, 15 * 60 * 1000);

// ---------------------------------------------------------------------------
// Automatic database backups. VACUUM INTO writes a consistent snapshot while
// the server keeps running. Files go to a "backups" folder NEXT TO the live
// database file — so on Railway they live on the same persistent volume.
// That protects against corruption / a bad deploy / an accidental delete, but
// NOT against losing the volume itself: for that, download a copy now and
// then from the admin endpoint below (or enable Railway's volume backups).
// ---------------------------------------------------------------------------

const BACKUP_ENABLED = process.env.BACKUP_ENABLED !== "false";
const BACKUP_KEEP = Math.max(1, Number(process.env.BACKUP_KEEP) || 7);
const BACKUP_INTERVAL_HOURS = Math.max(1, Number(process.env.BACKUP_INTERVAL_HOURS) || 24);
const BACKUP_FILE_RE = /^relateiq-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z\.sqlite$/;

function backupsDir() {
  return path.join(path.dirname(getDatabaseFilePath()), "backups");
}

function listBackups() {
  const dir = backupsDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => BACKUP_FILE_RE.test(f))
    .map((name) => {
      const st = fs.statSync(path.join(dir, name));
      return { name, size: st.size, createdAt: st.mtime.toISOString() };
    })
    .sort((a, b) => (a.name < b.name ? 1 : -1)); // newest first (names sort chronologically)
}

function createBackup() {
  const dir = backupsDir();
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/\.\d+Z$/, "Z").replace(/:/g, "-");
  const name = `relateiq-${stamp}.sqlite`;
  const dest = path.join(dir, name);
  if (fs.existsSync(dest)) return { name, size: fs.statSync(dest).size };
  backupDatabaseTo(dest);
  // Prune: keep only the newest BACKUP_KEEP files.
  for (const old of listBackups().slice(BACKUP_KEEP)) {
    try {
      fs.rmSync(path.join(dir, old.name));
    } catch (err) {
      console.error("Couldn't prune old backup", old.name, err.message);
    }
  }
  return { name, size: fs.statSync(dest).size };
}

function backupIfDue() {
  if (!BACKUP_ENABLED) return;
  try {
    const newest = listBackups()[0];
    const ageMs = newest ? Date.now() - new Date(newest.createdAt).getTime() : Infinity;
    if (ageMs >= BACKUP_INTERVAL_HOURS * 60 * 60 * 1000) {
      const made = createBackup();
      console.log(`💾 Database backup created: ${made.name} (${Math.round(made.size / 1024)} KB)`);
    }
  } catch (err) {
    console.error("Database backup failed:", err);
  }
}

if (BACKUP_ENABLED) {
  setTimeout(backupIfDue, 30 * 1000).unref(); // shortly after boot (a redeploy shouldn't wait a day)
  setInterval(backupIfDue, 60 * 60 * 1000).unref(); // then check hourly
}

// Read-only: which models this OpenAI key can actually use (ids only).
// Admin only: run the Coach prompt on a chosen model for one message, to compare models.
// Nothing is stored. Body: { model, message, effort? }.
app.post("/api/admin/coach-test", authMiddleware, adminMiddleware, async (req, res) => {
  const { model, message, effort } = req.body || {};
  if (!model || !message) return res.status(400).json({ error: "model and message are required." });
  const t0 = Date.now();
  try {
    const params = {
      model: String(model).slice(0, 60),
      messages: [
        { role: "system", content: COACH_SYSTEM_PROMPT },
        { role: "user", content: String(message).slice(0, 2000) },
      ],
    };
    if (effort) params.reasoning_effort = String(effort).slice(0, 12);
    const out = await openai.chat.completions.create(params);
    res.json({
      model: params.model,
      ms: Date.now() - t0,
      reply: out.choices[0]?.message?.content || "",
      usage: out.usage || null,
    });
  } catch (err) {
    res.status(200).json({ model, ms: Date.now() - t0, error: String(err.message || err).slice(0, 400) });
  }
});

app.get("/api/admin/openai-models", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const list = await openai.models.list();
    const ids = [];
    for await (const m of list) ids.push(m.id);
    ids.sort();
    res.json({ count: ids.length, models: ids });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err).slice(0, 300) });
  }
});

app.get("/api/admin/backups", authMiddleware, adminMiddleware, (req, res) => {
  res.json({ enabled: BACKUP_ENABLED, keep: BACKUP_KEEP, intervalHours: BACKUP_INTERVAL_HOURS, backups: listBackups() });
});

app.post("/api/admin/backups", authMiddleware, adminMiddleware, (req, res) => {
  try {
    res.json({ ok: true, backup: createBackup() });
  } catch (err) {
    console.error("Manual backup failed:", err);
    res.status(500).json({ error: "Backup failed. See server logs." });
  }
});

// Strict filename allowlist (no path separators possible) — never builds a
// path from anything that hasn't matched BACKUP_FILE_RE.
app.get("/api/admin/backups/:name/download", authMiddleware, adminMiddleware, (req, res) => {
  const name = String(req.params.name || "");
  if (!BACKUP_FILE_RE.test(name)) return res.status(400).json({ error: "Invalid backup name." });
  const full = path.join(backupsDir(), name);
  if (!fs.existsSync(full)) return res.status(404).json({ error: "Backup not found." });
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.send(fs.readFileSync(full));
});

// Friendly 404 instead of Express's bare "Cannot GET ..." page.
app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found." });
  res
    .status(404)
    .type("html")
    .send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Page not found · RelationshipAI</title><meta name="robots" content="noindex" /><link rel="icon" href="/favicon.svg?v=3" type="image/svg+xml" /><link rel="stylesheet" href="/css/style.css" /><script src="/js/i18n.js" defer></script></head><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#17130f;color:#f6efe4;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:center;padding:24px;"><main><p style="color:#d9899b;letter-spacing:.12em;font-size:13px;margin:0 0 12px;">404</p><h1 style="font-size:32px;margin:0 0 12px;">That page doesn't exist</h1><p style="color:#b6a795;margin:0 0 24px;">The link may be old or mistyped.</p><a href="/index.html" style="display:inline-block;background:#d1a05a;color:#1b1510;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:12px;">Back to RelationshipAI</a></main></body></html>`);
});

// Safety net: catches anything not already handled by a route's own
// try/catch (e.g. a thrown error in a synchronous helper) so the client
// always gets a valid JSON response instead of a broken/empty one.
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (res.headersSent) return next(err);
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({ error: `That's too large. Please keep attachments under ${MAX_TOTAL_UPLOAD_MB}MB total per message.` });
  }
  res.status(500).json({ error: "Unexpected server error. Please try again." });
});

app.listen(PORT, () => {
  console.log(`🔥 RelationshipAI server running on http://localhost:${PORT}`);
});
