"use client";
import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, BarChart3, CircleDollarSign, EllipsisVertical, Eye, HandCoins, HelpCircle, LifeBuoy,
  MousePointerClick, Pencil, Plus, SquarePlay, TrendingDown, TrendingUp, UserPlus,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { SERIES_60D, ctr, ecpm, fmtMoney, fmtNum, seedLiveEvents, timeAgo, uid } from "@/lib/data";
import { AreaChart, Donut, Spark } from "@/components/charts";
import { Badge, Reveal } from "@/components/ui";
import type { DayPoint, TrackEvent } from "@/lib/types";

const RANGES = [{ id: 7, label: "7D" }, { id: 14, label: "14D" }, { id: 30, label: "30D" }] as const;
const METRICS = [
  { id: "revenue", label: "Revenue", color: "#d9b380", fmt: (v: number) => fmtMoney(v) },
  { id: "impressions", label: "Impressions", color: "#8b7cf0", fmt: (v: number) => fmtNum(v) },
  { id: "clicks", label: "Clicks", color: "#8fe3b0", fmt: (v: number) => fmtNum(v) },
] as const;
type MetricId = (typeof METRICS)[number]["id"];
type Gran = "daily" | "weekly" | "monthly";

const EV_STYLE: Record<TrackEvent["type"], { dot: string; label: string }> = {
  impression: { dot: "bg-[#8b7cf0]", label: "Impression" },
  click: { dot: "bg-[#d9b380]", label: "Click" },
  conversion: { dot: "bg-[#8fe3b0]", label: "Conversion" },
  close: { dot: "bg-[#5d5867]", label: "Dismissed" },
};

function aggregate(data: DayPoint[], gran: Gran): DayPoint[] {
  if (gran === "daily") return data;
  const size = gran === "weekly" ? 7 : 30;
  const out: DayPoint[] = [];
  for (let i = 0; i < data.length; i += size) {
    const chunk = data.slice(i, i + size);
    out.push({
      day: gran === "weekly" ? `wk of ${chunk[0].day}` : chunk[0].day.split(" ")[0],
      revenue: +chunk.reduce((a, d) => a + d.revenue, 0).toFixed(2),
      clicks: chunk.reduce((a, d) => a + d.clicks, 0),
      impressions: chunk.reduce((a, d) => a + d.impressions, 0),
      conversions: chunk.reduce((a, d) => a + d.conversions, 0),
    });
  }
  return out;
}

function sum(data: DayPoint[], k: keyof Omit<DayPoint, "day">) {
  return data.reduce((a, d) => a + d[k], 0);
}
const delta = (cur: number, prev: number) => (prev ? ((cur - prev) / prev) * 100 : 0);

