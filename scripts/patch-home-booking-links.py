from pathlib import Path

p = Path("index.html")
s = p.read_text(encoding="utf-8")

# Keep real IANS destinations direct. Technical is a directory/hub, not a
# replacement for pages that already exist.
replacements = {
    'href="#ians-lab">IANS Lab</a>': 'href="teknisk.html#verktoy">IANS Lab</a>',
    'href="#portal">Portal</a>': 'href="#hovedomrader">Portal</a>',
    'class="planet planet-link p4" href="#ians-lab"': 'class="planet planet-link p4" href="teknisk.html#verktoy"',
    'class="planet planet-link p5" href="#projects"': 'class="planet planet-link p5" href="maimyra.html"',
    'class="planet planet-link p6" href="#strom"': 'class="planet planet-link p6" href="strom.html"',
    'class="planet planet-link p7" href="#dns"': 'class="planet planet-link p7" href="dns-sjekk.html"',
    'href="#ians-lab">Utforsk IANS Lab →</a>': 'href="teknisk.html#verktoy">Utforsk IANS Lab →</a>',
    'href="#dns">Utforsk DNS →</a>': 'href="dns-sjekk.html">Åpne DNS-sjekk →</a>',
    'href="#strom">Utforsk Strøm →</a>': 'href="strom.html">Åpne Strøm →</a>',
    'href="#projects">Utforsk Projects →</a>': 'href="maimyra.html">Åpne Projects →</a>',
}
for old,new in replacements.items(): s=s.replace(old,new)

s=s.replace('<a href="booking.html">Booking</a>','')
s=s.replace('<a class="portal" href="booking-admin.html" title="Administrer sprinklerbooking">Booking admin</a>','')

old_lang='<span class="lang">● NO⌄</span>'
new_lang='''<div class="langwrap"><button class="lang" id="langBtn" type="button" aria-haspopup="true" aria-expanded="false">● <span id="langCode">NO</span>⌄</button><div class="langmenu" id="langMenu" role="menu"><button type="button" data-lang="no">Norsk</button><button type="button" data-lang="en">English</button></div></div>'''
if old_lang in s:s=s.replace(old_lang,new_lang,1)
css_marker='.lang{border:1px solid #172c3f;padding:9px 12px;border-radius:999px;font-size:11px;color:#c7d4df}'
css_extra='''.lang{border:1px solid #172c3f;padding:9px 12px;border-radius:999px;font-size:11px;color:#c7d4df;background:#06111d;cursor:pointer}.langwrap{position:relative}.langmenu{display:none;position:absolute;right:0;top:44px;min-width:126px;padding:6px;background:#071521;border:1px solid #1b354d;border-radius:12px;box-shadow:0 18px 45px #0008;z-index:90}.langmenu.open{display:grid}.langmenu button{border:0;background:transparent;color:#dce8f2;text-align:left;padding:9px 10px;border-radius:8px;cursor:pointer}.langmenu button:hover{background:#10283b}.portal:focus-visible,.lang:focus-visible,.langmenu button:focus-visible{outline:2px solid #3fa7ff;outline-offset:2px}'''
if css_marker in s and '.langmenu{' not in s:s=s.replace(css_marker,css_extra,1)

if 'id="ians-home-ui-v1"' not in s:
    script=r'''<script id="ians-home-ui-v1">
(()=>{const $=q=>document.querySelector(q),btn=$('#langBtn'),menu=$('#langMenu'),code=$('#langCode');const tr={'Hjem':'Home','Økonomi':'Finance','Teknisk':'Technical','Utforsk portalen':'Explore portal','HOVEDOMRÅDER':'MAIN AREAS','Ni tydelige innganger':'Nine clear gateways','Alle områdene i IANS CORE — samlet på ett sted.':'All areas in IANS CORE — gathered in one place.','Åpne DNS-sjekk →':'Open DNS check →','Åpne Strøm →':'Open Energy →','Åpne Projects →':'Open Projects →','♥ Bygget med lidenskap for teknologi, læring og verdiskaping':'♥ Built with passion for technology, learning and value creation'};const rev=Object.fromEntries(Object.entries(tr).map(([a,b])=>[b,a]));function setLang(lang){const map=lang==='en'?tr:rev,w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),n=[];while(w.nextNode())n.push(w.currentNode);n.forEach(x=>{const t=x.nodeValue.trim();if(map[t])x.nodeValue=x.nodeValue.replace(t,map[t])});document.documentElement.lang=lang==='en'?'en':'no';if(code)code.textContent=lang==='en'?'EN':'NO';localStorage.setItem('iansLang',lang)}if(btn&&menu){btn.onclick=e=>{e.stopPropagation();menu.classList.toggle('open')};menu.onclick=e=>{const x=e.target.closest('[data-lang]');if(x){setLang(x.dataset.lang);menu.classList.remove('open')}};document.addEventListener('click',()=>menu.classList.remove('open'))}if(localStorage.getItem('iansLang')==='en')setLang('en');})();
</script>'''
    s=s.replace('</body>',script+'\n</body>',1)

p.write_text(s,encoding='utf-8')
print('Home navigation repaired with direct page links, portal and language selector')
