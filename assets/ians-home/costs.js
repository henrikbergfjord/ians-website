// Public aggregate only. Never put subscription IDs, resource names or credentials here.
export function parseCosts(data, now = new Date()) {
  if (data?.status !== 'available') return null;
  const dateOnly = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
  const validAmount = value => Number.isFinite(value) && value >= 0;
  if (data.currency !== 'NOK' || !validAmount(data.azureTotalNok) || !data.staticWebApps || !validAmount(data.staticWebApps.iansNok) || !validAmount(data.staticWebApps.sogodNok)) return null;
  if (Math.round(data.azureTotalNok * 100) < Math.round((data.staticWebApps.iansNok + data.staticWebApps.sogodNok) * 100)) return null;
  if (!dateOnly(data.periodStart) || !dateOnly(data.periodEnd) || data.periodEnd < data.periodStart) return null;
  if (typeof data.updatedAt !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(data.updatedAt) || !Number.isFinite(Date.parse(data.updatedAt))) return null;
  const updated = new Date(data.updatedAt);
  if (updated > now || data.periodEnd > updated.toISOString().slice(0,10)) return null;
  if (!Array.isArray(data.includes) || data.includes.length === 0 || !data.includes.every(v => typeof v === 'string' && v.trim()) || !Array.isArray(data.excludes) || !data.excludes.every(v => typeof v === 'string' && v.trim())) return null;
  return {...data, stale: now - updated > 72 * 60 * 60 * 1000};
}
export function renderCosts(data, root = document) {
  const value = parseCosts(data);
  if (!value) return;
  const isEnglish=root.documentElement?.lang==='en';
  const locale=isEnglish?'en-GB':'nb-NO';
  const date = day => new Intl.DateTimeFormat(locale, {day:'numeric',month:'short',timeZone:'Europe/Oslo'}).format(new Date(day));
  const money = amount => new Intl.NumberFormat(locale,{style:'currency',currency:value.currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(amount);
  root.querySelector('#cost-amount').textContent = money(value.azureTotalNok);
  root.querySelector('#cost-period').hidden = false;
  root.querySelector('#cost-period').textContent = `${date(value.periodStart)}–${date(value.periodEnd)}${value.stale?(isEnglish?' · Older reading':' · Eldre måling'):''}`;
  root.querySelector('#cost-ians').textContent = money(value.staticWebApps.iansNok);
  root.querySelector('#cost-sogod').textContent = money(value.staticWebApps.sogodNok);
  root.querySelector('#cost-azure-total').textContent = money(value.azureTotalNok);
  root.querySelector('#cost-description').textContent = isEnglish?`Azure total for ${value.periodStart} to ${value.periodEnd}. This may include other Azure services and is not solely IANS + SOGOD hosting. Last updated ${new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Oslo'}).format(new Date(value.updatedAt))}.`:`Azure-total hittil i perioden ${value.periodStart} til ${value.periodEnd}. Totalen kan også inneholde andre Azure-tjenester og er derfor ikke ren hostingkostnad for IANS + SOGOD. Sist oppdatert ${new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Oslo'}).format(new Date(value.updatedAt))}.`;
  root.querySelector('#cost-scope').textContent = isEnglish?`Includes: ${value.includes.join('; ')}. Excludes: ${value.excludes.join('; ')}.`:`Omfatter: ${value.includes.join('; ')}. Ikke inkludert: ${value.excludes.join('; ')}.`;
}
if (typeof document !== 'undefined') fetch('/assets/ians-home/costs.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>renderCosts(data)).catch(()=>{});
