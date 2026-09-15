const KEY = 'iansAcademyKidsV2';
const PROFILE_PREFIX = 'iansAcademyKidsProfile:';
const LAST_PROFILE = 'iansAcademyKidsLastName';
const PASS_SCORE = 60;
const EXAM_SIZE = 30;

const labels = {
  Computer:['💻 Datamaskin','💻 Computer'], Files:['📁 Filer','📁 Files'],
  OS:['🖥️ Operativsystem','🖥️ Operating system'], Internet:['🌐 Internett','🌐 Internet'],
  Web:['🌍 Web','🌍 Web'], Browser:['🔎 Nettleser','🔎 Browser'],
  Network:['📡 Nettverk','📡 Network'], Terminal:['⌨️ Terminal','⌨️ Terminal'],
  Cyber:['🛡️ Cyber','🛡️ Cybersecurity'], Judgement:['🧠 Dømmekraft','🧠 Digital judgement'],
  WebCode:['🎨 HTML/CSS','🎨 HTML/CSS'], Coding:['🧩 Koding','🧩 Coding'],
  Cloud:['☁️ Sky','☁️ Cloud'], Git:['🌿 Git','🌿 Git'],
  AI:['🤖 AI','🤖 AI'], Tech:['⚙️ Teknologi','⚙️ Technology'],
  Future:['🚀 Fremtid','🚀 Future'], Creator:['🏗️ Skaper','🏗️ Creator']
};

const worldEN = {
  'Den digitale verden':'The Digital World','Trygg på nettet':'Safe Online',
  'Hvordan nettet påvirker deg':'How the Internet Influences You','Bli en skaper':'Become a Creator',
  'AI-laboratoriet':'AI Laboratory','Teknologien rundt oss':'Technology Around Us',
  'Bygg fremtiden':'Build the Future','Creator Missions':'Creator Missions',
  'Datamaskinen':'The Computer','Filer og lagring':'Files and Storage',
  'Operativsystem og apper':'Operating Systems and Apps','World Wide Web':'World Wide Web',
  'Nettleser og søk':'Browser and Search','Nettverk og Wi-Fi':'Networks and Wi-Fi',
  'Terminal Lab':'Terminal Lab','Cybersikkerhet':'Cybersecurity',
  'Digital dømmekraft':'Digital Judgement','HTML og CSS':'HTML and CSS',
  'JavaScript og programmering':'JavaScript and Programming','Servere og sky':'Servers and Cloud',
  'Git og GitHub':'Git and GitHub','Creator Lab':'Creator Lab'
};

