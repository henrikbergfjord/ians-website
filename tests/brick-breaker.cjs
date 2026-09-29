const {webkit,devices}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await webkit.launch();
 for(const storage of ['normal','blocked','write-blocked']){
  const context=await browser.newContext({...devices['iPad (gen 7)']});
  if(storage==='blocked')await context.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError')}}));
  if(storage==='write-blocked')await context.addInitScript(()=>Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError')});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.GAMES_URL||'http://127.0.0.1:8766')+'/games/brick-breaker/');
  await page.locator('#start').tap();await page.waitForTimeout(220);
  assert.ok(await page.evaluate(()=>running&&ball.y<650),storage+' starts and moves');
  await page.locator('#start').tap();const paused=await page.evaluate(()=>ball.y);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>ball.y),paused);
  await page.locator('#start').tap();await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>running));
  // Simulate one deterministic brick hit, including denied storage writes.
  await page.evaluate(()=>{cancelAnimationFrame(raf);bricks=[{x:200,y:200,w:58,h:22,alive:true},{x:400,y:100,w:58,h:22,alive:true}];ball={x:220,y:233,vx:0,vy:-5,r:9};last=100;step(116.6667);cancelAnimationFrame(raf)});
  assert.equal(await page.evaluate(()=>score),10);assert.equal(await page.evaluate(()=>bricks[0].alive),false);
  assert.ok(await page.evaluate(()=>ball.vy>0));
  await page.evaluate(()=>{ball={x:300,y:690,vx:0,vy:5,r:9};paddle.x=230;last=100;step(116.6667);cancelAnimationFrame(raf)});assert.ok(await page.evaluate(()=>ball.vy<0));
  await page.evaluate(()=>{ball.y=780;last=100;step(116.6667);cancelAnimationFrame(raf)});assert.equal(await page.evaluate(()=>running),false);assert.match(await page.locator('#start').textContent(),/IGJEN/);
  await page.locator('#start').tap();assert.equal(await page.evaluate(()=>running),true);
  await page.locator('#reset').tap();assert.equal(await page.evaluate(()=>score),0);assert.equal(await page.evaluate(()=>running),false);
  // Actual browser pointer capture while dragging out of the canvas.
  const box=await page.locator('#c').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height*.9);await page.mouse.down();await page.mouse.move(box.x+box.width+60,box.y+box.height*.9);await page.mouse.up();assert.equal(await page.evaluate(()=>paddle.x),460);
  for(const size of [{width:810,height:1080},{width:1080,height:810},{width:390,height:844}]){await page.setViewportSize(size);const start=await page.locator('#start').boundingBox(),canvas=await page.locator('#c').boundingBox();assert.ok(start.y+start.height<size.height);assert.ok(canvas.y+canvas.height<size.height);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)}
  const positions=await page.evaluate(()=>{function sim(fps){running=true;keys={};paddle={x:230,y:700,w:140,h:16};ball={x:300,y:500,vx:2,vy:-2,r:9};bricks=[{x:20,y:20,w:20,h:20,alive:true}];last=100;for(let i=1;i<=fps/2;i++){step(100+i*1000/fps);cancelAnimationFrame(raf)}running=false;return ball.x}return [sim(60),sim(120)]});assert.ok(Math.abs(positions[0]-positions[1])<.01);
  assert.deepEqual(errors,[]);console.log('PASS',storage,'start, pause, resume, collision, scoring, replay, reset, drag, viewport, 60/120Hz');await context.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
