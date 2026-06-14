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
| `game.js` | All spillogikk: bane, bil, bevegelse, input |
| `MANIFEST.md` | Denne filen — oversikt over prosjektet |

## Ferdige funksjoner
- [x] Grunnoppsett: HTML-side med canvas
- [x] Bane tegnet med grønt gress, grå asfalt og sandfarget buffersone
- [x] Bil (rektangel) som kan kjøres med piltastene
- [x] Buffersone langs vegkant: bremser kraftig når du kjører ut i sanden
- [x] Eksplosjon med partikler, flash og BOOM!-tekst når du kjører av banen
- [x] Automatisk reset til startposisjon etter eksplosjon
- [x] Hastighetsmåler (buemåler, grønn→rød) nede til høyre

## Gjenstår / neste steg
- Runde-teller / tidtaker
- Motstandere eller hindringer
- Lyd (motor, kollisjon)

## Endringslogg
| Dato | Endring |
|------|---------|
| 2026-06-14 | Opprettet prosjekt, grunnoppsett med bane og spillbar bil |
| 2026-06-14 | Fikset banefargene (vei grå, gressplen grønn) |
| 2026-06-14 | Lagt til buffersone, eksplosjon og hastighetsmåler |
| 2026-06-14 | Fikset ujevn vegbredde — nå 125px på alle fire sider |
