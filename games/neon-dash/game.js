(() => {
'use strict';
const $=id=>document.getElementById(id), canvas=$('game'),ctx=canvas.getContext('2d');
const ground=368, modes={practice:{speed:255,gap:1.65},challenger:{speed:330,gap:1.38},expert:{speed:405,gap:1.15}};
let mode='challenger',state='ready',player,obstacles=[],gems=[],distance=0,collected=0,level=1,elapsed=0,spawn=1.5,last=0,slide=false,records={};
try{records=JSON.parse(localStorage.getItem('iansNeonDashBest')||'{}')||{}}catch{$('saveNote').textContent='Rekorden lagres bare i denne økten.'}
function score(){return Math.floor(distance/10)+collected*50}
function hud(){$('score').textContent=score();$('level').textContent=level+' / 10';$('gems').textContent=collected;$('best').textContent=Number(records[mode])||0}
function reset(){player={x:140,y:ground-48,w:32,h:48,vy:0,jumps:0};obstacles=[];gems=[];distance=collected=elapsed=0;level=1;spawn=1.5;slide=false;hud()}
function start(){mode=$('mode').value;reset();state='playing';$('overlay').classList.add('hidden');$('pause').disabled=false;$('pause').textContent='Pause';last=0}
function jump(){if(state!=='playing'||player.jumps>=2)return;slide=false;player.vy=player.jumps===0?-680:-590;player.jumps++}
function pause(){if(state==='playing'){state='paused';slide=false;$('title').textContent='Ta en pust.';$('message').textContent='Løpet venter på deg. Fortsett når du er klar.';$('modeLabel').hidden=true;$('start').textContent='FORTSETT ↗';$('overlay').classList.remove('hidden');$('pause').textContent='Fortsett'}else if(state==='paused'){state='playing';last=0;$('overlay').classList.add('hidden');$('pause').textContent='Pause'}}
function finish(won){state=won?'won':'over';slide=false;records[mode]=Math.max(Number(records[mode])||0,score());try{localStorage.setItem('iansNeonDashBest',JSON.stringify(records))}catch{$('saveNote').textContent='Rekorden lagres bare i denne økten.'}$('title').textContent=won?'Alle 10 klart!':'Ett forsøk til?';$('message').textContent=`${score()} poeng · ${collected} krystaller · nivå ${level}. `+(won?'Prøv en tøffere modus eller slå rekorden din.':'Tips: spar dobbelthoppet til du trenger det.');$('modeLabel').hidden=false;$('start').textContent='SPILL IGJEN ↗';$('overlay').classList.remove('hidden');$('pause').disabled=true;hud()}
function hit(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
function update(dt){if(state!=='playing')return;elapsed+=dt;level=Math.min(10,1+Math.floor(elapsed/12));const speed=modes[mode].speed+(level-1)*19;distance+=speed*dt;
 const h=slide&&player.jumps===0?25:48;player.y+=player.h-h;player.h=h;player.vy+=1850*dt;player.y+=player.vy*dt;if(player.y+player.h>=ground){player.y=ground-player.h;player.vy=0;player.jumps=0}
 spawn-=dt;if(spawn<=0){const laser=Math.random()<.36;obstacles.push({x:1010,y:laser?ground-84:ground-35,w:laser?64:36+(level>4?16:0),h:laser?49:35,laser});gems.push({x:1040,y:laser?ground-130:ground-105,r:9,taken:false});spawn=modes[mode].gap+Math.random()*.45}
 for(const ob of obstacles){ob.x-=speed*dt;if(hit({x:player.x+5,y:player.y+3,w:player.w-10,h:player.h-6},ob)){finish(false);return}}
 for(const gem of gems){gem.x-=speed*dt;if(!gem.taken&&hit(player,{x:gem.x-10,y:gem.y-10,w:20,h:20})){gem.taken=true;collected++}}
 obstacles=obstacles.filter(o=>o.x+o.w>0);gems=gems.filter(g=>g.x>0&&!g.taken);hud();if(elapsed>=120)finish(true)}
function draw(){ctx.fillStyle='#081426';ctx.fillRect(0,0,960,460);for(let i=0;i<32;i++){ctx.fillStyle=i%3?'#31546b':'#77bdc9';ctx.fillRect((i*137-distance*.12)%1000+ (i*137-distance*.12<0?1000:0),35+i*43%230,2,2)}
 for(let i=0;i<13;i++){const x=i*90-(distance*.22%90);ctx.fillStyle='#10243a';ctx.fillRect(x,160+(i%4)*28,62,210);ctx.fillStyle='#24475a';ctx.fillRect(x+10,175+(i%4)*28,3,35)}
 ctx.strokeStyle='#1c4253';ctx.lineWidth=1;for(let i=0;i<15;i++){let x=i*80-distance%80;ctx.beginPath();ctx.moveTo(x,ground);ctx.lineTo(x-120,460);ctx.stroke()}ctx.fillStyle='#bef75d';ctx.fillRect(0,ground,960,3);ctx.fillStyle='#bef75d22';ctx.fillRect(0,ground+3,960,8);
 for(const ob of obstacles){ctx.fillStyle=ob.laser?'#fb6da7':'#ff9d66';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=12;if(ob.laser){ctx.fillRect(ob.x,ob.y,ob.w,ob.h);ctx.fillStyle='#2a1430';ctx.fillRect(ob.x+6,ob.y+6,ob.w-12,ob.h-12)}else{ctx.beginPath();ctx.moveTo(ob.x,ground);ctx.lineTo(ob.x+ob.w/2,ob.y);ctx.lineTo(ob.x+ob.w,ground);ctx.fill()}ctx.shadowBlur=0}
 for(const gem of gems){ctx.save();ctx.translate(gem.x,gem.y);ctx.rotate(Math.PI/4);ctx.fillStyle='#80f5ec';ctx.shadowColor='#80f5ec';ctx.shadowBlur=15;ctx.fillRect(-7,-7,14,14);ctx.restore()}
 ctx.fillStyle='#bef75d';ctx.shadowColor='#bef75d';ctx.shadowBlur=16;ctx.fillRect(player.x,player.y,player.w,player.h);ctx.shadowBlur=0;ctx.fillStyle='#132a31';ctx.fillRect(player.x+18,player.y+8,14,8);ctx.fillStyle='#8eece4';ctx.fillRect(player.x-9,player.y+player.h-10,7,8);
 ctx.fillStyle='#819fb0';ctx.font='12px system-ui';ctx.fillText('SEKTOR '+String(level).padStart(2,'0')+' / 10',24,30);ctx.fillStyle='#bef75d';ctx.fillRect(0,456,960*Math.min(1,elapsed/120),4)}
function frame(t){const dt=Math.min(.032,(t-last)/1000||0);last=t;update(dt);draw();requestAnimationFrame(frame)}
$('start').onclick=()=>state==='paused'?pause():start();$('pause').onclick=pause;
$('mode').onchange=()=>{mode=$('mode').value;hud()};
$('jump').addEventListener('pointerdown',e=>{e.preventDefault();jump()});
let slidePointer=null;$('slide').addEventListener('pointerdown',e=>{e.preventDefault();slidePointer=e.pointerId;slide=true;$('slide').setPointerCapture(e.pointerId)});for(const event of ['pointerup','pointercancel','lostpointercapture'])$('slide').addEventListener(event,e=>{if(e.pointerId===slidePointer){slide=false;slidePointer=null}});
canvas.addEventListener('pointerdown',e=>{e.preventDefault();jump()});
addEventListener('keydown',e=>{if(e.target instanceof HTMLSelectElement||e.target instanceof HTMLButtonElement)return;if([' ','ArrowUp','ArrowDown'].includes(e.key))e.preventDefault();if(e.repeat)return;if(e.key===' '||e.key==='ArrowUp')jump();if(e.key==='ArrowDown')slide=true;if(e.key.toLowerCase()==='p')pause()});addEventListener('keyup',e=>{if(e.key==='ArrowDown')slide=false});
addEventListener('blur',()=>{if(state==='playing')pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause()});
// Release focus after a button click so keyboard play works immediately.
for(const id of ['start','pause','jump','slide'])$(id).addEventListener('click',()=>$(id).blur());
reset();requestAnimationFrame(frame);
})();
