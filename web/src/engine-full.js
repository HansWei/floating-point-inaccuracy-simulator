/*
 * Floating Point Inaccuracy Simulator: game rules, ported line by line from
 * original/floating_point_inaccuracy_simulator.py.
 *
 * Variable names match the Python globals so the two can be compared directly
 * (tests/test_parity.py runs both and compares every variable after every action).
 * Python ints are BigInt and Python floats are numbers; see pyfloat.js.
 *
 * The engine has no UI. It reports pop-ups through hooks.message(kind, title, text)
 * ("info" = messagebox.showinfo, "error" = showerror) and delayed checks through
 * hooks.schedule(ms, fn) (screen.after).
 */
(function (root) {
  "use strict";

  var P = root.PyNum || (typeof require === "function" ? require("./pyfloat.js") : null);
  var S = root.PySave || (typeof require === "function" ? require("./savejson.js") : null);
  var jsonNumber = S.jsonNumber, parseSave = S.parseSave, get = S.get, castFloat = S.castFloat,
    castInt = S.castInt, truthy = S.truthy, restoreFlags = S.restoreFlags;
  var pyAdd = P.pyAdd, pySub = P.pySub, pyMul = P.pyMul, pyInt = P.pyInt, pyLog = P.pyLog,
    pyPow = P.pyPow, pyStr = P.pyStr, toFloat = P.toFloat;

  var MILESTONE_ORDER = [1, 2, 4, 8, 16, 32, 64]; // repeat but *100
  var WIN_SCORE = 10n ** 63n;
  var YEAR = 86400 * 365;

  function FullGame(hooks) {
    this.hooks = hooks || {};
    this.won = false;

    this.score = 0n;
    this.click_power = 0.005;
    this.score_per_second = 0n;

    this.click_upgrade_index = 1;
    this.sps_upgrade_index = 1;

    this.prestige_points = 0n;
    this.lifetime_PP = 0n;
    this.cheaper_upgrades_index = 0;
    this.sps_prestige_upgrade_index = 0;

    this.score_ms_index = 0;
    this.upgrade_ms_index = 0;
    this.prestige_ms_index = 0;

    this.time_elapsed = 0;
    this.total_clicks = 0;
    this.lifetime_prestiges = 0;
    this.broke_counter = 0;
    this.upgrades_paid_for = 0;
    this.run_clicks = 0;

    this.click_avm_boost = 0n;
    this.sps_avm_boost = 0n;
    this.general_avm_boost = 0n;

    this.achievements = makeAchievements(this);
    this.special_achievements = makeSpecialAchievements(this);
  }

  FullGame.kind = "full";
  FullGame.prototype.kind = "full";

  FullGame.prototype._message = function (kind, title, text) {
    if (this.hooks.message) this.hooks.message(kind, title, text);
  };

  FullGame.prototype._schedule = function (ms, fn) {
    if (this.hooks.schedule) this.hooks.schedule(ms, fn);
  };

  // --- values shown on screen ------------------------------------------------

  FullGame.prototype.progress = function () {
    if (!(this.score >= 1)) return 0n;
    var v = Number(pyInt(pyLog(this.score, 10) / 63 * 1000)) / 10;
    return 0 > v ? 0n : v;
  };

  FullGame.prototype.prestigeGain = function () {
    if (!(this.score >= 1)) return 0n;
    var v = pyInt(pyLog(this.score, 10));
    return 0n > v ? 0n : v;
  };

  FullGame.prototype.clickIncome = function () {
    return pyMul(pyMul(pyMul(pyMul(this.click_power, pyAdd(1n, this.click_avm_boost)),
      pyAdd(1n, this.general_avm_boost)), 1 + 0.01 * this.score_ms_index),
      1 + 0.01 * this.prestige_ms_index);
  };

  FullGame.prototype._ppBoost = function () {
    return 1 + 0.01 * this.sps_prestige_upgrade_index * toFloat(this.prestige_points);
  };

  FullGame.prototype.passiveIncome = function () {
    return pyMul(pyMul(pyMul(pyMul(pyMul(this.score_per_second, pyAdd(1n, this.sps_avm_boost)),
      pyAdd(1n, this.general_avm_boost)), this._ppBoost()),
      1 + 0.01 * this.upgrade_ms_index), 1 + 0.01 * this.prestige_ms_index);
  };

  FullGame.prototype.clickCost = function () {
    return pyInt(Math.pow(2, this.click_upgrade_index) * pyPow(0.9, this.cheaper_upgrades_index));
  };

  FullGame.prototype.spsCost = function () {
    return pyInt(pyPow(1.5, this.sps_upgrade_index) * pyPow(0.9, this.cheaper_upgrades_index));
  };

  // Text of every label, in the original wording.
  FullGame.prototype.view = function () {
    return {
      score: "score: " + pyStr(this.score),
      clickPower: "click power: " + pyStr(this.clickIncome()),
      scorePerSecond: "score per second: " + pyStr(this.passiveIncome()),
      goal: this.won ? "u already won" : "get 10^63 (one vigintillion) score to win",
      progress: this.won ? null : "progress: " + pyStr(this.progress()) + "%",
      clickCost: pyStr(this.clickCost()),
      spsCost: pyStr(this.spsCost()),
      canAffordClick: this.score >= this.clickCost(),
      canAffordSps: this.score >= this.spsCost(),
      prestige: "reset all other progress for " + pyStr(this.prestigeGain()) + " prestige points",
      prestigePoints: "prestige points: " + pyStr(this.prestige_points),
      canAffordPrestigeUpgrade: this.prestige_points >= 1n,
    };
  };

  // --- original functions ----------------------------------------------------

  FullGame.prototype.increment_func = function () {
    this.score = pyAdd(this.score, this.clickIncome());
    this.total_clicks += 1;
    this.run_clicks += 1;
    this.check_achievments();
  };

  FullGame.prototype.per_sec_update = function () {
    this.time_elapsed += 1;
    this.score = pyAdd(this.score, this.passiveIncome());
    this.check_milestones();
    this.check_achievments();
    if (!this.won) this.check_achievments(1);
    if (this.score >= WIN_SCORE && !this.won) {
      this.won = true;
      this._message("info", null, "wow u actually did it congrats on wasting years of your life on this");
    }
  };

  FullGame.prototype._broke = function () {
    var self = this;
    this.broke_counter += 1;
    this._schedule(35000, function () { self.check_achievments(2); });
  };

  FullGame.prototype.upgrade_click = function () {
    var cost = this.clickCost();
    if (this.score >= cost) {
      if (cost !== 0n) this.upgrades_paid_for += 1;
      this.click_power += 0.005;
      this.click_upgrade_index += 1;
      this.score = pySub(this.score, cost);
      return true;
    }
    this._broke();
    return false;
  };

  FullGame.prototype.upgrade_sps = function () {
    var cost = this.spsCost();
    if (this.score >= cost) {
      if (cost !== 0n) this.upgrades_paid_for += 1;
      this.score_per_second = pyAdd(this.score_per_second, 0.002);
      this.sps_upgrade_index += 1;
      this.score = pySub(this.score, cost);
      return true;
    }
    this._broke();
    return false;
  };

  FullGame.prototype.prestige = function () {
    this.check_achievments(0);
    if (this.score >= 10) {
      this.check_achievments(3);
      this.check_achievments(4);
    }
    var points = this.prestigeGain();

    this.score = 0n;
    this.click_power = 0.005;
    this.score_per_second = 0n;

    this.click_upgrade_index = 0;
    this.sps_upgrade_index = 0;

    this.prestige_points += points;
    this.lifetime_PP += points;
    this.lifetime_prestiges += 1;

    this.upgrades_paid_for = 0;
    this.run_clicks = 0;
  };

  FullGame.prototype.prestige_upgrades = function (upgrade) {
    if (this.prestige_points < 1n) {
      this._broke();
      this._message("info", null, "you do not have enough prestige points for that.");
      return false;
    }
    this.prestige_points -= 1n;
    if (upgrade === 0) { // make all upgrades 10% cheaper (multiplicative)
      this.cheaper_upgrades_index += 1;
    } else if (upgrade === 1) { // gain 25% of current score
      this.score = pyMul(this.score, 1.25 * (1 + 0.01 * this.prestige_ms_index));
      this.check_milestones();
    } else if (upgrade === 2) { // instant 10 minutes of passive income
      this.score = pyAdd(this.score,
        pyMul(pyMul(pyMul(pyMul(pyMul(pyMul(this.score_per_second, pyAdd(1n, this.sps_avm_boost)),
          pyAdd(1n, this.general_avm_boost)), 600n), this._ppBoost()),
          1 + 0.01 * this.score_ms_index), 1 + 0.01 * this.prestige_ms_index));
    } else if (upgrade === 3) { // +1% sps per remaining prestige point, per level
      this.sps_prestige_upgrade_index += 1;
    }
    return true;
  };

  // Recursion and the positions read before it are kept exactly as in the original.
  FullGame.prototype.check_milestones = function () {
    var scorePos = this.score_ms_index % 7;
    var upgradePos = this.upgrade_ms_index % 7;
    var prestigePos = this.prestige_ms_index % 7;

    var scoreCycle = BigInt(Math.floor(this.score_ms_index / 7));
    var upgradeCycle = BigInt(Math.floor(this.upgrade_ms_index / 7));
    var prestigeCycle = BigInt(Math.floor(this.prestige_ms_index / 7));

    if (this.score >= BigInt(MILESTONE_ORDER[scorePos]) * 100n ** scoreCycle) {
      this._message("info", null, "you have achieved score milestone #" + (this.score_ms_index + 1) +
        ". click income increased by 1%.");
      this.score_ms_index += 1;
      this.check_milestones();
    }
    if (this.click_upgrade_index + this.sps_upgrade_index - 2 >=
        BigInt(MILESTONE_ORDER[upgradePos]) * 100n ** upgradeCycle) {
      this._message("info", null, "you have achieved upgrade milestone #" + (this.upgrade_ms_index + 1) +
        ". sps income increased by 1%.");
      this.upgrade_ms_index += 1;
      this.check_milestones();
    }
    if (this.lifetime_PP >= BigInt(MILESTONE_ORDER[prestigePos]) * 100n ** prestigeCycle) {
      this._message("info", null, "you have achieved prestige milestone #" + (this.prestige_ms_index + 1) +
        ". all income increased by 1%.");
      this.prestige_ms_index += 1;
      this.check_milestones();
    }
  };

  FullGame.prototype._unlock = function (a) {
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

  FullGame.prototype.check_achievments = function (index) {
    for (var i = 0; i < this.achievements.length; i++) {
      var a = this.achievements[i];
      if (a.quota(a.value()) && !a.unlocked) this._unlock(a);
    }
    if (index !== undefined && index !== null && !this.special_achievements[index].unlocked) {
      var s = this.special_achievements[index];
      if (s.quota(s.value()) && !s.unlocked) this._unlock(s);
    }
  };

  // --- buttons, as wired in the original --------------------------------------

  FullGame.BUTTONS = ["click", "buy_click", "buy_sps", "prestige",
    "pu_cheaper", "pu_multiply", "pu_timeskip", "pu_sps"];

  FullGame.prototype.press = function (button) {
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
      case "pu_multiply": return this.prestige_upgrades(1);
      case "pu_timeskip": return this.prestige_upgrades(2);
      case "pu_sps": return this.prestige_upgrades(3);
      default: throw new Error("unknown button " + button);
    }
  };

  // The original runs load_game() and then per_sec_update() once at startup.
  FullGame.prototype.start = function () { this.per_sec_update(); };
  FullGame.prototype.tick = function () { this.per_sec_update(); };

  // --- save files (same JSON as the original's save.json) ---------------------

  var FLOAT_FIELDS = ["score", "click_power", "score_per_second",
    "click_avm_boost", "sps_avm_boost", "general_avm_boost"];
  var INT_FIELDS = ["click_upgrade_index", "sps_upgrade_index", "cheaper_upgrades_index",
    "sps_prestige_upgrade_index", "score_ms_index", "upgrade_ms_index", "prestige_ms_index",
    "time_elapsed", "total_clicks", "lifetime_prestiges"];
  // Not in the original save; restoring them stops a reload from granting "free sample".
  var EXTRA_INT_FIELDS = ["broke_counter", "upgrades_paid_for", "run_clicks"];

  FullGame.prototype.toSaveText = function () {
    var self = this;
    var lines = [];
    function add(key, raw) { lines.push("    " + JSON.stringify(key) + ": " + raw); }
    function list(values) {
      return "[\n" + values.map(function (v) { return "        " + (v ? "true" : "false"); })
        .join(",\n") + "\n    ]";
    }
    add("won", this.won ? "true" : "false");
    add("score", jsonNumber(this.score));
    add("click_power", jsonNumber(this.click_power));
    add("score_per_second", jsonNumber(this.score_per_second));
    add("click_upgrade_index", String(this.click_upgrade_index));
    add("sps_upgrade_index", String(this.sps_upgrade_index));
    add("prestige_points", this.prestige_points.toString());
    add("lifetime_PP", this.lifetime_PP.toString());
    ["cheaper_upgrades_index", "sps_prestige_upgrade_index", "score_ms_index", "upgrade_ms_index",
      "prestige_ms_index", "time_elapsed", "total_clicks", "lifetime_prestiges"].forEach(function (k) {
      add(k, String(self[k]));
    });
    ["click_avm_boost", "sps_avm_boost", "general_avm_boost"].forEach(function (k) {
      add(k, jsonNumber(self[k]));
    });
    add("achievements_unlocked", list(this.achievements.map(function (a) { return a.unlocked; })));
    add("special_achievements_unlocked",
      list(this.special_achievements.map(function (a) { return a.unlocked; })));
    EXTRA_INT_FIELDS.forEach(function (k) { add(k, String(self[k])); });
    return "{\n" + lines.join(",\n") + "\n}";
  };

  // Mirrors load_game(): every field is cast the same way. Returns null if the text is
  // not a usable save (the original then starts a new game).
  FullGame.fromSaveText = function (text, hooks) {
    var data = parseSave(text);
    if (!data) return null;
    var g = new FullGame(hooks);
    try {
      g.won = truthy(get(data, "won", false));
      g.score = castFloat(get(data, "score", 0n));
      g.click_power = castFloat(get(data, "click_power", 0.005));
      g.score_per_second = castFloat(get(data, "score_per_second", 0n));
      g.prestige_points = castInt(get(data, "prestige_points", 0n));
      g.lifetime_PP = castInt(get(data, "lifetime_PP", g.prestige_points));
      INT_FIELDS.forEach(function (k) {
        var d = k === "click_upgrade_index" || k === "sps_upgrade_index" ? 1n : 0n;
        g[k] = Number(castInt(get(data, k, d)));
      });
      FLOAT_FIELDS.slice(3).forEach(function (k) { g[k] = castFloat(get(data, k, 0n)); });
      EXTRA_INT_FIELDS.forEach(function (k) {
        if (Object.prototype.hasOwnProperty.call(data, k)) g[k] = Number(castInt(data[k]));
      });
      restoreFlags(g.achievements, data.achievements_unlocked);
      restoreFlags(g.special_achievements, data.special_achievements_unlocked);
    } catch (err) {
      return null;
    }
    return g;
  };

  // --- achievements (same table, order and wording as the original) -----------

  function A(title, description, value, quota, reward, boosts, pp) {
    return { title: title, description: description, value: value, quota: quota,
      reward: reward, boosts: boosts, pp: pp, unlocked: false };
  }

  var ALL_100 = "100 percenting floating point inaccuracy simulator any % speedrun";

  function makeAchievements(g) {
    var zero = function () { return 0n; };
    var list = [
      A("the name of the game", "find out that computers aren't good at floating-point arithmetic",
        function () { return g.score; }, function (s) { return s >= 0.030000000000000002; },
        function () { return 0.00000000000000001; }, [0n, 0n, 0n], 0n),
      A("alert the staff", "somehow get negative score???",
        function () { return g.score; }, function (s) { return s < 0; },
        function () { return 100n; }, [0n, 0n, 0n], 5n),
      A("go touch grass", "play for 24 hours",
        function () { return g.time_elapsed; }, function (t) { return t >= 86400; },
        zero, [0n, 0n, 0.05], 1n),
      A("making progress", "10% of the way there",
        function () { return g.progress(); }, function (p) { return p >= 10; },
        zero, [0n, 0.05, 0.05], 5n),
      A("carpal tunnel syndrome", "click 100000 times",
        function () { return g.total_clicks; }, function (c) { return c >= 100000; },
        function (s) { return pyMul(s, 0.1); }, [0n, 0.01, 0n], 0n),
      A("hoarder", "have at least 100 prestige points at a time",
        function () { return g.prestige_points; }, function (pp) { return pp >= 100n; },
        zero, [0.01, 0n, 0n], 0n),
      A("beginning of the end", "click for the first time. you will do this many, many more times.",
        function () { return g.total_clicks; }, function (c) { return c >= 1; },
        zero, [0n, 0n, 0n], 0n),
      A("time wasters: wasters of time", "get to 1000 score without prestiging",
        function () { return g.score; }, function (s) { return s >= 1000 && g.lifetime_PP === 0n; },
        function () { return -1n; }, [0n, 0n, 0n], 0n),
      A("lol", "you have officially been permanently locked out of an achievement. we wont tell you what.",
        function () { return g.lifetime_PP; }, function (pp) { return pp >= 1n; },
        zero, [0n, 0n, -0.001], 0n),
      A("i got you a gift!", "a small gift, just for you =)",
        function () { return g.time_elapsed; }, function (t) { return t >= 4924; },
        zero, [0n, 0n, 0.01], 1n),
      A("stop.", "playing this game is dangerous, you can still leave.",
        function () { return g.time_elapsed; }, function (t) { return t >= 3600; },
        zero, [0n, 0n, 0n], 0n),
      A("it's too late...",
        "you've been at this for a year now. you can'nt stop anymore, so might as well help you out.",
        function () { return g.time_elapsed; }, function (t) { return t >= YEAR; },
        zero, [0n, 0.05, 0.05], 10n),
      A("retirement fees", "A DECADE??",
        function () { return g.time_elapsed; }, function (t) { return t >= YEAR * 10; },
        function (s) { return s; }, [0n, 0.05, 0.05], 100n),
      A("autoclicker", "click 1 million times",
        function () { return g.total_clicks; }, function (c) { return c >= 1000000; },
        zero, [0.01, 0n, 0.005], 0n),
      A("cheater!", "hey. i know youre using an autoclicker. stop it.",
        function () { return g.total_clicks / Math.max(g.time_elapsed, 1); },
        function (cps) { return cps > 20; },
        function (s) { return pyMul(-0.2, s); }, [-0.1, 0.01, 0n], 0n),
      A("bankruptcy", "click 100 upgrades without being able to afford them",
        function () { return g.broke_counter; }, function (c) { return c >= 100; },
        zero, [0n, 0n, 0n], 0n),
      A("need a loan?", "click 1000 upgrades without being able to afford them",
        function () { return g.broke_counter; }, function (c) { return c >= 1000; },
        function (s) { return pyMul(0.1, s); }, [-0.01, 0n, 0n], 0n),
      A(ALL_100, "get every achievement (besides this one)",
        function () { return g.achievements; },
        function (list) {
          return list.every(function (x) { return x.title === ALL_100 || x.unlocked; });
        },
        zero, [0n, 0n, 0.05], 50n),
      A("milestone milestone 1", "get 10 milestones",
        function () { return g.score_ms_index + g.upgrade_ms_index + g.prestige_ms_index; },
        function (m) { return m >= 10; }, zero, [0n, 0n, 0.01], 1n),
      A("milestone milestone 2", "get 100 milestones",
        function () { return g.score_ms_index + g.upgrade_ms_index + g.prestige_ms_index; },
        function (m) { return m >= 100; }, zero, [0n, 0n, 0.01], 2n),
      A("milestone milestone 3", "get 1000 milestones\ni dont think this is possible.",
        function () { return g.score_ms_index + g.upgrade_ms_index + g.prestige_ms_index; },
        function (m) { return m >= 1000; }, zero, [0n, 0n, 0.01], 5n),
      A("halfway there!", "get 50% progress",
        function () { return g.progress(); }, function (p) { return p >= 50; },
        zero, [0n, 0n, 0.02], 3n),
      A("free sample", "buy an upgrade for free",
        function () { return g.upgrades_paid_for; },
        function (u) { return u < g.click_upgrade_index + g.sps_upgrade_index - 2; },
        function () { return 2.5; }, [0n, 0n, 0n], 1n),
      A("filler text", "im bored so heres a gift",
        function () { return g.total_clicks; }, function (c) { return c >= 194745; },
        function (s) { return pyMul(s, 0.01); }, [0.01, 0n, 0n], 3n),
    ];
    return list;
  }

  function makeSpecialAchievements(g) {
    var zero = function () { return 0n; };
    return [
      A("why?", "prestige with less than 10 score and reset all your progress for nothing",
        function () { return g.score; }, function (s) { return s < 10; },
        zero, [0n, 0n, -0.01], 0n),
      A("alright, i give up, you win",
        "this achievement shouldn't be possible to get. if you did, you have exceeded my estimated play time tenfold.\n" +
        "        i am so sorry for ruining your life.",
        function () { return g.time_elapsed; }, function (t) { return t >= YEAR * 50; },
        function () { return 10n ** 63n; }, [1n, 1n, 1n], 10n ** 20n),
      A("take a break.", "go outside. drink some water. touch grass. whatever. just take a break.",
        function () { return g.broke_counter; }, function (b) { return b >= 42; },
        zero, [0n, 0n, 0n], 0n),
      A("the average costco:", "prestige with at least 10 score without paying for a single upgrade",
        function () { return g.upgrades_paid_for; }, function (u) { return u === 0; },
        zero, [0.01, 0n, 0n], 3n),
      A("lazy.", "prestige (with more than 10 score) without clicking the increment button at all",
        function () { return g.run_clicks; }, function (c) { return c === 0; },
        zero, [0.001, -0.001, 0n], 0n),
    ];
  }

  if (typeof module !== "undefined" && module.exports) module.exports = FullGame;
  else root.FullGame = FullGame;
})(typeof self !== "undefined" ? self : this);
