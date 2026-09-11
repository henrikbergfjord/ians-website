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

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function readPrincipal(req) {
  try {
    const raw = req.headers['x-ms-client-principal'];
    if (!raw) return null;
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function isAdmin(principal) {
  const roles = (principal?.userRoles || []).map(r => String(r).toLowerCase());
  return roles.includes('iansadmin') || roles.includes('axionadmin') || roles.includes('axionowner');
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
  if (!r.ok || !data.access_token) throw new Error(`Azure authentication failed (${r.status})`);
  return data.access_token;
}

async function costQuery(token, subscriptionId, payload, attempt = 0) {
  const url = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.CostManagement/query?api-version=2026-06-01`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (r.status === 204) return { columns: [], rows: [] };
  const data = await r.json().catch(() => ({}));
  if ((r.status === 429 || r.status >= 500) && attempt < 2) {
    const retryAfter = Math.max(1, Math.min(8, Number(r.headers.get('retry-after')) || (attempt + 1) * 2));
    await sleep(retryAfter * 1000);
    return costQuery(token, subscriptionId, payload, attempt + 1);
  }
  if (!r.ok) {
    const error = new Error(data?.error?.message || data?.error?.code || `Azure Cost Management returned ${r.status}`);
    error.status = r.status;
    throw error;
  }
  return data?.properties || { columns: [], rows: [] };
}

function rowsAsObjects(properties) {
  const names = (properties.columns || []).map(c => c.name);
  return (properties.rows || []).map(row => Object.fromEntries(names.map((name, i) => [name, row[i]])));
}

function totalFrom(properties) {
  const rows = rowsAsObjects(properties);
  const first = rows[0] || {};
  return {
    cost: num(first.PreTaxCost ?? first.Cost ?? first.totalCost ?? properties.rows?.[0]?.[0]),
    currency: String(first.Currency ?? properties.rows?.[0]?.[1] ?? 'NOK')
  };
}

async function optionalQuery(context, label, fn, fallback) {
  try { return await fn(); }
  catch (err) {
    context.log.warn(`azure-cost optional query failed: ${label}: ${err.message}`);
    return fallback;
  }
}

module.exports = async function (context, req) {
  try {
    const principal = readPrincipal(req);
    if (!principal) return context.res = json(401, { error: 'Microsoft sign-in required.' });
    if (!isAdmin(principal)) return context.res = json(403, { error: 'Administrator role required.' });

    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
    if (![tenantId, clientId, clientSecret, subscriptionId].every(Boolean)) {
      return context.res = json(503, { error: 'Azure cost integration is not configured.', missingConfiguration: true });
    }

    const token = await getToken(tenantId, clientId, clientSecret);
    const aggregation = { totalCost: { name: 'PreTaxCost', function: 'Sum' } };

    // Mandatory foundation: the same simple MonthToDate query already verified against Azure.
    const mtdProps = await costQuery(token, subscriptionId, {
      type: 'Usage', timeframe: 'MonthToDate',
      dataset: { granularity: 'None', aggregation }
    });
    const mtd = totalFrom(mtdProps);

    const previousProps = await optionalQuery(context, 'previous-month', () => costQuery(token, subscriptionId, {
      type: 'Usage', timeframe: 'TheLastMonth',
      dataset: { granularity: 'None', aggregation }
    }), { columns: [], rows: [] });
    const previous = totalFrom(previousProps);

    const dailyProps = await optionalQuery(context, 'daily', () => costQuery(token, subscriptionId, {
      type: 'Usage', timeframe: 'MonthToDate',
      dataset: { granularity: 'Daily', aggregation }
    }), { columns: [], rows: [] });

    const serviceProps = await optionalQuery(context, 'services', () => costQuery(token, subscriptionId, {
      type: 'Usage', timeframe: 'MonthToDate',
      dataset: { granularity: 'None', aggregation, grouping: [{ type: 'Dimension', name: 'ServiceName' }] }
    }), { columns: [], rows: [] });

    const daily = rowsAsObjects(dailyProps).map(r => {
      const rawDate = String(r.UsageDate ?? r.Date ?? '');
      const date = /^\d{8}$/.test(rawDate)
        ? `${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}`
        : rawDate.slice(0,10);
      return { date, cost: num(r.PreTaxCost ?? r.Cost ?? r.totalCost), currency: r.Currency || mtd.currency };
    }).filter(x => x.date);

    const services = rowsAsObjects(serviceProps).map(r => ({
      name: String(r.ServiceName || r.Service || 'Other'),
      cost: num(r.PreTaxCost ?? r.Cost ?? r.totalCost),
      currency: r.Currency || mtd.currency
    })).sort((a,b) => b.cost - a.cost);

    const now = new Date();
    const elapsedDays = Math.max(1, now.getUTCDate());
    const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
    const projected = mtd.cost / elapsedDays * daysInMonth;
    const budget = num(process.env.AZURE_COST_BUDGET || 0);

    context.res = json(200, {
      generatedAt: new Date().toISOString(),
      admin: principal.userDetails || null,
      subscription: { idSuffix: subscriptionId.slice(-6) },
      currency: mtd.currency || previous.currency || 'NOK',
      monthToDate: mtd.cost,
      projectedMonthEnd: projected,
      previousMonth: previous.cost,
      budget: budget > 0 ? budget : null,
      budgetUsedPercent: budget > 0 ? (mtd.cost / budget) * 100 : null,
      daily,
      services,
      note: 'Azure Cost Management data can be delayed compared with real-time resource usage.'
    });
  } catch (err) {
    context.log.error('azure-cost', err);
    context.res = json(502, { error: 'Could not retrieve Azure cost data.', diagnostic: err.message });
  }
};
