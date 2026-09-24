"use client";
import React, { useState } from "react";
import { Check, Code2, Copy, ExternalLink, Globe2, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { SNIPPET_CODE, fmtMoney, fmtNum } from "@/lib/data";
import { Badge, Empty, Modal, Reveal } from "@/components/ui";
import type { Site } from "@/lib/types";

export default function SitesPage() {
  const store = useStore();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [snippetFor, setSnippetFor] = useState<Site | null>(null);
  const [copiedKey, setCopiedKey] = useState("");
  const [verifying, setVerifying] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Site | null>(null);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const site = store.addSite(name || "Untitled Site", url || "example.com");
    setAdding(false); setName(""); setUrl("");
    setSnippetFor(site);
    store.toast(`“${site.name}” registered — install the snippet to go live`);
  };

  const copy = (text: string, key: string) => {
    try { navigator.clipboard.writeText(text); } catch { /* clipboard unavailable */ }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 1800);
  };

  const verify = (id: string) => {
    setVerifying(id);
    setTimeout(() => {
      store.verifySite(id);
      setVerifying(null);
      store.toast("Snippet detected — site is live", "success");
    }, 1600);
  };

  return (
    <div className="space-y-7">
      <Reveal className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="font-display text-3xl">Websites</h1>
          <p className="text-sm text-[#8b8794] mt-1">Every property runs from the same 14 KB snippet. Install once, control forever.</p>
        </div>
        <button onClick={() => setAdding(true)} className="ml-auto btn-gold rounded-xl px-4 py-2.5 text-sm flex items-center gap-2"><Plus size={15} /> Add website</button>
      </Reveal>

      {store.sites.length === 0 && (
        <Empty icon={<Globe2 size={22} />} title="No websites yet" sub="Register your first property and we'll mint its snippet key in seconds."
          action={<button onClick={() => setAdding(true)} className="btn-gold rounded-xl px-5 py-2.5 text-sm mt-2">Add website</button>} />
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        {store.sites.map((s, i) => (
          <Reveal key={s.id} delay={(i % 2) as 0 | 1} className="glass rounded-2xl p-6 card-hover">
            <div className="flex items-start gap-4">
              <span className="w-11 h-11 rounded-xl bg-[rgba(217,179,128,.09)] border border-line flex items-center justify-center text-[#d9b380] flex-none"><Globe2 size={19} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <p className="font-display text-lg">{s.name}</p>
                  <Badge tone={s.verified ? "mint" : "rose"}>{s.verified ? "LIVE" : "AWAITING SNIPPET"}</Badge>
                  <Badge tone="mute">{s.model === "revshare" ? "REV-SHARE" : "SUBSCRIPTION"}</Badge>
                </div>
                <a href={`https://${s.url}`} target="_blank" rel="noreferrer" onClick={(e) => e.preventDefault()}
                  className="text-xs text-[#8b8794] hover:text-[#f0d9ae] transition flex items-center gap-1 mt-1">{s.url} <ExternalLink size={10} /></a>
              </div>
              <div className="text-right flex-none">
                <p className="font-semibold text-[#f0d9ae]">{fmtMoney(s.revenue)}</p>
                <p className="text-[11px] text-[#8b8794]">{fmtNum(s.clicks)} clicks</p>
              </div>
            </div>
            <div className="mt-5 rounded-xl bg-black/30 border border-line px-4 py-3 flex items-center gap-3">
              <Code2 size={15} className="text-[#c9a068] flex-none" />
              <code className="text-[11px] text-[#97919f] truncate flex-1">{SNIPPET_CODE(s.siteKey)}</code>
              <button onClick={() => copy(SNIPPET_CODE(s.siteKey), s.id)} className="text-[#8b8794] hover:text-white transition flex-none" aria-label="Copy snippet">
                {copiedKey === s.id ? <Check size={14} className="text-[#8fe3b0]" /> : <Copy size={14} />}
              </button>
            </div>
            <div className="mt-4 flex items-center gap-2.5">
              <button onClick={() => setSnippetFor(s)} className="btn-ghost rounded-xl px-3.5 py-2 text-xs flex items-center gap-1.5"><Code2 size={13} /> Install guide</button>
              {!s.verified && (
                <button onClick={() => verify(s.id)} disabled={verifying === s.id}
                  className="btn-ghost rounded-xl px-3.5 py-2 text-xs flex items-center gap-1.5 disabled:opacity-60">
                  {verifying === s.id ? <RefreshCw size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                  {verifying === s.id ? "Pinging site…" : "Verify installation"}
                </button>
              )}
              <button onClick={() => setConfirmDelete(s)} className="ml-auto p-2 rounded-lg hover:bg-white/5 text-[#8b8794] hover:text-[#f0a0a8] transition" aria-label="Remove site"><Trash2 size={15} /></button>
            </div>
          </Reveal>
        ))}
      </div>

      {/* add modal */}
      <Modal open={adding} onClose={() => setAdding(false)} title="Register a website">
        <form onSubmit={add} className="space-y-4">
          <div><label className="text-xs text-[#97919f] mb-1.5 block">Site name</label>
            <input className="input-lux" required placeholder="The Gilded Post" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label className="text-xs text-[#97919f] mb-1.5 block">Domain</label>
            <input className="input-lux" required placeholder="thegildedpost.com" value={url} onChange={(e) => setUrl(e.target.value)} /></div>
          <button type="submit" className="btn-gold rounded-xl w-full py-3 text-sm">Register & mint snippet</button>
        </form>
      </Modal>

      {/* snippet modal */}
      <Modal open={!!snippetFor} onClose={() => setSnippetFor(null)} title={`Install on ${snippetFor?.name ?? ""}`}>
        <ol className="space-y-4 text-sm text-[#c9c4b8]">
          <li className="flex gap-3"><span className="w-6 h-6 rounded-lg bg-[rgba(217,179,128,.12)] border border-line text-[#f0d9ae] text-xs flex items-center justify-center flex-none">1</span>
            <span>Copy the snippet below and paste it anywhere before <code className="text-[#f0d9ae]">&lt;/body&gt;</code> on every page of <b>{snippetFor?.url}</b>.</span></li>
          <li className="flex gap-3"><span className="w-6 h-6 rounded-lg bg-[rgba(217,179,128,.12)] border border-line text-[#f0d9ae] text-xs flex items-center justify-center flex-none">2</span>
            <span>That's all. Design, triggers and campaigns stream from this dashboard — no further code edits, ever.</span></li>
          <li className="flex gap-3"><span className="w-6 h-6 rounded-lg bg-[rgba(217,179,128,.12)] border border-line text-[#f0d9ae] text-xs flex items-center justify-center flex-none">3</span>
            <span>The script is async and wrapped in fail-safes: if anything breaks, your site and your visitor are never affected.</span></li>
        </ol>
        <div className="mt-5 rounded-xl bg-black/40 border border-line p-4">
          <code className="text-[12px] text-[#e8cf9f] break-all leading-relaxed block">{snippetFor ? SNIPPET_CODE(snippetFor.siteKey) : ""}</code>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={() => snippetFor && copy(SNIPPET_CODE(snippetFor.siteKey), "modal")} className="btn-gold rounded-xl px-5 py-2.5 text-sm flex-1 flex items-center justify-center gap-2">
            {copiedKey === "modal" ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy snippet</>}
          </button>
          <button onClick={() => { setSnippetFor(null); store.toast("Open the Publisher sandbox to see this snippet in action", "info"); }} className="btn-ghost rounded-xl px-5 py-2.5 text-sm">Done</button>
        </div>
      </Modal>

      {/* delete confirm */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title={`Remove ${confirmDelete?.name ?? ""}?`}>
        <p className="text-sm text-[#a49ea8] mb-6">Its pops retire and the snippet key is revoked. Revenue history remains in reports.</p>
        <div className="flex gap-3">
          <button onClick={() => setConfirmDelete(null)} className="btn-ghost rounded-xl px-4 py-2.5 text-sm flex-1">Keep site</button>
          <button onClick={() => { if (confirmDelete) { store.deleteSite(confirmDelete.id); store.toast(`“${confirmDelete.name}” removed`, "info"); } setConfirmDelete(null); }}
            className="rounded-xl px-4 py-2.5 text-sm flex-1 bg-[rgba(240,160,168,.15)] border border-[rgba(240,160,168,.4)] text-[#f0a0a8] hover:bg-[rgba(240,160,168,.25)] transition">Remove</button>
        </div>
      </Modal>
    </div>
  );
}
