# RevBounce — *Turn Traffic Into Revenue*

A complete publisher-monetization SaaS: one JavaScript snippet on a publisher's site, everything
else (pop design, triggers, campaigns, devices, frequency, email delivery) controlled from the
dashboard. Exit-intent and idle pops present monetization offers, every event is tracked, revenue
is split, and publishers get paid.

> **Storage note:** by explicit requirement this build runs on an **in-memory data layer — no
> database is connected.** Every model from §9 exists (browsable at `/api/v1/meta/schema`), seeded
> on boot, so swapping in Prisma later is a driver change, not a rewrite.

---

## Quick start

```bash
npm install
cp .env.example .env
npm run dev            # http://localhost:3000
```

Production / Docker:

```bash
docker compose up --build        # web + worker + postgres + redis
# or
npm run build && npm run start
```

Verify:

```bash
curl -s localhost:3000/healthz | jq       # service + subsystem health
node tests/run.mjs http://localhost:3000  # 55 edge-case tests, exits non-zero on failure
```

### Demo accounts (password `demo1234`)

| Role | Email | Sees |
|---|---|---|
| Publisher | `publisher@revbounce.com` | own sites, pops, campaigns, revenue |
| Admin | `admin@revbounce.com` | everything + impersonation, splits, payouts, flags |
| Advertiser | `advertiser@revbounce.com` | own campaigns + own-campaign reports only |

The login screen has one-click buttons for all three.

---

## Install the snippet on any page

```html
<script async src="https://YOUR-HOST/embed.js" data-site="rb_tgp_9f27c1"></script>
```

That is the only code a publisher ever adds. Design, triggers, campaigns, caps and targeting all
stream from the dashboard; config is versioned with a 60-second cache TTL.

**Try it immediately:** open <http://localhost:3000/test-site.html> — a real HTML page with the
snippet installed, plus buttons for the public JS API. Or use the in-app sandbox at `/demo-site`.

Trigger it: flick the cursor up past the tab bar (exit intent), idle ~25 s, or press back on mobile.

---

## Architecture

```
Publisher website
  │  <script async src="/embed.js" data-site="SITE_KEY">
  ▼
/embed.js  ── Shadow DOM engine (13 KB gz)
  │   GET  /api/public/config/:siteKey     versioned + ETag + 60s TTL, HMAC session token
  │   POST /api/public/events              batched sendBeacon → dedupe, geo, bot filter
  │   POST /api/public/submit              Host & Post → advertiser endpoint (server-side)
  │   POST /api/public/email               validate → duplicate rule → API + FTP delivery
  │   GET  /api/public/click/:campaignId   302 redirect tracker, server click_id
  ▼
Backend (/api/v1/*)  ── JWT auth, RBAC, rate limits, SSRF guard, audit log
  ├── in-memory model registry (31 models, seeded)     ← swap for Prisma/Postgres
  ├── worker seam: email retries, FTP batches, billing, hourly optimizer
  └── POST /api/postback/:trackerKey        Everflow / Twyne / generic → Conversion + split
  ▼
Dashboard (Next.js App Router, light SaaS UI)
```

| Component | Location |
|---|---|
| Dashboard web app | `src/app/dashboard/**` |
| REST API | `src/lib/api-router.ts` + `src/app/api/v1/**` |
| Public plane | `src/app/api/public/**`, `src/app/api/postback/**` |
| Embed engine | `src/app/embed.js/route.ts` |
| Worker logic | `src/lib/server-store.ts` (delivery, retries, batching) |
| Data model + seed | `src/lib/api-core.ts`, `src/lib/api-seed.ts` |
| Tests | `src/lib/edge-tests.ts`, `tests/run.mjs` |

---

## Folder tree

```
├── Dockerfile · docker-compose.yml · .env.example · QA-CHECKLIST.md
├── tests/run.mjs                      # CI runner for the §11 suite
├── public/test-site.html              # demo page with the live snippet
└── src/
    ├── app/
    │   ├── page.tsx                   # marketing landing
    │   ├── login · signup · demo-site · docs
    │   ├── healthz/route.ts           # §13 health check
    │   ├── embed.js/route.ts          # the pop engine
    │   ├── api/
    │   │   ├── v1/[group]/[a]/[b]     # authed REST surface
    │   │   ├── public/{config,events,submit,email,click}
    │   │   ├── postback/[trackerKey]  # conversion receiver
    │   │   ├── openapi.json · privacy · testpost · health
    │   └── dashboard/
    │       ├── layout.tsx             # navy top bar, sidebar, toasts
    │       ├── page.tsx               # KPIs, charts, tables, quick actions
    │       ├── campaigns · pops/[id] · pops/new · publishers
    │       ├── reports · emails · payouts · sites · analytics
    │       ├── revenue · integrations · settings · admin · api
    ├── components/  ui · charts · landing · pop-builder · pop-preview · campaign-editor
    └── lib/         types · data · store · server-store · api-core · api-router · api-seed · edge-tests
```

