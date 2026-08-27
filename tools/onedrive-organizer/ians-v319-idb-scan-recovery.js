/* IANS OneDrive Command V3.19 · IndexedDB Scan Recovery
   Purpose:
   - inventory all IndexedDB databases/object stores with counts
   - identify the store that most closely matches the completed scan count
   - exclude review/queue/runtime stores
   - export only the selected scan store
   - never clear or mutate local data
*/
(() => {
  "use strict";
  const VERSION = "3.19";
  const NS = "ians-v319-idb-recovery";
  const EXCLUDE = /review|queue|runtime|event|debug|diag|telemetry|settings|auth|token|job|state/i;
  const INCLUDE = /scan|item|file|folder|result|cache|index|record|entry|catalog/i;

  const txt = el => (el?.textContent || "").trim();
  const fmt = n => new Intl.NumberFormat("nb-NO").format(Number(n)||0);

  function visibleSummary(){
    const body = document.body.innerText || "";
    const fileMatches = [...body.matchAll(/([\d\s.]+)\s*filer\b/gi)]
      .map(m => Number(m[1].replace(/[^\d]/g,""))||0)
      .filter(Boolean);
    const folderMatches = [...body.matchAll(/Mapper behandlet\s*([\d\s.]+)/gi)]
      .map(m => Number(m[1].replace(/[^\d]/g,""))||0);
    const sizes = [...body.matchAll(/([\d\s.,]+)\s*(TB|GB|MB)\b/gi)].map(m=>m[0]);
    return {
      completed: /Kartlegging ferdig|Scan klar|fullført|completed/i.test(body),
      files: fileMatches.length ? Math.max(...fileMatches) : 0,
      folders: folderMatches.length ? Math.max(...folderMatches) : 0,
      dataSizeLabel: sizes[0] || ""
    };
  }

  function openDb(name){
    return new Promise((resolve,reject)=>{
      const r=indexedDB.open(name);
      r.onsuccess=()=>resolve(r.result);
      r.onerror=()=>reject(r.error);
    });
  }

  function countStore(db, storeName){
    return new Promise((resolve,reject)=>{
      try{
        const tx=db.transaction(storeName,"readonly");
        const req=tx.objectStore(storeName).count();
        req.onsuccess=()=>resolve(req.result||0);
        req.onerror=()=>reject(req.error);
      }catch(e){ reject(e); }
    });
  }

  function sampleStore(db, storeName, limit=8){
    return new Promise((resolve,reject)=>{
      try{
        const tx=db.transaction(storeName,"readonly");
        const store=tx.objectStore(storeName);
        const out=[];
        const req=store.openCursor();
        req.onsuccess=e=>{
          const c=e.target.result;
          if(c && out.length<limit){ out.push(c.value); c.continue(); }
          else resolve(out);
        };
        req.onerror=()=>reject(req.error);
      }catch(e){ reject(e); }
    });
  }

  function schemaScore(samples){
    let score=0;
    for(const r of samples){
      if(!r || typeof r!=="object") continue;
      for(const k of ["id","name","size","file","folder","webUrl","parentReference","createdDateTime","lastModifiedDateTime","path"]){
        if(k in r) score++;
      }
    }
    return score;
  }

  async function inventory(){
    const metas = indexedDB.databases ? await indexedDB.databases() : [];
    const rows=[];
    for(const meta of metas){
      if(!meta?.name) continue;
      let db;
      try{ db=await openDb(meta.name); }catch{ continue; }
      const stores=[...db.objectStoreNames];
      for(const store of stores){
        let count=0, samples=[];
        try{ count=await countStore(db,store); }catch{}
        if(count>0){
          try{ samples=await sampleStore(db,store,6); }catch{}
        }
        rows.push({
          db:meta.name,
          store,
          count,
          schemaScore:schemaScore(samples),
          excluded:EXCLUDE.test(store) || EXCLUDE.test(meta.name),
          preferred:INCLUDE.test(store) || INCLUDE.test(meta.name),
          sampleKeys:samples[0] && typeof samples[0]==="object" ? Object.keys(samples[0]).slice(0,20) : []
        });
      }
      db.close();
    }
    return rows;
  }

  function rank(rows,target){
    return rows.map(r=>{
      const delta = target ? Math.abs(r.count-target) : Number.MAX_SAFE_INTEGER;
      let score=0;
      if(r.excluded) score -= 100000000;
      if(r.preferred) score += 500000;
      score += r.schemaScore*10000;
      if(target && r.count){
        score += Math.max(0, 1000000-delta*5);
        if(r.count===target) score += 5000000;
        if(r.count > target*0.8 && r.count < target*1.2) score += 1000000;
      }
      if(r.count>1000) score += 100000;
      return {...r, delta, rankScore:score};
    }).sort((a,b)=>b.rankScore-a.rankScore);
  }

  function readStoreAll(dbName,storeName){
    return new Promise((resolve,reject)=>{
      const r=indexedDB.open(dbName);
      r.onerror=()=>reject(r.error);
      r.onsuccess=()=>{
        const db=r.result;
        try{
          const tx=db.transaction(storeName,"readonly");
          const store=tx.objectStore(storeName);
          const out=[];
          const req=store.openCursor();
          req.onsuccess=e=>{
            const c=e.target.result;
            if(c){ out.push(c.value); c.continue(); }
            else { db.close(); resolve(out); }
          };
          req.onerror=()=>{ db.close(); reject(req.error); };
        }catch(e){ db.close(); reject(e); }
      };
    });
  }

  function download(name,obj){
    const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  }

  async function exportInventory(){
    const summary=visibleSummary();
    const rows=rank(await inventory(),summary.files);
    const ts=new Date().toISOString().replace(/[:.]/g,"-");
    download(`IANS-IDB-Inventory-${ts}.json`,{
      version:VERSION,
      type:"ians-idb-inventory",
      exportedAt:new Date().toISOString(),
      targetSummary:summary,
      candidates:rows
    });
  }

  async function exportBest(){
    const summary=visibleSummary();
    const ranked=rank(await inventory(),summary.files);
    const best=ranked.find(r=>!r.excluded && r.count>0);
    if(!best){
      alert("Ingen egnet IndexedDB-store ble funnet. Last ned IDB-inventar og send filen til analyse.");
      return;
    }
    const ok=confirm(
      `IANS vil eksportere:\n\nDatabase: ${best.db}\nStore: ${best.store}\nPoster: ${fmt(best.count)}\nMål fra ferdig scan: ${fmt(summary.files)} filer\n\nFortsette?`
    );
    if(!ok) return;

    const rows=await readStoreAll(best.db,best.store);
    const ts=new Date().toISOString().replace(/[:.]/g,"-");
    download(`IANS-OneDrive-Scan-${ts}.json`,{
      version:VERSION,
      type:"ians-completed-scan-export",
      exportedAt:new Date().toISOString(),
      summary,
      source:{kind:"indexedDB",db:best.db,store:best.store},
      count:rows.length,
      items:rows
    });
  }

  function addUI(){
    if(document.getElementById(`${NS}-panel`)) return;
    const host=[...document.querySelectorAll("section,article,div")]
      .filter(el=>/Scan & Vault/i.test(txt(el)))
      .sort((a,b)=>txt(a).length-txt(b).length)[0];
    if(!host) return;

    const s=visibleSummary();
    if(!s.files) return;

    const panel=document.createElement("div");
    panel.id=`${NS}-panel`;
    panel.className="ians-v319-panel";
    panel.innerHTML=`
      <div class="ians-v319-copy">
        <strong>Recovery · ferdig skanning funnet</strong>
        <span>${fmt(s.files)} filer${s.folders?` · ${fmt(s.folders)} mapper`:""}${s.dataSizeLabel?` · ${s.dataSizeLabel}`:""}</span>
      </div>
      <div class="ians-v319-actions">
        <button id="${NS}-inventory" type="button">Last ned IDB-inventar</button>
        <button id="${NS}-export" type="button">Eksporter beste scan-store</button>
      </div>`;
    host.prepend(panel);

    panel.querySelector(`#${NS}-inventory`).addEventListener("click",exportInventory);
    panel.querySelector(`#${NS}-export`).addEventListener("click",exportBest);
  }

  document.addEventListener("click",e=>{
    const el=e.target.closest("button,a");
    if(!el) return;
    if(/Nullstill lokal scan-data/i.test(txt(el))){
      const s=visibleSummary();
      if(s.files && !confirm(`Det finnes en ferdig skanning med ${fmt(s.files)} filer. Nullstilling kan slette resultatet. Fortsette?`)){
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      }
    }
  },true);

  function render(){ addUI(); }
  new MutationObserver(()=>requestAnimationFrame(render)).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  window.addEventListener("load",render,{once:true});
  render();
  console.info(`[IANS] OneDrive Command V${VERSION} IndexedDB Scan Recovery aktiv`);
})();