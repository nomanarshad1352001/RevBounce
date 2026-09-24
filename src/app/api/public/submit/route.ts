import { NextRequest, NextResponse } from "next/server";
import { CORS, EMAIL_RE, rateLimited, recordLead, uidS } from "@/lib/server-store";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// POST /api/public/submit — spec §3 Host&Post: pop form posts a lead;
// a worker then posts it to the advertiser endpoint. Dummy mode: delivery
// is simulated server-side and captured on the lead record (destination,
// http, latency) — never in publisher-side JavaScript.
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "anon";
    if (rateLimited(`sub:${ip}`, 30, 60_000)) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: CORS });
    }
    const body = JSON.parse(await req.text()) as { site?: string; pop?: string; campaign?: string; email?: string; zip?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    if (!body.site || !EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: "valid email required" }, { status: 400, headers: CORS });
    }
    if (body.zip && !/^[A-Za-z0-9 -]{3,10}$/.test(body.zip)) {
      return NextResponse.json({ ok: false, error: "invalid zip" }, { status: 400, headers: CORS });
    }
    // worker dummy: synchronous host-post to advertiser endpoint
    const ms = 118 + Math.floor(Math.random() * 240);
    recordLead({
      id: uidS(), site: body.site, pop: String(body.pop ?? ""), campaign: String(body.campaign ?? ""),
      email, zip: body.zip?.trim() || undefined, kind: "hostpost",
      destination: "advertiser-endpoint", provider: "Azure Media Partners API", http: 200, ms, ts: Date.now(),
    });
    return NextResponse.json(
      { ok: true, leadId: uidS(), delivered: true, ms },
      { headers: { ...CORS, "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ ok: false, error: "bad request" }, { status: 400, headers: CORS });
  }
}
