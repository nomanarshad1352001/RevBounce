// ─────────────────────────────────────────────────────────────
// RevBounce delivery-plane store (spec §2/§3) — dummy/in-memory
// mode, explicitly NO database. Maps spec components to their
// dummy equivalents:
//   Postgres rows   → arrays below (reseed on boot)
//   Redis cache     → CONFIG object + in-memory rate-limit buckets
//   BullMQ worker   → synchronous "delivery" simulation in the
//                     /public/submit & /public/email routes, with
//                     destination/provider/http captured on each lead
// ─────────────────────────────────────────────────────────────

/** Bump on every config-shape or pop change — /public/config is versioned. */
export const CONFIG_VERSION = 7;

export interface ServedEvent {
  site: string;
  pop: string;
  campaign: string;
  type: "impression" | "click" | "conversion" | "close";
  ts: number;
  ua?: string;
}

export interface ServedLead {
  id: string;
  site: string;
  pop: string;
  campaign: string;
  email: string;
  zip?: string;
  kind: "hostpost" | "email";
  destination: "advertiser-endpoint" | "integration";
  provider: string;
  http: number;
  ms: number;
  ts: number;
}

export interface ServedFormField {
  id: string; type: "text" | "email" | "phone" | "zip" | "address" | "select" | "consent";
  label: string; required: boolean; pattern?: string; options?: string;
}

/** Campaign as seen by the browser — public fields only, never secrets. */
export interface ServedCampaign {
  id: string;
  name: string;
  kind: "hostpost" | "cpa" | "gfeed";
  headline: string;
  description: string;
  image: string;
  yesText: string;
  noText: string;
  /** macro URL for cpa / gfeed — {click_id} replaced by the embed */
  url?: string;
  fields?: ServedFormField[];
  countries: string[];
  devices: ("desktop" | "tablet" | "mobile")[];
  capped: boolean;
}

export interface ServedPop {
  id: string;
  version: number;
  kind: "offer" | "email-capture";
  priority: number;
  template: "velvet" | "sovereign" | "ribbon" | "corner";
  headline: string;
  sub: string;
  yesText: string;
  noText: string;
  yesColor: string;
  noColor: string;
  bg: string;
  accent: string;
  image: string;
  imagePosition: "top" | "left" | "right" | "background";
  showCounter: boolean;
  closeOnYes: boolean;
  closeOnFinalNo: boolean;
  overlayColor: string;
  overlayOpacity: number;
  radius: number;
  animation: "fade" | "slide" | "zoom";
  closeOnOverlay: boolean;
  rules: {
    trigger: "exit" | "idle";
    loadDelay: number;
    idleSeconds: number;
    devices: ("desktop" | "tablet" | "mobile")[];
    mobileFallback: "back-button" | "scroll-up" | "timer" | "none";
    scrollUpExit: boolean;
    include: string[];
    exclude: string[];
  };
  targeting: { countries: string[]; visitor: "all" | "new" | "returning" };
  frequency: {
    mode: "session" | "cooldown" | "max";
    cooldownHours: number;
    maxPerDay: number;
    maxLifetime: number;
    closeCountsAsDisplay: boolean;
  };
  /** offer pops only */
  campaigns: ServedCampaign[];
  /** email-capture only */
  emailCapture?: {
    placeholder: string;
    successMessage: string;
    closeAfterSuccess: boolean;
    requireConsent: boolean;
    consentText: string;
  };
}

/** Domain allow-list per site (§7.1) — embed refuses to run elsewhere. */
export const SITE_DOMAINS: Record<string, string[]> = {
  rb_tgp_9f27c1: ["thegildedpost.com", "www.thegildedpost.com", "localhost", "127.0.0.1"],
  rb_cne_44a8d2: ["circuitember.io", "localhost", "127.0.0.1"],
};

