"""Browser tests for the built pages in dist/ (run tools/build.py first).

They drive the real page in Chrome through Playwright with a fake clock, play the same
scripted stories as the original Python games and compare every value and every pop-up.
They also check saving across reloads inside a sandboxed cross-origin iframe (the way
itch.io embeds HTML games), importing a desktop save.json, and a 320 px wide layout.

Skipped unless Playwright is installed:  pip install pytest playwright
Uses the installed Google Chrome (or set FPIS_BROWSER_CHANNEL=chromium after
`playwright install chromium`). Set FPIS_SCREENSHOTS=<dir> to save screenshots.
"""

from __future__ import annotations

import functools
import http.server
import os
import pathlib
import threading

import pytest

import py_harness as h

playwright_sync = pytest.importorskip("playwright.sync_api")

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
CHANNEL = os.environ.get("FPIS_BROWSER_CHANNEL", "chrome")
SHOTS = os.environ.get("FPIS_SCREENSHOTS")
TITLES = {"full": "floating point inaccuracy simulator",
          "demo": "floating point inaccuracy simulator (demo)"}

pytestmark = pytest.mark.skipif(not (DIST / "full" / "index.html").exists(),
                                reason="run tools/build.py first")

SNAPSHOT_JS = """(kind) => {
  const g = window.fpis.game, P = window.PyNum;
  const counters = new Set(%s);
  const out = {};
  for (const k of %s[kind]) out[k] = counters.has(k) ? String(g[k]) : P.pyStr(g[k]);
  if (g.achievements) {
    out.achievements = g.achievements.map(a => a.unlocked ? "1" : "0").join("");
    out.special = g.special_achievements.map(a => a.unlocked ? "1" : "0").join("");
  }
  return out;
}""" % (
    repr(["click_upgrade_index", "sps_upgrade_index", "cheaper_upgrades_index",
          "sps_prestige_upgrade_index", "score_ms_index", "upgrade_ms_index",
          "prestige_ms_index", "time_elapsed", "total_clicks", "lifetime_prestiges",
          "broke_counter", "upgrades_paid_for", "run_clicks"]),
    repr({"full": h.FULL_VARS, "demo": h.DEMO_VARS}).replace("'", '"'),
)

PANEL_OF = {"click": 0, "buy_click": 1, "buy_sps": 1}


class _Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_a):
        pass

    def do_GET(self):
        if self.path.startswith("/__itch/"):
            # A stand-in for an itch.io game page: the game runs in a sandboxed iframe on
            # another origin (127.0.0.1 instead of localhost), without allow-modals.
            edition = self.path.split("/")[2]
            port = self.server.server_address[1]
            body = (f'<!doctype html><title>host</title><link rel="icon" href="data:,"><body style="margin:0">'
                    f'<iframe id="game" src="http://127.0.0.1:{port}/{edition}/index.html" '
                    f'width="640" height="560" style="border:0" '
                    f'sandbox="allow-scripts allow-same-origin allow-forms allow-popups">'
                    f'</iframe></body>').encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


@pytest.fixture(scope="module")
def server():
    handler = functools.partial(_Handler, directory=str(DIST))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    yield f"http://localhost:{httpd.server_address[1]}"
    httpd.shutdown()


@pytest.fixture(scope="module")
def browser():
    with playwright_sync.sync_playwright() as p:
        try:
            b = p.chromium.launch(channel=CHANNEL if CHANNEL != "chromium" else None)
        except Exception as err:  # noqa: BLE001
            pytest.skip(f"no browser: {err}")
        yield b
        b.close()


@pytest.fixture
def page(browser):
    context = browser.new_context(viewport={"width": 640, "height": 720})
    page = context.new_page()
    errors: list = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("response", lambda r: errors.append(f"HTTP {r.status} {r.url}") if r.status >= 400 else None)
    page.errors = errors
    yield page
    context.close()
    assert not errors, errors


def shot(page, name):
    if SHOTS:
        pathlib.Path(SHOTS).mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(pathlib.Path(SHOTS) / f"{name}.png"))


def open_paused(page, url):
    page.clock.install(time=1_700_000_000_000)
    page.clock.pause_at(1_700_000_000_000)
    page.goto(url)
    page.wait_for_function("window.fpis !== undefined")


def dismiss_all(page) -> list:
    shown = []
    while page.locator("[data-modal]").is_visible():
        title = page.locator("[data-dialog-title]").text_content()
        text = page.locator("[data-dialog-text]").text_content()
        error = "error" in (page.locator(".dialog").get_attribute("class") or "")
        shown.append(["error" if error else "info", title, text])
        page.locator("[data-dialog-buttons] button").first.click()
    return shown


