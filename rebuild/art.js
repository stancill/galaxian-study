// art.js — ALL pixel art in this file is hand-drawn for this rebuild.
// Nothing here is extracted from the original ROMs: same canvas sizes, roles
// and palette as the 1979 machine so it reads as the same game, but the
// bitmaps are original expression (see README "Fidelity & credits").
"use strict";

// ---------- 8x8 font (original 5x7 glyphs in an 8x8 cell) ----------
const FONT_SRC = {
  A:"01110/10001/10001/11111/10001/10001/10001",
  B:"11110/10001/10001/11110/10001/10001/11110",
  C:"01110/10001/10000/10000/10000/10001/01110",
  D:"11110/10001/10001/10001/10001/10001/11110",
  E:"11111/10000/10000/11110/10000/10000/11111",
  F:"11111/10000/10000/11110/10000/10000/10000",
  G:"01110/10001/10000/10111/10001/10001/01111",
  H:"10001/10001/10001/11111/10001/10001/10001",
  I:"01110/00100/00100/00100/00100/00100/01110",
  J:"00111/00010/00010/00010/00010/10010/01100",
  K:"10001/10010/10100/11000/10100/10010/10001",
  L:"10000/10000/10000/10000/10000/10000/11111",
  M:"10001/11011/10101/10101/10001/10001/10001",
  N:"10001/11001/10101/10011/10001/10001/10001",
  O:"01110/10001/10001/10001/10001/10001/01110",
  P:"11110/10001/10001/11110/10000/10000/10000",
  Q:"01110/10001/10001/10001/10101/10010/01101",
  R:"11110/10001/10001/11110/10100/10010/10001",
  S:"01111/10000/10000/01110/00001/00001/11110",
  T:"11111/00100/00100/00100/00100/00100/00100",
  U:"10001/10001/10001/10001/10001/10001/01110",
  V:"10001/10001/10001/10001/10001/01010/00100",
  W:"10001/10001/10001/10101/10101/11011/10001",
  X:"10001/10001/01010/00100/01010/10001/10001",
  Y:"10001/10001/10001/01010/00100/00100/00100",
  Z:"11111/00001/00010/00100/01000/10000/11111",
  "0":"01110/10001/10011/10101/11001/10001/01110",
  "1":"00100/01100/00100/00100/00100/00100/01110",
  "2":"01110/10001/00001/00110/01000/10000/11111",
  "3":"11111/00010/00100/00010/00001/10001/01110",
  "4":"00010/00110/01010/10010/11111/00010/00010",
  "5":"11111/10000/11110/00001/00001/10001/01110",
  "6":"00110/01000/10000/11110/10001/10001/01110",
  "7":"11111/00001/00010/00100/01000/01000/01000",
  "8":"01110/10001/10001/01110/10001/10001/01110",
  "9":"01110/10001/10001/01111/00001/00010/01100",
  " ":"00000/00000/00000/00000/00000/00000/00000",
  ".":"00000/00000/00000/00000/00000/00000/00100",
  ":":"00000/00100/00100/00000/00100/00100/00000",
  "-":"00000/00000/00000/01110/00000/00000/00000",
  "=":"00000/00000/01110/00000/01110/00000/00000",
  "?":"01110/10001/00001/00110/00100/00000/00100",
  "!":"00100/00100/00100/00100/00100/00000/00100",
  "<":"00010/00100/01000/10000/01000/00100/00010",
  ">":"01000/00100/00010/00001/00010/00100/01000",
  ",":"00000/00000/00000/00000/00110/00100/01000"
};

