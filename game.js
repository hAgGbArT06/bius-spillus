// =============================================
// BILUS-SPILLUS — game.js
// =============================================
// Seksjoner:
//   1.  Oppsett
//   2.  Banen + buffersone
//   3.  Bilen
//   4.  Eksplosjon
//   5.  Tastaturinput
//   6.  Sonedeteksjon (vei / buffer / utenfor)
//   7.  Oppdater spilltilstand
//   8.  Tegn banen
//   9.  Tegn bilen
//  10.  Tegn eksplosjon
//  11.  Tegn hastighetsmåler
//  12.  Tegn alt
//  13.  Spilløkken
// =============================================


// --- 1. OPPSETT ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');


// --- 2. BANEN + BUFFERSONE ---
// BUFFER er bredden (i piksler) på den sandfargte kantstripa langs veikanten.
// Kjører du inn i den bremser du kraftig. Kjører du forbi den eksploderer du.
const BUFFER = 22;

const track = {
  outerX: 50,  outerY: 50,  outerW: 700, outerH: 500, cornerR: 60,
  innerX: 175, innerY: 175, innerW: 450, innerH: 250,
};

// Tegner et avrundet rektangel som en path (kaller ctx.beginPath() selv).
function roundRect(x, y, w, h, r) {
  r = Math.max(0, r); // radius kan ikke være negativ
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
const START = { x: 400, y: 80, angle: 0 };

const car = {
  x: START.x, y: START.y, angle: START.angle,
  width: 24, height: 14,
  speed: 0,
  visible: true,       // skjules under eksplosjon
  acceleration: 0.12,
  friction: 0.93,
  maxSpeed: 4,
  turnSpeed: 0.045,
};

function resetCar() {
  car.x       = START.x;
  car.y       = START.y;
  car.angle   = START.angle;
  car.speed   = 0;
  car.visible = true;
}


// --- 4. EKSPLOSJON ---
// Når bilen kjører av banen lages en haug med partikler som sprer seg utover.
const explosion = {
  active: false,
  x: 0, y: 0,
  particles: [],
  timer: 0,
  duration: 100, // antall frames eksplosjonen varer
};

function triggerExplosion() {
  if (explosion.active) return; // unngå dobbel-trigge
  explosion.active = true;
  explosion.x = car.x;
  explosion.y = car.y;
  explosion.timer = 0;
  explosion.particles = [];
  car.visible = false;
  car.speed = 0;

  // 40 partikler i tilfeldige retninger og størrelser
  for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 6;
    explosion.particles.push({
      x: 0, y: 0,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size:  2 + Math.random() * 12,
      color: ['#ff1100','#ff5500','#ff9900','#ffcc00','#ffffff'][Math.floor(Math.random() * 5)],
      life: 1.0, // 1.0 = full styrke, telles ned mot 0
    });
  }
}

function updateExplosion() {
  if (!explosion.active) return;
  explosion.timer++;

  for (const p of explosion.particles) {
    p.x  += p.vx;
    p.y  += p.vy;
    p.vy += 0.08;          // lett tyngdekraft på partiklene
    p.life -= 1 / explosion.duration;
    p.size *= 0.97;        // partiklene krymper gradvis
  }

  // Etter at eksplosjonen er ferdig: reset bilen til start
  if (explosion.timer >= explosion.duration) {
    explosion.active = false;
    resetCar();
  }
}


// --- 5. TASTATURINPUT ---
const keys = {};

document.addEventListener('keydown', (e) => {
  keys[e.key] = true;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
    e.preventDefault(); // hindrer siden fra å scrolle
  }
});

document.addEventListener('keyup', (e) => {
  keys[e.key] = false;
});


