/* IANS OneDrive Command V3.30 · Consolidated Runtime
   Generated from the currently active verified patch modules.
   Load order is preserved. V3.21/V3.21.1 observer runtimes remain excluded.
*/
console.info("[IANS] V3.30 consolidated runtime loading");

/* ===== BEGIN ians-v323-verified-duplicate-safety.js ===== */
(() => {
  "use strict";
  const VERSION="3.23.1";
  const MEDIA_EXT=new Set(["mts","m2ts","mov","mp4","m4v","avi","mkv","jpg","jpeg","heic","png","cr2","cr3","nef","arw","dng","raf"]);
  const CACHE_EXT=new Set(["cfa","pek","ims","tmp","cache"]);
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const txt=e=>(e?.textContent||"").trim();
  const ext=name=>((name||"").split(".").pop()||"").toLowerCase();

  function toast(message,kind="info"){
    let box=$("#ians-v323-toast");
    if(!box){ box=document.createElement("div"); box.id="ians-v323-toast"; document.body.append(box); }
    box.className="ians-v323-toast "+kind; box.textContent=message;
    requestAnimationFrame(()=>box.classList.add("show"));
    clearTimeout(box._t); box._t=setTimeout(()=>box.classList.remove("show"),5200);
  }

  async function sha256(blob){
    const buf=await blob.arrayBuffer();
    const dig=await crypto.subtle.digest("SHA-256",buf);
    return [...new Uint8Array(dig)].map(b=>b.toString(16).padStart(2,"0")).join("");
  }

  function duplicatePanel(){
  // V3.23.1: aldri skann hele dokumentets section/div-tre.
  const known =
    document.getElementById("dupBulkPanel") ||
    document.getElementById("v295DupList") ||
    document.getElementById("v294ReviewCleaner");
  if(known) return known;
  const candidates=$$("[data-duplicate-panel], .duplicate-review-panel, .duplicate-panel");
  return candidates.find(e=>/DUPLICATE REVIEW|duplikat/i.test(txt(e))) || null;
}

function groups(panel){
    if(!panel) return [];
    let candidates=$$("[data-duplicate-group], .duplicate-group, .dup-group, article",panel);
    if(!candidates.length){
      candidates=$$("div",panel).filter(e=>/BEHOLD|REVIEW|HASH/i.test(txt(e)) && e.querySelectorAll("input[type=checkbox]").length>=1);
    }
    return candidates.filter((e,i,a)=>!a.some((x,j)=>j!==i && x.contains(e) && /BEHOLD|REVIEW/i.test(txt(x))));
  }

  function rows(group){
    let rs=$$("[data-file-id], .duplicate-item, .dup-item, li, tr",group).filter(e=>/BEHOLD|REVIEW/i.test(txt(e)));
    if(!rs.length) rs=$$("div",group).filter(e=>/BEHOLD|REVIEW/i.test(txt(e)) && (e.querySelector("input[type=checkbox]")||/Preview/i.test(txt(e))));
    return rs;
  }

  function rowInfo(row){
    const t=txt(row);
    const name=(t.match(/([^\s/\\]+\.[A-Za-z0-9]{2,6})/)||[])[1]||"";
    const cb=$('input[type="checkbox"]',row);
    const keep=/\bBEHOLD\b/i.test(t);
    const review=/\bREVIEW\b/i.test(t);
    return {row,name,cb,keep,review,extension:ext(name)};
  }

  function markClassification(group){
    const infos=rows(group).map(rowInfo);
    const exts=new Set(infos.map(x=>x.extension).filter(Boolean));
    let badge=$(".ians-v323-type",group);
    if(!badge){ badge=document.createElement("span"); badge.className="ians-v323-type"; group.prepend(badge); }
    if([...exts].some(x=>CACHE_EXT.has(x))){
      badge.textContent="CACHE / AVLEDET FIL · MANUELL VURDERING";
      badge.dataset.kind="cache";
    } else if([...exts].some(x=>MEDIA_EXT.has(x))){
      badge.textContent="ORIGINAL / MEDIA · HASH PÅKREVD";
      badge.dataset.kind="media";
    } else {
      badge.textContent="HASH PÅKREVD FØR AUTOMATISK VALG";
      badge.dataset.kind="normal";
    }
  }

  function isVerified(group){
    return group.dataset.iansHashVerified==="1" || /HASH VERIFIED|SHA-256 VERIFISERT/i.test(txt(group));
  }

  function safeMarkVisible(panel){
    let n=0;
    groups(panel).forEach(g=>{
      if(!isVerified(g)) return;
      rows(g).map(rowInfo).forEach(x=>{
        if(x.review && !x.keep && x.cb && !x.cb.disabled){ x.cb.checked=true; x.cb.dispatchEvent(new Event("change",{bubbles:true})); n++; }
      });
    });
    toast(n?`${n} hash-verifiserte ekstrakopier ble valgt.`:"Ingen synlige hash-verifiserte ekstrakopier å velge.", n?"ok":"warn");
  }

  async function fetchBlobForRow(row){
    // Integrates with existing Preview/download links only; never invents Graph deletion.
    const a=$$('a',row).find(a=>/download|content|preview/i.test((a.href||"")+" "+txt(a)));
    if(a?.href){
      const r=await fetch(a.href,{credentials:"include"});
      if(r.ok) return await r.blob();
    }
    const btn=$$("button",row).find(b=>/Preview/i.test(txt(b)));
    if(btn && row.dataset.downloadUrl){
      const r=await fetch(row.dataset.downloadUrl,{credentials:"include"});
      if(r.ok) return await r.blob();
    }
    throw new Error("Ingen trygg innholds-URL tilgjengelig i denne raden.");
  }

  async function verifyGroup(group,button){
    const infos=rows(group).map(rowInfo).filter(x=>x.name);
    if(infos.length<2) return toast("Fant ikke minst to filer i gruppen.","warn");
    if(infos.some(x=>CACHE_EXT.has(x.extension))){
      return toast("CFA/cache behandles konservativt og verifiseres ikke for automatisk sletting.","warn");
    }
    button.disabled=true; button.textContent="Hash-sjekker…";
    try{
      const hashes=[];
      for(const x of infos){
        const blob=await fetchBlobForRow(x.row);
        hashes.push(await sha256(blob));
      }
      const ok=hashes.every(h=>h===hashes[0]);
      group.dataset.iansHashVerified=ok?"1":"0";
      let b=$(".ians-v323-hash",group);
      if(!b){ b=document.createElement("span"); b.className="ians-v323-hash"; group.prepend(b); }
      b.textContent=ok?"🔒 SHA-256 VERIFISERT":"⛔ HASH ULIK – IKKE DUPLIKAT";
      b.dataset.ok=ok?"1":"0";
      if(!ok) infos.forEach(x=>{if(x.cb)x.cb.checked=false});
      toast(ok?"Filinnholdet er identisk. Ekstrakopier kan velges trygt.":"Hashene er ulike. Ingen filer er valgt.",""+(ok?"ok":"bad"));
    }catch(e){
      toast("Hash-sjekk kunne ikke lese filinnholdet. Ingen filer ble valgt. "+e.message,"warn");
    }finally{ button.disabled=false; button.textContent="Trygg hash-sjekk"; }
  }

  function addVerifyButtons(panel){
    groups(panel).forEach(g=>{
      markClassification(g);
      if($(".ians-v323-verify",g)) return;
      const b=document.createElement("button"); b.type="button"; b.className="ians-v323-verify"; b.textContent="Trygg hash-sjekk";
      b.addEventListener("click",()=>verifyGroup(g,b));
      g.prepend(b);
    });
  }

  function findDeleteButton(panel){
    return $$("button",panel).find(b=>/Papirkurv valgte|Slett valgte/i.test(txt(b)));
  }
  function addBottomActions(panel){
    if($("#ians-v323-bottom-actions")) return;
    const wrap=document.createElement("div"); wrap.id="ians-v323-bottom-actions";
    wrap.innerHTML='<div><strong>Trygg handling</strong><small>Automatisk valg gjelder kun SHA-256-verifiserte grupper.</small></div>';
    const mark=document.createElement("button"); mark.textContent="Merk synlige sikre forslag"; mark.className="ians-v323-safe";
    mark.onclick=()=>safeMarkVisible(panel);
    const del=document.createElement("button"); del.textContent="Papirkurv valgte"; del.className="ians-v323-delete";
    del.onclick=()=>{
      const original=findDeleteButton(panel);
      if(!original) return toast("Fant ikke eksisterende Papirkurv valgte-knapp. Ingen handling utført.","warn");
      original.scrollIntoView({block:"center"}); original.click();
    };
    wrap.append(mark,del); panel.append(wrap);
  }

  function relabel(panel){
    $$("button",panel).forEach(b=>{
      if(/^Merk synlige foresl/i.test(txt(b))) b.textContent="Merk synlige sikre forslag";
    });
  }

  function init(){
    const panel=duplicatePanel(); if(!panel) return;
    panel.dataset.iansV323="1";
    relabel(panel); addVerifyButtons(panel); addBottomActions(panel);
  }


  let v326InitTimer=null;
  let v326PanelObserver=null;
  let v326ObservedPanel=null;

  function scheduleInit326(delay=120){
    clearTimeout(v326InitTimer);
    v326InitTimer=setTimeout(()=>{
      init();
      bindPanel326();
    },delay);
  }

  function bindPanel326(){
    const p=duplicatePanel();
    if(!p) return;
    if(v326ObservedPanel===p && v326PanelObserver) return;
    if(v326PanelObserver) v326PanelObserver.disconnect();
    v326ObservedPanel=p;
    v326PanelObserver=new MutationObserver(()=>scheduleInit326(180));
    v326PanelObserver.observe(p,{subtree:true,childList:true});
  }

  function boot326(){
    scheduleInit326(0);
    let tries=0;
    const probe=setInterval(()=>{
      tries++;
      scheduleInit326(0);
      if(duplicatePanel() || tries>=10) clearInterval(probe);
    },1000);
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",boot326,{once:true});
  }else{
    boot326();
  }

  console.log("[IANS] OneDrive Command V3.23.2 Scoped Duplicate Safety aktiv");
})();

