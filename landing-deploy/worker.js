// RelationshipAI landing: tiny Cloudflare Worker that stores early-access emails.
// Static files are served by Cloudflare's assets layer; only /api/* reaches this code.
//
// Storage: Cloudflare KV, binding name EMAILS.
//   key      = "email:" + lowercased address (so the same address is never stored twice)
//   metadata = { email, ts, source, plan, billing, country }  (shown in the dashboard list)
// Optional: set a secret variable EXPORT_KEY, then open /api/export?key=<EXPORT_KEY>
// to download all addresses as CSV.

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
const clip = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/subscribe") return subscribe(request, env, url);
    if (url.pathname === "/api/export") return exportCsv(request, env, url);
    if (url.pathname.startsWith("/api/")) return json({ ok: false, error: "not_found" }, 404);
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not found", { status: 404 });
  },
};

async function subscribe(request, env, url) {
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  // same-site requests only
  const origin = request.headers.get("origin");
  if (origin) {
    let ok = false;
    try { ok = new URL(origin).host === url.host; } catch (_) {}
    if (!ok) return json({ ok: false, error: "forbidden" }, 403);
  }

  const raw = await request.text();
  if (raw.length > 2000) return json({ ok: false, error: "too_large" }, 413);
  let body;
  try { body = JSON.parse(raw); } catch (_) { return json({ ok: false, error: "bad_json" }, 400); }

  // bots: hidden field filled in, or form submitted impossibly fast. Pretend success.
  if (body.website) return json({ ok: true });
  if (typeof body.t === "number" && body.t < 1200) return json({ ok: true });

  const email = clip(body.email, 300).trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return json({ ok: false, error: "invalid_email" }, 400);

  if (!env.EMAILS) return json({ ok: false, error: "not_configured" }, 500);

  const key = "email:" + email;
  const existing = await env.EMAILS.get(key);
  if (existing === null) {
    const meta = {
      email,
      ts: new Date().toISOString(),
      source: clip(body.source, 40),
      plan: clip(body.plan, 20),
      billing: clip(body.billing, 20),
      country: (request.cf && request.cf.country) || "",
    };
    await env.EMAILS.put(key, "1", { metadata: meta });
  }
  return json({ ok: true });
}

async function exportCsv(request, env, url) {
  const secret = env.EXPORT_KEY;
  const given = url.searchParams.get("key") || "";
  if (!secret || !safeEqual(given, secret)) return json({ ok: false, error: "not_found" }, 404);
  if (!env.EMAILS) return json({ ok: false, error: "not_configured" }, 500);

  const esc = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // keep spreadsheets from running a cell as a formula
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const rows = [["email", "date", "source", "plan", "billing", "country"]];
  let cursor;
  do {
    const page = await env.EMAILS.list({ prefix: "email:", cursor, limit: 1000 });
    for (const k of page.keys) {
      const m = k.metadata || {};
      rows.push([m.email || k.name.slice(6), m.ts || "", m.source || "", m.plan || "", m.billing || "", m.country || ""]);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  return new Response(rows.map((r) => r.map(esc).join(",")).join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="relationshipai-emails.csv"',
      "cache-control": "no-store",
    },
  });
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