const CAMPAIGN_AZURE: ServedCampaign = {
  id: "c1", name: "Azure Travel Club — $500 Voucher", kind: "hostpost",
  headline: "Your $500 travel voucher is waiting",
  description: "Campaign 1 Content Will Appear Here — Azure Travel Club, $500 voucher draw.",
  image: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=900&auto=format&fit=crop",
  yesText: "YES, CLAIM IT", noText: "NO, THANKS",
  fields: [
    { id: "email", type: "email", label: "Email address", required: true },
    { id: "zip", type: "zip", label: "ZIP code", required: true, pattern: "^[0-9]{5}$" },
  ],
  countries: ["US", "CA", "UK", "AU"], devices: ["desktop", "tablet", "mobile"], capped: false,
};

const CAMPAIGN_NOVA: ServedCampaign = {
  id: "c2", name: "NovaShield VPN — 30-Day Trial", kind: "cpa",
  headline: "Your connection is exposed right now",
  description: "Campaign 2 Content Will Appear Here — NovaShield VPN, 30-day free trial.",
  image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=900&auto=format&fit=crop",
  yesText: "START FREE TRIAL", noText: "NO, I'M FINE",
  url: "https://example.com/novashield?click_id={click_id}&site={site_id}&pop={pop_id}",
  countries: ["US", "DE", "UK", "FR", "NL", "CA", "AU"], devices: ["desktop", "tablet", "mobile"], capped: false,
};

const CAMPAIGN_LUMINA: ServedCampaign = {
  id: "c3", name: "Lumina Insurance Compare", kind: "hostpost",
  headline: "Cut your insurance bill in 60 seconds",
  description: "Campaign 3 Content Will Appear Here — Lumina insurance quote, 3 fields.",
  image: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?q=80&w=900&auto=format&fit=crop",
  yesText: "GET MY QUOTE", noText: "SKIP THIS",
  fields: [
    { id: "email", type: "email", label: "Email", required: true },
    { id: "zip", type: "zip", label: "ZIP", required: true, pattern: "^[0-9]{5}$" },
    { id: "consent", type: "consent", label: "I agree to be contacted about quotes", required: true },
  ],
  countries: ["US"], devices: ["desktop", "tablet", "mobile"], capped: false,
};

const CAMPAIGN_FEED: ServedCampaign = {
  id: "c4", name: "Google Click Feed — Tier 1", kind: "gfeed",
  headline: "Readers also explored these trending offers",
  description: "Campaign 4 Content Will Appear Here — sponsored results feed.",
  image: "https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?q=80&w=900&auto=format&fit=crop",
  yesText: "SHOW ME DEALS", noText: "NO THANKS",
  url: "https://example.com/feed?click_id={click_id}&site={site_id}&q={sub2}",
  countries: ["US", "CA", "UK", "AU", "DE"], devices: ["desktop", "tablet", "mobile"], capped: false,
};

const CAMPAIGN_CAPPED: ServedCampaign = {
  id: "c5", name: "iPhone 17 Pro Sweepstakes", kind: "cpa",
  headline: "Win the new iPhone 17 Pro",
  description: "Daily cap reached — the engine skips this slot automatically.",
  image: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=900&auto=format&fit=crop",
  yesText: "ENTER NOW", noText: "NO",
  url: "https://example.com/sweeps?click_id={click_id}",
  countries: ["US", "UK"], devices: ["mobile"], capped: true,
};