/* ===== END ians-v323-verified-duplicate-safety.js ===== */

/* ===== BEGIN ians-v324-manual-duplicate-review-recovery.js ===== */
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

/* ===== END ians-v324-manual-duplicate-review-recovery.js ===== */

/* ===== BEGIN ians-v325-verified-content-hash.js ===== */
(() => {
  "use strict";

  const VERSION = "3.25";
  const CACHE_KEY = "ians_v325_sha256_cache_v1";
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
  const text = el => (el?.textContent || "").trim();

  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch { cache = {}; }

  function saveCache(){
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
  }

  function panel(){
    return document.getElementById("dupBulkPanel")
      || document.getElementById("v295DupList")
      || document.getElementById("v294ReviewCleaner")
      || document.querySelector("[data-duplicate-panel]")
      || document.querySelector(".duplicate-review-panel")
      || document.querySelector(".duplicate-panel")
      || null;
  }

  function groups(root){
    if(!root) return [];
    const explicit = $$(
      '[data-duplicate-group], .duplicate-group, .dup-group, .v323-group, .v295-dup-group',
      root
    );
    if(explicit.length) return explicit;

    const buttons = $$("button", root).filter(b => /Merk manuelt etter review|Preview behold|Fjern gruppevalg/i.test(text(b)));
    const found = [];
    for(const btn of buttons){
      let el = btn.parentElement;
      for(let i=0; i<7 && el && el !== root; i++, el=el.parentElement){
        const cbs = $$('input[type="checkbox"]', el);
        if(cbs.length >= 2){
          if(!found.includes(el)) found.push(el);
          break;
        }
      }
    }
    return found;
  }

  function rows(group){
    const explicit = $$(
      '[data-duplicate-row], .duplicate-row, .dup-row, .candidate-row, .file-row, li, tr',
      group
    ).filter(r => text(r).length > 0);
    if(explicit.length >= 2) return explicit;
    return $$('input[type="checkbox"]', group).map(cb => cb.closest("div") || cb.parentElement).filter(Boolean);
  }

  function parseSize(str){
    const m = str.match(/([\d.,]+)\s*(B|KB|MB|GB|TB)\b/i);
    if(!m) return null;
    const n = parseFloat(m[1].replace(",", "."));
    const mult = {B:1,KB:1024,MB:1024**2,GB:1024**3,TB:1024**4}[m[2].toUpperCase()];
    return Math.round(n * mult);
  }

  function getGraphId(row){
    return row.dataset.itemId
      || row.dataset.driveItemId
      || row.getAttribute("data-id")
      || row.getAttribute("data-item-id")
      || row.getAttribute("data-drive-item-id")
      || null;
  }

  function getDownloadUrl(row){
    return row.dataset.downloadUrl
      || row.getAttribute("data-download-url")
      || row.querySelector('a[href*="download"]')?.href
      || null;
  }

  function getPath(row){
    const t = text(row);
    const m = t.match(/(\/[^\n]+?\.[A-Za-z0-9]{2,6})\b/);
    return m ? m[1].trim() : "";
  }

  function rowKey(row){
    return getGraphId(row) || getDownloadUrl(row) || getPath(row) || text(row).slice(0,220);
  }

  function getAuthToken(){
    const candidates = [
      window.IANS_GRAPH_TOKEN,
      window.graphAccessToken,
      window.accessToken,
      sessionStorage.getItem("ians_graph_token"),
      sessionStorage.getItem("graphAccessToken"),
      localStorage.getItem("ians_graph_token"),
      localStorage.getItem("graphAccessToken")
    ].filter(Boolean);
    return candidates[0] || null;
  }

  async function fetchOriginal(row){
    const itemId = getGraphId(row);
    const token = getAuthToken();

    if(itemId && token){
      const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(itemId)}/content`, {
        headers: { Authorization: `Bearer ${token}` },
        redirect: "follow"
      });
      if(!res.ok) throw new Error(`Graph content ${res.status}`);
      return await res.arrayBuffer();
    }

    const url = getDownloadUrl(row);
    if(url){
      const res = await fetch(url, { credentials: "include", redirect: "follow" });
      if(!res.ok) throw new Error(`Download ${res.status}`);
      return await res.arrayBuffer();
    }

    throw new Error("Mangler item-id eller direkte download-URL i raden");
  }

  async function sha256(buffer){
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2,"0")).join("");
  }

  function ensureStatus(row){
    let badge = row.querySelector(".ians-v325-hash-status");
    if(!badge){
      badge = document.createElement("span");
      badge.className = "ians-v325-hash-status";
      badge.style.cssText = "margin-left:8px;font:600 11px/1.2 system-ui;color:#9bdcff;white-space:nowrap";
      row.appendChild(badge);
    }
    return badge;
  }

  function setStatus(row, msg){
    ensureStatus(row).textContent = msg;
  }

  function ensureVerifyButton(group){
    if(group.querySelector(".ians-v325-verify-hash")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ians-v325-verify-hash";
    btn.textContent = "Verifiser SHA-256";
    btn.style.cssText = "margin-left:8px;padding:7px 10px;border-radius:7px;border:1px solid rgba(56,189,248,.45);background:#0d3550;color:#eaf7ff;font:600 12px system-ui;cursor:pointer";

    const host = $$("button", group).find(b => /Merk manuelt etter review|Fjern gruppevalg|Preview behold/i.test(text(b)))?.parentElement
      || group.firstElementChild
      || group;
    host.appendChild(btn);

    btn.addEventListener("click", async () => {
      await verifyGroup(group, btn);
    });
  }

  async function verifyGroup(group, btn){
    const rs = rows(group);
    if(rs.length < 2){
      toast("Fant ikke minst to filer i gruppen.");
      return;
    }

    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = "Hasher…";

    const results = [];
    try{
      for(let i=0; i<rs.length; i++){
        const row = rs[i];
        const key = rowKey(row);
        const size = parseSize(text(row));

        if(cache[key]?.sha256){
          setStatus(row, `SHA-256 ${cache[key].sha256.slice(0,12)}… (cache)`);
          results.push({row, key, size, sha256: cache[key].sha256});
          continue;
        }

        setStatus(row, `Laster original ${i+1}/${rs.length}…`);
        const buffer = await fetchOriginal(row);

        if(size && Math.abs(buffer.byteLength - size) > Math.max(1024*1024, size*0.02)){
          setStatus(row, `Størrelse avviker (${buffer.byteLength} B)`);
          throw new Error("Nedlastet innhold matcher ikke forventet filstørrelse");
        }

        setStatus(row, "Beregner SHA-256…");
        const hash = await sha256(buffer);

        cache[key] = {
          sha256: hash,
          bytes: buffer.byteLength,
          verifiedAt: new Date().toISOString()
        };
        saveCache();

        setStatus(row, `SHA-256 ${hash.slice(0,12)}…`);
        results.push({row, key, size: buffer.byteLength, sha256: hash});
        await new Promise(r => setTimeout(r, 60));
      }

      const first = results[0].sha256;
      const allSame = results.every(x => x.sha256 === first);

      if(allSame){
        results.forEach((x, idx) => {
          x.row.dataset.v325HashVerified = "1";
          x.row.dataset.v325Sha256 = x.sha256;
          const cb = $('input[type="checkbox"]', x.row);
          if(cb){
            cb.disabled = false;
            if(idx === 0){
              cb.checked = false;
              cb.dataset.v324Keep = "1";
            } else {
              cb.dataset.v325VerifiedDuplicate = "1";
            }
          }
          setStatus(x.row, idx === 0 ? "VERIFISERT · BEHOLD" : "VERIFISERT DUPLIKAT");
        });

        group.dataset.v325HashMatch = "1";
        toast(`SHA-256 verifisert: ${results.length} identiske filer. Behold én; øvrige er verifiserte duplikater.`);
      } else {
        group.dataset.v325HashMatch = "0";
        results.forEach(x => setStatus(x.row, "HASH AVVIKER · IKKE SLETT"));
        toast("Hashene er ikke identiske. Gruppen skal ikke behandles som verifiserte duplikater.");
      }

    } catch(err){
      console.error("[IANS V3.25] Hash verify failed", err);
      toast(`Kunne ikke verifisere gruppen: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  }

  function toast(message){
    let box = document.getElementById("iansV325Toast");
    if(!box){
      box = document.createElement("div");
      box.id = "iansV325Toast";
      box.style.cssText = "position:fixed;right:22px;bottom:22px;z-index:2147483647;max-width:460px;padding:12px 14px;border-radius:10px;background:rgba(7,18,32,.97);border:1px solid rgba(56,189,248,.45);box-shadow:0 14px 40px rgba(0,0,0,.35);color:#eaf7ff;font:500 13px/1.4 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";
      document.body.appendChild(box);
    }
    box.textContent = message;
    clearTimeout(box._timer);
    box._timer = setTimeout(() => box.remove(), 6000);
  }

  function install(){
    const p = panel();
    if(!p) return;
    groups(p).forEach(ensureVerifyButton);
  }

  function boot(){
    install();
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      install();
      if(panel() || tries >= 15) clearInterval(timer);
    }, 1000);

    const p = panel();
    if(p){
      new MutationObserver(() => setTimeout(install, 120))
        .observe(p, {subtree:true, childList:true});
    }
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot, {once:true});
  } else {
    boot();
  }

  console.log(`[IANS] OneDrive Command V${VERSION} Verified Content Hash aktiv`);
})();

