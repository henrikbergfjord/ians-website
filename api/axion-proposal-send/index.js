const { EmailClient } = require('@azure/communication-email');

function clean(v, max) { return String(v || '').trim().slice(0, max); }
function json(status, body) { return { status, headers: { 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store' }, body }; }
function escapeHtml(value) { return String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function principal(req) {
  try {
    const raw = req.headers['x-ms-client-principal'];
    if (!raw) return null;
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch { return null; }
}

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') return context.res = { status:204, headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS'} };
  try {
    const p = principal(req);
    const roles = Array.isArray(p && p.userRoles) ? p.userRoles.map(x=>String(x).toLowerCase()) : [];
    const allowed = ['axionreader','axionuser','axioncustomer','axionadmin','axionowner'].some(r=>roles.includes(r));
    if (!p || !allowed) return context.res = json(403,{ok:false,error:'Ingen tilgang til Axion Grid.'});

    const b = req.body || {};
    const scenario = clean(b.scenario,120), size = clean(b.size,180), connectivity = clean(b.connectivity,180), priorities = Array.isArray(b.priorities) ? b.priorities.map(x=>clean(x,100)).filter(Boolean).slice(0,12) : [], question = clean(b.question,5000), answer = clean(b.answer,18000);
    if (question.length < 5 || answer.length < 20) return context.res = json(400,{ok:false,error:'Løsningsforslaget mangler innhold.'});

    const connectionString = process.env.COMMUNICATION_SERVICES_CONNECTION_STRING;
    const sender = process.env.ACADEMY_EMAIL_SENDER || process.env.AXION_EMAIL_SENDER;
    const recipient = process.env.AXION_EMAIL_RECIPIENT || process.env.ACADEMY_EMAIL_RECIPIENT || 'henrik.bergfjord@outlook.com';
    if (!connectionString || !sender) return context.res = json(503,{ok:false,error:'E-postkanalen for Axion Grid er ikke konfigurert i Azure.'});

    const now = new Date().toISOString();
    const user = clean(p.userDetails || 'Microsoft-bruker',254);
    const subject = `Nytt Axion Grid løsningsforslag – ${scenario || 'AI Advisor'}`;
    const plainText = [
      'AXION GRID – AI ADVISOR','',
      `Innsendt av: ${user}`,`Tidspunkt: ${now}`,`Scenario: ${scenario || 'Ikke oppgitt'}`,`Størrelse / brukere: ${size || 'Ikke oppgitt'}`,`Dagens forbindelse: ${connectivity || 'Ikke oppgitt'}`,`Prioriteringer: ${priorities.join(', ') || 'Ingen valgt'}`,'',
      'SITUASJON / BEHOV',question,'','LØSNINGSFORSLAG',answer,'',
      'Dette er et foreløpig AI-generert løsningsforslag og bør kvalitetssikres før tilbud eller bestilling.'
    ].join('\n');
    const html = `<div style="font-family:Arial,sans-serif;color:#10202c;line-height:1.55"><h2>Axion Grid – AI Advisor</h2><p><strong>Innsendt av:</strong> ${escapeHtml(user)}<br><strong>Tidspunkt:</strong> ${escapeHtml(now)}<br><strong>Scenario:</strong> ${escapeHtml(scenario || 'Ikke oppgitt')}<br><strong>Størrelse / brukere:</strong> ${escapeHtml(size || 'Ikke oppgitt')}<br><strong>Dagens forbindelse:</strong> ${escapeHtml(connectivity || 'Ikke oppgitt')}<br><strong>Prioriteringer:</strong> ${escapeHtml(priorities.join(', ') || 'Ingen valgt')}</p><h3>Situasjon / behov</h3><p>${escapeHtml(question).replace(/\n/g,'<br>')}</p><h3>Løsningsforslag</h3><div style="white-space:pre-wrap">${escapeHtml(answer)}</div><hr><p style="color:#667;font-size:12px">Foreløpig AI-generert løsningsforslag. Kvalitetssikres før tilbud eller bestilling.</p></div>`;

    const client = new EmailClient(connectionString);
    const poller = await client.beginSend({ senderAddress: sender, content: { subject, plainText, html }, recipients: { to: [{ address: recipient, displayName:'Henrik Bergfjord' }] } });
    const result = await poller.pollUntilDone();
    if (result.status !== 'Succeeded') return context.res = json(502,{ok:false,error:'E-posttjenesten mottok forespørselen, men leveringen ble ikke bekreftet.'});
    context.res = json(200,{ok:true,message:'Løsningsforslaget er sendt til Axion Grid.',recipient});
  } catch (e) {
    context.log.error('Axion proposal send failed:', e);
    context.res = json(500,{ok:false,error:'Kunne ikke sende løsningsforslaget akkurat nå.'});
  }
};
