from pathlib import Path

p = Path('booking.html')
text = p.read_text(encoding='utf-8')
marker = '<script src="/booking-server.js?v=4"></script>'
if marker not in text:
    text = text.replace('</body>', marker + '</body>')
text = text.replace('Denne piloten sender ikke opplysningene til server.', 'Opplysningene lagres på serversiden og er bare tilgjengelige i styrets låste administrasjon.')
text = text.replace('IANS Booking V3 · Pilot · 4 tidsvinduer · boligregister uten navn · ingen serverlagring aktivert ennå', 'IANS Booking V4 · sentral booking · automatisk kapasitet · låst administrasjon')
p.write_text(text, encoding='utf-8')
print('booking.html patched for live server booking')
