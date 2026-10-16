# Innholds- og driftskontroll
Oppdatert 16. oktober 2026. Dette er en arbeidsrutine, ikke en påstand om sertifisering.

## Før publisering
- Kontroller tekst mot det brukeren faktisk kan gjøre. Merk eksempeldata, prototype og arkiv.
- Kildepåstander skal ha originalkilde og dato. Skill redaksjonell gjennomgang fra en ny full faktasjekk.
- Synkroniser norsk/engelsk og merk tydelig hvis en lenke fører til norsk innhold.
- Kjør `python3 checks/site-links.py`, `python3 checks/analytics-policy.py`, `node --test checks/*.test.mjs` og `python3 checks/local_ai_test.py`.
- Prøv berørte arbeidsflyter med ufarlige testdata, tastatur og mobilbredde. Et HTTP 200-svar er ikke en funksjonstest.
- Kontroller nye KI- eller datamottakere før data sendes. Nøkler skal bare ligge i backendinnstillinger.

## Daterte Azure-tall
`python3 scripts/update-public-costs.py --output assets/ians-home/costs.json`
krever Azure CLI-innlogging til riktig abonnement. Skriptet skriver bare offentlig aggregate,
stopper ved manglende valuta, ufullstendige sider og kredittbalanser og publiserer ikke automatisk.
Les tall, periode og omfang før commit. Kortet merker målinger eldre enn 72 timer.
Det er ingen ny automatisk fakturainnhenting eller planlagt jobb i dette oppsettet.

## Kontroll- og bookingdatoer
Brannkontrollens server bruker `IANS_FIRE_CONTROL_CONFIRMED=true` først når datoer er bekreftet.
Eventuelle andre datoer gis i `IANS_FIRE_CONTROL_DATES` som en JSON-liste med YYYY-MM-DD.
Ugyldig konfigurasjon feiler lukket. Åpning beregnes 30 dager før første bekreftede dag.
Ingen datoer er bekreftet av kodeendringen 16. oktober 2026.

Planlagt sletting er 14 dager etter siste brannkontrolldag. Serveren rydder ved neste autoriserte
forespørsel etter fristen. Dette er ikke en klokkestyrt slettejobb; ansvarlig må kontrollere faktisk
sletting. Sprinkler har separat oppgitt 30-dagersrutine og må følges opp separat.
Ikke påstå at en automatisk jobb er i drift før den er satt opp og kontrollert.

## Versjoner og arkiv
Dagens innganger er Website Studio, Money Planner-hovedsiden og OneDrive Command.
Money Planner v01-v04 er merkede, ikke-indekserte historiske utgaver. Unødvendig om-megoo-kopi
videresendes til dagens biografi. Eldre nedlastingspakker beholdes med sine opprinnelige hashfiler.

## Praktisk maskin- og tilgjengelighetstest
Lokal KI 1.1 har en kort fysisk Mac-test med Llama 3.2. Windows/Linux og Gemma-generering er ikke
bekreftet av den testen. Behold disse avgrensningene. Canvas-spill må testes som spill;
automatiske tilgjengelighetsregler og skjulte overskrifter gjør dem ikke automatisk brukbare
med skjermleser. Dokumenter begrensningene fremfor å love full universell utforming.