const POP_CONFIGS: Record<string, ServedPop[]> = {
  rb_tgp_9f27c1: [
    {
      id: "p1", version: 4, kind: "offer", priority: 10, template: "velvet",
      headline: "ARE YOU STILL THERE?", sub: "Exclusive Offers for You",
      yesText: "YES, SHOW ME", noText: "NO, THANKS", yesColor: "#0066FF", noColor: "#FF2D2D",
      bg: "#ffffff", accent: "#8b5cf6",
      image: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=900&auto=format&fit=crop",
      imagePosition: "left", showCounter: true, closeOnYes: false, closeOnFinalNo: true,
      overlayColor: "#0b1b3a", overlayOpacity: 55, radius: 16, animation: "fade", closeOnOverlay: true,
      rules: {
        trigger: "exit", loadDelay: 3, idleSeconds: 30,
        devices: ["desktop", "tablet", "mobile"], mobileFallback: "back-button",
        scrollUpExit: false, include: ["/*"], exclude: ["/checkout/*", "/account/*"],
      },
      targeting: { countries: [], visitor: "all" },
      frequency: { mode: "cooldown", cooldownHours: 24, maxPerDay: 2, maxLifetime: 12, closeCountsAsDisplay: true },
      campaigns: [CAMPAIGN_AZURE, CAMPAIGN_NOVA, CAMPAIGN_LUMINA, CAMPAIGN_FEED, CAMPAIGN_CAPPED],
    },
    {
      id: "p2", version: 2, kind: "offer", priority: 5, template: "sovereign",
      headline: "Still browsing?", sub: "Two hand-picked offers before you go.",
      yesText: "SHOW ME", noText: "NOT NOW", yesColor: "#0066FF", noColor: "#FF2D2D",
      bg: "#ffffff", accent: "#8b5cf6",
      image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=1600&auto=format&fit=crop",
      imagePosition: "background", showCounter: true, closeOnYes: false, closeOnFinalNo: true,
      overlayColor: "#0b1b3a", overlayOpacity: 62, radius: 16, animation: "zoom", closeOnOverlay: true,
      rules: {
        trigger: "idle", loadDelay: 3, idleSeconds: 25,
        devices: ["desktop", "tablet", "mobile"], mobileFallback: "timer",
        scrollUpExit: false, include: ["/*"], exclude: [],
      },
      targeting: { countries: [], visitor: "all" },
      frequency: { mode: "cooldown", cooldownHours: 48, maxPerDay: 1, maxLifetime: 8, closeCountsAsDisplay: true },
      campaigns: [CAMPAIGN_NOVA, CAMPAIGN_FEED],
    },
    {
      id: "p4", version: 1, kind: "email-capture", priority: 1, template: "corner",
      headline: "One slow-travel essay, every Sunday",
      sub: "Zero urgency, zero spam. Join 40,000 readers.",
      yesText: "SUBSCRIBE", noText: "NO THANKS", yesColor: "#0066FF", noColor: "#FF2D2D",
      bg: "#ffffff", accent: "#8b5cf6",
      image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=900&auto=format&fit=crop",
      imagePosition: "top", showCounter: false, closeOnYes: true, closeOnFinalNo: true,
      overlayColor: "#0b1b3a", overlayOpacity: 45, radius: 16, animation: "slide", closeOnOverlay: true,
      rules: {
        trigger: "idle", loadDelay: 2, idleSeconds: 18,
        devices: ["desktop", "tablet", "mobile"], mobileFallback: "timer",
        scrollUpExit: false, include: ["/*"], exclude: [],
      },
      targeting: { countries: [], visitor: "all" },
      frequency: { mode: "cooldown", cooldownHours: 72, maxPerDay: 1, maxLifetime: 5, closeCountsAsDisplay: true },
      campaigns: [],
      emailCapture: {
        placeholder: "you@email.com",
        successMessage: "You're in! Check your inbox to confirm.",
        closeAfterSuccess: true, requireConsent: false,
        consentText: "Email me the Sunday letter. Unsubscribe any time.",
      },
    },
  ],
};

const events: ServedEvent[] = [];
const leads: ServedLead[] = [];
const MAX_ROWS = 250;

// ── config ──
export function configFor(siteKey: string) {
  return {
    version: CONFIG_VERSION, site: siteKey, servedAt: Date.now(), cacheSeconds: 60,
    domains: SITE_DOMAINS[siteKey] ?? [],
    pops: POP_CONFIGS[siteKey] ?? [],
  };
}

// ── events (batched ingestion, spec §3) ──
export function recordEvent(e: ServedEvent) {
  events.unshift({ ...e, ts: e.ts || Date.now() });
  if (events.length > MAX_ROWS) events.length = MAX_ROWS;
}
export function recordEvents(list: ServedEvent[], ua: string) {
  for (const e of list.slice(0, 50)) recordEvent({ ...e, ua });
}
export function recentEvents(site: string, limit = 12): ServedEvent[] {
  return events.filter((e) => e.site === site).slice(0, limit);
}