def expected_messages(kind, messages):
    out = []
    for k, title, text in messages:
        out.append([k, title or ("Error" if k == "error" else TITLES[kind]), text])
    return out


def do_step(page, step) -> list:
    """Perform one trace step in the page; return the pop-ups it showed."""
    op = step["op"]
    shown = []
    if op == "tick":
        # Like the original, the next tick waits until its pop-ups are closed.
        for _ in range(step.get("n", 1)):
            page.clock.run_for(1000)
            shown += dismiss_all(page)
    elif op == "add":
        v = step["value"]
        literal = f'{v["int"]}n' if "int" in v else f'PyNum.fromHex("{v["float"]}")'
        page.evaluate(f"""() => {{
          const g = window.fpis.game, v = {literal};
          g["{step['var']}"] = typeof g["{step['var']}"] === "number" && typeof v === "bigint"
            ? g["{step['var']}"] + Number(v) : PyNum.pyAdd(g["{step['var']}"], v);
          window.fpis.render();
        }}""")
    else:
        panel = PANEL_OF.get(op, 2)
        page.locator(f'.tabs [data-goto="{panel}"]').click()
        page.locator(f'[data-action="{op}"]').click()
    return shown + dismiss_all(page)


def stories():
    for trace in h.scripted_traces():
        steps = [s["step"] for s in trace["steps"] if s["step"]["op"] != "timer"]
        yield pytest.param(trace["kind"], steps, id=trace["name"])


@pytest.mark.parametrize("kind,steps", list(stories()))
def test_story_matches_original(page, server, kind, steps):
    original = h.OriginalGame(kind)
    open_paused(page, f"{server}/{kind}/index.html")
    assert page.title() == TITLES[kind]
    assert page.evaluate(SNAPSHOT_JS, kind) == original.snapshot()
    assert dismiss_all(page) == expected_messages(kind, original.take_messages())
    for i, step in enumerate(steps):
        h.apply(original, step)
        shown = do_step(page, step)
        assert shown == expected_messages(kind, original.take_messages()), (i, step)
        snap = original.snapshot()
        assert page.evaluate(SNAPSHOT_JS, kind) == snap, (i, step)
        page.locator('.tabs [data-goto="0"]').click()
        assert page.locator('[data-panel="0"] [data-view="score"]').text_content() == \
            "score: " + snap["score"]
    shot(page, f"{kind}-story-end")


@pytest.mark.parametrize("kind", ["full", "demo"])
def test_progress_survives_reload_in_sandboxed_iframe(page, server, kind):
    page.goto(f"{server}/__itch/{kind}/")
    frame = page.frame_locator("#game")
    frame.locator('[data-action="click"]').wait_for()
    game_frame = page.frame(url=lambda u: "127.0.0.1" in u)
    # The game runs on the real clock here, so a pop-up can open between the check and
    # the click; such a click is ignored on purpose. Count the clicks the game accepted.
    while game_frame.evaluate("fpis.game.total_clicks") < 25:
        while frame.locator("[data-modal]").is_visible():
            frame.locator("[data-dialog-buttons] button").first.click()
        frame.locator('[data-action="click"]').click()
    before = float(game_frame.evaluate("Number(fpis.game.score)"))
    assert before > 0
    page.reload()
    frame = page.frame_locator("#game")
    frame.locator('[data-action="click"]').wait_for()
    game_frame = page.frame(url=lambda u: "127.0.0.1" in u)
    # Score never goes down without spending, so a restored save has at least as much.
    assert float(game_frame.evaluate("Number(fpis.game.score)")) >= before
    assert game_frame.evaluate("fpis.game.total_clicks") == 25
    assert frame.locator("[data-status]").text_content() == ""  # no storage warning
    shot(page, f"{kind}-itch-iframe")


