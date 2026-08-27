/* IANS OneDrive Command V3.20 · Checkpoint Deep Recovery
   Reads the single checkpoint object and recursively inventories report content.
   Does not clear or mutate local scan data.
*/
(() => {
  "use strict";
  const VERSION = "3.20";
  const DB = "ians_onedrive_scan_v25";
  const STORE = "checkpoints";
  const NS = "ians-v320-checkpoint-recovery";

  const txt = el => (el?.textContent || "").trim();
  const fmt = n => new Intl.NumberFormat("nb-NO").format(Number(n)||0);

  function openDb(){
    return new Promise((resolve,reject)=>{
      const r=indexedDB.open(DB);
      r.onsuccess=()=>resolve(r.result);
      r.onerror=()=>reject(r.error);
    });
  }

  function readCheckpoints(){
    return new Promise(async (resolve,reject)=>{
      let db;
      try{ db=await openDb(); }catch(e){ return reject(e); }
      if(!db.objectStoreNames.contains(STORE)){ db.close(); return resolve([]); }
      const tx=db.transaction(STORE,"readonly");
      const store=tx.objectStore(STORE);
      const out=[];
      const req=store.openCursor();
      req.onsuccess=e=>{
        const c=e.target.result;
        if(c){ out.push(c.value); c.continue(); }
        else { db.close(); resolve(out); }
      };
      req.onerror=()=>{ db.close(); reject(req.error); };
    });
  }

  function inspectNode(node,path="report",depth=0,out=[]){
    if(depth>7) return out;
    if(Array.isArray(node)){
      const sample=node[0];
      out.push({
        path,
        type:"array",
        count:node.length,
        sampleType: sample===null ? "null" : Array.isArray(sample) ? "array" : typeof sample,
        sampleKeys: sample && typeof sample==="object" && !Array.isArray(sample) ? Object.keys(sample).slice(0,30) : []
      });
      if(node.length && depth<5){
        inspectNode(node[0], `${path}[0]`, depth+1, out);
      }
      return out;
    }
    if(node && typeof node==="object"){
      out.push({path,type:"object",keys:Object.keys(node).slice(0,100)});
      for(const [k,v] of Object.entries(node)){
        if(v && typeof v==="object"){
          inspectNode(v, `${path}.${k}`, depth+1, out);
        }
      }
    } else {
      out.push({path,type:typeof node,valuePreview:String(node).slice(0,100)});
    }
    return out;
  }

  function candidateArrays(node,path="report",depth=0,out=[]){
    if(depth>8 || !node) return out;
    if(Array.isArray(node)){
      const sample=node[0];
      let signal=0;
      if(sample && typeof sample==="object" && !Array.isArray(sample)){
        for(const k of ["id","name","size","file","folder","webUrl","parentReference","createdDateTime","lastModifiedDateTime","path"]){
          if(k in sample) signal++;
        }
      }
      out.push({path,count:node.length,signal,sampleKeys:sample&&typeof sample==="object"&&!Array.isArray(sample)?Object.keys(sample).slice(0,30):[]});
      if(sample && typeof sample==="object") candidateArrays(sample,`${path}[0]`,depth+1,out);
      return out;
    }
    if(typeof node==="object"){
      for(const [k,v] of Object.entries(node)){
        if(v && typeof v==="object") candidateArrays(v,`${path}.${k}`,depth+1,out);
      }
    }
    return out;
  }

  function getByPath(root,path){
    if(path==="report") return root;
    const clean=path.replace(/^report\.?/,"");
    if(!clean) return root;
    const parts=clean.split(".").map(p=>p.replace(/\[0\]/g,"")).filter(Boolean);
    let cur=root;
    for(const p of parts){
      if(cur==null) return undefined;
      cur=cur[p];
      if(Array.isArray(cur) && path.includes(`${p}[0]`)) cur=cur[0];
    }
    return cur;
  }

  function download(name,obj){
    const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  }

  async function loadCheckpoint(){
    const cps=await readCheckpoints();
    if(!cps.length) throw new Error("Ingen checkpoint funnet");
    cps.sort((a,b)=>String(b.savedAt||"").localeCompare(String(a.savedAt||"")));
    return cps[0];
  }

  async function exportStructure(){
    const cp=await loadCheckpoint();
    const report=cp.report;
    const arrays=candidateArrays(report).sort((a,b)=>b.count-a.count || b.signal-a.signal);
    const ts=new Date().toISOString().replace(/[:.]/g,"-");
    download(`IANS-Checkpoint-Structure-${ts}.json`,{
      version:VERSION,
      type:"ians-checkpoint-structure",
      exportedAt:new Date().toISOString(),
      checkpoint:{schema:cp.schema,version:cp.version,savedAt:cp.savedAt,account:cp.account},
      reportType:Array.isArray(report)?"array":typeof report,
      structure:inspectNode(report),
      candidateArrays:arrays
    });
  }

  async function exportBestArray(){
    const cp=await loadCheckpoint();
    const report=cp.report;
    const target=(()=>{const m=(document.body.innerText||"").match(/([\d\s.]+)\s*filer\b/i);return m?Number(m[1].replace(/[^\d]/g,""))||0:0})();
    const arrays=candidateArrays(report).sort((a,b)=>{
      const da=target?Math.abs(a.count-target):999999999;
      const db=target?Math.abs(b.count-target):999999999;
      const sa=(a.signal*1000000)-da;
      const sb=(b.signal*1000000)-db;
      return sb-sa;
    });
    const best=arrays.find(a=>a.count>0 && a.signal>=2) || arrays.find(a=>a.count>1000);
    if(!best){
      alert("Fant ingen tydelig fil-array i checkpoint.report. Last ned strukturfilen først.");
      return;
    }
    const data=getByPath(report,best.path);
    if(!Array.isArray(data)){
      alert("Valgt kandidat var ikke et array. Last ned strukturfilen for analyse.");
      return;
    }
    const ok=confirm(`Eksportere kandidat:\n\n${best.path}\n${fmt(best.count)} poster\nSignal: ${best.signal}\nMål fra UI: ${fmt(target)} filer\n\nFortsette?`);
    if(!ok) return;
    const ts=new Date().toISOString().replace(/[:.]/g,"-");
    download(`IANS-OneDrive-Scan-${ts}.json`,{
      version:VERSION,
      type:"ians-completed-scan-export",
      exportedAt:new Date().toISOString(),
      source:{kind:"indexedDB-checkpoint",db:DB,store:STORE,path:best.path},
      checkpoint:{schema:cp.schema,version:cp.version,savedAt:cp.savedAt,account:cp.account},
      count:data.length,
      items:data
    });
  }

  function addUI(){
    if(document.getElementById(`${NS}-panel`)) return;
    const host=[...document.querySelectorAll("section,article,div")]
      .filter(el=>/Scan & Vault/i.test(txt(el)))
      .sort((a,b)=>txt(a).length-txt(b).length)[0];
    if(!host) return;
    const panel=document.createElement("div");
    panel.id=`${NS}-panel`;
    panel.className="ians-v320-panel";
    panel.innerHTML=`
      <div class="ians-v320-copy">
        <strong>Checkpoint Deep Recovery</strong>
        <span>Leser ${DB} → ${STORE} → report</span>
      </div>
      <div class="ians-v320-actions">
        <button id="${NS}-structure" type="button">Last ned checkpoint-struktur</button>
        <button id="${NS}-export" type="button">Eksporter beste report-array</button>
      </div>`;
    host.prepend(panel);
    panel.querySelector(`#${NS}-structure`).addEventListener("click",exportStructure);
    panel.querySelector(`#${NS}-export`).addEventListener("click",exportBestArray);
  }

  document.addEventListener("click",e=>{
    const el=e.target.closest("button,a");
    if(!el) return;
    if(/Nullstill lokal scan-data/i.test(txt(el))){
      if(!confirm("Dette kan slette checkpointet med den ferdige scanningen. Vil du virkelig fortsette?")){
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      }
    }
  },true);

  new MutationObserver(()=>requestAnimationFrame(addUI)).observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener("load",addUI,{once:true});
  addUI();
  console.info(`[IANS] OneDrive Command V${VERSION} Checkpoint Deep Recovery aktiv`);
})();