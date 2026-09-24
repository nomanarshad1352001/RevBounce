import { NextRequest, NextResponse } from "next/server";
import type { PostingConfig } from "@/lib/types";

// POST /api/testpost — §5.2 "Test-post" button: sends a sample lead through
// the posting config and shows the response. Dummy mode: no external call is
// made — the worker's behavior is simulated deterministically:
//   endpoint containing "fail" → 502 upstream error
//   endpoint containing "slow" → latency beyond a 1.5s timeout
//   otherwise                → 200/201 accepted
export async function POST(req: NextRequest) {
  try {
    const { posting, sample } = (await req.json()) as { posting?: PostingConfig; sample?: Record<string, string> };
    if (!posting?.endpoint || !/^https?:\/\//i.test(posting.endpoint)) {
      return NextResponse.json({ ok: false, error: "Endpoint must be a valid http(s) URL" }, { status: 400 });
    }
    // build the body exactly as the worker would (mapping + static params)
    const body: Record<string, string> = {};
    for (const m of posting.mapping ?? []) {
      if (m.field && m.param) body[m.param] = sample?.[m.field] ?? `sample_${m.field}@revbounce.dev`;
    }
    for (const line of (posting.staticParams ?? "").split("\n")) {
      const [k, ...v] = line.split("=");
      if (k && v.length) body[k.trim()] = v.join("=").trim();
    }

    const endpoint = posting.endpoint.toLowerCase();
    let ms = 140 + Math.floor(Math.random() * 260);
    let status = posting.successStatus ?? 200;
    let responseBody: unknown = { ok: true, accepted: true, lead_id: `sim_${Date.now().toString(36)}`, received: body };
    let timedOut = false;

    if (endpoint.includes("fail")) {
      status = 502; ms = 340;
      responseBody = { ok: false, error: "upstream_unavailable" };
    } else if (endpoint.includes("slow")) {
      ms = Math.max(ms, posting.timeoutMs + 900);
    }
    if (ms > posting.timeoutMs) timedOut = true;

    // success rule: HTTP status + response contains
    const contains = posting.successContains
      ? JSON.stringify(responseBody).includes(posting.successContains)
      : true;
    const success = !timedOut && status === posting.successStatus && contains;

    return NextResponse.json({
      ok: true,
      simulated: true,
      note: "Dummy mode — no external request was made; the worker pipeline is reproduced faithfully.",
      request: {
        to: posting.endpoint, method: posting.method, format: posting.bodyFormat,
        auth: posting.authType, headersCount: (posting.headers ?? "").split("\n").filter(Boolean).length,
        body: posting.bodyFormat === "form" ? new URLSearchParams(body).toString() : body,
      },
      response: { status, ms, timedOut, body: responseBody },
      successRule: {
        expectedStatus: posting.successStatus, contains: posting.successContains || null,
        passed: success,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid test payload" }, { status: 400 });
  }
}
