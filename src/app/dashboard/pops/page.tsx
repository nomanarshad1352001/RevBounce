"use client";
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive, Check, Code2, Copy, EllipsisVertical, Files, Monitor, Pause, Pencil, Play,
  Plus, Search, Smartphone, Tablet, Trash2,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { POP_KINDS, SNIPPET_CODE, ctr, fmtMoney, fmtNum } from "@/lib/data";
import { Badge, Modal, Reveal } from "@/components/ui";
import type { Pop, PopKind } from "@/lib/types";

const STATUS_TONE: Record<Pop["status"], "mint" | "rose" | "violet" | "mute"> = {
  active: "mint", paused: "rose", draft: "violet", archived: "mute",
};

export default function PopsListPage() {
  const store = useStore();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [kindF, setKindF] = useState<"all" | PopKind>("all");
  const [statusF, setStatusF] = useState<"all" | Pop["status"]>("all");
  const [siteF, setSiteF] = useState("all");
  const [menu, setMenu] = useState<string | null>(null);
  const [installFor, setInstallFor] = useState<Pop | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Pop | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return store.pops.filter((p) =>
      (kindF === "all" || p.kind === kindF) &&
      (statusF === "all" || p.status === statusF) &&
      (siteF === "all" || p.siteId === siteF) &&
      (!q || p.name.toLowerCase().includes(q)),
    );
  }, [store.pops, query, kindF, statusF, siteF]);

  const popRevenue = (p: Pop) =>
    p.stats.conversions * (store.campaigns.find((c) => c.id === p.campaignIds[0])?.payout ?? 2.4);

  const kindName = (k: PopKind) => POP_KINDS.find((x) => x.id === k)?.name ?? k;

  const copySnippet = (p: Pop) => {
    const site = store.sites.find((s) => s.id === p.siteId);
    try { navigator.clipboard.writeText(SNIPPET_CODE(site?.siteKey ?? "rb_demo")); } catch { /* blocked */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-6">
      <Reveal className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="font-display text-3xl">Pops</h1>
          <p className="text-sm text-[#8b8794] mt-1">Every placement across your properties — {store.pops.filter((p) => p.status === "active").length} serving right now.</p>
        </div>
        <Link href="/dashboard/pops/new" className="ml-auto btn-gold rounded-xl px-4 py-2.5 text-sm flex items-center gap-2"><Plus size={15} /> Create New Pop</Link>
      </Reveal>

      {/* pop-type rail (§5.3 — V1 vs Phase-8 architecture) */}
      <Reveal className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {POP_KINDS.slice(0, 4).map((k) => (
          <button key={k.id}
            onClick={() => k.v1 ? router.push(`/dashboard/pops/new?kind=${k.id}`) : store.toast(`${k.name} arrives in Phase 8 — the builder architecture already supports it`, "info")}
            className={`glass rounded-2xl p-4 text-left card-hover ${k.v1 ? "" : "opacity-70"}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">{k.name}</p>
              <Badge tone={k.v1 ? "mint" : "mute"}>{k.v1 ? "V1" : "PHASE 8"}</Badge>
            </div>
            <p className="text-[11px] text-[#8b8794] leading-relaxed">{k.blurb}</p>
          </button>
        ))}
      </Reveal>

      {/* filters */}
      <Reveal className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[190px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5d5867]" />
          <input className="input-lux !pl-9" placeholder="Search pops…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="input-lux !w-auto" value={kindF} onChange={(e) => setKindF(e.target.value as typeof kindF)}>
          <option value="all">All types</option>
          {POP_KINDS.filter((k) => k.v1).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
        <select className="input-lux !w-auto" value={statusF} onChange={(e) => setStatusF(e.target.value as typeof statusF)}>
          <option value="all">All statuses</option><option value="active">Active</option><option value="paused">Paused</option><option value="draft">Draft</option><option value="archived">Archived</option>
        </select>
        <select className="input-lux !w-auto" value={siteF} onChange={(e) => setSiteF(e.target.value)}>
          <option value="all">All sites</option>
          {store.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Reveal>

      {/* table */}
      <Reveal className="glass rounded-2xl p-2 sm:p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[940px]">
            <thead>
              <tr className="text-left text-[10px] tracking-[0.2em] uppercase text-[#5d5867] border-b border-line">
                <th className="pb-3 pl-2 font-medium">Name</th><th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Status</th><th className="pb-3 font-medium">Site</th>
                <th className="pb-3 font-medium">Devices</th>
                <th className="pb-3 font-medium text-right">Impressions</th><th className="pb-3 font-medium text-right">Clicks</th>
                <th className="pb-3 font-medium text-right">CTR</th><th className="pb-3 font-medium text-right">Revenue</th>
                <th className="pb-3 font-medium w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const site = store.sites.find((s) => s.id === p.siteId);
                const devs = p.rules?.devices ?? p.devices;
                return (
                  <tr key={p.id} className="border-b border-line/50 last:border-0 hover:bg-white/[0.02] transition">
                    <td className="py-3.5 pl-2 pr-4">
                      <button onClick={() => router.push(`/dashboard/pops/${p.id}`)} className="text-left group">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-none" style={{ background: p.accent }} />
                          <span className="text-[13px] font-medium group-hover:text-[#f0d9ae] transition">{p.name}</span>
                        </span>
                        <span className="text-[10.5px] text-[#8b8794] block mt-0.5 ml-4">
                          v{p.version ?? 0} · {p.campaignIds.length ? `${p.campaignIds.length} campaign${p.campaignIds.length > 1 ? "s" : ""}` : "no sequence"}
                        </span>
                      </button>
                    </td>
                    <td className="py-3.5 pr-4 text-[12px] text-[#c9c4b8]">{kindName(p.kind)}</td>
                    <td className="py-3.5 pr-4"><Badge tone={STATUS_TONE[p.status]}>{p.status.toUpperCase()}</Badge></td>
                    <td className="py-3.5 pr-4 text-[12px] text-[#97919f]">{site?.name ?? "—"}</td>
                    <td className="py-3.5 pr-4">
                      <span className="flex gap-1.5 text-[#8b8794]">
                        {devs.includes("desktop") && <Monitor size={13} />}
                        {(devs as string[]).includes("tablet") && <Tablet size={13} />}
                        {devs.includes("mobile") && <Smartphone size={13} />}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 text-right tabular-nums text-[#c9c4b8]">{fmtNum(p.stats.impressions)}</td>
                    <td className="py-3.5 pr-4 text-right tabular-nums text-[#c9c4b8]">{fmtNum(p.stats.clicks)}</td>
                    <td className="py-3.5 pr-4 text-right tabular-nums text-[#b3a6f5]">{ctr(p.stats.clicks, p.stats.impressions).toFixed(1)}%</td>
                    <td className="py-3.5 pr-4 text-right tabular-nums font-semibold text-[#f0d9ae]">{fmtMoney(popRevenue(p))}</td>
                    <td className="py-3.5 text-right relative">
                      <button onClick={() => setMenu(menu === p.id ? null : p.id)} className="p-1.5 rounded-lg hover:bg-white/5 text-[#8b8794] hover:text-white transition" aria-label="Row actions">
                        <EllipsisVertical size={15} />
                      </button>
                      {menu === p.id && (
                        <div className="absolute right-0 top-9 z-30 glass rounded-xl py-1.5 w-52 shadow-pop text-left fade-in">
                          {([
                            ["Edit", Pencil, () => router.push(`/dashboard/pops/${p.id}`)],
                            ["Duplicate", Files, () => { const n = store.duplicatePop(p.id); store.toast(`Duplicated as "${n?.name ?? "copy"}" (draft)`); }],
                            [p.status === "active" ? "Pause" : "Resume", p.status === "active" ? Pause : Play, () => {
                              store.setPopStatus(p.id, p.status === "active" ? "paused" : "active");
                              store.toast(`"${p.name}" ${p.status === "active" ? "paused" : "resumed"}`, "info");
                            }],
                            ["Archive", Archive, () => { store.archivePop(p.id); store.toast(`"${p.name}" archived`, "info"); }],
                            ["Get install code", Code2, () => setInstallFor(p)],
                            ["Delete", Trash2, () => setConfirmDelete(p)],
                          ] as [string, React.ElementType, () => void][]).map(([l, Icon, fn]) => (
                            <button key={l} onClick={() => { setMenu(null); fn(); }}
                              className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs transition hover:bg-white/[0.04] ${l === "Delete" ? "text-[#f0a0a8]" : "text-[#c9c4b8] hover:text-white"}`}>
                              <Icon size={13} className={l === "Delete" ? "" : "text-[#d9b380]"} /> {l}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p className="text-center text-sm text-[#8b8794] py-10">No pops match these filters.</p>}
      </Reveal>

      {/* install code */}
      <Modal open={!!installFor} onClose={() => setInstallFor(null)} title={`Install code — ${installFor?.name ?? ""}`}>
        <p className="text-sm text-[#a49ea8] mb-4">One tag serves every pop on this site. Paste it before <code className="text-[#f0d9ae]">&lt;/body&gt;</code>; this pop activates on the next config fetch (60s TTL).</p>
        <div className="rounded-xl bg-black/40 border border-line p-4">
          <code className="text-[12px] text-[#e8cf9f] break-all">{SNIPPET_CODE(store.sites.find((s) => s.id === installFor?.siteId)?.siteKey ?? "rb_demo")}</code>
        </div>
        <button onClick={() => installFor && copySnippet(installFor)} className="btn-gold rounded-xl w-full py-3 text-sm mt-4 flex items-center justify-center gap-2">
          {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy snippet</>}
        </button>
      </Modal>

      {/* delete */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title={`Delete "${confirmDelete?.name ?? ""}"?`}>
        <p className="text-sm text-[#a49ea8] mb-6">It stops serving on the next config fetch. Historical stats remain in Reports. Prefer Archive if you may revive it.</p>
        <div className="flex gap-3">
          <button onClick={() => setConfirmDelete(null)} className="btn-ghost rounded-xl px-4 py-2.5 text-sm flex-1">Keep it</button>
          <button onClick={() => { if (confirmDelete) { store.deletePop(confirmDelete.id); store.toast("Pop deleted", "info"); } setConfirmDelete(null); }}
            className="rounded-xl px-4 py-2.5 text-sm flex-1 bg-[rgba(240,160,168,.15)] border border-[rgba(240,160,168,.4)] text-[#f0a0a8] hover:bg-[rgba(240,160,168,.25)] transition">Delete</button>
        </div>
      </Modal>
    </div>
  );
}