const ui = {
  no:{
    learn:'LÆR-MODUS', test:'TEST', exam:'EKSAMEN', learned:'Lært', passed:'Tester bestått',
    show:'Vis riktig svar', right:'Riktig!', wrong:'Ikke helt.', explanation:'Forklaring',
    retry:'Prøv igjen', next:'Neste oppdrag →', previous:'← Forrige oppdrag',
    all:'Alle deler', startTest:'Start verdenstest', testReady:'Du har lært alle oppdragene i denne verdenen. Klar for test?',
    testRule:'Ett svar per spørsmål. Du får vite om svaret er riktig, men fasiten vises ikke. Resultatet kommer til slutt.',
    submit:'Svar', testResult:'Testresultat', pass:'BESTÅTT', fail:'IKKE BESTÅTT',
    again:'Ta testen på nytt', backLearn:'Tilbake til læring', examReady:'Avsluttende eksamen',
    examIntro:'Når hele kurset og verdenstestene er fullført, kan du ta avsluttende eksamen. Kun bestått eksamen gir diplom.',
    startExam:'Start eksamen', examRule:'30 spørsmål fra hele pensum · ett svar per spørsmål · 60 % kreves · ingen fasit underveis.',
    diploma:'Åpne diplom', print:'Skriv ut diplom', noDiploma:'Diplomet låses kun opp etter bestått avsluttende eksamen.',
    englishFallback:'Dette oppdraget er ikke oversatt ennå. Norsk original vises.',
    learnedAll:'Hele læringsreisen er gjennomført. Nå gjenstår tester og eksamen.',
    choose:'Velg ett svar.', correctHidden:'✓ Riktig', incorrectHidden:'✗ Feil', score:'Resultat',
    best:'Beste eksamen', attempts:'Eksamensforsøk', lang:'Språk'
  },
  en:{
    learn:'LEARN MODE', test:'TEST', exam:'EXAM', learned:'Learned', passed:'Tests passed',
    show:'Show correct answer', right:'Correct!', wrong:'Not quite.', explanation:'Explanation',
    retry:'Try again', next:'Next mission →', previous:'← Previous mission',
    all:'All sections', startTest:'Start world test', testReady:'You have learned every mission in this world. Ready for the test?',
    testRule:'One answer per question. You will see whether it was correct, but the answer key stays hidden. Your score appears at the end.',
    submit:'Answer', testResult:'Test result', pass:'PASSED', fail:'NOT PASSED',
    again:'Take the test again', backLearn:'Back to learning', examReady:'Final exam',
    examIntro:'When the full course and all world tests are complete, you can take the final exam. Only a passed final exam unlocks the diploma.',
    startExam:'Start exam', examRule:'30 questions from the full curriculum · one answer each · 60% required · no answer key during the exam.',
    diploma:'Open diploma', print:'Print diploma', noDiploma:'The diploma unlocks only after passing the final exam.',
    englishFallback:'This mission has not been translated yet. The Norwegian original is shown.',
    learnedAll:'The learning journey is complete. Tests and the final exam remain.',
    choose:'Choose one answer.', correctHidden:'✓ Correct', incorrectHidden:'✗ Incorrect', score:'Score',
    best:'Best exam', attempts:'Exam attempts', lang:'Language'
  }
};

const $ = id => document.getElementById(id);
let p=null, destination='resume', storageError=false, mode='learn', assessment=null;

