// ─────────────────────────────────────────────────────────────
// §8/§9/§10 — API core. The §9 Prisma schema is modelled here as
// an in-memory registry (explicit requirement: NO DATABASE).
// Every model, index and relation from the spec is represented;
// `MODELS` documents the shape that a Prisma migration would create.
// ─────────────────────────────────────────────────────────────
import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";

/* ══════════ §9 schema description (drives the docs page + seed) ══════════ */
export interface ModelDef {
  name: string;
  fields: string[];
  indexes: string[];
  note?: string;
}

export const MODELS: ModelDef[] = [
  { name: "User", fields: ["id", "email @unique", "passwordHash", "name", "role", "publisherId?", "twoFactor", "createdAt"], indexes: ["email"] },
  { name: "Publisher", fields: ["id", "name", "company", "model", "split", "status", "terms", "notes", "createdAt"], indexes: ["status"] },
  { name: "Site", fields: ["id", "publisherId", "name", "domain", "siteKey @unique", "allowedDomains[]", "verified", "verifyMethod", "createdAt"], indexes: ["publisherId", "siteKey"] },
  { name: "Advertiser", fields: ["id", "name", "contact", "status", "createdAt"], indexes: ["status"] },
  { name: "Campaign", fields: ["id", "advertiserId", "name", "kind", "type", "payoutModel", "payout", "vertical", "status", "weight", "dailyCap", "monthlyCap", "geo[]", "devices[]", "trafficSource", "startAt", "endAt", "allowedPopTypes[]", "destUrl", "feedUrl", "createdAt"], indexes: ["advertiserId, createdAt", "status"] },
  { name: "CampaignFormField", fields: ["id", "campaignId", "type", "label", "required", "pattern", "options", "order", "prefillAllowed"], indexes: ["campaignId"] },
  { name: "CampaignPostConfig", fields: ["id", "campaignId @unique", "endpoint", "method", "headers", "authType", "authValueEnc", "bodyFormat", "mapping", "staticParams", "successStatus", "successContains", "duplicateRule", "timeoutMs", "retries"], indexes: ["campaignId"], note: "authValueEnc = AES-256-GCM at rest" },
  { name: "Pop", fields: ["id", "siteId", "name", "kind", "template", "status", "currentVersion", "design", "rules", "targeting", "frequency", "integrations", "createdAt"], indexes: ["siteId, createdAt", "status"] },
  { name: "PopVersion", fields: ["id", "popId", "version", "snapshot", "note", "publishedAt", "publishedBy"], indexes: ["popId, version @unique"] },
  { name: "PopCampaign", fields: ["id", "popId", "campaignId", "slot", "order", "enabled"], indexes: ["popId, slot @unique", "campaignId"] },
  { name: "EmailIntegration", fields: ["id", "publisherId", "provider", "endpoint", "authType", "secretEnc", "mapping", "ftpHost", "ftpPort", "ftpUserEnc", "ftpSecretEnc", "remotePath", "filenamePattern", "frequency", "enabled"], indexes: ["publisherId"] },
  { name: "EmailRecord", fields: ["id", "siteId", "publisherId", "popId", "email", "emailHash", "device", "trigger", "pageUrl", "consent", "apiStatus", "ftpStatus", "lastError", "createdAt"], indexes: ["siteId, createdAt", "popId, createdAt", "emailHash"] },
  { name: "EmailDelivery", fields: ["id", "emailRecordId", "channel", "attempt", "status", "httpStatus", "latencyMs", "responseMasked", "createdAt"], indexes: ["emailRecordId"] },
  { name: "Visitor", fields: ["id", "siteId", "anonId @unique", "firstSeen", "lastSeen", "consent"], indexes: ["siteId, firstSeen", "anonId"] },
  { name: "Session", fields: ["id", "visitorId", "siteId", "startedAt", "lastEventAt", "userAgentHash", "country", "region"], indexes: ["visitorId", "siteId, startedAt"] },
  { name: "Event", fields: ["id", "eventId @unique", "siteId", "popId", "popVersion", "campaignId", "sessionId", "visitorId", "type", "deviceType", "triggerType", "country", "region", "pageUrl", "referrer", "utm", "clickId", "bot", "tsClient", "tsServer"], indexes: ["site_id, created_at", "pop_id, created_at", "campaign_id, created_at", "unique(event_id)"], note: "PARTITION BY RANGE (tsServer) — monthly" },
  { name: "ClickLog", fields: ["id", "clickId @unique", "siteId", "popId", "campaignId", "visitorId", "sessionId", "country", "createdAt", "invalid"], indexes: ["clickId", "campaign_id, created_at"] },
  { name: "Conversion", fields: ["id", "clickId", "campaignId", "siteId", "publisherId", "payout", "publisherShare", "platformShare", "status", "source", "createdAt"], indexes: ["clickId", "campaign_id, created_at", "site_id, created_at"] },
  { name: "Submission", fields: ["id", "campaignId", "siteId", "popId", "payloadMasked", "responseMasked", "httpStatus", "latencyMs", "success", "createdAt"], indexes: ["campaign_id, created_at", "site_id, created_at"] },
  { name: "DailyStat", fields: ["id", "date", "siteId", "popId", "campaignId", "device", "country", "source", "impressions", "unique", "yes", "no", "closes", "clicks", "submissions", "conversions", "revenue", "publisherPayout", "platformShare"], indexes: ["date, siteId", "date, campaignId"], note: "pre-aggregated rollup" },
  { name: "Plan", fields: ["id", "name", "price", "includedClicks", "overageRate", "features[]"], indexes: ["name"] },
  { name: "Subscription", fields: ["id", "publisherId", "planId", "status", "cycleStart", "cycleEnd", "stripeId"], indexes: ["publisherId"] },
  { name: "UsageCounter", fields: ["id", "publisherId", "cycleStart", "clicks", "overageClicks", "overageAmount"], indexes: ["publisherId, cycleStart @unique"] },
  { name: "Invoice", fields: ["id", "publisherId", "number", "amount", "status", "issuedAt", "paidAt", "lines"], indexes: ["publisherId, issuedAt"] },
  { name: "Payout", fields: ["id", "publisherId", "period", "gross", "split", "net", "status", "methodId", "approvedBy", "paidAt"], indexes: ["publisherId, period"] },
  { name: "PayoutMethod", fields: ["id", "publisherId", "type", "handleEnc", "taxFormOnFile", "minimum"], indexes: ["publisherId"] },
  { name: "ApiKey", fields: ["id", "publisherId", "label", "prefix", "hash", "scopes[]", "lastUsedAt", "createdAt"], indexes: ["prefix"] },
  { name: "AuditLog", fields: ["id", "actorId", "actor", "action", "target", "ip", "meta", "createdAt"], indexes: ["createdAt", "actorId"] },
  { name: "FeatureFlag", fields: ["id", "key @unique", "label", "on", "rollout", "description"], indexes: ["key"] },
  { name: "Webhook", fields: ["id", "publisherId", "url", "events[]", "secretEnc", "active"], indexes: ["publisherId"] },
  { name: "WebhookDelivery", fields: ["id", "webhookId", "event", "status", "httpStatus", "attempt", "responseMasked", "createdAt"], indexes: ["webhookId, createdAt"] },
];