def test_import_desktop_save(page, server, tmp_path):
    game = h.OriginalGame("full", save_dir=str(tmp_path), keep_saving=True)
    for step in h.random_trace("full", 7, 300)["steps"]:
        h.apply(game, step["step"])
    game.ns["save_game"]()
    text = pathlib.Path(game.save_path).read_text()
    loaded = h.OriginalGame("full", save_dir=str(tmp_path))  # Python's own load + startup tick

    open_paused(page, f"{server}/full/index.html")
    dismiss_all(page)
    page.locator('[data-cmd="import"]').click()
    page.locator("[data-dialog-input]").fill(text)
    page.locator("[data-dialog-buttons] button", has_text="load").click()
    shown = dismiss_all(page)
    assert shown == expected_messages("full", loaded.take_messages())
    assert page.evaluate(SNAPSHOT_JS, "full") == loaded.snapshot()

    page.locator('[data-cmd="import"]').click()
    page.locator("[data-dialog-input]").fill("not a save")
    page.locator("[data-dialog-buttons] button", has_text="load").click()
    assert "not a save for this game" in page.locator("[data-dialog-text]").text_content()
    page.locator("[data-dialog-buttons] button", has_text="cancel").click()
    assert page.evaluate(SNAPSHOT_JS, "full") == loaded.snapshot()

    # A save that loads but cannot run (a huge upgrade index overflows the cost) is
    # rejected, and the stored save is left alone.
    stored = page.evaluate("localStorage.getItem('floating-point-inaccuracy-simulator/full/save.json')")
    page.locator('[data-cmd="import"]').click()
    page.locator("[data-dialog-input]").fill('{"click_upgrade_index": 1024}')
    page.locator("[data-dialog-buttons] button", has_text="load").click()
    assert "not a save for this game" in page.locator("[data-dialog-text]").text_content()
    page.locator("[data-dialog-buttons] button", has_text="cancel").click()
    assert page.evaluate(SNAPSHOT_JS, "full") == loaded.snapshot()
    assert page.evaluate(
        "localStorage.getItem('floating-point-inaccuracy-simulator/full/save.json')") == stored


def test_unusable_stored_save_starts_a_new_game(page, server):
    key = "floating-point-inaccuracy-simulator/full/save.json"
    # Store the save before the page's own scripts run (the page saves when it unloads).
    page.add_init_script(
        "if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1');"
        f" localStorage.setItem('{key}', '{{\"click_upgrade_index\": 1024}}'); }}")
    page.goto(f"{server}/full/index.html")
    page.wait_for_function("window.fpis !== undefined")
    assert "could not be read" in page.locator("[data-status]").text_content()
    backups = page.evaluate("Object.keys(localStorage).filter(k => k.includes('.unreadable-'))")
    assert len(backups) == 1


@pytest.mark.parametrize("kind", ["full", "demo"])
def test_pop_up_blocks_the_game_behind_it(page, server, kind):
    open_paused(page, f"{server}/{kind}/index.html")
    dismiss_all(page)
    page.locator('[data-action="click"]').click()  # "beginning of the end" pop-up (demo)
    if not page.locator("[data-modal]").is_visible():
        page.locator('[data-cmd="reset"]').click()  # any pop-up will do
    assert page.locator("[data-modal]").is_visible()
    clicks = page.evaluate("fpis.game.total_clicks")
    assert page.evaluate("document.querySelector('.app').inert") is True
    # Keyboard activation of a background button arrives as a click event.
    page.evaluate("document.querySelector('[data-action=\"click\"]').click()")
    for _ in range(10):
        page.keyboard.press("Tab")
        on_game = page.evaluate("document.querySelector('.app').contains(document.activeElement)")
        assert not on_game, "focus reached a game control behind the pop-up"
    assert page.evaluate("fpis.game.total_clicks") == clicks


def test_held_key_does_not_auto_click(page, server):
    open_paused(page, f"{server}/full/index.html")
    dismiss_all(page)
    page.locator("h1").click()
    page.keyboard.down(" ")
    for _ in range(30):
        page.evaluate("""() => document.dispatchEvent(new KeyboardEvent("keydown",
            {key: " ", repeat: true, bubbles: true}))""")
    page.keyboard.up(" ")
    assert page.evaluate("fpis.game.total_clicks") == 1


@pytest.mark.parametrize("kind", ["full", "demo"])
def test_narrow_screen_has_no_sideways_scroll(browser, server, kind):
    context = browser.new_context(viewport={"width": 320, "height": 640}, is_mobile=True,
                                  has_touch=True)
    page = context.new_page()
    page.goto(f"{server}/{kind}/index.html")
    page.wait_for_function("window.fpis !== undefined")
    for panel in range(3):
        page.evaluate(f"() => document.querySelector('.tabs [data-goto=\"{panel}\"]').click()")
        assert page.evaluate("document.documentElement.scrollWidth") <= 320
        shot(page, f"{kind}-mobile-{panel}")
    context.close()