function tr(k){ return ui[p?.language === 'en' ? 'en':'no'][k] || k; }
function lang(){ return p?.language === 'en' ? 'en':'no'; }
function storageMessage(message,error=false){ $('saveStatus').textContent=message; $('saveStatus').className='save-status'+(error?' error':''); }
function read(key){ try{return localStorage.getItem(key);}catch{storageError=true;return null;} }
function decode(raw){
  if(!raw)return null;
  try{
    const v=JSON.parse(raw);
    if(!v||typeof v.name!=='string'||typeof v.pin!=='string'||!Array.isArray(v.completed))throw new Error();
    return v;
  }catch{storageError=true;storageMessage('Den lagrede profilen kunne ikke leses. Dataene er beholdt.',true);return null;}
}
function profileKey(name){return PROFILE_PREFIX+encodeURIComponent(name.trim().toLowerCase());}
function load(name){
  const raw=read(profileKey(name)); if(raw!==null)return decode(raw);
  const legacy=decode(read(KEY));
  return legacy&&legacy.name.trim().toLowerCase()===name.trim().toLowerCase()?legacy:null;
}
function lessonId(i){return lessons[i]?.id||`legacy-${String(i+1).padStart(3,'0')}`;}
function completedIds(v){
  if(Array.isArray(v.completedIds))return [...new Set(v.completedIds.filter(id=>typeof id==='string'&&lessons.some(l=>l.id===id)))];
  return [...new Set((Array.isArray(v.completed)?v.completed:[]).filter(i=>Number.isInteger(i)&&i>=0&&i<lessons.length).map(lessonId))];
}
function isCompleted(i){return !!p&&p.completedIds.includes(lessonId(i));}
function completedCount(){return p?p.completedIds.length:0;}
function fresh(name,pin){
  return {name,pin,xp:0,current:0,currentId:lessonId(0),completed:[],completedIds:[],legacyCompleted:[],
    skills:{},badges:[],attempts:0,profileVersion:4,language:'no',worldTests:{},examAttempts:0,examBest:0,diploma:null};
}
function normalize(v){
  if(!Array.isArray(v.legacyCompleted)&&Array.isArray(v.completed))v.legacyCompleted=[...v.completed];
  v.completedIds=completedIds(v);
  v.completed=v.completedIds.map(id=>lessons.findIndex(l=>l.id===id)).filter(i=>i>=0);
  if(typeof v.currentId==='string'&&lessons.some(l=>l.id===v.currentId))v.current=lessons.findIndex(l=>l.id===v.currentId);
  else{v.current=Number.isInteger(v.current)?Math.max(0,Math.min(v.current,lessons.length-1)):0;v.currentId=lessonId(v.current);}
  v.language=v.language==='en'?'en':'no';
  v.worldTests=v.worldTests&&typeof v.worldTests==='object'?v.worldTests:{};
  v.examAttempts=Number.isInteger(v.examAttempts)?v.examAttempts:0;
  v.examBest=Number.isFinite(v.examBest)?v.examBest:0;
  v.diploma=v.diploma&&v.diploma.passed===true?v.diploma:null;
  v.profileVersion=4;
  v.skills={};
  v.completed.forEach(i=>{const k=lessons[i].s;v.skills[k]=(v.skills[k]||0)+1;});
  v.xp=v.completedIds.length*25;
  v.badges=[[1,'Digital Explorer'],[25,'Computer Rookie'],[50,'Web Explorer'],[75,'Digital Builder'],
    [100,'Cyber & Network Scout'],[125,'Junior Developer'],[150,'Tech Master']]
    .filter(([n])=>v.completedIds.length>=n).map(([,n])=>n);
  v.attempts=Number.isInteger(v.attempts)&&v.attempts>=0?v.attempts:0;
  return v;
}
function save(){
  if(storageError)return false;
  try{localStorage.setItem(profileKey(p.name),JSON.stringify(p));localStorage.setItem(LAST_PROFILE,p.name);storageMessage('✓ Fremgangen er lagret i denne nettleseren.');return true;}
  catch{storageMessage('Fremgangen kunne ikke lagres.',true);return false;}
}
function firstUnfinished(){const i=lessons.findIndex((_,i)=>!isCompleted(i));return i<0?lessons.length-1:i;}
function unlocked(i){return isCompleted(i)||i<=firstUnfinished();}
function focusSection(id){$(id).scrollIntoView({block:'start'});$(id).focus({preventScroll:true});}
function worldName(w){return lang()==='en'?(worldEN[w]||w):w;}
function content(l,key){
  if(lang()==='en'&&l.en&&l.en[key])return l.en[key];
  return l[key];
}
function answersFor(l){return lang()==='en'&&l.en&&Array.isArray(l.en.a)?l.en.a:l.a;}
function englishMissing(l){return lang()==='en'&&!(l.en&&l.en.t&&l.en.x&&l.en.q&&Array.isArray(l.en.a)&&l.en.y);}
function worlds(){return [...new Set(lessons.map(l=>l.w))];}
function worldIndices(w){return lessons.map((l,i)=>l.w===w?i:-1).filter(i=>i>=0);}
function worldLearned(w){const ids=worldIndices(w);return ids.length>0&&ids.every(isCompleted);}
function worldPassed(w){return Number(p.worldTests?.[w]?.best||0)>=PASS_SCORE;}
function passedWorldCount(){return worlds().filter(worldPassed).length;}
function allLearned(){return completedCount()===lessons.length;}
function allWorldTestsPassed(){return worlds().every(worldPassed);}
function examUnlocked(){return allLearned()&&allWorldTestsPassed();}

