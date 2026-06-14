// =============================================
// BILUS-SPILLUS — game.js
// =============================================
// Seksjoner:
//   1.  Oppsett
//   2.  Banen + buffersone
//   3.  Bilen
//   4.  Bremsemerker (skid marks)
//   5.  Eksplosjon
//   6.  Tastaturinput
//   7.  Sonedeteksjon
//   8.  Oppdater spilltilstand
//   9.  Tegn banen
//  10.  Tegn bremsemerker
//  11.  Tegn bilen
//  12.  Tegn eksplosjon
//  13.  Tegn hastighetsmåler
//  14.  Tegn alt
//  15.  Spilløkken
// =============================================


// --- 1. OPPSETT ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');


// --- 2. BANEN ---
const BUFFER = 22;

const track = {
  outerX: 50,  outerY: 50,  outerW: 700, outerH: 500, cornerR: 60,
  innerX: 175, innerY: 175, innerW: 450, innerH: 250,
};

function roundRect(x, y, w, h, r) {
  r = Math.max(0, r);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,       y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x,     y,     x + r,   y,         r);
  ctx.closePath();
}


// --- 3. BILEN ---
// Viktig endring fra forrige versjon: bilen har nå en fartvektor (vx, vy)
// i stedet for bare én "speed"-verdi.
//
// Fordelen: vi kan simulere sluring/drift. Bilen peker i én retning (angle),
// men beveger seg i en annen (vx/vy). Graden av "grip" bestemmer hvor fort
// fartvektoren retter seg etter bilens vinkel.
const START = { x: 400, y: 80, angle: 0 };

const car = {
  x: START.x, y: START.y, angle: START.angle,
  width: 24, height: 14,
  vx: 0, vy: 0,   // faktisk fartvektor
  speed: 0,        // absoluttverdi av farten (brukes av HUD)
  visible: true,

  acceleration: 0.15,
  friction:     0.93,
  maxSpeed:     4,
  boostSpeed:   7,   // topfart med Shift-boost
  turnSpeed:    0.045,
};

function resetCar() {
  car.x = START.x; car.y = START.y; car.angle = START.angle;
  car.vx = 0; car.vy = 0; car.speed = 0;
  car.visible = true;
}


// --- 4. BREMSEMERKER ---
// Når bilen slurer lagres punkter her. Hvert punkt blekner gradvis.
const skidMarks = [];

function addSkidMark() {
  skidMarks.push({ x: car.x, y: car.y, life: 1.0 });
  if (skidMarks.length > 300) skidMarks.shift(); // maks 300 punkter
}

function updateSkidMarks() {
  for (const s of skidMarks) s.life -= 0.004;
}


// --- 5. EKSPLOSJON ---
const explosion = {
  active: false,
  x: 0, y: 0,
  particles: [],
  timer: 0,
  duration: 100,
};

function triggerExplosion() {
  if (explosion.active) return;
  explosion.active = true;
  explosion.x = car.x; explosion.y = car.y;
  explosion.timer = 0; explosion.particles = [];
  car.visible = false;
  car.vx = 0; car.vy = 0; car.speed = 0;

  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 0.5 + Math.random() * 6;
    explosion.particles.push({
      x: 0, y: 0,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      size:  2 + Math.random() * 12,
      color: ['#ff1100','#ff5500','#ff9900','#ffcc00','#ffffff'][Math.floor(Math.random() * 5)],
      life: 1.0,
    });
  }
}

function updateExplosion() {
  if (!explosion.active) return;
  explosion.timer++;
  for (const p of explosion.particles) {
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.08;
    p.life -= 1 / explosion.duration;
    p.size *= 0.97;
  }
  if (explosion.timer >= explosion.duration) {
    explosion.active = false;
    resetCar();
  }
}


// --- 6. TASTATURINPUT ---
const keys = {};

document.addEventListener('keydown', (e) => {
  keys[e.key] = true;
  // Hindrer scrolling med piltaster og mellomrom
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) {
    e.preventDefault();
  }
});

document.addEventListener('keyup', (e) => { keys[e.key] = false; });


// --- 7. SONEDETEKSJON ---
function getCarZone() {
  const { x, y } = car;
  const t = track;

  const inOuter = x > t.outerX && x < t.outerX + t.outerW &&
                  y > t.outerY && y < t.outerY + t.outerH;
  const inInner = x > t.innerX && x < t.innerX + t.innerW &&
                  y > t.innerY && y < t.innerY + t.innerH;

  if (!inOuter || inInner) return 'offroad';

  const inSafeOuter = x > t.outerX + BUFFER && x < t.outerX + t.outerW - BUFFER &&
                      y > t.outerY + BUFFER && y < t.outerY + t.outerH - BUFFER;
  const nearInner   = x > t.innerX - BUFFER && x < t.innerX + t.innerW + BUFFER &&
                      y > t.innerY - BUFFER && y < t.innerY + t.innerH + BUFFER;

  return (inSafeOuter && !nearInner) ? 'road' : 'buffer';
}