// ---------- 16x16 sprites (hand-drawn) ----------
// Pen chars: B blue, W white, R red, O orange-red, Y yellow, P purple, C teal, M magenta
const SPRITE_SRC = {
  // Rank 0 — drone (blue), wings out / wings raised
  drone0:[
    "....B......B....",
    "....BB....BB....",
    ".....B....B.....",
    ".....BB..BB.....",
    "..B...BBBB...B..",
    "..BB.BBBBBB.BB..",
    "...BBBBBBBBBB...",
    "...BBWWBBWWBB...",
    "...BBBBBBBBBB...",
    "....BBBBBBBB....",
    "....BBBBBBBB....",
    "...BB.BBBB.BB...",
    "..BB...BB...BB..",
    "..B....BB....B..",
    "................",
    "................"
  ],
  drone1:[
    "..B..........B..",
    "..BB........BB..",
    "...B........B...",
    "...BBB....BBB...",
    "....B.BBBBB.B...",
    "..BB.BBBBBB.BB..",
    "...BBBBBBBBBB...",
    "...BBWWBBWWBB...",
    "...BBBBBBBBBB...",
    "....BBBBBBBB....",
    "....BBBBBBBB....",
    "....BB.BB.BB....",
    "...B..BBBB..B...",
    "......B..B......",
    "................",
    "................"
  ],
  // Rank 1 — emissive (purple)
  emissive0:[
    "......PPPP......",
    "....PPPPPPPP....",
    "...PPPPPPPPPP...",
    "..PPPPPPPPPPPP..",
    "..PPWWPPPPWWPP..",
    "..PPWWPPPPWWPP..",
    "..PPPPPPPPPPPP..",
    ".PPPPPPPPPPPPPP.",
    ".PPP.PPPPPP.PPP.",
    ".PP...PPPP...PP.",
    ".P....PPPP....P.",
    "......PPPP......",
    ".....PP..PP.....",
    "....PP....PP....",
    "...PP......PP...",
    "................"
  ],
  emissive1:[
    "......PPPP......",
    ".....PPPPPP.....",
    "....PPPPPPPP....",
    "...PPPPPPPPPP...",
    "..PPWWPPPPWWPP..",
    "..PPWWPPPPWWPP..",
    "..PPPPPPPPPPPP..",
    "..PPPPPPPPPPPP..",
    ".PPPPPPPPPPPPPP.",
    ".PP..PPPPPP..PP.",
    ".P...PPPPPP...P.",
    ".....PPPPPP.....",
    "....PP.PP.PP....",
    "...PP..PP..PP...",
    "....P..PP..P....",
    "................"
  ],
  // Rank 2 — commander (red)
  commander0:[
    "......RRRR......",
    ".....RRRRRR.....",
    "....RRRRRRRR....",
    "....RWWRRWWR....",
    "...RRRRRRRRRR...",
    "..RRRRRRRRRRRR..",
    "..RRR.RRRR.RRR..",
    "..RR..RRRR..RR..",
    ".RRR..RRRR..RRR.",
    ".RR....RR....RR.",
    "RR.....RR.....RR",
    "R......RR......R",
    ".......RR.......",
    "................",
    "................",
    "................"
  ],
  commander1:[
    "......RRRR......",
    ".....RRRRRR.....",
    "....RRRRRRRR....",
    "....RWWRRWWR....",
    "...RRRRRRRRRR...",
    "..RRRRRRRRRRRR..",
    "..RRRRRRRRRRRR..",
    ".RRRRRRRRRRRRRR.",
    ".RRR..RRRR..RRR.",
    "RR....RRRR....RR",
    "R.....RRRR.....R",
    "......R..R......",
    ".....R....R.....",
    "....R......R....",
    "................",
    "................"
  ],
  // Rank 3 — flagship (yellow hull, white bridge, red keel)
  flagship0:[
    ".......YY.......",
    "......YYYY......",
    "......YYYY......",
    "...Y..YYYY..Y...",
    "..YY.YYYYYY.YY..",
    "..YYYYYYYYYYYY..",
    ".YYYYWWWWWWYYYY.",
    ".YYYYWWWWWWYYYY.",
    "YYYYYWWWWWWYYYYY",
    "YYYYYYYYYYYYYYYY",
    "YYYRRRRRRRRRRYYY",
    "YYRRRRRRRRRRRRYY",
    "YRRRRRRRRRRRRRRY",
    "YRR..........RRY",
    "YR............RY",
    "................"
  ],
  flagship1:[
    ".......YY.......",
    "......YYYY......",
    ".....YYYYYY.....",
    "..Y.YYYYYYYY.Y..",
    "..YYYYWWWWYYYY..",
    ".YYYYYWWWWYYYYY.",
    ".YYYWWWWWWWWYYY.",
    "YYYYWWWWWWWWYYYY",
    "YYYYYWWWWWWYYYYY",
    "YYYYYYYYYYYYYYYY",
    "YYYRRRRRRRRRRYYY",
    "YYRRRRRRRRRRRRYY",
    "YRRRRRRRRRRRRRRY",
    "YRRR........RRRY",
    "YR............RY",
    "................"
  ],
  // Player ship — "galaxip" (white body, red wings, teal canopy)
  galaxip:[
    ".......WW.......",
    ".......WW.......",
    "......WWWW......",
    "......CWWC......",
    ".....WWWWWW.....",
    ".....WWWWWW.....",
    "....WWWWWWWW....",
    "....RWWWWWWR....",
    "...RRWWWWWWRR...",
    "...RRWWWWWWRR...",
    "..RRRWWWWWWRRR..",
    ".RRRRWWWWWWRRRR.",
    ".RRR.WWWWWW.RRR.",
    "RRR..WWWWWW..RRR",
    "RR...WWWWWW...RR",
    "................"
  ],
  // Alien kill — starburst, two frames
  boom0:[
    "................",
    "................",
    ".......W........",
    "......YWY.......",
    ".......Y........",
    "..W...YYYY...W..",
    "...WYYOOYYW.....",
    "....YOOOOY......",
    "...WYYOOYYW.....",
    "..W...YYYY...W..",
    ".......Y........",
    "......YWY.......",
    ".......W........",
    "................",
    "................",
    "................"
  ],
  boom1:[
    "................",
    "....W...W....W..",
    ".....Y...Y......",
    "..W..YYYYY..W...",
    "....YYOOOYY.....",
    "..WYOOYOOYOYW...",
    "..WYOYWWWYOYW...",
    "..WYOOYOOYOYW...",
    "....YYOOOYY.....",
    "..W..YYYYY..W...",
    ".....Y...Y......",
    "....W...W....W..",
    "................",
    "................",
    "................",
    "................"
  ],
  // Player death — expanding fireball
  fire0:[
    "................",
    "................",
    "................",
    "................",
    "......OYO.......",
    ".....OYWYO......",
    ".....OWYWO......",
    "......OYO.......",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................"
  ],
  fire1:[
    "................",
    "................",
    "......O.O.......",
    "....O.YWY.O.....",
    "...O.OWYWO.O....",
    "....OYWYWO......",
    "...ROWWWOR......",
    "...ROWWWOR......",
    "....OYWYWO......",
    "...O.OWYWO.O....",
    "....O.YWY.O.....",
    "......O.O.......",
    "................",
    "................",
    "................",
    "................"
  ],
  fire2:[
    "....O.......O...",
    ".....O.YYO.O....",
    "...OYOWWYO......",
    "..OOWWWWWYOO....",
    "..OYWWWWWYWO....",
    ".OYWWWWWWWYWO...",
    ".OWWWWWWWWWWO...",
    ".OWWWWWWWWWWO...",
    ".OYWWWWWWWYWO...",
    "..OYWWWWWYWO....",
    "..OOWWWWWYOO....",
    "...OYOWWYO......",
    ".....O.YYO.O....",
    "....O.......O...",
    "................",
    "................"
  ]
};

