// ─────────────────────────────────────────────────────────────
// RevBounce — Dummy data layer (per spec: no database)
// Everything the SaaS renders is seeded here and mutated
// through the client store. Section-15 default assumptions are
// noted inline as ASSUME comments.
// ─────────────────────────────────────────────────────────────
import {
  Advertiser, ApiKey, AuditEntry, Branding, Campaign, DayPoint, EmailCaptureConfig, EmailRecord,
  FeatureFlag, FraudFlag, GlobalPostbacks, Integration, Invoice, PayoutDetails, PayoutPeriod, Plan,
  Pop, PopDesign, PopFrequency, PopIntegrations, PopKindMeta, PopRules, PopTargeting, PostingConfig,
  PublisherRow, Payout, Retention, SavedReport, Security, Site, TeamUser, TrackEvent, User,
} from "./types";

/* ── §5.3 pop-type registry — V1 live, rest plug in at Phase 8 ── */
export const POP_KINDS: PopKindMeta[] = [
  { id: "offer", name: "Offer Pop", blurb: "Exit-intent or idle. Runs up to 5 sequential campaigns.", v1: true, sequence: true },
  { id: "email-capture", name: "Email Capture Pop", blurb: "Single email form. Never part of the campaign sequence.", v1: true, sequence: false },
  { id: "decline", name: "Decline Page", blurb: "Monetize declined checkouts & failed payments.", v1: false, sequence: true },
  { id: "thankyou", name: "Thank-You Page", blurb: "Post-conversion offers on your confirmation page.", v1: false, sequence: true },
  { id: "checkout-upsell", name: "Checkout Upsell", blurb: "One-click upsell inside the cart flow.", v1: false, sequence: true },
  { id: "slide-in", name: "Slide-In", blurb: "Corner slide-in tied to scroll depth.", v1: false, sequence: true },
  { id: "mobile", name: "Mobile Pop", blurb: "Touch-native sheet with back-button exit.", v1: false, sequence: true },
  { id: "offer-wall", name: "Offer Wall", blurb: "Grid of offers, visitor picks their own.", v1: false, sequence: true },
  { id: "in-page", name: "In-Page", blurb: "Inline unit embedded in article flow.", v1: false, sequence: true },
  { id: "pop-under", name: "Pop-under", blurb: "Background tab placement (policy-gated).", v1: false, sequence: true },
];

export const DEFAULT_DESIGN: PopDesign = {
  size: "M", customWidth: 660, fontFamily: "Inter", radius: 16,
  overlayColor: "#0b1b3a", overlayOpacity: 55, animation: "fade", closeStyle: "circle",
  customCss: "", successColor: "#16A34A", errorColor: "#FF2D2D",
};
export const DEFAULT_RULES: PopRules = {
  trigger: "exit", loadDelay: 5, idleSeconds: 30, devices: ["desktop", "tablet", "mobile"],
  mobileFallback: "back-button", includePaths: "/*", excludePaths: "/checkout/*\n/account/*",
};
export const DEFAULT_TARGETING: PopTargeting = {
  countries: ["US", "CA", "UK", "AU"], trafficSource: "all", visitor: "all",
  language: "any", browser: "any", os: "any",
};
export const DEFAULT_FREQUENCY: PopFrequency = {
  mode: "cooldown", cooldownHours: 24, maxPerDay: 2, maxLifetime: 12, closeCountsAsDisplay: true,
};
export const DEFAULT_INTEGRATIONS: PopIntegrations = {
  fbPixel: "", gaId: "", gtmId: "", fireOn: "both", webhookUrl: "",
  everflowUrl: "", twyneUrl: "", emailProvider: "mailchimp", emailListId: "", prefillMapping: "email→{email}",
};

// ASSUME (Sec.15 defaults): plans & pricing not specified →
// Starter $49 / Growth $149 / Enterprise $499 with graduated
// included-click bundles and overage rates.
export const PLANS: Plan[] = [
  {
    id: "starter", name: "Starter", price: 49, tagline: "For single-site owners testing exit monetization.",
    includedClicks: 10_000, overageRate: 0.012, sites: 1, pops: 3,
    features: ["1 website", "3 active pops", "Exit-intent + timed triggers", "Campaign library access", "7-day analytics", "Email support"],
  },
  {
    id: "growth", name: "Growth", price: 149, tagline: "For publishers scaling across several properties.",
    includedClicks: 50_000, overageRate: 0.01, sites: 5, pops: -1,
    features: ["5 websites", "Unlimited pops", "All 4 triggers (exit / idle / scroll / timed)", "A/B auto-rotation", "Email integrations", "90-day analytics", "Priority support"],
  },
  {
    id: "enterprise", name: "Enterprise", price: 499, tagline: "For networks & lead-gen teams at volume.",
    includedClicks: 250_000, overageRate: 0.008, sites: -1, pops: -1,
    features: ["Unlimited websites", "Unlimited pops", "API + webhooks", "Custom payout splits", "Dedicated success manager", "Unlimited analytics retention", "SSO & SLA"],
  },
];

export const DEMO_USERS: Record<string, User> = {
  publisher: {
    id: "u_pub", name: "Ava Sterling", email: "publisher@revbounce.com", role: "publisher",
    company: "Sterling Media Co.", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop",
    plan: "growth", model: "revshare", split: 70, joinedAt: "2025-03-14",
  },
  admin: {
    id: "u_admin", name: "Marcus Vane", email: "admin@revbounce.com", role: "admin",
    company: "RevBounce HQ", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200&auto=format&fit=crop",
    plan: "enterprise", model: "revshare", split: 100, joinedAt: "2024-11-02",
  },
  advertiser: {
    id: "u_adv", name: "Lena Hoff", email: "advertiser@revbounce.com", role: "advertiser",
    company: "NovaShield Ltd.", avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=200&auto=format&fit=crop",
    plan: "revshare", model: "revshare", split: 0, joinedAt: "2025-06-21",
  },
};

