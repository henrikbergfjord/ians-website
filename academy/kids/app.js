const KEY = 'iansAcademyKidsV2'; // Keep the original record available for migration.
const PROFILE_PREFIX = 'iansAcademyKidsProfile:';
const LAST_PROFILE = 'iansAcademyKidsLastName';
const labels = {Internet:'🌐 Internett',Cyber:'🛡️ Cyber',Judgement:'🧠 Dømmekraft',Coding:'🧩 Koding',AI:'🤖 AI',Tech:'⚙️ Teknologi',Future:'🚀 Fremtid',Creator:'🏗️ Skaper'};
const $ = id => document.getElementById(id);
let p = null;
let destination = 'resume';
let storageError = false;
function storageMessage(message, error = false) {
  $('saveStatus').textContent = message;
  $('saveStatus').className = 'save-status' + (error ? ' error' : '');
}
function read(key) {
  try { return localStorage.getItem(key); }
  catch { storageError = true; storageMessage('Nettleseren tillater ikke lagring. Fremgangen kan forsvinne når du lukker siden.', true); return null; }
}
function decode(raw) {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value.name !== 'string' || typeof value.pin !== 'string' || !Array.isArray(value.completed)) throw new Error('Invalid profile');
    return value;
  } catch {
    storageError = true;
    storageMessage('Den lagrede profilen kunne ikke leses. Den er bevart; be en voksen om hjelp før du fortsetter.', true);
    return null;
  }
}
function profileKey(name) { return PROFILE_PREFIX + encodeURIComponent(name.trim().toLowerCase()); }
function load(name) {
  const raw = read(profileKey(name));
  if (raw !== null) return decode(raw);
  const legacy = decode(read(KEY));
  return legacy && legacy.name.trim().toLowerCase() === name.trim().toLowerCase() ? legacy : null;
}
function lessonId(i) {
  return lessons[i]?.id || `legacy-${String(i + 1).padStart(3,'0')}`;
}
function completedIds(value) {
  if (Array.isArray(value.completedIds)) {
    return [...new Set(
      value.completedIds.filter(id =>
        typeof id === 'string' && lessons.some(l => l.id === id)
      )
    )];
  }

  // Automatisk migrering fra den opprinnelige nummerbaserte profilen.
  return [...new Set(
    (Array.isArray(value.completed) ? value.completed : [])
      .filter(i => Number.isInteger(i) && i >= 0 && i < lessons.length)
      .map(i => lessonId(i))
  )];
}
function isCompleted(i) {
  return !!p && p.completedIds.includes(lessonId(i));
}
function completedCount() {
  return p ? p.completedIds.length : 0;
}
function fresh(name, pin) {
  return {
    name,
    pin,
    xp:0,
    current:0,
    completed:[],
    completedIds:[],
    skills:{},
    badges:[],
    attempts:0
  };
}
function normalize(value) {
  value.completedIds = completedIds(value);

  // Kompatibilitetsfelt for eksisterende kode/data.
  value.completed = value.completedIds
    .map(id => lessons.findIndex(l => l.id === id))
    .filter(i => i >= 0);

  value.current = Number.isInteger(value.current)
    ? Math.max(0, Math.min(value.current, lessons.length - 1))
    : 0;

  value.skills = {};
  value.completed.forEach(i => {
    const key = lessons[i].s;
    value.skills[key] = Math.min(10, (value.skills[key] || 0) + 1);
  });

  value.xp = value.completedIds.length * 25;
  value.badges = [
    [1,'Digital Explorer'],
    [5,'Web Ranger'],
    [10,'AI & Cyber Scout'],
    [lessons.length,'Future Creator']
  ]
    .filter(([n]) => value.completedIds.length >= n)
    .map(([,name]) => name);

  value.attempts =
    Number.isInteger(value.attempts) && value.attempts >= 0
      ? value.attempts
      : 0;

  return value;
}
function save() {
  if (storageError) return false;
  try {
    localStorage.setItem(profileKey(p.name), JSON.stringify(p));
    localStorage.setItem(LAST_PROFILE, p.name);
    storageMessage('✓ Fremgangen er lagret i denne nettleseren.');
    return true;
  } catch {
    storageMessage('Fremgangen kunne ikke lagres. Hold siden åpen og be en voksen om hjelp.', true);
    return false;
  }
}
function firstUnfinished() { const i = lessons.findIndex((_,i)=>!isCompleted(i)); return i < 0 ? lessons.length - 1 : i; }
function unlocked(i) { return isCompleted(i) || i <= firstUnfinished(); }
function focusSection(id) { $(id).scrollIntoView({block:'start'}); $(id).focus({preventScroll:true}); }
function navigate(where) {
  destination = where;
  if (!p) { $('login').scrollIntoView({block:'start'}); $('pin').focus({preventScroll:true}); return; }
  if (where === 'roblox') { location.href = '/academy/kids/roblox/'; return; }
  if (where === 'overview') { focusSection('worldHeading'); return; }
  jump(where === 'first' ? 0 : (isCompleted(p.current) ? firstUnfinished() : p.current));
}

