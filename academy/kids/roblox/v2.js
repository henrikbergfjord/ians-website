/*
 IANS Roblox Academy V2
 Kursmappe · rapport · kompetanse · diplom
 Beholder iansRobloxAcademyV1 urørt.
*/

const IANS_ROBLOX_LEVEL = {
  name: 'IANS Kids Digital Safety · Level 2',
  age: 'Veiledende nivå: 9–12 år',
  pass: 85
};

const competenceMap = {
  'Roblox & teknologi': [0,1,2],
  'Robux & økonomi': [3],
  'Spillpsykologi': [4],
  'Personvern & identitet': [5,6],
  'Scam & phishing': [7],
  'Sosiale situasjoner': [8],
  'Kontosikkerhet': [9],
  'Roblox Safety': [10],
  'Master': [11]
};

function robloxV2Stats() {
  const total = lessons.length;
  const done = state.done.length;
  const percent = total ? Math.round(done / total * 100) : 0;

  const competence = Object.entries(competenceMap).map(([name, chapterList]) => {
    const ids = lessons
      .map((l,i) => chapterList.includes(l.ch) ? i : -1)
      .filter(i => i >= 0);

    const completed = ids.filter(i => state.done.includes(i)).length;

    return {
      name,
      completed,
      total: ids.length,
      percent: ids.length ? Math.round(completed / ids.length * 100) : 0
    };
  });

  const adultTotal = lessons.filter(l => l.type === 'adult').length;
  const adultDone = state.adult.length;

  const masterIds = lessons
    .map((l,i) => l.ch === 11 ? i : -1)
    .filter(i => i >= 0);

  const masterDone = masterIds.filter(i => state.done.includes(i)).length;
  const masterPercent = masterIds.length
    ? Math.round(masterDone / masterIds.length * 100)
    : 0;

  const passed =
    done === total &&
    adultDone >= adultTotal &&
    masterPercent >= IANS_ROBLOX_LEVEL.pass;

  return {
    total, done, percent,
    competence,
    adultTotal, adultDone,
    masterPercent,
    passed
  };
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;');
}

function reportRows() {
  return lessons.map((l,i) => {
    const completed = state.done.includes(i);

    return `
      <article class="report-item">
        <div class="report-number">
          ${completed ? '✅' : '⬜'} Oppdrag ${i + 1}
        </div>
        <h3>${esc(l.t)}</h3>
        <p><b>Spørsmål:</b> ${esc(l.q)}</p>
        ${
          completed
            ? `<p><b>Riktig svar:</b> ${esc(l.a[l.c])}</p>
               <p><b>Hvorfor:</b> ${esc(l.why)}</p>`
            : `<p class="muted">Ikke gjennomført ennå. Fasiten vises når oppdraget er fullført.</p>`
        }
      </article>
    `;
  }).join('');
}

function openCourseFolder() {
  const s = robloxV2Stats();

  const competence = s.competence.map(x => `
    <div class="competence-row">
      <div>
        <b>${esc(x.name)}</b>
        <span>${x.completed}/${x.total}</span>
      </div>
      <div class="progress"><span style="width:${x.percent}%"></span></div>
      <small>${x.percent}% gjennomført</small>
    </div>
  `).join('');

  const html = `
    <section class="card v2-folder">
      <div class="v2-head">
        <div>
          <div class="v2-kicker">📘 MIN KURSMAPPE</div>
          <h2>Roblox Academy</h2>
          <p class="muted">
            Her kan du se hva du har lært og skrive ut læringsrapporten din.
          </p>
        </div>
        <button class="btn" onclick="closeCourseFolder()">Lukk</button>
      </div>

      <div class="v2-summary">
        <div><strong>${s.done}/${s.total}</strong><span>oppdrag</span></div>
        <div><strong>${s.percent}%</strong><span>gjennomført</span></div>
        <div><strong>${s.adultDone}/${s.adultTotal}</strong><span>voksenoppdrag</span></div>
        <div><strong>${s.masterPercent}%</strong><span>Master</span></div>
      </div>

      <h3>📊 Kompetanse</h3>
      <div class="competence-list">${competence}</div>

      <div class="v2-actions">
        <button class="btn" onclick="printLearningReport()">
          📄 Læringsrapport / PDF
        </button>

        <button class="btn ${s.passed ? '' : 'locked-btn'}"
          ${s.passed ? 'onclick="printDiploma()"' : 'disabled'}>
          🏆 ${s.passed ? 'Åpne diplom' : 'Diplom låst'}
        </button>
      </div>

      ${
        s.passed
          ? `<p class="v2-success">🏆 Gratulerer! Kravene til Roblox Smart Player er oppfylt.</p>`
          : `<p class="muted">
               Diplomet åpnes når alle oppdrag og voksenoppdrag er gjennomført
               og Master-kravet på ${IANS_ROBLOX_LEVEL.pass}% er oppfylt.
             </p>`
      }
    </section>
  `;

  let host = document.getElementById('courseFolder');
  if (!host) {
    host = document.createElement('section');
    host.id = 'courseFolder';
    document.querySelector('.wrap').appendChild(host);
  }

  host.innerHTML = html;
  host.scrollIntoView({behavior:'smooth', block:'start'});
}