/* ===== END ians-v325-verified-content-hash.js ===== */

/* ===== BEGIN ians-v326-duplicate-stability-bulk-select.js ===== */
(() => {
  "use strict";
  const VERSION="3.26";
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const txt=e=>(e?.textContent||"").trim();

  let currentPanel=null;
  let panelObserver=null;
  let installTimer=null;

  function panel(){
    return document.getElementById("dupBulkPanel")
      || document.getElementById("v295DupList")
      || document.getElementById("v294ReviewCleaner")
      || document.querySelector("[data-duplicate-panel]")
      || document.querySelector(".duplicate-review-panel")
      || document.querySelector(".duplicate-panel")
      || null;
  }

  function groupFromButton(btn,p){
    let el=btn.parentElement;
    for(let i=0;i<8 && el && el!==p;i++,el=el.parentElement){
      if($$('input[type="checkbox"]',el).length>=2) return el;
    }
    return null;
  }

  function groups(p){
    if(!p) return [];
    const explicit=$$('[data-duplicate-group], .duplicate-group, .dup-group, .v323-group, .v295-dup-group',p);
    if(explicit.length) return explicit;
    const anchors=$$("button",p).filter(b=>/Merk manuelt etter review|Manuell review aktiv|Fjern gruppevalg|Preview behold|Verifiser SHA-256/i.test(txt(b)));
    const found=[];
    anchors.forEach(b=>{
      const g=groupFromButton(b,p);
      if(g && !found.includes(g)) found.push(g);
    });
    return found;
  }

  function rows(g){
    const explicit=$$('[data-duplicate-row], .duplicate-row, .dup-row, .candidate-row, .file-row, li, tr',g)
      .filter(r=>$('input[type="checkbox"]',r));
    if(explicit.length) return explicit;
    return $$('input[type="checkbox"]',g).map(cb=>{
      let e=cb.parentElement;
      for(let i=0;i<4 && e && e!==g;i++,e=e.parentElement){
        if(/\bBEHOLD\b|\bKandidat\b|\bREVIEW\b/i.test(txt(e))) return e;
      }
      return cb.parentElement;
    }).filter(Boolean);
  }

  function isKeep(row,idx){
    const cb=$('input[type="checkbox"]',row);
    return /\bBEHOLD\b/i.test(txt(row)) || cb?.dataset.v324Keep==="1" || idx===0;
  }

  function toast(message){
    let b=document.getElementById("iansV326Toast");
    if(!b){
      b=document.createElement("div");
      b.id="iansV326Toast";
      b.style.cssText="position:fixed;right:22px;bottom:22px;z-index:2147483647;max-width:450px;padding:12px 14px;border-radius:10px;background:rgba(7,18,32,.97);border:1px solid rgba(56,189,248,.45);box-shadow:0 14px 40px rgba(0,0,0,.35);color:#eaf7ff;font:500 13px/1.4 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";
      document.body.appendChild(b);
    }
    b.textContent=message;
    clearTimeout(b._t);
    b._t=setTimeout(()=>b.remove(),4800);
  }

  function setChecked(cb,checked){
    cb.disabled=false;
    cb.removeAttribute("aria-disabled");
    cb.style.pointerEvents="auto";
    cb.checked=checked;
    cb.dispatchEvent(new Event("input",{bubbles:true}));
    cb.dispatchEvent(new Event("change",{bubbles:true}));
  }

  function selectExceptKeep(g){
    const rs=rows(g);
    if(rs.length<2) return toast("Fant ikke kandidatene i denne gruppen.");
    let selected=0;
    rs.forEach((row,idx)=>{
      const cb=$('input[type="checkbox"]',row);
      if(!cb) return;
      if(isKeep(row,idx)){
        cb.dataset.v324Keep="1";
        if(cb.checked) setChecked(cb,false);
      }else{
        setChecked(cb,true);
        selected++;
      }
    });
    document.dispatchEvent(new CustomEvent("ians:v326-bulk-selection",{detail:{selected}}));
    toast(`${selected} ekstrakopier merket. BEHOLD er ikke valgt. Ingenting er slettet.`);
  }

  function addButton(g){
    if(g.querySelector(".ians-v326-select-except-keep")) return;
    const b=document.createElement("button");
    b.type="button";
    b.className="ians-v326-select-except-keep";
    b.textContent="Merk alle unntatt BEHOLD";
    b.style.cssText="margin-left:6px;padding:7px 10px;border-radius:7px;border:1px solid rgba(34,197,94,.45);background:rgba(22,101,52,.55);color:#ecfff2;font:600 11px system-ui;cursor:pointer";
    b.addEventListener("click",ev=>{
      ev.preventDefault();
      ev.stopPropagation();
      selectExceptKeep(g);
    },true);
    const actionButton=$$("button",g).find(x=>/Merk manuelt etter review|Manuell review aktiv|Fjern gruppevalg|Preview behold|Verifiser SHA-256/i.test(txt(x)));
    const host=actionButton?.parentElement || g.firstElementChild || g;
    host.appendChild(b);
  }

  function install(){
    const p=panel();
    if(!p) return;
    if(currentPanel!==p){
      panelObserver?.disconnect();
      currentPanel=p;
      panelObserver=new MutationObserver(()=>{
        clearTimeout(installTimer);
        installTimer=setTimeout(install,180);
      });
      panelObserver.observe(p,{subtree:true,childList:true});
    }
    groups(p).forEach(addButton);
  }

  function boot(){
    install();
    setInterval(()=>{
      const p=panel();
      if(p!==currentPanel || (p && !p.querySelector(".ians-v326-select-except-keep"))) install();
    },2000);
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",boot,{once:true});
  }else{
    boot();
  }

  console.log(`[IANS] OneDrive Command V${VERSION} Duplicate Stability + Bulk Select aktiv`);
})();
/* ===== END ians-v326-duplicate-stability-bulk-select.js ===== */

