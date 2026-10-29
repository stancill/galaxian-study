# Deconstruction method

How this study was performed, so the results are reproducible from your own
lawfully-obtained ROM dumps. The ROM-derived outputs (disassemblies, extracted
graphics) are intentionally not committed; the tools here regenerate them.

## 1. Set identification

CRC-32 of every ROM file was compared against the ROM definitions in the MAME
`galaxian` driver. All eight files matched the MAME "galaxian" set (original
Midway US Galaxian), including the 2 KB program extension ROM mapped at $2000.

## 2. Disassembly

Headless Ghidra (Z80:LE:16) with recursive-descent disassembly seeded from the
reset vector, RST vectors, and the NMI vector ($0066); unvisited bytes are
emitted as data so the full 8 KB + 2 KB space is inspectable:

```
analyzeHeadless proj galx -import galaxian.rom -processor z80:LE:16:default \
  -noanalysis -scriptPath tools/ghidra \
  -postScript Rec2.java out.txt 0x0000 0x2000 0x0000 0x0008 0x0066 0x1a55
```

Scripts: `tools/ghidra/Rec2.java` (recursive + full dump), `RecursiveDisasm.java`
(8 KB variant), `DumpListing.java` (flow dump only).

Key landmarks found: boot clears the NMI-enable latch and jumps to $1A55; the
attract module at $2000 contains all attract text strings; sound latches are
written at $6002/$6003/$680x/$700x/$7800; input ports are memory-mapped reads at
$6000/$6800/$7000; the watchdog is a read of $7800.

## 3. Hardware cross-check

The memory map, palette DAC network, sprite/bullet formats, starfield LFSR and
sound-circuit constants were cross-checked against the MAME galaxian driver,
video and sound sources (drivers/galaxian.c, vidhrdw, sndhrdw). Facts only were
taken (address decodes, DAC resistor values, LFSR taps, LFO rates) — no code.

## 4. Graphics + palette extraction

`tools/extract_assets.py` decodes the character ROMs (plane-per-ROM, 8-byte tile
stride; sprites as 16×16 quadrant assemblies) and the palette PROM (resistor
DAC). Run it against your own dumps to regenerate `gfx.json`, `tiles.png`,
`sprites.png`, `palette.json`.

## 5. Rebuild verification

The browser rebuild is verified by headless Node tests (`rebuild/test_*.js`)
that stub the DOM and drive the real game logic: collision sweeps, dive
silhouette, difficulty ramp monotonicity, game-over flow, and font-visibility
(a regression test born from a bug where the whole font rendered transparent).
