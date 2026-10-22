"""Parity tests: the JavaScript port against the untouched original Python games.

Each trace presses buttons, runs the 1 s income tick, fires delayed checks and jumps
ahead (score, time, clicks) in the original game, recording every variable and every
pop-up after each step. tests/replay.js does the same in the web engines. The tests
require every float to print the same digits (repr) and every message to match.

Run from the repository root:  python3 -m pytest -q tests
Requires Node.js on PATH (any version from 16 up).
"""

from __future__ import annotations

import json
import pathlib
import shutil
import subprocess

import pytest

import py_harness as h

HERE = pathlib.Path(__file__).resolve().parent
NODE = shutil.which("node")

pytestmark = pytest.mark.skipif(NODE is None, reason="Node.js is required")


def run_node(payload: dict) -> dict:
    proc = subprocess.run([NODE, str(HERE / "replay.js")], input=json.dumps(payload),
                          capture_output=True, text=True, timeout=600)
    assert proc.returncode == 0, proc.stderr
    return json.loads(proc.stdout)


def first_difference(expected: dict, actual: dict) -> str:
    if "error" in actual:
        return "JS raised: " + actual["error"]
    for key in expected["snapshot"]:
        if expected["snapshot"][key] != actual["snapshot"].get(key):
            return f"{key}: python={expected['snapshot'][key]!r} js={actual['snapshot'].get(key)!r}"
    if expected["messages"] != actual["messages"]:
        return f"messages: python={expected['messages']!r} js={actual['messages']!r}"
    return ""


@pytest.fixture(scope="module")
def traces():
    return h.all_traces(seeds=12, steps=1500)


@pytest.fixture(scope="module")
def replayed(traces):
    return run_node({"traces": traces})


def test_every_trace_matches_original(traces, replayed):
    total_steps = 0
    for exp, got in zip(traces, replayed["traces"]):
        diff = first_difference(exp["start"], got["start"])
        assert not diff, f"{exp['name']} at startup: {diff}"
        assert len(got["steps"]) == len(exp["steps"]), f"{exp['name']}: {got['steps'][-1]}"
        for i, (e, g) in enumerate(zip(exp["steps"], got["steps"])):
            diff = first_difference(e, g)
            assert not diff, f"{exp['name']} step {i} {e['step']}: {diff}"
        total_steps += len(exp["steps"])
    assert total_steps > 10000


def test_traces_reach_the_interesting_parts(traces):
    """Guard against traces that never exercise late-game code."""
    titles = {m[1] for t in traces for s in t["steps"] for m in s["messages"] if m[1]}
    for title in ["the name of the game", "lol", "cheater!", "go touch grass", "free sample",
                  "alright, i give up, you win", "take a break.", "the average costco:", "why?",
                  "halfway there!", "milestone milestone 1"]:
        assert title in titles, title
    texts = [m[2] for t in traces for s in t["steps"] for m in s["messages"]]
    assert any("prestige milestone" in x for x in texts)
    assert any(x.startswith("wow u actually did it") for x in texts)
    assert any(x.startswith("yay u completed the demo") for x in texts)
    floats = {s["snapshot"]["score"] for t in traces for s in t["steps"]}
    assert any("e+" in x for x in floats), "no score large enough for exponent notation"


@pytest.mark.parametrize("kind", ["full", "demo"])
def test_achievement_tables_match(replayed, kind):
    game = h.OriginalGame(kind)

    def rows(items):
        return [[a[0], a[1], [h.py_str(b) for b in a[5]], str(a[6])] for a in items]

    assert replayed["tables"][kind]["achievements"] == rows(game.ns["achievements"])
    assert replayed["tables"][kind]["special"] == rows(game.ns["special_achievements"])


def test_every_demo_achievement_is_reached(traces):
    """Each demo achievement pops up in at least one trace (so its rule is tested)."""
    game = h.OriginalGame("demo")
    titles = {m[1] for t in traces if t["kind"] == "demo" for s in t["steps"] for m in s["messages"]}
    expected = [a[0] for a in game.ns["achievements"] + game.ns["special_achievements"]]
    missing = [t for t in expected if t not in titles]
    assert not missing, missing


def test_demo_rules_unchanged_apart_from_achievements(tmp_path):
    """With every achievement already unlocked (so none can fire or pay out), the desktop
    demo plays exactly like the original demo, apart from its lower win score (1000, the
    original's is 5000)."""
    source = h.ORIGINAL_DEMO.read_text(encoding="utf-8")
    for old, new in [("if score >= 5000 and not won:", "if score >= 1000 and not won:"),
                     ("text='get 5000 score to win'", "text='get 1000 score to win'")]:
        assert source.count(old) == 1, old
        source = source.replace(old, new)
    original_at_1000 = tmp_path / h.ORIGINAL_DEMO.name
    original_at_1000.write_text(source, encoding="utf-8")
    base_vars = h.DEMO_VARS_ORIGINAL
    for seed in range(4):
        reference = h.OriginalGame("demo", path=original_at_1000, variables=base_vars)
        changed = h.OriginalGame("demo")
        for a in changed.ns["achievements"] + changed.ns["special_achievements"]:
            a[7] = True
        rng = __import__("random").Random(900 + seed)
        ops = ["click"] * 8 + ["buy_click", "buy_sps", "prestige", "pu_cheaper", "pu_timeskip",
                               "tick", "tick", "tick"]
        for _ in range(1500):
            op = rng.choice(ops + ["grant"])
            step = ({"op": "add", "var": "score", "value": h.typed(rng.uniform(1, 400))}
                    if op == "grant" else {"op": op})
            h.apply(reference, step)
            h.apply(changed, step)
            expected = reference.snapshot()
            got = {k: changed.snapshot()[k] for k in base_vars}
            assert got == expected, (seed, step)
            assert reference.take_messages() == [m for m in changed.take_messages()]
