/*
 * Reading and writing save files the way Python's json module and the original
 * load_game() do: floats are written with repr(), big ints keep every digit, and
 * values are cast with Python's float()/int() rules when loading.
 */
(function (root) {
  "use strict";

  var P = root.PyNum || (typeof require === "function" ? require("./pyfloat.js") : null);
  var pyInt = P.pyInt;

  // Python's json.dump writes floats with repr() and ints as plain digits.
  function jsonNumber(v) {
    if (typeof v === "bigint") return v.toString();
    if (v !== v) return "NaN";
    if (v === Infinity) return "Infinity";
    if (v === -Infinity) return "-Infinity";
    return P.floatRepr(v);
  }

  // JSON.parse would turn big ints into rounded doubles, so number literals are kept as
  // text and converted with Python's rules later.
  function parseSave(text) {
    if (typeof text !== "string") return null;
    try {
      var marked = text.replace(
        /("(?:[^"\\]|\\.)*")|(-?Infinity|NaN|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
        function (m, str, num) { return str !== undefined ? str : JSON.stringify("\u0000" + num); });
      var data = JSON.parse(marked);
      return data && typeof data === "object" && !Array.isArray(data) ? data : null;
    } catch (err) {
      return null;
    }
  }

  function get(data, key, fallback) {
    return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : fallback;
  }

  function literal(v) {
    return typeof v === "string" && v.charCodeAt(0) === 0 ? v.slice(1) : null;
  }

  function castFloat(v) { // Python float(x)
    if (typeof v === "bigint") return Number(v);
    if (typeof v === "number") return v;
    var lit = literal(v);
    if (lit === null) {
      if (typeof v === "boolean") return v ? 1 : 0;
      throw new TypeError("not a number");
    }
    if (/^-?\d+$/.test(lit)) return Number(BigInt(lit));
    return Number(lit);
  }

  function castInt(v) { // Python int(x)
    if (typeof v === "bigint") return v;
    if (typeof v === "number") return pyInt(v);
    var lit = literal(v);
    if (lit === null) {
      if (typeof v === "boolean") return v ? 1n : 0n;
      throw new TypeError("not a number");
    }
    if (/^-?\d+$/.test(lit)) return BigInt(lit);
    return pyInt(Number(lit));
  }

  function truthy(v) {
    var lit = literal(v);
    if (lit !== null) return Number(lit) !== 0;
    return Boolean(v);
  }

  function restoreFlags(list, saved) {
    if (!Array.isArray(saved)) return;
    for (var i = 0; i < saved.length && i < list.length; i++) list[i].unlocked = truthy(saved[i]);
  }

  var PySave = { jsonNumber: jsonNumber, parseSave: parseSave, get: get, castFloat: castFloat,
    castInt: castInt, truthy: truthy, restoreFlags: restoreFlags };

  if (typeof module !== "undefined" && module.exports) module.exports = PySave;
  else root.PySave = PySave;
})(typeof self !== "undefined" ? self : this);
