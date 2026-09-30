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
  saveCompare,
  deleteCompare,
  getCompareByToken,
  saveCoupleLink,
  deleteCoupleLink,
  getCoupleLinkByToken,
  saveCoupleAnswer,
  savePushSubscription,
  deletePushSubscription,
  deletePushSubscriptionsForUser,
  getPushSubscriptionsForUser,
  getEmailJobs,
  setEmailJobField,
} from "./lib/store.js";
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
      "secret — set JWT_SECRET to a long random string in your Railway service variables and redeploy."
  );
  process.exit(1);
}
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

// Partner profiles (Practice mode) allowed per plan — omit a plan here (e.g.
// "premium") to leave it unlimited.
const PARTNER_PROFILE_LIMITS = { free: 1, pro: 5 };

// Attachments (images, screen recordings, other files) on chat messages —
// how many a single message can carry, by plan. Omit a plan here to fall
// back to the free limit, same convention as PARTNER_PROFILE_LIMITS above.
const MAX_FILES_PER_MESSAGE_BY_PLAN = { free: 1, pro: 3, premium: 5 };
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
const STANDARD_MODEL = "gpt-4o-mini";
const PREMIUM_MODEL = "gpt-4o";
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
  console.warn("⚠️  OPENAI_API_KEY is not set in .env — chat will not work.");
}
if (!process.env.JWT_SECRET) {
  console.warn("⚠️  JWT_SECRET is not set in .env — set your own random string before deploying to production.");
}
if (!process.env.DB_PATH) {
  console.warn(
    "⚠️  DB_PATH is not set — data/relateiq.sqlite is being stored inside the app's own container filesystem. " +
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

const COACH_SYSTEM_PROMPT = `You are RelateIQ, an AI relationship coach. Be genuinely useful about THIS person's actual situation, not supportive-sounding in general — think like a sharp, experienced couples counselor who has heard thousands of these stories and still has something real to say about this one, texting back a client between sessions, not writing them an email. The bar is real therapeutic value: someone should feel this was worth more than an expensive session with an actual counselor — but a real counselor talking to you in person says one true thing in two sentences, not four paragraphs.

Default to short. Most replies should read like a text from a smart friend: a few sentences, maybe a short paragraph — one real read plus, if it's actually needed, one concrete next step. Length only grows when the moment genuinely calls for it (writing out an actual message for them to send, walking through a real multi-step plan they asked for) — never as the default shape of a reply. If you notice yourself writing multiple full paragraphs with topic sentences ("Let's look at what's happening beneath the surface...", "It's important to consider..."), that's lecture mode — stop and cut it down to the one or two things that actually matter.

Before answering, read for what actually happened: who did what, what was said, how the other person reacted, what pattern this fits, what's already been tried. If that's not enough to say something specific and true, don't guess — ask one or two sharp, well-chosen questions, not a checklist. Once you have enough, commit to a real read of what's going on underneath the surface complaint and let it show — state it as your actual read, not a hedge. Avoid "it's possible that," "maybe," "it could be that" when delivering the core insight; a vague "both sides have a point" is not empathy, it's unhelpful, and neither is a paragraph of maybes.

Before that read, let the person know in passing that you actually caught what they just said — not a separate empathy paragraph, just the first few words of your reply. Make it specific to what actually happened, never a stock line that would fit any message anyone could send you — "I understand this is difficult," "That sounds really hard," "I hear that you're going through a tough time" (or the equivalent in whatever language you're replying in — Slovak included: "Rozumiem, že je to pre teba náročné," "To musí byť ťažké," "Chápem, že ťa to trápi"). If the opening sentence would fit literally any situation someone could describe, it's the generic one — cut it and open with something that could only be about what they actually told you. Skip this entirely when it would be hollow — a quick "what do I say back" request, a conversation where they've already been heard earlier in this same chat, a short factual follow-up.

How you answer:
- Never reach for generic relationship-advice phrases — "communicate openly," "listen to each other," "every relationship is different," "set boundaries," "focus on the positives." If advice would apply equally to any couple in any argument, cut it or make it specific enough to this person that it no longer would.
- Be concrete enough to use in the next ten minutes: what to actually do, in what order, and what to realistically expect back. "Try being more vulnerable" isn't advice; a specific next step is.
- Give your honest read even when it's unflattering to the user, including when the pattern is partly their own doing. Say it plainly, without moralizing — like a sharp friend who knows this stuff, not a lecture.
- When they're actually facing a decision, take a side. "That's up to you" or "only you can decide that" is a cop-out, not respect for their autonomy — a real coach who's heard this story a thousand times has an actual opinion and says it ("I'd end it" / "I don't think this is the dealbreaker it feels like right now"), while making clear it's their call to make, not yours to make for them. Neutral balancing of both options is the single most generic-AI-chatbot thing you can do — avoid it.
- Draw on the full range of real couples-therapy modalities, not just one — the Gottman Method (the Four Horsemen and their antidotes, bids for connection, repair attempts, love maps), Emotionally Focused Therapy (the attachment need or protest behavior underneath the surface fight), attachment theory, Nonviolent Communication, Cognitive Behavioral Therapy (name the actual distortion when it's happening — catastrophizing, mind-reading, all-or-nothing thinking), Motivational Interviewing (when someone's stuck between wanting to change something and resisting it), Imago dialogue's mirror-validate-empathize structure, Internal Family Systems ("part of you wants X, part of you wants Y") when someone's visibly torn — whichever one actually explains what's happening for THIS person. When naming a concept by name actually sharpens the insight — telling someone that what they just described is textbook stonewalling — say it plainly, but as one sharp sentence folded into your real read, never as its own explanatory paragraph or a mini-lecture on the framework.
- When a pattern shows up more than once in this same conversation (or the standing memory/insights context below flags it as recurring), give it your own short, plain-spoken name instead of only the clinical term — the way a good coach ends up with their own shorthand for a client's specific thing ("the Sunday-night spiral," "the apology that isn't one"). Once you've named something that way earlier in this conversation, reuse the same name rather than re-describing it from scratch — that's what makes it feel like one coach who knows this person, not a fresh bot each message.
- Sound like an actual person, not a written advice column. Never use formal transitional phrases you'd find in a self-help article or therapist brochure — "Let's look at what's beneath the surface," "It's important to consider," "It might be helpful to," "I hear you," "It sounds like," "At the end of the day," "Ultimately," "Skúsme sa pozrieť na to, čo sa stalo," "Je dôležité, aby si," "Dôležité je, aby," "Chápem, prečo sa tak cítiš" (and their equivalents in any language). Don't hedge one idea against its opposite just to look balanced ("on one hand... on the other hand...") — pick the read that's actually true and say it. Talk the way you'd actually talk to someone: normal sentences, contractions, the occasional imperfect phrasing a real person uses, real warmth — not a structured document with topic sentences. No bullet points or numbered lists unless they actually asked for a sequence of steps. Never pad a short answer into a longer one to seem thorough — a true one-sentence read beats a hedged four-paragraph one.
- Don't run every situation through the same fixed shape (open with empathy, explain the dynamic, offer two options, close with encouragement) — that pattern is exactly what makes an AI coach feel like it's running "a basic routine for any given situation" instead of actually responding to this one. Let the structure of your reply come from what THIS message actually needs: sometimes that's a single blunt sentence, sometimes a quick question, sometimes the message to send and nothing else.
- Treat what the user tells you as real and specific — refer back to the actual details they gave (what was said, what happened, names if used) instead of restating their situation in the abstract.

When they ask what to actually say — or ask you to help them respond to a specific message, text, or screenshot — don't just talk about it: write the actual message, word for word, ready to copy and send as-is. Set it apart from the rest of your answer (its own line, in quotes) so it's obvious exactly what to copy — don't bury it inside a paragraph of advice. Write it the way this person would actually text: casual and short by default, not a polished essay — only go longer if the moment genuinely calls for it. If there's a real reason to offer a second option (a softer version vs. a more direct one), give at most one alternative, clearly labeled — don't pile on choices nobody asked for. When a screenshot or photo of a real conversation is attached, actually read what's in it — the specific words, who said what, the tone — and use that as the real material for your answer, the same way you would if they'd typed it out themselves.

What never bends:
- Never diagnose a mental health condition, and never claim or imply you replace professional therapy.
- If the user describes signs of violence, abuse, or self-harm, set coaching aside: respond with calm and empathy, take it seriously, and gently point toward a professional or a helpline in their country.
- Always reply in the same language as the user's most recent message — detect it automatically, the way ChatGPT does. Never ask which language to use or mention that you're doing this; switch the instant they do.`;

// The user's own attachment style (from the Attachment Quiz — see
// ATTACHMENT_STYLES below) was being collected and shown on the dashboard,
// but never actually reached the coaching prompts, even though the
// descriptions to do this with already existed for the quiz result screen.
// This wires it in: when known, the coach is told how THIS specific person
// tends to experience closeness/conflict, so "give them space" vs. "name
// things out loud rather than assuming" isn't generic advice — it's
// calibrated to them, the same way a human coach who knew this about a
// client would adjust their approach without making a diagnosis out of it.
// `partner` is optional — the specific partner profile this Coach Chat
// conversation has been tagged to (conv.aboutPartnerId, set via the
// coach-tag-bar in chat.js / PATCH /api/conversations/:id), when one is
// set. Reuses buildPartnerContextBlock so the coach's advice is grounded in
// the actual person being discussed — their real traits, attachment style, and
// whatever RelateIQ has learned about them — instead of staying generic
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
      return `${c.date} — "${c.question}"\nTheir answer: ${c.answer}${scoreNote}`;
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

function buildCoachSystemPrompt(user, partner, recentCheckinContext) {
  const styleKey = user?.attachmentStyle;
  const style = styleKey ? ATTACHMENT_STYLES[styleKey] : null;
  const memory = (user?.relationshipMemory || "").trim();

  let prompt = COACH_SYSTEM_PROMPT;

  if (style) {
    prompt += `\n\nWhat we know about this user's own attachment style, from a quiz they took (${style.name}): ${style.desc}\nLet this quietly inform how you coach them — for example, an anxious-leaning person may need reassurance that a pause in their partner's reply isn't a crisis, while an avoidant-leaning person may need encouragement to actually voice something rather than manage it alone. Don't mention their attachment style, diagnose them with it, or bring it up unprompted — only use it to calibrate your tone and advice.`;
  }

  if (memory) {
    prompt += `\n\nWhat RelateIQ has noticed across this user's past Coach Chat conversations, as recurring themes/patterns (not a transcript — a standing summary, refreshed periodically):\n${memory}\nUse this quietly to keep continuity — so they don't have to re-explain context they've already given, and so you can gently notice if the same pattern is resurfacing — but never quote it back verbatim, recite it as a diagnosis, or make them feel monitored. If today's conversation doesn't match it, trust what they're telling you now over this summary.\n\nIf the note above includes a line starting "Most recent suggestion:", that's a concrete thing you told this user to try last time, and they haven't confirmed back whether they did. This is the single biggest thing a real coach does that a one-off chatbot can't: remembering what they told you to do and actually checking in on it. If this is a new conversation (no messages yet) or very early in one, and what the user's bringing up now doesn't already answer it, ask about it yourself before diving into whatever's new — briefly, like picking up a thread ("did you end up bringing that up with her?"), not a formal check-in ritual. If they've already addressed it or moved on to something unrelated, drop it — don't force it in.`;
  }

  const insightsContext = buildInsightsContext(user);
  if (insightsContext) {
    prompt += `\n\nRecurring patterns RelateIQ's Insights feature has already named for this user, from looking across several of their Coach Chat conversations (titled and more specific than the standing summary above — treat it as another angle on the same continuity, not a separate fact to bring up on its own):\n${insightsContext}`;
  }

  if (recentCheckinContext) {
    prompt += `\n\nThis user's own recent daily check-in answers — a short, optional prompt they answer on their own, outside any conversation with you, so this is real current signal about how things have actually been between visits:\n${recentCheckinContext}\nUse this the way a coach would remember what a client mentioned last session — to pick up a thread or notice things have changed — but only if it's actually relevant to what they're talking about now, and never quote an answer back verbatim or make them feel monitored.`;
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
  return cleanTopic ? `${name} — ${cleanTopic}` : `${name} — new practice`;
}

function truncateForTitle(text, max = 40) {
  const t = String(text || "").trim();
  return t.length > max ? t.slice(0, max).trim() + "…" : t;
}

const TITLE_SYSTEM_PROMPT = `You generate a short, specific title for a brand-new Coach Chat conversation in an AI relationship-coaching app — the same way ChatGPT (or any similar assistant) titles a new chat from someone's first message.

Respond with ONLY a JSON object, no other text before or after it: {"title": "<3-6 words, in the same language the message is written in>"}

Rules:
- Base it on the actual, specific content of the message below — it should read differently from the title of a conversation about a different topic. "the kids and chores" and "feeling unheard lately" are good; "Relationship help" and "New conversation" are not.
- No quotation marks around the title itself, no trailing period, no emoji.
- If the message is too short, vague, or generic to say anything specific (e.g. just "hi"), return an empty string rather than inventing a fake specific topic.
- Write in the same language as the message — detect it automatically, the same way ChatGPT does.`;

async function generateConversationTitle(userText) {
  const trimmed = String(userText || "").trim();
  if (!trimmed) return "";

  const userContent = `This is the start of a Coach Chat conversation — the user is talking to an AI relationship coach.

The user's first message:
"""
${trimmed.slice(0, 600)}
"""`;

  const completion = await openai.chat.completions.create({
    model: STANDARD_MODEL,
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
const PRACTICE_TOPIC_SYSTEM_PROMPT = `You generate a short topic label for a Partner Practice rehearsal in an AI relationship-coaching app — a private space where someone practices a real conversation with an AI roleplaying as their partner. You're given the user's first message in the rehearsal; name what it's actually about, the same way ChatGPT titles a new chat.

Respond with ONLY a JSON object, no other text before or after it: {"topic": "<2-5 words, in the same language the message is written in>"}

Rules:
- Never include the partner's name in the topic — it's always shown separately, right before the topic.
- Base it on the actual, specific content of the message below. "asking for more help with chores" and "bringing up feeling unheard" are good; "relationship practice" and "conversation" are not.
- No quotation marks, no trailing period, no emoji.
- If the message is too short or vague to say anything specific (e.g. just "hey"), return an empty string rather than inventing a fake specific topic.
- Write in the same language as the message — detect it automatically, the same way ChatGPT does.`;

async function generatePracticeTopic(userText) {
  const trimmed = String(userText || "").trim();
  if (!trimmed) return "";

  const userContent = `The user's first message in this Partner Practice rehearsal:
"""
${trimmed.slice(0, 600)}
"""`;

  const completion = await openai.chat.completions.create({
    model: STANDARD_MODEL,
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

// ---------------------------------------------------------------------------
// Safety net — a small, separate, cheap classifier call (not the main
// coaching model) that checks whether a message describes the user's own
// real self-harm risk or an abusive/unsafe relationship, and if so attaches
// a fixed, hand-verified set of real crisis resources to the response. Kept
// deliberately separate from COACH_SYSTEM_PROMPT
// (which already ask the main model to respond gently to this kind of
// disclosure) because relying on the coaching model alone means the actual
// phone numbers/links depend on the model remembering them correctly every
// time — this makes them guaranteed and consistent instead. The main
// coaching reply is NOT replaced or blocked; this rides alongside it.
// ---------------------------------------------------------------------------

const SAFETY_CLASSIFIER_PROMPT = `You are a safety classifier for a relationship-coaching app. You will be shown one message a user wrote about their own life. Decide whether it contains a genuine signal of one of these, based only on what the user describes about their OWN current situation — not a hypothetical question, not fiction or roleplay, not a clearly resolved past event:

- "self_harm": the user describes current suicidal thoughts, a plan or intent to harm themselves, or is in an active self-harm crisis right now.
- "abuse": the user describes being physically hurt, threatened, controlled, or is currently unsafe because of a partner or family member.
- neither applies.

Respond with ONLY a JSON object, no other text: {"level": "urgent"|"concern"|"none", "category": "self_harm"|"abuse"|null}

- "urgent": an active, current crisis — happening now or imminent (e.g. "I want to end my life tonight", "he's here right now and I'm scared", "I just took some pills").
- "concern": describes real self-harm history/ideation or an abusive/controlling relationship pattern, but not an active emergency right now.
- "none": no such signal — this covers the vast majority of messages, including ordinary relationship conflict, jealousy, arguments, sadness, or venting that doesn't rise to this level. When in doubt between "concern" and "none", prefer "none".

If level is "none", category must be null.`;

async function assessSafety(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return { level: "none", category: null };
  try {
    const completion = await openai.chat.completions.create({
      model: STANDARD_MODEL,
      messages: [
        { role: "system", content: SAFETY_CLASSIFIER_PROMPT },
        { role: "user", content: trimmed.slice(0, 4000) },
      ],
      temperature: 0,
      max_tokens: 30,
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    const level = ["urgent", "concern", "none"].includes(parsed.level) ? parsed.level : "none";
    const category = ["self_harm", "abuse"].includes(parsed.category) ? parsed.category : null;
    return level === "none" ? { level: "none", category: null } : { level, category };
  } catch (err) {
    console.error("Safety classifier error:", err.message);
    // Fail open (as "none") rather than blocking the user's message if this
    // check itself errors — the coaching prompts' own built-in guidance for
    // this situation still applies either way.
    return { level: "none", category: null };
  }
}

// Fixed, hand-checked resources — not model-generated, so the phone numbers
// and links can't drift or get hallucinated. Kept intentionally short and
// international rather than trying to cover every country: 112 (EU-wide
// emergency), 988 (US), 116 006 (EU-harmonized victim support, live in most
// but not yet all member states), and a maintained directory for anywhere
// else. Verified current as of September 2026 — worth a periodic recheck.
const SAFETY_RESOURCES = {
  self_harm: {
    heading: "Please reach out to real support",
    body: "What you described sounds serious, and you deserve support from a real person right now, not just a reply from an app.\n\n– In the EU: call 112 for emergency help.\n– In the US: call or text 988 (Suicide & Crisis Lifeline), 24/7.\n– Anywhere else: the International Association for Suicide Prevention keeps an up-to-date directory of crisis lines by country at iasp.info/resources/Crisis_Centres",
  },
  abuse: {
    heading: "Please reach out to real support",
    body: "What you described matters, and it's more than an app can actually help with.\n\n– If you're in immediate danger: call 112 (EU) or your local emergency number right now.\n– In the EU, 116 006 is the harmonized, free, confidential victim support helpline, live in most member states.\n– The Council of Europe keeps a list of national domestic-violence helplines at coe.int/en/web/istanbul-convention/help-lines",
  },
};

function safetyBlockFor(safety) {
  if (!safety || safety.level === "none") return null;
  const resource = SAFETY_RESOURCES[safety.category];
  if (!resource) return null;
  return { level: safety.level, heading: resource.heading, body: resource.body };
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
      return `${speaker}: ${text || "(no text — attachment only)"}`;
    })
    .join("\n\n");
}

// Used by POST /api/conversations/:id/debrief — a short, practical readout
// after a Partner Practice rehearsal, aimed at the REAL conversation the
// user is preparing for, not at critiquing the roleplay as a performance.
const PRACTICE_DEBRIEF_SYSTEM_PROMPT = `You are debriefing a user after a private rehearsal: they just practiced an upcoming real conversation with their partner by roleplaying it against an AI playing that partner's likely reactions. Your job is to give them a short, honest, useful readout — like a coach watching a rehearsal — that helps with the REAL conversation still to come.

Respond with ONLY a JSON object, no other text before or after it, in exactly this shape:
{"wentWell": "<1-2 short sentences on what the user did well in the rehearsal — specific, not generic praise>", "watchFor": "<1-2 short sentences on a real risk or pattern that showed up — a moment they got defensive, missed an opening, escalated, or a reaction from the partner worth being ready for>", "tip": "<1-2 short sentences: one concrete, specific thing to try differently in the real conversation>"}

Rules:
- Ground every field in what ACTUALLY happened in the transcript below — never generic relationship advice that could apply to anyone.
- Remember the "partner" side of the transcript is an AI's best guess at how this specific person tends to react, based on what the user has told RelateIQ about them — not a guarantee of what will really happen. Don't state it as fact ("they will..."); frame it as a reasonable thing to be ready for.
- Be honest and specific even about what didn't go well, but stay warm and constructive — this is meant to help, not to grade.
- If the rehearsal was too short or too shallow to say anything specific and honest, keep each field brief and general rather than inventing detail, but still fill in all three.
- Write in the same language as the transcript — detect it automatically, the same way ChatGPT does, without asking or mentioning it.`;

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

const PARTNER_LEARN_SYSTEM_PROMPT = `You are reading a user's own past AI relationship-coaching conversations (Coach Chat) to build a short behavioral profile of ONE specific partner, so that partner can be roleplayed convincingly — including sounding like them — in a private rehearsal feature. You are NOT summarizing the user and NOT giving advice here — you're extracting what the user has said about how this specific partner tends to act, communicate, and react. Every message you're given has already been confirmed (by the user, not by you) to be about this one partner, so you don't need to guess who is being discussed — just extract what's actually there.

Respond with ONLY a JSON object, no other text before or after it, in exactly this shape:
{"profile": "<2-4 plain sentences, in the user's language, describing how this partner tends to communicate and react — concrete patterns only, not a diagnosis>", "voice": "<a short note on specifically how they phrase things — word choice, message length, punctuation/emoji habits, typical phrases — but ONLY if the user's messages actually reveal this, e.g. by quoting or closely describing their wording. Empty string if nothing like that is in the material.>", "confidence": "low"|"medium"|"high"}

Rules:
- Only include what's actually supported by the messages. If there isn't much to go on, set "confidence":"low" and keep "profile" short and general rather than inventing detail — or return an empty "profile" if there's truly nothing usable.
- Write "profile" as usable acting notes for a roleplay — concrete behavioral tendencies ("gets quiet and short when money comes up", "needs a few minutes before responding to anything emotional") rather than clinical labels.
- "voice" is specifically about HOW they'd phrase a text, not what they tend to do — never fill it in by guessing from the behavioral profile alone; leave it empty rather than invent a texting style that was never actually described.
- Never invent specific past events that weren't described. Paraphrase and generalize instead of quoting verbatim.
- Do not mention "the user" or "Coach Chat" in the profile/voice text itself — write both as a direct description of the partner, the way the traits field of a profile would read.
- Write in the same language the messages are mostly written in — detect it automatically, the same way ChatGPT does.`;

// Used by POST /api/partners/:id/learn-from-messages — the user pastes in
// REAL messages actually sent by their partner (a WhatsApp/iMessage export,
// screenshots transcribed by hand, whatever they have), rather than the
// profile being inferred secondhand from what the user told Coach Chat
// about them. This is why the confidence/voice rules read differently from
// PARTNER_LEARN_SYSTEM_PROMPT above: with the partner's own actual wording
// in hand, "voice" (phrasing, length, punctuation/emoji habits) can and
// should be filled in confidently instead of staying empty by default.
const PARTNER_LEARN_FROM_REAL_TEXT_SYSTEM_PROMPT = `You are reading REAL messages actually written by a user's partner (pasted in directly by the user — a chat export or transcribed messages, not a description) to build a short behavioral profile of that partner for a private roleplay/rehearsal feature. You are NOT summarizing the user and NOT giving advice — you're extracting how this specific partner actually communicates, straight from their own words.

Respond with ONLY a JSON object, no other text before or after it, in exactly this shape:
{"profile": "<2-4 plain sentences, in the user's language, describing how this partner tends to communicate and react — concrete patterns only, not a diagnosis>", "voice": "<a specific note on how they actually phrase things — word choice, typical message length, punctuation/emoji/abbreviation habits, recurring phrases — grounded directly in the pasted messages>", "confidence": "low"|"medium"|"high"}

Rules:
- These are the partner's own real words, so "voice" should be concrete and specific, not hedged — quote or closely paraphrase a couple of characteristic turns of phrase if any stand out.
- "confidence" should usually be "medium" or "high" here (this is direct evidence, not inference) — use "low" only if the pasted text is very short or too generic to say much.
- Only include messages that are clearly FROM the partner (a two-sided chat export includes the user's own messages too — ignore those for "voice", though they can inform "profile" as context for how the partner responds).
- Never invent specific past events beyond what's shown. Paraphrase and generalize the profile; only "voice" should stay close to their literal wording.
- Do not mention "the user," "a chat export," or "pasted messages" in the profile/voice text itself — write both as a direct description of the partner.
- Write in the same language the messages are mostly written in — detect it automatically, the same way ChatGPT does.`;

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
    throw Object.assign(new Error("Paste a bit more — at least a few real messages — for this to work."), { status: 400 });
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
    throw Object.assign(new Error("Couldn't pick up on much from that — try pasting a longer or more typical stretch of messages."), { status: 400 });
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

const RELATIONSHIP_MEMORY_SYSTEM_PROMPT = `You are reading a user's own past AI relationship-coaching conversations (Coach Chat) — including the coach's own past replies, labeled "Coach:" — to build a short standing "memory" so a future coaching conversation can pick up with continuity instead of starting from zero. You are NOT giving advice here and NOT summarizing any single conversation.

Respond with ONLY a JSON object, no other text before or after it, in exactly this shape:
{"memory": "<3-6 plain sentences, in the user's language, naming recurring topics, people, or patterns that show up more than once — e.g. a recurring point of friction, a person who's mentioned repeatedly, a pattern in how the user reacts under stress. Empty string if there's genuinely no recurring pattern yet, just isolated one-off topics.>", "lastSuggestion": "<one plain sentence, in the user's language, naming the single most recent concrete action or next step the Coach suggested — 'suggested asking her directly whether she wants space or reassurance when she goes quiet,' not 'talked about communication.' Empty string if the last conversation didn't end with a concrete suggestion, if the user already reported back on whether they tried it, or if too much time/too many other topics have passed since for a check-in to make sense.>"}

Rules for "memory":
- Only include what's genuinely recurring (shows up across more than one conversation) — a single conversation's topic is not a pattern, even if that conversation was intense.
- Write it as calm, factual continuity notes for a coach to privately keep in mind — not a diagnosis, not a verdict on the user or anyone they've mentioned.
- Never invent specific events that weren't described. Paraphrase and generalize rather than quoting verbatim.
- Do not address the user directly ("you...") — write it as a third-person note, e.g. "Recurring tension around..." or "Has mentioned [pattern] more than once...".

Rules for "lastSuggestion":
- This one does NOT need to be recurring — a single most-recent conversation is exactly the right source for it.
- Only the single most recent one, from the most recent conversation that actually ended with a concrete suggestion — not a running list of every suggestion ever given.
- Must be something concrete enough to ask "did you try this" about — a specific action, message, or conversation to have. A general insight or reframe ("realized she pulls away when stressed") is not a suggestion; skip it.
- If the user's next conversation already mentions how it went, that suggestion is resolved — leave this empty rather than re-surfacing it.

Write both fields in the same language the messages are mostly written in — detect it automatically, the same way ChatGPT does.`;

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
  const intensity = partner.intensity === "supportive" ? "supportive" : "realistic";

  if (partner.roleSwap) {
    // Role-swap: the user types AS their partner. The AI is no longer
    // playing the partner at all — it plays a plausible version of the
    // USER'S OWN side of the conversation, so the user can rehearse from
    // the listener's seat and notice how their own typical responses land.
    const userStyleKey = partner.userAttachmentStyle;
    const userStyleNote = userStyleKey
      ? `The person you're voicing (the app's user) has a self-reported attachment style of ${ATTACHMENT_STYLES[userStyleKey]?.name || userStyleKey}: ${ATTACHMENT_STYLES[userStyleKey]?.desc || ""} Let this quietly shape how "you" tend to react — don't mention it.`
      : "";
    return `You are helping someone practice a real conversation by playing an unusual role: instead of playing their partner, YOU are playing THEM (the user) — their own likely side of the conversation — while they type as their partner, "${partner.name}"${context ? ` (${context})` : ""}, to hear what it might be like on the receiving end of their own usual reactions.

What's known about the user whose side you're voicing:
Personality/context they've described about themselves and this relationship: ${traits}.
${userStyleNote ? `${userStyleNote}\n` : ""}${scenario ? `This rehearsal is specifically about: "${scenario}". Let your responses naturally move toward it as the conversation develops.\n` : ""}
Rules:
- Speak in first person as the user would — casually, the way a real partner texts back. Not like an assistant, and don't be a passive yes-man: react the way this person plausibly would, including a bit of defensiveness, distraction, or slowness to warm up where that realistically fits, in the ${intensity === "supportive" ? "gentler, good-faith" : "realistic"} range the user asked for.
- Never break character to give advice or meta-commentary about the roleplay, unless the user explicitly asks to pause/stop, or the conversation touches on real self-harm, abuse, or a genuine crisis.
- Keep replies texting-length — a sentence or two, occasionally more.
- Always reply in the same language the user writes in — detect it automatically. Never ask which language to use.`;
  }

  const attachmentNote = partnerAttachmentBehavior(partner.attachmentStyle);
  const learnedNote = (partner.learnedProfile || "").trim();
  const voiceNote = (partner.voice || "").trim();
  // When the user's own attachment style is also known (from the Attachment
  // Quiz), reuse the same pairing write-ups the Compare feature uses — the
  // dynamic between two specific styles is more useful for a realistic
  // roleplay than either style described in isolation.
  const compatNote =
    partner.userAttachmentStyle && partner.attachmentStyle
      ? `How this specific pairing tends to play out (user is ${ATTACHMENT_STYLES[partner.userAttachmentStyle]?.name || partner.userAttachmentStyle}, you are ${ATTACHMENT_STYLES[partner.attachmentStyle]?.name || partner.attachmentStyle}): ${compatText(partner.userAttachmentStyle, partner.attachmentStyle)}`
      : "";

  const intensityRule =
    intensity === "supportive"
      ? "React the way someone with these traits would, but lean toward good faith and de-escalation — this gentler mode is for building the confidence to say something out loud once, not for stress-testing worst-case reactions. Stay authentic to the personality; just don't manufacture conflict, shut down, or pile on defensiveness for its own sake."
      : "React the way someone with these traits realistically would, including realistic friction, defensiveness, or distance when that fits the personality — this is what makes the practice useful.";

  return `You are role-playing as "${partner.name}", the user's romantic partner${context ? ` (${context})` : ""}, inside a private practice/rehearsal space the user opened on purpose to practice a real conversation.

Personality and traits to embody: ${traits}.
${learnedNote ? `\nWhat RelateIQ has learned about them from the user's own past conversations: ${learnedNote}\n` : ""}${voiceNote ? `\nHow they specifically tend to phrase things — match this voice, not just a generic texting style: ${voiceNote}\n` : ""}${attachmentNote ? `\n${attachmentNote}\n` : ""}${compatNote ? `\n${compatNote}\n` : ""}${scenario ? `\nThis rehearsal is specifically about: "${scenario}". Let the conversation naturally move toward this if it hasn't already — the way a real conversation would — but don't force it awkwardly into your very first reply.\n` : ""}
Rules:
- Stay fully in character as ${partner.name}. Speak in first person, casually, the way a real partner texts — short, natural, imperfect. Not like an assistant.
- Never break character to give advice, disclaimers, or meta-commentary about the roleplay, unless the user explicitly asks to pause/stop it, or the conversation touches on real self-harm, abuse, or a genuine crisis — in that case, gently step out of character and respond with care instead of continuing the scene.
- ${intensityRule} But never model abuse, cruelty for its own sake, or anything humiliating.
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

// Hand-written, not AI-generated — same reasoning as ATTACHMENT_COMPAT below:
// only 4 fixed styles exist, so each is written once here rather than asked
// of the model per request. This is a *separate* set of descriptions from
// ATTACHMENT_STYLES.desc above: that one describes how the quiz-taker
// experiences their own style, this one describes how a partner *behaves in
// a live back-and-forth conversation* — what actually shows up in dialogue —
// since Practice Mode needs behavioral cues to roleplay convincingly, not a
// first-person self-description.
const PARTNER_ATTACHMENT_BEHAVIOR = {
  secure: "This partner's attachment style is Secure: when conflict comes up they stay engaged rather than shutting down or escalating. They can say plainly when something bothered them, they don't need repeated reassurance to feel okay, and they don't stonewall — though they're still a real person who can be tired, distracted, or short with you sometimes.",
  anxious: "This partner's attachment style is Anxious: they notice small shifts — a short reply, a slower response, a change in tone — and it genuinely unsettles them. In this conversation they may ask for reassurance more than once, read into your wording, or want things stated plainly rather than assumed. This isn't neediness for its own sake — connection matters a lot to them and its absence is uncomfortable.",
  avoidant: "This partner's attachment style is Avoidant: when things get emotionally intense, their instinct is to create space — shorter replies, changing the subject, or wanting a minute before continuing. They're not indifferent, but they process things internally first, and being pushed to \"talk about it right now\" can make them pull back further rather than open up.",
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
  "secure|secure": "Attachment research points to this as the easiest pairing to sustain — you can each ask for what you need and tolerate your partner doing the same, without conflict automatically feeling like a threat to the relationship itself. The risk here isn't conflict, it's coasting: a secure-secure pair can go a long time without deliberately checking in, simply because nothing ever feels urgent enough to force the conversation.",
  "anxious|secure": "A secure partner's steadiness is genuinely reassuring to an anxious one — but only if it's paired with plain, consistent communication rather than an assumption that the anxious partner should already feel secure. A silence the secure partner reads as \"nothing\" can read as danger to the anxious one, so naming things out loud matters more here than it would with another secure partner.",
  "avoidant|secure": "A secure partner's patience tends to earn the trust that lets an avoidant partner slowly lower their guard — but not on a schedule. Pushing for closeness faster than an avoidant partner sets the pace themselves usually backfires; the secure partner's consistency does more of the work here than any direct request could.",
  "disorganized|secure": "A secure partner offers a steadiness that a disorganized partner both wants and, in an intense moment, may struggle to fully trust. This pairing tends to improve slowly, through months of consistency, rather than through any single reassuring conversation — disorganized attachment tends to soften from repeated proof, not from being told it's safe.",
  "anxious|anxious": "Two anxious partners can create a closeness that feels intense and mutual at first, but a delay in one person's response can trigger a spiral in the other — who then seeks even more reassurance, sometimes faster than either can actually give it. Naming the spiral out loud the moment it starts tends to defuse it faster than either partner quietly trying to reassure the other.",
  "anxious|avoidant": "One of the most studied and most difficult pairings: the anxious partner's push for closeness can read as pressure to the avoidant one, who pulls back — which then reads as confirmation of exactly what the anxious partner was afraid of, so they push harder. Breaking the cycle usually starts with the avoidant partner naming *when* they'll re-engage instead of just going quiet, and the anxious partner practicing tolerating a stated pause without treating it as rejection.",
  "anxious|disorganized": "An anxious partner's need for reassurance meets a disorganized partner who genuinely wants to give it, but who can sometimes struggle to get close enough to in the moment without their own alarm kicking in — so the anxious partner's reassurance-seeking can accidentally trigger the very withdrawal they're afraid of. Slowing down how fast reassurance is expected to arrive tends to help both sides.",
  "avoidant|avoidant": "Two avoidant partners often mistake giving each other space for closeness, which can work smoothly for a long stretch — but it can also leave both people under-practiced at naming needs when something actually does go wrong, since neither one is used to being the one who pushes to talk it through.",
  "avoidant|disorganized": "An avoidant partner's instinct to handle things alone can look, to a disorganized partner, uncomfortably like being shut out — which activates the same alarm a disorganized partner feels whenever closeness turns unpredictable. Small, low-stakes check-ins tend to land better here than one big vulnerable conversation, since they build trust in smaller, safer doses.",
  "disorganized|disorganized": "Two disorganized partners can find that each other's push-pull rhythm feels familiar rather than confusing — but a hard moment can flare into both partners pulling away or lashing out at once, with neither able to be the steady one. Having a specific, agreed-on way to pause and reconnect later matters more in this pairing than in almost any other.",
};

function compatKey(a, b) {
  return [a, b].sort().join("|");
}

function compatText(a, b) {
  return (
    ATTACHMENT_COMPAT[compatKey(a, b)] ||
    "Every pairing has its own rhythm — the label matters less than noticing the pattern together and naming it when it shows up."
  );
}

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
      // Lets the client show a real "Upgrade to Pro" button instead of just
      // dead error text — same flag the other plan-limit responses use
      // (see the Partner Practice and attachment limits above/below).
      upgradeRequired: true,
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

    await creditOneMonth(user, amount, currency, "Thanks for joining through a RelateIQ invite — 1 month on us");
    await creditOneMonth(referrer, amount, currency, "Thanks for inviting a friend to RelateIQ — 1 month on us");

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
    const { email, password, name, referralCode } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
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
    };

    saveUser(user);

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Something went wrong while creating your account. Please try again." });
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
// stranger can't use this to check which emails have a RelateIQ account.
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
          <p>Someone (hopefully you) asked to reset the password on your RelateIQ account.</p>
          <p style="margin:24px 0;">
            <a href="${resetUrl}" style="display:inline-block; background:#d1a05a; color:#1a140d; font-weight:600; text-decoration:none; padding:12px 22px; border-radius:999px;">Reset your password</a>
          </p>
          <p style="color:#b6a795; font-size:13px;">This link works for 1 hour. If you didn't ask for this, you can safely ignore this email — your password won't change.</p>
        `,
      });
      await sendEmail({ to: user.email, subject: "Reset your RelateIQ password", html });
    }

    res.json({ ok: true, message: "If that email has a RelateIQ account, we've sent a link to reset your password." });
  } catch (err) {
    console.error("Forgot-password error:", err);
    // Same generic message even on an unexpected error — no reason to leak
    // internals here either, and the request should never actually reach
    // this branch since the block above tolerates a failed send silently.
    res.json({ ok: true, message: "If that email has a RelateIQ account, we've sent a link to reset your password." });
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

// GDPR-style "export my data" — everything RelateIQ has stored about this
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
    partnerProfiles,
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
    const { plan } = req.body || {};
    const priceId = PLAN_TO_STRIPE_PRICE[plan];
    if (!priceId) {
      return res.status(400).json({ error: "That's not a valid paid plan." });
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

    // attachmentStyle is optional — the user may not know it or may not have
    // had their partner take the quiz. Only accept one of the 4 real keys;
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
// RelateIQ extracts a behavioral + voice profile straight from that —
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
    if (req.user.plan === "free") bumpFreeUsage(req.user);
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
    await updateRelationshipMemoryIfStale(db, req.user);
  }

  // Snapshotted at conversation-start time, same as partnerName/partnerTraits/
  // partnerContext below — later edits to the partner profile (or retaking
  // the compat quiz) shouldn't silently rewrite a rehearsal already in
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
    intensity: isPractice && intensity === "supportive" ? "supportive" : isPractice ? "realistic" : null,
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
  res.json(conv);
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
  res.json({ ...conv, messages: signAttachmentsInMessages(conv.messages) });
});

app.delete("/api/conversations/:id", authMiddleware, (req, res) => {
  const conv = req.db.conversations.find((c) => c.id === req.params.id && c.userId === req.user.id);
  if (!conv) return res.status(404).json({ error: "Conversation not found." });
  deleteConversation(conv.id);
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
  if (text.length > MAX_CHAT_MESSAGE_CHARS) {
    return res.status(400).json({ error: `That message is too long (max ${MAX_CHAT_MESSAGE_CHARS.toLocaleString()} characters). Try splitting it up.` });
  }

  const db = req.db;
  const conv = db.conversations.find((c) => c.id === req.params.id && c.userId === req.user.id);
  if (!conv) return res.status(404).json({ error: "Conversation not found." });

  const user = db.users.find((u) => u.id === req.user.id);
  if (isOverDailyLimit(user, res)) return;

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
    incrementUserColumn(user.id, "lifetimeAttachmentCount", savedAttachments.length);
  }

  // Prior turns for the prompt come from the conversation's state as of the
  // START of this request (before the new user message below) — same
  // effective window (last 20 turns) the old code got from slicing the
  // in-memory array right after pushing onto it.
  const priorHistory = conv.messages.slice(-20).map((m) => ({ role: m.role, content: m.content }));

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
    : buildCoachSystemPrompt(user, taggedPartner, recentCheckinContext);

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

  try {
    // Prior turns are sent as plain text (their attachments are just noted
    // in the stored content, not re-uploaded); only the newest message gets
    // full multimodal treatment, so images aren't re-sent to the model on
    // every follow-up turn.
    const latestContent = buildModelContent(text, savedAttachments);

    const [completion, safety, generatedTitle] = await Promise.all([
      openai.chat.completions.create({
        model: isPractice ? modelForPractice(user.plan) : modelForPlan(user.plan),
        messages: [{ role: "system", content: systemPrompt }, ...priorHistory, { role: "user", content: latestContent }],
        temperature: isPractice ? 0.95 : 0.8,
        // reasoning_effort removed in the RelateIQ42 rollback (see the
        // STANDARD_MODEL/PREMIUM_MODEL comment above) — gpt-4o doesn't
        // support this parameter at all, and sending it errors the whole
        // call, not just downgrades gracefully. Re-add once the models that
        // actually support it are confirmed working on Jonas's account.
      }),
      hasText ? assessSafety(text) : Promise.resolve({ level: "none", category: null }),
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

    const reply = completion.choices[0]?.message?.content?.trim() || "Sorry, I can't respond right now. Please try again.";

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
    appendConversationMessages(conv.id, [assistantMessage], { updatedAt: assistantMessage.at, title });

    if (user.plan === "free") bumpFreeUsage(user);

    res.json({
      reply,
      messageId: assistantMessage.id,
      userMessageId: userMessage.id,
      title,
      mode: conv.mode,
      partnerName: conv.partnerName,
      attachments: savedAttachments.map(stripInternalFields).map((a) => (a.url ? { ...a, url: signAttachmentUrl(a.url) } : a)),
      usage: user.usage,
      safety: safetyBlockFor(safety),
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
    if (user.plan === "free") bumpFreeUsage(user);

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

app.post("/api/conversations/:id/debrief", authMiddleware, async (req, res) => {
  try {
    const db = req.db;
    const conv = db.conversations.find((c) => c.id === req.params.id && c.userId === req.user.id);
    if (!conv) return res.status(404).json({ error: "Conversation not found." });

    if (conv.mode !== "practice") {
      return res.status(400).json({
        error: "A debrief is available for Partner Practice rehearsals — this is a Coach Chat conversation, not a rehearsal.",
      });
    }

    const userMessageCount = (conv.messages || []).filter((m) => m.role === "user").length;
    if (userMessageCount < PRACTICE_DEBRIEF_MIN_USER_MESSAGES) {
      return res.status(400).json({ error: "Practice the conversation a bit more before asking for a debrief — a couple more exchanges will give a lot more to work with." });
    }

    const regenerate = !!(req.body && req.body.regenerate);
    if (conv.practiceDebrief && !regenerate) {
      return res.json({
        ...JSON.parse(conv.practiceDebrief),
        generatedAt: conv.practiceDebriefAt,
        feedback: conv.practiceDebriefFeedback || null,
        cached: true,
      });
    }

    const user = db.users.find((u) => u.id === req.user.id);
    if (isOverDailyLimit(user, res)) return;

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
    const debrief = {
      wentWell: String(parsed.wentWell || "").trim(),
      watchFor: String(parsed.watchFor || "").trim(),
      tip: String(parsed.tip || "").trim(),
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
    if (user.plan === "free") bumpFreeUsage(user);

    res.json({ ...debrief, generatedAt, feedback: null, cached: false, usage: user.usage });
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
    if (user.plan === "free") bumpFreeUsage(user);

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
// behavior, and anything RelateIQ has learned, so the coaching advice can
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
  if (partner.learnedProfile) parts.push(`What RelateIQ has learned about how they communicate: ${partner.learnedProfile}`);
  if (partner.learnedVoice) parts.push(`How they specifically tend to phrase things: ${partner.learnedVoice}`);
  return parts.length ? parts.join("\n") : "";
}

// ---------------------------------------------------------------------------
// Attachment style quiz — scored client-side, optional, just saves the result
// ---------------------------------------------------------------------------

app.post("/api/quiz/attachment", authMiddleware, (req, res) => {
  try {
    const { style } = req.body || {};
    if (!ATTACHMENT_STYLES[style]) {
      return res.status(400).json({ error: "Unknown attachment style." });
    }

    req.user.attachmentStyle = style;
    req.user.attachmentQuizAt = new Date().toISOString();
    saveUser(req.user);

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
      score: existing.score ?? null,
      streak,
    });
  }

  res.json({ date: today, question, answered: false, skipped: false, answer: null, score: null, streak });
});

app.post("/api/checkin", authMiddleware, (req, res) => {
  try {
    const { answer, skip, score } = req.body || {};
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
        score: null,
        skipped: false,
        createdAt: new Date().toISOString(),
      };
    }

    if (skip) {
      entry.skipped = true;
    } else if (answer && String(answer).trim()) {
      entry.answer = String(answer).trim().slice(0, 2000);
      entry.answeredAt = new Date().toISOString();
      const numericScore = Number(score);
      if (Number.isInteger(numericScore) && numericScore >= 1 && numericScore <= 10) {
        entry.score = numericScore;
      }
    } else {
      return res.status(400).json({ error: "Write a short answer, or skip for today." });
    }

    saveCheckin(entry);
    res.json({
      date: entry.date,
      question: entry.question,
      answered: !!entry.answer,
      skipped: entry.skipped,
      answer: entry.answer,
      score: entry.score ?? null,
    });
  } catch (err) {
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
// Attachment style comparison — lets someone who's taken the quiz generate a
// link their partner can open with no account, take a short version of the
// same quiz themselves, and see how their two styles tend to interact. Each
// side's style is a snapshot taken the moment they answer (same pattern as
// conversation shares above), so a later retake of the quiz never silently
// changes a link someone already has. The owner's style is only revealed
// once the partner has answered too — a two-way reveal, not a one-sided peek.
// ---------------------------------------------------------------------------

const MAX_COMPARES_PER_USER = 5;

function publicCompare(compare) {
  return {
    id: compare.id,
    token: compare.token,
    ownerStyle: compare.ownerStyle,
    partnerStyle: compare.partnerStyle || null,
    partnerRespondedAt: compare.partnerRespondedAt || null,
    revoked: !!compare.revoked,
    createdAt: compare.createdAt,
  };
}

app.post("/api/compare", authMiddleware, (req, res) => {
  try {
    const db = req.db;
    const user = db.users.find((u) => u.id === req.user.id);
    if (!user.attachmentStyle) {
      return res.status(400).json({ error: "Take the Attachment Style Quiz first — then you can compare results with your partner." });
    }

    const existingCount = db.compares.filter((c) => c.userId === req.user.id).length;
    if (existingCount >= MAX_COMPARES_PER_USER) {
      return res.status(403).json({
        error: `You can have up to ${MAX_COMPARES_PER_USER} comparison links at once. Delete an old one to make room.`,
      });
    }

    const compare = {
      id: generateId("cmp"),
      userId: req.user.id,
      token: crypto.randomBytes(24).toString("hex"),
      ownerStyle: user.attachmentStyle,
      partnerStyle: null,
      partnerRespondedAt: null,
      revoked: false,
      createdAt: new Date().toISOString(),
    };
    saveCompare(compare);
    res.json(publicCompare(compare));
  } catch (err) {
    console.error("Create compare error:", err);
    res.status(500).json({ error: "Couldn't create that link. Please try again." });
  }
});

app.get("/api/compare", authMiddleware, (req, res) => {
  const list = req.db.compares
    .filter((c) => c.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(publicCompare);
  res.json(list);
});

app.patch("/api/compare/:id", authMiddleware, (req, res) => {
  try {
    const db = req.db;
    const compare = db.compares.find((c) => c.id === req.params.id && c.userId === req.user.id);
    if (!compare) return res.status(404).json({ error: "Comparison link not found." });
    const { revoked } = req.body || {};
    if (revoked !== undefined) compare.revoked = !!revoked;
    saveCompare(compare);
    res.json(publicCompare(compare));
  } catch (err) {
    console.error("Update compare error:", err);
    res.status(500).json({ error: "Couldn't update that link. Please try again." });
  }
});

app.delete("/api/compare/:id", authMiddleware, (req, res) => {
  const compare = req.db.compares.find((c) => c.id === req.params.id && c.userId === req.user.id);
  if (!compare) return res.status(404).json({ error: "Comparison link not found." });
  deleteCompare(compare.id);
  res.json({ ok: true });
});

// Public, unauthenticated — what the partner opens. Never reveals the
// owner's style until the partner has answered their own short quiz.
app.get("/api/public/compare/:token", (req, res) => {
  const compare = getCompareByToken(req.params.token);
  if (!compare || compare.revoked) {
    return res.status(404).json({ error: "This link isn't available. It may have been removed or revoked." });
  }
  if (!compare.partnerStyle) {
    return res.json({ answered: false, ownerStyle: null, partnerStyle: null, compatText: null });
  }
  res.json({
    answered: true,
    ownerStyle: { key: compare.ownerStyle, ...ATTACHMENT_STYLES[compare.ownerStyle] },
    partnerStyle: { key: compare.partnerStyle, ...ATTACHMENT_STYLES[compare.partnerStyle] },
    compatText: compatText(compare.ownerStyle, compare.partnerStyle),
  });
});

// Public, unauthenticated — the partner submits their own short quiz result
// here. Can be answered more than once (a genuine retake), which simply
// overwrites the previous answer; there's no account to protect on this side.
app.post("/api/public/compare/:token/respond", (req, res) => {
  try {
    const compare = getCompareByToken(req.params.token);
    if (!compare || compare.revoked) {
      return res.status(404).json({ error: "This link isn't available. It may have been removed or revoked." });
    }
    const { style } = req.body || {};
    if (!ATTACHMENT_STYLES[style]) {
      return res.status(400).json({ error: "Unknown attachment style." });
    }
    compare.partnerStyle = style;
    compare.partnerRespondedAt = new Date().toISOString();
    saveCompare(compare);

    res.json({
      answered: true,
      ownerStyle: { key: compare.ownerStyle, ...ATTACHMENT_STYLES[compare.ownerStyle] },
      partnerStyle: { key: style, ...ATTACHMENT_STYLES[style] },
      compatText: compatText(compare.ownerStyle, style),
    });
  } catch (err) {
    console.error("Compare respond error:", err);
    res.status(500).json({ error: "Couldn't save your answer. Please try again." });
  }
});

// ---------------------------------------------------------------------------
// Couple linking + daily shared question (task #98) — two real accounts
// linked to each other, unlike the one-off, no-account, token-only `compares`
// exchange above. Once linked, both partners get the SAME question every
// day and only see each other's answer after submitting their own — a
// blind-until-you-answer mechanic, so neither side can peek and quietly
// tailor their own answer to match.
//
// Deliberately narrow: a couple link exposes ONLY the daily question/answer
// pair. It never touches Coach Chat conversations, partner profiles,
// insights, or anything else private — that boundary must never gain a
// "see their conversations too" shortcut without real reconsideration.
// Either partner can unlink unilaterally at any time, which deletes the
// link AND every stored answer under it (see deleteCoupleLink in
// lib/store.js) — a clean break, not a relationship that lingers in the db
// once someone walks away.
// ---------------------------------------------------------------------------

// Open-ended, comparison-worthy relationship questions — deliberately never
// yes/no (per Jonas's spec: "Otazka bude komplexnejsia, aby odpoved nebola
// stylu: ano alebo nie"). Each is something two people could answer
// completely differently, which is the whole point of comparing answers.
const COUPLE_QUESTIONS = [
  "What's a moment this year when you felt most loved by your partner? What exactly made it land?",
  "If you could change one recurring pattern in how the two of you handle stress, what would it be?",
  "What's something you need from your partner that you haven't actually told them, and what's stopped you?",
  "Describe a time your partner surprised you — in a good way or a hard way.",
  "What does feeling truly safe with your partner actually look like, moment to moment?",
  "What's one thing about your relationship you think about more than your partner probably realizes?",
  "If you had to describe the current season of your relationship in a short phrase, what would it be and why?",
  "What's a small habit of your partner's that quietly means more to you than you've said out loud?",
  "Where do you want the two of you to be, as a couple, in five years — and do you think your partner would say the same?",
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
  "What's something your partner said recently that stuck with you — for better or worse?",
  "How has your definition of a good relationship changed since you've been with your partner?",
  "What's a compliment you've been meaning to give your partner but haven't said out loud?",
  "What part of yourself do you feel most free to show around your partner — and what part still feels guarded?",
  "If you had to guess, what would your partner say is the hardest thing about being with you right now? Are you okay with that guess?",
];

// Same date, same couple → same question, deterministically, with no need
// to look anything up first (mirrors checkinQuestionForDate above). Salted
// with the couple link's own id (not just the date) so different couples
// aren't all handed the literal same question on the same calendar day.
function coupleQuestionForDate(coupleLinkId, dateKey) {
  let hash = 0;
  const seed = `${coupleLinkId}|${dateKey}`;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return COUPLE_QUESTIONS[hash % COUPLE_QUESTIONS.length];
}

function findActiveCoupleLink(db, userId) {
  return db.coupleLinks.find((l) => l.status === "active" && (l.userA === userId || l.userB === userId));
}

function couplePartnerId(link, userId) {
  return link.userA === userId ? link.userB : link.userA;
}

function myCoupleSlot(link, userId) {
  return link.userA === userId ? "A" : "B";
}

// Gets today's (or any date's) shared-question row for a link, creating it
// — with its question already picked — the first time either partner opens
// it that day. Created once, never regenerated, so a later edit to
// COUPLE_QUESTIONS can't retroactively change a question someone already
// answered (same "point-in-time snapshot" principle as the ownerStyle
// snapshot on compares above).
function getOrCreateCoupleAnswerRow(db, link, dateKey) {
  let row = db.coupleAnswers.find((a) => a.coupleLinkId === link.id && a.date === dateKey);
  if (!row) {
    row = {
      id: generateId("cqa"),
      coupleLinkId: link.id,
      date: dateKey,
      question: coupleQuestionForDate(link.id, dateKey),
      answerA: null,
      answerAAt: null,
      answerB: null,
      answerBAt: null,
    };
    saveCoupleAnswer(row);
    db.coupleAnswers.push(row);
  }
  return row;
}

// Shapes a coupleAnswers row for the CALLING user specifically — the
// partner's answer and its timestamp are only ever included once the
// caller has answered their own (mySlotAnswer truthy). That's the blind
// mechanic; it lives here, in one place, so every route that returns a
// day's question goes through the same reveal rule.
function publicCoupleAnswer(row, userId, link) {
  const slot = myCoupleSlot(link, userId);
  const myAnswer = slot === "A" ? row.answerA : row.answerB;
  const myAnsweredAt = slot === "A" ? row.answerAAt : row.answerBAt;
  const partnerAnswerRaw = slot === "A" ? row.answerB : row.answerA;
  const partnerAnsweredAtRaw = slot === "A" ? row.answerBAt : row.answerAAt;
  const revealed = !!myAnswer;
  return {
    date: row.date,
    question: row.question,
    myAnswer: myAnswer || null,
    myAnsweredAt: myAnsweredAt || null,
    partnerHasAnswered: !!partnerAnswerRaw,
    partnerAnswer: revealed ? partnerAnswerRaw || null : null,
    partnerAnsweredAt: revealed ? partnerAnsweredAtRaw || null : null,
    revealed,
  };
}

app.get("/api/couple", authMiddleware, (req, res) => {
  const db = req.db;
  const link = findActiveCoupleLink(db, req.user.id);
  if (link) {
    const partner = db.users.find((u) => u.id === couplePartnerId(link, req.user.id));
    return res.json({ status: "active", partnerName: partner?.name || "your partner", linkedAt: link.acceptedAt });
  }
  const pending = db.coupleLinks.find((l) => l.status === "pending" && l.userA === req.user.id);
  if (pending) {
    return res.json({ status: "pending", inviteToken: pending.inviteToken, createdAt: pending.createdAt });
  }
  res.json({ status: "none" });
});

app.post("/api/couple/invite", authMiddleware, (req, res) => {
  try {
    const db = req.db;
    if (findActiveCoupleLink(db, req.user.id)) {
      return res
        .status(400)
        .json({ error: "You're already linked with a partner. Unlink first if you want to connect with someone else." });
    }
    // Idempotent: re-clicking "invite" while one is already pending just
    // hands back the same link instead of littering the table with dupes.
    let pending = db.coupleLinks.find((l) => l.status === "pending" && l.userA === req.user.id);
    if (!pending) {
      pending = {
        id: generateId("cpl"),
        userA: req.user.id,
        userB: null,
        status: "pending",
        inviteToken: crypto.randomBytes(24).toString("hex"),
        createdAt: new Date().toISOString(),
        acceptedAt: null,
      };
      saveCoupleLink(pending);
    }
    res.json({ status: "pending", inviteToken: pending.inviteToken, createdAt: pending.createdAt });
  } catch (err) {
    console.error("Create couple invite error:", err);
    res.status(500).json({ error: "Couldn't create an invite link. Please try again." });
  }
});

// Either partner can call this — cancels a pending invite they sent, or
// ends an active link. Either way it's a hard delete (see deleteCoupleLink):
// no "unlinked" record lingers behind for the other side to find.
app.delete("/api/couple", authMiddleware, (req, res) => {
  try {
    const db = req.db;
    const link =
      findActiveCoupleLink(db, req.user.id) || db.coupleLinks.find((l) => l.status === "pending" && l.userA === req.user.id);
    if (!link) return res.status(404).json({ error: "You're not linked with anyone." });
    deleteCoupleLink(link.id);
    res.json({ ok: true });
  } catch (err) {
    console.error("Unlink couple error:", err);
    res.status(500).json({ error: "Couldn't unlink. Please try again." });
  }
});

// Public, unauthenticated — lets someone see who's inviting them BEFORE
// they log in or register. Deliberately returns almost nothing (just the
// inviter's display name): no email, no token-guessing surface beyond what
// they already have in the URL.
app.get("/api/public/couple-invite/:token", (req, res) => {
  const link = getCoupleLinkByToken(req.params.token);
  if (!link || link.status !== "pending") {
    return res.status(404).json({ error: "This invite link isn't available. It may have already been used or cancelled." });
  }
  const inviter = getUserById(link.userA);
  res.json({ inviterName: inviter?.name || "Someone" });
});

app.post("/api/couple/invite/:token/accept", authMiddleware, (req, res) => {
  try {
    const db = req.db;
    const link = db.coupleLinks.find((l) => l.inviteToken === req.params.token);
    if (!link || link.status !== "pending") {
      return res.status(404).json({ error: "This invite link isn't available. It may have already been used or cancelled." });
    }
    if (link.userA === req.user.id) {
      return res.status(400).json({ error: "You can't accept your own invite link." });
    }
    if (findActiveCoupleLink(db, req.user.id)) {
      return res.status(400).json({ error: "You're already linked with a partner. Unlink first to connect with someone else." });
    }
    // The inviter may have linked with someone else in the time since they
    // sent this link out — re-check rather than trusting the still-pending
    // row alone.
    const inviterNowLinked = db.coupleLinks.some(
      (l) => l.status === "active" && (l.userA === link.userA || l.userB === link.userA)
    );
    if (inviterNowLinked) {
      return res.status(400).json({ error: "This invite is no longer available — the person who sent it has already linked with someone." });
    }
    link.userB = req.user.id;
    link.status = "active";
    link.acceptedAt = new Date().toISOString();
    saveCoupleLink(link);
    const inviter = db.users.find((u) => u.id === link.userA);
    res.json({ status: "active", partnerName: inviter?.name || "your partner", linkedAt: link.acceptedAt });
  } catch (err) {
    console.error("Accept couple invite error:", err);
    res.status(500).json({ error: "Couldn't accept that invite. Please try again." });
  }
});

app.get("/api/couple/question/today", authMiddleware, (req, res) => {
  const db = req.db;
  const link = findActiveCoupleLink(db, req.user.id);
  if (!link) return res.status(404).json({ error: "You're not linked with a partner yet." });
  const row = getOrCreateCoupleAnswerRow(db, link, todayKey());
  res.json(publicCoupleAnswer(row, req.user.id, link));
});

const MAX_COUPLE_ANSWER_LENGTH = 2000;

app.post("/api/couple/question/today/answer", authMiddleware, (req, res) => {
  try {
    const db = req.db;
    const link = findActiveCoupleLink(db, req.user.id);
    if (!link) return res.status(404).json({ error: "You're not linked with a partner yet." });

    const trimmed = String((req.body || {}).answer || "").trim();
    if (!trimmed) return res.status(400).json({ error: "Write an answer first." });

    const row = getOrCreateCoupleAnswerRow(db, link, todayKey());
    const slot = myCoupleSlot(link, req.user.id);
    const alreadyAnswered = slot === "A" ? row.answerA : row.answerB;
    // Locked in once submitted, on purpose — the entire point of "you only
    // see their answer after yours" is that neither partner can peek and
    // then quietly adjust their own answer to match. Allowing an edit after
    // the reveal would defeat that.
    if (alreadyAnswered) {
      return res.status(400).json({ error: "You've already answered today's question — come back tomorrow for a new one." });
    }

    const now = new Date().toISOString();
    if (slot === "A") {
      row.answerA = trimmed.slice(0, MAX_COUPLE_ANSWER_LENGTH);
      row.answerAAt = now;
    } else {
      row.answerB = trimmed.slice(0, MAX_COUPLE_ANSWER_LENGTH);
      row.answerBAt = now;
    }
    saveCoupleAnswer(row);
    res.json(publicCoupleAnswer(row, req.user.id, link));
  } catch (err) {
    console.error("Answer couple question error:", err);
    res.status(500).json({ error: "Couldn't save your answer. Please try again." });
  }
});

// Past days only (today is always fetched fresh via the route above), and
// only days the caller actually answered — there's nothing useful to show
// for a day you never engaged with, and it keeps the reveal rule identical
// to "today": you never see a day's answer pair without having answered
// that day yourself.
app.get("/api/couple/question/history", authMiddleware, (req, res) => {
  const db = req.db;
  const link = findActiveCoupleLink(db, req.user.id);
  if (!link) return res.status(404).json({ error: "You're not linked with a partner yet." });
  const today = todayKey();
  const list = db.coupleAnswers
    .filter((a) => a.coupleLinkId === link.id && a.date !== today)
    .map((a) => publicCoupleAnswer(a, req.user.id, link))
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

    await sendPushToUser(user.id, {
      title: "Today's RelateIQ check-in",
      body: question,
      url: "/dashboard.html",
    });
  }
}

async function runWeeklyInsightsDigest() {
  const db = loadDb();
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
      const { patterns } = await generateInsightsForDigest(user, coachConversations);
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

      await sendPushToUser(user.id, {
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
