/*
 * Bong Bóng Lời Chúc — máy chủ Node.js thuần (không cần cài thư viện).
 * Chạy:  node server.js
 *
 * Tuỳ chỉnh (sửa trực tiếp bên dưới, hoặc đặt biến môi trường trên Render):
 *   TITLE        tiêu đề sự kiện
 *   MAX_WISHES   số lời chúc tối đa (mặc định 200)
 *   PUBLIC_URL   địa chỉ công khai (trên Render tự nhận, không cần đặt)
 * Xoá toàn bộ lời chúc:  node server.js --reset
 */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

// ======================= CẤU HÌNH =======================
const TITLE = process.env.TITLE || "Gửi Lời Chúc Yêu Thương";
const MAX_WISHES = Math.min(Number(process.env.MAX_WISHES) || 200, 1000);
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_URL = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/+$/, "");
const MAX_TEXT = 150;
const MAX_NAME = 40;
// Giới hạn gửi theo IP (khách cùng Wi‑Fi dùng chung IP nên để rộng rãi)
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_PER_IP = 30;
// ========================================================

const BEHIND_PROXY = !!(process.env.RENDER || process.env.TRUST_PROXY);
const DATA_FILE = path.join(__dirname, "wishes.json");
// Tìm giao diện trong thư mục public/, nếu không có thì tìm ngay cạnh server.js
const PUBLIC_DIR = fs.existsSync(path.join(__dirname, "public", "host.html"))
  ? path.join(__dirname, "public")
  : __dirname;

if (process.argv.includes("--reset")) {
  try { fs.unlinkSync(DATA_FILE); } catch {}
  console.log("Đã xoá toàn bộ lời chúc.");
  process.exit(0);
}

// ---------------- Lưu trữ ----------------
let wishes = [];
let devices = new Set();
try {
  const saved = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  if (Array.isArray(saved.wishes)) wishes = saved.wishes.slice(0, MAX_WISHES);
  if (Array.isArray(saved.devices)) devices = new Set(saved.devices);
} catch {}
let nextId = wishes.reduce((m, w) => Math.max(m, w.id), 0) + 1;

let saving = false, pending = false;
function save() {
  if (saving) { pending = true; return; }
  saving = true;
  const tmp = DATA_FILE + ".tmp";
  fs.writeFile(tmp, JSON.stringify({ wishes, devices: [...devices] }), (err) => {
    if (!err) { try { fs.renameSync(tmp, DATA_FILE); } catch {} }
    saving = false;
    if (pending) { pending = false; save(); }
  });
}

// ---------------- Làm sạch dữ liệu ----------------
// Bỏ ký tự điều khiển, ký tự đảo chiều văn bản (bidi) và ký tự vô hình
const BAD_RANGES = [[0x00, 0x09], [0x0B, 0x1F], [0x7F, 0x9F], [0xAD, 0xAD], [0x200B, 0x200F],
  [0x2028, 0x202E], [0x2060, 0x206F], [0xFEFF, 0xFEFF], [0xFFF9, 0xFFFB]];
const BAD_CHARS = new RegExp("[" + BAD_RANGES.map(([a, b]) =>
  String.fromCharCode(92) + "u" + a.toString(16).padStart(4, "0") + "-" +
  String.fromCharCode(92) + "u" + b.toString(16).padStart(4, "0")).join("") + "]", "g");
function clean(str, max) {
  if (typeof str !== "string") return "";
  return Array.from(
    str.normalize("NFC").replace(/\r\n?/g, "\n").replace(BAD_CHARS, "").replace(/\n{3,}/g, "\n\n").trim()
  ).slice(0, max).join("").trim();
}
const DEVICE_RE = /^[A-Za-z0-9-]{8,64}$/;

// ---------------- Chống spam ----------------
const hits = new Map(); // ip -> [thời điểm]
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  return list.length > RATE_MAX_PER_IP;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, list] of hits) if (!list.some((t) => now - t < RATE_WINDOW_MS)) hits.delete(ip);
}, RATE_WINDOW_MS).unref();

function clientIp(req) {
  if (BEHIND_PROXY) {
    const xff = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    if (xff) return xff;
  }
  return req.socket.remoteAddress || "unknown";
}

// ---------------- Tiện ích ----------------
function lanAddress() {
  const all = [];
  for (const list of Object.values(os.networkInterfaces()))
    for (const a of list || [])
      if (a.family === "IPv4" && !a.internal) all.push(a.address);
  return all.find((ip) => /^192\.168\./.test(ip)) || all.find((ip) => /^10\./.test(ip)) ||
    all.find((ip) => /^172\.(1[6-9]|2\d|3[01])\./.test(ip)) || all[0] || "localhost";
}

