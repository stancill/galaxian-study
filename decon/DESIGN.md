# GALAXIAN (1979) — Complete Deconstruction for a Browser Rebuild

Deconstructed from the original ROM set in this directory (`galmidw.u/v/w/y`, `7l`,
`1h.bin`, `1k.bin`, `6l.bpr`). Set identity **verified by CRC** against MAME's
`galaxian` driver (`decon/mame_reference/`): this is the **original Midway US
Galaxian** ("galaxian" set — identical to `galmidw` except where the attract screen
prints the "BONUS SHIP" line).

Evidence legend — **[SEEN]** read directly from the ROMs/disassembly in this repo;
**[DOC]** from the MAME galaxian driver (hardware behavior, cited in
`decon/mame_reference/`); **[INFERRED]** deduced, verify during tuning.

---

## 1. Hardware platform [DOC]

| Component | Spec |
|---|---|
| CPU | Zilog Z80 @ 3.072 MHz (18.432 MHz XTAL ÷ 6) |
| Video clock | 6.144 MHz pixel clock, 1 pixel = 1 shift |
| Sync | 60.6060 Hz frame; VBlank ≈ 2500 µs |
| Interrupt | **NMI once per frame** (0x0066) — the whole game is a 60 Hz state machine |
| Sound | Discrete board: 18.432 MHz XTAL ÷ 6 = 1.536 MHz tone clock, LFSR noise generator, LFO warble, shoot sweep. No sound CPU, no sound ROM. |
| Watchdog | Read of `$7800-$78FF` clears it; game re-reads it in the main loop |

## 2. Memory map [DOC + SEEN]

```
READ
  $0000-$1FFF  program ROM (galmidw.u@0000, v@0800, w@1000, y@1800)   [SEEN: boot code]
  $2000-$27FF  program ROM (7l) — attract-mode text + choreography    [SEEN: CRC match, JP $2000 at $1BCA]
  $4000-$47FF  game RAM (2 KB: score, lives, 48 enemy slots, pointers)
  $5000-$53FF  RAM (mirrors/scratch)
  $5400-$57FF  video RAM READ-BACK window (VRAM is write-only at $5000)
  $5800-$58FF  RAM
  $6000        IN0  (coin/start)
  $6800        IN1  (left/right/fire)
  $7000        IN2  (DIP switches)
  $7800        watchdog clear (also read as sound "pitch" bus context) [DOC]

WRITE
  $5000-$53FF  video RAM (1 KB, 32×32 tiles of 8×8)
  $5800-$583F  attribute RAM (2 bytes per column: +0 = unused/scroll, +1 = 3-bit color code)
  $5840-$585F  sprite RAM (8 slots × 4 bytes)
  $5860-$587F  bullet RAM (8 slots × 4 bytes)
  $6000-$6001  cabinet LEDs
  $6002        coin lockout
  $6003        coin counter
  $6004-$6007  LFO frequency bits (dive-warble pitch select)
  $6800-$6802  background hum enable
  $6803        noise enable (explosions)
  $6805        shoot enable
  $6806-$6807  volume
  $7001        NMI enable (NMI handler starts by clearing it, main loop re-enables) [SEEN at 0x0066]
  $7004        starfield enable                                                      [SEEN: boot sets it]
  $7006/$7007  flip screen X / Y                                                     [DOC: attract flips]
```

## 3. Video system [DOC]

- Native canvas: **224×256 portrait** (a 256×256 generator, 224 visible), displayed rotated → 256×224 landscape... on the original upright cab it's a vertical monitor. For the browser: render 224×256 and show it at ~3:4.
- Playfield is **28 columns × 32 rows** of 8×8 tiles (centered in the 32-column VRAM with 2 columns border each side).
- 4 overlay planes, painted in this order: black background → **starfield** → tiles → **bullets** → sprites.
- **Sprites**: 8 hardware slots (game uses 7: Galaxip, up to 6 divers). 16×16, 2bpp, 6-bit code + flipX/flipY + 3-bit color. RAM format per slot: `+0 = Y, +1 = code|flipY<<7|flipX<<6, +2 = color, +3 = X(+1 hardware offset)`.
- **Bullets**: 8 hardware positions (7 enemy shots + 1 player shot), each drawn as a **4-pixel vertical streak**. Player bullet = yellow `(239,239,0)`, enemy bullets = white `(239,239,239)`. [DOC: `galaxian_draw_bullets`, `PALETTE_INIT`]
- Screen flip X/Y latches — the attract mode flips the whole screen upside down mid-demo.

## 4. Palette — exact DAC values

32-entry palette PROM `6l.bpr`, one byte per entry [SEEN bytes, DOC decode]:

```
R = 0x21·b0 + 0x47·b1 + 0x97·b2      (bits 0-2)
G = 0x21·b3 + 0x47·b4 + 0x97·b5      (bits 3-5)
B = 0x4f·b6 + 0xa8·b7                (bits 6-7)
```

