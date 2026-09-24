"use client";
import React, { use } from "react";
import Link from "next/link";
import PopBuilder from "@/components/pop-builder";
import { useStore } from "@/lib/store";

export default function EditPopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const store = useStore();
  const pop = store.pops.find((p) => p.id === id);

  if (!store.hydrated) return <p className="text-sm text-[#8b8794]">Loading pop…</p>;

  if (!pop) {
    return (
      <div className="glass rounded-3xl p-14 text-center max-w-lg mx-auto mt-10">
        <h1 className="font-display text-2xl mb-2">Pop not found</h1>
        <p className="text-sm text-[#8b8794] mb-6">It may have been deleted, or the workspace was reset.</p>
        <Link href="/dashboard/pops" className="btn-gold rounded-xl px-5 py-2.5 text-sm">Back to pops</Link>
      </div>
    );
  }

  return <PopBuilder key={pop.id} initial={pop} isNew={false} />;
}
