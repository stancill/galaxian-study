// palette.js — exact color data (facts, not copyrightable expression)
// The 32-entry color PROM (6l) byte table, decoded through the documented
// resistor DAC of the original board:
//   R = 0x21*b0 + 0x47*b1 + 0x97*b2   (bits 0-2)
//   G = 0x21*b3 + 0x47*b4 + 0x97*b5   (bits 3-5)
//   B = 0x4f*b6 + 0xa8*b7             (bits 6-7)
"use strict";

const PROM6L = [
  0x00,0x00,0x00,0xf6,0x00,0x16,0xc0,0x3f,
  0x00,0xd8,0x07,0x3f,0x00,0xc0,0xc4,0x07,
  0x00,0xc0,0xa0,0x07,0x00,0x00,0x00,0x07,
  0x00,0xf6,0x07,0xf0,0x00,0x76,0x07,0xc6
];

const PAL32 = PROM6L.map(b => [
  0x21*(b&1)     + 0x47*((b>>1)&1) + 0x97*((b>>2)&1),
  0x21*((b>>3)&1)+ 0x47*((b>>4)&1) + 0x97*((b>>5)&1),
  0x4f*((b>>6)&1)+ 0xa8*((b>>7)&1)
]);

// Starfield colors: 64 entries, 2 bits per channel through {0,0x88,0xcc,0xff}
const STAR_COLOR_MAP = [0x00,0x88,0xcc,0xff];
const STAR_COLORS = [];
for (let i = 0; i < 64; i++) {
  STAR_COLORS.push([
    STAR_COLOR_MAP[i & 3],
    STAR_COLOR_MAP[(i>>2) & 3],
    STAR_COLOR_MAP[(i>>4) & 3]
  ]);
}

// Bullet hardware colors (documented): player = yellow, enemies = white
const BULLET_PLAYER = [0xef,0xef,0x00];
const BULLET_ENEMY  = [0xef,0xef,0xef];

// Pen chars used by the art file -> palette index
const PEN = { W:3, O:5, B:6, Y:7, R:10, P:14, C:15, M:31, '.':-1 };
