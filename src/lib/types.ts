// ─────────────────────────────────────────────────────────────
// RevBounce — Core domain types (dummy-data mode, no database)
// ─────────────────────────────────────────────────────────────

export type Role = "admin" | "publisher" | "advertiser";

export type PlanId = "revshare" | "starter" | "growth" | "enterprise";

export type BusinessModel = "revshare" | "subscription";

export interface Plan {
  id: PlanId;
  name: string;
  price: number; // monthly, USD
  tagline: string;
  includedClicks: number; // -1 = unlimited
  overageRate: number; // USD per extra click
  sites: number; // -1 = unlimited
  pops: number; // -1 = unlimited
  features: string[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  company: string;
  avatar: string;
  plan: PlanId;
  model: BusinessModel;
  /** Revenue-share split % kept by publisher (admin-configurable) */
  split: number;
  joinedAt: string;
}

export type CampaignType = "exit-intent" | "click-feed" | "soi" | "lead-gen" | "cpa";
export type CampaignStatus = "active" | "paused" | "draft" | "library";
export type PayoutModel = "CPC" | "CPA" | "SOI" | "RevShare";

/* §5.2 — the three campaign delivery kinds */
export type CampaignKind = "hostpost" | "cpa" | "gfeed";

export type FormFieldType = "text" | "email" | "phone" | "zip" | "address" | "select" | "consent";

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  required: boolean;
  /** pipe-separated options for select; regex pattern for text-ish fields */
  options?: string;
  pattern?: string;
}

export interface PostingConfig {
  endpoint: string;
  method: "POST" | "PUT";
  /** one "Header: value" per line */
  headers: string;
  authType: "none" | "apikey" | "basic" | "bearer";
  authValue: string;
  bodyFormat: "json" | "form";
  /** form field id → advertiser param name */
  mapping: { field: string; param: string }[];
  /** one "key=value" per line */
  staticParams: string;
  successStatus: number;
  successContains: string;
  duplicateRule: "skip" | "allow" | "update";
  timeoutMs: number;
  retries: number;
}

export interface Campaign {
  id: string;
  name: string;
  advertiser: string;
  type: CampaignType;
  payoutModel: PayoutModel;
  payout: number; // USD per action/click
  vertical: string;
  status: CampaignStatus;
  clicks: number;
  impressions: number;
  conversions: number;
  revenue: number;
  epc: number; // earnings per click
  countries: string[];
  devices: ("desktop" | "mobile")[];
  description: string;
  image: string;
  /** 0–100 — admin auto-optimizer weight */
  optimizerScore: number;
  /* ── §5.2 extensions ── */
  kind: CampaignKind;
  /** YES / NO button labels rendered on pops */
  yesText: string;
  noText: string;
  /** CPA Link-Out destination w/ macros {click_id},{site_id},{pop_id},{sub1..sub5},{email},{zip} */
  destUrl?: string;
  /** Google Feed URL w/ same macros */
  feedUrl?: string;
  /** caps — beyond these the campaign is auto-skipped in the sequence */
  dailyCap?: number | null;
  monthlyCap?: number | null;
  trafficSource?: "all" | "direct" | "search" | "social";
  schedule?: { start: string; end: string };
  allowedPopTypes?: string[];
  /** rotation weight 1–100 */
  weight?: number;
  /** hostpost only */
  posting?: PostingConfig;
  formSpec?: FormField[];
}

export type PopTemplate = "velvet" | "sovereign" | "ribbon" | "corner";
export type TriggerType = "exit" | "idle" | "scroll" | "timed";

/* §5.3 — pop types. V1 = offer + email-capture; the rest are
   architecturally plugged in and flagged `phase8` until built. */
export type PopKind =
  | "offer" | "email-capture"
  | "decline" | "thankyou" | "checkout-upsell" | "slide-in" | "mobile" | "offer-wall" | "in-page" | "pop-under";

export interface PopKindMeta {
  id: PopKind;
  name: string;
  blurb: string;
  v1: boolean;
  sequence: boolean; // participates in the campaign sequence
}

