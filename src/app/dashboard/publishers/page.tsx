"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban, Check, Eye, Globe2, Landmark, Plus, Search, ShieldCheck, Trash2, UserPlus, Users,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { fmtMoney, fmtNum, uid } from "@/lib/data";
import { Badge, Modal, Reveal, Toggle } from "@/components/ui";
import type { PayoutDetails, PublisherRow, TeamUser } from "@/lib/types";

export default function PublishersPage() {
  const store = useStore();
  const router = useRouter();
  const isAdmin = store.user?.role === "admin";

  /* admin state */
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PublisherRow | null>(null);
  const [form, setForm] = useState({ name: "", company: "", model: "revshare" as PublisherRow["model"], split: 70, notes: "" });

  /* publisher state */
  const [addUser, setAddUser] = useState(false);
  const [nu, setNu] = useState({ name: "", email: "", role: "analyst" as TeamUser["role"] });
  const [domainFor, setDomainFor] = useState<string | null>(null);
  const [domainInput, setDomainInput] = useState("");

  /* ───────────── ADMIN VIEW ───────────── */
  if (isAdmin) {
    const rows = store.publishers.filter((p) =>
      !query.trim() || p.name.toLowerCase().includes(query.toLowerCase()) || p.company.toLowerCase().includes(query.toLowerCase()));

    return (
      <div className="space-y-6">
        <Reveal className="flex flex-wrap items-end gap-4">
          <div>
            <h1 className="font-display text-3xl">Publishers</h1>
            <p className="text-sm text-[#8b8794] mt-1">Business model, splits, custom terms, suspension and impersonation.</p>
          </div>
          <button onClick={() => { setForm({ name: "", company: "", model: "revshare", split: 70, notes: "" }); setCreating(true); }}
            className="ml-auto btn-gold rounded-xl px-4 py-2.5 text-sm flex items-center gap-2"><Plus size={15} /> Add publisher</button>
        </Reveal>

        <Reveal className="glass rounded-2xl p-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5d5867]" />
            <input className="input-lux !pl-9" placeholder="Search publishers…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </Reveal>

        <Reveal className="glass rounded-2xl p-2 sm:p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="text-left text-[10px] tracking-[0.2em] uppercase text-[#5d5867] border-b border-line">
                  <th className="pb-3 pl-2 font-medium">Publisher</th><th className="pb-3 font-medium">Business model</th>
                  <th className="pb-3 font-medium">Split</th><th className="pb-3 font-medium text-right">Clicks 30d</th>
                  <th className="pb-3 font-medium text-right">Revenue 30d</th><th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium text-right pr-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-line/50 last:border-0 hover:bg-white/[0.02] transition">
                    <td className="py-3.5 pl-2 pr-4">
                      <p className="text-[13px] font-medium">{p.name}</p>
                      <p className="text-[11px] text-[#8b8794]">{p.company} · {p.sites} site{p.sites !== 1 ? "s" : ""}</p>
                    </td>
                    <td className="py-3.5 pr-4">
                      <Badge tone={p.model === "revshare" ? "gold" : "violet"}>{p.model === "revshare" ? "REV-SHARE" : "PAY-FOR-SYSTEM"}</Badge>
                    </td>
                    <td className="py-3.5 pr-4 text-[12px] text-[#c9c4b8]">{p.model === "revshare" ? `${p.split} / ${100 - p.split}` : "—"}</td>
                    <td className="py-3.5 pr-4 text-right tabular-nums text-[#c9c4b8]">{fmtNum(p.clicks30d)}</td>
                    <td className="py-3.5 pr-4 text-right tabular-nums font-semibold text-[#f0d9ae]">{fmtMoney(p.revenue30d)}</td>
                    <td className="py-3.5 pr-4"><Badge tone={p.status === "active" ? "mint" : "rose"}>{p.status.toUpperCase()}</Badge></td>
                    <td className="py-3.5 pr-2">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => { setEditing(p); setForm({ name: p.name, company: p.company, model: p.model, split: p.split, notes: "" }); }}
                          className="p-2 rounded-lg hover:bg-white/5 text-[#97919f] hover:text-white transition" title="Edit terms"><ShieldCheck size={15} /></button>
                        <button onClick={() => { store.togglePublisherStatus(p.id); store.toast(`${p.name} ${p.status === "active" ? "suspended" : "reinstated"}`, p.status === "active" ? "error" : "success"); }}
                          className="p-2 rounded-lg hover:bg-white/5 text-[#97919f] hover:text-[#f0a0a8] transition" title="Suspend / reinstate"><Ban size={15} /></button>
                        <button onClick={() => {
                          if (p.id === "u_pub") { store.toast("That is the seeded publisher account — use the Publisher demo login", "info"); return; }
                          store.impersonate(p); store.toast(`Impersonating ${p.name}`); router.push("/dashboard");
                        }} className="p-2 rounded-lg hover:bg-white/5 text-[#97919f] hover:text-[#b3a6f5] transition" title="Impersonate"><Eye size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>

        {/* create */}
        <Modal open={creating} onClose={() => setCreating(false)} title="Add publisher">
          <form onSubmit={(e) => {
            e.preventDefault();
            const row: PublisherRow = {
              id: uid(), name: form.name || "New Publisher", company: form.company || "Independent",
              sites: 0, model: form.model, split: form.model === "revshare" ? form.split : 100,
              clicks30d: 0, revenue30d: 0, status: "active",
            };
            store.savePublisher(row);
            setCreating(false);
            store.toast(`${row.name} added — invite email queued`);
          }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-xs text-[#97919f] mb-1.5 block">Name</label><input className="input-lux" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="text-xs text-[#97919f] mb-1.5 block">Company</label><input className="input-lux" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
            </div>
            <div><label className="text-xs text-[#97919f] mb-1.5 block">Business model</label>
              <div className="grid grid-cols-2 gap-2">
                {([["revshare", "Revenue Share"], ["subscription", "Pay-for-System"]] as const).map(([m, l]) => (
                  <button type="button" key={m} onClick={() => setForm({ ...form, model: m })}
                    className={`rounded-xl border py-2.5 text-xs transition ${form.model === m ? "border-[rgba(217,179,128,.55)] bg-[rgba(217,179,128,.08)] text-[#f0d9ae]" : "border-line text-[#8b8794]"}`}>{l}</button>
                ))}
              </div></div>
            {form.model === "revshare" && (
              <div><label className="text-xs text-[#97919f] mb-1.5 block">Publisher split: {form.split}%</label>
                <input type="range" min={50} max={95} value={form.split} className="lux-range" style={{ ["--pct" as string]: `${((form.split - 50) / 45) * 100}%` }} onChange={(e) => setForm({ ...form, split: +e.target.value })} /></div>
            )}
            <div><label className="text-xs text-[#97919f] mb-1.5 block">Custom payout terms / notes</label>
              <textarea className="input-lux" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Net-15, minimum $250, wire only…" /></div>
            <button type="submit" className="btn-gold rounded-xl w-full py-3 text-sm">Create publisher</button>
          </form>
        </Modal>

        {/* edit terms */}
        <Modal open={!!editing} onClose={() => setEditing(null)} title={`Terms — ${editing?.name ?? ""}`}>
          {editing && (
            <form onSubmit={(e) => {
              e.preventDefault();
              store.savePublisher({ ...editing, model: form.model, split: form.model === "revshare" ? form.split : 100 });
              store.toast(`${editing.name}: ${form.model === "revshare" ? `split ${form.split}/${100 - form.split}` : "moved to Pay-for-System"}`);
              setEditing(null);
            }} className="space-y-4">
              <div><label className="text-xs text-[#97919f] mb-1.5 block">Business model</label>
                <div className="grid grid-cols-2 gap-2">
                  {([["revshare", "Revenue Share"], ["subscription", "Pay-for-System"]] as const).map(([m, l]) => (
                    <button type="button" key={m} onClick={() => setForm({ ...form, model: m })}
                      className={`rounded-xl border py-2.5 text-xs transition ${form.model === m ? "border-[rgba(217,179,128,.55)] bg-[rgba(217,179,128,.08)] text-[#f0d9ae]" : "border-line text-[#8b8794]"}`}>{l}</button>
                  ))}
                </div></div>
              {form.model === "revshare" && (
                <div><label className="text-xs text-[#97919f] mb-1.5 block">Publisher split: {form.split}% (platform keeps {100 - form.split}%)</label>
                  <input type="range" min={50} max={95} value={form.split} className="lux-range" style={{ ["--pct" as string]: `${((form.split - 50) / 45) * 100}%` }} onChange={(e) => setForm({ ...form, split: +e.target.value })} /></div>
              )}
              <div><label className="text-xs text-[#97919f] mb-1.5 block">Notes</label>
                <textarea className="input-lux" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <button type="submit" className="btn-gold rounded-xl w-full py-3 text-sm">Save terms</button>
            </form>
          )}
        </Modal>
      </div>
    );
  }

  /* ───────────── PUBLISHER VIEW ───────────── */
  const pd = store.payoutDetails;
  return (
    <div className="space-y-6">
      <Reveal>
        <h1 className="font-display text-3xl">Account</h1>
        <p className="text-sm text-[#8b8794] mt-1">Websites &amp; domains, team access, and how you get paid.</p>
      </Reveal>

      {/* websites + allow-list */}
      <Reveal className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl flex items-center gap-2"><Globe2 size={17} className="text-[#d9b380]" /> Websites &amp; allowed domains</h2>
          <p className="text-[11px] text-[#8b8794]">The embed refuses to run on unlisted domains.</p>
        </div>
        <div className="space-y-3">
          {store.sites.map((s) => (
            <div key={s.id} className="rounded-xl border border-line px-4 py-3.5">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{s.name} <span className="text-[11px] text-[#8b8794]">· {s.url}</span></p>
                  <p className="text-[11px] text-[#5d5867] font-mono mt-0.5">{s.siteKey}</p>
                </div>
                <Badge tone={s.verified ? "mint" : "rose"}>{s.verified ? "VERIFIED" : "UNVERIFIED"}</Badge>
                <select className="input-lux !w-auto !py-1.5 !text-[11px]" value={s.verifyMethod ?? "snippet"}
                  onChange={(e) => { store.updateSite(s.id, { verifyMethod: e.target.value as "snippet" | "meta" }); store.toast(`Verification method set to ${e.target.value}`); }}>
                  <option value="snippet">Snippet detection</option><option value="meta">Meta tag</option>
                </select>
                {!s.verified && (
                  <button onClick={() => { store.verifySite(s.id); store.toast(`${s.name} verified`); }} className="btn-ghost rounded-lg px-3 py-1.5 text-[11px]">Verify now</button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {(s.allowedDomains ?? []).map((d) => (
                  <span key={d} className="chip text-[#c9c4b8] gap-1.5">{d}
                    <button onClick={() => { store.updateSite(s.id, { allowedDomains: (s.allowedDomains ?? []).filter((x) => x !== d) }); store.toast(`${d} removed from allow-list`, "info"); }}
                      className="text-[#5d5867] hover:text-[#f0a0a8] transition" aria-label={`Remove ${d}`}>✕</button>
                  </span>
                ))}
                <button onClick={() => { setDomainFor(s.id); setDomainInput(""); }} className="chip text-[#d9b380] hover:border-[rgba(217,179,128,.5)] transition">+ add domain</button>
              </div>
            </div>
          ))}
        </div>
      </Reveal>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* team */}
        <Reveal className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-xl flex items-center gap-2"><Users size={17} className="text-[#d9b380]" /> Team users</h2>
            <button onClick={() => setAddUser(true)} className="btn-ghost rounded-lg px-3 py-1.5 text-[11px] flex items-center gap-1.5"><UserPlus size={12} /> Invite</button>
          </div>
          <div className="space-y-2.5">
            {store.team.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
                <span className="w-9 h-9 rounded-full bg-[rgba(217,179,128,.12)] text-[#f0d9ae] flex items-center justify-center text-xs font-bold flex-none">{t.name.split(" ").map((w) => w[0]).join("")}</span>
                <div className="min-w-0 flex-1"><p className="text-[13px] truncate">{t.name}</p><p className="text-[11px] text-[#8b8794] truncate">{t.email}</p></div>
                <Badge tone={t.role === "owner" ? "gold" : t.role === "manager" ? "violet" : "mute"}>{t.role.toUpperCase()}</Badge>
                {t.role !== "owner" && (
                  <button onClick={() => { store.removeTeamUser(t.id); store.toast(`${t.name} removed from team`, "info"); }}
                    className="p-1.5 text-[#5d5867] hover:text-[#f0a0a8] transition" aria-label="Remove user"><Trash2 size={14} /></button>
                )}
              </div>
            ))}
          </div>
        </Reveal>

        {/* payout details */}
        <Reveal delay={1} className="glass rounded-2xl p-6">
          <h2 className="font-display text-xl mb-5 flex items-center gap-2"><Landmark size={17} className="text-[#d9b380]" /> Payout details</h2>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] tracking-[0.22em] uppercase text-[#8b8794] block mb-2">Method</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(["paypal", "bank", "wire", "usdt"] as const).map((m) => (
                  <button key={m} onClick={() => { store.setPayoutDetails({ method: m }); store.toast(`Payout method set to ${m.toUpperCase()}`); }}
                    className={`rounded-lg border py-2 text-[11px] uppercase transition ${pd.method === m ? "border-[rgba(217,179,128,.55)] bg-[rgba(217,179,128,.08)] text-[#f0d9ae]" : "border-line text-[#8b8794]"}`}>{m}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] tracking-[0.22em] uppercase text-[#8b8794] block mb-1.5">Account / handle</label>
              <input className="input-lux" value={pd.handle} onChange={(e) => store.setPayoutDetails({ handle: e.target.value })} placeholder="PayPal email, IBAN, or USDT address" />
            </div>
            <div>
              <label className="text-[10px] tracking-[0.22em] uppercase text-[#8b8794] block mb-1.5">Minimum payout</label>
              <input className="input-lux" type="number" min={50} step={50} value={pd.minimumPayout} onChange={(e) => store.setPayoutDetails({ minimumPayout: +e.target.value })} />
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
              <Toggle on={pd.taxFormOnFile} onChange={(v) => { store.setPayoutDetails({ taxFormOnFile: v }); store.toast(v ? "Tax form marked on file" : "Tax form flag cleared", "info"); }} label="tax" />
              <div><p className="text-xs text-[#c9c4b8]">Tax form on file</p><p className="text-[10.5px] text-[#5d5867]">W-9 / W-8BEN required before the first payout clears.</p></div>
              {pd.taxFormOnFile && <Check size={16} className="ml-auto text-[#8fe3b0]" />}
            </div>
          </div>
        </Reveal>
      </div>

      {/* add domain */}
      <Modal open={!!domainFor} onClose={() => setDomainFor(null)} title="Add allowed domain">
        <p className="text-sm text-[#a49ea8] mb-4">The embed script checks <code className="text-[#f0d9ae]">location.hostname</code> against this list and refuses to run anywhere else.</p>
        <input className="input-lux mb-4" value={domainInput} onChange={(e) => setDomainInput(e.target.value)} placeholder="blog.example.com" autoFocus />
        <button onClick={() => {
          const s = store.sites.find((x) => x.id === domainFor);
          const d = domainInput.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
          if (s && d) { store.updateSite(s.id, { allowedDomains: [...(s.allowedDomains ?? []), d] }); store.toast(`${d} added to allow-list`); }
          setDomainFor(null);
        }} className="btn-gold rounded-xl w-full py-3 text-sm">Add domain</button>
      </Modal>

      {/* invite user */}
      <Modal open={addUser} onClose={() => setAddUser(false)} title="Invite team user">
        <form onSubmit={(e) => { e.preventDefault(); store.addTeamUser(nu.name || "Teammate", nu.email || "teammate@example.com", nu.role); setAddUser(false); setNu({ name: "", email: "", role: "analyst" }); store.toast("Invitation sent"); }} className="space-y-4">
          <div><label className="text-xs text-[#97919f] mb-1.5 block">Name</label><input className="input-lux" required value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} /></div>
          <div><label className="text-xs text-[#97919f] mb-1.5 block">Email</label><input className="input-lux" type="email" required value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} /></div>
          <div><label className="text-xs text-[#97919f] mb-1.5 block">Role</label>
            <select className="input-lux" value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value as TeamUser["role"] })}>
              <option value="manager">Manager — edit pops &amp; campaigns</option>
              <option value="analyst">Analyst — read-only reports</option>
            </select></div>
          <button type="submit" className="btn-gold rounded-xl w-full py-3 text-sm">Send invitation</button>
        </form>
      </Modal>
    </div>
  );
}
