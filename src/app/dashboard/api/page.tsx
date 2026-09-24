"use client";
import React, { useState } from "react";
import {
  Beaker, CheckCircle2, Database, Gauge, Loader2, Play, Server, Shield, TerminalSquare, XCircle,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Badge, Reveal } from "@/components/ui";
import type { TestResult } from "@/lib/edge-tests";

interface ModelDef { name: string; fields: string[]; indexes: string[]; note?: string }
interface Arm { campaignId: string; name: string; weight: number; epc: number; ecpm: number; exploring: boolean; reason: string }

export default function ApiPage() {
  const store = useStore();
  const [tab, setTab] = useState<"routes" | "schema" | "tests" | "optimizer">("tests");
  const [routes, setRoutes] = useState<string[]>([]);
  const [models, setModels] = useState<ModelDef[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [arms, setArms] = useState<Arm[]>([]);
  const [decisions, setDecisions] = useState<string[]>([]);
  const [token, setToken] = useState("");

  const login = async () => {
    const r = await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "admin@revbounce.com", password: "demo1234" }) });
    const b = await r.json();
    setToken(b.accessToken ?? "");
    return b.accessToken as string;
  };

  const loadMeta = async () => {
    const [r1, r2] = await Promise.all([fetch("/api/v1/meta/routes"), fetch("/api/v1/meta/schema")]);
    const b1 = await r1.json(), b2 = await r2.json();
    setRoutes(b1.routes ?? []);
    setModels(b2.models ?? []);
    setCounts(b2.counts ?? {});
  };

  React.useEffect(() => { loadMeta(); }, []);

  const runTests = async () => {
    setRunning(true);
    setResults([]);
    try {
      const r = await fetch("/api/v1/meta/selftest", { cache: "no-store" });
      const b = await r.json();
      setResults(b.results ?? []);
      store.toast(b.failed === 0 ? `All ${b.total} edge-case tests passed` : `${b.failed} of ${b.total} tests failed`, b.failed === 0 ? "success" : "error");
    } catch {
      store.toast("Test runner unreachable", "error");
    }
    setRunning(false);
  };

  const runOptimizer = async () => {
    const t = token || (await login());
    const r = await fetch("/api/v1/admin/optimize", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ site: "site_1", device: "desktop", geo: "US", seed: Math.floor(Math.random() * 1e6) }),
    });
    const b = await r.json();
    setArms(b.arms ?? []);
    setDecisions(b.decisions ?? []);
    store.toast("Optimizer run complete — weights reallocated");
  };

  const passed = results.filter((r) => r.pass).length;
  const groups = [...new Set(results.map((r) => r.group))];

  return (
    <div className="space-y-6">
      <Reveal className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="font-display text-3xl">API &amp; Engine</h1>
          <p className="text-sm text-[#8b8794] mt-1">REST surface, data model, the optimizer, and the §11 edge-case suite.</p>
        </div>
        <Badge tone="gold"><Server size={11} /> in-memory · no database</Badge>
      </Reveal>

      <div className="flex gap-2 flex-wrap">
        {([["tests", "Edge-case tests", Beaker], ["routes", "REST routes", TerminalSquare], ["schema", "Data model", Database], ["optimizer", "Optimizer", Gauge]] as const).map(([id, l, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`rounded-xl px-4 py-2.5 text-sm flex items-center gap-2 transition border ${tab === id ? "bg-[rgba(217,179,128,.12)] text-[#f0d9ae] border-[rgba(217,179,128,.3)]" : "border-line text-[#97919f] hover:text-white"}`}>
            <Icon size={14} /> {l}
          </button>
        ))}
      </div>

      {/* TESTS */}
      {tab === "tests" && (
        <>
          <Reveal className="glass rounded-2xl p-6 flex flex-wrap items-center gap-4">
            <span className="w-11 h-11 rounded-xl bg-[rgba(143,227,176,.1)] border border-[rgba(143,227,176,.28)] flex items-center justify-center text-[#8fe3b0]"><Beaker size={19} /></span>
            <div className="flex-1 min-w-[220px]">
              <p className="text-sm font-semibold">§11 edge cases + API contract</p>
              <p className="text-xs text-[#8b8794] mt-0.5">Runs live against the real HTTP endpoints — auth, RBAC, SSRF, dedupe, fraud, revenue splits, email delivery, embed guarantees.</p>
            </div>
            {results.length > 0 && (
              <Badge tone={passed === results.length ? "mint" : "rose"}>{passed}/{results.length} PASSING</Badge>
            )}
            <button onClick={runTests} disabled={running} className="btn-gold rounded-xl px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-60">
              {running ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} {running ? "Running…" : "Run suite"}
            </button>
          </Reveal>

          {results.length === 0 && !running && (
            <div className="glass rounded-2xl p-10 text-center">
              <p className="text-sm text-[#8b8794]">Press <b className="text-[#f0d9ae]">Run suite</b> — or from a terminal: <code className="text-[#e8cf9f]">node tests/run.mjs {typeof window !== "undefined" ? window.location.origin : ""}</code></p>
            </div>
          )}

          {groups.map((g) => {
            const rows = results.filter((r) => r.group === g);
            const allPass = rows.every((r) => r.pass);
            return (
              <Reveal key={g} className="glass rounded-2xl p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <h2 className="font-display text-lg">{g}</h2>
                  <Badge tone={allPass ? "mint" : "rose"}>{rows.filter((r) => r.pass).length}/{rows.length}</Badge>
                </div>
                <div className="space-y-1.5">
                  {rows.map((r) => (
                    <div key={r.id} className="flex items-start gap-3 rounded-lg border border-line px-3 py-2.5">
                      {r.pass ? <CheckCircle2 size={15} className="text-[#8fe3b0] flex-none mt-0.5" /> : <XCircle size={15} className="text-[#f0a0a8] flex-none mt-0.5" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px]">{r.name}</p>
                        <p className="text-[11px] text-[#8b8794] mt-0.5 font-mono break-words">{r.detail}</p>
                      </div>
                      <span className="text-[10px] text-[#5d5867] flex-none">{r.ms}ms</span>
                    </div>
                  ))}
                </div>
              </Reveal>
            );
          })}
        </>
      )}

      {/* ROUTES */}
      {tab === "routes" && (
        <Reveal className="glass rounded-2xl p-6">
          <h2 className="font-display text-xl mb-1">REST API</h2>
          <p className="text-xs text-[#8b8794] mb-5">JWT auth (access + refresh) · Zod-style validation · rate limited · CORS restricted on public routes.</p>
          <div className="grid md:grid-cols-2 gap-1.5">
            {routes.map((r) => (
              r.startsWith("—") ? (
                <p key={r} className="md:col-span-2 text-[10px] tracking-[0.25em] uppercase text-[#c9a068] mt-4 mb-1">{r.replace(/—/g, "").trim()}</p>
              ) : (
                <div key={r} className="rounded-lg border border-line px-3 py-2 font-mono text-[11.5px] text-[#c9c4b8] hover:border-[rgba(217,179,128,.35)] transition">
                  <span className="text-[#d9b380]">{r.split(" ")[0]}</span> {r.split(" ").slice(1).join(" ")}
                </div>
              )
            ))}
          </div>
          <div className="mt-6 rounded-xl bg-black/30 border border-line p-4">
            <p className="text-xs font-semibold mb-2 flex items-center gap-2"><Shield size={13} className="text-[#8fe3b0]" /> Security controls</p>
            <ul className="text-[11.5px] text-[#8b8794] space-y-1 list-disc pl-5">
              <li>HMAC-SHA256 signed tokens (access 15 min / refresh 30 d), revocable by jti</li>
              <li>HMAC session token issued at config fetch → event batches are signature-checked</li>
              <li>Rate limiting per IP and per site key on every public route</li>
              <li>SSRF guard blocks loopback, RFC-1918, CGNAT, link-local and cloud metadata</li>
              <li>Secrets AES-256-GCM at rest; every log line masked</li>
              <li>Bearer-token auth (CSRF-safe), audit log on every mutation, structured JSON errors</li>
            </ul>
          </div>
        </Reveal>
      )}

      {/* SCHEMA */}
      {tab === "schema" && (
        <>
          <Reveal className="glass rounded-2xl p-5 flex flex-wrap gap-3">
            {Object.entries(counts).filter(([, v]) => v > 0).map(([k, v]) => (
              <span key={k} className="chip text-[#c9c4b8]">{k} <b className="text-[#f0d9ae] ml-1">{v}</b></span>
            ))}
          </Reveal>
          <div className="grid md:grid-cols-2 gap-4">
            {models.map((m) => (
              <Reveal key={m.name} className="glass rounded-2xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-display text-lg">{m.name}</p>
                  <Badge tone="mute">{counts[m.name] ?? 0} rows</Badge>
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {m.fields.map((f) => <span key={f} className="text-[10.5px] font-mono text-[#8b8794] bg-black/25 border border-line rounded px-1.5 py-0.5">{f}</span>)}
                </div>
                <p className="text-[10.5px] text-[#5d5867]">
                  <span className="text-[#c9a068]">@@index</span> {m.indexes.join(" · ")}
                  {m.note ? <><br /><span className="text-[#8fe3b0]">note</span> {m.note}</> : null}
                </p>
              </Reveal>
            ))}
          </div>
        </>
      )}

      {/* OPTIMIZER */}
      {tab === "optimizer" && (
        <>
          <Reveal className="glass rounded-2xl p-6 flex flex-wrap items-center gap-4">
            <span className="w-11 h-11 rounded-xl bg-[rgba(139,124,240,.12)] border border-[rgba(139,124,240,.3)] flex items-center justify-center text-[#b3a6f5]"><Gauge size={19} /></span>
            <div className="flex-1 min-w-[220px]">
              <p className="text-sm font-semibold">Hourly allocation job — Thompson sampling</p>
              <p className="text-xs text-[#8b8794] mt-0.5">Computes EPC/eCPM per (site, device, geo) with a 200-impression minimum, 10% epsilon exploration, cap &amp; payout-floor guards.</p>
            </div>
            <button onClick={runOptimizer} className="btn-gold rounded-xl px-5 py-2.5 text-sm flex items-center gap-2"><Play size={15} /> Run now</button>
          </Reveal>
          {arms.length > 0 && (
            <Reveal className="glass rounded-2xl p-6">
              <h2 className="font-display text-xl mb-4">Allocation</h2>
              <div className="space-y-3">
                {arms.map((a) => (
                  <div key={a.campaignId} className="flex items-center gap-3 text-xs">
                    <span className="w-44 truncate text-[#c9c4b8]">{a.name}</span>
                    <div className="flex-1 h-2 rounded-full bg-[#1c1827] overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${a.weight}%`, background: a.exploring ? "linear-gradient(90deg,#8b7cf0,#5a4fc0)" : "linear-gradient(90deg,#8fe3b0,#3f9d6a)" }} />
                    </div>
                    <span className="w-10 text-right text-[#f0d9ae]">{a.weight}%</span>
                    <span className="w-16 text-right text-[#8b8794]">${a.epc.toFixed(3)}</span>
                    {a.exploring && <Badge tone="violet">EXPLORE</Badge>}
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-line">
                <p className="text-[10px] tracking-[0.25em] uppercase text-[#5d5867] mb-2">Decision audit</p>
                {decisions.map((d, i) => <p key={i} className="text-[11px] text-[#8b8794] font-mono">{d}</p>)}
              </div>
            </Reveal>
          )}
        </>
      )}
    </div>
  );
}
