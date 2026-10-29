// game.js — engine + game logic, written from scratch against the deconstruction
// in ../decon/DESIGN.md. Faithful: 224x256, 60 Hz fixed step, tile/sprite/bullet
// model, exact starfield + palette, formation/diving/convoy mechanics.
"use strict";

const GAME_W = 224, GAME_H = 256;
const TICK_MS = 1000 / 60;

const canvas = document.getElementById("screen");
canvas.width = GAME_W; canvas.height = GAME_H;
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

// ---------- bitmap pre-rendering ----------
function renderBitmap(bmp) {
  const c = document.createElement("canvas");
  c.width = bmp.w; c.height = bmp.h;
  const cc = c.getContext("2d");
  for (let y = 0; y < bmp.h; y++)
    for (let x = 0; x < bmp.w; x++) {
      const p = bmp.data[y*bmp.w+x];
      if (p !== 255) {
        const col = PAL32[p];
        cc.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
        cc.fillRect(x, y, 1, 1);
      }
    }
  return c;
}

function renderFlips(c) {
  const fx = document.createElement("canvas"); fx.width = 16; fx.height = 16;
  const fy = document.createElement("canvas"); fy.width = 16; fy.height = 16;
  const fxy = document.createElement("canvas"); fxy.width = 16; fxy.height = 16;
  let g = fx.getContext("2d"); g.translate(16,0); g.scale(-1,1); g.drawImage(c,0,0);
  g = fy.getContext("2d"); g.translate(0,16); g.scale(1,-1); g.drawImage(c,0,0);
  g = fxy.getContext("2d"); g.translate(16,16); g.scale(-1,-1); g.drawImage(c,0,0);
  return { c, fx, fy, fxy };
}

const FONT_IMG = {}; for (const k in FONT) FONT_IMG[k] = renderBitmap(FONT[k]);
const SPR_IMG = {};  for (const k in SPR)  SPR_IMG[k]  = renderFlips(renderBitmap(SPR[k]));

// pre-tinted font variants (white, red, yellow)
const FONT_TINT = {};
[3, 10, 7].forEach(pal => {
  FONT_TINT[pal] = {};
  for (const k in FONT) {
    const c = document.createElement("canvas"); c.width = 8; c.height = 8;
    const cc = c.getContext("2d");
    cc.drawImage(FONT_IMG[k], 0, 0);
    cc.globalCompositeOperation = "source-atop";
    const col = PAL32[pal];
    cc.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
    cc.fillRect(0, 0, 8, 8);
    FONT_TINT[pal][k] = c;
  }
});

function text(str, x, y, pal) {
  pal = pal || 3;
  let cx = x;
  for (const ch of str.toUpperCase()) {
    const img = (FONT_TINT[pal] && FONT_TINT[pal][ch]) || FONT_TINT[3][" "];
    ctx.drawImage(img, cx, y);
    cx += 8;
  }
}
function textCentered(str, y, pal) { text(str, (GAME_W - str.length*8) >> 1, y, pal); }

// ---------- game constants ----------
const RANK = [
  { spr: ["drone0","drone1"],         form: 30, dive: 60  },   // drone (blue)
  { spr: ["emissive0","emissive1"],   form: 40, dive: 80  },   // emissive (purple)
  { spr: ["commander0","commander1"], form: 50, dive: 100 },   // commander (red)
  { spr: ["flagship0","flagship1"],   form: 60, dive: 300 }    // flagship
];
const CONVOY_POPUPS = [150, 200, 300, 800];
const PLAYER_BULLET_SPEED = -6;
const ENEMY_BULLET_ACC = 0.055, ENEMY_BULLET_MAX = 4.2;
const MAX_ENEMY_BULLETS = 7;
const BONUS_LIFE_AT = 7000;

// ---------- state ----------
const keys = {};
let game, fleet, player, pBullet, eBullets, popups, starfield, sound, groupSeq;

