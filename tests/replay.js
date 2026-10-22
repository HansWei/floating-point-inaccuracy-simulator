// Replays traces recorded from the original Python games against the JS engines.
// Reads JSON from stdin: {traces: [...], saves: [...]}; writes JSON results to stdout.
// Used by tests/test_parity.py.
"use strict";

const path = require("path");
const src = path.join(__dirname, "..", "web", "src");
const P = require(path.join(src, "pyfloat.js"));
const FullGame = require(path.join(src, "engine-full.js"));
const DemoGame = require(path.join(src, "engine-demo.js"));

const FULL_VARS = [
  "won", "score", "click_power", "score_per_second", "click_upgrade_index",
  "sps_upgrade_index", "prestige_points", "lifetime_PP", "cheaper_upgrades_index",
  "sps_prestige_upgrade_index", "score_ms_index", "upgrade_ms_index",
  "prestige_ms_index", "time_elapsed", "total_clicks", "lifetime_prestiges",
  "broke_counter", "upgrades_paid_for", "run_clicks", "click_avm_boost",
  "sps_avm_boost", "general_avm_boost",
];
const DEMO_VARS = [
  "won", "score", "click_power", "score_per_second", "click_upgrade_index",
  "sps_upgrade_index", "prestige_points", "lifetime_PP", "cheaper_upgrades_index",
  "time_elapsed", "total_clicks", "broke_counter", "upgrades_paid_for", "run_clicks",
  "click_avm_boost", "sps_avm_boost", "general_avm_boost",
];
const COUNTERS = new Set(["click_upgrade_index", "sps_upgrade_index", "cheaper_upgrades_index",
  "sps_prestige_upgrade_index", "score_ms_index", "upgrade_ms_index", "prestige_ms_index",
  "time_elapsed", "total_clicks", "lifetime_prestiges", "broke_counter", "upgrades_paid_for",
  "run_clicks"]);

function snapshot(g) {
  const out = {};
  for (const name of g.kind === "full" ? FULL_VARS : DEMO_VARS) {
    const v = g[name];
    out[name] = COUNTERS.has(name) ? String(v) : P.pyStr(v);
  }
  if (g.achievements) {
    out.achievements = g.achievements.map((a) => (a.unlocked ? "1" : "0")).join("");
    out.special = g.special_achievements.map((a) => (a.unlocked ? "1" : "0")).join("");
  }
  return out;
}

function makeHooks() {
  const state = { messages: [], timers: [] };
  state.hooks = {
    message: (kind, title, text) => state.messages.push([kind, title, text]),
    schedule: (ms, fn) => { if (ms === 35000) state.timers.push(fn); },
  };
  state.take = () => state.messages.splice(0);
  return state;
}

function typedValue(v) {
  return "int" in v ? BigInt(v.int) : P.fromHex(v.float);
}

function apply(g, h, step) {
  if (step.op === "tick") {
    for (let i = 0; i < (step.n || 1); i++) g.tick();
  } else if (step.op === "timer") {
    const fn = h.timers.shift();
    if (fn) fn();
  } else if (step.op === "add") {
    const v = typedValue(step.value);
    g[step.var] = COUNTERS.has(step.var) ? g[step.var] + Number(v) : P.pyAdd(g[step.var], v);
  } else {
    g.press(step.op);
  }
}

// The demo's save is the web version's own format, so it must restore every value exactly.
// (The full game's save follows Python's load_game casts and is checked by test_parity.py.)
function checkSaveRoundTrip(g) {
  const Game = g.kind === "full" ? FullGame : DemoGame;
  const back = Game.fromSaveText(g.toSaveText());
  if (!back) throw new Error("own save could not be loaded: " + g.toSaveText());
  if (g.kind === "demo" && JSON.stringify(snapshot(back)) !== JSON.stringify(snapshot(g))) {
    throw new Error("demo save changed the state: " + g.toSaveText());
  }
}

function replay(trace) {
  const h = makeHooks();
  const Game = trace.kind === "full" ? FullGame : DemoGame;
  const g = new Game(h.hooks);
  g.start();
  const result = { name: trace.name, start: { snapshot: snapshot(g), messages: h.take() }, steps: [] };
  for (const rec of trace.steps) {
    try {
      apply(g, h, rec.step);
      checkSaveRoundTrip(g);
      result.steps.push({ snapshot: snapshot(g), messages: h.take() });
    } catch (err) {
      result.steps.push({ error: String(err && err.stack || err) });
      break;
    }
  }
  return result;
}

// Load a Python-written save.json and run the startup tick, like the original does.
// Also return the JS-written save text (taken before the tick) so Python can load it back.
function loadSave(item) {
  const h = makeHooks();
  const g = FullGame.fromSaveText(item.text, h.hooks);
  if (!g) return { name: item.name, error: "load failed" };
  const exported = g.toSaveText();
  g.start();
  return { name: item.name, snapshot: snapshot(g), messages: h.take(), exported };
}

function tables() {
  const row = (a) => [a.title, a.description, a.boosts.map(P.pyStr), P.pyStr(a.pp)];
  const out = {};
  for (const [kind, Game] of [["full", FullGame], ["demo", DemoGame]]) {
    const g = new Game();
    out[kind] = { achievements: g.achievements.map(row), special: g.special_achievements.map(row) };
  }
  return out;
}

let input = "";
process.stdin.on("data", (d) => { input += d; });
process.stdin.on("end", () => {
  const req = JSON.parse(input);
  const out = {
    traces: (req.traces || []).map(replay),
    saves: (req.saves || []).map(loadSave),
    tables: tables(),
  };
  process.stdout.write(JSON.stringify(out));
});
