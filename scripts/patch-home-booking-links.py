from pathlib import Path

p = Path("index.html")
s = p.read_text(encoding="utf-8")

old_nav = '<div class="navlinks"><a class="active" href="#top">Hjem</a><a href="SameieNett.html">SameieNett</a><a href="academy/index.html">Academy</a><a href="tools/money-planner/index.html">Økonomi</a><a href="#ians-lab">IANS Lab</a><a href="#portal">Portal</a><a class="axion" href="#axion">AXION GRID</a></div>'
new_nav = '<div class="navlinks"><a class="active" href="#top">Hjem</a><a href="SameieNett.html">SameieNett</a><a href="academy/index.html">Academy</a><a href="tools/money-planner/index.html">Økonomi</a><a href="#ians-lab">IANS Lab</a><a href="booking.html">Booking</a><a href="#portal">Portal</a><a class="axion" href="#axion">AXION GRID</a></div>'

old_actions = '<div class="nav-actions"><a class="portal" href="#hovedomrader">Utforsk portalen</a><span class="lang">● NO⌄</span></div>'
new_actions = '<div class="nav-actions"><a class="portal" href="booking-admin.html" title="Administrer sprinklerbooking">Booking admin</a><a class="portal" href="#hovedomrader">Utforsk portalen</a><span class="lang">● NO⌄</span></div>'

changed = False
if 'href="booking.html">Booking</a>' not in s:
    if old_nav not in s:
        raise SystemExit("Fant ikke forventet hovedmeny i index.html")
    s = s.replace(old_nav, new_nav, 1)
    changed = True

if 'href="booking-admin.html" title="Administrer sprinklerbooking"' not in s:
    if old_actions not in s:
        raise SystemExit("Fant ikke forventet handlingsfelt i index.html")
    s = s.replace(old_actions, new_actions, 1)
    changed = True

if changed:
    p.write_text(s, encoding="utf-8")
    print("La til Booking og Booking admin på forsiden")
else:
    print("Booking-lenker finnes allerede på forsiden")
