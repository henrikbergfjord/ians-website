/* IANS OneDrive Command V3.30 · Clean Runtime Preflight
   Purpose:
   - one boot/performance gate before app.js
   - protect Chromium from enormous duplicate-result DOM writes
   - no Graph calls
   - no IndexedDB access
   - no checkpoint/scan mutation
*/
(() => {
  "use strict";

  const VERSION = "3.30";
  const INITIAL_HTML_BUDGET = 320000;
  const STEP_HTML_BUDGET = 320000;
  const MAX_INITIAL_NODES_HINT = 350;
  const state = new WeakMap();
  let worstStall = 0;
  let lastTick = performance.now();

  function isDuplicateHost(el) {
    if (!el || el.nodeType !== 1) return false;
    const id = String(el.id || "").toLowerCase();
    return id === "duplicatestable" ||
      id === "duplicategroups" ||
      id.includes("duplicatetable") ||
      id.includes("duplicatelist");
  }

  function safeCut(html, budget) {
    if (html.length <= budget) return html.length;
    let cut = Math.min(budget, html.length);

    const tags = ["</article>", "</section>", "</li>", "</tr>", "</div>"];
    let best = -1;
    for (const tag of tags) {
      const pos = html.lastIndexOf(tag, cut);
      if (pos > best) best = pos + tag.length;
    }
    if (best > Math.max(1000, cut * 0.55)) return best;
    return cut;
  }

  function footer(host, rendered, total) {
    if (rendered >= total) return "";
    const pct = total ? Math.max(1, Math.floor(rendered / total * 100)) : 0;
    return `
      <div data-ians-v330-more style="
        margin:14px 0 6px;padding:12px 14px;border-radius:10px;
        border:1px solid rgba(86,183,255,.35);background:rgba(8,24,42,.86);
        display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap">
        <span style="font:12px system-ui;color:#cfe8ff">
          V3.30 viser duplikatlisten trinnvis for å holde nettleseren responsiv · ${pct}% av HTML-visningen lastet
        </span>
        <button type="button" data-ians-v330-more-btn style="
          border:1px solid #3d7ca8;background:#123a59;color:#fff;
          border-radius:8px;padding:8px 12px;cursor:pointer">
          Vis flere
        </button>
      </div>`;
  }

  const desc = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
  if (desc?.set && desc?.get) {
    Object.defineProperty(Element.prototype, "innerHTML", {
      configurable: true,
      enumerable: desc.enumerable,
      get: desc.get,
      set(value) {
        if (!isDuplicateHost(this) || typeof value !== "string" || value.length <= INITIAL_HTML_BUDGET) {
          return desc.set.call(this, value);
        }

        let s = state.get(this);
        if (!s || s.full !== value) {
          s = { full: value, budget: INITIAL_HTML_BUDGET };
          state.set(this, s);
        }

        const cut = safeCut(s.full, s.budget);
        const partial = s.full.slice(0, cut) + footer(this, cut, s.full.length);
        console.info("[IANS V3.30] Duplicate DOM capped", {
          htmlChars: s.full.length,
          renderedChars: cut,
          nodeHint: MAX_INITIAL_NODES_HINT
        });
        return desc.set.call(this, partial);
      }
    });
  }

  const nativeInsertAdjacentHTML = Element.prototype.insertAdjacentHTML;
  Element.prototype.insertAdjacentHTML = function(position, text) {
    if (isDuplicateHost(this) && typeof text === "string" && text.length > INITIAL_HTML_BUDGET) {
      state.set(this, { full: text, budget: INITIAL_HTML_BUDGET });
      const cut = safeCut(text, INITIAL_HTML_BUDGET);
      return nativeInsertAdjacentHTML.call(
        this,
        position,
        text.slice(0, cut) + footer(this, cut, text.length)
      );
    }
    return nativeInsertAdjacentHTML.call(this, position, text);
  };

  document.addEventListener("click", (event) => {
    const btn = event.target?.closest?.("[data-ians-v330-more-btn]");
    if (!btn) return;
    const host = btn.closest("[data-ians-v330-more]")?.parentElement;
    if (!host || !isDuplicateHost(host)) return;

    const s = state.get(host);
    if (!s?.full) return;
    s.budget = Math.min(s.full.length, s.budget + STEP_HTML_BUDGET);
    const cut = safeCut(s.full, s.budget);
    desc.set.call(host, s.full.slice(0, cut) + footer(host, cut, s.full.length));
  }, true);

  function badge() {
    let el = document.getElementById("iansV330Status");
    if (el) return el;
    el = document.createElement("div");
    el.id = "iansV330Status";
    el.style.cssText =
      "position:fixed;left:18px;bottom:18px;z-index:1000001;padding:8px 11px;" +
      "border-radius:9px;background:#071827;border:1px solid #31506a;color:#dcecff;" +
      "font:12px system-ui;box-shadow:0 8px 28px rgba(0,0,0,.28)";
    (document.body || document.documentElement).appendChild(el);
    return el;
  }

  function setStatus(text) {
    badge().textContent = `IANS V${VERSION} · ${text}`;
  }

  function watchdog() {
    setStatus("CLEAN RUNTIME · starter hovedmotor…");
    setInterval(() => {
      const now = performance.now();
      const drift = Math.max(0, now - lastTick - 500);
      lastTick = now;
      worstStall = Math.max(worstStall, drift);

      if (drift > 2000) {
        setStatus(`MAIN THREAD BLOCKED ${(drift / 1000).toFixed(1)}s`);
        console.warn("[IANS V3.30] Main-thread stall", Math.round(drift), "ms");
      } else if (
        window.IANS_V315 ||
        window.IANS_AUTH_V314 ||
        document.getElementById("iansV30")
      ) {
        setStatus(`HOVEDMOTOR OK · worst ${(worstStall / 1000).toFixed(1)}s`);
      }
    }, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchdog, { once: true });
  } else {
    watchdog();
  }

  window.IANS_V330_PREFLIGHT = {
    version: VERSION,
    duplicateDomBudget: INITIAL_HTML_BUDGET,
    status: () => ({ worstMainThreadStallMs: Math.round(worstStall) })
  };

  console.info("[IANS] OneDrive Command V3.30 Clean Runtime Preflight aktiv");
})();