export interface PopDesign {
  size: "S" | "M" | "L" | "custom";
  customWidth: number;
  fontFamily: string;
  radius: number;
  overlayColor: string;
  overlayOpacity: number;
  animation: "fade" | "slide" | "zoom";
  closeStyle: "circle" | "plain" | "outside";
  customCss: string;
  successColor: string;
  errorColor: string;
}

export interface PopRules {
  trigger: "exit" | "idle";
  loadDelay: number;      // seconds before arming
  idleSeconds: number;
  devices: ("desktop" | "tablet" | "mobile")[];
  mobileFallback: "back-button" | "scroll-up" | "timer" | "none";
  includePaths: string;   // one rule per line, wildcard/regex
  excludePaths: string;
}

export interface PopTargeting {
  countries: string[];
  trafficSource: "all" | "direct" | "search" | "social" | "email" | "paid";
  visitor: "all" | "new" | "returning";
  language: string;
  browser: string;
  os: string;
}

export interface PopFrequency {
  mode: "session" | "cooldown" | "max";
  cooldownHours: number;
  maxPerDay: number;
  maxLifetime: number;
  closeCountsAsDisplay: boolean;
}

export interface PopIntegrations {
  fbPixel: string;
  gaId: string;
  gtmId: string;
  fireOn: "impression" | "yes" | "both";
  webhookUrl: string;
  everflowUrl: string;
  twyneUrl: string;
  /** email-capture delivery (Section 6) */
  emailProvider: string;
  emailListId: string;
  prefillMapping: string;
}

export interface PopVersion {
  v: number;
  publishedAt: string;
  note: string;
}

export interface PopTrigger {
  type: TriggerType;
  /** idle → seconds, scroll → percent, timed → seconds */
  value: number;
}

export interface Pop {
  id: string;
  siteId: string;
  /** legacy pointer = campaignIds[0], kept for older surfaces */
  campaignId: string | null;
  /** §5.2 — a pop picks up to 5 campaigns from the library (rotation sequence) */
  campaignIds: string[];
  /** per-slot enable/disable, parallel to campaignIds */
  slotEnabled?: boolean[];
  name: string;
  kind: PopKind;
  template: PopTemplate;
  status: "active" | "paused" | "draft" | "archived";
  /* §5.3 builder blocks */
  /** NO button label (YES label = ctaText) */
  noText?: string;
  yesColor?: string;
  noColor?: string;
  imagePosition?: "top" | "left" | "right" | "background";
  showCounter?: boolean;
  closeOnYes?: boolean;
  closeOnFinalNo?: boolean;
  design?: PopDesign;
  rules?: PopRules;
  targeting?: PopTargeting;
  frequency?: PopFrequency;
  integrations?: PopIntegrations;
  version?: number;
  versions?: PopVersion[];
  trigger: PopTrigger;
  /** frequency cap: max X impressions per Y hours per visitor */
  maxImpressions: number;
  perHours: number;
  devices: ("desktop" | "mobile")[];
  headline: string;
  sub: string;
  ctaText: string;
  ctaUrl: string;
  bg: string;
  accent: string;
  image: string;
  stats: { impressions: number; clicks: number; conversions: number; closes: number };
}

export interface Site {
  id: string;
  name: string;
  url: string;
  siteKey: string;
  verified: boolean;
  model: BusinessModel;
  clicks: number;
  revenue: number;
  addedAt: string;
  /** §5.4 — embed refuses to run on unlisted domains */
  allowedDomains?: string[];
  verifyMethod?: "snippet" | "meta";
}

export interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: "owner" | "manager" | "analyst";
  addedAt: string;
}

export interface PayoutDetails {
  method: "paypal" | "bank" | "wire" | "usdt";
  handle: string;
  taxFormOnFile: boolean;
  minimumPayout: number;
}

/** §5.5 Email Records */
export interface EmailRecord {
  id: string;
  email: string;
  ts: number;
  site: string;
  pop: string;
  device: "desktop" | "tablet" | "mobile";
  trigger: string;
  status: "delivered" | "failed" | "pending" | "duplicate" | "invalid";
  channel: "api" | "ftp";
  provider: string;
}