const azurePosting: PostingConfig = {
  endpoint: "https://leads.azuremedia.example/v2/intake", method: "POST",
  headers: "X-Source: revbounce\nX-Site: {site_id}",
  authType: "bearer", authValue: "••••••••••••••••",
  bodyFormat: "json",
  mapping: [{ field: "email", param: "subscriber_email" }, { field: "zip", param: "postal" }],
  staticParams: "offer=travel-club-500\nsrc=exit",
  successStatus: 200, successContains: "accepted", duplicateRule: "skip",
  timeoutMs: 3000, retries: 2,
};

const KIND = { hp: "hostpost", cpa: "cpa", gf: "gfeed" } as const;

export const CAMPAIGNS: Campaign[] = [
  {
    id: "c1", name: "Azure Travel Club — $500 Voucher", advertiser: "Azure Media Partners", type: "soi", kind: KIND.hp,
    payoutModel: "SOI", payout: 2.4, vertical: "Travel", status: "active",
    clicks: 18_432, impressions: 214_981, conversions: 3_912, revenue: 9_388.8, epc: 0.51,
    countries: ["US", "CA", "UK", "AU"], devices: ["desktop", "mobile"],
    description: "Single-opt-in email submit for a $500 travel voucher draw. Proven 9.2% click-to-lead on exit traffic.",
    image: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=900&auto=format&fit=crop", optimizerScore: 94,
    yesText: "Claim My Voucher", noText: "No thanks, I'll pass",
    dailyCap: 1_500, monthlyCap: 40_000, trafficSource: "all",
    schedule: { start: "2025-12-01", end: "2026-03-31" },
    allowedPopTypes: ["Exit Intent", "Inactivity", "Email Capture", "Thank You Page"],
    weight: 90, posting: azurePosting,
    formSpec: [
      { id: "email", type: "email", label: "Email address", required: true },
      { id: "zip", type: "zip", label: "ZIP code", required: true, pattern: "^[0-9]{5}$" },
    ],
  },
  {
    id: "c2", name: "NovaShield VPN — 30-Day Trial", advertiser: "NovaShield Ltd.", type: "cpa", kind: KIND.cpa,
    payoutModel: "CPA", payout: 38, vertical: "Software", status: "active",
    clicks: 9_214, impressions: 122_400, conversions: 618, revenue: 23_484, epc: 2.55,
    countries: ["US", "DE", "UK", "FR", "NL"], devices: ["desktop"],
    description: "High-ticket VPN trial. Converts best on tech & streaming content with exit-intent on desktop.",
    image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=900&auto=format&fit=crop", optimizerScore: 91,
    yesText: "Activate Free Trial", noText: "Maybe later",
    destUrl: "https://go.novashield.example/trial?click_id={click_id}&site={site_id}&pop={pop_id}&src={sub1}",
    dailyCap: null, monthlyCap: null, trafficSource: "all",
    schedule: { start: "2025-11-01", end: "2026-12-31" },
    allowedPopTypes: ["Exit Intent", "Inactivity", "Decline Page", "Offer Wall"],
    weight: 85,
  },
  {
    id: "c3", name: "Lumina Insurance Compare", advertiser: "Lumina Leads", type: "lead-gen", kind: KIND.hp,
    payoutModel: "CPA", payout: 14, vertical: "Insurance", status: "active",
    clicks: 6_102, impressions: 88_300, conversions: 940, revenue: 13_160, epc: 2.16,
    countries: ["US"], devices: ["desktop", "mobile"],
    description: "3-field insurance quote form. Fixed $14 per qualified lead, paid weekly.",
    image: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?q=80&w=900&auto=format&fit=crop", optimizerScore: 88,
    yesText: "Get My Quote", noText: "Not today",
    dailyCap: 400, monthlyCap: 9_000, trafficSource: "search",
    schedule: { start: "2025-10-01", end: "2026-06-30" },
    allowedPopTypes: ["Exit Intent", "Email Capture"],
    weight: 78,
    posting: {
      endpoint: "https://api.luminaleads.example/pingpost", method: "POST", headers: "Content-Type: application/json",
      authType: "apikey", authValue: "••••••••", bodyFormat: "json",
      mapping: [{ field: "email", param: "email" }, { field: "phone", param: "phone" }, { field: "zip", param: "zip" }],
      staticParams: "vertical=insurance\nmode=post", successStatus: 201, successContains: "qualified",
      duplicateRule: "skip", timeoutMs: 4000, retries: 1,
    },
    formSpec: [
      { id: "email", type: "email", label: "Email", required: true },
      { id: "phone", type: "phone", label: "Phone", required: true },
      { id: "zip", type: "zip", label: "ZIP", required: true },
    ],
  },
  {
    id: "c4", name: "Google Click Feed — Tier 1", advertiser: "RevBounce Demand", type: "click-feed", kind: KIND.gf,
    payoutModel: "CPC", payout: 0.32, vertical: "General", status: "active",
    clicks: 41_870, impressions: 390_120, conversions: 41_870, revenue: 13_398.4, epc: 0.32,
    countries: ["US", "CA", "UK", "AU", "DE"], devices: ["desktop", "mobile"],
    description: "Sponsored results feed. Guaranteed $0.32 per valid outbound click, any vertical.",
    image: "https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?q=80&w=900&auto=format&fit=crop", optimizerScore: 83,
    yesText: "Explore Deals", noText: "Dismiss",
    feedUrl: "https://feed.revbounce.example/xml?tier=t1&site={site_id}&click_id={click_id}&q={sub2}",
    dailyCap: null, monthlyCap: null, trafficSource: "all",
    schedule: { start: "2025-01-01", end: "2026-12-31" },
    allowedPopTypes: ["Exit Intent", "Inactivity", "Decline Page", "Offer Wall", "Thank You Page"],
    weight: 70,
  },
  {
    id: "c5", name: "iPhone 17 Pro Sweepstakes", advertiser: "PrizeVault Network", type: "soi", kind: KIND.hp,
    payoutModel: "SOI", payout: 1.85, vertical: "Sweepstakes", status: "paused",
    clicks: 12_660, impressions: 178_004, conversions: 2_403, revenue: 4_445.55, epc: 0.35,
    countries: ["US", "UK"], devices: ["mobile"],
    description: "Mobile-first email submit. Strong on entertainment & news inventory.",
    image: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=900&auto=format&fit=crop", optimizerScore: 76,
    yesText: "Enter to Win", noText: "I'll skip",
    dailyCap: 2_000, monthlyCap: 50_000, trafficSource: "social",
    schedule: { start: "2025-09-01", end: "2026-02-28" },
    allowedPopTypes: ["Exit Intent", "Email Capture", "Decline Page"],
    weight: 55,
    posting: {
      endpoint: "https://post.prizevault.example/soi", method: "POST", headers: "",
      authType: "basic", authValue: "••••••", bodyFormat: "form",
      mapping: [{ field: "email", param: "e" }],
      staticParams: "campaign=iphone17", successStatus: 200, successContains: "ok",
      duplicateRule: "skip", timeoutMs: 2500, retries: 3,
    },
    formSpec: [{ id: "email", type: "email", label: "Email address", required: true }],
  },
  // ── Campaign library (admin-published marketplace, §5.2) ──
  {
    id: "c6", name: "Aura Skincare — Free Sample Box", advertiser: "BeautyHaus Direct", type: "cpa", kind: KIND.cpa,
    payoutModel: "CPA", payout: 27, vertical: "Beauty", status: "library",
    clicks: 0, impressions: 0, conversions: 0, revenue: 0, epc: 1.42,
    countries: ["US", "CA"], devices: ["desktop", "mobile"],
    description: "Trial-box CPA offer. Library benchmark: $1.42 EPC on lifestyle blogs.",
    image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=900&auto=format&fit=crop", optimizerScore: 72,
    yesText: "Get My Box", noText: "No thanks",
    destUrl: "https://track.beautyhaus.example/aura?click_id={click_id}&site={site_id}",
    dailyCap: 800, monthlyCap: 20_000, trafficSource: "all",
    schedule: { start: "2026-01-01", end: "2026-12-31" },
    allowedPopTypes: ["Exit Intent", "Inactivity", "Offer Wall"],
    weight: 68,
  },
  {
    id: "c7", name: "CryptoIQ Masterclass Webinar", advertiser: "FinEdu Group", type: "lead-gen", kind: KIND.hp,
    payoutModel: "CPA", payout: 9.5, vertical: "Finance", status: "library",
    clicks: 0, impressions: 0, conversions: 0, revenue: 0, epc: 1.18,
    countries: ["US", "UK", "AU", "SG"], devices: ["desktop"],
    description: "Webinar registration lead-gen. $9.50 per confirmed attendee.",
    image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=900&auto=format&fit=crop", optimizerScore: 69,
    yesText: "Reserve My Seat", noText: "Maybe later",
    dailyCap: 300, monthlyCap: 7_500, trafficSource: "search",
    schedule: { start: "2026-01-15", end: "2026-09-30" },
    allowedPopTypes: ["Exit Intent", "Email Capture", "Thank You Page"],
    weight: 60,
    posting: {
      endpoint: "https://hooks.finedu.example/webinar", method: "POST", headers: "",
      authType: "bearer", authValue: "••••••••", bodyFormat: "json",
      mapping: [{ field: "email", param: "attendee" }],
      staticParams: "event=masterclass-q1", successStatus: 200, successContains: "registered",
      duplicateRule: "update", timeoutMs: 3000, retries: 2,
    },
    formSpec: [{ id: "email", type: "email", label: "Work email", required: true }],
  },
  {
    id: "c8", name: "Wanderlast Flight Deals Feed", advertiser: "RevBounce Demand", type: "click-feed", kind: KIND.gf,
    payoutModel: "CPC", payout: 0.21, vertical: "Travel", status: "library",
    clicks: 0, impressions: 0, conversions: 0, revenue: 0, epc: 0.21,
    countries: ["US", "CA", "UK", "AU", "DE", "FR"], devices: ["desktop", "mobile"],
    description: "Flight-deal click feed tuned for travel content exits.",
    image: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=900&auto=format&fit=crop", optimizerScore: 64,
    yesText: "See Flight Deals", noText: "Dismiss",
    feedUrl: "https://feed.revbounce.example/flights?geo={sub3}&click_id={click_id}",
    dailyCap: null, monthlyCap: null, trafficSource: "all",
    schedule: { start: "2025-06-01", end: "2026-12-31" },
    allowedPopTypes: ["Exit Intent", "Decline Page", "Offer Wall"],
    weight: 50,
  },
];

