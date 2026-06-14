// =============================================
// BILUS-SPILLUS — game.js
// =============================================
// Seksjoner:
//   1.  Oppsett
//   1b. Lyd (Web Audio API)
//   2.  Banen + buffersone
//   2b. Pynt (grantrær og busker)
//   2c. Easter egg (rekord som gror i gresset)
//   3.  Bilen
//   3b. Runde-teller
//   3c. Leaderboard (localStorage)
//   4.  Bremsemerker (skid marks)
//   5.  Eksplosjon + brennmerker
//   6.  Tastaturinput
//   7.  Sonedeteksjon + rundekryssing
//   8.  Oppdater spilltilstand
//   9.  Tegn banen + mål-linje
//   9b. Tegn pynt (trær/busker)
//   9c. Tegn startgrid
//  10.  Tegn bremsemerker
//  11.  Tegn bilen
//  12.  Tegn brennmerker + eksplosjon
//  12c. Billboard (mørk eik) bak HUD
//  13.  Tegn hastighetsmåler
//  13b. Tegn runde-info + leaderboard
//  13c. Tegn nullstill-knapp
//  14.  Tegn alt
//  15.  Spilløkken
// =============================================


// --- 1. OPPSETT ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Versjonsnummer — vises nede til venstre, så man enkelt kan sjekke at alle
// spiller samme versjon (nyttig hvis noen har en gammel, bufret kopi).
const VERSION = 'v1.4';


// --- 1b. LYD (Web Audio API) ---
// Vi lager alle lyder matematisk i nettleseren — ingen lydfiler trengs.
// Nettlesere krever at lyd startes etter et tastetrykk, så vi "vekker" lyden
// første gang spilleren trykker på en tast (se tastaturinput lenger nede).
let audioCtx = null;
let engineOsc = null;     // motorlyd: en tone som endrer pitch med farten
let engineGain = null;    // hvor høy motorlyden er
let engineFilter = null;  // lavpassfilter som demper de skarpe overtonene

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // Motoren er en "trekant"-bølge — mykere og mindre summende enn sagtann.
  engineOsc  = audioCtx.createOscillator();
  engineGain = audioCtx.createGain();
  engineFilter = audioCtx.createBiquadFilter();
  engineOsc.type = 'triangle';
  engineOsc.frequency.value = 55;
  engineFilter.type = 'lowpass';      // slipper bare gjennom de lave, runde tonene
  engineFilter.frequency.value = 400;
  engineGain.gain.value = 0;          // starter stille
  engineOsc.connect(engineFilter).connect(engineGain).connect(audioCtx.destination);
  engineOsc.start();

  // Vibrato: en treg "LFO" som vugger pitchen ±3 Hz, så lyden føles levende
  // i stedet for en monoton, repetitiv tone.
  const lfo = audioCtx.createOscillator();
  const lfoGain = audioCtx.createGain();
  lfo.frequency.value = 6;   // vugger ~6 ganger i sekundet
  lfoGain.gain.value = 3;    // ±3 Hz utslag
  lfo.connect(lfoGain).connect(engineOsc.frequency);
  lfo.start();
}

// Oppdaterer motorlyden hvert bilde:
//   - høyere fart = lysere tone, åpnere filter og litt høyere volum
//   - tomgang er nesten helt stille (ingen konstant dur når du står stille)
function updateEngineSound() {
  if (!audioCtx) return;
  const ratio = Math.min(car.speed / car.boostSpeed, 1);
  const now = audioCtx.currentTime;
  const targetFreq   = 50 + ratio * 200;
  const targetCutoff = 350 + ratio * 1300;            // filteret åpner med farten
  const targetGain   = car.visible ? 0.01 + ratio * 0.09 : 0;
  engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.08);
  engineFilter.frequency.setTargetAtTime(targetCutoff, now, 0.08);
  engineGain.gain.setTargetAtTime(targetGain, now, 0.08);
}

// Spiller en kraftig eksplosjonslyd: et lavt "boom" + en filtrert støy-smell.
function playExplosionSound() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;

  // 1) Lavt boom som synker i tonehøyde
  const boom = audioCtx.createOscillator();
  const boomGain = audioCtx.createGain();
  boom.type = 'sine';
  boom.frequency.setValueAtTime(140, now);
  boom.frequency.exponentialRampToValueAtTime(28, now + 0.5);
  boomGain.gain.setValueAtTime(1.0, now);
  boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
  boom.connect(boomGain).connect(audioCtx.destination);
  boom.start(now); boom.stop(now + 0.7);

  // 2) Hvit støy gjennom et lavpassfilter = "smell"/rasling
  const len = Math.floor(audioCtx.sampleRate * 0.8);
  const buffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const lp = audioCtx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1400, now);
  lp.frequency.exponentialRampToValueAtTime(180, now + 0.7);
  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.9, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  noise.connect(lp).connect(noiseGain).connect(audioCtx.destination);
  noise.start(now); noise.stop(now + 0.8);
}


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
  ctx.arcTo(x,     y,     x + r,   y,          r);
  ctx.closePath();
}