function closeCourseFolder() {
  const el = document.getElementById('courseFolder');
  if (el) el.remove();
}

function printableWindow(title, body) {
  const w = window.open('', '_blank');

  if (!w) {
    alert('Nettleseren blokkerte utskriftsvinduet. Tillat popup for IANS og prøv igjen.');
    return null;
  }

  w.document.open();
  w.document.write(`
<!doctype html>
<html lang="no">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
  *{box-sizing:border-box}
  body{
    margin:0;
    background:#eef3f7;
    color:#172332;
    font:15px system-ui,-apple-system,Segoe UI,sans-serif;
  }
  main{
    width:min(900px,94%);
    margin:30px auto;
    background:white;
    padding:42px;
    box-shadow:0 8px 30px #0002;
  }
  h1{font-size:34px;margin-bottom:8px}
  h2{margin-top:32px}
  h3{margin-bottom:8px}
  .muted{color:#607080}
  .report-item{
    border-top:1px solid #d8e0e7;
    padding:18px 0;
    break-inside:avoid;
  }
  .report-number{
    font-size:12px;
    font-weight:800;
    color:#47718e;
  }
  .print-actions{
    display:flex;
    gap:10px;
    margin-bottom:25px;
  }
  button{
    border:0;
    padding:12px 18px;
    border-radius:9px;
    background:#147ac2;
    color:white;
    font-weight:800;
    cursor:pointer;
  }
  .diploma{
    min-height:900px;
    border:8px double #223d56;
    padding:70px 55px;
    text-align:center;
    display:flex;
    flex-direction:column;
    justify-content:center;
  }
  .seal{font-size:70px}
  .diploma h1{font-size:48px}
  .recipient{
    font-size:34px;
    font-weight:900;
    margin:25px 0;
  }
  .level{
    margin:30px auto;
    padding:15px;
    border-top:1px solid #8899a8;
    border-bottom:1px solid #8899a8;
    max-width:620px;
  }
  @media print{
    body{background:white}
    main{width:100%;margin:0;box-shadow:none}
    .print-actions{display:none}
    @page{size:A4;margin:14mm}
  }
</style>
</head>
<body>
<main>
<div class="print-actions">
<button onclick="window.print()">🖨️ Skriv ut / Lagre som PDF</button>
<button onclick="window.close()">Lukk</button>
</div>
${body}
</main>
</body>
</html>`);
  w.document.close();

  return w;
}

function printLearningReport() {
  const s = robloxV2Stats();

  const body = `
    <div>
      <div><b>IANS · ACADEMY KIDS</b></div>
      <h1>📘 Min Roblox Academy-rapport</h1>

      <p>
        Rapporten viser gjennomførte oppdrag og forklaringene barnet har låst opp.
        Oppgaver som ikke er gjennomført viser ikke fasiten.
      </p>

      <h2>Kursstatus</h2>
      <p>
        <b>${s.done}/${s.total}</b> oppdrag ·
        <b>${s.percent}%</b> gjennomført ·
        <b>${s.adultDone}/${s.adultTotal}</b> voksenoppdrag
      </p>

      <h2>Kompetanseområder</h2>
      ${s.competence.map(x =>
        `<p><b>${esc(x.name)}:</b> ${x.percent}% (${x.completed}/${x.total})</p>`
      ).join('')}

      <h2>Oppdrag og forklaringer</h2>
      ${reportRows()}

      <p class="muted">
        IANS Academy Kids · Dette er en læringsrapport, ikke en offentlig sertifisering.
      </p>
    </div>
  `;

  printableWindow('IANS Roblox Academy – læringsrapport', body);
}

