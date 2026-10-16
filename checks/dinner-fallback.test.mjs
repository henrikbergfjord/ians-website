import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const handler=require('../api/dinner-planner-ai/index.js');
test('unconfigured dinner service returns a labelled usable reserve plan',async()=>{
  const saved=process.env.OPENAI_API_KEY;delete process.env.OPENAI_API_KEY;
  try{
    const context={log:{error(){}}};
    await handler(context,{method:'POST',body:{days:3,adults:2,children:0,cuisines:['Nordisk'],budget:1000}});
    assert.equal(context.res.status,200);
    const plan=typeof context.res.body==='string'?JSON.parse(context.res.body):context.res.body;
    assert.equal(plan.aiAvailable,false);
    assert.equal(plan.meals.length,3);
    assert.ok(plan.meals.every(m=>m.name&&m.ingredients.length&&m.steps.length));
    assert.ok(plan.shopping.length);
    assert.deepEqual(plan.detected,[]);
  }finally{if(saved===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=saved;}
});
