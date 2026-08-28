(() => {
  "use strict";

  const VERSION = "3.24";
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
  const txt = (el) => (el?.textContent || "").trim();

  let activeGroup = null;
  let observer = null;
  let refreshTimer = null;

  function duplicatePanel(){
    return document.getElementById("dupBulkPanel")
      || document.getElementById("v295DupList")
      || document.getElementById("v294ReviewCleaner")
      || $("[data-duplicate-panel]")
      || $(".duplicate-review-panel")
      || $(".duplicate-panel")
      || $$("section,div").find(el => {
          const t = txt(el);
          return /DUPLICATE REVIEW|Rydd duplikat/i.test(t)
            && $$('input[type="checkbox"]', el).length > 0;
        })
      || null;
  }

  function groupCandidates(panel){
    if(!panel) return [];
    const explicit = $$(
      '[data-duplicate-group], .duplicate-group, .dup-group, .v323-group, .v295-dup-group',
      panel
    );
    if(explicit.length) return explicit;

    const buttons = $$("button", panel).filter(b => /Merk manuelt etter review/i.test(txt(b)));
    return buttons.map(btn => {
      let el = btn.parentElement;
      for(let i=0; i<6 && el && el !== panel; i++, el=el.parentElement){
        const cbs = $$('input[type="checkbox"]', el);
        if(cbs.length >= 2) return el;
      }
      return null;
    }).filter(Boolean);
  }

  function fileRows(group){
    const rows = $$(
      '[data-duplicate-row], .duplicate-row, .dup-row, .candidate-row, .file-row, li, tr',
      group
    ).filter(row => $('input[type="checkbox"]', row));

    if(rows.length) return rows;

    return $$('input[type="checkbox"]', group).map(cb => cb.closest("div") || cb.parentElement);
  }

  function bytesFromText(s){
    if(!s) return 0;
    const m = s.match(/([\d.,]+)\s*(B|KB|MB|GB|TB)\b/i);
    if(!m) return 0;
    let n = parseFloat(m[1].replace(/\s/g,"").replace(",","."));
    const u = m[2].toUpperCase();
    const mult = {B:1,KB:1024,MB:1024**2,GB:1024**3,TB:1024**4}[u] || 1;
    return Math.round(n * mult);
  }

  function formatBytes(n){
    if(!n || n < 1) return "0 B";
    const units = ["B","KB","MB","GB","TB"];
    let i = 0;
    let v = n;
    while(v >= 1024 && i < units.length-1){ v /= 1024; i++; }
    return `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)} ${units[i]}`;
  }

  function ensureManualModeButton(group){
    const existing = $$("button", group).find(b => /Merk manuelt etter review/i.test(txt(b)));
    if(!existing || existing.dataset.v324Bound === "1") return;

    existing.dataset.v324Bound = "1";
    existing.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      activateManualGroup(group, existing);
    }, true);
  }

  function activateManualGroup(group, button){
    if(activeGroup && activeGroup !== group){
      activeGroup.classList.remove("ians-v324-manual-active");
    }
    activeGroup = group;
    group.classList.add("ians-v324-manual-active");

    const rows = fileRows(group);
    const checks = rows.map(r => $('input[type="checkbox"]', r)).filter(Boolean);

    checks.forEach((cb, idx) => {
      cb.disabled = false;
      cb.removeAttribute("aria-disabled");
      cb.style.pointerEvents = "auto";
      cb.style.opacity = "1";

      const row = rows[idx];
      row?.classList.add("ians-v324-manual-row");

      // Første kopi er behold som standard.
      if(idx === 0){
        cb.checked = false;
        cb.dataset.v324Keep = "1";
      } else {
        cb.dataset.v324ManualCandidate = "1";
      }
    });

    if(button){
      button.textContent = "Manuell review aktiv";
      button.setAttribute("aria-pressed","true");
    }

    showNotice("Manuell review aktivert. Første kopi beholdes. Velg bare ekstrakopiene du vil behandle.");
    refreshTotals();
  }

  function bindCheckboxes(panel){
    $$('input[type="checkbox"]', panel).forEach(cb => {
      if(cb.dataset.v324Bound === "1") return;
      cb.dataset.v324Bound = "1";
      cb.addEventListener("click", () => {
        if(cb.dataset.v324Keep === "1"){
          cb.checked = false;
          showNotice("Første kopi er satt til BEHOLD. Velg en ekstrakopi i gruppen.");
        }
        refreshTotals();
      });
      cb.addEventListener("change", refreshTotals);
    });
  }

  function selectedCheckboxes(panel){
    return $$('input[type="checkbox"]:checked', panel).filter(cb => cb.dataset.v324Keep !== "1");
  }

  function updateVisibleSuggested(panel){
    const btn = $$("button", panel).find(b => /Merk synlige foreslåtte/i.test(txt(b)));
    if(!btn || btn.dataset.v324Bound === "1") return;

    btn.dataset.v324Bound = "1";
    btn.addEventListener("click", () => {
      setTimeout(() => {
        const selected = selectedCheckboxes(panel);
        if(selected.length === 0){
          showNotice("Ingen hash-verifiserte forslag i synlig område. Bruk «Merk manuelt etter review» på gruppene du vil kontrollere.");
        }
      }, 80);
    });
  }

  function locateMetric(labelRegex){
    const all = $$("div,span,p,strong");
    for(const el of all){
      if(labelRegex.test(txt(el))){
        const box = el.closest("div");
        if(box){
          const kids = $$("div,span,strong", box);
          const value = kids.find(x => x !== el && /^[\d\s.,]+(?:\s*(?:B|KB|MB|GB|TB))?$/i.test(txt(x)));
          if(value) return value;
        }
      }
    }
    return null;
  }

  function refreshTotals(){
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      const panel = duplicatePanel();
      if(!panel) return;

      const selected = selectedCheckboxes(panel);
      let totalBytes = 0;

      selected.forEach(cb => {
        const row = cb.closest('[data-duplicate-row], .duplicate-row, .dup-row, .candidate-row, .file-row, li, tr')
          || cb.closest("div");
        totalBytes += bytesFromText(txt(row));
      });

      const selectedValue = locateMetric(/^Valgte$/i);
      const freeingValue = locateMetric(/Mulig frigjøring/i);

      if(selectedValue) selectedValue.textContent = String(selected.length);
      if(freeingValue) freeingValue.textContent = formatBytes(totalBytes);

      document.dispatchEvent(new CustomEvent("ians:v324-selection-change", {
        detail: { selected: selected.length, bytes: totalBytes }
      }));
    }, 40);
  }

  function showNotice(message){
    let box = document.getElementById("iansV324Notice");
    if(!box){
      box = document.createElement("div");
      box.id = "iansV324Notice";
      box.style.cssText = [
        "position:fixed","right:22px","bottom:22px","z-index:2147483647",
        "max-width:420px","padding:12px 14px","border-radius:10px",
        "background:rgba(7,18,32,.96)","border:1px solid rgba(56,189,248,.45)",
        "box-shadow:0 14px 40px rgba(0,0,0,.35)","color:#eaf7ff",
        "font:500 13px/1.4 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif"
      ].join(";");
      document.body.appendChild(box);
    }
    box.textContent = message;
    clearTimeout(box._iansTimer);
    box._iansTimer = setTimeout(() => box.remove(), 5200);
  }

  function install(){
    const panel = duplicatePanel();
    if(!panel) return;

    groupCandidates(panel).forEach(ensureManualModeButton);
    bindCheckboxes(panel);
    updateVisibleSuggested(panel);
    refreshTotals();

    if(!observer){
      observer = new MutationObserver(() => {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(install, 180);
      });
      observer.observe(panel, {subtree:true, childList:true});
    }
  }

  function boot(){
    install();
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      install();
      if(duplicatePanel() || tries >= 12) clearInterval(timer);
    }, 1000);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot, {once:true});
  } else {
    boot();
  }

  console.log(`[IANS] OneDrive Command V${VERSION} Manual Duplicate Review Recovery aktiv`);
})();
