import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_TTL, MODELS, TRACKER_TEMPLATES, accountByEmail, accountById, accounts, audit, authFrom,
  clean, computeOverage, createAccount, find, insert, issuePair, limit, maskPayload,
  optimize, optimizerRuns, randomUUID, remove, revoke, sha256, signToken, ssrfSafe, table, update,
  verifyToken, where, type AuthCtx,
} from "@/lib/api-core";
import { ensureSeed, seedSummary } from "@/lib/api-seed";

const JSONH = { "Content-Type": "application/json" };
const ok = (data: unknown, status = 200) => NextResponse.json(data as Record<string, unknown>, { status, headers: JSONH });
const err = (message: string, status = 400, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: false, error: message, ...extra }, { status, headers: JSONH });

const ipOf = (req: NextRequest) => req.headers.get("x-forwarded-for") ?? "127.0.0.1";
const requireAuth = (req: NextRequest): AuthCtx | null => authFrom(req.headers.get("authorization"));
const requireRole = (ctx: AuthCtx | null, roles: AuthCtx["role"][]) => !!ctx && roles.includes(ctx.role);

function csv(rows: Record<string, string | number>[]): string {
  if (!rows.length) return "";
  const head = Object.keys(rows[0]);
  const esc = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [head.join(","), ...rows.map((r) => head.map((h) => esc(r[h])).join(","))].join("\n");
}
const csvResponse = (name: string, rows: Record<string, string | number>[]) =>
  new NextResponse(csv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` } });

function series(days: number) {
  let s = 20260117;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const out: { date: string; impressions: number; clicks: number; conversions: number; revenue: number }[] = [];
  const base = new Date("2026-01-17T12:00:00Z").getTime();
  for (let i = days - 1; i >= 0; i--) {
    const impressions = Math.round(14_200 + rnd() * 5_800);
    const clicks = Math.round(impressions * (0.082 + rnd() * 0.028));
    const conversions = Math.round(clicks * (0.19 + rnd() * 0.09));
    out.push({
      date: new Date(base - i * 86_400_000).toISOString().slice(0, 10),
      impressions, clicks, conversions, revenue: +(conversions * (7.4 + rnd() * 5.8)).toFixed(2),
    });
  }
  return out;
}

async function body(req: NextRequest): Promise<Record<string, unknown>> {
  try { return (await req.json()) as Record<string, unknown>; } catch { return {}; }
}

export const ROUTES = [
  "POST /api/v1/auth/register", "POST /api/v1/auth/login", "POST /api/v1/auth/refresh",
  "POST /api/v1/auth/logout", "POST /api/v1/auth/forgot", "POST /api/v1/auth/reset", "GET /api/v1/me",
  "GET|POST /api/v1/publishers", "GET|PUT|DELETE /api/v1/publishers/:id",
  "GET|POST /api/v1/sites", "GET|PUT|DELETE /api/v1/sites/:id", "POST /api/v1/sites/:id/verify", "GET /api/v1/sites/:id/snippet",
  "GET|POST /api/v1/campaigns", "GET|PUT|DELETE /api/v1/campaigns/:id", "POST /api/v1/campaigns/:id/test-post",
  "POST /api/v1/campaigns/:id/duplicate", "GET /api/v1/campaigns/library",
  "GET|POST /api/v1/pops", "GET|PUT|DELETE /api/v1/pops/:id", "POST /api/v1/pops/:id/publish",
  "POST /api/v1/pops/:id/rollback", "POST /api/v1/pops/:id/duplicate", "PATCH /api/v1/pops/:id/status",
  "GET /api/v1/pops/:id/preview-token",
  "GET /api/v1/email-records", "GET /api/v1/email-records/export.csv", "POST /api/v1/email-records/:id/retry",
  "GET|POST|PUT|DELETE /api/v1/email-integrations",
  "GET /api/v1/reports/overview", "GET /api/v1/reports/timeseries", "GET /api/v1/reports/by-dimension",
  "GET /api/v1/reports/funnel", "GET /api/v1/reports/email", "GET /api/v1/reports/export.csv",
  "GET|PUT /api/v1/billing/plan", "GET /api/v1/billing/usage", "GET /api/v1/invoices",
  "GET /api/v1/payouts", "POST /api/v1/payouts/:id/approve", "POST /api/v1/payouts/:id/paid",
  "GET /api/v1/admin/stats", "GET /api/v1/admin/audit-log", "GET|PATCH /api/v1/admin/feature-flags",
  "GET /api/v1/admin/advertisers", "GET|POST /api/v1/admin/fraud-flags", "POST /api/v1/admin/optimize",
  "GET /api/v1/admin/optimizer-runs", "GET /api/v1/meta/schema", "GET /api/v1/meta/routes", "GET /api/v1/meta/trackers",
  "— public —", "GET /api/public/config/:siteKey", "POST /api/public/events", "POST /api/public/submit",
  "POST /api/public/email", "GET /api/public/click/:campaignId", "POST /api/postback/:trackerKey",
];

/* ═══════════════════════ router ═══════════════════════ */
export async function apiRoute(req: NextRequest, path: string[]): Promise<NextResponse> {
  ensureSeed();
  const method = req.method.toUpperCase();
  const [group, a, b] = path;
  const q = req.nextUrl.searchParams;
  const clientIp = ipOf(req);
  if (limit(`api:${clientIp}`, 600, 60_000)) return err("rate_limited", 429);

  /* meta */
  if (group === "meta") {
    if (a === "schema") return ok({ ok: true, models: MODELS, counts: seedSummary() });
    if (a === "trackers") return ok({ ok: true, templates: TRACKER_TEMPLATES });
    if (a === "registry") {
      // §14 — pluggable PopType + Trigger registries. New entries require no
      // engine rewrite: the embed reads `kind` and `rules.trigger` generically.
      return ok({
        ok: true,
        popTypes: [
          { id: "offer", name: "Offer Pop", v1: true, sequence: true },
          { id: "email-capture", name: "Email Capture Pop", v1: true, sequence: false },
          { id: "decline", name: "Decline Page", v1: false, sequence: true },
          { id: "thankyou", name: "Thank-You Page", v1: false, sequence: true },
          { id: "checkout-upsell", name: "Checkout Upsell", v1: false, sequence: true },
          { id: "slide-in", name: "Slide-In", v1: false, sequence: true },
          { id: "mobile", name: "Mobile Pop", v1: false, sequence: true },
          { id: "offer-wall", name: "Offer Wall", v1: false, sequence: true },
          { id: "in-page", name: "In-Page", v1: false, sequence: true },
          { id: "pop-under", name: "Pop-under", v1: false, sequence: true },
        ],
        triggers: [
          { id: "exit", name: "Exit intent", v1: true, devices: ["desktop"] },
          { id: "idle", name: "Idle / inactivity", v1: true, devices: ["desktop", "tablet", "mobile"] },
          { id: "back-button", name: "Mobile back-button", v1: true, devices: ["tablet", "mobile"] },
          { id: "scroll-up", name: "Fast scroll-up", v1: true, devices: ["tablet", "mobile"] },
          { id: "scroll", name: "Scroll depth", v1: false, devices: ["desktop", "tablet", "mobile"] },
          { id: "timed", name: "Timed", v1: false, devices: ["desktop", "tablet", "mobile"] },
          { id: "click", name: "Click / selector", v1: false, devices: ["desktop", "tablet", "mobile"] },
          { id: "page-count", name: "Page count", v1: false, devices: ["desktop", "tablet", "mobile"] },
          { id: "cart-abandon", name: "Cart / checkout abandonment", v1: false, devices: ["desktop", "tablet", "mobile"] },
          { id: "time-on-site", name: "Time on site", v1: false, devices: ["desktop", "tablet", "mobile"] },
        ],
      });
    }
    if (a === "routes") return ok({ ok: true, routes: ROUTES });
    if (a === "selftest") {
      const origin = new URL(req.url).origin;
      const { runEdgeTests } = await import("@/lib/edge-tests");
      const results = await runEdgeTests(origin);
      const failed = results.filter((r) => !r.pass);
      return ok({ ok: failed.length === 0, total: results.length, passed: results.length - failed.length, failed: failed.length, results });
    }
    return err("not_found", 404);
  }

  /* §8 auth */
  if (group === "auth") {
    if (method === "POST" && a === "register") {
      const d = await body(req);
      const email = clean(d.email, 120), password = clean(d.password, 200), name = clean(d.name, 120) || "New Publisher";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err("invalid_email");
      if (password.length < 8) return err("weak_password");
      const acc = createAccount(email, password, name);
      if (!acc) return err("email_taken", 409);
      insert("Publisher", { id: acc.publisherId, name, company: clean(d.company, 120) || "Independent", model: "revshare", split: 70, status: "active", createdAt: Date.now() });
      audit(acc.email, "registered", acc.id, clientIp);
      return ok({ ok: true, ...issuePair(acc) }, 201);
    }
    if (method === "POST" && a === "login") {
      if (limit(`login:${clientIp}`, 20, 60_000)) return err("rate_limited", 429);
      const d = await body(req);
      const acc = accountByEmail(clean(d.email, 120));
      if (!acc || acc.passwordHash !== sha256(clean(d.password, 200))) return err("invalid_credentials", 401);
      audit(acc.email, "logged in", acc.id, clientIp);
      return ok({ ok: true, ...issuePair(acc) });
    }
    if (method === "POST" && a === "refresh") {
      const d = await body(req);
      const payload = verifyToken<{ sub: string; typ: string }>(clean(d.refreshToken, 4000));
      if (!payload || payload.typ !== "refresh") return err("invalid_refresh", 401);
      const acc = accountById(payload.sub);
      if (!acc) return err("invalid_refresh", 401);
      return ok({ ok: true, ...issuePair(acc) });
    }
    if (method === "POST" && a === "logout") {
      const ctx = requireAuth(req);
      if (ctx) { revoke(ctx.jti); audit(ctx.sub, "logged out", ctx.sub, clientIp); }
      return ok({ ok: true });
    }
    if (method === "POST" && a === "forgot") {
      const d = await body(req);
      const acc = accountByEmail(clean(d.email, 120));
      const resetToken = acc ? signToken({ sub: acc.id, typ: "reset", jti: randomUUID() }, 900) : "";
      return ok({ ok: true, message: "If that address exists, a reset link is on its way.", ...(acc ? { resetToken } : {}) });
    }
    if (method === "POST" && a === "reset") {
      const d = await body(req);
      const payload = verifyToken<{ sub: string; typ: string }>(clean(d.token, 4000));
      if (!payload || payload.typ !== "reset") return err("invalid_token", 401);
      const acc = accountById(payload.sub);
      if (!acc) return err("invalid_token", 401);
      const pw = clean(d.password, 200);
      if (pw.length < 8) return err("weak_password");
      acc.passwordHash = sha256(pw);
      audit(acc.email, "reset password", acc.id, clientIp);
      return ok({ ok: true });
    }
    return err("not_found", 404);
  }

  if (group === "me") {
    const ctx = requireAuth(req);
    if (!ctx) return err("unauthorized", 401);
    const acc = accountById(ctx.sub);
    if (!acc) return err("unauthorized", 401);
    return ok({ ok: true, user: { id: acc.id, email: acc.email, name: acc.name, role: acc.role, publisherId: acc.publisherId }, expiresIn: ACCESS_TTL });
  }

  const ctx = requireAuth(req);
  if (!ctx) return err("unauthorized", 401);
  const scope = (r: Record<string, unknown>) => ctx.role === "admin" || r.publisherId === ctx.publisherId;

  /* publishers */
  if (group === "publishers") {
    if (method === "GET" && !a) return ok({ ok: true, data: ctx.role === "admin" ? table("Publisher") : where("Publisher", (r) => r.id === ctx.publisherId) });
    if (method === "GET" && a) {
      const row = find("Publisher", (r) => r.id === a);
      if (!row) return err("not_found", 404);
      if (ctx.role !== "admin" && row.id !== ctx.publisherId) return err("forbidden", 403);
      return ok({ ok: true, data: row });
    }
    if (method === "POST") {
      if (!requireRole(ctx, ["admin"])) return err("forbidden", 403);
      const d = await body(req);
      const row = insert("Publisher", {
        name: clean(d.name, 120) || "New Publisher", company: clean(d.company, 120),
        model: d.model === "subscription" ? "subscription" : "revshare",
        split: Math.min(95, Math.max(50, Number(d.split ?? 70))), status: "active",
        terms: clean(d.terms, 500), notes: clean(d.notes, 500), createdAt: Date.now(),
      });
      audit(ctx.sub, "created publisher", String(row.name), clientIp);
      return ok({ ok: true, data: row }, 201);
    }
    if ((method === "PUT" || method === "PATCH") && a) {
      if (!requireRole(ctx, ["admin"])) return err("forbidden", 403);
      const d = await body(req);
      const row = update("Publisher", a, {
        ...(d.name !== undefined ? { name: clean(d.name, 120) } : {}),
        ...(d.split !== undefined ? { split: Math.min(95, Math.max(50, Number(d.split))) } : {}),
        ...(d.model !== undefined ? { model: d.model } : {}),
        ...(d.status !== undefined ? { status: d.status } : {}),
      });
      if (!row) return err("not_found", 404);
      audit(ctx.sub, "updated publisher", String(row.name), clientIp);
      return ok({ ok: true, data: row });
    }
    if (method === "DELETE" && a) {
      if (!requireRole(ctx, ["admin"])) return err("forbidden", 403);
      update("Publisher", a, { status: "suspended" });
      audit(ctx.sub, "suspended publisher", a, clientIp);
      return ok({ ok: true });
    }
    return err("not_found", 404);
  }

  /* sites */
  if (group === "sites") {
    if (method === "GET" && !a) return ok({ ok: true, data: ctx.role === "admin" ? table("Site") : where("Site", scope) });
    if (method === "GET" && a && b === "snippet") {
      const row = find("Site", (r) => r.id === a);
      if (!row) return err("not_found", 404);
      if (!scope(row)) return err("forbidden", 403);
      const origin = new URL(req.url).origin;
      return ok({ ok: true, siteKey: row.siteKey, snippet: `<script async src="${origin}/embed.js" data-site="${row.siteKey}"></script>` });
    }
    if (method === "GET" && a) {
      const row = find("Site", (r) => r.id === a);
      if (!row) return err("not_found", 404);
      if (!scope(row)) return err("forbidden", 403);
      return ok({ ok: true, data: row });
    }
    if (method === "POST" && a && b === "verify") {
      const row = find("Site", (r) => r.id === a);
      if (!row) return err("not_found", 404);
      if (!scope(row)) return err("forbidden", 403);
      update("Site", a, { verified: true, verifiedAt: Date.now() });
      audit(ctx.sub, "verified site", String(row.domain), clientIp);
      return ok({ ok: true, verified: true, method: row.verifyMethod ?? "snippet", detectedAt: Date.now() });
    }
    if (method === "POST") {
      const d = await body(req);
      const domain = clean(d.domain, 200).replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (!domain) return err("domain_required");
      const row = insert("Site", {
        publisherId: ctx.publisherId, name: clean(d.name, 120) || domain, domain,
        siteKey: `rb_${randomUUID().slice(0, 3)}_${randomUUID().slice(0, 6)}`,
        allowedDomains: [domain], verified: false, verifyMethod: "snippet", createdAt: Date.now(),
      });
      audit(ctx.sub, "created site", domain, clientIp);
      return ok({ ok: true, data: row }, 201);
    }
    if ((method === "PUT" || method === "PATCH") && a) {
      const row = find("Site", (r) => r.id === a);
      if (!row) return err("not_found", 404);
      if (!scope(row)) return err("forbidden", 403);
      const d = await body(req);
      return ok({ ok: true, data: update("Site", a, {
        ...(d.name ? { name: clean(d.name, 120) } : {}),
        ...(Array.isArray(d.allowedDomains) ? { allowedDomains: (d.allowedDomains as string[]).map((x) => clean(x, 200)) } : {}),
        ...(d.verifyMethod ? { verifyMethod: d.verifyMethod } : {}),
      }) });
    }
    if (method === "DELETE" && a) {
      const row = find("Site", (r) => r.id === a);
      if (!row || !scope(row)) return err("not_found", 404);
      remove("Site", a);
      audit(ctx.sub, "deleted site", String(row.domain), clientIp);
      return ok({ ok: true });
    }
    return err("not_found", 404);
  }

  /* campaigns */
  if (group === "campaigns") {
    if (method === "GET" && a === "library") return ok({ ok: true, data: where("Campaign", (r) => r.status === "library") });
    if (method === "GET" && !a) {
      let rows = where("Campaign", (r) => r.status !== "library");
      if (ctx.role === "advertiser") rows = rows.filter((r) => r.advertiserId === ctx.sub || r.advertiserName === "NovaShield Ltd.");
      const status = q.get("status"), kind = q.get("kind"), search = (q.get("q") ?? "").toLowerCase();
      if (status) rows = rows.filter((r) => r.status === status);
      if (kind) rows = rows.filter((r) => r.kind === kind);
      if (search) rows = rows.filter((r) => String(r.name).toLowerCase().includes(search));
      return ok({ ok: true, data: rows, total: rows.length });
    }
    if (method === "POST" && a && b === "test-post") {
      const row = find("Campaign", (r) => r.id === a);
      if (!row) return err("not_found", 404);
      const cfg = find("CampaignPostConfig", (r) => r.campaignId === a);
      const d = await body(req);
      const endpoint = clean((d.endpoint as string) ?? (cfg?.endpoint as string) ?? "", 500);
      const guard = ssrfSafe(endpoint);
      if (!guard.ok) return err(`ssrf_blocked:${guard.reason}`, 422, { endpoint });
      const lower = endpoint.toLowerCase();
      const status = lower.includes("fail") ? 500 : Number(cfg?.successStatus ?? 200);
      const latencyMs = 140 + Math.floor(Math.random() * 220);
      const timeout = Number(cfg?.timeoutMs ?? 3000);
      const timedOut = lower.includes("slow") && latencyMs + 1200 > timeout;
      const payload = maskPayload({ email: "lead.demo@revbounce.dev", zip: "90210", authToken: String(cfg?.authValueEnc ?? "secret-token-value") });
      const success = !timedOut && status >= 200 && status < 300;
      insert("Submission", { campaignId: a, siteId: "", popId: "", payloadMasked: payload, responseMasked: { status, body: success ? "accepted" : "upstream_error" }, httpStatus: status, latencyMs, success, createdAt: Date.now() });
      audit(ctx.sub, "ran campaign test-post", String(row.name), clientIp);
      return ok({ ok: true, simulated: true, request: { endpoint, method: cfg?.method ?? "POST", payload }, response: { status, latencyMs, timedOut, body: success ? { accepted: true } : { error: "upstream" } }, success });
    }
    if (method === "POST" && a && b === "duplicate") {
      const row = find("Campaign", (r) => r.id === a);
      if (!row) return err("not_found", 404);
      const { id: _drop, ...rest } = row;
      void _drop;
      const copy = insert("Campaign", { ...rest, name: `${row.name} (copy)`, status: "draft", createdAt: Date.now() });
      audit(ctx.sub, "duplicated campaign", String(row.name), clientIp);
      return ok({ ok: true, data: copy }, 201);
    }
    if (method === "GET" && a) {
      const row = find("Campaign", (r) => r.id === a);
      return row ? ok({ ok: true, data: row, formFields: where("CampaignFormField", (f) => f.campaignId === a), postConfig: find("CampaignPostConfig", (f) => f.campaignId === a) ?? null }) : err("not_found", 404);
    }
    if (method === "POST") {
      const d = await body(req);
      if (!clean(d.name, 200)) return err("name_required");
      const kind = ["hostpost", "cpa", "gfeed"].includes(String(d.kind)) ? String(d.kind) : "cpa";
      const destUrl = clean(d.destUrl, 800);
      if ((kind === "cpa" || kind === "gfeed") && destUrl) {
        const guard = ssrfSafe(destUrl.replace(/\{[^}]+\}/g, "x"));
        if (!guard.ok) return err(`ssrf_blocked:${guard.reason}`, 422);
      }
      const row = insert("Campaign", {
        advertiserId: ctx.role === "advertiser" ? ctx.sub : clean(d.advertiserId, 60),
        name: clean(d.name, 200), kind, type: clean(d.type, 40) || "cpa",
        payoutModel: clean(d.payoutModel, 20) || "CPA", payout: Number(d.payout ?? 0),
        vertical: clean(d.vertical, 60) || "General", status: "draft",
        weight: Number(d.weight ?? 50), dailyCap: d.dailyCap ?? null, monthlyCap: d.monthlyCap ?? null,
        geo: Array.isArray(d.geo) ? d.geo : ["US"], devices: Array.isArray(d.devices) ? d.devices : ["desktop", "mobile"],
        destUrl, feedUrl: clean(d.feedUrl, 800),
        impressions: 0, clicks: 0, conversions: 0, revenue: 0, createdAt: Date.now(),
      });
      audit(ctx.sub, "created campaign", String(row.name), clientIp);
      return ok({ ok: true, data: row }, 201);
    }
    if ((method === "PUT" || method === "PATCH") && a) {
      const d = await body(req);
      const row = update("Campaign", a, {
        ...(d.name ? { name: clean(d.name, 200) } : {}),
        ...(d.status ? { status: d.status } : {}),
        ...(d.payout !== undefined ? { payout: Number(d.payout) } : {}),
        ...(d.weight !== undefined ? { weight: Number(d.weight) } : {}),
      });
      return row ? ok({ ok: true, data: row }) : err("not_found", 404);
    }
    if (method === "DELETE" && a) return remove("Campaign", a) ? ok({ ok: true }) : err("not_found", 404);
    return err("not_found", 404);
  }

  /* pops */
  if (group === "pops") {
    if (method === "GET" && !a) {
      const rows = ctx.role === "admin" ? table("Pop") : where("Pop", (r) => {
        const site = find("Site", (s) => s.id === r.siteId);
        return !site || site.publisherId === ctx.publisherId;
      });
      return ok({ ok: true, data: rows, total: rows.length });
    }
    if (method === "GET" && a && b === "preview-token") {
      const row = find("Pop", (r) => r.id === a);
      if (!row) return err("not_found", 404);
      const token = signToken({ popId: a, typ: "preview", jti: randomUUID() }, 1800);
      return ok({ ok: true, popId: a, token, expiresIn: 1800, url: `?revbounce_preview=${a}&t=${token}` });
    }
    if (method === "POST" && a && b === "publish") {
      const row = find("Pop", (r) => r.id === a);
      if (!row) return err("not_found", 404);
      const d = await body(req);
      const slots = where("PopCampaign", (r) => r.popId === a && r.enabled !== false);
      if (row.kind === "offer" && slots.length === 0) return err("no_active_campaign", 422);
      const version = Number(row.currentVersion ?? 0) + 1;
      insert("PopVersion", { popId: a, version, snapshot: { ...row }, note: clean(d.note, 200) || `v${version} publish`, publishedAt: Date.now(), publishedBy: ctx.sub });
      update("Pop", a, { currentVersion: version, status: "active" });
      audit(ctx.sub, "published pop version", `${row.name} v${version}`, clientIp);
      return ok({ ok: true, version, status: "active", ttlSeconds: 60 });
    }
    if (method === "POST" && a && b === "rollback") {
      const row = find("Pop", (r) => r.id === a);
      if (!row) return err("not_found", 404);
      const d = await body(req);
      const target = Number(d.version ?? 0);
      const snap = find("PopVersion", (v) => v.popId === a && v.version === target);
      if (!snap) return err("version_not_found", 404);
      const version = Number(row.currentVersion ?? 0) + 1;
      insert("PopVersion", { popId: a, version, snapshot: snap.snapshot, note: `rolled back to v${target}`, publishedAt: Date.now(), publishedBy: ctx.sub });
      update("Pop", a, { currentVersion: version });
      audit(ctx.sub, "rolled back pop", `${row.name} → v${target}`, clientIp);
      return ok({ ok: true, version, rolledBackTo: target });
    }
    if (method === "POST" && a && b === "duplicate") {
      const row = find("Pop", (r) => r.id === a);
      if (!row) return err("not_found", 404);
      const { id: _drop, ...rest } = row;
      void _drop;
      const copy = insert("Pop", { ...rest, name: `${row.name} (copy)`, status: "draft", currentVersion: 0, createdAt: Date.now() });
      return ok({ ok: true, data: copy }, 201);
    }
    if (method === "PATCH" && a && b === "status") {
      const d = await body(req);
      const status = String(d.status);
      if (!["active", "paused", "draft", "archived"].includes(status)) return err("invalid_status");
      const row = update("Pop", a, { status });
      if (!row) return err("not_found", 404);
      audit(ctx.sub, `set pop ${status}`, String(row.name), clientIp);
      return ok({ ok: true, data: row });
    }
    if (method === "GET" && a) {
      const row = find("Pop", (r) => r.id === a);
      return row ? ok({ ok: true, data: row, versions: where("PopVersion", (v) => v.popId === a), campaigns: where("PopCampaign", (v) => v.popId === a) }) : err("not_found", 404);
    }
    if (method === "POST") {
      const d = await body(req);
      const row = insert("Pop", {
        siteId: clean(d.siteId, 60) || (table("Site")[0]?.id ?? ""), name: clean(d.name, 160) || "Untitled pop",
        kind: d.kind === "email-capture" ? "email-capture" : "offer", template: clean(d.template, 40) || "velvet",
        status: "draft", currentVersion: 0, createdAt: Date.now(),
      });
      return ok({ ok: true, data: row }, 201);
    }
    if ((method === "PUT" || method === "PATCH") && a) {
      const d = await body(req);
      const row = update("Pop", a, { ...(d.name ? { name: clean(d.name, 160) } : {}), ...(d.template ? { template: d.template } : {}) });
      return row ? ok({ ok: true, data: row }) : err("not_found", 404);
    }
    if (method === "DELETE" && a) return remove("Pop", a) ? ok({ ok: true }) : err("not_found", 404);
    return err("not_found", 404);
  }

  /* email records */
  if (group === "email-records") {
    if (method === "GET" && a === "export.csv") {
      return csvResponse("email-records.csv", table("EmailRecord").map((r) => ({
        id: String(r.id), email: String(r.email), site: String(r.siteId), pop: String(r.popId),
        device: String(r.device), trigger: String(r.trigger), api: String(r.apiStatus),
        ftp: String(r.ftpStatus), created: new Date(Number(r.createdAt)).toISOString(),
      })));
    }
    if (method === "POST" && a && b === "retry") {
      const row = find("EmailRecord", (r) => r.id === a);
      if (!row) return err("not_found", 404);
      const attempt = where("EmailDelivery", (d) => d.emailRecordId === a).length + 1;
      const success = attempt >= 2;
      insert("EmailDelivery", { emailRecordId: a, channel: "api", attempt, status: success ? "success" : "failed", httpStatus: success ? 200 : 503, latencyMs: 160 + attempt * 40, responseMasked: { body: success ? "accepted" : "retry" }, createdAt: Date.now() });
      update("EmailRecord", a, { apiStatus: success ? "success" : "failed", lastError: success ? "" : "upstream 503" });
      audit(ctx.sub, "retried email delivery", String(row.email), clientIp);
      return ok({ ok: true, apiStatus: success ? "success" : "failed", attempt });
    }
    if (method === "GET") {
      const status = q.get("status");
      let rows = table("EmailRecord");
      if (status) rows = rows.filter((r) => r.apiStatus === status);
      return ok({ ok: true, data: rows.slice(0, Number(q.get("limit") ?? 50)), total: rows.length });
    }
    return err("not_found", 404);
  }

  if (group === "email-integrations") {
    if (method === "GET") return ok({ ok: true, data: where("EmailIntegration", scope).map((r) => ({ ...r, secretEnc: "••••", ftpSecretEnc: "••••" })) });
    if (method === "POST") {
      const d = await body(req);
      const endpoint = clean(d.endpoint, 500);
      if (endpoint) { const g = ssrfSafe(endpoint); if (!g.ok) return err(`ssrf_blocked:${g.reason}`, 422); }
      const row = insert("EmailIntegration", {
        publisherId: ctx.publisherId, provider: clean(d.provider, 60) || "mailchimp", endpoint,
        authType: clean(d.authType, 20) || "bearer",
        secretEnc: "aes-256-gcm:" + sha256(clean(d.secret, 200)).slice(0, 24),
        enabled: true, frequency: clean(d.frequency, 20) || "hourly", createdAt: Date.now(),
      });
      return ok({ ok: true, data: { ...row, secretEnc: "••••" } }, 201);
    }
    if ((method === "PUT" || method === "PATCH") && a) {
      const d = await body(req);
      const row = update("EmailIntegration", a, { ...(d.enabled !== undefined ? { enabled: !!d.enabled } : {}), ...(d.frequency ? { frequency: d.frequency } : {}) });
      return row ? ok({ ok: true, data: { ...row, secretEnc: "••••" } }) : err("not_found", 404);
    }
    if (method === "DELETE" && a) return remove("EmailIntegration", a) ? ok({ ok: true }) : err("not_found", 404);
    return err("not_found", 404);
  }

  /* reports */
  if (group === "reports") {
    const days = Math.min(90, Math.max(1, Number(q.get("days") ?? 30)));
    const s = series(days);
    const totals = s.reduce((acc, d) => ({
      impressions: acc.impressions + d.impressions, clicks: acc.clicks + d.clicks,
      conversions: acc.conversions + d.conversions, revenue: +(acc.revenue + d.revenue).toFixed(2),
    }), { impressions: 0, clicks: 0, conversions: 0, revenue: 0 });

    if (a === "overview") {
      return ok({
        ok: true, range: { days }, totals,
        ctr: +((totals.clicks / totals.impressions) * 100).toFixed(2),
        epc: +(totals.revenue / totals.clicks).toFixed(3),
        ecpm: +((totals.revenue / totals.impressions) * 1000).toFixed(2),
        fillRate: 94.3,
      });
    }
    if (a === "timeseries") return ok({ ok: true, granularity: q.get("granularity") ?? "daily", data: s });
    if (a === "by-dimension") {
      const dim = q.get("dimension") ?? "campaign";
      const buckets: Record<string, string[]> = {
        campaign: table("Campaign").filter((c) => c.status !== "library").map((c) => String(c.name)),
        site: table("Site").map((x) => String(x.name)),
        pop: table("Pop").map((x) => String(x.name)),
        device: ["Desktop", "Mobile", "Tablet"],
        country: ["US", "UK", "CA", "AU", "DE"],
        source: ["Direct", "Organic search", "Social", "Email", "Paid"],
        publisher: table("Publisher").map((x) => String(x.name)),
        date: s.map((d) => d.date),
      };
      const keys = (buckets[dim] ?? buckets.campaign).filter(Boolean);
      const denom = (keys.length * (keys.length + 1)) / 2 || 1;
      const data = keys.map((key, i) => {
        const share = (keys.length - i) / denom;
        const impressions = Math.round(totals.impressions * share);
        const yes = Math.round(totals.clicks * share);
        const revenue = +(totals.revenue * share).toFixed(2);
        return {
          key, impressions, unique: Math.round(impressions * 0.87), yes,
          no: Math.max(0, impressions - yes - Math.round(impressions * 0.8)),
          closes: Math.round(impressions * 0.8), conversions: Math.round(totals.conversions * share),
          submissionsAttempted: Math.round(totals.conversions * share * 1.14),
          submissionsSuccessful: Math.round(totals.conversions * share),
          linkouts: Math.round(yes * 0.63), revenue,
          ctr: +((yes / (impressions || 1)) * 100).toFixed(2),
          epc: +(revenue / (yes || 1)).toFixed(3),
          ecpm: +((revenue / (impressions || 1)) * 1000).toFixed(2),
        };
      });
      return ok({ ok: true, dimension: dim, data });
    }
    if (a === "funnel") {
      const imps = totals.impressions;
      const steps: { step: string; value: number }[] = [{ step: "impressions", value: imps }];
      let rem = imps;
      ["campaign_1", "campaign_2", "campaign_3"].forEach((c, i) => {
        steps.push({ step: `${c}_shown`, value: rem });
        const yes = Math.round(rem * (0.1 - i * 0.015));
        steps.push({ step: `${c}_yes`, value: yes });
        rem = Math.round((rem - yes) * 0.62);
      });
      steps.push({ step: "sequence_end", value: rem });
      return ok({ ok: true, popId: q.get("popId") ?? table("Pop")[0]?.id ?? "", steps });
    }
    if (a === "email") {
      const recs = table("EmailRecord");
      const n = (f: (r: Record<string, unknown>) => boolean) => recs.filter(f).length;
      return ok({
        ok: true, impressions: 18_220, uniqueImpressions: 15_902, closes: 15_884, formStarts: 3_120,
        submissions: recs.length, valid: n((r) => r.apiStatus === "success"),
        invalid: n((r) => r.apiStatus === "invalid"), duplicates: n((r) => r.apiStatus === "duplicate"),
        api: { attempts: where("EmailDelivery", (d) => d.channel === "api").length, success: where("EmailDelivery", (d) => d.channel === "api" && d.status === "success").length, failure: where("EmailDelivery", (d) => d.channel === "api" && d.status === "failed").length },
        ftp: { attempts: where("EmailDelivery", (d) => d.channel === "ftp").length, success: where("EmailDelivery", (d) => d.channel === "ftp" && d.status === "success").length, failure: where("EmailDelivery", (d) => d.channel === "ftp" && d.status === "failed").length },
      });
    }
    if (a === "export.csv") {
      return csvResponse("report.csv", s.map((d) => ({ date: d.date, impressions: d.impressions, clicks: d.clicks, conversions: d.conversions, revenue: d.revenue.toFixed(2) })));
    }
    return err("not_found", 404);
  }

  /* billing */
  if (group === "billing") {
    if (a === "plan" && method === "GET") {
      const sub = find("Subscription", (r) => r.publisherId === ctx.publisherId);
      const plan = find("Plan", (p) => p.id === (sub?.planId ?? "growth"));
      return ok({ ok: true, subscription: sub ?? null, plan: plan ?? null, plans: table("Plan") });
    }
    if (a === "plan" && (method === "PUT" || method === "PATCH")) {
      const d = await body(req);
      const planId = clean(d.planId, 40);
      const plan = find("Plan", (p) => p.id === planId);
      if (!plan) return err("plan_not_found", 404);
      const sub = find("Subscription", (r) => r.publisherId === ctx.publisherId);
      if (sub) update("Subscription", String(sub.id), { planId, status: "active" });
      else insert("Subscription", { publisherId: ctx.publisherId, planId, status: "active", cycleStart: "2026-01-01", cycleEnd: "2026-02-01", stripeId: "sub_mock_" + randomUUID().slice(0, 8) });
      audit(ctx.sub, "changed plan", planId, clientIp);
      return ok({ ok: true, planId, prorated: true, provider: "mock-stripe" });
    }
    if (a === "usage" && method === "GET") {
      const sub = find("Subscription", (r) => r.publisherId === ctx.publisherId);
      const plan = find("Plan", (p) => p.id === (sub?.planId ?? "growth"));
      const counter = find("UsageCounter", (r) => r.publisherId === ctx.publisherId) ?? { clicks: 38_402 };
      const clicks = Number(counter.clicks);
      const included = Number(plan?.includedClicks ?? 50_000);
      const { overageClicks, overageAmount } = computeOverage(clicks, included, Number(plan?.overageRate ?? 0.01));
      return ok({ ok: true, cycleStart: sub?.cycleStart ?? "2026-01-01", clicks, includedClicks: included, overageClicks, overageAmount, plan: plan?.name ?? "Growth" });
    }
    return err("not_found", 404);
  }

  if (group === "invoices") return ok({ ok: true, data: where("Invoice", (r) => ctx.role === "admin" || r.publisherId === ctx.publisherId) });

  /* payouts */
  if (group === "payouts") {
    if (method === "GET") return ok({ ok: true, data: ctx.role === "admin" ? table("Payout") : where("Payout", (r) => r.publisherId === ctx.publisherId) });
    if (method === "POST" && a && (b === "approve" || b === "paid")) {
      if (!requireRole(ctx, ["admin"])) return err("forbidden", 403);
      const row = find("Payout", (r) => r.id === a);
      if (!row) return err("not_found", 404);
      if (b === "approve" && row.status !== "pending") return err("invalid_transition", 409, { status: row.status });
      if (b === "paid" && row.status !== "approved") return err("invalid_transition", 409, { status: row.status });
      update("Payout", a, b === "approve" ? { status: "approved", approvedBy: ctx.sub } : { status: "paid", paidAt: Date.now() });
      audit(ctx.sub, b === "approve" ? "approved payout" : "marked payout paid", a, clientIp);
      return ok({ ok: true, status: b === "approve" ? "approved" : "paid" });
    }
    return err("not_found", 404);
  }

  /* admin */
  if (group === "admin") {
    if (!requireRole(ctx, ["admin"])) return err("forbidden", 403);
    if (a === "audit-log") return ok({ ok: true, data: table("AuditLog").slice(0, Number(q.get("limit") ?? 50)) });
    if (a === "feature-flags" && method === "GET") return ok({ ok: true, data: table("FeatureFlag") });
    if (a === "feature-flags" && (method === "PATCH" || method === "PUT")) {
      const d = await body(req);
      const row = find("FeatureFlag", (r) => r.key === clean(d.key, 60));
      if (!row) return err("not_found", 404);
      Object.assign(row, { ...(d.on !== undefined ? { on: !!d.on } : {}), ...(d.rollout !== undefined ? { rollout: Number(d.rollout) } : {}) });
      audit(ctx.sub, "updated feature flag", String(row.key), clientIp);
      return ok({ ok: true, data: row });
    }
    if (a === "advertisers") return ok({ ok: true, data: table("Advertiser") });
    if (a === "stats") {
      const s = series(30);
      return ok({
        ok: true, networkGross: +s.reduce((x, d) => x + d.revenue, 0).toFixed(2),
        publishers: table("Publisher").length, sites: table("Site").length,
        campaigns: table("Campaign").length, openFraudFlags: where("FraudFlag", (r) => r.status === "open").length,
      });
    }
    if (a === "fraud-flags" && method === "GET") return ok({ ok: true, data: table("FraudFlag") });
    if (a === "fraud-flags" && method === "POST") {
      const d = await body(req);
      const row = find("FraudFlag", (r) => r.id === clean(d.id, 60));
      if (!row) return err("not_found", 404);
      Object.assign(row, { status: clean(d.status, 20) || "cleared" });
      audit(ctx.sub, `fraud flag ${row.status}`, String(row.site), clientIp);
      return ok({ ok: true, data: row });
    }
    if (a === "optimize" && method === "POST") {
      const d = await body(req);
      const camps = table("Campaign").filter((c) => c.status === "active").map((c) => ({
        id: String(c.id), name: String(c.name), impressions: Number(c.impressions ?? 0),
        clicks: Number(c.clicks ?? 0), conversions: Number(c.conversions ?? 0),
        revenue: Number(c.revenue ?? 0), payout: Number(c.payout ?? 0),
        capped: !!c.capped, locked: !!c.locked, payoutFloor: Number(d.payoutFloor ?? 0),
      }));
      const result = optimize({ campaigns: camps, segment: { site: clean(d.site, 60) || "all", device: clean(d.device, 20) || "all", geo: clean(d.geo, 8) || "all" }, seed: Number(d.seed ?? 20260117) });
      audit(ctx.sub, "ran optimizer", `${result.arms.length} arms`, clientIp);
      return ok({ ok: true, ...result });
    }
    if (a === "optimizer-runs") return ok({ ok: true, data: optimizerRuns(10) });
    if (a === "accounts") return ok({ ok: true, data: accounts().map((x) => ({ id: x.id, email: x.email, role: x.role })) });
    return err("not_found", 404);
  }

  return err("not_found", 404);
}

export async function runApi(req: NextRequest, path: string[]): Promise<NextResponse> {
  try {
    return await apiRoute(req, path);
  } catch (e) {
    return err("internal_error", 500, { detail: (e as Error).message });
  }
}