All 32 entries are in `decon/palette.json` with raw PROM bytes. Key entries:

| idx | byte | RGB | use [INFERRED from art] |
|---|---|---|---|
| 0-2 | 00 | (0,0,0) | black |
| 3 | f6 | (222,222,247) | "white" text/ship (lavender-white on CRT) |
| 5 | 16 | (222,71,0) | red-orange |
| 6 | c0 | (0,0,247) | blue |
| 7 | 3f | (255,255,0) | yellow |
| 10 | 07 | (255,0,0) | red |
| 14 | c4 | (151,0,247) | purple/magenta |
| 31 | c6 | (222,0,247) | pink/magenta |

**Star colors**: 64-entry hardware palette, 2 bits per channel through map `{0x00,0x88,0xcc,0xff}` [DOC].

**Tile color codes**: attribute RAM gives a 3-bit palette base per **column** (all tiles in a column share it; the per-row color shifts you see on aliens come from the animation frames themselves). Sprites use their own 3-bit color code. The color code selects `palette[code*4 + pixel]` style group of 4 entries per code with pen 0 transparent — replicate via MAME `colortable` (gfx color_groups = 8, granularity 4).

## 5. Graphics format

**Tiles (8×8, 2bpp, 256 total)** [SEEN, decode verified visually]:
```
plane0 = 1h.bin, plane1 = 1k.bin
tile n:  byte (row y) of tile = ROMplane[n*8 + y], MSB = leftmost pixel
pixel = plane0_bit | plane1_bit<<1
```
Tile inventory [SEEN]: `$00-$1F` letters/symbols (text tiles, tile = ASCII − 0x40), `$20-$3F` digits/punct, `$40-$43` blank (space), then alien char frames, flagship, Galaxip, explosions `$C0+`.

**Sprites (16×16, 2bpp, 64 total)** [DOC `galaxian_spritelayout`, render `decon/sprites.png`]:
```
sprite n = tiles [4n, 4n+1, 4n+2, 4n+3] assembled as TL, TR, BL, BR
```
Sprite inventory [SEEN from render]: drones (2 anim frames), red emissives (2 frames), purple rank (2 frames), flagship (top/bottom halves = 2 consecutive codes), **score popups "150", "200", "300", "800"**, Galaxip ship, enemy-hit starburst (2 frames), big player-death fireball frames. Sprite codes 0-7 are font fragments (never used).

**Machine-readable copies**: `decon/gfx.json` (all 256 tiles + 64 sprites as pixel arrays).

## 6. Starfield — exact algorithm [DOC]

Hardware LFSR, replicate in JS:

```js
// birth pass (once at boot, builds the fixed star table):
let g = 0; const stars = [];
for (let y = 0; y < 256; y++) for (let x = 0; x < 512; x++) {
  const bit0 = ((~g >>> 16) & 1) ^ ((g >>> 4) & 1);
  g = ((g << 1) | bit0) & 0x1ffff;
  if (((~g >>> 16) & 1) && (g & 0xff) === 0xff) {
    const color = (~(g >>> 8)) & 0x3f;
    if (color) stars.push({x, y, color});   // ~256 stars total
  }
}
// per frame (scrollpos++ each frame, wraps):
x = ((s.x + scrollpos) & 0x1ff) >> 1;
y = (s.y + ((scrollpos + s.x) >>> 9)) & 0xff;
if (((y & 1) ^ ((x >> 3) & 1))) plot(x, y, starColor[s.color]);  // twinkle
```
Stars scroll slowly left (half x-speed) with slight vertical drift, twinkling. Enable latch = `$7004`.

## 7. Sound system [DOC sndhrdw + SEEN latch writes]

No sound CPU — everything is discrete logic, perfect for WebAudio synthesis:

| Event | Trigger | Synthesis recipe |
|---|---|---|
| Galaxip shot ("pew") | `$6805` shoot enable | pitch sweep ~2672 Hz base, falling, ~0.3 s |
| Alien hit pop | noise `$6803` burst | short filtered LFSR noise burst |
| Galaxip explosion | noise, long | 4 s LFSR noise source (RNG clock = 6.144 MHz, sample rate ≈ 8 kHz), amplitude envelope |
| Dive warble | `$6004-$6007` LFO freq bits | tone ~139 Hz ±139/3 Hz, vibrato; pitch rises as divers descend — the iconic "woo-woo" |
| Background hum | `$6800-$6802` | 32-step square wave (16×+A, 16×−A), quiet |
| Tone pitch/vol | `$7800` pitch, `$6806/7` vol | 16-step "toothsaw" waveform, 4 volume steps |

Boot writes `$7004=1, $7002=1, $7003=1, $7001=1` then jumps to attract [SEEN at `$1BB1-$1BCA`].

## 8. Game mechanics

