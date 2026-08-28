/* IANS OneDrive Command V3.21.1 · UI Guard
   Fixes duplicated "Siste ferdige skanning" panels caused by V3.21 observer/render recursion.
   Safety:
   - no Graph calls
   - no scan mutation/deletion
   - no IndexedDB writes
   - keeps V3.21 permanent export path intact
*/
(() => {
  "use strict";

  const VERSION = "3.21.1";
  const PANEL_ID = "ians-v321-permanent-export-panel";
  const PANEL_SELECTOR = ".ians-v321-panel";
  const LEGACY_PANEL_ID = "ians-v321-permanent-export-panel";
  let observer = null;
  let scheduled = false;
  let rendering = false;

  function text(el){
    return (el?.textContent || "").trim();
  }

  function getAllV321Panels(){
    const byClass = [...document.querySelectorAll(PANEL_SELECTOR)];
    const byId = [...document.querySelectorAll(`#${CSS.escape(PANEL_ID)}, #${CSS.escape(LEGACY_PANEL_ID)}`)];
    return [...new Set([...byClass, ...byId])];
  }

  function dedupePanels(){
    const panels = getAllV321Panels();
    if (panels.length <= 1) return panels[0] || null;

    const keeper =
      panels.find(p => /Siste ferdige skanning/i.test(text(p))) ||
      panels[0];

    for (const panel of panels){
      if (panel !== keeper) panel.remove();
    }

    return keeper;
  }

  function dedupeByContent(){
    const nodes = [...document.querySelectorAll("section,article,div")];
    const candidates = nodes.filter(el => {
      const t = text(el);
      if (!/Siste ferdige skanning/i.test(t)) return false;
      if (!/Last ned komplett rapport/i.test(t)) return false;
      if (!/Last ned checkpoint/i.test(t)) return false;
      if (!/Verifiser/i.test(t)) return false;
      return true;
    });

    if (candidates.length <= 1) return candidates[0] || null;

    // Prefer the smallest matching container: the actual recovery/export card.
    candidates.sort((a,b) => a.querySelectorAll("*").length - b.querySelectorAll("*").length);
    const keeper = candidates[0];

    for (const el of candidates.slice(1)){
      // Never remove a parent that contains keeper.
      if (el.contains(keeper)) continue;
      el.remove();
    }

    return keeper;
  }

  function normalizePanel(panel){
    if (!panel) return;
    panel.id = PANEL_ID;
    panel.dataset.iansUiGuard = "1";
  }

  function removeStrayDuplicates(){
    // Covers the exact repeated card shape visible in V3.21 screenshot.
    const all = [...document.querySelectorAll("div,section,article")];
    const cards = all.filter(el => {
      if (el.id === PANEL_ID) return false;
      const t = text(el);
      const directButtons = [...el.querySelectorAll(":scope > button, :scope > div > button")];
      return /Siste ferdige skanning/i.test(t)
        && /Last ned komplett rapport/i.test(t)
        && /Last ned checkpoint/i.test(t)
        && /Verifiser/i.test(t)
        && directButtons.length >= 2
        && !el.contains(document.getElementById(PANEL_ID));
    });

    // Keep only one visible matching card if V3.21 gave them no stable id.
    if (cards.length > 1){
      cards.sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top);
      const keeper=cards[0];
      keeper.id=PANEL_ID;
      keeper.dataset.iansUiGuard="1";
      for(const card of cards.slice(1)){
        if(!card.contains(keeper)) card.remove();
      }
    }
  }

  function guardPass(){
    if (rendering) return;
    rendering = true;

    try{
      let panel = dedupePanels();
      if (!panel) panel = dedupeByContent();
      normalizePanel(panel);
      removeStrayDuplicates();

      // Final hard invariant: never allow more than one exact panel id.
      const ids = [...document.querySelectorAll(`[id="${PANEL_ID}"]`)];
      for (const el of ids.slice(1)) el.remove();
    } finally {
      rendering = false;
    }
  }

  function scheduleGuard(){
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      guardPass();
    });
  }

  function shouldReact(mutations){
    for (const mutation of mutations){
      const target = mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
      if (target?.closest?.(`[data-ians-ui-guard="1"]`)) continue;

      const added = [...(mutation.addedNodes || [])];
      if (added.some(n => {
        if (n.nodeType !== 1) return false;
        if (n.matches?.(PANEL_SELECTOR)) return true;
        if (/Siste ferdige skanning/i.test(text(n))) return true;
        return !!n.querySelector?.(PANEL_SELECTOR);
      })) return true;
    }
    return false;
  }

  function startObserver(){
    if (observer) observer.disconnect();

    observer = new MutationObserver(mutations => {
      if (rendering) return;
      if (shouldReact(mutations)) scheduleGuard();
    });

    observer.observe(document.body || document.documentElement, {
      childList:true,
      subtree:true
    });
  }

  function init(){
    guardPass();
    startObserver();

    // One delayed cleanup handles panels already queued by V3.21 before V3.21.1 loaded.
    setTimeout(guardPass, 50);
    setTimeout(guardPass, 250);
    setTimeout(guardPass, 1000);

    console.info(`[IANS] OneDrive Command V${VERSION} UI Guard aktiv`);
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init, {once:true});
  } else {
    init();
  }
})();