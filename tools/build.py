"""Build the itch.io-ready web versions of both games.

Each edition becomes one self-contained index.html (all CSS and JavaScript inlined, no
network requests), plus a zip with index.html at its root, which is what itch.io
expects for an HTML game.

Usage, from the repository root:  python3 tools/build.py
Output:
  dist/full/index.html   dist/floating-point-inaccuracy-simulator-web.zip
  dist/demo/index.html   dist/floating-point-inaccuracy-simulator-demo-web.zip
  dist/index.html        a landing page linking both, for hosting dist/ as one site
                         (GitHub Pages, any static web server); not part of the zips
"""

from __future__ import annotations

import html
import pathlib
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "web" / "src"
DIST = ROOT / "dist"

EDITIONS = {
    "full": {
        "title": "floating point inaccuracy simulator",
        "scripts": ["pow-exceptions.js", "pyfloat.js", "savejson.js", "engine-full.js", "i18n.js", "ui.js"],
        "zip": "floating-point-inaccuracy-simulator-web.zip",
    },
    "demo": {
        "title": "floating point inaccuracy simulator (demo)",
        "scripts": ["pow-exceptions.js", "pyfloat.js", "savejson.js", "engine-demo.js", "i18n.js", "ui.js"],
        "zip": "floating-point-inaccuracy-simulator-demo-web.zip",
    },
}

# A fixed timestamp keeps the zips byte-for-byte reproducible.
ZIP_DATE = (2025, 1, 1, 0, 0, 0)


def inline_script(name: str) -> str:
    code = (SRC / name).read_text(encoding="utf-8")
    # "</script" inside inlined code would end the tag early.
    code = code.replace("</script", "<\\/script")
    return f"<script>\n/* {name} */\n{code}</script>"


def build_page(edition: str) -> str:
    spec = EDITIONS[edition]
    template = (SRC / "index.html").read_text(encoding="utf-8")
    page = (template
            .replace("{{STYLE}}", (SRC / "style.css").read_text(encoding="utf-8"))
            .replace("{{SCRIPTS}}", "\n".join(inline_script(s) for s in spec["scripts"]))
            .replace("{{TITLE}}", html.escape(spec["title"]))
            .replace("{{EDITION}}", edition))
    assert "{{" not in page, "unfilled placeholder"
    return page


LANDING = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>floating point inaccuracy simulator</title>
<link rel="icon" href="data:,">
<style>
  body { font-family: system-ui, sans-serif; max-width: 34rem; margin: 3rem auto; padding: 0 1rem;
         line-height: 1.5; color: #1d1d1f; background: #fafafa; }
  a.play { display: block; margin: 0.75rem 0; padding: 0.9rem 1rem; border: 1px solid #ccc;
           border-radius: 8px; background: #fff; color: inherit; text-decoration: none; }
  a.play:hover, a.play:focus { border-color: #0a66c2; }
  small { color: #666; }
  @media (prefers-color-scheme: dark) {
    body { color: #eee; background: #111; } a.play { background: #1c1c1e; border-color: #444; }
    small { color: #aaa; }
  }
</style>
</head>
<body>
<h1>floating point inaccuracy simulator</h1>
<p>An incremental game about how computers store numbers: every value is shown exactly as
the computer holds it, rounding errors included.</p>
<a class="play" href="full/"><strong>play the full game</strong><br>
<small>reach 1e63 score; achievements, milestones and prestige upgrades</small></a>
<a class="play" href="demo/"><strong>play the demo</strong><br>
<small>a short version: win at 5000 score, with its own achievements</small></a>
<p><small>Progress is saved in this browser. Use "export save" in the game to back it up.</small></p>
</body>
</html>
"""


def write_zip(path: pathlib.Path, page: str) -> None:
    info = zipfile.ZipInfo("index.html", date_time=ZIP_DATE)
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o644 << 16
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr(info, page.encode("utf-8"))


def main() -> None:
    DIST.mkdir(exist_ok=True)
    for edition, spec in EDITIONS.items():
        page = build_page(edition)
        out_dir = DIST / edition
        out_dir.mkdir(exist_ok=True)
        (out_dir / "index.html").write_text(page, encoding="utf-8")
        write_zip(DIST / spec["zip"], page)
        size = (DIST / spec["zip"]).stat().st_size
        print(f"{edition}: dist/{edition}/index.html ({len(page.encode()) // 1024} KB), "
              f"dist/{spec['zip']} ({size // 1024} KB)")
    (DIST / "index.html").write_text(LANDING, encoding="utf-8")
    print("landing page: dist/index.html")


if __name__ == "__main__":
    main()