/* ══════════ in-memory tables ══════════ */
type Row = Record<string, unknown> & { id: string };
const tables = new Map<string, Row[]>();
export function table(name: string): Row[] {
  if (!tables.has(name)) tables.set(name, []);
  return tables.get(name)!;
}
export function insert(name: string, row: Omit<Row, "id"> & { id?: string }): Row {
  const r = { ...row, id: (row.id as string) ?? randomUUID() } as Row;
  table(name).unshift(r);
  const cap = name === "Event" ? 800 : 400;
  const t = table(name);
  if (t.length > cap) t.length = cap;
  return r;
}
export function find(name: string, pred: (r: Row) => boolean): Row | undefined {
  return table(name).find(pred);
}
export function where(name: string, pred: (r: Row) => boolean): Row[] {
  return table(name).filter(pred);
}
export function update(name: string, id: string, patch: Record<string, unknown>): Row | undefined {
  const r = find(name, (x) => x.id === id);
  if (r) Object.assign(r, patch);
  return r;
}
export function remove(name: string, id: string): boolean {
  const t = table(name);
  const i = t.findIndex((x) => x.id === id);
  if (i === -1) return false;
  t.splice(i, 1);
  return true;
}

/* ══════════ §8 security ══════════ */
const SECRET = process.env.REVBOUNCE_SECRET ?? "dev-only-secret-rotate-in-prod";

