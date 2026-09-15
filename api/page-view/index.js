const { TableClient } = require('@azure/data-tables');
const crypto = require('crypto');

const TABLE = 'IansAnalytics';
const PARTITION = 'pageviews';

function json(status, body) {
  return {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}

function storageConnection() {
  return process.env.IANS_BOOKING_STORAGE ||
         process.env.AzureWebJobsStorage;
}

function client() {
  const cs = storageConnection();
  if (!cs) throw new Error('Storage is not configured');
  return TableClient.fromConnectionString(cs, TABLE);
}

function cleanPath(value) {
  let path = String(value || '')
    .trim()
    .split('?')[0]
    .split('#')[0];

  if (!path.startsWith('/')) return '';

  if (path === '/index.html') {
    path = '/';
  } else if (path.endsWith('/index.html')) {
    path = path.slice(0, -'index.html'.length);
  }

  if (path.length > 300) return '';

  const excluded = [
    /admin/i,
    /login/i,
    /tilgang/i,
    /registrer/i,
    /dashboard/i,
    /styre/i,
    /teknisk/i,
    /personvern/i,
    /old/i,
    /^\/api\//i,
    /^\/\.auth\//i
  ];

  if (excluded.some(rule => rule.test(path))) return '';

  return path;
}

function rowKeyFor(path) {
  return crypto
    .createHash('sha256')
    .update(path)
    .digest('hex')
    .slice(0, 40);
}

async function increment(tc, path) {
  const day = new Date().toISOString().slice(0, 10);
  const rowKey = `${day}-${rowKeyFor(path)}`;
  const now = new Date().toISOString();

  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const entity = await tc.getEntity(PARTITION, rowKey);

      entity.path = path;
      entity.views = Math.max(0, Number(entity.views || 0)) + 1;
      entity.lastSeen = now;

      await tc.updateEntity(entity, 'Replace', {
        etag: entity.etag
      });

      return;
    } catch (err) {
      if (err.statusCode === 404) {
        try {
          await tc.createEntity({
            partitionKey: PARTITION,
            rowKey,
            path,
            day,
            views: 1,
            firstSeen: now,
            lastSeen: now
          });
          return;
        } catch (createErr) {
          if (createErr.statusCode === 409) continue;
          throw createErr;
        }
      }

      if (err.statusCode === 409 || err.statusCode === 412) continue;

      throw err;
    }
  }

  throw new Error('Could not update page counter after retries');
}

module.exports = async function(context, req) {
  try {
    const path = cleanPath(req.body && req.body.path);

    if (!path) {
      context.res = json(400, {
        ok: false,
        error: 'Invalid page path'
      });
      return;
    }

    const tc = client();

    await tc.createTable().catch(err => {
      if (err.statusCode !== 409) throw err;
    });

    await increment(tc, path);

    context.res = {
      status: 204,
      headers: {
        'cache-control': 'no-store'
      }
    };
  } catch (err) {
    context.log.error('Page view analytics error:', err);

    context.res = json(500, {
      ok: false,
      error: 'Analytics unavailable'
    });
  }
};
