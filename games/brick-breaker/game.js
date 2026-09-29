'use strict';
const c = document.getElementById('c'), x = c.getContext('2d');
const startButton = document.getElementById('start'), message = document.getElementById('message');
let paddle, ball, bricks, score = 0, level = 1, best = 0;
let running = false, keys = {}, raf = null, last = null, pointer = null, storageOK = true;
try {
  const stored = Number(localStorage.getItem('iansBrickBest'));
  if (Number.isFinite(stored) && stored > 0) best = stored;
} catch { storageOK = false; }
function setMessage(text) {
  message.textContent = text + (storageOK ? '' : ' Rekorden beholdes i denne økten.');
}
function build() {
  paddle = {x:230, y:700, w:140, h:16};
  ball = {x:300, y:650, vx:Math.min(6, 3.4 + level * .18), vy:-Math.min(7, 4.2 + level * .14), r:9};
  bricks = [];
  const rows = Math.min(8, 3 + Math.floor(level / 2));
  for (let r = 0; r < rows; r++) for (let col = 0; col < 8; col++)
    bricks.push({x:25+col*69, y:70+r*34, w:58, h:22, alive:true});
  draw();
}
function hud() {
  document.getElementById('level').textContent = level;
  document.getElementById('score').textContent = score;
  if (score > best) {
    best = score;
    if (storageOK) try { localStorage.setItem('iansBrickBest', String(best)); }
    catch { storageOK = false; setMessage('Spillet fortsetter uten lagring.'); }
  }
  document.getElementById('best').textContent = best;
}
function draw() {
  x.fillStyle = '#071827'; x.fillRect(0,0,600,760);
  bricks.forEach((b,i) => {
    if (!b.alive) return;
    x.fillStyle = ['#38d98c','#57c9ff','#b26eff','#ffb13b'][i%4];
    x.fillRect(b.x,b.y,b.w,b.h);
  });
  x.fillStyle = '#dff7ff'; x.fillRect(paddle.x,paddle.y,paddle.w,paddle.h);
  x.beginPath(); x.arc(ball.x,ball.y,ball.r,0,Math.PI*2); x.fillStyle='#fff'; x.fill();
}
function pause() {
  if (!running) return;
  running = false; cancelAnimationFrame(raf); raf = null; last = null; keys = {}; pointer = null;
  startButton.textContent = 'FORTSETT'; setMessage('Pause. Trykk FORTSETT når du er klar.');
}
function step(t) {
  if (!running) return;
  const dt = last === null ? 0 : Math.min(2,(t-last)/16.6667); last=t;
  const count = Math.max(1,Math.ceil(dt*2)), delta=dt/count;
  for (let part=0; part<count && running; part++) {
    if (keys.ArrowLeft) paddle.x -= 7*delta;
    if (keys.ArrowRight) paddle.x += 7*delta;
    paddle.x = Math.max(0,Math.min(600-paddle.w,paddle.x));
    const oldX=ball.x, oldY=ball.y;
    ball.x += ball.vx*delta; ball.y += ball.vy*delta;
    if (ball.x < ball.r) { ball.x=ball.r; ball.vx=Math.abs(ball.vx); }
    if (ball.x > 600-ball.r) { ball.x=600-ball.r; ball.vx=-Math.abs(ball.vx); }
    if (ball.y < ball.r) { ball.y=ball.r; ball.vy=Math.abs(ball.vy); }
    if (ball.vy>0 && oldY+ball.r<=paddle.y && ball.y+ball.r>=paddle.y &&
        ball.x+ball.r>=paddle.x && ball.x-ball.r<=paddle.x+paddle.w) {
      ball.y=paddle.y-ball.r;
      const speed=Math.min(10,Math.hypot(ball.vx,ball.vy));
      const angle=Math.max(-1,Math.min(1,(ball.x-paddle.x-paddle.w/2)/(paddle.w/2)))*Math.PI/3;
      ball.vx=speed*Math.sin(angle); ball.vy=-speed*Math.cos(angle);
    }
    for (const b of bricks) {
      if (!b.alive) continue;
      if (ball.x+ball.r>b.x && ball.x-ball.r<b.x+b.w && ball.y+ball.r>b.y && ball.y-ball.r<b.y+b.h) {
        b.alive=false; score+=10;
        if (oldY+ball.r<=b.y) { ball.y=b.y-ball.r; ball.vy=-Math.abs(ball.vy); }
        else if (oldY-ball.r>=b.y+b.h) { ball.y=b.y+b.h+ball.r; ball.vy=Math.abs(ball.vy); }
        else if (oldX<b.x) { ball.x=b.x-ball.r; ball.vx=-Math.abs(ball.vx); }
        else { ball.x=b.x+b.w+ball.r; ball.vx=Math.abs(ball.vx); }
        break;
      }
    }
    if (bricks.every(b=>!b.alive)) { level++; build(); setMessage('Nivå '+level+' — klar neste brett!'); break; }
    if (ball.y-ball.r>760) {
      running=false; last=null; keys={}; pointer=null;
      startButton.textContent='PRØV NIVÅET IGJEN'; setMessage('Ballen falt ned. Prøv nivå '+level+' igjen.'); build(); break;
    }
  }
  hud(); draw();
  if (running) raf=requestAnimationFrame(step);
}
function start() {
  if (running) { pause(); return; }
  running=true; last=null; startButton.textContent='PAUSE';
  setMessage('Dra på brettet eller bruk ← og → for å styre.');
  cancelAnimationFrame(raf); raf=requestAnimationFrame(step);
}
function movePaddle(e) {
  const rect=c.getBoundingClientRect();
  paddle.x=Math.max(0,Math.min(600-paddle.w,(e.clientX-rect.left)/rect.width*600-paddle.w/2));
  if (!running) draw();
}
c.addEventListener('pointerdown',e=>{
  if (pointer!==null) return;
  e.preventDefault(); pointer=e.pointerId; c.setPointerCapture(e.pointerId); movePaddle(e);
});
c.addEventListener('pointermove',e=>{if(e.pointerId===pointer){e.preventDefault();movePaddle(e)}});
for (const event of ['pointerup','pointercancel','lostpointercapture'])
  c.addEventListener(event,e=>{if(e.pointerId===pointer)pointer=null});
document.addEventListener('keydown',e=>{
  if (['ArrowLeft','ArrowRight'].includes(e.key)) {e.preventDefault();keys[e.key]=true;}
});
document.addEventListener('keyup',e=>{keys[e.key]=false});
startButton.onclick=start;
document.getElementById('reset').onclick=()=>{
  cancelAnimationFrame(raf); running=false; last=null; keys={}; pointer=null; score=0; level=1;
  build(); hud(); startButton.textContent='START SPILLET'; setMessage('Ny runde. Trykk START SPILLET.');
};
window.addEventListener('blur',pause);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
build(); hud(); setMessage('Trykk START SPILLET. Dra fingeren på brettet for å styre platen.');
