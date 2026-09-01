(()=>{
'use strict';
const API='/api/booking';
const $=id=>document.getElementById(id);
const unit=$('unit'), phone=$('phone'), book=$('book'), confirmBox=$('confirm');
if(!unit||!phone||!book)return;

function selectedWindow(){
  const b=document.querySelector('.window.sel');
  const strong=b&&b.querySelector('strong');
  return strong?strong.textContent.trim():'';
}
function selectedUnit(){
  if(!unit.value)return '';
  const o=unit.options[unit.selectedIndex];
  return o?o.textContent.trim():'';
}
function message(text,ok=false){
  if(!confirmBox)return;
  confirmBox.style.display='block';
  confirmBox.className='confirm '+(ok?'good':'warn');
  confirmBox.textContent=text;
}
function setBusy(on){book.disabled=on;book.textContent=on?'Lagrer …':'Book leiligheten'}
function applySummary(data){
  if(!data||!Array.isArray(data.windows))return;
  for(const w of data.windows){
    for(const b of document.querySelectorAll('.window')){
      const s=b.querySelector('strong'); if(!s||s.textContent.trim()!==w.window)continue;
      const cap=b.querySelector('.cap');
      if(cap)cap.innerHTML=`<span>${w.booked} av ${w.booked+w.available} booket</span><span>${w.available} ledige</span>`;
      const bar=b.querySelector('.bar i'); if(bar)bar.style.width=`${Math.min(100,Math.round((w.booked/(w.booked+w.available||24))*100))}%`;
      b.disabled=w.available<=0&&!b.classList.contains('sel');
      b.title=w.available<=0?'Dette tidsvinduet er fullt':'';
    }
  }
}
async function refresh(){
  try{const r=await fetch(API,{cache:'no-store'});const j=await r.json();if(r.ok)applySummary(j)}catch(_){/* keep page usable; booking click will show server error */}
}

book.addEventListener('click',async e=>{
  e.preventDefault();e.stopImmediatePropagation();
  const u=selectedUnit(), p=phone.value.trim(), w=selectedWindow();
  if(!u)return message('Velg leiligheten din først.');
  if(!/^\s*(?:\+47)?\s*\d(?:[\s-]*\d){7}\s*$/.test(p))return message('Skriv inn et gyldig norsk telefonnummer med 8 siffer.');
  if(!w)return message('Velg et tidsvindu først.');
  setBusy(true);
  try{
    const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({unit:u,phone:p,window:w})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.error||'Bestillingen kunne ikke lagres.');
    if(j.summary)applySummary(j.summary);
    message(`${j.message||'Bestillingen er lagret'} ${u} · ${w}.`,true);
  }catch(err){message(`Kunne ikke lagre bestillingen: ${err.message}`)}finally{setBusy(false)}
},true);

const privacy=document.querySelector('.privacy');
if(privacy)privacy.textContent='Telefonnummeret brukes bare for gjennomføring av kontrollen og er kun tilgjengelig for styrets låste administrasjon. Opplysningene lagres sikkert på serversiden.';
const foot=document.querySelector('.foot');
if(foot)foot.textContent='IANS Booking V4 · sentral booking · automatisk kapasitet · låst administrasjon';
refresh();setInterval(refresh,15000);
})();