function newGame() {
  game = {
    state: "attract", tick: 0, attractPhase: 0, attractT: 0,
    score: 0, hi: loadHi(), lives: 3, wave: 1, credit: 0,
    bonusGiven: false, flip: false, paused: false, overT: 0, readyT: 0
  };
  player = { x: 16, alive: true, dying: 0, fireballFrame: 0 };
  pBullet = null;
  eBullets = [];
  popups = [];
  fleet = [];
  groupSeq = 0;
  buildFleet(true);
}

function loadHi() {
  try { return parseInt(localStorage.getItem("galaxian_hi") || "0", 10) || 0; }
  catch (e) { return 0; }
}
function saveHi() { try { localStorage.setItem("galaxian_hi", String(game.hi)); } catch (e) {} }

// formation layout: 2 flagship / 6 commander / 8 emissive / 10+10 drone = 36
function formationSlots() {
  const slots = [];
  const row = (rank, y, xs) => xs.forEach((x, col) => slots.push({ rank, x, y, col }));
  row(3, 52,  [84, 124]);
  row(2, 74,  [44, 68, 92, 116, 140, 164]);
  row(1, 92,  [27, 49, 71, 93, 115, 137, 159, 181]);
  row(0, 110, [10, 31, 52, 73, 94, 115, 136, 157, 178, 199]);
  row(0, 128, [10, 31, 52, 73, 94, 115, 136, 157, 178, 199]);
  return slots;
}

function buildFleet(first) {
  fleet = formationSlots().map((s, i) => ({
    rank: s.rank, slotX: s.x, slotY: s.y, col: s.col,
    x: s.x, y: s.y, state: "entry",
    t: -((s.col + s.rank*2) * 2 + (first ? 0 : 0)),   // stagger
    phase: 0, dir: 1, targetX: 0, sx: 0, sy: 0, wig: Math.random()*6.28,
    group: null
  }));
  eBullets = [];
}

const aliveCount = () => fleet.reduce((n, a) => n + (a.state !== "dead" ? 1 : 0), 0);
const diversCount = () => fleet.reduce((n, a) => n + ((a.state === "dive" || a.state === "entry" && a.diving) ? 1 : 0), 0);

// ---------- dives ----------
// Dive engine. NOTE: a smooth-run scan of the ROM found no trajectory delta
// tables — the original computes diver motion procedurally (engine code at
// $0E00-$16A5, IX-indexed object updates with screen clamps). This re-creates
// the observed silhouette: tip-up peel-off, wide C-hook toward the near screen
// edge, then a lane-committed snake dive (original divers do not home onto the
// player), bottom wrap, and a straight climb back to the slot.
function diveInterval(w)   { return Math.max(45, 150 - w * 12); }        // frames between dive dispatch
function maxDiversForWave(w){ return Math.min(6, 2 + Math.floor(w / 3)); }
function diveVy(w)         { return Math.min(3.3, 1.9 + 0.11 * w); }

function dispatchDive() {
  const inForm = fleet.filter(a => a.state === "form");
  if (!inForm.length) return;
  if (diversCount() >= maxDiversForWave(game.wave)) return;

  const flagships = inForm.filter(a => a.rank === 3);
  let picks = [];
  if (flagships.length && Math.random() < 0.22) {
    const f = flagships[(Math.random()*flagships.length)|0];
    picks = [f];
    // escorts: up to 2 nearest drones, convoy group
    const drones = inForm.filter(a => a.rank === 0)
      .sort((a,b) => Math.abs(a.slotX - f.slotX) - Math.abs(b.slotX - f.slotX))
      .slice(0, 2);
    const group = { id: ++groupSeq, escortKills: 0 };
    f.group = group;
    drones.forEach(d => { d.group = group; picks.push(d); });
  } else {
    const pool = inForm.filter(a => a.rank < 3);
    if (!pool.length) return;
    picks = [pool[(Math.random()*pool.length)|0]];
  }
  picks.forEach(a => startDive(a));
}

