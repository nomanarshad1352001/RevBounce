"use client";
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban, Building2, Check, Crown, Eye, FileClock, Flag, Gauge, Layers, ShieldCheck,
  SlidersHorizontal, ToggleLeft, Users, Wallet,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { PLANS, SERIES_60D, fmtMoney, fmtNum, timeAgo } from "@/lib/data";
import { Badge, Reveal, Toggle } from "@/components/ui";
import { Donut } from "@/components/charts";
import type { PlanId } from "@/lib/types";

const TABS = [
  { id: "system", label: "System", icon: Gauge },
  { id: "advertisers", label: "Advertisers", icon: Building2 },
  { id: "publishers", label: "Publishers & sites", icon: Users },
  { id: "revshare", label: "Rev-share & plans", icon: SlidersHorizontal },
  { id: "payouts", label: "Payout approvals", icon: Wallet },
  { id: "fraud", label: "Fraud flags", icon: Flag },
  { id: "audit", label: "Audit log", icon: FileClock },
  { id: "flags", label: "Feature flags", icon: ToggleLeft },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function AdminPage() {
  const store = useStore();
  const router = useRouter();
  const isAdmin = store.user?.role === "admin";
  const [tab, setTab] = useState<TabId>("system");
  const [editSplit, setEditSplit] = useState<string | null>(null);
  const [splitDraft, setSplitDraft] = useState(70);
  const [planDrafts, setPlanDrafts] = useState<Record<PlanId, { price: number; clicks: number; rate: number }>>(() =>
    Object.fromEntries(PLANS.map((p) => [p.id, { price: p.price, clicks: p.includedClicks, rate: p.overageRate }])) as Record<PlanId, { price: number; clicks: number; rate: number }>);

  const platform = useMemo(() => {
    const gross = SERIES_60D.slice(-30).reduce((a, d) => a + d.revenue, 0) * 4.2;
    const keep = store.publishers.reduce((acc, p) => acc + p.revenue30d * ((100 - p.split) / 100), 0);
    return { gross, keep, active: store.publishers.filter((p) => p.status === "active").length, total: store.publishers.length };
  }, [store.publishers]);

  if (!isAdmin) {
    return (
      <div className="glass rounded-3xl p-14 text-center max-w-lg mx-auto mt-10">
        <ShieldCheck size={30} className="text-[#8b7cf0] mx-auto mb-4" />
        <h1 className="font-display text-2xl mb-2">Admin console</h1>
        <p className="text-sm text-[#8b8794]">You&rsquo;re signed in as a {store.user?.role}. Sign out and use the <b>Admin</b> demo account.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Reveal className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="font-display text-3xl">Admin Console</h1>
          <p className="text-sm text-[#8b8794] mt-1">Network health, demand, terms, risk and rollout control.</p>
        </div>
        <Badge tone="violet"><Crown size={11} /> FULL ACCESS</Badge>
      </Reveal>

      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`rounded-xl px-3.5 py-2 text-xs flex items-center gap-1.5 transition border ${tab === t.id ? "bg-[rgba(217,179,128,.12)] text-[#f0d9ae] border-[rgba(217,179,128,.3)]" : "border-line text-[#97919f] hover:text-white"}`}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* SYSTEM */}
      {tab === "system" && (
        <>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { icon: Wallet, l: "Network gross · 30d", v: fmtMoney(platform.gross), s: "all publishers" },
              { icon: Gauge, l: "Platform revenue", v: fmtMoney(platform.keep), s: "weighted splits" },
              { icon: Users, l: "Publishers", v: `${platform.active}/${platform.total}`, s: "active / total" },
              { icon: Flag, l: "Open fraud flags", v: `${store.fraudFlags.filter((f) => f.status === "open").length}`, s: "awaiting review" },
            ].map((s, i) => (
              <Reveal key={s.l} delay={(i % 4) as 0 | 1 | 2 | 3} className="glass rounded-2xl p-5 card-hover">
                <div className="flex items-center justify-between mb-3"><span className="text-xs text-[#8b8794]">{s.l}</span><s.icon size={16} className="text-[#8b7cf0]" /></div>
                <p className="font-display text-[26px] leading-none">{s.v}</p>
                <p className="text-[11px] text-[#8b8794] mt-2.5">{s.s}</p>
              </Reveal>
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-5">
            <Reveal className="glass rounded-2xl p-6">
              <h2 className="font-display text-xl mb-4">Business mix</h2>
              <Donut size={170} slices={[
                { label: "Revenue-share publishers", value: store.publishers.filter((p) => p.model === "revshare").length, color: "#d9b380" },
                { label: "Pay-for-System publishers", value: store.publishers.filter((p) => p.model === "subscription").length, color: "#8b7cf0" },
              ]} />
            </Reveal>
            <Reveal delay={1} className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl">Rotation optimizer</h2>
                <Toggle on={store.optimizerOn} onChange={(v) => { store.setOptimizer(v); store.logAudit(v ? "enabled optimizer" : "paused optimizer", "network"); store.toast(v ? "Optimizer engaged" : "Optimizer paused", "info"); }} label="optimizer" />
              </div>
              <div className="space-y-3">
                {store.campaigns.filter((c) => c.status === "active").map((c) => (
                  <div key={c.id} className="flex items-center gap-3 text-xs">
                    <span className="w-36 truncate text-[#c9c4b8]">{c.name}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-[#1c1827] overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${c.optimizerScore}%`, background: store.optimizerOn ? "linear-gradient(90deg,#8fe3b0,#3f9d6a)" : "#3a3244" }} />
                    </div>
                    <span className={`w-6 text-right ${store.optimizerOn ? "text-[#8fe3b0]" : "text-[#5d5867]"}`}>{c.optimizerScore}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </>
      )}

      {/* ADVERTISERS */}
      {tab === "advertisers" && (
        <Reveal className="glass rounded-2xl p-2 sm:p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-[10px] tracking-[0.2em] uppercase text-[#5d5867] border-b border-line">
                  <th className="pb-3 pl-2 font-medium">Advertiser</th><th className="pb-3 font-medium">Contact</th>
                  <th className="pb-3 font-medium text-right">Campaigns</th><th className="pb-3 font-medium text-right">Spend 30d</th>
                  <th className="pb-3 font-medium">Status</th><th className="pb-3 font-medium text-right pr-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {store.advertisers.map((a) => (
                  <tr key={a.id} className="border-b border-line/50 last:border-0 hover:bg-white/[0.02] transition">
                    <td className="py-3.5 pl-2 pr-4 text-[13px] font-medium">{a.name}</td>
                    <td className="py-3.5 pr-4 text-[11.5px] text-[#8b8794]">{a.contact}</td>
                    <td className="py-3.5 pr-4 text-right tabular-nums text-[#c9c4b8]">{a.campaigns}</td>
                    <td className="py-3.5 pr-4 text-right tabular-nums font-semibold text-[#f0d9ae]">{fmtMoney(a.spend30d)}</td>
                    <td className="py-3.5 pr-4"><Badge tone={a.status === "active" ? "mint" : "rose"}>{a.status.toUpperCase()}</Badge></td>
                    <td className="py-3.5 pr-2 text-right">
                      <button onClick={() => { store.toggleAdvertiser(a.id); store.logAudit(a.status === "active" ? "paused advertiser" : "activated advertiser", a.name); store.toast(`${a.name} ${a.status === "active" ? "paused" : "activated"}`, "info"); }}
                        className="btn-ghost rounded-lg px-3 py-1.5 text-[11px]">{a.status === "active" ? "Pause" : "Activate"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 px-2 flex gap-2">
            <button onClick={() => router.push("/dashboard/campaigns")} className="btn-ghost rounded-xl px-4 py-2.5 text-xs flex items-center gap-1.5"><Layers size={13} /> Manage all campaigns</button>
          </div>
        </Reveal>
      )}

      {/* PUBLISHERS */}
      {tab === "publishers" && (
        <Reveal className="glass rounded-2xl p-2 sm:p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="text-left text-[10px] tracking-[0.2em] uppercase text-[#5d5867] border-b border-line">
                  <th className="pb-3 pl-2 font-medium">Publisher</th><th className="pb-3 font-medium">Model</th>
                  <th className="pb-3 font-medium">Split</th><th className="pb-3 font-medium text-right">Clicks 30d</th>
                  <th className="pb-3 font-medium text-right">Revenue 30d</th><th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium text-right pr-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {store.publishers.map((p) => (
                  <tr key={p.id} className="border-b border-line/50 last:border-0 hover:bg-white/[0.02] transition">
                    <td className="py-3.5 pl-2 pr-4"><p className="text-[13px] font-medium">{p.name}</p><p className="text-[11px] text-[#8b8794]">{p.company} · {p.sites} sites</p></td>
                    <td className="py-3.5 pr-4"><Badge tone={p.model === "revshare" ? "gold" : "violet"}>{p.model === "revshare" ? "REV-SHARE" : "SUB"}</Badge></td>
                    <td className="py-3.5 pr-4">
                      {editSplit === p.id ? (
                        <div className="flex items-center gap-2">
                          <input type="number" min={50} max={95} value={splitDraft} onChange={(e) => setSplitDraft(+e.target.value)} className="input-lux !w-20 !py-1.5 text-center" autoFocus />
                          <button onClick={() => { const v = Math.min(95, Math.max(50, splitDraft)); store.setSplit(p.id, v); store.logAudit("changed revenue split", `${p.name} → ${v}/${100 - v}`); setEditSplit(null); store.toast(`${p.name} split set to ${v}/${100 - v}`); }}
                            className="p-1.5 rounded-lg bg-[rgba(143,227,176,.15)] text-[#8fe3b0]" aria-label="Save"><Check size={13} /></button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditSplit(p.id); setSplitDraft(p.split); }} className="chip text-[#f0d9ae] border-[rgba(217,179,128,.4)] bg-[rgba(217,179,128,.08)]">{p.split} / {100 - p.split}</button>
                      )}
                    </td>
                    <td className="py-3.5 pr-4 text-right tabular-nums text-[#c9c4b8]">{fmtNum(p.clicks30d)}</td>
                    <td className="py-3.5 pr-4 text-right tabular-nums font-semibold text-[#f0d9ae]">{fmtMoney(p.revenue30d)}</td>
                    <td className="py-3.5 pr-4"><Badge tone={p.status === "active" ? "mint" : "rose"}>{p.status.toUpperCase()}</Badge></td>
                    <td className="py-3.5 pr-2">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => { store.togglePublisherStatus(p.id); store.logAudit(p.status === "active" ? "suspended publisher" : "reinstated publisher", p.name); store.toast(`${p.name} ${p.status === "active" ? "suspended" : "reinstated"}`, p.status === "active" ? "error" : "success"); }}
                          className="p-2 rounded-lg hover:bg-white/5 text-[#97919f] hover:text-[#f0a0a8] transition" title="Suspend"><Ban size={14} /></button>
                        <button onClick={() => { if (p.id === "u_pub") { store.toast("Seeded account — use the Publisher demo login", "info"); return; } store.impersonate(p); store.logAudit("impersonated publisher", p.name); router.push("/dashboard"); }}
                          className="p-2 rounded-lg hover:bg-white/5 text-[#97919f] hover:text-[#b3a6f5] transition" title="Impersonate"><Eye size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      )}

      {/* REV-SHARE & PLAN EDITOR */}
      {tab === "revshare" && (
        <>
          <Reveal className="glass rounded-2xl p-6">
            <h2 className="font-display text-xl mb-1">Default revenue-share</h2>
            <p className="text-xs text-[#8b8794] mb-4">Applied to new publishers; per-publisher overrides live in the Publishers tab.</p>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <div className="flex justify-between text-xs mb-1.5"><span className="text-[#97919f]">Publisher keeps</span><span className="text-[#f0d9ae] font-semibold">{splitDraft}% / platform {100 - splitDraft}%</span></div>
                <input type="range" min={50} max={95} value={splitDraft} className="lux-range" style={{ ["--pct" as string]: `${((splitDraft - 50) / 45) * 100}%` }} onChange={(e) => setSplitDraft(+e.target.value)} />
              </div>
              <button onClick={() => { store.logAudit("changed default rev-share", `${splitDraft}/${100 - splitDraft}`); store.toast(`Default split set to ${splitDraft}/${100 - splitDraft}`); }}
                className="btn-gold rounded-xl px-5 py-2.5 text-sm">Save default</button>
            </div>
          </Reveal>
          <Reveal delay={1} className="glass rounded-2xl p-6">
            <h2 className="font-display text-xl mb-1">Plan / tier editor</h2>
            <p className="text-xs text-[#8b8794] mb-5">Price, included clicks and overage rate per tier.</p>
            <div className="space-y-3">
              {PLANS.map((p) => (
                <div key={p.id} className="grid sm:grid-cols-[120px_1fr_1fr_1fr_auto] gap-3 items-end rounded-xl border border-line p-4">
                  <p className="font-display text-lg">{p.name}</p>
                  <div><label className="text-[10px] uppercase tracking-wider text-[#8b8794] block mb-1">Price / mo</label>
                    <input className="input-lux !py-2 !text-xs" type="number" value={planDrafts[p.id].price} onChange={(e) => setPlanDrafts({ ...planDrafts, [p.id]: { ...planDrafts[p.id], price: +e.target.value } })} /></div>
                  <div><label className="text-[10px] uppercase tracking-wider text-[#8b8794] block mb-1">Included clicks</label>
                    <input className="input-lux !py-2 !text-xs" type="number" step={1000} value={planDrafts[p.id].clicks} onChange={(e) => setPlanDrafts({ ...planDrafts, [p.id]: { ...planDrafts[p.id], clicks: +e.target.value } })} /></div>
                  <div><label className="text-[10px] uppercase tracking-wider text-[#8b8794] block mb-1">Overage / click</label>
                    <input className="input-lux !py-2 !text-xs" type="number" step={0.001} value={planDrafts[p.id].rate} onChange={(e) => setPlanDrafts({ ...planDrafts, [p.id]: { ...planDrafts[p.id], rate: +e.target.value } })} /></div>
                  <button onClick={() => { store.logAudit("updated plan tier", `${p.name} · $${planDrafts[p.id].price} · ${planDrafts[p.id].clicks} clicks`); store.toast(`${p.name} tier updated`); }}
                    className="btn-ghost rounded-xl px-4 py-2.5 text-xs">Save</button>
                </div>
              ))}
            </div>
          </Reveal>
        </>
      )}

      {/* PAYOUT APPROVALS */}
      {tab === "payouts" && (
        <Reveal className="glass rounded-2xl p-2 sm:p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[780px]">
              <thead>
                <tr className="text-left text-[10px] tracking-[0.2em] uppercase text-[#5d5867] border-b border-line">
                  <th className="pb-3 pl-2 font-medium">Period</th><th className="pb-3 font-medium">Publisher</th>
                  <th className="pb-3 font-medium text-right">Gross</th><th className="pb-3 font-medium text-right">Net</th>
                  <th className="pb-3 font-medium">Status</th><th className="pb-3 font-medium text-right pr-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {store.payoutPeriods.map((p) => (
                  <tr key={p.id} className="border-b border-line/50 last:border-0 hover:bg-white/[0.02] transition">
                    <td className="py-3.5 pl-2 pr-4 text-[12.5px]">{p.period}</td>
                    <td className="py-3.5 pr-4 text-[12.5px] text-[#c9c4b8]">{p.publisher}</td>
                    <td className="py-3.5 pr-4 text-right tabular-nums text-[#97919f]">{fmtMoney(p.gross, 2)}</td>
                    <td className="py-3.5 pr-4 text-right tabular-nums font-semibold text-[#f0d9ae]">{fmtMoney(p.net, 2)}</td>
                    <td className="py-3.5 pr-4"><Badge tone={p.status === "paid" ? "mint" : p.status === "approved" ? "violet" : "gold"}>{p.status.toUpperCase()}</Badge></td>
                    <td className="py-3.5 pr-2 text-right">
                      {p.status === "pending" && (
                        <button onClick={() => { store.setPayoutStatus(p.id, "approved"); store.logAudit("approved payout", `${p.id} · ${fmtMoney(p.net, 2)}`); store.toast(`${p.publisher} approved`); }}
                          className="rounded-lg px-3 py-1.5 text-[11px] bg-[rgba(139,124,240,.14)] border border-[rgba(139,124,240,.35)] text-[#b3a6f5]">Approve</button>
                      )}
                      {p.status === "approved" && (
                        <button onClick={() => { store.setPayoutStatus(p.id, "paid"); store.logAudit("marked payout paid", `${p.id} · ${fmtMoney(p.net, 2)}`); store.toast(`${fmtMoney(p.net, 2)} marked paid`); }}
                          className="rounded-lg px-3 py-1.5 text-[11px] bg-[rgba(143,227,176,.14)] border border-[rgba(143,227,176,.35)] text-[#8fe3b0]">Mark paid</button>
                      )}
                      {p.status === "paid" && <span className="text-[11px] text-[#5d5867]">settled</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      )}

      {/* FRAUD */}
      {tab === "fraud" && (
        <Reveal className="space-y-3">
          {store.fraudFlags.map((f) => (
            <div key={f.id} className="glass rounded-2xl p-5 flex flex-wrap items-center gap-4">
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-none ${f.severity === "high" ? "bg-[rgba(240,160,168,.14)] text-[#f0a0a8]" : f.severity === "medium" ? "bg-[rgba(217,179,128,.12)] text-[#d9b380]" : "bg-[rgba(151,145,159,.12)] text-[#97919f]"}`}>
                <Flag size={17} />
              </span>
              <div className="min-w-[220px] flex-1">
                <p className="text-sm font-medium">{f.site} <span className="text-[11px] text-[#8b8794]">· {f.clicks} clicks · {timeAgo(f.ts)}</span></p>
                <p className="text-xs text-[#8b8794] mt-0.5">{f.reason}</p>
              </div>
              <Badge tone={f.severity === "high" ? "rose" : f.severity === "medium" ? "gold" : "mute"}>{f.severity.toUpperCase()}</Badge>
              <Badge tone={f.status === "open" ? "gold" : f.status === "cleared" ? "mint" : "violet"}>{f.status.toUpperCase()}</Badge>
              {f.status === "open" && (
                <div className="flex gap-2">
                  <button onClick={() => { store.setFraudStatus(f.id, "cleared"); store.logAudit("cleared fraud flag", `${f.site} · ${f.clicks} clicks`); store.toast("Flag cleared — clicks remain payable"); }}
                    className="rounded-lg px-3 py-1.5 text-[11px] bg-[rgba(143,227,176,.12)] border border-[rgba(143,227,176,.32)] text-[#8fe3b0]">Clear</button>
                  <button onClick={() => { store.setFraudStatus(f.id, "withheld"); store.logAudit("withheld invalid clicks", `${f.site} · ${f.clicks} clicks`); store.toast(`${f.clicks} clicks withheld from payout`, "error"); }}
                    className="rounded-lg px-3 py-1.5 text-[11px] bg-[rgba(240,160,168,.12)] border border-[rgba(240,160,168,.35)] text-[#f0a0a8]">Withhold</button>
                </div>
              )}
            </div>
          ))}
        </Reveal>
      )}

      {/* AUDIT */}
      {tab === "audit" && (
        <Reveal className="glass rounded-2xl p-2 sm:p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-[10px] tracking-[0.2em] uppercase text-[#5d5867] border-b border-line">
                  <th className="pb-3 pl-2 font-medium">When</th><th className="pb-3 font-medium">Actor</th>
                  <th className="pb-3 font-medium">Action</th><th className="pb-3 font-medium">Target</th><th className="pb-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {store.auditLog.map((a) => (
                  <tr key={a.id} className="border-b border-line/50 last:border-0 hover:bg-white/[0.02] transition">
                    <td className="py-3 pl-2 pr-4 text-[11.5px] text-[#97919f]">{timeAgo(a.ts)}</td>
                    <td className="py-3 pr-4 text-[12px] text-[#c9c4b8]">{a.actor}</td>
                    <td className="py-3 pr-4 text-[12px] text-[#f0d9ae]">{a.action}</td>
                    <td className="py-3 pr-4 text-[11.5px] text-[#8b8794] max-w-[260px] truncate">{a.target}</td>
                    <td className="py-3 pr-2 text-[11px] font-mono text-[#5d5867]">{a.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      )}

      {/* FEATURE FLAGS */}
      {tab === "flags" && (
        <Reveal className="space-y-3">
          {store.featureFlags.map((f) => (
            <div key={f.id} className="glass rounded-2xl p-5 flex flex-wrap items-center gap-4">
              <Toggle on={f.on} onChange={() => { store.toggleFlag(f.id); store.logAudit(f.on ? "disabled feature flag" : "enabled feature flag", f.label); store.toast(`${f.label} ${f.on ? "disabled" : "enabled"}`, "info"); }} label={f.label} />
              <div className="min-w-[220px] flex-1">
                <p className="text-sm font-medium">{f.label}</p>
                <p className="text-xs text-[#8b8794] mt-0.5">{f.description}</p>
              </div>
              <div className="w-44">
                <div className="flex justify-between text-[10px] text-[#8b8794] mb-1"><span>Rollout</span><span className="text-[#f0d9ae]">{f.rollout}%</span></div>
                <input type="range" min={0} max={100} value={f.rollout} className="lux-range" disabled={!f.on}
                  style={{ ["--pct" as string]: `${f.rollout}%` }} onChange={(e) => store.setFlagRollout(f.id, +e.target.value)} />
              </div>
              <code className="text-[10px] text-[#5d5867] font-mono">{f.id}</code>
            </div>
          ))}
        </Reveal>
      )}
    </div>
  );
}
