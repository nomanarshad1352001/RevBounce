"use client";
// ─────────────────────────────────────────────────────────────
// RevBounce — Landing page (all interactive sections)
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, BadgeDollarSign, BarChart3, Check, ChevronRight, Copy, Gauge,
  Layers, MousePointer2, MousePointerClick, Play, Sparkles, Split, Timer, Users, Zap,
} from "lucide-react";
import { Badge, Counter, Reveal, SectionLabel } from "@/components/ui";
import { BarChart, Donut, Spark } from "@/components/charts";
import { PopSpec, PopSurface, TEMPLATE_META } from "@/components/pop-preview";
import { SNIPPET_CODE, TESTIMONIALS, PLANS, fmtMoney } from "@/lib/data";

const DEMO_SPECS: Record<string, PopSpec> = {
  velvet: {
    template: "velvet", headline: "Before you go — your $500 travel voucher is waiting",
    sub: "Join 214,000 travelers in the Azure Club draw. One email, zero spam, genuine wanderlust.",
    ctaText: "Claim My Voucher", ctaUrl: "#converted", bg: "#0d0b14", accent: "#d9b380",
    image: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=900&auto=format&fit=crop",
  },
  sovereign: {
    template: "sovereign", headline: "The internet's best-kept secret is one click away",
    sub: "NovaShield encrypts everything instantly. Try it free for 30 days — no card required.",
    ctaText: "Activate Free Trial", ctaUrl: "#converted", bg: "#090a12", accent: "#7a8cf0",
    image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=1600&auto=format&fit=crop",
  },
  ribbon: {
    template: "ribbon", headline: "Sponsored: readers also explored these trending offers",
    sub: "Hand-picked deals from our premium feed partners.", ctaText: "Explore Deals",
    ctaUrl: "#converted", bg: "#101018", accent: "#e0c08a", image: "",
  },
  corner: {
    template: "corner", headline: "Free Aura sample box — just cover shipping",
    sub: "Dermatologist-approved. Loved by 40k+ subscribers.", ctaText: "Get My Box",
    ctaUrl: "#converted", bg: "#12100e", accent: "#d9a0a8",
    image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=900&auto=format&fit=crop",
  },
};

