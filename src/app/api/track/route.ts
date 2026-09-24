import { NextRequest, NextResponse } from "next/server";
import { CORS, recordEvents, recentEvents, recentLeads, type ServedEvent } from "@/lib/server-store";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// Legacy single-event beacon (old snippet tag) — normalized into the
// batched recordEvents pipeline (spec §3 shape).
export async function POST(req: NextRequest) {
  try {
    const body = JSON.parse(await req.text()) as Partial<ServedEvent>;
    if (!body.site || !body.type || !["impression", "click", "conversion", "close"].includes(body.type)) {
      return NextResponse.json({ ok: false, error: "invalid event" }, { status: 400, headers: CORS });
    }
    recordEvents([{
      site: String(body.site), pop: String(body.pop ?? ""), campaign: String(body.campaign ?? ""),
      type: body.type, ts: Date.now(),
    }], req.headers.get("user-agent") ?? "unknown");
    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS });
  }
}

// GET /api/track?site=rb_xxx — activity feed (tracked events + lead delivery log)
export async function GET(req: NextRequest) {
  const site = req.nextUrl.searchParams.get("site") ?? "";
  return NextResponse.json(
    { ok: true, events: recentEvents(site, 14), leads: recentLeads(site, 8) },
    { headers: { ...CORS, "Cache-Control": "no-store" } },
  );
}
