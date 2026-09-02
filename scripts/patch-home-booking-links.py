from pathlib import Path

p = Path("index.html")
s = p.read_text(encoding="utf-8")

# This deployment patch used to add Booking links to the home page.
# Booking/admin now belong in the technical hub. Keep this step as an
# idempotent home-navigation repair so older source versions also deploy safely.
replacements = {
    'href="#ians-lab">IANS Lab</a>': 'href="teknisk.html#verktoy">IANS Lab</a>',
    'href="#portal">Portal</a>': 'href="#hovedomrader">Portal</a>',
    'class="axion" href="#axion">AXION GRID</a>': 'class="axion" href="teknisk.html#axion">AXION GRID</a>',
    'class="planet planet-link p4" href="#ians-lab"': 'class="planet planet-link p4" href="teknisk.html#verktoy"',
    'class="planet planet-link p5" href="#projects"': 'class="planet planet-link p5" href="teknisk.html#projects"',
    'class="planet planet-link p6" href="#strom"': 'class="planet planet-link p6" href="teknisk.html#strom"',
    'class="planet planet-link p7" href="#dns"': 'class="planet planet-link p7" href="teknisk.html#dns"',
    'class="planet planet-link p8" href="#axion"': 'class="planet planet-link p8" href="teknisk.html#axion"',
    'href="#axion">Besøk AXION GRID →</a>': 'href="teknisk.html#axion">Se AXION GRID →</a>',
    'href="#ians-lab">Utforsk IANS Lab →</a>': 'href="teknisk.html#verktoy">Utforsk IANS Lab →</a>',
    'href="#dns">Utforsk DNS →</a>': 'href="teknisk.html#dns">Utforsk DNS →</a>',
    'href="#strom">Utforsk Strøm →</a>': 'href="teknisk.html#strom">Utforsk Strøm →</a>',
    'href="#projects">Utforsk Projects →</a>': 'href="teknisk.html#projects">Utforsk Projects →</a>',
}
for old, new in replacements.items():
    s = s.replace(old, new)

# Remove obsolete Booking / Booking admin links if an older index is checked out.
s = s.replace('<a href="booking.html">Booking</a>', '')
s = s.replace('<a class="portal" href="booking-admin.html" title="Administrer sprinklerbooking">Booking admin</a>', '')

# Make the language control real. The UI translates the main navigation,
# hero and portal section, stores the choice locally, and can switch back.
old_lang = '<span class="lang">● NO⌄</span>'
new_lang = '''<div class="langwrap"><button class="lang" id="langBtn" type="button" aria-haspopup="true" aria-expanded="false">● <span id="langCode">NO</span>⌄</button><div class="langmenu" id="langMenu" role="menu"><button type="button" data-lang="no">Norsk</button><button type="button" data-lang="en">English</button></div></div>'''
if old_lang in s:
    s = s.replace(old_lang, new_lang, 1)

css_marker = '.lang{border:1px solid #172c3f;padding:9px 12px;border-radius:999px;font-size:11px;color:#c7d4df}'
css_extra = '''.lang{border:1px solid #172c3f;padding:9px 12px;border-radius:999px;font-size:11px;color:#c7d4df;background:#06111d;cursor:pointer}.langwrap{position:relative}.langmenu{display:none;position:absolute;right:0;top:44px;min-width:126px;padding:6px;background:#071521;border:1px solid #1b354d;border-radius:12px;box-shadow:0 18px 45px #0008;z-index:90}.langmenu.open{display:grid}.langmenu button{border:0;background:transparent;color:#dce8f2;text-align:left;padding:9px 10px;border-radius:8px;cursor:pointer}.langmenu button:hover{background:#10283b}.portal:focus-visible,.lang:focus-visible,.langmenu button:focus-visible{outline:2px solid #3fa7ff;outline-offset:2px}'''
if css_marker in s and '.langmenu{' not in s:
    s = s.replace(css_marker, css_extra, 1)

