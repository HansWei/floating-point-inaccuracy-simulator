"""Run the untouched original Tkinter games headlessly and record what they do.

A fake ``tkinter`` module is installed before the original file is executed, so the
real game code runs as written: buttons keep their ``command`` callbacks, labels
keep their text, ``messagebox`` calls are recorded, and ``screen.after`` timers are
queued instead of firing. Tests then press the same buttons in the original game
and in the JavaScript port and compare every variable and every pop-up message.
"""

from __future__ import annotations

import os
import pathlib
import random
import sys
import tempfile
import types

HERE = pathlib.Path(__file__).resolve().parent
ORIGINALS = HERE.parent / "original"
FULL = ORIGINALS / "floating_point_inaccuracy_simulator.py"
# The web demo follows the desktop demo with achievements, which is the original demo
# plus the full game's achievement system with goals scaled to the demo.
DEMO = HERE.parent / "desktop" / "floating_point_inaccuracy_simulator_demo.py"
ORIGINAL_DEMO = ORIGINALS / "floating_point_inaccuracy_simulator_demo.py"

FULL_VARS = [
    "won", "score", "click_power", "score_per_second", "click_upgrade_index",
    "sps_upgrade_index", "prestige_points", "lifetime_PP", "cheaper_upgrades_index",
    "sps_prestige_upgrade_index", "score_ms_index", "upgrade_ms_index",
    "prestige_ms_index", "time_elapsed", "total_clicks", "lifetime_prestiges",
    "broke_counter", "upgrades_paid_for", "run_clicks", "click_avm_boost",
    "sps_avm_boost", "general_avm_boost",
]
DEMO_VARS = [
    "won", "score", "click_power", "score_per_second", "click_upgrade_index",
    "sps_upgrade_index", "prestige_points", "lifetime_PP", "cheaper_upgrades_index",
    "time_elapsed", "total_clicks", "broke_counter", "upgrades_paid_for", "run_clicks",
    "click_avm_boost", "sps_avm_boost", "general_avm_boost",
]

DEMO_VARS_ORIGINAL = DEMO_VARS[:7] + ["cheaper_upgrades_index"]

FULL_BUTTONS = {
    "click": "increment_button",
    "buy_click": "upgrade_click_button",
    "buy_sps": "upgrade_sps_button",
    "prestige": "prestige_button",
    "pu_cheaper": "cheaper_upgrades_button",
    "pu_multiply": "score_multiplier_button",
    "pu_timeskip": "time_skip_button",
    "pu_sps": "sps_prestige_upgrade_button",
}
DEMO_BUTTONS = {
    "click": "increment_button",
    "buy_click": "upgrade_click_button",
    "buy_sps": "upgrade_sps_button",
    "prestige": "prestige_button",
    "pu_cheaper": "cheaper_upgrades_button",
    "pu_timeskip": "time_skip_button",
}


class _Widget:
    def __init__(self, master=None, text="", command=None, **_kw):
        self.text = text
        self.command = command
        self.destroyed = False

    def config(self, **kw):
        if "text" in kw:
            self.text = kw["text"]

    configure = config

    def grid(self, **_kw):
        pass

    def tkraise(self):
        pass

    def destroy(self):
        self.destroyed = True


class _Screen(_Widget):
    def __init__(self):
        super().__init__()
        self.timers: list = []  # delayed callbacks other than the 1 s income loop

    def title(self, *_a):
        pass

    def after(self, ms, fn=None):
        if fn is None or getattr(fn, "__name__", "") == "per_sec_update":
            return
        if ms == 35000:  # "take a break" achievement check after a failed purchase
            self.timers.append(fn)
        # Other timers only move the window (mac refresh) or hide a label; ignore.

    def winfo_x(self):
        return 0

    def winfo_y(self):
        return 0

    def geometry(self, *_a):
        pass

    def mainloop(self):
        pass


def _fake_tkinter(messages: list):
    tk = types.ModuleType("tkinter")
    mb = types.ModuleType("tkinter.messagebox")

    def showinfo(title=None, message=None, **_kw):
        messages.append(["info", title, message])

    def showerror(title=None, message=None, **_kw):
        messages.append(["error", title, message])

    mb.showinfo = showinfo
    mb.showerror = showerror
    tk.Tk = _Screen
    tk.Frame = _Widget
    tk.Label = _Widget
    tk.Button = _Widget
    tk.messagebox = mb
    tk.__all__ = ["Tk", "Frame", "Label", "Button"]
    return tk, mb


