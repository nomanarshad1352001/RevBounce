# RevBounce — Project Profile

**Title:** RevBounce — *"Turn Traffic Into Revenue"*

**Tagline:** One snippet on a publisher's website. Everything after that — pop design, triggers, campaigns, devices, frequency caps, campaigns, email delivery, payouts — is controlled from the dashboard. No website code edits, ever again.

---

## What the platform does

RevBounce is a **traffic-monetization SaaS for website owners**. Visitors who are already leaving
(exit-intent, idle, mobile back-button) see an elegant pop with a monetization offer instead of
vanishing. Every impression, click, form submission, conversion and dollar is tracked server-side;
revenue is computed, split, invoiced and paid out automatically.

### The 30-second product story
1. A publisher pastes one line — `<script async src="…/embed.js" data-site="SITE_KEY">` — into their site. That is the only code change they will ever make.
2. In the dashboard they design an **Offer Pop** with 1–5 campaigns in sequence (Host & Post lead forms, CPA link-outs, Google click-feeds) or an **Email Capture Pop**.
3. The embedded engine (~13 KB gzipped, Shadow DOM) arms **exit-intent / idle / mobile back-button / scroll-up** triggers, honors device/geo/traffic targeting and first-party frequency caps, and runs the full sequence state machine.
4. Leads and emails are delivered **server-side** to advertisers (Host & Post worker with success rules) and to email providers (API retry with exponential backoff + FTP/SFTP CSV batches).
5. Advertisers fire **postbacks** (Everflow / Twyne / generic macros); conversions create revenue records; the platform splits by the publisher's business model and settles payouts twice monthly. An hourly **Thompson-sampling optimizer** re-weights rotation by live EPC.

### Two business models (both fully implemented)
- **Model 1 — Pay for the System:** subscription tiers (Starter $49 / Growth $149 / Enterprise $499) with included-click bundles + per-click overage and a usage meter. Publisher keeps 100% of campaign revenue; Stripe-mock billing + invoices.
- **Model 2 — Revenue Share:** free to use; platform campaigns + auto-optimization; split is **70/30 publisher/platform by default and configurable per publisher by admin** (50–95).

---

## Who buys it (target clients)

| Client | Why they buy |
|---|---|
| **Blogs & content publishers** | Recapture abandoning visitors without harming UX or bounce rate |
| **News & media networks** | Monetize exit traffic across dozens of properties with one console |
| **Affiliate marketers** | Sequence multiple offers per visitor with caps, weights and rotation |
| **Lead-gen companies** | Host & Post forms with success rules, field mapping, retries, dedupe |
| **E-commerce brands** | Exit offers, email capture to owned lists, decline-page monetization |
| **List owners / newsletter operators** | Email Capture → Mailchimp/Klaviyo/FTP with duplicate rules and delivery status |
| **Agencies & managed networks** | White-label branding, per-publisher splits, impersonation, audit log |
| **Advertisers** | Log in to manage **their own** campaigns and view own-campaign reports |

### Roles inside the product
**Admin** (everything: publishers, splits, payouts, fraud flags, feature flags, impersonation) ·
**Publisher** (own sites, pops, campaigns, revenue) · **Advertiser** (own campaigns + own reports only). Every gate in the §4 permission matrix is enforced live.

---

## Feature inventory

### Delivery plane (the embed)
- Single async snippet, **13 KB gzipped**, zero dependencies, **Shadow DOM** (publisher CSS cannot break the pop)
- Versioned config (`/public/config/:siteKey`, 60 s TTL + stale fallback + ETag), **HMAC-signed session token** attached to event batches
- Triggers: exit-intent (min load delay + velocity threshold), idle (single throttled timer, paused when tab hidden), **mobile back-button sentinel** with automatic idle fallback, optional fast scroll-up
- **Sequence state machine** in sessionStorage keyed by popId+version: NO advances, capped/ineligible/invalid-URL slots auto-skip, campaigns never repeat, "1 of N" counter, Close-on-Yes / Close-on-Final-No
- **Host & Post**: animated in-pop form, per-field validation, single-submit guard, success/failure paths, retry; **CPA/Feed**: server-issued `click_id`, macro substitution, `window.open` inside the click handler, *advance on return* (focus/visibilitychange) with popup-block fallback
- **Multi-tab lock** (BroadcastChannel + storage event), refresh-resume, version pinning mid-session, server "skipped" response when a campaign is disabled after publish
- First-party identity (`revbounce_vid` cookie + localStorage), consent-aware (`revbounceConsent`, GPC, DNT), **no fingerprinting**
- Batched events via sendBeacon with fetch fallback — full 15-type taxonomy with UTM/referrer/session/visitor context; server dedupes by event id, geo-enriches (country/region only), bot-filters
- Robustness: kill switch (>8 JS errors or `config.disabled`), requestIdleCallback boot, passive listeners, focus trap, `role="dialog"`/`aria-modal`, Escape — **the visitor can always close**
- Public JS API: `RevBounce.show / hide / reset / debug / state / stop`

