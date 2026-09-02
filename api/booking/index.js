const { TableClient } = require('@azure/data-tables');
const crypto = require('crypto');

const TABLE = 'IansBooking';
const PARTITION = 'sprinkler2028';
const WINDOWS = ['08:00–10:00','10:00–12:00','12:00–14:00','14:00–16:00'];
const CAPACITY = 24;
const FALLBACK_ADMIN_HASH = '14a33ff207ae4416deb502f56950b4ca6eed48276b8242925911bbea879c53d0';

function json(status, body) {
  return { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, body: JSON.stringify(body) };
}

function storageConnection() {
  return process.env.IANS_BOOKING_STORAGE || process.env.AzureWebJobsStorage;
}

function client() {
  const cs = storageConnection();
  if (!cs) throw new Error('Mangler lagringstilkobling. Sett IANS_BOOKING_STORAGE i Azure Static Web App Configuration.');
  return TableClient.fromConnectionString(cs, TABLE);
}

function cleanPhone(value) {
  return String(value || '').replace(/[^0-9+]/g, '').slice(0, 16);
}

function cleanUnit(value) {
  return String(value || '').trim().replace(/[\\/#?\u0000-\u001f\u007f]/g, '-').replace(/[^A-Za-z0-9 ._\-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

async function allEntities(tc) {
  const out = [];
  for await (const e of tc.listEntities({ queryOptions: { filter: `PartitionKey eq '${PARTITION}'` } })) out.push(e);
  return out;
}

function summary(rows) {
  const counts = Object.fromEntries(WINDOWS.map(w => [w, 0]));
  for (const r of rows) if (counts[r.window] !== undefined) counts[r.window]++;
  return {
    capacity: CAPACITY,
    totalBooked: rows.length,
    windows: WINDOWS.map(window => ({ window, booked: counts[window], available: Math.max(0, CAPACITY - counts[window]) }))
  };
}

function adminAllowed(req) {
  const supplied = req.headers['x-admin-key'] || req.headers['X-Admin-Key'];
  if (typeof supplied !== 'string' || supplied.length < 12) return false;
  const configured = process.env.IANS_BOOKING_ADMIN_KEY;
  if (configured) {
    const a = Buffer.from(supplied);
    const b = Buffer.from(configured);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  const suppliedHash = crypto.createHash('sha256').update(supplied).digest('hex');
  const a = Buffer.from(suppliedHash, 'hex');
  const b = Buffer.from(FALLBACK_ADMIN_HASH, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = async function (context, req) {
  try {
    if (req.method === 'GET' && String(req.query.health || '') === '1') {
      const hasDedicatedStorage = !!process.env.IANS_BOOKING_STORAGE;
      const hasHostStorage = !!process.env.AzureWebJobsStorage;
      context.res = json(200, {
        ok: true,
        service: 'IANS Booking API',
        functionRuntime: process.env.FUNCTIONS_WORKER_RUNTIME || 'node',
        storageConfigured: hasDedicatedStorage || hasHostStorage,
        storageSource: hasDedicatedStorage ? 'IANS_BOOKING_STORAGE' : (hasHostStorage ? 'AzureWebJobsStorage' : 'none')
      });
      return;
    }

    const tc = client();
    await tc.createTable().catch(err => {
      if (err.statusCode !== 409) throw err;
    });

    if (req.method === 'GET') {
      const rows = await allEntities(tc);
      if (String(req.query.admin || '') === '1') {
        if (!adminAllowed(req)) {
          context.res = json(401, { ok: false, error: 'Ugyldig administratornøkkel.' });
          return;
        }
        const bookings = rows
          .map(r => ({ unit: r.rowKey, phone: r.phone || '', window: r.window || '', updatedAt: r.updatedAt || '', createdAt: r.createdAt || '' }))
          .sort((a,b) => a.window.localeCompare(b.window) || a.unit.localeCompare(b.unit, 'no', { numeric: true }));
        context.res = json(200, { ok: true, ...summary(rows), bookings });
        return;
      }
      context.res = json(200, { ok: true, ...summary(rows) });
      return;
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const unit = cleanUnit(body.unit);
      const phone = cleanPhone(body.phone);
      const window = String(body.window || '').trim();
      if (!unit || !phone || !WINDOWS.includes(window)) {
        context.res = json(400, { ok: false, error: 'Velg leilighet, skriv inn telefonnummer og velg et gyldig tidsvindu.' });
        return;
      }
      if (!/^\+?\d{8,15}$/.test(phone)) {
        context.res = json(400, { ok: false, error: 'Telefonnummeret ser ikke gyldig ut.' });
        return;
      }

      const rows = await allEntities(tc);
      const current = rows.find(r => r.rowKey === unit);
      const targetCount = rows.filter(r => r.window === window && r.rowKey !== unit).length;
      if (targetCount >= CAPACITY) {
        context.res = json(409, { ok: false, error: 'Dette tidsvinduet ble nettopp fullt. Velg et annet tidsvindu.', summary: summary(rows) });
        return;
      }

      const now = new Date().toISOString();
      await tc.upsertEntity({
        partitionKey: PARTITION,
        rowKey: unit,
        phone,
        window,
        createdAt: current?.createdAt || now,
        updatedAt: now
      }, 'Replace');

      const after = await allEntities(tc);
      context.res = json(current ? 200 : 201, {
        ok: true,
        updated: !!current,
        message: current ? 'Bestillingen er oppdatert.' : 'Leiligheten er booket.',
        booking: { unit, window },
        summary: summary(after)
      });
      return;
    }

    if (req.method === 'DELETE') {
      if (!adminAllowed(req)) {
        context.res = json(401, { ok: false, error: 'Ugyldig administratornøkkel.' });
        return;
      }
      const unit = cleanUnit((req.body || {}).unit || req.query.unit);
      if (!unit) {
        context.res = json(400, { ok: false, error: 'Mangler leilighet.' });
        return;
      }
      await tc.deleteEntity(PARTITION, unit).catch(err => {
        if (err.statusCode !== 404) throw err;
      });
      context.res = json(200, { ok: true, message: 'Bestillingen er slettet.' });
      return;
    }

    context.res = json(405, { ok: false, error: 'Metoden støttes ikke.' });
  } catch (err) {
    context.log.error(err);
    context.res = json(500, { ok: false, error: 'Bookingserveren er ikke klar.' });
  }
};
