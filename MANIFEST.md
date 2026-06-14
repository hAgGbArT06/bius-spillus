# MANIFEST — Bilus-spillus

## Beskrivelse
Et top-down 2D bilspill i nettleseren, inspirert av Super Mario Kart på SNES.
Starter som singleplayer og skal vokse til flere baner, turnering og flerspiller.
Et viktig delmål er å lære kodeflyten steg for steg.

## Teknologi
- Ren JavaScript (ingen rammeverk)
- HTML5 Canvas for grafikk
- Kjøres rett i nettleser via Live Server

> **Konvensjon:** Versjonsnummeret (`VERSION` i game.js, vises nede til venstre) bumpes ved hver oppdatering.
- Ingen byggeverktøy / ingen npm i dag. Dette må revurderes i Fase 3 (online flerspiller krever en server — webhotell er på vei).

## Filer
| Fil | Hva den gjør |
|-----|-------------|
| `index.html` | Setter opp HTML-siden og canvas-elementet |
| `game.js` | All spillogikk: bane, bil, bevegelse, input, lyd og effekter |
| `MANIFEST.md` | Denne filen — oversikt, veikart og endringslogg |

---

## Veikart (faser)

Prosjektet er delt i tre faser. Hver fase bygger på den forrige.
`[x]` = ferdig, `[ ]` = gjenstår, `[~]` = påbegynt.

### Fase 1 — Grunnlaget (FERDIG ✅)
Mål: solid kjørefølelse og en komplett singleplayer-runde.

Ferdig:
- [x] Grunnoppsett: HTML-side med canvas
- [x] Bane med grønt gress, grå asfalt og sandfarget buffersone
- [x] Bil som kjøres med piltaster og WASD
- [x] Buffersone langs vegkant (bremser kraftig i sanden)
- [x] Fartvektor-fysikk: boost (Shift), håndbrekk/drift (mellomrom), understyring
- [x] Bremsemerker på asfalten ved skrensing
- [x] Sonedeteksjon med avrundede hjørner (signed distance function)
- [x] Brutal eksplosjon (ild, røyk, vrakdeler, sjokkbølge, skjermrysting, brennmerke) + auto-reset
- [x] Lyd via Web Audio API (motorbrum som følger farten + eksplosjonssmell)
- [x] Hastighetsmåler (buemåler, grønn→rød)
- [x] Rundeteller med tidtaker og rutete start/mål-linje
- [x] Pynt: grantrær og busker i de grønne områdene
- [x] Leaderboard: dine 5 beste rundetider lagret i nettleseren (localStorage) + «NY REKORD!»-blink
- [x] Startgrid: nummererte startbokser malt på asfalten bak mål-linja
- [x] Fast tidssteg i spilløkken — lik fart på alle skjermer (uavhengig av Hz), rundetider blir sammenlignbare
- [x] Versjonsnummer nede til venstre (så alle kan sjekke samme versjon)
- [x] Easter egg: hilsen + vennens rekord ("Entps / #2.75") gror frem som gress oppe til venstre
- [x] Klikkbar nullstill-knapp for leaderboardet (med to-klikks bekreftelse)
- [x] Bredere spillvindu (1000×600) med et «billboard» i mørk eik til høyre — tider, nullstill-knapp og hastighetsmåler flyttet dit (ikke lenger oppå banen)
- [x] «Forrige runde»-tid i HUD-en (oppdateres hver runde, også uten rekord)
- [x] Ekte racing-start: bilen spawner på pole (plass 1) bak startlinja, og klokka starter først når du krysser linja
- [x] Dekkspor: 2 spor (bakhjul) normalt, alle 4 hjul ved kraftig driftvinkel
- [x] Mellomrom = ekte drift-knapp (beholder fart, lavt grep, skarp sving = lange drifter)
- [x] Fintuning av fysikkmotor og kjøreprofil — brukeren er fornøyd med kjørefølelsen
- [x] Lyder: motorbrum og eksplosjonssmell (drift-skrik og boost-sus ble testet, men fjernet — brukeren likte dem ikke)
- [x] Meny / tilstand-system: startmeny (tre-bakgrunn), banevalg, innstillinger (volum + bilfarge), Esc = tilbake til meny
- [x] Per-bane leaderboard (Rektangelen beholder gamle tider) — klargjort for flere baner i fase 2
- [x] **Data-drevet bane**: all bane-geometri (form, buffer, startlinje, grid, spawn, scenery) bor i `TRACKS`. En ny bane = en ny oppføring i lista. `applyTrackGeometry()` peker «aktiv bane» om ved banevalg.

- [x] Pausemeny: Esc eller pause-ikon i et løp → pause (klokka fryser). Valg: Innstillinger eller Tilbake til meny. Innstillinger husker om du kom fra meny eller pause.

**✅ FASE 1 ER LUKKET!** Klar for fase 2 (flere baner + turnering).

### Fase 2 — Baner & turnering
Mål: flere baner å velge mellom, og en turnering (cup) å konkurrere i.
Bygger direkte på singleplayer + rundetider fra fase 1.

- [ ] Data-drevet bane-format (krever «data-drevet bane» fra fase 1)
- [ ] Flere baner med ulik layout (2–3 stk)
- [ ] Banevelger i menyen
- [ ] AI-motstandere (datastyrte biler som følger banen) — *gjør løp til ekte konkurranse*
- [ ] Turneringsmodus: serie av løp, poeng per plassering, sammenlagt-tabell
- [ ] Lagre turneringsresultater (localStorage)