// --- 2b. PYNT (grantrær og busker) ---
// Faste posisjoner i de grønne områdene (midten + ytterkantene). Vi velger dem
// for hånd så ingen havner på veien. Bilen kan uansett ikke kjøre på gresset
// (= død), så trærne trenger ingen kollisjon — de er rein pynt.
//   type: 'tree' = grantre,  'bush' = busk.   s = størrelse.
const scenery = [
  // Gressplenen i midten
  { x: 235, y: 235, s: 26, type: 'tree' },
  { x: 330, y: 215, s: 22, type: 'tree' },
  { x: 470, y: 220, s: 24, type: 'tree' },
  { x: 565, y: 245, s: 26, type: 'tree' },
  { x: 595, y: 340, s: 22, type: 'tree' },
  { x: 520, y: 395, s: 26, type: 'tree' },
  { x: 400, y: 300, s: 28, type: 'tree' },
  { x: 300, y: 385, s: 24, type: 'tree' },
  { x: 215, y: 320, s: 22, type: 'tree' },
  { x: 380, y: 245, s: 16, type: 'bush' },
  { x: 460, y: 360, s: 16, type: 'bush' },
  { x: 270, y: 290, s: 14, type: 'bush' },
  // Ytre gresskant (hjørner og sider)
  { x: 26, y: 28,  s: 18, type: 'tree' },
  { x: 774, y: 28, s: 18, type: 'tree' },
  { x: 26, y: 575, s: 18, type: 'tree' },
  { x: 774, y: 575, s: 18, type: 'tree' },
  { x: 26, y: 300, s: 14, type: 'bush' },
  { x: 774, y: 300, s: 14, type: 'bush' },
];


// --- 2c. EASTER EGG: vennens rekord som gror i gresset ---
// Et lite skjult minne: en hilsen + vennens rekord "gror" frem som gresstrå oppe
// til venstre, under kontroll-teksten. Teknikken: vi skriver teksten på et usynlig
// hjelpe-canvas, leser av hvilke piksler som er dekket, og planter et gresstrå på
// hver av dem.
const EGG_LINES = ['Entps', '#2.75'];   // linje 1 og 2
const easterEgg = {
  blades: [],     // ett objekt per gresstrå: { x, y, h, phase }
  grow: 0,        // 0 = ikke grodd, 1 = fullvokst
  built: false,
};

function buildEasterEgg() {
  try {
    // Tegn de to tekstlinjene på et lite usynlig canvas
    const off = document.createElement('canvas');
    off.width = 130; off.height = 58;
    const octx = off.getContext('2d');
    octx.fillStyle = '#fff';
    octx.font = 'bold 26px monospace';
    octx.textAlign = 'left';
    octx.textBaseline = 'top';
    octx.fillText(EGG_LINES[0], 2, 2);
    octx.fillText(EGG_LINES[1], 2, 30);
    const data = octx.getImageData(0, 0, off.width, off.height).data;

    // Plasser teksten oppe til venstre, rett under kontroll-boksen, i gress-hjørnet
    const anchorX = 12, anchorY = 40;
    const scale = 0.62;
    for (let py = 0; py < off.height; py += 2) {
      for (let px = 0; px < off.width; px += 2) {
        const alpha = data[(py * off.width + px) * 4 + 3];
        if (alpha > 128) {  // her er det "blekk" → plant et gresstrå
          easterEgg.blades.push({
            x: anchorX + px * scale,
            y: anchorY + py * scale,
            h: 3 + Math.random() * 3,
            phase: Math.random() * Math.PI * 2,
          });
        }
      }
    }
    easterEgg.built = true;
  } catch (e) {
    /* hvis pikselavlesning er blokkert: bare hopp over easter egget */
  }
}

function updateEasterEgg() {
  // Gresset gror sakte frem de første ~4 sekundene, og blir så stående
  if (easterEgg.grow < 1) easterEgg.grow = Math.min(1, easterEgg.grow + 0.004);
}

function drawEasterEgg() {
  if (!easterEgg.built || easterEgg.grow <= 0) return;
  const t = performance.now() / 600;   // brukes til mild vaiing i "vinden"
  for (const b of easterEgg.blades) {
    const h = b.h * easterEgg.grow;
    if (h < 0.5) continue;
    const sway = Math.sin(t + b.phase) * 0.9 * easterEgg.grow;
    ctx.strokeStyle = '#54a347';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x + sway, b.y - h);
    ctx.stroke();
  }
}


// --- 3. BILEN ---
// Viktig endring fra forrige versjon: bilen har nå en fartvektor (vx, vy)
// i stedet for bare én "speed"-verdi.
//
// Fordelen: vi kan simulere sluring/drift. Bilen peker i én retning (angle),
// men beveger seg i en annen (vx/vy). Graden av "grip" bestemmer hvor fort
// fartvektoren retter seg etter bilens vinkel.
// Start/mål-linja ligger midt på toppstykket (her skjer rundetellingen).
// Den er bevisst skilt fra bilens spawn, så bilen kan stå BAK linja på pole.
const LINE_X = 400;

// Startoppstilling: nummererte ruter trappet bakover (mot venstre) fra linja.
// Plass 1 er fremst (nærmest linja). firstX flyttet til venstre for mer plass.
const GRID = { laneA: 92, laneB: 128, firstX: 344, stepX: 24, count: 6 };

