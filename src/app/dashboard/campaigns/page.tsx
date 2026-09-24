"use client";
import React, { useMemo, useState } from "react";
import {
  BookOpen, CheckSquare2, Gauge, Layers, Library, Pencil, Play, Plus, Search, Square, X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { fmtMoney, fmtNum, uid } from "@/lib/data";
import { Badge, Modal, Reveal, Toggle } from "@/components/ui";
import CampaignEditor, { blankCampaign } from "@/components/campaign-editor";
import type { Campaign, CampaignKind } from "@/lib/types";

const KIND_LABEL: Record<CampaignKind, string> = { hostpost: "Host & Post", cpa: "CPA Link-Out", gfeed: "Google Feed" };
const KIND_TONE: Record<CampaignKind, "gold" | "violet" | "mint"> = { hostpost: "mint", cpa: "gold", gfeed: "violet" };

export default function CampaignsPage() {
  const store = useStore();
  const isAdv = store.user?.role === "advertiser";
  const [tab, setTab] = useState<"mine" | "library">("mine");
  const [query, setQuery] = useState("");
  const [kindF, setKindF] = useState<"all" | CampaignKind>("all");
  const [statusF, setStatusF] = useState<"all" | "active" | "paused" | "draft">("all");
  const [verticalF, setVerticalF] = useState("all");
  const [ownerF, setOwnerF] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<(Omit<Campaign, "id"> & { id?: string }) | null>(null);

  const mine = useMemo(
    () => store.campaigns.filter((c) => c.status !== "library" && (!isAdv || c.advertiser === store.user?.company)),
    [store.campaigns, isAdv, store.user?.company],
  );
  const library = useMemo(() => store.campaigns.filter((c) => c.status === "library"), [store.campaigns]);

  const verticals = useMemo(() => [...new Set(mine.map((c) => c.vertical))], [mine]);
  const owners = useMemo(() => [...new Set(mine.map((c) => c.advertiser))], [mine]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mine.filter((c) =>
      (kindF === "all" || c.kind === kindF) &&
      (statusF === "all" || c.status === statusF) &&
      (verticalF === "all" || c.vertical === verticalF) &&
      (ownerF === "all" || c.advertiser === ownerF) &&
      (!q || c.name.toLowerCase().includes(q) || c.advertiser.toLowerCase().includes(q)),
    );
  }, [mine, query, kindF, statusF, verticalF, ownerF]);

  const toggleSel = (id: string) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelected(n);
  };
  const bulk = (status: "active" | "paused") => {
    const hits: Campaign[] = [];
    filtered.forEach((c) => {
      if (selected.has(c.id)) { hits.push(c); store.saveCampaign({ ...c, status }); }
    });
    store.toast(`${hits.length} campaign${hits.length === 1 ? "" : "s"} ${status === "active" ? "activated" : "deactivated"}`);
    setSelected(new Set());
  };

  const openCreate = () => {
    const b = blankCampaign();
    if (isAdv) b.advertiser = store.user!.company;
    setEditing(b);
  };

  return (
    <div className="space-y-6">
      <Reveal className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="font-display text-3xl">Campaign Library</h1>
          <p className="text-sm text-[#8b8794] mt-1">Campaigns live independently of pops — each pop draws up to 5 into its rotation sequence.</p>
        </div>
        <button onClick={openCreate} className="ml-auto btn-gold rounded-xl px-4 py-2.5 text-sm flex items-center gap-2"><Plus size={15} /> New campaign</button>
      </Reveal>

      {/* optimizer band — platform-owned, hidden from advertisers (§4) */}
      {!isAdv && (
        <Reveal className="glass rounded-2xl px-6 py-5 flex flex-wrap items-center gap-5">
          <span className="w-10 h-10 rounded-xl bg-[rgba(143,227,176,.1)] border border-[rgba(143,227,176,.25)] flex items-center justify-center text-[#8fe3b0]"><Gauge size={19} /></span>
          <div className="flex-1 min-w-[240px]">
            <p className="text-sm font-semibold">Auto-Optimizer {store.optimizerOn ? "is live" : "is off"}</p>
            <p className="text-xs text-[#8b8794]">Reweighs rotation hourly by live EPC — a capped-out campaign is auto-skipped in the sequence.</p>
          </div>
          <div className="flex items-center gap-4">
            {store.optimizerOn && (
              <div className="hidden md:flex items-center gap-3">
                {mine.filter((c) => c.status === "active").slice(0, 3).map((c) => (
                  <span key={c.id} className="chip text-[#8fe3b0] border-[rgba(143,227,176,.25)] bg-[rgba(143,227,176,.06)]">{c.name.split(" ")[0]} · {c.optimizerScore}</span>
                ))}
              </div>
            )}
            <Toggle on={store.optimizerOn} onChange={(v) => { store.setOptimizer(v); store.toast(v ? "Optimizer engaged" : "Optimizer paused", "info"); }} label="Optimizer" />
          </div>
        </Reveal>
      )}

      {/* tabs */}
      <div className="flex gap-2 flex-wrap">
        {([["mine", `${isAdv ? "Own campaigns" : "My campaigns"} (${mine.length})`, Layers], ...(isAdv ? [] : [["library", `Marketplace (${library.length})`, Library] as const] as const)] as const).map(([id, l, Icon]) => (
          <button key={id} onClick={() => setTab(id as "mine" | "library")}
            className={`rounded-xl px-4 py-2.5 text-sm flex items-center gap-2 transition border ${tab === id ? "bg-[rgba(217,179,128,.12)] text-[#f0d9ae] border-[rgba(217,179,128,.3)]" : "border-line text-[#97919f] hover:text-white"}`}>
            <Icon size={15} /> {l}
          </button>
        ))}
      </div>

      {tab === "mine" ? (
        <>
          {/* search + filters (§5.2) */}
          <Reveal className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5d5867]" />
              <input className="input-lux !pl-9" placeholder="Search name or advertiser…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <select className="input-lux !w-auto" value={kindF} onChange={(e) => setKindF(e.target.value as typeof kindF)}>
              <option value="all">All kinds</option><option value="hostpost">Host &amp; Post</option><option value="cpa">CPA Link-Out</option><option value="gfeed">Google Feed</option>
            </select>
            <select className="input-lux !w-auto" value={statusF} onChange={(e) => setStatusF(e.target.value as typeof statusF)}>
              <option value="all">All statuses</option><option value="active">active</option><option value="paused">paused</option><option value="draft">draft</option>
            </select>
            <select className="input-lux !w-auto" value={verticalF} onChange={(e) => setVerticalF(e.target.value)}>
              <option value="all">All verticals</option>{verticals.map((v) => <option key={v}>{v}</option>)}
            </select>
            <select className="input-lux !w-auto" value={ownerF} onChange={(e) => setOwnerF(e.target.value)}>
              <option value="all">All owners</option>{owners.map((v) => <option key={v}>{v}</option>)}
            </select>
          </Reveal>

          {/* bulk actions bar */}
          {selected.size > 0 && (
            <div className="glass rounded-2xl px-5 py-3.5 flex items-center gap-4 toast-in sticky top-[84px] z-20 border-[rgba(217,179,128,.4)]">
              <CheckSquare2 size={16} className="text-[#d9b380]" />
              <span className="text-sm">{selected.size} selected</span>
              <div className="ml-auto flex gap-2">
                <button onClick={() => bulk("active")} className="rounded-lg px-3.5 py-2 text-xs bg-[rgba(143,227,176,.12)] border border-[rgba(143,227,176,.35)] text-[#8fe3b0] hover:bg-[rgba(143,227,176,.22)] transition">Activate</button>
                <button onClick={() => bulk("paused")} className="rounded-lg px-3.5 py-2 text-xs bg-[rgba(240,160,168,.1)] border border-[rgba(240,160,168,.3)] text-[#f0a0a8] hover:bg-[rgba(240,160,168,.2)] transition">Deactivate</button>
                <button onClick={() => setSelected(new Set())} className="btn-ghost rounded-lg px-3 py-2 text-xs" aria-label="Clear selection"><X size={13} /></button>
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="glass rounded-2xl p-12 text-center">
              <p className="font-display text-lg mb-1">Nothing matches</p>
              <p className="text-sm text-[#8b8794]">Loosen a filter or clear the search.</p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-5">
            {filtered.map((c, i) => (
              <Reveal key={c.id} delay={(i % 2) as 0 | 1} className={`glass rounded-2xl overflow-hidden card-hover relative ${selected.has(c.id) ? "border-[rgba(217,179,128,.55)]" : ""}`}>
                <button onClick={() => toggleSel(c.id)} aria-label="Select campaign"
                  className={`absolute top-3 right-3 z-10 w-7 h-7 rounded-lg border flex items-center justify-center transition ${selected.has(c.id) ? "bg-[rgba(217,179,128,.9)] border-[#eed9ac] text-[#16110a]" : "bg-black/45 border-white/25 text-transparent hover:border-[#eed9ac]"}`}>
                  {selected.has(c.id) ? <CheckSquare2 size={14} /> : <Square size={14} />}
                </button>
                <div className="h-32 bg-cover bg-center relative" style={{ backgroundImage: `url(${c.image})` }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0c0a13] via-[#0c0a13]/40 to-transparent" />
                  <div className="absolute top-3 left-3 flex gap-2">
                    <Badge tone={KIND_TONE[c.kind]}>{KIND_LABEL[c.kind]}</Badge>
                    <Badge tone={c.status === "active" ? "mint" : c.status === "paused" ? "rose" : "mute"}>{c.status.toUpperCase()}</Badge>
                  </div>
                  <div className="absolute bottom-3 left-4 right-12">
                    <p className="font-display text-lg leading-tight">{c.name}</p>
                    <p className="text-[11px] text-[#97919f]">{c.advertiser} · {c.vertical}</p>
                  </div>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-4 gap-2 text-center mb-4">
                    {[["Payout", `$${c.payout}`], ["EPC", `$${c.epc}`], ["Clicks", fmtNum(c.clicks)], ["Revenue", fmtMoney(c.revenue)]].map(([l, v]) => (
                      <div key={l as string} className="rounded-lg bg-black/25 border border-line py-2">
                        <p className="text-[13px] font-semibold">{v}</p><p className="text-[9.5px] text-[#8b8794] uppercase tracking-wider mt-0.5">{l}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-4 text-[10.5px]">
                    <span className="chip text-[#c9c4b8]">YES: {c.yesText}</span>
                    {c.dailyCap != null && <span className="chip text-[#c9a068]">cap {fmtNum(c.dailyCap)}/day</span>}
                    {c.monthlyCap != null && <span className="chip text-[#c9a068]">cap {fmtNum(c.monthlyCap)}/mo</span>}
                    <span className="chip text-[#8b8794]">w{c.weight ?? 50}</span>
                    {c.schedule && <span className="chip text-[#8b8794]">{c.schedule.start.slice(0, 7)} → {c.schedule.end.slice(0, 7)}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Toggle on={c.status === "active"} onChange={() => { store.toggleCampaign(c.id); store.toast(`"${c.name}" ${c.status === "active" ? "paused" : "activated"}`, "info"); }} label="status" />
                    <span className="text-[11px] text-[#8b8794]">{c.status === "active" ? <span className="inline-flex items-center gap-1"><Play size={10} className="text-[#8fe3b0]" /> Serving</span> : "Idle"}</span>
                    <div className="ml-auto flex gap-1.5">
                      <button onClick={() => setEditing({ ...c })} className="p-2 rounded-lg hover:bg-white/5 text-[#97919f] hover:text-white transition" aria-label="Edit"><Pencil size={15} /></button>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-[#8b8794] -mt-1 flex items-center gap-2"><BookOpen size={13} className="text-[#d9b380]" /> Admin-published proven campaigns with set payouts. Publishers on a paid plan can add them to any pop sequence.</p>
          <div className="grid md:grid-cols-3 gap-5">
            {library.map((c, i) => (
              <Reveal key={c.id} delay={(i % 3) as 0 | 1 | 2} className="glass rounded-2xl overflow-hidden card-hover flex flex-col">
                <div className="h-28 bg-cover bg-center relative" style={{ backgroundImage: `url(${c.image})` }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0c0a13] to-transparent" />
                  <div className="absolute top-3 left-3"><Badge tone={KIND_TONE[c.kind]}>{KIND_LABEL[c.kind]}</Badge></div>
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <p className="font-display text-lg leading-tight">{c.name}</p>
                  <p className="text-[11px] text-[#97919f] mt-0.5 mb-3">{c.advertiser}</p>
                  <p className="text-xs text-[#8b8794] leading-relaxed flex-1">{c.description}</p>
                  <div className="flex items-center justify-between mt-4 mb-4 text-center">
                    <div><p className="text-sm font-semibold text-[#f0d9ae]">${c.payout}</p><p className="text-[10px] text-[#8b8794]">{c.payoutModel} payout</p></div>
                    <div><p className="text-sm font-semibold">${c.epc}</p><p className="text-[10px] text-[#8b8794]">library EPC</p></div>
                    <div><p className="text-sm font-semibold">w{c.weight ?? 50}</p><p className="text-[10px] text-[#8b8794]">weight</p></div>
                  </div>
                  <button onClick={() => { store.deployCampaign(c.id); store.toast(`"${c.name}" added to your campaigns — pick it inside any pop's sequence`); }}
                    className="btn-gold rounded-xl px-4 py-2.5 text-sm flex items-center justify-center gap-2">
                    <Plus size={14} /> Add to my campaigns
                  </button>
                </div>
              </Reveal>
            ))}
          </div>
        </>
      )}

      {/* editor modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit campaign" : "New campaign"} wide>
        {editing && (
          <CampaignEditor
            initial={editing}
            lockAdvertiser={isAdv ? store.user!.company : undefined}
            onCancel={() => setEditing(null)}
            onSave={(c) => {
              const withId = { ...c, id: c.id ?? `c_${uid()}` } as Campaign;
              store.saveCampaign(withId);
              store.toast(c.id ? "Campaign updated" : `Campaign "${withId.name}" created`);
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
