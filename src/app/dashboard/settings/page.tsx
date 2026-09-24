"use client";
import React, { useState } from "react";
import {
  BellRing, Blocks, Check, Copy, Database, KeyRound, Palette, Plus, Save, ShieldCheck,
  Trash2, TriangleAlert, UserRound, Users, Wallet,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { PLANS, SERIES_60D, fmtMoney, fmtNum } from "@/lib/data";
import { Badge, Progress, Reveal, Toggle } from "@/components/ui";
import type { ApiKey, Retention, TeamUser } from "@/lib/types";

const TABS = [
  { id: "profile", label: "Account", icon: UserRound },
  { id: "security", label: "Security & 2FA", icon: ShieldCheck },
  { id: "api", label: "API keys", icon: KeyRound },
  { id: "billing", label: "Billing & usage", icon: Wallet },
  { id: "team", label: "Team", icon: Users },
  { id: "notifications", label: "Notifications", icon: BellRing },
  { id: "integrations", label: "Global postbacks", icon: Blocks },
  { id: "branding", label: "Branding", icon: Palette },
  { id: "data", label: "Data retention", icon: Database },
  { id: "danger", label: "Danger zone", icon: TriangleAlert },
] as const;
type TabId = (typeof TABS)[number]["id"];

const L = ({ children }: { children: React.ReactNode }) => (
  <label className="text-[10px] tracking-[0.22em] uppercase text-[#8b8794] block mb-1.5">{children}</label>
);

export default function SettingsPage() {
  const store = useStore();
  const user = store.user;
  const [tab, setTab] = useState<TabId>("profile");

  const [name, setName] = useState(user?.name ?? "");
  const [company, setCompany] = useState(user?.company ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [keyLabel, setKeyLabel] = useState("");
  const [keyScopes, setKeyScopes] = useState<ApiKey["scopes"]>(["read:reports"]);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [nu, setNu] = useState({ name: "", email: "", role: "analyst" as TeamUser["role"] });
  const [confirmReset, setConfirmReset] = useState(false);

  const plan = PLANS.find((p) => p.id === user?.plan);
  const clicks30 = SERIES_60D.slice(-30).reduce((a, d) => a + d.clicks, 0);
  const used = plan ? clicks30 % plan.includedClicks : 0;
  const overage = plan ? Math.max(0, clicks30 - plan.includedClicks) : 0;

  const NOTIFS: { k: keyof typeof store.notifications; t: string; d: string }[] = [
    { k: "revenue", t: "Revenue milestones", d: "Payout processed, daily best, split changes." },
    { k: "product", t: "Product updates", d: "New templates, triggers and campaign-library drops." },
    { k: "weekly", t: "Weekly performance digest", d: "A Monday-morning brief on every property." },
  ];

  return (
    <div className="space-y-6">
      <Reveal>
        <h1 className="font-display text-3xl">Settings</h1>
        <p className="text-sm text-[#8b8794] mt-1">Account, security, API access, billing, branding and retention.</p>
      </Reveal>

      <div className="grid lg:grid-cols-[230px_1fr] gap-5 items-start">
        <Reveal className="glass rounded-2xl p-2 lg:sticky lg:top-24">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] text-left transition ${tab === t.id ? "bg-[rgba(217,179,128,.12)] text-[#f0d9ae]" : "text-[#97919f] hover:text-white hover:bg-white/[0.03]"} ${t.id === "danger" ? "text-[#f0a0a8]" : ""}`}>
              <t.icon size={15} className="flex-none" /> {t.label}
            </button>
          ))}
        </Reveal>

        <div className="space-y-5">
          {/* ACCOUNT */}
          {tab === "profile" && (
            <Reveal className="glass rounded-2xl p-6">
              <h2 className="font-display text-xl mb-5">Account &amp; profile</h2>
              <div className="flex items-center gap-5 mb-6">
                <img src={user?.avatar} alt="" className="w-16 h-16 rounded-2xl object-cover border border-[rgba(217,179,128,.4)]" />
                <div>
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-[#8b8794]">{user?.role} · member since {user?.joinedAt}</p>
                  <button onClick={() => store.toast("Avatar upload is decorative in demo mode", "info")} className="text-xs text-[#d9b380] hover:text-white transition mt-1">Change photo</button>
                </div>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); store.updateProfile({ name, company, email }); store.logAudit("updated profile", name); store.toast("Profile saved"); }} className="grid sm:grid-cols-2 gap-4">
                <div><L>Full name</L><input className="input-lux" value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div><L>Company</L><input className="input-lux" value={company} onChange={(e) => setCompany(e.target.value)} /></div>
                <div className="sm:col-span-2"><L>Email</L><input className="input-lux" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="sm:col-span-2"><button type="submit" className="btn-gold rounded-xl px-5 py-2.5 text-sm flex items-center gap-2"><Save size={14} /> Save profile</button></div>
              </form>
            </Reveal>
          )}

          {/* SECURITY */}
          {tab === "security" && (
            <>
              <Reveal className="glass rounded-2xl p-6">
                <h2 className="font-display text-xl mb-5">Password</h2>
                <form onSubmit={(e) => { e.preventDefault(); setCurPw(""); setNewPw(""); store.logAudit("rotated password", user?.email ?? ""); store.toast("Password rotated"); }} className="grid sm:grid-cols-2 gap-4">
                  <div><L>Current password</L><input className="input-lux" type="password" required value={curPw} onChange={(e) => setCurPw(e.target.value)} /></div>
                  <div><L>New password</L><input className="input-lux" type="password" required minLength={8} value={newPw} onChange={(e) => setNewPw(e.target.value)} /></div>
                  <div className="sm:col-span-2"><button type="submit" className="btn-ghost rounded-xl px-5 py-2.5 text-sm">Rotate password</button></div>
                </form>
              </Reveal>
              <Reveal delay={1} className="glass rounded-2xl p-6">
                <h2 className="font-display text-xl mb-4">Two-factor authentication <span className="text-xs text-[#8b8794] font-sans">(optional)</span></h2>
                <div className="flex items-center gap-4 rounded-xl border border-line px-4 py-3.5">
                  <Toggle on={store.security.twoFactor} onChange={(v) => { store.setSecurity({ twoFactor: v }); store.logAudit(v ? "enabled 2FA" : "disabled 2FA", user?.email ?? ""); store.toast(v ? "2FA enabled — scan the QR in your authenticator" : "2FA disabled", v ? "success" : "info"); }} label="2fa" />
                  <div className="flex-1">
                    <p className="text-sm">{store.security.twoFactor ? "Enabled" : "Disabled"}</p>
                    <p className="text-[11px] text-[#8b8794]">Required for admin accounts handling payouts.</p>
                  </div>
                  {store.security.twoFactor && (
                    <select className="input-lux !w-auto" value={store.security.method} onChange={(e) => store.setSecurity({ method: e.target.value as "app" | "sms" })}>
                      <option value="app">Authenticator app</option><option value="sms">SMS</option>
                    </select>
                  )}
                </div>
                {store.security.twoFactor && (
                  <div className="mt-4 rounded-xl bg-black/30 border border-line p-4 flex items-center gap-4">
                    <div className="w-20 h-20 rounded-lg bg-white/90 flex items-center justify-center text-[8px] text-black text-center leading-tight font-mono">QR<br />CODE</div>
                    <div>
                      <p className="text-xs text-[#c9c4b8] mb-1">Recovery codes</p>
                      <p className="text-[11px] font-mono text-[#8b8794]">4K2P-99XA · L07D-B21M · ZQ48-7TRE</p>
                      <button onClick={() => store.toast("Recovery codes downloaded")} className="text-[11px] text-[#d9b380] hover:text-white transition mt-1">Download codes</button>
                    </div>
                  </div>
                )}
              </Reveal>
            </>
          )}

          {/* API KEYS */}
          {tab === "api" && (
            <Reveal className="glass rounded-2xl p-6">
              <h2 className="font-display text-xl mb-1">API keys</h2>
              <p className="text-xs text-[#8b8794] mb-5">For the reporting API. Keys are shown once at creation and stored hashed.</p>
              {freshKey && (
                <div className="rounded-xl border border-[rgba(143,227,176,.35)] bg-[rgba(143,227,176,.06)] p-4 mb-4">
                  <p className="text-xs text-[#8fe3b0] mb-2">New key — copy it now, it won&rsquo;t be shown again.</p>
                  <div className="flex items-center gap-2">
                    <code className="text-[12px] text-[#e8cf9f] break-all flex-1">{freshKey}</code>
                    <button onClick={() => { try { navigator.clipboard.writeText(freshKey); } catch { } setCopied(true); setTimeout(() => setCopied(false), 1600); }}
                      className="text-[#8b8794] hover:text-white transition">{copied ? <Check size={14} className="text-[#8fe3b0]" /> : <Copy size={14} />}</button>
                  </div>
                </div>
              )}
              <div className="space-y-2.5 mb-6">
                {store.apiKeys.map((k) => (
                  <div key={k.id} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
                    <KeyRound size={15} className="text-[#d9b380] flex-none" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] truncate">{k.label}</p>
                      <p className="text-[11px] text-[#8b8794] font-mono">{k.prefix}••••••••••••  · created {k.createdAt} · used {k.lastUsed}</p>
                    </div>
                    <div className="hidden sm:flex gap-1">{k.scopes.map((s) => <Badge key={s} tone="mute">{s}</Badge>)}</div>
                    <button onClick={() => { store.revokeApiKey(k.id); store.logAudit("revoked API key", k.prefix); store.toast(`${k.label} revoked`, "info"); }}
                      className="p-1.5 text-[#5d5867] hover:text-[#f0a0a8] transition" aria-label="Revoke"><Trash2 size={14} /></button>
                  </div>
                ))}
                {store.apiKeys.length === 0 && <p className="text-sm text-[#8b8794]">No active keys.</p>}
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                const k = store.createApiKey(keyLabel || "Untitled key", keyScopes);
                setFreshKey(`${k.prefix}_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`);
                setKeyLabel("");
                store.logAudit("created API key", k.prefix);
                store.toast("API key created");
              }} className="rounded-xl border border-line p-4 space-y-3">
                <p className="text-xs font-semibold">Create a key</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div><L>Label</L><input className="input-lux" value={keyLabel} onChange={(e) => setKeyLabel(e.target.value)} placeholder="Looker Studio connector" /></div>
                  <div><L>Scopes</L>
                    <div className="flex flex-wrap gap-1.5">
                      {(["read:reports", "read:pops", "write:pops"] as const).map((s) => {
                        const on = keyScopes.includes(s);
                        return (
                          <button type="button" key={s} onClick={() => setKeyScopes(on ? keyScopes.filter((x) => x !== s) : [...keyScopes, s])}
                            className={`chip transition ${on ? "text-[#f0d9ae] border-[rgba(217,179,128,.5)] bg-[rgba(217,179,128,.09)]" : "text-[#8b8794]"}`}>{s}</button>
                        );
                      })}
                    </div></div>
                </div>
                <button type="submit" className="btn-gold rounded-xl px-4 py-2.5 text-xs flex items-center gap-2"><Plus size={13} /> Generate key</button>
              </form>
            </Reveal>
          )}

          {/* BILLING */}
          {tab === "billing" && (
            <>
              <Reveal className="glass rounded-2xl p-6">
                <h2 className="font-display text-xl mb-5">Plan &amp; usage meter</h2>
                {plan ? (
                  <>
                    <div className="flex flex-wrap items-center gap-4 mb-5">
                      <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#eed9ac] to-[#a97c4b] flex items-center justify-center text-[#16110a] font-display text-xl">{plan.name[0]}</span>
                      <div className="flex-1 min-w-[200px]">
                        <p className="font-display text-2xl">{plan.name} <span className="text-base text-[#97919f] font-sans">{fmtMoney(plan.price)}/mo</span></p>
                        <p className="text-xs text-[#8b8794]">{plan.tagline}</p>
                      </div>
                      <Badge tone="mint">ACTIVE · renews Feb 1</Badge>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-6">
                      <div>
                        <div className="flex justify-between text-xs mb-2"><span className="text-[#97919f]">Clicks used / included</span><span className="text-[#f0d9ae] font-semibold">{fmtNum(used)} / {fmtNum(plan.includedClicks)}</span></div>
                        <Progress value={(used / plan.includedClicks) * 100} tone={used / plan.includedClicks > 0.85 ? "rose" : "gold"} />
                        <p className="text-[11px] text-[#8b8794] mt-2">Extra clicks bill at ${plan.overageRate.toFixed(3)} each.</p>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-2"><span className="text-[#97919f]">Overage this cycle</span><span className="font-semibold">{fmtNum(overage)} · {fmtMoney(overage * plan.overageRate, 2)}</span></div>
                        <Progress value={overage > 0 ? 100 : 4} tone="mint" />
                        <p className="text-[11px] text-[#8b8794] mt-2">Billed as a separate line on the next invoice.</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-[#a49ea8]">You&rsquo;re on <b className="text-[#f0d9ae]">Revenue Share</b> — no subscription, no usage meter. We take {100 - (user?.split ?? 70)}% of what your exits earn.</p>
                )}
              </Reveal>
              <Reveal delay={1} className="glass rounded-2xl p-6">
                <h2 className="font-display text-xl mb-4">Invoices</h2>
                <div className="space-y-2.5">
                  {store.invoices.map((inv) => (
                    <div key={inv.id} className="flex items-center gap-4 rounded-xl border border-line px-4 py-3">
                      <div className="flex-1 min-w-0"><p className="text-[13px]">{inv.id} <span className="text-[#5d5867]">· {inv.description}</span></p><p className="text-[11px] text-[#8b8794]">{inv.date}</p></div>
                      <Badge tone={inv.status === "paid" ? "mint" : "rose"}>{inv.status.toUpperCase()}</Badge>
                      <p className="text-sm font-semibold w-20 text-right">{fmtMoney(inv.amount)}</p>
                    </div>
                  ))}
                </div>
              </Reveal>
            </>
          )}

          {/* TEAM */}
          {tab === "team" && (
            <Reveal className="glass rounded-2xl p-6">
              <h2 className="font-display text-xl mb-5">Team members</h2>
              <div className="space-y-2.5 mb-5">
                {store.team.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
                    <span className="w-9 h-9 rounded-full bg-[rgba(217,179,128,.12)] text-[#f0d9ae] flex items-center justify-center text-xs font-bold flex-none">{t.name.split(" ").map((w) => w[0]).join("")}</span>
                    <div className="min-w-0 flex-1"><p className="text-[13px] truncate">{t.name}</p><p className="text-[11px] text-[#8b8794] truncate">{t.email}</p></div>
                    <Badge tone={t.role === "owner" ? "gold" : t.role === "manager" ? "violet" : "mute"}>{t.role.toUpperCase()}</Badge>
                    {t.role !== "owner" && (
                      <button onClick={() => { store.removeTeamUser(t.id); store.toast(`${t.name} removed`, "info"); }} className="p-1.5 text-[#5d5867] hover:text-[#f0a0a8] transition" aria-label="Remove"><Trash2 size={14} /></button>
                    )}
                  </div>
                ))}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); store.addTeamUser(nu.name || "Teammate", nu.email || "teammate@example.com", nu.role); setNu({ name: "", email: "", role: "analyst" }); store.toast("Invitation sent"); }}
                className="rounded-xl border border-line p-4 grid sm:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end">
                <div><L>Name</L><input className="input-lux" required value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} /></div>
                <div><L>Email</L><input className="input-lux" type="email" required value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} /></div>
                <div><L>Role</L>
                  <select className="input-lux" value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value as TeamUser["role"] })}>
                    <option value="manager">Manager</option><option value="analyst">Analyst</option>
                  </select></div>
                <button type="submit" className="btn-gold rounded-xl px-4 py-2.5 text-xs">Invite</button>
              </form>
            </Reveal>
          )}

          {/* NOTIFICATIONS */}
          {tab === "notifications" && (
            <Reveal className="glass rounded-2xl p-6">
              <h2 className="font-display text-xl mb-5">Notification preferences</h2>
              <div className="space-y-4">
                {NOTIFS.map((n) => (
                  <div key={n.k} className="flex items-center gap-4 rounded-xl border border-line px-4 py-3.5">
                    <div className="flex-1"><p className="text-sm">{n.t}</p><p className="text-xs text-[#8b8794] mt-0.5">{n.d}</p></div>
                    <Toggle on={store.notifications[n.k]} onChange={(v) => { store.setNotification(n.k, v); store.toast(`${n.t} ${v ? "enabled" : "muted"}`, "info"); }} label={n.t} />
                  </div>
                ))}
              </div>
            </Reveal>
          )}

          {/* GLOBAL POSTBACKS */}
          {tab === "integrations" && (
            <Reveal className="glass rounded-2xl p-6">
              <h2 className="font-display text-xl mb-1">Global postbacks</h2>
              <p className="text-xs text-[#8b8794] mb-5">Fired server-side for every conversion, across all pops. Per-pop overrides live in the Pop Builder.</p>
              <div className="flex items-center gap-4 rounded-xl border border-line px-4 py-3.5 mb-4">
                <Toggle on={store.postbacks.enabled} onChange={(v) => { store.setPostbacks({ enabled: v }); store.toast(v ? "Global postbacks enabled" : "Global postbacks paused", "info"); }} label="postbacks" />
                <p className="text-sm flex-1">{store.postbacks.enabled ? "Active" : "Paused"}</p>
                <Badge tone="gold">server-side only</Badge>
              </div>
              <div className="space-y-4">
                <div><L>Everflow postback URL</L>
                  <input className="input-lux font-mono !text-xs" value={store.postbacks.everflow} onChange={(e) => store.setPostbacks({ everflow: e.target.value })} placeholder="https://www.everflowclient.io/?nid=&transaction_id={click_id}" /></div>
                <div><L>Twyne postback URL</L>
                  <input className="input-lux font-mono !text-xs" value={store.postbacks.twyne} onChange={(e) => store.setPostbacks({ twyne: e.target.value })} placeholder="https://twyne.example/pb?cid={click_id}&amount={payout}" /></div>
                <p className="text-[11px] text-[#8b8794]">Macros: <code className="text-[#e8cf9f]">{"{click_id} {site_id} {pop_id} {campaign_id} {payout}"}</code></p>
                <button onClick={() => { store.logAudit("updated global postbacks", "Everflow / Twyne"); store.toast("Postbacks saved"); }} className="btn-gold rounded-xl px-5 py-2.5 text-sm flex items-center gap-2"><Save size={14} /> Save postbacks</button>
              </div>
            </Reveal>
          )}

          {/* BRANDING */}
          {tab === "branding" && (
            <Reveal className="glass rounded-2xl p-6">
              <h2 className="font-display text-xl mb-5">Branding</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-4 rounded-xl border border-line px-4 py-3.5">
                  <Toggle on={store.branding.showPoweredBy} onChange={(v) => { store.setBranding({ showPoweredBy: v }); store.toast(v ? "“Powered by RevBounce” shown" : "White-labelled — badge hidden", "info"); }} label="badge" />
                  <div className="flex-1"><p className="text-sm">Show &ldquo;Powered by RevBounce&rdquo;</p><p className="text-[11px] text-[#8b8794]">Turn off for white-label (Growth &amp; Enterprise).</p></div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><L>Brand name on pops</L><input className="input-lux" value={store.branding.brandName} onChange={(e) => store.setBranding({ brandName: e.target.value })} /></div>
                  <div><L>Default accent</L>
                    <div className="flex gap-2">
                      <input type="color" className="w-11 h-9 rounded-lg bg-transparent border border-line" value={store.branding.accent} onChange={(e) => store.setBranding({ accent: e.target.value })} />
                      <input className="input-lux font-mono !text-xs" value={store.branding.accent} onChange={(e) => store.setBranding({ accent: e.target.value })} />
                    </div></div>
                  <div><L>Logo URL</L><input className="input-lux" value={store.branding.logoUrl} onChange={(e) => store.setBranding({ logoUrl: e.target.value })} placeholder="https://…/logo.svg" /></div>
                  <div><L>Custom CDN domain</L><input className="input-lux" value={store.branding.customDomain} onChange={(e) => store.setBranding({ customDomain: e.target.value })} placeholder="tags.yourdomain.com" /></div>
                </div>
                <button onClick={() => { store.logAudit("updated branding", store.branding.brandName); store.toast("Branding saved"); }} className="btn-gold rounded-xl px-5 py-2.5 text-sm flex items-center gap-2"><Save size={14} /> Save branding</button>
              </div>
            </Reveal>
          )}

          {/* RETENTION */}
          {tab === "data" && (
            <Reveal className="glass rounded-2xl p-6">
              <h2 className="font-display text-xl mb-1">Data retention</h2>
              <p className="text-xs text-[#8b8794] mb-5">Older rows are purged automatically. Aggregates are always kept.</p>
              <div className="grid sm:grid-cols-2 gap-4">
                {([["events", "Event data"], ["emails", "Captured emails"]] as const).map(([k, label]) => (
                  <div key={k}><L>{label}</L>
                    <select className="input-lux" value={store.retention[k]} onChange={(e) => { store.setRetention({ [k]: +e.target.value as Retention["events"] }); store.toast(`${label} retention set to ${e.target.value} days`); }}>
                      <option value={90}>90 days</option><option value={180}>180 days</option><option value={365}>1 year</option><option value={730}>2 years</option>
                    </select></div>
                ))}
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-line px-4 py-3.5 mt-4">
                <Toggle on={store.retention.autoPurgePii} onChange={(v) => { store.setRetention({ autoPurgePii: v }); store.toast(v ? "PII auto-purge enabled" : "PII auto-purge disabled", "info"); }} label="purge" />
                <div className="flex-1"><p className="text-sm">Auto-purge PII after retention window</p><p className="text-[11px] text-[#8b8794]">Emails are hashed; aggregate counts survive for reporting.</p></div>
              </div>
            </Reveal>
          )}

          {/* DANGER */}
          {tab === "danger" && (
            <Reveal className="glass rounded-2xl p-6 border-[rgba(240,160,168,.3)]">
              <h2 className="font-display text-xl mb-3 flex items-center gap-2 text-[#f0a0a8]"><TriangleAlert size={18} /> Danger zone</h2>
              <p className="text-xs text-[#8b8794] mb-4 leading-relaxed">Reset all demo data (campaigns, pops, sites, splits, settings) back to factory seeds. Your session stays signed in.</p>
              {!confirmReset ? (
                <button onClick={() => setConfirmReset(true)} className="rounded-xl px-5 py-2.5 text-sm bg-[rgba(240,160,168,.12)] border border-[rgba(240,160,168,.4)] text-[#f0a0a8] hover:bg-[rgba(240,160,168,.22)] transition">Reset workspace</button>
              ) : (
                <div className="flex items-center gap-3">
                  <button onClick={() => { try { localStorage.removeItem("revbounce_v3"); } catch { } location.reload(); }}
                    className="rounded-xl px-5 py-2.5 text-sm bg-[rgba(240,160,168,.3)] border border-[rgba(240,160,168,.6)] text-white transition">Yes — wipe &amp; reseed</button>
                  <button onClick={() => setConfirmReset(false)} className="btn-ghost rounded-xl px-5 py-2.5 text-sm">Cancel</button>
                </div>
              )}
            </Reveal>
          )}
        </div>
      </div>
    </div>
  );
}