export default function OverviewPage() {
  const store = useStore();
  const isAdmin = store.user?.role === "admin";
  const [range, setRange] = useState<7 | 14 | 30>(7);
  const [metric, setMetric] = useState<MetricId>("revenue");
  const [gran, setGran] = useState<Gran>("daily");
  const [events, setEvents] = useState<TrackEvent[]>(() => seedLiveEvents(7));
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  React.useEffect(() => {
    setNow(Date.now());
    const iv = setInterval(() => {
      setEvents((prev) => {
        const types: TrackEvent["type"][] = ["impression", "impression", "close", "click", "impression", "conversion"];
        const type = types[Math.floor(Math.random() * types.length)];
        const camps = ["Azure Travel Club", "NovaShield VPN", "Lumina Insurance", "Google Click Feed"];
        const ev: TrackEvent = {
          id: uid(), ts: Date.now(), type,
          site: ["The Gilded Post", "Circuit & Ember", "Velvet Ledger Blog"][Math.floor(Math.random() * 3)],
          campaign: camps[Math.floor(Math.random() * camps.length)],
          country: ["US", "UK", "CA", "AU", "DE"][Math.floor(Math.random() * 5)],
          device: Math.random() > 0.42 ? "desktop" : "mobile",
          revenue: type === "conversion" ? +(2 + Math.random() * 30).toFixed(2) : 0,
        };
        return [ev, ...prev].slice(0, 7);
      });
      setNow(Date.now());
    }, 4200);
    return () => clearInterval(iv);
  }, []);

  // current vs previous period (comparison per §5.1)
  const cur = useMemo(() => SERIES_60D.slice(-range), [range]);
  const prev = useMemo(() => SERIES_60D.slice(-range * 2, -range), [range]);
  const kpis = useMemo(() => {
    const rev = sum(cur, "revenue"), imp = sum(cur, "impressions"), clk = sum(cur, "clicks");
    const prevRev = sum(prev, "revenue"), prevImp = sum(prev, "impressions"), prevClk = sum(prev, "clicks");
    return {
      rev, imp, clk, ecpm: ecpm(rev, imp), prevEcpm: ecpm(prevRev, prevImp),
      dRev: delta(rev, prevRev), dImp: delta(imp, prevImp), dClk: delta(clk, prevClk),
      dEcpm: delta(ecpm(rev, imp), ecpm(prevRev, prevImp)),
    };
  }, [cur, prev]);

  const chartData = useMemo(() => aggregate(cur, gran).map((d) => ({ day: d.day, value: d[metric] })), [cur, gran, metric]);
  const metricMeta = METRICS.find((m) => m.id === metric)!;

  const popRevenue = (p: (typeof store.pops)[number]) =>
    p.stats.conversions * (store.campaigns.find((c) => c.id === p.campaignIds[0])?.payout ?? 2.4);

  // top performing pops (§5.1)
  const topPops = useMemo(
    () => [...store.pops].sort((a, b) => popRevenue(b) - popRevenue(a)).slice(0, 5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.pops, store.campaigns],
  );

  // performance by pop type (§5.1) — real pop stats + seeded auxiliary types
  const typeRows = useMemo(() => {
    const byT = (tmpl: string) => store.pops.filter((p) => p.template === tmpl).reduce(
      (a, p) => ({ imps: a.imps + p.stats.impressions, clk: a.clk + p.stats.clicks, rev: a.rev + popRevenue(p) }),
      { imps: 0, clk: 0, rev: 0 },
    );
    const exit = store.pops.filter((p) => p.trigger.type === "exit").reduce((a, p) => ({ imps: a.imps + p.stats.impressions, clk: a.clk + p.stats.clicks, rev: a.rev + popRevenue(p) }), { imps: 0, clk: 0, rev: 0 });
    const idle = store.pops.filter((p) => p.trigger.type === "idle").reduce((a, p) => ({ imps: a.imps + p.stats.impressions, clk: a.clk + p.stats.clicks, rev: a.rev + popRevenue(p) }), { imps: 0, clk: 0, rev: 0 });
    const timed = byT("corner");
    return [
      { id: "exit", t: "Exit Intent", status: "active", ...exit },
      { id: "idle", t: "Inactivity", status: "active", ...idle },
      { id: "decline", t: "Decline Page", status: "active", imps: 38_204, clk: 2_911, rev: 1_842.3 },
      { id: "offer", t: "Offer Wall", status: "paused", imps: 61_900, clk: 5_112, rev: 2_204.6 },
      { id: "emailcap", t: "Email Capture", status: store.pops.find((p) => p.template === "corner")?.status ?? "active", ...timed },
      { id: "ty", t: "Thank You Page", status: "draft", imps: 24_020, clk: 1_009, rev: 640.1 },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.pops, store.campaigns]);

  const donut = useMemo(() => {
    const counts = { Active: 0, Paused: 0, Draft: 0, Archived: 1, colors: { Active: "#8fe3b0", Paused: "#d9b380", Draft: "#8b7cf0", Archived: "#3a3244" } };
    store.pops.forEach((p) => { counts[p.status === "active" ? "Active" : "Paused"]++; });
    if (!counts.Draft) counts.Draft = openMenu ? 0 : 0; // drafts surface when created
    return Object.entries(counts)
      .filter(([k, v]) => typeof v === "number" && (v as number) > 0)
      .map(([label, value]) => ({ label, value: value as number, color: counts.colors[label as keyof typeof counts.colors] }));
  }, [store.pops, openMenu]);

  const kpiCards = [
    { icon: CircleDollarSign, label: "Revenue", v: kpis.rev, d: kpis.dRev, fmt: (n: number) => fmtMoney(n), spark: cur.slice(-14).map((d) => d.revenue), c: "#d9b380" },
    { icon: Eye, label: "Impressions", v: kpis.imp, d: kpis.dImp, fmt: (n: number) => fmtNum(n), spark: cur.slice(-14).map((d) => d.impressions), c: "#8b7cf0" },
    { icon: MousePointerClick, label: "Clicks", v: kpis.clk, d: kpis.dClk, fmt: (n: number) => fmtNum(n), spark: cur.slice(-14).map((d) => d.clicks), c: "#8fe3b0" },
    { icon: HandCoins, label: "eCPM", v: kpis.ecpm, d: kpis.dEcpm, fmt: (n: number) => `$${n.toFixed(2)}`, spark: cur.slice(-14).map((d) => ecpm(d.revenue, d.impressions)), c: "#f0a0a8" },
  ];

  return (
    <div className="space-y-6">
      {/* header — range picker + Create New Pop (§5.1) */}
      <Reveal className="flex flex-wrap items-end gap-3">
        <div>
          <p className="text-xs tracking-[0.3em] uppercase text-[#8b8794]">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="font-display text-3xl mt-1.5">Good evening, <span className="gold-text">{store.user?.name.split(" ")[0]}</span></h1>
        </div>
        <div className="ml-auto flex items-center gap-2.5 flex-wrap">
          <div className="glass rounded-xl p-1 flex gap-1">
            {RANGES.map((r) => (
              <button key={r.id} onClick={() => setRange(r.id)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${range === r.id ? "bg-[rgba(217,179,128,.18)] text-[#f0d9ae]" : "text-[#8b8794] hover:text-white"}`}>
                {r.label}
              </button>
            ))}
          </div>
          <Badge tone="mute">vs previous {range}d</Badge>
          <Link href="/dashboard/pops" className="btn-gold rounded-xl px-4 py-2.5 text-sm flex items-center gap-2"><Plus size={15} /> Create New Pop</Link>
        </div>
      </Reveal>

      {/* KPI cards (§5.1: sparkline + % change vs previous period) */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiCards.map((s, i) => {
          const up = s.d >= 0;
          return (
            <Reveal key={s.label} delay={(i % 4) as 0 | 1 | 2 | 3} className="glass rounded-2xl p-5 card-hover">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[#8b8794]">{s.label} · {range}d</span>
                <s.icon size={16} style={{ color: s.c }} />
              </div>
              <p className="font-display text-[26px] leading-none">{s.fmt(s.v)}</p>
              <div className="flex items-end justify-between mt-3">
                <span className={`text-[11px] flex items-center gap-1 ${up ? "text-[#8fe3b0]" : "text-[#f0a0a8]"}`}>
                  {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{up ? "+" : ""}{s.d.toFixed(1)}% vs prev
                </span>
                <Spark data={s.spark} color={s.c} />
              </div>
            </Reveal>
          );
        })}
      </div>

      {/* revenue & traffic chart (§5.1: metric chips + daily/weekly/monthly) */}
      <Reveal className="glass rounded-2xl p-6">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="mr-1">
            <h2 className="font-display text-xl">Revenue &amp; Traffic</h2>
            <p className="text-xs text-[#8b8794] mt-0.5">{metricMeta.label} · {gran}</p>
          </div>
          <div className="flex gap-1.5">
            {METRICS.map((m) => (
              <button key={m.id} onClick={() => setMetric(m.id)}
                className={`rounded-lg px-3 py-1.5 text-xs transition border flex items-center gap-1.5 ${metric === m.id ? "border-[rgba(217,179,128,.45)] text-[#f0d9ae] bg-[rgba(217,179,128,.08)]" : "border-line text-[#8b8794] hover:text-white"}`}>
                <span className="w-2 h-2 rounded-full" style={{ background: m.color }} /> {m.label}
              </button>
            ))}
          </div>
          <div className="ml-auto glass rounded-lg p-0.5 flex gap-0.5">
            {(["daily", "weekly", "monthly"] as Gran[]).map((g) => (
              <button key={g} onClick={() => setGran(g)}
                className={`rounded-md px-3 py-1 text-[11px] capitalize transition ${gran === g ? "bg-[rgba(217,179,128,.18)] text-[#f0d9ae]" : "text-[#8b8794] hover:text-white"}`}>
                {g}
              </button>
            ))}
          </div>
        </div>
        <AreaChart data={chartData} color={metricMeta.color} format={metricMeta.fmt} label={`${gran} ${metricMeta.label.toLowerCase()}`} height={260} />
        <div className="flex gap-5 mt-2 text-[11px] text-[#8b8794] flex-wrap">
          {METRICS.map((m) => (
            <span key={m.id} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: m.color }} />
              {m.label}: <b className="text-[#c9c4b8]">{m.id === "revenue" ? fmtMoney(sum(cur, "revenue")) : fmtNum(sum(cur, m.id as "impressions"))}</b>
            </span>
          ))}
        </div>
      </Reveal>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* top performing pops (§5.1) */}
        <Reveal className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-xl">Top Performing Pops</h2>
            <Link href="/dashboard/pops" className="text-xs text-[#d9b380] hover:text-white transition flex items-center gap-1.5">View all <ArrowRight size={12} /></Link>
          </div>
          <div className="space-y-2.5">
            {topPops.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3 hover:border-[rgba(217,179,128,.3)] transition">
                <span className="font-display text-sm text-[#5d5867] w-4">{i + 1}</span>
                <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: p.accent }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] truncate">{p.name}</p>
                  <p className="text-[10.5px] text-[#8b8794] capitalize">{p.template} · {p.trigger.type}</p>
                </div>
                <span className="text-[11px] text-[#97919f] w-14 text-right tabular-nums">{fmtNum(p.stats.impressions)}</span>
                <span className="text-[11px] text-[#97919f] w-12 text-right tabular-nums">{fmtNum(p.stats.clicks)}</span>
                <span className="text-[13px] font-semibold text-[#f0d9ae] w-20 text-right">{fmtMoney(popRevenue(p))}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] tracking-[0.18em] uppercase text-[#5d5867] mt-3 px-1">
            <span className="ml-auto mr-[calc(5rem+3px)]">imps · clicks</span><span>revenue</span>
          </div>
        </Reveal>

        {/* live events + donut + quick actions */}
        <div className="space-y-5">
          <Reveal delay={1} className="glass rounded-2xl p-6">
            <div className="grid grid-cols-[auto_1fr] gap-6 items-center">
              <div>
                <h2 className="font-display text-xl mb-4">Pops by status</h2>
                <Donut size={160} slices={donut.length ? donut : [{ label: "None", value: 1, color: "#3a3244" }]} />
              </div>
              <div className="space-y-2.5">
                <p className="text-[10px] tracking-[0.25em] uppercase text-[#5d5867] mb-1">Quick actions</p>
                {[
                  { icon: Plus, label: "Create New Pop", act: "link:/dashboard/pops" },
                  { icon: SquarePlay, label: "New Campaign", act: "link:/dashboard/campaigns" },
                  { icon: UserPlus, label: "Add Publisher", act: "publisher" },
                  { icon: BarChart3, label: "View Reports", act: "link:/dashboard/analytics" },
                ].map((q) => (
                  <button key={q.label} onClick={() => {
                    if (q.act.startsWith("link:")) location.href = q.act.slice(5);
                    else if (isAdmin) location.href = "/dashboard/admin";
                    else store.toast("Adding publishers is an admin capability (§4) — ask RevBounce to invite a network account", "info");
                  }}
                    className="w-full flex items-center gap-3 rounded-xl border border-line px-3.5 py-2.5 text-[13px] text-[#c9c4b8] hover:text-white hover:border-[rgba(217,179,128,.4)] transition group">
                    <q.icon size={15} className="text-[#d9b380]" /> {q.label}
                    <ArrowRight size={12} className="ml-auto opacity-0 group-hover:opacity-100 transition" />
                  </button>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={2} className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-2 h-2 rounded-full bg-[#8fe3b0] pulse-dot" />
              <h2 className="font-display text-lg">Live events</h2>
            </div>
            <div className="space-y-2">
              {events.map((e, i) => (
                <div key={e.id} className={`flex items-center gap-2.5 text-[11px] rounded-lg px-2 py-1.5 ${i === 0 ? "ticker-row bg-white/[0.03] border border-line" : ""}`}>
                  <span className={`w-1.5 h-1.5 rounded-full flex-none ${EV_STYLE[e.type].dot}`} />
                  <span className="text-[#c9c4b8] w-[70px] flex-none">{EV_STYLE[e.type].label}</span>
                  <span className="truncate text-[#97919f] flex-1">{e.campaign}</span>
                  {e.revenue > 0 && <span className="text-[#8fe3b0] font-semibold flex-none">+{fmtMoney(e.revenue, 2)}</span>}
                  <span className="text-[#5d5867] flex-none w-12 text-right">{now ? timeAgo(e.ts) : ""}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>

      {/* performance by pop type (§5.1) */}
      <Reveal className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl">Performance by Pop Type</h2>
          <p className="text-[11px] text-[#8b8794]">CTR = clicks ÷ impressions</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="text-left text-[10px] tracking-[0.2em] uppercase text-[#5d5867] border-b border-line">
                <th className="pb-3 font-medium">Type</th><th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium text-right">Impressions</th><th className="pb-3 font-medium text-right">Clicks</th>
                <th className="pb-3 font-medium text-right">CTR</th><th className="pb-3 font-medium text-right">Revenue</th>
                <th className="pb-3 font-medium w-10" />
              </tr>
            </thead>
            <tbody>
              {typeRows.map((r) => (
                <tr key={r.id} className="border-b border-line/50 last:border-0 hover:bg-white/[0.02] transition">
                  <td className="py-3.5 pr-4 text-[13px] font-medium">{r.t}</td>
                  <td className="py-3.5 pr-4"><Badge tone={r.status === "active" ? "mint" : r.status === "paused" ? "rose" : "mute"}>{r.status.toUpperCase()}</Badge></td>
                  <td className="py-3.5 pr-4 text-right tabular-nums text-[#c9c4b8]">{r.imps.toLocaleString()}</td>
                  <td className="py-3.5 pr-4 text-right tabular-nums text-[#c9c4b8]">{r.clk.toLocaleString()}</td>
                  <td className="py-3.5 pr-4 text-right tabular-nums text-[#b3a6f5]">{ctr(r.clk, r.imps).toFixed(1)}%</td>
                  <td className="py-3.5 pr-4 text-right tabular-nums font-semibold text-[#f0d9ae]">{fmtMoney(r.rev)}</td>
                  <td className="py-3.5 text-right relative">
                    <button onClick={() => setOpenMenu(openMenu === r.id ? null : r.id)} className="p-1.5 rounded-lg hover:bg-white/5 text-[#8b8794] hover:text-white transition" aria-label="Row actions">
                      <EllipsisVertical size={15} />
                    </button>
                    {openMenu === r.id && (
                      <div className="absolute right-0 top-9 z-20 glass rounded-xl py-1.5 w-44 shadow-pop text-left fade-in">
                        {([
                          ["Edit in Studio", Pencil, () => { location.href = "/dashboard/pops"; }],
                          ["Pause type", r.status === "paused" ? TrendingUp : TrendingDown, () => store.toast(`"${r.t}" ${r.status === "paused" ? "resumed" : "paused"} across all sites`, "info")],
                          ["View report", BarChart3, () => { location.href = "/dashboard/analytics"; }],
                        ] as [string, React.ElementType, () => void][]).map(([l, Icon, fn]) => (
                          <button key={l} onClick={() => { setOpenMenu(null); fn(); }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-[#c9c4b8] hover:text-white hover:bg-white/[0.04] transition">
                            <Icon size={13} className="text-[#d9b380]" /> {l}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>

      {/* need help (§5.1) */}
      <Reveal className="glass rounded-2xl px-6 py-5 flex flex-wrap items-center gap-4">
        <span className="w-10 h-10 rounded-xl bg-[rgba(139,124,240,.12)] border border-[rgba(139,124,240,.3)] flex items-center justify-center text-[#b3a6f5]"><HelpCircle size={18} /></span>
        <div className="flex-1 min-w-[220px]">
          <p className="text-sm font-semibold">Need help?</p>
          <p className="text-xs text-[#8b8794]">Snippet wiring, frequency capping, host &amp; post success rules — the Help Center covers every module with short videos.</p>
        </div>
        <button onClick={() => store.toast("Help Center ships with your plan — meanwhile, the Publisher sandbox doubles as a live walkthrough", "info")}
          className="btn-ghost rounded-xl px-4 py-2.5 text-sm flex items-center gap-2">
          <LifeBuoy size={14} className="text-[#d9b380]" /> Visit Help Center
        </button>
      </Reveal>
    </div>
  );
}