// Bilen starter oppå plass 1 (pole position), bak startlinja.
const START = { x: GRID.firstX, y: GRID.laneA, angle: 0 };

const car = {
  x: START.x, y: START.y, angle: START.angle,
  width: 24, height: 14,
  vx: 0, vy: 0,   // faktisk fartvektor
  speed: 0,        // absoluttverdi av farten (brukes av HUD)
  visible: true,

  acceleration: 0.16,
  maxSpeed:     4,
  boostSpeed:   7,      // topfart med Shift-boost
  boostPower:   1.8,    // hvor mye ekstra motorkraft boost gir
  turnSpeed:    0.045,

  // Friksjon = hvor mye fart bilen beholder hvert bilde (1 = ingen tap).
  // Nå avhenger den av hva du gjør, så du må bremse aktivt for å sakke ned:
  friction:          0.97,    // mens du gasser (lar toppfarten sette seg)
  coastFriction:     0.995,   // ingen knapper → bilen ruller fritt, mister nesten ingen fart
  brakeFriction:     0.94,    // når du bremser (pil ned / S)
  handbrakeFriction: 0.87,    // håndbrekk (mellomrom)
};

function resetCar() {
  car.x = START.x; car.y = START.y; car.angle = START.angle;
  car.vx = 0; car.vy = 0; car.speed = 0;
  car.visible = true;
  // Nullstill alle taster slik at ingen "henger" fast etter en død.
  // (Holder du en tast fortsatt inne, registreres den på nytt automatisk.)
  for (const k in keys) keys[k] = false;
  // En død avbryter runden: start tiden på nytt og glem halvveis-sjekkpunktet.
  prevCarX = START.x;
  lap.started = false;        // klokka venter til du krysser startlinja igjen
  lap.passedHalfway = false;
}


// --- 3b. RUNDE-TELLER ---
// Vi teller en runde når bilen krysser mål-linja øverst (ved x = LINE_X) på vei
// mot HØYRE — men bare hvis den først har vært innom et halvveis-sjekkpunkt
// nederst på banen. Det hindrer juks ved å vippe fram og tilbake over linja.
// Klokka starter først ved aller første kryssing (bilen står bak linja på pole).
const lap = {
  count: 0,              // fullførte runder
  started: false,        // har klokka begynt? (starter når du krysser linja først)
  passedHalfway: false,  // har bilen passert nedre sjekkpunkt denne runden?
  startTime: 0,          // tidspunktet (ms) inneværende runde startet
  lastLapTime: 0,        // forrige rundetid (ms)
  recordFlash: 0,        // teller ned bilder mens "NY REKORD!" blinker
};
let prevCarX = START.x;  // bilens x forrige bilde — brukes til å oppdage kryssing

// Gjør millisekunder om til en lesbar tekst, f.eks. "12.34s".
function formatTime(ms) {
  return (ms / 1000).toFixed(2) + 's';
}


// --- 3c. LEADERBOARD (lagres i nettleseren) ---
// localStorage er et lite "minne" i nettleseren som overlever at du lukker fanen.
// Vi lagrer de 5 beste rundetidene dine der som en JSON-tekst, så du kan jakte
// på din egen rekord — et lite leaderboard mot deg selv.
const LB_KEY = 'bilus_leaderboard';   // navnet vi lagrer under
let leaderboard = loadLeaderboard();  // liste med tider (ms), sortert raskest først

function loadLeaderboard() {
  try {
    const raw = localStorage.getItem(LB_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];  // hvis noe er ødelagt eller blokkert: bare start tomt
  }
}

function saveLeaderboard() {
  try {
    localStorage.setItem(LB_KEY, JSON.stringify(leaderboard));
  } catch (e) {
    /* lagring kan være blokkert (privat modus) — da kjører vi bare uten */
  }
}

// Legger inn en ny rundetid, sorterer og beholder de 5 beste.
function recordLapTime(ms) {
  leaderboard.push(ms);
  leaderboard.sort((a, b) => a - b);   // minst (raskest) først
  leaderboard = leaderboard.slice(0, 5);
  saveLeaderboard();
}

// Teller ned bilder mens "Sikker?"-bekreftelsen på nullstill-knappen vises.
let resetConfirm = 0;

