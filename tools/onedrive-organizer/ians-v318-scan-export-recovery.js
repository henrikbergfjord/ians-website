/* IANS OneDrive Command V3.18 · Scan Export Recovery */
(() => {
  "use strict";
  const VERSION = "3.18";
  const NS = "ians-v318-export-recovery";
  const fmt = n => new Intl.NumberFormat("nb-NO").format(Number(n)||0);
  const text = el => (el?.textContent || "").trim();
  const all = () => [...document.querySelectorAll("button,a")];
  const byLabel = rx => all().find(el => rx.test(text(el)));

  function toast(title, body){
    if (typeof window.iansToast === "function") window.iansToast(title, body||"", "info", 5000);
    else console.info(`[IANS ${VERSION}] ${title}${body?": "+body:""}`);
  }

  function visibleSummary(){
    const body = document.body.innerText || "";
    const files = Math.max(0, ...[...body.matchAll(/([\d\s.]+)\s*filer\b/gi)].map(m => Number(m[1].replace(/[^\d]/g,""))||0));
    const fm = body.match(/Mapper behandlet\s*([\d\s.]+)/i);
    const folders = fm ? Number(fm[1].replace(/[^\d]/g,""))||0 : 0;
    const sizes = [...body.matchAll(/([\d\s.,]+)\s*(TB|GB|MB)\b/gi)].map(m => m[0]);
    return {
      completed: /Kartlegging ferdig|Scan klar|fullført|completed/i.test(body),
      files, folders, bytes: sizes[0] || ""
    };
  }

  async function dbList(){
    if(!indexedDB.databases) return [];
    try { return await indexedDB.databases(); } catch { return []; }
  }

  function readAll(dbName, storeName){
    return new Promise((resolve,reject)=>{
      const open=indexedDB.open(dbName);
      open.onerror=()=>reject(open.error);
      open.onsuccess=()=>{
        const db=open.result;
        if(!db.objectStoreNames.contains(storeName)){ db.close(); return resolve([]); }
        const tx=db.transaction(storeName,"readonly");
        const store=tx.objectStore(storeName);
        const out=[];
        const req=store.openCursor();
        req.onsuccess=e=>{
          const cur=e.target.result;
          if(cur){ out.push(cur.value); cur.continue(); }
          else { db.close(); resolve(out); }
        };
        req.onerror=()=>{ db.close(); reject(req.error); };
      };
    });
  }

  function storageObjects(){
    const out=[];
    for(const storage of [localStorage,sessionStorage]){
      for(let i=0;i<storage.length;i++){
        const key=storage.key(i);
        if(!key || !/ians|onedrive|scan|vault|cache|index/i.test(key)) continue;
        const raw=storage.getItem(key);
        if(!raw) continue;
        try{
          out.push({kind:storage===localStorage?"localStorage":"sessionStorage", key, value:JSON.parse(raw)});
        }catch{}
      }
    }
    return out;
  }

  function dataset(obj){
    let rows=[];
    if(Array.isArray(obj)) rows=obj;
    else if(obj && typeof obj==="object"){
      for(const k of ["items","files","records","results","entries","data","scan","scanData"])
        if(Array.isArray(obj[k]) && obj[k].length>rows.length) rows=obj[k];
    }
    if(!rows.length) return {score:0,rows:[]};
    let signal=0;
    for(const r of rows.slice(0,50)){
      if(!r || typeof r!=="object") continue;
      for(const k of ["id","name","size","folder","file","webUrl","parentReference","path"]) if(k in r) signal++;
    }
    return {score:rows.length*10+signal,rows};
  }

  async function bestDataset(){
    let best=null;
    for(const x of storageObjects()){
      const d=dataset(x.value);
      if(!best || d.score>best.score) best={score:d.score,rows:d.rows,source:{kind:x.kind,key:x.key}};
    }
    for(const meta of await dbList()){
      if(!meta?.name || !/ians|onedrive|scan|vault/i.test(meta.name)) continue;
      await new Promise(resolve=>{
        const open=indexedDB.open(meta.name);
        open.onerror=()=>resolve();
        open.onsuccess=async()=>{
          const db=open.result, stores=[...db.objectStoreNames]; db.close();
          for(const s of stores){
            if(!/scan|item|file|folder|result|cache|index|record|entry/i.test(s)) continue;
            try{
              const rows=await readAll(meta.name,s), d=dataset(rows);
              if(!best || d.score>best.score) best={score:d.score,rows:d.rows,source:{kind:"indexedDB",db:meta.name,store:s}};
            }catch(e){ console.warn("[IANS V3.18] read fail",meta.name,s,e); }
          }
          resolve();
        };
      });
    }
    return best && best.rows?.length ? best : null;
  }

  function download(filename,obj){
    const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  async function exportScan(){
    const summary=visibleSummary();
    toast("Forbereder scan-eksport","Leser siste ferdige scan fra lokal lagring.");
    const best=await bestDataset();
    if(!best){
      alert("IANS finner den ferdige scanningen i grensesnittet, men ikke et eksportbart datasett i lokal lagring. Ikke nullstill scan-data.");
      return;
    }
    const ts=new Date().toISOString().replace(/[:.]/g,"-");
    download(`IANS-OneDrive-Scan-${ts}.json`,{
      version:VERSION,
      type:"ians-completed-scan-export",
      exportedAt:new Date().toISOString(),
      summary:{files:summary.files||best.rows.length,folders:summary.folders||0,dataSizeLabel:summary.bytes||"",completed:!!summary.completed},
      source:best.source,
      count:best.rows.length,
      items:best.rows
    });
    toast("Scan lastet ned",`${fmt(best.rows.length)} poster eksportert.`);
  }

  function exportDiag(){
    const ts=new Date().toISOString().replace(/[:.]/g,"-");
    download(`IANS-Diagnostics-${ts}.json`,{
      version:VERSION,type:"ians-runtime-diagnostics",exportedAt:new Date().toISOString(),
      visible:visibleSummary(),location:location.href,
      localStorageKeys:Object.keys(localStorage),sessionStorageKeys:Object.keys(sessionStorage)
    });
  }

  function addUI(){
    if(document.getElementById(`${NS}-panel`)) return;
    const host=[...document.querySelectorAll("section,article,div")]
      .filter(el=>/Scan & Vault/i.test(text(el)))
      .sort((a,b)=>text(a).length-text(b).length)[0];
    if(!host) return;
    const s=visibleSummary();
    if(!s.completed && !s.files) return;
    const panel=document.createElement("div");
    panel.id=`${NS}-panel`; panel.className="ians-v318-recovery-panel";
    panel.innerHTML=`<div class="ians-v318-recovery-copy"><strong>Siste ferdige skanning</strong><span>${fmt(s.files)} filer${s.folders?` · ${fmt(s.folders)} mapper`:""}${s.bytes?` · ${s.bytes}`:""}</span></div><div class="ians-v318-recovery-actions"><button type="button" id="${NS}-export">Last ned skann</button><button type="button" id="${NS}-diag">Last ned diagnostikk</button></div>`;
    host.prepend(panel);
    panel.querySelector(`#${NS}-export`).addEventListener("click",exportScan);
    panel.querySelector(`#${NS}-diag`).addEventListener("click",exportDiag);
  }

  function relabelOld(){
    const suspect=byLabel(/^(Last ned skann|Eksporter skann)$/i);
    if(!suspect || suspect.id===`${NS}-export` || suspect.dataset.iansV318Relabeled) return;
    suspect.dataset.iansV318Relabeled="1";
    suspect.textContent="Last ned diagnostikk";
    suspect.title="Eksporterer runtime-/debugstatus, ikke filindeksen.";
  }

  document.addEventListener("click",e=>{
    const el=e.target.closest("button,a");
    if(!el || !/Nullstill lokal scan-data/i.test(text(el))) return;
    const s=visibleSummary();
    if(!s.files) return;
    if(!confirm(`Det finnes en ferdig skanning med ${fmt(s.files)} filer. Nullstilling kan slette resultatet. Vil du virkelig fortsette?`)){
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    }
  },true);

  function render(){ relabelOld(); addUI(); }
  new MutationObserver(()=>requestAnimationFrame(render)).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  window.addEventListener("load",render,{once:true}); render();
  console.info(`[IANS] OneDrive Command V${VERSION} Scan Export Recovery aktiv`);
})();