class OriginalGame:
    """One running copy of an original game file."""

    def __init__(self, kind: str, save_dir: str | None = None, keep_saving: bool = False,
                 path: pathlib.Path | None = None, variables: list | None = None):
        self.kind = kind
        self.path = path or (FULL if kind == "full" else DEMO)
        self.vars = variables or (FULL_VARS if kind == "full" else DEMO_VARS)
        self.buttons = FULL_BUTTONS if kind == "full" else DEMO_BUTTONS
        self.messages: list = []
        self._tmp = None
        if save_dir is None:
            self._tmp = tempfile.TemporaryDirectory()
            save_dir = self._tmp.name
        tk, mb = _fake_tkinter(self.messages)
        saved = {k: sys.modules.get(k) for k in ("tkinter", "tkinter.messagebox")}
        sys.modules["tkinter"] = tk
        sys.modules["tkinter.messagebox"] = mb
        try:
            self.ns = {"__name__": "__main__", "__file__": os.path.join(save_dir, "game.py")}
            code = compile(self.path.read_text(encoding="utf-8"), str(self.path), "exec")
            exec(code, self.ns)
        finally:
            for k, v in saved.items():
                if v is None:
                    sys.modules.pop(k, None)
                else:
                    sys.modules[k] = v
        if kind == "full" and not keep_saving:
            self.ns["save_game"] = lambda: None  # the original writes save.json every second

    @property
    def save_path(self) -> str:
        return self.ns["SAVE_FILE"]

    def press(self, action: str):
        self.ns[self.buttons[action]].command()

    def tick(self):
        self.ns["per_sec_update"]()

    def fire_timer(self) -> bool:
        timers = self.ns["screen"].timers
        if not timers:
            return False
        timers.pop(0)()
        return True

    def snapshot(self) -> dict:
        out = {}
        for name in self.vars:
            out[name] = py_str(self.ns[name])
        if "achievements" in self.ns:
            out["achievements"] = "".join("1" if a[7] else "0" for a in self.ns["achievements"])
            out["special"] = "".join("1" if a[7] else "0" for a in self.ns["special_achievements"])
        return out

    def take_messages(self) -> list:
        out = list(self.messages)
        self.messages.clear()
        return out


def py_str(value) -> str:
    return repr(value) if isinstance(value, float) else str(value)


def typed(value) -> dict:
    if isinstance(value, bool):
        raise TypeError("bool is not a number")
    if isinstance(value, int):
        return {"int": str(value)}
    return {"float": value.hex()}


# --- traces -------------------------------------------------------------------

def _cost_hint(game: OriginalGame) -> float:
    ns = game.ns
    if game.kind == "full":
        c = int(2 ** ns["click_upgrade_index"] * 0.9 ** ns["cheaper_upgrades_index"])
        s = int(1.5 ** ns["sps_upgrade_index"] * 0.9 ** ns["cheaper_upgrades_index"])
    else:
        c = int(1.6 ** ns["click_upgrade_index"] * 0.95 ** ns["cheaper_upgrades_index"])
        s = int(1.4 ** ns["sps_upgrade_index"] * 0.95 ** ns["cheaper_upgrades_index"])
    return float(max(c, s, 1))


def apply(game: OriginalGame, step: dict):
    """Apply one trace step to the original game."""
    op = step["op"]
    if op == "tick":
        for _ in range(step.get("n", 1)):
            game.tick()
    elif op == "timer":
        game.fire_timer()
    elif op == "add":
        value = step["value"]
        v = int(value["int"]) if "int" in value else float.fromhex(value["float"])
        game.ns[step["var"]] += v
    else:
        game.press(op)


def random_trace(kind: str, seed: int, steps: int) -> dict:
    rng = random.Random(seed)
    game = OriginalGame(kind)
    start = {"snapshot": game.snapshot(), "messages": game.take_messages()}
    ops = list(game.buttons)
    weights = {
        "click": 40, "buy_click": 9, "buy_sps": 9, "prestige": 1.2,
        "pu_cheaper": 2, "pu_multiply": 1.5, "pu_timeskip": 1.5, "pu_sps": 1.5,
    }
    records = []
    for _ in range(steps):
        choice = rng.choices(
            ops + ["tick", "timer", "grant", "jump"],
            weights=[weights[o] for o in ops] + [25, 1, 2.5, 0.6],
        )[0]
        if choice == "grant":
            step = {"op": "add", "var": "score",
                    "value": typed(_cost_hint(game) * rng.uniform(0.5, 30))}
        elif choice == "jump":
            var, amount = rng.choice([
                ("time_elapsed", rng.choice([600, 3600, 4924, 86400, 86400 * 365, 86400 * 3650,
                                             86400 * 365 * 50])),
                ("total_clicks", rng.choice([1000, 100000, 194745, 1000000])),
                ("broke_counter", rng.choice([10, 42, 100, 1000])),
            ])
            step = {"op": "add", "var": var, "value": typed(amount)}
        elif choice == "tick":
            step = {"op": "tick", "n": rng.choice([1, 1, 1, 5, 60])}
        elif choice == "timer":
            step = {"op": "timer"}
        else:
            step = {"op": choice}
        apply(game, step)
        records.append({"step": step, "snapshot": game.snapshot(), "messages": game.take_messages()})
    return {"kind": kind, "name": f"random-{kind}-{seed}", "start": start, "steps": records}


