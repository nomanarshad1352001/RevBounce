"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3, Blocks, Globe2, LayoutDashboard, LogOut, Mail, MousePointerClick, PanelLeftClose,
  PanelLeftOpen, Search, Server, Settings, ShieldCheck, Sparkles, Users, Wallet, X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Badge } from "@/components/ui";

const NAV = [
  { href: "/dashboard", label: "Dashboard", sub: "KPIs & live activity", icon: LayoutDashboard },
  { href: "/dashboard/campaigns", label: "Campaigns", sub: "Library & marketplace", icon: Sparkles },
  { href: "/dashboard/pops", label: "Pops", sub: "Builder & placements", icon: MousePointerClick },
  { href: "/dashboard/publishers", label: "Publishers", sub: "Accounts, sites & team", icon: Users },
  { href: "/dashboard/reports", label: "Reports", sub: "Group-by, funnel, export", icon: BarChart3 },
  { href: "/dashboard/emails", label: "Email Records", sub: "Captures & delivery", icon: Mail },
  { href: "/dashboard/payouts", label: "Payouts", sub: "Earnings & approvals", icon: Wallet },
  { href: "/dashboard/sites", label: "Websites", sub: "Snippet & verification", icon: Globe2 },
  { href: "/dashboard/analytics", label: "Analytics", sub: "Trends & geo", icon: BarChart3 },
  { href: "/dashboard/revenue", label: "Revenue & Billing", sub: "Plan, invoices, split", icon: Wallet },
  { href: "/dashboard/integrations", label: "Integrations", sub: "Email & webhooks", icon: Blocks },
  { href: "/dashboard/api", label: "API & Engine", sub: "Routes, schema, tests", icon: Server },
];

