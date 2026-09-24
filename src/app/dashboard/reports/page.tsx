"use client";
import React, { useMemo, useState } from "react";
import {
  ArrowDownWideNarrow, ArrowUpDown, BookmarkPlus, CalendarClock, Download, Filter, Mail, Star, Trash2,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { SERIES_60D, COUNTRY_SPLIT, downloadCsv, ctr, ecpm, fmtMoney, fmtNum, uid } from "@/lib/data";
import { AreaChart } from "@/components/charts";
import { Badge, Modal, Reveal } from "@/components/ui";
import type { SavedReport } from "@/lib/types";

type ViewId = "overall" | "publisher" | "website" | "campaign" | "pop" | "source" | "device" | "geo" | "date";
const VIEWS: { id: ViewId; label: string }[] = [
  { id: "overall", label: "Overall" }, { id: "publisher", label: "Publisher" }, { id: "website", label: "Website" },
  { id: "campaign", label: "Campaign" }, { id: "pop", label: "Placement / Pop" }, { id: "source", label: "Traffic source" },
  { id: "device", label: "Device" }, { id: "geo", label: "Geo" }, { id: "date", label: "Date" },
];

interface Row {
  key: string; impressions: number; unique: number; yes: number; no: number; closes: number;
  conversions: number; attempted: number; successful: number; linkouts: number; revenue: number;
}

const COLS: { id: keyof Row | "ctr" | "epc" | "rpv" | "ecpm" | "fill"; label: string; num: boolean }[] = [
  { id: "key", label: "Dimension", num: false },
  { id: "impressions", label: "Impr.", num: true },
  { id: "unique", label: "Uniq.", num: true },
  { id: "yes", label: "YES", num: true },
  { id: "no", label: "NO", num: true },
  { id: "closes", label: "Closes", num: true },
  { id: "ctr", label: "CTR", num: true },
  { id: "conversions", label: "Conv.", num: true },
  { id: "successful", label: "Subs ok", num: true },
  { id: "linkouts", label: "Link-outs", num: true },
  { id: "revenue", label: "Revenue", num: true },
  { id: "epc", label: "EPC", num: true },
  { id: "rpv", label: "RPV", num: true },
  { id: "ecpm", label: "eCPM", num: true },
  { id: "fill", label: "Fill", num: true },
];

const PAGE = 8;

export default function ReportsPage() {
  const store = useStore();
  const [tab, setTab] = useState<"perf" | "funnel" | "email">("perf");
  const [view, setView] = useState<ViewId>("campaign");
  const [range, setRange] = useState<7 | 14 | 30>(30);
  const [deviceF, setDeviceF] = useState("all");
  const [countryF, setCountryF] = useState("all");
  const [sourceF, setSourceF] = useState("all");
  const [siteF, setSiteF] = useState("all");
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 }>({ col: "revenue", dir: -1 });
  const [page, setPage] = useState(0);
  const [saveOpen, setSaveOpen] = useState(false);
  const [reportName, setReportName] = useState("");
  const [schedule, setSchedule] = useState<SavedReport["scheduled"]>("none");

  const series = useMemo(() => SERIES_60D.slice(-range), [range]);
  const totals = useMemo(() => ({
    impressions: series.reduce((a, d) => a + d.impressions, 0),
    clicks: series.reduce((a, d) => a + d.clicks, 0),
    conversions: series.reduce((a, d) => a + d.conversions, 0),
    revenue: series.reduce((a, d) => a + d.revenue, 0),
  }), [series]);

  // deterministic dimension split of the period totals
  const rows: Row[] = useMemo(() => {
    const mk = (key: string, share: number, quality = 1): Row => {
      const impressions = Math.round(totals.impressions * share);
      const yes = Math.round(totals.clicks * share * quality);
      const closes = Math.round(impressions * 0.82);
      const conversions = Math.round(totals.conversions * share * quality);
      return {
        key, impressions, unique: Math.round(impressions * 0.87), yes,
        no: Math.max(0, impressions - yes - closes), closes, conversions,
        attempted: Math.round(conversions * 1.14), successful: conversions,
        linkouts: Math.round(yes * 0.63), revenue: +(totals.revenue * share * quality).toFixed(2),
      };
    };
    switch (view) {
      case "overall": return [mk("All traffic", 1)];
      case "publisher": return store.publishers.map((p, i) => mk(p.name, [0.34, 0.22, 0.24, 0.07, 0.13][i] ?? 0.1, 1 + i * 0.02));
      case "website": return store.sites.map((s, i) => mk(s.name, [0.58, 0.31, 0.11][i] ?? 0.1));
      case "campaign": return store.campaigns.filter((c) => c.status !== "library").map((c, i) => mk(c.name, [0.28, 0.21, 0.17, 0.24, 0.1][i] ?? 0.08, 1 + i * 0.03));
      case "pop": return store.pops.map((p, i) => mk(p.name, [0.33, 0.19, 0.36, 0.08, 0.04][i] ?? 0.05));
      case "source": return [["Direct", 0.34], ["Organic search", 0.31], ["Social", 0.19], ["Email", 0.09], ["Paid", 0.07]].map(([k, s]) => mk(k as string, s as number));
      case "device": return [["Desktop", 0.58], ["Mobile", 0.36], ["Tablet", 0.06]].map(([k, s]) => mk(k as string, s as number));
      case "geo": return COUNTRY_SPLIT.map((c) => mk(c.code, c.share / 100));
      case "date": return series.slice(-12).map((d) => ({
        key: d.day, impressions: d.impressions, unique: Math.round(d.impressions * 0.87), yes: d.clicks,
        no: Math.max(0, d.impressions - d.clicks - Math.round(d.impressions * 0.82)), closes: Math.round(d.impressions * 0.82),
        conversions: d.conversions, attempted: Math.round(d.conversions * 1.14), successful: d.conversions,
        linkouts: Math.round(d.clicks * 0.63), revenue: d.revenue,
      }));
      default: return [];
    }
  }, [view, totals, store.publishers, store.sites, store.campaigns, store.pops, series]);

  const derived = (r: Row) => ({
    ctr: ctr(r.yes, r.impressions), epc: r.yes ? r.revenue / r.yes : 0,
    rpv: r.unique ? r.revenue / r.unique : 0, ecpm: ecpm(r.revenue, r.impressions),
    fill: r.impressions ? Math.min(100, (r.impressions / (r.impressions * 1.06)) * 100) : 0,
  });

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const da = derived(a), db = derived(b);
      const get = (r: Row, d: ReturnType<typeof derived>) =>
        sort.col === "key" ? r.key : sort.col in d ? (d as Record<string, number>)[sort.col] : (r as unknown as Record<string, number>)[sort.col];
      const va = get(a, da), vb = get(b, db);
      if (typeof va === "string" || typeof vb === "string") return String(va).localeCompare(String(vb)) * sort.dir;
      return ((va as number) - (vb as number)) * sort.dir;
    });
    return arr;
  }, [rows, sort]);

  const pageRows = sorted.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.ceil(sorted.length / PAGE);

  const exportCsv = () => {
    downloadCsv(`revbounce-${view}-${range}d.csv`, sorted.map((r) => {
      const d = derived(r);
      return {
        dimension: r.key, impressions: r.impressions, unique_impressions: r.unique, yes_clicks: r.yes,
        no_clicks: r.no, closes: r.closes, ctr_pct: d.ctr.toFixed(2), conversions: r.conversions,
        submissions_attempted: r.attempted, submissions_successful: r.successful, linkout_clicks: r.linkouts,
        revenue: r.revenue.toFixed(2), epc: d.epc.toFixed(3), revenue_per_visitor: d.rpv.toFixed(3),
        ecpm: d.ecpm.toFixed(2), fill_rate_pct: d.fill.toFixed(1),
      };
    }));
    store.toast(`Exported ${sorted.length} rows to CSV`);
  };

  /* ── funnel (Offer Pop) ── */
  const funnelPop = store.pops.find((p) => p.kind === "offer" && p.campaignIds.length > 1) ?? store.pops[0];
  const funnel = useMemo(() => {
    const imps = funnelPop?.stats.impressions ?? 0;
    const steps: { label: string; value: number }[] = [{ label: "Impressions", value: imps }];
    let remaining = imps;
    (funnelPop?.campaignIds ?? []).forEach((id, i) => {
      const c = store.campaigns.find((x) => x.id === id);
      steps.push({ label: `Campaign ${i + 1} shown — ${c?.name.split("—")[0].trim() ?? id}`, value: Math.round(remaining) });
      const yes = Math.round(remaining * (0.1 - i * 0.015));
      steps.push({ label: `└ YES on campaign ${i + 1}`, value: yes });
      remaining = Math.round((remaining - yes) * 0.62);
    });
    steps.push({ label: "Sequence end / closed", value: Math.max(0, remaining) });
    return steps;
  }, [funnelPop, store.campaigns]);

  /* ── email capture report ── */
  const emailStats = useMemo(() => {
    const recs = store.emailRecords;
    const n = (s: string) => recs.filter((r) => r.status === s).length;
    return {
      impressions: 18_220, unique: 15_902, closes: 15_884, starts: 3_120,
      submissions: recs.length, valid: n("delivered") + n("pending"), invalid: n("invalid"), duplicates: n("duplicate"),
      apiAttempts: recs.filter((r) => r.channel === "api").length,
      apiSuccess: recs.filter((r) => r.channel === "api" && r.status === "delivered").length,
      apiFail: recs.filter((r) => r.channel === "api" && r.status === "failed").length,
      ftpAttempts: recs.filter((r) => r.channel === "ftp").length,
      ftpSuccess: recs.filter((r) => r.channel === "ftp" && r.status === "delivered").length,
      ftpFail: recs.filter((r) => r.channel === "ftp" && r.status === "failed").length,
    };
  }, [store.emailRecords]);

  return (
    <div className="space-y-6">
      <Reveal className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="font-display text-3xl">Reports</h1>
          <p className="text-sm text-[#8b8794] mt-1">Group by any dimension, sort, export, save and schedule.</p>
        </div>
        <div className="ml-auto flex gap-2 flex-wrap">
          <button onClick={() => setSaveOpen(true)} className="btn-ghost rounded-xl px-3.5 py-2.5 text-xs flex items-center gap-1.5"><BookmarkPlus size={13} /> Save report</button>
          <button onClick={exportCsv} className="btn-gold rounded-xl px-4 py-2.5 text-sm flex items-center gap-2"><Download size={14} /> Export CSV</button>
        </div>
      </Reveal>

      {/* tabs */}
      <div className="flex gap-2 flex-wrap">
        {([["perf", "Performance"], ["funnel", "Offer funnel"], ["email", "Email capture"]] as const).map(([id, l]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`rounded-xl px-4 py-2.5 text-sm transition border ${tab === id ? "bg-[rgba(217,179,128,.12)] text-[#f0d9ae] border-[rgba(217,179,128,.3)]" : "border-line text-[#97919f] hover:text-white"}`}>{l}</button>
        ))}
      </div>

      {tab === "perf" && (
        <>
          {/* filters */}
          <Reveal className="glass rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-[10px] tracking-[0.22em] uppercase text-[#5d5867]"><Filter size={12} /> Filters</div>
            <div className="flex flex-wrap gap-2.5">
              <select className="input-lux !w-auto" value={range} onChange={(e) => { setRange(+e.target.value as 7 | 14 | 30); setPage(0); }}>
                <option value={7}>Last 7 days</option><option value={14}>Last 14 days</option><option value={30}>Last 30 days</option>
              </select>
              <select className="input-lux !w-auto" value={siteF} onChange={(e) => setSiteF(e.target.value)}>
                <option value="all">All websites</option>{store.sites.map((s) => <option key={s.id}>{s.name}</option>)}
              </select>
              <select className="input-lux !w-auto" value={deviceF} onChange={(e) => setDeviceF(e.target.value)}>
                <option value="all">All devices</option><option>Desktop</option><option>Mobile</option><option>Tablet</option>
              </select>
              <select className="input-lux !w-auto" value={countryF} onChange={(e) => setCountryF(e.target.value)}>
                <option value="all">All countries</option>{COUNTRY_SPLIT.map((c) => <option key={c.code}>{c.code}</option>)}
              </select>
              <select className="input-lux !w-auto" value={sourceF} onChange={(e) => setSourceF(e.target.value)}>
                <option value="all">All sources</option><option>Direct</option><option>Organic search</option><option>Social</option><option>Email</option><option>Paid</option>
              </select>
              {(deviceF !== "all" || countryF !== "all" || sourceF !== "all" || siteF !== "all") && (
                <button onClick={() => { setDeviceF("all"); setCountryF("all"); setSourceF("all"); setSiteF("all"); }} className="btn-ghost rounded-xl px-3 py-2 text-xs">Clear</button>
              )}
            </div>
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <span className="text-[10px] tracking-[0.22em] uppercase text-[#5d5867] mr-1">Group by</span>
              {VIEWS.map((v) => (
                <button key={v.id} onClick={() => { setView(v.id); setPage(0); }}
                  className={`chip transition ${view === v.id ? "text-[#f0d9ae] border-[rgba(217,179,128,.5)] bg-[rgba(217,179,128,.09)]" : "text-[#8b8794] hover:text-white"}`}>{v.label}</button>
              ))}
            </div>
          </Reveal>

          {/* summary + chart */}
          <div className="grid lg:grid-cols-[1fr_320px] gap-5">
            <Reveal className="glass rounded-2xl p-6">
              <h2 className="font-display text-xl mb-4">Revenue · last {range} days</h2>
              <AreaChart data={series.map((d) => ({ day: d.day, value: d.revenue }))} format={(v) => fmtMoney(v)} height={220} />
            </Reveal>
            <Reveal delay={1} className="glass rounded-2xl p-6 space-y-3">
              <h2 className="font-display text-xl mb-1">Period totals</h2>
              {[
                ["Impressions", fmtNum(totals.impressions)], ["YES clicks", fmtNum(totals.clicks)],
                ["CTR", `${ctr(totals.clicks, totals.impressions).toFixed(2)}%`],
                ["Conversions", fmtNum(totals.conversions)], ["Revenue", fmtMoney(totals.revenue)],
                ["EPC", `$${(totals.revenue / totals.clicks).toFixed(3)}`],
                ["eCPM", `$${ecpm(totals.revenue, totals.impressions).toFixed(2)}`],
                ["Fill rate", "94.3%"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs border-b border-line/40 pb-2 last:border-0">
                  <span className="text-[#8b8794]">{k}</span><span className="text-[#c9c4b8] font-semibold">{v}</span>
                </div>
              ))}
            </Reveal>
          </div>

          {/* table */}
          <Reveal className="glass rounded-2xl p-2 sm:p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[1080px]">
                <thead>
                  <tr className="text-left text-[9.5px] tracking-[0.16em] uppercase text-[#5d5867] border-b border-line">
                    {COLS.map((c) => (
                      <th key={c.id} className={`pb-3 font-medium ${c.num ? "text-right" : "pl-2"}`}>
                        <button onClick={() => setSort({ col: c.id as string, dir: sort.col === c.id && sort.dir === -1 ? 1 : -1 })}
                          className={`inline-flex items-center gap-1 hover:text-[#d9b380] transition ${sort.col === c.id ? "text-[#d9b380]" : ""}`}>
                          {c.label}<ArrowUpDown size={9} />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => {
                    const d = derived(r);
                    return (
                      <tr key={r.key} className="border-b border-line/50 last:border-0 hover:bg-white/[0.02] transition">
                        <td className="py-3 pl-2 pr-3 text-[12px] text-[#e8e2d6] max-w-[200px] truncate">{r.key}</td>
                        <td className="py-3 pr-3 text-right tabular-nums text-[#c9c4b8]">{r.impressions.toLocaleString()}</td>
                        <td className="py-3 pr-3 text-right tabular-nums text-[#97919f]">{r.unique.toLocaleString()}</td>
                        <td className="py-3 pr-3 text-right tabular-nums text-[#8fe3b0]">{r.yes.toLocaleString()}</td>
                        <td className="py-3 pr-3 text-right tabular-nums text-[#f0a0a8]">{r.no.toLocaleString()}</td>
                        <td className="py-3 pr-3 text-right tabular-nums text-[#5d5867]">{r.closes.toLocaleString()}</td>
                        <td className="py-3 pr-3 text-right tabular-nums text-[#b3a6f5]">{d.ctr.toFixed(1)}%</td>
                        <td className="py-3 pr-3 text-right tabular-nums text-[#c9c4b8]">{r.conversions.toLocaleString()}</td>
                        <td className="py-3 pr-3 text-right tabular-nums text-[#97919f]">{r.successful.toLocaleString()}<span className="text-[#5d5867]">/{r.attempted.toLocaleString()}</span></td>
                        <td className="py-3 pr-3 text-right tabular-nums text-[#97919f]">{r.linkouts.toLocaleString()}</td>
                        <td className="py-3 pr-3 text-right tabular-nums font-semibold text-[#f0d9ae]">{fmtMoney(r.revenue)}</td>
                        <td className="py-3 pr-3 text-right tabular-nums text-[#c9c4b8]">${d.epc.toFixed(2)}</td>
                        <td className="py-3 pr-3 text-right tabular-nums text-[#c9c4b8]">${d.rpv.toFixed(2)}</td>
                        <td className="py-3 pr-3 text-right tabular-nums text-[#c9c4b8]">${d.ecpm.toFixed(2)}</td>
                        <td className="py-3 pr-2 text-right tabular-nums text-[#8fe3b0]">{d.fill.toFixed(0)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="flex items-center justify-between mt-4 px-2">
                <p className="text-[11px] text-[#8b8794]">{sorted.length} rows · page {page + 1} of {pages}</p>
                <div className="flex gap-2">
                  <button disabled={page === 0} onClick={() => setPage(page - 1)} className="btn-ghost rounded-lg px-3 py-1.5 text-xs disabled:opacity-40">Prev</button>
                  <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="btn-ghost rounded-lg px-3 py-1.5 text-xs disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </Reveal>

          {/* saved reports */}
          <Reveal className="glass rounded-2xl p-6">
            <h2 className="font-display text-xl mb-4 flex items-center gap-2"><Star size={16} className="text-[#d9b380]" /> Saved &amp; scheduled reports</h2>
            <div className="space-y-2.5">
              {store.savedReports.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] truncate">{r.name}</p>
                    <p className="text-[11px] text-[#8b8794]">{r.view} · last {r.range}d · saved {r.createdAt}</p>
                  </div>
                  <Badge tone={r.scheduled === "none" ? "mute" : "mint"}>
                    {r.scheduled === "none" ? "MANUAL" : <><CalendarClock size={10} /> {r.scheduled.toUpperCase()}</>}
                  </Badge>
                  <button onClick={() => { const v = VIEWS.find((x) => x.label === r.view); if (v) setView(v.id); setRange(r.range as 7 | 14 | 30); store.toast(`Loaded "${r.name}"`); }}
                    className="btn-ghost rounded-lg px-3 py-1.5 text-[11px]">Load</button>
                  <button onClick={() => { store.deleteReport(r.id); store.toast("Saved report removed", "info"); }}
                    className="p-1.5 text-[#5d5867] hover:text-[#f0a0a8] transition" aria-label="Delete report"><Trash2 size={14} /></button>
                </div>
              ))}
              {store.savedReports.length === 0 && <p className="text-sm text-[#8b8794]">No saved reports yet.</p>}
            </div>
          </Reveal>
        </>
      )}

      {tab === "funnel" && (
        <Reveal className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div>
              <h2 className="font-display text-xl flex items-center gap-2"><ArrowDownWideNarrow size={17} className="text-[#d9b380]" /> Offer Pop funnel</h2>
              <p className="text-xs text-[#8b8794] mt-0.5">{funnelPop?.name} · {funnelPop?.campaignIds.length} campaigns in sequence</p>
            </div>
            <button onClick={() => { downloadCsv("revbounce-funnel.csv", funnel.map((f) => ({ step: f.label, visitors: f.value }))); store.toast("Funnel exported"); }}
              className="btn-ghost rounded-xl px-3.5 py-2 text-xs flex items-center gap-1.5"><Download size={12} /> Export</button>
          </div>
          <div className="space-y-2">
            {funnel.map((f, i) => {
              const pct = funnel[0].value ? (f.value / funnel[0].value) * 100 : 0;
              const sub = f.label.startsWith("└");
              return (
                <div key={i} className={sub ? "pl-8" : ""}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={sub ? "text-[#8fe3b0]" : "text-[#c9c4b8]"}>{f.label}</span>
                    <span className="tabular-nums text-[#97919f]">{f.value.toLocaleString()} · {pct.toFixed(1)}%</span>
                  </div>
                  <div className={`rounded-lg bg-[#121019] border border-line overflow-hidden ${sub ? "h-5" : "h-8"}`}>
                    <div className="h-full rounded-lg transition-all duration-700"
                      style={{ width: `${Math.max(pct, 1.5)}%`, background: sub ? "linear-gradient(90deg,#8fe3b044,#8fe3b0)" : "linear-gradient(90deg,#d9b38044,#d9b380)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      )}

      {tab === "email" && (
        <>
          <Reveal className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ["Impressions", fmtNum(emailStats.impressions)], ["Unique impressions", fmtNum(emailStats.unique)],
              ["Closes", fmtNum(emailStats.closes)], ["Form starts", fmtNum(emailStats.starts)],
              ["Submissions", `${emailStats.submissions}`], ["Valid", `${emailStats.valid}`],
              ["Invalid", `${emailStats.invalid}`], ["Duplicates", `${emailStats.duplicates}`],
            ].map(([l, v]) => (
              <div key={l} className="glass rounded-2xl p-5">
                <p className="text-xs text-[#8b8794]">{l}</p>
                <p className="font-display text-[26px] mt-1.5">{v}</p>
              </div>
            ))}
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-5">
            {([
              ["API delivery", emailStats.apiAttempts, emailStats.apiSuccess, emailStats.apiFail, "mint"],
              ["FTP / SFTP delivery", emailStats.ftpAttempts, emailStats.ftpSuccess, emailStats.ftpFail, "violet"],
            ] as const).map(([label, att, ok, fail]) => (
              <Reveal key={label} className="glass rounded-2xl p-6">
                <h3 className="font-display text-lg mb-4 flex items-center gap-2"><Mail size={15} className="text-[#d9b380]" /> {label}</h3>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[["Attempts", att], ["Success", ok], ["Failures", fail]].map(([k, v]) => (
                    <div key={k as string} className="rounded-xl bg-black/25 border border-line py-3">
                      <p className="font-display text-xl">{v as number}</p>
                      <p className="text-[10px] text-[#8b8794] uppercase tracking-wider mt-1">{k}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 h-1.5 rounded-full bg-[#1c1827] overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#8fe3b0] to-[#3f9d6a]" style={{ width: `${att ? (ok / att) * 100 : 0}%` }} />
                </div>
                <p className="text-[11px] text-[#8b8794] mt-2">{att ? ((ok / att) * 100).toFixed(1) : "0"}% delivery success rate</p>
              </Reveal>
            ))}
          </div>
        </>
      )}

      {/* save report modal */}
      <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title="Save this report">
        <form onSubmit={(e) => {
          e.preventDefault();
          store.saveReport({
            id: uid(), name: reportName || `${VIEWS.find((v) => v.id === view)?.label} report`,
            view: VIEWS.find((v) => v.id === view)?.label ?? "Overall", groupBy: view, range,
            createdAt: new Date().toISOString().slice(0, 10), scheduled: schedule,
          });
          setSaveOpen(false); setReportName(""); setSchedule("none");
          store.toast(schedule === "none" ? "Report saved" : `Report saved — emailed ${schedule}`);
        }} className="space-y-4">
          <div><label className="text-xs text-[#97919f] mb-1.5 block">Report name</label>
            <input className="input-lux" value={reportName} onChange={(e) => setReportName(e.target.value)} placeholder={`${VIEWS.find((v) => v.id === view)?.label} · last ${range}d`} /></div>
          <div><label className="text-xs text-[#97919f] mb-1.5 block">Email schedule</label>
            <select className="input-lux" value={schedule} onChange={(e) => setSchedule(e.target.value as SavedReport["scheduled"])}>
              <option value="none">Don&rsquo;t email — manual only</option><option value="daily">Daily</option><option value="weekly">Weekly (Mondays)</option><option value="monthly">Monthly (1st)</option>
            </select></div>
          <p className="text-[11px] text-[#8b8794]">Current filters, group-by ({VIEWS.find((v) => v.id === view)?.label}) and the {range}-day window are captured.</p>
          <button type="submit" className="btn-gold rounded-xl w-full py-3 text-sm">Save report</button>
        </form>
      </Modal>
    </div>
  );
}
