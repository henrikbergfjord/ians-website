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
