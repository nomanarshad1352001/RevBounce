import { NextRequest, NextResponse } from "next/server";
import { ROUTES } from "@/lib/api-router";

export const dynamic = "force-dynamic";

/** §13 — OpenAPI 3.1 document generated from the route table. */
export function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const paths: Record<string, Record<string, unknown>> = {};

  for (const entry of ROUTES) {
    if (entry.startsWith("—")) continue;
    const [methods, path] = entry.split(" ");
    const oaPath = path.replace(/:(\w+)/g, "{$1}");
    paths[oaPath] ??= {};
    for (const m of methods.split("|")) {
      const params = [...oaPath.matchAll(/\{(\w+)\}/g)].map((x) => ({
        name: x[1], in: "path", required: true, schema: { type: "string" },
      }));
      (paths[oaPath] as Record<string, unknown>)[m.toLowerCase()] = {
        summary: `${m} ${path}`,
        tags: [path.split("/")[3] ?? "public"],
        parameters: params,
        security: path.startsWith("/api/v1/") && !path.includes("/auth/") && !path.includes("/meta/") ? [{ bearerAuth: [] }] : [],
        responses: {
          "200": { description: "Success", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" } } } } } },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
          "422": { description: "Validation or SSRF guard failure" },
          "429": { description: "Rate limited" },
        },
      };
    }
  }

  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "RevBounce API",
      version: "1.0.0",
      description: "Turn traffic into revenue. JWT auth (access + refresh), rate-limited public plane, HMAC-signed embed sessions. Demo build runs on an in-memory store — no database.",
      contact: { name: "RevBounce", url: origin },
    },
    servers: [{ url: origin }],
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
      schemas: {
        Error: { type: "object", properties: { ok: { type: "boolean", example: false }, error: { type: "string" } } },
        Event: {
          type: "object",
          properties: {
            id: { type: "string" },
            type: { type: "string", enum: ["pop_impression", "campaign_impression", "yes_click", "no_click", "pop_close", "outbound_click", "submission_attempt", "submission_success", "submission_failure", "email_form_start", "email_submit", "email_invalid", "email_duplicate", "sequence_complete", "error"] },
            popId: { type: "string" }, popVersion: { type: "integer" }, campaignId: { type: "string" },
            sessionId: { type: "string" }, visitorId: { type: "string" }, tsClient: { type: "integer" },
          },
        },
      },
    },
    paths,
  }, { headers: { "Cache-Control": "no-store" } });
}
