import { NextRequest, NextResponse } from "next/server";
import { CORS } from "@/lib/server-store";
import { audit, clean, limit, remove, sha256, table, where } from "@/lib/api-core";
import { ensureSeed } from "@/lib/api-seed";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * §13 — GDPR / CCPA endpoints.
 *  POST /api/privacy { action: "delete" | "export" | "retention", email? , visitorId? }
 *  - delete:    erase every record for a subject (email or visitor id)
 *  - export:    machine-readable copy of everything held about a subject
 *  - retention: run the purge job (raw events 90d, aggregates 24mo,
 *               email records kept until the publisher deletes them)
 */
export async function POST(req: NextRequest) {
  ensureSeed();
  const ip = req.headers.get("x-forwarded-for") ?? "0.0.0.0";
  if (limit(`priv:${ip}`, 20, 60_000)) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: CORS });
  }
  let b: Record<string, unknown> = {};
  try { b = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }

  const action = clean(b.action, 20) || "delete";
  const email = clean(b.email, 160).toLowerCase();
  const visitorId = clean(b.visitorId, 120);

  if (action === "retention") {
    const now = Date.now();
    const eventCut = now - 90 * 86_400_000;      // raw events: 90 days
    const aggCut = now - 730 * 86_400_000;       // aggregates: 24 months
    let purged = 0;
    for (const row of [...table("Event")]) if (Number(row.tsServer ?? 0) < eventCut) { remove("Event", String(row.id)); purged++; }
    for (const row of [...table("ClickLog")]) if (Number(row.createdAt ?? 0) < eventCut) { remove("ClickLog", String(row.id)); purged++; }
    for (const row of [...table("DailyStat")]) if (Number(row.createdAt ?? now) < aggCut) { remove("DailyStat", String(row.id)); purged++; }
    audit("system", "ran retention job", `${purged} rows purged`, ip);
    return NextResponse.json({
      ok: true, action, purged,
      policy: { rawEvents: "90 days", aggregates: "24 months", emailRecords: "until deleted by publisher" },
    }, { headers: CORS });
  }

  if (!email && !visitorId) {
    return NextResponse.json({ ok: false, error: "email_or_visitorId_required" }, { status: 400, headers: CORS });
  }
  const hash = email ? sha256(email) : "";
  const match = (r: Record<string, unknown>): boolean =>
    (!!email && (r.email === email || r.emailHash === hash)) ||
    (!!visitorId && (r.visitorId === visitorId || r.anonId === visitorId));

  if (action === "export") {
    const subject = {
      emailRecords: where("EmailRecord", match),
      events: where("Event", match).map((e) => ({ ...e, pageUrl: e.pageUrl })),
      visitors: where("Visitor", match),
      clicks: where("ClickLog", match),
    };
    audit("system", "privacy export", email || visitorId, ip);
    return NextResponse.json({ ok: true, action, subject, generatedAt: new Date().toISOString() }, { headers: CORS });
  }

  // delete
  let deleted = 0;
  for (const t of ["EmailRecord", "EmailDelivery", "Event", "Visitor", "Session", "ClickLog", "Submission"]) {
    for (const row of [...table(t)]) {
      if (match(row) || (t === "EmailDelivery" && where("EmailRecord", match).some((e) => e.id === row.emailRecordId))) {
        remove(t, String(row.id));
        deleted++;
      }
    }
  }
  audit("system", "privacy delete", email || visitorId, ip);
  return NextResponse.json({
    ok: true, action: "delete", deleted, subject: email || visitorId,
    note: "Aggregate counters are retained without personal data, per GDPR Art. 17(3).",
  }, { headers: CORS });
}

/** GET — publish the retention policy (used by the settings UI + docs). */
export function GET() {
  return NextResponse.json({
    ok: true,
    consent: { flag: "window.revbounceConsent", honors: ["GPC", "DNT"], fingerprinting: false },
    identity: "first-party revbounce_vid per site",
    retention: { rawEvents: "90 days", aggregates: "24 months", emailRecords: "until deleted by publisher" },
    endpoints: { delete: "POST /api/privacy {action:'delete', email|visitorId}", export: "POST /api/privacy {action:'export'}", retention: "POST /api/privacy {action:'retention'}" },
  }, { headers: { ...CORS, "Cache-Control": "no-store" } });
}
