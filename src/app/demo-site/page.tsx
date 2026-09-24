"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import {
  ArrowLeft, Bug, FlaskConical, MousePointerClick, Radio, RotateCcw, ShieldOff, Terminal, Timer,
} from "lucide-react";
import { timeAgo } from "@/lib/data";

const SITE_KEY = "rb_tgp_9f27c1";

interface RbState {
  site: string; device: string; geo: string; consent: boolean; visitorId: string;
  sessionId: string; tabId: string; lockedElsewhere: boolean; killed: boolean;
  errors: number; queued: number; prefill: Record<string, string>;
  pops: { id: string; kind: string; version: number; priority: number; status: string; index: number; order: string[] }[];
}
type RBWindow = Window & {
  RevBounce?: {
    show: (id: string) => boolean; hide: () => boolean; reset: () => boolean;
    debug: (on?: boolean) => boolean; stop: () => boolean; state: () => RbState; flush: () => void;
  };
  revbounceData?: Record<string, string>;
  revbounceConsent?: boolean;
};
interface ServedEvent { site: string; pop: string; campaign: string; type: string; ts: number }
interface ServedLead { id: string; email: string; kind: string; destination: string; provider: string; http: number; ms: number; campaign: string; ts: number }

const EV_COLOR: Record<string, string> = {
  impression: "#8b7cf0", click: "#d9b380", conversion: "#8fe3b0", close: "#5d5867",
};

const mask = (email: string) => email.replace(/^(.{2})[^@]*(@.+)$/, "$1•••$2");