---

## API

Full interactive list at **`/docs`**, machine-readable at **`/api/openapi.json`**.

```bash
TOKEN=$(curl -s -X POST localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"publisher@revbounce.com","password":"demo1234"}' | jq -r .accessToken)

curl -s localhost:3000/api/v1/reports/overview?days=30 -H "Authorization: Bearer $TOKEN" | jq
curl -s localhost:3000/api/v1/meta/schema | jq '.models | length'      # 31
curl -s localhost:3000/api/v1/meta/registry | jq                        # pop types + triggers
```

Auth · Publishers · Sites · Campaigns (+test-post, duplicate, library) · Pops (+publish, rollback,
duplicate, status, preview-token) · Email records (+export.csv, retry) · Email integrations ·
Reports (overview, timeseries, by-dimension, funnel, email, export.csv) · Billing (plan, usage) ·
Invoices · Payouts (+approve, paid) · Admin (stats, audit-log, feature-flags, advertisers,
fraud-flags, optimize, optimizer-runs) · Meta (schema, routes, registry, trackers, selftest).

### Security
HMAC-SHA256 JWTs (access 15 min / refresh 30 d, revocable) · bearer auth (CSRF-safe) ·
HMAC session token minted at config fetch and verified on event batches · per-IP/per-siteKey rate
limits · SSRF guard (loopback, RFC-1918, CGNAT, link-local, cloud metadata) · input sanitization ·
secrets AES-256-GCM at rest and masked in every log · audit log on all mutations · structured JSON errors.

### Privacy (§13)
`GET /api/privacy` publishes the policy. `POST /api/privacy` supports `delete`, `export` and
`retention` (raw events 90 days, aggregates 24 months, email records until the publisher deletes
them). Consent honours `window.revbounceConsent`, GPC and DNT; identity is a first-party
`revbounce_vid` per site — **no fingerprinting**.

---

## The embed engine

* **13 KB gzipped**, zero dependencies, Shadow DOM so publisher CSS cannot break the pop
* Boot: allow-listed hostname → cached versioned config → device detection → URL/targeting/frequency → priority-ordered arming
* Triggers: exit-intent (min delay + velocity), idle (throttled, single timer, paused when hidden), mobile back-button sentinel with automatic idle fallback, optional fast scroll-up
* Offer sequence: up to 5 campaigns, NO advances, capped/ineligible auto-skipped, Host & Post inline form, link-out with server click id and advance-on-return, "1 of N" counter
* Multi-tab lock (BroadcastChannel + storage), refresh resume, version pinning mid-session
* WCAG AA: `role="dialog"`, `aria-modal`, focus trap, Escape, visible focus rings — **the visitor can always close**
* Fail-safe: everything try/caught, kill switch after 8 errors or `config.disabled`, silent no-op if the config fetch fails
* Public API: `RevBounce.show(popId) · hide() · reset() · debug(true) · state() · stop()`

---

## Tests

```bash
node tests/run.mjs http://localhost:3000     # 55 tests · ~550 ms
```

Also runnable from **Dashboard → API & Engine → Run suite**, or `GET /api/v1/meta/selftest`.
Covers auth/RBAC, SSRF, HMAC spoofing, event dedupe, bot filtering, geo enrichment, revenue splits
and postback idempotency, fraud suppression, billing/usage/payout transitions, the Thompson-sampling
optimizer, the 31-model schema, all report dimensions, and every §11 edge case. See
`QA-CHECKLIST.md` for the manual pass.

---

## Defaults (§15)

Frequency once per 24 h (session / cooldown 1h–30d / max-N also available) · unique visitor = distinct
first-party id per site · link-out advances on return (immediate advance is a per-pop option) ·
final NO closes · config changes apply on next load (60 s TTL) · preview/test mode before publish ·
currency USD · timestamps stored UTC, displayed local · Host & Post success = HTTP 2xx + optional
response match.
