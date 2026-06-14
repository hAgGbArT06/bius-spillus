# MANIFEST — Bilus-spillus

## Beskrivelse
Et enkelt top-down 2D bilspill i nettleseren, inspirert av Super Mario Kart på SNES.
Singleplayer. Målet er å lære kodeflyten steg for steg.

## Teknologi
- Ren JavaScript (ingen rammeverk)
- HTML5 Canvas for grafikk
- Kjøres rett i nettleser via Live Server

## Filer
| Fil | Hva den gjør |
|-----|-------------|
| `index.html` | Setter opp HTML-siden og canvas-elementet |
| `game.js` | All spillogikk: bane, bil, bevegelse, input, lyd og effekter |
| `MANIFEST.md` | Denne filen — oversikt over prosjektet |

## Ferdige funksjoner
- [x] Grunnoppsett: HTML-side med canvas
- [x] Bane tegnet med grønt gress, grå asfalt og sandfarget buffersone
- [x] Bil (rektangel) som kan kjøres med piltastene
- [x] Buffersone langs vegkant: bremser kraftig når du kjører ut i sanden
- [x] Eksplosjon med partikler, flash og BOOM!-tekst når du kjører av banen
- [x] Automatisk reset til startposisjon etter eksplosjon
- [x] Hastighetsmåler (buemåler, grønn→rød) nede til høyre
- [x] WASD-kontroller (i tillegg til piltaster)
- [x] Shift = boost (høyere topfart, oransje HUD)
- [x] Mellomrom = håndbrekk / drift (minimalt grep, skarpere sving)
- [x] Fartbasert understyring — bilen skrenser mer jo fortere den kjører
- [x] Bremsemerker på asfalten ved skrensing
- [x] Sonedeteksjon med avrundede hjørner (signed distance function)
- [x] Lyd via Web Audio API (myk motorbrum med vibrato + filter, følger farten + eksplosjonssmell)
- [x] Brutal eksplosjon: ild, røyk, vrakdeler, sjokkbølge, skjermrysting og brennmerke

## Gjenstår / neste steg
- Runde-teller / tidtaker
- Motstandere eller hindringer
- Flere lyder (drift-skrik, boost-sus, kollisjon)

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