// ── leads / delivery log (worker dummy) ──
export function recordLead(l: ServedLead) {
  leads.unshift(l);
  if (leads.length > MAX_ROWS) leads.length = MAX_ROWS;
}
export function recentLeads(site: string, limit = 8): ServedLead[] {
  return leads.filter((l) => l.site === site).slice(0, limit);
}

// ── rate limiting (Redis substitute — same fixed-window shape) ──
const buckets = new Map<string, number[]>();
export function rateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => t > now - windowMs);
  if (arr.length >= limit) { buckets.set(key, arr); return true; }
  arr.push(now);
  buckets.set(key, arr);
  if (buckets.size > 5000) buckets.clear();
  return false;
}

// ── helpers ──
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const uidS = () => Math.random().toString(36).slice(2, 10);

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/* ─────────────────────────────────────────────────────────────
 * §6 Email-capture pipeline (dummy mode — no external calls).
 * Mirrors the real worker faithfully: validation → duplicate rule
 * → store record → enqueue API + FTP delivery → record result.
 * ───────────────────────────────────────────────────────────── */

export interface LeadRecord {
  id: string;
  email: string;
  timestamp: number;
  siteId: string;
  publisherId: string;
  popId: string;
  device: string;
  trigger: string;
  pageUrl: string;
  consent: boolean;
  apiStatus: "pending" | "success" | "failed";
  ftpStatus: "pending" | "success" | "failed" | "queued" | "skipped";
  lastError: string;
  attempts: { n: number; status: number; ms: number; note: string }[];
}

const leadStore: LeadRecord[] = [];
const MAX_LEADS = 300;

export const DISPOSABLE_DOMAINS = [
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
  "trashmail.com", "yopmail.com", "throwaway.email", "sharklasers.com",
];

/** Dummy MX check: domains with a dot and a known-ish TLD "resolve". */
export function mxLooksValid(email: string): boolean {
  const domain = email.split("@")[1] ?? "";
  if (!domain.includes(".")) return false;
  if (domain.endsWith(".invalid") || domain.endsWith(".test")) return false;
  return true;
}

export function isDisposable(email: string): boolean {
  const domain = (email.split("@")[1] ?? "").toLowerCase();
  return DISPOSABLE_DOMAINS.includes(domain);
}

export type DuplicateRule = "allow" | "block-site" | "block-pop" | "block-pop-days";

export function findDuplicate(email: string, siteId: string, popId: string, rule: DuplicateRule, days: number): LeadRecord | null {
  if (rule === "allow") return null;
  const cutoff = Date.now() - days * 86_400_000;
  return leadStore.find((l) => {
    if (l.email !== email) return false;
    if (rule === "block-site") return l.siteId === siteId;
    if (rule === "block-pop") return l.popId === popId;
    return l.popId === popId && l.timestamp >= cutoff;
  }) ?? null;
}

/** Mask any secret before it is written to a log line. */
export function maskSecret(v: string): string {
  if (!v) return "";
  if (v.length <= 6) return "••••";
  return `${v.slice(0, 3)}••••${v.slice(-2)}`;
}

/**
 * Simulated real-time API delivery with exponential backoff.
 * 5xx / timeout → retry (max configurable, cap 5); 2xx → success.
 * Endpoints containing "fail" always 500; "flaky" fails once then succeeds.
 */
