const { TableClient } = require('@azure/data-tables');

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

function areaFor(path) {
  if (path === '/') return 'IANS.no';
  if (path.startsWith('/academy/kids/roblox')) return 'Roblox Academy';
  if (path.startsWith('/academy/kids')) return 'Academy Kids';
  if (path.startsWith('/academy')) return 'Academy';
  if (path.startsWith('/games')) return 'Games';
  if (path.startsWith('/tools/money-planner')) return 'Money Planner';
  if (path.startsWith('/tools/')) return 'Tools';
  if (/sameie/i.test(path)) return 'SameieNett';
  return 'Andre sider';
}

module.exports = async function(context) {
  try {
    const cs = storageConnection();
    if (!cs) throw new Error('Storage is not configured');

    const tc = TableClient.fromConnectionString(cs, TABLE);

    const rows = [];

    for await (const entity of tc.listEntities({
      queryOptions: {
        filter: `PartitionKey eq '${PARTITION}'`
      }
    })) {
      rows.push({
        path: String(entity.path || ''),
        day: String(entity.day || ''),
        views: Number(entity.views || 0)
      });
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    function isoDaysAgo(days) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - days);
      return d.toISOString().slice(0, 10);
    }

    const from7 = isoDaysAgo(6);
    const from30 = isoDaysAgo(29);

    const totals = {
      today: 0,
      days7: 0,
      days30: 0,
      all: 0
    };

    const pages = new Map();
    const areas = new Map();

    for (const row of rows) {
      const v = row.views;

      totals.all += v;
      if (row.day === today) totals.today += v;
      if (row.day >= from7) totals.days7 += v;
      if (row.day >= from30) totals.days30 += v;

      if (!pages.has(row.path)) {
        pages.set(row.path, {
          path: row.path,
          area: areaFor(row.path),
          today: 0,
          days7: 0,
          days30: 0,
          all: 0
        });
      }

      const p = pages.get(row.path);
      p.all += v;
      if (row.day === today) p.today += v;
      if (row.day >= from7) p.days7 += v;
      if (row.day >= from30) p.days30 += v;

      const area = areaFor(row.path);

      if (!areas.has(area)) {
        areas.set(area, {
          area,
          today: 0,
          days7: 0,
          days30: 0,
          all: 0
        });
      }

      const a = areas.get(area);
      a.all += v;
      if (row.day === today) a.today += v;
      if (row.day >= from7) a.days7 += v;
      if (row.day >= from30) a.days30 += v;
    }

    context.res = json(200, {
      ok: true,
      generatedAt: now.toISOString(),
      totals,
      areas: [...areas.values()].sort((a, b) => b.days30 - a.days30),
      pages: [...pages.values()].sort((a, b) => b.days30 - a.days30)
    });

  } catch (err) {
    context.log.error('Analytics stats error:', err);

    context.res = json(500, {
      ok: false,
      error: 'Analytics unavailable'
    });
  }
};
