"use client";
import React, { useState } from "react";
import { Blocks, Check, KeyRound, Link2, RefreshCw, Unplug, Zap } from "lucide-react";
import { useStore } from "@/lib/store";
import { fmtNum } from "@/lib/data";
import { Badge, Modal, Reveal } from "@/components/ui";
import type { Integration } from "@/lib/types";

export default function IntegrationsPage() {
  const store = useStore();
  const [connecting, setConnecting] = useState<Integration | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [syncing, setSyncing] = useState<string | null>(null);

  const connect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!connecting) return;
    store.connectIntegration(connecting.id, apiKey.trim() || "demo-key");
    store.toast(`${connecting.name} connected — captured leads will flow automatically`);
    setConnecting(null);
    setApiKey("");
  };

  const sync = (i: Integration) => {
    setSyncing(i.id);
    setTimeout(() => {
      store.syncIntegration(i.id);
      setSyncing(null);
      store.toast(`${i.name}: leads synchronized`);
    }, 1400);
  };

  const connected = store.integrations.filter((i) => i.connected).length;

  return (
    <div className="space-y-7">
      <Reveal className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="font-display text-3xl">Integrations</h1>
          <p className="text-sm text-[#8b8794] mt-1">Captured leads, wired into the tools you already love.</p>
        </div>
        <Badge tone="mint"><Link2 size={11} /> {connected} connected</Badge>
      </Reveal>

      <Reveal className="glass rounded-2xl px-6 py-5 flex flex-wrap items-center gap-4">
        <span className="w-10 h-10 rounded-xl bg-[rgba(217,179,128,.1)] border border-line flex items-center justify-center text-[#d9b380]"><Blocks size={18} /></span>
        <p className="text-sm text-[#c9c4b8] flex-1 min-w-[260px] leading-relaxed">
          API keys are stored <b>server-side only</b>. Publisher-side JavaScript never sees them — all posting and delivery happens on RevBounce infrastructure.
        </p>
        <Badge tone="gold"><KeyRound size={11} /> Secrets never ship to the browser</Badge>
      </Reveal>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {store.integrations.map((i, idx) => (
          <Reveal key={i.id} delay={(idx % 3) as 0 | 1 | 2} className="glass rounded-2xl p-6 card-hover flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <span className="w-11 h-11 rounded-xl flex items-center justify-center font-display text-lg font-semibold" style={{ background: `${i.logoColor}18`, color: i.logoColor, border: `1px solid ${i.logoColor}44` }}>
                {i.name[0]}
              </span>
              <Badge tone={i.connected ? "mint" : "mute"}>{i.connected ? "CONNECTED" : i.category.toUpperCase()}</Badge>
            </div>
            <h3 className="font-display text-lg">{i.name}</h3>
            <p className="text-xs text-[#8b8794] mt-1.5 leading-relaxed flex-1">{i.description}</p>
            {i.connected && (
              <p className="text-[11px] text-[#97919f] mt-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8fe3b0]" /> {fmtNum(i.syncedLeads)} leads delivered
              </p>
            )}
            <div className="mt-5 flex gap-2">
              {i.connected ? (
                <>
                  <button onClick={() => sync(i)} disabled={syncing === i.id}
                    className="btn-ghost rounded-xl px-3.5 py-2 text-xs flex-1 flex items-center justify-center gap-1.5 disabled:opacity-60">
                    <RefreshCw size={12} className={syncing === i.id ? "animate-spin" : ""} /> {syncing === i.id ? "Syncing…" : "Sync now"}
                  </button>
                  <button onClick={() => { store.disconnectIntegration(i.id); store.toast(`${i.name} disconnected`, "info"); }}
                    className="btn-ghost rounded-xl px-3.5 py-2 text-xs text-[#f0a0a8] flex items-center justify-center gap-1.5">
                    <Unplug size={12} /> Disconnect
                  </button>
                </>
              ) : (
                <button onClick={() => { setConnecting(i); setApiKey(""); }}
                  className="btn-gold rounded-xl px-3.5 py-2.5 text-xs flex-1 flex items-center justify-center gap-1.5">
                  <Zap size={12} /> Connect
                </button>
              )}
            </div>
          </Reveal>
        ))}
      </div>

      <Modal open={!!connecting} onClose={() => setConnecting(null)} title={`Connect ${connecting?.name ?? ""}`}>
        <form onSubmit={connect} className="space-y-4">
          <p className="text-xs text-[#8b8794] leading-relaxed">
            Paste your {connecting?.name} API key. It is encrypted at rest and used exclusively by RevBounce servers — it never appears in any snippet or page source.
          </p>
          <div>
            <label className="text-xs text-[#97919f] mb-1.5 block">API key</label>
            <input className="input-lux font-mono" placeholder={connecting?.id === "webhooks" ? "https://your.endpoint/postback" : "xxxxxxxx-xxxx-xxxx"}
              value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            {apiKey.length > 0 && apiKey.length < 8 && <p className="text-[11px] text-[#f0a0a8] mt-1.5">That looks short — most keys are 16+ characters.</p>}
          </div>
          <button type="submit" className="btn-gold rounded-xl w-full py-3 text-sm flex items-center justify-center gap-2">
            <Check size={14} /> Save & connect
          </button>
        </form>
      </Modal>
    </div>
  );
}