// Tømmer leaderboardet (kalles når knappen er bekreftet med to klikk).
function clearLeaderboard() {
  leaderboard = [];
  saveLeaderboard();
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
// Mer brutal nå: ild-partikler + røyk + flygende vrakdeler + sjokkbølge,
// pluss skjermrystelse og et svidd brennmerke som blir igjen på asfalten.
const explosion = {
  active: false,
  x: 0, y: 0,
  fire: [],      // raske, lyse gnister
  smoke: [],     // mørke, trege røykskyer som henger igjen
  debris: [],    // roterende vrakbiter
  shockwave: 0,  // radius på den ekspanderende trykkbølgen
  shake: 0,      // hvor mye skjermen rister
  timer: 0,
  duration: 130,
};

// Brennmerker som blir liggende på bakken etterpå (blekner sakte).
const scorches = [];

function triggerExplosion() {
  if (explosion.active) return;
  explosion.active = true;
  explosion.x = car.x; explosion.y = car.y;
  explosion.timer = 0;
  explosion.shockwave = 0;
  explosion.shake = 22;          // kraftig rist ved smell
  explosion.fire = [];
  explosion.smoke = [];
  explosion.debris = [];
  car.visible = false;
  car.vx = 0; car.vy = 0; car.speed = 0;

  playExplosionSound();

  // Svidd merke på bakken
  scorches.push({ x: car.x, y: car.y, r: 26, life: 1.0 });

  // Ild: mange raske gnister i alle retninger
  for (let i = 0; i < 80; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 1 + Math.random() * 9;
    explosion.fire.push({
      x: 0, y: 0,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      size: 2 + Math.random() * 14,
      color: ['#ffffff','#ffee66','#ff9900','#ff5500','#ff1100','#cc0000'][Math.floor(Math.random() * 6)],
      life: 1.0,
      decay: 0.012 + Math.random() * 0.02,
    });
  }

  // Røyk: trege, mørke skyer som vokser og stiger
  for (let i = 0; i < 22; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 0.3 + Math.random() * 2;
    const g = 40 + Math.floor(Math.random() * 50);  // gråtone
    explosion.smoke.push({
      x: 0, y: 0,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.4,
      size: 8 + Math.random() * 18,
      color: `rgb(${g},${g},${g})`,
      life: 1.0,
      decay: 0.006 + Math.random() * 0.006,
    });
  }

  // Vrakdeler: biter av bilen som spinner og spretter utover
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 3 + Math.random() * 7;
    explosion.debris.push({
      x: 0, y: 0,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      w: 3 + Math.random() * 7,
      h: 2 + Math.random() * 5,
      color: ['#e63030','#aa2020','#333333','#aad4f5'][Math.floor(Math.random() * 4)],
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.5,
      life: 1.0,
    });
  }
}

function updateExplosion() {
  if (!explosion.active) return;
  explosion.timer++;
  explosion.shockwave += 9;             // trykkbølgen vokser raskt
  explosion.shake *= 0.88;              // risten roer seg gradvis

  for (const p of explosion.fire) {
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.94; p.vy = p.vy * 0.94 + 0.12; // luftmotstand + litt tyngde
    p.life -= p.decay;
    p.size *= 0.96;
  }
  for (const p of explosion.smoke) {
    p.x += p.vx; p.y += p.vy;
    p.vy -= 0.01;        // røyk stiger
    p.size += 0.4;       // røyk vokser
    p.life -= p.decay;
  }
  for (const d of explosion.debris) {
    d.x += d.vx; d.y += d.vy;
    d.vx *= 0.97; d.vy = d.vy * 0.97 + 0.18;
    d.angle += d.spin;
    d.life -= 0.012;
  }

  if (explosion.timer >= explosion.duration) {
    explosion.active = false;
    resetCar();
  }
}

function updateScorches() {
  for (const s of scorches) s.life -= 0.0015;
  // Fjern merker som er helt falmet (holder lista kort)
  for (let i = scorches.length - 1; i >= 0; i--) {
    if (scorches[i].life <= 0) scorches.splice(i, 1);
  }
}


// --- 6. TASTATURINPUT ---
// Vi lagrer alltid tastenavnet i SMÅ bokstaver. Det er viktig: når Shift holdes
// inne sender nettleseren f.eks. "D" i stedet for "d". Slipper du Shift før
// bokstaven, kommer slipp-signalet som "d" — og "D" blir aldri nullstilt og
// henger fast. Ved å gjøre alt til små bokstaver peker samme fysiske tast alltid
// til samme navn, uansett om Shift er nede.
const keys = {};

document.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  initAudio();  // starter lyden ved første tastetrykk (nettleserkrav)
  // Hindrer scrolling med piltaster og mellomrom
  if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) {
    e.preventDefault();
  }
});

document.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

// Museklikk: brukes til nullstill-knappen for leaderboardet.
canvas.addEventListener('click', (e) => {
  // Regn om museposisjon til canvas-koordinater (canvaset kan vises i annen størrelse)
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const my = (e.clientY - rect.top) * (canvas.height / rect.height);

  const r = resetButtonRect();
  const inside = mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;

  if (inside) {
    if (resetConfirm > 0) {
      clearLeaderboard();   // andre klikk → bekreftet, slett tidene
      resetConfirm = 0;
    } else {
      resetConfirm = 180;   // første klikk → be om bekreftelse (~3 sek)
    }
  } else {
    resetConfirm = 0;       // klikk utenfor → avbryt bekreftelsen
  }
});


// --- 7. SONEDETEKSJON ---
// "Signed distance" til et avrundet rektangel: returnerer negativt tall når
// punktet er INNI formen, positivt når det er UTENFOR. Denne tar hensyn til de
// buede hjørnene (i motsetning til en vanlig firkant-sjekk), så dødssonen
// stemmer nøyaktig med asfalten — også i svingene.
function sdRoundRect(px, py, x, y, w, h, r) {
  const ccx = x + w / 2, ccy = y + h / 2;   // senter
  const qx = Math.abs(px - ccx) - (w / 2 - r);
  const qy = Math.abs(py - ccy) - (h / 2 - r);
  const outside = Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2);
  const inside  = Math.min(Math.max(qx, qy), 0);
  return outside + inside - r;
}

