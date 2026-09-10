const { TableClient } = require('@azure/data-tables');
const { EmailClient } = require('@azure/communication-email');
const crypto = require('crypto');

const TABLE = 'IansContact';
const PARTITION = 'messages';
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function storageClient() {
  const cs =
    process.env.IANS_BOOKING_STORAGE ||
    process.env.AzureWebJobsStorage;

  if (!cs) throw new Error('Storage is not configured');

  return TableClient.fromConnectionString(cs, TABLE);
}

function clean(v, max) {
  return String(v || '').trim().slice(0, max);
}

function json(status, body) {
  return {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body
  };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function sendAcademyNotification(data, context) {
  const connectionString =
    process.env.COMMUNICATION_SERVICES_CONNECTION_STRING;

  const sender =
    process.env.ACADEMY_EMAIL_SENDER;

  const recipient =
    process.env.ACADEMY_EMAIL_RECIPIENT;

  if (!connectionString || !sender || !recipient) {
    context.log.warn(
      'Academy email notification skipped: email environment variables are missing.'
    );
    return false;
  }

  const client = new EmailClient(connectionString);

  const plainText = [
    'Ny tilgangsforespørsel – Henrik Academy',
    '',
    `Navn: ${data.name}`,
    `E-post: ${data.email}`,
    `Virksomhet / organisasjon: ${data.company || 'Ikke oppgitt'}`,
    '',
    'Begrunnelse:',
    data.message,
    '',
    `Tidspunkt: ${data.createdAt}`,
    `Kilde: ${data.source || '/academy/be-om-tilgang.html'}`
  ].join('\n');

  const html = `
    <h2>Ny tilgangsforespørsel – Henrik Academy</h2>

    <p>
      <strong>Navn:</strong> ${escapeHtml(data.name)}<br>
      <strong>E-post:</strong> ${escapeHtml(data.email)}<br>
      <strong>Virksomhet / organisasjon:</strong>
      ${escapeHtml(data.company || 'Ikke oppgitt')}
    </p>

    <p><strong>Begrunnelse:</strong></p>
    <p>${escapeHtml(data.message).replace(/\n/g, '<br>')}</p>

    <hr>

    <p style="color:#666;font-size:12px">
      Tidspunkt: ${escapeHtml(data.createdAt)}<br>
      Kilde: ${escapeHtml(data.source || '/academy/be-om-tilgang.html')}
    </p>
  `;

  const message = {
    senderAddress: sender,
    content: {
      subject: `Ny tilgangsforespørsel – ${data.name}`,
      plainText,
      html
    },
    recipients: {
      to: [
        {
          address: recipient,
          displayName: 'Henrik Bergfjord'
        }
      ]
    }
  };

  const poller = await client.beginSend(message);
  const result = await poller.pollUntilDone();

  context.log(
    `Academy email notification status: ${result.status || 'unknown'}`
  );

  return true;
}

module.exports = async function (context, req) {
  try {
    const b = req.body || {};

    const name = clean(b.name, 120);
    const type = clean(b.type, 20);
    const company = clean(b.company, 160);
    const email = clean(b.email, 254).toLowerCase();
    const subject = clean(b.subject, 180);
    const message = clean(b.message, 5000);
    const website = clean(b.website, 200);
    const source = clean(b.source, 300);

    // Honeypot
    if (website) {
      return context.res = json(200, { ok: true });
    }

    if (
      name.length < 2 ||
      !['privat', 'firma'].includes(type) ||
      !emailRe.test(email) ||
      subject.length < 3 ||
      message.length < 10
    ) {
      return context.res = json(400, {
        ok: false,
        error: 'Kontroller navn, type, e-post, emne og melding.'
      });
    }

    if (type === 'firma' && company.length < 2) {
      return context.res = json(400, {
        ok: false,
        error: 'Skriv inn firmanavn.'
      });
    }

    const client = storageClient();
    await client.createTable().catch(() => {});

    const now = new Date();

    const entity = {
      partitionKey: PARTITION,
      rowKey: `${now.toISOString()}-${crypto.randomUUID()}`,
      name,
      type,
      company,
      email,
      subject,
      message,
      createdAt: now.toISOString(),
      status: 'new',
      source
    };

    // Forespørselen lagres først.
    await client.createEntity(entity);

    const isAcademyRequest =
      subject === 'Tilgang til Henrik Academy' ||
      source === '/academy/be-om-tilgang.html';

    // E-postfeil skal aldri føre til at en allerede lagret
    // tilgangsforespørsel rapporteres som mislykket.
    if (isAcademyRequest) {
      try {
        await sendAcademyNotification(entity, context);
      } catch (emailError) {
        context.log.error(
          'Academy request was stored, but email notification failed:',
          emailError
        );
      }
    }

    context.res = json(201, {
      ok: true,
      message: isAcademyRequest
        ? 'Tilgangsforespørselen er mottatt.'
        : 'Takk. Henvendelsen er mottatt av IANS.'
    });

  } catch (e) {
    context.log.error(e);

    context.res = json(500, {
      ok: false,
      error: 'Kunne ikke sende henvendelsen akkurat nå.'
    });
  }
};
