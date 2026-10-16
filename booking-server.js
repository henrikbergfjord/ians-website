(()=>{
'use strict';
const API='/api/booking',$=id=>document.getElementById(id),unit=$('unit'),phone=$('phone'),book=$('book'),box=$('confirm');
if(!unit||!phone||!book)return;
let ready=false,busy=false;
function selectedWindow(){return document.querySelector('.window.sel')?.querySelector('strong')?.textContent.trim()||'';}
const canonicalUnit=v=>String(v||'').trim().slice(0,80).replace(/[\\/#?\u0000-\u001f\u007f]/g,'-').replace(/[^A-Za-z0-9 ._\-]/g,' ').replace(/\s+/g,' ').trim();
function selectedUnit(){return unit.value===''?'':unit.options[unit.selectedIndex]?.textContent.trim()||'';}
function message(text,ok=false){box.style.display='block';box.className='confirm '+(ok?'good':'warn');box.setAttribute('role','status');box.textContent=text;}
function controls(){book.disabled=busy||!ready;book.textContent=busy?'Lagrer …':'Book leiligheten';}
function applySummary(data){
 if(!Array.isArray(data?.windows)||!data.windows.length)throw Error('Ugyldig kapasitetsoversikt.');
 for(const w of data.windows){
  if(!Number.isFinite(w.booked)||!Number.isFinite(w.available)||w.booked<0||w.available<0)throw Error('Ugyldig kapasitet.');
  for(const b of document.querySelectorAll('.window')){
   if(b.querySelector('strong')?.textContent.trim()!==w.window)continue;
   const cap=b.querySelector('.cap');if(cap)cap.textContent=`${w.booked} booket · ${w.available} ledige`;
   const bar=b.querySelector('.bar i');if(bar)bar.style.width=`${Math.min(100,Math.round(w.booked/(w.booked+w.available||24)*100))}%`;
   b.disabled=w.available<=0;b.title=b.disabled?'Dette tidsvinduet er fullt':'';
   if(b.disabled&&b.classList.contains('sel')){b.classList.remove('sel');$('chosen').textContent='Ingen valgt';}
  }
 }
}
async function refresh(){
 try{const r=await fetch(API,{cache:'no-store'});if(!r.ok)throw Error();const data=await r.json();if(!data.ok)throw Error();const wasReady=ready;applySummary(data);ready=true;if(!wasReady)message('Bookingserveren er tilkoblet. Velg bolig og tidsvindu.');}
 catch{ready=false;for(const b of document.querySelectorAll('.window'))b.disabled=true;message('Bookingserveren kunne ikke nås. Ingen bestilling er registrert. Vi prøver tilkoblingen igjen automatisk.');}
 controls();
}
book.addEventListener('click',async e=>{
 e.preventDefault();if(busy||!ready)return;
 const u=selectedUnit(),p=phone.value.trim(),w=selectedWindow();
 if(!u)return message('Velg leiligheten din først.');
 if(!/^\s*(?:\+47)?\s*\d(?:[\s-]*\d){7}\s*$/.test(p))return message('Skriv inn et gyldig norsk telefonnummer med 8 siffer.');
 if(!w)return message('Velg et tidsvindu først.');
 busy=true;controls();
 try{
  const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({unit:u,phone:p,window:w})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||!j.ok||j.booking?.unit!==canonicalUnit(u)||j.booking?.window!==w)throw Error(j.error||'Serveren bekreftet ikke bestillingen.');
  if(j.summary)applySummary(j.summary);
  message(`Bestillingen er bekreftet lagret på serveren: ${u} · ${w}. Kontakt styret hvis den skal endres.`,true);
 }catch(err){message(`Bestillingen ble ikke bekreftet: ${err.message} Ikke send på nytt hvis du er usikker; kontakt styret for kontroll.`);}
 finally{busy=false;controls();}
});
controls();refresh();setInterval(refresh,15000);
})();
