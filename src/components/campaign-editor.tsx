"use client";
// §5.2 Campaign editor — create/edit for the 3 delivery kinds:
// Host & Post (form builder + posting config + test-post), CPA Link-Out
// (macro URL), Google Feed (macro feed URL).
import React, { useMemo, useState } from "react";
import { Beaker, Check, FlaskConical, Link2, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui";
import { uid } from "@/lib/data";
import type { Campaign, CampaignKind, FormField, FormFieldType, PayoutModel, PostingConfig } from "@/lib/types";

export const MACROS = ["{click_id}", "{site_id}", "{pop_id}", "{sub1}", "{sub2}", "{sub3}", "{sub4}", "{sub5}", "{email}", "{zip}"];
export const MACROS_FORM = ["{email}", "{zip}"];
export const POP_TYPE_OPTIONS = ["Exit Intent", "Inactivity", "Decline Page", "Offer Wall", "Email Capture", "Thank You Page"];
const GEO_OPTIONS = ["US", "CA", "UK", "AU", "DE", "FR", "NL", "SG"];
const FIELD_TYPES: FormFieldType[] = ["text", "email", "phone", "zip", "address", "select", "consent"];

export const blankPosting: PostingConfig = {
  endpoint: "", method: "POST", headers: "", authType: "none", authValue: "",
  bodyFormat: "json", mapping: [{ field: "email", param: "email" }],
  staticParams: "", successStatus: 200, successContains: "", duplicateRule: "skip",
  timeoutMs: 3000, retries: 2,
};

export function blankCampaign(): Omit<Campaign, "id"> {
  return {
    name: "", advertiser: "Direct Partner", type: "cpa", kind: "cpa", payoutModel: "CPA", payout: 10,
    vertical: "General", status: "draft", clicks: 0, impressions: 0, conversions: 0, revenue: 0, epc: 0,
    countries: ["US"], devices: ["desktop", "mobile"], description: "",
    image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=900&auto=format&fit=crop",
    optimizerScore: 50, yesText: "Yes, show me", noText: "No thanks",
    destUrl: "", feedUrl: "", dailyCap: null, monthlyCap: null, trafficSource: "all",
    schedule: { start: "2026-01-01", end: "2026-12-31" },
    allowedPopTypes: ["Exit Intent"], weight: 50,
    posting: { ...blankPosting }, formSpec: [{ id: "email", type: "email", label: "Email address", required: true }],
  };
}

const L = ({ children }: { children: React.ReactNode }) => (
  <label className="text-[10px] tracking-[0.22em] uppercase text-[#8b8794] block mb-1.5">{children}</label>
);

export default function CampaignEditor({ initial, onSave, onCancel, lockAdvertiser }: {
  initial: Omit<Campaign, "id"> & { id?: string };
  onSave: (c: Omit<Campaign, "id"> & { id?: string }) => void;
  onCancel: () => void;
  lockAdvertiser?: string;
}) {
  const [c, setC] = useState(initial);
  const [tab, setTab] = useState<"core" | "delivery" | "targeting">("core");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<null | {
    ok: boolean; error?: string; request?: { to: string; method: string; format: string; body: string | Record<string, string> };
    response?: { status: number; ms: number; timedOut: boolean; body: unknown };
    successRule?: { expectedStatus: number; contains: string | null; passed: boolean };
  }>(null);
  const patch = (p: Partial<typeof c>) => setC({ ...c, ...p });
  const ppost = (p: Partial<PostingConfig>) => setC({ ...c, posting: { ...(c.posting ?? blankPosting), ...p } });

  const kindHelp: Record<CampaignKind, string> = {
    hostpost: "Form rendered inside the pop; lead posted server-side to the advertiser endpoint.",
    cpa: "YES sends the visitor to the advertiser URL with macros replaced per click.",
    gfeed: "YES sends the visitor to the Google click-feed URL; revenue per valid click.",
  };

  const macros = c.kind === "hostpost" ? MACROS_FORM : MACROS;
  const url = c.kind === "gfeed" ? c.feedUrl ?? "" : c.destUrl ?? "";
  const setUrl = (v: string) => patch(c.kind === "gfeed" ? { feedUrl: v } : { destUrl: v });
  const urlValid = !url || /^https?:\/\//i.test(url.replace(/\{[^}]+\}/g, "x"));
  const appendMacro = (m: string) => setUrl(url + (url && !url.endsWith("=") && !url.endsWith("&") && !url.endsWith("?") ? "&" : "") + m);

  const formSpec = c.formSpec ?? [];
  const updField = (i: number, f: Partial<FormField>) => {
    const next = [...formSpec];
    next[i] = { ...next[i], ...f };
    patch({ formSpec: next });
  };

  const runTestPost = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch("/api/testpost", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posting: c.posting ?? blankPosting,
          sample: Object.fromEntries(formSpec.map((f) => [f.id, f.type === "email" ? "lead.demo@revbounce.dev" : f.type === "zip" ? "90210" : f.type === "phone" ? "+1-415-555-0100" : "Sample value"])),
        }),
      });
      setTestResult(await r.json());
    } catch {
      setTestResult({ ok: false, error: "Test runner unreachable" });
    }
    setTesting(false);
  };

  const valid = useMemo(() => {
    if (!c.name.trim()) return false;
    if (c.kind === "hostpost") return !!c.posting?.endpoint && /^https?:\/\//i.test(c.posting.endpoint) && formSpec.some((f) => f.type === "email");
    return !!url && urlValid;
  }, [c, url, urlValid, formSpec]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onSave(c);
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* tab rail */}
      <div className="glass rounded-xl p-1 flex gap-1">
        {([["core", "Core & payouts"], ["delivery", c.kind === "hostpost" ? "Form & posting" : "Destination URL"], ["targeting", "Caps, targeting & schedule"]] as const).map(([id, l]) => (
          <button type="button" key={id} onClick={() => setTab(id)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${tab === id ? "bg-[rgba(217,179,128,.18)] text-[#f0d9ae]" : "text-[#8b8794] hover:text-white"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "core" && (
        <div className="space-y-4 fade-in">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><L>Campaign name</L>
              <input className="input-lux" required value={c.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Spring Candle CPA" /></div>
            <div><L>Delivery kind (§5.2)</L>
              <select className="input-lux" value={c.kind} onChange={(e) => patch({ kind: e.target.value as CampaignKind })}>
                <option value="hostpost">Host &amp; Post</option>
                <option value="cpa">CPA Link-Out</option>
                <option value="gfeed">Google Feed</option>
              </select>
              <p className="text-[11px] text-[#8b8794] mt-1.5 leading-relaxed">{kindHelp[c.kind]}</p></div>
            <div><L>Advertiser / owner</L>
              <input className="input-lux" value={lockAdvertiser ?? c.advertiser} disabled={!!lockAdvertiser}
                onChange={(e) => patch({ advertiser: e.target.value })} /></div>
            <div><L>YES button text</L>
              <input className="input-lux" value={c.yesText} onChange={(e) => patch({ yesText: e.target.value })} placeholder="Yes, show me" /></div>
            <div><L>NO button text</L>
              <input className="input-lux" value={c.noText} onChange={(e) => patch({ noText: e.target.value })} placeholder="No thanks" /></div>
            <div><L>Payout type</L>
              <select className="input-lux" value={c.payoutModel} onChange={(e) => patch({ payoutModel: e.target.value as PayoutModel })}>
                <option value="CPA">CPA (fixed per lead)</option><option value="CPC">CPC (per click)</option><option value="SOI">SOI</option><option value="RevShare">% Rev-share</option>
              </select></div>
            <div><L>Payout value (USD or %)</L>
              <input className="input-lux" type="number" min="0" step="0.01" value={c.payout} onChange={(e) => patch({ payout: +e.target.value })} /></div>
            <div><L>Vertical</L>
              <input className="input-lux" value={c.vertical} onChange={(e) => patch({ vertical: e.target.value })} /></div>
            <div><L>Status</L>
              <select className="input-lux" value={c.status === "library" ? "draft" : c.status} onChange={(e) => patch({ status: e.target.value as Campaign["status"] })}>
                <option value="active">active</option><option value="paused">paused</option><option value="draft">draft</option>
              </select></div>
            <div className="sm:col-span-2"><L>Headline &amp; description (shown on pop)</L>
              <textarea className="input-lux" rows={2} value={c.description} onChange={(e) => patch({ description: e.target.value })} /></div>
            <div className="sm:col-span-2"><L>Image URL</L>
              <input className="input-lux" value={c.image} onChange={(e) => patch({ image: e.target.value })} placeholder="https://images.unsplash.com/…" /></div>
          </div>
          {/* YES/NO preview */}
          <div className="rounded-xl bg-black/25 border border-line p-4 flex items-center gap-3 flex-wrap">
            <span className="text-[10px] tracking-[0.25em] uppercase text-[#5d5867]">Button preview</span>
            <span className="rounded-lg px-4 py-2 text-xs font-semibold text-[#16110a] bg-gradient-to-r from-[#eed9ac] to-[#c9a068]">{c.yesText || "YES"}</span>
            <span className="text-xs text-[#6e6879] underline underline-offset-4">{c.noText || "NO"}</span>
          </div>
        </div>
      )}

      {tab === "delivery" && c.kind !== "hostpost" && (
        <div className="space-y-4 fade-in">
          <div>
            <L>{c.kind === "gfeed" ? "Google feed URL" : "Advertiser destination URL"}</L>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5d5867]" />
                <input className="input-lux !pl-9 font-mono !text-xs" value={url} onChange={(e) => setUrl(e.target.value)}
                  placeholder={c.kind === "gfeed" ? "https://feed.example/xml?site={site_id}" : "https://go.advertiser.com/lander?click_id={click_id}"} />
              </div>
            </div>
            {!urlValid && <p className="text-[11px] text-[#f0a0a8] mt-1.5 flex items-center gap-1"><TriangleAlert size={11} /> Not a valid http(s) URL</p>}
          </div>
          <div>
            <L>Click a macro to insert (replaced per click)</L>
            <div className="flex flex-wrap gap-1.5">
              {macros.map((m) => (
                <button type="button" key={m} onClick={() => patch(c.kind === "gfeed" ? { feedUrl: url + m } : { destUrl: url + m })}
                  className="chip text-[#c9c4b8] hover:text-[#f0d9ae] hover:border-[rgba(217,179,128,.5)] transition font-mono">{m}</button>
              ))}
            </div>
            <p className="text-[11px] text-[#8b8794] mt-2">…and append-all: <button type="button" onClick={() => appendMacro("utm_auto={sub1}")} className="text-[#d9b380] hover:text-white transition font-mono">utm_auto={"{sub1}"}</button></p>
          </div>
          <div className="rounded-xl bg-black/25 border border-line p-4 text-[11px] text-[#8b8794] leading-relaxed">
            <p className="text-[#c9c4b8] mb-1">Resolved example on click:</p>
            <code className="text-[#e8cf9f] break-all">
              {(url || "https://…").replace("{click_id}", "cl_8x2p1").replace("{site_id}", "rb_tgp_9f27c1").replace("{pop_id}", "p1").replace("{sub1}", "exit").replace("{sub2}", "travel").replace("{sub3}", "US").replace("{sub4}", "-").replace("{sub5}", "-").replace("{email}", "reader@mail.com").replace("{zip}", "90210")}
            </code>
          </div>
        </div>
      )}

      {tab === "delivery" && c.kind === "hostpost" && (
        <div className="space-y-5 fade-in">
          {/* form builder */}
          <div className="rounded-xl border border-line p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold flex items-center gap-2"><FlaskConical size={13} className="text-[#d9b380]" /> Form builder</p>
              <button type="button" onClick={() => patch({ formSpec: [...formSpec, { id: `f_${uid()}`, type: "text", label: "New field", required: false }] })}
                className="btn-ghost rounded-lg px-2.5 py-1.5 text-[11px] flex items-center gap-1"><Plus size={11} /> Add field</button>
            </div>
            {formSpec.map((f, i) => (
              <div key={f.id} className="grid grid-cols-[110px_1fr_80px_28px] gap-2 items-center">
                <select className="input-lux !py-2 !text-xs" value={f.type} onChange={(e) => updField(i, { type: e.target.value as FormFieldType })}>
                  {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input className="input-lux !py-2 !text-xs" value={f.label} onChange={(e) => updField(i, { label: e.target.value })} placeholder="Label" />
                <label className="flex items-center gap-1.5 text-[11px] text-[#8b8794]">
                  <input type="checkbox" checked={f.required} onChange={(e) => updField(i, { required: e.target.checked })} className="accent-[#d9b380]" /> req
                </label>
                <button type="button" onClick={() => patch({ formSpec: formSpec.filter((_, x) => x !== i) })} className="p-1 text-[#5d5867] hover:text-[#f0a0a8] transition" aria-label="Remove field"><Trash2 size={12} /></button>
                {f.type === "select" && (
                  <input className="input-lux !py-2 !text-xs col-span-4" value={f.options ?? ""} onChange={(e) => updField(i, { options: e.target.value })} placeholder="Select options, pipe-separated: Option A|Option B" />
                )}
                {(f.type === "text" || f.type === "zip" || f.type === "phone") && (
                  <input className="input-lux !py-2 !text-xs col-span-4 font-mono" value={f.pattern ?? ""} onChange={(e) => updField(i, { pattern: e.target.value })} placeholder="Validation regex (optional) e.g. ^[0-9]{5}$" />
                )}
              </div>
            ))}
            {!formSpec.some((f) => f.type === "email") && (
              <p className="text-[11px] text-[#f0a0a8] flex items-center gap-1"><TriangleAlert size={11} /> Host &amp; Post requires at least one email field.</p>
            )}
          </div>

          {/* posting config */}
          <div className="rounded-xl border border-line p-4 space-y-4">
            <p className="text-xs font-semibold flex items-center gap-2"><Link2 size={13} className="text-[#d9b380]" /> Posting config <Badge tone="gold">server-side only</Badge></p>
            <div className="grid sm:grid-cols-[1fr_110px] gap-3">
              <div><L>Endpoint URL</L>
                <input className="input-lux font-mono !text-xs" value={c.posting?.endpoint ?? ""} onChange={(e) => ppost({ endpoint: e.target.value })} placeholder="https://leads.advertiser.com/intake" /></div>
              <div><L>Method</L>
                <select className="input-lux" value={c.posting?.method} onChange={(e) => ppost({ method: e.target.value as "POST" | "PUT" })}>
                  <option>POST</option><option>PUT</option>
                </select></div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><L>Headers (one per line)</L>
                <textarea className="input-lux font-mono !text-xs" rows={2} value={c.posting?.headers} onChange={(e) => ppost({ headers: e.target.value })} placeholder={"X-Source: revbounce"} /></div>
              <div><L>Static params (key=value per line)</L>
                <textarea className="input-lux font-mono !text-xs" rows={2} value={c.posting?.staticParams} onChange={(e) => ppost({ staticParams: e.target.value })} placeholder={"offer=travel-club"} /></div>
              <div><L>Auth</L>
                <div className="flex gap-2">
                  <select className="input-lux !w-[110px]" value={c.posting?.authType} onChange={(e) => ppost({ authType: e.target.value as PostingConfig["authType"] })}>
                    <option value="none">none</option><option value="apikey">API key</option><option value="basic">Basic</option><option value="bearer">Bearer</option>
                  </select>
                  <input className="input-lux flex-1 !text-xs" type="password" value={c.posting?.authValue} onChange={(e) => ppost({ authValue: e.target.value })} placeholder="secret stays server-side" disabled={c.posting?.authType === "none"} />
                </div></div>
              <div><L>Body format</L>
                <select className="input-lux" value={c.posting?.bodyFormat} onChange={(e) => ppost({ bodyFormat: e.target.value as "json" | "form" })}>
                  <option value="json">JSON</option><option value="form">form-urlencoded</option>
                </select></div>
            </div>
            {/* field mapping */}
            <div>
              <L>Field mapping (form field → advertiser param)</L>
              <div className="space-y-2">
                {(c.posting?.mapping ?? []).map((m, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto_1fr_28px] gap-2 items-center">
                    <select className="input-lux !py-2 !text-xs" value={m.field}
                      onChange={(e) => { const mapping = [...(c.posting?.mapping ?? [])]; mapping[i] = { ...m, field: e.target.value }; ppost({ mapping }); }}>
                      {formSpec.map((f) => <option key={f.id} value={f.id}>{f.label || f.id}</option>)}
                    </select>
                    <span className="text-[#5d5867] text-xs">→</span>
                    <input className="input-lux !py-2 !text-xs font-mono" value={m.param}
                      onChange={(e) => { const mapping = [...(c.posting?.mapping ?? [])]; mapping[i] = { ...m, param: e.target.value }; ppost({ mapping }); }} placeholder="param_name" />
                    <button type="button" onClick={() => ppost({ mapping: (c.posting?.mapping ?? []).filter((_, x) => x !== i) })} className="p-1 text-[#5d5867] hover:text-[#f0a0a8]" aria-label="Remove mapping"><Trash2 size={12} /></button>
                  </div>
                ))}
                <button type="button" onClick={() => ppost({ mapping: [...(c.posting?.mapping ?? []), { field: formSpec[0]?.id ?? "email", param: "" }] })}
                  className="btn-ghost rounded-lg px-2.5 py-1.5 text-[11px] flex items-center gap-1"><Plus size={11} /> Add mapping</button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><L>Success HTTP</L>
                <input className="input-lux !py-2 !text-xs" type="number" value={c.posting?.successStatus} onChange={(e) => ppost({ successStatus: +e.target.value })} /></div>
              <div><L>Response contains</L>
                <input className="input-lux !py-2 !text-xs" value={c.posting?.successContains} onChange={(e) => ppost({ successContains: e.target.value })} placeholder="accepted" /></div>
              <div><L>Timeout (ms)</L>
                <input className="input-lux !py-2 !text-xs" type="number" step="500" value={c.posting?.timeoutMs} onChange={(e) => ppost({ timeoutMs: +e.target.value })} /></div>
              <div><L>Retries</L>
                <input className="input-lux !py-2 !text-xs" type="number" min="0" max="5" value={c.posting?.retries} onChange={(e) => ppost({ retries: +e.target.value })} /></div>
              <div className="col-span-2"><L>Duplicate rule</L>
                <select className="input-lux !py-2 !text-xs" value={c.posting?.duplicateRule} onChange={(e) => ppost({ duplicateRule: e.target.value as PostingConfig["duplicateRule"] })}>
                  <option value="skip">Skip duplicates</option><option value="allow">Allow duplicates</option><option value="update">Update existing</option>
                </select></div>
            </div>
          </div>

          {/* test post */}
          <div className="rounded-xl border border-[rgba(143,227,176,.25)] bg-[rgba(143,227,176,.04)] p-4 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-xs font-semibold flex items-center gap-2"><Beaker size={13} className="text-[#8fe3b0]" /> Test post — sends a sample lead through this config</p>
              <button type="button" onClick={runTestPost} disabled={testing || !c.posting?.endpoint}
                className="btn-gold rounded-lg px-3.5 py-1.5 text-[11px] disabled:opacity-50 ml-auto">
                {testing ? "Posting…" : "Send test lead"}
              </button>
            </div>
            <p className="text-[10.5px] text-[#8b8794]">Tip: point the endpoint at <code className="text-[#e8cf9f]">…fail…</code> or <code className="text-[#e8cf9f]">…slow…</code> to exercise the retry/timeout branch.</p>
            {testResult && (
              <div className="space-y-2.5 fade-in">
                {testResult.error && <p className="text-[11px] text-[#f0a0a8]">{testResult.error}</p>}
                {testResult.request && (
                  <div className="rounded-lg bg-black/35 border border-line p-3">
                    <p className="text-[10px] tracking-[0.22em] uppercase text-[#5d5867] mb-1.5">Worker request</p>
                    <code className="text-[11px] text-[#c9a068] block break-all">{testResult.request.method} {testResult.request.to} · {testResult.request.format}</code>
                    <code className="text-[11px] text-[#8b8794] block break-all mt-1">{typeof testResult.request.body === "string" ? testResult.request.body : JSON.stringify(testResult.request.body)}</code>
                  </div>
                )}
                {testResult.response && (
                  <div className="rounded-lg bg-black/35 border border-line p-3 flex items-start gap-3">
                    <Badge tone={testResult.successRule?.passed ? "mint" : "rose"}>{testResult.response.timedOut ? "TIMEOUT" : `HTTP ${testResult.response.status}`}</Badge>
                    <div className="min-w-0">
                      <code className="text-[11px] text-[#8b8794] block break-all">{JSON.stringify(testResult.response.body)}</code>
                      <p className="text-[10px] text-[#5d5867] mt-1">{testResult.response.ms}ms · success rule {testResult.successRule?.passed ? "PASSED ✔" : "FAILED ✘"} (expects HTTP {testResult.successRule?.expectedStatus}{testResult.successRule?.contains ? ` + "${testResult.successRule.contains}"` : ""})</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "targeting" && (
        <div className="space-y-4 fade-in">
          <div className="grid sm:grid-cols-2 gap-4">
            <div><L>Daily cap (blank = unlimited)</L>
              <input className="input-lux" type="number" min="0" value={c.dailyCap ?? ""} onChange={(e) => patch({ dailyCap: e.target.value === "" ? null : +e.target.value })} placeholder="∞" /></div>
            <div><L>Monthly cap (blank = unlimited)</L>
              <input className="input-lux" type="number" min="0" value={c.monthlyCap ?? ""} onChange={(e) => patch({ monthlyCap: e.target.value === "" ? null : +e.target.value })} placeholder="∞" /></div>
          </div>
          <p className="text-[11px] text-[#8b8794] -mt-2">When a cap is hit, the campaign is <b className="text-[#c9c4b8]">auto-skipped</b> in the pop&rsquo;s rotation sequence.</p>
          <div>
            <L>Geo targeting</L>
            <div className="flex flex-wrap gap-1.5">
              {GEO_OPTIONS.map((g) => {
                const on = c.countries.includes(g);
                return (
                  <button type="button" key={g} onClick={() => patch({ countries: on ? c.countries.filter((x) => x !== g) : [...c.countries, g] })}
                    className={`chip transition ${on ? "text-[#f0d9ae] border-[rgba(217,179,128,.5)] bg-[rgba(217,179,128,.09)]" : "text-[#8b8794] hover:text-white"}`}>{g}</button>
                );
              })}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><L>Devices</L>
              <div className="flex gap-2">
                {(["desktop", "mobile"] as const).map((d) => {
                  const on = c.devices.includes(d);
                  return (
                    <button type="button" key={d} onClick={() => patch({ devices: on ? c.devices.filter((x) => x !== d) : [...c.devices, d] })}
                      className={`flex-1 rounded-xl border p-2.5 text-xs capitalize transition ${on ? "border-[rgba(217,179,128,.55)] bg-[rgba(217,179,128,.07)]" : "border-line text-[#8b8794]"}`}>{d}</button>
                  );
                })}
              </div></div>
            <div><L>Traffic source</L>
              <select className="input-lux" value={c.trafficSource ?? "all"} onChange={(e) => patch({ trafficSource: e.target.value as Campaign["trafficSource"] })}>
                <option value="all">All sources</option><option value="direct">Direct</option><option value="search">Search</option><option value="social">Social</option>
              </select></div>
            <div><L>Schedule — start</L>
              <input className="input-lux" type="date" value={c.schedule?.start ?? ""} onChange={(e) => patch({ schedule: { start: e.target.value, end: c.schedule?.end ?? "" } })} /></div>
            <div><L>Schedule — end</L>
              <input className="input-lux" type="date" value={c.schedule?.end ?? ""} onChange={(e) => patch({ schedule: { start: c.schedule?.start ?? "", end: e.target.value } })} /></div>
          </div>
          <div>
            <L>Allowed pop types</L>
            <div className="flex flex-wrap gap-1.5">
              {POP_TYPE_OPTIONS.map((t) => {
                const on = (c.allowedPopTypes ?? []).includes(t);
                return (
                  <button type="button" key={t} onClick={() => patch({ allowedPopTypes: on ? (c.allowedPopTypes ?? []).filter((x) => x !== t) : [...(c.allowedPopTypes ?? []), t] })}
                    className={`chip transition ${on ? "text-[#b3a6f5] border-[rgba(139,124,240,.5)] bg-[rgba(139,124,240,.1)]" : "text-[#8b8794] hover:text-white"}`}>{t}</button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[11px] text-[#97919f] mb-1.5"><span>Rotation weight</span><span className="text-[#f0d9ae] font-semibold">{c.weight ?? 50}</span></div>
            <input type="range" min={1} max={100} value={c.weight ?? 50} className="lux-range"
              style={{ ["--pct" as string]: `${c.weight ?? 50}%` }}
              onChange={(e) => patch({ weight: +e.target.value })} />
            <p className="text-[10.5px] text-[#5d5867] mt-1.5">Heavier weights claim more impressions when the Optimizer splits traffic within a pop sequence.</p>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="btn-ghost rounded-xl px-5 py-3 text-sm flex-1">Cancel</button>
        <button type="submit" disabled={!valid}
          className="btn-gold rounded-xl px-5 py-3 text-sm flex-[2.2] disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          <Check size={15} /> {valid ? (c.id ? "Save campaign" : "Create campaign") : "Complete required fields"}
        </button>
      </div>
    </form>
  );
}
