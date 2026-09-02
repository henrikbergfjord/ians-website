from pathlib import Path

p = Path('booking.html')
text = p.read_text(encoding='utf-8')
marker = '<script src="/booking-server.js?v=5"></script>'
text = text.replace('<script src="/booking-server.js?v=4"></script>', '')
if marker not in text:
    text = text.replace('</body>', marker + '</body>')
text = text.replace('Denne piloten sender ikke opplysningene til server.', 'Telefonnummeret brukes bare for gjennomføring av kontrollen og er kun tilgjengelig i styrets låste administrasjon.')
text = text.replace('Opplysningene lagres på serversiden og er bare tilgjengelige i styrets låste administrasjon.', 'Telefonnummeret brukes bare for gjennomføring av kontrollen og er kun tilgjengelig i styrets låste administrasjon.')
text = text.replace('IANS Booking V3 · Pilot · 4 tidsvinduer · boligregister uten navn · ingen serverlagring aktivert ennå', 'IANS Booking V5 · sentral booking · personvern · låst administrasjon')
text = text.replace('IANS Booking V4 · sentral booking · automatisk kapasitet · låst administrasjon', 'IANS Booking V5 · sentral booking · personvern · låst administrasjon')
needle = '<p><strong>Bookingsystemet er et frivillig hjelpemiddel.</strong> Det gjør det mulig å reservere et tidsvindu i stedet for å være tilgjengelig hele dagen. Kontrolløren kan komme når som helst innenfor valgt 2-timersperiode.</p>'
if needle not in text:
    old = '<p><strong>Bookingsystemet er et frivillig hjelpemiddel.</strong> Det gjør det mulig å reservere et tidsvindu i stedet for å være tilgjengelig hele dagen. Kontrolløren kan komme når som helst innenfor valgt 2-timersperiode. Hvert vindu har begrenset kapasitet.</p>'
    new = '<p><strong>Bookingsystemet er frivillig.</strong> Det er sameiets løsning for å administrere de tilgjengelige 2-timers intervallene. Kontrolløren kan komme når som helst innenfor valgt periode. Dersom du ikke ønsker å bruke digital booking, kan du melde via <strong>VIBBO</strong> at boligen er tilgjengelig hele kontrolldagen, eller kontakte sprinklerleverandøren på oppgitt e-post om ønsket tidspunkt.</p><p><strong>Selve sprinklerkontrollen er ikke frivillig.</strong> Booking er bare måten tidsvinduet administreres på; sameiets plikt til nødvendig kontroll og vedlikehold av brannsikkerhetsinstallasjoner følger av gjeldende brannregelverk.</p><p><a href="/booking-personvern.html">Personvern og GDPR for IANS Booking</a> · <a href="https://www.datatilsynet.no/rettigheter-og-plikter/personvernprinsippene/" target="_blank" rel="noopener">Datatilsynet</a> · <a href="https://www.dsb.no/brannsikkerhet/ofte-stilte-sporsmal-til-forskrift-om-brannforebygging/" target="_blank" rel="noopener">DSB om kontroll og vedlikehold</a></p>'
    text = text.replace(old, new)
privacy_old = '<p class="privacy">Telefonnummeret skal bare brukes for gjennomføring av kontrollen og skal aldri vises til andre beboere. Denne piloten sender ikke opplysningene til server.</p>'
privacy_new = '<p class="privacy">Telefonnummeret brukes bare for gjennomføring av kontrollen og er kun tilgjengelig i styrets låste administrasjon. Opplysningene slettes etter kontroll og praktisk etterarbeid, normalt senest etter 30 dager. <a href="/booking-personvern.html">Les om personvern og dine rettigheter.</a></p>'
text = text.replace(privacy_old, privacy_new)
p.write_text(text, encoding='utf-8')
print('booking.html patched for GDPR-aware live booking')
