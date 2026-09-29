# IANS Games – 20 spill

Ferdig implementert og klargjort for publisering 29. september 2026. Publisering er godkjent av eier.
Forhåndsvisning: http://127.0.0.1:8765/games/ på denne maskinen mens lokalserveren kjører.

## 11 nye spill

Alle starter på «Utfordrer · ca. 12 år», med Øving og Ekspert som alternativer. Aldersnivået er et designmål; Ian bør prøve spillene for endelig kalibrering.

| Spill | Utfordring |
| --- | --- |
| Neon Dash | Hopp, dobbelthopp og skli. 10 nivåer over to minutter, økende fart, krystaller og rekord per modus. |
| 2048 Reactor | Skyv og slå sammen tall. Mål 512 / 2048 / 4096. |
| Fire på rad | Datamaskin med ulik søkedybde, taktiske blokkeringer og feller. |
| Mine Lab | 8 × 8 brett med 8 / 12 / 16 miner og egen flaggmodus. |
| Sudoku Lab | Genererte 6 × 6-brett, kontrollert for nøyaktig én løsning, færre ledetråder på høyere nivå. |
| Lysjakten | Løsbare 4 × 4 / 5 × 5 / 6 × 6-brett. |
| Skyvepuslespill | Løsbare 3 × 3 / 4 × 4 / 5 × 5-brett. |
| Kodeknekkeren | Fire ulike sifre; større sifferutvalg og færre forsøk på høyere nivå. |
| Ordjakten | Større brett, flere ord og flere retninger. |
| Labyrintjakten | Tilfeldige, sammenhengende labyrinter i tre størrelser. |
| Target Rush | 30 sekunder, grønne mål, rosa lokkemål og raskere tidsfrister. |

De ni eksisterende spillene er fortsatt med, inkludert de to eventyrspillene som manglet i den lokale spilloversikten.

## Rettinger i eksisterende spill

- Neon Snake: ny runde etter kollisjon, sveip, korrekt kollisjon mot halen, fullført brett og pause når fanen skjules.
- Memory Grid: avbryter gamle visningssekvenser ved omstart og låser opp startknappen. Starter med fire ruter og får lengre/raskere sekvenser.
- Brick Breaker: tidsbasert bevegelse gir samme fart ved 60 og 120 Hz. Pauseknapp og pause ved fokusbytte.
- Block Grid: avbrutt berøringsbevegelse plasserer ikke en brikke. Fjerner gamle hendelseslyttere.
- Moto Run: nullstiller holdte knapper og avbryter banen når fanen skjules. Piltastene ruller ikke siden.
- Orbit Defender: et treff gir ikke flere poeng for samme objekt. Berøringsfangst og pause ved fanebytte.
- IAN’S ORBIT / IAN: The Adventure: berøringsknapper vises på nettbrett, fanger fingeren og hindrer nettleserbevegelser på kontrollene. Overlegg ligger over kontrollene.
- Chess Arena: brettet passer små skjermer. Samme sjakkmotor (chess.js 1.4.0, med lisens) lastes lokalt og trenger ikke ekstern CDN.
- Eksisterende analyseskript fra den offentlige siden er bevart. Det kjører ikke på localhost/127.0.0.1.

De offentlige HTML-sidene ble hentet og sammenlignet med lokal grunnversjon. Spillene hadde samme grunnkode, med eksisterende analyseskript lagt til på produksjonssiden.

## Verifisert

Playwright WebKit 26.5 med iPad-enhetsprofil og berøring:

- 20 unike spillkort og 20 sider uten JavaScript-feil.
- 30 kombinasjoner av modus og omstart for de ti spillene i felles spillmotor.
- Ingen horisontal side-overflyt ved 390 px eller iPad-portrett; eventyrkontroller synlige i iPad-landskap.
- Reelle berøringstrekk, motspill fra datamaskinen og fullføring av Sudoku, Ordjakten, Lysjakten og Labyrintjakten.
- Snake-krasj og omstart, Memory Grid-omstart under visning, Neon Dash-pause og ny runde.
- Brick Breaker samme bevegelse ved 60/120 Hz; Block Grid-avbrytelse uten plassering.
- Sjakkparti startet og trekk utført med tredjepartsnettverk blokkert.
- Alle 11 nye spill starter også når localStorage er blokkert.
- JavaScript-syntaks og git diff --check bestått.

Testfiler: tests/games-browser.cjs og tests/games-regressions.cjs. De bruker Playwright og en lokal HTTP-server på port 8765. Den første støtter GAMES_URL som alternativ adresse.

Begrensninger: Dette er nettleseremulering, ikke en fysisk iPad. Ingen påstand om at alle gamle spill er fullført eller alle baner gjennomspilt. Endelig følelse, vanskelighetsgrad og eldre iPadOS-versjoner må vurderes på Ians enhet.

## Publisering

Leveransen inneholder kun spillrelaterte filer og tester. Pågående endringer i Academy/Kids er ikke inkludert. Oppdateringspakken legges over nettsidens rot, slik at games/, tools/chess-arena/ og assets/js/ beholder struktur. Publiseringsjobben i repoet aktiveres av push til main; denne oppdateringen publiseres via main etter eiers godkjenning.