function getCarZone() {
  const t = track;
  const px = car.x, py = car.y;

  // Ytterkant av hele banen, og gressplenen i midten
  const sdOuter = sdRoundRect(px, py, t.outerX, t.outerY, t.outerW, t.outerH, t.cornerR);
  const sdGrass = sdRoundRect(px, py, t.innerX, t.innerY, t.innerW, t.innerH, t.cornerR - 20);

  // Utenfor banen, eller inne på gressplenen = død
  if (sdOuter > 0 || sdGrass < 0) return 'offroad';

  // Trygg asfalt: innenfor den grå flaten OG utenfor den indre sandstripa
  const sdSafe = sdRoundRect(px, py,
    t.outerX + BUFFER, t.outerY + BUFFER,
    t.outerW - BUFFER * 2, t.outerH - BUFFER * 2, t.cornerR - 12);
  const sdInnerSand = sdRoundRect(px, py,
    t.innerX - BUFFER, t.innerY - BUFFER,
    t.innerW + BUFFER * 2, t.innerH + BUFFER * 2, t.cornerR - 10);

  if (sdSafe < 0 && sdInnerSand > 0) return 'road';
  return 'buffer';  // ellers: sandstripa (bremser)
}

// Sjekker om bilen har krysset mål-linja eller halvveis-sjekkpunktet.
function updateLapCounter() {
  const lineX = LINE_X;
  // Øvre vegbånd (der mål-linja er) og nedre vegbånd (halvveis)
  const inTopBand    = car.y > track.outerY && car.y < track.innerY;
  const inBottomBand = car.y > track.innerY + track.innerH &&
                       car.y < track.outerY + track.outerH;

  // Nederst: kryss linja (uansett retning) → halvveis-sjekkpunkt passert
  if (inBottomBand && (prevCarX - lineX) * (car.x - lineX) < 0) {
    lap.passedHalfway = true;
  }

  // Øverst: kryss mot HØYRE (venstre→høyre)
  if (inTopBand && prevCarX < lineX && car.x >= lineX) {
    if (!lap.started) {
      // Aller første kryssing fra grid → start klokka (ingen runde fullført ennå)
      lap.started = true;
      lap.startTime = performance.now();
      lap.passedHalfway = false;
    } else if (lap.passedHalfway) {
      // Fullført runde
      lap.count++;
      const now = performance.now();
      lap.lastLapTime = now - lap.startTime;

      // Var dette en ny rekord? (raskere enn den beste vi hadde fra før)
      const oldBest = leaderboard.length ? leaderboard[0] : Infinity;
      recordLapTime(lap.lastLapTime);
      if (lap.lastLapTime < oldBest) lap.recordFlash = 180;  // blink i ~3 sekunder

      lap.startTime = now;
      lap.passedHalfway = false;
    }
  }

  if (lap.recordFlash > 0) lap.recordFlash--;
  prevCarX = car.x;
}