const HERO_SERIES = [12, 18, 14, 22, 19, 28, 24, 33, 29, 38, 34, 44];

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [heroPop, setHeroPop] = useState(false);
  const [demoPop, setDemoPop] = useState<PopSpec | null>(null);
  const [demoDevice, setDemoDevice] = useState<"desktop" | "mobile">("desktop");
  const [model, setModel] = useState<"subscription" | "revshare">("subscription");
  const [sessions, setSessions] = useState(250_000);
  const [copied, setCopied] = useState(false);
  const [ctaFlash, setCtaFlash] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Hero pop self-demonstration loop
  useEffect(() => {
    let show: ReturnType<typeof setTimeout>, hide: ReturnType<typeof setTimeout>;
    const cycle = () => {
      show = setTimeout(() => setHeroPop(true), 900);
      hide = setTimeout(() => setHeroPop(false), 5200);
    };
    cycle();
    const iv = setInterval(cycle, 6200);
    return () => { clearTimeout(show); clearTimeout(hide); clearInterval(iv); };
  }, []);

  // Rev-share calculator (ASSUME: 38% of sessions trigger a pop, 9.5% CTR,
  // $0.58 blended EPC, 70% publisher split — platform defaults)
  const calc = useMemo(() => {
    const impressions = sessions * 0.38;
    const clicks = impressions * 0.095;
    const gross = clicks * 0.58;
    return { impressions, clicks, gross, yours: gross * 0.7, platform: gross * 0.3 };
  }, [sessions]);

  const copySnippet = () => {
    const code = SNIPPET_CODE("rb_tgp_9f27c1");
    try { navigator.clipboard.writeText(code); } catch { /* clipboard blocked — non-fatal */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fireCta = () => {
    setDemoPop(null);
    setCtaFlash(true);
    setTimeout(() => setCtaFlash(false), 2600);
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* atmosphere */}
      <div className="aurora w-[900px] h-[600px] -top-64 left-1/2 -translate-x-1/2" style={{ background: "radial-gradient(closest-side, rgba(217,179,128,.17), transparent)" }} />
      <div className="aurora w-[700px] h-[500px] top-[1000px] -left-64" style={{ background: "radial-gradient(closest-side, rgba(139,124,240,.10), transparent)" }} />
      <div className="aurora w-[700px] h-[500px] top-[2200px] -right-64" style={{ background: "radial-gradient(closest-side, rgba(217,179,128,.10), transparent)" }} />

      {/* ── NAV ─────────────────────────────────────── */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${scrolled ? "bg-[#07060b]/85 backdrop-blur-xl border-b border-line py-3" : "py-6"}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="relative w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#eed9ac] to-[#a97c4b] shadow-[0_8px_24px_-8px_rgba(217,179,128,.7)]">
              <MousePointerClick size={18} className="text-[#16110a]" />
            </span>
            <span className="font-display text-xl tracking-tight">Rev<span className="gold-text">Bounce</span></span>
          </Link>
          <nav className="hidden lg:flex items-center gap-7 text-sm text-[#b9b3ac]">
            {[["Features", "#features"], ["Live demo", "#demo"], ["How it works", "#how"], ["Pricing", "#pricing"], ["Stories", "#stories"]].map(([l, h]) => (
              <a key={l} href={h} className="hover:text-[#f0d9ae] transition-colors">{l}</a>
            ))}
            <Link href="/demo-site" className="flex items-center gap-1.5 text-[#e8cf9f] hover:text-white transition-colors">
              <Play size={12} /> Publisher sandbox
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/login" className="btn-ghost rounded-xl px-4 py-2 text-sm hidden sm:block">Sign in</Link>
            <Link href="/signup" className="btn-gold rounded-xl px-4 py-2 text-sm">Start free <ArrowRight size={14} className="inline ml-1 -mt-0.5" /></Link>
          </div>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────── */}
      <section className="relative pt-36 lg:pt-44 pb-16 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
          <div>
            <Reveal>
              <div className="chip mb-7 text-[#c9a068] border-[rgba(217,179,128,.3)] bg-[rgba(217,179,128,.06)]">
                <Sparkles size={12} /> The publisher monetization atelier
              </div>
            </Reveal>
            <Reveal delay={1}>
              <h1 className="font-display leading-[1.02] tracking-tight text-[clamp(2.6rem,6vw,4.6rem)]">
                The moment visitors leave is the moment you
                <span className="gold-text italic"> get paid.</span>
              </h1>
            </Reveal>
            <Reveal delay={2}>
              <p className="mt-6 text-lg text-[#a49ea8] max-w-xl leading-relaxed">
                RevBounce turns abandoning traffic into your highest-margin channel. One refined snippet, four elegant triggers, a
                curated campaign library — and a self-optimizing engine that pays you for every graceful goodbye.
              </p>
            </Reveal>
            <Reveal delay={3}>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Link href="/signup" className="btn-gold rounded-2xl px-7 py-3.5 text-[15px]">Launch your first pop <ArrowRight size={16} className="inline ml-1.5" /></Link>
                <a href="#demo" className="btn-ghost rounded-2xl px-7 py-3.5 text-[15px] flex items-center gap-2">
                  <Play size={15} className="text-[#d9b380]" /> Trigger a live pop
                </a>
              </div>
            </Reveal>
            <Reveal delay={4}>
              <div className="mt-12 flex items-center gap-8 text-sm">
                {[["$42.8M", "paid to publishers"], ["11.4%", "avg. exit CVR"], ["312ms", "snippet load"]].map(([v, l]) => (
                  <div key={l}>
                    <p className="font-display text-2xl gold-text">{v}</p>
                    <p className="text-[#8b8794] text-xs mt-1">{l}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          {/* Browser mockup with self-triggering pop */}
          <Reveal delay={2} className="relative">
            <div className="floaty absolute -top-5 -right-3 z-20 glass rounded-xl px-3.5 py-2 text-xs flex items-center gap-2" style={{ ["--tilt" as string]: "3deg" }}>
              <span className="w-2 h-2 rounded-full bg-[#8fe3b0] pulse-dot" /> Conversion +$2.40
            </div>
            <div className="floaty absolute -bottom-4 -left-4 z-20 glass rounded-xl px-3.5 py-2 text-xs flex items-center gap-2" style={{ ["--tilt" as string]: "-2deg", animationDelay: "1.4s" }}>
              <BadgeDollarSign size={13} className="text-[#d9b380]" /> Payout queued · $1,204.12
            </div>
            <div className="relative glass rounded-2xl shadow-pop overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-line bg-black/30">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f0a0a8]/70" /><span className="w-2.5 h-2.5 rounded-full bg-[#eed9ac]/70" /><span className="w-2.5 h-2.5 rounded-full bg-[#8fe3b0]/70" />
                <span className="ml-3 text-xs text-[#6e6879] bg-black/30 rounded-md px-3 py-1 flex-1 truncate">thegildedpost.com/journal/alpine-retreats</span>
              </div>
              <div className="relative h-[380px] sm:h-[430px] bg-[#0c0a13]">
                {/* fake article */}
                <div className="p-6 space-y-3 select-none" aria-hidden>
                  <div className="h-4 w-40 rounded bg-[#1c1827]" />
                  <div className="h-8 w-4/5 rounded bg-[#241f30]" />
                  <div className="h-3 w-full rounded bg-[#16131f]" /><div className="h-3 w-full rounded bg-[#16131f]" /><div className="h-3 w-3/5 rounded bg-[#16131f]" />
                  <div className="h-28 w-full rounded-xl mt-2 bg-cover bg-center opacity-70" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=900&auto=format&fit=crop)" }} />
                  <div className="h-3 w-full rounded bg-[#16131f]" /><div className="h-3 w-4/5 rounded bg-[#16131f]" />
                </div>
                {/* the pop */}
                {heroPop && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px] fade-in">
                    <div className="pop-in w-[86%] max-w-[380px] rounded-2xl overflow-hidden shadow-pop border border-[rgba(232,211,168,.22)] bg-[#0d0b14]">
                      <div className="h-24 bg-cover bg-center relative" style={{ backgroundImage: `url(${DEMO_SPECS.velvet.image})` }}>
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0d0b14]" />
                      </div>
                      <div className="p-5 -mt-2">
                        <p className="text-[9px] tracking-[0.35em] uppercase text-[#d9b380]">Exclusive for you</p>
                        <p className="font-display text-[19px] leading-snug mt-1.5 text-[#f5f1e6]">Your $500 travel voucher is waiting</p>
                        <p className="text-[11px] text-[#97919f] mt-1.5 mb-4">One email. Zero spam. Genuine wanderlust.</p>
                        <button className="btn-gold rounded-lg px-4 py-2 text-xs w-full">Claim My Voucher</button>
                      </div>
                    </div>
                  </div>
                )}
                {/* cursor hint */}
                <div className={`absolute transition-opacity duration-700 ${heroPop ? "opacity-0" : "opacity-60"}`} style={{ right: "18%", top: "14%" }}>
                  <MousePointer2 size={16} className="text-[#d9b380] animate-bounce" />
                </div>
              </div>
            </div>
            <div className="absolute -bottom-7 right-6 glass rounded-xl px-4 py-3 flex items-center gap-3">
              <Spark data={HERO_SERIES} color="#8fe3b0" width={110} height={34} />
              <div><p className="text-sm font-semibold text-[#8fe3b0]">+248%</p><p className="text-[10px] text-[#97919f]">exit revenue, 90 days</p></div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── MARQUEE ─────────────────────────────────── */}
      <section className="py-10 border-y border-line/60 overflow-hidden">
        <div className="flex whitespace-nowrap marquee-track">
          {[0, 1].map((n) => (
            <div key={n} className="flex items-center gap-16 pr-16 text-[#5d5867]">
              {["TLC Media", "The Gilded Post", "Ember Digital", "Lotus Publishing", "Weber Mediahaus", "Rossi Lifestyle", "NovaPress", "Atlas Affiliates"].map((b) => (
                <span key={b} className="font-display text-lg tracking-wide opacity-70 hover:opacity-100 hover:text-[#d9b380] transition">{b}</span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── METRICS BAND ────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { v: 42.8, s: "M", d: 1, l: "publisher earnings paid", p: "$" },
            { v: 128, s: "M", d: 0, l: "sessions monetized / mo", p: "" },
            { v: 9.5, s: "%", d: 1, l: "average pop CTR", p: "" },
            { v: 70, s: "%", d: 0, l: "goes to you, on rev-share", p: "" },
          ].map((m, i) => (
            <Reveal key={m.l} delay={(i % 4) as 0 | 1 | 2 | 3} className="glass rounded-2xl p-6 card-hover text-center">
              <p className="font-display text-4xl gold-text"><Counter to={m.v} prefix={m.p} suffix={m.s} decimals={m.d} /></p>
              <p className="text-xs text-[#8b8794] mt-2">{m.l}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── FEATURES BENTO ──────────────────────────── */}
      <section id="features" className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <Reveal className="text-center flex flex-col items-center gap-4 mb-16">
            <SectionLabel>The instrument</SectionLabel>
            <h2 className="font-display text-[clamp(2rem,4vw,3.2rem)] leading-tight max-w-2xl">Everything after <span className="italic gold-text">one snippet</span> lives here</h2>
            <p className="text-[#a49ea8] max-w-xl">Install once. Design, target, cap, rotate and report — forever after — from the dashboard. Your site's code never changes again.</p>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-5">
            <Reveal className="glass rounded-3xl p-8 card-hover md:col-span-2 relative overflow-hidden">
              <div className="absolute right-6 top-6"><Donut size={150} slices={[
                { label: "Exit-intent", value: 44, color: "#d9b380" }, { label: "Idle", value: 22, color: "#8b7cf0" },
                { label: "Scroll", value: 19, color: "#8fe3b0" }, { label: "Timed", value: 15, color: "#f0a0a8" },
              ]} /></div>
              <Zap className="text-[#d9b380] mb-5" size={26} />
              <h3 className="font-display text-2xl mb-3">Four refined triggers, zero intrusions</h3>
              <p className="text-sm text-[#a49ea8] leading-relaxed max-w-md">
                Exit-intent tuned per device, idle detection, scroll-depth and timed reveals — each wrapped in frequency caps so a
                visitor is courted once, never chased. A broken campaign fails silently; your site and your reader are untouchable.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["Exit-intent", "Idle 45s", "Scroll 70%", "Timed 20s", "1×/24h cap", "Device targeting"].map((t) => <Badge key={t}>{t}</Badge>)}
              </div>
            </Reveal>
            <Reveal delay={1} className="glass rounded-3xl p-8 card-hover">
              <Gauge className="text-[#8fe3b0] mb-5" size={26} />
              <h3 className="font-display text-2xl mb-3">The Optimizer</h3>
              <p className="text-sm text-[#a49ea8] leading-relaxed">A home-bandit engine reweighs campaign rotation hourly by live EPC. Winners surface, losers retire — automatically.</p>
              <div className="mt-6 space-y-2.5">
                {[["Azure Travel", 94], ["NovaShield", 91], ["Lumina Leads", 88]].map(([n, s]) => (
                  <div key={n as string} className="flex items-center gap-3 text-xs">
                    <span className="w-28 text-[#c9c4b8]">{n}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-[#1c1827] overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-[#8fe3b0] to-[#3f9d6a]" style={{ width: `${s}%` }} /></div>
                    <span className="text-[#8fe3b0] w-7 text-right">{s}</span>
                  </div>
                ))}
              </div>
            </Reveal>
            <Reveal className="glass rounded-3xl p-8 card-hover">
              <Layers className="text-[#8b7cf0] mb-5" size={26} />
              <h3 className="font-display text-2xl mb-3">Curated campaign library</h3>
              <p className="text-sm text-[#a49ea8] leading-relaxed">Proven exit campaigns, Google click-feed, SOI email submits and lead-gen with fixed payouts — deployable in one click.</p>
              <div className="mt-6 flex gap-2 flex-wrap">{["SOI $2.40", "CPA $38", "CPC feed", "Lead-gen $14"].map((t) => <Badge key={t} tone="violet">{t}</Badge>)}</div>
            </Reveal>
            <Reveal delay={1} className="glass rounded-3xl p-8 card-hover">
              <BarChart3 className="text-[#d9b380] mb-5" size={26} />
              <h3 className="font-display text-2xl mb-3">Revenue you can watch</h3>
              <p className="text-sm text-[#a49ea8] leading-relaxed">Impressions, clicks, conversions and dollars stream in live. Split payouts settle twice a month like clockwork.</p>
              <div className="mt-6"><BarChart height={110} data={HERO_SERIES.map((v, i) => ({ day: `${i + 1}`, value: v }))} /></div>
            </Reveal>
            <Reveal delay={2} className="glass rounded-3xl p-8 card-hover">
              <Users className="text-[#f0a0a8] mb-5" size={26} />
              <h3 className="font-display text-2xl mb-3">Email, instantly wired</h3>
              <p className="text-sm text-[#a49ea8] leading-relaxed">Captured leads land in Mailchimp, Klaviyo or Kit the moment a pop converts — plus server-side webhooks for everything.</p>
              <div className="mt-6 flex gap-2 flex-wrap">{["Mailchimp", "Klaviyo", "Kit", "Webhooks"].map((t) => <Badge key={t} tone="rose">{t}</Badge>)}</div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── LIVE DEMO ───────────────────────────────── */}
      <section id="demo" className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <Reveal className="text-center flex flex-col items-center gap-4 mb-14">
            <SectionLabel>Feel it</SectionLabel>
            <h2 className="font-display text-[clamp(2rem,4vw,3.2rem)] leading-tight">Four templates. <span className="italic gold-text">Fire them all.</span></h2>
            <p className="text-[#a49ea8] max-w-lg">These aren't screenshots — this is the production renderer. Trigger any pop, close it, click through. Your visitors always keep control.</p>
            <div className="chip mt-2 cursor-pointer" onClick={() => setDemoDevice(demoDevice === "desktop" ? "mobile" : "desktop")}>
              <Timer size={11} /> Previewing: <b className="text-[#f0d9ae]">{demoDevice}</b> — tap to switch
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {TEMPLATE_META.map((t, i) => (
              <Reveal key={t.id} delay={(i % 4) as 0 | 1 | 2 | 3} className="glass rounded-2xl p-6 card-hover flex flex-col">
                <div className="h-24 rounded-xl mb-5 bg-cover bg-center relative overflow-hidden" style={{ backgroundImage: DEMO_SPECS[t.id].image ? `url(${DEMO_SPECS[t.id].image})` : undefined, background: DEMO_SPECS[t.id].image ? undefined : "linear-gradient(120deg,#1c1827,#121019)" }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0c0a13] to-transparent" />
                  <span className="absolute bottom-2 left-3 text-[10px] tracking-[0.25em] uppercase text-[#d9b380]">Template 0{i + 1}</span>
                </div>
                <h3 className="font-display text-xl">{t.name}</h3>
                <p className="text-xs text-[#97919f] mt-1.5 mb-5 flex-1">{t.blurb}</p>
                <button onClick={() => setDemoPop(DEMO_SPECS[t.id])} className="btn-ghost rounded-xl px-4 py-2.5 text-sm flex items-center justify-center gap-2 group">
                  <Play size={13} className="text-[#d9b380]" /> Trigger pop
                </button>
              </Reveal>
            ))}
          </div>
          {ctaFlash && (
            <div className="mt-8 mx-auto max-w-md glass rounded-xl px-5 py-4 text-center toast-in">
              <p className="text-sm"><span className="text-[#8fe3b0] font-semibold">Conversion tracked.</span> <span className="text-[#97919f]">The click-through posted to /api/track and revenue attributed to the publisher — see it in the sandbox.</span></p>
              <Link href="/demo-site" className="text-xs text-[#d9b380] hover:text-white transition inline-flex items-center gap-1 mt-1.5">Open live publisher sandbox <ArrowUpRight size={12} /></Link>
            </div>
          )}
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────── */}
      <section id="how" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center flex flex-col items-center gap-4 mb-16">
            <SectionLabel>Three movements</SectionLabel>
            <h2 className="font-display text-[clamp(2rem,4vw,3.2rem)]">From snippet to settlement</h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-9 left-[18%] right-[18%] hairline" />
            {[
              { n: "01", t: "Paste one line", d: "Drop the async snippet before </body>. It weighs 14 KB, never blocks rendering, and fails silently if anything ever goes wrong.", code: true },
              { n: "02", t: "Compose from the dashboard", d: "Pick a template, set triggers, caps and devices, choose campaigns — or let the Optimizer rotate the library for you." },
              { n: "03", t: "Watch revenue settle", d: "Every impression, click and dollar streams live into your analytics. Payouts land twice monthly, split automatically." },
            ].map((s, i) => (
              <Reveal key={s.n} delay={(i % 3) as 0 | 1 | 2} className="relative text-center">
                <div className="w-[72px] h-[72px] mx-auto rounded-2xl glass flex items-center justify-center font-display text-xl gold-text relative z-10">{s.n}</div>
                <h3 className="font-display text-2xl mt-6 mb-3">{s.t}</h3>
                <p className="text-sm text-[#a49ea8] leading-relaxed max-w-xs mx-auto">{s.d}</p>
                {s.code && (
                  <button onClick={copySnippet} className="mt-5 group w-full max-w-xs mx-auto block text-left glass rounded-xl px-4 py-3 hover:border-[rgba(217,179,128,.4)] transition">
                    <code className="text-[11px] text-[#c9a068] break-all leading-relaxed block">{SNIPPET_CODE("rb_tgp_9f27c1")}</code>
                    <span className="text-[10px] text-[#8b8794] mt-1.5 flex items-center gap-1.5">{copied ? <><Check size={11} className="text-[#8fe3b0]" /> Copied</> : <><Copy size={11} /> Click to copy</>}</span>
                  </button>
                )}
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING — two business models ───────────── */}
      <section id="pricing" className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <Reveal className="text-center flex flex-col items-center gap-4 mb-12">
            <SectionLabel>Two ways to earn</SectionLabel>
            <h2 className="font-display text-[clamp(2rem,4vw,3.2rem)]">Choose your business model</h2>
            <div className="mt-4 glass rounded-full p-1 flex">
              {([["subscription", "Pay for the system"], ["revshare", "Revenue share — 70/30"]] as const).map(([id, l]) => (
                <button key={id} onClick={() => setModel(id)}
                  className={`rounded-full px-5 sm:px-7 py-2.5 text-sm font-medium transition-all duration-300 ${model === id ? "bg-gradient-to-r from-[#eed9ac] to-[#c9a068] text-[#16110a] shadow" : "text-[#a49ea8] hover:text-white"}`}>
                  {l}
                </button>
              ))}
            </div>
          </Reveal>

          {model === "subscription" ? (
            <div className="grid md:grid-cols-3 gap-6">
              {PLANS.map((p, i) => (
                <Reveal key={p.id} delay={(i % 3) as 0 | 1 | 2}
                  className={`rounded-3xl p-8 card-hover relative ${p.id === "growth" ? "glass border-[rgba(217,179,128,.45)] shadow-[0_30px_80px_-40px_rgba(217,179,128,.35)]" : "glass"}`}>
                  {p.id === "growth" && <span className="absolute -top-3 left-1/2 -translate-x-1/2 chip text-[#16110a] bg-gradient-to-r from-[#eed9ac] to-[#c9a068] font-bold">MOST CHOSEN</span>}
                  <p className="text-sm text-[#c9a068] font-semibold tracking-wide">{p.name}</p>
                  <p className="mt-4 font-display text-5xl">{fmtMoney(p.price)}<span className="text-base text-[#97919f] font-sans">/mo</span></p>
                  <p className="text-xs text-[#8b8794] mt-2 leading-relaxed h-8">{p.tagline}</p>
                  <div className="hairline my-6" />
                  <ul className="space-y-2.5 text-sm text-[#c9c4b8]">
                    <li className="flex gap-2.5"><Check size={15} className="text-[#8fe3b0] flex-none mt-0.5" />{p.includedClicks.toLocaleString()} clicks included</li>
                    <li className="flex gap-2.5"><Check size={15} className="text-[#8fe3b0] flex-none mt-0.5" />${p.overageRate.toFixed(3)} per extra click</li>
                    {p.features.slice(0, 4).map((f) => <li key={f} className="flex gap-2.5"><Check size={15} className="text-[#8fe3b0] flex-none mt-0.5" />{f}</li>)}
                  </ul>
                  <Link href={`/signup?plan=${p.id}`} className={`mt-8 block text-center rounded-xl px-4 py-3 text-sm font-semibold transition ${p.id === "growth" ? "btn-gold" : "btn-ghost"}`}>
                    Start with {p.name}
                  </Link>
                </Reveal>
              ))}
            </div>
          ) : (
            <Reveal className="glass rounded-3xl p-8 lg:p-12">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div>
                  <Badge tone="mint"><Split size={11} /> No upfront cost — we earn when you do</Badge>
                  <h3 className="font-display text-3xl mt-5 mb-4">You keep <span className="gold-text">70%</span> of every dollar your exits produce</h3>
                  <p className="text-sm text-[#a49ea8] leading-relaxed mb-8">
                    We supply the campaigns, the optimizer and the pipes. Split is configurable per publisher by our team — slide your
                    traffic and see what the arrangement is worth.
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-[#97919f]"><span>Monthly sessions</span><span className="text-[#f0d9ae] font-semibold text-sm">{sessions.toLocaleString()}</span></div>
                    <input type="range" min={10_000} max={2_000_000} step={10_000} value={sessions} className="lux-range"
                      style={{ ["--pct" as string]: `${((sessions - 10_000) / (2_000_000 - 10_000)) * 100}%` }}
                      onChange={(e) => setSessions(+e.target.value)} />
                    <div className="flex justify-between text-[10px] text-[#5d5867]"><span>10k</span><span>1M</span><span>2M</span></div>
                  </div>
                  <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                    {[["Pop impressions", Math.round(calc.impressions).toLocaleString()], ["Clicks", Math.round(calc.clicks).toLocaleString()], ["Gross revenue", fmtMoney(calc.gross)]].map(([l, v]) => (
                      <div key={l as string} className="rounded-xl bg-black/30 border border-line px-2 py-3">
                        <p className="text-sm font-semibold">{v}</p><p className="text-[10px] text-[#8b8794] mt-0.5">{l}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs tracking-[0.3em] uppercase text-[#97919f]">Your projected monthly take</p>
                  <p className="font-display text-[clamp(3rem,6vw,4.6rem)] gold-text leading-none mt-4">{fmtMoney(calc.yours)}</p>
                  <p className="text-xs text-[#8b8794] mt-3">platform keeps {fmtMoney(calc.platform)} · settled twice monthly</p>
                  <div className="mt-8 mx-auto max-w-[280px]"><Donut size={180} slices={[{ label: "You — 70%", value: 70, color: "#d9b380" }, { label: "RevBounce — 30%", value: 30, color: "#3a3244" }]} /></div>
                  <Link href="/signup?plan=revshare" className="btn-gold rounded-xl px-8 py-3.5 text-sm inline-block mt-8">Start earning — free <ArrowRight size={14} className="inline ml-1" /></Link>
                </div>
              </div>
            </Reveal>
          )}
        </div>
      </section>

      {/* ── TESTIMONIALS ────────────────────────────── */}
      <section id="stories" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <Reveal className="text-center flex flex-col items-center gap-4 mb-14">
            <SectionLabel>Word of mouth</SectionLabel>
            <h2 className="font-display text-[clamp(2rem,4vw,3.2rem)]">Publishers, in their own words</h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={(i % 3) as 0 | 1 | 2} className="glass rounded-3xl p-8 card-hover flex flex-col">
                <p className="font-display text-5xl gold-text leading-none mb-4">&ldquo;</p>
                <p className="text-sm text-[#c9c4b8] leading-relaxed flex-1">{t.quote}</p>
                <div className="flex items-center gap-3 mt-7 pt-6 border-t border-line">
                  <img src={t.avatar} alt={t.name} className="w-11 h-11 rounded-full object-cover border border-[rgba(217,179,128,.4)]" />
                  <div><p className="text-sm font-semibold">{t.name}</p><p className="text-xs text-[#8b8794]">{t.role}</p></div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────── */}
      <section className="py-28 px-6 relative">
        <div className="aurora w-[700px] h-[400px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ background: "radial-gradient(closest-side, rgba(217,179,128,.16), transparent)" }} />
        <Reveal className="max-w-3xl mx-auto text-center relative">
          <p className="text-[11px] tracking-[0.4em] uppercase text-[#c9a068] mb-6">The last thing they see could be the first thing that pays</p>
          <h2 className="font-display text-[clamp(2.4rem,5vw,4rem)] leading-tight">Turn traffic into <span className="italic gold-text">revenue.</span></h2>
          <p className="text-[#a49ea8] mt-6 max-w-xl mx-auto">Free to start on revenue share. Live on your site in four minutes. Cancel the snippet any time — it was never really there.</p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/signup" className="btn-gold rounded-2xl px-9 py-4">Create your account <ChevronRight size={16} className="inline ml-1" /></Link>
            <Link href="/demo-site" className="btn-ghost rounded-2xl px-9 py-4 flex items-center gap-2"><Play size={15} className="text-[#d9b380]" /> See a live site</Link>
          </div>
        </Reveal>
      </section>

      {/* ── FOOTER ──────────────────────────────────── */}
      <footer className="border-t border-line/60 py-14 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-[#eed9ac] to-[#a97c4b]"><MousePointerClick size={15} className="text-[#16110a]" /></span>
              <span className="font-display text-lg">Rev<span className="gold-text">Bounce</span></span>
            </div>
            <p className="text-sm text-[#8b8794] max-w-sm leading-relaxed">The monetization atelier for publishers who refuse to let traffic leave empty-handed. Built async, capped politely, settled honestly.</p>
          </div>
          {[
            ["Product", [["Features", "#features"], ["Pricing", "#pricing"], ["Live demo", "#demo"], ["Publisher sandbox", "/demo-site"]]],
            ["Account", [["Sign in", "/login"], ["Create account", "/signup"], ["Dashboard", "/dashboard"]]],
          ].map(([h, links]) => (
            <div key={h as string}>
              <p className="text-xs tracking-[0.25em] uppercase text-[#97919f] mb-4">{h}</p>
              <ul className="space-y-2.5 text-sm">
                {(links as string[][]).map(([l, href]) => (
                  <li key={l}><Link href={href} className="text-[#a49ea8] hover:text-[#f0d9ae] transition">{l}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-line/40 flex flex-wrap justify-between gap-3 text-xs text-[#5d5867]">
          <span>© 2026 RevBounce Labs. Turn traffic into revenue.</span>
          <span>14 KB snippet · async · never blocks rendering · fails silently</span>
        </div>
      </footer>

      {/* live pop renderer for the demo section */}
      {demoPop && <PopSurface spec={demoPop} device={demoDevice} onClose={() => setDemoPop(null)} onCta={fireCta} />}
    </div>
  );
}
