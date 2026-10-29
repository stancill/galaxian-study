# GALAXIAN — Study Rebuild

A from-scratch browser rebuild of the 1979 Namco/Midway *Galaxian* arcade machine,
built directly from the deconstruction in [`../decon/DESIGN.md`](../decon/DESIGN.md).

## Run it

No build, no dependencies:

```
open rebuild/index.html          # macOS
# or
cd rebuild && python3 -m http.server 8000   # then http://localhost:8000
```

## Controls

| Key | Action |
|---|---|
| ←/→ or A/D | Move |
| Space / Z / X | Fire |
| Enter or 1 | Start |
| M | Mute |
| P | Pause |

## What is faithful vs. original

**Faithful to the original machine (facts & mechanics — not copyrightable expression):**

- 224×256 portrait raster, 60 Hz fixed-step game loop (the NMI cadence)
- Full memory-map model: VRAM/sprite/bullet planes, paint order (stars → tiles → bullets → sprites)
- **Exact palette**: the 32-entry color PROM values decoded through the documented resistor DAC (`palette.js`)
- **Exact starfield algorithm**: the 17-bit LFSR birth pass, scroll and twinkle mask (`starfield.js`)
- Bullet hardware: 7 enemy shots + 1 player shot, 4-pixel streaks, player yellow / enemies white, enemy shots accelerate
- Fleet structure and scoring from the ROM's own score advance table: 30/40/50/60 in formation, doubled when diving (60/80/100, flagship 300)
- **Convoy charger ladder**: flagship dive 150 alone / 200 with 1 escort / 300 with 2 escorts / **800 for escorts-first-flagship-last**
- Bonus Galaxip at 7000, 3 lives, full attract sequence. The flip-screen hardware
  latches ($7006/$7007) are implemented, but the browser attract keeps text upright —
  the original's mid-attract 180° flip relies on the cabinet's rotating yoke and
  reads as broken in a window. during the score table
- Sound synthesis recipes from the documented board: shoot sweep, LFSR noise pops/explosions, the 139 Hz ±46 Hz LFO dive warble, background hum

**Original (ethical choices — see "Fidelity & credits"):**

- All pixel art (aliens, flagship, Galaxip, explosions, font) is hand-drawn for this
  project. Same sizes, roles, animation frames and palette as the 1979 art so it reads
  as the same game, but **no bitmaps were copied from the ROMs**.
- All engine code is new JavaScript; nothing was translated from the Z80 ROM.
- The attract text is limited to short non-protectable phrases ("WE ARE THE GALAXIANS",
  "PUSH START BUTTON", scoring labels).
- "Galaxian" appears only as a nominative reference to the machine being studied.
  If you ever distribute this, rename it.

**Approximations (tuned, not yet byte-exact vs. MAME):**

- Formation layout 2+6+8+10+10 = 36 enemies in 5 rows
- Dive trajectories are parametric swoops capturing the peel-off → curve → wiggle-dive →
  return-to-slot phases, not the ROM's exact path tables
- Difficulty ramp (dive interval / max concurrent divers / bullet rate) is approximate

## Files

- `palette.js` — PROM bytes + DAC decode, star colors, bullet colors
- `art.js` — hand-drawn font + sprites (bitmap strings)
- `starfield.js` — the LFSR star generator
- `audio.js` — WebAudio synthesis of the discrete sound board
- `game.js` — engine, states (attract/ready/play/over), dives, convoy scoring

## Credits

Machine deconstruction: `../decon/` (ROM analysis + MAME galaxian driver reference).
This is a study/educational project. Galaxian is © Namco (trademark & original assets) —
this project ships none of them.
