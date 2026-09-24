// §11 — edge-case + API test suite. Exercises the real HTTP surface so it
// can run from the dashboard, from a node script, or in CI.

export interface TestResult {
  id: string;
  group: string;
  name: string;
  pass: boolean;
  detail: string;
  ms: number;
}

type Ctx = { base: string; token: string; adminToken: string };

const j = async (r: Response) => { try { return await r.json(); } catch { return {}; } };

async function api(ctx: Ctx, path: string, init: RequestInit = {}, admin = false) {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init.headers as Record<string, string> ?? {}) };
  const tok = admin ? ctx.adminToken : ctx.token;
  if (tok) headers.Authorization = `Bearer ${tok}`;
  const res = await fetch(`${ctx.base}${path}`, { ...init, headers, cache: "no-store" });
  return { res, body: await j(res) as Record<string, unknown> };
}

interface Case { id: string; group: string; name: string; run: (ctx: Ctx) => Promise<[boolean, string]>; }

const CASES: Case[] = [
  /* ── auth & API (§8) ── */
  {
    id: "auth-login", group: "API · Auth", name: "Login issues access + refresh tokens",
    run: async (ctx) => {
      const { body } = await api(ctx, "/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email: "publisher@revbounce.com", password: "demo1234" }) });
      const okk = !!body.accessToken && !!body.refreshToken;
      if (okk) ctx.token = String(body.accessToken);
      return [okk, okk ? "access + refresh issued" : JSON.stringify(body).slice(0, 120)];
    },
  },
  {
    id: "auth-admin", group: "API · Auth", name: "Admin login + role claim",
    run: async (ctx) => {
      const { body } = await api(ctx, "/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email: "admin@revbounce.com", password: "demo1234" }) });
      const u = body.user as { role?: string } | undefined;
      if (body.accessToken) ctx.adminToken = String(body.accessToken);
      return [u?.role === "admin", `role=${u?.role}`];
    },
  },
  {
    id: "auth-bad", group: "API · Auth", name: "Bad password rejected 401",
    run: async (ctx) => {
      const { res } = await api(ctx, "/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email: "publisher@revbounce.com", password: "wrong" }) });
      return [res.status === 401, `status=${res.status}`];
    },
  },
  {
    id: "auth-guard", group: "API · Auth", name: "Unauthenticated request rejected 401",
    run: async (ctx) => {
      const res = await fetch(`${ctx.base}/api/v1/pops`, { cache: "no-store" });
      return [res.status === 401, `status=${res.status}`];
    },
  },
  {
    id: "auth-rbac", group: "API · Auth", name: "Publisher blocked from admin routes (403)",
    run: async (ctx) => {
      const { res } = await api(ctx, "/api/v1/admin/stats");
      return [res.status === 403, `status=${res.status}`];
    },
  },
  {
    id: "auth-refresh", group: "API · Auth", name: "Refresh token mints a new access token",
    run: async (ctx) => {
      const { body: login } = await api(ctx, "/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email: "publisher@revbounce.com", password: "demo1234" }) });
      const { body } = await api(ctx, "/api/v1/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: login.refreshToken }) });
      return [!!body.accessToken, body.accessToken ? "new access token" : "no token"];
    },
  },
  {
    id: "auth-me", group: "API · Auth", name: "GET /me returns the session user",
    run: async (ctx) => {
      const { body } = await api(ctx, "/api/v1/me");
      const u = body.user as { email?: string } | undefined;
      return [u?.email === "publisher@revbounce.com", `user=${u?.email}`];
    },
  },

  /* ── CRUD (§8) ── */
  {
    id: "crud-site", group: "API · CRUD", name: "Create → verify → snippet → delete a site",
    run: async (ctx) => {
      const { body: made } = await api(ctx, "/api/v1/sites", { method: "POST", body: JSON.stringify({ name: "Test Site", domain: "https://test.example/x" }) });
      const site = made.data as { id: string; domain: string } | undefined;
      if (!site?.id) return [false, "create failed"];
      const { body: ver } = await api(ctx, `/api/v1/sites/${site.id}/verify`, { method: "POST" });
      const { body: snip } = await api(ctx, `/api/v1/sites/${site.id}/snippet`);
      const { res: del } = await api(ctx, `/api/v1/sites/${site.id}`, { method: "DELETE" });
      const good = site.domain === "test.example" && ver.verified === true && String(snip.snippet).includes("data-site") && del.status === 200;
      return [good, `domain=${site.domain} verified=${ver.verified} snippet=${String(snip.snippet).includes("embed.js")}`];
    },
  },
  {
    id: "crud-pop-publish", group: "API · CRUD", name: "Pop publish creates an immutable version",
    run: async (ctx) => {
      const { body } = await api(ctx, "/api/v1/pops/p2/publish", { method: "POST", body: JSON.stringify({ note: "test publish" }) });
      return [body.ok === true && Number(body.version) >= 3 && body.ttlSeconds === 60, `v=${body.version} ttl=${body.ttlSeconds}`];
    },
  },
  {
    id: "crud-pop-rollback", group: "API · CRUD", name: "Pop rollback publishes a new version",
    run: async (ctx) => {
      const { body } = await api(ctx, "/api/v1/pops/p1/rollback", { method: "POST", body: JSON.stringify({ version: 2 }) });
      return [body.ok === true && body.rolledBackTo === 2, `new v=${body.version} from v=${body.rolledBackTo}`];
    },
  },
  {
    id: "crud-pop-status", group: "API · CRUD", name: "PATCH pop status validates the enum",
    run: async (ctx) => {
      const { res: bad } = await api(ctx, "/api/v1/pops/p1/status", { method: "PATCH", body: JSON.stringify({ status: "banana" }) });
      const { body: good } = await api(ctx, "/api/v1/pops/p1/status", { method: "PATCH", body: JSON.stringify({ status: "paused" }) });
      return [bad.status === 400 && good.ok === true, `invalid=${bad.status} valid=${good.ok}`];
    },
  },
  {
    id: "crud-preview", group: "API · CRUD", name: "Preview token is signed and short-lived",
    run: async (ctx) => {
      const { body } = await api(ctx, "/api/v1/pops/p1/preview-token");
      return [String(body.token).split(".").length === 3 && body.expiresIn === 1800, `ttl=${body.expiresIn}`];
    },
  },
  {
    id: "crud-library", group: "API · CRUD", name: "Campaign library returns only library rows",
    run: async (ctx) => {
      const { body } = await api(ctx, "/api/v1/campaigns/library");
      const rows = (body.data as { status: string }[]) ?? [];
      return [rows.length > 0 && rows.every((r) => r.status === "library"), `${rows.length} library campaigns`];
    },
  },
  {
    id: "crud-testpost", group: "API · CRUD", name: "Campaign test-post masks secrets in the log",
    run: async (ctx) => {
      const { body } = await api(ctx, "/api/v1/campaigns/c1/test-post", { method: "POST", body: JSON.stringify({}) });
      const req = body.request as { payload: Record<string, string> };
      const masked = Object.values(req?.payload ?? {}).some((v) => String(v).includes("••••"));
      return [body.ok === true && masked, masked ? "secrets masked" : "NOT masked"];
    },
  },

  /* ── security (§8) ── */
  {
    id: "sec-ssrf", group: "Security", name: "SSRF guard blocks private ranges",
    run: async (ctx) => {
      const blocked: string[] = [];
      for (const u of ["http://127.0.0.1:8080/hook", "http://10.0.0.5/x", "http://169.254.169.254/latest/meta-data", "http://192.168.1.4/post"]) {
        const { res } = await api(ctx, "/api/v1/campaigns/c1/test-post", { method: "POST", body: JSON.stringify({ endpoint: u }) });
        if (res.status === 422) blocked.push(u);
      }
      return [blocked.length === 4, `${blocked.length}/4 blocked`];
    },
  },
  {
    id: "sec-ssrf-allow", group: "Security", name: "SSRF guard allows public endpoints",
    run: async (ctx) => {
      const { res } = await api(ctx, "/api/v1/campaigns/c1/test-post", { method: "POST", body: JSON.stringify({ endpoint: "https://leads.partner.example/intake" }) });
      return [res.status === 200, `status=${res.status}`];
    },
  },
  {
    id: "sec-token", group: "Security", name: "Tampered JWT signature rejected",
    run: async (ctx) => {
      const bad = ctx.token.slice(0, -3) + "aaa";
      const res = await fetch(`${ctx.base}/api/v1/me`, { headers: { Authorization: `Bearer ${bad}` }, cache: "no-store" });
      return [res.status === 401, `status=${res.status}`];
    },
  },
  {
    id: "sec-hmac", group: "Security", name: "Config issues an HMAC session token; events verify it",
    run: async (ctx) => {
      const cfg = await (await fetch(`${ctx.base}/api/public/config/rb_tgp_9f27c1`, { cache: "no-store" })).json();
      const signedRes = await fetch(`${ctx.base}/api/public/events`, {
        method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 Chrome/131" },
        body: JSON.stringify({ site: "rb_tgp_9f27c1", token: cfg.sessionToken, events: [{ id: `sig-${Date.now()}`, type: "pop_impression" }] }),
      });
      const signed = await signedRes.json();
      const spoofRes = await fetch(`${ctx.base}/api/public/events`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: "rb_tgp_9f27c1", token: "forged.token.value", events: [{ id: `spoof-${Date.now()}`, type: "pop_impression" }] }),
      });
      const spoof = await spoofRes.json();
      return [signed.signed === true && spoof.signed === false, `signed=${signed.signed} spoofed=${spoof.signed}`];
    },
  },
  {
    id: "sec-sanitize", group: "Security", name: "Input sanitization strips control chars",
    run: async (ctx) => {
      const { body } = await api(ctx, "/api/v1/campaigns", { method: "POST", body: JSON.stringify({ name: "Evil\u0000\u001bName", kind: "cpa" }) });
      const row = body.data as { name: string } | undefined;
      return [!!row && !/[\u0000-\u001f]/.test(row.name), `name=${JSON.stringify(row?.name)}`];
    },
  },

  /* ── §11 embed edge cases ── */
  {
    id: "edge-invalid-email", group: "Edge · Email", name: "Invalid email rejected with a friendly message",
    run: async (ctx) => {
      const r = await fetch(`${ctx.base}/api/public/email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ site: "rb_tgp_9f27c1", pop: "p4", email: "not-an-email" }) });
      const b = await j(r);
      return [r.status === 400 && b.code === "invalid_format", `code=${b.code}`];
    },
  },
  {
    id: "edge-duplicate-email", group: "Edge · Email", name: "Duplicate email returns the configured message (no error)",
    run: async (ctx) => {
      const email = `dup${Date.now()}@example.com`;
      await fetch(`${ctx.base}/api/public/email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ site: "rb_tgp_9f27c1", pop: "p4", email }) });
      const r = await fetch(`${ctx.base}/api/public/email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ site: "rb_tgp_9f27c1", pop: "p4", email }) });
      const b = await j(r);
      return [r.ok && b.duplicate === true && typeof b.message === "string", `duplicate=${b.duplicate}`];
    },
  },
  {
    id: "edge-email-api-fail", group: "Edge · Email", name: "Email stored even when API delivery fails",
    run: async (ctx) => {
      const r = await fetch(`${ctx.base}/api/public/email`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: "rb_tgp_9f27c1", pop: "p4", email: `fail${Date.now()}@example.com`, config: { endpoint: "https://api.partner.example/fail", maxRetries: 2, duplicateRule: "allow" } }),
      });
      const b = await j(r) as { ok: boolean; leadId?: string; delivery?: { api: { status: string; attempts: unknown[] } } };
      return [b.ok === true && !!b.leadId && b.delivery?.api.status === "failed", `stored=${!!b.leadId} api=${b.delivery?.api.status} attempts=${b.delivery?.api.attempts.length}`];
    },
  },
  {
    id: "edge-email-ftp", group: "Edge · Email", name: "Email stored when FTP is queued/disabled",
    run: async (ctx) => {
      const r = await fetch(`${ctx.base}/api/public/email`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: "rb_tgp_9f27c1", pop: "p4", email: `ftp${Date.now()}@example.com`, config: { ftpEnabled: false, duplicateRule: "allow" } }),
      });
      const b = await j(r) as { ok: boolean; delivery?: { ftp: { status: string } } };
      return [b.ok === true && b.delivery?.ftp.status === "skipped", `ftp=${b.delivery?.ftp.status}`];
    },
  },
  {
    id: "edge-email-retry", group: "Edge · Email", name: "Failed delivery is retryable from the dashboard",
    run: async (ctx) => {
      const { body } = await api(ctx, "/api/v1/email-records?limit=50");
      const rows = (body.data as { id: string; apiStatus: string }[]) ?? [];
      const target = rows.find((r) => r.apiStatus === "failed") ?? rows[0];
      if (!target) return [false, "no records"];
      const { body: retry } = await api(ctx, `/api/v1/email-records/${target.id}/retry`, { method: "POST" });
      return [retry.ok === true, `attempt=${retry.attempt} status=${retry.apiStatus}`];
    },
  },
  {
    id: "edge-hostpost-fail", group: "Edge · Sequence", name: "Host & Post failure returns an error (form stays open)",
    run: async (ctx) => {
      const r = await fetch(`${ctx.base}/api/public/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ site: "rb_tgp_9f27c1", pop: "p1", email: "bad" }) });
      const b = await j(r);
      return [r.status === 400 && b.ok === false && typeof b.error === "string", `status=${r.status} error=${b.error}`];
    },
  },
  {
    id: "edge-campaign-disabled", group: "Edge · Sequence", name: "Campaign disabled after publish → server says skip",
    run: async (ctx) => {
      const r = await fetch(`${ctx.base}/api/public/click`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ site: "rb_tgp_9f27c1", pop: "p1", campaign: "c5" }) });
      const b = await j(r);
      return [b.skipped === true, `skipped=${b.skipped} reason=${b.reason}`];
    },
  },
  {
    id: "edge-invalid-url", group: "Edge · Sequence", name: "Invalid campaign URL is skipped and logged",
    run: async (ctx) => {
      const r = await fetch(`${ctx.base}/api/public/click/c9?u=javascript:alert(1)&site=rb_tgp_9f27c1`, { redirect: "manual", cache: "no-store" });
      const b = await j(r);
      return [r.status === 422 && b.error === "invalid_destination", `status=${r.status} error=${b.error}`];
    },
  },
  {
    id: "edge-click-redirect", group: "Edge · Sequence", name: "Click tracker 302s with a server click_id",
    run: async (ctx) => {
      const r = await fetch(`${ctx.base}/api/public/click/c2?u=${encodeURIComponent("https://example.com/lp?cid={click_id}")}&site=rb_tgp_9f27c1&pop=p1&vid=v-${Date.now()}`, { redirect: "manual", cache: "no-store" });
      const loc = r.headers.get("location") ?? "";
      return [(r.status === 302 || r.status === 307) && /cid=cl_/.test(loc), `status=${r.status} loc=${loc.slice(0, 70)}`];
    },
  },
  {
    id: "edge-config-fewer", group: "Edge · Sequence", name: "Pop with zero eligible campaigns never fires",
    run: async (ctx) => {
      const cfg = await (await fetch(`${ctx.base}/api/public/config/rb_tgp_9f27c1`, { cache: "no-store" })).json();
      const pops = cfg.pops as { kind: string; campaigns: unknown[] }[];
      const emailPop = pops.find((p) => p.kind === "email-capture");
      const offer = pops.find((p) => p.kind === "offer");
      return [!!emailPop && emailPop.campaigns.length === 0 && !!offer && offer.campaigns.length <= 5, `offer slots=${offer?.campaigns.length} email slots=${emailPop?.campaigns.length}`];
    },
  },
  {
    id: "edge-allowlist", group: "Edge · Embed", name: "Config ships a domain allow-list for the embed",
    run: async (ctx) => {
      const cfg = await (await fetch(`${ctx.base}/api/public/config/rb_tgp_9f27c1`, { cache: "no-store" })).json();
      return [Array.isArray(cfg.domains) && cfg.domains.length > 0, `domains=${(cfg.domains ?? []).join(",")}`];
    },
  },
  {
    id: "edge-unknown-site", group: "Edge · Embed", name: "Unknown site key returns an empty, harmless config",
    run: async (ctx) => {
      const r = await fetch(`${ctx.base}/api/public/config/rb_does_not_exist`, { cache: "no-store" });
      const b = await j(r) as { ok: boolean; pops: unknown[] };
      return [r.status === 200 && Array.isArray(b.pops) && b.pops.length === 0, `status=${r.status} pops=${b.pops?.length}`];
    },
  },
  {
    id: "edge-embed-shadow", group: "Edge · Embed", name: "Engine uses Shadow DOM + never blocks the page",
    run: async (ctx) => {
      const js = await (await fetch(`${ctx.base}/embed.js`, { cache: "no-store" })).text();
      const checks = ["attachShadow", "requestIdleCallback", "passive", "try {", "window.RevBounce"];
      const missing = checks.filter((c) => !js.includes(c));
      return [missing.length === 0, missing.length ? `missing ${missing.join(",")}` : `all guards present · ${(js.length / 1024).toFixed(1)}KB`];
    },
  },
  {
    id: "edge-embed-api", group: "Edge · Embed", name: "Public JS API exposes show/hide/reset/debug",
    run: async (ctx) => {
      const js = await (await fetch(`${ctx.base}/embed.js`, { cache: "no-store" })).text();
      const missing = ["show:", "hide:", "reset:", "debug:"].filter((c) => !js.includes(c));
      return [missing.length === 0, missing.length ? `missing ${missing.join(",")}` : "show/hide/reset/debug present"];
    },
  },
  {
    id: "edge-multitab", group: "Edge · Embed", name: "Multi-tab lock + refresh resume implemented",
    run: async (ctx) => {
      const js = await (await fetch(`${ctx.base}/embed.js`, { cache: "no-store" })).text();
      const has = js.includes("BroadcastChannel") && js.includes("lockHeldElsewhere") && js.includes("resuming sequence");
      return [has, has ? "BroadcastChannel lock + sessionStorage resume" : "missing"];
    },
  },
  {
    id: "edge-mobile-fallback", group: "Edge · Embed", name: "Mobile back-button unsupported → idle fallback",
    run: async (ctx) => {
      const js = await (await fetch(`${ctx.base}/embed.js`, { cache: "no-store" })).text();
      const has = js.includes("FBAN|FBAV|Instagram") && js.includes("armIdle(pop, fire)");
      return [has, has ? "in-app browsers fall back to idle" : "missing"];
    },
  },
  {
    id: "edge-server-down", group: "Edge · Embed", name: "Broken event payload never surfaces an error",
    run: async (ctx) => {
      const r = await fetch(`${ctx.base}/api/public/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{{{not json" });
      return [r.status === 200, `status=${r.status} (silent)`];
    },
  },
  {
    id: "edge-ratelimit", group: "Edge · Embed", name: "Public endpoints are rate limited",
    run: async (ctx) => {
      let limited = false;
      for (let i = 0; i < 45; i++) {
        const r = await fetch(`${ctx.base}/api/public/email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ site: "rb_tgp_9f27c1", email: `rl${i}@x.com` }) });
        if (r.status === 429) { limited = true; break; }
      }
      return [limited, limited ? "429 after burst" : "no limit hit (window may have reset)"];
    },
  },

  /* ── §7.6 events ── */
  {
    id: "evt-idempotent", group: "Events", name: "Duplicate event ids are deduped",
    run: async (ctx) => {
      const id = `idem-${Date.now()}`;
      const send = () => fetch(`${ctx.base}/api/public/events`, {
        method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 Chrome/131" },
        body: JSON.stringify({ site: "rb_tgp_9f27c1", events: [{ id, type: "yes_click", campaignId: "c1" }] }),
      }).then(j) as Promise<{ accepted: number; duplicates: number }>;
      const a = await send(); const b = await send();
      return [a.accepted === 1 && b.duplicates === 1, `first accepted=${a.accepted} second duplicates=${b.duplicates}`];
    },
  },
  {
    id: "evt-bot", group: "Events", name: "Bot user-agents are filtered",
    run: async (ctx) => {
      const r = await fetch(`${ctx.base}/api/public/events`, {
        method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "Googlebot/2.1" },
        body: JSON.stringify({ site: "rb_tgp_9f27c1", events: [{ id: `bot-${Date.now()}`, type: "yes_click" }] }),
      });
      const b = await j(r) as { accepted: number; filtered: number };
      return [b.accepted === 0 && b.filtered >= 1, `accepted=${b.accepted} filtered=${b.filtered}`];
    },
  },
  {
    id: "evt-geo", group: "Events", name: "Events are geo-enriched (country/region, no raw IP)",
    run: async (ctx) => {
      const r = await fetch(`${ctx.base}/api/public/events`, {
        method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 Chrome/131" },
        body: JSON.stringify({ site: "rb_tgp_9f27c1", events: [{ id: `geo-${Date.now()}`, type: "pop_impression" }] }),
      });
      const b = await j(r) as { geo: { country: string } };
      const list = await (await fetch(`${ctx.base}/api/public/events?site=rb_tgp_9f27c1`, { cache: "no-store" })).json();
      const ev = (list.events as Record<string, unknown>[])[0] ?? {};
      return [!!b.geo?.country && !("ip" in ev), `country=${b.geo?.country} rawIpStored=${"ip" in ev}`];
    },
  },

  /* ── §10 revenue, billing, optimizer, fraud ── */
  {
    id: "rev-postback", group: "Revenue", name: "Postback creates a conversion and splits revenue 70/30",
    run: async (ctx) => {
      const clickRes = await fetch(`${ctx.base}/api/public/click/c2?site=site_1&pop=p1&vid=v-${Date.now()}`, { cache: "no-store" });
      const click = await j(clickRes) as { clickId: string };
      const r = await fetch(`${ctx.base}/api/postback/everflow`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transaction_id: click.clickId, amount: 38, status: "approved" }) });
      const b = await j(r) as { ok: boolean; revenue?: { publisherShare: number; platformShare: number } };
      const good = b.ok && b.revenue?.publisherShare === 26.6 && b.revenue?.platformShare === 11.4;
      return [good, `pub=${b.revenue?.publisherShare} platform=${b.revenue?.platformShare}`];
    },
  },
  {
    id: "rev-idempotent", group: "Revenue", name: "Repeat postback for the same click is idempotent",
    run: async (ctx) => {
      const clickRes = await fetch(`${ctx.base}/api/public/click/c2?site=site_1&pop=p1&vid=v2-${Date.now()}`, { cache: "no-store" });
      const click = await j(clickRes) as { clickId: string };
      const send = () => fetch(`${ctx.base}/api/postback/twyne`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cid: click.clickId, amount: 12 }) }).then(j) as Promise<{ duplicate?: boolean }>;
      await send();
      const second = await send();
      return [second.duplicate === true, `duplicate=${second.duplicate}`];
    },
  },
  {
    id: "rev-invalid-payout", group: "Revenue", name: "Postback rejects a malformed payout",
    run: async (ctx) => {
      const r = await fetch(`${ctx.base}/api/postback/generic`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ click_id: "cl_x", amount: "-5" }) });
      return [r.status === 400, `status=${r.status}`];
    },
  },
  {
    id: "fraud-dupe-click", group: "Fraud", name: "Duplicate click within 30s is flagged invalid",
    run: async (ctx) => {
      const vid = `dupclick-${Date.now()}`;
      await fetch(`${ctx.base}/api/public/click/c4?site=site_1&pop=p1&vid=${vid}`, { cache: "no-store" });
      const r = await fetch(`${ctx.base}/api/public/click/c4?site=site_1&pop=p1&vid=${vid}`, { cache: "no-store" });
      const b = await j(r) as { invalid: string[] };
      return [(b.invalid ?? []).includes("duplicate_30s"), `flags=${(b.invalid ?? []).join("|") || "none"}`];
    },
  },
  {
    id: "billing-usage", group: "Billing", name: "Usage meter reports clicks, included and overage",
    run: async (ctx) => {
      const { body } = await api(ctx, "/api/v1/billing/usage");
      return [typeof body.clicks === "number" && typeof body.overageAmount === "number", `clicks=${body.clicks} included=${body.includedClicks} overage=$${body.overageAmount}`];
    },
  },
  {
    id: "billing-plan", group: "Billing", name: "Plan change is prorated via the mock provider",
    run: async (ctx) => {
      const { body } = await api(ctx, "/api/v1/billing/plan", { method: "PUT", body: JSON.stringify({ planId: "enterprise" }) });
      const restore = await api(ctx, "/api/v1/billing/plan", { method: "PUT", body: JSON.stringify({ planId: "growth" }) });
      return [body.ok === true && body.prorated === true && restore.body.ok === true, `provider=${body.provider}`];
    },
  },
  {
    id: "payout-flow", group: "Billing", name: "Payout approve → paid enforces state transitions",
    run: async (ctx) => {
      const badOrder = await api(ctx, "/api/v1/payouts/pp_2601b/paid", { method: "POST" }, true);
      const approve = await api(ctx, "/api/v1/payouts/pp_2601b/approve", { method: "POST" }, true);
      const paid = await api(ctx, "/api/v1/payouts/pp_2601b/paid", { method: "POST" }, true);
      return [badOrder.res.status === 409 && approve.body.ok === true && paid.body.ok === true, `outOfOrder=${badOrder.res.status} approve=${approve.body.status} paid=${paid.body.status}`];
    },
  },
  {
    id: "opt-bandit", group: "Optimizer", name: "Thompson sampling allocates weights summing ~100%",
    run: async (ctx) => {
      const { body } = await api(ctx, "/api/v1/admin/optimize", { method: "POST", body: JSON.stringify({ site: "site_1", device: "desktop", geo: "US", seed: 42 }) }, true);
      const arms = (body.arms as { weight: number; campaignId: string; reason: string }[]) ?? [];
      const total = arms.reduce((a, x) => a + x.weight, 0);
      return [arms.length > 0 && Math.abs(total - 100) <= 2, `${arms.length} arms · total=${total}%`];
    },
  },
  {
    id: "opt-cap", group: "Optimizer", name: "Capped campaign gets zero weight and a reason",
    run: async (ctx) => {
      const { body } = await api(ctx, "/api/v1/admin/optimize", { method: "POST", body: JSON.stringify({ seed: 7 }) }, true);
      const arms = (body.arms as { campaignId: string; weight: number; reason: string }[]) ?? [];
      const capped = arms.find((x) => x.campaignId === "c5");
      return [!!capped && capped.weight === 0 && capped.reason.includes("cap"), `c5 weight=${capped?.weight} · ${capped?.reason}`];
    },
  },
  {
    id: "opt-audit", group: "Optimizer", name: "Optimizer decisions are written to an audit view",
    run: async (ctx) => {
      const { body } = await api(ctx, "/api/v1/admin/optimizer-runs", {}, true);
      const runs = (body.data as { decisions: string[] }[]) ?? [];
      return [runs.length > 0 && runs[0].decisions.length > 0, `${runs.length} runs · ${runs[0]?.decisions.length ?? 0} decisions logged`];
    },
  },

  /* ── §9 schema + reports ── */
  {
    id: "schema-models", group: "Schema", name: "All 31 spec models are present with indexes",
    run: async (ctx) => {
      const { body } = await api(ctx, "/api/v1/meta/schema");
      const models = (body.models as { name: string; indexes: string[] }[]) ?? [];
      const required = ["User", "Publisher", "Site", "Advertiser", "Campaign", "CampaignFormField", "CampaignPostConfig", "Pop", "PopVersion", "PopCampaign", "EmailIntegration", "EmailRecord", "EmailDelivery", "Visitor", "Session", "Event", "ClickLog", "Conversion", "Submission", "DailyStat", "Plan", "Subscription", "UsageCounter", "Invoice", "Payout", "PayoutMethod", "ApiKey", "AuditLog", "FeatureFlag", "Webhook", "WebhookDelivery"];
      const missing = required.filter((m) => !models.some((x) => x.name === m));
      const ev = models.find((m) => m.name === "Event");
      const hasIdx = !!ev && ev.indexes.some((i) => i.includes("unique(event_id)"));
      return [missing.length === 0 && hasIdx, missing.length ? `missing: ${missing.join(",")}` : `${models.length} models · Event unique(event_id) ✓`];
    },
  },
  {
    id: "schema-seed", group: "Schema", name: "Seed populates every core table",
    run: async (ctx) => {
      const { body } = await api(ctx, "/api/v1/meta/schema");
      const counts = body.counts as Record<string, number>;
      const empties = ["Publisher", "Site", "Campaign", "Pop", "PopVersion", "Plan", "Payout", "EmailRecord"].filter((k) => !counts[k]);
      return [empties.length === 0, empties.length ? `empty: ${empties.join(",")}` : `seeded ${Object.values(counts).reduce((a, b) => a + b, 0)} rows`];
    },
  },
  {
    id: "report-dims", group: "Reports", name: "by-dimension supports every spec dimension",
    run: async (ctx) => {
      const dims = ["campaign", "site", "pop", "device", "country", "source", "publisher", "date"];
      const results = await Promise.all(dims.map(async (d) => {
        const { body } = await api(ctx, `/api/v1/reports/by-dimension?dimension=${d}&days=7`);
        return Array.isArray(body.data) && (body.data as unknown[]).length > 0;
      }));
      return [results.every(Boolean), `${results.filter(Boolean).length}/${dims.length} dimensions return rows`];
    },
  },
  {
    id: "report-csv", group: "Reports", name: "CSV export returns a downloadable file",
    run: async (ctx) => {
      const res = await fetch(`${ctx.base}/api/v1/reports/export.csv?days=7`, { headers: { Authorization: `Bearer ${ctx.token}` }, cache: "no-store" });
      const text = await res.text();
      return [res.headers.get("content-type")?.includes("text/csv") === true && text.split("\n").length > 2, `${text.split("\n").length - 1} rows`];
    },
  },
  {
    id: "report-funnel", group: "Reports", name: "Funnel returns the full sequence chain",
    run: async (ctx) => {
      const { body } = await api(ctx, "/api/v1/reports/funnel");
      const steps = (body.steps as { step: string }[]) ?? [];
      return [steps.length >= 8 && steps[0].step === "impressions" && steps[steps.length - 1].step === "sequence_end", `${steps.length} steps`];
    },
  },
];

export async function runEdgeTests(base: string, onProgress?: (r: TestResult) => void): Promise<TestResult[]> {
  const ctx: Ctx = { base, token: "", adminToken: "" };
  const out: TestResult[] = [];
  for (const c of CASES) {
    const t0 = Date.now();
    let pass = false, detail = "";
    try {
      const [p, d] = await c.run(ctx);
      pass = p; detail = d;
    } catch (e) {
      pass = false; detail = `threw: ${(e as Error).message}`;
    }
    const r: TestResult = { id: c.id, group: c.group, name: c.name, pass, detail, ms: Date.now() - t0 };
    out.push(r);
    onProgress?.(r);
  }
  return out;
}

export const TEST_COUNT = CASES.length;
export const TEST_GROUPS = [...new Set(CASES.map((c) => c.group))];
