/* IANS OneDrive Command V3.28 · Boot Isolation
   Diagnostic-only runtime:
   - no Graph calls
   - no IndexedDB reads/writes
   - no scan/checkpoint mutation
   - detects main-thread stalls without scanning the DOM
*/
(() => {
  "use strict";

  const VERSION = "3.28";
  let last = performance.now();
  let worst = 0;
  let timer = null;

  function badge() {
    let el = document.getElementById("iansV328Boot");
    if (el) return el;
    el = document.createElement("div");
    el.id = "iansV328Boot";
    el.style.cssText =
      "position:fixed;left:18px;bottom:18px;z-index:1000000;" +
      "padding:9px 12px;border-radius:10px;background:#071827;" +
      "border:1px solid #31506a;color:#dcecff;font:12px system-ui;" +
      "box-shadow:0 8px 28px rgba(0,0,0,.28)";
    (document.body || document.documentElement).appendChild(el);
    return el;
  }

  function setStatus(text) {
    const el = badge();
    el.textContent = `IANS V${VERSION} · ${text}`;
  }

  function startWatchdog() {
    setStatus("BOOT ISOLATION AKTIV · starter hovedmotor…");
    last = performance.now();

    timer = setInterval(() => {
      const now = performance.now();
      const drift = Math.max(0, now - last - 500);
      last = now;
      worst = Math.max(worst, drift);

      if (drift > 2000) {
        setStatus(`MAIN THREAD BLOCKED ${(drift / 1000).toFixed(1)}s`);
        console.warn("[IANS V3.28] Main-thread stall", {
          driftMs: Math.round(drift),
          worstMs: Math.round(worst)
        });
      } else if (
        window.IANS_V315 ||
        window.IANS_AUTH_V314 ||
        document.getElementById("iansV30")
      ) {
        setStatus(`HOVEDMOTOR OK · worst stall ${(worst / 1000).toFixed(1)}s`);
      }
    }, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startWatchdog, { once: true });
  } else {
    startWatchdog();
  }

  window.IANS_V328_BOOT_ISOLATION = {
    version: VERSION,
    status: () => ({ worstMainThreadStallMs: Math.round(worst) }),
    stop: () => timer && clearInterval(timer)
  };

  console.info("[IANS] OneDrive Command V3.28 Boot Isolation aktiv");
})();
