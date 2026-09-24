"use client";
// §5.3 Pop Builder — 8-step vertical stepper, live preview (desktop/tablet/
// mobile), Pop Summary card, Save Draft / Save & Continue, publish + versions.
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Blocks, Check, Code2, Copy, Eye, GripVertical, History, Image as ImageIcon,
  Layers, Mail, Monitor, Palette, Rocket, Save, Settings2, ShieldCheck, Smartphone, SlidersHorizontal,
  Tablet, Target, Timer, TriangleAlert, Upload,
} from "lucide-react";
import { useStore } from "@/lib/store";
import {
  DEFAULT_DESIGN, DEFAULT_FREQUENCY, DEFAULT_INTEGRATIONS, DEFAULT_RULES, DEFAULT_TARGETING,
  POP_KINDS, SNIPPET_CODE,
} from "@/lib/data";
import { Badge, Modal, Toggle } from "@/components/ui";
import type { Pop, PopDesign, PopFrequency, PopIntegrations, PopRules, PopTargeting } from "@/lib/types";

const STEPS = [
  { id: 0, name: "General Settings", icon: Settings2, sub: "Name, copy, buttons, image" },
  { id: 1, name: "Design & Content", icon: Palette, sub: "Size, colors, animation, CSS" },
  { id: 2, name: "Campaigns (1–5)", icon: Layers, sub: "Sequence & ordering" },
  { id: 3, name: "Display Rules", icon: SlidersHorizontal, sub: "Trigger, delay, devices, URLs" },
  { id: 4, name: "Targeting", icon: Target, sub: "Geo, source, visitor, tech" },
  { id: 5, name: "Frequency", icon: Timer, sub: "Caps & cooldowns" },
  { id: 6, name: "Integrations", icon: Blocks, sub: "Pixels, webhooks, delivery" },
  { id: 7, name: "Preview & Save", icon: Rocket, sub: "Test, checklist, publish" },
];

const L = ({ children }: { children: React.ReactNode }) => (
  <label className="text-[10px] tracking-[0.22em] uppercase text-[#8b8794] block mb-1.5">{children}</label>
);
const Row = ({ children }: { children: React.ReactNode }) => <div className="grid sm:grid-cols-2 gap-4">{children}</div>;

const GEOS = ["US", "CA", "UK", "AU", "DE", "FR", "NL", "SG", "SE", "ES"];