function printDiploma() {
  const s = robloxV2Stats();

  if (!s.passed) {
    alert('Diplomet er ikke låst opp ennå.');
    return;
  }

  const today = new Intl.DateTimeFormat('nb-NO', {
    day:'2-digit',
    month:'long',
    year:'numeric'
  }).format(new Date());

  const body = `
    <section class="diploma">
      <div class="seal">🏆</div>

      <div><b>IANS ACADEMY KIDS</b></div>

      <h1>ROBLOX SMART PLAYER</h1>

      <p>Diplom for gjennomført kurs</p>

      <div class="recipient">Academy Explorer</div>

      <p>
        har gjennomført IANS Roblox Academy og vist kunnskap om
      </p>

      <p>
        <b>
          Roblox · Robux · digital dømmekraft · personvern ·
          nettsvindel · kommunikasjon · kontosikkerhet
        </b>
      </p>

      <div class="level">
        <b>${esc(IANS_ROBLOX_LEVEL.name)}</b><br>
        ${esc(IANS_ROBLOX_LEVEL.age)}<br>
        Master-krav: ${IANS_ROBLOX_LEVEL.pass}%
      </div>

      <p>
        Gjennomført ${esc(today)}
      </p>

      <p>
        Master: <b>${s.masterPercent}%</b>
      </p>

      <p class="muted">
        IANS Academy-diplom · Ikke en offentlig eller formell sertifisering
      </p>
    </section>
  `;

  printableWindow('IANS Roblox Smart Player – diplom', body);
}


