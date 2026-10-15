# IANS lokal KI – startpakke 1.0
Publisert 15. oktober 2026. Koden bruker Python 3.10+ og Ollama.
Dette er en liten tekstchat med en ferdigtrent modell, ikke trening av egen grunnmodell.
Ingen API-nokkel, pip-avhengigheter eller abonnement er nodvendig for denne lokale chatten.
Modellene har egne lisensvilkar: https://ai.google.dev/gemma/terms

## 1. Installer forutsetningene selv
Last ned Ollama fra https://ollama.com/download og Python 3.10+ fra
https://www.python.org/downloads/ (Mac har ikke nodvendigvis Python fra for).
Bruk leverandorenes installasjonsveiledning. Pakk ut ZIP-filen for du starter.
Start Ollama. Apne Terminal pa Mac/Linux, eller cmd pa Windows, i den utpakkede mappen.
Eksemplene under er Mac/Linux. Pa Windows: bytt `python3` med `py -3`.

## 2. Sett Ollama i lokal modus
Les koden for du kjorer den.
    python3 ians_chat.py --configure-local
Bekreft med y. Dette setter disable_ollama_cloud=true i ~/.ollama/server.json.
Eksisterende innstillinger bevares; en eksisterende fil sikkerhetskopieres en gang.
AVSLUTT OLLAMA HELT og start appen/tjenesten igjen etter endringen.
Pa Linux med systemd bruker du Ollamas dokumentasjon for omstart av tjenesten.
Kontroller Ollama-loggen: `Ollama cloud disabled: true`.
Koden endrer ikke nettverksbinding. Ollama skal lytte pa 127.0.0.1:11434,
ikke 0.0.0.0 eller en offentlig adresse. Fjern egen OLLAMA_HOST-overstyring hvis nodvendig.
Dokumentasjon: https://docs.ollama.com/faq
Gjenoppretting: avslutt Ollama, sett disable_ollama_cloud=false eller gjenopprett din
server.json.ians-backup, og start Ollama igjen. Ikke overskriv andre nye innstillinger.

## 3. Last ned modell (krever internett og ditt samtykke)
    python3 ians_chat.py --setup --model gemma3:1b
Bekreft med y. Modellfilen er omtrent 0,8 GB ved kildekontroll 15.10.2026.
Alternativ, bedre men tyngre:
    python3 ians_chat.py --setup --model gemma3:4b
Omtrent 3,4 GB; det kreves mer arbeidsminne enn filstorrelse.
Ingen programvare installeres automatisk av pakken; modellnedlasting skjer med ollama pull.

## 4. Start chat
    python3 ians_chat.py --model gemma3:1b
Eller velg gemma3:4b hvis den er installert. /clear tommer chat og /quit avslutter.
Du kan bruke start-mac-linux.sh eller start-windows.cmd med de samme argumentene.
Om skallet ikke vil kjore .sh direkte: `sh start-mac-linux.sh --model gemma3:1b`.
Ingen sudo eller endring av PowerShell ExecutionPolicy er nodvendig for pakken.

## Hva er lokalt?
Chatklienten kontakter bare http://127.0.0.1:11434 og folger ikke HTTP-videresendinger.
Den bruker ikke systemets HTTP-proxy. Kun de to angitte lokale modellnavnene godtas.
Du ma likevel selv kontrollere at Ollama pa maskinen ikke er erstattet eller satt opp
med en ekstern backend, og at cloud-modus faktisk er av etter omstart.
Forste installasjon, modellnedlasting og programoppdateringer bruker nettverk.
Etter nedlasting kan du prove chatten uten internett. Dette er ikke en full sikkerhetsrevisjon
av Ollama, operativsystemet eller annen programvare pa maskinen.

Ingen nettleser, filinnlesing eller agentverktoy. Modellsvar blir aldri kjort som kommandoer.
Chat finnes bare i prosessminnet; terminalens historikk/skjermbuffer og andre programmer
kan fortsatt beholde informasjon. Programmet tilbyr ikke kryptert lagring eller flerbruker-tilgang.
Korte samtaler: inntil tre tidligere meldingspar sendes med; kontekstvindu er satt til 4096 tokens.
Store meldinger kan fremdeles bli avkortet av modellen. Forste svar kan ta tid.

## Feilsoking
- Connection refused: start Ollama; kontroller port 11434 og at ingen annen tjeneste bruker den.
- Modell mangler: kjor --setup med det samme modellnavnet du vil chatte med.
- For lite minne: velg 1b, lukk andre programmer og forkort samtalen med /clear.
- Lang ventetid: CPU kan vaere treg. Modellen lastes forst inn i RAM/VRAM.
- Dette er ikke ChatGPT: modellen kan gi svake norske svar og dikte opp fakta/kilder.
- Avinstallering: `ollama rm gemma3:1b` / `ollama rm gemma3:4b` fjerner modellen,
  og sletting av pakkemappen fjerner denne klienten. Ollama/Python avinstalleres separat.

## Verifikasjon og begrensninger
Koden er syntakskontrollert og testet mot en simulert lokal Ollama-API:
modellvalg, oppsettbekreftelse, HTTP-chat, feil og avbrudd. Pakken er ikke testet med
modellgenerering pa fysisk Mac-, Windows- eller Linux-maskin. Ingen ytelsesgaranti.
Kildedato 15.10.2026. Runtime og modeller kan endres; kontroller offisiell dokumentasjon.

## Kilder
https://docs.ollama.com/faq
https://docs.ollama.com/api/chat
https://ollama.com/library/gemma3/tags
https://docs.ollama.com/macos
https://docs.ollama.com/windows
https://docs.ollama.com/linux

## Lisens
Pakkens egen Python-/startkode kan brukes, endres og deles under MIT-lisensen i LICENSE.txt.
Modeller, Ollama og Python har egne vilkar. Ingen modellvekter er inkludert i ZIP-filen.
