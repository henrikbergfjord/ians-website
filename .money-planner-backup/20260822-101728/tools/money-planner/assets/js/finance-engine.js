(() => {
  const n = v => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const s = String(v ?? '').trim().replace(/\s/g,'').replace(',','.');
    const x = Number(s);
    return Number.isFinite(x) ? x : 0;
  };
  const sum = a => a.reduce((x,y)=>x+n(y),0);
  const fvMonthly = (monthly, annualRatePct, years) => {
    const p=n(monthly), r=n(annualRatePct)/100/12, periods=years*12;
    if (!r) return p*periods;
    return p*((Math.pow(1+r,periods)-1)/r);
  };
  const money = v => new Intl.NumberFormat('nb-NO',{maximumFractionDigits:0}).format(Math.round(n(v)))+' kr';
  const pct = v => new Intl.NumberFormat('nb-NO',{maximumFractionDigits:1}).format(n(v))+' %';

  function calculate(d){
    const income = sum([d.incomeMain,d.incomePartner,d.incomeExtra,d.incomeBenefits,d.incomeRental,d.incomeOther]);
    const monthlyExpenses = {
      Bolig:n(d.expenseHousing), Energi:n(d.expenseEnergy), Mat:n(d.expenseFood), Transport:n(d.expenseTransport),
      Forsikring:n(d.expenseInsurance), Telekom:n(d.expenseTelecom), Barn:n(d.expenseChildren),
      Abonnement:n(d.expenseSubscriptions), Livsstil:n(d.expenseLifestyle), Annet:n(d.expenseOther)
    };
    const annualTotal = sum([d.annualCar,d.annualTravel,d.annualGifts,d.annualHealth,d.annualHome,d.annualOther]);
    const annualReserve = annualTotal/12;
    const baseExpense = sum(Object.values(monthlyExpenses));
    const totalExpense = baseExpense + annualReserve;
    const margin = income-totalExpense;
    const saving = n(d.monthlySaving);
    const savingsRate = income ? saving/income*100 : 0;

    const mortgage=n(d.mortgageBalance), carLoan=n(d.carLoanBalance), consumer=n(d.consumerBalance);
    const debt=mortgage+carLoan+consumer;
    const annualInterest = mortgage*n(d.mortgageRate)/100 + carLoan*n(d.carLoanRate)/100 + consumer*n(d.consumerRate)/100;
    const ltv = n(d.homeValue) ? mortgage/n(d.homeValue)*100 : 0;
    const debtIncome = n(d.grossAnnual) ? debt/n(d.grossAnnual) : 0;
    const necessary = sum([monthlyExpenses.Bolig,monthlyExpenses.Energi,monthlyExpenses.Mat,monthlyExpenses.Transport,monthlyExpenses.Forsikring,monthlyExpenses.Telekom,monthlyExpenses.Barn]) + annualReserve;
    const autoBufferGoal = Math.max(necessary*2.5, 0);
    const bufferGoal = n(d.bufferGoal) || autoBufferGoal;
    const bufferCoverage = necessary ? n(d.buffer)/necessary : 0;

    let score=50;
    if(income>0) score+=5;
    if(margin>=0) score+=12; else score-=18;
    if(savingsRate>=10) score+=10; else if(savingsRate>0) score+=4;
    if(bufferCoverage>=3) score+=12; else if(bufferCoverage>=1) score+=5; else if(n(d.buffer)>0) score+=1;
    if(consumer===0) score+=7; else score-=Math.min(15,5+(n(d.consumerRate)>10?5:0));
    if(ltv>0 && ltv<60) score+=4;
    if(debtIncome>5) score-=8;
    score=Math.max(0,Math.min(100,Math.round(score)));

    const years=[1,5,10,20];
    const projections = years.map(y=>({years:y,contributed:saving*12*y,value:fvMonthly(saving,d.returnRate,y)}));

    return {income,monthlyExpenses,annualTotal,annualReserve,baseExpense,totalExpense,margin,saving,savingsRate,mortgage,carLoan,consumer,debt,annualInterest,ltv,debtIncome,necessary,bufferGoal,bufferCoverage,score,projections};
  }

  function actions(d,r){
    const out=[];
    const push=(title,text,impact='Prioritet')=>out.push({title,text,impact});
    if(r.margin<0) push('Stopp budsjettlekkasjen',`Registrerte kostnader er ${money(Math.abs(r.margin))} høyere enn inntekten per måned. Start med faste kostnader og de største kategoriene før du øker sparingen.`,'Høy prioritet');
    if(r.consumer>0) push('Se på dyr gjeld først',`Du har ${money(r.consumer)} registrert som kredittkort/forbruksgjeld. Sammenlign effektiv rente og vurder om raskere nedbetaling reduserer rentekostnaden.`,'Høy prioritet');
    if(r.mortgage>0 && n(d.mortgageRate)>0) push('Forhandle boliglånet',`En reduksjon på 0,50 prosentpoeng på dagens saldo tilsvarer grovt ${money(r.mortgage*.005)} mindre rente første år, før skatteeffekt og saldoendring.`,'Mulig stor effekt');
    if(r.bufferCoverage<2) push('Bygg en robust buffer',`Registrert buffer dekker omtrent ${r.bufferCoverage.toFixed(1).replace('.',',')} måned(er) av nødvendige kostnader. Et mål på 2–3 måneder kan redusere behovet for dyr kreditt når noe uventet skjer.`,'Trygghet');
    if(r.annualReserve>0) push('Automatiser årsutgiftene',`Sett av omtrent ${money(r.annualReserve)} per måned til de registrerte årsutgiftene. Da blir bilservice, gaver, ferie og vedlikehold planlagte i stedet for «overraskelser».`,'Stabilitet');
    if(r.savingsRate<10 && r.margin>0) push('Flytt sparing til lønningsdagen',`Du har positiv margin. En automatisk overføring samme dag som lønn kommer gjør sparing til en fast kostnad i stedet for det som eventuelt er igjen.`,'Vane');
    if(!out.length) push('Behold rytmen',`Tallene dine viser ingen åpenbar akutt ubalanse. Bruk scenarioene til å teste om mer buffer, lavere rente eller økt sparing passer målene dine.`,'Vedlikehold');
    return out.slice(0,6);
  }

  window.FinanceEngine={n,sum,fvMonthly,money,pct,calculate,actions};
})();