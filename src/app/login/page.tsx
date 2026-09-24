"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Megaphone, MousePointerClick, ShieldCheck, UserRound } from "lucide-react";
import { useStore } from "@/lib/store";

export default function LoginPage() {
  const { login, loginAs, toast } = useStore();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const go = () => router.push("/dashboard");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(email)) { toast("Welcome back"); go(); return; }
    setError("Demo mode: use one of the one-click accounts below, or publisher@revbounce.com.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative">
      <div className="aurora w-[600px] h-[400px] top-0 left-1/2 -translate-x-1/2" style={{ background: "radial-gradient(closest-side, rgba(217,179,128,.14), transparent)" }} />
      <div className="w-full max-w-md relative">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-[#8b8794] hover:text-[#f0d9ae] transition mb-8"><ArrowLeft size={13} /> Back to site</Link>
        <div className="glass rounded-3xl p-8 shadow-pop">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#eed9ac] to-[#a97c4b]"><MousePointerClick size={18} className="text-[#16110a]" /></span>
            <span className="font-display text-2xl">Rev<span className="gold-text">Bounce</span></span>
          </div>
          <p className="text-sm text-[#8b8794] mb-7">Sign in to your monetization suite.</p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs text-[#97919f] mb-1.5 block">Email</label>
              <input className="input-lux" type="email" required placeholder="you@publication.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-[#97919f] mb-1.5 block">Password</label>
              <input className="input-lux" type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-xs text-[#f0a0a8]">{error}</p>}
            <button type="submit" className="btn-gold rounded-xl w-full py-3 text-sm">Sign in</button>
          </form>
          <div className="hairline my-6" />
          <p className="text-[10px] tracking-[0.3em] uppercase text-[#5d5867] text-center mb-3">One-click demo accounts</p>
          <div className="grid grid-cols-3 gap-2.5">
            <button onClick={() => { loginAs("publisher"); toast("Signed in as Ava Sterling — Publisher"); go(); }}
              className="btn-ghost rounded-xl px-2 py-3 text-[11px] flex items-center justify-center gap-1.5">
              <UserRound size={13} className="text-[#d9b380]" /> Publisher
            </button>
            <button onClick={() => { loginAs("admin"); toast("Signed in as Marcus Vane — Admin"); go(); }}
              className="btn-ghost rounded-xl px-2 py-3 text-[11px] flex items-center justify-center gap-1.5">
              <ShieldCheck size={13} className="text-[#8b7cf0]" /> Admin
            </button>
            <button onClick={() => { loginAs("advertiser"); toast("Signed in as Lena Hoff — Advertiser"); go(); }}
              className="btn-ghost rounded-xl px-2 py-3 text-[11px] flex items-center justify-center gap-1.5">
              <Megaphone size={13} className="text-[#f0a0a8]" /> Advertiser
            </button>
          </div>
          <p className="text-[10px] text-[#5d5867] text-center mt-3">advertiser@revbounce.com · publisher@revbounce.com · admin@revbounce.com</p>
        </div>
        <p className="text-center text-xs text-[#8b8794] mt-6">New here? <Link href="/signup" className="text-[#d9b380] hover:text-white transition">Create an account</Link></p>
      </div>
    </div>
  );
}
