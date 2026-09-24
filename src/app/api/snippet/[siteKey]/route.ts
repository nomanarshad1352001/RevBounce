import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/*
 * GET /api/snippet/:siteKey → the RevBounce delivery tag.
 * A single async script installed on a publisher's page. It:
 *  - fetches pop config server-side (no secrets ever reach the page)
 *  - arms exit / idle / scroll / timed triggers with frequency caps
 *  - renders isolated, inline-styled pops and posts events to /api/track
 *  - is wrapped in fail-safes: any error exits silently and the
 *    visitor can ALWAYS close the pop (Fail gracefully spec).
 */
const ENGINE = `
(function () {
  "use strict";
  if (window.__RB_LOADED__) return;
  window.__RB_LOADED__ = true;

  var SITE_KEY = "__SITE_KEY__";
  var ORIGIN = "__ORIGIN__";
  var LS = "rbq_caps_v1";
  var fired = {};
  var openNodes = [];
  var pops = [];

  function isMobile() {
    return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || "") || window.innerWidth < 768;
  }
  function capsGet() {
    try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch (e) { return {}; }
  }
  function capped(pop) {
    try {
      var list = capsGet()[pop.id] || [];
      var cutoff = Date.now() - (pop.perHours || 24) * 3600000;
      var n = 0;
      for (var i = 0; i < list.length; i++) if (list[i] > cutoff) n++;
      return n >= (pop.maxImpressions || 1);
    } catch (e) { return false; }
  }
  function markShown(pop) {
    try {
      var all = capsGet();
      (all[pop.id] = all[pop.id] || []).push(Date.now());
      localStorage.setItem(LS, JSON.stringify(all));
    } catch (e) {}
  }

  function track(pop, type) {
    try {
      var payload = JSON.stringify({ site: SITE_KEY, pop: pop.id, campaign: pop.campaign || "", type: type, ts: Date.now() });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ORIGIN + "/api/track", new Blob([payload], { type: "text/plain" }));
      } else if (window.fetch) {
        fetch(ORIGIN + "/api/track", { method: "POST", body: payload, keepalive: true, headers: { "Content-Type": "text/plain" } })["catch"](function () {});
      }
    } catch (e) {}
  }

  function dismiss(pop, node, reason) {
    try {
      if (!node || node.__rbClosin) return;
      node.__rbClosin = true;
      track(pop, reason || "close");
      node.style.opacity = "0";
      node.style.transform = "translateY(10px)";
      setTimeout(function () { try { node.parentNode && node.parentNode.removeChild(node); } catch (e) {} }, 260);
      var i = openNodes.indexOf(node);
      if (i > -1) openNodes.splice(i, 1);
    } catch (e) {}
  }

  document.addEventListener("keydown", function (e) {
    try {
      if (e.key === "Escape" && openNodes.length) {
        var top = openNodes[openNodes.length - 1];
        dismiss(top.__rbPop, top, "close");
      }
    } catch (e) {}
  });

  function el(tag, css) {
    var n = document.createElement(tag);
    if (css) n.style.cssText = css;
    return n;
  }

  function closeBtn(onClick, css) {
    var b = el("button", "all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:999px;color:#97919f;background:rgba(255,255,255,.06);transition:all .25s;" + (css || ""));
    b.setAttribute("aria-label", "Close");
    b.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    b.onmouseenter = function () { b.style.background = "rgba(255,255,255,.14)"; b.style.color = "#fff"; };
    b.onmouseleave = function () { b.style.background = "rgba(255,255,255,.06)"; b.style.color = "#97919f"; };
    b.onclick = function (e) { e.preventDefault(); e.stopPropagation(); onClick(); };
    return b;
  }

  function ctaBtn(pop, css) {
    var a = el("a", "all:unset;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;padding:13px 22px;border-radius:12px;font:600 14px/1 -apple-system,Segoe UI,Roboto,sans-serif;color:#16110a;background:" + pop.accent + ";box-shadow:0 12px 30px -10px " + pop.accent + "88;transition:transform .2s;" + (css || ""));
    a.href = pop.ctaUrl || "#";
    a.target = "_blank";
    a.rel = "noopener sponsored";
    a.textContent = pop.ctaText || "Learn more";
    a.onmouseenter = function () { a.style.transform = "translateY(-2px)"; };
    a.onmouseleave = function () { a.style.transform = "translateY(0)"; };
    a.onclick = function () {
      track(pop, "click");
      setTimeout(function () { track(pop, "conversion"); }, 400);
      return true;
    };
    return a;
  }

  function brand(pop, align) {
    var p = el("p", "all:unset;box-sizing:border-box;display:block;font:600 9px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.3em;text-transform:uppercase;opacity:.4;color:" + pop.accent + ";text-align:" + (align || "left") + ";");
    p.textContent = "Powered by RevBounce";
    return p;
  }

  function shell() {
    var n = el("div", "all:unset;box-sizing:border-box;display:block;position:fixed;z-index:2147483646;opacity:0;transform:translateY(10px);transition:opacity .3s ease,transform .3s ease;font-family:-apple-system,Segoe UI,Roboto,sans-serif;");
    setTimeout(function () { n.style.opacity = "1"; n.style.transform = "translateY(0)"; }, 30);
    return n;
  }

  function render(pop) {
    try {
      var node = shell();
      node.__rbPop = pop;
      var mobile = window.innerWidth < 640;
      var overlay, card, img, body, h, s, spacer;

      if (pop.template === "sovereign") {
        overlay = el("div", "position:absolute;inset:0;background:" + pop.bg + "f2;");
        node.style.cssText += ";inset:0;";
        node.appendChild(overlay);
        if (pop.image) {
          img = el("div", "position:absolute;inset:0;background:url(" + pop.image + ") center/cover;opacity:.25;");
          node.appendChild(img);
        }
        card = el("div", "position:relative;max-width:600px;margin:0 auto;padding:96px 24px 40px;text-align:center;");
        h = el("h2", "margin:14px 0 18px;font-family:Georgia,'Times New Roman',serif;color:#f5f1e6;font-weight:600;font-size:" + (mobile ? "30px" : "46px") + ";line-height:1.08;");
        h.textContent = pop.headline;
        s = el("p", "margin:0 0 32px;color:#b9b3ac;font-size:16px;line-height:1.65;");
        s.textContent = pop.sub;
        var kick = el("p", "margin:0;color:" + pop.accent + ";font:600 11px/1 -apple-system,sans-serif;letter-spacing:.4em;text-transform:uppercase;");
        kick.textContent = "Limited invitation";
        card.appendChild(kick); card.appendChild(h); card.appendChild(s);
        var row = el("div", "display:flex;gap:16px;justify-content:center;align-items:center;flex-wrap:wrap;flex-direction:" + (mobile ? "column" : "row") + ";");
        row.appendChild(ctaBtn(pop, "padding:17px 30px;font-size:16px;" + (mobile ? "width:100%;" : "")));
        var pass = closeBtn(function () { dismiss(pop, node); }, "width:auto;height:auto;background:none;padding:10px 14px;font:400 13px -apple-system,sans-serif;text-decoration:underline;");
        pass.textContent = "No thanks, I'll pass";
        row.appendChild(pass);
        card.appendChild(row);
        spacer = el("div", "height:30px;"); card.appendChild(spacer);
        card.appendChild(brand(pop, "center"));
        var xTop = closeBtn(function () { dismiss(pop, node); }, "position:absolute;top:20px;right:20px;width:36px;height:36px;");
        node.appendChild(xTop);
        overlay.onclick = function () { dismiss(pop, node); };
        overlay.style.pointerEvents = "none";
        node.appendChild(card);
      } else if (pop.template === "ribbon") {
        node.style.cssText += ";left:0;right:0;bottom:0;";
        card = el("div", "background:" + pop.bg + "f5;border-top:1px solid rgba(232,211,168,.16);backdrop-filter:blur(12px);padding:14px 20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;");
        var txt = el("div", "flex:1;min-width:200px;");
        h = el("p", "margin:0;color:#f5f1e6;font:600 14px/1.4 -apple-system,sans-serif;");
        h.textContent = pop.headline;
        s = el("p", "margin:3px 0 0;color:#97919f;font:400 12px/1.4 -apple-system,sans-serif;");
        s.textContent = pop.sub;
        txt.appendChild(h); txt.appendChild(s);
        card.appendChild(txt);
        var actions = el("div", "display:flex;align-items:center;gap:10px;");
        actions.appendChild(ctaBtn(pop, "padding:10px 16px;font-size:12px;"));
        actions.appendChild(closeBtn(function () { dismiss(pop, node); }));
        card.appendChild(actions);
        node.appendChild(card);
      } else if (pop.template === "corner") {
        node.style.cssText += mobile ? ";left:12px;right:12px;bottom:12px;" : ";right:24px;bottom:24px;width:360px;";
        card = el("div", "background:" + pop.bg + ";border:1px solid rgba(232,211,168,.16);border-radius:18px;overflow:hidden;box-shadow:0 40px 90px -20px rgba(0,0,0,.75);");
        if (pop.image) {
          img = el("div", "height:104px;background:url(" + pop.image + ") center/cover;position:relative;");
          var grad = el("div", "position:absolute;inset:0;background:linear-gradient(180deg,transparent," + pop.bg + ");");
          img.appendChild(grad);
          card.appendChild(img);
        }
        body = el("div", "padding:18px;position:relative;");
        h = el("p", "margin:0 26px 8px 0;font-family:Georgia,serif;color:#f5f1e6;font-size:18px;line-height:1.3;");
        h.textContent = pop.headline;
        s = el("p", "margin:0 0 14px;color:#97919f;font:400 12px/1.6 -apple-system,sans-serif;");
        s.textContent = pop.sub;
        body.appendChild(h); body.appendChild(s);
        body.appendChild(ctaBtn(pop, "width:100%;font-size:12px;padding:12px;"));
        spacer = el("div", "height:10px;"); body.appendChild(spacer);
        body.appendChild(brand(pop, "center"));
        var xC = closeBtn(function () { dismiss(pop, node); }, "position:absolute;top:8px;right:8px;width:24px;height:24px;");
        body.appendChild(xC);
        card.appendChild(body);
        node.appendChild(card);
      } else {
        // velvet modal
        overlay = el("div", "position:absolute;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(3px);");
        node.style.cssText += ";inset:0;display:flex;align-items:center;justify-content:center;padding:16px;";
        overlay.onclick = function () { dismiss(pop, node); };
        node.appendChild(overlay);
        card = el("div", "position:relative;width:100%;max-width:" + (mobile ? "340px" : "660px") + ";background:" + pop.bg + ";border:1px solid rgba(232,211,168,.18);border-radius:22px;overflow:hidden;box-shadow:0 40px 90px -20px rgba(0,0,0,.75);display:" + (mobile ? "block" : "grid") + ";grid-template-columns:0.9fr 1.1fr;");
        if (pop.image) {
          img = el("div", (mobile ? "height:130px;" : "min-height:320px;") + "background:url(" + pop.image + ") center/cover;position:relative;");
          var g2 = el("div", "position:absolute;inset:0;background:linear-gradient(" + (mobile ? "180deg" : "90deg") + ",transparent " + (mobile ? "0%" : "55%") + "," + pop.bg + ");");
          img.appendChild(g2);
          card.appendChild(img);
        }
        body = el("div", "padding:" + (mobile ? "22px" : "30px 34px") + ";position:relative;display:flex;flex-direction:column;justify-content:center;");
        var kick2 = el("p", "margin:0 0 10px;color:" + pop.accent + ";font:600 10px/1 -apple-system,sans-serif;letter-spacing:.35em;text-transform:uppercase;");
        kick2.textContent = "Exclusive for you";
        h = el("h3", "margin:0 26px 10px 0;font-family:Georgia,serif;color:#f5f1e6;font-size:" + (mobile ? "21px" : "26px") + ";line-height:1.2;font-weight:600;");
        h.textContent = pop.headline;
        s = el("p", "margin:0 0 20px;color:#a49ea8;font:400 13px/1.65 -apple-system,sans-serif;");
        s.textContent = pop.sub;
        body.appendChild(kick2); body.appendChild(h); body.appendChild(s);
        body.appendChild(ctaBtn(pop, mobile ? "width:100%;" : "align-self:flex-start;"));
        var later = closeBtn(function () { dismiss(pop, node, "close"); }, "width:auto;height:auto;background:none;padding:10px 0 0;font:400 11px -apple-system,sans-serif;color:#6e6879;");
        later.textContent = "Maybe later";
        body.appendChild(later);
        spacer = el("div", "height:14px;"); body.appendChild(spacer);
        body.appendChild(brand(pop));
        var xV = closeBtn(function () { dismiss(pop, node); }, "position:absolute;top:12px;right:12px;width:28px;height:28px;");
        body.appendChild(xV);
        card.appendChild(body);
        node.appendChild(card);
      }

      document.body.appendChild(node);
      openNodes.push(node);
    } catch (e) {}
  }

  function fire(pop, force) {
    try {
      if (!pop) return;
      if (!force) {
        if (fired[pop.id] || capped(pop)) return;
        if ((pop.devices || []).indexOf(isMobile() ? "mobile" : "desktop") === -1) return;
      }
      fired[pop.id] = true;
      markShown(pop);
      track(pop, "impression");
      render(pop);
    } catch (e) {}
  }

  function arm(pop) {
    try {
      var t = (pop && pop.trigger) || { type: "exit", value: 0 };
      if (t.type === "exit") {
        document.addEventListener("mouseout", function (e) {
          if (!e.relatedTarget && e.clientY <= 0) fire(pop);
        });
      } else if (t.type === "idle") {
        var ms = Math.max(5, t.value || 45) * 1000;
        var timer = setTimeout(function () { fire(pop); }, ms);
        var reset = function () {
          if (fired[pop.id]) return;
          clearTimeout(timer);
          timer = setTimeout(function () { fire(pop); }, ms);
        };
        ["mousemove", "keydown", "scroll", "touchstart", "click"].forEach(function (ev) {
          document.addEventListener(ev, reset, { passive: true });
        });
      } else if (t.type === "scroll") {
        var pct = Math.min(100, Math.max(10, t.value || 70));
        window.addEventListener("scroll", function () {
          var d = document.documentElement;
          var max = d.scrollHeight - d.clientHeight;
          if (max > 0 && (d.scrollTop / max) * 100 >= pct) fire(pop);
        }, { passive: true });
      } else if (t.type === "timed") {
        setTimeout(function () { fire(pop); }, Math.max(3, t.value || 20) * 1000);
      }
    } catch (e) {}
  }

  // Debug / demo hooks (used by the RevBounce sandbox control panel)
  window.RB_DEBUG = {
    trigger: function (tpl) {
      var found = null;
      for (var i = 0; i < pops.length; i++) if (pops[i].template === tpl) { found = pops[i]; break; }
      if (found) { fired[found.id] = false; fire(found, true); }
    },
    triggerId: function (id) {
      for (var i = 0; i < pops.length; i++) if (pops[i].id === id) { fired[id] = false; fire(pops[i], true); return; }
    },
    reset: function () {
      try { localStorage.removeItem(LS); } catch (e) {}
      fired = {};
    },
    list: function () { return pops; }
  };

  try {
    fetch(ORIGIN + "/api/pops/" + SITE_KEY)
      .then(function (r) { return r.json(); })
      .then(function (cfg) {
        pops = (cfg && cfg.pops) || [];
        pops.forEach(arm);
      })["catch"](function () { /* silent */ });
  } catch (e) {}
})();
`;

export async function GET(req: NextRequest, { params }: { params: Promise<{ siteKey: string }> }) {
  const { siteKey } = await params;
  // Derive the PUBLIC origin the browser actually reached us on —
  // req.url can be an internal bind address (0.0.0.0) behind a proxy.
  const fwdProto = req.headers.get("x-forwarded-proto");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  const isLocal = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(host);
  // Public hosts are always served over TLS (proxies may forward http internally)
  const proto = isLocal ? fwdProto ?? "http" : "https";
  const origin = `${proto}://${host}`;
  const js = ENGINE.replace("__SITE_KEY__", siteKey.replace(/[^a-zA-Z0-9_]/g, "")).replace("__ORIGIN__", origin);
  return new NextResponse(js, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
