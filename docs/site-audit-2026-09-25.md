# IANS – gjennomgang 25. september 2026

## Ferdigstilt
- Forsiden har sammenhengende bakgrunnsbilde over hele siden. Kortene ligger nederst og opptar 22–25 % av kontrollerte skrivebordshøyder. Mobil bruker kompakte kort og samme bakgrunn.
- Teknisk er delt i verktøy, sameie, infrastruktur, læring, personlige prosjekter og administrasjon. Tilgangslenker er samlet.
- Tre identiske Academy-kopier videresendes til hovedsidene. Eldre verktøyversjoner er beholdt med tydelig vei tilbake.
- Manglende SameieNett-bilder, ugyldige OneDrive-ankere, foreldreløse spill og flere tilbake-lenker er rettet.
- Website Builder Light og Pro hadde JavaScript-syntaksfeil. Begge viser nå forhåndsvisning og eksporterer HTML. Regresjonstester beskytter eksporten.
- Money Planner: rettet manglende skjema-guard, navnekollisjon i v04 og mobiloverløp. Flere andre sider har fått mobilrettelser.
- Språkvelger vises på oversatte sider, overlapper ikke navigasjonen og omdirigerer ikke uvedkommende verktøy.
- Kostnadsfeltet er beholdt. Det viser ærlig «Ikke tilkoblet» når gyldige data mangler.

## Kontroll og avgrensning
112 HTML-sider er kontrollert statisk. Ingen manglende lokale referanser eller ugyldige ankre; 84 inline-skript syntakskontrollert. 91 offentlige sider ble åpnet på skrivebord og smal mobilbredde for strukturell kontroll. Berørte mobiloppsett ble kontrollert på nytt. Sju automatiske tester består. Alle åtte produksjonspatchene er kjørt i en separat kopi; også der består lenkekontrollen (1434 referanser). Eksisterende tilgangsregler er bevart.

HTTP-baseline omfattet 112 sider og 55 eksterne adresser. Beskyttede sider ga forventet 401. RME-lenken er oppdatert til NVE, og iPhone 17-spesifikasjonene peker direkte til Apple Support.

Dette er ikke en full ende-til-ende-test av alle tjenester. Innlogget administrasjon, ekte booking/varsling, OneDrive-filoperasjoner, AI-tjenester og kundedata er ikke endret eller testet med reelle innsendelser. Auth-callback og reset-sider ble ikke kjørt. Kostnadsintegrasjonen trenger fortsatt en fungerende datakilde. Spill merket under utvikling er fortsatt prototyper.

## Anbefalt neste arbeid
1. Koble kostnadsfeltet til reelle, daterte tall for IANS og SOGOD.
2. Gjennomfør innloggede tester med egne testkontoer for booking, tilgang og varsler.
3. Test OneDrive og AI-verktøy med ufarlige testdata før ordinær bruk.
4. Ta en separat innholds- og tilgjengelighetsgjennomgang av de største verktøyene; dagens kontroll garanterer ikke komplett tastatur-/skjermleserstøtte.
5. For SOGOD: planlegg egen rollebasert forespørselskø med ansvarlig, status, svarhistorikk og eskalering. Dette inngår ikke i IANS-endringene.
