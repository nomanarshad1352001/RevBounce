"use client";
// ─────────────────────────────────────────────────────────────
// RevBounce — client-side application store (dummy data mode)
// Seeded from lib/data, persisted to localStorage so every
// click in the SaaS has durable, visible effect.
// ─────────────────────────────────────────────────────────────
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  Advertiser, ApiKey, AuditEntry, Branding, Campaign, EmailCaptureConfig, EmailRecord, FeatureFlag,
  FraudFlag, GlobalPostbacks, Integration, Invoice, PayoutDetails, PayoutPeriod, PlanId, Pop,
  PublisherRow, Payout, Retention, SavedReport, Security, Site, TeamUser, Toast, User,
} from "./types";
import {
  ADVERTISERS, API_KEYS, AUDIT_LOG, BRANDING, CAMPAIGNS, DEMO_USERS, EMAIL_CONFIG, EMAIL_RECORDS,
  FEATURE_FLAGS, FRAUD_FLAGS, GLOBAL_POSTBACKS, INTEGRATIONS, INVOICES, PAYOUT_DETAILS,
  PAYOUT_PERIODS, POPS, PUBLISHERS, PAYOUTS, RETENTION, SAVED_REPORTS, SECURITY, SITES, TEAM, uid,
} from "./data";

const LS_KEY = "revbounce_v3";

interface State {
  hydrated: boolean;
  user: User | null;
  /** set while an admin is viewing the suite as a publisher (spec §4) */
  impersonator: User | null;
  campaigns: Campaign[];
  pops: Pop[];
  sites: Site[];
  integrations: Integration[];
  invoices: Invoice[];
  payouts: Payout[];
  publishers: PublisherRow[];
  team: TeamUser[];
  payoutDetails: PayoutDetails;
  payoutPeriods: PayoutPeriod[];
  emailRecords: EmailRecord[];
  savedReports: SavedReport[];
  apiKeys: ApiKey[];
  branding: Branding;
  retention: Retention;
  postbacks: GlobalPostbacks;
  security: Security;
  advertisers: Advertiser[];
  auditLog: AuditEntry[];
  featureFlags: FeatureFlag[];
  fraudFlags: FraudFlag[];
  emailConfig: EmailCaptureConfig;
  toasts: Toast[];
  optimizerOn: boolean;
  notifications: { product: boolean; revenue: boolean; weekly: boolean };
}

interface Store extends State {
  login: (email: string) => boolean;
  loginAs: (kind: "publisher" | "admin" | "advertiser") => void;
  signup: (name: string, email: string, company: string, plan: PlanId) => void;
  logout: () => void;
  updateProfile: (patch: Partial<User>) => void;
  toast: (title: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: string) => void;

  toggleCampaign: (id: string) => void;
  deployCampaign: (id: string) => void;
  saveCampaign: (c: Campaign) => void;

  savePop: (p: Pop) => void;
  togglePop: (id: string) => void;
  deletePop: (id: string) => void;
  duplicatePop: (id: string) => Pop | null;
  archivePop: (id: string) => void;
  setPopStatus: (id: string, status: Pop["status"]) => void;
  publishPop: (p: Pop, note: string) => void;
  rollbackPop: (id: string, v: number) => void;

  addSite: (name: string, url: string) => Site;
  verifySite: (id: string) => void;
  deleteSite: (id: string) => void;

  updateSite: (id: string, patch: Partial<Site>) => void;
  addTeamUser: (name: string, email: string, role: TeamUser["role"]) => void;
  removeTeamUser: (id: string) => void;
  setPayoutDetails: (d: Partial<PayoutDetails>) => void;
  setPayoutStatus: (id: string, status: PayoutPeriod["status"]) => void;
  resendEmail: (id: string) => void;
  saveReport: (r: SavedReport) => void;
  deleteReport: (id: string) => void;
  connectIntegration: (id: string, apiKey: string) => void;
  disconnectIntegration: (id: string) => void;
  syncIntegration: (id: string) => void;

