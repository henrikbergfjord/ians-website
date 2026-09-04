module.exports = async function (context, req) {
  const origin = req.headers?.origin || '';
  const allowedOrigins = new Set([
    'https://zealous-pond-02b149c10.7.azurestaticapps.net',
    'https://axion-grid.admhenber.chatgpt.site'
  ]);
  const allowOrigin = allowedOrigins.has(origin) ? origin : 'https://zealous-pond-02b149c10.7.azurestaticapps.net';
  const cors = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8'
  };

  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: cors, body: '' };
    return;
  }
  if (req.method !== 'POST') {
    context.res = { status: 405, headers: cors, jsonBody: { error: 'Method not allowed' } };
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    context.res = { status: 503, headers: cors, jsonBody: { error: 'AI is not configured.' } };
    return;
  }

  const body = req.body || {};
  const question = String(body.question || '').trim().slice(0, 2200);
  const scenario = String(body.scenario || 'generell').trim().slice(0, 120);
  const contextData = {
    locationType: String(body.locationType || '').slice(0, 100),
    connectivity: String(body.connectivity || '').slice(0, 120),
    priorities: Array.isArray(body.priorities) ? body.priorities.slice(0, 8).map(v => String(v).slice(0, 80)) : [],
    size: String(body.size || '').slice(0, 80)
  };

  if (!question) {
    context.res = { status: 400, headers: cors, jsonBody: { error: 'Mangler spørsmål.' } };
    return;
  }

  const system = `Du er AXION AI Advisor, et teknisk forklarings- og planleggingslag for norsk digital infrastruktur.
Kunden skal kunne skrive fritt med egne ord om situasjonen, problemet, dagens løsning og ønsket resultat. Bruk dette sammen med valgte felt til å lage et konkret første løsningsforslag.
AXION GRID tenker helhet: internett/WAN, firewall/gateway, switching/PoE, Wi-Fi, kamera, adgang, sensorer/IoT, backupforbindelse, UPS, overvåkning, dokumentasjon og fjernstyring.
Forklar verdien av én leverandør og ett driftsansvar når det er relevant: bedre feilisolering, dokumentasjon, forebyggende overvåkning, raskere respons og mindre leverandørkoordinering.
Ved fjernlokasjoner: fiber er normalt førstevalg. 4G/5G kan være godt når dekningen er stabil. Starlink kan være et praktisk alternativ eller reserve der kablet nett/mobildekning er svak. Ikke lov bestemt kapasitet eller pris uten ferske data.
UniFi/Ubiquiti kan brukes som konkret eksempel, men ikke lås løsningen til ett fabrikat. En UDM-SE kan være et eksempel på kompakt gateway/controller for mindre lokasjoner; større installasjoner bør skaleres med separate PoE-switcher/NVR etter behov.
Kameraanalyse kan brukes til person/kjøretøy/hendelsesdeteksjon og støtte alarmverifikasjon. Røykdeteksjon i kamera er et supplement, ikke en erstatning for et forskriftsmessig/godkjent brannalarmanlegg. Ikke påstå direkte tilkobling til brannvesen uten at lokale krav, godkjent alarmoverføring og avtale er avklart.
Skill tydelig mellom overvåkning for drift og sikkerhets-/alarmtjenester. Ikke gi råd som om du har inspisert lokasjonen.
Svar på norsk, konkret og profesjonelt. Bruk nøyaktig disse overskriftene i denne rekkefølgen:
SITUASJON
ANBEFALT LØSNING
FORSLAG TIL PLAN
SLIK KAN AXION HJELPE
VIKTIGE AVKLARINGER
NESTE STEG
Under FORSLAG TIL PLAN skal du gi 4–6 nummererte trinn fra kartlegging til ferdig dokumentert drift.
Under SLIK KAN AXION HJELPE skal du konkret beskrive hvordan AXION GRID kan bistå, for eksempel kartlegging, befaring, løsningsdesign, produktvalg, installasjonsplan, dokumentasjon, test, overvåkning og videre drift — men uten å love tjenester som ikke er avklart.
Avslutt NESTE STEG med en lavterskel anbefaling om en kort teknisk gjennomgang før endelig arkitektur og pris fastsettes.
Maks 650 ord.`;

  const input = `Scenario: ${scenario}\nKontekst: ${JSON.stringify(contextData)}\nKundens fritekst: ${question}`;

  try {
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
        instructions: system,
        input
      })
    });
    const data = await r.json();
    if (!r.ok) {
      context.log.error('OpenAI error', r.status, data?.error?.message);
      context.res = { status: 502, headers: cors, jsonBody: { error: 'AI request failed.' } };
      return;
    }
    const answer = extractOutputText(data);
    context.res = { status: 200, headers: cors, jsonBody: { answer } };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, headers: cors, jsonBody: { error: 'AI service unavailable.' } };
  }
};

function extractOutputText(body) {
  if (typeof body.output_text === 'string') return body.output_text;
  const parts = [];
  for (const item of body.output || []) {
    for (const c of item.content || []) {
      if (c.type === 'output_text' && c.text) parts.push(c.text);
    }
  }
  return parts.join('\n').trim() || 'Ingen tekst mottatt fra modellen.';
}