const topLoginBtn = $('topLoginBtn');
const robloxCourseBtn = $('robloxCourseBtn');

function academyLoginFor(target) {
  destination = target;
  $('login').scrollIntoView({behavior:'smooth', block:'start'});
  setTimeout(() => $('pin').focus({preventScroll:true}), 350);
}

if (topLoginBtn) {
  topLoginBtn.onclick = () => {
    destination = 'resume';
    $('login').scrollIntoView({behavior:'smooth', block:'start'});
    setTimeout(() => $('pin').focus({preventScroll:true}), 350);
  };
}

if (robloxCourseBtn) {
  robloxCourseBtn.onclick = () => {
    if (p) {
      location.href = '/academy/kids/roblox/';
      return;
    }
    academyLoginFor('roblox');
  };
}

$('resumeBtn') && ($('resumeBtn').onclick = () => navigate('resume'));
$('firstBtn') && ($('firstBtn').onclick = () => navigate('first'));
$('overviewBtn') && ($('overviewBtn').onclick = () => navigate('overview'));
$('loginBtn').onclick = () => {
  const name = $('name').value.trim() || 'Explorer';
  const pin = $('pin').value;
  if (!/^\d{4}$/.test(pin)) { $('loginMsg').textContent = 'Velg en PIN med 4 tall.'; return; }
  const old = load(name);
  if (storageError) { $('loginMsg').textContent = 'Lagringen må være tilgjengelig før profilen kan åpnes.'; return; }
  if (old && old.pin !== pin) { $('loginMsg').textContent = 'PIN-koden stemmer ikke. Fremgangen din er beholdt.'; return; }
  p = normalize(old || fresh(name, pin));
  save();
  $('pin').value = '';
  $('login').style.display = 'none';
  $('dash').style.display = 'block';
  render();
  navigate(destination);
};
$('pin').onkeydown = e => { if (e.key === 'Enter') $('loginBtn').onclick(); };
$('logout').onclick = () => location.reload();
function render() {
  $('hello').textContent = 'Hei ' + p.name + '! 👋';
  $('levelText').textContent = 'LEVEL ' + (Math.floor(p.xp / 100) + 1) + ' · ' + p.xp + ' XP';
  $('xpFill').style.width = (p.xp % 100) + '%';
  $('skills').innerHTML = Object.entries(labels).map(([key,label])=>{
    const total = lessons.filter(l => l.s === key).length;
    return `<div class="skill"><b>${label}</b> <span class="muted">${p.skills[key] || 0}/${total}</span></div>`;
  }).join('');
  $('badges').innerHTML = p.badges.length ? p.badges.map(x=>`<span class="badge">🏆 ${x}</span>`).join('') : '<span class="muted">Det første merket venter på deg.</span>';
  $('resumeBtn') && ($('resumeBtn').textContent = completedCount() ? 'Fortsett der du slapp →' : 'Start første oppdrag →');
  const nextIndex = isCompleted(p.current) ? firstUnfinished() : p.current;
  $('resumeNote').textContent = `${completedCount()}/${lessons.length} oppdrag fullført · ${lessons[nextIndex].t}`;
  const worlds = [...new Set(lessons.map(x=>x.w))];
  $('worlds').innerHTML = worlds.map(world=>{
    const indices = lessons.map((l,i)=>l.w===world?i:-1).filter(i=>i>=0);
    const done = indices.filter(i=>isCompleted(i)).length;
    const target = indices.find(i=>!isCompleted(i)) ?? indices[0];
    const locked = !unlocked(target);
    return `<button type="button" class="card world ${locked?'locked':''}" ${locked?'disabled':''} onclick="jump(${target})"><div class="icon">${lessons[target].i}</div><h3>${world}</h3><div class="muted">${done}/${indices.length} oppdrag fullført</div><div class="progress"><span style="width:${100*done/indices.length}%"></span></div><p>${locked?'🔒 Fullfør de tidligere oppdragene.':done===indices.length?'Se delen igjen →':done?'Fortsett delen →':'Start delen →'}</p></button>`;
  }).join('');
  $('parentStats').textContent = `${completedCount()}/${lessons.length} oppdrag · ${p.xp} XP. Fremgangen lagres separat for hvert profilnavn i denne nettleseren. Bruk samme nettadresse og nettleser neste gang.`;
  mission();
}
function jump(i) {
  if (!p || !Number.isInteger(i) || i < 0 || i >= lessons.length || !unlocked(i)) return;
  p.current = i; save(); render(); focusSection('mission');
}
function mission() {
  const i=p.current, lesson=lessons[i], done=isCompleted(i);
  $('mission').innerHTML = `<div class="eyebrow">${done?'FULLFØRT':'AKTIVT OPPDRAG'} · ${i+1}/${lessons.length} · ${lesson.i} ${lesson.w}</div><h2>${lesson.t}</h2><p class="lessonText muted">${lesson.x}</p><div class="question">${lesson.q}</div><div class="answers">${lesson.a.map((a,j)=>`<button class="answer" onclick="answer(${j})" ${done?'disabled':''}>${a}</button>`).join('')}</div><div id="result" class="result ${done?'good':''}" role="status">${done?'✅ '+lesson.y:''}</div><nav class="actions" aria-label="Oppdragsnavigasjon">${i>0?`<button class="btn alt" onclick="jump(${i-1})">← Forrige oppdrag</button>`:''}<button class="btn alt" onclick="navigate('overview')">Alle deler</button>${done&&i<lessons.length-1?'<button class="btn" onclick="next()">Neste oppdrag →</button>':''}</nav>`;
}
function answer(j) {
  if (!p || isCompleted(p.current)) return;
  const lesson=lessons[p.current];
  p.attempts++;
  if (j===lesson.c) {
    p.completedIds.push(lessonId(p.current)); normalize(p); save(); render();
    if (completedCount()===lessons.length) $('result').textContent += ' Du har fullført første Academy Kids-reise!';
  } else {
    $('result').className='result bad';
    $('result').textContent='Ikke helt. Tenk gjennom alternativene og prøv igjen – ingen XP trekkes.';
    save();
  }
}
function next() { if(p && isCompleted(p.current) && p.current<lessons.length-1) jump(p.current+1); }
const remembered = read(LAST_PROFILE) || decode(read(KEY))?.name;
if (remembered) {
  $('name').value = remembered;
  $('loginBtn').textContent = 'Fortsett Academy Kids';
  $('resumeBtn') && ($('resumeBtn').textContent = 'Fortsett der du slapp →');
  $('resumeNote').textContent = 'Velkommen tilbake, ' + remembered + '. Lås opp profilen med PIN-koden din.';
}
