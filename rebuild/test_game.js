// headless test harness: drives the real game.js logic with stubbed DOM
"use strict";
const fs = require("fs"), vm = require("vm");

// ---- recording canvas stubs ----
let canvasId = 0;
const draws = [];   // {canvasId, tag, x, y}
function makeCtx(canvasRef) {
  return new Proxy({}, {
    get: (t, p) => {
      if (p === "canvas") return canvasRef;
      return (...args) => {
        if (p === "drawImage") draws.push({ canvasId: canvasRef.id, tag: canvasRef.tag, x: args[1], y: args[2] });
        if (p === "fillRect") draws.push({ canvasId: canvasRef.id, tag: canvasRef.tag, x: args[0], y: args[1] });
        return undefined;
      };
    },
    set: () => true
  });
}
function makeCanvas(tag) {
  const c = { id: ++canvasId, tag: tag || ("c" + canvasId), width: 0, height: 0, style: {} };
  c.getContext = () => makeCtx(c);
  return c;
}

const documentStub = {
  createElement: () => makeCanvas(),
  getElementById: () => makeCanvas("screen")
};
const windowStub = { addEventListener: () => {}, AudioContext: undefined, webkitAudioContext: undefined };

const sandbox = {
  console, document: documentStub, window: windowStub,
  localStorage: { getItem: () => null, setItem: () => {} },
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => 0,
  module: undefined
};
vm.createContext(sandbox);

for (const f of ["palette.js", "art.js", "starfield.js", "audio.js", "game.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), sandbox, { filename: f });
}

const run = (code) => vm.runInContext(code, sandbox);

// ---- setup: force play state with completed formation ----
run(`
  game.state = "play"; game.readyT = 0;
  fleet.forEach(a => { a.state = "form"; a.t = 100; a.x = a.slotX; a.y = a.slotY; });
`);

// ==== TEST 1: can a diving alien be shot? (bullet spawned overlapping diver) ====
run(`
  var d = fleet.find(a => a.rank === 0);
  startDive(d);
  d.phase = 2; d.t = 0; d.x = 100; d.y = 180;
  player.x = 92; player.dying = 0; pBullet = null; eBullets = [];
  var diveStates = [];
  // place an overlapping bullet and tick once
  pBullet = { x: d.x + 7, y: d.y + 6 };
  tick();
  diveStates.push(d.state);
`);
console.log("TEST1 diver state after overlapping-bullet tick:", run("diveStates[0]"), "(want 'dead')");

// ==== TEST 2: realistic pursuit — player holds fire under diver lane ====
run(`
  buildFleet(false);
  fleet.forEach(a => { a.state = "form"; a.t = 100; a.x = a.slotX; a.y = a.slotY; });
  game.score = 0;
  var d2 = fleet.find(a => a.rank === 0);
  startDive(d2);
  d2.phase = 2; d2.t = 0; d2.wig = 0; d2.targetX = 112; d2.x = 112; d2.y = 150;
  d2.fireT = 99999;                       // don't shoot back
  player.x = 104; player.dying = 0; pBullet = null; eBullets = [];
  game.lives = 3;
  var scoreBefore = game.score, passes = 0;
  // auto-fire: as soon as bullet free and diver below y=150, fire from player pos
  for (var i = 0; i < 400; i++) {
    if (!pBullet && d2.state === "dive" && d2.y > 150) pBullet = { x: d2.x + 7, y: d2.y - 2 };
    tick();
    if (d2.state === "dead") break;
  }
  TEST2 = { killed: d2.state === "dead", score: game.score - scoreBefore };
`);
console.log("TEST2 realistic aim-locked kill:", JSON.stringify(run("TEST2")), "(want killed:true)");

// ==== TEST 3: player fires from fixed spot — diver crosses the bullet column ====
run(`
  buildFleet(false);
  fleet.forEach(a => { a.state = "form"; a.t = 100; a.x = a.slotX; a.y = a.slotY; });
  var d3 = fleet.find(a => a.rank === 0);
  startDive(d3);
  d3.phase = 2; d3.t = 0; d3.wig = 0; d3.targetX = 112; d3.x = 112; d3.y = 96;
  d3.fireT = 99999;
  player.x = 112 - 7; player.dying = 0; pBullet = null; eBullets = [];
  var shots = 0, hits = 0;
  for (var i = 0; i < 600; i++) {
    // player keeps a bullet rising in the diver's column at all times
    if (!pBullet) { pBullet = { x: 112, y: 230 }; shots++; }
    tick();
    if (d3.state === "dead") { hits = 1; break; }
    if (d3.state === "form") break; // went home
  }
  TEST3 = { shots, killed: hits === 1 };
`);
console.log("TEST3 stationary-column defense:", JSON.stringify(run("TEST3")));

// ==== TEST 4: game over — 3rd death shows state 'over' + renders GAME OVER text ====
run(`
  buildFleet(false);
  fleet.forEach(a => { a.state = "form"; a.t = 100; a.x = a.slotX; a.y = a.slotY; });
  game.state = "play"; game.lives = 1; player.dying = 0;
  eBullets = []; pBullet = null;
  killPlayer();
  for (var i = 0; i < 70; i++) tick();
  GAMEOVER = { state: game.state, overT: game.overT };
`);
console.log("TEST4 state after last death:", JSON.stringify(run("GAMEOVER")), "(want state:'over')");
draws.length = 0;
run("render();");
const gameOverDraws = draws.filter(d => d.y === 128);
console.log("TEST4 drawImage/fillRect ops at y=128 while rendering 'over':", gameOverDraws.length, "(want >0)");

// ==== TEST 5: does 'over' regress to attract after 180 ticks, and is text gone then? ====
run("for (var i = 0; i < 200; i++) tick(); OVER_STATE = game.state;");
console.log("TEST5 state 200 ticks after game over:", run("OVER_STATE"), "(want 'attract')");

// ==== TEST 6: player death mid-dive → divers frozen, then game continues ====
run(`
  buildFleet(false);
  fleet.forEach(a => { a.state = "form"; a.t = 100; a.x = a.slotX; a.y = a.slotY; });
  var d6 = fleet.find(a => a.rank === 0);
  startDive(d6); d6.phase = 2; d6.t = 0; d6.x = player.x; d6.y = 200;
  game.lives = 3; player.dying = 0;
  var y0 = d6.y;
  killPlayer();
  for (var i = 0; i < 30; i++) tick();
  TEST6 = { frozen: d6.y === y0, dying: player.dying };
`);
console.log("TEST6 world freeze during death:", JSON.stringify(run("TEST6")));
