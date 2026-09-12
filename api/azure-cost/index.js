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

function optionalAmount(name) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const n = Number(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function readPrincipal(req) {
  try {
    const raw = req.headers['x-ms-client-principal'];
    if (!raw) return null;
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch { return null; }
}

function isIansAdmin(principal) {
  const roles = (Array.isArray(principal?.userRoles) ? principal.userRoles : []).map(r => String(r).toLowerCase());
  const user = String(principal?.userDetails || '').trim().toLowerCase();
  return roles.includes('iansadmin') || user === 'henrik.bergfjord@outlook.com';
}

// Warm-instance cache. Azure Functions may recycle an instance at any time, so this is
// deliberately an optimization rather than durable state. It dramatically reduces
// repeated Cost Management calls while keeping the endpoint stateless and safe.
let costCache = { value: null, storedAt: 0 };
let inFlightRefresh = null;

function cacheTtlMs() {
  const minutes = Number(process.env.AZURE_COST_CACHE_MINUTES || 10);
  return Math.max(1, Math.min(60, Number.isFinite(minutes) ? minutes : 10)) * 60 * 1000;
}

function staleTtlMs() {
  const minutes = Number(process.env.AZURE_COST_STALE_MINUTES || 60);
  return Math.max(10, Math.min(360, Number.isFinite(minutes) ? minutes : 60)) * 60 * 1000;
}

function cacheEnvelope(data, principal, hit, stale = false) {
  const ageMs = costCache.storedAt ? Math.max(0, Date.now() - costCache.storedAt) : 0;
  return {
    ...data,
    admin: principal?.userDetails || null,
    cache: {
      hit,
      stale,
      ageSeconds: Math.round(ageMs / 1000),
      ttlSeconds: Math.round(cacheTtlMs() / 1000),
      storedAt: costCache.storedAt ? new Date(costCache.storedAt).toISOString() : null
    }
  };
}

async function getToken(tenantId, clientId, clientSecret) {
  const body = new URLSearchParams({ client_id:clientId, client_secret:clientSecret, scope:'https://management.azure.com/.default', grant_type:'client_credentials' });
  const r = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, { method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'}, body });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.access_token) throw new Error(`Azure authentication failed (${r.status})`);
  return data.access_token;
}

async function costQuery(token, subscriptionId, payload, attempt = 0) {
  const url = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.CostManagement/query?api-version=2025-03-01`;
  const r = await fetch(url, { method:'POST', headers:{authorization:`Bearer ${token}`,'content-type':'application/json'}, body:JSON.stringify(payload) });
  if (r.status === 204) return { columns:[], rows:[] };
  const data = await r.json().catch(() => ({}));
  if ((r.status === 429 || r.status >= 500) && attempt < 2) {
    const retryAfter = Math.max(1, Math.min(8, Number(r.headers.get('retry-after')) || (attempt + 1) * 2));
    await sleep(retryAfter * 1000);
    return costQuery(token, subscriptionId, payload, attempt + 1);
  }
  if (!r.ok) throw new Error(data?.error?.message || data?.error?.code || `Azure Cost Management returned ${r.status}`);
  return data?.properties || { columns:[], rows:[] };
}

function rowsAsObjects(properties) {
  const names = (properties.columns || []).map(c => c.name);
  return (properties.rows || []).map(row => Object.fromEntries(names.map((name,i) => [name,row[i]])));
}

function totalFrom(properties) {
  if (properties.unavailable) return { cost:null, currency:null };
  const first = rowsAsObjects(properties)[0] || {};
  return { cost:num(first.PreTaxCost ?? first.Cost ?? first.totalCost ?? properties.rows?.[0]?.[0]), currency:String(first.Currency ?? properties.rows?.[0]?.[1] ?? 'NOK') };
}

async function optionalQuery(context,label,fn,fallback) {
  try { return await fn(); } catch(err) { context.log.warn(`azure-cost optional query failed: ${label}: ${err.message}`); return {...fallback,unavailable:true}; }
}

async function resourceGroupQuery(context,token,subscriptionId,aggregation) {
  let lastError;
  for (const name of ['ResourceGroupName','ResourceGroup']) {
    try { return await costQuery(token,subscriptionId,{type:'Usage',timeframe:'MonthToDate',dataset:{granularity:'None',aggregation,grouping:[{type:'Dimension',name}]}}); }
    catch(err) { lastError=err; context.log.warn(`azure-cost resource-group grouping ${name} failed: ${err.message}`); }
  }
  throw lastError || new Error('Resource group cost query failed');
}

async function buildCostData(context, tenantId, clientId, clientSecret, subscriptionId) {
  const token=await getToken(tenantId,clientId,clientSecret);
  const aggregation={totalCost:{name:'PreTaxCost',function:'Sum'}};
  const mtdProps=await costQuery(token,subscriptionId,{type:'Usage',timeframe:'MonthToDate',dataset:{granularity:'None',aggregation}}), mtd=totalFrom(mtdProps);
  const previousProps=await optionalQuery(context,'previous-month',()=>costQuery(token,subscriptionId,{type:'Usage',timeframe:'TheLastMonth',dataset:{granularity:'None',aggregation}}),{columns:[],rows:[]}), previous=totalFrom(previousProps);
  const dailyProps=await optionalQuery(context,'daily',()=>costQuery(token,subscriptionId,{type:'Usage',timeframe:'MonthToDate',dataset:{granularity:'Daily',aggregation}}),{columns:[],rows:[]});
  const serviceProps=await optionalQuery(context,'services',()=>costQuery(token,subscriptionId,{type:'Usage',timeframe:'MonthToDate',dataset:{granularity:'None',aggregation,grouping:[{type:'Dimension',name:'ServiceName'}]}}),{columns:[],rows:[]});
  const groupProps=await optionalQuery(context,'resource-groups',()=>resourceGroupQuery(context,token,subscriptionId,aggregation),{columns:[],rows:[]});

  const daily=rowsAsObjects(dailyProps).map(r=>{const raw=String(r.UsageDate??r.Date??'');const date=/^\d{8}$/.test(raw)?`${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`:raw.slice(0,10);return{date,cost:num(r.PreTaxCost??r.Cost??r.totalCost),currency:r.Currency||mtd.currency}}).filter(x=>x.date).sort((a,b)=>a.date.localeCompare(b.date));
  const services=rowsAsObjects(serviceProps).map(r=>({name:String(r.ServiceName||r.Service||'Other'),cost:num(r.PreTaxCost??r.Cost??r.totalCost),currency:r.Currency||mtd.currency})).sort((a,b)=>b.cost-a.cost);
  const resourceGroups=rowsAsObjects(groupProps).map(r=>({name:String(r.ResourceGroupName||r.ResourceGroup||r.ResourceGroupName_s||'Other'),cost:num(r.PreTaxCost??r.Cost??r.totalCost),currency:r.Currency||mtd.currency})).filter(x=>x.name&&x.name!=='Other').sort((a,b)=>b.cost-a.cost);
  const now=new Date(), elapsedDays=Math.max(1,now.getUTCDate()), daysInMonth=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,0)).getUTCDate(), projected=mtd.cost/elapsedDays*daysInMonth, budget=num(process.env.AZURE_COST_BUDGET||0);

  // Confirmed 12.09.2026 from Microsoft account: Microsoft 365 Family, NOK 1,559/year incl. VAT, renews 07.10.2026.
  // Override with IANS_COST_MICROSOFT365_PRIVATE_MONTHLY if the subscription price changes.
  const m365Override=optionalAmount('IANS_COST_MICROSOFT365_PRIVATE_MONTHLY');
  const m365Monthly=m365Override ?? (1559/12);
  const externalCosts=[
    {key:'m365-family',name:'Microsoft 365 Family · Privat',category:'Microsoft',amount:m365Monthly,annualAmount:m365Monthly*12,source:m365Override===null?'verified-fixed':'manual',renewalDate:'2026-10-07',note:'Office + OneDrive. Delt familieabonnement, opptil 6 personer.'},
    {key:'openai',name:'OpenAI API',category:'AI',amount:optionalAmount('IANS_COST_OPENAI_MONTHLY'),source:'manual'},
    {key:'microsoft',name:'Andre Microsoft / Entra-kostnader',category:'Microsoft',amount:optionalAmount('IANS_COST_MICROSOFT_MONTHLY'),source:'manual'},
    {key:'github',name:'GitHub',category:'Development',amount:optionalAmount('IANS_COST_GITHUB_MONTHLY'),source:'manual'},
    {key:'domains',name:'Domener / DNS',category:'Web',amount:optionalAmount('IANS_COST_DOMAINS_MONTHLY'),source:'manual'},
    {key:'other',name:'Andre faste tjenester',category:'Other',amount:optionalAmount('IANS_COST_OTHER_MONTHLY'),source:'manual'}
  ].map(x=>({...x,configured:x.amount!==null,currency:'NOK'}));

  const externalConfiguredTotal=externalCosts.reduce((sum,x)=>sum+(x.amount??0),0), knownMonthTotal=(mtd.cost??0)+externalConfiguredTotal, projectedKnownMonthTotal=(projected??0)+externalConfiguredTotal;

  return {
    generatedAt:new Date().toISOString(),
    subscription:{idSuffix:subscriptionId.slice(-6)},
    currency:mtd.currency||previous.currency||'NOK',
    monthToDate:mtd.cost,
    projectedMonthEnd:projected,
    previousMonth:previous.cost,
    knownMonthTotal,
    projectedKnownMonthTotal,
    knownAnnualRunRate:projectedKnownMonthTotal*12,
    externalConfiguredTotal,
    externalCosts,
    warnings:[previousProps.unavailable&&'Forrige måneds kostnad kunne ikke hentes.',dailyProps.unavailable&&'Daglige kostnader kunne ikke hentes.',serviceProps.unavailable&&'Kostnader per tjeneste kunne ikke hentes.',groupProps.unavailable&&'Kostnader per Azure-ressursgruppe kunne ikke hentes.'].filter(Boolean),
    budget:budget>0?budget:null,
    budgetUsedPercent:budget>0?(mtd.cost/budget)*100:null,
    daily,
    services,
    resourceGroups,
    note:'Azure is actual usage. Microsoft 365 Family is a verified fixed annual subscription converted to monthly cost. Other external costs are included only when configured.'
  };
}

module.exports = async function(context,req) {
  try {
    const principal=readPrincipal(req);
    if(!principal) return context.res=json(401,{error:'Microsoft sign-in required.'});
    if(!isIansAdmin(principal)) return context.res=json(403,{error:'IANS administrator access required.'});

    const tenantId=process.env.AZURE_TENANT_ID, clientId=process.env.AZURE_CLIENT_ID, clientSecret=process.env.AZURE_CLIENT_SECRET, subscriptionId=process.env.AZURE_SUBSCRIPTION_ID;
    if(![tenantId,clientId,clientSecret,subscriptionId].every(Boolean)) return context.res=json(503,{error:'Azure cost integration is not configured.',missingConfiguration:true});

    const now=Date.now();
    const age=now-costCache.storedAt;
    if(costCache.value && age < cacheTtlMs()) {
      return context.res=json(200,cacheEnvelope(costCache.value,principal,true,false));
    }

    // Coalesce simultaneous requests: one request refreshes Azure while the rest await the same promise.
    if(!inFlightRefresh) {
      inFlightRefresh=buildCostData(context,tenantId,clientId,clientSecret,subscriptionId)
        .then(data=>{
          costCache={value:data,storedAt:Date.now()};
          return data;
        })
        .finally(()=>{ inFlightRefresh=null; });
    }

    try {
      const data=await inFlightRefresh;
      return context.res=json(200,cacheEnvelope(data,principal,false,false));
    } catch(refreshError) {
      // If Azure throttles or is temporarily unavailable, serve the last successful snapshot for up to 60 minutes.
      if(costCache.value && (Date.now()-costCache.storedAt) < staleTtlMs()) {
        const stale={...costCache.value,warnings:[...(costCache.value.warnings||[]),'Azure kunne ikke oppdateres akkurat nå. Viser siste vellykkede kostnadsdata.']};
        return context.res=json(200,cacheEnvelope(stale,principal,true,true));
      }
      throw refreshError;
    }
  } catch(err) {
    context.log.error('azure-cost',err);
    context.res=json(502,{error:'Could not retrieve Azure cost data.',diagnostic:err.message});
  }
};