export function hmac(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try { return timingSafeEqual(ab, bb); } catch { return false; }
}
export function sha256(v: string): string {
  return createHash("sha256").update(v).digest("hex");
}

/** HMAC-signed short-lived token (JWT-shaped: header.payload.sig). */
export function signToken(payload: Record<string, unknown>, ttlSeconds: number): string {
  const head = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + ttlSeconds * 1000 })).toString("base64url");
  return `${head}.${body}.${hmac(`${head}.${body}`)}`;
}
export function verifyToken<T = Record<string, unknown>>(token: string): T | null {
  try {
    const [h, b, s] = (token || "").split(".");
    if (!h || !b || !s) return null;
    if (!safeEqual(s, hmac(`${h}.${b}`))) return null;
    const payload = JSON.parse(Buffer.from(b, "base64url").toString()) as { exp: number };
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload as T;
  } catch { return null; }
}

/** §8 SSRF protection — refuse private / link-local / loopback targets. */
export function ssrfSafe(rawUrl: string): { ok: boolean; reason?: string } {
  let u: URL;
  try { u = new URL(rawUrl); } catch { return { ok: false, reason: "invalid_url" }; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, reason: "bad_protocol" };
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    return { ok: false, reason: "private_host" };
  }
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127)) return { ok: false, reason: "private_range" };
  }
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) {
    return { ok: false, reason: "private_range" };
  }
  if (host === "metadata.google.internal" || host === "169.254.169.254") return { ok: false, reason: "metadata_endpoint" };
  return { ok: true };
}

/** Input sanitization for anything echoed back or stored. */
export function clean(v: unknown, max = 500): string {
  return String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max);
}

export function maskValue(v: string): string {
  if (!v) return "";
  return v.length <= 6 ? "••••" : `${v.slice(0, 3)}••••${v.slice(-2)}`;
}
export function maskPayload(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const secretish = /(pass|secret|token|key|auth|bearer|signature)/i;
  for (const [k, v] of Object.entries(obj)) {
    if (secretish.test(k)) out[k] = maskValue(String(v));
    else if (/email/i.test(k)) out[k] = String(v).replace(/^(.{2})[^@]*(@.+)$/, "$1•••$2");
    else out[k] = typeof v === "string" ? clean(v, 200) : v;
  }
  return out;
}

/* rate limiting per IP + siteKey */
const buckets = new Map<string, number[]>();
export function limit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => t > now - windowMs);
  if (arr.length >= max) { buckets.set(key, arr); return true; }
  arr.push(now);
  buckets.set(key, arr);
  if (buckets.size > 8000) buckets.clear();
  return false;
}

export function audit(actor: string, action: string, target: string, ip = "127.0.0.1", meta: Record<string, unknown> = {}) {
  insert("AuditLog", { actor, action, target, ip, meta, createdAt: Date.now() });
}

/* ══════════ §8 auth ══════════ */
export interface Account { id: string; email: string; name: string; role: "admin" | "publisher" | "advertiser"; publisherId: string; passwordHash: string; }

const ACCOUNTS: Account[] = [
  { id: "u_admin", email: "admin@revbounce.com", name: "Marcus Vane", role: "admin", publisherId: "", passwordHash: sha256("demo1234") },
  { id: "u_pub", email: "publisher@revbounce.com", name: "Ava Sterling", role: "publisher", publisherId: "pub_1", passwordHash: sha256("demo1234") },
  { id: "u_adv", email: "advertiser@revbounce.com", name: "Lena Hoff", role: "advertiser", publisherId: "", passwordHash: sha256("demo1234") },
];

export function accounts(): Account[] { return ACCOUNTS; }
export function accountByEmail(email: string) { return ACCOUNTS.find((a) => a.email === email.toLowerCase().trim()); }
export function accountById(id: string) { return ACCOUNTS.find((a) => a.id === id); }
export function createAccount(email: string, password: string, name: string, role: Account["role"] = "publisher"): Account | null {
  if (accountByEmail(email)) return null;
  const acc: Account = { id: `u_${randomUUID().slice(0, 8)}`, email: email.toLowerCase().trim(), name, role, publisherId: `pub_${randomUUID().slice(0, 6)}`, passwordHash: sha256(password) };
  ACCOUNTS.push(acc);
  return acc;
}