// ---------- bitmap building ----------
// rows of pen chars -> {w,h,data:Uint8Array of palette index or 255=transparent}
function makeBitmap(rows, w, h) {
  w = w || 16; h = h || (rows ? rows.length : 8);
  const data = new Uint8Array(w*h).fill(255);
  if (rows) {
    for (let y = 0; y < h; y++) {
      const line = rows[y] || "";
      for (let x = 0; x < w; x++) {
        const ch = line[x] || ".";
        if (ch !== ".") data[y*w+x] = (typeof PEN[ch] === "number") ? PEN[ch] : 255;
      }
    }
  }
  return { w, h, data };
}

function buildFont() {
  const out = {};
  for (const ch of Object.keys(FONT_SRC)) {
    // FONT_SRC rows are "0"/"1" bitmaps; map 1 -> white pen so makeBitmap sees it
    const rows = FONT_SRC[ch].split("/").map(r =>
      r.split("").map(b => (b === "1" ? "W" : ".")).join(""));
    out[ch] = makeBitmap(rows, 8, 8);
  }
  return out;
}

function buildSprites() {
  const out = {};
  for (const name of Object.keys(SPRITE_SRC)) {
    out[name] = makeBitmap(SPRITE_SRC[name], 16, 16);
  }
  return out;
}

const FONT = buildFont();
const SPR = buildSprites();
