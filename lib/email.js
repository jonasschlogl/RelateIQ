// Thin wrapper around the Resend API (https://resend.com/docs/api-reference/emails/send-email)
// using the platform's built-in fetch — no SDK dependency needed. Set
// RESEND_API_KEY (and optionally EMAIL_FROM) in .env to enable sending.
// Without a key, sendEmail() just logs a warning once and no-ops — every
// caller in this app tolerates that silently, since a missed email should
// never break a request or crash a background job.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "RelateIQ <onboarding@resend.dev>";

let warnedMissingKey = false;

export async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    if (!warnedMissingKey) {
      console.warn("⚠️  RESEND_API_KEY is not set — emails will not be sent (fine for local dev, required in production).");
      warnedMissingKey = true;
    }
    return { skipped: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`Resend API error (${res.status}):`, text);
      return { skipped: true, error: text };
    }

    return await res.json();
  } catch (err) {
    console.error("Failed to send email:", err.message);
    return { skipped: true, error: err.message };
  }
}

// Escapes text for safe interpolation into an HTML email body. Deliberately
// separate from the app's escapeHtml() (frontend-only, uses the DOM) since
// this runs server-side with no DOM available.
export function escapeForEmail(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Wraps a snippet of body HTML in RelateIQ's email shell — dark, on-brand,
// inline-styled (email clients don't reliably load external/linked CSS).
// unsubscribeUrl is optional but should be passed for every automated,
// non-transactional email (check-in reminders, digests) — not for one-off
// account emails a person directly triggered.
export function emailShell({ bodyHtml, unsubscribeUrl }) {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background:#17130f; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#17130f; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:480px; background:#241d14; border-radius:16px; padding:32px;">
            <tr>
              <td style="font-family:Georgia,serif; font-size:20px; font-weight:600; color:#f6efe4; padding-bottom:18px;">
                Relate<span style="color:#d1a05a;">IQ</span>
              </td>
            </tr>
            <tr>
              <td style="color:#f6efe4; font-size:15px; line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
            ${
              unsubscribeUrl
                ? `<tr>
              <td style="padding-top:28px; border-top:1px solid rgba(250,235,215,0.09); margin-top:24px;">
                <p style="color:#7d7062; font-size:12px; margin:16px 0 0;">
                  Don't want these emails? <a href="${unsubscribeUrl}" style="color:#7d7062;">Unsubscribe</a>
                </p>
              </td>
            </tr>`
                : ""
            }
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
