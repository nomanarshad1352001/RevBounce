"use client";
// Shared UI primitives for the RevBounce SaaS
import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

/* Reveal-on-scroll wrapper */
export function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: 0 | 1 | 2 | 3 | 4 }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => e.isIntersecting && setInView(true), { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${inView ? "in" : ""} ${delay ? `reveal-d${delay}` : ""} ${className}`}>
      {children}
    </div>
  );
}

/* Animated counter */
export function Counter({ to, prefix = "", suffix = "", decimals = 0, duration = 1600 }: { to: number; prefix?: string; suffix?: string; decimals?: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || started.current) return;
      started.current = true;
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        setVal(to * (1 - Math.pow(1 - p, 4)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [to, duration]);
  return (
    <span ref={ref}>
      {prefix}{val.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </span>
  );
}

export function Badge({ tone = "gold", children }: { tone?: "gold" | "mint" | "rose" | "violet" | "mute"; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    gold: "text-[#e8cf9f] border-[rgba(217,179,128,.35)] bg-[rgba(217,179,128,.09)]",
    mint: "text-[#9fe8bd] border-[rgba(143,227,176,.3)] bg-[rgba(143,227,176,.08)]",
    rose: "text-[#f2b3ba] border-[rgba(240,160,168,.3)] bg-[rgba(240,160,168,.08)]",
    violet: "text-[#b3a6f5] border-[rgba(139,124,240,.35)] bg-[rgba(139,124,240,.1)]",
    mute: "text-[#97919f] border-[rgba(151,145,159,.3)] bg-[rgba(151,145,159,.08)]",
  };
  return <span className={`chip ${tones[tone]}`}>{children}</span>;
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" aria-label={label ?? "toggle"} onClick={() => onChange(!on)} className={`switch ${on ? "on" : ""}`} />
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 fade-in" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative glass rounded-2xl shadow-pop pop-in w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[88vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-line sticky top-0 bg-[#121019]/95 backdrop-blur z-10 rounded-t-2xl">
          <h3 className="font-display text-lg">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-[#97919f] hover:text-white transition" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function Progress({ value, tone = "gold" }: { value: number; tone?: "gold" | "mint" | "rose" }) {
  const grad = tone === "gold" ? "from-[#f0d9ae] to-[#b0824f]" : tone === "mint" ? "from-[#8fe3b0] to-[#3f9d6a]" : "from-[#f0a0a8] to-[#b0525c]";
  return (
    <div className="h-1.5 rounded-full bg-[#1c1827] overflow-hidden">
      <div className={`h-full rounded-full bg-gradient-to-r ${grad} transition-all duration-700`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-[11px] tracking-[0.32em] uppercase text-[#c9a068] font-semibold">
      <span className="h-px w-8 bg-gradient-to-r from-transparent via-[#c9a068] to-transparent" />
      {children}
      <span className="h-px w-8 bg-gradient-to-r from-transparent via-[#c9a068] to-transparent" />
    </div>
  );
}

export function Empty({ icon, title, sub, action }: { icon: React.ReactNode; title: string; sub: string; action?: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-10 text-center flex flex-col items-center gap-3">
      <div className="w-12 h-12 rounded-xl bg-[rgba(217,179,128,.09)] border border-line flex items-center justify-center text-[#d9b380]">{icon}</div>
      <p className="font-display text-lg">{title}</p>
      <p className="text-sm text-[#97919f] max-w-sm">{sub}</p>
      {action}
    </div>
  );
}
