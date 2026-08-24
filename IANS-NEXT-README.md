# IANS Next – Master Release

## Hovedløft
- Felles IANS Next designlag og release-identitet.
- Money Planner 5.0: renere hovedside, separate sider for Barnesparing, Selg, Ressurser og utvidet Hjelp.
- OneDrive Command: ny produktforside og oppgavebasert navigasjon, med eksisterende Graph-motor bevart i Command Center.
- Backupfiler, .DS_Store og .git er ikke med i releasepakken.
- Eksisterende SameieNett, Academy og IANS-verktøy beholdes funksjonelt og kobles til felles designlag.

## Bevisst risikostyring
Denne releasen flytter ikke OneDrive Graph-logikken fysisk mellom JS-moduler ennå. Den delen er stor og tilstandsfull, så masteren legger først ny informasjonsarkitektur rundt den testede motoren. Neste engineering-release kan modulere JS etter regresjonstester.
