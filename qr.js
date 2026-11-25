/*
 * Trình tạo mã QR gọn nhẹ (byte mode, chạy offline, không cần thư viện ngoài).
 * Dùng:  QR.toSVG("https://...", { ecl: "M", margin: 4, dark: "#000", light: "#fff" })
 */
(function (global) {
  "use strict";

  const ECC_PER_BLOCK = {
    L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  };
  const NUM_BLOCKS = {
    L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  };
  const ECL_BITS = { L: 1, M: 0 };

  const getBit = (x, i) => ((x >>> i) & 1) !== 0;

  function rawDataModules(ver) {
    let r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const na = Math.floor(ver / 7) + 2;
      r -= (25 * na - 10) * na - 55;
      if (ver >= 7) r -= 36;
    }
    return r;
  }
  const dataCodewords = (ver, ecl) =>
    Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ecl][ver] * NUM_BLOCKS[ecl][ver];

  function gfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xff;
  }
  function rsDivisor(deg) {
    const res = new Array(deg).fill(0);
    res[deg - 1] = 1;
    let root = 1;
    for (let i = 0; i < deg; i++) {
      for (let j = 0; j < deg; j++) {
        res[j] = gfMul(res[j], root);
        if (j + 1 < deg) res[j] ^= res[j + 1];
      }
      root = gfMul(root, 0x02);
    }
    return res;
  }
  function rsRemainder(data, div) {
    const res = new Array(div.length).fill(0);
    for (const b of data) {
      const f = b ^ res.shift();
      res.push(0);
      div.forEach((c, i) => (res[i] ^= gfMul(c, f)));
    }
    return res;
  }

  function utf8(str) {
    return Array.from(new TextEncoder().encode(str));
  }

  function encode(text, ecl) {
    ecl = ecl === "L" ? "L" : "M";
    const bytes = utf8(text);
    let ver;
    for (ver = 1; ver <= 40; ver++) {
      const ccBits = ver <= 9 ? 8 : 16;
      const need = 4 + ccBits + bytes.length * 8;
      if (need <= dataCodewords(ver, ecl) * 8) break;
    }
    if (ver > 40) throw new Error("Dữ liệu quá dài cho mã QR");

    // ---- Chuỗi bit dữ liệu
    const bits = [];
    const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(0x4, 4);
    push(bytes.length, ver <= 9 ? 8 : 16);
    bytes.forEach((b) => push(b, 8));
    const cap = dataCodewords(ver, ecl) * 8;
    push(0, Math.min(4, cap - bits.length));
    push(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) push(pad, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
      let v = 0;
      for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
      data.push(v);
    }

    // ---- Sửa lỗi Reed–Solomon + xen kẽ khối
    const nb = NUM_BLOCKS[ecl][ver];
    const eccLen = ECC_PER_BLOCK[ecl][ver];
    const raw = Math.floor(rawDataModules(ver) / 8);
    const nShort = nb - (raw % nb);
    const shortLen = Math.floor(raw / nb);
    const div = rsDivisor(eccLen);
    const blocks = [];
    for (let i = 0, k = 0; i < nb; i++) {
      const dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1));
      k += dat.length;
      const ecc = rsRemainder(dat, div);
      if (i < nShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    const codewords = [];
    for (let i = 0; i < blocks[0].length; i++)
      for (let j = 0; j < blocks.length; j++)
        if (i !== shortLen - eccLen || j >= nShort) codewords.push(blocks[j][i]);

    // ---- Ma trận
    const size = ver * 4 + 17;
    const mod = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const setF = (x, y, d) => { mod[y][x] = d; fn[y][x] = true; };

    for (let i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const d = Math.max(Math.abs(dx), Math.abs(dy));
          const x = cx + dx, y = cy + dy;
          if (x >= 0 && x < size && y >= 0 && y < size) setF(x, y, d !== 2 && d !== 4);
        }
    };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);

    if (ver > 1) {
      const na = Math.floor(ver / 7) + 2;
      const step = Math.floor((ver * 8 + na * 3 + 5) / (na * 4 - 4)) * 2;
      const pos = [6];
      for (let p = size - 7; pos.length < na; p -= step) pos.splice(1, 0, p);
      for (let i = 0; i < na; i++)
        for (let j = 0; j < na; j++) {
          if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
          for (let dy = -2; dy <= 2; dy++)
            for (let dx = -2; dx <= 2; dx++)
              setF(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
    }

    const drawFormat = (mask) => {
      const d = (ECL_BITS[ecl] << 3) | mask;
      let rem = d;
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const b = ((d << 10) | rem) ^ 0x5412;
      for (let i = 0; i <= 5; i++) setF(8, i, getBit(b, i));
      setF(8, 7, getBit(b, 6));
      setF(8, 8, getBit(b, 7));
      setF(7, 8, getBit(b, 8));
      for (let i = 9; i < 15; i++) setF(14 - i, 8, getBit(b, i));
      for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, getBit(b, i));
      for (let i = 8; i < 15; i++) setF(8, size - 15 + i, getBit(b, i));
      setF(8, size - 8, true);
    };
    drawFormat(0);

    if (ver >= 7) {
      let rem = ver;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const b = (ver << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const bit = getBit(b, i);
        const a = size - 11 + (i % 3), c = Math.floor(i / 3);
        setF(a, c, bit); setF(c, a, bit);
      }
    }

    // ---- Đặt dữ liệu theo đường zigzag
    let bi = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let v = 0; v < size; v++)
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const up = ((right + 1) & 2) === 0;
          const y = up ? size - 1 - v : v;
          if (!fn[y][x] && bi < codewords.length * 8) {
            mod[y][x] = getBit(codewords[bi >>> 3], 7 - (bi & 7));
            bi++;
          }
        }
    }

    // ---- Chọn mặt nạ tốt nhất
    const maskFn = [
      (x, y) => (x + y) % 2 === 0,
      (x, y) => y % 2 === 0,
      (x, y) => x % 3 === 0,
      (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
      (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
      (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
      (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
    ];
    const applyMask = (m) => {
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++)
          if (!fn[y][x] && maskFn[m](x, y)) mod[y][x] = !mod[y][x];
    };
    const penalty = () => {
      let p = 0, dark = 0;
      for (let y = 0; y < size; y++) {
        for (let pass = 0; pass < 2; pass++) {
          let run = 1;
          for (let x = 1; x < size; x++) {
            const a = pass ? mod[x][y] : mod[y][x];
            const b = pass ? mod[x - 1][y] : mod[y][x - 1];
            if (a === b) { run++; if (run === 5) p += 3; else if (run > 5) p++; }
            else run = 1;
          }
        }
        for (let x = 0; x < size; x++) {
          if (mod[y][x]) dark++;
          if (x < size - 1 && y < size - 1) {
            const c = mod[y][x];
            if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3;
          }
        }
      }
      const total = size * size;
      p += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
      return p;
    };
    let best = 0, bestP = Infinity;
    for (let m = 0; m < 8; m++) {
      applyMask(m); drawFormat(m);
      const p = penalty();
      if (p < bestP) { bestP = p; best = m; }
      applyMask(m);
    }
    applyMask(best); drawFormat(best);
    return { size, modules: mod };
  }

  function toSVG(text, opt = {}) {
    const { size, modules } = encode(text, opt.ecl || "M");
    const m = opt.margin == null ? 4 : opt.margin;
    const dark = opt.dark || "#000", light = opt.light || "#fff";
    let d = "";
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++)
        if (modules[y][x]) d += `M${x + m},${y + m}h1v1h-1z`;
    const s = size + m * 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
  }

  const api = { encode, toSVG };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.QR = api;
})(typeof window !== "undefined" ? window : globalThis);
