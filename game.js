// =============================================
// BILUS-SPILLUS — game.js
// =============================================
// Denne filen inneholder all spillogikk.
// Den er delt inn i seksjoner:
//   1. Oppsett (canvas og kontekst)
//   2. Banen (track)
//   3. Bilen (car)
//   4. Tastaturinput
//   5. Oppdater spilltilstand (update)
//   6. Tegn alt på skjermen (draw)
//   7. Spilløkken (game loop)
// =============================================


// --- 1. OPPSETT ---
// Henter canvas-elementet fra index.html og lager en 2D-tegnekontekst.
// "ctx" er det vi bruker for å tegne alt.
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');


// --- 2. BANEN ---
// Banen er et enkelt ovalt (rektangulært) løp.
// Vi tegner det ved å fylle først med grønt (gress), så en bred grå stripe (vei).
//
// Banens ytterkant og innerkant definerer selve veien.
const track = {
  outerX: 50,   // venstre kant av ytterbanen
  outerY: 50,   // topp kant av ytterbanen
  outerW: 700,  // bredde på ytterbanen
  outerH: 500,  // høyde på ytterbanen
  innerX: 175,  // venstre kant av innerbanen (hullet i midten)
  innerY: 150,  // topp kant av innerbanen
  innerW: 450,  // bredde på innerbanen
  innerH: 300,  // høyde på innerbanen
  cornerR: 60,  // avrunding på hjørnene
};

// Hjelpefunksjon: tegner et avrundet rektangel
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,       x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h,   x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h,   x, y + h - r,     r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x,     y,       x + r, y,          r);
  ctx.closePath();
}


// --- 3. BILEN ---
// Bilen er et enkelt rektangel.
// "angle" er retningen bilen peker, i radianer (0 = peker mot høyre).
// "speed" er nåværende fart fremover.
const car = {
  x: 400,       // startposisjon: midt på skjermen
  y: 80,        // nær toppen av banen
  width: 24,
  height: 14,
  angle: 0,     // radianer, 0 = peker mot høyre
  speed: 0,

  // Justerbare kjøreegenskaper
  acceleration: 0.12,   // hvor fort bilen akselererer
  friction: 0.93,       // bremsing uten input (0–1, lavere = mer friksjon)
  maxSpeed: 4,          // maks fart
  turnSpeed: 0.045,     // hvor fort bilen svinger
};


// --- 4. TASTATURINPUT ---
// Vi lagrer hvilke taster som er trykket ned i et objekt.
// Det gjør at vi kan sjekke dem i game-loopen hvert bilde.
const keys = {};

document.addEventListener('keydown', (e) => {
  keys[e.key] = true;
  // Hindrer siden fra å scrolle når piltaster brukes
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
  }
});

document.addEventListener('keyup', (e) => {
  keys[e.key] = false;
});


// --- 5. OPPDATER SPILLTILSTAND ---
// Denne funksjonen kjøres 60 ganger i sekundet.
// Den regner ut ny posisjon og fart for bilen basert på hvilke taster som holdes inne.
function update() {
  // Pil OPP = gasspedal
  if (keys['ArrowUp']) {
    car.speed += car.acceleration;
  }
  // Pil NED = brems / revers
  if (keys['ArrowDown']) {
    car.speed -= car.acceleration;
  }

  // Begrens farten til maks
  car.speed = Math.max(-car.maxSpeed / 2, Math.min(car.maxSpeed, car.speed));

  // Sving bare når bilen faktisk beveger seg
  if (Math.abs(car.speed) > 0.1) {
    if (keys['ArrowLeft'])  car.angle -= car.turnSpeed * (car.speed > 0 ? 1 : -1);
    if (keys['ArrowRight']) car.angle += car.turnSpeed * (car.speed > 0 ? 1 : -1);
  }

  // Flytt bilen fremover i den retningen den peker
  // Math.cos og Math.sin regner ut x/y-komponentene ut fra vinkelen
  car.x += Math.cos(car.angle) * car.speed;
  car.y += Math.sin(car.angle) * car.speed;

  // Brems gradvis (friksjon) når ingen taster holdes
  car.speed *= car.friction;

  // Stopp fullstendig ved svært lav fart (unngår evig glidning)
  if (Math.abs(car.speed) < 0.01) car.speed = 0;
}


// --- 6. TEGN ALT PÅ SKJERMEN ---
// Denne funksjonen tegner ett "bilde" (frame) av spillet.
function draw() {
  // Tøm hele canvaset
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // --- Tegn gress (bakgrunn) ---
  ctx.fillStyle = '#3a7d34';  // grønn
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // --- Tegn veien ---
  // Først fyller vi hele det ytre rektangelet med grått (veien).
  ctx.fillStyle = '#888';
  roundRect(track.outerX, track.outerY, track.outerW, track.outerH, track.cornerR);
  ctx.fill();

  // Deretter tegner vi det indre rektangelet med grønt oppå — det blir "gressplen i midten".
  ctx.fillStyle = '#3a7d34';
  roundRect(track.innerX, track.innerY, track.innerW, track.innerH, track.cornerR - 10);
  ctx.fill();

  // --- Tegn hvite kantlinjer ---
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.setLineDash([20, 15]);  // stiplet linje

  ctx.beginPath();
  roundRect(track.outerX + 18, track.outerY + 18, track.outerW - 36, track.outerH - 36, track.cornerR - 10);
  ctx.stroke();

  ctx.beginPath();
  roundRect(track.innerX - 18, track.innerY - 18, track.innerW + 36, track.innerH + 36, track.cornerR);
  ctx.stroke();

  ctx.setLineDash([]);  // tilbakestill til heltrukken linje

  // --- Tegn bilen ---
  // Vi lagrer og gjenoppretter canvas-tilstanden slik at rotasjonen
  // bare gjelder bilen, ikke resten av tegningen.
  ctx.save();
  ctx.translate(car.x, car.y);  // flytt origo til bilens posisjon
  ctx.rotate(car.angle);        // roter rundt bilens midtpunkt

  // Bilkropp (rød)
  ctx.fillStyle = '#e63030';
  ctx.fillRect(-car.width / 2, -car.height / 2, car.width, car.height);

  // Vindus (lyseblå firkant)
  ctx.fillStyle = '#aad4f5';
  ctx.fillRect(-car.width / 2 + 4, -car.height / 2 + 3, car.width / 3, car.height - 6);

  // Hjul (fire mørke rektangler)
  ctx.fillStyle = '#222';
  const wx = car.width / 2 - 4;  // x-avstand fra senter
  const wy = car.height / 2;     // y-avstand fra senter
  ctx.fillRect(-wx - 2, -wy - 2, 6, 4);   // bakre venstre
  ctx.fillRect(-wx - 2,  wy - 2, 6, 4);   // bakre høyre
  ctx.fillRect( wx - 4, -wy - 2, 6, 4);   // fremre venstre
  ctx.fillRect( wx - 4,  wy - 2, 6, 4);   // fremre høyre

  ctx.restore();  // tilbakestill canvas-tilstand

  // --- Hjelpetekst ---
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(8, 8, 200, 26);
  ctx.fillStyle = '#fff';
  ctx.font = '13px monospace';
  ctx.fillText('Piltaster: kjør og sving', 16, 26);
}


// --- 7. SPILLØKKEN (GAME LOOP) ---
// requestAnimationFrame ber nettleseren kalle "gameLoop" ca. 60 ganger i sekundet.
// Hvert kall oppdaterer spilltilstanden og tegner et nytt bilde.
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// Start spillet!
gameLoop();