export default function DemoSite() {
  const [panel, setPanel] = useState(true);
  const [events, setEvents] = useState<ServedEvent[]>([]);
  const [leads, setLeads] = useState<ServedLead[]>([]);
  const [snippetReady, setSnippetReady] = useState(false);

  const [note, setNote] = useState("");
  const [state, setState] = useState<RbState | null>(null);
  const [debugOn, setDebugOn] = useState(false);
  const rb = () => (window as RBWindow).RevBounce;
  const trigger = (id: string) => {
    if (!rb()?.show(id)) setNote("Pop not eligible here (device / URL / frequency rules).");
    else setNote(`RevBounce.show("${id}") fired.`);
  };
  const resetCaps = () => { rb()?.reset(); setNote("Frequency caps, sequence state and the tab lock were cleared."); };

  const poll = useCallback(async () => {
    try {
      const r = await fetch(`/api/track?site=${SITE_KEY}`, { cache: "no-store" });
      const j = await r.json();
      if (j?.events) setEvents(j.events);
      if (j?.leads) setLeads(j.leads);
    } catch { /* feed is best-effort */ }
  }, []);

  useEffect(() => {
    poll();
    const iv = setInterval(poll, 3500);
    return () => clearInterval(iv);
  }, [poll]);

  // §7.7 publisher-provided pre-fill data, set before the tag boots
  useEffect(() => {
    const w = window as RBWindow;
    w.revbounceData = { first_name: "Ava", email: "reader@gildedpost.com", zip: "90210" };
  }, []);

  // poll the engine's public state (§7.8 RevBounce.state)
  useEffect(() => {
    const iv = setInterval(() => { try { setState(rb()?.state() ?? null); } catch { /* not booted */ } }, 1200);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(""), 4000); return () => clearTimeout(t); }, [note]);


  const img = (id: string, w = 900) => `https://images.unsplash.com/${id}?q=80&w=${w}&auto=format&fit=crop`;

  return (
    <div className="min-h-screen bg-[#faf7f1] text-[#211d18] relative" style={{ fontFamily: "var(--f-sans), ui-sans-serif, system-ui" }}>
      {/* the actual production tag — Shadow DOM engine, exactly what a publisher installs (spec §3) */}
      <Script src="/embed.js" data-site={SITE_KEY} strategy="afterInteractive" onLoad={() => setSnippetReady(true)} />

      {/* ── masthead ── */}
      <header className="border-b border-[#e5ddd0] bg-[#faf7f1]/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-8">
          <span className="font-display text-2xl tracking-tight text-[#171310]">The Gilded Post</span>
          <nav className="hidden md:flex gap-6 text-[13px] text-[#6d655a]">
            {["Journal", "Guides", "Reviews", "Deals", "About"].map((n) => (
              <a key={n} href="#article" className="hover:text-[#a07c42] transition">{n}</a>
            ))}
          </nav>
          <span className="ml-auto text-[11px] text-[#a07c42] tracking-[0.2em] uppercase hidden sm:block">Est. 2019 · Independent</span>
        </div>
      </header>

      {/* ── demo notice bar ── */}
      <div className="bg-[#171310] text-[#e8dfce] text-[12px] px-6 py-2.5 flex items-center justify-center gap-2 flex-wrap text-center">
        <FlaskConical size={13} className="text-[#d9b380]" />
        <span>Live sandbox running <b>/embed.js</b> with <code>data-site</code>. Exit-intent (cursor to tab bar) · idle · back-button on mobile. Open a <b>second tab</b> — only one shows a pop. Refresh mid-sequence to resume where you left off.</span>
      </div>

      {/* ── article ── */}
      <main id="article" className="max-w-3xl mx-auto px-6 py-12">
        <p className="text-[11px] tracking-[0.3em] uppercase text-[#a07c42] font-semibold">Journal · Alpine Issue No. 14</p>
        <h1 className="font-display text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.06] mt-4 text-[#171310]">
          In praise of slow mountain mornings: six alpine retreats worth the altitude
        </h1>
        <div className="flex items-center gap-3 mt-6 text-[12.5px] text-[#6d655a]">
          <img src={img("photo-1494790108377-be9c29b29330", 100)} alt="Ava Sterling" className="w-9 h-9 rounded-full object-cover" />
          <span>By <b className="text-[#211d18]">Ava Sterling</b> · 9 min read · January 2026</span>
        </div>

        <figure className="mt-9 rounded-2xl overflow-hidden shadow-lg">
          <img src={img("photo-1464822759023-fed622ff2c3b", 1600)} alt="Alpine ridge at dawn" className="w-full h-[380px] object-cover" />
          <figcaption className="text-[11.5px] text-[#8b8272] px-4 py-2.5 bg-[#f2ecdf]">The Bernese Oberland, an hour after first light. Photo: TGP archives.</figcaption>
        </figure>

        <div className="prose-custom mt-9 space-y-5 text-[15.5px] leading-[1.85] text-[#3d372e]">
          <p>There is a particular silence that lives above two thousand metres — not the absence of sound, but the presence of altitude. It arrives somewhere between the second coffee and the first cloud burning off the ridge, and once you have heard it, every morning at sea level feels slightly mis-tuned.</p>
          <p>We spent the autumn chasing that silence through six valleys and four countries. What follows is not a list of the most expensive chalets in the Alps — you know those already — but the retreats where the mornings are deliberately, almost stubbornly slow.</p>
          <h2 className="font-display text-3xl text-[#171310] pt-4">1. The firekeeper's farm, Val d'Hérens</h2>
          <p>A working farm that happens to take six guests. Breakfast is whatever the hens negotiated that morning, and the stove is lit by a man who has never once checked a phone before noon. Book the east room; the sunrise does the rest.</p>
          <img src={img("photo-1519681393784-d120267933ba", 1400)} alt="Snowy peak with stars" className="w-full h-72 object-cover rounded-xl my-2" />
          <h2 className="font-display text-3xl text-[#171310] pt-4">2. A librarian's chalet, South Tyrol</h2>
          <p>Eleven thousand books, one espresso machine, zero Wi-Fi passwords handed out before 11 a.m. It is the only place we have ever finished a novel and a crossword in the same sitting.</p>
          <p>Further down the valley, the cable car runs at seven sharp — but the retreat's regulars have long ago agreed that anything worth ascending will still be there at ten.</p>
          <h2 className="font-display text-3xl text-[#171310] pt-4">Reading list, ranked by woodsmoke</h2>
          <p>Our remaining four picks — a photographer's hut above Zermatt, a bakery-inn near Chamonix, a retired observatory in the Dolomites, and a sauna boat on Lake Brienz — are profiled in the print issue. The common thread is not luxury but tempo: each of them has decided, in its own way, that mornings are for keeping.</p>
          <p>Pack wool socks. Leave the laptop. And if a pop-up showed you a very handsome travel voucher just now — well, the mountains do reward curiosity.</p>
        </div>

        {/* newsletter box */}
        <div className="mt-12 rounded-2xl bg-[#171310] text-[#e8dfce] p-8 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full opacity-20" style={{ background: "radial-gradient(closest-side,#d9b380,transparent)" }} />
          <h3 className="font-display text-2xl">The Sunday Cable Car</h3>
          <p className="text-[13px] text-[#b3a891] mt-2 max-w-md">One slow-travel essay, one borrowed recipe, zero urgency. Weekly, free.</p>
          <form onSubmit={(e) => e.preventDefault()} className="mt-5 flex gap-2.5 max-w-md">
            <input placeholder="you@somewhere.quiet" className="flex-1 rounded-lg bg-white/10 border border-white/15 px-4 py-2.5 text-sm placeholder:text-[#6d655a] outline-none focus:border-[#d9b380]" />
            <button className="rounded-lg px-5 py-2.5 text-sm font-semibold text-[#171310] bg-gradient-to-r from-[#eed9ac] to-[#c9a068] hover:brightness-110 transition">Subscribe</button>
          </form>
        </div>

        {/* related */}
        <h3 className="font-display text-2xl mt-14 mb-6 text-[#171310]">Further reading</h3>
        <div className="grid sm:grid-cols-3 gap-5">
          {[
            ["photo-1476514525535-07fb3b4ae5f1", "The ferries of the fjords, taken slowly"],
            ["photo-1470071459604-3b5ec3a7fe05", "Fog, and the case for unphotographed days"],
            ["photo-1441974231531-c6227db76b6e", "A field guide to forest hotels"],
          ].map(([id, t]) => (
            <a key={id} href="#article" onClick={(e) => e.preventDefault()} className="group">
              <div className="rounded-xl overflow-hidden"><img src={img(id, 700)} alt={t} className="h-36 w-full object-cover group-hover:scale-105 transition duration-500" /></div>
              <p className="mt-3 text-[13.5px] font-medium leading-snug text-[#3d372e] group-hover:text-[#a07c42] transition">{t}</p>
            </a>
          ))}
        </div>
      </main>

      <footer className="border-t border-[#e5ddd0] mt-10 py-10 text-center text-[12px] text-[#8b8272]">
        <p>© 2026 The Gilded Post · monetized politely by <Link href="/" className="text-[#a07c42] underline underline-offset-2">RevBounce</Link></p>
      </footer>

      {/* ── demo control panel ── */}
      <div className={`fixed bottom-5 left-5 z-[70] transition-all ${panel ? "w-[320px]" : "w-auto"}`}>
        <div className="glass rounded-2xl shadow-pop overflow-hidden">
          <button onClick={() => setPanel(!panel)} className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-white/[0.03] transition">
            <Terminal size={15} className="text-[#d9b380]" />
            <span className="text-[13px] font-semibold flex-1">Sandbox controls</span>
            <span className={`w-2 h-2 rounded-full ${snippetReady ? "bg-[#8fe3b0] pulse-dot" : "bg-[#d9b380]"}`} />
            <span className="text-[10px] text-[#8b8794]">{panel ? "–" : "+"}</span>
          </button>
          {panel && (
            <div className="px-4 pb-4 space-y-4">
              <p className="text-[11px] text-[#8b8794] flex items-center gap-1.5">
                <MousePointerClick size={11} className="text-[#d9b380]" />
                Snippet {snippetReady ? "loaded · key " + SITE_KEY : "loading…"} — firing via window.RB_DEBUG
              </p>
              <div>
                <p className="text-[10px] tracking-[0.25em] uppercase text-[#5d5867] mb-2">RevBounce.show(popId)</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[["p1", "Offer · exit (5)"], ["p2", "Offer · idle (2)"], ["p4", "Email capture"]].map(([id, l]) => (
                    <button key={id} onClick={() => trigger(id)} className="btn-ghost rounded-lg px-3 py-2 text-[11.5px]">{l}</button>
                  ))}
                  <button onClick={() => { rb()?.hide(); setNote("RevBounce.hide() called."); }} className="btn-ghost rounded-lg px-3 py-2 text-[11.5px]">Hide</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button onClick={resetCaps} className="btn-ghost rounded-lg px-3 py-2 text-[11.5px] flex items-center justify-center gap-1.5">
                  <RotateCcw size={11} /> reset()
                </button>
                <button onClick={() => { const v = !debugOn; setDebugOn(v); rb()?.debug(v); setNote(`Console debug ${v ? "on" : "off"} — open devtools.`); }}
                  className={`rounded-lg px-3 py-2 text-[11.5px] flex items-center justify-center gap-1.5 border transition ${debugOn ? "border-[rgba(217,179,128,.5)] text-[#f0d9ae] bg-[rgba(217,179,128,.08)]" : "btn-ghost"}`}>
                  <Bug size={11} /> debug({debugOn ? "true" : "false"})
                </button>
                <button onClick={() => { (window as RBWindow).revbounceConsent = false; setNote("window.revbounceConsent = false — reload to see anonymous, session-only identity."); }}
                  className="btn-ghost rounded-lg px-3 py-2 text-[11.5px] flex items-center justify-center gap-1.5"><ShieldOff size={11} /> revoke consent</button>
                <Link href="/dashboard/pops" className="btn-ghost rounded-lg px-3 py-2 text-[11.5px] flex items-center justify-center gap-1.5">
                  <Timer size={11} /> Edit in Studio
                </Link>
              </div>

              {/* §7.8 engine state */}
              {state && (
                <div className="rounded-lg bg-black/25 border border-line px-2.5 py-2 space-y-1">
                  <p className="text-[10px] tracking-[0.25em] uppercase text-[#5d5867] mb-1">RevBounce.state()</p>
                  {[
                    ["device / geo", `${state.device} · ${state.geo || "—"}`],
                    ["visitor", state.consent ? state.visitorId.slice(0, 13) + "…" : "anonymous (consent off)"],
                    ["session", state.sessionId.slice(0, 12) + "…"],
                    ["tab lock", state.lockedElsewhere ? "held by another tab" : "free / this tab"],
                    ["queued events", `${state.queued}`],
                    ["JS errors", `${state.errors}${state.killed ? " · KILLED" : ""}`],
                    ["prefill", Object.keys(state.prefill || {}).join(", ") || "none"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2 text-[10.5px]">
                      <span className="text-[#5d5867]">{k}</span><span className="text-[#c9c4b8] truncate">{v}</span>
                    </div>
                  ))}
                  {state.pops.map((p) => (
                    <div key={p.id} className="flex justify-between gap-2 text-[10.5px]">
                      <span className="text-[#5d5867]">{p.id} v{p.version}</span>
                      <span className="text-[#97919f]">{p.status}{p.order.length ? ` · ${p.index + 1}/${p.order.length}` : ""}</span>
                    </div>
                  ))}
                </div>
              )}
              {note && <p className="text-[10.5px] text-[#8fe3b0] leading-relaxed">{note}</p>}
              <div>
                <p className="text-[10px] tracking-[0.25em] uppercase text-[#5d5867] mb-2 flex items-center gap-1.5">
                  <Radio size={10} className="text-[#8fe3b0]" /> Lead delivery · worker log
                </p>
                <div className="space-y-1.5 max-h-[118px] overflow-y-auto pr-1">
                  {leads.length === 0 && <p className="text-[11px] text-[#5d5867]">No leads yet — submit a form in the Velvet or Corner pop.</p>}
                  {leads.map((l) => (
                    <div key={l.id} className="rounded-md bg-black/25 border border-line px-2.5 py-1.5 text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#8fe3b0] flex-none" />
                        <span className="text-[#c9c4b8] truncate flex-1">{mask(l.email)}</span>
                        <span className="text-[#8fe3b0] font-semibold flex-none">{l.http}</span>
                        <span className="text-[#5d5867] flex-none">{l.ms}ms</span>
                      </div>
                      <p className="text-[10px] text-[#5d5867] mt-1 truncate">
                        {l.kind === "hostpost" ? "POST → advertiser endpoint" : "Delivered → integration"}: {l.provider}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] tracking-[0.25em] uppercase text-[#5d5867] mb-2 flex items-center gap-1.5">
                  <Radio size={10} className="text-[#8b7cf0]" /> Tracked events · batched sendBeacon → /public/events
                </p>
                <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                  {events.length === 0 && <p className="text-[11px] text-[#5d5867]">No events yet — trigger a pop.</p>}
                  {events.map((e, i) => (
                    <div key={`${e.ts}-${i}`} className="flex items-center gap-2 text-[11px] rounded-md bg-black/25 border border-line px-2.5 py-1.5">
                      <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: EV_COLOR[e.type] ?? "#888" }} />
                      <span className="capitalize w-16 flex-none text-[#c9c4b8]">{e.type}</span>
                      <span className="truncate text-[#97919f] flex-1">{e.campaign || e.pop}</span>
                      <span className="text-[#5d5867] flex-none">{timeAgo(e.ts)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Link href="/" className="text-[11px] text-[#8b8794] hover:text-[#f0d9ae] transition flex items-center gap-1.5">
                <ArrowLeft size={11} /> Back to RevBounce
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
