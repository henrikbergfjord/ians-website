/*
 IANS OneDrive V3.31 · Runtime Reduction Phase 1
 Purpose:
 - No global DOM observers.
 - No permanent rediscovery timers.
 - No legacy duplicate-panel decoration at boot.
 - Advanced/heavy legacy panels stay dormant until explicitly opened by navigation.
 - Core scan/auth remains owned by app.js.

 V3.31.4 UI state addition:
 - Makes OneDrive media structure mode unmistakably visible.
 - Persists state through the existing localStorage key owned by app.js.
 - Mirrors the active mode in Organization Studio and Preview.
 - Uses only a finite boot probe + delegated click handling; no global MutationObserver.
*/
(() => {
  "use strict";
  const VERSION = "3.31.4";
  const MEDIA_MODE_KEY = "ians.v3313.useOneDriveMediaStructure";

  function markRuntime(){
    document.documentElement.dataset.iansRuntime = VERSION;
    const version = document.querySelector(".core-version");
    if(version) version.textContent = "V3.31.4 Media State";
  }

  function collapseAdvancedAtBoot(){
    const advancedIds = [
      "v293Portable",
      "v294ReviewCleaner",
      "v295DupList",
      "dupBulkPanel",
      "storageMapPanel"
    ];
    for(const id of advancedIds){
      const el = document.getElementById(id);
      if(!el) continue;
      el.dataset.iansV331Dormant = "1";
    }
  }

  function exposeDiagnostics(){
    window.IANS_V331 = Object.freeze({
      version: VERSION,
      mode: "runtime-reduction-phase1+media-state",
      observersAdded: 0,
      repeatingInitTimersAdded: 0,
      note: "Core app.js owns auth/scan and media mode logic. V3.31.4 only exposes the selected media mode clearly in the UI."
    });
  }

  function injectMediaStateStyles(){
    if(document.getElementById("ians-v3314-media-state-style")) return;
    const style = document.createElement("style");
    style.id = "ians-v3314-media-state-style";
    style.textContent = `
      #v3313OneDriveMediaMode.v3314-media-active,
      #v3313OneDriveMediaMode[aria-pressed="true"] {
        color: #dfffee !important;
        background: linear-gradient(180deg, rgba(16,185,129,.22), rgba(5,150,105,.13)) !important;
        border-color: rgba(52,211,153,.85) !important;
        box-shadow: 0 0 0 1px rgba(52,211,153,.16) inset, 0 0 18px rgba(16,185,129,.12) !important;
      }
      #v3313OneDriveMediaMode.v3314-media-active::before,
      #v3313OneDriveMediaMode[aria-pressed="true"]::before {
        content: "●";
        color: #34d399;
        margin-right: 8px;
        font-size: .82em;
      }
      .v3314-media-state {
        grid-column: 1 / -1;
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 38px;
        padding: 9px 12px;
        margin-top: 2px;
        border: 1px solid rgba(100,116,139,.28);
        border-radius: 11px;
        background: rgba(2,12,27,.42);
        color: #9fb0c6;
        font-size: 12px;
      }
      .v3314-media-state strong { color: #d7e4f5; letter-spacing: .02em; }
      .v3314-media-state[data-active="1"] {
        border-color: rgba(52,211,153,.45);
        background: rgba(6,78,59,.17);
        color: #b9f6db;
      }
      .v3314-media-state[data-active="1"] strong { color: #6ee7b7; }
      .v3314-media-dot {
        width: 9px;
        height: 9px;
        border-radius: 999px;
        flex: 0 0 auto;
        background: #64748b;
        box-shadow: 0 0 0 3px rgba(100,116,139,.12);
      }
      .v3314-media-state[data-active="1"] .v3314-media-dot {
        background: #34d399;
        box-shadow: 0 0 0 3px rgba(52,211,153,.13), 0 0 12px rgba(52,211,153,.28);
      }
      .v3314-preview-mode {
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 10px 12px;
        margin: 0 0 10px;
        border-radius: 10px;
        border: 1px solid rgba(52,211,153,.42);
        background: rgba(6,78,59,.16);
        color: #b9f6db;
        font-size: 12px;
      }
      .v3314-preview-mode strong { color: #6ee7b7; }
    `;
    document.head.appendChild(style);
  }

  function mediaModeActive(){
    return localStorage.getItem(MEDIA_MODE_KEY) === "1";
  }

  function ensureStateLine(button){
    const scope = button?.closest(".v3312-org-scope, .v3311-org-scope") || button?.parentElement;
    if(!scope) return null;
    let line = scope.querySelector(".v3314-media-state");
    if(!line){
      line = document.createElement("div");
      line.className = "v3314-media-state";
      line.setAttribute("role", "status");
      line.setAttribute("aria-live", "polite");
      scope.appendChild(line);
    }
    return line;
  }

  function syncMediaState(){
    const button = document.getElementById("v3313OneDriveMediaMode");
    if(!button) return false;
    const active = mediaModeActive();
    button.classList.toggle("v3314-media-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.title = active
      ? "Aktiv: Bilder og video følger eksisterende OneDrive mediastruktur. Klikk for å slå av."
      : "Av: IANS bruker valgt standardstruktur. Klikk for å bruke OneDrive mediastruktur.";

    const line = ensureStateLine(button);
    if(line){
      line.dataset.active = active ? "1" : "0";
      line.innerHTML = active
        ? '<span class="v3314-media-dot"></span><strong>ONEDRIVE MEDIA-STRUKTUR · AKTIV</strong><span>Bilder og video bruker eksisterende OneDrive-struktur. Valget er lagret.</span>'
        : '<span class="v3314-media-dot"></span><strong>ONEDRIVE MEDIA-STRUKTUR · AV</strong><span>Standard IANS-struktur brukes for Bilder og Video.</span>';
    }
    syncPreviewMode(active);
    return true;
  }

  function syncPreviewMode(active = mediaModeActive()){
    const preview = document.getElementById("v285OrgPreview");
    if(!preview) return;
    let banner = preview.querySelector(":scope > .v3314-preview-mode");
    if(!active){
      if(banner) banner.remove();
      return;
    }
    if(!banner){
      banner = document.createElement("div");
      banner.className = "v3314-preview-mode";
      preview.prepend(banner);
    }
    banner.innerHTML = '<span class="v3314-media-dot"></span><strong>✓ OneDrive media-struktur aktiv i denne planen</strong><span>Bilder og Video følger media-modusen.</span>';
  }

  function bindDelegatedStateSync(){
    document.addEventListener("click", (event) => {
      const target = event.target?.closest?.("button");
      if(!target) return;
      if(target.id === "v3313OneDriveMediaMode"){
        // app.js owns the actual toggle; synchronize after its click handler finishes.
        setTimeout(syncMediaState, 0);
        setTimeout(syncMediaState, 80);
      }
      if(target.id === "v285OrgBuild"){
        // renderOrg294 replaces preview contents; restore the mode banner afterwards.
        setTimeout(() => syncPreviewMode(), 0);
        setTimeout(() => syncPreviewMode(), 120);
      }
    }, false);
  }

  function finitePanelProbe(){
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      if(syncMediaState() || tries >= 24) clearInterval(timer);
    }, 250);
  }

  function boot(){
    markRuntime();
    collapseAdvancedAtBoot();
    exposeDiagnostics();
    injectMediaStateStyles();
    bindDelegatedStateSync();
    finitePanelProbe();
    console.info("[IANS V3.31.4] Runtime Reduction + persistent media mode state active");
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot, {once:true});
  }else{
    boot();
  }
})();