function ensureLanguageControl(){
  if($('academyLanguage'))return;
  const profile=document.querySelector('.profile');
  if(!profile)return;
  const box=document.createElement('div');box.className='language-switch';
  box.innerHTML='<span>🌍</span><button type="button" id="langNO">Norsk</button><button type="button" id="langEN">English</button>';
  profile.insertBefore(box,$('logout'));
  $('langNO').onclick=()=>setLanguage('no');$('langEN').onclick=()=>setLanguage('en');
}
function setLanguage(v){p.language=v;save();render();}
function navigate(where){
  destination=where;
  if(!p){$('login').scrollIntoView({block:'start'});$('pin').focus({preventScroll:true});return;}
  if(where==='roblox'){location.href='/academy/kids/roblox/';return;}
  if(where==='overview'){mode='learn';assessment=null;render();focusSection('worldHeading');return;}
  jump(where==='first'?0:(isCompleted(p.current)?firstUnfinished():p.current));
}
const topLoginBtn=$('topLoginBtn'),robloxCourseBtn=$('robloxCourseBtn');
function academyLoginFor(target){destination=target;$('login').scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>$('pin').focus({preventScroll:true}),350);}
if(topLoginBtn)topLoginBtn.onclick=()=>academyLoginFor('resume');
if(robloxCourseBtn)robloxCourseBtn.onclick=()=>p?location.href='/academy/kids/roblox/':academyLoginFor('roblox');
$('resumeBtn')&&($('resumeBtn').onclick=()=>navigate('resume'));
$('firstBtn')&&($('firstBtn').onclick=()=>navigate('first'));
$('overviewBtn')&&($('overviewBtn').onclick=()=>navigate('overview'));
$('loginBtn').onclick=()=>{
  const name=$('name').value.trim()||'Explorer',pin=$('pin').value;
  if(!/^\d{4}$/.test(pin)){$('loginMsg').textContent='Velg en PIN med 4 tall.';return;}
  const old=load(name);
  if(storageError){$('loginMsg').textContent='Lagringen må være tilgjengelig før profilen kan åpnes.';return;}
  if(old&&old.pin!==pin){$('loginMsg').textContent='PIN-koden stemmer ikke. Fremgangen din er beholdt.';return;}
  p=normalize(old||fresh(name,pin));save();$('pin').value='';window.IANSAcademyCloseLogin?.();$('login').style.display='none';$('dash').style.display='block';
  ensureLanguageControl();render();navigate(destination);
};
$('pin').onkeydown=e=>{if(e.key==='Enter')$('loginBtn').onclick();};
$('logout').onclick=()=>location.reload();