export function deliverApi(endpoint: string, maxRetries: number): { status: "success" | "failed"; attempts: LeadRecord["attempts"]; lastError: string } {
  const attempts: LeadRecord["attempts"] = [];
  const cap = Math.min(Math.max(maxRetries, 0), 5);
  const ep = endpoint.toLowerCase();
  for (let n = 1; n <= cap + 1; n++) {
    const backoff = n === 1 ? 0 : Math.min(2 ** (n - 1) * 250, 8000);
    let status = 200;
    if (ep.includes("fail")) status = 500;
    else if (ep.includes("flaky") && n === 1) status = 503;
    else if (ep.includes("timeout")) status = 0;
    const ms = 80 + Math.floor(Math.random() * 190) + backoff;
    const note = status >= 200 && status < 300 ? "accepted"
      : status === 0 ? `timeout · retry in ${backoff}ms`
      : `upstream ${status} · retry in ${backoff}ms`;
    attempts.push({ n, status, ms, note });
    if (status >= 200 && status < 300) return { status: "success", attempts, lastError: "" };
  }
  const last = attempts[attempts.length - 1];
  return { status: "failed", attempts, lastError: last.status === 0 ? "request timed out after retries" : `upstream returned ${last.status} after ${attempts.length} attempts` };
}

export function ftpFilename(pattern: string, site: string): string {
  const d = new Date();
  return pattern
    .replace("{site}", site)
    .replace("{date}", d.toISOString().slice(0, 10).replace(/-/g, ""))
    .replace("{time}", d.toISOString().slice(11, 19).replace(/:/g, ""));
}

export function recordLeadRecord(l: LeadRecord) {
  leadStore.unshift(l);
  if (leadStore.length > MAX_LEADS) leadStore.length = MAX_LEADS;
}

export function recentLeadRecords(siteId: string, limit = 20): LeadRecord[] {
  return leadStore.filter((l) => !siteId || l.siteId === siteId).slice(0, limit);
}

export function retryLead(id: string, endpoint: string, maxRetries: number): LeadRecord | null {
  const lead = leadStore.find((l) => l.id === id);
  if (!lead) return null;
  const res = deliverApi(endpoint, maxRetries);
  lead.apiStatus = res.status;
  lead.attempts = [...lead.attempts, ...res.attempts.map((a) => ({ ...a, note: `retry · ${a.note}` }))];
  lead.lastError = res.lastError;
  return lead;
}

/* ── §7 server-issued click IDs for CPA / feed link-outs ── */
const clicks: { id: string; site: string; pop: string; campaign: string; ts: number }[] = [];