// --- 8. OPPDATER SPILLTILSTAND ---
function update() {
  if (explosion.active) { updateExplosion(); return; }

  // Les input
  const boost     = keys['Shift'];
  const handbrake = keys[' '];
  const gas       = keys['ArrowUp']    || keys['w'] || keys['W'];
  const brake     = keys['ArrowDown']  || keys['s'] || keys['S'];
  const left      = keys['ArrowLeft']  || keys['a'] || keys['A'];
  const right     = keys['ArrowRight'] || keys['d'] || keys['D'];

  const topSpeed = boost ? car.boostSpeed : car.maxSpeed;

  // Legg akselerasjon til fartvektoren i bilens retning
  if (gas)   { car.vx += Math.cos(car.angle) * car.acceleration;
               car.vy += Math.sin(car.angle) * car.acceleration; }
  if (brake) { car.vx -= Math.cos(car.angle) * car.acceleration * 0.6;
               car.vy -= Math.sin(car.angle) * car.acceleration * 0.6; }

  // Beregn nåværende fart (lengden av fartvektoren)
  const speed = Math.sqrt(car.vx * car.vx + car.vy * car.vy);

  // Begrens til topfart
  if (speed > topSpeed) {
    car.vx = (car.vx / speed) * topSpeed;
    car.vy = (car.vy / speed) * topSpeed;
  }

  // Sving (bare når bilen beveger seg)
  if (speed > 0.1) {
    // Sjekk om bilen kjører fremover eller bakover ved å projisere
    // fartvektoren på bilens framretning (dot-produkt).
    const forwardDot = Math.cos(car.angle) * car.vx + Math.sin(car.angle) * car.vy;
    const dir = forwardDot >= 0 ? 1 : -1;

    // Håndbrekk gir skarpere sving (hjulene låser bak, gir dreining)
    const turn = car.turnSpeed * (handbrake ? 1.6 : 1);
    if (left)  car.angle -= turn * dir;
    if (right) car.angle += turn * dir;
  }

  // GRIP — trekker fartvektoren mot bilens faktiske retning.
  //
  // Lav fart  → høy grip (presis styring)
  // Høy fart  → lavere grip (bilen skrenser i svinger = understyring)
  // Håndbrekk → minimalt grip (maks drift)
  if (speed > 0.1) {
    let grip;
    if (handbrake) {
      grip = 0.04;
    } else {
      // Lineær reduksjon: 0.18 ved stillestående → 0.07 ved full fart
      grip = Math.max(0.07, 0.18 - (speed / topSpeed) * 0.11);
    }

    // Blend fartvektoren mot retningen bilen peker
    const facingVx = Math.cos(car.angle) * speed;
    const facingVy = Math.sin(car.angle) * speed;
    car.vx += (facingVx - car.vx) * grip;
    car.vy += (facingVy - car.vy) * grip;
  }

  // Friksjon (håndbrekk = ekstra bremsing)
  const frict = handbrake ? 0.87 : car.friction;
  car.vx *= frict;
  car.vy *= frict;

  if (speed < 0.01) { car.vx = 0; car.vy = 0; }

  // Oppdater posisjon og lagre speed for HUD
  car.x    += car.vx;
  car.y    += car.vy;
  car.speed = speed;

  // Sonesjekk
  const zone = getCarZone();
  if (zone === 'buffer') {
    car.vx *= 0.88; car.vy *= 0.88;
  } else if (zone === 'offroad') {
    triggerExplosion();
  }

  // Bremsemerker vises når bilen slurer (stor vinkelforskjell mellom
  // fartretning og bilretning, eller håndbrekk aktivt)
  if (speed > 1) {
    const velAngle = Math.atan2(car.vy, car.vx);
    let diff = Math.abs(velAngle - car.angle) % (Math.PI * 2);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (handbrake || diff > 0.15) addSkidMark();
  }

  updateSkidMarks();
}


// --- 9. TEGN BANEN ---
function drawTrack() {
  ctx.fillStyle = '#3a7d34';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#c8a840';
  roundRect(track.outerX, track.outerY, track.outerW, track.outerH, track.cornerR);
  ctx.fill();

  ctx.fillStyle = '#888';
  roundRect(
    track.outerX + BUFFER, track.outerY + BUFFER,
    track.outerW - BUFFER * 2, track.outerH - BUFFER * 2,
    track.cornerR - 12
  );
  ctx.fill();

  ctx.fillStyle = '#c8a840';
  roundRect(
    track.innerX - BUFFER, track.innerY - BUFFER,
    track.innerW + BUFFER * 2, track.innerH + BUFFER * 2,
    track.cornerR - 10
  );
  ctx.fill();

  ctx.fillStyle = '#3a7d34';
  roundRect(track.innerX, track.innerY, track.innerW, track.innerH, track.cornerR - 20);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 2;
  ctx.setLineDash([20, 15]);
  roundRect(
    track.outerX + BUFFER * 2, track.outerY + BUFFER * 2,
    track.outerW - BUFFER * 4, track.outerH - BUFFER * 4,
    track.cornerR - 20
  );
  ctx.stroke();
  roundRect(
    track.innerX - BUFFER * 2, track.innerY - BUFFER * 2,
    track.innerW + BUFFER * 4, track.innerH + BUFFER * 4,
    track.cornerR - 5
  );
  ctx.stroke();
  ctx.setLineDash([]);
}


