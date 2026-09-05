from pathlib import Path

# Dinner Planner: compact ecosystem switcher + own minimal responsibility footer.
p=Path('tools/dinner-planner/index.html')
s=p.read_text()
if '.ecoswitch{' not in s:
    s=s.replace('.brand{font-weight:900}', '.brand{font-weight:900}.ecoswitch{display:flex;gap:8px;align-items:center}.ecoswitch a{color:#bfe6ff;text-decoration:none;border:1px solid #28516e;border-radius:9px;padding:7px 10px;font-size:12px}.ecoswitch a.active{background:#12334b;color:white}@media(max-width:760px){.ecoswitch{gap:5px}.ecoswitch a{padding:6px 7px;font-size:11px}}',1)
s=s.replace('<header class="top"><div class="brand">IANS · DINNER PLANNER AI</div><a href="/teknisk.html" style="color:#9ddfff">IANS Teknisk</a></header>', '<header class="top"><div class="brand">IANS · FOOD TOOLS</div><div class="ecoswitch"><a href="/middag.html">🎲 Dinner Creator</a><a class="active" href="/tools/dinner-planner/index.html">📅 Dinner Planner</a><a href="/teknisk.html">IANS Teknisk</a></div></header>',1)
s=s.replace('IANS Dinner Planner · Veiledende matplanlegging. Kontroller allergier, intoleranser, holdbarhet og trygg tilberedning selv. IANS / Henrik Bergfjord · Teknisk ansvarlig.', 'IANS Dinner Planner · Veiledende matplanlegging · Teknisk ansvarlig for denne siden: Henrik Bergfjord · ians.no',1)
p.write_text(s)

# Dinner Creator: preserve quick/random role, add clear route to Planner.
p=Path('middag.html')
s=p.read_text()
needle='<button class="button primary" id="generateHero" type="button">Generer middag</button>'
if needle in s and '/tools/dinner-planner/index.html' not in s:
    s=s.replace(needle, needle+'\n              <a class="button secondary" href="/tools/dinner-planner/index.html">📅 Lag ukesplan i Dinner Planner</a>',1)
# Clarify identity without replacing its strong random-generator concept.
s=s.replace('<h1>Middagsgenerator</h1>', '<h1>Dinner Creator</h1>',1)
s=s.replace('Finn en ny middagsidé med bilde, tidsbruk, ingredienser, fremgangsmåte, bakgrunn og enkel ukemeny.', 'Få én rask middagsidé med bilde, ingredienser, fremgangsmåte og inspirasjon. For komplett uke, budsjett og handleliste bruker du Dinner Planner.',1)
p.write_text(s)

# Technical page: expose both tools with distinct jobs.
p=Path('teknisk.html')
s=p.read_text()
planner='<a class="link" href="/tools/dinner-planner/index.html"><span class="icon">🍽️</span><span><b>Dinner Planner</b><small>Middagsplan, oppskrifter, handleliste, sparetips og PDF på norsk/engelsk.</small></span><span>→</span></a>'
creator='<a class="link" href="/middag.html"><span class="icon">🎲</span><span><b>Dinner Creator</b><small>Rask middagsidé, inspirasjon, oppskrift og favoritt.</small></span><span>→</span></a>'
if planner in s and creator not in s:s=s.replace(planner,creator+planner,1)
p.write_text(s)
