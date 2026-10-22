/*
 * Browser front end shared by both editions. The game rules live in engine-full.js and
 * engine-demo.js; this file only draws labels, queues pop-ups, runs the 1 s income tick
 * and keeps the save in localStorage.
 */
(function () {
  "use strict";

  var EDITIONS = {
    full: {
      Game: window.FullGame,
      storageKey: "floating-point-inaccuracy-simulator/full/save.json",
      upgrades: [
        ["pu_cheaper", "all upgrades 10% cheaper"],
        ["pu_multiply", "gain 25% of current score"],
        ["pu_timeskip", "gain 10 minutes of\npassive income instantly"],
        ["pu_sps", "+1% passive income\nper prestige point\nper level"],
      ],
      importHint: "Paste a save exported from this page, or the save.json written by the desktop (Python) version.",
    },
    demo: {
      Game: window.DemoGame,
      storageKey: "floating-point-inaccuracy-simulator/demo/save.json",
      upgrades: [
        ["pu_cheaper", "all upgrades 5% cheaper"],
        ["pu_timeskip", "gain 3 minutes of\npassive income instantly"],
      ],
      importHint: "Paste a save exported from this page.",
    },
  };

  var TICK_MS = 1000;
  // Missed seconds are caught up (background tabs run timers late), but one gap counts
  // for at most an hour, so waking a computer from sleep does not grant a windfall.
  var MAX_CATCH_UP_MS = 60 * 60 * 1000;
  var APP_TITLE = document.title;

  var edition = EDITIONS[document.body.getAttribute("data-edition")] || EDITIONS.full;
  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  // --- pop-ups -------------------------------------------------------------------

  var dialogs = [];
  var modal = $("[data-modal]");
  var dialogBox = modal.querySelector(".dialog");
  var app = $(".app");
  var lastFocus = null;

  function showDialog(spec) {
    dialogs.push(spec);
    if (dialogs.length === 1) openDialog();
  }

  function openDialog() {
    var spec = dialogs[0];
    if (!spec) {
      modal.hidden = true;
      app.inert = false;
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
      lastFocus = null;
      return;
    }
    if (modal.hidden) lastFocus = document.activeElement;
    dialogBox.classList.toggle("error", spec.kind === "error");
    $("[data-dialog-title]").textContent = spec.title || "";
    $("[data-dialog-text]").textContent = spec.text || "";
    var input = $("[data-dialog-input]");
    input.hidden = spec.input === undefined;
    input.value = spec.input || "";
    input.readOnly = !!spec.readOnly;
    var row = $("[data-dialog-buttons]");
    row.textContent = "";
    var buttons = spec.buttons || [["OK", null]];
    buttons.forEach(function (b, i) {
      var el = document.createElement("button");
      el.type = "button";
      el.textContent = b[0];
      if (b[2]) el.className = b[2];
      el.addEventListener("click", function () {
        var keepOpen = b[1] ? b[1](input.value, el) === false : false;
        if (!keepOpen) closeDialog();
      });
      row.appendChild(el);
      if (i === 0) el.setAttribute("data-default", "");
    });
    modal.hidden = false;
    // Keyboard focus must not reach the game behind a pop-up (pop-ups pause the game).
    app.inert = true;
    (spec.input !== undefined && !spec.readOnly ? input : row.querySelector("[data-default]")).focus();
  }

  function closeDialog() {
    dialogs.shift();
    openDialog();
    render();
  }

  function dialogOpen() { return dialogs.length > 0; }

  // --- game ------------------------------------------------------------------------

  var timers = [];
  var hooks = {
    message: function (kind, title, text) {
      showDialog({ kind: kind, title: title || (kind === "error" ? "Error" : APP_TITLE), text: text });
    },
    schedule: function (ms, fn) {
      var id = setTimeout(function () {
        timers.splice(timers.indexOf(id), 1);
        fn();
        afterChange();
      }, ms);
      timers.push(id);
    },
  };

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  // --- storage ---------------------------------------------------------------------

  var storage = null;
  try {
    storage = window.localStorage;
    var probe = edition.storageKey + "/probe";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
  } catch (err) {
    storage = null;
  }

  function setStatus(text, warn) {
    var el = $("[data-status]");
    el.textContent = text;
    el.classList.toggle("warn", !!warn);
  }

  var statusTimer = 0;
  function flashStatus(text) {
    setStatus(text);
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { if (storage) setStatus(""); }, 1500);
  }

  function save() {
    if (!storage) return false;
    try {
      storage.setItem(edition.storageKey, game.toSaveText());
      return true;
    } catch (err) {
      setStatus("Saving failed (" + err.name + "). Use \"export save\" to keep your progress.", true);
      return false;
    }
  }

  // A save is accepted only if a throwaway copy can start and be drawn; otherwise a save
  // with, say, a huge upgrade index would be stored and then fail on every reload.
  function readSave(text) {
    var next = edition.Game.fromSaveText(text, hooks);
    if (!next) return null;
    try {
      var probe = edition.Game.fromSaveText(text, {});
      probe.view();
      probe.start();
      probe.view();
      next.view();
    } catch (err) {
      return null;
    }
    return next;
  }

  function loadStored() {
    if (!storage) return null;
    var text = storage.getItem(edition.storageKey);
    if (text === null) return null;
    var loaded = readSave(text);
    if (!loaded) {
      // Keep the unreadable save instead of overwriting it on the next autosave.
      storage.setItem(edition.storageKey + ".unreadable-" + Date.now(), text);
      setStatus("Your saved game could not be read, so a new game was started.", true);
    }
    return loaded;
  }

  var game = loadStored() || new edition.Game(hooks);
  game.start();
  if (!storage) {
    setStatus("This browser blocks storage for this page, so progress is lost on reload. Use \"export save\" to keep it.", true);
  }

  function replaceGame(next) {
    clearTimers();
    game = next;
    game.start();
    save();
    accumulated = 0;
    render();
  }

  // --- drawing ---------------------------------------------------------------------

  var upgradeBox = $("[data-prestige-upgrades]");
  edition.upgrades.forEach(function (u) {
    var b = document.createElement("button");
    b.type = "button";
    b.setAttribute("data-action", u[0]);
    b.textContent = u[1];
    upgradeBox.appendChild(b);
  });

  var current = 0;
  function goto(index) {
    current = index;
    $$("[data-panel]").forEach(function (p) { p.hidden = Number(p.getAttribute("data-panel")) !== index; });
    $$(".tabs [data-goto]").forEach(function (t) {
      t.setAttribute("aria-selected", String(Number(t.getAttribute("data-goto")) === index));
    });
  }

  var viewEls = $$("[data-view]");
  function setText(el, text) {
    if (el.textContent !== text) el.textContent = text;
  }

  function render() {
    var v = game.view();
    viewEls.forEach(function (el) {
      var key = el.getAttribute("data-view");
      var text = v[key];
      el.hidden = text === null;
      if (text !== null) setText(el, text);
    });
    $('[data-action="buy_click"]').classList.toggle("affordable", v.canAffordClick);
    $('[data-action="buy_sps"]').classList.toggle("affordable", v.canAffordSps);
    $$("[data-prestige-upgrades] button").forEach(function (b) {
      b.classList.toggle("affordable", v.canAffordPrestigeUpgrade);
    });
  }

  function afterChange() {
    save();
    render();
  }

  // --- input -------------------------------------------------------------------------

  document.addEventListener("click", function (e) {
    var el = e.target.closest ? e.target.closest("button") : null;
    if (!el || modal.contains(el) || dialogOpen()) return;
    if (el.hasAttribute("data-action")) {
      game.press(el.getAttribute("data-action"));
      afterChange();
    } else if (el.hasAttribute("data-goto")) {
      goto(Number(el.getAttribute("data-goto")));
    } else if (el.hasAttribute("data-cmd")) {
      commands[el.getAttribute("data-cmd")]();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (dialogOpen()) {
      if (e.key === "Escape" && !dialogs[0].buttons) closeDialog();
      if (e.repeat && e.target.tagName === "BUTTON") e.preventDefault();
      return;
    }
    // Holding a key down must not auto-click: the "cheater!" achievement watches the click rate.
    if (e.repeat) {
      if (e.key === " " || e.key === "Enter") e.preventDefault();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var onControl = /^(BUTTON|TEXTAREA|INPUT|A)$/.test(e.target.tagName);
    if (e.key === " " && !onControl) {
      e.preventDefault();
      game.press("click");
      afterChange();
    } else if (e.key === "1" || e.key === "2" || e.key === "3") {
      goto(Number(e.key) - 1);
    }
  }, true);

  // --- save commands -------------------------------------------------------------------

  function download(name, text) {
    try {
      var url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      var a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    } catch (err) {
      flashStatus("Download is blocked here; copy the text instead.");
    }
  }

  var commands = {
    save: function () {
      if (save()) flashStatus("saved");
    },
    export: function () {
      var text = game.toSaveText();
      showDialog({
        title: "export save",
        text: "This is your whole save. Copy it somewhere safe, or download it as a file.",
        input: text,
        readOnly: true,
        buttons: [
          ["copy", function (_v, el) {
            var done = function () { el.textContent = "copied"; };
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(text).then(done, function () {
                $("[data-dialog-input]").select();
              });
            } else {
              $("[data-dialog-input]").select();
            }
            return false;
          }],
          ["download", function () { download("save.json", text); return false; }],
          ["close", null],
        ],
      });
    },
    import: function () {
      showDialog({
        title: "import save",
        text: edition.importHint + " This replaces your current game.",
        input: "",
        buttons: [
          ["load", function (value) {
            var next = readSave(value.trim());
            if (!next) {
              $("[data-dialog-text]").textContent = "That text is not a save for this game. Nothing was changed.";
              return false;
            }
            replaceGame(next);
            flashStatus("save imported");
          }],
          ["choose file", function () {
            var picker = document.createElement("input");
            picker.type = "file";
            picker.accept = ".json,application/json,text/plain";
            picker.addEventListener("change", function () {
              var file = picker.files && picker.files[0];
              if (!file) return;
              file.text().then(function (t) { $("[data-dialog-input]").value = t; });
            });
            picker.click();
            return false;
          }],
          ["cancel", null],
        ],
      });
    },
    reset: function () {
      showDialog({
        kind: "error",
        title: "reset everything?",
        text: "This deletes your score, upgrades, prestige points and achievements. Export your save first if you might want it back.",
        buttons: [
          ["cancel", null],
          ["delete my progress", function () {
            replaceGame(new edition.Game(hooks));
            flashStatus("new game started");
          }, "danger"],
        ],
      });
    },
  };

  // --- the 1 s income tick ---------------------------------------------------------------

  var accumulated = 0;
  var lastTime = performance.now();

  function loop() {
    var now = performance.now();
    var elapsed = Math.min(now - lastTime, MAX_CATCH_UP_MS);
    lastTime = now;
    // Pop-ups pause the game, like the original's modal message boxes.
    if (dialogOpen()) return;
    accumulated += elapsed;
    var ticks = 0;
    while (accumulated >= TICK_MS && !dialogOpen()) {
      accumulated -= TICK_MS;
      game.tick();
      ticks++;
    }
    if (ticks) afterChange();
  }

  setInterval(loop, 100);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") save();
    else loop();
  });
  window.addEventListener("pagehide", save);

  goto(0);
  afterChange();
  // For tests and the browser console.
  window.fpis = { get game() { return game; }, save: save, render: render, loop: loop };
})();
