import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
const config=JSON.parse(fs.readFileSync('staticwebapp.config.json'));
const manifest=JSON.parse(fs.readFileSync('publication.json'));
function route(url){return config.routes.find(r=>r.route.endsWith('*')?url.startsWith(r.route.slice(0,-1)):r.route===url)}
test('analytics aliases all require authentication at the edge',()=>{for(const p of['/ians-analytics','/ians-analytics.html','/api/analytics-stats','/api/analytics-stats/'])assert.deepEqual(route(p).allowedRoles,['authenticated'])});
test('old editions redirect and are absent from the artifact',()=>{for(const f of['SameieNettold.html','om-megoo.html',...['01','02','03','04'].map(n=>'tools/money-planner/v'+n+'.html'),'tools/website-builder-light/index.html','tools/website-builder-pro/index.html']){assert(!manifest.files.includes(f));assert(!fs.existsSync(f));assert.equal(route('/'+f).statusCode,301)}});
test('publication excludes source snapshots and internal files',()=>{assert(manifest.files.length>250);assert(manifest.files.every(f=>!/(^|\/)(\.|api\/|docs\/|checks\/|scripts\/|tests\/)/.test(f)&&!f.includes('.backup')))});
test('reviewed artifact builds with the exact file count',()=>{const out=fs.mkdtempSync(path.join(os.tmpdir(),'ians-publication-test-'));try{const r=spawnSync('python3',['scripts/build-publication.py','--output',out],{encoding:'utf8'});assert.equal(r.status,0,r.stderr+r.stdout);let count=0;function walk(p){for(const n of fs.readdirSync(p)){const f=path.join(p,n);if(fs.statSync(f).isDirectory())walk(f);else count++}}walk(out);assert.equal(count,manifest.files.length);assert(!fs.existsSync(path.join(out,'checks')))}finally{fs.rmSync(out,{recursive:true,force:true})}});
function api(principal){let storageReads=0;const sandbox={Buffer,Date,Map,process:{env:{IANS_BOOKING_STORAGE:'test'}},module:{exports:{}},require(name){assert.equal(name,'@azure/data-tables');return{TableClient:{fromConnectionString(){storageReads++;return{async *listEntities(){}}}}}}};vm.runInNewContext(fs.readFileSync('api/analytics-stats/index.js','utf8'),sandbox);return{handler:sandbox.module.exports,reads:()=>storageReads,req:{headers:principal?{'x-ms-client-principal':Buffer.from(JSON.stringify(principal)).toString('base64')}:{}}}}
const p={identityProvider:'aad',userId:'test-id',userDetails:'henrik.bergfjord@outlook.com',userRoles:['anonymous','authenticated']};
test('anonymous analytics request never reads storage',async()=>{const x=api(),c={};await x.handler(c,x.req);assert.equal(c.res.status,401);assert.equal(x.reads(),0)});
test('unapproved signed-in account never reads analytics storage',async()=>{const x=api({...p,userDetails:'other@example.com'}),c={};await x.handler(c,x.req);assert.equal(c.res.status,403);assert.equal(x.reads(),0)});
test('non-Microsoft identity cannot impersonate approved analytics email',async()=>{const x=api({...p,identityProvider:'github'}),c={};await x.handler(c,x.req);assert.equal(c.res.status,403);assert.equal(x.reads(),0)});
test('approved Microsoft owner can read aggregate analytics',async()=>{const x=api(p),c={log:{error(){}}};await x.handler(c,x.req);assert.equal(c.res.status,200);assert.equal(x.reads(),1)});
