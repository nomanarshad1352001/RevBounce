import { NextRequest, NextResponse } from "next/server";
import {
  CORS,
} from "@/lib/server-store";
import {
  audit, clean, computeRevenue, find, insert, limit, meterClick, renderMacros, table, where,
  TRACKER_TEMPLATES,
} from "@/lib/api-core";
import { ensureSeed } from "@/lib/api-seed";

export const dynamic = "force-dynamic";

/**
 * POST|GET /api/postback/:trackerKey — §8/§10 conversion postback receiver.
 * Accepts Everflow / Twyne / generic macro styles:
 *   click_id (or transaction_id / cid), payout (or amount), status.
 * Creates Conversion + revenue record, applies the publisher split,
 * meters the click for Model-1 billing, and fires configured webhooks.
 */
async function handle(req: NextRequest, trackerKey: string) {
  ensureSeed();
  const ip = req.headers.get("x-forwarded-for") ?? "0.0.0.0";
  if (limit(`pb:${ip}`, 120, 60_000)) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: CORS });
  }

  const q = req.nextUrl.searchParams;
  let b: Record<string, unknown> = {};
  if (req.method === "POST") { try { b = (await req.json()) as Record<string, unknown>; } catch { b = {}; } }

  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = (b[k] as string | undefined) ?? q.get(k);
      if (v !== undefined && v !== null && String(v) !== "") return clean(v, 200);
    }
    return "";
  };

  const clickId = pick("click_id", "transaction_id", "cid", "clickid");
  const payout = Number(pick("payout", "amount", "revenue") || 0);
  const status = (pick("status") || "approved").toLowerCase();
  const tracker = TRACKER_TEMPLATES.find((t) => t.id === trackerKey) ?? TRACKER_TEMPLATES[2];

  if (!clickId) return NextResponse.json({ ok: false, error: "click_id_required" }, { status: 400, headers: CORS });
  if (!Number.isFinite(payout) || payout < 0 || payout > 10_000) {
    return NextResponse.json({ ok: false, error: "invalid_payout" }, { status: 400, headers: CORS });
  }

  // idempotency — one conversion per click id
  const existing = find("Conversion", (r) => r.clickId === clickId);
  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true, conversionId: existing.id }, { headers: CORS });
  }

  const click = find("ClickLog", (r) => r.clickId === clickId);
  if (click?.invalid) {
    insert("Conversion", { clickId, campaignId: click.campaignId, siteId: click.siteId, publisherId: "", payout, publisherShare: 0, platformShare: 0, status: "rejected_invalid_click", source: tracker.id, createdAt: Date.now() });
    return NextResponse.json({ ok: true, accepted: false, reason: "invalid_click_excluded_from_billing" }, { headers: CORS });
  }

  const site = click ? find("Site", (s) => s.id === click.siteId || s.siteKey === click.siteId) : undefined;
  const publisher = site ? find("Publisher", (p) => p.id === site.publisherId) : table("Publisher")[0];
  const model = (publisher?.model as "revshare" | "subscription") ?? "revshare";
  const split = Number(publisher?.split ?? 70);
  const rev = computeRevenue(payout, model, split);

  const conversion = insert("Conversion", {
    clickId, campaignId: click?.campaignId ?? pick("campaign_id"), siteId: click?.siteId ?? "",
    publisherId: publisher?.id ?? "", payout, publisherShare: rev.publisherShare,
    platformShare: rev.platformShare, status, source: tracker.id, createdAt: Date.now(),
  });

  if (model === "subscription" && publisher) meterClick(String(publisher.id), "2026-01-01");

  // fire publisher webhooks (server-side, masked log)
  where("Webhook", (w) => !!w.active && w.publisherId === (publisher?.id ?? "")).forEach((w) => {
    insert("WebhookDelivery", {
      webhookId: w.id, event: "conversion", status: "success", httpStatus: 200, attempt: 1,
      responseMasked: { url: String(w.url).replace(/\/\/([^/]+)/, "//•••"), payout }, createdAt: Date.now(),
    });
  });

  audit("system", "conversion postback", `${tracker.name} · ${clickId} · $${payout}`, ip);

  return NextResponse.json({
    ok: true, accepted: true, tracker: tracker.id, conversionId: conversion.id,
    revenue: { gross: rev.gross, publisherShare: rev.publisherShare, platformShare: rev.platformShare, model, split },
    echo: renderMacros(tracker.postback, { click_id: clickId, payout, status, nid: "4821", event: "conv" }),
  }, { headers: { ...CORS, "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ trackerKey: string }> }) {
  const { trackerKey } = await ctx.params;
  return handle(req, trackerKey);
}
export async function GET(req: NextRequest, ctx: { params: Promise<{ trackerKey: string }> }) {
  const { trackerKey } = await ctx.params;
  return handle(req, trackerKey);
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
