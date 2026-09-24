import { NextRequest, NextResponse } from "next/server";
import { CORS, campaignStatus, issueClickId } from "@/lib/server-store";
import { botUa, duplicateClick, insert, ipAnomaly, limit, renderMacros, clean } from "@/lib/api-core";
import { ensureSeed } from "@/lib/api-seed";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/click/:campaignId — §8 server redirect tracker.
 * Generates the click id server-side, logs it (with §10 fraud checks),
 * then 302s to the advertiser URL with macros substituted.
 * ?u= destination (validated) · ?site= · ?pop= · ?vid= · ?sub1..5
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ campaignId: string }> }) {
  ensureSeed();
  const { campaignId } = await ctx.params;
  const q = req.nextUrl.searchParams;
  const ip = req.headers.get("x-forwarded-for") ?? "0.0.0.0";
  const ua = req.headers.get("user-agent") ?? "";
  const site = clean(q.get("site"), 60);
  const pop = clean(q.get("pop"), 60);
  const visitor = clean(q.get("vid"), 80) || "anon";
  const fallback = clean(q.get("u"), 800);

  if (limit(`redir:${ip}`, 120, 60_000)) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: CORS });
  }
  if (campaignStatus(campaignId) === "skipped") {
    return NextResponse.json({ ok: true, skipped: true, reason: "campaign_inactive" }, { headers: CORS });
  }

  const invalidReasons: string[] = [];
  if (botUa(ua)) invalidReasons.push("bot_ua");
  if (duplicateClick(visitor, campaignId)) invalidReasons.push("duplicate_30s");
  if (ipAnomaly(ip)) invalidReasons.push("ip_rate_anomaly");

  const clickId = issueClickId(site, pop, campaignId);
  insert("ClickLog", {
    clickId, siteId: site, popId: pop, campaignId, visitorId: visitor,
    sessionId: clean(q.get("sid"), 80), country: req.headers.get("x-vercel-ip-country") ?? "US",
    createdAt: Date.now(), invalid: invalidReasons.length > 0, invalidReasons,
  });

  if (!fallback) {
    return NextResponse.json({ ok: true, clickId, invalid: invalidReasons }, { headers: { ...CORS, "Cache-Control": "no-store" } });
  }
  const dest = renderMacros(fallback, {
    click_id: clickId, site_id: site, pop_id: pop, campaign_id: campaignId,
    sub1: clean(q.get("sub1"), 80), sub2: clean(q.get("sub2"), 80), sub3: clean(q.get("sub3"), 80),
    sub4: clean(q.get("sub4"), 80), sub5: clean(q.get("sub5"), 80),
  });
  if (!/^https?:\/\//i.test(dest)) {
    return NextResponse.json({ ok: false, error: "invalid_destination", clickId }, { status: 422, headers: CORS });
  }
  return NextResponse.redirect(dest, { status: 302, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
