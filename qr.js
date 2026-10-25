/* Minimal QR Code encoder: byte mode, error correction M, versions 1-10 (up to 213 bytes). */
function makeQR(text) {
  var ECC = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  var BLK = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
  var bytes = [], i, j;
  var enc = unescape(encodeURIComponent(text));
  for (i = 0; i < enc.length; i++) bytes.push(enc.charCodeAt(i));

  function rawModules(v) {
    var r = (16 * v + 128) * v + 64;
    if (v >= 2) { var n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
    return r;
  }
  function dataCap(v) { return Math.floor(rawModules(v) / 8) - ECC[v] * BLK[v]; }

  var ver = 0;
  for (var v = 1; v <= 10; v++) {
    var ccBits = v < 10 ? 8 : 16;
    if (4 + ccBits + 8 * bytes.length <= dataCap(v) * 8) { ver = v; break; }
  }
  if (!ver) throw new Error("Link bahut lamba hai");

  var bits = [];
  function put(val, len) { for (var k = len - 1; k >= 0; k--) bits.push((val >>> k) & 1); }
  put(4, 4); put(bytes.length, ver < 10 ? 8 : 16);
  bytes.forEach(function (b) { put(b, 8); });
  var cap = dataCap(ver) * 8;
  put(0, Math.min(4, cap - bits.length));
  while (bits.length % 8) bits.push(0);
  for (var pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
  var data = [];
  for (i = 0; i < bits.length; i += 8) { var by = 0; for (j = 0; j < 8; j++) by = (by << 1) | bits[i + j]; data.push(by); }

  /* Reed-Solomon */
  function mul(x, y) { var z = 0; for (var k = 7; k >= 0; k--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> k) & 1) * x; } return z; }
  function divisor(deg) {
    var res = []; for (var k = 0; k < deg - 1; k++) res.push(0); res.push(1);
    var root = 1;
    for (k = 0; k < deg; k++) {
      for (var m = 0; m < res.length; m++) { res[m] = mul(res[m], root); if (m + 1 < res.length) res[m] ^= res[m + 1]; }
      root = mul(root, 0x02);
    }
    return res;
  }
  function remainder(d, div) {
    var res = div.map(function () { return 0; });
    d.forEach(function (b) { var f = b ^ res.shift(); res.push(0); div.forEach(function (c, k) { res[k] ^= mul(c, f); }); });
    return res;
  }
  var nb = BLK[ver], eccLen = ECC[ver], raw = Math.floor(rawModules(ver) / 8);
  var nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), blocks = [], div = divisor(eccLen), kk = 0;
  for (i = 0; i < nb; i++) {
    var dat = data.slice(kk, kk + shortLen - eccLen + (i < nShort ? 0 : 1)); kk += dat.length;
    var ecc = remainder(dat, div);
    if (i < nShort) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  var all = [];
  for (i = 0; i < blocks[0].length; i++) blocks.forEach(function (b, bj) { if (i != shortLen - eccLen || bj >= nShort) all.push(b[i]); });

  /* Matrix */
  var size = ver * 4 + 17, mod = [], fn = [];
  for (i = 0; i < size; i++) { mod.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
  function setFn(x, y, d) { mod[y][x] = d; fn[y][x] = true; }
  for (i = 0; i < size; i++) { setFn(6, i, i % 2 == 0); setFn(i, 6, i % 2 == 0); }
  function finder(x, y) {
    for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
      var d = Math.max(Math.abs(dx), Math.abs(dy)), xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < size && yy >= 0 && yy < size) setFn(xx, yy, d != 2 && d != 4);
    }
  }
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  var pos = [];
  if (ver > 1) {
    var na = Math.floor(ver / 7) + 2, step = Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2;
    pos = [6]; for (var p = size - 7; pos.length < na; p -= step) pos.splice(1, 0, p);
  }
  for (i = 0; i < pos.length; i++) for (j = 0; j < pos.length; j++) {
    if ((i == 0 && j == 0) || (i == 0 && j == pos.length - 1) || (i == pos.length - 1 && j == 0)) continue;
    for (var ay = -2; ay <= 2; ay++) for (var ax = -2; ax <= 2; ax++) setFn(pos[i] + ax, pos[j] + ay, Math.max(Math.abs(ax), Math.abs(ay)) != 1);
  }
  function bit(x, k) { return ((x >>> k) & 1) != 0; }
  function formatBits(mask) {
    var d = (0 << 3) | mask, r = d;
    for (var k = 0; k < 10; k++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    var b = ((d << 10) | r) ^ 0x5412, k2;
    for (k2 = 0; k2 <= 5; k2++) setFn(8, k2, bit(b, k2));
    setFn(8, 7, bit(b, 6)); setFn(8, 8, bit(b, 7)); setFn(7, 8, bit(b, 8));
    for (k2 = 9; k2 < 15; k2++) setFn(14 - k2, 8, bit(b, k2));
    for (k2 = 0; k2 < 8; k2++) setFn(size - 1 - k2, 8, bit(b, k2));
    for (k2 = 8; k2 < 15; k2++) setFn(8, size - 15 + k2, bit(b, k2));
    setFn(8, size - 8, true);
  }
  formatBits(0);
  if (ver >= 7) {
    var r2 = ver; for (i = 0; i < 12; i++) r2 = (r2 << 1) ^ ((r2 >>> 11) * 0x1F25);
    var vb = (ver << 12) | r2;
    for (i = 0; i < 18; i++) { var c = bit(vb, i), a = size - 11 + i % 3, b2 = Math.floor(i / 3); setFn(a, b2, c); setFn(b2, a, c); }
  }
  var idx = 0;
  for (var right = size - 1; right >= 1; right -= 2) {
    if (right == 6) right = 5;
    for (var vert = 0; vert < size; vert++) for (j = 0; j < 2; j++) {
      var x = right - j, up = ((right + 1) & 2) == 0, y = up ? size - 1 - vert : vert;
      if (!fn[y][x] && idx < all.length * 8) { mod[y][x] = bit(all[idx >>> 3], 7 - (idx & 7)); idx++; }
    }
  }
  function applyMask(m) {
    for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
      var inv;
      switch (m) {
        case 0: inv = (x + y) % 2 == 0; break;
        case 1: inv = y % 2 == 0; break;
        case 2: inv = x % 3 == 0; break;
        case 3: inv = (x + y) % 3 == 0; break;
        case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 == 0; break;
        case 5: inv = x * y % 2 + x * y % 3 == 0; break;
        case 6: inv = (x * y % 2 + x * y % 3) % 2 == 0; break;
        default: inv = ((x + y) % 2 + x * y % 3) % 2 == 0;
      }
      if (!fn[y][x] && inv) mod[y][x] = !mod[y][x];
    }
  }
  function penalty() {
    var s = 0, y, x, k, dark = 0, line;
    function lineScore(get) {
      var sc = 0, run = 1, prev = get(0), k2;
      for (k2 = 1; k2 < size; k2++) { var c = get(k2); if (c == prev) run++; else { if (run >= 5) sc += 3 + run - 5; run = 1; prev = c; } }
      if (run >= 5) sc += 3 + run - 5;
      var a = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], b = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
      for (k2 = 0; k2 + 11 <= size; k2++) {
        var ma = true, mb = true;
        for (var q = 0; q < 11; q++) { var v2 = get(k2 + q) ? 1 : 0; if (v2 != a[q]) ma = false; if (v2 != b[q]) mb = false; }
        if (ma) sc += 40; if (mb) sc += 40;
      }
      return sc;
    }
    for (y = 0; y < size; y++) { s += lineScore(function (k2) { return mod[y][k2]; }); }
    for (x = 0; x < size; x++) { s += lineScore(function (k2) { return mod[k2][x]; }); }
    for (y = 0; y < size - 1; y++) for (x = 0; x < size - 1; x++) { var c0 = mod[y][x]; if (c0 == mod[y][x + 1] && c0 == mod[y + 1][x] && c0 == mod[y + 1][x + 1]) s += 3; }
    for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (mod[y][x]) dark++;
    var total = size * size;
    s += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return s;
  }
  var best = 0, bestP = Infinity;
  for (var m = 0; m < 8; m++) {
    applyMask(m); formatBits(m);
    var pen = penalty(); if (pen < bestP) { bestP = pen; best = m; }
    applyMask(m);
  }
  applyMask(best); formatBits(best);
  return { size: size, modules: mod, version: ver };
}
function qrSvgString(text) {
  var q = makeQR(text), n = q.size + 8, d = "";
  for (var y = 0; y < q.size; y++) {
    var x = 0;
    while (x < q.size) {
      if (q.modules[y][x]) { var s = x; while (x < q.size && q.modules[y][x]) x++; d += "M" + (s + 4) + " " + (y + 4) + "h" + (x - s) + "v1h-" + (x - s) + "z"; } else x++;
    }
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + " " + n + '" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="' + n + '" height="' + n + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
}