def scripted_trace(kind: str, name: str, steps: list) -> dict:
    game = OriginalGame(kind)
    start = {"snapshot": game.snapshot(), "messages": game.take_messages()}
    records = []
    for step in steps:
        apply(game, step)
        records.append({"step": step, "snapshot": game.snapshot(), "messages": game.take_messages()})
    return {"kind": kind, "name": name, "start": start, "steps": records}


def scripted_traces() -> list:
    clicks = [{"op": "click"}] * 12
    full_story = (
        [{"op": "click"}] * 7 + [{"op": "tick"}]
        + [{"op": "buy_click"}, {"op": "pu_cheaper"}, {"op": "timer"}]
        + [{"op": "add", "var": "score", "value": typed(1e3)}, {"op": "tick"}]
        + [{"op": "buy_click"}] * 6 + [{"op": "buy_sps"}] * 8 + [{"op": "tick", "n": 30}]
        + [{"op": "prestige"}, {"op": "tick"}]
        + [{"op": "pu_cheaper"}, {"op": "pu_sps"}, {"op": "buy_click"}, {"op": "buy_sps"}]
        + [{"op": "add", "var": "score", "value": typed(1e63)}, {"op": "tick"}, {"op": "tick"}]
        + [{"op": "pu_multiply"}, {"op": "pu_timeskip"}, {"op": "prestige"}, {"op": "prestige"}]
    )
    demo_story = (
        clicks + [{"op": "buy_click"}, {"op": "buy_sps"}, {"op": "tick", "n": 20}]
        + [{"op": "pu_cheaper"}, {"op": "add", "var": "score", "value": typed(200.0)}]
        + [{"op": "prestige"}, {"op": "pu_cheaper"}, {"op": "pu_timeskip"}, {"op": "buy_sps"}]
        + [{"op": "add", "var": "score", "value": typed(6000.0)}, {"op": "tick"}, {"op": "tick"}]
    )
    def add(var, value):
        return {"op": "add", "var": var, "value": typed(value)}

    # Unlocks every demo achievement, in an order where none blocks another.
    demo_complete = (
        [{"op": "buy_click"}]  # fails: counts as "broke" and schedules the "take a break." check
        + [{"op": "click"}] * 3  # 0.1 + 0.1 + 0.1 = 0.30000000000000004
        + [add("score", 200.0), {"op": "tick"}]  # making progress, time wasters
        + [add("score", 300.0), {"op": "tick"}]  # halfway there (first prestige point), lol
        + [add("prestige_points", 10), {"op": "tick"}]  # hoarder
        + [{"op": "pu_cheaper"}] * 7 + [{"op": "buy_sps"}, {"op": "tick"}]  # free sample
        + [add("total_clicks", 10000), {"op": "tick"}]  # carpal tunnel, filler text, autoclicker, cheater!
        + [add("time_elapsed", 86400), {"op": "tick"}]  # i got you a gift!, stop., go touch grass
        + [add("broke_counter", 1000), {"op": "tick"}, {"op": "timer"}]  # bankruptcy, need a loan?, take a break.
        + [{"op": "prestige"}, add("score", 50.0), {"op": "prestige"}]  # the average costco:, lazy.
        + [{"op": "prestige"}, {"op": "tick"}]  # why?, then 100 percenting
        + [add("score", 6000.0), {"op": "tick"}]  # demo won
    )
    return [scripted_trace("full", "story-full", full_story),
            scripted_trace("demo", "story-demo", demo_story),
            scripted_trace("demo", "story-demo-complete", demo_complete)]


def all_traces(seeds: int = 12, steps: int = 1500) -> list:
    traces = scripted_traces()
    for seed in range(seeds):
        traces.append(random_trace("full", seed, steps))
        traces.append(random_trace("demo", seed, steps // 3))
    return traces
