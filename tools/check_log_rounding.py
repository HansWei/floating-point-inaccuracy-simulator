"""Check that a correctly rounded log gives the same game results as Python's math.log.

The games only use log() truncated with int():
  - prestige points: int(log(score, 10)) in the full game, int(log(score, 5)) in the demo;
  - progress: int(log(score, 10) / 63 * 1000) / 10 in the full game.

The web port computes a correctly rounded log with BigInt (pyfloat.js crLog), because
JavaScript's Math.log is not exact and differs between browsers. The C library behind
CPython's math.log (macOS libm) is itself off by one unit in the last place for about 1
in 7000 inputs. Such an error can only change int(...) when the quotient is within a few
units of a whole number, so this script scans every score near every boundary up to the
largest float and compares Python with the correctly rounded value.

Result with Python 3.14 on macOS arm64: 15.7 million scores near boundaries, 34 log
mismatches, none of which changes a truncated result. Exits 1 if a platform differs.
Takes about a minute; uses all CPU cores.
"""

from __future__ import annotations

import math
import multiprocessing
import struct
import sys
from decimal import Decimal, getcontext

MAX = sys.float_info.max
Q_ULPS = 3  # |python quotient - correctly rounded quotient| is at most 2 units; 3 is margin
X_MARGIN = 64

# name, base, transform applied to log(x, base) before int()
CASES = {
    "demo prestige": (5.0, lambda q: q),
    "full prestige": (10.0, lambda q: q),
    "full progress": (10.0, lambda q: q / 63 * 1000),
}


def bits(x: float) -> int:
    return struct.unpack("<q", struct.pack("<d", x))[0]


def from_bits(b: int) -> float:
    return struct.unpack("<d", struct.pack("<q", b))[0]


def cr_log(x: float) -> float:
    return float(Decimal(x).ln())


def first_bits(pred, lo: int, hi: int) -> int:
    """Smallest b in [lo, hi] with pred(from_bits(b)) true (pred monotone)."""
    while lo < hi:
        mid = (lo + hi) // 2
        if pred(from_bits(mid)):
            hi = mid
        else:
            lo = mid + 1
    return lo


def scan(job):
    name, j = job
    getcontext().prec = 50
    base, f = CASES[name]
    ln_base = math.log(base)
    q_threshold = first_bits(lambda q: f(q) >= j, 0, bits(MAX))
    q_lo, q_hi = from_bits(q_threshold - Q_ULPS), from_bits(q_threshold + Q_ULPS)
    one, top = bits(1.0), bits(MAX)
    x_lo = first_bits(lambda x: math.log(x, base) >= q_lo, one, top) - X_MARGIN
    x_hi = first_bits(lambda x: math.log(x, base) > q_hi, one, top) + X_MARGIN
    found, mismatched, worst = [], 0, 0
    for xb in range(max(x_lo, one), min(x_hi, top) + 1):
        x = from_bits(xb)
        py_log = math.log(x)
        cr = cr_log(x)
        if py_log == cr:
            continue
        mismatched += 1
        py_q, cr_q = py_log / ln_base, cr / ln_base
        worst = max(worst, abs(bits(py_q) - bits(cr_q)))
        if int(f(py_q)) != int(f(cr_q)):
            found.append((x.hex(), py_log.hex()))
    return name, j, x_hi - x_lo + 1, mismatched, worst, found


def main() -> int:
    getcontext().prec = 50
    for base in (5.0, 10.0):
        assert math.log(base) == cr_log(base), f"log({base}) is not correctly rounded"
    jobs = []
    for name, (base, f) in CASES.items():
        jobs += [(name, j) for j in range(1, int(f(math.log(MAX, base))) + 1)]
    table: dict[str, str] = {}
    stats = {name: [0, 0, 0, 0] for name in CASES}
    with multiprocessing.Pool() as pool:
        for i, (name, j, scanned, mismatched, worst, found) in enumerate(
                pool.imap_unordered(scan, jobs, chunksize=8)):
            s = stats[name]
            s[0] += scanned
            s[1] += mismatched
            s[2] = max(s[2], worst)
            s[3] += len(found)
            table.update(found)
            if i % 500 == 0:
                print(f"{i}/{len(jobs)} boundaries", file=sys.stderr)
    for name, (scanned, mismatched, worst, flips) in stats.items():
        print(f"{name}: scanned {scanned} scores, {mismatched} log mismatches "
              f"(max {worst} units in the quotient), {flips} change the result", file=sys.stderr)
        assert worst < Q_ULPS, "window too small for this libm"
    if table:
        print("scores where the web port would differ (score, python log):", file=sys.stderr)
        for x, py_log in sorted(table.items(), key=lambda kv: float.fromhex(kv[0])):
            print(f"  {float.fromhex(x)!r} {float.fromhex(py_log)!r}", file=sys.stderr)
        return 1
    print("ok: the correctly rounded log matches every truncated result", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