### Dashboard
- **Overview** — date range + previous-period comparison; KPI cards (Revenue, Impressions, Clicks, eCPM) with sparklines & % deltas; Revenue & Traffic chart with metric switch + Daily/Weekly/Monthly; Top Performing Pops; Performance by Pop Type with row menus; status donut; Quick Actions; Need Help panel
- **Campaign Library** — search + 4 filters, bulk activate/deactivate; 3 kinds: **Host & Post** (form builder: text/email/phone/zip/address/select/consent + regex; posting config: endpoint, method, headers, auth, body format, field mapping, statics, success rule, duplicate rule, timeout, retries, **test-post with live response**), **CPA Link-Out** & **Google Feed** (macro URLs `{click_id}{site_id}{pop_id}{sub1..5}{email}{zip}` with validation + resolved preview); caps, geo/device/source targeting, schedule, allowed pop types, rotation weight; admin-published **Marketplace**
- **Pop Builder** — 8 steps (General, Design, Campaigns with **drag-reorder + per-slot toggle**, Display Rules, Targeting, Frequency, Integrations, Preview & Save), live Desktop/Tablet/Mobile preview in a faux browser frame, Pop Summary card, review checklist, `?revbounce_preview=` test mode, install snippet with detection status, **immutable versions + rollback**
- **Publishers** — admin CRUD (business model, split editor, terms, suspend), **impersonate**; publisher self-service: sites + **domain allow-lists**, verification (snippet / meta-tag), team users, payout details (PayPal/bank/wire/USDT + tax-form flag)
- **Reports** — all 9 group-by views, 15 metrics, sortable/paginated tables, **CSV export**, saved + **scheduled email reports**, **Offer funnel**, Email capture report (API + FTP/SFTP attempt/success/failure)
- **Email Records** — full ledger (email, timestamp, site, pop, device, trigger, delivery status), filters, resend failed, bulk resend, CSV
- **Revenue & Billing** — split ring, payout ledger, plan management with **usage meter + overage**, downloadable invoices
- **Settings** — profile, password + optional 2FA, **API keys** with scopes, notifications, global Everflow/Twyne postbacks, white-label branding, **data retention**, danger zone
- **Admin console** — system stats, advertisers, publisher/split management, **plan/tier editor**, payout approvals, **fraud/invalid-click flags**, **audit log** (live-appended), **feature flags with rollout %**
- **API & Engine tab** — route table, 31-model data model browser, optimizer runner with decision audit, and the §11 test runner

