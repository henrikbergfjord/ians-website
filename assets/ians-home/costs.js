// Public aggregate only. Never put subscription IDs, resource names or credentials here.
export function parseCosts(data, now = new Date()) {
  if (data?.status !== 'available') return null;
  const dateOnly = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
  if (!Number.isFinite(data.amountNok) || data.amountNok < 0 || !dateOnly(data.periodStart) || !dateOnly(data.periodEnd) || data.periodEnd < data.periodStart) return null;
  if (typeof data.updatedAt !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(data.updatedAt) || !Number.isFinite(Date.parse(data.updatedAt))) return null;
  const updated = new Date(data.updatedAt);
  if (updated > now || data.periodEnd > updated.toISOString().slice(0,10)) return null;
  if (!Array.isArray(data.includes) || data.includes.length === 0 || !data.includes.every(v => typeof v === 'string' && v.trim()) || !Array.isArray(data.excludes) || !data.excludes.every(v => typeof v === 'string' && v.trim())) return null;
  return {...data, stale: now - updated > 72 * 60 * 60 * 1000};
}
export function renderCosts(data, root = document) {
  const value = parseCosts(data);
  if (!value) return;
  const date = day => new Intl.DateTimeFormat('nb-NO', {day:'numeric',month:'short',timeZone:'Europe/Oslo'}).format(new Date(day));
  root.querySelector('#cost-amount').textContent = new Intl.NumberFormat('nb-NO',{style:'currency',currency:'NOK',maximumFractionDigits:2}).format(value.amountNok);
  root.querySelector('#cost-period').hidden = false;
  root.querySelector('#cost-period').textContent = `${date(value.periodStart)}–${date(value.periodEnd)}${value.stale?' · Eldre måling':''}`;
  root.querySelector('#cost-description').textContent = `Registrert driftskostnad for perioden ${value.periodStart} til ${value.periodEnd}. Sist oppdatert ${new Intl.DateTimeFormat('nb-NO',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Oslo'}).format(new Date(value.updatedAt))}.`;
  root.querySelector('#cost-scope').textContent = `Inkluderer: ${value.includes.join(', ')}. ${value.excludes.length?'Inkluderer ikke: '+value.excludes.join(', ')+'.':''}`;
}
if (typeof document !== 'undefined') fetch('/assets/ians-home/costs.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>renderCosts(data)).catch(()=>{});
