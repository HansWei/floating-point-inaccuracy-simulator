/*
 * Python number semantics in JavaScript, so the web port shows the same floats as
 * the original Python game, digit for digit.
 *
 * Python int  -> JS BigInt  (exact, never overflows)
 * Python float -> JS number (both are IEEE 754 doubles, so + - * / match exactly)
 *
 * What does not match out of the box, and is handled here:
 *  - repr(): Python prints 0.1 + 0.2 as 0.30000000000000004 like JS, but 2.0 as "2.0",
 *    1e16 as "1e+16" and 1e-05 as "1e-05". pyStr() reproduces Python's rules.
 *  - base ** n: JS Math.pow differs from CPython's pow() in about 9% of cases.
 *    pyPow() rounds the exact BigInt result once, then applies the few known cases
 *    where CPython's pow() is itself off by one unit (pow-exceptions.js).
 *  - int + float, int * float, comparisons: pyAdd/pySub/pyMul follow Python's
 *    type rules (int op int stays int; anything with a float becomes a float).
 *    JS compares BigInt and number by exact value, the same as Python.
 */
(function (root) {
  "use strict";

  var POW_EXCEPTIONS = root.POW_EXCEPTIONS ||
    (typeof require === "function" ? require("./pow-exceptions.js") : {});

  function isInt(x) { return typeof x === "bigint"; }

  function toFloat(x) {
    // Python int -> float conversion is correctly rounded; so is Number(BigInt).
    return typeof x === "bigint" ? Number(x) : x;
  }

  function pyAdd(a, b) { return isInt(a) && isInt(b) ? a + b : toFloat(a) + toFloat(b); }
  function pySub(a, b) { return isInt(a) && isInt(b) ? a - b : toFloat(a) - toFloat(b); }
  function pyMul(a, b) { return isInt(a) && isInt(b) ? a * b : toFloat(a) * toFloat(b); }

  // Python int(x): truncate a float toward zero, exactly.
  function pyInt(x) {
    if (isInt(x)) return x;
    if (!isFinite(x)) throw new RangeError("cannot convert float " + x + " to integer");
    return BigInt(Math.trunc(x));
  }

  function floatRepr(x) {
    if (x !== x) return "nan";
    if (x === Infinity) return "inf";
    if (x === -Infinity) return "-inf";
    if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
    // toExponential() with no argument gives the shortest digits that round-trip,
    // the same digits Python's repr() picks.
    var m = /^(-?)(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(x.toExponential());
    var sign = m[1];
    var digits = m[2] + (m[3] || "");
    var e = parseInt(m[4], 10);
    if (e < -4 || e >= 16) {
      var exp = String(Math.abs(e));
      if (exp.length < 2) exp = "0" + exp;
      return sign + digits[0] + (digits.length > 1 ? "." + digits.slice(1) : "") +
        "e" + (e < 0 ? "-" : "+") + exp;
    }
    if (e >= 0) {
      var intPart = digits.slice(0, e + 1);
      while (intPart.length < e + 1) intPart += "0";
      return sign + intPart + "." + (digits.slice(e + 1) || "0");
    }
    return sign + "0." + new Array(-e).join("0") + digits;
  }

  // Python str() for an int, float or bool.
  function pyStr(x) {
    if (typeof x === "bigint") return x.toString();
    if (typeof x === "boolean") return x ? "True" : "False";
    return floatRepr(x);
  }

  // --- correctly rounded base ** n -------------------------------------------

  var view = new DataView(new ArrayBuffer(8));

  // Split a positive finite double into an odd-or-zero integer mantissa and a power of two.
  function decompose(x) {
    view.setFloat64(0, x);
    var hi = view.getUint32(0), lo = view.getUint32(4);
    var biased = (hi >>> 20) & 0x7ff;
    var mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
    var exp;
    if (biased === 0) {
      exp = -1074;
    } else {
      mant |= 1n << 52n;
      exp = biased - 1075;
    }
    return { mant: mant, exp: exp };
  }

  function bitLength(n) { return n === 0n ? 0 : n.toString(2).length; }

  function scaleByPow2(x, k) {
    while (k > 0) { var s = Math.min(k, 1000); x *= Math.pow(2, s); k -= s; }
    while (k < 0) { var t = Math.min(-k, 1000); x /= Math.pow(2, t); k += t; }
    return x;
  }

  // Round the exact value n * 2^k (n > 0 BigInt) to the nearest double, ties to even,
  // including subnormal results.
  function roundToDouble(n, k) {
    var len = bitLength(n);
    var top = len - 1 + k;
    var precision = top >= -1022 ? 53 : 53 - (-1022 - top);
    if (precision <= 0) {
      // Below half the smallest subnormal rounds to zero; exactly half rounds to even (zero).
      if (precision === 0 && n > (1n << BigInt(len - 1))) return Math.pow(2, -1074);
      return 0;
    }
    var shift = len - precision;
    if (shift > 0) {
      var s = BigInt(shift);
      var q = n >> s;
      var rem = n & ((1n << s) - 1n);
      var half = 1n << (s - 1n);
      if (rem > half || (rem === half && (q & 1n) === 1n)) q += 1n;
      return scaleByPow2(Number(q), k + shift);
    }
    return scaleByPow2(Number(n), k);
  }

  var powCache = new Map();
  var exceptionMaps = {};
  Object.keys(POW_EXCEPTIONS).forEach(function (base) {
    var m = new Map();
    POW_EXCEPTIONS[base].forEach(function (pair) { m.set(pair[0], fromHex(pair[1])); });
    exceptionMaps[base] = m;
  });

  // Parse Python float.hex() output, e.g. "0x1.8000000000000p+0".
  function fromHex(h) {
    var neg = h[0] === "-";
    if (neg) h = h.slice(1);
    var m = /^0x([01])\.?([0-9a-f]*)p([+-]\d+)$/.exec(h);
    var frac = m[2] || "";
    var v = Number(BigInt("0x" + m[1] + frac));
    v = scaleByPow2(v, parseInt(m[3], 10) - 4 * frac.length);
    return neg ? -v : v;
  }

  // Python's float ** int for a positive float base and an int n >= 0.
  function pyPow(base, n) {
    n = Number(n);
    var key = base + ":" + n;
    var cached = powCache.get(key);
    if (cached !== undefined) return cached;
    var exc = exceptionMaps[floatRepr(base)];
    var result;
    if (exc && exc.has(n)) {
      result = exc.get(n);
    } else if (n === 0) {
      result = 1;
    } else {
      var d = decompose(base);
      result = roundToDouble(d.mant ** BigInt(n), d.exp * n);
    }
    if (result === Infinity) throw new RangeError("(34, 'Result too large')");
    if (powCache.size > 5000) powCache.clear();
    powCache.set(key, result);
    return result;
  }

  // Correctly rounded natural log of a double, computed in 200-bit fixed point:
  // x = m * 2^e with m / 2^p in [0.75, 1.5), ln x = 2 atanh((m - 2^p) / (m + 2^p)) + (e + p) ln 2.
  // Math.log is not exact and differs between browsers, which can change int(log(...)).
  var LOG_PREC = 200n;
  var LOG_ONE = 1n << LOG_PREC;
  function twoAtanh(num, den) {
    var s = (num << LOG_PREC) / den;
    var s2 = (s * s) / LOG_ONE;
    var term = s, sum = 0n, k = 1n;
    while (term !== 0n) { sum += term / k; term = (term * s2) / LOG_ONE; k += 2n; }
    return 2n * sum;
  }
  var LN2_FIXED = twoAtanh(1n, 3n);
  var logView = new DataView(new ArrayBuffer(8));
  function crLog(x) {
    if (x !== x || x < 0) return NaN;
    if (x === 0) return -Infinity;
    if (x === Infinity) return Infinity;
    if (x === 1) return 0;
    logView.setFloat64(0, x);
    var hi = logView.getUint32(0), lo = logView.getUint32(4);
    var biased = (hi >>> 20) & 0x7ff;
    var mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
    var e = biased === 0 ? -1074 : biased - 1075;
    if (biased !== 0) mant |= 1n << 52n;
    var p = bitLength(mant) - 1;
    if (mant * 4n >= 3n << BigInt(p + 1)) p += 1;
    var pow2 = 1n << BigInt(p);
    var fixed = twoAtanh(mant - pow2, mant + pow2) + BigInt(e + p) * LN2_FIXED;
    return Number(fixed) / Math.pow(2, Number(LOG_PREC));
  }

  // Python math.log(x, base) is log(x) / log(base). The games only use it truncated with
  // int(); a correctly rounded log reproduces CPython's truncated results at every score
  // (tools/check_log_rounding.py), although macOS libm's log is not always correctly rounded.
  var logBaseCache = new Map();
  function pyLog(x, base) {
    var den = logBaseCache.get(base);
    if (den === undefined) { den = crLog(base); logBaseCache.set(base, den); }
    return crLog(toFloat(x)) / den;
  }

  var api = {
    isInt: isInt, toFloat: toFloat, pyAdd: pyAdd, pySub: pySub, pyMul: pyMul,
    pyInt: pyInt, pyStr: pyStr, floatRepr: floatRepr, pyPow: pyPow, pyLog: pyLog, crLog: crLog,
    fromHex: fromHex, roundToDouble: roundToDouble,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PyNum = api;
})(typeof self !== "undefined" ? self : this);
