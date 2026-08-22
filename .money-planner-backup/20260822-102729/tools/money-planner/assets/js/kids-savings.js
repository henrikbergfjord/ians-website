(() => {
  const $=s=>document.querySelector(s);
  const num=v=>{const x=Number(String(v||'').replace(/\s/g,'').replace(',','.'));return Number.isFinite(x)?x:0};
  const money=v=>new Intl.NumberFormat('nb-NO',{maximumFractionDigits:0}).format(Math.round(v))+' kr';
  const jobs=[
    ['🛏️','Rydde rommet skikkelig','Tidy your room properly'],
    ['📚','Gjøre lekser eller lese uten påminnelse','Do homework or reading without being reminded'],
    ['🍽️','Dekke på eller rydde av bordet','Set or clear the table'],
    ['🧺','Hjelpe med å sortere eller brette klær','Help sort or fold laundry'],
    ['🛒','Hjelpe en voksen med å bære inn varer','Help an adult carry in groceries'],
    ['🧹','Gjøre en avtalt ekstra ryddejobb hjemme','Do an agreed extra tidy-up job at home'],
    ['🌱','Hjelpe litt ekstra i hagen','Do an extra garden job'],
    ['♻️','Samle og pante flasker','Collect and return bottles'],
    ['🐕','Hjelpe med kjæledyr etter avtale med en voksen','Help with a pet as agreed with an adult'],
    ['🤝','Hjelpe en voksen med en liten avtalt oppgave','Help an adult with a small agreed task']
  ];
  function renderJobs(){
    const en=window.MoneyI18n?.lang()==='en';
    const host=$('#kidsJobs'); if(!host)return;
    host.innerHTML=jobs.map((j,i)=>`<label class="kid-job"><input type="checkbox" data-job="${i}"><span>${j[0]}</span><b>${en?j[2]:j[1]}</b><input type="number" min="0" step="5" placeholder="${en?'Reward':'Belønning'}" data-job-price="${i}"></label>`).join('');
  }
  function build(){
    const en=window.MoneyI18n?.lang()==='en';
    const name=$('#kidName').value.trim()||(en?'You':'Du');
    const goal=$('#kidGoal').value.trim()||(en?'your goal':'målet ditt');
    const cost=num($('#kidCost').value), saved=num($('#kidSaved').value), weekly=num($('#kidWeekly').value);
    const remaining=Math.max(0,cost-saved), weeks=weekly>0?Math.ceil(remaining/weekly):0;
    const pct=cost>0?Math.min(100,Math.round(saved/cost*100)):0;
    const selected=[...document.querySelectorAll('[data-job]:checked')].map(x=>{
      const i=Number(x.dataset.job); const p=num(document.querySelector(`[data-job-price="${i}"]`).value);
      return `${jobs[i][0]} ${en?jobs[i][2]:jobs[i][1]}${p?` – ${money(p)}`:''}`;
    });
    $('#kidProgressFill').style.width=pct+'%';
    $('#kidProgressText').textContent=cost?`${pct}% · ${money(saved)} / ${money(cost)}`:(en?'Enter your goal amount':'Fyll inn målbeløpet');
    const msg = remaining<=0 && cost>0
      ? (en?`🏆 ${name}, you reached your goal!`:`🏆 ${name}, du har nådd målet ditt!`)
      : weekly>0 && cost>0
        ? (en?`⭐ ${name}, if you save ${money(weekly)} each week, you can reach ${goal} in about ${weeks} weeks.`:`⭐ ${name}, sparer du ${money(weekly)} hver uke, kan du nå ${goal} om omtrent ${weeks} uker.`)
        : (en?'Choose a goal and a weekly amount to see your plan.':'Velg et mål og et ukebeløp for å se planen din.');
    $('#kidsResult').innerHTML=`<strong>${msg}</strong><p>${en?'Still needed':'Du mangler'}: <b>${money(remaining)}</b></p>${selected.length?`<p>${en?'Extra jobs you agreed with an adult':'Ekstrajobber dere har avtalt'}:<br>${selected.join('<br>')}</p>`:''}`;
  }
  function download(){
    build();
    const text=document.querySelector('#kidsResult').innerText;
    const blob=new Blob([`IANS – ${window.MoneyI18n?.lang()==='en'?'MY FIRST SAVINGS PLAN':'MIN FØRSTE SPAREPLAN'}\n\n${text}\n\n${window.MoneyI18n?.lang()==='en'?'Small steps count.':'Små steg teller.'}`],{type:'text/plain;charset=utf-8'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='min-spareplan.txt';a.click();URL.revokeObjectURL(a.href);
  }
  window.addEventListener('DOMContentLoaded',()=>{
    renderJobs(); ['kidName','kidGoal','kidCost','kidSaved','kidWeekly'].forEach(id=>$('#'+id)?.addEventListener('input',build));
    $('#kidsJobs')?.addEventListener('input',build);
    $('#buildKidPlan')?.addEventListener('click',build);
    $('#downloadKidPlan')?.addEventListener('click',download);
    build();
  });
  window.addEventListener('moneyplanner:language',()=>{renderJobs();build()});
})();