// --- 10. TEGN BREMSEMERKER ---
function drawSkidMarks() {
  for (const s of skidMarks) {
    if (s.life <= 0) continue;
    ctx.globalAlpha = s.life * 0.55;
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}


// --- 11. TEGN BILEN ---
function drawCar() {
  if (!car.visible) return;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  ctx.fillStyle = '#e63030';
  ctx.fillRect(-car.width / 2, -car.height / 2, car.width, car.height);

  ctx.fillStyle = '#aad4f5';
  ctx.fillRect(-car.width / 2 + 4, -car.height / 2 + 3, car.width / 3, car.height - 6);

  ctx.fillStyle = '#222';
  const wx = car.width / 2 - 4;
  const wy = car.height / 2;
  ctx.fillRect(-wx - 2, -wy - 2, 6, 4);
  ctx.fillRect(-wx - 2,  wy - 2, 6, 4);
  ctx.fillRect( wx - 4, -wy - 2, 6, 4);
  ctx.fillRect( wx - 4,  wy - 2, 6, 4);

  ctx.restore();
}


// --- 12. TEGN EKSPLOSJON ---
function drawExplosion() {
  if (!explosion.active) return;

  if (explosion.timer < 8) {
    const alpha = ((8 - explosion.timer) / 8) * 0.75;
    ctx.fillStyle = `rgba(255, 220, 50, ${alpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (explosion.timer < 45) {
    const alpha = 1 - explosion.timer / 45;
    const scale = 1 + explosion.timer / 18;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(explosion.x, explosion.y - 30);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center';
    ctx.font = 'bold 36px monospace';
    ctx.fillStyle   = '#ff4400';
    ctx.fillText('BOOM!', 0, 0);
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth   = 1.5;
    ctx.strokeText('BOOM!', 0, 0);
    ctx.restore();
  }

  for (const p of explosion.particles) {
    if (p.life <= 0) continue;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(explosion.x + p.x, explosion.y + p.y, Math.max(0.1, p.size), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}


// --- 13. TEGN HASTIGHETSMÅLER ---
// Når boost er aktiv: oransje ring og "BOOST"-tekst i stedet for "km/h".
function drawSpeedometer() {
  const boost = keys['Shift'];
  const cx = canvas.width - 75;
  const cy = canvas.height - 75;
  const r  = 50;
  const topSpeed = boost ? car.boostSpeed : car.maxSpeed;

  // Bakgrunn (mørkere oransje når boost er aktiv)
  ctx.fillStyle = boost ? 'rgba(60,20,0,0.75)' : 'rgba(0,0,0,0.65)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = boost ? '#ff6600' : '#444';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  const startAngle = (225 * Math.PI) / 180;
  const totalArc   = (270 * Math.PI) / 180;

  // Grå tom bue
  ctx.strokeStyle = '#333';
  ctx.lineWidth   = 7;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 8, startAngle, startAngle + totalArc);
  ctx.stroke();

  // Farget fartsbue (grønn → rød)
  const speedRatio = Math.min(car.speed / topSpeed, 1);
  if (speedRatio > 0) {
    const hue = (1 - speedRatio) * 120;
    ctx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
    ctx.lineWidth   = 7;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, r - 8, startAngle, startAngle + speedRatio * totalArc);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  const kmh = Math.round(speedRatio * (boost ? 280 : 200));
  ctx.fillStyle  = '#ffffff';
  ctx.font       = 'bold 16px monospace';
  ctx.textAlign  = 'center';
  ctx.fillText(kmh, cx, cy + 5);
  ctx.font      = '9px monospace';
  ctx.fillStyle = boost ? '#ff9944' : '#aaaaaa';
  ctx.fillText(boost ? 'BOOST' : 'km/h', cx, cy + 18);
  ctx.textAlign = 'left';
}


// --- 14. TEGN ALT ---
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawTrack();
  drawSkidMarks();
  drawCar();
  drawExplosion();
  drawSpeedometer();

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(8, 8, 300, 26);
  ctx.fillStyle = '#fff';
  ctx.font = '13px monospace';
  ctx.fillText('WASD / piltaster  •  Shift = boost  •  Mellomrom = drift', 16, 26);
}


// --- 15. SPILLØKKEN ---
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();
