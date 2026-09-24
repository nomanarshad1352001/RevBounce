import { NextRequest, NextResponse } from "next/server";
import {
  CORS, EMAIL_RE, deliverApi, findDuplicate, ftpFilename, isDisposable, maskSecret,
  mxLooksValid, rateLimited, recordLead, recordLeadRecord, recentLeadRecords, retryLead,
  uidS, type DuplicateRule, type LeadRecord,
} from "@/lib/server-store";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * POST /api/public/email — §6 Email Capture flow:
 *   validate (format → MX → disposable → consent)
 *   → duplicate rule
 *   → store record
 *   → enqueue API delivery (retry w/ exponential backoff on 5xx/timeout, max 5)
 *   → enqueue FTP/SFTP delivery (realtime file / hourly / daily batch)
 *   → record result (secrets masked) → return success message
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "anon";
    if (rateLimited(`em:${ip}`, 30, 60_000)) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: CORS });
    }

    const body = JSON.parse(await req.text()) as {
      site?: string; pop?: string; campaign?: string; email?: string; consent?: boolean;
      device?: string; trigger?: string; pageUrl?: string; publisherId?: string;
      config?: {
        duplicateRule?: DuplicateRule; duplicateDays?: number; duplicateMessage?: string;
        checkMx?: boolean; blockDisposable?: boolean; requireConsent?: boolean;
        successMessage?: string; endpoint?: string; maxRetries?: number; authValue?: string;
        ftpEnabled?: boolean; ftpHost?: string; ftpPattern?: string; ftpFrequency?: string;
      };
    };

    const cfg = body.config ?? {};
    const email = (body.email ?? "").trim().toLowerCase();
    const siteId = String(body.site ?? "");
    const popId = String(body.pop ?? "");

    /* ── validation ── */
    if (!siteId) return NextResponse.json({ ok: false, code: "no_site", error: "site key required" }, { status: 400, headers: CORS });
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, code: "invalid_format", error: "Please enter a valid email address." }, { status: 400, headers: CORS });
    }
    if (cfg.checkMx !== false && !mxLooksValid(email)) {
      return NextResponse.json({ ok: false, code: "invalid_mx", error: "That mail domain doesn't accept mail." }, { status: 400, headers: CORS });
    }
    if (cfg.blockDisposable !== false && isDisposable(email)) {
      return NextResponse.json({ ok: false, code: "disposable", error: "Please use a permanent email address." }, { status: 400, headers: CORS });
    }
    if (cfg.requireConsent && !body.consent) {
      return NextResponse.json({ ok: false, code: "consent_required", error: "Please accept the consent checkbox." }, { status: 400, headers: CORS });
    }

    /* ── duplicate rule ── */
    const rule = (cfg.duplicateRule ?? "block-pop-days") as DuplicateRule;
    const dup = findDuplicate(email, siteId, popId, rule, cfg.duplicateDays ?? 30);
    if (dup) {
      return NextResponse.json({
        ok: true, duplicate: true,
        message: cfg.duplicateMessage ?? "You're already subscribed — thanks for the enthusiasm!",
      }, { headers: CORS });
    }

    /* ── store record (stored even if delivery later fails) ── */
    const lead: LeadRecord = {
      id: uidS(), email, timestamp: Date.now(), siteId,
      publisherId: String(body.publisherId ?? "u_pub"), popId,
      device: String(body.device ?? "desktop"), trigger: String(body.trigger ?? "exit"),
      pageUrl: String(body.pageUrl ?? ""), consent: !!body.consent,
      apiStatus: "pending", ftpStatus: "pending", lastError: "", attempts: [],
    };

    /* ── API delivery with exponential backoff ── */
    const endpoint = cfg.endpoint ?? "https://api.mailchimp.example/3.0/lists/aud_9921/members";
    const api = deliverApi(endpoint, cfg.maxRetries ?? 5);
    lead.apiStatus = api.status;
    lead.attempts = api.attempts;
    lead.lastError = api.lastError;

    /* ── FTP / SFTP delivery ── */
    let ftpFile = "";
    if (cfg.ftpEnabled === false) {
      lead.ftpStatus = "skipped";
    } else {
      ftpFile = ftpFilename(cfg.ftpPattern ?? "{site}_{date}_{time}.csv", siteId);
      lead.ftpStatus = (cfg.ftpFrequency ?? "hourly") === "realtime" ? "success" : "queued";
    }

    recordLeadRecord(lead);
    // mirror into the generic activity feed used by the sandbox
    recordLead({
      id: lead.id, site: siteId, pop: popId, campaign: String(body.campaign ?? "Email Capture"),
      email, kind: "email", destination: "integration",
      provider: api.status === "success" ? "API · delivered" : "API · failed (retryable)",
      http: api.attempts[api.attempts.length - 1]?.status ?? 0,
      ms: api.attempts.reduce((a, x) => a + x.ms, 0), ts: lead.timestamp,
    });

    return NextResponse.json({
      ok: true,
      duplicate: false,
      message: cfg.successMessage ?? "You're in! Check your inbox to confirm.",
      leadId: lead.id,
      delivery: {
        api: { status: lead.apiStatus, attempts: lead.attempts, auth: maskSecret(cfg.authValue ?? "bearer-token-xyz"), lastError: lead.lastError },
        ftp: { status: lead.ftpStatus, host: cfg.ftpHost ?? "drop.partner.example", file: ftpFile, frequency: cfg.ftpFrequency ?? "hourly" },
      },
    }, { headers: CORS });
  } catch {
    return NextResponse.json({ ok: false, error: "bad request" }, { status: 400, headers: CORS });
  }
}

/** GET — recent stored leads with delivery state (dashboard). */
export async function GET(req: NextRequest) {
  const site = req.nextUrl.searchParams.get("site") ?? "";
  return NextResponse.json({ ok: true, leads: recentLeadRecords(site, 20) }, { headers: { ...CORS, "Cache-Control": "no-store" } });
}

/** PATCH — retry a failed delivery from the dashboard. */
export async function PATCH(req: NextRequest) {
  try {
    const { id, endpoint, maxRetries } = (await req.json()) as { id: string; endpoint?: string; maxRetries?: number };
    const lead = retryLead(id, endpoint ?? "https://api.mailchimp.example/3.0/lists/aud_9921/members", maxRetries ?? 5);
    if (!lead) return NextResponse.json({ ok: false, error: "lead not found" }, { status: 404, headers: CORS });
    return NextResponse.json({ ok: true, lead }, { headers: CORS });
  } catch {
    return NextResponse.json({ ok: false, error: "bad request" }, { status: 400, headers: CORS });
  }
}
