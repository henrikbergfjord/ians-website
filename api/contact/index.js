const { TableClient } = require('@azure/data-tables');
const { EmailClient } = require('@azure/communication-email');
const crypto = require('crypto');

const TABLE = 'IansContact';
const PARTITION = 'messages';
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function storageClient() {
  const cs = process.env.IANS_BOOKING_STORAGE || process.env.AzureWebJobsStorage;
  if (!cs) throw new Error('Storage is not configured');
  return TableClient.fromConnectionString(cs, TABLE);
}
function clean(v, max) { return String(v || '').trim().slice(0, max); }
function json(status, body) { return { status, headers: { 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store' }, body }; }
function escapeHtml(value) { return String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }

async function sendAcademyNotification(data, context, kind) {
  const connectionString = process.env.COMMUNICATION_SERVICES_CONNECTION_STRING;
  const sender = process.env.ACADEMY_EMAIL_SENDER;
  const recipient = process.env.ACADEMY_EMAIL_RECIPIENT;
  if (!connectionString || !sender || !recipient) {
    context.log.warn('Academy email notification skipped: email environment variables are missing.');
    return false;
  }
  const client = new EmailClient(connectionString);
  const isAccess = kind === 'access';
  const heading = isAccess ? 'Ny tilgangsforespørsel – Henrik Academy' : 'Ny kontaktmelding – Henrik Academy';
  const plainText = [heading,'',`Navn: ${data.name}`,`E-post: ${data.email}`,`Virksomhet / organisasjon: ${data.company || 'Ikke oppgitt'}`,'',isAccess ? 'Begrunnelse:' : 'Melding:',data.message,'',`Tidspunkt: ${data.createdAt}`,`Kilde: ${data.source || ''}`].join('\n');
  const html = `<h2>${escapeHtml(heading)}</h2><p><strong>Navn:</strong> ${escapeHtml(data.name)}<br><strong>E-post:</strong> ${escapeHtml(data.email)}<br><strong>Virksomhet / organisasjon:</strong> ${escapeHtml(data.company || 'Ikke oppgitt')}</p><p><strong>${isAccess ? 'Begrunnelse' : 'Melding'}:</strong></p><p>${escapeHtml(data.message).replace(/\n/g,'<br>')}</p><hr><p style="color:#666;font-size:12px">Tidspunkt: ${escapeHtml(data.createdAt)}<br>Kilde: ${escapeHtml(data.source || '')}</p>`;
  const poller = await client.beginSend({ senderAddress: sender, content: { subject: `${isAccess ? 'Ny tilgangsforespørsel' : 'Ny Academy-melding'} – ${data.name}`, plainText, html }, recipients: { to: [{ address: recipient, displayName:'Henrik Bergfjord' }] } });
  const result = await poller.pollUntilDone();
  context.log(`Academy email notification status: ${result.status || 'unknown'}`);
  return true;
}

module.exports = async function (context, req) {
  try {
    const b = req.body || {};
    const name = clean(b.name,120), type = clean(b.type,20), company = clean(b.company,160), email = clean(b.email,254).toLowerCase(), subject = clean(b.subject,180), message = clean(b.message,5000), website = clean(b.website,200), source = clean(b.source,300);
    if (website) return context.res = json(200,{ok:true});
    if (name.length < 2 || !['privat','firma'].includes(type) || !emailRe.test(email) || subject.length < 3 || message.length < 10) return context.res = json(400,{ok:false,error:'Kontroller navn, type, e-post, emne og melding.'});
    if (type === 'firma' && company.length < 2) return context.res = json(400,{ok:false,error:'Skriv inn firmanavn.'});

    const client = storageClient();
    await client.createTable().catch(()=>{});
    const now = new Date();
    const entity = { partitionKey:PARTITION,rowKey:`${now.toISOString()}-${crypto.randomUUID()}`,name,type,company,email,subject,message,createdAt:now.toISOString(),status:'new',source };
    await client.createEntity(entity);

    const isAcademyRequest = subject === 'Tilgang til Henrik Academy' || source === '/academy/be-om-tilgang.html';
    const isAcademyContact = source === '/academy/kontakt.html';
    if (isAcademyRequest || isAcademyContact) {
      try { await sendAcademyNotification(entity, context, isAcademyRequest ? 'access' : 'contact'); }
      catch (emailError) { context.log.error('Academy message was stored, but email notification failed:', emailError); }
    }

    context.res = json(201,{ok:true,message:isAcademyRequest?'Tilgangsforespørselen er mottatt.':isAcademyContact?'Takk. Meldingen er sendt til Henrik Academy.':'Takk. Henvendelsen er mottatt av IANS.'});
  } catch (e) {
    context.log.error(e);
    context.res = json(500,{ok:false,error:'Kunne ikke sende henvendelsen akkurat nå.'});
  }
};
