import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/*
 * GET /embed.js — the RevBounce pop engine (spec §7).
 * Install: <script async src="…/embed.js" data-site="SITE_KEY"></script>
 *
 * 7.1 boot · 7.2 triggers · 7.3 sequence state machine
 * 7.4 multi-tab lock (BroadcastChannel + storage), refresh resume,
 *     version pinning mid-session, server "skipped" advance
 * 7.5 first-party visitor identity + consent (GPC / DNT / revbounceConsent)
 * 7.6 full event taxonomy, batched via sendBeacon with fetch fallback
 * 7.7 pre-fill from window.revbounceData or page-form selectors
 * 7.8 Shadow DOM, single namespace, requestIdleCallback boot, passive
 *     listeners, kill switch, public API RevBounce.{show,hide,reset,debug}
 */
const ENGINE = String.raw`
(function () {
  "use strict";
  try { if (window.RevBounce && window.RevBounce.__loaded) return; } catch (e) { return; }

  var ORIGIN = "__ORIGIN__";
  var CFG_KEY = "rb_cfg_v8:";
  var CAP_PREFIX = "revbounce_freq_";
  var VID_KEY = "revbounce_vid";
  var SEQ_KEY = "rb_seq_v8:";
  var LOCK_KEY = "rb_lock";
  var VISIT_KEY = "revbounce_seen";
  var MAX_ERRORS = 8;                    /* §7.8 kill switch */

  var errorCount = 0, KILLED = false, DEBUG = false, SESSION_TOKEN = "";
  function safe(fn, tag) {
    try { return fn(); }
    catch (e) {
      errorCount++;
      if (DEBUG) { try { console.warn("[RevBounce]", tag || "", e && e.message); } catch (e2) {} }
      try { if (tag !== "evt") emit("error", { note: (tag || "") + ":" + (e && e.message) }); } catch (e3) {}
      if (errorCount > MAX_ERRORS) { KILLED = true; teardown(); }
      return undefined;
    }
  }
  function log() { if (DEBUG) { try { console.log.apply(console, ["[RevBounce]"].concat([].slice.call(arguments))); } catch (e) {} } }

  function ls(k) { return safe(function () { return localStorage.getItem(k); }, "ls"); }
  function lsSet(k, v) { safe(function () { localStorage.setItem(k, v); }, "ls"); }
  function ss(k) { return safe(function () { return sessionStorage.getItem(k); }, "ss"); }
  function ssSet(k, v) { safe(function () { sessionStorage.setItem(k, v); }, "ss"); }
  function ssDel(k) { safe(function () { sessionStorage.removeItem(k); }, "ss"); }
  function jparse(v, d) { try { return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function throttle(fn, ms) {
    var last = 0;
    return function () { var n = Date.now(); if (n - last >= ms) { last = n; fn.apply(null, arguments); } };
  }
  function uuid() {
    try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  /* ───────── install tag ───────── */
  var scriptEl = document.currentScript;
  if (!scriptEl) {
    var all = document.getElementsByTagName("script");
    for (var i = all.length - 1; i >= 0; i--) {
      if (all[i].src && all[i].src.indexOf("/embed.js") > -1) { scriptEl = all[i]; break; }
    }
  }
  if (!scriptEl) return;
  var SITE_KEY = scriptEl.getAttribute("data-site") || scriptEl.getAttribute("data-key") || "";
  if (!SITE_KEY) { safe(function () { SITE_KEY = new URL(scriptEl.src, location.href).searchParams.get("s") || ""; }, "key"); }
  if (!SITE_KEY) return;

  var PREVIEW = "";
  safe(function () { PREVIEW = new URLSearchParams(location.search).get("revbounce_preview") || ""; }, "prev");

  /* ───────── §7.5 consent & visitor identity ───────── */
  function consentGranted() {
    try {
      if (window.revbounceConsent === false) return false;           // publisher flag
      if (navigator.globalPrivacyControl === true) return false;     // GPC
      if (navigator.doNotTrack === "1" || window.doNotTrack === "1") return false;
      return true;
    } catch (e) { return true; }
  }
  var CONSENT = consentGranted();

  function cookieGet(n) {
    try {
      var m = document.cookie.match("(?:^|; )" + n + "=([^;]*)");
      return m ? decodeURIComponent(m[1]) : "";
    } catch (e) { return ""; }
  }
  function cookieSet(n, v, days) {
    safe(function () {
      var d = new Date(Date.now() + days * 86400000).toUTCString();
      document.cookie = n + "=" + encodeURIComponent(v) + ";expires=" + d + ";path=/;SameSite=Lax";
    }, "cookie");
  }

  /* first-party only, no fingerprinting; session-scoped when consent is withheld */
  var VISITOR_ID = "";
  (function () {
    if (!CONSENT) { VISITOR_ID = "anon-" + uuid().slice(0, 8); return; }
    VISITOR_ID = cookieGet(VID_KEY) || ls(VID_KEY) || "";
    if (!VISITOR_ID) VISITOR_ID = uuid();
    cookieSet(VID_KEY, VISITOR_ID, 365);
    lsSet(VID_KEY, VISITOR_ID);
  })();

  var SESSION_ID = ss("rb_sid") || ("s_" + uuid().slice(0, 12));
  ssSet("rb_sid", SESSION_ID);
  var RETURNING = CONSENT ? !!ls(VISIT_KEY) : false;
  if (CONSENT) lsSet(VISIT_KEY, "1");

  /* ───────── device ───────── */
  function deviceType() {
    var ua = navigator.userAgent || "";
    var touch = ("ontouchstart" in window) || (navigator.maxTouchPoints || 0) > 0;
    var w = window.innerWidth || 1024;
    if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (touch && w >= 768 && w <= 1180)) return "tablet";
    if (/Mobi|Android|iPhone|iPod/i.test(ua) || (touch && w < 768)) return "mobile";
    return "desktop";
  }
  var DEVICE = deviceType();

  /* ───────── §7.6 events ───────── */
  var utm = {};
  safe(function () {
    var q = new URLSearchParams(location.search);
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach(function (k) {
      var v = q.get(k); if (v) utm[k] = v;
    });
  }, "utm");

  var queue = [];
  var ctx = { popId: "", popVersion: 0, campaignId: "", triggerType: "", clickId: "" };
  function emit(type, extra) {
    if (PREVIEW || KILLED) return;
    safe(function () {
      var e = extra || {};
      queue.push({
        id: uuid(), type: type,
        popId: e.popId || ctx.popId, popVersion: e.popVersion || ctx.popVersion,
        campaignId: e.campaignId !== undefined ? e.campaignId : ctx.campaignId,
        deviceType: DEVICE, triggerType: e.triggerType || ctx.triggerType,
        tsClient: Date.now(), sessionId: SESSION_ID, visitorId: VISITOR_ID,
        pageUrl: location.href, referrer: document.referrer || "",
        utm: utm, clickId: e.clickId || ctx.clickId || "", note: e.note || ""
      });
      log("event", type, e);
      if (queue.length >= 12) flush();
    }, "evt");
  }
  function flush() {
    safe(function () {
      if (!queue.length) return;
      var payload = JSON.stringify({ site: SITE_KEY, token: SESSION_TOKEN, events: queue });
      queue = [];
      var sent = false;
      if (navigator.sendBeacon) {
        try { sent = navigator.sendBeacon(ORIGIN + "/api/public/events", new Blob([payload], { type: "text/plain" })); } catch (e) {}
      }
      if (!sent && window.fetch) {
        fetch(ORIGIN + "/api/public/events", { method: "POST", body: payload, keepalive: true, headers: { "Content-Type": "text/plain" } })["catch"](function () {});
      }
    }, "flush");
  }
  var flushTimer = setInterval(flush, 3000);
  safe(function () {
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") flush(); }, { passive: true });
    window.addEventListener("pagehide", flush, { passive: true });
  }, "flushhooks");

  /* ───────── §7.4 cross-tab lock ───────── */
  var TAB_ID = uuid().slice(0, 8);
  var bc = null;
  safe(function () { if (window.BroadcastChannel) bc = new BroadcastChannel("revbounce_" + SITE_KEY); }, "bc");

  function lockRead() { return jparse(ls(LOCK_KEY), null); }
  function lockHeldElsewhere() {
    var l = lockRead();
    if (!l) return false;
    if (l.tab === TAB_ID) return false;
    return Date.now() - l.ts < 90000;          // stale locks expire
  }
  function lockAcquire() {
    if (lockHeldElsewhere()) return false;
    lsSet(LOCK_KEY, JSON.stringify({ tab: TAB_ID, ts: Date.now() }));
    safe(function () { bc && bc.postMessage({ t: "lock", tab: TAB_ID }); }, "bc");
    return true;
  }
  function lockRelease() {
    var l = lockRead();
    if (l && l.tab === TAB_ID) safe(function () { localStorage.removeItem(LOCK_KEY); }, "lock");
    safe(function () { bc && bc.postMessage({ t: "unlock", tab: TAB_ID }); }, "bc");
  }
  safe(function () {
    if (bc) bc.onmessage = function (m) {
      if (!m || !m.data || m.data.tab === TAB_ID) return;
      if (m.data.t === "lock" && openRec && !openRec.closed) closePop(openRec, openRec.pop, "silent");
    };
    window.addEventListener("storage", function (e) {
      if (e.key !== LOCK_KEY || !e.newValue) return;
      var l = jparse(e.newValue, null);
      if (l && l.tab !== TAB_ID && openRec && !openRec.closed) closePop(openRec, openRec.pop, "silent");
    });
    window.addEventListener("pagehide", lockRelease);
  }, "bcwire");

  /* ───────── §7.5 frequency (per-pop first-party keys) ───────── */
  function freqKey(popId) { return CAP_PREFIX + popId; }
  function freqList(popId) { return jparse(ls(freqKey(popId)), []) || []; }
  function freqRecord(pop) {
    if (PREVIEW) return;
    safe(function () {
      var l = freqList(pop.id);
      l.push(Date.now());
      if (l.length > 120) l = l.slice(-120);
      lsSet(freqKey(pop.id), JSON.stringify(l));
      ssSet("rb_shown:" + pop.id, "1");
    }, "freq");
  }
  function frequencyBlocked(pop) {
    if (PREVIEW) return false;
    var f = pop.frequency || {}, list = freqList(pop.id), now = Date.now();
    if (f.mode === "session") return ss("rb_shown:" + pop.id) === "1";
    if (f.mode === "cooldown") {
      var cut = now - (f.cooldownHours || 24) * 3600000;
      for (var i = 0; i < list.length; i++) if (list[i] > cut) return true;
      return false;
    }
    var today = 0, dayCut = now - 86400000;
    for (var j = 0; j < list.length; j++) if (list[j] > dayCut) today++;
    if (today >= (f.maxPerDay || 2)) return true;
    return list.length >= (f.maxLifetime || 12);
  }

  /* ───────── URL rules / eligibility ───────── */
  function pathMatches(rule, path) {
    if (!rule) return false;
    if (rule.charAt(0) === "~") { try { return new RegExp(rule.slice(1)).test(path); } catch (e) { return false; } }
    var rx = "^" + rule.split("*").map(function (p) { return p.replace(/[.+?^$\{\}()|[\]\\]/g, "\\$&"); }).join(".*") + "$";
    try { return new RegExp(rx).test(path); } catch (e) { return false; }
  }
  function urlAllowed(pop) {
    var path = location.pathname || "/", r = pop.rules || {};
    var inc = (r.include && r.include.length) ? r.include : ["/*"], ok = false;
    for (var i = 0; i < inc.length; i++) if (pathMatches(inc[i], path)) { ok = true; break; }
    if (!ok) return false;
    var exc = r.exclude || [];
    for (var j = 0; j < exc.length; j++) if (pathMatches(exc[j], path)) return false;
    return true;
  }
  function eligible(pop, geo) {
    if (PREVIEW) return pop.id === PREVIEW;
    var r = pop.rules || {};
    if ((r.devices || []).indexOf(DEVICE) === -1) return false;
    if (!urlAllowed(pop)) return false;
    var t = pop.targeting || {};
    if (t.countries && t.countries.length && geo && t.countries.indexOf(geo) === -1) return false;
    if (t.visitor === "new" && RETURNING) return false;
    if (t.visitor === "returning" && !RETURNING) return false;
    if (frequencyBlocked(pop)) return false;
    return true;
  }
  function campaignEligible(c, geo) {
    if (!c) return false;
    if (c.capped) return false;
    if (skippedCampaigns[c.id]) return false;                 // §7.4 server-marked
    if ((c.devices || []).indexOf(DEVICE) === -1) return false;
    if (c.countries && c.countries.length && geo && c.countries.indexOf(geo) === -1) return false;
    if ((c.kind === "cpa" || c.kind === "gfeed") && !/^https?:\/\//i.test(c.url || "")) return false;
    return true;
  }
  var skippedCampaigns = {};

  /* ───────── §7.7 pre-fill ───────── */
  var prefill = {};
  function collectPrefill(cfg) {
    safe(function () {
      var stored = jparse(ss("rb_prefill"), null);
      if (stored) prefill = stored;
      var d = window.revbounceData;
      if (d && typeof d === "object") {
        ["first_name", "last_name", "email", "phone", "zip", "address"].forEach(function (k) {
          if (typeof d[k] === "string" && d[k]) prefill[k] = d[k];
        });
      }
      // selector → field mapping from the Integrations step
      var maps = (cfg && cfg.prefillSelectors) || [];
      for (var i = 0; i < maps.length; i++) {
        var el = document.querySelector(maps[i].selector);
        if (el && el.value) prefill[maps[i].field] = String(el.value);
      }
      // held in sessionStorage only — never posted until the visitor submits
      ssSet("rb_prefill", JSON.stringify(prefill));
    }, "prefill");
  }

  /* ───────── styles ───────── */
  var CSS = [
    ".rbw{box-sizing:border-box;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#0b1b3a}",
    ".rbw *,.rbw *::before,.rbw *::after{box-sizing:border-box;margin:0;padding:0;border:0}",
    ".rbw button{font:inherit;color:inherit;background:none;cursor:pointer}",
    ".rbw input,.rbw select{font:inherit;outline:none;width:100%}",
    "@keyframes rbFade{from{opacity:0}to{opacity:1}}",
    "@keyframes rbSlide{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:none}}",
    "@keyframes rbZoom{from{opacity:0;transform:scale(.93)}to{opacity:1;transform:none}}",
    "@keyframes rbDrop{from{opacity:0;max-height:0}to{opacity:1;max-height:460px}}",
    ".anim-fade{animation:rbFade .32s ease both}.anim-slide{animation:rbSlide .42s cubic-bezier(.2,.9,.3,1.1) both}.anim-zoom{animation:rbZoom .38s cubic-bezier(.2,.9,.3,1.15) both}",
    ".x{position:absolute;top:12px;right:12px;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:999px;color:#8ea3c4;background:#f3f7fd;transition:all .25s;z-index:5}",
    ".x:hover{background:#e6eefc;color:#0b1b3a;transform:rotate(90deg)}",
    ".x:focus-visible{outline:2px solid #d9b380;outline-offset:2px}",
    ".btn{display:inline-flex;align-items:center;justify-content:center;padding:14px 22px;border-radius:999px;font-weight:700;font-size:14px;color:#fff;transition:transform .18s,filter .18s;text-decoration:none}",
    ".btn:hover{transform:translateY(-1px);filter:brightness(1.08)}",
    ".btn:focus-visible{outline:2px solid #fff;outline-offset:2px}",
    ".btn[disabled]{opacity:.55;cursor:wait;transform:none}",
    ".row{display:flex;gap:10px;margin-top:4px}.row .btn{flex:1}",
    ".kick{font-size:10px;font-weight:700;letter-spacing:.3em;text-transform:uppercase;color:#8b5cf6}",
    ".h{font-weight:800;line-height:1.2;color:#0b1b3a;letter-spacing:-.01em}",
    ".s{color:#0066ff;font-size:14px;font-weight:600;line-height:1.5}",
    ".slot{background:#f3f7fd;border:1px dashed #cfdcf0;border-radius:12px;color:#8ea3c4;font-size:12.5px;padding:18px;text-align:center;margin:14px 0}",
    ".count{font-size:10px;letter-spacing:.2em;text-transform:uppercase;font-weight:700;color:#8ea3c4}",
    ".form{overflow:hidden;animation:rbDrop .4s ease both;margin-top:12px;display:flex;flex-direction:column;gap:8px}",
    ".field{background:#fff;border:1px solid #e3eaf5;border-radius:10px;padding:12px 13px;font-size:13.5px;color:#0b1b3a;transition:border-color .2s}",
    ".field:focus{border-color:#0066ff;box-shadow:0 0 0 3px rgba(0,102,255,.13)}.field::placeholder{color:#a8b8d4}",
    ".err{color:#ff2d2d;font-size:11.5px;min-height:14px}",
    ".ok{display:flex;flex-direction:column;align-items:center;gap:10px;padding:18px 6px;text-align:center}",
    ".fine{color:#8ea3c4;font-size:10.5px;line-height:1.5}",
    ".brand{display:block;font-size:9px;font-weight:700;letter-spacing:.28em;text-transform:uppercase;color:#a8b8d4;margin-top:14px}",
    ".consent{display:flex;gap:8px;align-items:flex-start;font-size:11.5px;color:#5b6b8c}",
    ".consent input{width:auto;margin-top:2px;accent-color:#d9b380}"
  ].join("");

  /* ───────── rendering ───────── */
  var openRec = null;

  function buildHost(pop) {
    var host = document.createElement("div");
    host.setAttribute("data-revbounce", pop.id);
    host.style.cssText = "all:initial;position:fixed;z-index:2147483647;";
    if (pop.template === "corner") host.style.cssText += DEVICE === "mobile" ? "left:12px;right:12px;bottom:12px;" : "right:24px;bottom:24px;width:360px;";
    else if (pop.template === "ribbon") host.style.cssText += "left:0;right:0;bottom:0;";
    else host.style.cssText += "inset:0;display:flex;align-items:center;justify-content:center;padding:16px;";
    return { host: host, shadow: host.attachShadow ? host.attachShadow({ mode: "open" }) : null };
  }
  function animClass(pop) { return pop.animation === "slide" ? "anim-slide" : pop.animation === "zoom" ? "anim-zoom" : "anim-fade"; }

  function cardShell(pop, inner, overlay) {
    var wide = DEVICE === "desktop" && pop.template !== "corner" && pop.template !== "ribbon";
    var ov = overlay ? '<div class="ovl" data-close-overlay style="position:absolute;inset:0;background:' + esc(pop.overlayColor) + ';opacity:' + (pop.overlayOpacity / 100) + '"></div>' : "";
    var media = (pop.image && pop.imagePosition !== "background" && pop.template !== "ribbon")
      ? '<div style="' + (pop.imagePosition === "top" ? "height:120px;width:100%;" : "width:38%;min-height:240px;") + 'background:url(' + esc(pop.image) + ') center/cover;flex:none"></div>' : "";
    var bg = (pop.image && pop.imagePosition === "background")
      ? '<div style="position:absolute;inset:0;background:url(' + esc(pop.image) + ') center/cover;opacity:.22;pointer-events:none"></div>' : "";
    var dir = pop.imagePosition === "left" ? "row" : pop.imagePosition === "right" ? "row-reverse" : "column";
    return ov +
      '<div class="card ' + animClass(pop) + '" role="dialog" aria-modal="true" aria-label="' + esc(pop.headline) + '" tabindex="-1" style="position:relative;width:100%;max-width:' +
      (pop.template === "corner" ? "100%" : wide ? "660px" : "360px") + ';background:' + esc(pop.bg) +
      ';border:1px solid #e3eaf5;border-radius:' + (pop.radius || 16) + 'px;overflow:hidden;box-shadow:0 30px 70px -20px rgba(11,27,58,.45);display:flex;flex-direction:' + (wide ? dir : "column") + '">' +
      bg + (wide ? media : (pop.imagePosition === "top" ? media : "")) +
      '<div class="body" style="position:relative;flex:1;padding:' + (DEVICE === "mobile" ? "20px" : "26px 28px") + '">' + inner + "</div>" +
      '<button class="x" data-close aria-label="Close">✕</button></div>';
  }

  function mount(pop, inner, overlay) {
    var sh = buildHost(pop);
    if (!sh.shadow) return null;
    var style = document.createElement("style");
    style.textContent = CSS;
    var wrap = document.createElement("div");
    wrap.className = "rbw";
    wrap.style.cssText = "width:100%;display:flex;align-items:center;justify-content:center";
    wrap.innerHTML = cardShell(pop, inner, overlay);
    sh.shadow.appendChild(style);
    sh.shadow.appendChild(wrap);
    document.body.appendChild(sh.host);
    return { host: sh.host, shadow: sh.shadow, wrap: wrap, closed: false };
  }

  function wireA11y(rec, pop) {
    var card = rec.wrap.querySelector(".card");
    safe(function () { card && card.focus(); }, "focus");
    if (rec.keyHandler) document.removeEventListener("keydown", rec.keyHandler, true);
    rec.keyHandler = function (e) {
      if (e.key === "Escape") { closePop(rec, pop, "close"); return; }
      if (e.key !== "Tab") return;
      var f = rec.wrap.querySelectorAll('button,a[href],input,select,[tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1], active = rec.shadow.activeElement;
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", rec.keyHandler, true);
    var closers = rec.wrap.querySelectorAll("[data-close]");
    for (var i = 0; i < closers.length; i++) closers[i].addEventListener("click", function (e) { e.preventDefault(); closePop(rec, pop, "close"); });
    if (pop.closeOnOverlay !== false) {
      var ov = rec.wrap.querySelector("[data-close-overlay]");
      if (ov) ov.addEventListener("click", function () { closePop(rec, pop, "close"); });
    }
  }

  function closePop(rec, pop, reason) {
    safe(function () {
      if (!rec || rec.closed) return;
      rec.closed = true;
      if (reason === "close") {
        emit("pop_close", { popId: pop.id, popVersion: pop.version });
        seqSet(pop, { status: "closed" });
        if ((pop.frequency || {}).closeCountsAsDisplay !== false) { /* already counted at display */ }
      }
      if (rec.keyHandler) document.removeEventListener("keydown", rec.keyHandler, true);
      rec.host.style.transition = "opacity .25s ease";
      rec.host.style.opacity = "0";
      setTimeout(function () { safe(function () { rec.host.parentNode && rec.host.parentNode.removeChild(rec.host); }, "rm"); }, 260);
      if (openRec === rec) openRec = null;
      lockRelease();
      flush();
    }, "close");
  }

  /* ───────── §7.3 / §7.4 sequence state ───────── */
  function seqKey(pop) { return SEQ_KEY + pop.id + ":" + pop.version; }
  function seqGet(pop) { return jparse(ss(seqKey(pop)), null); }
  function seqSet(pop, patch) {
    var cur = seqGet(pop) || {}, next = {};
    for (var k in cur) next[k] = cur[k];
    for (var k2 in patch) next[k2] = patch[k2];
    ssSet(seqKey(pop), JSON.stringify(next));
    return next;
  }
  function initSequence(pop, geo) {
    var order = [];
    for (var i = 0; i < (pop.campaigns || []).length; i++) if (campaignEligible(pop.campaigns[i], geo)) order.push(pop.campaigns[i].id);
    var st = { popId: pop.id, version: pop.version, order: order, index: 0, shown: [], status: "active", sessionId: SESSION_ID, startedAt: Date.now() };
    ssSet(seqKey(pop), JSON.stringify(st));
    return st;
  }
  function campaignById(pop, id) {
    for (var i = 0; i < (pop.campaigns || []).length; i++) if (pop.campaigns[i].id === id) return pop.campaigns[i];
    return null;
  }

  function renderOffer(pop, geo) {
    var st = seqGet(pop);
    /* §7.4 refresh mid-sequence → resume at the current campaign on the
       version that was loaded; a bumped version starts fresh. */
    if (!st || st.version !== pop.version || st.status === "closed" || st.status === "completed") st = initSequence(pop, geo);
    else log("resuming sequence at index", st.index);
    if (!st.order.length) return;                       /* zero eligible → never fires */
    showCampaign(pop, st, geo, true);
  }

  function showCampaign(pop, st, geo, fresh) {
    safe(function () {
      while (st.index < st.order.length) {
        var cid = st.order[st.index], cc = campaignById(pop, cid);
        if (campaignEligible(cc, geo) && (fresh || st.shown.indexOf(cid) === -1)) break;
        st.index++;
      }
      if (st.index >= st.order.length) { endSequence(pop, st); return; }
      var c = campaignById(pop, st.order[st.index]);
      if (st.shown.indexOf(c.id) === -1) st.shown.push(c.id);
      seqSet(pop, { index: st.index, shown: st.shown, status: "active" });
      ctx.popId = pop.id; ctx.popVersion = pop.version; ctx.campaignId = c.id;
      ctx.triggerType = (pop.rules || {}).trigger || "exit";

      var counter = pop.showCounter ? '<p class="count" style="color:' + esc(pop.accent) + ';margin-bottom:8px">' + (st.index + 1) + " of " + st.order.length + "</p>" : "";
      var inner = counter +
        '<p class="kick" style="color:' + esc(pop.accent) + '">' + esc(pop.sub || "Exclusive offer") + "</p>" +
        '<h2 class="h" style="font-size:' + (DEVICE === "mobile" ? "20px" : "25px") + ';margin:10px 26px 10px 0">' + esc(c.headline || pop.headline) + "</h2>" +
        '<p class="s" style="margin-bottom:6px">' + esc(pop.sub || "") + "</p>" +
        '<div class="slot">' + esc(c.description) + "</div>" +
        '<div class="row"><button class="btn" data-yes style="background:' + esc(pop.yesColor || "#0066FF") + '">' + esc(c.yesText || pop.yesText) + "</button>" +
        '<button class="btn" data-no style="background:' + esc(pop.noColor || "#FF2D2D") + '">' + esc(c.noText || pop.noText) + "</button></div>" +
        '<div data-slot></div><span class="brand" style="color:' + esc(pop.accent) + '">Powered by RevBounce</span>';

      if (fresh || !openRec || openRec.closed) {
        if (!lockAcquire()) { log("another tab holds the lock"); return; }   /* §7.4 */
        var rec = mount(pop, inner, pop.template !== "corner" && pop.template !== "ribbon");
        if (!rec) return;
        openRec = rec; rec.pop = pop; rec.geo = geo;
        wireA11y(rec, pop);
        emit("pop_impression", { popId: pop.id, popVersion: pop.version, campaignId: "" });
        freqRecord(pop);
      } else {
        var body = openRec.wrap.querySelector(".body");
        if (body) body.innerHTML = inner;
        wireA11y(openRec, pop);
      }
      emit("campaign_impression", { campaignId: c.id });
      wireCampaign(pop, st, c, geo);
    }, "showCampaign");
  }

  function advance(pop, st, geo) {
    st.index++;
    seqSet(pop, { index: st.index, pending: "" });
    var more = false;
    for (var i = st.index; i < st.order.length; i++) if (campaignEligible(campaignById(pop, st.order[i]), geo)) { more = true; break; }
    if (!more) { endSequence(pop, st); return; }
    showCampaign(pop, st, geo, false);
  }

  function wireCampaign(pop, st, c, geo) {
    if (!openRec) return;
    var yes = openRec.wrap.querySelector("[data-yes]");
    var no = openRec.wrap.querySelector("[data-no]");
    var slot = openRec.wrap.querySelector("[data-slot]");

    if (no) no.addEventListener("click", function () {
      emit("no_click", { campaignId: c.id });
      var last = true;
      for (var i = st.index + 1; i < st.order.length; i++) if (campaignEligible(campaignById(pop, st.order[i]), geo)) { last = false; break; }
      if (last && pop.closeOnFinalNo !== false) { endSequence(pop, st); return; }
      advance(pop, st, geo);
    });
    if (!yes) return;

    /* Host & Post — inline form with §7.7 pre-fill */
    if (c.kind === "hostpost") {
      yes.addEventListener("click", function () {
        emit("yes_click", { campaignId: c.id });
        if (slot.getAttribute("data-open") === "1") return;
        slot.setAttribute("data-open", "1");
        var fields = c.fields || [{ id: "email", type: "email", label: "Email address", required: true }];
        var html = '<div class="form">', anyPrefilled = false;
        for (var i = 0; i < fields.length; i++) {
          var f = fields[i];
          var pv = (f.prefill !== false && prefill[f.id]) ? prefill[f.id] : "";
          if (pv) anyPrefilled = true;
          if (f.type === "consent") html += '<label class="consent"><input type="checkbox" data-f="' + esc(f.id) + '"><span>' + esc(f.label) + "</span></label>";
          else if (f.type === "select") html += '<select class="field" data-f="' + esc(f.id) + '">' + (f.options || "").split("|").map(function (o) { return "<option>" + esc(o) + "</option>"; }).join("") + "</select>";
          else {
            var it = f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text";
            html += '<input class="field" type="' + it + '" data-f="' + esc(f.id) + '" value="' + esc(pv) + '" placeholder="' + esc(f.label) + '">';
          }
        }
        if (anyPrefilled) html += '<span class="fine">Some details were filled from this page. Edit anything before submitting.</span>';
        html += '<span class="err" data-err></span><button class="btn" data-submit style="background:' + esc(pop.yesColor) + '">Submit &amp; continue</button>' +
          '<span class="fine">Delivered server-side. Never sold, never spammed.</span></div>';
        slot.innerHTML = html;

        var btn = slot.querySelector("[data-submit]"), errEl = slot.querySelector("[data-err]");
        btn.addEventListener("click", function () {
          var payload = { site: SITE_KEY, pop: pop.id, campaign: c.id }, bad = "";
          for (var k = 0; k < fields.length; k++) {
            var fd = fields[k], el = slot.querySelector('[data-f="' + fd.id + '"]');
            if (!el) continue;
            var val = fd.type === "consent" ? (el.checked ? "1" : "") : (el.value || "").trim();
            if (fd.required && !val) bad = bad || "Please complete: " + fd.label;
            if (fd.type === "email" && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) bad = bad || "Please enter a valid email address.";
            if (fd.pattern && val) { try { if (!new RegExp(fd.pattern).test(val)) bad = bad || ("Check the format of " + fd.label); } catch (e) {} }
            payload[fd.id] = val;
          }
          if (bad) { errEl.textContent = bad; return; }
          errEl.textContent = ""; btn.disabled = true; btn.textContent = "Submitting…";
          emit("submission_attempt", { campaignId: c.id });
          fetch(ORIGIN + "/api/public/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
            .then(function (r) { return r.json(); })
            .then(function (res) {
              if (!res || !res.ok) throw new Error("rejected");
              emit("submission_success", { campaignId: c.id });
              flush();
              slot.innerHTML = '<div class="ok"><span style="font-size:26px;color:' + esc(pop.accent) + '">✓</span><p style="font-weight:600">Thanks — you are in.</p></div>';
              setTimeout(function () {
                if (pop.closeOnYes) { closePop(openRec, pop, "done"); return; }
                advance(pop, st, geo);
              }, 1200);
            })["catch"](function () {
              emit("submission_failure", { campaignId: c.id });
              errEl.textContent = "We couldn't submit that — please try again.";
              btn.disabled = false; btn.textContent = "Submit & continue";
            });
        });
      });
      return;
    }

    /* CPA / feed link-out — server click id, §7.4 skipped handling */
    yes.addEventListener("click", function () {
      emit("yes_click", { campaignId: c.id });
      var localId = "cl_local_" + uuid().slice(0, 8), done = false;
      var openWith = function (clickId) {
        ctx.clickId = clickId;
        var url = (c.url || "").replace("{click_id}", clickId).replace("{site_id}", SITE_KEY)
          .replace("{pop_id}", pop.id).replace(/\{sub[1-5]\}/g, "rb");
        var win = null;
        try { win = window.open(url, "_blank", "noopener"); } catch (e) {}
        emit("outbound_click", { campaignId: c.id, clickId: clickId });
        if (!win) {
          slot.innerHTML = '<div class="form"><a class="btn" href="' + esc(url) + '" target="_blank" rel="noopener" style="background:' + esc(pop.yesColor) + '">Click here to open the offer</a></div>';
          return;
        }
        seqSet(pop, { pending: c.id });
        if (pop.advanceImmediately) advance(pop, st, geo);
        if (pop.closeOnYes) closePop(openRec, pop, "done");
      };
      var t = setTimeout(function () { if (!done) { done = true; openWith(localId); } }, 700);
      fetch(ORIGIN + "/api/public/click", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ site: SITE_KEY, pop: pop.id, campaign: c.id }) })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (done) return; done = true; clearTimeout(t);
          if (res && res.skipped) {                       /* stale config → advance */
            skippedCampaigns[c.id] = 1;
            log("campaign skipped by server", c.id);
            advance(pop, st, geo);
            return;
          }
          openWith(res && res.clickId ? res.clickId : localId);
        })["catch"](function () { if (!done) { done = true; clearTimeout(t); openWith(localId); } });
    });
  }

  function endSequence(pop, st) {
    seqSet(pop, { status: "completed" });
    emit("sequence_complete", { popId: pop.id, popVersion: pop.version, campaignId: "" });
    if (openRec && !openRec.closed) closePop(openRec, pop, "done");
  }

  /* resume pending link-out when the visitor returns */
  safe(function () {
    var resume = function () {
      if (!openRec || openRec.closed || !openRec.pop) return;
      var pop = openRec.pop, geo = openRec.geo, st = seqGet(pop);
      if (!st || !st.pending) return;
      var pending = st.pending;
      seqSet(pop, { pending: "" });
      emit("campaign_impression", { campaignId: pending, note: "returned" });
      advance(pop, st, geo);
    };
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") resume(); }, { passive: true });
    window.addEventListener("focus", resume, { passive: true });
  }, "resume");

  /* ───────── email capture ───────── */
  function renderEmail(pop) {
    var ec = pop.emailCapture || {};
    if (!lockAcquire()) return;
    var pv = prefill.email || "";
    var inner =
      '<p class="kick" style="color:' + esc(pop.accent) + '">Newsletter</p>' +
      '<h2 class="h" style="font-size:' + (DEVICE === "mobile" ? "19px" : "23px") + ';margin:10px 26px 8px 0">' + esc(pop.headline) + "</h2>" +
      '<p class="s" style="margin-bottom:12px">' + esc(pop.sub) + "</p>" +
      '<div class="form" style="animation:none">' +
      '<input class="field" type="email" data-email value="' + esc(pv) + '" placeholder="' + esc(ec.placeholder || "you@email.com") + '">' +
      (pv ? '<span class="fine">Pre-filled from this page — edit if needed.</span>' : "") +
      (ec.requireConsent ? '<label class="consent"><input type="checkbox" data-consent><span>' + esc(ec.consentText || "I agree to receive emails.") + "</span></label>" : "") +
      '<span class="err" data-err></span>' +
      '<button class="btn" data-sub style="background:' + esc(pop.yesColor) + '">' + esc(pop.yesText) + "</button>" +
      '<button data-close style="color:#6c6676;font-size:11.5px;padding-top:2px">' + esc(pop.noText) + "</button></div>" +
      '<span class="brand" style="color:' + esc(pop.accent) + '">Powered by RevBounce</span>';

    var rec = mount(pop, inner, pop.template !== "corner" && pop.template !== "ribbon");
    if (!rec) return;
    openRec = rec; rec.pop = pop;
    ctx.popId = pop.id; ctx.popVersion = pop.version; ctx.campaignId = ""; ctx.triggerType = (pop.rules || {}).trigger || "idle";
    wireA11y(rec, pop);
    emit("pop_impression", { popId: pop.id, popVersion: pop.version });
    freqRecord(pop);

    var input = rec.wrap.querySelector("[data-email]");
    var consent = rec.wrap.querySelector("[data-consent]");
    var errEl = rec.wrap.querySelector("[data-err]");
    var btn = rec.wrap.querySelector("[data-sub]");
    var started = false;
    input.addEventListener("input", function () { if (!started) { started = true; emit("email_form_start", {}); } }, { passive: true });

    var submit = function () {
      var email = (input.value || "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = "Please enter a valid email address."; emit("email_invalid", { note: "client_format" }); return; }
      if (consent && !consent.checked) { errEl.textContent = "Please accept to continue."; return; }
      errEl.textContent = ""; btn.disabled = true; btn.textContent = "Sending…";
      emit("email_submit", {});
      fetch(ORIGIN + "/api/public/email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: SITE_KEY, pop: pop.id, email: email, consent: consent ? consent.checked : false, device: DEVICE, trigger: ctx.triggerType, pageUrl: location.href })
      }).then(function (r) { return r.json(); }).then(function (res) {
        if (!res || !res.ok) { emit("email_invalid", { note: (res && res.code) || "server" }); throw new Error(res && res.error ? res.error : "failed"); }
        if (res.duplicate) emit("email_duplicate", {});
        else emit("submission_success", {});
        flush();
        var msg = res.duplicate ? res.message : (ec.successMessage || res.message);
        var form = rec.wrap.querySelector(".form");
        form.innerHTML = '<div class="ok"><span style="font-size:28px;color:' + esc(pop.accent) + '">✓</span><p style="font-weight:600">' + esc(msg) + "</p></div>";
        if (ec.closeAfterSuccess !== false) setTimeout(function () { closePop(rec, pop, "done"); }, 2400);
      })["catch"](function (e) {
        errEl.textContent = (e && e.message) ? String(e.message) : "Something went wrong — please try again.";
        btn.disabled = false; btn.textContent = pop.yesText;
      });
    };
    btn.addEventListener("click", submit);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); submit(); } });
  }

  function showPop(pop, geo) {
    if (KILLED) return;
    if (openRec && !openRec.closed) return;
    if (lockHeldElsewhere()) { log("suppressed — pop open in another tab"); return; }
    if (pop.kind === "email-capture") renderEmail(pop);
    else renderOffer(pop, geo);
  }

  /* ───────── triggers ───────── */
  var listeners = [];
  function on(target, ev, fn, opts) {
    target.addEventListener(ev, fn, opts || { passive: true });
    listeners.push([target, ev, fn, opts]);
  }
  function teardown() {
    safe(function () {
      for (var i = 0; i < listeners.length; i++) listeners[i][0].removeEventListener(listeners[i][1], listeners[i][2], listeners[i][3]);
      listeners = [];
      clearInterval(flushTimer);
      if (openRec && !openRec.closed) closePop(openRec, openRec.pop, "silent");
      log("engine stopped");
    }, "teardown");
  }

  function armExit(pop, fire) {
    var armed = false, lastY = 0, lastT = 0;
    setTimeout(function () { armed = true; }, (pop.rules.loadDelay || 5) * 1000);
    on(document, "mousemove", throttle(function (e) { lastY = e.clientY; lastT = Date.now(); }, 60));
    on(document, "mouseout", function (e) {
      if (!armed || e.relatedTarget || e.clientY > 0) return;
      var dt = Date.now() - lastT, v = dt > 0 ? (lastY - e.clientY) / dt : 1;
      if (lastT && dt < 400 && v < 0.06) return;
      fire();
    }, false);
  }
  function armIdle(pop, fire) {
    var ms = Math.max(5, pop.rules.idleSeconds || 30) * 1000, timer = null, hidden = false;
    function clear() { if (timer) { clearTimeout(timer); timer = null; } }
    function start() { clear(); if (!hidden) timer = setTimeout(fire, ms); }
    var reset = throttle(start, 400);
    ["mousemove", "mousedown", "click", "keydown", "scroll", "touchstart", "touchmove", "wheel"].forEach(function (ev) { on(document, ev, reset); });
    on(document, "visibilitychange", function () { hidden = document.visibilityState === "hidden"; if (hidden) clear(); else start(); });
    setTimeout(start, (pop.rules.loadDelay || 5) * 1000);
  }
  function armMobileExit(pop, fire) {
    var fb = pop.rules.mobileFallback || "back-button";
    var supported = !!(window.history && history.pushState) && !/FBAN|FBAV|Instagram|Line\//i.test(navigator.userAgent || "");
    if (fb === "back-button" && supported) {
      var pushed = false, used = false;
      var push = function () { if (pushed) return; pushed = true; safe(function () { history.pushState({ rb: 1 }, "", location.href); }, "push"); };
      ["touchstart", "scroll", "click"].forEach(function (ev) { document.addEventListener(ev, push, { once: true, passive: true }); });
      on(window, "popstate", function () { if (used) return; used = true; fire(); }, false);
      setTimeout(function () { if (!used) armIdle(pop, fire); }, 45000);
    } else if (fb === "scroll-up" || pop.rules.scrollUpExit) {
      var lastY = window.scrollY, lastT = Date.now();
      on(window, "scroll", throttle(function () {
        var y = window.scrollY, t = Date.now(), dy = lastY - y, dt = t - lastT;
        lastY = y; lastT = t;
        if (dy > 90 && dt < 260 && y < 400) fire();
      }, 120));
    } else armIdle(pop, fire);
  }

  function arm(pop, geo) {
    var firedThisPage = false;
    var fire = function () {
      if (KILLED || firedThisPage) return;
      if (!eligible(pop, geo)) return;
      if (openRec && !openRec.closed) return;
      var st = seqGet(pop);
      if (st && (st.status === "closed") && !PREVIEW) return;      /* never auto-reopen */
      firedThisPage = true;
      showPop(pop, geo);
    };
    pop.__fire = fire;
    if (PREVIEW && pop.id === PREVIEW) { setTimeout(fire, 800); return; }
    if (pop.rules.trigger === "idle") { armIdle(pop, fire); return; }
    if (DEVICE === "desktop") armExit(pop, fire); else armMobileExit(pop, fire);
  }

  /* ───────── boot ───────── */
  var POPS = [], GEO = "";
  function boot(cfg) {
    safe(function () {
      if (!cfg || !cfg.pops) return;
      if (cfg.disabled) { KILLED = true; log("kill switch: config disabled"); return; }   /* §7.8 */
      var host = (location.hostname || "").toLowerCase(), domains = cfg.domains || [];
      if (domains.length) {
        var ok = false;
        for (var i = 0; i < domains.length; i++) {
          var d = String(domains[i]).toLowerCase();
          if (host === d || host.endsWith("." + d)) { ok = true; break; }
        }
        if (!ok) { log("refusing to run on", host); return; }
      }
      GEO = cfg.geo || "";
      SESSION_TOKEN = cfg.sessionToken || "";
      collectPrefill(cfg);
      POPS = cfg.pops.slice().sort(function (a, b) { return (b.priority || 0) - (a.priority || 0); });
      for (var p = 0; p < POPS.length; p++) {
        if (eligible(POPS[p], GEO) || (PREVIEW && POPS[p].id === PREVIEW)) arm(POPS[p], GEO);
      }
      log("booted", { site: SITE_KEY, device: DEVICE, consent: CONSENT, visitor: VISITOR_ID, pops: POPS.length });
    }, "boot");
  }

  function fetchConfig() {
    safe(function () {
      var cacheKey = CFG_KEY + SITE_KEY, cached = jparse(ss(cacheKey), null);
      if (cached && cached.fetchedAt && Date.now() - cached.fetchedAt < 60000) { boot(cached.cfg); return; }
      fetch(ORIGIN + "/api/public/config/" + encodeURIComponent(SITE_KEY), { credentials: "omit" })
        .then(function (r) { return r.json(); })
        .then(function (cfg) { ssSet(cacheKey, JSON.stringify({ fetchedAt: Date.now(), cfg: cfg })); boot(cfg); })
        ["catch"](function () { if (cached && cached.cfg) boot(cached.cfg); });
    }, "cfg");
  }

  /* §7.8 — boot when the browser is idle, never block rendering */
  safe(function () {
    if (window.requestIdleCallback) requestIdleCallback(fetchConfig, { timeout: 2500 });
    else setTimeout(fetchConfig, 1);
  }, "idle");

  /* ───────── §7.8 public API (single namespace) ───────── */
  window.RevBounce = {
    __loaded: true,
    version: "8",
    show: function (popId) {
      for (var i = 0; i < POPS.length; i++) if (POPS[i].id === popId) {
        ssDel(seqKey(POPS[i]));
        if (openRec && !openRec.closed) closePop(openRec, openRec.pop, "silent");
        setTimeout(function (pop) { return function () { showPop(pop, GEO); }; }(POPS[i]), 60);
        return true;
      }
      return false;
    },
    hide: function () { if (openRec && !openRec.closed) { closePop(openRec, openRec.pop, "close"); return true; } return false; },
    reset: function () {
      safe(function () {
        for (var i = 0; i < POPS.length; i++) {
          localStorage.removeItem(CAP_PREFIX + POPS[i].id);
          sessionStorage.removeItem(seqKey(POPS[i]));
          sessionStorage.removeItem("rb_shown:" + POPS[i].id);
        }
        localStorage.removeItem(LOCK_KEY);
      }, "reset");
      return true;
    },
    debug: function (on) { DEBUG = on !== false; log("debug", DEBUG); return DEBUG; },
    stop: function () { KILLED = true; teardown(); return true; },
    state: function () {
      return {
        site: SITE_KEY, device: DEVICE, geo: GEO, consent: CONSENT, visitorId: VISITOR_ID,
        sessionId: SESSION_ID, tabId: TAB_ID, lockedElsewhere: lockHeldElsewhere(),
        killed: KILLED, errors: errorCount, queued: queue.length, prefill: prefill,
        pops: POPS.map(function (p) {
          var st = seqGet(p) || {};
          return { id: p.id, kind: p.kind, version: p.version, priority: p.priority, status: st.status || "idle", index: st.index || 0, order: st.order || [] };
        })
      };
    },
    flush: flush,
    /* legacy alias used by the sandbox panel */
    trigger: function (id) { return window.RevBounce.show(id); }
  };
  window.RB_DEBUG = window.RevBounce;
})();
`;

export function GET(req: NextRequest) {
  const fwdProto = req.headers.get("x-forwarded-proto");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  const isLocal = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(host);
  const proto = isLocal ? fwdProto ?? "http" : "https";
  const js = ENGINE.replace("__ORIGIN__", `${proto}://${host}`);
  return new NextResponse(js, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
