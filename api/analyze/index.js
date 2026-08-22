// Azure Static Web Apps API: /api/analyze
// IMPORTANT: OPENAI_API_KEY must be configured as an application setting in Azure.
// No name, email, address or free-text identity is expected by this endpoint.

module.exports = async function (context, req) {
  if (req.method !== "POST") {
    context.res = { status: 405, jsonBody: { error: "Method not allowed" } };
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    context.res = { status: 503, jsonBody: { error: "AI is not configured. Set OPENAI_API_KEY in Azure application settings." } };
    return;
  }

  const data = req.body || {};
  const allowed = {
    goal: data.goal,
    household: data.household,
    housing: data.housing,
    income: num(data.income),
    totalExpense: num(data.totalExpense),
    margin: num(data.margin),
    annualReserve: num(data.annualReserve),
    savingsRate: num(data.savingsRate),
    buffer: num(data.buffer),
    bufferCoverage: num(data.bufferCoverage),
    debt: {
      mortgage: num(data.debt?.mortgage),
      mortgageRate: num(data.debt?.mortgageRate),
      carLoan: num(data.debt?.carLoan),
      carLoanRate: num(data.debt?.carLoanRate),
      consumer: num(data.debt?.consumer),
      consumerRate: num(data.debt?.consumerRate)
    },
    ltv: num(data.ltv),
    debtIncome: num(data.debtIncome),
    monthlySaving: num(data.monthlySaving),
    returnRate: num(data.returnRate)
  };

  const system = `Du er forklaringslaget i et norsk personlig økonomiverktøy.
Matematikk og nøkkeltall er allerede beregnet av programmet; ikke overstyr dem.
Skriv på klart, varmt og nøkternt norsk. Ikke moraliser.
Gi 1) kort situasjonsbilde, 2) tre prioriterte forbedringsområder, 3) en konkret 90-dagers plan,
4) ett motiverende langsiktig perspektiv.
Vær tydelig på usikkerhet. Ikke gi individuelle investeringsvalg, skatte- eller juridiske råd.
Ikke påstå at brukeren får et bestemt banktilbud. Ved lån: anbefal sammenligning og forhandling.
Hold svaret under 550 ord.`;

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
        instructions: system,
        input: `Analyser disse anonymiserte nøkkeltallene:\n${JSON.stringify(allowed, null, 2)}`
      })
    });

    const body = await r.json();
    if (!r.ok) {
      context.log.error("OpenAI error", r.status, body?.error?.message);
      context.res = { status: 502, jsonBody: { error: "AI request failed." } };
      return;
    }

    const analysis = extractOutputText(body);
    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      jsonBody: { analysis }
    };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, jsonBody: { error: "AI service unavailable." } };
  }
};

function num(v){ const x=Number(v); return Number.isFinite(x)?x:0; }
function extractOutputText(body){
  if (typeof body.output_text === "string") return body.output_text;
  const parts=[];
  for (const item of body.output || []) {
    for (const c of item.content || []) {
      if (c.type === "output_text" && c.text) parts.push(c.text);
    }
  }
  return parts.join("\n").trim() || "Ingen tekst mottatt fra modellen.";
}