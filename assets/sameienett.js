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