function startDive(a) {
  a.state = "dive";
  a.phase = 0; a.t = 0;
  a.sx = a.x; a.sy = a.y;
  a.dir = (a.slotX < GAME_W/2) ? -1 : 1;   // peel toward the near screen edge
  a.fireT = 30 + (Math.random()*30|0);
}

function updateDiver(a) {
  a.t++;
  switch (a.phase) {
    case 0: { // tip up and out of the slot (small lift)
      a.x = a.sx + a.dir * 1.6 * a.t;
      a.y = a.sy - 0.5 * a.t;
      if (a.t >= 10) { a.phase = 1; a.t = 0; }
      break;
    }
    case 1: { // wide C-hook: swing toward the edge, curve back in and down
      const p = a.t / 42, q = 1 - p;
      const x0 = a.sx + a.dir*16, y0 = a.sy - 5;
      const cpx = Math.max(12, Math.min(GAME_W-12, x0 + a.dir*95));
      const p1x = Math.max(12, Math.min(GAME_W-28, x0 + a.dir*30));
      a.x = q*q*x0 + 2*q*p*cpx + p*p*p1x;
      a.y = q*q*y0 + 2*q*p*(y0 + 10)     + p*p*(y0 + 84);
      if (a.t >= 42) { a.phase = 2; a.t = 0; a.wig = Math.random()*6.28; }
      break;
    }
    case 2: { // lane-committed snake dive (no homing — like the original)
      a.y += diveVy(game.wave);
      a.wig += 0.13;
      a.x += Math.sin(a.wig) * 2.2;
      a.x = Math.max(2, Math.min(GAME_W - 18, a.x));
      if (--a.fireT <= 0) {
        a.fireT = Math.max(22, 44 - 2 * game.wave) + (Math.random()*30|0);
        if (eBullets.length < MAX_ENEMY_BULLETS && a.y > 60 && a.y < 210)
          eBullets.push({ x: a.x+7, y: a.y+14, vy: 1.0 + game.wave*0.06 });
      }
      if (a.y > GAME_H + 16) { a.y = -20; a.phase = 3; a.t = 0; }
      break;
    }
    case 3: { // re-enter from the top, climb back to the slot
      a.y -= 2.6;
      a.x += (a.slotX - a.x) * 0.06;
      if (a.y <= a.slotY) {
        a.y = a.slotY; a.x = a.slotX;
        a.state = "form";
      }
      break;
    }
  }
}

// ---------- kills ----------
function killAlien(a, idx) {
  if (a.state === "dead") return 0;
  const wasForm = (a.state === "form");
  a.state = "dead";
  let pts, popup = null;

  if (a.rank === 3) { // flagship
    if (wasForm) pts = RANK[3].form;
    else if (a.group) {
      const alive = fleet.filter(m => m.group === a.group && m !== a && m.state !== "dead").length;
      if (a.group.escortKills === 2) pts = 800;
      else if (alive >= 2) pts = 300;
      else if (alive === 1) pts = 200;
      else pts = 150;
      popup = pts;
    } else pts = 150, popup = 150;
  } else {
    pts = wasForm ? RANK[a.rank].form : RANK[a.rank].dive;
    if (a.group && !wasForm) {
      // escort of a diving flagship
      const flag = fleet.find(m => m.group === a.group && m.rank === 3 && m.state !== "dead");
      if (flag) a.group.escortKills++;
    }
  }
  addScore(pts);
  if (popup) popups.push({ x: Math.max(2, Math.min(GAME_W-34, a.x|0)), y: a.y|0, txt: String(popup), t: 80 });
  sound.pop();
  return pts;
}

function addScore(pts) {
  game.score += pts;
  if (game.score > game.hi) { game.hi = game.score; }
  if (!game.bonusGiven && game.score >= BONUS_LIFE_AT) {
    game.bonusGiven = true;
    game.lives++;
    sound.extraLife();
  }
}