export const ACCESS_TTL = 900;          // 15 min
export const REFRESH_TTL = 60 * 60 * 24 * 30;
const revoked = new Set<string>();
export function revoke(jti: string) { revoked.add(jti); }
export function isRevoked(jti: string) { return revoked.has(jti); }

export interface AuthCtx { sub: string; role: Account["role"]; publisherId: string; jti: string; }

export function authFrom(header: string | null): AuthCtx | null {
  if (!header) return null;
  const token = header.replace(/^Bearer\s+/i, "");
  const payload = verifyToken<AuthCtx & { exp: number }>(token);
  if (!payload || isRevoked(payload.jti)) return null;
  return payload;
}

export function issuePair(acc: Account) {
  const jti = randomUUID();
  return {
    accessToken: signToken({ sub: acc.id, role: acc.role, publisherId: acc.publisherId, jti, typ: "access" }, ACCESS_TTL),
    refreshToken: signToken({ sub: acc.id, role: acc.role, publisherId: acc.publisherId, jti, typ: "refresh" }, REFRESH_TTL),
    expiresIn: ACCESS_TTL,
    user: { id: acc.id, email: acc.email, name: acc.name, role: acc.role, publisherId: acc.publisherId },
  };
}

/* ══════════ §10 revenue ══════════ */
export interface RevenueSplit { gross: number; publisherShare: number; platformShare: number; model: "revshare" | "subscription"; }

export function computeRevenue(gross: number, model: "revshare" | "subscription", split: number): RevenueSplit {
  if (model === "subscription") {
    // Model 1 — publisher keeps all campaign revenue; platform bills subscription + overage
    return { gross, publisherShare: +gross.toFixed(4), platformShare: 0, model };
  }
  const pub = +(gross * (split / 100)).toFixed(4);
  return { gross, publisherShare: pub, platformShare: +(gross - pub).toFixed(4), model };
}

export function meterClick(publisherId: string, cycleStart: string) {
  const row = find("UsageCounter", (r) => r.publisherId === publisherId && r.cycleStart === cycleStart);
  if (row) { row.clicks = (row.clicks as number) + 1; return row; }
  return insert("UsageCounter", { publisherId, cycleStart, clicks: 1, overageClicks: 0, overageAmount: 0 });
}

export function computeOverage(clicks: number, includedClicks: number, rate: number) {
  const over = Math.max(0, clicks - includedClicks);
  return { overageClicks: over, overageAmount: +(over * rate).toFixed(2) };
}

/* ══════════ §10 fraud / quality ══════════ */
const BOT_RE = /bot|crawler|spider|headless|phantom|puppeteer|playwright|lighthouse|curl|wget|python-requests/i;
export function botUa(ua: string) { return !ua || BOT_RE.test(ua); }

const recentClicks = new Map<string, number>();
/** Duplicate click suppression: same visitor+campaign within 30s. */
export function duplicateClick(visitorId: string, campaignId: string, windowMs = 30_000): boolean {
  const k = `${visitorId}:${campaignId}`;
  const last = recentClicks.get(k) ?? 0;
  const now = Date.now();
  if (now - last < windowMs) return true;
  recentClicks.set(k, now);
  if (recentClicks.size > 5000) recentClicks.clear();
  return false;
}

const ipCounts = new Map<string, number[]>();
/** IP rate anomaly → flag as invalid (excluded from billing & payouts). */
export function ipAnomaly(ip: string, max = 40, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (ipCounts.get(ip) ?? []).filter((t) => t > now - windowMs);
  arr.push(now);
  ipCounts.set(ip, arr);
  return arr.length > max;
}

/* ══════════ §10 auto-optimization (Thompson sampling) ══════════ */
export interface BanditArm {
  campaignId: string;
  name: string;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  epc: number;
  ecpm: number;
  weight: number;
  sampled: number;
  exploring: boolean;
  locked: boolean;
  reason: string;
}

const MIN_SAMPLE = 200;
const EPSILON = 0.10;

