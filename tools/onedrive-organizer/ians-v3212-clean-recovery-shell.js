/* IANS OneDrive Command V3.21.2 · Clean Recovery Shell
   Goals:
   - keep V3.21 permanent export + V3.21.1 UI Guard
   - hide V3.18/V3.19/V3.20 recovery panels from normal workspace
   - present one clean completed-scan control surface
   - surface Microsoft session-expired state in UI
   - no Graph calls, no scan mutation, no IndexedDB writes
*/
(() => {
  "use strict";

  const VERSION = "3.21.2";
  const SHELL_ID = "ians-v3212-clean-recovery-shell";
  const SESSION_ID = "ians-v3212-session-status";
  const HIDDEN_CLASS = "ians-v3212-hidden-recovery";

  function txt(el){ return (el?.textContent || "").trim(); }

  function hideRecoveryNoise(){
    const nodes = [...document.querySelectorAll("div,section,article")];

    for(const el of nodes){
      if(el.closest(`#${SHELL_ID}`)) continue;
      const t = txt(el);

      const isV320 =
        /Checkpoint Deep Recovery/i.test(t) &&
        /checkpoint-struktur/i.test(t);

      const isV319 =
        /Recovery · ferdig skanning funnet/i.test(t) &&
        /IDB-inventar/i.test(t);

      const isLegacyCompleted =
        /^Siste ferdige skanning/i.test(t) &&
        /Last ned diagnostikk/i.test(t) &&
        !/Last ned komplett rapport/i.test(t);

      if(isV320 || isV319 || isLegacyCompleted){
        el.classList.add(HIDDEN_CLASS);
      }
    }
  }

  function findPermanentPanel(){
    const direct = document.getElementById("ians-v321-permanent-export-panel");
    if(direct) return direct;

    const candidates = [...document.querySelectorAll("div,section,article")]
      .filter(el => {
        const t = txt(el);
        return /Siste ferdige skanning/i.test(t)
          && /Last ned komplett rapport/i.test(t)
          && /Last ned checkpoint/i.test(t)
          && /Verifiser/i.test(t);
      })
      .sort((a,b)=>a.querySelectorAll("*").length-b.querySelectorAll("*").length);

    return candidates[0] || null;
  }

  function enhancePermanentPanel(){
    const panel = findPermanentPanel();
    if(!panel) return;

    panel.id = "ians-v321-permanent-export-panel";
    panel.dataset.iansCleanShell = "1";

    let badge = panel.querySelector(".ians-v3212-badge");
    if(!badge){
      badge = document.createElement("span");
      badge.className = "ians-v3212-badge";
      badge.textContent = "MASTER SCAN";
      panel.prepend(badge);
    }

    const buttons = [...panel.querySelectorAll("button,a")];
    for(const el of buttons){
      const t = txt(el);

      if(/^Last ned diagnostikk$/i.test(t)){
        el.classList.add(HIDDEN_CLASS);
      }

      if(/^Last ned skann$/i.test(t)){
        el.title = "Eksporterer hele checkpoint.report.files";
      }

      if(/^Last ned komplett rapport$/i.test(t)){
        el.title = "Eksporterer hele checkpoint.report med analyser";
      }

      if(/^Last ned checkpoint$/i.test(t)){
        el.title = "Full lokal backup for senere import/gjenoppretting";
      }
    }
  }

  function findHeaderHost(){
    return [...document.querySelectorAll("header,section,div")]
      .filter(el => /Forstå OneDrive\. Finn rotet\. Rydd trygt\./i.test(txt(el)))
      .sort((a,b)=>a.querySelectorAll("*").length-b.querySelectorAll("*").length)[0] || null;
  }

  function ensureSessionBanner(){
    if(document.getElementById(SESSION_ID)) return;

    const host = findHeaderHost();
    if(!host) return;

    const banner = document.createElement("div");
    banner.id = SESSION_ID;
    banner.className = "ians-v3212-session ians-v3212-session-ok";
    banner.innerHTML = `
      <div class="ians-v3212-session-copy">
        <strong>Microsoft-session</strong>
        <span>Ingen aktiv Graph-feil registrert.</span>
      </div>
      <button type="button" class="ians-v3212-session-action" hidden>Koble til OneDrive på nytt</button>
    `;
    host.appendChild(banner);
  }

  function setSessionState(expired, detail=""){
    ensureSessionBanner();
    const banner = document.getElementById(SESSION_ID);
    if(!banner) return;

    banner.classList.toggle("ians-v3212-session-expired", !!expired);
    banner.classList.toggle("ians-v3212-session-ok", !expired);

    const strong = banner.querySelector("strong");
    const span = banner.querySelector("span");
    const btn = banner.querySelector("button");

    if(expired){
      strong.textContent = "Microsoft-session må fornyes";
      span.textContent = detail || "Nye Graph-kall er satt på vent. Den ferdige lokale skanningen er fortsatt tilgjengelig.";
      btn.hidden = false;
      btn.onclick = () => {
        const candidates = [...document.querySelectorAll("button,a")]
          .filter(el => /Koble til OneDrive|Logg inn|Connect|Microsoft Graph/i.test(txt(el)));
        const target = candidates[0];
        if(target) target.click();
        else alert("Åpne Innstillinger og koble OneDrive/Microsoft Graph til på nytt.");
      };
    }else{
      strong.textContent = "Microsoft-session";
      span.textContent = "Klar for Graph når tilkoblingen er gyldig. Lokal master-scan er tilgjengelig.";
      btn.hidden = true;
      btn.onclick = null;
    }
  }

  function installConsoleWatch(){
    const patterns = [
      /acquireTokenSilent failed/i,
      /Microsoft-sessionen må fornyes/i,
      /timed_out/i
    ];

    const origError = console.error.bind(console);
    console.error = (...args) => {
      try{
        const msg = args.map(a => {
          if(typeof a === "string") return a;
          if(a?.message) return a.message;
          try{return JSON.stringify(a)}catch{return String(a)}
        }).join(" ");

        if(patterns.some(rx => rx.test(msg))){
          setSessionState(true, "Microsoft-tokenet ble ikke fornyet i tide. Lokal scan-data påvirkes ikke.");
        }
      }catch{}
      return origError(...args);
    };
  }

  function observeDom(){
    const observer = new MutationObserver(() => {
      requestAnimationFrame(() => {
        hideRecoveryNoise();
        enhancePermanentPanel();
        ensureSessionBanner();
      });
    });

    observer.observe(document.body || document.documentElement, {
      childList:true,
      subtree:true
    });
  }

  function init(){
    hideRecoveryNoise();
    enhancePermanentPanel();
    ensureSessionBanner();
    installConsoleWatch();
    observeDom();

    // Also inspect existing page text in case the auth error was rendered before this script loaded.
    const pageText = txt(document.body);
    if(/Microsoft-sessionen må fornyes|acquireTokenSilent failed|timed_out/i.test(pageText)){
      setSessionState(true);
    }

    console.info(`[IANS] OneDrive Command V${VERSION} Clean Recovery Shell aktiv`);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init, {once:true});
  }else{
    init();
  }
})();