function render(){
  setTimeout(()=>window.IANSProRefresh?.(),0);
  ensureLanguageControl();
  $('langNO')?.classList.toggle('active',lang()==='no');$('langEN')?.classList.toggle('active',lang()==='en');
  document.documentElement.lang=lang();
  $('hello').textContent=(lang()==='en'?'Hi ':'Hei ')+p.name+'! 👋';
  $('levelText').textContent='LEVEL '+(Math.floor(p.xp/100)+1)+' · '+p.xp+' XP';
  $('xpFill').style.width=(p.xp%100)+'%';
  $('skills').innerHTML=Object.entries(labels).map(([key,names])=>{
    const total=lessons.filter(l=>l.s===key).length;
    return `<div class="skill"><b>${names[lang()==='en'?1:0]}</b> <span class="muted">${p.skills[key]||0}/${total}</span></div>`;
  }).join('');
  $('badges').innerHTML=p.badges.length?p.badges.map(x=>`<span class="badge">🏅 ${x}</span>`).join(''):'<span class="muted">Det første merket venter på deg.</span>';
  const nextIndex=isCompleted(p.current)?firstUnfinished():p.current;
  $('resumeBtn')&&($('resumeBtn').textContent=completedCount()?(lang()==='en'?'Continue →':'Fortsett der du slapp →'):(lang()==='en'?'Start first mission →':'Start første oppdrag →'));
  $('resumeNote').textContent=`${tr('learned')}: ${completedCount()}/${lessons.length} · ${tr('passed')}: ${passedWorldCount()}/${worlds().length} · ${tr('best')}: ${p.examBest||0}%`;
  $('worlds').innerHTML=worlds().map(w=>{
    const ids=worldIndices(w),done=ids.filter(isCompleted).length,target=ids.find(i=>!isCompleted(i))??ids[0],locked=!unlocked(target);
    const passed=worldPassed(w),best=p.worldTests?.[w]?.best||0;
    return `<div class="card world ${locked?'locked':''}">
      <button type="button" class="world-main" ${locked?'disabled':''} onclick="jump(${target})">
        <div class="icon">${lessons[target].i}</div><h3>${worldName(w)}</h3>
        <div class="muted">${done}/${ids.length} ${tr('learned').toLowerCase()}</div>
        <div class="progress"><span style="width:${100*done/ids.length}%"></span></div>
      </button>
      <div class="world-test-row">${passed?`<span class="test-pass">🏆 ${tr('test')} ${best}%</span>`:
        worldLearned(w)?`<button class="btn test-btn" onclick="startWorldTest('${encodeURIComponent(w)}')">🧠 ${tr('startTest')}</button>`:
        `<span class="muted">🔒 ${tr('test')}</span>`}</div>
    </div>`;
  }).join('');
  $('parentStats').innerHTML=`${tr('learned')}: <b>${completedCount()}/${lessons.length}</b> · ${tr('passed')}: <b>${passedWorldCount()}/${worlds().length}</b> · ${tr('attempts')}: <b>${p.examAttempts}</b> · ${tr('best')}: <b>${p.examBest||0}%</b>.`;
  if(mode==='learn')mission(); else if(mode==='assessment')renderAssessment(); else if(mode==='examHome')renderExamHome(); else if(mode==='diploma')renderDiploma();
}
function jump(i){
  if(!p||!Number.isInteger(i)||i<0||i>=lessons.length||!unlocked(i))return;
  mode='learn';assessment=null;p.current=i;p.currentId=lessonId(i);save();render();focusSection('mission');
}
function mission(){
  const i=p.current,l=lessons[i],done=isCompleted(i),a=answersFor(l);
  const lab=l.type==='terminal'&&l.lab?`<div class="academy-terminal"><div class="academy-terminal-top">● ● ● &nbsp; IANS TERMINAL LAB</div><div class="academy-terminal-hint">🎯 ${l.lab.hint}</div><div class="academy-terminal-line"><span>${l.lab.prompt}</span><code>${l.lab.command}</code></div><pre>${l.lab.output}</pre><div class="academy-terminal-note">Simulering – ingen kommando kjøres på maskinen din.</div></div>`:'';
  $('mission').innerHTML=`<div class="mode-pill">📘 ${tr('learn')}</div>${englishMissing(l)?`<div class="translation-note">🇬🇧 ${tr('englishFallback')}</div>`:''}${lab}
    <div class="eyebrow">${done?'✓ '+tr('learned').toUpperCase():tr('learn')} · ${i+1}/${lessons.length} · ${l.i} ${worldName(l.w)}</div>
    <h2>${content(l,'t')}</h2><p class="lessonText muted">${content(l,'x')}</p><div class="question">${content(l,'q')}</div>
    <div class="answers">${a.map((x,j)=>`<button class="answer" onclick="answer(${j})" ${done?'disabled':''}>${x}</button>`).join('')}</div>
    <div id="result" class="result ${done?'good':''}" role="status">${done?'✅ '+content(l,'y'):''}</div>
    <div id="learnTools"></div>
    <nav class="actions">${i>0?`<button class="btn alt" onclick="jump(${i-1})">${tr('previous')}</button>`:''}<button class="btn alt" onclick="navigate('overview')">${tr('all')}</button>${done&&i<lessons.length-1?`<button class="btn" onclick="next()">${tr('next')}</button>`:''}</nav>
    ${allLearned()?`<div class="exam-callout"><b>🎓 ${tr('learnedAll')}</b><br><button class="btn" onclick="openExamHome()">${tr('examReady')} →</button></div>`:''}`;
}
function answer(j){
  if(!p||isCompleted(p.current))return;
  const l=lessons[p.current];p.attempts++;
  if(j===l.c){p.completedIds.push(lessonId(p.current));normalize(p);save();render();}
  else{
    $('result').className='result bad';$('result').textContent=tr('wrong')+' '+tr('retry');save();
    $('learnTools').innerHTML=`<button class="btn alt" onclick="showCorrect()">${tr('show')}</button>`;
  }
}
function showCorrect(){
  const l=lessons[p.current],a=answersFor(l);
  $('learnTools').innerHTML=`<div class="answer-reveal"><b>💡 ${a[l.c]}</b><p>${content(l,'y')}</p></div>`;
}
function next(){if(p&&isCompleted(p.current)&&p.current<lessons.length-1)jump(p.current+1);}

