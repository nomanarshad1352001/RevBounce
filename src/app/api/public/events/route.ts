import { NextRequest, NextResponse } from "next/server";
import {
  CORS, geoFromHeaders, ingestEvents, rateLimited, recentRbEvents, type RbEvent,
} from "@/lib/server-store";
import { verifyToken } from "@/lib/api-core";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * POST /api/public/events — §7.6 batched ingestion via sendBeacon.
 * Body: { site, events: [{ id, type, popId, popVersion, campaignId, deviceType,
 *         triggerType, tsClient, sessionId, visitorId, pageUrl, referrer, utm, clickId }] }
 * Server: dedupes by event id (idempotent), stamps server time, enriches with
 * IP-derived country/region (raw IP never stored), and flags bot traffic.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "anon";
    if (rateLimited(`ev:${ip}`, 300, 60_000)) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: CORS });
    }
    const body = JSON.parse(await req.text()) as { site?: string; token?: string; events?: Partial<RbEvent>[] };
    // §8 — verify the HMAC session token issued by /public/config
    const tokenPayload = body.token ? verifyToken<{ site: string; typ: string }>(body.token) : null;
    const signed = !!tokenPayload && tokenPayload.typ === "embed" && tokenPayload.site === body.site;
    if (!body.site || !Array.isArray(body.events)) {
      return NextResponse.json({ ok: false, error: "invalid payload" }, { status: 400, headers: CORS });
    }
    const ua = req.headers.get("user-agent") ?? "";
    const { country, region } = geoFromHeaders(req.headers);
    const res = ingestEvents(body.events, { siteKey: body.site, ua, country, region });
    return NextResponse.json({ ok: true, ...res, signed, geo: { country, region } }, { headers: CORS });
  } catch {
    // never surface a loud failure onto a publisher page
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS });
  }
}

/** GET — recent enriched events (sandbox + dashboards). */
export async function GET(req: NextRequest) {
  const site = req.nextUrl.searchParams.get("site") ?? "";
  return NextResponse.json({ ok: true, events: recentRbEvents(site, 25) }, { headers: { ...CORS, "Cache-Control": "no-store" } });
}