// ---------- player ----------
function killPlayer() {
  if (player.dying) return;
  player.dying = 60;
  player.fireballFrame = 0;
  pBullet = null;
  sound.shipBoom();
  sound.diveStop();   // world freezes; warble restarts on respawn via tick()
}

// ---------- per-frame tick ----------
function tick() {
  game.tick++;
  if (game.state === "attract") { tickAttract(); return; }
  if (game.state === "over") {
    if (--game.overT <= 0) { game.state = "attract"; game.attractPhase = 0; game.attractT = 0; buildFleet(true); }
    starfield.advance();
    return;
  }
  if (game.state === "ready") {
    if (--game.readyT <= 0) game.state = "play";
    starfield.advance();
    return;
  }

  // ---- play ----
  starfield.advance();

  if (player.dying > 0) {          // freeze world during death anim
    player.dying--;
    player.fireballFrame = 2 - (player.dying / 20 | 0);
    if (player.dying === 0) {
      if (--game.lives <= 0) {
        game.state = "over"; game.overT = 300;    // 5 s, or Enter to restart
        saveHi(); sound.diveStop();
      } else {
        player.x = 16; player.alive = true;
        eBullets = [];
      }
    }
    return;
  }

  // player movement + fire
  if (keys["ArrowLeft"] || keys["KeyA"]) player.x -= 2;
  if (keys["ArrowRight"] || keys["KeyD"]) player.x += 2;
  player.x = Math.max(2, Math.min(GAME_W - 18, player.x));
  if ((keys["Space"] || keys["KeyZ"] || keys["KeyX"]) && !pBullet) {
    pBullet = { x: player.x + 7, y: 232 };
    sound.fire();
  }

  // bullets (track previous position so collisions can sweep the path)
  if (pBullet) {
    pBullet.prevY = pBullet.y;
    pBullet.y += PLAYER_BULLET_SPEED;
    if (pBullet.y < -8) pBullet = null;
  }
  for (const b of eBullets) { b.y += b.vy; b.vy = Math.min(ENEMY_BULLET_MAX, b.vy + ENEMY_BULLET_ACC); }
  eBullets = eBullets.filter(b => b.y < GAME_H + 8);

  // fleet
  let entryPlaying = false;
  for (const a of fleet) {
    if (a.state === "dead") continue;
    if (a.state === "entry") {
      a.t++;
      if (a.t < 0) { a.y = -24; entryPlaying = true; continue; }
      const p = Math.min(1, a.t / 70);
      a.y = -24 + (a.slotY + 24) * p;
      a.x = a.slotX + Math.sin(p * Math.PI) * 50 * (a.col % 2 ? 1 : -1) * (a.slotX < GAME_W/2 ? 1 : -1);
      if (p >= 1) { a.x = a.slotX; a.y = a.slotY; a.state = "form"; }
      else entryPlaying = true;
    } else if (a.state === "dive") updateDiver(a);
  }

  // wave dispatch
  if (!entryPlaying && aliveCount() === 0) {       // wave cleared
    game.wave++;
    buildFleet(false);
  } else if (!entryPlaying) {
    if (game.tick % diveInterval(game.wave) === 0) dispatchDive();
  }

  // one shared warble voice for anything flying — dives AND the convoy fly-in —
  // pitch rising with depth, like the original's LFO tone (139 Hz ± 46 Hz)
  const anyFlying = fleet.some(a => a.state === "dive" || (a.state === "entry" && a.t >= 0));
  if (anyFlying && !sound.warble) sound.diveStart();
  if (!anyFlying && sound.warble) sound.diveStop();
  if (sound.warble) {
    let deepest = 60;
    for (const a of fleet) if (a.state === "dive" || a.state === "entry") deepest = Math.max(deepest, a.y);
    sound.divePitch(Math.max(0, Math.min(1, (deepest - 60) / 180)));
  }

  // collisions: player bullet vs aliens (swept segment — the bullet is fast,
  // so test the whole path travelled this tick, not just the tip pixel)
  if (pBullet) {
    const segTop = pBullet.y;                 // new tip (moving up)
    const segBot = pBullet.prevY + 4;         // old tail of the 4px streak
    for (const a of fleet) {
      if (a.state === "dead" || a.t < 0) continue;
      const ax = a.x, ay = a.y;
      if (pBullet.x >= ax+1 && pBullet.x <= ax+14 &&
          segTop <= ay+13 && segBot >= ay+4) {
        killAlien(a);
        pBullet = null;
        break;
      }
    }
  }
  // enemy bullets vs player; divers vs player
  if (!player.dying) {
    for (const b of eBullets) {
      if (b.x >= player.x+4 && b.x <= player.x+11 && b.y >= 236 && b.y <= 246) { killPlayer(); break; }
    }
    if (!player.dying) {
      for (const a of fleet) {
        if (a.state !== "dive" && a.state !== "entry") continue;
        if (a.x+12 > player.x+2 && a.x < player.x+13 && a.y+12 > 238 && a.y < 250) { killPlayer(); break; }
      }
    }
  }

  // popups
  for (const p of popups) p.t--;
  popups = popups.filter(p => p.t > 0);
}