function securityHeaders(res, nonce) {
  res.setHeader("Content-Security-Policy", [
    "default-src 'self'",
    `script-src 'self'${nonce ? ` 'nonce-${nonce}'` : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; "));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  if (BEHIND_PROXY) res.setHeader("Strict-Transport-Security", "max-age=31536000");
}

function sendJSON(res, code, obj) {
  securityHeaders(res);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}
function sendText(res, code, text) {
  securityHeaders(res);
  res.writeHead(code, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
  res.end(text);
}

// Chỉ phục vụ đúng các file trong danh sách này (chặn truy cập file khác)
const STATIC = {
  "/": ["host.html", "text/html"],
  "/host": ["host.html", "text/html"],
  "/guest": ["guest.html", "text/html"],
  "/qr.js": ["qr.js", "application/javascript"],
  "/ocean.css": ["ocean.css", "text/css"],
  "/ocean.js": ["ocean.js", "application/javascript"],
};
const cache = {};
function loadStatic(file) {
  if (!cache[file]) cache[file] = fs.readFileSync(path.join(PUBLIC_DIR, file), "utf8");
  return cache[file];
}

function readBody(req, limit = 2048) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { req.removeAllListeners("data"); req.resume(); reject(new Error("too large")); }
      else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // một số trình duyệt cũ không gửi Origin
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

// ---------------- Xử lý yêu cầu ----------------
async function handle(req, res) {
  let url;
  try { url = new URL(req.url, "http://x"); } catch { return sendText(res, 400, "Yêu cầu không hợp lệ"); }
  const p = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;

  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "POST")
    return sendText(res, 405, "Phương thức không được hỗ trợ");

  // Trang & file tĩnh
  if ((req.method === "GET" || req.method === "HEAD") && STATIC[p]) {
    const [file, type] = STATIC[p];
    let body;
    try { body = loadStatic(file); }
    catch { return sendText(res, 500, `Không tìm thấy file ${file}. Hãy kiểm tra thư mục public trên GitHub.`); }
    let nonce;
    if (type === "text/html") {
      nonce = crypto.randomBytes(16).toString("base64");
      body = body.replace(/<script>/g, `<script nonce="${nonce}">`);
    }
    securityHeaders(res, nonce);
    res.writeHead(200, { "Content-Type": type + "; charset=utf-8", "Cache-Control": "no-cache" });
    return res.end(req.method === "HEAD" ? undefined : body);
  }

  if (req.method === "GET" && p === "/api/info") {
    return sendJSON(res, 200, {
      title: TITLE, max: MAX_WISHES, count: wishes.length, maxText: MAX_TEXT, maxName: MAX_NAME,
      lanUrl: PUBLIC_URL ? "" : `http://${lanAddress()}:${PORT}`, publicUrl: PUBLIC_URL,
    });
  }

  if (req.method === "GET" && p === "/api/wishes") {
    const since = Math.max(0, parseInt(url.searchParams.get("since"), 10) || 0);
    return sendJSON(res, 200, {
      count: wishes.length, max: MAX_WISHES,
      wishes: wishes.filter((w) => w.id > since).map(({ id, name, text }) => ({ id, name, text })),
    });
  }

  if (req.method === "GET" && p === "/api/status") {
    const device = String(url.searchParams.get("device") || "");
    return sendJSON(res, 200, {
      count: wishes.length, max: MAX_WISHES, full: wishes.length >= MAX_WISHES,
      sent: DEVICE_RE.test(device) ? devices.has(device) : false,
    });
  }

  if (req.method === "POST" && p === "/api/wish") {
    if (!sameOrigin(req)) return sendJSON(res, 403, { error: "Yêu cầu không hợp lệ." });
    if (!String(req.headers["content-type"] || "").startsWith("application/json"))
      return sendJSON(res, 415, { error: "Dữ liệu không hợp lệ." });
    if (rateLimited(clientIp(req)))
      return sendJSON(res, 429, { error: "Bạn gửi nhanh quá, đợi một chút rồi thử lại nhé." });

    let data;
    let raw;
    try { raw = await readBody(req); }
    catch { res.setHeader("Connection", "close"); return sendJSON(res, 413, { error: "Lời chúc quá dài." }); }
    try { data = JSON.parse(raw); }
    catch { return sendJSON(res, 400, { error: "Dữ liệu không hợp lệ." }); }
    if (!data || typeof data !== "object" || Array.isArray(data))
      return sendJSON(res, 400, { error: "Dữ liệu không hợp lệ." });

    const text = clean(data.text, MAX_TEXT);
    const name = clean(data.name, MAX_NAME).replace(/\n/g, " ") || "Khách mời";
    const device = typeof data.device === "string" && DEVICE_RE.test(data.device) ? data.device : "";

    if (!text) return sendJSON(res, 400, { error: "Bạn chưa viết lời chúc." });
    if (wishes.length >= MAX_WISHES) return sendJSON(res, 403, { error: "Đã đủ lời chúc", full: true });
    if (device && devices.has(device))
      return sendJSON(res, 409, { error: "Thiết bị này đã gửi lời chúc rồi.", sent: true });

    const wish = { id: nextId++, name, text, at: Date.now() };
    wishes.push(wish);
    if (device) devices.add(device);
    save();
    console.log(`  🫧 #${wish.id} ${JSON.stringify(name)}: ${JSON.stringify(text)}`);
    return sendJSON(res, 201, { ok: true, wish: { id: wish.id, name, text }, count: wishes.length, max: MAX_WISHES });
  }

  return sendText(res, 404, "Không tìm thấy trang");
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error("Lỗi:", err && err.message);
    if (!res.headersSent) sendText(res, 500, "Lỗi máy chủ");
    else res.end();
  });
});
// Chống giữ kết nối treo (slowloris)
server.headersTimeout = 15000;
server.requestTimeout = 20000;
server.keepAliveTimeout = 5000;
server.maxRequestsPerSocket = 200;

process.on("uncaughtException", (e) => console.error("Lỗi không mong muốn:", e && e.message));
process.on("unhandledRejection", (e) => console.error("Lỗi không mong muốn:", e && e.message));

server.listen(PORT, () => {
  console.log("\n  🌊  Bong Bóng Lời Chúc đang chạy!\n");
  console.log(`  Màn hình trình chiếu : ${PUBLIC_URL || `http://localhost:${PORT}`}`);
  console.log(`  Trang cho khách      : ${PUBLIC_URL || `http://${lanAddress()}:${PORT}`}/guest`);
  console.log(`  Thư mục giao diện    : ${PUBLIC_DIR}`);
  console.log(`  Lời chúc đã có       : ${wishes.length}/${MAX_WISHES}\n`);
});