export const SITES: Site[] = [
  { id: "s1", name: "The Gilded Post", url: "thegildedpost.com", siteKey: "rb_tgp_9f27c1", verified: true, model: "revshare", clicks: 61_204, revenue: 21_842.9, addedAt: "2025-03-14", allowedDomains: ["thegildedpost.com", "www.thegildedpost.com"], verifyMethod: "snippet" },
  { id: "s2", name: "Circuit & Ember", url: "circuitember.io", siteKey: "rb_cne_44a8d2", verified: true, model: "revshare", clicks: 24_118, revenue: 9_114.2, addedAt: "2025-05-02", allowedDomains: ["circuitember.io"], verifyMethod: "meta" },
  { id: "s3", name: "Velvet Ledger Blog", url: "velvetledger.blog", siteKey: "rb_vlb_77e3b9", verified: false, model: "subscription", clicks: 2_904, revenue: 1_102.4, addedAt: "2025-12-19", allowedDomains: ["velvetledger.blog"], verifyMethod: "snippet" },
];

export const TEAM: TeamUser[] = [
  { id: "t1", name: "Ava Sterling", email: "publisher@revbounce.com", role: "owner", addedAt: "2025-03-14" },
  { id: "t2", name: "Rhys Calloway", email: "rhys@sterlingmedia.co", role: "manager", addedAt: "2025-06-02" },
  { id: "t3", name: "Nina Duarte", email: "nina@sterlingmedia.co", role: "analyst", addedAt: "2025-09-18" },
];

