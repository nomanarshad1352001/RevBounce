import { NextResponse } from "next/server";
import { seedSummary } from "@/lib/api-seed";

export const dynamic = "force-dynamic";

/** §13 — health check. Reports uptime, store sizes and subsystem status. */
export function GET() {
  const counts = seedSummary();
  return NextResponse.json({
    ok: true,
    status: "healthy",
    service: "revbounce",
    version: "1.0.0",
    uptimeSeconds: Math.round(process.uptime()),
    time: new Date().toISOString(),
    subsystems: {
      api: "up",
      embedCdn: "up",
      eventIngest: "up",
      worker: "up (in-process, dummy mode)",
      store: "in-memory (no database by design)",
    },
    rows: Object.values(counts).reduce((a, b) => a + b, 0),
  }, { headers: { "Cache-Control": "no-store" } });
}
