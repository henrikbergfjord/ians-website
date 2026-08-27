(() => {
"use strict";
const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");
const W=1280,H=720;
const ui={
 start:document.getElementById("startScreen"),quiz:document.getElementById("quizScreen"),finish:document.getElementById("finishScreen"),hud:document.getElementById("hud"),
 crystals:document.getElementById("crystals"),coins:document.getElementById("coins"),score:document.getElementById("score"),timer:document.getElementById("timer"),
 quizTitle:document.getElementById("quizTitle"),quizQuestion:document.getElementById("quizQuestion"),quizAnswers:document.getElementById("quizAnswers"),quizFeedback:document.getElementById("quizFeedback"),
 finalScore:document.getElementById("finalScore"),finalCoins:document.getElementById("finalCoins"),finalTime:document.getElementById("finalTime"),bestScore:document.getElementById("bestScore"),badge:document.getElementById("badge")
};
let running=false,paused=false,last=0,startTime=0,elapsed=0,sound=true;
const keys={left:false,right:false,jump:false,use:false};
let player,coins,crystals,platforms,portals,stars,particles,cameraX,score,collectedCrystals;
const gravity=2100;

const quizzes=[
 {q:"Hva er 7 × 8?",a:["54","56","64","48"],ok:1,title:"Matteport"},
 {q:"Hvilket tall mangler? 2, 4, 8, 16, __",a:["18","24","30","32"],ok:3,title:"Mønsterport"},
 {q:"Hvis en robot har 3 batterier og finner 5 til, hvor mange har den?",a:["7","8","9","10"],ok:1,title:"Logikkport"},
 {q:"Hva er størst?",a:["0,7","0,65","0,59","0,699"],ok:0,title:"Tallport"},
 {q:"En kode er 3-6-12-24. Hva kommer etter?",a:["30","36","42","48"],ok:3,title:"Core-lås"}
];

function reset(){
 player={x:90,y:510,w:34,h:48,vx:0,vy:0,onGround:false,face:1};
 cameraX=0;score=0;collectedCrystals=0;
 platforms=[
  {x:0,y:620,w:900,h:100},{x:980,y:620,w:760,h:100},{x:1840,y:620,w:600,h:100},{x:2540,y:620,w:850,h:100},
  {x:300,y:520,w:170,h:24},{x:560,y:450,w:160,h:24},{x:820,y:380,w:170,h:24},
  {x:1120,y:500,w:180,h:24},{x:1390,y:410,w:160,h:24},{x:1630,y:330,w:180,h:24},
  {x:1980,y:500,w:170,h:24},{x:2220,y:420,w:150,h:24},{x:2700,y:510,w:180,h:24},{x:3010,y:420,w:160,h:24}
 ];
 coins=[];
 [180,240,330,390,610,660,850,910,1080,1160,1240,1430,1490,1680,1730,1900,2000,2070,2250,2330,2600,2730,2820,3050,3140,3280].forEach((x,i)=>coins.push({x,y: i%3===0?560:(i%3===1?360:470),r:10,taken:false}));
 crystals=[
  {x:680,y:410,taken:false},{x:1510,y:370,taken:false},{x:1740,y:290,taken:false},{x:2300,y:380,taken:false},{x:3120,y:380,taken:false}
 ];
 portals=[
  {x:920,y:540,w:44,h:80,quiz:0,open:false,solved:false},
  {x:1760,y:540,w:44,h:80,quiz:1,open:false,solved:false},
  {x:2445,y:540,w:44,h:80,quiz:2,open:false,solved:false},
  {x:2890,y:540,w:44,h:80,quiz:3,open:false,solved:false},
  {x:3340,y:520,w:55,h:100,quiz:4,open:false,solved:false,final:true}
 ];
 stars=Array.from({length:120},()=>({x:Math.random()*3600,y:Math.random()*520,r:Math.random()*1.8+.3,p:Math.random()*6.28}));
 particles=[];
}

function beep(freq=440,dur=.08){
 if(!sound)return;
 try{
  const ac=beep.ac||(beep.ac=new (window.AudioContext||window.webkitAudioContext)());
  const o=ac.createOscillator(),g=ac.createGain();
  o.frequency.value=freq;o.type="sine";g.gain.value=.035;o.connect(g);g.connect(ac.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+dur);o.stop(ac.currentTime+dur);
 }catch{}
}

function startGame(){
 reset();running=true;paused=false;startTime=performance.now();elapsed=0;ui.start.classList.add("hidden");ui.finish.classList.add("hidden");ui.hud.classList.remove("hidden");beep(520,.12);
}
function fmtTime(ms){const s=Math.floor(ms/1000),m=Math.floor(s/60);return `${m}:${String(s%60).padStart(2,"0")}`}

function rectHit(a,b){return a.x<a.w+b.x && a.x+a.w>b.x && a.y<a.h+b.y && a.y+a.h>b.y}
function update(dt){
 if(!running||paused)return;
 elapsed=performance.now()-startTime;
 const accel=1650,max=310,fric=1750;
 if(keys.left){player.vx=Math.max(player.vx-accel*dt,-max);player.face=-1}
 if(keys.right){player.vx=Math.min(player.vx+accel*dt,max);player.face=1}
 if(!keys.left&&!keys.right){if(player.vx>0)player.vx=Math.max(0,player.vx-fric*dt);else player.vx=Math.min(0,player.vx+fric*dt)}
 if(keys.jump&&player.onGround){player.vy=-760;player.onGround=false;beep(300,.05)}
 keys.jump=false;

 const oldY=player.y;player.vy+=gravity*dt;player.x+=player.vx*dt;player.y+=player.vy*dt;player.onGround=false;
 for(const p of platforms){
   const wasAbove=oldY+player.h<=p.y+6;
   if(player.x+player.w>p.x && player.x<p.x+p.w && player.y+player.h>=p.y && player.y<p.y+p.h && wasAbove && player.vy>=0){
     player.y=p.y-player.h;player.vy=0;player.onGround=true;
   }
 }
 if(player.y>H+150){player.x=Math.max(40,cameraX+100);player.y=300;player.vy=0;score=Math.max(0,score-100)}
 player.x=Math.max(0,Math.min(player.x,3380));

 for(const c of coins){
  if(!c.taken && Math.hypot(player.x+17-c.x,player.y+24-c.y)<34){c.taken=true;score+=25;beep(760,.04);burst(c.x,c.y,"coin")}
 }
 for(const c of crystals){
  if(!c.taken && Math.hypot(player.x+17-c.x,player.y+24-c.y)<42){c.taken=true;collectedCrystals++;score+=250;beep(980,.12);burst(c.x,c.y,"crystal")}
 }
 if(keys.use){
  keys.use=false;
  const near=portals.find(p=>Math.abs((player.x+17)-(p.x+p.w/2))<72 && Math.abs((player.y+24)-(p.y+p.h/2))<90);
  if(near){
    if(near.final && collectedCrystals<5){flashMessage(`Du mangler ${5-collectedCrystals} krystall${5-collectedCrystals===1?"":"er"}!`)}
    else if(!near.solved)showQuiz(near);
    else if(near.final)finishGame();
  }
 }
 for(const pt of particles){pt.life-=dt;pt.x+=pt.vx*dt;pt.y+=pt.vy*dt;pt.vy+=350*dt}
 particles=particles.filter(p=>p.life>0);
 cameraX += ((player.x-420)-cameraX)*Math.min(1,dt*5);cameraX=Math.max(0,Math.min(cameraX,2120));
 ui.crystals.textContent=`${collectedCrystals} / 5`;ui.coins.textContent=coins.filter(c=>c.taken).length;ui.score.textContent=score;ui.timer.textContent=fmtTime(elapsed);
}
function burst(x,y,type){for(let i=0;i<14;i++)particles.push({x,y,vx:(Math.random()-.5)*260,vy:(Math.random()-.8)*260,life:.65,type})}

let msg="",msgUntil=0;function flashMessage(s){msg=s;msgUntil=performance.now()+1800;beep(180,.08)}
function showQuiz(portal){
 paused=true;ui.quiz.classList.remove("hidden");ui.quizFeedback.textContent="";
 const q=quizzes[portal.quiz];ui.quizTitle.textContent=q.title;ui.quizQuestion.textContent=q.q;ui.quizAnswers.innerHTML="";
 q.a.forEach((ans,i)=>{
  const b=document.createElement("button");b.textContent=ans;b.onclick=()=>{
   if(i===q.ok){portal.solved=true;portal.open=true;score+=200;ui.quizFeedback.textContent="Riktig! Porten er åpnet ⚡";beep(880,.14);setTimeout(()=>{ui.quiz.classList.add("hidden");paused=false},650)}
   else{score=Math.max(0,score-25);ui.quizFeedback.textContent="Nesten! Prøv en gang til.";beep(190,.08)}
  };ui.quizAnswers.appendChild(b);
 });
}
function finishGame(){
 running=false;ui.hud.classList.add("hidden");ui.finish.classList.remove("hidden");
 const coinCount=coins.filter(c=>c.taken).length,final=score+Math.max(0,3000-Math.floor(elapsed/1000)*10)+coinCount*10;
 const best=Math.max(final,Number(localStorage.getItem("ians_orbit_best")||0));localStorage.setItem("ians_orbit_best",best);
 ui.finalScore.textContent=final;ui.finalCoins.textContent=coinCount;ui.finalTime.textContent=fmtTime(elapsed);ui.bestScore.textContent=best;
 ui.badge.textContent=elapsed<120000?"⚡ SPEED EXPLORER":coinCount>=22?"🪙 COIN MASTER":"🏆 MASTER EXPLORER";beep(1040,.35);
}

function draw(){
 ctx.clearRect(0,0,W,H);
 const grad=ctx.createLinearGradient(0,0,0,H);grad.addColorStop(0,"#071427");grad.addColorStop(.65,"#0a1730");grad.addColorStop(1,"#06101d");ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
 ctx.save();ctx.translate(-cameraX*.18,0);
 for(const s of stars){ctx.globalAlpha=.45+.35*Math.sin(performance.now()/900+s.p);ctx.fillStyle="#b9ebff";ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;
 ctx.restore();
 // distant planets
 circle(180-cameraX*.06,150,72,"#17345b");circle(1120-cameraX*.10,120,38,"#2a5171");circle(720-cameraX*.03,230,18,"#5e4c8a");
 // world
 ctx.save();ctx.translate(-cameraX,0);
 for(const p of platforms){
   ctx.fillStyle="#10263d";ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle="#1d5673";ctx.fillRect(p.x,p.y,p.w,7);
   ctx.fillStyle="rgba(70,200,255,.08)";for(let x=p.x+18;x<p.x+p.w;x+=48)ctx.fillRect(x,p.y+20,2,Math.min(55,p.h-25));
 }
 // lava gaps
 ctx.fillStyle="#ff5d35";for(let x=900;x<980;x+=18)ctx.fillRect(x,650+Math.sin((performance.now()/220)+x)*8,12,70);for(let x=1740;x<1840;x+=18)ctx.fillRect(x,650+Math.sin((performance.now()/220)+x)*8,12,70);for(let x=2440;x<2540;x+=18)ctx.fillRect(x,650+Math.sin((performance.now()/220)+x)*8,12,70);
 for(const c of coins)if(!c.taken){ctx.save();ctx.translate(c.x,c.y);ctx.rotate(performance.now()/500);ctx.fillStyle="#ffd95c";ctx.beginPath();ctx.ellipse(0,0,10,14,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#7b5b00";ctx.font="bold 10px sans-serif";ctx.textAlign="center";ctx.fillText("I",0,4);ctx.restore()}
 for(const c of crystals)if(!c.taken){ctx.save();ctx.translate(c.x,c.y);ctx.rotate(Math.sin(performance.now()/700)*.15);ctx.shadowBlur=22;ctx.shadowColor="#50eaff";ctx.fillStyle="#77f5ff";ctx.beginPath();ctx.moveTo(0,-20);ctx.lineTo(14,-4);ctx.lineTo(7,20);ctx.lineTo(-7,20);ctx.lineTo(-14,-4);ctx.closePath();ctx.fill();ctx.restore()}
 for(const p of portals){
   ctx.save();ctx.translate(p.x,p.y);ctx.strokeStyle=p.solved?"#67ffb0":"#5eaaff";ctx.lineWidth=6;ctx.shadowBlur=18;ctx.shadowColor=ctx.strokeStyle;ctx.strokeRect(0,0,p.w,p.h);ctx.shadowBlur=0;ctx.fillStyle=p.solved?"rgba(74,255,170,.15)":"rgba(74,150,255,.12)";ctx.fillRect(6,6,p.w-12,p.h-12);ctx.fillStyle="#dff7ff";ctx.font="bold 10px sans-serif";ctx.textAlign="center";ctx.fillText(p.final?"CORE":"E",p.w/2,p.h/2+4);ctx.restore()
 }
 for(const pt of particles){ctx.globalAlpha=Math.max(0,pt.life/.65);circle(pt.x,pt.y,pt.type==="crystal"?5:3,pt.type==="crystal"?"#7df6ff":"#ffe16b")}ctx.globalAlpha=1;
 // player
 ctx.save();ctx.translate(player.x+player.w/2,player.y+player.h/2);ctx.scale(player.face,1);
 ctx.fillStyle="#172f48";ctx.fillRect(-13,-8,26,30);ctx.fillStyle="#ffd7bd";ctx.fillRect(-11,-24,22,18);ctx.fillStyle="#52dfff";ctx.fillRect(-10,-22,20,6);ctx.fillStyle="#0b1726";ctx.fillRect(-6,-16,3,3);ctx.fillRect(4,-16,3,3);ctx.fillStyle="#5c8dff";ctx.fillRect(-13,20,10,18);ctx.fillRect(3,20,10,18);ctx.fillStyle="#65efff";ctx.fillRect(10,-4,13,6);ctx.restore();
 ctx.restore();
 // mission arrow
 if(running){
   ctx.fillStyle="rgba(218,245,255,.78)";ctx.font="bold 11px sans-serif";ctx.textAlign="center";
   const next=crystals.find(c=>!c.taken);if(next){const sx=next.x-cameraX;if(sx<40){ctx.fillText("◀ KRYSTALL",65,100)}else if(sx>W-40){ctx.fillText("KRYSTALL ▶",W-70,100)}}
 }
 if(msgUntil>performance.now()){ctx.fillStyle="rgba(2,10,18,.78)";ctx.fillRect(W/2-180,115,360,46);ctx.strokeStyle="rgba(100,210,255,.25)";ctx.strokeRect(W/2-180,115,360,46);ctx.fillStyle="#eafaff";ctx.font="bold 16px sans-serif";ctx.textAlign="center";ctx.fillText(msg,W/2,144)}
}
function circle(x,y,r,c){ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
function loop(t){const dt=Math.min(.033,(t-last)/1000||0);last=t;update(dt);draw();requestAnimationFrame(loop)}
requestAnimationFrame(loop);

function key(e,on){
 const k=e.key.toLowerCase();if(["arrowleft","a"].includes(k))keys.left=on;if(["arrowright","d"].includes(k))keys.right=on;if(["arrowup","w"," "].includes(k)){if(on)keys.jump=true}if(k==="e"&&on)keys.use=true;
 if(["arrowleft","arrowright","arrowup"," "].includes(k))e.preventDefault();
}
addEventListener("keydown",e=>key(e,true));addEventListener("keyup",e=>key(e,false));
document.getElementById("playBtn").onclick=startGame;document.getElementById("againBtn").onclick=startGame;
document.getElementById("soundBtn").onclick=e=>{sound=!sound;e.currentTarget.textContent=sound?"🔊":"🔇"};
document.querySelectorAll(".mobile-controls button").forEach(b=>{
 const map=b.dataset.key;
 const down=e=>{e.preventDefault();if(map==="left")keys.left=true;if(map==="right")keys.right=true;if(map==="jump")keys.jump=true;if(map==="use")keys.use=true};
 const up=e=>{e.preventDefault();if(map==="left")keys.left=false;if(map==="right")keys.right=false};
 b.addEventListener("pointerdown",down);b.addEventListener("pointerup",up);b.addEventListener("pointercancel",up);b.addEventListener("pointerleave",up);
});
reset();draw();
})();