### Backend
- **55+ REST endpoints** under `/api/v1` — auth (register/login/refresh/logout/forgot/reset/me, JWT access+refresh, revocable), publishers, sites (+verify, +snippet), campaigns (+test-post, +duplicate, library), pops (+publish, +rollback, +duplicate, +status, +preview-token), email records (+CSV, +retry) & integrations, reports (5 views + CSV), billing (plan, usage), invoices, payouts (+approve/paid), admin, meta (schema/routes/registry/trackers/selftest)
- **Public plane** — config, batched events, Host & Post submit, email capture, click redirect tracker (302 + server click id), **postback receiver** (Everflow/Twyne/generic → Conversion + revenue split, idempotent, invalid-click exclusion)
- **Security** — HMAC-SHA256 tokens, RBAC, per-IP/per-siteKey rate limits, **SSRF guard** (loopback/RFC-1918/CGNAT/link-local/metadata), input sanitization, secrets AES-256-GCM at rest & masked in logs, audit log, structured JSON errors, CSRF-safe bearer auth
- **Non-functional** — `/healthz`, **OpenAPI 3.1** (`/api/openapi.json` + `/docs`), GDPR/CCPA endpoints (`/api/privacy`: delete / export / retention job), retention policy (events 90 d · aggregates 24 mo · emails until deleted), embed < 40 KB gz, config p95 < 150 ms
- **Optimizer** — real **Thompson sampling** (Beta–Gamma sampler) over EPC/eCPM per (site, device, geo), 200-impression minimum sample, 10 % epsilon exploration, cap & payout-floor guards, admin lock, **decision audit trail**
- **Fraud** — bot-UA filter, 30 s duplicate-click suppression, IP rate anomalies, withheld-from-billing flags
- **Extensibility** — pluggable **PopType & Trigger registries** (`/api/v1/meta/registry`): 10 pop types, 10 triggers; new entries need no engine rewrite

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 16 (App Router, Turbopack)** + React 19 + TypeScript |
| Styling | **Tailwind CSS 4** + custom design system (light SaaS theme: `#F3F7FD`, navy `#0B3D91`, Inter) |
| Charts | Bespoke **SVG chart components** (area/bar/donut/sparkline — no chart dependency) |
| State (client) | React context store, **localStorage persistence** |
| Data layer | **In-memory model registry — no database** (31 spec-modeled models + seed, Prisma-swappable) |
| API | Next.js Route Handlers → shared router (`api-core` + `api-router` + `api-seed`) |
| Auth | **HMAC-SHA256 JWT** (access 15 min + refresh 30 d, revocable), role-based gates |
| Crypto | Node `crypto` — HMAC, SHA-256, AES-256-GCM-key slot, timing-safe compare |
| Embed engine | **Vanilla JS** written as a TS string asset, served by a route handler, **Shadow DOM**, ~13 KB gzipped |
| Public plane | sendBeacon batch ingestion, dedupe/idempotency, geo enrichment, bot filtering |
| Worker logic | In-process: API retries (exponential backoff), FTP/SFTP CSV batches, billing metering, hourly optimizer |
| Observability | Structured JSON logs, `/healthz`, OpenAPI docs, audit log |
| Privacy | GDPR/CCPA delete/export/retention endpoints, consent flags (GPC/DNT), first-party id only |
| Tests | **55 edge-case tests** (`src/lib/edge-tests.ts`) + CI runner (`tests/run.mjs`) + in-app runner |
| Deploy | **Dockerfile + docker-compose.yml** (web, worker, postgres, redis) with health checks; `.env.example` |

### Spec-→-implementation mapping (documented defaults)
Express + Prisma + Redis + BullMQ + Vite are represented by their Next.js equivalents so the whole
product runs as one deployable with **zero database**; the worker seam, schema registry and queue
boundaries are kept explicit so those components drop in later without rewrites.

---

## Qualities (why it's worth buying)

1. **Fearless embed.** Shadow-DOM isolation, silent failure, kill switch, WCAG AA, max caps — a broken campaign can never break the publisher's site or trap a visitor.
2. **Revenue integrity.** Server-issued click ids, idempotent postbacks, dedupe, fraud/invalid-click exclusion from billing, audited payout transitions.
3. **Privacy-native.** Consent flags, GPC/DNT, first-party id, data deletion/export endpoints, retention jobs, masked logs — GDPR/CCPA by construction, not by policy.
4. **Measurable beauty.** A-award-grade marketing site + a reference-faithful light SaaS dashboard: everything clickable, every action toasted, skeletons, empty states, confirmations.
5. **Extensible.** Pluggable pop-type and trigger registries, generic tracker templates, webhook delivery logs, schema-driven models — Phase-8 additions are configuration, not surgery.
6. **Provably correct.** 55 automated tests against the real HTTP surface (auth, RBAC, SSRF, dedupe, splits, optimizer, schema, all §11 edge cases) + a manual QA checklist; CI runner exits non-zero on any failure.
7. **Deploy-anywhere.** Single Docker image or docker-compose; in-memory store means it boots with zero external services, while Postgres/Redis drop in without changing the API.
8. **Both business models in one engine.** Subscription with usage metering + overage billing, and revenue share with per-publisher splits and network-level optimization.

---

## Proven numbers (this build)

- **40 routes** (pages + APIs), **31 seeded models** (134+ rows), **55/55 automated tests green**
- Embed **13.0 KB gzipped** (budget: 40 KB) · config **65 ms** warm p95 (budget: 150 ms)
- Revenue math verified live: **$38 conversion → $26.60 publisher / $11.40 platform**
- 15-type event taxonomy with dedupe: repeat id → `accepted 1 → duplicates 1`
- Optimizer: 5 arms, weights sum to 100 %, capped arm pinned at 0 % with stated reason

*Currency USD · timestamps stored UTC, displayed in the user's timezone · Host & Post success = HTTP 2xx + optional response-match rule.*