function smartPlayerTemplateBody(index) {
  const item = SMART_PLAYER_TEMPLATES[index];
  if (!item) return '';

  const commonTop = `
    <div><b>IANS · ACADEMY KIDS</b></div>
    <h1>${item.icon} ${esc(item.title)}</h1>
    <p>${esc(item.desc)}</p>
    <p class="muted">Navn: ______________________________ &nbsp;&nbsp; Dato: _______________</p>
  `;

  const bodies = [
    `
      <h2>STOPP · SJEKK · SPØR</h2>
      <div class="report-item"><h3>1. Hva lover meldingen eller nettsiden?</h3><p>____________________________________________________________</p></div>
      <div class="report-item"><h3>2. Ber den om passord, innlogging, penger eller personopplysninger?</h3><p>☐ Ja &nbsp;&nbsp; ☐ Nei</p></div>
      <div class="report-item"><h3>3. Lover den gratis Robux eller noe som virker for godt til å være sant?</h3><p>☐ Ja &nbsp;&nbsp; ☐ Nei</p></div>
      <div class="report-item"><h3>4. Kjenner og stoler jeg på avsenderen?</h3><p>☐ Ja &nbsp;&nbsp; ☐ Nei &nbsp;&nbsp; ☐ Vet ikke</p></div>
      <div class="report-item"><h3>5. Hva gjør jeg nå?</h3><p>☐ Stopper &nbsp; ☐ Lukker lenken &nbsp; ☐ Spør en voksen &nbsp; ☐ Rapporterer</p></div>
    `,
    `
      <h2>Min sikkerhetssjekk</h2>
      <div class="report-item"><p>☐ Jeg bruker et sterkt passord som andre ikke kjenner.</p></div>
      <div class="report-item"><p>☐ Jeg deler aldri passord eller innloggingskode i chat.</p></div>
      <div class="report-item"><p>☐ Jeg vet hvilke personopplysninger jeg ikke skal dele.</p></div>
      <div class="report-item"><p>☐ Jeg stopper hvis noen vil flytte en hemmelig samtale til en annen app.</p></div>
      <div class="report-item"><p>☐ Jeg vet hvordan jeg blokkerer og rapporterer.</p></div>
      <div class="report-item"><p>☐ Jeg vet hvilken voksen jeg kan hente hvis noe føles feil.</p></div>
      <h2>Min viktigste sikkerhetsregel</h2>
      <p>____________________________________________________________</p>
    `,
    `
      <h2>Før jeg bruker Robux</h2>
      <div class="report-item"><h3>Hvor mange Robux har jeg?</h3><p>________________ Robux</p></div>
      <div class="report-item"><h3>Hva vurderer jeg å kjøpe?</h3><p>____________________________________________________________</p></div>
      <div class="report-item"><h3>Pris</h3><p>________________ Robux</p></div>
      <div class="report-item"><h3>Hvor mye har jeg igjen etterpå?</h3><p>________________ Robux</p></div>
      <div class="report-item"><h3>Er dette et behov eller et ønske?</h3><p>☐ Behov &nbsp;&nbsp; ☐ Ønske &nbsp;&nbsp; ☐ Jeg er usikker</p></div>
      <div class="report-item"><h3>Jeg har ventet og tenkt før jeg kjøper</h3><p>☐ Ja &nbsp;&nbsp; ☐ Jeg spør en voksen først</p></div>
    `,
    `
      <h2>Min STOPP-plan</h2>
      <div class="report-item"><h3>1 · STOPP</h3><p>Ikke svar, betal eller klikk videre når noe føles feil.</p></div>
      <div class="report-item"><h3>2 · TA VARE PÅ DET DU KAN VISE</h3><p>Fortell eller vis en voksen hva som skjedde. Ikke spre ubehagelig innhold videre.</p></div>
      <div class="report-item"><h3>3 · HENT EN VOKSEN</h3><p>Min trygge voksen er: ______________________________________</p></div>
      <div class="report-item"><h3>4 · BLOKKER / RAPPORTER</h3><p>☐ Blokker bruker &nbsp;&nbsp; ☐ Rapporter hendelsen &nbsp;&nbsp; ☐ Sikre kontoen ved behov</p></div>
      <div class="report-item"><h3>Det viktigste jeg skal huske</h3><p>Jeg trenger ikke løse vanskelige ting på nettet alene.</p></div>
    `,
    `
      <h2>Fra spiller til skaper</h2>
      <div class="report-item"><h3>Spillet jeg undersøker</h3><p>____________________________________________________________</p></div>
      <div class="report-item"><h3>Hva gjør at jeg vil fortsette å spille?</h3><p>____________________________________________________________</p></div>
      <div class="report-item"><h3>Hvordan brukes belønninger, lyder eller checkpoints?</h3><p>____________________________________________________________</p></div>
      <div class="report-item"><h3>Min egen spillidé</h3><p>____________________________________________________________</p><p>____________________________________________________________</p></div>
      <div class="report-item"><h3>Hvordan gjør jeg spillet trygt og rettferdig?</h3><p>____________________________________________________________</p></div>
      <div style="height:180px;border:2px dashed #aab7c2;margin-top:18px;padding:12px">✏️ Tegn kartet eller spillideen din her</div>
    `,
    `
      <h2>Vår Smart Player-avtale</h2>
      <p>Denne avtalen lager vi sammen. Målet er trygghet, tillit og gode valg – ikke overvåkning.</p>
      <div class="report-item"><h3>1. Når jeg trenger hjelp</h3><p>____________________________________________________________</p></div>
      <div class="report-item"><h3>2. Våre regler for Robux og kjøp</h3><p>____________________________________________________________</p></div>
      <div class="report-item"><h3>3. Hva jeg aldri deler med andre</h3><p>____________________________________________________________</p></div>
      <div class="report-item"><h3>4. Hva vi gjør hvis noen oppfører seg dårlig</h3><p>____________________________________________________________</p></div>
      <div class="report-item"><h3>5. Når vi snakker sammen om Roblox</h3><p>____________________________________________________________</p></div>
      <p style="margin-top:45px">Barn: ____________________________ &nbsp;&nbsp; Voksen: ____________________________</p>
    `
  ];

  return commonTop + (bodies[index] || '');
}

function printSmartPlayerTemplate(index) {
  const item = SMART_PLAYER_TEMPLATES[index];
  if (!item) return;

  const r = rewardState();

  if (r.xp < item.xp) {
    alert(`Denne templaten låses opp ved ${item.xp} XP.`);
    return;
  }

  printableWindow(
    `IANS Roblox Academy – ${item.title}`,
    smartPlayerTemplateBody(index)
  );
}

function installRobloxV2Button() {
  if (document.getElementById('courseFolderBtn')) return;

  const statsCard = document.querySelector('.stats')?.closest('.card');
  if (!statsCard) return;

  const actions = document.createElement('div');
  actions.className = 'actions';
  actions.innerHTML = `
    <button id="courseFolderBtn" class="btn" onclick="openCourseFolder()">
      📘 Min kursmappe
    </button>
  `;

  statsCard.appendChild(actions);
}

