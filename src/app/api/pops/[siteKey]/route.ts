import { NextRequest, NextResponse } from "next/server";
import { CORS, configFor } from "@/lib/server-store";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// Legacy alias of /api/public/config/:siteKey (kept for the old snippet tag)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ siteKey: string }> }) {
  const { siteKey } = await params;
  return NextResponse.json(
    { ok: true, path: "legacy", ...configFor(siteKey) },
    { headers: { ...CORS, "Cache-Control": "no-store" } },
  );
}
