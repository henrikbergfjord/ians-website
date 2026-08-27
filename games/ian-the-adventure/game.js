(() => {
"use strict";
const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");
const W=1280,H=720;
const ui={
 worldLabel:document.getElementById("worldLabel"),missionLabel:document.getElementById("missionLabel"),
 coinHud:document.getElementById("coinHud"),starsStat:document.getElementById("starsStat"),coinsStat:document.getElementById("coinsStat"),catStat:document.getElementById("catStat"),
 start:document.getElementById("startOverlay"),worldOverlay:document.getElementById("worldOverlay"),finish:document.getElementById("finishOverlay"),
 worldTitle:document.getElementById("worldTitle"),worldText:document.getElementById("worldText"),msg:document.getElementById("message"),
 finalStars:document.getElementById("finalStars"),finalCoins:document.getElementById("finalCoins"),finalCat:document.getElementById("finalCat")
};

const worlds={
 school:{label:"Danielsen barneskole",sky1:"#63b9ff",sky2:"#d7f0ff",ground:"#59794a",accent:"#ffd361",mission:"Finn skolegårdens hemmelighet",desc:"Utforsk skolegården, hopp på benker og finn den skjulte skoleklokken.",goalX:2700},
 football:{label:"Fotballbanen",sky1:"#58b4ff",sky2:"#d8f5ff",ground:"#3c8a45",accent:"#ffffff",mission:"Score 3 mål",desc:"Drible ballen, kom deg forbi kjeglene og score tre mål.",goalX:2500},
 beach:{label:"Solstranden",sky1:"#42c5ff",sky2:"#d8fbff",ground:"#e5c777",accent:"#ff8a55",mission:"Finn den tapte surfestjernen",desc:"Palmer, brygger, bølger og skjulte coins.",goalX:2800},
 neon:{label:"Neonbyen",sky1:"#1a174f",sky2:"#531c72",ground:"#17223c",accent:"#ff4ef5",mission:"Aktiver neonportalen",desc:"En glødende nattby med ramper, lys og tak du kan hoppe på.",goalX:3000},
 jungle:{label:"Jungelen",sky1:"#4fa55a",sky2:"#b9ef9f",ground:"#385e2f",accent:"#f4d35e",mission:"Finn jungeltempelet",desc:"Tette trær, fossefall og en gammel hemmelighet.",goalX:2900},
 space:{label:"Romstasjonen",sky1:"#06071d",sky2:"#111c43",ground:"#30364d",accent:"#6ee7ff",mission:"Start stjerneporten",desc:"Lav gravitasjon, romvinduer og en siste portal.",goalX:3200}
};
const worldOrder=["school","football","beach","neon","jungle","space"];
let current="school",running=false,last=0,cameraX=0,lookOffset=0,stars=0,coinsTotal=0,catCuddles=0,goals=0;
let player,cat,ball,collectibles,platforms,goal,ambient;
const keys={left:false,right:false,jump:false,use:false,kick:false};

function resetWorld(name){
 current=name;const w=worlds[name];
 player={x:120,y:530,w:34,h:52,vx:0,vy:0,onGround:false,face:1};
 cat={x:40,y:555,w:30,h:24,vx:0,need:0,cuddleCooldown:0};
 ball={x:460,y:574,r:15,vx:0,vy:0};
 collectibles=[];platforms=[];ambient=[];goals=0;cameraX=0;lookOffset=0;
 for(let i=0;i<24;i++)collectibles.push({x:260+i*105+Math.sin(i)*35,y:500-(i%4)*60,taken:false});
 platforms=[
  {x:0,y:620,w:850,h:100},{x:930,y:620,w:650,h:100},{x:1680,y:620,w:780,h:100},{x:2540,y:620,w:900,h:100},
  {x:340,y:520,w:170,h:20},{x:650,y:450,w:150,h:20},{x:1050,y:510,w:180,h:20},{x:1350,y:430,w:170,h:20},
  {x:1780,y:500,w:160,h:20},{x:2060,y:420,w:180,h:20},{x:2630,y:500,w:170,h:20},{x:2960,y:410,w:170,h:20}
 ];
 goal={x:w.goalX,y:510,w:64,h:110};
 for(let i=0;i<90;i++)ambient.push({x:Math.random()*3500,y:Math.random()*450,s:Math.random()*2+.5,p:Math.random()*6.28});
 ui.worldLabel.textContent=w.label;ui.missionLabel.textContent=w.mission;
 document.querySelectorAll(".menu-btn").forEach(b=>b.classList.toggle("active",b.dataset.world===name));
}

function showMessage(t,ms=1800){ui.msg.textContent=t;ui.msg.classList.remove("hidden");clearTimeout(showMessage.t);showMessage.t=setTimeout(()=>ui.msg.classList.add("hidden"),ms)}
function beep(f=440,d=.06){try{const a=beep.a||(beep.a=new(window.AudioContext||window.webkitAudioContext)());const o=a.createOscillator(),g=a.createGain();o.frequency.value=f;o.type="sine";g.gain.value=.025;o.connect(g);g.connect(a.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,a.currentTime+d);o.stop(a.currentTime+d)}catch{}}

function update(dt){
 if(!running)return;
 const accel=1500,max=315,fric=1700,grav=current==="space"?900:2000;
 if(keys.left){player.vx=Math.max(-max,player.vx-accel*dt);player.face=-1}
 if(keys.right){player.vx=Math.min(max,player.vx+accel*dt);player.face=1}
 if(!keys.left&&!keys.right){player.vx += Math.sign(-player.vx)*Math.min(Math.abs(player.vx),fric*dt)}
 if(keys.jump&&player.onGround){player.vy=current==="space"?-620:-760;player.onGround=false;beep(300,.04)}
 keys.jump=false;

 const oldY=player.y;player.vy+=grav*dt;player.x+=player.vx*dt;player.y+=player.vy*dt;player.onGround=false;
 for(const p of platforms){
   if(player.x+player.w>p.x&&player.x<p.x+p.w&&oldY+player.h<=p.y+8&&player.y+player.h>=p.y&&player.vy>=0){
     player.y=p.y-player.h;player.vy=0;player.onGround=true;
   }
 }
 if(player.y>H+120){player.x=Math.max(60,cameraX+100);player.y=340;player.vy=0}
 player.x=Math.max(0,Math.min(player.x,3350));

 // Collectibles
 for(const c of collectibles){
   if(!c.taken&&Math.hypot(player.x+17-c.x,player.y+26-c.y)<34){c.taken=true;coinsTotal++;beep(760,.035)}
 }

 // Ball physics & football
 ball.vy+=grav*dt*.45;ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;ball.vx*=.992;
 if(ball.y+ball.r>620){ball.y=620-ball.r;ball.vy*=-.32;if(Math.abs(ball.vy)<20)ball.vy=0}
 if(keys.kick&&Math.abs((player.x+17)-ball.x)<75&&Math.abs((player.y+25)-ball.y)<70){
   ball.vx=player.face*620;ball.vy=-250;keys.kick=false;beep(220,.06)
 }
 if(current==="football"&&ball.x>goal.x&&ball.x<goal.x+goal.w&&ball.y>goal.y){
   goals++;stars++;ball.x=460;ball.y=574;ball.vx=ball.vy=0;showMessage(`MÅL! ${goals}/3 ⚽`,1500);beep(960,.12)
 }

 // Cat follows and annoys Ian
 const dx=player.x-cat.x;
 cat.vx += Math.sign(dx)*700*dt;cat.vx=Math.max(-210,Math.min(210,cat.vx));cat.x+=cat.vx*dt;cat.vx*=.88;
 if(Math.abs(dx)<48){cat.need+=dt;if(cat.need>2.2&&cat.cuddleCooldown<=0){showMessage("Mio: «Kos meg daaa!» 🐈💗",1600);cat.need=0}}
 else cat.need=Math.max(0,cat.need-dt*.5);
 cat.cuddleCooldown=Math.max(0,cat.cuddleCooldown-dt);

 if(keys.use){
   keys.use=false;
   if(Math.abs(player.x-cat.x)<70){catCuddles++;cat.cuddleCooldown=4;cat.need=0;stars++;showMessage("Mio er fornøyd. I cirka 10 sekunder. 😼");beep(680,.08)}
   else if(player.x>goal.x-80){
     if(current==="football"&&goals<3){showMessage(`Du mangler ${3-goals} mål! ⚽`)}
     else completeWorld();
   }
 }

 cameraX += ((player.x-430)+lookOffset-cameraX)*Math.min(1,dt*5);
 cameraX=Math.max(0,Math.min(cameraX,2200));
 ui.coinHud.textContent=coinsTotal;ui.coinsStat.textContent=coinsTotal;ui.starsStat.textContent=stars;ui.catStat.textContent=catCuddles;
}

function completeWorld(){
 const idx=worldOrder.indexOf(current);stars+=3;
 if(idx===worldOrder.length-1){running=false;ui.finalStars.textContent=stars;ui.finalCoins.textContent=coinsTotal;ui.finalCat.textContent=catCuddles;ui.finish.classList.remove("hidden");return}
 const next=worldOrder[idx+1],w=worlds[next];running=false;ui.worldTitle.textContent=w.label;ui.worldText.textContent=w.desc;ui.worldOverlay.dataset.next=next;ui.worldOverlay.classList.remove("hidden")
}

function draw(){
 const w=worlds[current],g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,w.sky1);g.addColorStop(1,w.sky2);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 ctx.save();ctx.translate(-cameraX*.16,0);
 if(current==="space"){
   ctx.fillStyle="#ccecff";for(const a of ambient){ctx.globalAlpha=.4+.5*Math.sin(performance.now()/800+a.p);ctx.beginPath();ctx.arc(a.x,a.y,a.s,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;
   circle(1000,145,70,"#243765");circle(420,190,38,"#6a4e8a");
 } else {
   circle(1060,120,58,"rgba(255,245,190,.72)");
   for(const a of ambient){circle(a.x,a.y,2,"rgba(255,255,255,.35)")}
 }
 ctx.restore();

 ctx.save();ctx.translate(-cameraX,0);
 drawBackdrop(w);
 for(const p of platforms){ctx.fillStyle=w.ground;ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle=w.accent;ctx.fillRect(p.x,p.y,p.w,6)}
 for(const c of collectibles)if(!c.taken){ctx.save();ctx.translate(c.x,c.y);ctx.rotate(performance.now()/600);ctx.fillStyle="#ffd95a";ctx.beginPath();ctx.ellipse(0,0,9,13,0,0,Math.PI*2);ctx.fill();ctx.restore()}
 drawGoal(w);
 drawBall();
 drawCat();
 drawIan();
 ctx.restore();
}
function drawBackdrop(w){
 if(current==="school"){
   ctx.fillStyle="#d6a55e";ctx.fillRect(1820,250,520,260);ctx.fillStyle="#734d2e";ctx.fillRect(1800,225,560,35);
   ctx.fillStyle="#edf7ff";for(let r=0;r<2;r++)for(let c=0;c<6;c++)ctx.fillRect(1850+c*78,290+r*80,48,45);
   ctx.fillStyle="#15243a";ctx.font="bold 28px sans-serif";ctx.fillText("DANIELSEN BARNESKOLE",1875,470);
   ctx.fillStyle="#3d6d3d";for(let x=200;x<3300;x+=380){ctx.beginPath();ctx.arc(x,500,75,0,Math.PI*2);ctx.fill()}
 } else if(current==="football"){
   ctx.fillStyle="rgba(255,255,255,.75)";for(let x=0;x<3400;x+=180)ctx.fillRect(x,610,90,4);
   ctx.strokeStyle="#fff";ctx.lineWidth=4;ctx.strokeRect(1700,515,180,105);
 } else if(current==="beach"){
   ctx.fillStyle="#2eb8d5";ctx.fillRect(0,510,3400,110);ctx.fillStyle="#4a9d48";for(let x=250;x<3300;x+=420){ctx.fillRect(x,390,14,120);circle(x+7,365,58,"#4a9d48")}
 } else if(current==="neon"){
   for(let x=100;x<3300;x+=250){ctx.fillStyle="#111b36";ctx.fillRect(x,260,180,260);ctx.fillStyle=x%500?"#ff4ef5":"#38e8ff";for(let y=290;y<480;y+=45)ctx.fillRect(x+25,y,24,13)}
 } else if(current==="jungle"){
   for(let x=100;x<3300;x+=210){ctx.fillStyle="#244c25";ctx.fillRect(x,330,18,190);circle(x+10,310,78,"#2f6f34");circle(x+55,345,55,"#3d8240")}
   ctx.fillStyle="#74d6ef";ctx.fillRect(2400,280,90,240);
 } else if(current==="space"){
   for(let x=150;x<3300;x+=400){ctx.fillStyle="#26314c";ctx.fillRect(x,350,280,170);ctx.fillStyle="#68e5ff";ctx.fillRect(x+35,390,120,45)}
 }
}
function drawGoal(w){
 ctx.save();ctx.translate(goal.x,goal.y);ctx.strokeStyle=w.accent;ctx.lineWidth=6;ctx.strokeRect(0,0,goal.w,goal.h);ctx.fillStyle="rgba(255,255,255,.08)";ctx.fillRect(6,6,goal.w-12,goal.h-12);ctx.fillStyle="#fff";ctx.font="bold 10px sans-serif";ctx.textAlign="center";ctx.fillText(current==="football"?"MÅL":"PORTAL",goal.w/2,goal.h/2);ctx.restore()
}
function drawBall(){circle(ball.x,ball.y,ball.r,"#fff");ctx.fillStyle="#111";ctx.beginPath();ctx.arc(ball.x,ball.y,5,0,Math.PI*2);ctx.fill()}
function drawCat(){
 ctx.save();ctx.translate(cat.x,cat.y);ctx.fillStyle="#d88b34";ctx.beginPath();ctx.ellipse(0,0,19,13,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(17,-8,11,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(12,-17);ctx.lineTo(16,-29);ctx.lineTo(21,-17);ctx.fill();ctx.moveTo(20,-17);ctx.lineTo(26,-28);ctx.lineTo(29,-14);ctx.fill();ctx.strokeStyle="#d88b34";ctx.lineWidth=7;ctx.beginPath();ctx.arc(-18,-2,20,1.5,4.7);ctx.stroke();ctx.fillStyle="#16301e";ctx.fillRect(13,-10,3,3);ctx.fillRect(21,-10,3,3);ctx.restore()
}
function drawIan(){
 ctx.save();ctx.translate(player.x+17,player.y+26);ctx.scale(player.face,1);
 ctx.fillStyle="#111822";ctx.fillRect(-14,-8,28,32);ctx.fillStyle="#f0c29e";ctx.fillRect(-11,-25,22,19);ctx.fillStyle="#402414";ctx.beginPath();ctx.arc(0,-25,14,Math.PI,0);ctx.fill();
 ctx.fillStyle="#fff";ctx.font="bold 11px sans-serif";ctx.textAlign="center";ctx.fillText("IAN",0,9);
 ctx.fillStyle="#111822";ctx.fillRect(-13,22,10,19);ctx.fillRect(3,22,10,19);ctx.fillStyle="#fff";ctx.fillRect(-14,39,12,5);ctx.fillRect(2,39,12,5);
 ctx.restore()
}
function circle(x,y,r,c){ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
function loop(t){const dt=Math.min(.033,(t-last)/1000||0);last=t;update(dt);draw();requestAnimationFrame(loop)}
requestAnimationFrame(loop);

document.getElementById("startBtn").onclick=()=>{ui.start.classList.add("hidden");running=true};
document.getElementById("enterWorldBtn").onclick=()=>{const n=ui.worldOverlay.dataset.next;ui.worldOverlay.classList.add("hidden");resetWorld(n);running=true;showMessage(`Velkommen til ${worlds[n].label}!`)};
document.getElementById("restartBtn").onclick=()=>{stars=coinsTotal=catCuddles=0;ui.finish.classList.add("hidden");resetWorld("school");running=true};

document.querySelectorAll(".menu-btn").forEach(b=>b.onclick=()=>{const n=b.dataset.world;ui.worldTitle.textContent=worlds[n].label;ui.worldText.textContent=worlds[n].desc;ui.worldOverlay.dataset.next=n;ui.worldOverlay.classList.remove("hidden");running=false});

function key(e,on){
 const k=e.key.toLowerCase();
 if(["a","arrowleft"].includes(k))keys.left=on;
 if(["d","arrowright"].includes(k))keys.right=on;
 if([" ","w","arrowup"].includes(k)&&on)keys.jump=true;
 if(k==="e"&&on)keys.use=true;
 if(k==="f"&&on)keys.kick=true;
 if(["arrowleft","arrowright","arrowup"," "].includes(k))e.preventDefault();
}
addEventListener("keydown",e=>key(e,true));addEventListener("keyup",e=>key(e,false));
canvas.addEventListener("mousemove",e=>{const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width;lookOffset=(x-.5)*420});
canvas.addEventListener("mouseleave",()=>lookOffset=0);

document.querySelectorAll(".mobile-controls button").forEach(b=>{
 const a=b.dataset.action;
 const down=e=>{e.preventDefault();if(a==="left")keys.left=true;if(a==="right")keys.right=true;if(a==="jump")keys.jump=true;if(a==="use")keys.use=true;if(a==="kick")keys.kick=true};
 const up=e=>{e.preventDefault();if(a==="left")keys.left=false;if(a==="right")keys.right=false};
 b.addEventListener("pointerdown",down);b.addEventListener("pointerup",up);b.addEventListener("pointercancel",up);
});
resetWorld("school");draw();
})();