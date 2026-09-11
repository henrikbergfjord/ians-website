const crypto = require('crypto');

function json(status, body) {
  return {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0'
    },
    body: JSON.stringify(body)
  };
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function isoDateTime(d) {
  return d.toISOString();
}

function startOfUtcMonth(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function addUtcMonths(d, n) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

function daysInUtcMonth(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

async function getToken(tenantId, clientId, clientSecret) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://management.azure.com/.default',
    grant_type: 'client_credentials'
  });

  const r = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.access_token) throw new Error('Azure authentication failed');
  return data.access_token;
}

async function costQuery(token, subscriptionId, payload) {
  const scope = `/subscriptions/${subscriptionId}`;
  const url = `https://management.azure.com${scope}/providers/Microsoft.CostManagement/query?api-version=2026-06-01`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error?.message || data?.error?.code || `Azure Cost Management returned ${r.status}`;
    throw new Error(msg);
  }
  return data?.properties || {};
}

function rowsAsObjects(properties) {
  const names = (properties.columns || []).map(c => c.name);
  return (properties.rows || []).map(row => Object.fromEntries(names.map((name, i) => [name, row[i]])));
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

module.exports = async function (context, req) {
  try {
    const adminKey = process.env.IANS_ADMIN_KEY;
    if (!adminKey) return context.res = json(503, { error: 'IANS admin access is not configured.' });
    if (!safeEqual(req.headers['x-admin-key'], adminKey)) return context.res = json(401, { error: 'Unauthorized.' });

    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
    if (![tenantId, clientId, clientSecret, subscriptionId].every(Boolean)) {
      return context.res = json(503, {
        error: 'Azure cost integration is not configured.',
        missingConfiguration: true
      });
    }

    const now = new Date();
    const thisStart = startOfUtcMonth(now);
    const nextStart = addUtcMonths(thisStart, 1);
    const prevStart = addUtcMonths(thisStart, -1);
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const queryTo = new Date(Math.min(Date.now(), nextStart.getTime() - 1000));

    const token = await getToken(tenantId, clientId, clientSecret);
    const baseAggregation = { totalCost: { name: 'PreTaxCost', function: 'Sum' } };

    const dailyProps = await costQuery(token, subscriptionId, {
      type: 'Usage',
      timeframe: 'Custom',
      timePeriod: { from: isoDateTime(prevStart), to: isoDateTime(queryTo) },
      dataset: { granularity: 'Daily', aggregation: baseAggregation }
    });

    const serviceProps = await costQuery(token, subscriptionId, {
      type: 'Usage',
      timeframe: 'Custom',
      timePeriod: { from: isoDateTime(thisStart), to: isoDateTime(queryTo) },
      dataset: {
        granularity: 'None',
        aggregation: baseAggregation,
        grouping: [{ type: 'Dimension', name: 'ServiceName' }]
      }
    });

    const dailyRows = rowsAsObjects(dailyProps).map(r => {
      const rawDate = String(r.UsageDate ?? r.Date ?? '');
      const date = /^\d{8}$/.test(rawDate)
        ? `${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}`
        : rawDate.slice(0,10);
      return {
        date,
        cost: num(r.PreTaxCost ?? r.Cost ?? r.totalCost),
        currency: r.Currency || ''
      };
    }).filter(x => x.date);

    const thisPrefix = isoDate(thisStart).slice(0, 7);
    const prevPrefix = isoDate(prevStart).slice(0, 7);
    const currentDaily = dailyRows.filter(x => x.date.startsWith(thisPrefix));
    const previousDaily = dailyRows.filter(x => x.date.startsWith(prevPrefix));
    const monthToDate = currentDaily.reduce((s, x) => s + x.cost, 0);
    const previousMonth = previousDaily.reduce((s, x) => s + x.cost, 0);

    const elapsedDays = Math.max(1, today.getUTCDate());
    const projected = monthToDate / elapsedDays * daysInUtcMonth(now);
    const currency = currentDaily.find(x => x.currency)?.currency || previousDaily.find(x => x.currency)?.currency || 'NOK';
    const budget = num(process.env.AZURE_COST_BUDGET || 0);

    const services = rowsAsObjects(serviceProps).map(r => ({
      name: String(r.ServiceName || r.Service || 'Other'),
      cost: num(r.PreTaxCost ?? r.Cost ?? r.totalCost),
      currency: r.Currency || currency
    })).sort((a, b) => b.cost - a.cost);

    context.res = json(200, {
      generatedAt: new Date().toISOString(),
      subscription: { idSuffix: subscriptionId.slice(-6) },
      currency,
      monthToDate,
      projectedMonthEnd: projected,
      previousMonth,
      budget: budget > 0 ? budget : null,
      budgetUsedPercent: budget > 0 ? (monthToDate / budget) * 100 : null,
      daily: currentDaily,
      services,
      note: 'Azure Cost Management data can be delayed compared with real-time resource usage.'
    });
  } catch (err) {
    context.log.error('azure-cost', err);
    context.res = json(502, { error: 'Could not retrieve Azure cost data.' });
  }
};
