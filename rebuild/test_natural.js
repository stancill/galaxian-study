// natural-flow test: real deaths, real state machine
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

// natural start
run(`
  startGame();
  for (var i = 0; i < 120; i++) tick();          // ready -> play
  fleet.forEach(a => { if (a.state === "entry") { a.state = "form"; a.t = 100; a.x = a.slotX; a.y = a.slotY; } });
`);

// kill the player naturally 3 times: park a diver on the ship every respawn
const hist = [];
for (let death = 1; death <= 3; death++) {
  run(`
    var d = fleet.find(a => a.state === "dive") || fleet.find(a => a.state === "form" && a.rank === 0);
    if (d && d.state === "form") startDive(d);
    if (d) { d.phase = 2; d.t = 0; d.x = player.x; d.y = 220; }
  `);
  let saw = [];
  for (let i = 0; i < 400; i++) {
    run("tick()");
    saw.push(run("game.state + ':' + player.dying"));
    if (run("game.state") === "over") break;
  }
  hist.push({ death, states: saw.filter((s, i, arr) => i === 0 || s !== arr[i-1]).slice(0, 8), final: saw[saw.length-1] });
}
console.log("state history per death:");
hist.forEach(h => console.log(" ", JSON.stringify(h)));

console.log("after 3 natural deaths: state =", run("game.state"), " lives =", run("game.lives"));
draws.length = 0;
run("render()");
const goGlyphs = draws.filter(d => d.y === 128 && d.tag && d.tag.startsWith("c")).length;
console.log("draw ops at y=128 during 'over' render:", draws.filter(d => d.y === 128).length);
