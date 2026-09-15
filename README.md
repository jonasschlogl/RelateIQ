# RelateIQ

An AI relationship coach — landing page, login/registration, four coaching modes connected to OpenAI (Coach Chat, Partner Practice, Message Coach, Attachment Style Quiz), a daily check-in, and a dashboard with conversation history.

## Running it

```bash
npm install
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

`npm run dev` restarts the server on file changes (Node's `--watch`). For a production run, use `npm start`.

## Configuration

In `.env` (copy from `.env.example` if you don't have one yet) you need:

- `OPENAI_API_KEY` — your OpenAI API key (already set).
- `JWT_SECRET` — a random string used to sign login tokens. For local development it works even without one (a default value is used), but **set your own long, random string before deploying to production**.
- `PORT` — optional, defaults to `3000`.
- `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_PREMIUM`, `STRIPE_WEBHOOK_SECRET`, `APP_URL` — optional, needed only for real payments. See "Payments (Stripe)" below.
- `DB_PATH`, `UPLOADS_DIR` — optional. Override where the JSON database and uploaded files are stored. Only needed when deploying somewhere with a persistent volume — see "Deploying to production" below; local dev ignores these and just uses `data/db.json` and `public/uploads/`.

## Project structure

- `server.js` — Express server: API routes (`/api/auth/*`, `/api/conversations/*`, `/api/partners/*`, `/api/message-coach`, `/api/quiz/attachment`, `/api/checkin*`, `/api/billing/*`) and static serving of `public/`.
- `lib/store.js` — a simple JSON-file store (`data/db.json`), with four collections: `users`, `conversations`, `partnerProfiles`, `checkins`. Fine for local development and a modest number of users; as you grow, swap it for a real database (e.g. SQLite or Postgres) — only this one file needs to change.
- `public/` — the entire frontend (landing page, login, registration, chat, message coach, quiz, dashboard).
- `data/db.json` — where everything is stored. Not committed to git (see `.gitignore`).

## What's included

- **Landing page** (`index.html`) — hero, features, a "Modes" showcase, how it works, pricing, FAQ.
- **Sign up / log in** (`register.html`, `login.html`) — email + password, passwords hashed with bcrypt, session handled via a JWT stored in `localStorage`.
- **Coach Chat** (`chat.html`) — conversation with the AI coach (GPT-4o mini), history saved per user, a free-tier limit of 8 AI messages/day (shared across every mode that calls the AI). Messages can include attachments (photos, screen recordings, or other files — up to 3 files / 15MB total per message): images are sent to the model as vision input, small text files (.txt/.md/.csv/.json/.log) are read and included as context, and other files (video, PDFs, etc.) are referenced by name since the model can't open them directly. Uploaded files are saved under `public/uploads/<userId>/` by default (served at `/uploads/...` regardless of where they physically live — see `UPLOADS_DIR` in Configuration) — not committed to git, and not private (anyone with the exact URL could load one), which is fine for local/personal use but worth hardening before any real deployment.
- **Partner Practice** (also `chat.html`, via the mode tabs) — create one or more "partner profiles" (name, personality, context) and the AI roleplays as that partner in character, so you can rehearse a real conversation. Switch back to the Coach tab anytime for a debrief.
- **Message Coach** (`message-coach.html`) — paste a draft message + optional context, get a calmer rewrite plus a short explanation of what changed.
- **Attachment Style Quiz** (`quiz.html`) — a short, client-scored quiz (secure / anxious / avoidant / disorganized). Entirely optional and skippable; the result is just saved to the user's profile.
- **Daily check-in** (on `dashboard.html`) — one optional, rotating reflection question per day. Always skippable, never gates anything else in the app.
- **Dashboard** (`dashboard.html`) — profile, plan, today's usage, attachment style (if taken), the check-in, a "modes hub" linking to everything above, and the list of conversations.

## Payments (Stripe)

Pro (\$9.99/mo) and Premium (\$19.99/mo) are wired up to real Stripe subscriptions. The pricing page, the dashboard's "Upgrade" button, and a self-serve "Manage subscription" button (Stripe's hosted Customer Portal) all work once you fill in the Stripe env vars — until then, those buttons show a friendly "payments aren't set up yet" error instead of crashing.

**One-time setup, in your [Stripe Dashboard](https://dashboard.stripe.com):**

1. Create your Stripe account if you don't have one yet. Start in **test mode** (toggle in the top right) — you can test the whole flow with fake card numbers before ever taking a real payment.
2. Go to **Product catalog** → create a product called "RelateIQ Pro" with a recurring price of \$9.99/month, and another called "RelateIQ Premium" at \$19.99/month. Copy each price's ID (starts with `price_...`) into `STRIPE_PRICE_PRO` / `STRIPE_PRICE_PREMIUM` in your `.env`.
3. Go to **Developers → API keys**, copy the **Secret key** (starts with `sk_test_...` in test mode) into `STRIPE_SECRET_KEY`.
4. Set `APP_URL` to wherever the app is reachable — `http://localhost:3000` for local dev, or your real domain once deployed.
5. Webhook (this is what actually upgrades the account after a successful payment):
   - **Local dev:** install the [Stripe CLI](https://stripe.com/docs/stripe-cli), run `stripe login` once, then keep `stripe listen --forward-to localhost:3000/api/billing/webhook` running alongside `npm run dev`. It prints a `whsec_...` value — put that in `STRIPE_WEBHOOK_SECRET`.
   - **Production:** in the Dashboard, go to **Developers → Webhooks → Add endpoint**, use `https://yourdomain.com/api/billing/webhook`, and subscribe it to `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted`. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
6. Restart the server after editing `.env`.
7. Test it: sign up, click "Choose Pro" on the pricing page, and pay with Stripe's test card `4242 4242 4242 4242`, any future expiry, any CVC. You should land back on the dashboard already upgraded. From there, "Manage subscription" opens Stripe's hosted portal to cancel or change plans.
8. Turn on the **Customer Portal** once, under **Settings → Billing → Customer portal**, so "Manage subscription" has something to open (Stripe enables a sensible default automatically the first time you visit that settings page).
9. When you're ready to take real money, switch the Dashboard out of test mode and swap in your **live** keys (`sk_live_...`, live price IDs, and a live-mode webhook endpoint/secret) in `.env`.

## Deploying to production (Railway)

RelateIQ isn't stateless — it writes to `data/db.json` and saves uploaded files to disk — so it needs a host with a **persistent volume**, not a plain serverless platform. [Railway](https://railway.app) is a straightforward choice for a project this size: connect a GitHub repo, click deploy, done.

1. **Push the code to GitHub.** Create a new repo (GitHub.com → New repository), then from `C:\RelateIQ`:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
   `.gitignore` already excludes `node_modules/`, `.env`, `data/db.json`, and `public/uploads/` — none of your secrets or local data get pushed.
2. **Create a Railway project** → "Deploy from GitHub repo" → pick the repo. Railway auto-detects it's a Node app (via `package.json`) and runs `npm start`.
3. **Add a Volume** (Railway project → your service → "Volumes" tab → "New Volume"). Mount it at `/data`. This is the persistent disk that survives every redeploy.
4. **Set environment variables** (service → "Variables" tab) — everything from your local `.env`, plus two new ones pointing at the volume:
   ```
   OPENAI_API_KEY=sk-...
   JWT_SECRET=<a long random string — generate a new one for production, don't reuse the dev one>
   STRIPE_SECRET_KEY=sk_live_... (see step 7 below)
   STRIPE_PRICE_PRO=price_...
   STRIPE_PRICE_PREMIUM=price_...
   STRIPE_WEBHOOK_SECRET=whsec_... (see step 7 below)
   APP_URL=https://your-domain-or-railway-subdomain
   DB_PATH=/data/db.json
   UPLOADS_DIR=/data/uploads
   ```
5. **Get the free Railway subdomain working first** (Settings → "Generate Domain" → you'll get something like `relateiq-production.up.railway.app`). Visit it, register an account, send a message — confirm the whole app works before touching a custom domain.
6. **Custom domain:** buy one from any registrar (Namecheap, Porkbun, Cloudflare Registrar are all simple and cheap). In Railway, Settings → "Custom Domain" → enter it → Railway gives you a CNAME record to add at your registrar's DNS settings. DNS changes can take anywhere from a few minutes to a few hours to take effect. Once it resolves, update `APP_URL` in Railway's variables to `https://yourdomain.com` and redeploy.
7. **Switch Stripe to live mode:** in the Stripe Dashboard, toggle off test mode, recreate the two products/prices (live-mode prices are separate from test ones), grab the live secret key, and add a **new** webhook endpoint under live mode pointing at `https://yourdomain.com/api/billing/webhook` (same three events as before). Put the live `sk_live_...`, price IDs, and `whsec_...` into Railway's variables.
8. **Test end to end on the real domain** — register, chat, and run one real (or Stripe test-card, if you leave test mode on a bit longer to be safe) upgrade before telling anyone else about it.

## Old files in the root folder

The original `index.html`, `chat.html`, `dashboard.html`, `script.js`, and `style.css` in the root folder (outside `public/`) are no longer used by the app — they've been replaced by the new version in `public/`. You can safely delete them, or keep them as a backup.

## Ideas for what's next

- Add password reset via email.
- Move from the JSON file to a real database once you have more users.
