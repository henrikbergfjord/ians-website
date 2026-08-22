(() => {
  const E=window.FinanceEngine;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function build(d,r,actions,aiText=''){
    const name=esc(d.name||'Din');
    const date=new Intl.DateTimeFormat('nb-NO',{dateStyle:'long'}).format(new Date());
    const expenseRows=Object.entries(r.monthlyExpenses).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const actionHtml=actions.map((a,i)=>`<div class="r-action"><b>${i+1}</b><div><strong>${esc(a.title)}</strong><p>${esc(a.text)}</p></div></div>`).join('');
    const ai=aiText?`<div class="r-ai"><h2>AI-oppsummering</h2><p>${esc(aiText).replace(/\n/g,'<br>')}</p></div>`:'';
    return `
      <style>
      .report-page{width:794px;min-height:1123px;padding:64px 68px;background:#fff;color:#172620;font-family:Arial,sans-serif;position:relative}
      .report-page h1,.report-page h2{font-family:Georgia,serif;font-weight:500}.report-page h1{font-size:48px;line-height:1.02;margin:30px 0}.report-page h2{font-size:28px}.r-k{font-size:11px;letter-spacing:2px;font-weight:800;color:#456b5d}.r-muted{color:#68766f}.r-hero{margin-top:90px}.r-big{font-family:Georgia,serif;font-size:58px}.r-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:28px 0}.r-box{padding:18px;background:#f4f6f2;border-radius:14px}.r-box span{font-size:12px;color:#68766f;display:block}.r-box strong{font-size:23px}.r-table{width:100%;border-collapse:collapse}.r-table td{padding:11px 0;border-bottom:1px solid #e5e8e2}.r-table td:last-child{text-align:right;font-weight:700}.r-action{display:grid;grid-template-columns:38px 1fr;gap:14px;padding:15px 0;border-bottom:1px solid #e5e8e2}.r-action>b{width:32px;height:32px;border-radius:50%;background:#e8dfcf;display:grid;place-items:center}.r-action p{margin:4px 0;color:#68766f;font-size:13px}.r-quote{margin-top:70px;padding:28px;background:linear-gradient(135deg,#eef3ef,#f5ecdd);border-radius:20px;font-family:Georgia,serif;font-size:24px}.r-foot{position:absolute;bottom:40px;left:68px;right:68px;display:flex;justify-content:space-between;font-size:10px;color:#849089}.r-ai{background:#f4f6f2;padding:20px;border-radius:16px}.r-ai p{font-size:13px;line-height:1.6}
      </style>
      <section class="report-page">
        <div class="r-k">MONEY PLANNER · IANS</div>
        <div class="r-hero"><h1>${name === 'Din' ? 'Din økonomiske plan' : name+'s økonomiske plan'}</h1><p class="r-muted">${date}</p>
          <div class="r-big">${E.money(r.margin)}</div><p>Månedlig margin etter registrerte utgifter og avsetning til årsutgifter.</p>
          <div class="r-quote">Små forbedringer i dag kan gi større valgfrihet senere.</div>
        </div><div class="r-foot"><span>Pedagogisk økonomiverktøy – ikke kredittvurdering</span><span>1</span></div>
      </section>
      <section class="report-page">
        <div class="r-k">DIN SITUASJON I DAG</div><h2>Oversikten</h2>
        <div class="r-grid">
          <div class="r-box"><span>Netto inntekt / mnd</span><strong>${E.money(r.income)}</strong></div>
          <div class="r-box"><span>Utgifter inkl. årsreserve</span><strong>${E.money(r.totalExpense)}</strong></div>
          <div class="r-box"><span>Registrert sparing / mnd</span><strong>${E.money(r.saving)}</strong></div>
          <div class="r-box"><span>Økonomisk helseindikator</span><strong>${r.score}/100</strong></div>
          <div class="r-box"><span>Total registrert gjeld</span><strong>${E.money(r.debt)}</strong></div>
          <div class="r-box"><span>Buffer</span><strong>${E.money(d.buffer)}</strong></div>
        </div>
        <h2>Hvor pengene går</h2><table class="r-table">${expenseRows.map(([k,v])=>`<tr><td>${esc(k)}</td><td>${E.money(v)}</td></tr>`).join('')}<tr><td>Avsetning årsutgifter</td><td>${E.money(r.annualReserve)}</td></tr></table>
        <div class="r-foot"><span>Beløpene bygger på opplysningene du selv har registrert.</span><span>2</span></div>
      </section>
      <section class="report-page">
        <div class="r-k">BUFFER · LÅN · SPARING</div><h2>Robusthet og muligheter</h2>
        <div class="r-grid">
          <div class="r-box"><span>Buffer dekker ca.</span><strong>${r.bufferCoverage.toFixed(1).replace('.',',')} mnd</strong></div>
          <div class="r-box"><span>Anbefalt årsreserve / mnd</span><strong>${E.money(r.annualReserve)}</strong></div>
          <div class="r-box"><span>Belåningsgrad</span><strong>${r.ltv?E.pct(r.ltv):'–'}</strong></div>
          <div class="r-box"><span>Estimert årlig rente, grovt</span><strong>${E.money(r.annualInterest)}</strong></div>
        </div>
        <h2>Hvis fast sparing fortsetter</h2>
        <table class="r-table">${r.projections.map(p=>`<tr><td>${p.years} år</td><td>${E.money(p.value)} <span class="r-muted">(innbetalt ${E.money(p.contributed)})</span></td></tr>`).join('')}</table>
        <p class="r-muted">Scenarioverdien bruker oppgitt forventet avkastning og er ikke en garanti. Skatt, kostnader og markedsutvikling er ikke modellert.</p>
        <div class="r-foot"><span>Scenario – ikke investeringsråd</span><span>3</span></div>
      </section>
      <section class="report-page">
        <div class="r-k">90-DAGERS RETNING</div><h2>Dine prioriterte neste steg</h2>${actionHtml}
        ${ai}
        <h2 style="margin-top:30px">Nyttige steder å sjekke</h2>
        <p><strong>Finansportalen:</strong> sammenligning av finansielle produkter.</p>
        <p><strong>Skatteetaten:</strong> skatt, fradrag og skattekort.</p>
        <p><strong>NAV økonomi og gjeld:</strong> offentlig informasjon og rådgivning ved økonomiske problemer.</p>
        <p><strong>Norsk Pensjon:</strong> samlet pensjonsoversikt.</p>
        <div class="r-foot"><span>Kontroller alltid gjeldende priser og vilkår hos aktuell tilbyder.</span><span>4</span></div>
      </section>`;
  }

  async function download(d,r,actions,aiText=''){
    const host=document.getElementById('reportDocument');
    host.innerHTML=build(d,r,actions,aiText);
    if(!window.html2canvas||!window.jspdf){
      window.print(); return {fallback:true};
    }
    const {jsPDF}=window.jspdf;
    const pages=[...host.querySelectorAll('.report-page')];
    const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
    for(let i=0;i<pages.length;i++){
      const canvas=await html2canvas(pages[i],{scale:1.7,backgroundColor:'#ffffff',useCORS:true});
      const img=canvas.toDataURL('image/jpeg',.92);
      if(i) pdf.addPage();
      pdf.addImage(img,'JPEG',0,0,210,297,undefined,'FAST');
    }
    const safe=(d.name||'min').trim().toLowerCase().replace(/[^a-z0-9æøå]+/gi,'-').replace(/^-|-$/g,'');
    pdf.save(`money-planner-${safe||'rapport'}.pdf`);
    return {fallback:false};
  }
  window.MoneyReport={build,download};
})();