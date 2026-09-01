from pathlib import Path

p = Path("SameieNett.html")
s = p.read_text(encoding="utf-8")

# Add booking to the main navigation, immediately before FAQ.
nav_marker = '<a href="#faq">\n      FAQ\n     </a>'
nav_booking = '<a href="booking.html">\n      Booking\n     </a>\n' + nav_marker
if 'href="booking.html">\n      Booking' not in s and nav_marker in s:
    s = s.replace(nav_marker, nav_booking, 1)

# Add resident booking + admin access in the footer CTA action group.
back_marker = '<a class="sn-btn ghost" href="index.html">\n        Tilbake til ians.no\n       </a>'
booking_buttons = '''<a class="sn-btn primary" href="booking.html">\n        Bestill sprinklerkontroll\n       </a>\n<a class="sn-btn ghost" href="booking-admin.html">\n        Booking admin\n       </a>\n''' + back_marker
if 'href="booking-admin.html">\n        Booking admin' not in s and back_marker in s:
    s = s.replace(back_marker, booking_buttons, 1)

p.write_text(s, encoding="utf-8")
print("SameieNett: booking links enabled")