// ---------- attract ----------
function tickAttract() {
  game.attractT++;
  starfield.enabled = true;
  starfield.advance();
  const dur = [420, 480, 360, 420][game.attractPhase] || 400;
  // NOTE: the original flips the whole picture mid-attract via its cabinet yoke
  // latches ($7006/$7007 — implemented in render). Kept upright here so the
  // text phases stay readable in a browser window.
  game.flip = false;
  if (game.attractT > dur) { game.attractPhase = (game.attractPhase + 1) % 4; game.attractT = 0; }
}

// ---------- render ----------
function render() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, GAME_W, GAME_H);
  ctx.save();
  if (game.flip) { ctx.translate(GAME_W, GAME_H); ctx.rotate(Math.PI); }
  starfield.draw(ctx);

  if (game.state === "attract") renderAttract();
  else {
    renderHUD();
    if (game.state === "ready") {
      textCentered(game.wave === 1 && game.score === 0 ? "PLAYER ONE" : "GET READY", 120, 7);
    }
    if (game.state === "over") {
      textCentered("GAME OVER", 112, 10);
      textCentered("FINAL SCORE " + scoreStr(game.score), 132, 3);
    } else if (player.dying > 0 && game.lives <= 1) {
      // last life lost: announce immediately, don't wait for the fireball
      textCentered("GAME OVER", 112, 10);
    }
    // fleet
    for (const a of fleet) {
      if (a.state === "dead" || a.t < 0) continue;
      const f = ((game.tick >> 3) + a.col) & 1;
      drawSprite(RANK[a.rank].spr[f], a.x, a.y, false, false);
    }
    // bullets
    if (pBullet) drawStreak(pBullet.x, pBullet.y, BULLET_PLAYER);
    for (const b of eBullets) drawStreak(b.x, b.y, BULLET_ENEMY);
    // player
    if (!player.dying && game.state === "play") {
      drawSprite("galaxip", player.x, 240, false, false);
    }
    if (player.dying > 0) {
      const frames = ["fire0","fire1","fire2"];
      drawSprite(frames[Math.min(2, player.fireballFrame)], player.x, 236, false, false);
    }
    // popups
    for (const p of popups) text(p.txt, p.x, p.y, 10);
  }
  ctx.restore();
}

function drawSprite(name, x, y, flipX, flipY) {
  const set = SPR_IMG[name];
  const img = flipX && flipY ? set.fxy : flipX ? set.fx : flipY ? set.fy : set.c;
  ctx.drawImage(img, Math.round(x), Math.round(y));
}

