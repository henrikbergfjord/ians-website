const { TableClient } = require('@azure/data-tables');
const { EmailClient } = require('@azure/communication-email');
const crypto = require('crypto');

const TABLE = 'IansContact';
const PARTITION = 'messages';
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function clean(v, max) { return String(v || '').trim().slice(0, max); }
function json(status, body) { return { status, headers: { 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store' }, body }; }
function escapeHtml(value) { return String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }

async function tryStore(entity, context) {
  const cs = process.env.IANS_BOOKING_STORAGE || process.env.AzureWebJobsStorage;
  if (!cs) {
    context.log.warn('IANS contact storage skipped: no storage connection string configured.');
    return false;
  }
  try {
    const client = TableClient.fromConnectionString(cs, TABLE);
    await client.createTable().catch(()=>{});
    await client.createEntity(entity);
    return true;
  } catch (e) {
    context.log.error('IANS contact storage failed:', e);
    return false;
  }
}

async function sendIansNotification(data, context, options) {
  const connectionString = process.env.COMMUNICATION_SERVICES_CONNECTION_STRING;
  const sender = process.env.ACADEMY_EMAIL_SENDER;
  const recipient = process.env.ACADEMY_EMAIL_RECIPIENT;
  if (!connectionString || !sender || !recipient) {
    context.log.warn('IANS email notification skipped: email environment variables are missing.');
    return false;
  }
  try {
    const client = new EmailClient(connectionString);
    const heading = options.heading;
    const label = options.label || 'Melding';
    const plainText = [heading,'',`Navn: ${data.name}`,`E-post: ${data.email}`,`Virksomhet / organisasjon: ${data.company || 'Ikke oppgitt'}`,'',`${label}:`,data.message,'',`Tidspunkt: ${data.createdAt}`,`Kilde: ${data.source || ''}`].join('\n');
    const html = `<h2>${escapeHtml(heading)}</h2><p><strong>Navn:</strong> ${escapeHtml(data.name)}<br><strong>E-post:</strong> ${escapeHtml(data.email)}<br><strong>Virksomhet / organisasjon:</strong> ${escapeHtml(data.company || 'Ikke oppgitt')}</p><p><strong>${escapeHtml(label)}:</strong></p><p>${escapeHtml(data.message).replace(/\n/g,'<br>')}</p><hr><p style="color:#666;font-size:12px">Tidspunkt: ${escapeHtml(data.createdAt)}<br>Kilde: ${escapeHtml(data.source || '')}</p>`;
    const poller = await client.beginSend({ senderAddress: sender, content: { subject: `${options.subjectPrefix} – ${data.name}`, plainText, html }, recipients: { to: [{ address: recipient, displayName:'Henrik Bergfjord' }] } });
    const result = await poller.pollUntilDone();
    context.log(`IANS email notification status: ${result.status || 'unknown'}`);
    return result.status === 'Succeeded';
  } catch (e) {
    context.log.error('IANS email notification failed:', e);
    return false;
  }
}

module.exports = async function (context, req) {
  try {
    const b = req.body || {};
    const name = clean(b.name,120), type = clean(b.type,20), company = clean(b.company,160), email = clean(b.email,254).toLowerCase(), subject = clean(b.subject,180), message = clean(b.message,5000), website = clean(b.website,200), source = clean(b.source,300);
    if (website) return context.res = json(200,{ok:true});
    if (name.length < 2 || !['privat','firma'].includes(type) || !emailRe.test(email) || subject.length < 3 || message.length < 10) return context.res = json(400,{ok:false,error:'Kontroller navn, type, e-post, emne og melding.'});
    if (type === 'firma' && company.length < 2) return context.res = json(400,{ok:false,error:'Skriv inn firmanavn.'});

    const now = new Date();
    const entity = { partitionKey:PARTITION,rowKey:`${now.toISOString()}-${crypto.randomUUID()}`,name,type,company,email,subject,message,createdAt:now.toISOString(),status:'new',source };
    const isAcademyRequest = subject === 'Tilgang til Henrik Academy' || source === '/academy/be-om-tilgang.html';
    const isAcademyContact = source === '/academy/kontakt.html';
    const isAxionRequest = subject === 'Tilgang til Axion Grid' || source === '/axion-grid/be-om-tilgang.html';

    const stored = await tryStore(entity, context);
    let emailed = false;
    if (isAcademyRequest) emailed = await sendIansNotification(entity, context, { heading:'Ny tilgangsforespørsel – Henrik Academy', subjectPrefix:'Ny tilgangsforespørsel – Henrik Academy', label:'Begrunnelse' });
    else if (isAcademyContact) emailed = await sendIansNotification(entity, context, { heading:'Ny kontaktmelding – Henrik Academy', subjectPrefix:'Ny Academy-melding', label:'Melding' });
    else if (isAxionRequest) emailed = await sendIansNotification(entity, context, { heading:'Ny tilgangsforespørsel – Axion Grid', subjectPrefix:'Ny Axion Grid-forespørsel', label:'Begrunnelse' });

    if (!stored && !emailed) {
      return context.res = json(503,{ok:false,error:'Forespørselen kunne ikke leveres akkurat nå. Systemet mangler en aktiv lagrings- eller e-postkanal.'});
    }

    const responseMessage = isAcademyRequest || isAxionRequest
      ? 'Tilgangsforespørselen er mottatt.'
      : isAcademyContact
        ? 'Takk. Meldingen er sendt til Henrik Academy.'
        : 'Takk. Henvendelsen er mottatt av IANS.';
    context.res = json(201,{ok:true,message:responseMessage,stored,emailed});
  } catch (e) {
    context.log.error(e);
    context.res = json(500,{ok:false,error:'Kunne ikke sende henvendelsen akkurat nå.'});
  }
};
