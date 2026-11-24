# Guerriers Du Futur

A web port of **Guerriers Du Futur**, a role-playing game written in Visual Basic 6 in 2001
by Rafal Klodzinski (PROJET DU COURS 420-835, version 1.0.0, 15 septembre 2001).

Play it in any browser, on a computer or a phone: same images, same music, same rules and math as the original.

## Controls
- **Computer:** arrow keys to walk (the original Home / End / Delete / Page Down keys also work), **S** for the stats screen, mouse for menus, shops and battles.
- **Phone / tablet:** on-screen arrows and the **S** button; tap everything else. Landscape works best.

## Notes on the port
- The original MIDI music was rendered to MP3 with the GeneralUser GS soundfont.
- Saves are kept in the browser (15 slots). Slots 1–3 start with the save files shipped with the 2001 game.
- Small fixes compared to the original: music loops and comes back after shops and battles, no crashes (hero level 20+, non-numeric age, etc.), Escape no longer quits, a lost battle returns to the main menu, and the hero's action buttons are hidden once an action is chosen.

`tools/` holds the scripts that converted the original `.gdf` / `.MAP` data files and GIF animations.
