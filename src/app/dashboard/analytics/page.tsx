"use client";
import React, { useMemo, useState } from "react";
import { ArrowDownWideNarrow, MonitorSmartphone } from "lucide-react";
import { COUNTRY_SPLIT, SERIES_30D, fmtMoney, fmtNum } from "@/lib/data";
import { AreaChart, BarChart, Donut } from "@/components/charts";
import { Badge, Reveal } from "@/components/ui";

const RANGES = [{ id: 7, label: "7D" }, { id: 14, label: "14D" }, { id: 30, label: "30D" }] as const;

export default function AnalyticsPage() {
  const [range, setRange] = useState<7 | 14 | 30>(30);
  const [metric, setMetric] = useState<"revenue" | "clicks" | "conversions">("revenue");

  const data = useMemo(() => SERIES_30D.slice(-range), [range]);
  const fmtFor = (m: typeof metric) => (v: number) => m === "revenue" ? fmtMoney(v) : fmtNum(v);

  const funnel = useMemo(() => {
    const impressions = data.reduce((a, d) => a + d.impressions, 0);
    const clicks = data.reduce((a, d) => a + d.clicks, 0);
    const conversions = data.reduce((a, d) => a + d.conversions, 0);
    return { impressions, clicks, conversions };
  }, [data]);

  const pages = [
    { page: "/journal/alpine-retreats", pops: "Exit — Travel Voucher", imps: 41_204, ctr: 10.4 },
    { page: "/reviews/nova-vpn", pops: "Idle — VPN Trial", imps: 33_881, ctr: 9.2 },
    { page: "/deals/weekly-edit", pops: "Scroll — Sponsored Picks", imps: 29_550, ctr: 16.3 },
    { page: "/journal/city-guides", pops: "Exit — Travel Voucher", imps: 18_992, ctr: 8.1 },
    { page: "/tech/battery-lab", pops: "Idle — VPN Trial", imps: 12_401, ctr: 7.4 },
  ];

  return (
    <div className="space-y-7">
      <Reveal className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="font-display text-3xl">Analytics</h1>
          <p className="text-sm text-[#8b8794] mt-1">Every impression, click, close and dollar — attributed.</p>
        </div>
        <div className="ml-auto glass rounded-xl p-1 flex gap-1">
          {RANGES.map((r) => (
            <button key={r.id} onClick={() => setRange(r.id)}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${range === r.id ? "bg-[rgba(217,179,128,.18)] text-[#f0d9ae]" : "text-[#8b8794] hover:text-white"}`}>
              {r.label}
            </button>
          ))}
        </div>
      </Reveal>

      <Reveal className="glass rounded-2xl p-6">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <h2 className="font-display text-xl mr-2">Performance</h2>
          {(["revenue", "clicks", "conversions"] as const).map((m) => (
            <button key={m} onClick={() => setMetric(m)}
              className={`rounded-lg px-3.5 py-1.5 text-xs capitalize transition border ${metric === m ? "border-[rgba(217,179,128,.45)] text-[#f0d9ae] bg-[rgba(217,179,128,.08)]" : "border-line text-[#8b8794] hover:text-white"}`}>
              {m}
            </button>
          ))}
          <Badge tone="mint" >{range}D total: {metric === "revenue" ? fmtMoney(data.reduce((a, d) => a + d.revenue, 0)) : fmtNum(data.reduce((a, d) => a + d[metric], 0))}</Badge>
        </div>
        <AreaChart data={data.map((d) => ({ day: d.day, value: d[metric] }))} format={fmtFor(metric)} label={metric} height={280} />
      </Reveal>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* funnel */}
        <Reveal className="glass rounded-2xl p-6">
          <h2 className="font-display text-xl mb-1 flex items-center gap-2"><ArrowDownWideNarrow size={17} className="text-[#d9b380]" /> Funnel</h2>
          <p className="text-xs text-[#8b8794] mb-6">Impression → click → conversion</p>
          <div className="space-y-3">
            {[
              { l: "Impressions", v: funnel.impressions, pct: 100, c: "#8b7cf0" },
              { l: "Clicks", v: funnel.clicks, pct: (funnel.clicks / funnel.impressions) * 100, c: "#d9b380" },
              { l: "Conversions", v: funnel.conversions, pct: (funnel.conversions / funnel.impressions) * 100, c: "#8fe3b0" },
            ].map((s) => (
              <div key={s.l}>
                <div className="flex justify-between text-xs mb-1.5"><span className="text-[#c9c4b8]">{s.l}</span><span className="tabular-nums text-[#97919f]">{fmtNum(s.v)} · {s.pct < 10 ? s.pct.toFixed(1) : Math.round(s.pct)}%</span></div>
                <div className="h-8 rounded-lg bg-[#121019] border border-line overflow-hidden relative">
                  <div className="h-full rounded-lg transition-all duration-700" style={{ width: `${Math.max(s.pct, 2)}%`, background: `linear-gradient(90deg, ${s.c}44, ${s.c})` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[#8b8794] mt-5 leading-relaxed">Dismissed (closed) pops are tracked separately so CTR stays honest — see the live event stream for closes.</p>
        </Reveal>

        {/* geo + device */}
        <Reveal delay={1} className="glass rounded-2xl p-6">
          <h2 className="font-display text-xl mb-5">Geography</h2>
          <div className="space-y-2.5">
            {COUNTRY_SPLIT.slice(0, 6).map((c) => (
              <div key={c.code} className="flex items-center gap-3 text-xs">
                <span className="w-8 font-semibold">{c.code}</span>
                <div className="flex-1 h-1.5 rounded-full bg-[#1c1827] overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#f0d9ae] to-[#b0824f]" style={{ width: `${(c.share / COUNTRY_SPLIT[0].share) * 100}%` }} />
                </div>
                <span className="w-8 text-right text-[#97919f]">{c.share}%</span>
              </div>
            ))}
          </div>
          <div className="hairline my-6" />
          <h2 className="font-display text-xl mb-4 flex items-center gap-2"><MonitorSmartphone size={17} className="text-[#8b7cf0]" /> Devices</h2>
          <Donut size={150} slices={[{ label: "Desktop", value: 58, color: "#d9b380" }, { label: "Mobile", value: 36, color: "#8b7cf0" }, { label: "Tablet", value: 6, color: "#3a3244" }]} />
        </Reveal>

        {/* impressions bars + top pages */}
        <Reveal delay={2} className="glass rounded-2xl p-6">
          <h2 className="font-display text-xl mb-1">Impressions / day</h2>
          <p className="text-xs text-[#8b8794] mb-4">Capped politely: never more than your frequency limit.</p>
          <BarChart height={150} data={data.map((d) => ({ day: d.day, value: d.impressions }))} color="#8b7cf0" format={(v) => fmtNum(v)} />
          <div className="hairline my-6" />
          <h2 className="font-display text-xl mb-4">Top pages</h2>
          <div className="space-y-2.5">
            {pages.map((p) => (
              <div key={p.page} className="flex items-center gap-3 text-xs rounded-lg border border-line px-3 py-2.5 hover:border-[rgba(217,179,128,.3)] transition">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[#c9c4b8]">{p.page}</p>
                  <p className="text-[10px] text-[#5d5867] truncate">{p.pops}</p>
                </div>
                <span className="text-[#97919f] flex-none">{fmtNum(p.imps)}</span>
                <span className="text-[#8fe3b0] font-semibold flex-none w-12 text-right">{p.ctr}%</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </div>
  );
}