// --- 8. OPPDATER SPILLTILSTAND ---
function update() {
  if (resetConfirm > 0) resetConfirm--;   // teller alltid ned (også under eksplosjon)

  if (explosion.active) {
    updateExplosion();
    updateScorches();
    updateEngineSound();
    return;
  }

  // Les input (alle navn er små bokstaver, se seksjon 6)
  const boost     = keys['shift'];
  const handbrake = keys[' '];
  const gas       = keys['arrowup']    || keys['w'];
  const brake     = keys['arrowdown']  || keys['s'];
  const left      = keys['arrowleft']  || keys['a'];
  const right     = keys['arrowright'] || keys['d'];

  const topSpeed = boost ? car.boostSpeed : car.maxSpeed;
  // Boost gir både høyere tak OG mer motorkraft, ellers når bilen aldri det nye taket.
  const power = boost ? car.acceleration * car.boostPower : car.acceleration;

  // Legg akselerasjon til fartvektoren i bilens retning
  if (gas)   { car.vx += Math.cos(car.angle) * power;
               car.vy += Math.sin(car.angle) * power; }
  if (brake) { car.vx -= Math.cos(car.angle) * car.acceleration * 0.6;
               car.vy -= Math.sin(car.angle) * car.acceleration * 0.6; }

  // Beregn nåværende fart (lengden av fartvektoren)
  let speed = Math.sqrt(car.vx * car.vx + car.vy * car.vy);

  // Myk fartsgrense: i stedet for å kappe brått til taket, glir farten gradvis
  // ned mot det. Det bevarer bevegelsesmengde og gir ikke en brå rykk-følelse
  // (også når du slipper boost og taket synker fra 7 til 4).
  if (speed > topSpeed) {
    const eased = Math.max(topSpeed, speed * 0.97);
    car.vx = (car.vx / speed) * eased;
    car.vy = (car.vy / speed) * eased;
    speed = eased;
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

  // Friksjon — avhenger av hva du gjør:
  //   håndbrekk → kraftig bremsing
  //   bremse    → tydelig bremsing
  //   ingenting → "fri" (ruller videre, mister nesten ingen fart)
  //   gass      → lett drag (toppfarten settes av taket)
  let frict;
  if (handbrake)     frict = car.handbrakeFriction;
  else if (brake)    frict = car.brakeFriction;
  else if (!gas)     frict = car.coastFriction;
  else               frict = car.friction;
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
  updateScorches();
  updateEngineSound();
  updateLapCounter();
  updateEasterEgg();
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

  // Rutete start/mål-linje øverst (midt på toppstykket)
  const lx = LINE_X;
  const y0 = track.outerY + BUFFER;   // øvre kant av asfalten
  const y1 = track.innerY - BUFFER;   // nedre kant av asfalten på toppstykket
  const sq = 8;                       // rutestørrelse
  for (let yy = y0; yy < y1; yy += sq) {
    for (let col = 0; col < 2; col++) {
      ctx.fillStyle = ((Math.floor(yy / sq) + col) % 2 === 0) ? '#fff' : '#111';
      ctx.fillRect(lx - sq + col * sq, yy, sq, Math.min(sq, y1 - yy));
    }
  }
}


// --- 9b. TEGN PYNT (grantrær og busker) ---
function drawSpruce(x, y, s) {
  // skygge på bakken
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.4, s * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  // liten brun stamme
  ctx.fillStyle = '#5b3a1a';
  ctx.fillRect(x - s * 0.05, y - s * 0.1, s * 0.1, s * 0.16);

  // tre grønne lag (trekanter) — mørkest nederst gir dybde, klassisk gran-form
  const greens = ['#1f5e2a', '#266a31', '#2e7a39'];
  for (let i = 0; i < 3; i++) {
    const baseY = y - s * (0.05 + i * 0.27);
    const apexY = baseY - s * 0.5;
    const halfW = s * (0.42 - i * 0.1);
    ctx.fillStyle = greens[i];
    ctx.beginPath();
    ctx.moveTo(x, apexY);
    ctx.lineTo(x - halfW, baseY);
    ctx.lineTo(x + halfW, baseY);
    ctx.closePath();
    ctx.fill();
  }
}

function drawBush(x, y, s) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.2, s * 0.7, s * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();

  // klynge av grønne sirkler
  ctx.fillStyle = '#2f7a36';
  const blobs = [[0, 0, 1], [-0.5, 0.1, 0.7], [0.5, 0.1, 0.7], [0, -0.3, 0.7]];
  for (const [dx, dy, r] of blobs) {
    ctx.beginPath();
    ctx.arc(x + dx * s * 0.6, y + dy * s, r * s * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // lysere flekk øverst for litt dybde
  ctx.fillStyle = '#3f9446';
  ctx.beginPath();
  ctx.arc(x - s * 0.15, y - s * 0.15, s * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

function drawScenery() {
  for (const o of scenery) {
    if (o.type === 'tree') drawSpruce(o.x, o.y, o.s);
    else drawBush(o.x, o.y, o.s);
  }
}

// --- 9c. TEGN STARTGRID ---
// Nummererte startbokser malt på asfalten rett bak mål-linja, trappet i to baner
// (som en ekte startoppstilling). Plass nr. 1 er der bilen din starter.
function drawStartGrid() {
  ctx.lineWidth = 2;
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  for (let i = 0; i < GRID.count; i++) {
    const x = GRID.firstX - i * GRID.stepX;            // trappet bakover
    const y = (i % 2 === 0) ? GRID.laneA : GRID.laneB; // vekslende bane
    ctx.fillStyle   = 'rgba(255,255,255,0.12)';        // svakt fyll, ser malt ut
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(x - 12, y - 8, 24, 16);
    ctx.strokeRect(x - 12, y - 8, 24, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(i + 1, x, y + 4);
  }
  ctx.textAlign = 'left';
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


// --- 12a. TEGN BRENNMERKER ---
// Svidde flekker som blir igjen på asfalten etter en eksplosjon.
function drawScorches() {
  for (const s of scorches) {
    if (s.life <= 0) continue;
    ctx.globalAlpha = s.life * 0.6;
    const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
    grad.addColorStop(0, '#000000');
    grad.addColorStop(0.6, '#1a1a1a');
    grad.addColorStop(1, 'rgba(20,20,20,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// --- 12b. TEGN EKSPLOSJON ---
function drawExplosion() {
  if (!explosion.active) return;
  const ex = explosion.x, ey = explosion.y;

  // Kraftig hvit-gul flash de første bildene (litt større enn skjermen
  // så skjermrystingen ikke etterlater en udekket stripe i kanten)
  if (explosion.timer < 6) {
    const alpha = ((6 - explosion.timer) / 6) * 0.85;
    ctx.fillStyle = `rgba(255, 240, 180, ${alpha})`;
    ctx.fillRect(-40, -40, canvas.width + 80, canvas.height + 80);
  }

  // Sjokkbølge: en ekspanderende ring som blekner
  if (explosion.timer < 30) {
    const alpha = 1 - explosion.timer / 30;
    ctx.globalAlpha = alpha * 0.8;
    ctx.strokeStyle = '#ffdd88';
    ctx.lineWidth = 6 * alpha + 1;
    ctx.beginPath();
    ctx.arc(ex, ey, explosion.shockwave, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Røyk bak ilden (tegnes først så ilden ligger oppå)
  for (const p of explosion.smoke) {
    if (p.life <= 0) continue;
    ctx.globalAlpha = Math.max(0, p.life) * 0.55;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(ex + p.x, ey + p.y, Math.max(0.1, p.size), 0, Math.PI * 2);
    ctx.fill();
  }

  // Ild-gnister med "glød" (lighter-blanding gjør at de lyser når de overlapper)
  ctx.globalCompositeOperation = 'lighter';
  for (const p of explosion.fire) {
    if (p.life <= 0) continue;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(ex + p.x, ey + p.y, Math.max(0.1, p.size), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  // Vrakdeler som spinner
  for (const d of explosion.debris) {
    if (d.life <= 0) continue;
    ctx.globalAlpha = Math.max(0, d.life);
    ctx.save();
    ctx.translate(ex + d.x, ey + d.y);
    ctx.rotate(d.angle);
    ctx.fillStyle = d.color;
    ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // "BOOM!" som vokser og blekner
  if (explosion.timer < 40) {
    const alpha = 1 - explosion.timer / 40;
    const scale = 1 + explosion.timer / 14;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(ex, ey - 30);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center';
    ctx.font = 'bold 40px monospace';
    ctx.fillStyle   = '#ff2200';
    ctx.fillText('BOOM!', 0, 0);
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth   = 2;
    ctx.strokeText('BOOM!', 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}


// --- 12c. BILLBOARD (mørk eik) ---
// Et trepanel til høyre for banen. Her henger leaderboardet, nullstill-knappen
// og hastighetsmåleren — helt unna selve banen.
const HUD = { x: 800, y: 12, w: 186, h: 576 };

function drawBillboard() {
  const b = HUD;

  // Skygge bak panelet
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(b.x + 5, b.y + 7, b.w, b.h);

  // Vertikale planker i mørk eik (vekslende nyanser gir treverk-følelse)
  const planks = 4;
  const pw = b.w / planks;
  for (let i = 0; i < planks; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#43311d' : '#392917';
    ctx.fillRect(b.x + i * pw, b.y, pw, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';   // skjøt mellom planker
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(b.x + i * pw, b.y);
    ctx.lineTo(b.x + i * pw, b.y + b.h);
    ctx.stroke();
  }

  // Ytre ramme + en svak lyskant øverst
  ctx.strokeStyle = '#241a0e';
  ctx.lineWidth = 5;
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = 'rgba(255,220,160,0.12)';
  ctx.lineWidth = 1;
  ctx.strokeRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);

  // Fire "skruer" i hjørnene for litt sjarm
  ctx.fillStyle = '#1c140a';
  for (const [sx, sy] of [[10, 10], [b.w - 10, 10], [10, b.h - 10], [b.w - 10, b.h - 10]]) {
    ctx.beginPath();
    ctx.arc(b.x + sx, b.y + sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Inngravert tittel midt på panelet (fyller den tomme treflaten)
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,225,180,0.5)';
  ctx.font = 'bold 17px monospace';
  ctx.fillText('BILUS', b.x + b.w / 2, b.y + b.h * 0.46);
  ctx.fillText('SPILLUS', b.x + b.w / 2, b.y + b.h * 0.46 + 20);
  ctx.textAlign = 'left';
}


// --- 13. TEGN HASTIGHETSMÅLER ---
// Når boost er aktiv: oransje ring og "BOOST"-tekst i stedet for "km/h".
function drawSpeedometer() {
  const boost = keys['shift'];
  const cx = HUD.x + HUD.w / 2;            // midtstilt på billboardet
  const cy = HUD.y + HUD.h - 66;           // nederst på billboardet
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


// --- 13b. TEGN RUNDE-INFO + LEADERBOARD ---
// Panel øverst til høyre: rundenummer, tid på inneværende runde, og en topp-5
// liste over dine beste tider (lagret i nettleseren).

// Hvor stort leaderboard-panelet er (deles av tegning og museklikk-sjekk).
// Det sitter øverst på billboardet (HUD).
function lapPanelRect() {
  const x = HUD.x + 12, y = HUD.y + 14, w = HUD.w - 24;
  const rows = Math.min(leaderboard.length, 5);
  const h = rows > 0 ? 92 + rows * 16 + 6 : 104;
  return { x, y, w, h, rows };
}

// Nullstill-knappen sitter rett under panelet.
function resetButtonRect() {
  const p = lapPanelRect();
  const w = 150, h = 24;
  return { x: p.x + p.w - w, y: p.y + p.h + 6, w, h };
}

function drawLapInfo() {
  const { x, y, w, rows } = lapPanelRect();

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x, y, w, lapPanelRect().h);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('RUNDE ' + lap.count, x + 10, y + 22);

  ctx.font = '12px monospace';
  // Klokka teller først når du har krysset startlinja
  const current = lap.started ? (performance.now() - lap.startTime) : 0;
  ctx.fillText('Tid:  ' + formatTime(current), x + 10, y + 40);

  // Forrige fullførte runde — oppdateres hver runde, også uten rekord
  ctx.fillStyle = '#cfcfcf';
  ctx.fillText('Forrige: ' + (lap.lastLapTime ? formatTime(lap.lastLapTime) : '--.--'), x + 10, y + 58);

  // Overskrift for lista — bytter til blinkende "NY REKORD!" rett etter en rekord
  if (lap.recordFlash > 0 && Math.floor(lap.recordFlash / 15) % 2 === 0) {
    ctx.fillStyle = '#ffd24a';
    ctx.fillText('★ NY REKORD! ★', x + 10, y + 78);
  } else {
    ctx.fillStyle = '#9fd0ff';
    ctx.fillText('Beste tider:', x + 10, y + 78);
  }

  if (rows === 0) {
    ctx.fillStyle = '#888';
    ctx.fillText('(ingen ennå)', x + 14, y + 94);
  } else {
    for (let i = 0; i < rows; i++) {
      ctx.fillStyle = i === 0 ? '#ffd24a' : '#dddddd';  // rekorden i gull
      ctx.fillText((i + 1) + '.  ' + formatTime(leaderboard[i]), x + 14, y + 94 + i * 16);
    }
  }
}

// --- 13c. TEGN NULLSTILL-KNAPP ---
// Klikkbar knapp under leaderboardet. Krever to klikk (bekreftelse) så tidene
// ikke slettes ved et uhell.
function drawResetButton() {
  const r = resetButtonRect();
  const confirming = resetConfirm > 0;

  ctx.fillStyle   = confirming ? 'rgba(150,30,30,0.85)' : 'rgba(0,0,0,0.55)';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = confirming ? '#ff6655' : '#666';
  ctx.lineWidth   = 1.5;
  ctx.strokeRect(r.x, r.y, r.w, r.h);

  ctx.fillStyle = '#fff';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(confirming ? 'Sikker? Klikk igjen' : '↺ Nullstill tider', r.x + r.w / 2, r.y + r.h / 2 + 4);
  ctx.textAlign = 'left';
}


// --- 14. TEGN ALT ---
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Skjermrysting under eksplosjon: flytt hele bildet litt tilfeldig.
  // save/restore sørger for at forskyvningen nullstilles til neste bilde.
  ctx.save();
  if (explosion.active && explosion.shake > 0.5) {
    const dx = (Math.random() - 0.5) * 2 * explosion.shake;
    const dy = (Math.random() - 0.5) * 2 * explosion.shake;
    ctx.translate(dx, dy);
  }

  drawTrack();
  drawStartGrid();
  drawScorches();
  drawSkidMarks();
  drawEasterEgg();   // gress-rekorden — del av kartet (rister med under eksplosjon)
  drawScenery();
  drawCar();
  drawExplosion();

  ctx.restore();  // slutt skjermrysting — HUD under skal stå stille

  drawBillboard();    // tre-panelet bak HUD-elementene
  drawSpeedometer();
  drawLapInfo();
  drawResetButton();

  // Måler tekstbredden først, så boksen alltid blir bred nok (ingen overflyt).
  const hint = 'WASD / piltaster  •  Shift = boost  •  Mellomrom = drift';
  ctx.font = '13px monospace';
  const hintW = ctx.measureText(hint).width;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(8, 8, hintW + 16, 26);
  ctx.fillStyle = '#fff';
  ctx.fillText(hint, 16, 26);

  // Versjonsnummer nede til venstre (diskret)
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(VERSION, 10, canvas.height - 10);
}


// --- 15. SPILLØKKEN ---
// VIKTIG: vi skiller mellom "simulering" (update) og "tegning" (draw).
//
// Før kjørte vi update() én gang per bilde skjermen tegnet. Problemet: en 144 Hz-
// skjerm tegner langt flere bilder per sekund enn en 60 Hz-skjerm, så bilen — og
// alt annet — beveget seg mye fortere hos noen. Urettferdig og inkonsekvent.
//
// Løsning: et FAST TIDSSTEG. Vi kjører alltid simuleringen 60 ganger i sekundet,
// uansett hvor ofte skjermen tegner. Vi måler hvor mye ekte tid som har gått, og
// kjører update() akkurat så mange faste steg som trengs for å holde tritt.
const FIXED_DT = 1000 / 60;   // ett steg = 16,67 ms (= 60 steg i sekundet)
let lastTime = null;
let accumulator = 0;          // oppsamlet ekte tid som ennå ikke er simulert

function gameLoop(now) {
  if (lastTime === null) lastTime = now;
  accumulator += now - lastTime;
  lastTime = now;

  // Har fanen ligget i bakgrunnen lenge, ikke "ta igjen" alt på én gang
  if (accumulator > 250) accumulator = 250;

  // Kjør fysikken i faste steg til vi har tatt igjen sanntiden
  while (accumulator >= FIXED_DT) {
    update();
    accumulator -= FIXED_DT;
  }

  draw();
  requestAnimationFrame(gameLoop);
}

buildEasterEgg();   // "plant" gresset som staver vennens rekord før vi starter
requestAnimationFrame(gameLoop);
