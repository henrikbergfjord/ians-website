const fmt = n => new Intl.NumberFormat('no-NO',{style:'currency',currency:'NOK',maximumFractionDigits:0}).format(n);
function calcSN(){
  const units=+document.querySelector('#snUnits')?.value||204;
  const monthly=+document.querySelector('#snMonthly')?.value||500;
  const tv=+document.querySelector('#snTv')?.value||269;
  const months=+document.querySelector('#snMonths')?.value||18;
  const cost=+document.querySelector('#snCost')?.value||645704;
  const sla=+document.querySelector('#snSla')?.value||10000;
  const net=Math.max(0,monthly-tv), revenue=net*units*months, margin=revenue-cost;
  const breakEven=net*units>0?Math.ceil(cost/(net*units)):0;
  const tenYear=margin+(sla*12*10);
  const out={snRevenue:revenue,snMargin:margin,snTenYear:tenYear};
  Object.entries(out).forEach(([id,v])=>{const e=document.getElementById(id);if(e)e.textContent=fmt(v)});
  const be=document.getElementById('snBreakEven'); if(be)be.textContent=breakEven?`Måned ${breakEven}`:'–';
  document.querySelectorAll('[data-range]').forEach(el=>{const target=document.getElementById(el.dataset.range);if(target)target.textContent=el.value});
}
document.querySelectorAll('.sn-form input').forEach(i=>i.addEventListener('input',calcSN));calcSN();
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('sn-in')}),{threshold:.12});
document.querySelectorAll('.sn-card,.sn-layer,.sn-stat,.sn-step').forEach(e=>io.observe(e));

// Architecture 01–04: interactive depth panels
const layerButtons=[...document.querySelectorAll('[data-layer]')];
const layerPanels=[...document.querySelectorAll('[data-panel]')];
function openLayer(id){
  layerButtons.forEach(btn=>{
    const active=btn.dataset.layer===id;
    btn.classList.toggle('is-active',active);
    btn.setAttribute('aria-selected',active?'true':'false');
  });

  layerPanels.forEach(panel=>{
    const active=panel.dataset.panel===id;
    panel.classList.toggle('is-active',active);
    panel.hidden=!active;
  });

  const visual=document.getElementById('snArchitectureVisual');
  if(visual){
    visual.dataset.stage=id;
  }

  const label=document.getElementById('snBuildStageLabel');
  if(label){
    const labels={
      '01':'01 · CORE',
      '02':'02 · CORE + DISTRIBUSJON',
      '03':'03 · CORE + DISTRIBUSJON + BOLIGER',
      '04':'04 · KOMPLETT PLATTFORM'
    };
    label.textContent=labels[id]||id;
  }
}
layerButtons.forEach(btn=>btn.addEventListener('click',()=>openLayer(btn.dataset.layer)));

// Contact that also works when mailto is not configured
const email='henrik.bergfjord@outlook.com';
const copyBtn=document.getElementById('snCopyEmail');
const copyStatus=document.getElementById('snCopyStatus');
if(copyBtn){
  copyBtn.addEventListener('click',async()=>{
    try{
      await navigator.clipboard.writeText(email);
      copyStatus.textContent='E-postadressen er kopiert. Du kan lime den inn i ønsket e-posttjeneste.';
      copyBtn.textContent='Kopiert ✓';
      setTimeout(()=>copyBtn.textContent='Kopier e-postadresse',2200);
    }catch(err){
      const ta=document.createElement('textarea');ta.value=email;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();
      copyStatus.textContent='E-postadressen er kopiert.';
    }
  });
}

// Resident cost calculator
function calcResident(){
  const base=+document.querySelector('#rcBase')?.value||0;
  const speed=+document.querySelector('#rcSpeed')?.value||0;
  const tv=+document.querySelector('#rcTv')?.value||0;
  const netflix=+document.querySelector('#rcNetflix')?.value||0;
  const other=+document.querySelector('#rcOther')?.value||0;
  const month=base+speed+tv+netflix+other;
  const kr=n=>new Intl.NumberFormat('no-NO',{maximumFractionDigits:0}).format(n)+' kr';
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  set('rcMonth',kr(month)); set('rcYear',kr(month*12)+' / år'); set('rcFive',kr(month*60)); set('rcTen',kr(month*120));
  set('barBaseV',base); set('barSpeedV',speed); set('barTvV',tv); set('barStreamV',netflix+other);
  set('orbitTotal',kr(month)+'/mnd'); set('orbitTv',tv); set('orbitOther',other);
  const max=Math.max(month,1);
  [['barBase',base],['barSpeed',speed],['barTv',tv],['barStream',netflix+other]].forEach(([id,v])=>{const e=document.getElementById(id);if(e)e.style.width=Math.max(2,(v/max)*100)+'%'});
  document.querySelectorAll('[data-resident-range]').forEach(el=>{const target=document.getElementById(el.dataset.residentRange);if(target)target.textContent=el.value});
}
document.querySelectorAll('[data-resident-range]').forEach(i=>i.addEventListener('input',calcResident));
calcResident();

// Example building: interactive digital twin hotspots
const caseButtons=[...document.querySelectorAll('[data-case]')];
const casePanels=[...document.querySelectorAll('[data-case-panel]')];
function openCase(id){
  caseButtons.forEach(btn=>btn.classList.toggle('is-active',btn.dataset.case===id));
  casePanels.forEach(panel=>{
    const active=panel.dataset.casePanel===id;
    panel.classList.toggle('is-active',active);
    panel.hidden=!active;
  });
}
caseButtons.forEach(btn=>btn.addEventListener('click',()=>openCase(btn.dataset.case)));
