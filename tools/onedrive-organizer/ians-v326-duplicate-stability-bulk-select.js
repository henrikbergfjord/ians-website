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