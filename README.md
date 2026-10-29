# GALAXIAN — Study Rebuild

A from-scratch browser rebuild of the 1979 Namco/Midway *Galaxian* arcade machine,
built from a hardware-level deconstruction of how the original board works —
**without shipping any of Namco's copyrighted material** (no ROMs, no extracted
art, no disassembly listings).

## Quick start

```
open rebuild/index.html        # macOS
# or
cd rebuild && python3 -m http.server 8000
```

No dependencies, no build step. Controls: ←/→ or A/D move · Space/Z/X fire ·
Enter or 1 start · M mute · P pause.

Headless regression tests (Node, DOM stubbed):

```
node rebuild/test_fixes.js
```

## Repo layout

| Path | What it is |
|---|---|
| `rebuild/` | The playable browser rebuild — all original code, art, and audio |
| `decon/DESIGN.md` | The full hardware deconstruction: memory map, video/sprite/bullet model, starfield algorithm, palette decode, mechanics tables |
| `decon/palette.json` | The 32-entry color PROM decoded through the documented resistor DAC (factual data) |
| `tools/extract_assets.py` | Regenerates the ROM-derived study artifacts (tile/sprite sheets, `gfx.json`) **from your own legally-dumped ROMs** |
| `tools/ghidra/` | Headless Ghidra scripts (Z80 recursive-descent disassembly) used in the study |

## What is deliberately NOT in this repo

The following artifacts were generated locally during the study and are excluded
because they derive from Namco's copyrighted ROM code and pixel art:

- the arcade ROM images (`galmidw.*`, `7l`, `1h.bin`, `1k.bin`, `6l.bpr`)
- extracted tile/sprite data (`gfx.json`) and rendered sheets (`tiles.png`, `sprites.png`)
- full Z80 disassembly listings
- emulator source snapshots used as a hardware cross-check

If you own legal ROM dumps you can regenerate the study artifacts:

```
python3 tools/extract_assets.py --roms /path/to/roms --out decon/
```

`.gitignore` blocks these patterns as defense in depth.

## Fidelity notes

**Faithful (hardware facts & game mechanics — unprotectable):** 224×256 raster at a
fixed 60 Hz tick; the tile/sprite/bullet plane model; the exact 32-color PROM values
through the documented DAC; the exact 17-bit LFSR starfield (252 stars); 8 hardware
sprite slots and 7+1 bullet slots; formation/diving/convoy scoring from the ROM's own
score-advance table (30/40/50/60 formation, doubled diving, flagship convoy ladder
150/200/300/**800**); bonus life at 7000; the documented sound-circuit recipes
(139 Hz ± 46 Hz LFO warble, sweep-generator shot, LFSR noise).

**Original (ethical choices):** all pixel art and the font are hand-drawn for this
project in the same sizes/roles/palette; all engine code is new JavaScript; attract
text is limited to short non-protectable phrases.

**Approximations (documented in code comments):** dive paths are a re-creation of the
observed silhouette (the original computes diver motion procedurally — a scan found no
trajectory tables to extract); formation layout 2+6+8+10+10; difficulty ramp constants.

## Legal

Original code and art: MIT, see `LICENSE`. *Galaxian* is a trademark of Namco; this
project uses the name only to identify the machine being studied. The method in
`decon/` and `tools/` is for study with lawfully-owned ROM dumps.