export function issueClickId(site: string, pop: string, campaign: string): string {
  const id = `cl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  clicks.unshift({ id, site, pop, campaign, ts: Date.now() });
  if (clicks.length > 300) clicks.length = 300;
  return id;
}

/* ─────────────────────────────────────────────────────────────
 * §7.6 Event ingestion support — idempotency, geo enrichment,
 * bot filtering. §7.4 — server-authoritative campaign status.
 * ───────────────────────────────────────────────────────────── */

export type RbEventType =
  | "pop_impression" | "campaign_impression" | "yes_click" | "no_click" | "pop_close"
  | "outbound_click" | "submission_attempt" | "submission_success" | "submission_failure"
  | "email_form_start" | "email_submit" | "email_invalid" | "email_duplicate"
  | "sequence_complete" | "error";

export const RB_EVENT_TYPES: RbEventType[] = [
  "pop_impression", "campaign_impression", "yes_click", "no_click", "pop_close",
  "outbound_click", "submission_attempt", "submission_success", "submission_failure",
  "email_form_start", "email_submit", "email_invalid", "email_duplicate",
  "sequence_complete", "error",
];

export interface RbEvent {
  id: string;
  type: RbEventType;
  siteKey: string;
  popId: string;
  popVersion: number;
  campaignId: string;
  deviceType: string;
  triggerType: string;
  tsClient: number;
  tsServer: number;
  sessionId: string;
  visitorId: string;
  pageUrl: string;
  referrer: string;
  utm: Record<string, string>;
  clickId: string;
  country: string;
  region: string;
  bot: boolean;
}

const rbEvents: RbEvent[] = [];
const seenEventIds = new Set<string>();
const MAX_RB = 400;

/** Country/region only — raw IP is never persisted past the fraud window. */
export function geoFromHeaders(h: Headers): { country: string; region: string } {
  const country = h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry") ?? "";
  const region = h.get("x-vercel-ip-country-region") ?? h.get("cf-region-code") ?? "";
  if (country) return { country: country.toUpperCase(), region };
  // dummy mode: derive a stable pseudo-geo from the forwarded IP hash
  const ip = h.get("x-forwarded-for") ?? "0.0.0.0";
  const pool = [["US", "CA"], ["US", "NY"], ["UK", "ENG"], ["CA", "ON"], ["DE", "BE"], ["AU", "NSW"], ["FR", "IDF"], ["NL", "NH"]];
  let hash = 0;
  for (let i = 0; i < ip.length; i++) hash = (hash * 31 + ip.charCodeAt(i)) >>> 0;
  const [c, r] = pool[hash % pool.length];
  return { country: c, region: r };
}

const BOT_RE = /bot|crawler|spider|crawling|headless|phantom|puppeteer|playwright|lighthouse|curl|wget|python-requests|axios\//i;
export function isBot(ua: string): boolean {
  if (!ua) return true;
  return BOT_RE.test(ua);
}

/** Returns accepted / duplicate / filtered counts (idempotent by event id). */
export function ingestEvents(
  batch: Partial<RbEvent>[],
  meta: { siteKey: string; ua: string; country: string; region: string },
): { accepted: number; duplicates: number; filtered: number } {
  let accepted = 0, duplicates = 0, filtered = 0;
  const bot = isBot(meta.ua);
  for (const raw of batch.slice(0, 60)) {
    const type = raw.type as RbEventType;
    if (!type || RB_EVENT_TYPES.indexOf(type) === -1) { filtered++; continue; }
    const id = String(raw.id ?? "");
    if (!id) { filtered++; continue; }
    if (seenEventIds.has(id)) { duplicates++; continue; }   // idempotency
    seenEventIds.add(id);
    if (seenEventIds.size > 5000) seenEventIds.clear();
    const ev: RbEvent = {
      id, type, siteKey: meta.siteKey,
      popId: String(raw.popId ?? ""), popVersion: Number(raw.popVersion ?? 0),
      campaignId: String(raw.campaignId ?? ""), deviceType: String(raw.deviceType ?? ""),
      triggerType: String(raw.triggerType ?? ""),
      tsClient: Number(raw.tsClient ?? Date.now()), tsServer: Date.now(),
      sessionId: String(raw.sessionId ?? ""), visitorId: String(raw.visitorId ?? ""),
      pageUrl: String(raw.pageUrl ?? ""), referrer: String(raw.referrer ?? ""),
      utm: (raw.utm as Record<string, string>) ?? {}, clickId: String(raw.clickId ?? ""),
      country: meta.country, region: meta.region, bot,
    };
    rbEvents.unshift(ev);
    if (rbEvents.length > MAX_RB) rbEvents.length = MAX_RB;
    if (bot) filtered++; else accepted++;
    // mirror into the legacy feed so existing dashboards keep streaming
    const legacy: Record<string, ServedEvent["type"]> = {
      pop_impression: "impression", campaign_impression: "impression",
      yes_click: "click", outbound_click: "click", email_submit: "click",
      submission_success: "conversion", email_duplicate: "close",
      no_click: "close", pop_close: "close", sequence_complete: "close",
    };
    const lt = legacy[type];
    if (lt && !bot) {
      recordEvent({ site: meta.siteKey, pop: ev.popId, campaign: ev.campaignId, type: lt, ts: ev.tsServer, ua: meta.ua });
    }
  }
  return { accepted, duplicates, filtered };
}

export function recentRbEvents(siteKey: string, limit = 25): RbEvent[] {
  return rbEvents.filter((e) => !siteKey || e.siteKey === siteKey).slice(0, limit);
}

/** §7.4 — campaigns disabled after publish; embed asks and advances. */
const disabledCampaigns = new Set<string>(["c5"]);   // c5 is capped/disabled in the demo

export function campaignStatus(id: string): "active" | "skipped" {
  return disabledCampaigns.has(id) ? "skipped" : "active";
}
export function setCampaignDisabled(id: string, off: boolean) {
  if (off) disabledCampaigns.add(id); else disabledCampaigns.delete(id);
}