document.addEventListener('DOMContentLoaded', installRobloxV2Button);
setTimeout(installRobloxV2Button, 0);

/* =========================================================
   IANS Roblox Academy V2.1 · Smart Player Reward Vault
   Rewards are derived from existing progress.
   No storage migration and no Robux/reward purchase system.
   ========================================================= */

(function(){

const REWARD_LEVELS = [
  {xp:0,    name:'Rookie',       icon:'🌱'},
  {xp:150,  name:'Explorer',     icon:'🧭'},
  {xp:350,  name:'Smart Player', icon:'🎮'},
  {xp:650,  name:'Security Pro', icon:'🛡️'},
  {xp:1000, name:'Roblox Master',icon:'🏆'}
];


const SMART_PLAYER_TEMPLATES = [
  {
    xp:50,
    icon:'🔎',
    title:'Scam Detective-sjekk',
    desc:'Et enkelt ark for å stoppe opp og undersøke mistenkelige tilbud, meldinger og lenker.'
  },
  {
    xp:150,
    icon:'🔐',
    title:'Min trygge Roblox-konto',
    desc:'Sjekkliste for passord, personvern, innlogging og hvem du kan stole på.'
  },
  {
    xp:300,
    icon:'💰',
    title:'Mitt Robux-budsjett',
    desc:'Planlegg Robux før du kjøper og skill mellom det du ønsker og det du faktisk trenger.'
  },
  {
    xp:500,
    icon:'🆘',
    title:'Hvis noe skjer på Roblox',
    desc:'En enkel STOPP-plan for ubehagelige meldinger, svindel, press eller andre problemer.'
  },
  {
    xp:700,
    icon:'🏗️',
    title:'Spilldesigner-arket',
    desc:'Se et Roblox-spill med skaperøyne og tegn din egen idé til en trygg opplevelse.'
  },
  {
    xp:1000,
    icon:'🤝',
    title:'Smart Player-familieavtale',
    desc:'Barn og voksen lager noen få tydelige regler sammen for Roblox, Robux og hjelp.'
  }
];

const PRO_TIPS = [
  {
    xp:50,
    icon:'🔎',
    title:'Pro Tip #1 · Sjekk hvem som laget spillet',
    text:'Før du bruker tid eller Robux i en opplevelse, se hvem som har laget den og hva du faktisk får.'
  },
  {
    xp:150,
    icon:'🔐',
    title:'Pro Tip #2 · Beskytt kontoen',
    text:'Et sterkt og unikt passord gjør det vanskeligere for andre å komme inn på kontoen din. Del aldri passordet i chat.'
  },
  {
    xp:300,
    icon:'💰',
    title:'Pro Tip #3 · Tenk før du bruker Robux',
    text:'Spill kan bruke tidsbegrensninger og spesialtilbud for å få deg til å kjøpe raskt. Stopp og spør: Trenger jeg egentlig dette?'
  },
  {
    xp:500,
    icon:'🕵️',
    title:'Scam Detective · Gratis Robux?',
    text:'Nettsider, videoer eller meldinger som lover gratis Robux mot passord, innlogging eller mistenkelige lenker er et kraftig faresignal.'
  },
  {
    xp:700,
    icon:'🧠',
    title:'Creator Secret · Se spillet med nye øyne',
    text:'Når du spiller, legg merke til checkpoints, belønninger, lyder og menyer. Noen har designet hvert av disse valgene.'
  },
  {
    xp:1000,
    icon:'🏗️',
    title:'Roblox Master Secret · Fra spiller til skaper',
    text:'Roblox Studio lar deg bygge egne opplevelser. Det du lærer om spilldesign som spiller kan bli kunnskap du bruker som skaper.'
  }
];

function rewardState(){
  let raw={done:[]};

  try{
    raw=JSON.parse(localStorage.getItem('iansRobloxAcademyV1') || '{"done":[]}');
  }catch(e){}

  const completed=Array.isArray(raw.done) ? raw.done.length : 0;
  const xp=completed*25;

  let level=REWARD_LEVELS[0];

  for(const candidate of REWARD_LEVELS){
    if(xp>=candidate.xp) level=candidate;
  }

  const next=REWARD_LEVELS.find(item=>item.xp>xp) || null;

  return {completed,xp,level,next};
}

function renderRewardVault(){
  const mount=document.getElementById('iansRewardVault');
  if(!mount) return;

  const r=rewardState();

  let progress=100;
  if(r.next){
    const span=r.next.xp-r.level.xp;
    progress=Math.max(0,Math.min(100,
      ((r.xp-r.level.xp)/span)*100
    ));
  }

  const tips=PRO_TIPS.map(tip=>{
    const unlocked=r.xp>=tip.xp;

    return `
      <article class="reward-tip ${unlocked?'unlocked':'locked'}">
        <div class="reward-tip-icon">${unlocked ? tip.icon : '🔒'}</div>
        <div>
          <div class="reward-state">${unlocked ? 'LÅST OPP' : `KREVER ${tip.xp} XP`}</div>
          <h3>${unlocked ? tip.title : 'Hemmelig Roblox-tips'}</h3>
          <p>${unlocked ? tip.text : `Fortsett kurset for å låse opp dette tipset.`}</p>
        </div>
      </article>
    `;
  }).join('');

  mount.innerHTML=`
    <section class="reward-vault">
      <div class="reward-head">
        <div>
          <div class="reward-eyebrow">🏆 MIN ROBLOX-REISE</div>
          <h2>${r.level.icon} Level · ${r.level.name}</h2>
          <p>${r.xp} XP · ${r.completed} oppdrag fullført</p>
        </div>
        <div class="reward-xp">${r.xp}<small>XP</small></div>
      </div>

      <div class="reward-progress">
        <span style="width:${progress}%"></span>
      </div>

      <div class="reward-next">
        ${
          r.next
          ? `${r.next.xp-r.xp} XP til ${r.next.icon} ${r.next.name}`
          : '🏆 Høyeste Smart Player-nivå nådd'
        }
      </div>

      <div class="reward-title">
        <div>
          <div class="reward-eyebrow">🎁 REWARD VAULT</div>
          <h2>Pro Tips & Creator Secrets</h2>
        </div>
        <div>${PRO_TIPS.filter(t=>r.xp>=t.xp).length}/${PRO_TIPS.length} åpnet</div>
      </div>

      <div class="reward-grid">
        ${tips}
      </div>

      <div class="reward-title" style="margin-top:30px">
        <div>
          <div class="reward-eyebrow">🧰 SMART PLAYER-VERKTØYKASSE</div>
          <h2>Templates du kan bruke</h2>
        </div>
        <div>${SMART_PLAYER_TEMPLATES.filter(t=>r.xp>=t.xp).length}/${SMART_PLAYER_TEMPLATES.length} åpnet</div>
      </div>

      <div class="reward-grid">
        ${SMART_PLAYER_TEMPLATES.map((item,index)=>{
          const unlocked=r.xp>=item.xp;
          return `
            <article class="reward-tip ${unlocked?'unlocked':'locked'}">
              <div class="reward-tip-icon">${unlocked ? item.icon : '🔒'}</div>
              <div>
                <div class="reward-state">${unlocked ? 'KLAR TIL BRUK' : `KREVER ${item.xp} XP`}</div>
                <h3>${unlocked ? item.title : 'Hemmelig Smart Player-template'}</h3>
                <p>${unlocked ? item.desc : 'Fortsett kurset for å låse opp denne templaten.'}</p>
                ${unlocked ? `<button class="btn" onclick="printSmartPlayerTemplate(${index})">🖨️ Åpne / skriv ut</button>` : ''}
              </div>
            </article>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

function installRewardVault(){
  if(document.getElementById('iansRewardVault')){
    renderRewardVault();
    return;
  }

  const host=document.querySelector('main') || document.body;
  const mount=document.createElement('div');
  mount.id='iansRewardVault';
  host.appendChild(mount);

  renderRewardVault();
}

document.addEventListener('DOMContentLoaded',installRewardVault);

/* Refresh automatically when course progress changes. */
window.addEventListener('storage',renderRewardVault);

const originalSetItem=localStorage.setItem.bind(localStorage);
localStorage.setItem=function(key,value){
  originalSetItem(key,value);

  if(key==='iansRobloxAcademyV1'){
    setTimeout(renderRewardVault,0);
  }
};

})();
