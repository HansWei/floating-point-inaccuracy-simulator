/*
 * Floating Point Inaccuracy Simulator (demo): game rules, ported line by line from
 * desktop/floating_point_inaccuracy_simulator_demo.py (the original demo plus the full
 * game's achievement system, with goals scaled to the demo). Same conventions as
 * engine-full.js: Python names, BigInt for ints, numbers for floats, UI via hooks.
 */
(function (root) {
  "use strict";

  var P = root.PyNum || (typeof require === "function" ? require("./pyfloat.js") : null);
  var pyAdd = P.pyAdd, pySub = P.pySub, pyMul = P.pyMul, pyInt = P.pyInt, pyLog = P.pyLog,
    pyPow = P.pyPow, pyStr = P.pyStr;
  var S = root.PySave || (typeof require === "function" ? require("./savejson.js") : null);

  var WIN_SCORE = 1000;

  function DemoGame(hooks) {
    this.hooks = hooks || {};
    this.won = false;
    this.score = 0n;
    this.click_power = 0.1;
    this.score_per_second = 0n;
    this.click_upgrade_index = 1;
    this.sps_upgrade_index = 1;
    this.prestige_points = 0n;
    this.lifetime_PP = 0n;
    this.cheaper_upgrades_index = 0;

    this.time_elapsed = 0;
    this.total_clicks = 0;
    this.broke_counter = 0;
    this.upgrades_paid_for = 0;
    this.run_clicks = 0;

    this.click_avm_boost = 0n;
    this.sps_avm_boost = 0n;
    this.general_avm_boost = 0n;

    this.achievements = makeAchievements(this);
    this.special_achievements = makeSpecialAchievements(this);
  }

  DemoGame.kind = "demo";
  DemoGame.prototype.kind = "demo";
  DemoGame.BUTTONS = ["click", "buy_click", "buy_sps", "prestige", "pu_cheaper", "pu_timeskip"];

  DemoGame.prototype._message = function (kind, title, text) {
    if (this.hooks.message) this.hooks.message(kind, title, text);
  };

  DemoGame.prototype._schedule = function (ms, fn) {
    if (this.hooks.schedule) this.hooks.schedule(ms, fn);
  };

  // --- values shown on screen ------------------------------------------------

  DemoGame.prototype.prestigeGain = function () {
    if (!(this.score >= 1)) return 0n;
    var v = pyInt(pyLog(this.score, 5));
    return 0n > v ? 0n : v;
  };

  DemoGame.prototype.clickIncome = function () {
    return pyMul(pyMul(this.click_power, pyAdd(1n, this.click_avm_boost)),
      pyAdd(1n, this.general_avm_boost));
  };

  DemoGame.prototype.passiveIncome = function () {
    return pyMul(pyMul(this.score_per_second, pyAdd(1n, this.sps_avm_boost)),
      pyAdd(1n, this.general_avm_boost));
  };

  DemoGame.prototype.clickCost = function () {
    return pyInt(pyPow(1.6, this.click_upgrade_index) * pyPow(0.95, this.cheaper_upgrades_index));
  };

  DemoGame.prototype.spsCost = function () {
    return pyInt(pyPow(1.4, this.sps_upgrade_index) * pyPow(0.95, this.cheaper_upgrades_index));
  };

  DemoGame.prototype.view = function () {
    return {
      score: "score: " + pyStr(this.score),
      clickPower: "click power: " + pyStr(this.clickIncome()),
      scorePerSecond: "score per second: " + pyStr(this.passiveIncome()),
      goal: "get 1000 score to win",
      progress: null,
      clickCost: pyStr(this.clickCost()),
      spsCost: pyStr(this.spsCost()),
      canAffordClick: this.score >= this.clickCost(),
      canAffordSps: this.score >= this.spsCost(),
      prestige: "reset all other progress for " + pyStr(this.prestigeGain()) + " prestige points",
      prestigePoints: "prestige points: " + pyStr(this.prestige_points),
      canAffordPrestigeUpgrade: this.prestige_points >= 1n,
    };
  };

  // --- game functions --------------------------------------------------------

  DemoGame.prototype.increment_func = function () {
    this.score = pyAdd(this.score, this.clickIncome());
    this.total_clicks += 1;
    this.run_clicks += 1;
    this.check_achievments();
  };

  DemoGame.prototype.per_sec_update = function () {
    this.time_elapsed += 1;
    this.score = pyAdd(this.score, this.passiveIncome());
    this.check_achievments();
    if (this.score >= WIN_SCORE && !this.won) {
      this.won = true;
      this._message("info", null, "yay u completed the demo of floating point inaccuracy simulator!");
    }
  };

  DemoGame.prototype._broke = function () {
    var self = this;
    this.broke_counter += 1;
    this._schedule(35000, function () { self.check_achievments(1); });
  };

  DemoGame.prototype.upgrade_click = function () {
    var cost = this.clickCost();
    if (this.score >= cost) {
      if (cost !== 0n) this.upgrades_paid_for += 1;
      this.click_power += 0.05;
      this.click_upgrade_index += 1;
      this.score = pySub(this.score, cost);
      return true;
    }
    this._broke();
    return false;
  };

  DemoGame.prototype.upgrade_sps = function () {
    var cost = this.spsCost();
    if (this.score >= cost) {
      if (cost !== 0n) this.upgrades_paid_for += 1;
      this.score_per_second = pyAdd(this.score_per_second, 0.15);
      this.sps_upgrade_index += 1;
      this.score = pySub(this.score, cost);
      return true;
    }
    this._broke();
    return false;
  };

  DemoGame.prototype.prestige = function () {
    this.check_achievments(0);
    if (this.score >= 10) {
      this.check_achievments(2);
      this.check_achievments(3);
    }
    var points = this.prestigeGain();
    this.score = 0n;
    this.click_power = 0.1;
    this.score_per_second = 0n;
    this.click_upgrade_index = 1;
    this.sps_upgrade_index = 1;
    this.prestige_points += points;
    this.lifetime_PP += points;
    this.upgrades_paid_for = 0;
    this.run_clicks = 0;
  };

  DemoGame.prototype.prestige_upgrades = function (upgrade) {
    if (this.prestige_points < 1n) {
      this._broke();
      this._message("info", null, "you do not have enough prestige points for that.");
      return false;
    }
    this.prestige_points -= 1n;
    if (upgrade === 0) { // make all upgrades 5% cheaper (multiplicative)
      this.cheaper_upgrades_index += 1;
    } else if (upgrade === 2) { // instant 3 minutes of passive income
      this.score = pyAdd(this.score, pyMul(this.passiveIncome(), 180n));
    }
    return true;
  };

  DemoGame.prototype._unlock = function (a) {
    var reward = a.reward(this.score);
    this._message("info", a.title, a.description + "\n\nrewards: " + pyStr(reward) + " score, " +
      pyStr(pyMul(a.boosts[0], 100n)) + "% boost to clicking income, " +
      pyStr(pyMul(a.boosts[1], 100n)) + "% boost to passive income, " +
      pyStr(pyMul(a.boosts[2], 100n)) + "% boost to all income, " +
      pyStr(a.pp) + " prestige points.");
    a.unlocked = true;
    this.score = pyAdd(this.score, a.reward(this.score));
    this.click_avm_boost = pyAdd(this.click_avm_boost, a.boosts[0]);
    this.sps_avm_boost = pyAdd(this.sps_avm_boost, a.boosts[1]);
    this.general_avm_boost = pyAdd(this.general_avm_boost, a.boosts[2]);
    this.prestige_points += a.pp;
    this.lifetime_PP += a.pp;
  };

  DemoGame.prototype.check_achievments = function (index) {
    for (var i = 0; i < this.achievements.length; i++) {
      var a = this.achievements[i];
      if (a.quota(a.value()) && !a.unlocked) this._unlock(a);
    }
    if (index !== undefined && index !== null && !this.special_achievements[index].unlocked) {
      var s = this.special_achievements[index];
      if (s.quota(s.value()) && !s.unlocked) this._unlock(s);
    }
  };

  DemoGame.prototype.press = function (button) {
    switch (button) {
      case "click": return this.increment_func();
      case "buy_click":
        if (!this.upgrade_click()) this._message("error", null, "you do not have enough score for this.");
        return;
      case "buy_sps":
        if (!this.upgrade_sps()) this._message("error", null, "you do not have enough score for this.");
        return;
      case "prestige": return this.prestige();
      case "pu_cheaper": return this.prestige_upgrades(0);
      case "pu_timeskip": return this.prestige_upgrades(2);
      default: throw new Error("unknown button " + button);
    }
  };

  DemoGame.prototype.start = function () { this.per_sec_update(); };
  DemoGame.prototype.tick = function () { this.per_sec_update(); };

  // --- achievements (same table as the desktop demo) ---------------------------

  function A(title, description, value, quota, reward, boosts, pp) {
    return { title: title, description: description, value: value, quota: quota,
      reward: reward, boosts: boosts, pp: pp, unlocked: false };
  }

  var ALL_100 = "100 percenting floating point inaccuracy simulator (demo) any % speedrun";

  function makeAchievements(g) {
    var zero = function () { return 0n; };
    var score = function () { return g.score; };
    var clicks = function () { return g.total_clicks; };
    var time = function () { return g.time_elapsed; };
    var broke = function () { return g.broke_counter; };
    return [
      A("the name of the game", "find out that computers aren't good at floating-point arithmetic",
        score, function (s) { return s >= 0.30000000000000004; },
        function () { return 0.00000000000000001; }, [0n, 0n, 0n], 0n),
      A("beginning of the end", "click for the first time. you will do this many, many more times.",
        clicks, function (c) { return c >= 1; }, zero, [0n, 0n, 0n], 0n),
      A("making progress", "10% of the way there",
        score, function (s) { return s >= 100; }, zero, [0n, 0.05, 0.05], 0n),
      A("halfway there!", "get 50% progress",
        score, function (s) { return s >= 500; }, zero, [0n, 0n, 0.02], 1n),
      A("time wasters: wasters of time", "get to 200 score without prestiging",
        score, function (s) { return s >= 200 && g.lifetime_PP === 0n; },
        function () { return -1n; }, [0n, 0n, 0n], 0n),
      A("lol", "you have officially been permanently locked out of an achievement. we wont tell you what.",
        function () { return g.lifetime_PP; }, function (pp) { return pp >= 1n; },
        zero, [0n, 0n, -0.001], 0n),
      A("hoarder", "have at least 10 prestige points at a time",
        function () { return g.prestige_points; }, function (pp) { return pp >= 10n; },
        zero, [0.01, 0n, 0n], 0n),
      A("carpal tunnel syndrome", "click 1000 times",
        clicks, function (c) { return c >= 1000; },
        function (s) { return pyMul(s, 0.1); }, [0n, 0.01, 0n], 0n),
      A("filler text", "im bored so heres a gift",
        clicks, function (c) { return c >= 1947; },
        function (s) { return pyMul(s, 0.01); }, [0.01, 0n, 0n], 1n),
      A("autoclicker", "click 10000 times",
        clicks, function (c) { return c >= 10000; }, zero, [0.01, 0n, 0.005], 0n),
      A("cheater!", "hey. i know youre using an autoclicker. stop it.",
        function () { return g.total_clicks / Math.max(g.time_elapsed, 1); },
        function (cps) { return cps > 20; },
        function (s) { return pyMul(-0.2, s); }, [-0.1, 0.01, 0n], 0n),
      A("i got you a gift!", "a small gift, just for you =)",
        time, function (t) { return t >= 492; }, zero, [0n, 0n, 0.01], 1n),
      A("stop.", "playing this game is dangerous, you can still leave.",
        time, function (t) { return t >= 600; }, zero, [0n, 0n, 0n], 0n),
      A("go touch grass", "play for 24 hours",
        time, function (t) { return t >= 86400; }, zero, [0n, 0n, 0.05], 1n),
      A("bankruptcy", "click 100 upgrades without being able to afford them",
        broke, function (c) { return c >= 100; }, zero, [0n, 0n, 0n], 0n),
      A("need a loan?", "click 1000 upgrades without being able to afford them",
        broke, function (c) { return c >= 1000; },
        function (s) { return pyMul(0.1, s); }, [-0.01, 0n, 0n], 0n),
      A("free sample", "buy an upgrade for free",
        function () { return g.upgrades_paid_for; },
        function (u) { return u < g.click_upgrade_index + g.sps_upgrade_index - 2; },
        function () { return 2.5; }, [0n, 0n, 0n], 1n),
      A(ALL_100, "get every achievement (besides this one)",
        function () { return g.achievements; },
        function (list) {
          return list.every(function (x) { return x.title === ALL_100 || x.unlocked; });
        },
        zero, [0n, 0n, 0.05], 5n),
    ];
  }

  function makeSpecialAchievements(g) {
    var zero = function () { return 0n; };
    return [
      A("why?", "prestige with less than 10 score and reset all your progress for nothing",
        function () { return g.score; }, function (s) { return s < 10; },
        zero, [0n, 0n, -0.01], 0n),
      A("take a break.", "go outside. drink some water. touch grass. whatever. just take a break.",
        function () { return g.broke_counter; }, function (b) { return b >= 42; },
        zero, [0n, 0n, 0n], 0n),
      A("the average costco:", "prestige with at least 10 score without paying for a single upgrade",
        function () { return g.upgrades_paid_for; }, function (u) { return u === 0; },
        zero, [0.01, 0n, 0n], 1n),
      A("lazy.", "prestige (with more than 10 score) without clicking the increment button at all",
        function () { return g.run_clicks; }, function (c) { return c === 0; },
        zero, [0.001, -0.001, 0n], 0n),
    ];
  }

  // --- save ------------------------------------------------------------------

  // The original demo has no save file. The web version keeps progress in the browser in
  // its own format, which restores every value with its exact Python type.
  var NUMBER_FIELDS = ["score", "click_power", "score_per_second", "prestige_points", "lifetime_PP",
    "click_avm_boost", "sps_avm_boost", "general_avm_boost"];
  var COUNTER_FIELDS = ["click_upgrade_index", "sps_upgrade_index", "cheaper_upgrades_index",
    "time_elapsed", "total_clicks", "broke_counter", "upgrades_paid_for", "run_clicks"];
  var BIGINT_FIELDS = { prestige_points: true, lifetime_PP: true };

  DemoGame.prototype.toSaveText = function () {
    var self = this;
    var parts = ['"demo": true', '"won": ' + this.won];
    NUMBER_FIELDS.forEach(function (k) { parts.push('"' + k + '": ' + S.jsonNumber(self[k])); });
    COUNTER_FIELDS.forEach(function (k) { parts.push('"' + k + '": ' + String(self[k])); });
    var flags = function (list) {
      return "[" + list.map(function (a) { return a.unlocked ? "true" : "false"; }).join(", ") + "]";
    };
    parts.push('"achievements_unlocked": ' + flags(this.achievements));
    parts.push('"special_achievements_unlocked": ' + flags(this.special_achievements));
    return "{\n    " + parts.join(",\n    ") + "\n}";
  };

  DemoGame.fromSaveText = function (text, hooks) {
    var data = S.parseSave(text);
    if (!data || data.demo !== true) return null;
    var g = new DemoGame(hooks);
    try {
      g.won = S.truthy(data.won);
      NUMBER_FIELDS.forEach(function (k) {
        if (data[k] === undefined) return;
        var lit = typeof data[k] === "string" && data[k].charCodeAt(0) === 0 ? data[k].slice(1) : null;
        if (lit === null) throw new TypeError("not a number");
        if (BIGINT_FIELDS[k]) g[k] = S.castInt(data[k]);
        else g[k] = /^-?\d+$/.test(lit) ? BigInt(lit) : Number(lit);
      });
      COUNTER_FIELDS.forEach(function (k) {
        if (data[k] !== undefined) g[k] = Number(S.castInt(data[k]));
      });
      // Saves from before achievements existed have no lifetime_PP.
      if (data.lifetime_PP === undefined) g.lifetime_PP = g.prestige_points;
      S.restoreFlags(g.achievements, data.achievements_unlocked);
      S.restoreFlags(g.special_achievements, data.special_achievements_unlocked);
    } catch (err) {
      return null;
    }
    return g;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = DemoGame;
  else root.DemoGame = DemoGame;
})(typeof self !== "undefined" ? self : this);