// --- 6. SONEDETEKSJON ---
// Returnerer hvilken sone bilen er i:
//   'road'    = trygg asfalt
//   'buffer'  = sandstripe langs kanten (bremser kraftig)
//   'offroad' = helt utenfor banen (= eksplosjon)
//
// Vi bruker enkle rektangelsjekker. Avrundede hjørner ignoreres for enkelhets skyld —
// litt unøyaktig helt i svingene, men godt nok.
function getCarZone() {
  const { x, y } = car;
  const t = track;

  const inOuter = x > t.outerX             && x < t.outerX + t.outerW &&
                  y > t.outerY             && y < t.outerY + t.outerH;
  const inInner = x > t.innerX             && x < t.innerX + t.innerW &&
                  y > t.innerY             && y < t.innerY + t.innerH;

  if (!inOuter || inInner) return 'offroad';

  const inSafeOuter = x > t.outerX + BUFFER && x < t.outerX + t.outerW - BUFFER &&
                      y > t.outerY + BUFFER && y < t.outerY + t.outerH - BUFFER;
  const nearInner   = x > t.innerX - BUFFER && x < t.innerX + t.innerW + BUFFER &&
                      y > t.innerY - BUFFER && y < t.innerY + t.innerH + BUFFER;

  if (inSafeOuter && !nearInner) return 'road';
  return 'buffer';
}


// --- 7. OPPDATER SPILLTILSTAND ---
function update() {
  // Mens eksplosjonen pågår: oppdater bare den, ikke bilen
  if (explosion.active) {
    updateExplosion();
    return;
  }

  if (keys['ArrowUp'])   car.speed += car.acceleration;
  if (keys['ArrowDown']) car.speed -= car.acceleration;

  car.speed = Math.max(-car.maxSpeed / 2, Math.min(car.maxSpeed, car.speed));

  if (Math.abs(car.speed) > 0.1) {
    if (keys['ArrowLeft'])  car.angle -= car.turnSpeed * (car.speed > 0 ? 1 : -1);
    if (keys['ArrowRight']) car.angle += car.turnSpeed * (car.speed > 0 ? 1 : -1);
  }

  car.x += Math.cos(car.angle) * car.speed;
  car.y += Math.sin(car.angle) * car.speed;
  car.speed *= car.friction;
  if (Math.abs(car.speed) < 0.01) car.speed = 0;

  // Sjekk sone og reager
  const zone = getCarZone();
  if (zone === 'buffer') {
    car.speed *= 0.88; // kraftig ekstra bremsing i sandstripa
  } else if (zone === 'offroad') {
    triggerExplosion();
  }
}


