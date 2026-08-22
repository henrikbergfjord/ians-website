(() => {
  const E=window.FinanceEngine;
  let currentStep=1, state={}, result={}, actions=[], aiText='';
  const form=document.getElementById('moneyForm');
  const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];

  function normalizeInput(el){
    if(!el.matches('input[inputmode="numeric"],input[inputmode="decimal"]')) return;
    if(el.value && !/[a-zA-Z]/.test(el.value)){
      el.value=el.value.replace(/[^\d,.\s-]/g,'');
    }
  }
  function data(){
    const fd=new FormData(form), o={};
    for(const [k,v] of fd.entries()) o[k]=v;
    return o;
  }
  function render(){
    state=data(); result=E.calculate(state); actions=E.actions(state,result);
    q('#metricIncome').textContent=E.money(result.income); if(q('#asideIncome')) q('#asideIncome').textContent=E.money(result.income);
    q('#metricExpenses').textContent=E.money(result.totalExpense); if(q('#asideExpenses')) q('#asideExpenses').textContent=E.money(result.totalExpense);
    q('#metricMargin').textContent=E.money(result.margin); if(q('#asideMargin')) q('#asideMargin').textContent=E.money(result.margin); if(q('#heroSaving')) q('#heroSaving').textContent=E.money(result.saving);
    q('#metricSavingsRate').textContent=E.pct(result.savingsRate);
    q('#annualReserveExplain').textContent=E.money(result.annualReserve)+'/mnd';
    q('#heroMargin').textContent=E.money(result.margin);
    q('#previewMargin').textContent=E.money(result.margin);
    const name=(state.name||'').trim();
    q('#previewTitle').textContent=name?`${name}s økonomiske plan`:'Din økonomiske plan';
    q('#previewDate').textContent=new Intl.DateTimeFormat('nb-NO',{dateStyle:'long'}).format(new Date());

    const progress=Math.max(5,Math.min(100,result.income?50+(result.margin/result.income*100):5));
    q('#heroProgress').style.width=progress+'%';
    q('#heroText').textContent=result.income===0?'Fyll inn noen tall – så begynner bildet å ta form.':result.margin>=0?`Du har ${E.money(result.margin)} igjen etter registrerte kostnader.`:`Budsjettet viser et underskudd på ${E.money(Math.abs(result.margin))} per måned.`;

    const circumference=264;
    q('#scoreArc').style.strokeDashoffset=circumference-(circumference*result.score/100);
    q('#healthScore').textContent=result.score;
    q('#healthLabel').textContent=result.score>=80?'Sterk struktur':result.score>=65?'God retning':result.score>=50?'Noe å jobbe med':'Trenger oppmerksomhet';
    q('#healthExplain').textContent='Indikatoren vurderer blant annet margin, buffer, sparing og dyr gjeld. Den er ikke en kredittscore.';

    const micro=E.n(state.microAmount), freq=state.microFrequency||'daily';
    const annual=micro*(freq==='daily'?365:freq==='weekly'?52:12);
    const freqText=freq==='daily'?'per dag':freq==='weekly'?'per uke':'per måned';
    q('#microResult').textContent=`${E.money(micro)} ${freqText} tilsvarer omtrent ${E.money(annual)} i året.`;

    q('#expenseChartHint').textContent=result.totalExpense?E.money(result.totalExpense)+'/mnd':'Legg inn utgifter';
    window.MoneyCharts?.update(result);

    q('#quickInsights').innerHTML=buildInsights().map(x=>`<div class="insight ${x.warn?'warn':''}"><strong>${x.title}</strong>${x.text}</div>`).join('');
    q('#actionGrid').innerHTML=actions.map((a,i)=>`<article class="action-card"><div class="rank">${i+1}</div><h3>${a.title}</h3><p>${a.text}</p><span class="impact">${a.impact}</span></article>`).join('');

    updateScenarios();
  }
  function buildInsights(){
    const a=[];
    if(result.annualReserve>0)a.push({title:'Planlegg årsutgiftene',text:`Sett av ${E.money(result.annualReserve)} hver måned til registrerte årsutgifter.`});
    if(result.bufferCoverage && result.bufferCoverage<2)a.push({title:'Bufferen er sårbar',text:`Den dekker ca. ${result.bufferCoverage.toFixed(1).replace('.',',')} måned(er) av nødvendige kostnader.`,warn:true});
    if(result.consumer>0)a.push({title:'Dyr gjeld fortjener oppmerksomhet',text:`Registrert saldo: ${E.money(result.consumer)}. Sjekk effektiv rente og vilkår.`,warn:true});
    if(result.ltv>0)a.push({title:'Belåningsgrad',text:`Omtrent ${E.pct(result.ltv)} basert på oppgitt boligverdi. Lavere belåningsgrad kan påvirke bankens prising.`});
    if(!a.length)a.push({title:'Bygg bildet steg for steg',text:'Når du legger inn inntekt, kostnader, lån og buffer får du mer konkrete forklaringer her.'});
    return a.slice(0,4);
  }
  function showStep(n){
    currentStep=Math.max(1,Math.min(6,n));
    qa('.form-step').forEach(x=>x.classList.toggle('active',Number(x.dataset.step)===currentStep));
    qa('#stepNav button').forEach(x=>x.classList.toggle('active',Number(x.dataset.stepTarget)===currentStep));
    q('#prevStep').style.visibility=currentStep===1?'hidden':'visible';
    q('#nextStep').textContent=currentStep===6?'Se min plan ↓':'Neste →';
    if(currentStep===6 && n>6) q('#insights').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function updateScenarios(){
    const rate=Number(q('#scenarioRate').value), save=Number(q('#scenarioSave').value), cut=Number(q('#scenarioCut').value);
    q('#scenarioRateLabel').textContent=rate.toFixed(2).replace('.',',')+' prosentpoeng';
    q('#scenarioRateResult').textContent=E.money(result.mortgage*rate/100)+'/år';
    q('#scenarioSaveLabel').textContent=E.money(save)+'/mnd';
    q('#scenarioSaveResult').textContent=E.money(E.fvMonthly(result.saving+save,state.returnRate,10))+' på 10 år';
    q('#scenarioCutLabel').textContent=E.money(cut)+'/mnd'; q('#scenarioCutResult').textContent=E.money(cut*12)+'/år';
  }
  function demo(){
    const d={name:'Ola',ageGroup:'40–49',household:'2 voksne med barn',housing:'Eier med lån',goal:'control',goalAmount:'150000',incomeMain:'52000',incomeExtra:'2500',incomeBenefits:'0',incomeOther:'0',expenseHousing:'16800',expenseEnergy:'2100',expenseFood:'8500',expenseTransport:'5200',expenseInsurance:'1800',expenseTelecom:'1300',expenseChildren:'2600',expenseSubscriptions:'850',expenseLifestyle:'3500',expenseOther:'1000',annualCar:'18000',annualTravel:'30000',annualGifts:'12000',annualHealth:'6000',annualHome:'18000',annualOther:'6000',mortgageBalance:'3200000',mortgageRate:'5,20',mortgagePayment:'16800',carLoanBalance:'190000',carLoanRate:'7,1',carLoanPayment:'3900',consumerBalance:'22000',consumerRate:'19,9',consumerPayment:'1500',homeValue:'5200000',grossAnnual:'900000',buffer:'45000',monthlySaving:'2500',returnRate:'4',bufferGoal:'120000',microAmount:'50',microFrequency:'daily'};
    Object.entries(d).forEach(([k,v])=>{const el=form.elements[k];if(el)el.value=v}); render(); showStep(1);
  }
  async function runAI(){
    const btn=q('#runAi'), out=q('#aiResult'); btn.disabled=true; btn.textContent='Analyserer…'; out.hidden=false; out.textContent='Sender kun anonymiserte nøkkeltall…';
    const payload={
      goal:state.goal,household:state.household,housing:state.housing,
      income:result.income,totalExpense:result.totalExpense,margin:result.margin,annualReserve:result.annualReserve,
      savingsRate:result.savingsRate,buffer:E.n(state.buffer),bufferCoverage:result.bufferCoverage,
      debt:{mortgage:result.mortgage,mortgageRate:E.n(state.mortgageRate),carLoan:result.carLoan,carLoanRate:E.n(state.carLoanRate),consumer:result.consumer,consumerRate:E.n(state.consumerRate)},
      ltv:result.ltv,debtIncome:result.debtIncome,monthlySaving:result.saving,returnRate:E.n(state.returnRate)
    };
    try{
      const res=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const body=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(body.error||`HTTP ${res.status}`);
      aiText=body.analysis||'Ingen analyse mottatt.';
      out.textContent=aiText; q('#aiDot').style.background='#4e806b'; q('#aiStatus').textContent='AI-analyse mottatt';
    }catch(err){
      aiText='';
      out.textContent='AI er ikke konfigurert eller kunne ikke nås akkurat nå. Resten av Money Planner fungerer normalt.\n\nTeknisk melding: '+err.message;
      q('#aiDot').style.background='#b96f64'; q('#aiStatus').textContent='AI ikke tilgjengelig';
    }finally{btn.disabled=false;btn.textContent='✨ Analyser min økonomi med AI'}
  }
  async function downloadPdf(){
    const st=q('#pdfStatus'); st.textContent='Bygger rapport…';
    try{const x=await window.MoneyReport.download(state,result,actions,aiText);st.textContent=x.fallback?'PDF-biblioteket var ikke tilgjengelig. Utskriftsdialogen er åpnet som reserve.':'PDF-en er generert.'}catch(e){st.textContent='Kunne ikke generere PDF. Prøv «Skriv ut / lagre som PDF».'}
  }

  function makeCommitment(){
    const chosen=qa('.commit-check').filter(x=>x.checked).map(x=>x.parentElement.textContent.trim());
    const nm=(state.name||'Jeg').trim();
    const items=chosen.length?chosen:[
      'Jeg åpner all økonomisk post og alle digitale krav.',
      'Jeg lager én komplett liste over gjeld, avtaler og frister.',
      'Jeg kontakter dem jeg ikke klarer å betale.',
      'Jeg følger planen i 90 dager og justerer i stedet for å gi opp.'
    ];
    const top=actions.slice(0,3).map((a,i)=>`${i+1}. ${a.title}: ${a.text}`).join('\n');
    const txt=`MIN 90-DAGERS FORPLIKTELSE\n\n${nm} velger å ta aktiv kontroll på økonomien de neste 90 dagene.\n\nMINE FORPLIKTELSER\n- ${items.join('\n- ')}\n\nMINE TRE FØRSTE PRIORITERINGER\n${top || '1. Skaff komplett oversikt.\n2. Stopp nye unødvendige kostnader.\n3. Ta kontakt med dem du ikke kan betale.'}\n\nSTART I DAG\nÅpne posten. Finn tallene. Gjør én konkret handling. Du trenger ikke løse alt på én gang.`;
    q('#commitmentResult').className='commit-output';
    q('#commitmentResult').textContent=txt;
    return txt;
  }
  function downloadCommitment(){
    const txt=q('#commitmentResult').textContent||makeCommitment();
    const blob=new Blob([txt],{type:'text/plain;charset=utf-8'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='money-planner-90-dagers-plan.txt';a.click();URL.revokeObjectURL(a.href);
  }

  form.addEventListener('input',e=>{normalizeInput(e.target);render()});form.addEventListener('change',render);
  q('#nextStep').addEventListener('click',()=>{ if(currentStep<6)showStep(currentStep+1); else q('#insights').scrollIntoView({behavior:'smooth'})});
  q('#prevStep').addEventListener('click',()=>showStep(currentStep-1));
  qa('#stepNav button').forEach(b=>b.addEventListener('click',()=>showStep(Number(b.dataset.stepTarget))));
  qa('[data-demo]').forEach(b=>b.addEventListener('click',demo));
  ['scenarioRate','scenarioSave','scenarioCut'].forEach(id=>q('#'+id).addEventListener('input',updateScenarios));
  q('#runAi').addEventListener('click',runAI);
  q('#downloadPdf').addEventListener('click',downloadPdf);
  q('#printReport').addEventListener('click',()=>{q('#reportDocument').innerHTML=window.MoneyReport.build(state,result,actions,aiText);window.print()});
  q('#makeCommitment')?.addEventListener('click',makeCommitment);
  q('#downloadCommitment')?.addEventListener('click',downloadCommitment);
  window.addEventListener('DOMContentLoaded',()=>{window.MoneyCharts?.init();showStep(1);render()});
})();