export const PAYOUT_DETAILS: PayoutDetails = {
  method: "wire", handle: "Chase ····4281", taxFormOnFile: true, minimumPayout: 100,
};

// ASSUME (Sec.15 defaults): frequency cap 1 impression / 24h,
// exit-intent primary trigger with idle fallback at 45s.
export const POPS: Pop[] = [
  {
    id: "p1", siteId: "s1", campaignId: "c1", campaignIds: ["c1", "c3"], slotEnabled: [true, true],
    name: "Exit — Travel Voucher", kind: "offer", template: "velvet", status: "active",
    trigger: { type: "exit", value: 0 }, maxImpressions: 1, perHours: 24, devices: ["desktop", "mobile"],
    headline: "ARE YOU STILL THERE?",
    sub: "Exclusive Offers for You — your $500 travel voucher is waiting.",
    ctaText: "YES, SHOW ME", ctaUrl: "https://offers.revbounce.com/azure",
    bg: "#ffffff", accent: "#8B5CF6",
    image: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=900&auto=format&fit=crop",
    yesColor: "#0066FF", noColor: "#FF2D2D", imagePosition: "left", showCounter: true,
    closeOnYes: true, closeOnFinalNo: true,
    design: { ...DEFAULT_DESIGN }, rules: { ...DEFAULT_RULES },
    targeting: { ...DEFAULT_TARGETING }, frequency: { ...DEFAULT_FREQUENCY },
    integrations: { ...DEFAULT_INTEGRATIONS, gaId: "G-8XQ2RB01", fbPixel: "418822901" },
    version: 4, versions: [
      { v: 4, publishedAt: "2026-01-12 09:14", note: "Counter enabled, added Lumina to slot 2" },
      { v: 3, publishedAt: "2025-12-28 16:02", note: "New headline copy" },
      { v: 2, publishedAt: "2025-11-30 11:41", note: "Mobile fallback to back-button" },
      { v: 1, publishedAt: "2025-10-04 08:20", note: "Initial publish" },
    ],
    stats: { impressions: 96_420, clicks: 9_733, conversions: 2_102, closes: 84_910 },
  },
  {
    id: "p2", siteId: "s1", campaignId: "c2", campaignIds: ["c2"], slotEnabled: [true],
    name: "Idle — VPN Trial", kind: "offer", template: "sovereign", status: "active",
    trigger: { type: "idle", value: 45 }, maxImpressions: 1, perHours: 48, devices: ["desktop"],
    headline: "Your connection is exposed right now",
    sub: "NovaShield encrypts everything in one click. Try it free for 30 days — no card required.",
    ctaText: "Activate Free Trial", ctaUrl: "https://offers.revbounce.com/novashield",
    bg: "#ffffff", accent: "#8B5CF6",
    image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=900&auto=format&fit=crop",
    yesColor: "#0066FF", noColor: "#FF2D2D", imagePosition: "background", showCounter: false,
    closeOnYes: true, closeOnFinalNo: true,
    design: { ...DEFAULT_DESIGN, animation: "zoom", size: "L" },
    rules: { ...DEFAULT_RULES, trigger: "idle", idleSeconds: 45, devices: ["desktop"] },
    targeting: { ...DEFAULT_TARGETING, visitor: "returning" }, frequency: { ...DEFAULT_FREQUENCY, cooldownHours: 48 },
    integrations: { ...DEFAULT_INTEGRATIONS },
    version: 2, versions: [
      { v: 2, publishedAt: "2026-01-05 13:55", note: "Idle 60s to 45s" },
      { v: 1, publishedAt: "2025-11-18 10:12", note: "Initial publish" },
    ],
    stats: { impressions: 41_300, clicks: 3_812, conversions: 244, closes: 36_002 },
  },
  {
    id: "p3", siteId: "s2", campaignId: "c4", campaignIds: ["c4", "c2", "c5"], slotEnabled: [true, true, false],
    name: "Scroll — Sponsored Picks", kind: "offer", template: "ribbon", status: "active",
    trigger: { type: "scroll", value: 70 }, maxImpressions: 2, perHours: 24, devices: ["desktop", "mobile"],
    headline: "Sponsored: readers also explored these trending offers",
    sub: "Hand-picked deals from our premium feed partners.",
    ctaText: "Explore Deals", ctaUrl: "https://offers.revbounce.com/feed",
    bg: "#ffffff", accent: "#8B5CF6",
    image: "",
    yesColor: "#0066FF", noColor: "#FF2D2D", imagePosition: "top", showCounter: true,
    closeOnYes: false, closeOnFinalNo: true,
    design: { ...DEFAULT_DESIGN, size: "S", animation: "slide" },
    rules: { ...DEFAULT_RULES, includePaths: "/deals/*\n/reviews/*" },
    targeting: { ...DEFAULT_TARGETING }, frequency: { ...DEFAULT_FREQUENCY, maxPerDay: 2 },
    integrations: { ...DEFAULT_INTEGRATIONS },
    version: 3, versions: [
      { v: 3, publishedAt: "2026-01-09 07:31", note: "Slot 3 disabled (cap reached)" },
      { v: 2, publishedAt: "2025-12-11 19:05", note: "Path rules tightened" },
      { v: 1, publishedAt: "2025-10-22 12:00", note: "Initial publish" },
    ],
    stats: { impressions: 128_700, clicks: 21_044, conversions: 21_044, closes: 96_330 },
  },
  {
    id: "p4", siteId: "s2", campaignId: null, campaignIds: [], slotEnabled: [],
    name: "Email Capture — Sunday Cable Car", kind: "email-capture", template: "corner", status: "paused",
    trigger: { type: "timed", value: 20 }, maxImpressions: 1, perHours: 72, devices: ["mobile"],
    headline: "One slow-travel essay, every Sunday",
    sub: "Zero urgency, zero spam. Join 40,000 readers.",
    ctaText: "Subscribe", ctaUrl: "",
    bg: "#ffffff", accent: "#8B5CF6",
    image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=900&auto=format&fit=crop",
    yesColor: "#0066FF", noColor: "#FF2D2D", imagePosition: "top", showCounter: false,
    closeOnYes: true, closeOnFinalNo: true,
    design: { ...DEFAULT_DESIGN, size: "S" },
    rules: { ...DEFAULT_RULES, trigger: "idle", idleSeconds: 20, devices: ["mobile"] },
    targeting: { ...DEFAULT_TARGETING }, frequency: { ...DEFAULT_FREQUENCY, mode: "session" },
    integrations: { ...DEFAULT_INTEGRATIONS, emailProvider: "mailchimp", emailListId: "aud_9921" },
    version: 1, versions: [{ v: 1, publishedAt: "2025-12-20 15:44", note: "Initial publish" }],
    stats: { impressions: 18_220, clicks: 1_931, conversions: 402, closes: 15_884 },
  },
  {
    id: "p5", siteId: "s3", campaignId: null, campaignIds: ["c6"], slotEnabled: [true],
    name: "Draft — Winter Skincare", kind: "offer", template: "velvet", status: "draft",
    trigger: { type: "exit", value: 0 }, maxImpressions: 1, perHours: 24, devices: ["desktop", "mobile"],
    headline: "Before you go — a free sample box",
    sub: "Dermatologist-approved, loved by 40k+ subscribers.",
    ctaText: "Get My Box", ctaUrl: "https://offers.revbounce.com/aura",
    bg: "#ffffff", accent: "#8B5CF6",
    image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=900&auto=format&fit=crop",
    yesColor: "#0066FF", noColor: "#FF2D2D", imagePosition: "right", showCounter: true,
    closeOnYes: true, closeOnFinalNo: true,
    design: { ...DEFAULT_DESIGN }, rules: { ...DEFAULT_RULES },
    targeting: { ...DEFAULT_TARGETING }, frequency: { ...DEFAULT_FREQUENCY },
    integrations: { ...DEFAULT_INTEGRATIONS },
    version: 0, versions: [],
    stats: { impressions: 0, clicks: 0, conversions: 0, closes: 0 },
  },
];