/* §5 top navigation */
const TOPNAV = [
  ["Dashboard", "/dashboard"], ["Campaigns", "/dashboard/campaigns"], ["Pops", "/dashboard/pops"],
  ["Publishers", "/dashboard/publishers"], ["Reports", "/dashboard/reports"], ["Settings", "/dashboard/settings"],
] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const store = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (store.hydrated && !store.user) router.replace("/login");
  }, [store.hydrated, store.user, router]);

  if (!store.hydrated || !store.user) {
    return (
      <div className="app-light min-h-screen p-8">
        <div className="max-w-7xl mx-auto space-y-5">
          <div className="skeleton h-12 w-64" />
          <div className="grid sm:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-28" />)}</div>
          <div className="grid lg:grid-cols-3 gap-4"><div className="skeleton h-72 lg:col-span-2" /><div className="skeleton h-72" /></div>
        </div>
      </div>
    );
  }

  const role = store.user.role;
  const isAdmin = role === "admin";
  // §4 role permissions — advertiser sees only own-campaign surfaces
  const allowed: string[] =
    role === "admin" ? [...NAV.map((n) => n.href), "/dashboard/admin", "/dashboard/settings"]
    : role === "advertiser" ? ["/dashboard", "/dashboard/campaigns", "/dashboard/reports", "/dashboard/analytics", "/dashboard/settings"]
    : [...NAV.map((n) => n.href), "/dashboard/settings"];
  const nav = (isAdmin ? [...NAV, { href: "/dashboard/admin", label: "Admin Console", sub: "Network & splits", icon: ShieldCheck }] : NAV)
    .filter((n) => allowed.includes(n.href))
    .map((n) => (role === "advertiser" && n.href === "/dashboard/analytics" ? { ...n, label: "Reports" } : n));
  const forbidden = !allowed.includes(pathname);

  return (
    <div className="app-light min-h-screen flex">
      {/* ── SIDEBAR ── */}
      <aside className={`fixed lg:sticky top-0 z-40 h-screen flex flex-col border-r border-line bg-white transition-all duration-300 ${open ? "w-64" : "w-0 lg:w-[76px]"} overflow-hidden`}>
        <div className="flex items-center gap-2.5 px-5 h-[68px] border-b border-line flex-none">
          <Link href="/" className="w-9 h-9 rounded-xl flex-none flex items-center justify-center" style={{ background: "linear-gradient(135deg,#0066ff,#0b3d91)" }}>
            <MousePointerClick size={17} className="text-white" />
          </Link>
          {open && (
            <span className="leading-none">
              <span className="font-display text-[17px] whitespace-nowrap block" style={{ color: "#0b1b3a" }}>Rev<span style={{ color: "#0066ff" }}>Bounce</span></span>
              <span className="text-[7.5px] tracking-[0.22em] uppercase block mt-0.5" style={{ color: "#8ea3c4" }}>Turn traffic into revenue</span>
            </span>
          )}
        </div>
        <nav className="flex-1 py-5 px-3 space-y-1 overflow-y-auto">
          {nav.map(({ href, label, sub, icon: Icon }) => {
            const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
            return (
              <Link key={href} href={href} title={label}
                className={`rb-side-item flex items-start gap-3 px-3 py-2.5 ml-2.5 mr-1 transition-all group ${active ? "on" : "hover:bg-[#f2f7ff]"}`}>
                <Icon size={17} className="flex-none mt-0.5" style={{ color: active ? "#0066ff" : "#8ea3c4" }} />
                {open && (
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] leading-tight whitespace-nowrap font-medium" style={{ color: active ? "#0066ff" : "#0b1b3a" }}>{label}</span>
                    {sub && <span className="block text-[10.5px] mt-0.5 truncate" style={{ color: "#8ea3c4" }}>{sub}</span>}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        {open && (
          <div className="px-3 pb-2">
            <div className="rb-help p-4">
              <p className="text-[13px] font-semibold" style={{ color: "#0b1b3a" }}>Need Help?</p>
              <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "#5b6b8c" }}>Snippet setup, triggers, host &amp; post rules — short guides for every module.</p>
              <button onClick={() => store.toast("Help Center opens with your plan — the Publisher sandbox is a live walkthrough", "info")}
                className="mt-3 w-full rounded-lg py-2 text-[12px] font-semibold text-white" style={{ background: "#0066ff" }}>
                Visit Help Center
              </button>
            </div>
          </div>
        )}
        <div className="p-3 border-t border-line space-y-1">
          <Link href="/dashboard/settings" className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] transition ${pathname === "/dashboard/settings" ? "bg-[rgba(217,179,128,.12)] text-[#f0d9ae]" : "text-[#97919f] hover:text-white hover:bg-white/[0.04]"}`}>
            <Settings size={17} className="flex-none" />{open && <span>Settings</span>}
          </Link>
          <button onClick={() => { store.logout(); router.push("/"); }} className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] text-[#97919f] hover:text-[#f0a0a8] hover:bg-white/[0.04] transition">
            <LogOut size={17} className="flex-none" />{open && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="rb-topbar sticky top-0 z-30 h-[68px] flex items-center gap-4 px-5 shadow-[0_2px_12px_rgba(11,27,58,.18)]">
          <button onClick={() => setOpen(!open)} className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition" aria-label="Toggle sidebar">
            {open ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
          <nav className="hidden xl:flex items-center gap-1">
            {TOPNAV.filter(([, href]) => allowed.includes(href)).map(([label, href]) => {
              const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
              return (
                <Link key={href} href={href}
                  className={`rb-nav-pill ${active ? "on" : ""}`}>
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="hidden md:flex xl:hidden items-center gap-2 rounded-xl px-3.5 py-2 w-56 text-sm cursor-text bg-white/10 text-white/70" onClick={() => store.toast("Global search is decorative in this demo", "info")}>
            <Search size={15} /> Search…
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Badge tone={isAdmin ? "violet" : role === "advertiser" ? "rose" : "gold"}>
              {isAdmin ? "ADMIN" : role === "advertiser" ? "ADVERTISER" : store.user.model === "revshare" ? `REV-SHARE ${store.user.split}/${100 - store.user.split}` : "SUBSCRIPTION"}
            </Badge>
            <Link href="/demo-site" className="rounded-xl px-3.5 py-2 text-xs hidden sm:block bg-white/10 hover:bg-white/20 text-white transition">Publisher sandbox</Link>
            <button onClick={() => store.toast("No new notifications", "info")} className="relative p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition" aria-label="Notifications">
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#4ade80]" />
              <BarChart3 size={17} />
            </button>
            <Link href="/dashboard/settings" className="flex items-center gap-2.5 group">
              <img src={store.user.avatar} alt={store.user.name} className="w-9 h-9 rounded-full object-cover border-2 border-white/30 group-hover:border-white transition" />
              <div className="hidden xl:block">
                <p className="text-[13px] font-medium leading-tight text-white">{store.user.name}</p>
                <p className="text-[11px] leading-tight text-white/60">{isAdmin ? "Admin Account" : role === "advertiser" ? "Advertiser Account" : "Publisher Account"} ▾</p>
              </div>
            </Link>
          </div>
        </header>
        {/* §4 impersonation banner */}
        {store.impersonator && (
          <div className="sticky top-[68px] z-20 px-6 py-2.5 text-[12px] flex items-center justify-center gap-3 flex-wrap"
            style={{ background: "linear-gradient(90deg, rgba(139,124,240,.18), rgba(217,179,128,.14))", borderBottom: "1px solid var(--color-line)" }}>
            <ShieldCheck size={13} className="text-[#8b7cf0]" />
            <span>Impersonating <b className="text-[#f0d9ae]">{store.user.name}</b> — you are viewing the suite as this publisher ({store.impersonator.name}).</span>
            <button onClick={() => { store.stopImpersonating(); store.toast("Back to your admin session"); router.push("/dashboard/admin"); }}
              className="rounded-lg px-3 py-1 bg-[rgba(139,124,240,.25)] border border-[rgba(139,124,240,.4)] hover:bg-[rgba(139,124,240,.4)] transition font-semibold">
              Return to admin
            </button>
          </div>
        )}
        <main className="flex-1 p-5 lg:p-8 max-w-[1400px] w-full mx-auto">
          {forbidden ? (
            <div className="glass rounded-3xl p-14 text-center max-w-lg mx-auto mt-10">
              <ShieldCheck size={30} className="text-[#8b7cf0] mx-auto mb-4" />
              <h1 className="font-display text-2xl mb-2">Not in your lane</h1>
              <p className="text-sm text-[#8b8794] mb-6">
                {role === "advertiser"
                  ? "Advertiser accounts see own campaigns and own-campaign reports only (spec §4). Pops, sites and revenue are publisher territory."
                  : "This console is admin-only."}
              </p>
              <Link href="/dashboard/campaigns" className="btn-gold rounded-xl px-5 py-2.5 text-sm">Go to campaigns</Link>
            </div>
          ) : children}
        </main>
      </div>

      {/* ── TOASTS ── */}
      <div className="fixed bottom-5 right-5 z-[95] space-y-2.5 w-[320px]">
        {store.toasts.map((t) => (
          <div key={t.id} className="glass rounded-xl px-4 py-3.5 flex items-start gap-3 toast-in shadow-pop">
            <span className={`mt-1 w-2 h-2 rounded-full flex-none ${t.kind === "success" ? "bg-[#8fe3b0]" : t.kind === "error" ? "bg-[#f0a0a8]" : "bg-[#d9b380]"}`} />
            <p className="text-[13px] flex-1 leading-snug">{t.title}</p>
            <button onClick={() => store.dismissToast(t.id)} className="text-[#5d5867] hover:text-white transition"><X size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