### Controls
Left / Right / Fire (fire = one player bullet on screen at a time). [DOC input ports]

### Fleet & formation [SEEN art, INFERRED layout during tuning]
4 ranks. Formation parked in VRAM as tiles; up to 6 enemies at a time detach as **hardware sprites** to dive. Ranks & per-alien scores — **from the ROM's own SCORE ADVANCE TABLE** (`7l` @ `$244D-$2497`) [SEEN]:

| Rank | In formation | While diving |
|---|---|---|
| Drone (blue, bottom rows) | 30 | 60 |
| Emissive (purple) | 40 | 80 |
| Commander (red) | 50 | 100 |
| **Flagship** | 60 | 300 |

### CONVOY CHARGER — the flagship bonus ladder [SEEN: popup sprites "150/200/300/800" in ROM + `CONVOY@@CHARGER` attract text]
When the flagship dives with escorts (adjacent drones peel off with it), shooting the convoy in one pass pays a bonus popup instead of the plain scores:

| Situation | Popup |
|---|---|
| Flagship dives alone, destroyed | 150 |
| Flagship + 1 escort | 200 |
| Flagship + 2 escorts (flagship shot first) | 300 |
| Flagship + 2 escorts, escorts destroyed first, **flagship last** | **800** |

### Lives, bonus, coinage [SEEN: `$1F12` DIP table in main ROM + `7l` strings]
- Lives: **2 or 3 Galaxips** (DIP).
- Bonus Galaxip at **7000 / 10000 / 12000 / 20000** (DIP; attract prints "BONUS GALAXIP FOR 7000").
- Coinage: 1COIN 1CREDIT / 2COINS 1CREDIT / 1COIN 2CREDITS / FREE PLAY (DIP).
- High score persisted (attract: `HIGH@SCORE`).

### Waves & difficulty [INFERRED — confirm against MAME]
- Destroy the whole fleet (or its divers) → next wave re-forms and dives more aggressively; dive frequency, bullet rate and convoy behavior scale with wave count. Formation re-entries use swoop paths (choreography tables in main ROM `$1E60-$1EC8`: alternating frame codes 02 03 / 05 06 / 07 08 / 09 0A per rank, ascending/descending sway runs [SEEN]).
- Enemy bullets accelerate downward; max 7 in flight (hardware).

### Attract mode [SEEN: entire module `7l` @ `$2000-$27FF`]
Sequence: `WE ARE THE GALAXIANS` → `MISSION: DESTROY ALIENS` → `SCORE ADVANCE TABLE` (alien icons + 30/60/40/80/50/100/60/300) → `CONVOY CHARGER` → `PUSH START BUTTON`, `PLAYER ONE`/`PLAYER TWO`, `GAME OVER`, `CREDIT 0`, screen flips upside-down. Text engine: strings stored ASCII+command bytes (`R`,`S`,`O`,`[` = position/draw ops), drawn via tile codes (ASCII − 0x40).

### NMI (frame) flow [SEEN at $0066]
Push regs → disable NMI → read/copy inputs → run one game tick (formation sway, dive dispatch, bullets, collisions, score/high-score, attract) → render state into VRAM/sprite/bullet RAM → re-enable NMI, return. Everything is frame-locked at 60 Hz — **do the same in the browser with a fixed-timestep accumulator**.

## 9. Disassembly evidence

- `decon/disassembly_main.txt` — full 8 KB, recursive-descent (Ghidra Z80), data shown as DEFB.
- `decon/disassembly_attract_7l.txt` — the `$2000` module.
- `decon/mame_reference/` — MAME 2003-plus driver/video/sound sources used as the hardware cross-check.
- Key SEEN code landmarks: boot `0000: XOR A / LD ($7001),A / JP $1A55`; NMI `0066`; input helpers `003C`; sound init `1BB1-1BC9` → `JP $2000`; attract strings `7l` `$237F-$24B1`.

## 10. Suggested browser architecture

```
canvas 224×256 logical, integer-scaled, imageRendering: pixelated
fixed 60 Hz tick (accumulator), then render
gfx.json   → pre-render 256 tiles + 64 sprites to offscreen canvases (colorized per palette code)
palette.json → direct RGB
starfield  → exact LFSR from §6 (birth pass once, then scroll+twinkle per frame)
entities   → fleet matrix (VRAM tiles) + diver sprite slots (7) + 8 bullet slots
audio      → WebAudio: sweep osc (shot), noise buffer + bandpass (pops/explosions),
             LFO'd osc (dive warble), square hum loop
states     → ATTRACT → PLAY → READY → GAME_OVER (attract text renderer from 7l strings)
```

Legal note: the *code and art in the ROMs are copyrighted* (Namco). This deconstruction
is for study; the rebuild should use the extracted data as reference for your own
implementation (mechanics, palette numbers, and formats aren't protectable; the pixel
art and ROM code are).