function drawStreak(x, y, color) {
  const col = `rgb(${color[0]},${color[1]},${color[2]})`;
  ctx.fillStyle = col;
  ctx.fillRect(Math.round(x), Math.round(y), 1, 4);
}

function scoreStr(n) {
  const s = String(n);
  return s.length < 2 ? "0".repeat(2 - s.length) + s : s;
}

function renderHUD() {
  text("  1UP      HIGH SCORE", 0, 0, 3);
  text(scoreStr(game.score).padStart(6, " "), 16, 8, 3);
  text(String(game.hi).padStart(6, " "), 144, 8, 7);
  // reserve ships
  for (let i = 0; i < Math.min(6, game.lives - 1); i++) drawSprite("galaxip", 4 + i*20, 244, false, false);
  text("CREDIT 0", 144, 246, 3);
}

function renderAttract() {
  const t = game.attractT;
  const blink = (t % 60) < 40;
  switch (game.attractPhase) {
    case 0:
      textCentered("WE ARE THE", 92, 3);
      textCentered("GALAXIANS", 108, 3);
      if (t > 180) textCentered("MISSION: DESTROY ALIENS", 148, 10);
      break;
    case 1: { // score advance table (screen flipped, like the original quirk)
      textCentered("SCORE ADVANCE TABLE", 24, 7);
      const rows = [
        ["drone0",      "30 PTS"],
        ["emissive0",   "40 PTS"],
        ["commander0",  "50 PTS"],
        ["flagship0",   "60 PTS"]
      ];
      rows.forEach((r, i) => {
        const y = 48 + i*24;
        ctx.drawImage(SPR_IMG[r[0]].c, 40, y - 4);
        text("= " + r[1], 64, y, 3);
      });
      text("CONVOY CHARGER", 48, 152, 10);
      text("UP TO 800 PTS", 56, 164, 10);
      if (blink) textCentered("PUSH START BUTTON", 200, 7);
      break;
    }
    case 2:
      textCentered("HIGH SCORE", 96, 7);
      textCentered(String(game.hi).padStart(6, "0"), 112, 3);
      if (blink) textCentered("PUSH START BUTTON", 160, 7);
      break;
    case 3:
      textCentered("GALAXIAN", 64, 7);
      textCentered("STUDY REBUILD", 84, 10);
      textCentered("ORIGINAL 1979 ARCADE", 116, 3);
      textCentered("MECHANICS TRIBUTE", 128, 3);
      if (blink) textCentered("PUSH START BUTTON", 176, 7);
      break;
  }
  text("CREDIT 0", 144, 246, 3);
}

// ---------- input ----------
function startGame() {
  sound.resume(); sound.coin();
  newGameState();
}
function newGameState() {
  game.state = "ready"; game.readyT = 100; game.flip = false;
  game.score = 0; game.lives = 3; game.wave = 1; game.bonusGiven = false;
  player = { x: 16, alive: true, dying: 0, fireballFrame: 0 };
  pBullet = null; eBullets = []; popups = [];
  buildFleet(true);
  sound.humOn();
}

window.addEventListener("keydown", e => {
  if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space"].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.code === "KeyM") sound.toggleMute();
  if (e.code === "KeyP") game.paused = !game.paused;
  if ((e.code === "Enter" || e.code === "Digit1" ||
       (e.code === "Space" && game.state === "attract")) &&
      (game.state === "attract" || game.state === "over")) startGame();
});
window.addEventListener("keyup", e => { keys[e.code] = false; });

// ---------- boot & loop ----------
starfield = new Starfield();
sound = new SoundBoard();
newGame();

let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  acc += Math.min(100, now - last); last = now;
  while (acc >= TICK_MS) {
    acc -= TICK_MS;
    if (!game.paused) tick();
  }
  render();
}
requestAnimationFrame(frame);