// ── Deterministic 60-day series (seeded PRNG so SSR/CSR agree) ──
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildSeries(days: number): DayPoint[] {
  const rnd = mulberry32(20260117);
  const out: DayPoint[] = [];
  const now = new Date("2026-01-17T12:00:00Z").getTime();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 86_400_000);
    const weekly = 1 + 0.22 * Math.sin((days - i) / 4.7);
    const trend = 1 + ((days - i) / days) * 0.35;
    const impressions = Math.round((14_200 + rnd() * 5_800) * weekly * trend);
    const clicks = Math.round(impressions * (0.082 + rnd() * 0.028));
    const conversions = Math.round(clicks * (0.19 + rnd() * 0.09));
    const revenue = +(conversions * (7.4 + rnd() * 5.8)).toFixed(2);
    out.push({
      day: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      revenue, clicks, impressions, conversions,
    });
  }
  return out;
}

/** last 30 days — legacy consumers */
export const SERIES_30D: DayPoint[] = buildSeries(60).slice(-30);
/** full 60 days — powers §5.1 "compare vs previous period" */
export const SERIES_60D: DayPoint[] = buildSeries(60);

const COUNTRIES = ["US", "UK", "CA", "AU", "DE", "FR", "NL", "SE"];
export const COUNTRY_SPLIT: { code: string; share: number }[] = [
  { code: "US", share: 46 }, { code: "UK", share: 14 }, { code: "CA", share: 11 },
  { code: "AU", share: 8 }, { code: "DE", share: 7 }, { code: "FR", share: 6 },
  { code: "NL", share: 5 }, { code: "Other", share: 3 },
];

export function seedLiveEvents(count: number): TrackEvent[] {
  const rnd = mulberry32(42);
  const types: TrackEvent["type"][] = ["impression", "impression", "impression", "close", "close", "click", "click", "conversion"];
  const sites = ["The Gilded Post", "Circuit & Ember", "Velvet Ledger Blog"];
  const camps = ["Azure Travel Club", "NovaShield VPN", "Lumina Insurance", "Google Click Feed"];
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const type = types[Math.floor(rnd() * types.length)];
    return {
      id: `e${i}_${Math.floor(rnd() * 1e6)}`,
      ts: now - i * 4_000 - Math.floor(rnd() * 9_000),
      type,
      site: sites[Math.floor(rnd() * sites.length)],
      campaign: camps[Math.floor(rnd() * camps.length)],
      country: COUNTRIES[Math.floor(rnd() * COUNTRIES.length)],
      device: (rnd() > 0.42 ? "desktop" : "mobile") as "desktop" | "mobile",
      revenue: type === "conversion" ? +(1.85 + rnd() * 36).toFixed(2) : 0,
    };
  }).sort((a, b) => b.ts - a.ts);
}