/** Deterministic PRNG so optimizer runs are reproducible in demo mode. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function gammaSample(shape: number, rand: () => number): number {
  // Marsaglia–Tsang
  if (shape < 1) return gammaSample(shape + 1, rand) * Math.pow(rand() || 1e-9, 1 / shape);
  const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (let i = 0; i < 64; i++) {
    let x = 0, v = 0;
    do {
      const u1 = rand() || 1e-9, u2 = rand() || 1e-9;
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rand() || 1e-9;
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
  return d;
}
function betaSample(a: number, b: number, rand: () => number): number {
  const x = gammaSample(a, rand), y = gammaSample(b, rand);
  return x / (x + y || 1);
}

export interface OptimizeInput {
  campaigns: { id: string; name: string; impressions: number; clicks: number; conversions: number; revenue: number; payout: number; capped?: boolean; locked?: boolean; payoutFloor?: number }[];
  segment: { site: string; device: string; geo: string };
  seed?: number;
}

/** Hourly job: compute EPC/eCPM per (site, device, geo) and allocate with
 *  Thompson sampling + 10% epsilon exploration. Respects caps & floors. */
export function optimize(input: OptimizeInput): { segment: OptimizeInput["segment"]; arms: BanditArm[]; ranAt: number; decisions: string[] } {
  const rand = rng(input.seed ?? 20260117);
  const decisions: string[] = [];
  const arms: BanditArm[] = input.campaigns.map((c) => {
    const epc = c.clicks ? c.revenue / c.clicks : 0;
    const ecpm = c.impressions ? (c.revenue / c.impressions) * 1000 : 0;
    let sampled: number;
    let exploring = false;
    let reason = "";
    if (c.capped) {
      sampled = 0; reason = "cap reached — excluded from rotation";
    } else if (c.locked) {
      sampled = 1; reason = "admin lock — weight pinned";
    } else if (c.impressions < MIN_SAMPLE) {
      sampled = 0.5 + rand() * 0.5; exploring = true;
      reason = `below min sample (${c.impressions}/${MIN_SAMPLE}) — exploring`;
    } else if (rand() < EPSILON) {
      sampled = rand(); exploring = true;
      reason = "epsilon exploration (10%)";
    } else {
      const alpha = 1 + c.conversions;
      const beta = 1 + Math.max(0, c.clicks - c.conversions);
      sampled = betaSample(alpha, beta, rand) * Math.max(epc, 0.01);
      reason = `Thompson draw · EPC $${epc.toFixed(3)} · eCPM $${ecpm.toFixed(2)}`;
    }
    if (c.payoutFloor && c.payout < c.payoutFloor) {
      sampled = 0;
      reason = `payout $${c.payout} below floor $${c.payoutFloor}`;
    }
    return { campaignId: c.id, name: c.name, impressions: c.impressions, clicks: c.clicks, conversions: c.conversions, revenue: c.revenue, epc: +epc.toFixed(4), ecpm: +ecpm.toFixed(2), weight: 0, sampled, exploring, locked: !!c.locked, reason };
  });

  const total = arms.reduce((a, x) => a + x.sampled, 0) || 1;
  arms.forEach((a) => { a.weight = Math.round((a.sampled / total) * 100); });
  arms.sort((a, b) => b.weight - a.weight);
  arms.forEach((a, i) => decisions.push(`#${i + 1} ${a.name} → weight ${a.weight}% · ${a.reason}`));

  insert("OptimizerRun", {
    segment: input.segment, ranAt: Date.now(),
    order: arms.map((a) => a.campaignId), decisions,
  });
  return { segment: input.segment, arms, ranAt: Date.now(), decisions };
}

export function optimizerRuns(limitN = 10) {
  return table("OptimizerRun").slice(0, limitN);
}

/* ══════════ third-party tracker templates (§10) ══════════ */
export const TRACKER_TEMPLATES: { id: string; name: string; postback: string; macros: string[] }[] = [
  { id: "everflow", name: "Everflow", postback: "https://www.everflowclient.io/?nid={nid}&transaction_id={click_id}&amount={payout}&adv_event_id={event}", macros: ["{click_id}", "{payout}", "{nid}", "{event}"] },
  { id: "twyne", name: "Twyne", postback: "https://track.twyne.example/pb?cid={click_id}&amount={payout}&status={status}", macros: ["{click_id}", "{payout}", "{status}"] },
  { id: "generic", name: "Generic template", postback: "https://your-tracker.example/postback?click_id={click_id}&payout={payout}&status={status}&sub1={sub1}", macros: ["{click_id}", "{payout}", "{status}", "{sub1}", "{sub2}", "{sub3}", "{sub4}", "{sub5}"] },
];

export function renderMacros(tpl: string, vals: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_m, k: string) => String(vals[k] ?? ""));
}

export { randomUUID };
