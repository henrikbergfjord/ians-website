from pathlib import Path

# Dinner Creator: preserve quick/random role, add clear route to Planner.
p=Path('middag.html')
s=p.read_text()
needle='<button class="button primary" id="generateHero" type="button">Generer middag</button>'
if needle in s and '/tools/dinner-planner/index.html' not in s:
    s=s.replace(needle, needle+'\n              <a class="button secondary" href="/tools/dinner-planner/index.html">📅 Lag ukesplan i Dinner Planner</a>',1)
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