export const INVOICES: Invoice[] = [
  { id: "INV-2041", date: "Jan 1, 2026", description: "Growth plan — monthly", amount: 149, status: "paid" },
  { id: "INV-2017", date: "Dec 1, 2025", description: "Growth plan — monthly", amount: 149, status: "paid" },
  { id: "INV-1990", date: "Nov 1, 2025", description: "Growth plan + 12,400 overage clicks", amount: 273, status: "paid" },
  { id: "INV-1962", date: "Oct 1, 2025", description: "Growth plan — monthly", amount: 149, status: "paid" },
];

export const PAYOUTS: Payout[] = [
  { id: "PO-0917", date: "Jan 15, 2026", method: "Wire ····4281", amount: 8_412.55, status: "processing" },
  { id: "PO-0901", date: "Jan 1, 2026", method: "Wire ····4281", amount: 14_202.31, status: "paid" },
  { id: "PO-0884", date: "Dec 15, 2025", method: "Wire ····4281", amount: 11_990.84, status: "paid" },
  { id: "PO-0861", date: "Dec 1, 2025", method: "PayPal", amount: 10_482.11, status: "paid" },
  { id: "PO-0843", date: "Nov 15, 2025", method: "Wire ····4281", amount: 9_204.66, status: "paid" },
];

export const INTEGRATIONS: Integration[] = [
  { id: "mailchimp", name: "Mailchimp", category: "Email", description: "Push captured leads into any audience with field mapping.", connected: true, syncedLeads: 4_812, logoColor: "#ffe01b" },
  { id: "klaviyo", name: "Klaviyo", category: "Email", description: "Trigger flows the moment a pop converts.", connected: false, syncedLeads: 0, logoColor: "#2bd96b" },
  { id: "convertkit", name: "Kit (ConvertKit)", category: "Email", description: "Tag & segment subscribers from SOI campaigns.", connected: true, syncedLeads: 1_930, logoColor: "#fb6970" },
  { id: "activecampaign", name: "ActiveCampaign", category: "Automation", description: "Create contacts + automations on conversion.", connected: false, syncedLeads: 0, logoColor: "#356ae6" },
  { id: "zapier", name: "Zapier", category: "Automation", description: "Connect RevBounce events to 6,000+ apps.", connected: false, syncedLeads: 0, logoColor: "#ff4a00" },
  { id: "webhooks", name: "Webhooks", category: "Data", description: "Server-to-server postbacks for every event.", connected: true, syncedLeads: 28_404, logoColor: "#8b5cf6" },
];

export const PUBLISHERS: PublisherRow[] = [
  { id: "u_pub", name: "Ava Sterling", company: "Sterling Media Co.", sites: 3, model: "revshare", split: 70, clicks30d: 61_204, revenue30d: 21_842.9, status: "active" },
  { id: "pb2", name: "Daniel Okafor", company: "Ember Digital", sites: 2, model: "revshare", split: 65, clicks30d: 38_551, revenue30d: 12_110.7, status: "active" },
  { id: "pb3", name: "Mira Chen", company: "Lotus Publishing", sites: 5, model: "subscription", split: 100, clicks30d: 91_302, revenue30d: 31_774.4, status: "active" },
  { id: "pb4", name: "Jonas Weber", company: "Weber Mediahaus", sites: 1, model: "revshare", split: 72, clicks30d: 9_812, revenue30d: 3_104.2, status: "active" },
  { id: "pb5", name: "Sofia Rossi", company: "Rossi Lifestyle", sites: 4, model: "revshare", split: 68, clicks30d: 44_901, revenue30d: 15_208.9, status: "suspended" },
];

// §5.1 quick-math helpers — platform formulas:
// CTR = clicks/impressions · eCPM = revenue/impressions×1000 · EPC = revenue/clicks
export const ctr = (clicks: number, impressions: number) => (impressions ? (clicks / impressions) * 100 : 0);
export const ecpm = (revenue: number, impressions: number) => (impressions ? (revenue / impressions) * 1000 : 0);
export const epc = (revenue: number, clicks: number) => (clicks ? revenue / clicks : 0);

export const TESTIMONIALS = [
  {
    quote: "We installed one snippet on a Sunday. By Friday, exit traffic we were literally throwing away paid for the quarter. RevBounce is the closest thing to free money I've seen in 12 years of publishing.",
    name: "Ava Sterling", role: "Founder, The Gilded Post",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop",
  },
  {
    quote: "The auto-optimizer quietly rotates nine campaigns and just… finds the EPC. Our revenue per session is up 41% and I have touched the code exactly zero times since onboarding.",
    name: "Daniel Okafor", role: "CEO, Ember Digital",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=200&auto=format&fit=crop",
  },
  {
    quote: "Frequency capping done right is why we stayed. Readers never feel ambushed, and our bounce rate didn't move a point. The 70/30 split settles like clockwork, twice a month.",
    name: "Mira Chen", role: "Director, Lotus Publishing",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200&auto=format&fit=crop",
  },
];

// ── Formatters ──
export const fmtMoney = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtNum = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : `${n}`;

export const fmtFull = (n: number) => n.toLocaleString("en-US");

