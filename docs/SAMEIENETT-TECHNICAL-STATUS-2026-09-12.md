# IANS SameieNett – teknisk status 12.09.2026

## Mål
SameieNett skal være en fler-sameieplattform hvor beboerflater viser minst mulig personinformasjon, mens Microsoft-autentiserte styremedlemmer får rollebasert tilgang til nødvendige administrative data.

## Bygget og tilgjengelig i kodebasen
- Microsoft-sikrede styreadminflater for sprinkler, brannkontroll og årshjul.
- Tjenestespesifikke tilgangsforespørsler og samlet styretilgang.
- Registrering av nytt sameie med godkjenningsflyt.
- Årshjul med gjentakende aktiviteter, styremøter, varsling, helligdager, CSV, utskrift og ICS.
- Vedlikeholdsoppfølging med estimat/faktisk kostnad og oppfølgingsdatoer.
- Booking-admin med tilgangskontroll og administrative persondata.
- SameieNett Dashboard som felles inngang til tjenester.
- Ny SameieNett-kjerne med separate tabeller for sameie, boliger, personer, medlemskap og kontrollhistorikk.
- Grunnregister for manuell registrering av bolig, styremedlem og kontrollhistorikk.

## Ny datamodell – fase 1
Azure Table Storage:
- `IansSameier`: sameieprofil, status, moduler og profilmetadata.
- `IansSameieUnits`: stabile boligobjekter med oppgang, bruksenhet, leilighetsnummer og admin-adresse.
- `IansSameiePeople`: personobjekter. Skal ikke brukes som boligidentitet.
- `IansSameieMembers`: styremedlemmer og roller per sameie.
- `IansSameieInspections`: kontrollhistorikk per bolig og år.

Kjerneprinsipp: bolig og person er separate objekter. En bolig består selv om eier/beboer eller styre endres.

## Sikkerhet og personvern
- Entra/Microsoft identifiserer bruker.
- Backend autoriserer sameie og rolle.
- Frontend skal aldri være eneste tilgangskontroll.
- Beboerbooking skal kun vise nødvendig boligidentifikasjon, for eksempel `5D · H0203`.
- Full adresse, navn, telefon og e-post hører hjemme i godkjent Styreadmin.
- Sensitive opplastinger som beboerlister skal lagres i privat Blob Storage og behandles som importkilde, ikke offentlig frontend-data.

## Eksisterende begrensninger som må ryddes
1. Dagens sprinkler-booking har fortsatt full adresse i dropdown. Denne må migreres til redusert offentlig boligvisning.
2. Eksisterende bookingdata og historiske 2025/2026-kontroller er ennå ikke fullt migrert til `IansSameieUnits` og `IansSameieInspections`.
3. Tilgangstabellen og det nye medlemsregisteret eksisterer parallelt i fase 1. I fase 2 skal medlemskap bli autoritativ kilde og tilgangstjenesten bruke samme medlemsmodell.
4. Årshjul, booking og vedlikehold har fortsatt enkelte Straumsfjellet-spesifikke partisjoner/antakelser. Disse må flyttes til `sameieId`.
5. Nye sameier må få automatisk opprettelse av profil, moduler og tomme dataområder etter godkjenning.
6. Import av Excel/CSV må få validering, forhåndsvisning, duplikatkontroll og eksplisitt bekreftelse før data skrives.

## Fase 2
- Migrer sprinkler og brannbooking til `sameieId` + `unitId`.
- Offentlig API returnerer kun oppgang/bruksenhet og bookingstatus.
- Admin API beriker med person-/kontaktdata etter autorisasjon.
- Migrer 2025/2026 sprinklerhistorikk til kontrolltabellen.
- Koble tilgangsmodellen til medlemsregisteret.
- Gjør dashboardet dynamisk per sameie i stedet for hardkodet Straumsfjellet.

## Fase 3
- Full onboarding: søknad → godkjenning → sameieopprettelse → import → styreinvitasjoner → aktive moduler.
- Profilbilde og egen sameieprofil.
- Dokumentområde, rapporter og eventuell økonomimodul.
- Revisjonslogg for administrative endringer.
- Test/prod-separasjon når plattformen tas i bruk av flere sameier.

## Azure
Ingen ny Azure-plattform er nødvendig for fase 1. Eksisterende Static Web App, Functions, Table Storage, Blob Storage, Microsoft auth og ACS kan gjenbrukes. Før ekstern utrulling anbefales tydelig skille mellom test og produksjon samt dokumenterte retention-/backupregler for persondata.