if 'id="ians-home-ui-v1"' not in s:
    script = r'''<script id="ians-home-ui-v1">
(()=>{
  const $=q=>document.querySelector(q);
  const $$=q=>[...document.querySelectorAll(q)];
  const btn=$('#langBtn'), menu=$('#langMenu'), code=$('#langCode');
  const translations={
    'Hjem':'Home','SameieNett':'SameieNett','Academy':'Academy','Økonomi':'Finance','IANS Lab':'IANS Lab','Teknisk':'Technical','Portal':'Portal','AXION GRID':'AXION GRID',
    'Utforsk portalen':'Explore portal','Utforsk SameieNett →':'Explore SameieNett →','Åpne Academy':'Open Academy','Åpne økonomi':'Open finance',
    'HOVEDOMRÅDER':'MAIN AREAS','Ni tydelige innganger':'Nine clear gateways','Alle områdene i IANS CORE — samlet på ett sted.':'All areas in IANS CORE — gathered in one place.',
    'Utforsk SameieNett →':'Explore SameieNett →','Åpne Academy →':'Open Academy →','Åpne økonomi →':'Open finance →','Se AXION GRID →':'View AXION GRID →','Utforsk IANS Lab →':'Explore IANS Lab →','Åpne OneDrive →':'Open OneDrive →','Utforsk DNS →':'Explore DNS →','Utforsk Strøm →':'Explore Energy →','Utforsk Projects →':'Explore Projects →',
    'Digital infrastruktur for sameier, nettverk, sikkerhet, adgang og smarte løsninger.':'Digital infrastructure for communities, networks, security, access and smart solutions.',
    'Faglig læring og kurs innen kraftsystem, teknologi og arkitektur.':'Professional learning and courses in power systems, technology and architecture.',
    'Personlig økonomi, budsjett, renter, spareplan og smarte verktøy.':'Personal finance, budgets, interest, savings plans and smart tools.',
    'Partnerskap og teknologinettverk for fremtidens infrastruktur.':'Partnerships and technology networks for future infrastructure.',
    'Verktøy, eksperimenter og nye konsepter under utvikling.':'Tools, experiments and new concepts under development.',
    'Kartlegg, analyser og organiser OneDrive-filer, duplikater og store filer.':'Map, analyse and organise OneDrive files, duplicates and large files.',
    'DNS, domener og nettverksverktøy for bedre ytelse og sikkerhet.':'DNS, domains and network tools for better performance and security.',
    'Kraftsystem, energidata og innsikt for styring og beslutninger.':'Power systems, energy data and insight for management and decisions.',
    'Egne prosjekter og konsepter — fra idé til løsning og innovasjon.':'Projects and concepts — from idea to solution and innovation.',
    '♥ Bygget med lidenskap for teknologi, læring og verdiskaping':'♥ Built with passion for technology, learning and value creation'
  };
  const reverse=Object.fromEntries(Object.entries(translations).map(([a,b])=>[b,a]));
  function translate(lang){
    const map=lang==='en'?translations:reverse;
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n=>{const t=n.nodeValue.trim(); if(map[t]) n.nodeValue=n.nodeValue.replace(t,map[t]);});
    document.documentElement.lang=lang==='en'?'en':'no';
    if(code) code.textContent=lang==='en'?'EN':'NO';
    localStorage.setItem('iansLang',lang);
  }
  if(btn&&menu){
    btn.addEventListener('click',e=>{e.stopPropagation();const open=menu.classList.toggle('open');btn.setAttribute('aria-expanded',String(open));});
    menu.addEventListener('click',e=>{const x=e.target.closest('[data-lang]');if(!x)return;translate(x.dataset.lang);menu.classList.remove('open');btn.setAttribute('aria-expanded','false');});
    document.addEventListener('click',()=>{menu.classList.remove('open');btn.setAttribute('aria-expanded','false');});
  }
  if(localStorage.getItem('iansLang')==='en') translate('en');
  $$('.portal[href="#hovedomrader"]').forEach(a=>a.addEventListener('click',e=>{const target=$('#hovedomrader');if(target){e.preventDefault();target.scrollIntoView({behavior:'smooth',block:'start'});history.replaceState(null,'','#hovedomrader');}}));
})();
</script>'''
    s = s.replace('</body>', script+'\n</body>', 1)

p.write_text(s, encoding="utf-8")
print("Home navigation repaired: technical links, portal and language selector enabled")