export const timeAgo = (ts: number) => {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export const SNIPPET_CODE = (key: string, origin = "https://app.revbounce.io") =>
  `<script src="${origin}/embed.js?s=${key}" async></script>`;

/* ─────────── §5.5 Email Records ─────────── */
const EMAIL_NAMES = ["ava.r", "j.mercer", "l.okonkwo", "d.silva", "m.tanaka", "h.bauer", "s.novak", "c.dupont", "r.wallace", "n.haddad", "t.lindqvist", "p.rossi"];
const EMAIL_DOMAINS = ["gmail.com", "outlook.com", "proton.me", "icloud.com", "fastmail.com"];

export const EMAIL_RECORDS: EmailRecord[] = (() => {
  const rnd = mulberry32(77);
  const statuses: EmailRecord["status"][] = ["delivered", "delivered", "delivered", "delivered", "failed", "duplicate", "invalid", "pending"];
  const sites = ["The Gilded Post", "Circuit & Ember", "Velvet Ledger Blog"];
  const pops = ["Email Capture — Sunday Cable Car", "Exit — Travel Voucher"];
  const triggers = ["exit-intent", "idle 30s", "timed 20s", "scroll 70%"];
  const devices: EmailRecord["device"][] = ["desktop", "mobile", "tablet"];
  const now = Date.now();
  return Array.from({ length: 48 }, (_, i) => {
    const status = statuses[Math.floor(rnd() * statuses.length)];
    return {
      id: `em_${i}_${Math.floor(rnd() * 1e5)}`,
      email: `${EMAIL_NAMES[Math.floor(rnd() * EMAIL_NAMES.length)]}${Math.floor(rnd() * 90 + 10)}@${EMAIL_DOMAINS[Math.floor(rnd() * EMAIL_DOMAINS.length)]}`,
      ts: now - i * 2_400_000 - Math.floor(rnd() * 900_000),
      site: sites[Math.floor(rnd() * sites.length)],
      pop: pops[Math.floor(rnd() * pops.length)],
      device: devices[Math.floor(rnd() * devices.length)],
      trigger: triggers[Math.floor(rnd() * triggers.length)],
      status,
      channel: (rnd() > 0.35 ? "api" : "ftp") as "api" | "ftp",
      provider: rnd() > 0.35 ? "Mailchimp" : "SFTP · partner-drop",
    };
  });
})();

/* ─────────── §5.5 Payout periods (admin approval flow) ─────────── */
export const PAYOUT_PERIODS: PayoutPeriod[] = [
  { id: "pp_2601b", period: "Jan 1–15, 2026", publisher: "Ava Sterling", publisherId: "u_pub", gross: 12_017.93, split: 70, net: 8_412.55, status: "pending", method: "Wire ····4281" },
  { id: "pp_2601a", period: "Dec 16–31, 2025", publisher: "Ava Sterling", publisherId: "u_pub", gross: 20_289.01, split: 70, net: 14_202.31, status: "paid", method: "Wire ····4281" },
  { id: "pp_2601c", period: "Jan 1–15, 2026", publisher: "Daniel Okafor", publisherId: "pb2", gross: 9_204.11, split: 65, net: 5_982.67, status: "approved", method: "PayPal" },
  { id: "pp_2601d", period: "Jan 1–15, 2026", publisher: "Mira Chen", publisherId: "pb3", gross: 15_880.4, split: 100, net: 15_880.4, status: "pending", method: "Bank · DBS" },
  { id: "pp_2512e", period: "Dec 16–31, 2025", publisher: "Jonas Weber", publisherId: "pb4", gross: 2_140.9, split: 72, net: 1_541.45, status: "paid", method: "USDT (TRC-20)" },
  { id: "pp_2512f", period: "Dec 16–31, 2025", publisher: "Sofia Rossi", publisherId: "pb5", gross: 7_611.2, split: 68, net: 5_175.62, status: "approved", method: "Wire ····9930" },
];

export const SAVED_REPORTS: SavedReport[] = [
  { id: "sr1", name: "Weekly revenue by campaign", view: "Campaign", groupBy: "campaign", range: 7, createdAt: "2025-12-02", scheduled: "weekly" },
  { id: "sr2", name: "Geo performance — 30d", view: "Geo", groupBy: "country", range: 30, createdAt: "2025-11-14", scheduled: "monthly" },
  { id: "sr3", name: "Mobile device check", view: "Device", groupBy: "device", range: 14, createdAt: "2026-01-04", scheduled: "none" },
];

/* CSV helper used by every §5.5 export button */
export function toCsv(rows: Record<string, string | number>[]): string {
  if (!rows.length) return "";
  const head = Object.keys(rows[0]);
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [head.join(","), ...rows.map((r) => head.map((h) => esc(r[h])).join(","))].join("\n");
}

export function downloadCsv(filename: string, rows: Record<string, string | number>[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ─────────── §5.6 Settings seeds ─────────── */
export const API_KEYS: ApiKey[] = [
  { id: "k1", label: "Reporting — Looker Studio", prefix: "rb_live_9f27", scopes: ["read:reports"], createdAt: "2025-08-11", lastUsed: "2 hours ago" },
  { id: "k2", label: "Ops automation", prefix: "rb_live_44a8", scopes: ["read:reports", "read:pops", "write:pops"], createdAt: "2025-11-02", lastUsed: "yesterday" },
];

export const BRANDING: Branding = {
  showPoweredBy: true, brandName: "Sterling Media Co.", accent: "#d9b380",
  logoUrl: "", customDomain: "",
};

export const RETENTION: Retention = { events: 365, emails: 730, autoPurgePii: true };

export const GLOBAL_POSTBACKS: GlobalPostbacks = {
  everflow: "https://www.everflowclient.io/?nid=4821&transaction_id={click_id}&amount={payout}",
  twyne: "", enabled: true,
};

export const SECURITY: Security = { twoFactor: false, method: "app" };

/* ─────────── §5.7 Admin seeds ─────────── */
export const ADVERTISERS: Advertiser[] = [
  { id: "ad1", name: "Azure Media Partners", contact: "ops@azuremedia.example", campaigns: 3, spend30d: 42_118.4, status: "active" },
  { id: "ad2", name: "NovaShield Ltd.", contact: "lena@novashield.example", campaigns: 2, spend30d: 61_902.1, status: "active" },
  { id: "ad3", name: "Lumina Leads", contact: "partners@lumina.example", campaigns: 1, spend30d: 18_440.7, status: "active" },
  { id: "ad4", name: "PrizeVault Network", contact: "aff@prizevault.example", campaigns: 2, spend30d: 9_204.3, status: "paused" },
  { id: "ad5", name: "BeautyHaus Direct", contact: "growth@beautyhaus.example", campaigns: 1, spend30d: 12_880.9, status: "active" },
];

export const AUDIT_LOG: AuditEntry[] = (() => {
  const rnd = mulberry32(1337);
  const actions: [string, string][] = [
    ["published pop version", "Exit — Travel Voucher v4"],
    ["changed revenue split", "Daniel Okafor · 65 → 68"],
    ["approved payout", "pp_2601c · $5,982.67"],
    ["suspended publisher", "Sofia Rossi"],
    ["created campaign", "Aura Skincare — Free Sample Box"],
    ["rotated API key", "rb_live_44a8"],
    ["flagged invalid clicks", "velvetledger.blog · 412 clicks"],
    ["impersonated publisher", "Mira Chen"],
    ["updated plan tier", "Growth · 50k → 60k included clicks"],
    ["deleted pop", "Legacy Offer Wall test"],
  ];
  const actors = ["Marcus Vane (admin)", "Ava Sterling (publisher)", "system", "Rhys Calloway (manager)"];
  const now = Date.now();
  return Array.from({ length: 14 }, (_, i) => {
    const [action, target] = actions[Math.floor(rnd() * actions.length)];
    return {
      id: `au_${i}`, ts: now - i * 5_400_000 - Math.floor(rnd() * 1_800_000),
      actor: actors[Math.floor(rnd() * actors.length)], action, target,
      ip: `${Math.floor(rnd() * 200 + 20)}.${Math.floor(rnd() * 250)}.${Math.floor(rnd() * 250)}.${Math.floor(rnd() * 250)}`,
    };
  });
})();

export const FEATURE_FLAGS: FeatureFlag[] = [
  { id: "ff_popunder", label: "Pop-under placements", description: "Policy-gated background tab unit (Phase 8).", on: false, rollout: 0 },
  { id: "ff_offerwall", label: "Offer Wall", description: "Grid placement where the visitor picks an offer.", on: false, rollout: 15 },
  { id: "ff_mlopt", label: "ML optimizer v2", description: "Thompson-sampling rotation replacing greedy EPC weights.", on: true, rollout: 45 },
  { id: "ff_mxcheck", label: "MX record validation", description: "Verify mail exchanger before accepting a lead.", on: true, rollout: 100 },
  { id: "ff_scrollup", label: "Mobile scroll-up exit", description: "Fast scroll-up heuristic as a mobile exit trigger.", on: false, rollout: 5 },
  { id: "ff_selfserve", label: "Advertiser self-serve login", description: "Let advertisers manage their own campaigns.", on: true, rollout: 100 },
];

export const FRAUD_FLAGS: FraudFlag[] = [
  { id: "fr1", ts: Date.now() - 3_600_000, site: "velvetledger.blog", reason: "Click velocity 14× baseline from a single /24 subnet", clicks: 412, severity: "high", status: "open" },
  { id: "fr2", ts: Date.now() - 27_000_000, site: "circuitember.io", reason: "Datacenter ASN share above 22% on YES clicks", clicks: 168, severity: "medium", status: "open" },
  { id: "fr3", ts: Date.now() - 86_400_000, site: "thegildedpost.com", reason: "Repeated identical UA + zero dwell time", clicks: 54, severity: "low", status: "cleared" },
  { id: "fr4", ts: Date.now() - 172_800_000, site: "velvetledger.blog", reason: "Duplicate lead fingerprints across 3 pops", clicks: 96, severity: "medium", status: "withheld" },
];

/* ─────────── §6 Email capture config ─────────── */
export const EMAIL_CONFIG: EmailCaptureConfig = {
  successMessage: "You're in! Check your inbox to confirm.",
  closeAfterSuccess: true,
  duplicateRule: "block-pop-days",
  duplicateDays: 30,
  duplicateMessage: "You're already subscribed — thanks for the enthusiasm!",
  checkMx: true,
  blockDisposable: true,
  requireConsent: false,
  api: {
    endpoint: "https://api.mailchimp.example/3.0/lists/aud_9921/members",
    method: "POST", authType: "bearer", authValue: "••••••••••••",
    headers: "Content-Type: application/json",
    mapping: [
      { field: "email", param: "email_address" },
      { field: "timestamp", param: "signed_up" },
      { field: "site_id", param: "merge_fields.SITE" },
      { field: "pop_id", param: "merge_fields.POP" },
      { field: "device", param: "merge_fields.DEVICE" },
      { field: "trigger", param: "merge_fields.TRIGGER" },
      { field: "source", param: "merge_fields.SOURCE" },
    ],
    maxRetries: 5,
  },
  ftp: {
    enabled: true, protocol: "sftp", host: "drop.partner.example", port: 22,
    username: "revbounce", password: "••••••••••", useKey: true,
    remotePath: "/inbound/leads", filenamePattern: "{site}_{date}_{time}.csv",
    frequency: "hourly",
  },
};
