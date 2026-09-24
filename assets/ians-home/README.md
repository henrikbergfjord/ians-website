# Offentlige driftskostnader

costs.json publiseres offentlig. Ta bare med godkjente summer og forklaring av hva som er inkludert; aldri nøkler, fakturaer eller kundeopplysninger.

Når faktiske summer finnes: sett status til available, amountNok til et tall i NOK, periodStart/periodEnd til YYYY-MM-DD, updatedAt til ISO-tid med tidssone, includes til en ikke-tom liste med kostnadsomfang, og excludes til en liste med utelatelser. Data eldre enn 72 timer merkes som utdaterte. Behold unavailable og null frem til tallgrunnlaget er kontrollert.

Test: node --test checks/costs.test.mjs