/* ===== BEGIN ians-v324-controlled-organization-scope.js ===== */
(()=>{
'use strict';
const V='3.24';
const MAX_TEST_FILES=500;
const norm=s=>String(s||'').trim().replace(/\\/g,'/').replace(/\/+$/,'');
const txt=e=>(e?.textContent||'').trim();
const all=(q,r=document)=>Array.from(r.querySelectorAll(q));
function findStudio(){
  return all('section,div,main,article').find(e=>/ORGANIZATION STUDIO/i.test(txt(e)) && /Utfør plan/i.test(txt(e)))||null;
}
function findButton(root,re){ return all('button,[role="button"]',root).find(b=>re.test(txt(b)))||null; }
function readPlanCount(root){
  const t=txt(root); const m=t.match(/Filer i plan\s*([\d\s.]+)/i); return m?Number(m[1].replace(/\D/g,'')):NaN;
}
function install(){
 const studio=findStudio(); if(!studio || studio.dataset.v324==='1') return false;
 studio.dataset.v324='1';
 const build=findButton(studio,/^Bygg forslag$/i), execute=findButton(studio,/^Utfør plan$/i);
 if(!execute) return false;
 const box=document.createElement('div'); box.className='ians-v324-scope';
 box.innerHTML=`<div class="v324-head"><strong>CONTROLLED SCOPE · V${V}</strong><span>SIKKER TESTMODUS</span></div>
 <div class="v324-grid"><label>Kildemappe <input id="v324Source" placeholder="/IANS-Test-Kilde" autocomplete="off"></label>
 <label>Målrot for test <input id="v324Target" placeholder="/IANS-Test-Organisert" autocomplete="off"></label></div>
 <div class="v324-note">V3.24 sperrer Utfør plan dersom planen er større enn ${MAX_TEST_FILES} filer eller kilde/mål ikke er eksplisitt satt. Dette hindrer at 137 665 filer kan startes ved et uhell.</div>
 <label class="v324-confirm"><input type="checkbox" id="v324Confirm"> Jeg bekrefter at dette er en kontrollert testmappe</label>
 <div id="v324State" class="v324-state">LÅST · Velg kontrollert kilde og mål før utførelse.</div>`;
 const anchor=studio.querySelector('h1,h2,h3,h4')||studio.firstChild; anchor?.parentNode?.insertBefore(box,anchor.nextSibling);
 const source=box.querySelector('#v324Source'), target=box.querySelector('#v324Target'), confirm=box.querySelector('#v324Confirm'), state=box.querySelector('#v324State');
 function safe(){
   const n=readPlanCount(studio), s=norm(source.value), t=norm(target.value);
   const pathsOk=s.startsWith('/')&&s.length>1&&t.startsWith('/')&&t.length>1&&s!==t;
   const countOk=Number.isFinite(n)&&n>0&&n<=MAX_TEST_FILES;
   const ok=pathsOk&&countOk&&confirm.checked;
   execute.dataset.v324Allowed=ok?'1':'0';
   execute.classList.toggle('v324-locked',!ok);
   if(!pathsOk) state.textContent='LÅST · Angi separat kildemappe og målrot.';
   else if(!Number.isFinite(n)||n<1) state.textContent='LÅST · Bygg en plan for testmappen først.';
   else if(!countOk) state.textContent=`LÅST · Planen inneholder ${n.toLocaleString('nb-NO')} filer. Maks ${MAX_TEST_FILES} i V3.24 testmodus.`;
   else if(!confirm.checked) state.textContent=`LÅST · ${n.toLocaleString('nb-NO')} filer. Bekreft kontrollert testmappe.`;
   else state.textContent=`KLAR FOR KONTROLLERT TEST · ${n.toLocaleString('nb-NO')} filer · ${s} → ${t}`;
   state.classList.toggle('ready',ok);
   return ok;
 }
 [source,target,confirm].forEach(e=>e.addEventListener('input',safe));
 if(build) build.addEventListener('click',()=>setTimeout(safe,100),true);
 // Capture-phase hard stop: older handlers never receive the click unless V3.24 says safe.
 execute.addEventListener('click',ev=>{
   if(!safe()){
     ev.preventDefault(); ev.stopImmediatePropagation();
     alert('IANS V3.24 sikkerhetslås: Utfør plan er blokkert. Bruk en kontrollert testmappe, maks 500 filer, og bekreft testen.');
     return false;
   }
   const n=readPlanCount(studio), s=norm(source.value), t=norm(target.value);
   if(!window.confirm(`KONTROLLERT TEST\n\nKilde: ${s}\nMål: ${t}\nPlan: ${n.toLocaleString('nb-NO')} filer\n\nFortsette med Utfør plan?`)){
     ev.preventDefault(); ev.stopImmediatePropagation(); return false;
   }
 },true);
 new MutationObserver(safe).observe(studio,{subtree:true,childList:true,characterData:true});
 safe(); console.log('[IANS] V3.24 Controlled Organization Scope aktiv'); return true;
}
let tries=0; const timer=setInterval(()=>{tries++; if(install()||tries>40)clearInterval(timer)},500);
if(document.readyState!=='loading') install(); else document.addEventListener('DOMContentLoaded',install,{once:true});
})();

/* ===== END ians-v324-controlled-organization-scope.js ===== */

window.IANS_V330 = {
  version: "3.30",
  consolidated: true,
  modules: ["3.23","3.24-review","3.25","3.26","3.24-scope"]
};
console.info("[IANS] V3.30 consolidated runtime active");
