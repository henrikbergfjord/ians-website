const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const principal=(roles,email='customer@example.test')=>Buffer.from(JSON.stringify({userId:'test-id',userDetails:email,userRoles:roles})).toString('base64');
const context=()=>{const log=()=>{};log.warn=()=>{};log.error=()=>{};return {log};};
function load(file,fetch,env={},extra={}){const sandbox={module:{exports:{}},Buffer,URLSearchParams,process:{env},fetch,setTimeout:(fn)=>fn(),...extra};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),sandbox);return sandbox.module.exports;}
test('Advisor rejects anonymous and unrelated roles before any upstream request',async()=>{
  let calls=0;const fn=load('api/axion-advisor/index.js',async()=>{calls++;throw Error('Unexpected network')});
  for(const [header,status] of [[undefined,401],['invalid',401],[principal(['authenticated']),403],[principal(['iansadmin']),403]]){const c=context();await fn(c,{method:'POST',headers:{'x-ms-client-principal':header},body:{question:'Test'}});assert.equal(c.res.status,status);assert.equal(typeof c.res.body.error,'string');}
  assert.equal(calls,0);
});
test('Advisor returns v3 JSON for approved role variants and upstream errors',async()=>{
  let failed=false;const fn=load('api/axion-advisor/index.js',async()=>({ok:!failed,status:failed?400:200,json:async()=>failed?{error:{message:'test'}}:{output_text:'Answer'}}),{OPENAI_API_KEY:'test'});
  for(const role of ['axionreader','AxionReader','axioncustomer','AxionAdmin','axionowner']){const c=context();await fn(c,{method:'POST',headers:{'x-ms-client-principal':principal([role])},body:{question:'Test'}});assert.equal(c.res.status,200);assert.equal(c.res.body.answer,'Answer');assert.equal(c.res.jsonBody,undefined);}
  failed=true;const c=context();await fn(c,{method:'POST',headers:{'x-ms-client-principal':principal(['axionadmin'])},body:{question:'Test'}});assert.equal(c.res.status,502);assert.ok(c.res.body.error);
});
test('Costs reject a customer, preserve missing data and sort daily series',async()=>{
  let calls=0;const fetch=async(url,opts)=>{calls++;if(url.includes('login.microsoftonline'))return {ok:true,json:async()=>({access_token:'test'})};assert.ok(url.includes('api-version=2025-03-01'));const q=JSON.parse(opts.body);if(q.timeframe==='TheLastMonth')return {ok:false,status:403,headers:{get:()=>null},json:async()=>({error:{message:'Denied'}})};const daily=q.dataset.granularity==='Daily';return {ok:true,status:200,json:async()=>({properties:{columns:[{name:'PreTaxCost'},{name:daily?'UsageDate':'Currency'},{name:'Currency'}],rows:daily?[[4,20260912,'NOK'],[2,20260901,'NOK']]:[[6,'NOK','NOK']]}})};};
  const fn=load('api/azure-cost/index.js',fetch,{AZURE_TENANT_ID:'test',AZURE_CLIENT_ID:'test',AZURE_CLIENT_SECRET:'test',AZURE_SUBSCRIPTION_ID:'test'});
  let c=context();await fn(c,{headers:{'x-ms-client-principal':principal(['axioncustomer'])}});assert.equal(c.res.status,403);assert.equal(calls,0);
  c=context();await fn(c,{headers:{'x-ms-client-principal':principal(['iansadmin'])}});assert.equal(c.res.status,200);const body=JSON.parse(c.res.body);assert.equal(body.monthToDate,6);assert.equal(body.previousMonth,null);assert.equal(body.warnings.length,1);assert.deepEqual(body.daily.map(x=>x.date),['2026-09-01','2026-09-12']);
});
test('Contact cannot claim delivery when email reports Failed and storage is absent',async()=>{
  for(const state of ['Failed','Succeeded']){const fn=load('api/contact/index.js',undefined,{COMMUNICATION_SERVICES_CONNECTION_STRING:'test',ACADEMY_EMAIL_SENDER:'test',ACADEMY_EMAIL_RECIPIENT:'test'},{require:(name)=>name==='crypto'?require('crypto'):name==='@azure/data-tables'?{TableClient:{}}:{EmailClient:class{async beginSend(){return {pollUntilDone:async()=>({status:state})}}}}});const c=context();await fn(c,{body:{name:'Test User',email:'test@example.test',type:'privat',subject:'Tilgang til Axion Grid',message:'Test request message'}});assert.equal(c.res.status,state==='Succeeded'?201:503);}
});
test('Route permissions keep Axion customers out of admin and protect Advisor',()=>{
  const cfg=JSON.parse(fs.readFileSync(path.join(__dirname,'..','staticwebapp.config.json'),'utf8'));
  const admin=cfg.routes.find(x=>x.route==='/axion-grid/admin/*').allowedRoles;
  assert.ok(admin.includes('axionadmin'));assert.ok(!admin.includes('AxionReader'));assert.ok(!admin.includes('authenticated'));
  for(const route of ['/api/axion-advisor','/axion-grid/customer/*']){const r=cfg.routes.find(x=>x.route===route);assert.ok(r.allowedRoles.includes('axionreader'));assert.ok(!r.allowedRoles.includes('authenticated'));}
});
