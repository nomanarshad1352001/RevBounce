"use client"
import React, { useMemo, useState } from "react";
import { ArrowUpRight, CalendarClock, CircleDollarSign, Download, Gem, Landmark, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { PLANS, SERIES_30D, fmtMoney, fmtNum } from "@/lib/data";
import { Badge, Modal, Progress, Reveal } from "@/components/ui";
import type { PlanId } from "@/lib/types";

export default function RevenuePage() {
  const store = useStore();
  const [tab, setTab] = useState<"earnings" | "billing">("earnings");
  const [switchPlan, setSwitchPlan] = useState<PlanId | null>(null);
  const user = store.user;

  const rev30 = useMemo(() => SERIES_30D.reduce((a, d) => a + d.revenue, 0), []);
  const split = user?.split ?? 70;
  const mine = rev30 * (split / 100);
  const clicks30 = SERIES_30D.reduce((a, d) => a + d.clicks, 0);

  const plan = PLANS.find((p) => p.id === user?.plan);
  const isSubscription = user?.plan && user.plan !== "revshare";
  const usage = plan ? (clicks30 % plan.includedClicks) : 0; // demo: current month usage
  const overage = plan ? Math.max(0, usage - plan.includedClicks) : 0;

  const downloadInvoice = (id: string, amount: number, date: string) => {
    const body = [
      "REVBOUNCE LABS — INVOICE", "─".repeat(34),
      `Invoice:   ${id}`, `Date:      ${date}`, `Bill to:   ${user?.name} · ${user?.company}`, "",
      `Plan:      ${plan?.name ?? "Revenue Share"}`, `Amount:    ${fmtMoney(amount, 2)}`, `Status:    PAID`, "",
      "Thank you for monetizing with RevBounce.",
    ].join("\n");
    const blob = new Blob([body], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${id}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    store.toast(`Invoice ${id} downloaded`);
  };

  return (
    <div className="space-y-7">
      <Reveal className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="font-display text-3xl">Revenue & Billing</h1>
          <p className="text-sm text-[#8b8794] mt-1">Earnings, splits, payouts — and the plan that powers them.</p>
        </div>
        <div className="ml-auto glass rounded-xl p-1 flex gap-1">
          {([["earnings", "Earnings & payouts"], ["billing", "Plan & invoices"]] as const).map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${tab === id ? "bg-[rgba(217,179,128,.18)] text-[#f0d9ae]" : "text-[#8b8794] hover:text-white"}`}>
              {l}
            </button>
          ))}
        </div>
      </Reveal>

      {tab === "earnings" ? (
        <>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { icon: CircleDollarSign, l: "Gross revenue · 30d", v: fmtMoney(rev30), s: "all campaigns, all sites" },
              { icon: Gem, l: `Your share · ${split}%`, v: fmtMoney(mine), s: `platform keeps ${100 - split}%` },
              { icon: CalendarClock, l: "Next settlement", v: fmtMoney(store.payouts[0]?.amount ?? 0), s: "Jan 30 · wire ····4281" },
              { icon: ArrowUpRight, l: "EPC blended", v: `$${(rev30 / clicks30).toFixed(2)}`, s: `${fmtNum(clicks30)} monetized clicks` },
            ].map((s, i) => (
              <Reveal key={s.l} delay={(i % 4) as 0 | 1 | 2 | 3} className="glass rounded-2xl p-5 card-hover">
                <div className="flex items-center justify-between mb-3"><span className="text-xs text-[#8b8794]">{s.l}</span><s.icon size={16} className="text-[#d9b380]" /></div>
                <p className="font-display text-[26px] leading-none">{s.v}</p>
                <p className="text-[11px] text-[#8b8794] mt-2.5">{s.s}</p>
              </Reveal>
            ))}
          </div>

          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5">
            <Reveal className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-xl">Payout ledger</h2>
                <Badge tone="mint"><Landmark size={11} /> Twice monthly · net-0</Badge>
              </div>
              <div className="space-y-2.5">
                {store.payouts.map((p) => (
                  <div key={p.id} className="flex items-center gap-4 rounded-xl border border-line px-4 py-3.5 hover:border-[rgba(217,179,128,.3)] transition">
                    <span className="w-9 h-9 rounded-lg bg-[rgba(143,227,176,.08)] border border-[rgba(143,227,176,.2)] flex items-center justify-center text-[#8fe3b0] flex-none"><Landmark size={15} /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{p.id} <span className="text-[#5d5867]">· {p.method}</span></p>
                      <p className="text-[11px] text-[#8b8794]">{p.date}</p>
                    </div>
                    <Badge tone={p.status === "paid" ? "mint" : p.status === "processing" ? "gold" : "mute"}>{p.status.toUpperCase()}</Badge>
                    <p className="text-sm font-semibold w-24 text-right">{fmtMoney(p.amount, 2)}</p>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={1} className="glass rounded-2xl p-6">
              <h2 className="font-display text-xl mb-1">The split</h2>
              <p className="text-xs text-[#8b8794] mb-5">Set by your agreement — admins can tune it per publisher.</p>
              <div className="relative mx-auto w-[210px] h-[210px]">
                <svg viewBox="0 0 120 120" className="-rotate-90 w-full h-full">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#1c1827" strokeWidth="11" />
                  <circle cx="60" cy="60" r="50" fill="none" stroke="url(#splitG)" strokeWidth="11" strokeLinecap="round"
                    strokeDasharray={`${(split / 100) * 314} 314`} style={{ transition: "stroke-dasharray 1s ease" }} />
                  <defs><linearGradient id="splitG" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#f0d9ae" /><stop offset="100%" stopColor="#b0824f" />
                  </linearGradient></defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="font-display text-5xl gold-text">{split}%</p>
                  <p className="text-[10px] tracking-[0.3em] uppercase text-[#8b8794] mt-1">yours, always</p>
                </div>
              </div>
              <div className="mt-6 space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-[#97919f]">You received · 30d</span><span className="font-semibold text-[#f0d9ae]">{fmtMoney(mine)}</span></div>
                <div className="flex justify-between"><span className="text-[#97919f]">Platform operations · 30d</span><span className="font-semibold text-[#8b8794]">{fmtMoney(rev30 - mine)}</span></div>
              </div>
              <p className="text-[11px] text-[#8b8794] mt-5 leading-relaxed">Want a different arrangement? Enterprise agreements support custom splits — ask your success manager.</p>
            </Reveal>
          </div>
        </>
      ) : (
        <>
          {isSubscription && plan ? (
            <Reveal className="glass rounded-2xl p-6">
              <div className="flex flex-wrap items-center gap-5">
                <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#eed9ac] to-[#a97c4b] flex items-center justify-center text-[#16110a] font-display text-xl flex-none">{plan.name[0]}</span>
                <div className="flex-1 min-w-[220px]">
                  <p className="font-display text-2xl">{plan.name} <span className="text-base text-[#97919f] font-sans">{fmtMoney(plan.price)}/mo</span></p>
                  <p className="text-xs text-[#8b8794] mt-1">{plan.tagline}</p>
                </div>
                <Badge tone="mint">ACTIVE · renews Feb 1</Badge>
              </div>
              <div className="mt-6 grid md:grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between text-xs mb-2"><span className="text-[#97919f]">Included-click usage</span><span className="text-[#f0d9ae] font-semibold">{fmtNum(usage)} / {fmtNum(plan.includedClicks)}</span></div>
                  <Progress value={(usage / plan.includedClicks) * 100} tone={usage / plan.includedClicks > 0.85 ? "rose" : "gold"} />
                  <p className="text-[11px] text-[#8b8794] mt-2">Beyond the bundle: {usage > plan.includedClicks * 0.85 ? "approaching limit — " : ""}extra clicks bill at ${plan.overageRate.toFixed(3)} each.</p>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-2"><span className="text-[#97919f]">Overage this cycle</span><span className="font-semibold">{fmtNum(overage)} clicks · {fmtMoney(overage * plan.overageRate, 2)}</span></div>
                  <Progress value={overage > 0 ? 100 : 0} tone="mint" />
                  <p className="text-[11px] text-[#8b8794] mt-2">Overage appears as a separate line on your next invoice.</p>
                </div>
              </div>
            </Reveal>
          ) : (
            <Reveal className="glass rounded-2xl p-6 flex flex-wrap items-center gap-5">
              <span className="w-12 h-12 rounded-2xl bg-[rgba(143,227,176,.1)] border border-[rgba(143,227,176,.3)] flex items-center justify-center text-[#8fe3b0]"><Sparkles size={20} /></span>
              <div className="flex-1 min-w-[220px]">
                <p className="font-display text-2xl">Revenue Share — $0/mo</p>
                <p className="text-xs text-[#8b8794] mt-1">No subscription. You keep {split}% of everything your exits earn. Prefer owning campaigns outright? Pick a plan below.</p>
              </div>
              <Badge tone="mint">NO INVOICES · WE PAY YOU</Badge>
            </Reveal>
          )}

          <div className="grid md:grid-cols-3 gap-5">
            {PLANS.map((p, i) => {
              const current = user?.plan === p.id;
              return (
                <Reveal key={p.id} delay={(i % 3) as 0 | 1 | 2} className={`glass rounded-2xl p-6 card-hover ${current ? "border-[rgba(217,179,128,.5)]" : ""}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-display text-xl">{p.name}</p>
                    {current && <Badge tone="gold">CURRENT</Badge>}
                  </div>
                  <p className="mt-2 font-display text-3xl">{fmtMoney(p.price)}<span className="text-sm text-[#97919f] font-sans">/mo</span></p>
                  <ul className="mt-4 space-y-1.5 text-xs text-[#c9c4b8]">
                    <li>{p.includedClicks.toLocaleString()} clicks included</li>
                    <li>${p.overageRate.toFixed(3)} per extra click</li>
                    <li>{p.sites === -1 ? "Unlimited" : p.sites} site{p.sites !== 1 ? "s" : ""} · {p.pops === -1 ? "unlimited" : p.pops} pops</li>
                  </ul>
                  <button disabled={current} onClick={() => setSwitchPlan(p.id)}
                    className={`mt-5 w-full rounded-xl py-2.5 text-sm transition ${current ? "bg-white/[0.03] text-[#5d5867] cursor-default" : "btn-ghost"}`}>
                    {current ? "Your plan" : p.price > (plan?.price ?? 0) ? `Upgrade to ${p.name}` : `Switch to ${p.name}`}
                  </button>
                </Reveal>
              );
            })}
          </div>

          <Reveal className="glass rounded-2xl p-6">
            <h2 className="font-display text-xl mb-5">Invoices</h2>
            <div className="space-y-2.5">
              {store.invoices.map((inv) => (
                <div key={inv.id} className="flex items-center gap-4 rounded-xl border border-line px-4 py-3.5 hover:border-[rgba(217,179,128,.3)] transition">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{inv.id} <span className="text-[#5d5867]">· {inv.description}</span></p>
                    <p className="text-[11px] text-[#8b8794]">{inv.date}</p>
                  </div>
                  <Badge tone={inv.status === "paid" ? "mint" : inv.status === "due" ? "rose" : "mute"}>{inv.status.toUpperCase()}</Badge>
                  <p className="text-sm font-semibold w-20 text-right">{fmtMoney(inv.amount)}</p>
                  <button onClick={() => downloadInvoice(inv.id, inv.amount, inv.date)} className="p-2 rounded-lg hover:bg-white/5 text-[#8b8794] hover:text-white transition" aria-label="Download invoice"><Download size={15} /></button>
                </div>
              ))}
            </div>
          </Reveal>
        </>
      )}

      {/* plan switch confirm */}
      <Modal open={!!switchPlan} onClose={() => setSwitchPlan(null)} title="Change plan">
        {switchPlan && (() => {
          const p = PLANS.find((x) => x.id === switchPlan)!;
          return (
            <>
              <p className="text-sm text-[#a49ea8] mb-2">Move to <b className="text-[#f0d9ae]">{p.name}</b> at {fmtMoney(p.price)}/mo?</p>
              <ul className="text-xs text-[#8b8794] space-y-1.5 mb-6 list-disc pl-5">
                <li>Prorated today — no double charges</li>
                <li>{p.includedClicks.toLocaleString()} included clicks/month, then ${p.overageRate.toFixed(3)}/click</li>
                <li>Pops and sites keep serving uninterrupted</li>
              </ul>
              <div className="flex gap-3">
                <button onClick={() => setSwitchPlan(null)} className="btn-ghost rounded-xl px-4 py-2.5 text-sm flex-1">Stay on {plan?.name ?? "Revenue Share"}</button>
                <button onClick={() => { store.setPlan(p.id); setSwitchPlan(null); store.toast(`Now on the ${p.name} plan`); }}
                  className="btn-gold rounded-xl px-4 py-2.5 text-sm flex-1">Confirm switch</button>
              </div>
            </>
          );
        })()}
      </Modal>
    </div>
  );
}
