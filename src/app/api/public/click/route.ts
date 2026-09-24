import { NextRequest, NextResponse } from "next/server";
import { CORS, campaignStatus, issueClickId, rateLimited } from "@/lib/server-store";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * POST /api/public/click — §7.3 server-issued click ID, and §7.4 the
 * authority on campaign state: if the campaign was disabled after the
 * visitor's config was cached, we answer { skipped: true } and the embed
 * advances to the next slot instead of opening a dead offer.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "anon";
    if (rateLimited(`clk:${ip}`, 90, 60_000)) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: CORS });
    }
    const body = JSON.parse(await req.text()) as { site?: string; pop?: string; campaign?: string };
    const campaign = String(body.campaign ?? "");
    if (campaignStatus(campaign) === "skipped") {
      return NextResponse.json({ ok: true, skipped: true, reason: "campaign_inactive" }, { headers: { ...CORS, "Cache-Control": "no-store" } });
    }
    const clickId = issueClickId(String(body.site ?? ""), String(body.pop ?? ""), campaign);
    return NextResponse.json({ ok: true, skipped: false, clickId }, { headers: { ...CORS, "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS });
  }
}