// --- 8. TEGN BANEN ---
// Banens lag (malt oppå hverandre):
//   1. Grønt gress overalt (bakgrunn)
//   2. Sandfarget ytre oval (hele baneflaten inkl. buffersone)
//   3. Grå oval innsnevret med BUFFER (trygg asfalt, dekker sanden innenfor)
//   4. Sandfarget indre oval (buffersone langs gressplen)
//   5. Grønt indre oval (gressplen i midten)
function drawTrack() {
  // 1. Gress
  ctx.fillStyle = '#3a7d34';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Hele baneflaten i sandfarge (buffer langs ytterkant synes her)
  ctx.fillStyle = '#c8a840';
  roundRect(track.outerX, track.outerY, track.outerW, track.outerH, track.cornerR);
  ctx.fill();

  // 3. Trygg asfalt i grått (BUFFER piksler innsnevret fra ytterkant)
  ctx.fillStyle = '#888';
  roundRect(
    track.outerX + BUFFER, track.outerY + BUFFER,
    track.outerW - BUFFER * 2, track.outerH - BUFFER * 2,
    track.cornerR - 12
  );
  ctx.fill();

  // 4. Indre buffersone i sandfarge (BUFFER piksler utenfor gressplen)
  ctx.fillStyle = '#c8a840';
  roundRect(
    track.innerX - BUFFER, track.innerY - BUFFER,
    track.innerW + BUFFER * 2, track.innerH + BUFFER * 2,
    track.cornerR - 10
  );
  ctx.fill();

  // 5. Gressplen i midten
  ctx.fillStyle = '#3a7d34';
  roundRect(track.innerX, track.innerY, track.innerW, track.innerH, track.cornerR - 20);
  ctx.fill();

  // Stiplete midtlinjer (bare til pynt, syner ca. midten av asfalten)
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


// --- 9. TEGN BILEN ---
function drawCar() {
  if (!car.visible) return;

  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  // Bilkropp (rød)
  ctx.fillStyle = '#e63030';
  ctx.fillRect(-car.width / 2, -car.height / 2, car.width, car.height);

  // Vindu (lyseblå)
  ctx.fillStyle = '#aad4f5';
  ctx.fillRect(-car.width / 2 + 4, -car.height / 2 + 3, car.width / 3, car.height - 6);

  // Fire hjul (mørke rektangler)
  ctx.fillStyle = '#222';
  const wx = car.width / 2 - 4;
  const wy = car.height / 2;
  ctx.fillRect(-wx - 2, -wy - 2, 6, 4);
  ctx.fillRect(-wx - 2,  wy - 2, 6, 4);
  ctx.fillRect( wx - 4, -wy - 2, 6, 4);
  ctx.fillRect( wx - 4,  wy - 2, 6, 4);

  ctx.restore();
}


// --- 10. TEGN EKSPLOSJON ---
function drawExplosion() {
  if (!explosion.active) return;

  // Kort gul-hvit flash rett etter smell
  if (explosion.timer < 8) {
    const alpha = ((8 - explosion.timer) / 8) * 0.75;
    ctx.fillStyle = `rgba(255, 220, 50, ${alpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // "BOOM!"-tekst som vokser og blekner
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

  // Partikler
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


// --- 11. TEGN HASTIGHETSMÅLER ---
// En buemåler nede til høyre. Fargen går fra grønn (sakte) til rød (full fart).
function drawSpeedometer() {
  const cx = canvas.width - 75;
  const cy = canvas.height - 75;
  const r  = 50;

  // Mørk bakgrunnssirkel
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#444';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // Bue-skala: starter sørøst (225°), går 270° med klokken
  const startAngle = (225 * Math.PI) / 180;
  const totalArc   = (270 * Math.PI) / 180;

  // Grå bakgrunnsbue (tom del av måleren)
  ctx.strokeStyle = '#333';
  ctx.lineWidth   = 7;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 8, startAngle, startAngle + totalArc);
  ctx.stroke();

  // Farget fartsbue oppå
  const speedRatio = Math.abs(car.speed) / car.maxSpeed;
  if (speedRatio > 0) {
    const hue = (1 - speedRatio) * 120; // 120=grønn, 0=rød
    ctx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
    ctx.lineWidth   = 7;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, r - 8, startAngle, startAngle + speedRatio * totalArc);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  // Fart som tall (skalert til km/t for å se realistisk ut)
  const kmh = Math.round(speedRatio * 200);
  ctx.fillStyle  = '#ffffff';
  ctx.font       = 'bold 16px monospace';
  ctx.textAlign  = 'center';
  ctx.fillText(kmh, cx, cy + 5);

  ctx.font      = '9px monospace';
  ctx.fillStyle = '#aaaaaa';
  ctx.fillText('km/h', cx, cy + 18);
  ctx.textAlign = 'left';
}


// --- 12. TEGN ALT ---
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawTrack();
  drawCar();
  drawExplosion();
  drawSpeedometer();

  // Hjelpetekst øverst til venstre
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(8, 8, 200, 26);
  ctx.fillStyle = '#fff';
  ctx.font = '13px monospace';
  ctx.fillText('Piltaster: kjør og sving', 16, 26);
}


// --- 13. SPILLØKKEN ---
// requestAnimationFrame kaller gameLoop ~60 ganger i sekundet.
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();