### Fase 3 — Flerspiller (ONLINE)
Mål: flere spillere konkurrerer over nett. Største teknologispranget — gjøres sist.
**Beslutning tatt:** vi satser på *online* flerspiller. Brukeren får tilgang til et
webhotell snart; konkrete tekniske detaljer (server, protokoll) avklares når det er på plass.

- [ ] Velge server-/nettverksløsning (avklares når webhotellet er klart)
- [ ] Server + nettverkssynkronisering av bilposisjoner
- [ ] Lobby / bli-med-system (gjenbruker meny-systemet fra fase 1)
- [ ] Flerspiller-turnering (kombinerer fase 2 + fase 3)

---

## Avhengigheter & rekkefølge
- **Fase 2 før fase 3.** Baner/turnering gjenbruker eksisterende singleplayer-logikk → lav risiko og mye nytt innhold raskt. Flerspiller er det største teknologispranget og har godt av et modent fundament.
- **Felles forutsetning (gjøres tidlig):** data-drevet bane + meny/tilstand-system. Banebytte, turnering og flerspiller-lobby trenger alle dette. Derfor ligger de som siste punkt i fase 1.
- **AI-motstandere** er forutsetning for at turnering skal være gøy (ellers er det bare tidskjøring). De kan også gjenbrukes som «fyll» i flerspiller.
- **Online flerspiller (besluttet)** krever en server. Det bryter dagens «kjør via Live Server, ingen npm»-ramme, så teknologivalget må revurderes når vi når fase 3. Brukeren får webhotell snart — detaljene avklares da.

## Åpne beslutninger
- Server-/nettverksløsning for online flerspiller (avklares når webhotellet er klart).
- Hvor mye av «ingen byggeverktøy / ingen npm» vi beholder når serveren kommer inn i fase 3.

---

## Endringslogg
| Dato | Endring |
|------|---------|
| 2026-06-14 | Opprettet prosjekt, grunnoppsett med bane og spillbar bil |
| 2026-06-14 | Fikset banefargene (vei grå, gressplen grønn) |
| 2026-06-14 | Lagt til buffersone, eksplosjon og hastighetsmåler |
| 2026-06-14 | Fikset ujevn vegbredde — nå 125px på alle fire sider |
| 2026-06-14 | WASD-kontroller, Shift-boost, håndbrekk/drift og understyring |
| 2026-06-14 | Fiks: bred nok tekstboks, nullstiller taster ved død, boost gir reell fart, mer bevegelsesmengde, hjørne-nøyaktig sonedeteksjon |
| 2026-06-14 | Lyd (motor + eksplosjon) og kraftig oppgradert eksplosjonseffekt |
| 2026-06-14 | Mykere motorlyd: trekant-bølge, lavpassfilter, vibrato og stille tomgang |
| 2026-06-14 | Fiks: taster lagres som små bokstaver — svingingen henger ikke lenger ved boost+sving |
| 2026-06-14 | Rundeteller med tidtaker + mål-linje, og grantrær/busker som pynt |
| 2026-06-14 | Utvidet MANIFEST med veikart i tre faser, avhengigheter og åpne beslutninger |
| 2026-06-14 | Besluttet online flerspiller for fase 3 (webhotell på vei, detaljer senere) |
| 2026-06-14 | Leaderboard med 5 beste rundetider (localStorage) + startgrid-markører på asfalten |
| 2026-06-14 | Fast tidssteg i spilløkken — spillet kjører likt på alle skjermer uansett oppdateringsfrekvens |
| 2026-06-14 | Versjonsnummer (v1.1) i hjørnet + easter egg: vennens rekord 2.75 gror frem som gress |
| 2026-06-14 | Klikkbar nullstill-knapp for leaderboardet (to-klikks bekreftelse) |
| 2026-06-14 | Bredere canvas (1000×600) + billboard i mørk eik for HUD, så banen ikke blokkeres (v1.2) |
| 2026-06-14 | Coasting/«fri» når ingen knapper trykkes + «forrige runde»-tid i HUD (v1.3) |
| 2026-06-14 | Startgrid flyttet til venstre, bil spawner på pole, klokka starter ved startlinja (v1.4) |
| 2026-06-14 | Dekkspor per hjul — fire parallelle spor i stedet for én senterlinje (v1.5) |
| 2026-06-14 | Drift-knapp (mellomrom) beholder fart + lavt grep for lange drifter, 2 spor normalt / 4 ved stor vinkel (v1.6) |
| 2026-06-14 | Drift-tuning: mer fart beholdt sidelengs (lavere grep + høyere friksjon), mildere sving for finjustering (v1.7) |
| 2026-06-14 | Lagt til drift-skrik og boost-sus (syntetisert støy via Web Audio) (v1.8) |
| 2026-06-14 | Drift-skrik dempet, høyere terskel (kun ved stor vinkel) og mykere klang (v1.9) |
| 2026-06-14 | Fjernet drift-skrik og boost-sus igjen (likte dem ikke) — beholder motor + eksplosjon (v2.0) |
| 2026-06-14 | Meny-system: startmeny, banevalg, innstillinger (volum + bilfarge), per-bane leaderboard (v2.1) |
| 2026-06-14 | Data-drevet bane: all geometri flyttet inn i TRACKS — FASE 1 LUKKET (v2.2) |
| 2026-06-14 | Pausemeny (Esc / pause-ikon): Innstillinger + Tilbake til meny, fryser rundeklokka (v2.3) |
| 2026-06-14 | Motorlyd dempes i alle ikke-kjørende tilstander (meny, pause osv.) (v2.4) |
