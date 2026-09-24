"use client";
import React, { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import PopBuilder from "@/components/pop-builder";
import { useStore } from "@/lib/store";
import {
  DEFAULT_DESIGN, DEFAULT_FREQUENCY, DEFAULT_INTEGRATIONS, DEFAULT_RULES, DEFAULT_TARGETING, uid,
} from "@/lib/data";
import type { Pop, PopKind } from "@/lib/types";

function NewPop() {
  const store = useStore();
  const params = useSearchParams();
  const kind = (params.get("kind") as PopKind | null) ?? "offer";

  const draft = useMemo<Pop>(() => ({
    id: `p_${uid()}`,
    siteId: store.sites[0]?.id ?? "s1",
    campaignId: null, campaignIds: [], slotEnabled: [],
    name: kind === "email-capture" ? "Untitled email capture" : "Untitled offer pop",
    kind: kind === "email-capture" ? "email-capture" : "offer",
    template: "velvet", status: "draft",
    trigger: { type: "exit", value: 0 }, maxImpressions: 1, perHours: 24, devices: ["desktop", "mobile"],
    headline: "ARE YOU STILL THERE?", sub: "Exclusive Offers for You",
    ctaText: "YES, SHOW ME", noText: "NO, THANKS", ctaUrl: "",
    bg: "#0d0b14", accent: "#d9b380", image: "",
    yesColor: "#0066FF", noColor: "#FF2D2D", imagePosition: "top",
    showCounter: true, closeOnYes: true, closeOnFinalNo: true,
    design: { ...DEFAULT_DESIGN }, rules: { ...DEFAULT_RULES }, targeting: { ...DEFAULT_TARGETING },
    frequency: { ...DEFAULT_FREQUENCY }, integrations: { ...DEFAULT_INTEGRATIONS },
    version: 0, versions: [],
    stats: { impressions: 0, clicks: 0, conversions: 0, closes: 0 },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [kind, store.sites]);

  return <PopBuilder initial={draft} isNew />;
}

export default function NewPopPage() {
  return <Suspense><NewPop /></Suspense>;
}
