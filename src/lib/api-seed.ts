// §9 seed — populates every in-memory model with demo data on first use.
// Mirrors what `prisma db seed` would insert.
import { insert, table, sha256 } from "@/lib/api-core";

let seeded = false;

export function ensureSeed() {
  if (seeded) return;
  seeded = true;

  /* Plans */
  ([
    ["starter", "Starter", 49, 10_000, 0.012],
    ["growth", "Growth", 149, 50_000, 0.01],
    ["enterprise", "Enterprise", 499, 250_000, 0.008],
  ] as const).forEach(([id, name, price, includedClicks, overageRate]) => {
    insert("Plan", { id, name, price, includedClicks, overageRate, features: ["pops", "campaigns", "reports"] });
  });

  /* Publishers */
  const pubs = [
    { id: "pub_1", name: "Ava Sterling", company: "Sterling Media Co.", model: "revshare", split: 70, status: "active" },
    { id: "pub_2", name: "Daniel Okafor", company: "Ember Digital", model: "revshare", split: 65, status: "active" },
    { id: "pub_3", name: "Mira Chen", company: "Lotus Publishing", model: "subscription", split: 100, status: "active" },
    { id: "pub_4", name: "Jonas Weber", company: "Weber Mediahaus", model: "revshare", split: 72, status: "active" },
    { id: "pub_5", name: "Sofia Rossi", company: "Rossi Lifestyle", model: "revshare", split: 68, status: "suspended" },
  ];
  pubs.forEach((p) => insert("Publisher", { ...p, terms: "Net-15", notes: "", createdAt: Date.now() }));

  /* Sites */
  ([
    ["site_1", "pub_1", "The Gilded Post", "thegildedpost.com", "rb_tgp_9f27c1", true],
    ["site_2", "pub_1", "Circuit & Ember", "circuitember.io", "rb_cne_44a8d2", true],
    ["site_3", "pub_1", "Velvet Ledger Blog", "velvetledger.blog", "rb_vlb_77e3b9", false],
  ] as const).forEach(([id, publisherId, name, domain, siteKey, verified]) => {
    insert("Site", { id, publisherId, name, domain, siteKey, allowedDomains: [domain, `www.${domain}`], verified, verifyMethod: "snippet", createdAt: Date.now() });
  });

  /* Advertisers */
  ([
    ["adv_1", "Azure Media Partners", "ops@azuremedia.example"],
    ["adv_2", "NovaShield Ltd.", "lena@novashield.example"],
    ["adv_3", "Lumina Leads", "partners@lumina.example"],
    ["adv_4", "PrizeVault Network", "aff@prizevault.example"],
    ["adv_5", "BeautyHaus Direct", "growth@beautyhaus.example"],
  ] as const).forEach(([id, name, contact]) => insert("Advertiser", { id, name, contact, status: "active", createdAt: Date.now() }));

  /* Campaigns (+ form fields + post configs) */
  const camps = [
    { id: "c1", advertiserId: "adv_1", advertiserName: "Azure Media Partners", name: "Azure Travel Club — $500 Voucher", kind: "hostpost", payoutModel: "SOI", payout: 2.4, status: "active", impressions: 214_981, clicks: 18_432, conversions: 3_912, revenue: 9_388.8, weight: 90, capped: false },
    { id: "c2", advertiserId: "adv_2", advertiserName: "NovaShield Ltd.", name: "NovaShield VPN — 30-Day Trial", kind: "cpa", payoutModel: "CPA", payout: 38, status: "active", impressions: 122_400, clicks: 9_214, conversions: 618, revenue: 23_484, weight: 85, capped: false, destUrl: "https://example.com/novashield?click_id={click_id}" },
    { id: "c3", advertiserId: "adv_3", advertiserName: "Lumina Leads", name: "Lumina Insurance Compare", kind: "hostpost", payoutModel: "CPA", payout: 14, status: "active", impressions: 88_300, clicks: 6_102, conversions: 940, revenue: 13_160, weight: 78, capped: false },
    { id: "c4", advertiserId: "adv_1", advertiserName: "RevBounce Demand", name: "Google Click Feed — Tier 1", kind: "gfeed", payoutModel: "CPC", payout: 0.32, status: "active", impressions: 390_120, clicks: 41_870, conversions: 41_870, revenue: 13_398.4, weight: 70, capped: false, feedUrl: "https://example.com/feed?click_id={click_id}" },
    { id: "c5", advertiserId: "adv_4", advertiserName: "PrizeVault Network", name: "iPhone 17 Pro Sweepstakes", kind: "cpa", payoutModel: "SOI", payout: 1.85, status: "active", impressions: 178_004, clicks: 12_660, conversions: 2_403, revenue: 4_445.55, weight: 55, capped: true, destUrl: "https://example.com/sweeps?click_id={click_id}" },
    { id: "c6", advertiserId: "adv_5", advertiserName: "BeautyHaus Direct", name: "Aura Skincare — Free Sample Box", kind: "cpa", payoutModel: "CPA", payout: 27, status: "library", impressions: 0, clicks: 0, conversions: 0, revenue: 0, weight: 68, capped: false },
    { id: "c7", advertiserId: "adv_3", advertiserName: "FinEdu Group", name: "CryptoIQ Masterclass Webinar", kind: "hostpost", payoutModel: "CPA", payout: 9.5, status: "library", impressions: 0, clicks: 0, conversions: 0, revenue: 0, weight: 60, capped: false },
  ];
  camps.forEach((c) => insert("Campaign", { ...c, type: c.kind, vertical: "General", geo: ["US"], devices: ["desktop", "mobile"], createdAt: Date.now() }));

  insert("CampaignFormField", { campaignId: "c1", type: "email", label: "Email address", required: true, order: 1, prefillAllowed: true });
  insert("CampaignFormField", { campaignId: "c1", type: "zip", label: "ZIP code", required: true, pattern: "^[0-9]{5}$", order: 2, prefillAllowed: true });
  insert("CampaignPostConfig", {
    campaignId: "c1", endpoint: "https://leads.azuremedia.example/v2/intake", method: "POST",
    headers: "X-Source: revbounce", authType: "bearer", authValueEnc: "aes-256-gcm:" + sha256("azure-secret").slice(0, 24),
    bodyFormat: "json", mapping: [{ field: "email", param: "subscriber_email" }, { field: "zip", param: "postal" }],
    staticParams: "offer=travel-club-500", successStatus: 200, successContains: "accepted",
    duplicateRule: "skip", timeoutMs: 3000, retries: 2,
  });

  /* Pops + versions + slots */
  insert("Pop", { id: "p1", siteId: "site_1", name: "Exit — Travel Voucher", kind: "offer", template: "velvet", status: "active", currentVersion: 4, createdAt: Date.now() });
  insert("Pop", { id: "p2", siteId: "site_1", name: "Idle — VPN Trial", kind: "offer", template: "sovereign", status: "active", currentVersion: 2, createdAt: Date.now() });
  insert("Pop", { id: "p4", siteId: "site_2", name: "Email Capture — Sunday Cable Car", kind: "email-capture", template: "corner", status: "paused", currentVersion: 1, createdAt: Date.now() });
  [1, 2, 3, 4].forEach((v) => insert("PopVersion", { popId: "p1", version: v, snapshot: { v }, note: `v${v} publish`, publishedAt: Date.now() - v * 86_400_000, publishedBy: "u_pub" }));
  insert("PopVersion", { popId: "p2", version: 1, snapshot: { v: 1 }, note: "initial", publishedAt: Date.now(), publishedBy: "u_pub" });
  insert("PopVersion", { popId: "p2", version: 2, snapshot: { v: 2 }, note: "idle 45s", publishedAt: Date.now(), publishedBy: "u_pub" });
  insert("PopVersion", { popId: "p4", version: 1, snapshot: { v: 1 }, note: "initial", publishedAt: Date.now(), publishedBy: "u_pub" });
  ([["p1", "c1", 1], ["p1", "c3", 2], ["p1", "c4", 3], ["p2", "c2", 1]] as const).forEach(([popId, campaignId, slot]) => {
    insert("PopCampaign", { popId, campaignId, slot, order: slot, enabled: true });
  });

  /* Visitors / sessions */
  for (let i = 0; i < 6; i++) {
    const vid = `vis_${i}_${Math.random().toString(36).slice(2, 8)}`;
    insert("Visitor", { siteId: "site_1", anonId: vid, firstSeen: Date.now() - i * 3_600_000, lastSeen: Date.now(), consent: true });
    insert("Session", { visitorId: vid, siteId: "site_1", startedAt: Date.now() - i * 1_800_000, lastEventAt: Date.now(), userAgentHash: sha256("ua" + i).slice(0, 16), country: "US", region: "CA" });
  }

  /* Email records + deliveries */
  const statuses = ["success", "failed", "duplicate", "invalid", "success", "success"];
  statuses.forEach((st, i) => {
    const rec = insert("EmailRecord", {
      siteId: "site_1", publisherId: "pub_1", popId: "p4",
      email: `reader${i}@example.com`, emailHash: sha256(`reader${i}@example.com`),
      device: i % 2 ? "mobile" : "desktop", trigger: "idle", pageUrl: "https://thegildedpost.com/journal",
      consent: true, apiStatus: st, ftpStatus: i % 3 === 0 ? "queued" : "success",
      lastError: st === "failed" ? "upstream 503" : "", createdAt: Date.now() - i * 900_000,
    });
    insert("EmailDelivery", { emailRecordId: rec.id, channel: "api", attempt: 1, status: st === "failed" ? "failed" : "success", httpStatus: st === "failed" ? 503 : 200, latencyMs: 120 + i * 20, responseMasked: { body: st === "failed" ? "retry" : "accepted" }, createdAt: Date.now() });
    if (i % 3 === 0) insert("EmailDelivery", { emailRecordId: rec.id, channel: "ftp", attempt: 1, status: "success", httpStatus: 0, latencyMs: 410, responseMasked: { file: "rb_tgp_20260117_090000.csv" }, createdAt: Date.now() });
  });

  /* Email integration */
  insert("EmailIntegration", { publisherId: "pub_1", provider: "mailchimp", endpoint: "https://api.mailchimp.example/3.0/lists/aud_9921/members", authType: "bearer", secretEnc: "aes-256-gcm:" + sha256("mc").slice(0, 24), ftpHost: "drop.partner.example", ftpPort: 22, remotePath: "/inbound/leads", filenamePattern: "{site}_{date}_{time}.csv", frequency: "hourly", enabled: true });

  /* Clicks / conversions / submissions / daily stats */
  for (let i = 0; i < 8; i++) {
    const clickId = `cl_seed_${i}`;
    insert("ClickLog", { clickId, siteId: "site_1", popId: "p1", campaignId: i % 2 ? "c2" : "c4", visitorId: `vis_${i % 6}`, sessionId: `sess_${i}`, country: "US", createdAt: Date.now() - i * 600_000, invalid: i === 7 });
    if (i % 2 === 0) {
      const payout = i % 4 === 0 ? 38 : 0.32;
      insert("Conversion", { clickId, campaignId: i % 2 ? "c2" : "c4", siteId: "site_1", publisherId: "pub_1", payout, publisherShare: +(payout * 0.7).toFixed(4), platformShare: +(payout * 0.3).toFixed(4), status: "approved", source: "postback", createdAt: Date.now() - i * 600_000 });
    }
  }
  insert("Submission", { campaignId: "c1", siteId: "site_1", popId: "p1", payloadMasked: { email: "re•••@example.com" }, responseMasked: { status: 200, body: "accepted" }, httpStatus: 200, latencyMs: 180, success: true, createdAt: Date.now() });
  insert("DailyStat", { date: "2026-01-17", siteId: "site_1", popId: "p1", campaignId: "c1", device: "desktop", country: "US", source: "direct", impressions: 14_902, unique: 12_960, yes: 1_402, no: 1_208, closes: 12_292, clicks: 1_402, submissions: 318, conversions: 296, revenue: 1_820.4, publisherPayout: 1_274.28, platformShare: 546.12 });

  /* Subscription / usage / invoices / payouts */
  insert("Subscription", { publisherId: "pub_1", planId: "growth", status: "active", cycleStart: "2026-01-01", cycleEnd: "2026-02-01", stripeId: "sub_mock_9f27c1" });
  insert("UsageCounter", { publisherId: "pub_1", cycleStart: "2026-01-01", clicks: 38_402, overageClicks: 0, overageAmount: 0 });
  ([["INV-2041", 149, "paid"], ["INV-2017", 149, "paid"], ["INV-1990", 273, "paid"]] as const).forEach(([number, amount, status]) => {
    insert("Invoice", { publisherId: "pub_1", number, amount, status, issuedAt: Date.now(), lines: [{ label: "Growth plan", amount }] });
  });
  insert("Payout", { id: "pp_2601b", publisherId: "pub_1", period: "Jan 1–15, 2026", gross: 12_017.93, split: 70, net: 8_412.55, status: "pending", methodId: "pm_1" });
  insert("Payout", { id: "pp_2601c", publisherId: "pub_2", period: "Jan 1–15, 2026", gross: 9_204.11, split: 65, net: 5_982.67, status: "approved", methodId: "pm_2" });
  insert("Payout", { id: "pp_2601a", publisherId: "pub_1", period: "Dec 16–31, 2025", gross: 20_289.01, split: 70, net: 14_202.31, status: "paid", methodId: "pm_1", paidAt: Date.now() });
  insert("PayoutMethod", { id: "pm_1", publisherId: "pub_1", type: "wire", handleEnc: "aes-256-gcm:••••4281", taxFormOnFile: true, minimum: 100 });

  /* API keys, flags, webhooks, fraud */
  insert("ApiKey", { publisherId: "pub_1", label: "Reporting — Looker Studio", prefix: "rb_live_9f27", hash: sha256("demo-key"), scopes: ["read:reports"], lastUsedAt: Date.now(), createdAt: Date.now() });
  ([
    ["ff_popunder", "Pop-under placements", false, 0],
    ["ff_offerwall", "Offer Wall", false, 15],
    ["ff_mlopt", "ML optimizer v2", true, 45],
    ["ff_mxcheck", "MX record validation", true, 100],
  ] as const).forEach(([key, label, on, rollout]) => insert("FeatureFlag", { key, label, on, rollout, description: label }));
  insert("Webhook", { publisherId: "pub_1", url: "https://hooks.sterlingmedia.co/revbounce", events: ["conversion", "submission_success"], secretEnc: "aes-256-gcm:" + sha256("wh").slice(0, 20), active: true });
  insert("WebhookDelivery", { webhookId: "wh_1", event: "conversion", status: "success", httpStatus: 200, attempt: 1, responseMasked: { body: "ok" }, createdAt: Date.now() });
  insert("FraudFlag", { id: "fr1", site: "velvetledger.blog", reason: "Click velocity 14× baseline from a single /24", clicks: 412, severity: "high", status: "open", ts: Date.now() - 3_600_000 });
  insert("FraudFlag", { id: "fr2", site: "circuitember.io", reason: "Datacenter ASN share above 22%", clicks: 168, severity: "medium", status: "open", ts: Date.now() - 27_000_000 });
}

export function seedSummary(): Record<string, number> {
  ensureSeed();
  const names = ["User", "Publisher", "Site", "Advertiser", "Campaign", "CampaignFormField", "CampaignPostConfig",
    "Pop", "PopVersion", "PopCampaign", "EmailIntegration", "EmailRecord", "EmailDelivery", "Visitor", "Session",
    "Event", "ClickLog", "Conversion", "Submission", "DailyStat", "Plan", "Subscription", "UsageCounter",
    "Invoice", "Payout", "PayoutMethod", "ApiKey", "AuditLog", "FeatureFlag", "Webhook", "WebhookDelivery"];
  const out: Record<string, number> = {};
  names.forEach((n) => { out[n] = table(n).length; });
  return out;
}