  setPlan: (plan: PlanId) => void;
  setSplit: (publisherId: string, split: number) => void;
  togglePublisherStatus: (id: string) => void;
  savePublisher: (row: PublisherRow) => void;
  setOptimizer: (on: boolean) => void;
  setNotification: (k: keyof State["notifications"], v: boolean) => void;
  impersonate: (row: PublisherRow) => void;
  stopImpersonating: () => void;
  /* §5.6 */
  createApiKey: (label: string, scopes: ApiKey["scopes"]) => ApiKey;
  revokeApiKey: (id: string) => void;
  setBranding: (b: Partial<Branding>) => void;
  setRetention: (r: Partial<Retention>) => void;
  setPostbacks: (p: Partial<GlobalPostbacks>) => void;
  setSecurity: (s: Partial<Security>) => void;
  /* §5.7 */
  toggleAdvertiser: (id: string) => void;
  toggleFlag: (id: string) => void;
  setFlagRollout: (id: string, pct: number) => void;
  setFraudStatus: (id: string, status: FraudFlag["status"]) => void;
  logAudit: (action: string, target: string) => void;
  /* §6 */
  setEmailConfig: (c: Partial<EmailCaptureConfig>) => void;
}

const StoreCtx = createContext<Store | null>(null);

const seed = (): State => ({
  hydrated: false,
  user: null,
  impersonator: null,
  campaigns: CAMPAIGNS,
  pops: POPS,
  sites: SITES,
  integrations: INTEGRATIONS,
  invoices: INVOICES,
  payouts: PAYOUTS,
  publishers: PUBLISHERS,
  team: TEAM,
  payoutDetails: PAYOUT_DETAILS,
  payoutPeriods: PAYOUT_PERIODS,
  emailRecords: EMAIL_RECORDS,
  savedReports: SAVED_REPORTS,
  apiKeys: API_KEYS,
  branding: BRANDING,
  retention: RETENTION,
  postbacks: GLOBAL_POSTBACKS,
  security: SECURITY,
  advertisers: ADVERTISERS,
  auditLog: AUDIT_LOG,
  featureFlags: FEATURE_FLAGS,
  fraudFlags: FRAUD_FLAGS,
  emailConfig: EMAIL_CONFIG,
  toasts: [],
  optimizerOn: true,
  notifications: { product: true, revenue: true, weekly: false },
});

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(seed);

  // hydrate from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as State;
        setState({ ...parsed, hydrated: true, toasts: [] });
        return;
      }
    } catch { /* corrupted storage → fresh seed */ }
    setState((s) => ({ ...s, hydrated: true }));
  }, []);

  // persist
  useEffect(() => {
    if (!state.hydrated) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ ...state, toasts: [] }));
    } catch { /* storage full — non-fatal */ }
  }, [state]);

  const toast = useCallback((title: string, kind: Toast["kind"] = "success") => {
    const id = uid();
    setState((s) => ({ ...s, toasts: [...s.toasts, { id, title, kind }] }));
    setTimeout(() => {
      setState((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3400);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setState((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) }));
  }, []);

  const login = useCallback((email: string) => {
    const found = Object.values(DEMO_USERS).find((u) => u.email === email.toLowerCase().trim());
    if (found) setState((s) => ({ ...s, user: found }));
    return !!found;
  }, []);

  const loginAs = useCallback((kind: "publisher" | "admin" | "advertiser") => {
    setState((s) => ({ ...s, user: DEMO_USERS[kind] }));
  }, []);

  const signup = useCallback((name: string, email: string, company: string, plan: PlanId) => {
    const user: User = {
      id: uid(), name, email: email.toLowerCase().trim(), role: "publisher", company,
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop",
      plan, model: plan === "revshare" ? "revshare" : "subscription",
      split: 70, joinedAt: new Date().toISOString().slice(0, 10),
    };
    setState((s) => ({ ...s, user }));
  }, []);

  const logout = useCallback(() => setState((s) => ({ ...s, user: null })), []);

  const updateProfile = useCallback((patch: Partial<User>) => {
    setState((s) => (s.user ? { ...s, user: { ...s.user, ...patch } } : s));
  }, []);

  const toggleCampaign = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      campaigns: s.campaigns.map((c) =>
        c.id === id
          ? { ...c, status: c.status === "active" ? "paused" : "active" }
          : c,
      ),
    }));
  }, []);

  const deployCampaign = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, status: "active" } : c)),
    }));
  }, []);

  const saveCampaign = useCallback((c: Campaign) => {
    setState((s) => {
      const exists = s.campaigns.some((x) => x.id === c.id);
      return { ...s, campaigns: exists ? s.campaigns.map((x) => (x.id === c.id ? c : x)) : [c, ...s.campaigns] };
    });
  }, []);

  const savePop = useCallback((p: Pop) => {
    setState((s) => {
      const exists = s.pops.some((x) => x.id === p.id);
      return { ...s, pops: exists ? s.pops.map((x) => (x.id === p.id ? p : x)) : [p, ...s.pops] };
    });
  }, []);

  const togglePop = useCallback((id: string) => {
    setState((s) => ({ ...s, pops: s.pops.map((p) => (p.id === id ? { ...p, status: p.status === "active" ? "paused" : "active" } : p)) }));
  }, []);

  const deletePop = useCallback((id: string) => {
    setState((s) => ({ ...s, pops: s.pops.filter((p) => p.id !== id) }));
  }, []);

  /* §5.3 pop lifecycle */
  const duplicatePop = useCallback((id: string): Pop | null => {
    let made: Pop | null = null;
    setState((s) => {
      const src = s.pops.find((p) => p.id === id);
      if (!src) return s;
      made = {
        ...src, id: `p_${uid()}`, name: `${src.name} (copy)`, status: "draft",
        version: 0, versions: [],
        stats: { impressions: 0, clicks: 0, conversions: 0, closes: 0 },
      };
      return { ...s, pops: [made, ...s.pops] };
    });
    return made;
  }, []);

  const archivePop = useCallback((id: string) => {
    setState((s) => ({ ...s, pops: s.pops.map((p) => (p.id === id ? { ...p, status: "archived" as const } : p)) }));
  }, []);

  const setPopStatus = useCallback((id: string, status: Pop["status"]) => {
    setState((s) => ({ ...s, pops: s.pops.map((p) => (p.id === id ? { ...p, status } : p)) }));
  }, []);

  /* Publish → new immutable version (config TTL 60s, rollback allowed) */
  const publishPop = useCallback((p: Pop, note: string) => {
    setState((s) => {
      const v = (p.version ?? 0) + 1;
      const stamped: Pop = {
        ...p, status: "active", version: v,
        versions: [{ v, publishedAt: new Date().toISOString().slice(0, 16).replace("T", " "), note }, ...(p.versions ?? [])],
      };
      const exists = s.pops.some((x) => x.id === p.id);
      return { ...s, pops: exists ? s.pops.map((x) => (x.id === p.id ? stamped : x)) : [stamped, ...s.pops] };
    });
  }, []);

  const rollbackPop = useCallback((id: string, v: number) => {
    setState((s) => ({
      ...s,
      pops: s.pops.map((p) => {
        if (p.id !== id) return p;
        const nv = (p.version ?? 0) + 1;
        const from = (p.versions ?? []).find((x) => x.v === v);
        return {
          ...p, version: nv,
          versions: [{ v: nv, publishedAt: new Date().toISOString().slice(0, 16).replace("T", " "), note: `Rolled back to v${v}${from ? ` — ${from.note}` : ""}` }, ...(p.versions ?? [])],
        };
      }),
    }));
  }, []);

  const addSite = useCallback((name: string, url: string): Site => {
    const site: Site = {
      id: uid(), name, url: url.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      siteKey: `rb_${uid().slice(0, 3)}_${uid()}`, verified: false,
      model: "revshare", clicks: 0, revenue: 0, addedAt: new Date().toISOString().slice(0, 10),
    };
    setState((s) => ({ ...s, sites: [...s.sites, site] }));
    return site;
  }, []);

  const verifySite = useCallback((id: string) => {
    // Dummy verification: simulate ping that finds the snippet tag
    setState((s) => ({ ...s, sites: s.sites.map((x) => (x.id === id ? { ...x, verified: true } : x)) }));
  }, []);

  const deleteSite = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      sites: s.sites.filter((x) => x.id !== id),
      pops: s.pops.filter((p) => p.siteId !== id),
    }));
  }, []);

  const updateSite = useCallback((id: string, patch: Partial<Site>) => {
    setState((s) => ({ ...s, sites: s.sites.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  }, []);

  const addTeamUser = useCallback((name: string, email: string, role: TeamUser["role"]) => {
    setState((s) => ({
      ...s,
      team: [...s.team, { id: uid(), name, email, role, addedAt: new Date().toISOString().slice(0, 10) }],
    }));
  }, []);

  const removeTeamUser = useCallback((id: string) => {
    setState((s) => ({ ...s, team: s.team.filter((t) => t.id !== id) }));
  }, []);

  const setPayoutDetails = useCallback((d: Partial<PayoutDetails>) => {
    setState((s) => ({ ...s, payoutDetails: { ...s.payoutDetails, ...d } }));
  }, []);

  const setPayoutStatus = useCallback((id: string, status: PayoutPeriod["status"]) => {
    setState((s) => ({ ...s, payoutPeriods: s.payoutPeriods.map((p) => (p.id === id ? { ...p, status } : p)) }));
  }, []);

  const resendEmail = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      emailRecords: s.emailRecords.map((e) => (e.id === id ? { ...e, status: "delivered" as const, ts: Date.now() } : e)),
    }));
  }, []);

  const saveReport = useCallback((r: SavedReport) => {
    setState((s) => {
      const exists = s.savedReports.some((x) => x.id === r.id);
      return { ...s, savedReports: exists ? s.savedReports.map((x) => (x.id === r.id ? r : x)) : [r, ...s.savedReports] };
    });
  }, []);

  const deleteReport = useCallback((id: string) => {
    setState((s) => ({ ...s, savedReports: s.savedReports.filter((r) => r.id !== id) }));
  }, []);

  const connectIntegration = useCallback((id: string, apiKey: string) => {
    setState((s) => ({
      ...s,
      integrations: s.integrations.map((i) =>
        i.id === id ? { ...i, connected: true, apiKey, syncedLeads: i.syncedLeads || 0 } : i,
      ),
    }));
  }, []);

  const disconnectIntegration = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      integrations: s.integrations.map((i) => (i.id === id ? { ...i, connected: false, apiKey: undefined } : i)),
    }));
  }, []);

  const syncIntegration = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      integrations: s.integrations.map((i) =>
        i.id === id ? { ...i, syncedLeads: i.syncedLeads + Math.floor(20 + Math.random() * 140) } : i,
      ),
    }));
  }, []);

  const setPlan = useCallback((plan: PlanId) => {
    setState((s) => (s.user ? { ...s, user: { ...s.user, plan } } : s));
  }, []);

  const setSplit = useCallback((publisherId: string, split: number) => {
    setState((s) => ({
      ...s,
      publishers: s.publishers.map((p) => (p.id === publisherId ? { ...p, split } : p)),
      user: s.user && s.user.id === publisherId ? { ...s.user, split } : s.user,
    }));
  }, []);

  const togglePublisherStatus = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      publishers: s.publishers.map((p) =>
        p.id === id ? { ...p, status: p.status === "active" ? "suspended" : "active" } : p,
      ),
    }));
  }, []);

  const savePublisher = useCallback((row: PublisherRow) => {
    setState((s) => {
      const exists = s.publishers.some((p) => p.id === row.id);
      return { ...s, publishers: exists ? s.publishers.map((p) => (p.id === row.id ? row : p)) : [...s.publishers, row] };
    });
  }, []);

  const setOptimizer = useCallback((on: boolean) => setState((s) => ({ ...s, optimizerOn: on })), []);

  const setNotification = useCallback((k: keyof State["notifications"], v: boolean) => {
    setState((s) => ({ ...s, notifications: { ...s.notifications, [k]: v } }));
  }, []);

  // §4 — Admin may impersonate a publisher (view-only vantage in dummy mode)
  const impersonate = useCallback((row: PublisherRow) => {
    setState((s) => {
      if (s.user?.role !== "admin") return s;
      if (s.user.id === row.id) return { ...s, impersonator: null }; // viewing self
      const pub: User = {
        id: row.id, name: row.name, email: `${row.name.toLowerCase().replace(/[^a-z]+/g, ".")}@publisher.demo`,
        role: "publisher", company: row.company,
        avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop",
        plan: row.model === "revshare" ? "revshare" : "growth", model: row.model, split: row.split, joinedAt: "2025-04-01",
      };
      return { ...s, user: pub, impersonator: s.user };
    });
  }, []);

  /* §5.6 actions */
  const createApiKey = useCallback((label: string, scopes: ApiKey["scopes"]): ApiKey => {
    const key: ApiKey = {
      id: uid(), label, prefix: `rb_live_${uid().slice(0, 4)}`, scopes,
      createdAt: new Date().toISOString().slice(0, 10), lastUsed: "never",
    };
    setState((s) => ({ ...s, apiKeys: [key, ...s.apiKeys] }));
    return key;
  }, []);
  const revokeApiKey = useCallback((id: string) => {
    setState((s) => ({ ...s, apiKeys: s.apiKeys.filter((k) => k.id !== id) }));
  }, []);
  const setBranding = useCallback((b: Partial<Branding>) => {
    setState((s) => ({ ...s, branding: { ...s.branding, ...b } }));
  }, []);
  const setRetention = useCallback((r: Partial<Retention>) => {
    setState((s) => ({ ...s, retention: { ...s.retention, ...r } }));
  }, []);
  const setPostbacks = useCallback((p: Partial<GlobalPostbacks>) => {
    setState((s) => ({ ...s, postbacks: { ...s.postbacks, ...p } }));
  }, []);
  const setSecurity = useCallback((sec: Partial<Security>) => {
    setState((s) => ({ ...s, security: { ...s.security, ...sec } }));
  }, []);

  /* §5.7 actions */
  const toggleAdvertiser = useCallback((id: string) => {
    setState((s) => ({
      ...s, advertisers: s.advertisers.map((a) => (a.id === id ? { ...a, status: a.status === "active" ? "paused" : "active" } : a)),
    }));
  }, []);
  const toggleFlag = useCallback((id: string) => {
    setState((s) => ({ ...s, featureFlags: s.featureFlags.map((f) => (f.id === id ? { ...f, on: !f.on } : f)) }));
  }, []);
  const setFlagRollout = useCallback((id: string, pct: number) => {
    setState((s) => ({ ...s, featureFlags: s.featureFlags.map((f) => (f.id === id ? { ...f, rollout: pct } : f)) }));
  }, []);
  const setFraudStatus = useCallback((id: string, status: FraudFlag["status"]) => {
    setState((s) => ({ ...s, fraudFlags: s.fraudFlags.map((f) => (f.id === id ? { ...f, status } : f)) }));
  }, []);
  const logAudit = useCallback((action: string, target: string) => {
    setState((s) => ({
      ...s,
      auditLog: [{ id: uid(), ts: Date.now(), actor: `${s.user?.name ?? "system"} (${s.user?.role ?? "system"})`, action, target, ip: "127.0.0.1" }, ...s.auditLog].slice(0, 60),
    }));
  }, []);

  /* §6 */
  const setEmailConfig = useCallback((c: Partial<EmailCaptureConfig>) => {
    setState((s) => ({ ...s, emailConfig: { ...s.emailConfig, ...c } }));
  }, []);

  const stopImpersonating = useCallback(() => {
    setState((s) => (s.impersonator ? { ...s, user: s.impersonator, impersonator: null } : s));
  }, []);

  const value = useMemo<Store>(() => ({
    ...state, login, loginAs, signup, logout, updateProfile, toast, dismissToast,
    toggleCampaign, deployCampaign, saveCampaign, savePop, togglePop, deletePop,
    duplicatePop, archivePop, setPopStatus, publishPop, rollbackPop,
    addSite, verifySite, deleteSite, updateSite, addTeamUser, removeTeamUser,
    setPayoutDetails, setPayoutStatus, resendEmail, saveReport, deleteReport,
    connectIntegration, disconnectIntegration,
    syncIntegration, setPlan, setSplit, togglePublisherStatus, savePublisher, setOptimizer, setNotification,
    impersonate, stopImpersonating, createApiKey, revokeApiKey, setBranding, setRetention,
    setPostbacks, setSecurity, toggleAdvertiser, toggleFlag, setFlagRollout, setFraudStatus,
    logAudit, setEmailConfig,
  }), [state, login, loginAs, signup, logout, updateProfile, toast, dismissToast,
    toggleCampaign, deployCampaign, saveCampaign, savePop, togglePop, deletePop,
    addSite, verifySite, deleteSite, connectIntegration, disconnectIntegration,
    syncIntegration, setPlan, setSplit, togglePublisherStatus, setOptimizer, setNotification,
    impersonate, stopImpersonating, duplicatePop, archivePop, setPopStatus, publishPop,
    rollbackPop, updateSite, addTeamUser, removeTeamUser, setPayoutDetails, setPayoutStatus,
    resendEmail, saveReport, deleteReport, savePublisher, createApiKey, revokeApiKey, setBranding,
    setRetention, setPostbacks, setSecurity, toggleAdvertiser, toggleFlag, setFlagRollout,
    setFraudStatus, logAudit, setEmailConfig]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
