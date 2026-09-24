# IANS førsteutkast – 24. september 2026

Status: klar for publisering som førsteutkast.

## Kontrollert
- Visuell sammenligning med brukerens fjord/globus-referanse. Tilpasset med fire innganger og enklere navigasjon.
- Desktop 1672 × 941 og smal mobilvisning kontrollert i nettleser. Mobiltekst ligger over et separat bildeområde. Skjermbilder ligger lokalt i qa/; fullsideopptak på mobil hadde enkelte sammensettingsartefakter.
- Mobilmeny, Plattformen, Prosjekter, Veien videre, kostnadsforklaring og kontaktåpning kontrollert.
- Teknisk viser fire grupper. Eksisterende lenker og innloggingsadresser er bevart.
- Kontaktskjema testet lokalt: opplyser at meldingen ikke er sendt. Produksjonsinnsending er ikke testet med en virkelig henvendelse.
- Ingen JavaScript-feil observert i nettleseren.
- Fire automatiserte tester av kostnadsvalidering bestått.
- Alle åtte produksjonspatcher kjørt i separat kopi; index.html og teknisk.html var identiske før og etter.
- git diff --check bestått.

## Gjenstår
- Koble til godkjente, aggregerte faktiske kostnader for IANS og SOGOD. Inntil da vises «Ikke tilkoblet», aldri et oppdiktet beløp.
- Verifisere mottak og operativ oppfølging av en reell kontaktmelding. Eksisterende API lagrer generelle meldinger, men sender ikke automatisk e-postvarsel for disse.
- Eventuelt finpusse Teknisk med kortere beskrivelser og tydeligere undergrupper.
- Utvide prosjektinnhold etter brukerens ønsker.

## Omfang
Ny forside og omorganisering av Teknisk. Eksisterende tjenester, API, tilgangskontroll og SOGOD er ikke bygget om.
