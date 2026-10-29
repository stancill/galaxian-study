// retest after fixes
"use strict";
const fs = require("fs"), vm = require("vm");
let canvasId = 0;
const draws = [];
function makeCtx(canvasRef) {
  return new Proxy({}, {
    get: (t, p) => (p === "canvas") ? canvasRef : (...args) => {
      if (p === "drawImage") draws.push({ tag: canvasRef.tag, x: args[1], y: args[2] });
      return undefined;
    },
    set: () => true
  });
}
function makeCanvas(tag) {
  const c = { id: ++canvasId, tag: tag || ("c" + canvasId), width: 0, height: 0, style: {} };
  c.getContext = () => makeCtx(c);
  return c;
}
const sandbox = {
  console,
  document: { createElement: () => makeCanvas(), getElementById: () => makeCanvas("screen") },
  window: { addEventListener: () => {} },
  localStorage: { getItem: () => null, setItem: () => {} },
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => 0
};
vm.createContext(sandbox);
for (const f of ["palette.js", "art.js", "starfield.js", "audio.js", "game.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), sandbox, { filename: f });
}
const run = (code) => vm.runInContext(code, sandbox);

// TEST 0: font glyphs must contain visible pixels (regression: the whole font
// was silently transparent when pen lookup failed on "0"/"1" bit strings)
run(`
  FONTPIX = {};
  for (const ch of "ABCDEFG0123456789:=") {
    let n = 0; for (const v of FONT[ch].data) if (v !== 255) n++;
    FONTPIX[ch] = n;
  }
  T0 = Object.values(FONTPIX).every(n => n > 0);
`);
console.log("T0 all font glyphs visible:", run("T0"), JSON.stringify(run("FONTPIX")));

function freshPlay() {
  run(`
    startGame();
    for (var i = 0; i < 130; i++) tick();
    fleet.forEach(a => { if (a.state !== "dead") { a.state = "form"; a.t = 100; a.x = a.slotX; a.y = a.slotY; } });
    eBullets = []; popups = [];
  `);
}

// TEST 1: bullet spawned overlapping a diving alien -> must die this tick
freshPlay();
run(`
  var d = fleet.find(a => a.rank === 0);
  startDive(d); d.phase = 2; d.t = 0; d.x = 100; d.y = 180; d.fireT = 99999;
  player.x = 92; player.dying = 0; pBullet = null;
  pBullet = { x: d.x + 7, y: d.y + 6 };
  tick();
  T1 = d.state;
`);
console.log("T1 overlap kill:", run("T1"), "(want dead)");

// TEST 2: aim-locked realistic: bullet fired from below into the diver's box
freshPlay();
run(`
  var d = fleet.find(a => a.rank === 0);
  startDive(d); d.phase = 2; d.t = 0; d.wig = 0; d.x = 112; d.y = 150; d.fireT = 99999;
  player.x = 105; player.dying = 0; pBullet = null; game.score = 0;
  var sb = game.score;
  for (var i = 0; i < 120 && d.state === "dive"; i++) {
    if (!pBullet && d.y > 160) pBullet = { x: d.x + 7, y: d.y + 10 };  // from below
    tick();
  }
  T2 = { killed: d.state === "dead", pts: game.score - sb };
`);
console.log("T2 aim-locked kill:", JSON.stringify(run("T2")), "(want killed:true, pts:60)");

// TEST 3: lane-prediction defense — like the original, the player camps the
// predicted dive lane (slot + 16 peel + 30 hook-in = +46) and the diver dies
// crossing it. Lane-committed divers don't home, so this is THE defense skill.
freshPlay();
run(`
  var d = fleet.find(a => a.rank === 0 && a.slotX === 115);
  startDive(d);
  var lane = 115 + 46;                     // predicted sprite-left-edge lane
  player.x = lane;                         // bullet = player.x+7 = sprite center
  player.dying = 0; pBullet = null;
  for (var i = 0; i < 400 && d.state === "dive"; i++) {
    if (!pBullet && d.y > 100) pBullet = { x: player.x + 7, y: 230 };
    tick();
  }
  T3 = d.state;
`);
console.log("T3 lane-prediction defense:", run("T3"), "(want dead)");

// TEST 4: natural triple death -> GAME OVER text draws, lasts ~5s, Enter restarts
freshPlay();
run(`
  game.lives = 1; player.dying = 0;
  killPlayer();
  for (var i = 0; i < 70; i++) tick();
  ST = game.state;
`);
console.log("T4 state after last death:", run("ST"), "(want over)");
draws.length = 0; run("render()");
const at112 = draws.filter(d => d.y === 112).length, at132 = draws.filter(d => d.y === 132).length;
console.log("T4 GAME OVER glyphs at y=112:", at112, " FINAL SCORE glyphs at y=132:", at132, "(want 9 and >9)");
run("var overT0 = game.overT; for (var i = 0; i < 299; i++) tick(); T4b = { state: game.state, t: game.overT };");
console.log("T4 after 299 ticks still:", JSON.stringify(run("T4b")), "(want state over, t>=1)");
run("tick(); T4c = game.state;");
console.log("T4 after full timeout:", run("T4c"), "(want attract)");
run("startGame(); T4d = game.state;");
console.log("T4 Enter restarts:", run("T4d"), "(want ready)");

// TEST 5: formation shooting still works (isolated: no dive dispatch in window)
freshPlay();
run(`
  game.tick = Math.floor(game.tick / 45) * 45 + 1;   // keep dispatch quiet for 30 ticks
  var d = fleet.find(a => a.state === "form" && a.rank === 2);
  player.x = d.slotX - 3; player.dying = 0; pBullet = null; game.score = 0;
  var sb = game.score;
  for (var i = 0; i < 30 && d.state === "form"; i++) {
    if (!pBullet) pBullet = { x: player.x + 7, y: 232 };
    tick();
  }
  T5 = { killed: d.state === "dead", pts: game.score - sb };
`);
console.log("T5 formation kill:", JSON.stringify(run("T5")), "(want killed:true, pts:50)");

// TEST 6: dive silhouette — small lift (<=6px), then a deep snake dive
freshPlay();
run(`
  var d = fleet.filter(a => a.rank === 0).pop();   // last drone = bottom row
  startDive(d);
  var maxClimb = 0, maxY = 0, reachedDive = false;
  for (var i = 0; i < 300 && d.state !== "dead"; i++) {
    tick();
    if (d.phase === 0) maxClimb = Math.max(maxClimb, d.slotY - d.y);
    if (d.phase >= 2) { reachedDive = true; maxY = Math.max(maxY, d.y); }
  }
  T6 = { maxClimb: maxClimb, reachedDive: reachedDive, deep: maxY };
`);
console.log("T6 dive silhouette:", JSON.stringify(run("T6")), "(want maxClimb<=6, reachedDive:true, deep>250)");

// TEST 7: difficulty ramp is monotonic (dive interval falls, divers/speed rise)
run(`
  T7 = {
    i1: diveInterval(1),  i5: diveInterval(5),  i12: diveInterval(12),
    m1: maxDiversForWave(1), m3: maxDiversForWave(3), m6: maxDiversForWave(6), m12: maxDiversForWave(12),
    v1: diveVy(1), v12: diveVy(12)
  };
  T7.ok = T7.i1 > T7.i5 && T7.i5 >= T7.i12 && T7.m1 < T7.m3 && T7.m3 < T7.m6 && T7.m6 <= T7.m12 && T7.v12 > T7.v1;
`);
console.log("T7 difficulty ramp:", JSON.stringify(run("T7")), "(want ok:true)");
