"use client";
import React, { useMemo, useState } from "react";
import { Download, Mail, RefreshCw, Search, Send } from "lucide-react";
import { useStore } from "@/lib/store";
import { downloadCsv, timeAgo } from "@/lib/data";
import { Badge, Reveal } from "@/components/ui";
import type { EmailRecord } from "@/lib/types";

const TONE: Record<EmailRecord["status"], "mint" | "rose" | "gold" | "violet" | "mute"> = {
  delivered: "mint", failed: "rose", pending: "gold", duplicate: "violet", invalid: "mute",
};
const PAGE = 12;

export default function EmailRecordsPage() {
  const store = useStore();
  const [query, setQuery] = useState("");
  const [statusF, setStatusF] = useState<"all" | EmailRecord["status"]>("all");
  const [channelF, setChannelF] = useState<"all" | "api" | "ftp">("all");
  const [deviceF, setDeviceF] = useState("all");
  const [page, setPage] = useState(0);
  const [resending, setResending] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return store.emailRecords.filter((r) =>
      (statusF === "all" || r.status === statusF) &&
      (channelF === "all" || r.channel === channelF) &&
      (deviceF === "all" || r.device === deviceF) &&
      (!q || r.email.toLowerCase().includes(q) || r.site.toLowerCase().includes(q)));
  }, [store.emailRecords, query, statusF, channelF, deviceF]);

  const pageRows = rows.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.ceil(rows.length / PAGE);
  const failed = rows.filter((r) => r.status === "failed").length;

  const resend = (r: EmailRecord) => {
    setResending(r.id);
    setTimeout(() => {
      store.resendEmail(r.id);
      setResending(null);
      store.toast(`Re-delivered ${r.email} via ${r.provider}`);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      <Reveal className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="font-display text-3xl">Email Records</h1>
          <p className="text-sm text-[#8b8794] mt-1">Every captured address, its delivery status, and one-click resend for failures.</p>
        </div>
        <div className="ml-auto flex gap-2">
          {failed > 0 && (
            <button onClick={() => { rows.filter((r) => r.status === "failed").forEach((r) => store.resendEmail(r.id)); store.toast(`Re-queued ${failed} failed deliveries`); }}
              className="btn-ghost rounded-xl px-3.5 py-2.5 text-xs flex items-center gap-1.5"><Send size={13} /> Resend {failed} failed</button>
          )}
          <button onClick={() => {
            downloadCsv("revbounce-email-records.csv", rows.map((r) => ({
              email: r.email, captured_at: new Date(r.ts).toISOString(), site: r.site, pop: r.pop,
              device: r.device, trigger: r.trigger, status: r.status, channel: r.channel, provider: r.provider,
            })));
            store.toast(`Exported ${rows.length} records`);
          }} className="btn-gold rounded-xl px-4 py-2.5 text-sm flex items-center gap-2"><Download size={14} /> Export CSV</button>
        </div>
      </Reveal>

      <Reveal className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {([
          ["Total captured", store.emailRecords.length, "gold"],
          ["Delivered", store.emailRecords.filter((r) => r.status === "delivered").length, "mint"],
          ["Failed", store.emailRecords.filter((r) => r.status === "failed").length, "rose"],
          ["Duplicates", store.emailRecords.filter((r) => r.status === "duplicate").length, "violet"],
          ["Invalid", store.emailRecords.filter((r) => r.status === "invalid").length, "mute"],
        ] as const).map(([l, v, tone]) => (
          <div key={l} className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1.5"><span className="text-[11px] text-[#8b8794]">{l}</span><Badge tone={tone}>●</Badge></div>
            <p className="font-display text-2xl">{v}</p>
          </div>
        ))}
      </Reveal>

      <Reveal className="glass rounded-2xl p-4 flex flex-wrap gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5d5867]" />
          <input className="input-lux !pl-9" placeholder="Search email or site…" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} />
        </div>
        <select className="input-lux !w-auto" value={statusF} onChange={(e) => { setStatusF(e.target.value as typeof statusF); setPage(0); }}>
          <option value="all">All statuses</option><option value="delivered">Delivered</option><option value="failed">Failed</option><option value="pending">Pending</option><option value="duplicate">Duplicate</option><option value="invalid">Invalid</option>
        </select>
        <select className="input-lux !w-auto" value={channelF} onChange={(e) => { setChannelF(e.target.value as typeof channelF); setPage(0); }}>
          <option value="all">All channels</option><option value="api">API</option><option value="ftp">FTP / SFTP</option>
        </select>
        <select className="input-lux !w-auto" value={deviceF} onChange={(e) => { setDeviceF(e.target.value); setPage(0); }}>
          <option value="all">All devices</option><option value="desktop">Desktop</option><option value="mobile">Mobile</option><option value="tablet">Tablet</option>
        </select>
      </Reveal>

      <Reveal className="glass rounded-2xl p-2 sm:p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="text-left text-[10px] tracking-[0.2em] uppercase text-[#5d5867] border-b border-line">
                <th className="pb-3 pl-2 font-medium">Email</th><th className="pb-3 font-medium">Captured</th>
                <th className="pb-3 font-medium">Site</th><th className="pb-3 font-medium">Pop</th>
                <th className="pb-3 font-medium">Device</th><th className="pb-3 font-medium">Trigger</th>
                <th className="pb-3 font-medium">Delivery</th><th className="pb-3 font-medium text-right pr-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.id} className="border-b border-line/50 last:border-0 hover:bg-white/[0.02] transition">
                  <td className="py-3 pl-2 pr-3">
                    <span className="flex items-center gap-2"><Mail size={12} className="text-[#5d5867] flex-none" /><span className="text-[12.5px] text-[#e8e2d6]">{r.email}</span></span>
                  </td>
                  <td className="py-3 pr-3 text-[11.5px] text-[#97919f]">{timeAgo(r.ts)}</td>
                  <td className="py-3 pr-3 text-[11.5px] text-[#c9c4b8]">{r.site}</td>
                  <td className="py-3 pr-3 text-[11.5px] text-[#97919f] max-w-[180px] truncate">{r.pop}</td>
                  <td className="py-3 pr-3 text-[11.5px] text-[#97919f] capitalize">{r.device}</td>
                  <td className="py-3 pr-3 text-[11.5px] text-[#97919f]">{r.trigger}</td>
                  <td className="py-3 pr-3">
                    <span className="flex items-center gap-2">
                      <Badge tone={TONE[r.status]}>{r.status.toUpperCase()}</Badge>
                      <span className="text-[10.5px] text-[#5d5867]">{r.provider}</span>
                    </span>
                  </td>
                  <td className="py-3 pr-2 text-right">
                    {r.status === "failed" ? (
                      <button onClick={() => resend(r)} disabled={resending === r.id}
                        className="btn-ghost rounded-lg px-2.5 py-1.5 text-[11px] inline-flex items-center gap-1.5 disabled:opacity-60">
                        <RefreshCw size={11} className={resending === r.id ? "animate-spin" : ""} /> {resending === r.id ? "Sending" : "Resend"}
                      </button>
                    ) : <span className="text-[11px] text-[#5d5867]">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p className="text-center text-sm text-[#8b8794] py-10">No records match these filters.</p>}
        {pages > 1 && (
          <div className="flex items-center justify-between mt-4 px-2">
            <p className="text-[11px] text-[#8b8794]">{rows.length} records · page {page + 1} of {pages}</p>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => setPage(page - 1)} className="btn-ghost rounded-lg px-3 py-1.5 text-xs disabled:opacity-40">Prev</button>
              <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="btn-ghost rounded-lg px-3 py-1.5 text-xs disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </Reveal>
    </div>
  );
}