/** §5.5 Payouts with admin approval */
export interface PayoutPeriod {
  id: string;
  period: string;
  publisher: string;
  publisherId: string;
  gross: number;
  split: number;
  net: number;
  status: "pending" | "approved" | "paid";
  method: string;
}

export interface SavedReport {
  id: string;
  name: string;
  view: string;
  groupBy: string;
  range: number;
  createdAt: string;
  scheduled: "none" | "daily" | "weekly" | "monthly";
}

export type EventType = "impression" | "click" | "conversion" | "close";

export interface TrackEvent {
  id: string;
  ts: number;
  type: EventType;
  site: string;
  campaign: string;
  country: string;
  device: "desktop" | "mobile";
  revenue: number;
}

export interface DayPoint {
  day: string;
  revenue: number;
  clicks: number;
  impressions: number;
  conversions: number;
}

export interface Invoice {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: "paid" | "due" | "void";
}

export interface Payout {
  id: string;
  date: string;
  method: string;
  amount: number;
  status: "paid" | "pending" | "processing";
}

export interface Integration {
  id: string;
  name: string;
  category: "Email" | "Automation" | "Data";
  description: string;
  connected: boolean;
  apiKey?: string;
  syncedLeads: number;
  logoColor: string;
}

export interface PublisherRow {
  id: string;
  name: string;
  company: string;
  sites: number;
  model: BusinessModel;
  split: number;
  clicks30d: number;
  revenue30d: number;
  status: "active" | "suspended";
}

export interface Toast {
  id: string;
  title: string;
  kind: "success" | "info" | "error";
}

/* ─────────── §5.6 Settings ─────────── */
export interface ApiKey {
  id: string;
  label: string;
  prefix: string;
  scopes: ("read:reports" | "read:pops" | "write:pops")[];
  createdAt: string;
  lastUsed: string;
}

export interface Branding {
  showPoweredBy: boolean;
  brandName: string;
  accent: string;
  logoUrl: string;
  customDomain: string;
}

export interface Retention {
  events: 90 | 180 | 365 | 730;
  emails: 90 | 180 | 365 | 730;
  autoPurgePii: boolean;
}

export interface GlobalPostbacks {
  everflow: string;
  twyne: string;
  enabled: boolean;
}

export interface Security {
  twoFactor: boolean;
  method: "app" | "sms";
}

/* ─────────── §5.7 Admin ─────────── */
export interface AuditEntry {
  id: string;
  ts: number;
  actor: string;
  action: string;
  target: string;
  ip: string;
}

export interface FeatureFlag {
  id: string;
  label: string;
  description: string;
  on: boolean;
  rollout: number;
}

export interface FraudFlag {
  id: string;
  ts: number;
  site: string;
  reason: string;
  clicks: number;
  severity: "low" | "medium" | "high";
  status: "open" | "cleared" | "withheld";
}

export interface Advertiser {
  id: string;
  name: string;
  contact: string;
  campaigns: number;
  spend30d: number;
  status: "active" | "paused";
}

/* ─────────── §6 Email Capture delivery ─────────── */
export interface EmailApiConfig {
  endpoint: string;
  method: "POST" | "PUT";
  authType: "none" | "apikey" | "bearer" | "basic";
  authValue: string;
  headers: string;
  mapping: { field: string; param: string }[];
  maxRetries: number;
}

export interface EmailFtpConfig {
  enabled: boolean;
  protocol: "ftp" | "sftp";
  host: string;
  port: number;
  username: string;
  password: string;
  useKey: boolean;
  remotePath: string;
  filenamePattern: string;
  frequency: "realtime" | "hourly" | "daily";
}

export interface EmailCaptureConfig {
  successMessage: string;
  closeAfterSuccess: boolean;
  duplicateRule: "allow" | "block-site" | "block-pop" | "block-pop-days";
  duplicateDays: number;
  duplicateMessage: string;
  checkMx: boolean;
  blockDisposable: boolean;
  requireConsent: boolean;
  api: EmailApiConfig;
  ftp: EmailFtpConfig;
}
