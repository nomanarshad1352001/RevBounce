"use client";
import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, MousePointerClick } from "lucide-react";
import { useStore } from "@/lib/store";
import { PLANS, fmtMoney } from "@/lib/data";
import type { PlanId } from "@/lib/types";

function SignupForm() {
  const { signup, toast } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const initial = (params.get("plan") as PlanId | null) ?? "revshare";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [plan, setPlan] = useState<PlanId>(["revshare", "starter", "growth", "enterprise"].includes(initial) ? initial : "revshare");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    signup(name || "New Publisher", email || "you@publication.com", company || "Independent", plan);
    toast("Account created — welcome to RevBounce");
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-14 relative">
      <div className="aurora w-[700px] h-[420px] top-0 left-1/2 -translate-x-1/2" style={{ background: "radial-gradient(closest-side, rgba(217,179,128,.13), transparent)" }} />
      <div className="w-full max-w-lg relative">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-[#8b8794] hover:text-[#f0d9ae] transition mb-8"><ArrowLeft size={13} /> Back to site</Link>
        <div className="glass rounded-3xl p-8 shadow-pop">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#eed9ac] to-[#a97c4b]"><MousePointerClick size={18} className="text-[#16110a]" /></span>
            <span className="font-display text-2xl">Rev<span className="gold-text">Bounce</span></span>
          </div>
          <p className="text-sm text-[#8b8794] mb-7">Create your publisher account. Live in four minutes.</p>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className="text-xs text-[#97919f] mb-1.5 block">Full name</label>
                <input className="input-lux" required placeholder="Ava Sterling" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><label className="text-xs text-[#97919f] mb-1.5 block">Company</label>
                <input className="input-lux" placeholder="Sterling Media Co." value={company} onChange={(e) => setCompany(e.target.value)} /></div>
            </div>
            <div><label className="text-xs text-[#97919f] mb-1.5 block">Work email</label>
              <input className="input-lux" type="email" required placeholder="you@publication.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div>
              <label className="text-xs text-[#97919f] mb-2 block">Business model &amp; plan</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button type="button" onClick={() => setPlan("revshare")}
                  className={`rounded-xl border p-3.5 text-left transition ${plan === "revshare" ? "border-[rgba(217,179,128,.6)] bg-[rgba(217,179,128,.08)]" : "border-line hover:border-[rgba(217,179,128,.3)]"}`}>
                  <p className="text-sm font-semibold">Revenue Share</p>
                  <p className="text-[11px] text-[#8b8794] mt-1">Free forever · you keep 70%</p>
                </button>
                {PLANS.map((p) => (
                  <button key={p.id} type="button" onClick={() => setPlan(p.id)}
                    className={`rounded-xl border p-3.5 text-left transition ${plan === p.id ? "border-[rgba(217,179,128,.6)] bg-[rgba(217,179,128,.08)]" : "border-line hover:border-[rgba(217,179,128,.3)]"}`}>
                    <p className="text-sm font-semibold">{p.name} <span className="text-[#c9a068]">{fmtMoney(p.price)}</span><span className="text-[10px] text-[#8b8794]">/mo</span></p>
                    <p className="text-[11px] text-[#8b8794] mt-1">{p.includedClicks.toLocaleString()} clicks incl.</p>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[#8b8794] mt-2 flex items-center gap-1.5">
                <Check size={12} className="text-[#8fe3b0]" />
                {plan === "revshare" ? "No card required. Our campaigns, our optimizer, your 70%." : "Own campaigns + library. First 14 days on us."}
              </p>
            </div>
            <button type="submit" className="btn-gold rounded-xl w-full py-3.5 text-sm !mt-6">Create account</button>
          </form>
        </div>
        <p className="text-center text-xs text-[#8b8794] mt-6">Already registered? <Link href="/login" className="text-[#d9b380] hover:text-white transition">Sign in</Link></p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return <Suspense><SignupForm /></Suspense>;
}
