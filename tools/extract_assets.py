#!/usr/bin/env python3
"""
extract_assets.py — regenerate Galaxian study artifacts from your own ROM dumps.

Reads the 1979 Galaxian ROM set (files: 1h.bin, 1k.bin, 6l.bpr) and writes:

  tiles.png      all 256 hardware tiles (8x8, 2bpp)
  sprites.png    all 64 hardware sprites (16x16, quadrant-assembled)
  gfx.json       tiles + sprites as pixel-index arrays
  palette.json   the 32-entry palette PROM through the documented resistor DAC
                 (R/G bits 0-2/3-5 weights 0x21/0x47/0x97; B bits 6-7 weights 0x4f/0xa8)

The ROM images themselves are NEVER written anywhere — only derived views.

Formats (verified against the board's wiring and emulator behavior):
  tile n      : plane0 = 1h.bin[n*8 .. n*8+8), plane1 = 1k.bin[n*8 .. n*8+8)
                MSB = leftmost pixel; pixel = p0_bit | p1_bit << 1
  sprite n    : tiles [4n, 4n+1, 4n+2, 4n+3] assembled as TL, TR, BL, BR

Usage:
  python3 extract_assets.py --roms ~/path/to/roms --out ../decon
"""
import argparse, json, os, struct, zlib

VIEWER_PENS = [(0,0,0), (110,110,255), (255,80,80), (255,255,255)]  # neutral 2bpp viewer colors

def load(roms):
    rA = open(os.path.join(roms, "1h.bin"), "rb").read()
    rB = open(os.path.join(roms, "1k.bin"), "rb").read()
    prom = open(os.path.join(roms, "6l.bpr"), "rb").read()
    assert len(rA) == len(rB) == 2048, "character ROMs must be 2 KB each"
    assert len(prom) == 32, "palette PROM must be 32 bytes"
    return rA, rB, prom

def decode_tiles(rA, rB):
    tiles = []
    for n in range(256):
        t = [[0]*8 for _ in range(8)]
        for y in range(8):
            b0, b1 = rA[n*8+y], rB[n*8+y]
            for x in range(8):
                t[y][x] = ((b0 >> (7-x)) & 1) | (((b1 >> (7-x)) & 1) << 1)
        tiles.append(t)
    return tiles

def decode_sprites(tiles):
    sprites = []
    for s in range(64):
        im = [[0]*16 for _ in range(16)]
        for y in range(16):
            for x in range(16):
                im[y][x] = tiles[s*4 + (2 if y >= 8 else 0) + (1 if x >= 8 else 0)][y % 8][x % 8]
        sprites.append(im)
    return sprites

def decode_palette(prom):
    dac = lambda b: [
        0x21*(b & 1)      + 0x47*((b >> 1) & 1) + 0x97*((b >> 2) & 1),
        0x21*((b >> 3)&1) + 0x47*((b >> 4) & 1) + 0x97*((b >> 5) & 1),
        0x4f*((b >> 6)&1) + 0xa8*((b >> 7) & 1),
    ]
    return [{"index": i, "prom": prom[i], "rgb": dac(prom[i])} for i in range(32)]

def write_png(path, w, h, pix):
    raw = b"".join(b"\x00" + bytes(v for px in row for v in px) for row in pix)
    def chunk(t, d):
        c = t + d
        return struct.pack(">I", len(d)) + c + struct.pack(">I", zlib.crc32(c))
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))
    open(path, "wb").write(png)

def sheet(images, cw, ch, cols, scale, path):
    rows = (len(images) + cols - 1) // cols
    W, H = cols*cw*scale, rows*ch*scale
    pix = [[[0,0,0]]*W for _ in range(H)]
    for i, im in enumerate(images):
        ox, oy = (i % cols)*cw*scale, (i // cols)*ch*scale
        for y in range(len(im)):
            for x in range(len(im[0])):
                c = VIEWER_PENS[im[y][x]]
                for sy in range(scale):
                    for sx in range(scale):
                        pix[oy+y*scale+sy][ox+x*scale+sx] = c
    write_png(path, W, H, pix)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--roms", required=True, help="directory containing 1h.bin, 1k.bin, 6l.bpr")
    ap.add_argument("--out", default=".", help="output directory")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    rA, rB, prom = load(a.roms)
    tiles = decode_tiles(rA, rB)
    sprites = decode_sprites(tiles)

    json.dump({"tiles_8x8": tiles, "sprites_16x16": sprites,
               "notes": {"tile_layout": "plane0=1h.bin, plane1=1k.bin, tile n at n*8 in each ROM",
                         "sprite_layout": "sprite n = tiles [4n..4n+3] as TL,TR,BL,BR"}},
              open(os.path.join(a.out, "gfx.json"), "w"))
    json.dump({"char_palette": decode_palette(prom),
               "bullets": {"player": [0xef,0xef,0x00], "enemy": [0xef,0xef,0xef]}},
              open(os.path.join(a.out, "palette.json"), "w"))
    sheet(tiles, 8, 8, 16, 4, os.path.join(a.out, "tiles.png"))
    sheet(sprites, 16, 16, 8, 3, os.path.join(a.out, "sprites.png"))
    print("wrote gfx.json, palette.json, tiles.png, sprites.png to", a.out)

if __name__ == "__main__":
    main()
