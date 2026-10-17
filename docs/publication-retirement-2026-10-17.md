# Avpublisering og tilgangskontroll - 17. oktober 2026

## Bekreftet før endring
- 171 kjente HTML-adresser kontrollert anonymt på www.ians.no og den parallelle black-bush-verten: 146 svarte 200, 17 svarte 301, 8 svarte 401. Dette er adresser, ikke 171 selvstendige tjenester. Listen omfattet 21 HTML-snapshots i skjulte backupmapper.
- Den separate Axion-verten publiseres fra feature/entra-login. 105 av de samme gamle IANS-adressene svarte 200 der. Egen kildegren har også aktive Axion-sider.
- Analytics-side/API og de viste Axion-adminsidene svarte 401 anonymt. Skjermbildet viser en innlogget eier; det er ikke dokumentasjon på anonym adminadgang.
- Analytics-API-et manglet egen administratoravgrensning bak innloggingen. Det er rettet før lagring leses.
- Tre forhåndsvisningsmiljøer er fortsatt knyttet til åpen PR 1 (feature/azure-cost-admin), sist oppdatert 11. september. De har gamle IANS-kopier. De skal håndteres separat uten å endre produksjonsdata eller lukke PR-en.

## Denne main-endringen
- 22 entydig utgåtte HTML-kilder og 5 .backup-filer fjernes fra dagens kilde. De er gjenfinnbare i Git-historikken.
- Historiske URL-er videresendes til dagens erstatning; gammel kilde inngår ikke i publiseringen.
- Eksplisitt publication.json begrenser den statiske publiseringen til 339 filer / 128 HTML-sider. Backend deployes separat fra api/.
- Skjulte mapper, dokumentasjon, tester, skript, arbeidsfiler og gamle builder-assets følger ikke med til statisk hosting.
- Begge main-arbeidsflyter bygger dist-public og kontrollerer lenker i det faktiske artefaktet.
- Ingen eksisterende innloggingskrav fjernes. Filaliaser for beskyttede sider får samme autentiseringskrav. Analytics krever godkjent Microsoft-eierkonto i backend; en vilkårlig innlogget konto avvises før lagring leses.
- Ingen Azure-hemmeligheter, lagrede bestillinger, brukere eller rollemedlemskap endres.

## Separat Axion-endring
- Beholder aktiv Axion-tjeneste og gjeldende rollegrenser inntil eieren eventuelt ber om full avvikling.
- Bare admin/, axion-grid/, en fjernet-side og konfigurasjon inngår i statisk hosting. Root viser til dagens IANS. Ukjente/gamle IANS-sider gir 404.
- Kun de fire aktive API-ene contact, azure-cost, axion-advisor og axion-proposal-send deployes.
- Admin-HTML krever innlogging; Axion-områder/API-er beholder egne roller. Azure-kostdata har allerede egen serverkontroll for IANS-eier/admin. Frontendvisning alene regnes ikke som databeskyttelse.

## Kontroller før publisering
37 Node-tester og 12 lokale KI-tester besto. Ny sikkerhetstest kontrollerer anonym/feil konto/eier mot Analytics, filaliaser, historiske videresendinger og eksakt publiseringsliste. Artefaktets 128 HTML-sider og lokale ressurser er kontrollert. Axion har egen liste-, rolle-, 404- og JavaScript-kontroll før deploy.

Kilder for plattformoppførsel: https://learn.microsoft.com/en-us/azure/static-web-apps/configuration og https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-authorization (kontrollert 17. oktober 2026). Produksjonsstatus må etterprøves etter deploy.
