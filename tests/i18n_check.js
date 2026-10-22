// Checks that every text the game can show has a Chinese and a Spanish translation, and
// that translated labels and pop-ups keep their numbers exactly (numbers are never
// reformatted). Runs with Node alone; used by CI and by tests/test_i18n.py.
// Usage, from the repository root:  node tests/i18n_check.js
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "web", "src");
const I18N = require(path.join(src, "i18n.js"));
const games = {
  full: require(path.join(src, "engine-full.js")),
  demo: require(path.join(src, "engine-demo.js")),
};

const dynamic = new Set(); // engine text with numbers in it
const fixed = new Set(); // page text

// --- text from the engines ----------------------------------------------------------

const VIEW_TEXT = ["score", "clickCost", "spsCost", "clickPower", "scorePerSecond", "goal", "progress", "prestige", "prestigePoints"];

function collect(g, messages) {
  const v = g.view();
  for (const k of VIEW_TEXT) if (v[k] !== null) dynamic.add(v[k]);
  for (const [, title, text] of messages.splice(0)) {
    if (title !== null) fixed.add(title);
    dynamic.add(text);
  }
}

let seed = 777;
function rand() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}

for (const [kind, Game] of Object.entries(games)) {
  const messages = [];
  const timers = [];
  const hooks = { message: (k, title, text) => messages.push([k, title, text]), schedule: (ms, fn) => timers.push(fn) };

  // Every achievement pop-up, exactly as the engine words it.
  const g = new Game(hooks);
  for (const a of g.achievements.concat(g.special_achievements)) g._unlock(a);
  collect(g, messages);

  // A long random game: labels, milestones, "not enough" messages, prestige.
  const r = new Game(hooks);
  r.start();
  for (let i = 0; i < 20000; i++) {
    const x = rand();
    if (x < 0.55) r.press("click");
    else if (x < 0.7) r.tick();
    else if (x < 0.9) r.press(rand() < 0.5 ? "buy_click" : "buy_sps");
    else if (x < 0.93 && timers.length) timers.shift()();
    else if (x < 0.96) r.press(Game.BUTTONS ? Game.BUTTONS[4 + Math.floor(rand() * (Game.BUTTONS.length - 4))] : "pu_cheaper");
    else r.press("prestige");
    collect(r, messages);
  }

  // Winning, and the labels after a win.
  const w = new Game(hooks);
  w.score = kind === "full" ? 10n ** 64n : 10000n;
  w.tick();
  collect(w, messages);
}

// --- text from the page (index.html, ui.js and the build titles) ---------------------

const html = fs.readFileSync(path.join(src, "index.html"), "utf8");
for (const m of html.matchAll(/data-i18n>([^<]*)</g)) {
  if (m[1] !== "{{TITLE}}") fixed.add(m[1].replace(/&middot;/g, "·"));
}
const build = fs.readFileSync(path.join(root, "tools", "build.py"), "utf8");
for (const m of build.matchAll(/"title": "([^"]+)"/g)) fixed.add(m[1]);
const ui = fs.readFileSync(path.join(src, "ui.js"), "utf8");
const UI_PATTERNS = [
  /\bt\("((?:[^"\\]|\\.)*)"\)/g, // t("...")
  /\[\s*"((?:[^"\\]|\\.)*)",\s*(?:function|null)/g, // dialog buttons
  /\["pu_\w+", "((?:[^"\\]|\\.)*)"\]/g, // prestige upgrades
  /importHint: "((?:[^"\\]|\\.)*)"/g,
  /(?:title|text): "((?:[^"\\]|\\.)*)"/g, // dialog titles and texts
  /\btext: \[edition\.importHint, "((?:[^"\\]|\\.)*)"\]/g,
  /= "((?:secret )?achievement unlocked!)"/g,
  /"(Error|OK|language)"/g,
];
for (const re of UI_PATTERNS) {
  for (const m of ui.matchAll(re)) fixed.add(JSON.parse('"' + m[1] + '"'));
}
// t("Saving failed (" + err.name + ") ...") is built at run time; check one real example.
fixed.delete("Saving failed (");
dynamic.add('Saving failed (QuotaExceededError). Use "export save" to keep your progress.');

// --- checks -------------------------------------------------------------------------

const NUMBER = /-?\d+(?:\.\d+)?(?:e[+-]\d+)?/g;
const problems = [];
for (const lang of I18N.LANGUAGES.map((l) => l.code).filter((c) => c !== "en")) {
  for (const text of fixed) {
    if (I18N.translate(lang, text) === null) problems.push(`${lang}: no translation for ${JSON.stringify(text)}`);
  }
  for (const text of dynamic) {
    const out = I18N.translate(lang, text);
    if (out === null) {
      problems.push(`${lang}: no translation for ${JSON.stringify(text)}`);
      continue;
    }
    // Numbers in the rewards line and labels must come through unchanged.
    const numbers = (text.split("\n\nrewards: ")[1] !== undefined ? text.split("\n\nrewards: ")[1] : text).match(NUMBER) || [];
    for (const n of numbers) {
      if (!out.includes(n)) problems.push(`${lang}: ${JSON.stringify(out)} lost the number ${n}`);
    }
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`translations ok: ${fixed.size} page texts and ${dynamic.size} game texts in ` +
  I18N.LANGUAGES.map((l) => l.code).join(", "));
