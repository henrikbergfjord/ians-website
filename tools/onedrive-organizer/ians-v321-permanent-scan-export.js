/* IANS OneDrive Command V3.21 · Permanent Scan Export
   Permanent export path:
   - Full scan export => checkpoint.report.files
   - Full report export => checkpoint.report
   - Checkpoint export => full checkpoint wrapper for resume/import
   - Legacy review-queue export is relabeled diagnostics
   - No Graph calls, no deletes, no mutation of scan data
*/
(() => {
  "use strict";

  const VERSION = "3.21";
  const DB = "ians_onedrive_scan_v25";
  const STORE = "checkpoints";
  const NS = "ians-v321-permanent-export";

  const text = el => (el?.textContent || "").trim();
  const fmt = n => new Intl.NumberFormat("nb-NO").format(Number(n)||0);

  function openDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB);
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
  }

  async function readLatestCheckpoint(){
    const db=await openDb();
    if(!db.objectStoreNames.contains(STORE)){
      db.close();
      throw new Error(`Mangler store "${STORE}"`);
    }

    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,"readonly");
      const store=tx.objectStore(STORE);
      const rows=[];
      const req=store.openCursor();

      req.onsuccess=e=>{
        const cursor=e.target.result;
        if(cursor){
          rows.push(cursor.value);
          cursor.continue();
        }else{
          db.close();
          if(!rows.length) return reject(new Error("Ingen checkpoint funnet"));
          rows.sort((a,b)=>String(b.savedAt||"").localeCompare(String(a.savedAt||"")));
          resolve(rows[0]);
        }
      };
      req.onerror=()=>{
        db.close();
        reject(req.error);
      };
    });
  }

  function downloadJson(filename,obj){
    const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2500);
  }

  function nowStamp(){
    return new Date().toISOString().replace(/[:.]/g,"-");
  }

  function toast(title,body=""){
    if(typeof window.iansToast==="function"){
      window.iansToast(title,body,"info",5000);
    }else{
      console.info(`[IANS V${VERSION}] ${title}${body?": "+body:""}`);
    }
  }

  function summaryFromCheckpoint(cp){
    const s=cp?.report?.summary || {};
    return {
      files:Number(s.files)||cp?.report?.files?.length||0,
      folders:Number(s.folders)||0,
      fileBytes:Number(s.fileBytes)||0,
      generatedAt:cp?.report?.generatedAt||null,
      scanStartedAt:cp?.report?.scanStartedAt||null,
      scanRoot:cp?.report?.scanRoot||null,
      account:cp?.report?.account||cp?.account||null
    };
  }

  async function exportScan(){
    try{
      toast("Forbereder full scan-eksport","Leser checkpoint.report.files.");
      const cp=await readLatestCheckpoint();
      const files=cp?.report?.files;

      if(!Array.isArray(files)){
        throw new Error("checkpoint.report.files finnes ikke som array");
      }

      const summary=summaryFromCheckpoint(cp);

      downloadJson(`IANS-OneDrive-Scan-${nowStamp()}.json`,{
        version:VERSION,
        type:"ians-completed-scan-export",
        exportedAt:new Date().toISOString(),
        source:{kind:"indexedDB-checkpoint",db:DB,store:STORE,path:"report.files"},
        checkpointMeta:{
          schema:cp.schema||null,
          version:cp.version||null,
          savedAt:cp.savedAt||null
        },
        summary,
        count:files.length,
        items:files
      });

      toast("Scan eksportert",`${fmt(files.length)} filer`);
    }catch(err){
      console.error("[IANS V3.21] Scan export failed",err);
      alert(`Kunne ikke eksportere scan:\n${err.message||err}`);
    }
  }

  async function exportReport(){
    try{
      toast("Forbereder komplett rapport","Eksporterer hele checkpoint.report.");
      const cp=await readLatestCheckpoint();
      const report=cp?.report;

      if(!report || typeof report!=="object"){
        throw new Error("checkpoint.report mangler");
      }

      downloadJson(`IANS-OneDrive-Complete-Report-${nowStamp()}.json`,{
        version:VERSION,
        type:"ians-complete-report-export",
        exportedAt:new Date().toISOString(),
        source:{kind:"indexedDB-checkpoint",db:DB,store:STORE,path:"report"},
        checkpointMeta:{
          schema:cp.schema||null,
          version:cp.version||null,
          savedAt:cp.savedAt||null
        },
        report
      });

      const c=Array.isArray(report.files)?report.files.length:0;
      toast("Komplett rapport eksportert",`${fmt(c)} filer + analyse`);
    }catch(err){
      console.error("[IANS V3.21] Report export failed",err);
      alert(`Kunne ikke eksportere komplett rapport:\n${err.message||err}`);
    }
  }

  async function exportCheckpoint(){
    try{
      toast("Forbereder checkpoint","Eksporterer hele checkpoint-wrapperen.");
      const cp=await readLatestCheckpoint();

      downloadJson(`IANS-OneDrive-Checkpoint-${nowStamp()}.json`,{
        version:VERSION,
        type:"ians-checkpoint-export",
        exportedAt:new Date().toISOString(),
        source:{kind:"indexedDB",db:DB,store:STORE},
        checkpoint:cp
      });

      toast("Checkpoint eksportert","Kan brukes som trygg backup for import/resume.");
    }catch(err){
      console.error("[IANS V3.21] Checkpoint export failed",err);
      alert(`Kunne ikke eksportere checkpoint:\n${err.message||err}`);
    }
  }

  async function verifyCheckpoint(){
    try{
      const cp=await readLatestCheckpoint();
      const report=cp?.report;
      const files=report?.files;
      const issues=[];

      if(!cp?.schema) issues.push("checkpoint.schema mangler");
      if(!cp?.savedAt) issues.push("checkpoint.savedAt mangler");
      if(!report || typeof report!=="object") issues.push("report mangler");
      if(!Array.isArray(files)) issues.push("report.files mangler");
      if(Array.isArray(files) && Number(report?.summary?.files||files.length)!==files.length){
        issues.push(`summary.files (${report?.summary?.files}) matcher ikke report.files (${files.length})`);
      }

      if(issues.length){
        alert("Checkpoint funnet, men med avvik:\n\n• "+issues.join("\n• "));
      }else{
        alert(
          `Checkpoint OK\n\n`+
          `Filer: ${fmt(files.length)}\n`+
          `Mapper: ${fmt(report?.summary?.folders||0)}\n`+
          `Lagret: ${cp.savedAt}\n`+
          `Schema: ${cp.schema}\n`+
          `Intern versjon: ${cp.version||"ukjent"}`
        );
      }
    }catch(err){
      alert(`Verifisering feilet:\n${err.message||err}`);
    }
  }

  function makeButton(label,handler,primary=false){
    const b=document.createElement("button");
    b.type="button";
    b.textContent=label;
    b.className=primary?"ians-v321-primary":"";
    b.addEventListener("click",handler);
    return b;
  }

  function findHost(){
    return [...document.querySelectorAll("section,article,div")]
      .filter(el=>/Scan & Vault/i.test(text(el)))
      .sort((a,b)=>text(a).length-text(b).length)[0] || null;
  }

  async function addPanel(){
    if(document.getElementById(`${NS}-panel`)) return;
    const host=findHost();
    if(!host) return;

    let cp;
    try{ cp=await readLatestCheckpoint(); }catch{return;}
    const summary=summaryFromCheckpoint(cp);
    if(!summary.files) return;

    const panel=document.createElement("div");
    panel.id=`${NS}-panel`;
    panel.className="ians-v321-panel";

    const copy=document.createElement("div");
    copy.className="ians-v321-copy";
    copy.innerHTML=`
      <strong>Siste ferdige skanning</strong>
      <span>${fmt(summary.files)} filer · ${fmt(summary.folders)} mapper · lagret ${cp.savedAt||"ukjent"}</span>
    `;

    const actions=document.createElement("div");
    actions.className="ians-v321-actions";
    actions.append(
      makeButton("Last ned skann",exportScan,true),
      makeButton("Last ned komplett rapport",exportReport),
      makeButton("Last ned checkpoint",exportCheckpoint),
      makeButton("Verifiser",verifyCheckpoint)
    );

    panel.append(copy,actions);
    host.prepend(panel);
  }

  function relabelLegacyButtons(){
    const candidates=[...document.querySelectorAll("button,a")];

    for(const el of candidates){
      const t=text(el);

      // Do not touch our new buttons.
      if(el.closest(`#${NS}-panel`)) continue;

      if(/^(Last ned skann|Eksporter skann)$/i.test(t)){
        el.textContent="Last ned diagnostikk";
        el.title="Eldre runtime-/review-eksport. Bruk V3.21-panelet for full scan.";
        el.dataset.iansV321Legacy="1";
      }
    }
  }

  function protectReset(){
    document.addEventListener("click",async e=>{
      const el=e.target.closest("button,a");
      if(!el) return;
      if(!/Nullstill lokal scan-data/i.test(text(el))) return;

      let count=0;
      try{
        const cp=await readLatestCheckpoint();
        count=cp?.report?.files?.length||0;
      }catch{}

      const msg=count
        ? `Det finnes en ferdig skanning med ${fmt(count)} filer. Nullstilling kan slette checkpointet. Vil du virkelig fortsette?`
        : "Nullstilling kan slette lokal scan-data. Vil du virkelig fortsette?";

      if(!confirm(msg)){
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    },true);
  }

  function render(){
    relabelLegacyButtons();
    addPanel();
  }

  protectReset();
  new MutationObserver(()=>requestAnimationFrame(render))
    .observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  window.addEventListener("load",render,{once:true});
  render();

  console.info(`[IANS] OneDrive Command V${VERSION} Permanent Scan Export aktiv`);
})();