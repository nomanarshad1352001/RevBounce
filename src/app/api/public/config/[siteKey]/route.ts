import { NextRequest, NextResponse } from "next/server";
import { CORS, CONFIG_VERSION, configFor, rateLimited } from "@/lib/server-store";
import { signToken } from "@/lib/api-core";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// GET /api/public/config/:siteKey — spec §3: cached, versioned pop config
// consumed by /embed.js. CDN-style 60s cache with ETag version.
export async function GET(req: NextRequest, { params }: { params: Promise<{ siteKey: string }> }) {
  const { siteKey } = await params;
  const ip = req.headers.get("x-forwarded-for") ?? "anon";
  if (rateLimited(`cfg:${ip}`, 120, 60_000)) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: CORS });
  }
  const cfg = configFor(siteKey);
  // §8 — HMAC-signed short-lived session token; /public/events prefers signed
  // batches so spoofed events can be identified and down-ranked.
  const sessionToken = signToken({ site: siteKey, typ: "embed", jti: `${siteKey}:${Date.now()}` }, 3600);
  const origin = req.headers.get("origin") ?? "";
  const allowed = cfg.domains.length === 0 || cfg.domains.some((d) => origin.includes(d)) || origin === "";
  return NextResponse.json(
    { ok: true, sessionToken, originAllowed: allowed, ...cfg },
    {
      headers: {
        ...CORS,
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        ETag: `W/"rb-${siteKey}-v${CONFIG_VERSION}"`,
      },
    },
  );
}
