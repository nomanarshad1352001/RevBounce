"use client";
// RevBounce pop templates — React preview renderer.
// The live snippet engine (api/snippet) mirrors these with vanilla JS.
import React, { useEffect } from "react";
import { ArrowRight, X } from "lucide-react";
import type { Pop, PopTemplate } from "@/lib/types";

export interface PopSpec {
  template: PopTemplate;
  headline: string;
  sub: string;
  ctaText: string;
  ctaUrl: string;
  bg: string;
  accent: string;
  image: string;
}

export const TEMPLATE_META: { id: PopTemplate; name: string; blurb: string }[] = [
  { id: "velvet", name: "Velvet Modal", blurb: "Editorial split-card with hero image." },
  { id: "sovereign", name: "Sovereign Overlay", blurb: "Full-screen cinematic takeover." },
  { id: "ribbon", name: "Silk Ribbon", blurb: "Slim bottom bar, never intrusive." },
  { id: "corner", name: "Corner Card", blurb: "Slide-in card, mobile native." },
];

export function popToSpec(p: Pop): PopSpec {
  return { template: p.template, headline: p.headline, sub: p.sub, ctaText: p.ctaText, ctaUrl: p.ctaUrl, bg: p.bg, accent: p.accent, image: p.image };
}

export function PopSurface({ spec, onClose, onCta, device = "desktop" }: {
  spec: PopSpec; onClose?: () => void; onCta?: () => void; device?: "desktop" | "mobile";
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const mobile = device === "mobile";
  const closeBtn = (cls: string) => (
    <button onClick={onClose} aria-label="Close pop"
      className={`flex items-center justify-center rounded-full transition hover:rotate-90 duration-300 ${cls}`}>
      <X size={15} />
    </button>
  );
  const cta = (cls: string, big = false) => (
    <a href={spec.ctaUrl} onClick={(e) => { if (onCta) { e.preventDefault(); onCta(); } }}
      className={`group inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition transform hover:-translate-y-0.5 ${big ? "px-8 py-4 text-base" : "px-5 py-3 text-sm"} ${mobile ? "w-full" : ""} ${cls}`}
      style={{ background: `linear-gradient(120deg, ${spec.accent}, ${spec.accent}cc)`, color: "#0d0b10", boxShadow: `0 14px 34px -12px ${spec.accent}88` }}>
      {spec.ctaText}
      <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
    </a>
  );
  const brand = (
    <p className="text-[10px] tracking-[0.3em] uppercase opacity-50" style={{ color: spec.accent === "#0d0b10" ? "#666" : spec.accent }}>
      Powered by RevBounce
    </p>
  );

  if (spec.template === "sovereign") {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center fade-in" role="dialog" aria-modal>
        <div className="absolute inset-0" style={{ background: `${spec.bg}f2` }} onClick={onClose} />
        {spec.image && (
          <div className="absolute inset-0 opacity-25 bg-cover bg-center" style={{ backgroundImage: `url(${spec.image})` }} />
        )}
        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(60% 55% at 50% 45%, ${spec.accent}26, transparent 70%)` }} />
        <div className="relative pop-in text-center max-w-xl px-6 py-10">
          <div className="absolute top-0 right-0 sm:-right-4">{closeBtn("w-9 h-9 border border-white/15 text-white/70 hover:text-white bg-black/30")}</div>
          <p className="text-[11px] tracking-[0.4em] uppercase mb-5" style={{ color: spec.accent }}>Limited invitation</p>
          <h2 className="font-display leading-[1.05] mb-5" style={{ fontSize: mobile ? 32 : 50, color: "#f5f1e6" }}>{spec.headline}</h2>
          <p className="text-[#b9b3ac] mb-9 leading-relaxed" style={{ fontSize: mobile ? 14 : 16 }}>{spec.sub}</p>
          <div className={`flex ${mobile ? "flex-col" : "flex-row"} items-center justify-center gap-4`}>
            {cta("", true)}
            <button onClick={onClose} className="text-sm text-[#8b8794] hover:text-white underline underline-offset-4 transition">No thanks, I&rsquo;ll pass</button>
          </div>
          <div className="mt-10">{brand}</div>
        </div>
      </div>
    );
  }

  if (spec.template === "ribbon") {
    return (
      <div className="fixed inset-x-0 bottom-0 z-[80] fade-in" role="dialog">
        <div className="pop-in border-t" style={{ background: `${spec.bg}f5`, borderColor: "rgba(232,211,168,.16)", backdropFilter: "blur(12px)" }}>
          <div className="max-w-6xl mx-auto px-5 py-4 flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <p className="text-sm font-semibold truncate" style={{ color: "#f5f1e6" }}>{spec.headline}</p>
              <p className="text-xs text-[#97919f] truncate">{spec.sub}</p>
            </div>
            <div className="flex items-center gap-3 flex-none">
              {cta("!px-4 !py-2.5 !text-xs")}
              {closeBtn("w-7 h-7 text-[#97919f] hover:text-white hover:bg-white/10")}
            </div>
          </div>
          <div className="h-[3px] w-full overflow-hidden bg-black/20">
            <div className="h-full w-1/3" style={{ background: `linear-gradient(90deg, transparent, ${spec.accent}, transparent)`, animation: "shimmer-line 3.2s linear infinite" }} />
          </div>
        </div>
      </div>
    );
  }

  if (spec.template === "corner") {
    return (
      <div className={`fixed z-[80] ${mobile ? "inset-x-3 bottom-3" : "bottom-6 right-6 w-[360px]"} fade-in`} role="dialog">
        <div className="pop-in rounded-2xl overflow-hidden shadow-pop border" style={{ background: spec.bg, borderColor: "rgba(232,211,168,.16)" }}>
          {spec.image && (
            <div className="h-28 bg-cover bg-center relative" style={{ backgroundImage: `url(${spec.image})` }}>
              <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent, ${spec.bg})` }} />
            </div>
          )}
          <div className="p-5 relative">
            <div className="absolute top-3 right-3">{closeBtn("w-7 h-7 text-[#97919f] hover:text-white hover:bg-white/10")}</div>
            <p className="font-display text-lg pr-8 leading-snug" style={{ color: "#f5f1e6" }}>{spec.headline}</p>
            <p className="text-xs text-[#97919f] mt-2 mb-4 leading-relaxed">{spec.sub}</p>
            {cta("w-full !text-xs")}
            <div className="mt-3 text-center">{brand}</div>
          </div>
        </div>
      </div>
    );
  }

  // velvet (default modal)
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 fade-in" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[3px]" onClick={onClose} />
      <div className={`relative pop-in rounded-3xl overflow-hidden shadow-pop border ${mobile ? "w-full max-w-[340px]" : "w-full max-w-2xl"}`}
        style={{ background: spec.bg, borderColor: "rgba(232,211,168,.18)" }}>
        <div className={`grid ${mobile ? "grid-cols-1" : "grid-cols-[0.9fr_1.1fr]"}`}>
          {spec.image && (
            <div className={`${mobile ? "h-36" : "min-h-[340px]"} bg-cover bg-center relative`} style={{ backgroundImage: `url(${spec.image})` }}>
              <div className="absolute inset-0" style={{ background: mobile ? `linear-gradient(180deg, transparent, ${spec.bg})` : `linear-gradient(90deg, transparent 60%, ${spec.bg})` }} />
            </div>
          )}
          <div className="p-7 sm:p-9 relative flex flex-col justify-center">
            <div className="absolute top-4 right-4">{closeBtn("w-8 h-8 text-[#97919f] hover:text-white hover:bg-white/10")}</div>
            <p className="text-[10px] tracking-[0.35em] uppercase mb-3" style={{ color: spec.accent }}>Exclusive for you</p>
            <h3 className="font-display leading-tight mb-3 pr-6" style={{ fontSize: mobile ? 22 : 27, color: "#f5f1e6" }}>{spec.headline}</h3>
            <p className="text-sm text-[#a49ea8] leading-relaxed mb-6">{spec.sub}</p>
            {cta(`${mobile ? "w-full" : "self-start"}`)}
            <button onClick={onClose} className="mt-3 text-xs text-[#6e6879] hover:text-[#b9b3ac] transition self-start">Maybe later</button>
            <div className="mt-5">{brand}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
