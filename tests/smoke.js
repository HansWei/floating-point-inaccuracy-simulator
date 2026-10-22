// Quick check that runs anywhere Node 16+ runs (used by CI, where the macOS-specific
// parity tests cannot run): each game plays a long scripted session without errors,
// saves round-trip exactly, and the built pages exist.
// Usage, from the repository root:  node tests/smoke.js
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.join(__dirname, "..");
const src = path.join(root, "web", "src");
const P = require(path.join(src, "pyfloat.js"));
const games = {
  full: require(path.join(src, "engine-full.js")),
  demo: require(path.join(src, "engine-demo.js")),
};

// Python results the port must reproduce.
assert.strictEqual(P.pyStr(P.pyAdd(0.1, 0.2)), "0.30000000000000004");
assert.strictEqual(P.pyStr(2.0), "2.0");
assert.strictEqual(P.pyStr(1e16), "1e+16");
assert.strictEqual(Math.trunc(P.pyLog(1000000000.0000011, 10)), 9);
assert.strictEqual(Math.trunc(P.pyLog(8.810488730080142, 10) / 63 * 1000) / 10, 1.5);

let seed = 12345;
function rand() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}

for (const [kind, Game] of Object.entries(games)) {
  const messages = [];
  const timers = [];
  const hooks = {
    message: (k, title) => messages.push(title),
    schedule: (ms, fn) => timers.push(fn),
  };
  const g = new Game(hooks);
  g.start();
  for (let i = 0; i < 20000; i++) {
    const r = rand();
    if (r < 0.6) g.press("click");
    else if (r < 0.75) g.tick();
    else if (r < 0.95) g.press(rand() < 0.5 ? "buy_click" : "buy_sps");
    else if (r < 0.97 && timers.length) timers.shift()();
    else if (r < 0.985) g.press("pu_cheaper");
    else g.press("prestige");
    g.view();
  }
  const text = g.toSaveText();
  const loaded = Game.fromSaveText(text, {});
  assert.ok(loaded, `${kind}: save did not load`);
  // The full game loads like the desktop load_game(), which turns some ints into floats
  // (0 becomes 0.0), so its save is stable from the first reload on; the demo's is exact.
  const again = Game.fromSaveText(loaded.toSaveText(), {});
  assert.strictEqual(again.toSaveText(), loaded.toSaveText(), `${kind}: save is not stable`);
  if (kind === "demo") assert.strictEqual(loaded.toSaveText(), text, "demo: save did not round-trip");
  const unlocked = g.achievements.filter((a) => a.unlocked).length;
  assert.ok(unlocked > 0, `${kind}: no achievement unlocked`);
  console.log(`${kind}: 20000 steps ok, score ${P.pyStr(g.score)}, ` +
    `${unlocked}/${g.achievements.length} achievements, ${messages.length} pop-ups`);
}

for (const page of ["full/index.html", "demo/index.html", "index.html"]) {
  const file = path.join(root, "dist", page);
  assert.ok(fs.existsSync(file), `missing dist/${page} (run tools/build.py)`);
}
console.log("built pages present");
