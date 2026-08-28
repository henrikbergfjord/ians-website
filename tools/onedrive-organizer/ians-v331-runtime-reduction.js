/*
 IANS OneDrive V3.31 · Runtime Reduction Phase 1
 Purpose:
 - No global DOM observers.
 - No permanent rediscovery timers.
 - No legacy duplicate-panel decoration at boot.
 - Advanced/heavy legacy panels stay dormant until explicitly opened by navigation.
 - Core scan/auth remains owned by app.js.
*/
(() => {
  "use strict";
  const VERSION = "3.31.0";

  function markRuntime(){
    document.documentElement.dataset.iansRuntime = VERSION;
    const version = document.querySelector(".core-version");
    if(version) version.textContent = "V3.31 Runtime Reduction";
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
      mode: "runtime-reduction-phase1",
      observersAdded: 0,
      repeatingInitTimersAdded: 0,
      note: "Core app.js owns auth/scan. Legacy consolidated patch runtime is not loaded."
    });
  }

  function boot(){
    markRuntime();
    collapseAdvancedAtBoot();
    exposeDiagnostics();
    console.info("[IANS V3.31] Runtime Reduction Phase 1 active");
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot, {once:true});
  }else{
    boot();
  }
})();
