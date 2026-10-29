// starfield.js — exact algorithm of the original background star generator:
// a 17-bit LFSR clocked across the whole 512x256 field builds a fixed star
// table once; per frame the table is scrolled and twinkle-masked.
// (Hardware behavior — facts; implementation from scratch.)
"use strict";

class Starfield {
  constructor() {
    this.stars = [];
    this.scrollpos = 0;
    this.enabled = false;
    // birth pass
    let g = 0;
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 512; x++) {
        const bit0 = (((~g >>> 16) & 1) ^ ((g >>> 4) & 1));
        g = ((g << 1) | bit0) & 0x1ffff;
        if (((~g >>> 16) & 1) && (g & 0xff) === 0xff) {
          const color = (~(g >>> 8)) & 0x3f;
          if (color) this.stars.push({ x, y, color });
        }
      }
    }
    // pre-render stars to an offscreen 224x256 canvas (re-blitted each frame
    // with per-star twinkle test, matching the hardware's 1-bit mask)
    this.canvas = document.createElement("canvas");
    this.canvas.width = 224; this.canvas.height = 256;
  }

  advance() {           // once per frame (60 Hz), when enabled
    if (!this.enabled) return;
    this.scrollpos = (this.scrollpos + 1) & 0xffff;
    const ctx = this.canvas.getContext("2d");
    ctx.clearRect(0, 0, 224, 256);
    for (const s of this.stars) {
      const x = ((s.x + this.scrollpos) & 0x1ff) >> 1;
      const y = (s.y + ((this.scrollpos + s.x) >>> 9)) & 0xff;
      if ((y & 1) ^ ((x >> 3) & 1)) {
        const c = STAR_COLORS[s.color];
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  draw(ctx) {
    if (this.enabled) ctx.drawImage(this.canvas, 0, 0);
  }
}

// node test hook
if (typeof module !== "undefined" && typeof document === "undefined") {
  module.exports = { Starfield };
}
