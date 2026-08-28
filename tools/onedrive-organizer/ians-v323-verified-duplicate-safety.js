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
