"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Code2, Copy, Check, Server, ShieldCheck, Database, Terminal } from "lucide-react";

interface Spec { info: { title: string; version: string; description: string }; paths: Record<string, Record<string, { summary: string; tags: string[] }>> }

export default function DocsPage() {
  const [spec, setSpec] = useState<Spec | null>(null);
  const [copied, setCopied] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    fetch("/api/openapi.json").then((r) => r.json()).then(setSpec).catch(() => {});
  }, []);

  const copy = (text: string, key: string) => {
    try { navigator.clipboard.writeText(text); } catch { /* blocked */ }
    setCopied(key);
    setTimeout(() => setCopied(""), 1600);
  };

  const tags = spec ? [...new Set(Object.values(spec.paths).flatMap((m) => Object.values(m).flatMap((o) => o.tags)))] : [];
  const snippet = `<script async src="${origin}/embed.js" data-site="rb_tgp_9f27c1"></script>`;
  const curl = `curl -s -X POST ${origin}/api/v1/auth/login \\
  -H 'Content-Type: application/json' \\
  -d '{"email":"publisher@revbounce.com","password":"demo1234"}'`;

  return (
    <div className="app-light min-h-screen">
      <header className="rb-topbar h-[64px] flex items-center gap-4 px-6">
        <Link href="/" className="flex items-center gap-2 text-white"><ArrowLeft size={15} /> <span className="font-semibold">RevBounce</span></Link>
        <span className="text-white/60 text-sm">API documentation</span>
        <div className="ml-auto flex gap-2">
          <a href="/api/openapi.json" className="rounded-lg px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white transition">openapi.json</a>
          <a href="/healthz" className="rounded-lg px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white transition">/healthz</a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="font-display text-3xl">{spec?.info.title ?? "RevBounce API"} <span className="text-base text-[#5b6b8c] font-normal">v{spec?.info.version ?? "1.0.0"}</span></h1>
          <p className="text-sm text-[#5b6b8c] mt-2 max-w-2xl">{spec?.info.description ?? "Loading…"}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="glass p-5">
            <p className="text-sm font-semibold flex items-center gap-2 mb-3"><Code2 size={15} className="text-[#0066ff]" /> Install snippet</p>
            <div className="rounded-lg bg-[#f3f7fd] border border-[#e3eaf5] p-3 flex items-start gap-2">
              <code className="text-[11.5px] break-all flex-1 text-[#0b3d91]">{snippet}</code>
              <button onClick={() => copy(snippet, "s")} className="text-[#8ea3c4] hover:text-[#0b1b3a]">{copied === "s" ? <Check size={14} className="text-[#16a34a]" /> : <Copy size={14} />}</button>
            </div>
            <p className="text-[11px] text-[#5b6b8c] mt-2">Async, Shadow DOM, ~13 KB gzipped, never blocks rendering.</p>
          </div>
          <div className="glass p-5">
            <p className="text-sm font-semibold flex items-center gap-2 mb-3"><Terminal size={15} className="text-[#0066ff]" /> Authenticate</p>
            <div className="rounded-lg bg-[#f3f7fd] border border-[#e3eaf5] p-3 flex items-start gap-2">
              <code className="text-[11px] whitespace-pre-wrap break-all flex-1 text-[#0b3d91]">{curl}</code>
              <button onClick={() => copy(curl, "c")} className="text-[#8ea3c4] hover:text-[#0b1b3a]">{copied === "c" ? <Check size={14} className="text-[#16a34a]" /> : <Copy size={14} />}</button>
            </div>
            <p className="text-[11px] text-[#5b6b8c] mt-2">Send <code>Authorization: Bearer &lt;accessToken&gt;</code> on every /api/v1 call.</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: ShieldCheck, t: "Security", d: "HMAC-signed JWTs, SSRF guard, rate limits, masked secrets, audit log." },
            { icon: Database, t: "Data model", d: "31 models with indexes — browsable at /api/v1/meta/schema." },
            { icon: Server, t: "Health", d: "/healthz reports subsystems; /api/v1/meta/selftest runs 55 edge-case tests." },
          ].map((c) => (
            <div key={c.t} className="glass p-5">
              <c.icon size={18} className="text-[#8b5cf6] mb-2.5" />
              <p className="text-sm font-semibold">{c.t}</p>
              <p className="text-xs text-[#5b6b8c] mt-1 leading-relaxed">{c.d}</p>
            </div>
          ))}
        </div>

        {tags.map((tag) => {
          const rows = Object.entries(spec?.paths ?? {}).flatMap(([p, methods]) =>
            Object.entries(methods).filter(([, o]) => o.tags.includes(tag)).map(([m, o]) => ({ path: p, method: m.toUpperCase(), summary: o.summary })));
          if (!rows.length) return null;
          return (
            <div key={tag} className="glass p-5">
              <h2 className="font-display text-lg mb-3 capitalize">{tag}</h2>
              <div className="space-y-1.5">
                {rows.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-[#e3eaf5] px-3 py-2 hover:border-[#a9c9ff] transition">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded w-16 text-center ${r.method === "GET" ? "bg-[#eaf2ff] text-[#0066ff]" : r.method === "DELETE" ? "bg-[#ffecec] text-[#ff2d2d]" : "bg-[#f3eeff] text-[#8b5cf6]"}`}>{r.method}</span>
                    <code className="text-[12px] text-[#0b1b3a]">{r.path}</code>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
