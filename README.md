# Double Take — digital twin studio

Landing page and lead API for a studio that builds digital twins: an avatar and a
voice clone that ship vertical video without the person being on set.

Stack: **HTML + Tailwind CSS v4 + vanilla ES modules** on the front, **Node + Express**
on the back. No bundler, no framework, no native dependencies.

---

## Getting started

```bash
npm install
cp .env.example .env     # then set ADMIN_TOKEN
npm run dev
```

`npm run dev` runs two watchers side by side: the Tailwind CLI compiling
`src/styles/tailwind.css` → `public/assets/css/site.css`, and nodemon restarting the
server. Open <http://localhost:3000>.

For production:

```bash
npm run build     # writes the minified stylesheet
npm start
```

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Tailwind watch + server with reload |
| `npm run dev:css` | Tailwind watch only |
| `npm run dev:server` | Server only |
| `npm run build` | Minified `site.css` — run before deploying |
| `npm start` | Serves `public/` and the API |

---

## Layout

```
.
├── public/                     ← everything served to the browser
│   ├── index.html              landing page
│   ├── admin.html              lead inbox (needs the admin token)
│   ├── favicon.svg
│   └── assets/
│       ├── css/site.css        BUILD OUTPUT — generated, git-ignored
│       ├── img/robot.png
│       └── js/
│           ├── main.js         entry point, boots the modules
│           ├── admin.js        entry point for admin.html
│           └── modules/
│               ├── api.js          fetch wrapper + ApiError
│               ├── nav.js          mobile drawer
│               ├── planPicker.js   plan card → prefilled form
│               ├── leadForm.js     validation + submit
│               └── availability.js live slot count in the hero
│
├── src/styles/tailwind.css     ← design tokens (@theme) and components
│
├── server/
│   ├── index.js                starts the HTTP server, handles signals
│   ├── app.js                  middleware and static file wiring
│   ├── config.js               env parsing, one source of truth
│   ├── routes/                 URL → controller
│   ├── controllers/            HTTP in, HTTP out; no business logic
│   ├── services/               business logic (leads, availability, Telegram)
│   ├── repositories/           persistence; the only layer that knows the store
│   ├── validators/             zod schemas shared by controllers
│   ├── middleware/             security headers, rate limits, auth, errors
│   └── lib/                    logger, error classes
│
└── data/                       ← leads.ndjson lands here (git-ignored)
```

The layering is the point: a controller never touches the store, and a service
never reads `req`. Swapping the database means rewriting
`server/repositories/leads.repository.js` and nothing above it.

---

## API

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | — | Uptime probe |
| `GET` | `/api/availability` | — | Slots left this month; drives the hero counter |
| `POST` | `/api/leads` | — | Booking form. Rate limited to 5 per 15 min per IP |
| `GET` | `/api/leads` | admin token | Lead inbox, newest first |

Send the admin token as `X-Admin-Token: <token>` or `Authorization: Bearer <token>`.

```bash
# Submit a lead
curl -X POST http://localhost:3000/api/leads \
  -H 'content-type: application/json' \
  -d '{"name":"Alex Moreau","email":"alex@studio.com","plan":"scene","elapsedMs":9000}'

# Read the inbox
curl http://localhost:3000/api/leads -H "x-admin-token: $ADMIN_TOKEN"
```

Errors always come back in the same shape:

```json
{ "ok": false, "error": { "code": "bad_request", "message": "Some fields need fixing.",
  "details": [{ "field": "email", "message": "That email address looks wrong." }] } }
```

---

## Where the data goes

Leads append to `data/leads.ndjson`, one JSON object per line. Writes are queued
in-process so two submissions cannot interleave a line. That is deliberately the
simplest thing that survives a restart — good for the volume a studio site sees,
and honest about its limits: it does not fan out across multiple server instances.

**Moving to a real database.** Keep the four exported functions in
`server/repositories/leads.repository.js` (`create`, `list`, `countSince`,
`countBookedThisMonth`) and rewrite their bodies. Nothing else in the codebase
imports the store.

---

## Spam handling

Three cheap layers, no third-party captcha:

1. A honeypot field positioned off-screen — a filled one is rejected.
2. A fill-time check: anything submitted under 1.2 seconds is rejected.
3. `express-rate-limit`: 5 submissions per 15 minutes per IP.

---

## Telegram notifications

Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` and each new lead is posted to that
chat. Leave them blank to disable. Delivery failures are logged and swallowed — the
lead is already stored before the notification is attempted, so an outage at
Telegram never loses a booking.

---

## Design tokens

Colours and typefaces live in one `@theme` block in `src/styles/tailwind.css` and
generate the Tailwind utilities used in the markup:

| Token | Value | Role |
| --- | --- | --- |
| `--color-ink` | `#08080B` | Page ground |
| `--color-panel` | `#11121A` | Cards |
| `--color-edge` | `#20222E` | Hairlines |
| `--color-chalk` | `#F4F3F1` | Text |
| `--color-mist` | `#9B9CA8` | Secondary text |
| `--color-flare` | `#FF6A1A` | The single accent |
| `--font-display` | Unbounded | Headlines |
| `--font-body` | Golos Text | Body |
| `--font-mono` | JetBrains Mono | Labels, prices, data |

Rename a token here and the whole site follows.

---

## Deploying

1. `npm ci && npm run build`
2. Set `NODE_ENV=production`, a real `ADMIN_TOKEN`, and `MONTHLY_SLOTS`.
3. `npm start` behind a TLS-terminating proxy. `trust proxy` is already set to 1,
   so rate limiting sees real client IPs.
4. Keep `data/` on a persistent volume, or move the repository to a managed
   database first.

## Before going live

Placeholders to replace: the Telegram link in the booking panel, the
`hi@doubletake.studio` address, "since 2023" in the hero slate, and the 40 / 48 / 90
figures in the hero stats.