function shuffled(arr,seed){
  let x=seed||1234567,a=[...arr];
  for(let i=a.length-1;i>0;i--){x=(x*1664525+1013904223)>>>0;const j=x%(i+1);[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
function startWorldTest(encoded){
  const w=decodeURIComponent(encoded),ids=worldIndices(w);
  if(!worldLearned(w))return;
  assessment={kind:'world',world:w,indices:[...ids],pos:0,correct:0,answers:[],finished:false};
  mode='assessment';render();focusSection('mission');
}
function openExamHome(){mode='examHome';assessment=null;render();focusSection('mission');}
function startExam(){
  if(!examUnlocked())return;
  const seed=Date.now()&0xffffffff;
  const pool=lessons.map((_,i)=>i);
  assessment={kind:'exam',indices:shuffled(pool,seed).slice(0,Math.min(EXAM_SIZE,pool.length)),pos:0,correct:0,answers:[],finished:false};
  mode='assessment';render();focusSection('mission');
}
function renderAssessment(){
  const a=assessment;
  if(!a){mode='learn';return render();}
  if(a.finished)return renderAssessmentResult();
  const idx=a.indices[a.pos],l=lessons[idx],opts=answersFor(l);
  $('mission').innerHTML=`<div class="mode-pill exam">${a.kind==='exam'?'🎓 '+tr('exam'):'🧠 '+tr('test')}</div>
    <div class="eyebrow">${a.pos+1}/${a.indices.length} · ${l.i} ${worldName(l.w)}</div>
    <h2>${content(l,'t')}</h2><div class="question">${content(l,'q')}</div>
    <div class="answers">${opts.map((x,j)=>`<button class="answer" onclick="assessmentAnswer(${j})">${x}</button>`).join('')}</div>
    <div id="result" class="result" role="status"></div>
    <p class="assessment-rule muted">${a.kind==='exam'?tr('examRule'):tr('testRule')}</p>`;
}
function assessmentAnswer(j){
  const a=assessment;if(!a||a.finished||a.locked)return;
  a.locked=true;
  const l=lessons[a.indices[a.pos]],correct=j===l.c;
  if(correct)a.correct++;
  a.answers.push({id:lessonId(a.indices[a.pos]),correct});
  const r=$('result');r.className='result '+(correct?'good':'bad');r.textContent=correct?tr('correctHidden'):tr('incorrectHidden');
  document.querySelectorAll('#mission .answer').forEach(b=>b.disabled=true);
  setTimeout(()=>{a.pos++;a.locked=false;if(a.pos>=a.indices.length)a.finished=true;render();},650);
}
function renderAssessmentResult(){
  const a=assessment,total=a.indices.length,score=Math.round(100*a.correct/total),passed=score>=PASS_SCORE;
  if(!a.saved){
    if(a.kind==='world'){
      const old=p.worldTests[a.world]||{attempts:0,best:0};
      p.worldTests[a.world]={attempts:(old.attempts||0)+1,best:Math.max(old.best||0,score),last:score,passed:passed||old.passed===true};
    }else{
      p.examAttempts++;p.examBest=Math.max(p.examBest||0,score);
      if(passed)p.diploma={passed:true,name:p.name,score,date:new Date().toISOString().slice(0,10),version:'IANS Digital School'};
    }
    a.saved=true;save();
  }
  $('mission').innerHTML=`<div class="mode-pill exam">${a.kind==='exam'?'🎓 '+tr('exam'):'🧠 '+tr('testResult')}</div>
    <div class="score-ring"><b>${score}%</b><span>${a.correct}/${total}</span></div>
    <h2>${passed?'🏆 '+tr('pass'):'📚 '+tr('fail')}</h2>
    <p class="muted">${passed?'60 % '+(lang()==='en'?'or more — passed.':'eller mer – bestått.'):(lang()==='en'?'Review the material and try again.':'Gå tilbake til læringen, øv og prøv igjen.')}</p>
    <div class="actions">${a.kind==='world'?`<button class="btn" onclick="startWorldTest('${encodeURIComponent(a.world)}')">${tr('again')}</button>`:
      passed?`<button class="btn" onclick="openDiploma()">🎓 ${tr('diploma')}</button><button class="btn alt" onclick="openExamHome()">${tr('examReady')}</button>`:
      `<button class="btn" onclick="startExam()">${tr('again')}</button>`}
      <button class="btn alt" onclick="navigate('overview')">${tr('backLearn')}</button></div>`;
}
function renderExamHome(){
  const unlocked=examUnlocked();
  $('mission').innerHTML=`<div class="mode-pill exam">🎓 ${tr('examReady')}</div><h2>IANS Digital School</h2>
    <p class="lessonText muted">${tr('examIntro')}</p>
    <div class="exam-requirements">
      <div>${allLearned()?'✅':'🔒'} ${tr('learned')}: ${completedCount()}/${lessons.length}</div>
      <div>${allWorldTestsPassed()?'✅':'🔒'} ${tr('passed')}: ${passedWorldCount()}/${worlds().length}</div>
      <div>🎯 ${tr('best')}: ${p.examBest||0}%</div>
    </div>
    <p class="assessment-rule">${tr('examRule')}</p>
    <div class="actions">${unlocked?`<button class="btn" onclick="startExam()">🎓 ${tr('startExam')}</button>`:''}
      ${p.diploma?`<button class="btn alt" onclick="openDiploma()">${tr('diploma')}</button>`:`<span class="muted">${tr('noDiploma')}</span>`}
      <button class="btn alt" onclick="navigate('overview')">${tr('backLearn')}</button></div>`;
}
function openDiploma(){if(!p.diploma)return;mode='diploma';render();focusSection('mission');}
function renderDiploma(){
  if(!p.diploma)return openExamHome();
  const d=p.diploma;
  $('mission').innerHTML=`<div class="diploma" id="academyDiploma"><div class="diploma-mark">IANS</div><div class="eyebrow">DIGITAL SCHOOL</div>
    <h1>${lang()==='en'?'DIPLOMA':'DIPLOM'}</h1><p>${lang()==='en'?'This certifies that':'Dette bekrefter at'}</p>
    <h2>${escapeHtml(d.name)}</h2><p>${lang()==='en'?'has passed the final examination in IANS Digital School':'har bestått avsluttende eksamen i IANS Digital School'}</p>
    <div class="diploma-score">${d.score}% · ${tr('pass')}</div><p>${d.date}</p><div class="diploma-footer">Understand · Evaluate · Create</div></div>
    <div class="actions no-print"><button class="btn" onclick="window.print()">🖨️ ${tr('print')}</button><button class="btn alt" onclick="openExamHome()">← ${tr('examReady')}</button></div>`;
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

const remembered=read(LAST_PROFILE)||decode(read(KEY))?.name;
if(remembered){$('name').value=remembered;$('loginBtn').textContent='Fortsett Academy Kids';$('resumeBtn')&&($('resumeBtn').textContent='Fortsett der du slapp →');$('resumeNote').textContent='Velkommen tilbake, '+remembered+'. Lås opp profilen med PIN-koden din.';}