export default function PopBuilder({ initial, isNew }: { initial: Pop; isNew: boolean }) {
  const store = useStore();
  const router = useRouter();
  const [p, setP] = useState<Pop>(initial);
  const [step, setStep] = useState(0);
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishNote, setPublishNote] = useState("");
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const set = (patch: Partial<Pop>) => setP({ ...p, ...patch });
  const design = p.design ?? DEFAULT_DESIGN;
  const rules = p.rules ?? DEFAULT_RULES;
  const targeting = p.targeting ?? DEFAULT_TARGETING;
  const frequency = p.frequency ?? DEFAULT_FREQUENCY;
  const integrations = p.integrations ?? DEFAULT_INTEGRATIONS;
  const setDesign = (d: Partial<PopDesign>) => set({ design: { ...design, ...d } });
  const setRules = (d: Partial<PopRules>) => set({ rules: { ...rules, ...d } });
  const setTgt = (d: Partial<PopTargeting>) => set({ targeting: { ...targeting, ...d } });
  const setFreq = (d: Partial<PopFrequency>) => set({ frequency: { ...frequency, ...d } });
  const setIntg = (d: Partial<PopIntegrations>) => set({ integrations: { ...integrations, ...d } });

  const isOffer = p.kind === "offer";
  const site = store.sites.find((s) => s.id === p.siteId);
  const activeCampaigns = useMemo(() => store.campaigns.filter((c) => c.status === "active"), [store.campaigns]);
  const seqCampaigns = p.campaignIds.map((id) => store.campaigns.find((c) => c.id === id)).filter(Boolean);

  // §5.3 validation / review checklist
  const checks = useMemo(() => [
    { label: "Pop name set", ok: !!p.name.trim() },
    { label: "Headline & subheadline written", ok: !!p.headline.trim() && !!p.sub.trim() },
    { label: "YES / NO button text set", ok: !!p.ctaText.trim() && !!(p.noText ?? "").trim() },
    { label: isOffer ? "At least 1 active campaign in sequence" : "Email delivery target chosen", ok: isOffer ? p.campaignIds.some((_, i) => (p.slotEnabled ?? [])[i] !== false) : !!integrations.emailProvider },
    { label: "At least one device targeted", ok: rules.devices.length > 0 },
    { label: "Frequency cap configured", ok: frequency.mode === "session" || frequency.cooldownHours > 0 || frequency.maxPerDay > 0 },
    { label: "Site selected", ok: !!p.siteId },
  ], [p, rules, frequency, integrations, isOffer]);
  const allOk = checks.every((c) => c.ok);

  const saveDraft = () => {
    store.savePop({ ...p, status: p.status === "active" ? "active" : "draft" });
    store.toast(`"${p.name}" saved as ${p.status === "active" ? "active" : "draft"}`);
    if (isNew) router.replace(`/dashboard/pops/${p.id}`);
  };
  const saveContinue = () => {
    store.savePop({ ...p, status: p.status === "active" ? "active" : "draft" });
    if (step < 7) setStep(step + 1);
    else setPublishOpen(true);
    if (isNew) router.replace(`/dashboard/pops/${p.id}`);
  };
  const doPublish = () => {
    store.publishPop(p, publishNote || `v${(p.version ?? 0) + 1} publish`);
    setP({ ...p, status: "active", version: (p.version ?? 0) + 1 });
    setPublishOpen(false);
    setPublishNote("");
    store.toast(`Published v${(p.version ?? 0) + 1} — live on next config fetch (60s TTL)`);
  };

  const previewW = device === "desktop" ? 560 : device === "tablet" ? 420 : 300;
  const previewH = device === "mobile" ? 440 : 360;
  const sizeScale = design.size === "S" ? 0.74 : design.size === "L" ? 0.98 : 0.86;

  /* ── live preview surface ─────────────────────────── */
  const Preview = () => (
    <div className="rounded-xl border border-line bg-[#0a0810] relative overflow-hidden mx-auto transition-all duration-300"
      style={{ width: previewW, height: previewH }}>
      {/* fake page */}
      <div className="p-4 space-y-2 select-none" aria-hidden>
        <div className="h-2.5 w-24 rounded bg-[#1c1827]" />
        <div className="h-4 w-3/4 rounded bg-[#241f30]" />
        <div className="h-2 w-full rounded bg-[#16131f]" /><div className="h-2 w-full rounded bg-[#16131f]" />
        <div className="h-14 w-full rounded bg-[#16131f]" /><div className="h-2 w-4/5 rounded bg-[#16131f]" />
      </div>
      {/* overlay */}
      <div className="absolute inset-0" style={{ background: design.overlayColor, opacity: design.overlayOpacity / 100 }} />
      {/* the pop */}
      <div className="absolute inset-0 flex items-center justify-center p-3">
        <div className="pop-in overflow-hidden shadow-pop border relative"
          style={{
            width: `${sizeScale * 100}%`, background: p.bg, borderColor: "rgba(232,211,168,.2)",
            borderRadius: design.radius, fontFamily: design.fontFamily.includes("serif") ? "Georgia, serif" : undefined,
          }}>
          {p.showCounter && isOffer && (
            <span className="absolute top-2 left-2.5 z-10 text-[8.5px] tracking-[0.2em] uppercase px-2 py-1 rounded-full"
              style={{ background: "rgba(0,0,0,.45)", color: p.accent }}>
              1 of {Math.max(1, p.campaignIds.length)}
            </span>
          )}
          <span className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
            style={{ background: design.closeStyle === "plain" ? "transparent" : "rgba(255,255,255,.08)", color: "#97919f" }}>✕</span>
          <div className={`flex ${p.imagePosition === "left" ? "flex-row" : p.imagePosition === "right" ? "flex-row-reverse" : "flex-col"}`}>
            {p.image && p.imagePosition !== "background" && (
              <div className={`${p.imagePosition === "top" ? "h-16 w-full" : "w-2/5 min-h-[130px]"} bg-cover bg-center flex-none`}
                style={{ backgroundImage: `url(${p.image})` }} />
            )}
            {p.image && p.imagePosition === "background" && (
              <div className="absolute inset-0 bg-cover bg-center opacity-25" style={{ backgroundImage: `url(${p.image})` }} />
            )}
            <div className="p-3.5 relative flex-1">
              <p className="font-display leading-tight" style={{ color: "#0b1b3a", fontWeight: 800, fontSize: device === "mobile" ? 13 : 15 }}>{p.headline || "Headline"}</p>
              <p className="text-[10px] mt-1 mb-2 leading-snug font-semibold" style={{ color: "#0066FF" }}>{p.sub || "Subheadline"}</p>
              {isOffer && <div className="rounded-lg text-[9px] py-2.5 mb-2.5 text-center" style={{ background: "#f3f7fd", border: "1px dashed #cfdcf0", color: "#8ea3c4" }}>Campaign 1 Content Will Appear Here</div>}
              {p.kind === "email-capture" ? (
                <div className="space-y-1.5">
                  <div className="rounded-md border px-2 py-1.5 text-[9px]" style={{ borderColor: "#e3eaf5", color: "#a8b8d4" }}>you@email.com</div>
                  <div className="rounded-full px-2.5 py-1.5 text-[9.5px] font-bold text-center" style={{ background: p.yesColor ?? "#0066FF", color: "#fff" }}>{p.ctaText || "Subscribe"}</div>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <span className="rounded-full px-2.5 py-1.5 text-[9.5px] font-bold flex-1 text-center" style={{ background: p.yesColor ?? "#0066FF", color: "#fff" }}>{p.ctaText || "YES"}</span>
                  <span className="rounded-full px-2.5 py-1.5 text-[9.5px] font-bold flex-1 text-center" style={{ background: p.noColor ?? "#FF2D2D", color: "#fff" }}>{p.noText || "NO"}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => router.push("/dashboard/pops")} className="btn-ghost rounded-xl px-3 py-2 text-xs flex items-center gap-1.5"><ArrowLeft size={13} /> All pops</button>
        <div>
          <h1 className="font-display text-2xl">{isNew ? "Create New Pop" : p.name}</h1>
          <p className="text-[11px] text-[#8b8794] mt-0.5">
            {POP_KINDS.find((k) => k.id === p.kind)?.name} · {site?.name ?? "no site"} · v{p.version ?? 0}
            {p.status === "active" ? " · live" : ` · ${p.status}`}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          {!isNew && (
            <button onClick={() => setVersionsOpen(true)} className="btn-ghost rounded-xl px-3.5 py-2.5 text-xs flex items-center gap-1.5"><History size={13} /> v{p.version ?? 0} history</button>
          )}
          <button onClick={saveDraft} className="btn-ghost rounded-xl px-4 py-2.5 text-sm flex items-center gap-2"><Save size={14} /> Save Draft</button>
          <button onClick={saveContinue} className="btn-gold rounded-xl px-4 py-2.5 text-sm flex items-center gap-2">
            {step < 7 ? <>Save &amp; Continue <ArrowRight size={14} /></> : <>Publish <Rocket size={14} /></>}
          </button>
        </div>
      </div>

      <div className="grid xl:grid-cols-[230px_1fr_330px] gap-5 items-start">
        {/* ── stepper ── */}
        <div className="glass rounded-2xl p-3 space-y-1 xl:sticky xl:top-24">
          {STEPS.map((s) => {
            const done = s.id < step;
            const active = s.id === step;
            return (
              <button key={s.id} onClick={() => setStep(s.id)}
                className={`w-full flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition border ${active ? "bg-[rgba(217,179,128,.12)] border-[rgba(217,179,128,.3)]" : "border-transparent hover:bg-white/[0.03]"}`}>
                <span className={`w-6 h-6 rounded-lg flex-none flex items-center justify-center text-[11px] font-bold ${active ? "bg-gradient-to-br from-[#eed9ac] to-[#b0824f] text-[#16110a]" : done ? "bg-[rgba(143,227,176,.15)] text-[#8fe3b0]" : "bg-[#1c1827] text-[#5d5867]"}`}>
                  {done ? <Check size={12} /> : s.id + 1}
                </span>
                <span className="min-w-0">
                  <span className={`block text-[12.5px] leading-tight ${active ? "text-[#f0d9ae]" : "text-[#c9c4b8]"}`}>{s.name}</span>
                  <span className="block text-[10px] text-[#5d5867] mt-0.5 truncate">{s.sub}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* ── step body ── */}
        <div className="glass rounded-2xl p-6 space-y-5 min-h-[520px]">
          <div className="flex items-center gap-2.5 pb-4 border-b border-line">
            {React.createElement(STEPS[step].icon, { size: 17, className: "text-[#d9b380]" })}
            <h2 className="font-display text-xl">{STEPS[step].name}</h2>
            <span className="ml-auto text-[11px] text-[#5d5867]">Step {step + 1} of 8</span>
          </div>

          {/* 1 — General */}
          {step === 0 && (
            <div className="space-y-4 fade-in">
              <Row>
                <div><L>Pop name *</L><input className="input-lux" value={p.name} onChange={(e) => set({ name: e.target.value })} placeholder="Exit — Travel Voucher" /></div>
                <div><L>Pop type</L>
                  <select className="input-lux" value={p.kind} onChange={(e) => set({ kind: e.target.value as Pop["kind"], campaignIds: e.target.value === "email-capture" ? [] : p.campaignIds })}>
                    {POP_KINDS.map((k) => <option key={k.id} value={k.id} disabled={!k.v1}>{k.name}{k.v1 ? "" : " — Phase 8"}</option>)}
                  </select></div>
              </Row>
              <div><L>Headline *</L><input className="input-lux" value={p.headline} onChange={(e) => set({ headline: e.target.value })} placeholder="ARE YOU STILL THERE?" /></div>
              <div><L>Subheadline *</L><input className="input-lux" value={p.sub} onChange={(e) => set({ sub: e.target.value })} placeholder="Exclusive Offers for You" /></div>
              <Row>
                <div><L>Yes button text *</L><input className="input-lux" value={p.ctaText} onChange={(e) => set({ ctaText: e.target.value })} placeholder="YES, SHOW ME" /></div>
                <div><L>No button text *</L><input className="input-lux" value={p.noText ?? ""} onChange={(e) => set({ noText: e.target.value })} placeholder="NO, THANKS" /></div>
                <div><L>Yes button color</L>
                  <div className="flex gap-2 items-center">
                    <input type="color" className="w-11 h-9 rounded-lg bg-transparent border border-line cursor-pointer" value={p.yesColor ?? "#0066FF"} onChange={(e) => set({ yesColor: e.target.value })} />
                    <input className="input-lux font-mono !text-xs" value={p.yesColor ?? "#0066FF"} onChange={(e) => set({ yesColor: e.target.value })} />
                  </div></div>
                <div><L>No button color</L>
                  <div className="flex gap-2 items-center">
                    <input type="color" className="w-11 h-9 rounded-lg bg-transparent border border-line cursor-pointer" value={p.noColor ?? "#FF2D2D"} onChange={(e) => set({ noColor: e.target.value })} />
                    <input className="input-lux font-mono !text-xs" value={p.noColor ?? "#FF2D2D"} onChange={(e) => set({ noColor: e.target.value })} />
                  </div></div>
              </Row>
              <div>
                <L>Pop image (600×200 recommended · JPG / PNG / GIF)</L>
                <div onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) { set({ image: URL.createObjectURL(f) }); store.toast(`"${f.name}" attached to this pop`); } }}
                  className="rounded-xl border border-dashed border-line hover:border-[rgba(217,179,128,.4)] transition p-4 flex items-center gap-4">
                  {p.image ? <img src={p.image} alt="" className="w-24 h-12 object-cover rounded-lg flex-none" /> : <span className="w-24 h-12 rounded-lg bg-[#16131f] flex items-center justify-center text-[#5d5867] flex-none"><ImageIcon size={16} /></span>}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#c9c4b8] flex items-center gap-1.5"><Upload size={12} className="text-[#d9b380]" /> Drag &amp; drop an image here, or paste a URL below</p>
                    <input className="input-lux !py-1.5 !text-xs mt-2" value={p.image} onChange={(e) => set({ image: e.target.value })} placeholder="https://images.unsplash.com/…" />
                  </div>
                </div>
              </div>
              <Row>
                <div><L>Image position</L>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(["top", "left", "right", "background"] as const).map((ip) => (
                      <button key={ip} type="button" onClick={() => set({ imagePosition: ip })}
                        className={`rounded-lg border py-2 text-[11px] capitalize transition ${p.imagePosition === ip ? "border-[rgba(217,179,128,.55)] bg-[rgba(217,179,128,.08)] text-[#f0d9ae]" : "border-line text-[#8b8794]"}`}>{ip}</button>
                    ))}
                  </div></div>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3"><Toggle on={!!p.showCounter} onChange={(v) => set({ showCounter: v })} label="counter" /><span className="text-xs text-[#c9c4b8]">Show Campaign Counter (&ldquo;1 of 5&rdquo;)</span></div>
                  <div className="flex items-center gap-3"><Toggle on={p.closeOnYes !== false} onChange={(v) => set({ closeOnYes: v })} label="close yes" /><span className="text-xs text-[#c9c4b8]">Close on Yes click</span></div>
                  <div className="flex items-center gap-3"><Toggle on={p.closeOnFinalNo !== false} onChange={(v) => set({ closeOnFinalNo: v })} label="close no" /><span className="text-xs text-[#c9c4b8]">Close on Final No</span></div>
                </div>
              </Row>
            </div>
          )}

          {/* 2 — Design */}
          {step === 1 && (
            <div className="space-y-4 fade-in">
              <Row>
                <div><L>Pop size</L>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(["S", "M", "L", "custom"] as const).map((sz) => (
                      <button key={sz} type="button" onClick={() => setDesign({ size: sz })}
                        className={`rounded-lg border py-2 text-[11px] transition ${design.size === sz ? "border-[rgba(217,179,128,.55)] bg-[rgba(217,179,128,.08)] text-[#f0d9ae]" : "border-line text-[#8b8794]"}`}>{sz}</button>
                    ))}
                  </div></div>
                <div><L>Custom width (px)</L>
                  <input className="input-lux" type="number" min={280} max={1200} value={design.customWidth} disabled={design.size !== "custom"} onChange={(e) => setDesign({ customWidth: +e.target.value })} /></div>
                <div><L>Font</L>
                  <select className="input-lux" value={design.fontFamily} onChange={(e) => setDesign({ fontFamily: e.target.value })}>
                    <option>System sans</option><option>Editorial serif</option><option>Geometric sans</option><option>Monospace</option>
                  </select></div>
                <div><L>Border radius: {design.radius}px</L>
                  <input type="range" min={0} max={40} value={design.radius} className="lux-range" style={{ ["--pct" as string]: `${(design.radius / 40) * 100}%` }} onChange={(e) => setDesign({ radius: +e.target.value })} /></div>
                <div><L>Surface color</L>
                  <div className="flex gap-2"><input type="color" className="w-11 h-9 rounded-lg bg-transparent border border-line" value={p.bg} onChange={(e) => set({ bg: e.target.value })} /><input className="input-lux font-mono !text-xs" value={p.bg} onChange={(e) => set({ bg: e.target.value })} /></div></div>
                <div><L>Accent color</L>
                  <div className="flex gap-2"><input type="color" className="w-11 h-9 rounded-lg bg-transparent border border-line" value={p.accent} onChange={(e) => set({ accent: e.target.value })} /><input className="input-lux font-mono !text-xs" value={p.accent} onChange={(e) => set({ accent: e.target.value })} /></div></div>
                <div><L>Overlay color</L>
                  <div className="flex gap-2"><input type="color" className="w-11 h-9 rounded-lg bg-transparent border border-line" value={design.overlayColor} onChange={(e) => setDesign({ overlayColor: e.target.value })} /><input className="input-lux font-mono !text-xs" value={design.overlayColor} onChange={(e) => setDesign({ overlayColor: e.target.value })} /></div></div>
                <div><L>Overlay opacity: {design.overlayOpacity}%</L>
                  <input type="range" min={0} max={95} value={design.overlayOpacity} className="lux-range" style={{ ["--pct" as string]: `${(design.overlayOpacity / 95) * 100}%` }} onChange={(e) => setDesign({ overlayOpacity: +e.target.value })} /></div>
                <div><L>Animation</L>
                  <select className="input-lux" value={design.animation} onChange={(e) => setDesign({ animation: e.target.value as PopDesign["animation"] })}>
                    <option value="fade">Fade</option><option value="slide">Slide</option><option value="zoom">Zoom</option>
                  </select></div>
                <div><L>Close-X style</L>
                  <select className="input-lux" value={design.closeStyle} onChange={(e) => setDesign({ closeStyle: e.target.value as PopDesign["closeStyle"] })}>
                    <option value="circle">Circle</option><option value="plain">Plain</option><option value="outside">Outside corner</option>
                  </select></div>
                <div><L>Success message color</L>
                  <div className="flex gap-2"><input type="color" className="w-11 h-9 rounded-lg bg-transparent border border-line" value={design.successColor} onChange={(e) => setDesign({ successColor: e.target.value })} /><input className="input-lux font-mono !text-xs" value={design.successColor} onChange={(e) => setDesign({ successColor: e.target.value })} /></div></div>
                <div><L>Error message color</L>
                  <div className="flex gap-2"><input type="color" className="w-11 h-9 rounded-lg bg-transparent border border-line" value={design.errorColor} onChange={(e) => setDesign({ errorColor: e.target.value })} /><input className="input-lux font-mono !text-xs" value={design.errorColor} onChange={(e) => setDesign({ errorColor: e.target.value })} /></div></div>
              </Row>
              <div><L>Custom CSS (sanitized — scoped inside the Shadow DOM)</L>
                <textarea className="input-lux font-mono !text-xs" rows={3} value={design.customCss} onChange={(e) => setDesign({ customCss: e.target.value })} placeholder=".rb-headline { letter-spacing: .02em; }" />
                <p className="text-[10.5px] text-[#5d5867] mt-1.5">Script tags, url() imports and @import are stripped server-side before the config is served.</p></div>
            </div>
          )}

          {/* 3 — Campaigns */}
          {step === 2 && (
            <div className="space-y-4 fade-in">
              {!isOffer ? (
                <div className="rounded-xl border border-[rgba(139,124,240,.3)] bg-[rgba(139,124,240,.06)] p-5">
                  <p className="text-sm font-semibold mb-1.5">Email Capture pops don&rsquo;t use the campaign sequence</p>
                  <p className="text-xs text-[#a49ea8] leading-relaxed">Per §5.3 this type shows a single email form. Configure where captured addresses go in <b className="text-[#c9c4b8]">Step 7 · Integrations</b>.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-[#8b8794]">Pick 1–5 campaigns. Drag to reorder — visitors see them in sequence, and capped campaigns are auto-skipped.</p>
                  <div className="space-y-2">
                    {p.campaignIds.map((id, i) => {
                      const c = store.campaigns.find((x) => x.id === id);
                      const enabled = (p.slotEnabled ?? [])[i] !== false;
                      return (
                        <div key={id} draggable
                          onDragStart={() => setDragIdx(i)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (dragIdx === null || dragIdx === i) return;
                            const ids = [...p.campaignIds]; const en = [...(p.slotEnabled ?? ids.map(() => true))];
                            const [mi] = ids.splice(dragIdx, 1); const [me] = en.splice(dragIdx, 1);
                            ids.splice(i, 0, mi); en.splice(i, 0, me);
                            set({ campaignIds: ids, slotEnabled: en, campaignId: ids[0] ?? null });
                            setDragIdx(null);
                          }}
                          className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-grab active:cursor-grabbing transition ${enabled ? "border-line" : "border-line opacity-50"} hover:border-[rgba(217,179,128,.35)]`}>
                          <GripVertical size={14} className="text-[#5d5867] flex-none" />
                          <span className="w-6 h-6 rounded-lg bg-[rgba(217,179,128,.14)] text-[#f0d9ae] text-[11px] font-bold flex items-center justify-center flex-none">{i + 1}</span>
                          {c?.image && <img src={c.image} alt="" className="w-9 h-9 rounded-lg object-cover flex-none" />}
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] truncate">{c?.name ?? id}</p>
                            <p className="text-[10.5px] text-[#8b8794]">{c?.payoutModel} ${c?.payout} · EPC ${c?.epc} · w{c?.weight ?? 50}</p>
                          </div>
                          <Toggle on={enabled} onChange={(v) => { const en = [...(p.slotEnabled ?? p.campaignIds.map(() => true))]; en[i] = v; set({ slotEnabled: en }); }} label="slot" />
                          <button onClick={() => {
                            const ids = p.campaignIds.filter((_, x) => x !== i);
                            const en = (p.slotEnabled ?? []).filter((_, x) => x !== i);
                            set({ campaignIds: ids, slotEnabled: en, campaignId: ids[0] ?? null });
                          }} className="p-1.5 text-[#5d5867] hover:text-[#f0a0a8] transition flex-none" aria-label="Remove slot">✕</button>
                        </div>
                      );
                    })}
                  </div>
                  {p.campaignIds.length === 0 && (
                    <p className="text-[11px] text-[#f0a0a8] flex items-center gap-1.5"><TriangleAlert size={12} /> At least 1 active campaign is required to publish.</p>
                  )}
                  {p.campaignIds.length < 5 && (
                    <div>
                      <L>Add from library ({p.campaignIds.length}/5 used)</L>
                      <div className="grid sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                        {activeCampaigns.filter((c) => !p.campaignIds.includes(c.id)).map((c) => (
                          <button key={c.id} onClick={() => set({ campaignIds: [...p.campaignIds, c.id], slotEnabled: [...(p.slotEnabled ?? []), true], campaignId: p.campaignIds[0] ?? c.id })}
                            className="flex items-center gap-2.5 rounded-xl border border-line px-3 py-2 text-left hover:border-[rgba(217,179,128,.35)] transition">
                            <span className="text-[#d9b380] text-sm flex-none">+</span>
                            <span className="min-w-0"><span className="block text-[12px] truncate">{c.name}</span><span className="block text-[10px] text-[#8b8794]">{c.payoutModel} ${c.payout}</span></span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* 4 — Display rules */}
          {step === 3 && (
            <div className="space-y-4 fade-in">
              <Row>
                <div><L>Trigger type</L>
                  <div className="grid grid-cols-2 gap-2">
                    {(["exit", "idle"] as const).map((t) => (
                      <button key={t} onClick={() => setRules({ trigger: t })}
                        className={`rounded-xl border py-2.5 text-xs capitalize transition ${rules.trigger === t ? "border-[rgba(217,179,128,.55)] bg-[rgba(217,179,128,.08)] text-[#f0d9ae]" : "border-line text-[#8b8794]"}`}>
                        {t === "exit" ? "Exit Intent" : "Idle / Inactivity"}
                      </button>
                    ))}
                  </div></div>
                <div><L>Minimum page-load delay: {rules.loadDelay}s</L>
                  <input type="range" min={0} max={30} value={rules.loadDelay} className="lux-range" style={{ ["--pct" as string]: `${(rules.loadDelay / 30) * 100}%` }} onChange={(e) => setRules({ loadDelay: +e.target.value })} /></div>
                <div><L>Idle seconds: {rules.idleSeconds}s</L>
                  <input type="range" min={5} max={180} value={rules.idleSeconds} className="lux-range" disabled={rules.trigger !== "idle"} style={{ ["--pct" as string]: `${((rules.idleSeconds - 5) / 175) * 100}%` }} onChange={(e) => setRules({ idleSeconds: +e.target.value })} /></div>
                <div><L>Mobile exit fallback</L>
                  <select className="input-lux" value={rules.mobileFallback} onChange={(e) => setRules({ mobileFallback: e.target.value as PopRules["mobileFallback"] })}>
                    <option value="back-button">Back-button intercept</option><option value="scroll-up">Fast scroll-up</option><option value="timer">Timer fallback</option><option value="none">None</option>
                  </select></div>
              </Row>
              <div><L>Device targeting</L>
                <div className="grid grid-cols-3 gap-2">
                  {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([d, Icon]) => {
                    const on = rules.devices.includes(d);
                    return (
                      <button key={d} onClick={() => setRules({ devices: on ? rules.devices.filter((x) => x !== d) : [...rules.devices, d] })}
                        className={`rounded-xl border py-2.5 flex items-center justify-center gap-2 text-xs capitalize transition ${on ? "border-[rgba(217,179,128,.55)] bg-[rgba(217,179,128,.08)] text-[#f0d9ae]" : "border-line text-[#8b8794]"}`}>
                        <Icon size={14} /> {d}
                      </button>
                    );
                  })}
                </div></div>
              <Row>
                <div><L>Include paths (wildcard / regex, one per line)</L>
                  <textarea className="input-lux font-mono !text-xs" rows={3} value={rules.includePaths} onChange={(e) => setRules({ includePaths: e.target.value })} placeholder={"/*\n/journal/*"} /></div>
                <div><L>Exclude paths</L>
                  <textarea className="input-lux font-mono !text-xs" rows={3} value={rules.excludePaths} onChange={(e) => setRules({ excludePaths: e.target.value })} placeholder={"/checkout/*\n/account/*"} /></div>
              </Row>
              <div className="rounded-xl border border-line bg-black/20 px-4 py-3 flex items-center gap-3">
                <span className="text-[11px] text-[#5d5867] flex-1">Page-count rule (&ldquo;show after N pageviews&rdquo;) — reserved for a future release.</span>
                <Badge tone="mute">SOON</Badge>
              </div>
            </div>
          )}

          {/* 5 — Targeting */}
          {step === 4 && (
            <div className="space-y-4 fade-in">
              <div><L>Country / region</L>
                <div className="flex flex-wrap gap-1.5">
                  {GEOS.map((g) => {
                    const on = targeting.countries.includes(g);
                    return (
                      <button key={g} onClick={() => setTgt({ countries: on ? targeting.countries.filter((x) => x !== g) : [...targeting.countries, g] })}
                        className={`chip transition ${on ? "text-[#f0d9ae] border-[rgba(217,179,128,.5)] bg-[rgba(217,179,128,.09)]" : "text-[#8b8794] hover:text-white"}`}>{g}</button>
                    );
                  })}
                </div>
                <p className="text-[10.5px] text-[#5d5867] mt-1.5">{targeting.countries.length === 0 ? "No geos selected — pop serves worldwide." : `${targeting.countries.length} geos selected.`}</p></div>
              <Row>
                <div><L>Traffic source (UTM / referrer)</L>
                  <select className="input-lux" value={targeting.trafficSource} onChange={(e) => setTgt({ trafficSource: e.target.value as PopTargeting["trafficSource"] })}>
                    <option value="all">All sources</option><option value="direct">Direct</option><option value="search">Organic search</option><option value="social">Social</option><option value="email">Email</option><option value="paid">Paid / UTM tagged</option>
                  </select></div>
                <div><L>Visitor</L>
                  <select className="input-lux" value={targeting.visitor} onChange={(e) => setTgt({ visitor: e.target.value as PopTargeting["visitor"] })}>
                    <option value="all">New &amp; returning</option><option value="new">New only</option><option value="returning">Returning only</option>
                  </select></div>
                <div><L>Language</L>
                  <select className="input-lux" value={targeting.language} onChange={(e) => setTgt({ language: e.target.value })}>
                    <option value="any">Any</option><option>en</option><option>de</option><option>fr</option><option>es</option><option>sv</option>
                  </select></div>
                <div><L>Browser</L>
                  <select className="input-lux" value={targeting.browser} onChange={(e) => setTgt({ browser: e.target.value })}>
                    <option value="any">Any</option><option>Chrome</option><option>Safari</option><option>Firefox</option><option>Edge</option>
                  </select></div>
                <div><L>Operating system</L>
                  <select className="input-lux" value={targeting.os} onChange={(e) => setTgt({ os: e.target.value })}>
                    <option value="any">Any</option><option>macOS</option><option>Windows</option><option>iOS</option><option>Android</option><option>Linux</option>
                  </select></div>
              </Row>
            </div>
          )}

          {/* 6 — Frequency */}
          {step === 5 && (
            <div className="space-y-4 fade-in">
              <div><L>Frequency mode</L>
                <div className="grid sm:grid-cols-3 gap-2">
                  {([["session", "Once per session"], ["cooldown", "Once per X hours"], ["max", "Max N per visitor"]] as const).map(([m, l]) => (
                    <button key={m} onClick={() => setFreq({ mode: m })}
                      className={`rounded-xl border py-3 px-3 text-xs transition ${frequency.mode === m ? "border-[rgba(217,179,128,.55)] bg-[rgba(217,179,128,.08)] text-[#f0d9ae]" : "border-line text-[#8b8794]"}`}>{l}</button>
                  ))}
                </div></div>
              <Row>
                <div><L>Cooldown: {frequency.cooldownHours}h</L>
                  <input type="range" min={1} max={168} value={frequency.cooldownHours} className="lux-range" disabled={frequency.mode !== "cooldown"} style={{ ["--pct" as string]: `${(frequency.cooldownHours / 168) * 100}%` }} onChange={(e) => setFreq({ cooldownHours: +e.target.value })} /></div>
                <div><L>Max displays / visitor / day</L>
                  <input className="input-lux" type="number" min={1} max={20} value={frequency.maxPerDay} onChange={(e) => setFreq({ maxPerDay: +e.target.value || 1 })} /></div>
                <div><L>Max lifetime displays / visitor</L>
                  <input className="input-lux" type="number" min={1} max={200} value={frequency.maxLifetime} onChange={(e) => setFreq({ maxLifetime: +e.target.value || 1 })} /></div>
              </Row>
              <div className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
                <Toggle on={frequency.closeCountsAsDisplay} onChange={(v) => setFreq({ closeCountsAsDisplay: v })} label="close counts" />
                <div><p className="text-xs text-[#c9c4b8]">Closing counts as a display</p><p className="text-[10.5px] text-[#5d5867]">Recommended. The engine also enforces &ldquo;never immediate reopen&rdquo; within a pageview, always.</p></div>
              </div>
              <div className="rounded-xl bg-black/25 border border-line p-4 text-[11px] text-[#8b8794] leading-relaxed">
                Effective rule: <b className="text-[#c9c4b8]">
                  {frequency.mode === "session" ? "one display per session" : frequency.mode === "cooldown" ? `1 display per ${frequency.cooldownHours}h` : `max ${frequency.maxPerDay}/day, ${frequency.maxLifetime} lifetime`}
                </b>{frequency.closeCountsAsDisplay ? ", closes included" : ", closes excluded"}.
              </div>
            </div>
          )}

          {/* 7 — Integrations */}
          {step === 6 && (
            <div className="space-y-4 fade-in">
              <Row>
                <div><L>Facebook pixel ID</L><input className="input-lux font-mono !text-xs" value={integrations.fbPixel} onChange={(e) => setIntg({ fbPixel: e.target.value })} placeholder="418822901" /></div>
                <div><L>GA4 measurement ID</L><input className="input-lux font-mono !text-xs" value={integrations.gaId} onChange={(e) => setIntg({ gaId: e.target.value })} placeholder="G-XXXXXXX" /></div>
                <div><L>GTM container</L><input className="input-lux font-mono !text-xs" value={integrations.gtmId} onChange={(e) => setIntg({ gtmId: e.target.value })} placeholder="GTM-XXXXXX" /></div>
                <div><L>Fire event on</L>
                  <select className="input-lux" value={integrations.fireOn} onChange={(e) => setIntg({ fireOn: e.target.value as PopIntegrations["fireOn"] })}>
                    <option value="impression">Impression only</option><option value="yes">YES click only</option><option value="both">Impression + YES</option>
                  </select></div>
              </Row>
              <div><L>Webhook URL (per event, server-to-server)</L>
                <input className="input-lux font-mono !text-xs" value={integrations.webhookUrl} onChange={(e) => setIntg({ webhookUrl: e.target.value })} placeholder="https://hooks.yoursite.com/revbounce" /></div>
              <Row>
                <div><L>Everflow postback URL</L><input className="input-lux font-mono !text-xs" value={integrations.everflowUrl} onChange={(e) => setIntg({ everflowUrl: e.target.value })} placeholder="https://www.ef.com/?nid=&transaction_id={click_id}" /></div>
                <div><L>Twyne postback URL</L><input className="input-lux font-mono !text-xs" value={integrations.twyneUrl} onChange={(e) => setIntg({ twyneUrl: e.target.value })} placeholder="https://twyne.example/pb?cid={click_id}" /></div>
              </Row>
              <div className="rounded-xl border border-line p-4 space-y-3">
                <p className="text-xs font-semibold flex items-center gap-2"><ShieldCheck size={13} className="text-[#8fe3b0]" /> Email-capture delivery (Section 6)</p>
                <Row>
                  <div><L>Provider</L>
                    <select className="input-lux" value={integrations.emailProvider} onChange={(e) => setIntg({ emailProvider: e.target.value })}>
                      {store.integrations.filter((i) => i.category === "Email").map((i) => <option key={i.id} value={i.id}>{i.name}{i.connected ? "" : " (not connected)"}</option>)}
                      <option value="ftp">FTP / SFTP CSV batch</option>
                    </select></div>
                  <div><L>List / audience ID</L><input className="input-lux font-mono !text-xs" value={integrations.emailListId} onChange={(e) => setIntg({ emailListId: e.target.value })} placeholder="aud_9921" /></div>
                </Row>
                <div><L>Form pre-fill mapping (Section 8)</L>
                  <input className="input-lux font-mono !text-xs" value={integrations.prefillMapping} onChange={(e) => setIntg({ prefillMapping: e.target.value })} placeholder="email→{email}, zip→{zip}" /></div>
                <p className="text-[10.5px] text-[#5d5867]">Keys and endpoints are stored server-side and never appear in the published snippet.</p>
              </div>

              {/* §6 — full email-capture delivery config */}
              {p.kind === "email-capture" && (() => {
                const ec = store.emailConfig;
                return (
                  <div className="rounded-xl border border-[rgba(217,179,128,.3)] bg-[rgba(217,179,128,.04)] p-4 space-y-4">
                    <p className="text-xs font-semibold flex items-center gap-2"><Mail size={13} className="text-[#d9b380]" /> Email Capture behaviour (§6)</p>
                    <Row>
                      <div><L>Success message</L><input className="input-lux" value={ec.successMessage} onChange={(e) => store.setEmailConfig({ successMessage: e.target.value })} /></div>
                      <div><L>&ldquo;Already subscribed&rdquo; message</L><input className="input-lux" value={ec.duplicateMessage} onChange={(e) => store.setEmailConfig({ duplicateMessage: e.target.value })} /></div>
                      <div><L>Duplicate rule</L>
                        <select className="input-lux" value={ec.duplicateRule} onChange={(e) => store.setEmailConfig({ duplicateRule: e.target.value as typeof ec.duplicateRule })}>
                          <option value="allow">Allow duplicates</option>
                          <option value="block-site">Block per site</option>
                          <option value="block-pop">Block per pop</option>
                          <option value="block-pop-days">Block per pop within X days</option>
                        </select></div>
                      <div><L>Duplicate window (days)</L>
                        <input className="input-lux" type="number" min={1} max={365} value={ec.duplicateDays} disabled={ec.duplicateRule !== "block-pop-days"} onChange={(e) => store.setEmailConfig({ duplicateDays: +e.target.value })} /></div>
                    </Row>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {([["closeAfterSuccess", "Close after success"], ["checkMx", "MX record check"], ["blockDisposable", "Block disposable domains"], ["requireConsent", "Require consent checkbox"]] as const).map(([k, label]) => (
                        <div key={k} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
                          <Toggle on={!!ec[k]} onChange={(v) => store.setEmailConfig({ [k]: v })} label={label} />
                          <span className="text-[11.5px] text-[#c9c4b8]">{label}</span>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-lg border border-line p-3.5 space-y-3">
                      <p className="text-[11px] font-semibold text-[#c9c4b8]">Real-time API delivery</p>
                      <Row>
                        <div><L>Endpoint</L><input className="input-lux font-mono !text-xs" value={ec.api.endpoint} onChange={(e) => store.setEmailConfig({ api: { ...ec.api, endpoint: e.target.value } })} /></div>
                        <div><L>Auth</L>
                          <div className="flex gap-2">
                            <select className="input-lux !w-[100px]" value={ec.api.authType} onChange={(e) => store.setEmailConfig({ api: { ...ec.api, authType: e.target.value as typeof ec.api.authType } })}>
                              <option value="none">none</option><option value="apikey">API key</option><option value="bearer">Bearer</option><option value="basic">Basic</option>
                            </select>
                            <input className="input-lux !text-xs" type="password" value={ec.api.authValue} onChange={(e) => store.setEmailConfig({ api: { ...ec.api, authValue: e.target.value } })} />
                          </div></div>
                        <div><L>Max retries (exp. backoff, cap 5)</L>
                          <input className="input-lux" type="number" min={0} max={5} value={ec.api.maxRetries} onChange={(e) => store.setEmailConfig({ api: { ...ec.api, maxRetries: Math.min(5, +e.target.value) } })} /></div>
                        <div><L>Custom headers</L>
                          <input className="input-lux font-mono !text-xs" value={ec.api.headers} onChange={(e) => store.setEmailConfig({ api: { ...ec.api, headers: e.target.value } })} /></div>
                      </Row>
                      <div>
                        <L>Field mapping</L>
                        <div className="flex flex-wrap gap-1.5">
                          {ec.api.mapping.map((m) => (
                            <span key={m.field} className="chip text-[#c9c4b8] font-mono">{m.field} → {m.param}</span>
                          ))}
                        </div>
                        <p className="text-[10px] text-[#5d5867] mt-1.5">Available: email, timestamp, site_id, pop_id, device, trigger, source</p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-line p-3.5 space-y-3">
                      <div className="flex items-center gap-3">
                        <Toggle on={ec.ftp.enabled} onChange={(v) => store.setEmailConfig({ ftp: { ...ec.ftp, enabled: v } })} label="ftp" />
                        <p className="text-[11px] font-semibold text-[#c9c4b8]">FTP / SFTP CSV delivery</p>
                        <Badge tone="gold">AES-256-GCM at rest</Badge>
                      </div>
                      {ec.ftp.enabled && (
                        <Row>
                          <div><L>Protocol</L>
                            <select className="input-lux" value={ec.ftp.protocol} onChange={(e) => store.setEmailConfig({ ftp: { ...ec.ftp, protocol: e.target.value as "ftp" | "sftp" } })}>
                              <option value="sftp">SFTP</option><option value="ftp">FTP</option>
                            </select></div>
                          <div><L>Host : port</L>
                            <div className="flex gap-2">
                              <input className="input-lux font-mono !text-xs" value={ec.ftp.host} onChange={(e) => store.setEmailConfig({ ftp: { ...ec.ftp, host: e.target.value } })} />
                              <input className="input-lux !w-20" type="number" value={ec.ftp.port} onChange={(e) => store.setEmailConfig({ ftp: { ...ec.ftp, port: +e.target.value } })} />
                            </div></div>
                          <div><L>Username</L><input className="input-lux" value={ec.ftp.username} onChange={(e) => store.setEmailConfig({ ftp: { ...ec.ftp, username: e.target.value } })} /></div>
                          <div><L>{ec.ftp.useKey ? "SSH key (encrypted)" : "Password (encrypted)"}</L>
                            <div className="flex gap-2 items-center">
                              <input className="input-lux !text-xs" type="password" value={ec.ftp.password} onChange={(e) => store.setEmailConfig({ ftp: { ...ec.ftp, password: e.target.value } })} />
                              <button type="button" onClick={() => store.setEmailConfig({ ftp: { ...ec.ftp, useKey: !ec.ftp.useKey } })} className="btn-ghost rounded-lg px-2.5 py-2 text-[10px] whitespace-nowrap">{ec.ftp.useKey ? "use password" : "use SSH key"}</button>
                            </div></div>
                          <div><L>Remote path</L><input className="input-lux font-mono !text-xs" value={ec.ftp.remotePath} onChange={(e) => store.setEmailConfig({ ftp: { ...ec.ftp, remotePath: e.target.value } })} /></div>
                          <div><L>Filename pattern</L><input className="input-lux font-mono !text-xs" value={ec.ftp.filenamePattern} onChange={(e) => store.setEmailConfig({ ftp: { ...ec.ftp, filenamePattern: e.target.value } })} /></div>
                          <div><L>Frequency</L>
                            <select className="input-lux" value={ec.ftp.frequency} onChange={(e) => store.setEmailConfig({ ftp: { ...ec.ftp, frequency: e.target.value as typeof ec.ftp.frequency } })}>
                              <option value="realtime">Real-time file per record</option><option value="hourly">Hourly batch</option><option value="daily">Daily batch</option>
                            </select></div>
                        </Row>
                      )}
                    </div>
                    <p className="text-[10.5px] text-[#5d5867]">Leads are stored even when a delivery fails — retry any failure from <b className="text-[#8b8794]">Email Records</b>.</p>
                  </div>
                );
              })()}
            </div>
          )}

          {/* 8 — Preview & Save */}
          {step === 7 && (
            <div className="space-y-4 fade-in">
              <div className="rounded-xl border border-line p-4">
                <p className="text-xs font-semibold mb-2 flex items-center gap-2"><Eye size={13} className="text-[#d9b380]" /> Full test mode</p>
                <p className="text-[11px] text-[#8b8794] mb-3 leading-relaxed">Loads this pop on your real site with a preview token. No events are counted, frequency caps are bypassed.</p>
                <div className="rounded-lg bg-black/40 border border-line px-3 py-2.5 flex items-center gap-2">
                  <code className="text-[11px] text-[#e8cf9f] break-all flex-1">https://{site?.url ?? "yoursite.com"}/?revbounce_preview={p.id}</code>
                  <button onClick={() => { try { navigator.clipboard.writeText(`https://${site?.url ?? "yoursite.com"}/?revbounce_preview=${p.id}`); } catch { } store.toast("Preview URL copied"); }}
                    className="text-[#8b8794] hover:text-white transition flex-none" aria-label="Copy preview URL"><Copy size={13} /></button>
                </div>
                <a href={`/demo-site?revbounce_preview=${p.id}`} target="_blank" rel="noreferrer"
                  className="btn-ghost rounded-lg px-3.5 py-2 text-[11px] mt-3 inline-flex items-center gap-1.5">
                  <Eye size={12} className="text-[#d9b380]" /> Open in sandbox
                </a>
              </div>

              <div className="rounded-xl border border-line p-4">
                <p className="text-xs font-semibold mb-3">Review checklist</p>
                <div className="space-y-1.5">
                  {checks.map((c) => (
                    <div key={c.label} className="flex items-center gap-2.5 text-xs">
                      <span className={`w-4 h-4 rounded flex items-center justify-center flex-none ${c.ok ? "bg-[rgba(143,227,176,.18)] text-[#8fe3b0]" : "bg-[rgba(240,160,168,.15)] text-[#f0a0a8]"}`}>
                        {c.ok ? <Check size={11} /> : <TriangleAlert size={10} />}
                      </span>
                      <span className={c.ok ? "text-[#c9c4b8]" : "text-[#f0a0a8]"}>{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-line p-4">
                <p className="text-xs font-semibold mb-2 flex items-center gap-2"><Code2 size={13} className="text-[#d9b380]" /> Install snippet &amp; verification</p>
                <div className="rounded-lg bg-black/40 border border-line px-3 py-2.5 flex items-center gap-2">
                  <code className="text-[11px] text-[#e8cf9f] break-all flex-1">{SNIPPET_CODE(site?.siteKey ?? "rb_demo")}</code>
                  <button onClick={() => { try { navigator.clipboard.writeText(SNIPPET_CODE(site?.siteKey ?? "rb_demo")); } catch { } setCopied(true); setTimeout(() => setCopied(false), 1600); }}
                    className="text-[#8b8794] hover:text-white transition flex-none" aria-label="Copy snippet">{copied ? <Check size={13} className="text-[#8fe3b0]" /> : <Copy size={13} />}</button>
                </div>
                <p className="text-[11px] mt-2.5 flex items-center gap-1.5">
                  Snippet detected on site:
                  <b className={site?.verified ? "text-[#8fe3b0]" : "text-[#f0a0a8]"}>{site?.verified ? "yes" : "no"}</b>
                  {!site?.verified && (
                    <button onClick={() => { if (site) { store.verifySite(site.id); store.toast("Snippet detected — site verified"); } }}
                      className="text-[#d9b380] hover:text-white transition underline underline-offset-2">re-check</button>
                  )}
                </p>
              </div>

              <button onClick={() => setPublishOpen(true)} disabled={!allOk}
                className="btn-gold rounded-xl w-full py-3.5 text-sm flex items-center justify-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed">
                <Rocket size={15} /> {allOk ? `Publish v${(p.version ?? 0) + 1}` : "Resolve checklist to publish"}
              </button>
            </div>
          )}

          {/* step nav */}
          <div className="flex gap-3 pt-4 border-t border-line">
            <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
              className="btn-ghost rounded-xl px-4 py-2.5 text-sm disabled:opacity-40 flex items-center gap-2"><ArrowLeft size={14} /> Back</button>
            <button onClick={saveDraft} className="btn-ghost rounded-xl px-4 py-2.5 text-sm flex items-center gap-2"><Save size={14} /> Save Draft</button>
            <button onClick={saveContinue} className="btn-gold rounded-xl px-5 py-2.5 text-sm flex-1 flex items-center justify-center gap-2">
              {step < 7 ? <>Save &amp; Continue <ArrowRight size={14} /></> : <>Publish <Rocket size={14} /></>}
            </button>
          </div>
        </div>

        {/* ── live preview + summary ── */}
        <div className="space-y-4 xl:sticky xl:top-24">
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] tracking-[0.22em] uppercase text-[#8b8794]">Live Preview</p>
              <div className="flex gap-1">
                {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([d, Icon]) => (
                  <button key={d} onClick={() => setDevice(d)}
                    className={`p-1.5 rounded-lg transition ${device === d ? "bg-[rgba(217,179,128,.15)] text-[#f0d9ae]" : "text-[#8b8794] hover:text-white"}`} aria-label={d}>
                    <Icon size={14} />
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-hidden flex justify-center"><div style={{ transform: `scale(${device === "desktop" ? 0.56 : device === "tablet" ? 0.72 : 0.86})`, transformOrigin: "top center" }}><Preview /></div></div>
          </div>

          <div className="glass rounded-2xl p-5">
            <p className="font-display text-lg mb-3">Pop Summary</p>
            <div className="space-y-2 text-[11.5px]">
              {[
                ["Type", POP_KINDS.find((k) => k.id === p.kind)?.name ?? p.kind],
                ["Status", p.status],
                ["Site", site?.name ?? "—"],
                ["Trigger", rules.trigger === "exit" ? `Exit intent · ${rules.loadDelay}s delay` : `Idle ${rules.idleSeconds}s`],
                ["Devices", rules.devices.join(", ") || "none"],
                ["Campaigns", isOffer ? `${p.campaignIds.length} in sequence` : "n/a (email capture)"],
                ["Frequency", frequency.mode === "session" ? "1 / session" : frequency.mode === "cooldown" ? `1 / ${frequency.cooldownHours}h` : `${frequency.maxPerDay}/day`],
                ["Geos", targeting.countries.length ? targeting.countries.join(" ") : "worldwide"],
                ["Version", `v${p.version ?? 0}`],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-3 border-b border-line/40 pb-1.5 last:border-0">
                  <span className="text-[#8b8794]">{k}</span><span className="text-[#c9c4b8] text-right truncate">{v}</span>
                </div>
              ))}
            </div>
            {isOffer && seqCampaigns.length > 0 && (
              <div className="mt-4 pt-3 border-t border-line">
                <p className="text-[10px] tracking-[0.2em] uppercase text-[#5d5867] mb-2">Sequence</p>
                {seqCampaigns.map((c, i) => (
                  <p key={c!.id} className="text-[11px] text-[#c9c4b8] truncate">{i + 1}. {c!.name} <span className="text-[#5d5867]">· ${c!.payout}</span></p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* publish modal */}
      <Modal open={publishOpen} onClose={() => setPublishOpen(false)} title={`Publish v${(p.version ?? 0) + 1}`}>
        <p className="text-sm text-[#a49ea8] mb-4">Each publish creates an <b className="text-[#f0d9ae]">immutable version</b>. Visitors pick it up on their next config fetch (60s cache TTL). You can roll back at any time.</p>
        <L>Version note</L>
        <input className="input-lux mb-5" value={publishNote} onChange={(e) => setPublishNote(e.target.value)} placeholder="What changed in this version?" />
        <div className="flex gap-3">
          <button onClick={() => setPublishOpen(false)} className="btn-ghost rounded-xl px-4 py-2.5 text-sm flex-1">Cancel</button>
          <button onClick={doPublish} className="btn-gold rounded-xl px-4 py-2.5 text-sm flex-[1.6] flex items-center justify-center gap-2"><Rocket size={14} /> Publish now</button>
        </div>
      </Modal>

      {/* versions modal */}
      <Modal open={versionsOpen} onClose={() => setVersionsOpen(false)} title="Version history">
        <div className="space-y-2">
          {(p.versions ?? []).length === 0 && <p className="text-sm text-[#8b8794]">No published versions yet — this pop is still a draft.</p>}
          {(p.versions ?? []).map((v) => (
            <div key={v.v} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
              <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-none ${v.v === p.version ? "bg-[rgba(217,179,128,.18)] text-[#f0d9ae]" : "bg-[#1c1827] text-[#8b8794]"}`}>v{v.v}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] truncate">{v.note}</p>
                <p className="text-[10.5px] text-[#8b8794]">{v.publishedAt}</p>
              </div>
              {v.v === p.version ? <Badge tone="mint">CURRENT</Badge> : (
                <button onClick={() => { store.rollbackPop(p.id, v.v); setP({ ...p, version: (p.version ?? 0) + 1 }); setVersionsOpen(false); store.toast(`Rolled back to v${v.v} — published as v${(p.version ?? 0) + 1}`); }}
                  className="btn-ghost rounded-lg px-3 py-1.5 text-[11px]">Roll back</button>
              )}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
