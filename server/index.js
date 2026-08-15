// server/index.js · 今天不低头 · 本地后端代理(零依赖 Node)
// ------------------------------------------------------------
// 职责:
//   1. 持有 LLM key(走环境变量),前端永不接触 key —— 这是引入后端的根本理由。
//   2. 暴露 /api/* 端点(POST):intro / analyze / recommend / screen / coach /
//      profile / intake / game-report —— 覆盖开局问诊、结果分析、关卡推荐、
//      评估闸门、练习指导、档案画像、对话录入,以及游戏结果闭环(结论+方案+商品)。
//   3. 同源托管静态文件(index.html / mock-*.html / js / img …),
//      前端 fetch('/api/...') 无跨域,一个端口跑全部,摄像头也满足 localhost 安全上下文。
//
// 用内置 http/fs,不依赖 Express —— 零 npm install 即可 `node server/index.js` 跑起来。
// 隐私:后端只接收游戏传来的数值化 session 数据,绝不接收任何画面。

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { getProvider } from './adapters/provider.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// 极简 .env 读取(零依赖):把 server/.env 的键值塞进 process.env,已存在的不覆盖。
// .env 被 .gitignore 排除,LLM key 绝不进 git。必须在 getProvider() 生效前执行。
(function loadEnv() {
  try {
    const txt = readFileSync(join(__dirname, '.env'), 'utf8');
    for (const line of txt.split('\n')) {
      const s = line.trim();
      if (!s || s.startsWith('#')) continue;
      const eq = s.indexOf('=');
      if (eq < 0) continue;
      const k = s.slice(0, eq).trim();
      const v = s.slice(eq + 1).trim();
      if (k && process.env[k] === undefined) process.env[k] = v;
    }
  } catch {}  // 无 .env 则用现有环境变量
})();

const ROOT = normalize(join(__dirname, '..'));   // 项目根(静态文件在这)
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webp': 'image/webp',
};

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req, limitBytes = 512 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limitBytes) { reject(new Error('payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// ——— API：调 provider,任何错误都降级为 200 + degraded 标记,让前端静默兜底 ———
async function handleApi(req, res, path) {
  const provider = getProvider();
  let payload = {};
  try { payload = await readBody(req); } catch { return sendJSON(res, 400, { error: 'bad json' }); }

  try {
    if (path === '/api/intro') {
      const data = await provider.intro(payload);
      return sendJSON(res, 200, { provider: provider.name, ...data });
    }
    if (path === '/api/analyze') {
      const data = await provider.analyze(payload);
      return sendJSON(res, 200, { provider: provider.name, ...data });
    }
    if (path === '/api/recommend') {
      const data = await provider.recommend(payload);
      return sendJSON(res, 200, { provider: provider.name, ...data });
    }
    if (path === '/api/screen') {          // 健康评估:红旗+ROM→gate/flow/baseline
      const data = await provider.screen(payload);
      return sendJSON(res, 200, { provider: provider.name, ...data });
    }
    if (path === '/api/coach') {           // 练习指导:分流→当日方案
      const data = await provider.coach(payload);
      return sendJSON(res, 200, { provider: provider.name, ...data });
    }
    if (path === '/api/profile') {         // 档案健康画像分析
      const data = await provider.analyzeProfile(payload);
      return sendJSON(res, 200, { provider: provider.name, ...data });
    }
    if (path === '/api/intake') {          // 对话式录入:自由描述 → 结构化档案字段
      const data = await provider.intake(payload);
      return sendJSON(res, 200, { provider: provider.name, ...data });
    }
    if (path === '/api/game-report') {     // 编排:游戏结果 → 结论 + 训练方案 + 商业化推荐
      const data = await provider.gameReport(payload);
      return sendJSON(res, 200, { provider: provider.name, ...data });
    }
    return sendJSON(res, 404, { error: 'no such api' });
  } catch (e) {
    // provider 未配置 / 网关报错等 —— 不让前端 hard-fail,返回可降级标记
    console.warn(`[api] ${path} 失败:`, e.code || e.message);
    return sendJSON(res, 200, { provider: provider.name, degraded: true, reason: e.code || 'provider_error' });
  }
}

// ——— 静态文件 ———
async function handleStatic(req, res, path) {
  let rel = decodeURIComponent(path.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  const full = normalize(join(ROOT, rel));
  if (!full.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }  // 防目录穿越
  if (!existsSync(full)) { res.writeHead(404); return res.end('not found'); }
  try {
    const buf = await readFile(full);
    res.writeHead(200, { 'Content-Type': MIME[extname(full)] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(500); res.end('read error'); }
}

const server = http.createServer((req, res) => {
  const path = req.url || '/';
  if (path.startsWith('/api/')) {
    if (req.method !== 'POST') { res.writeHead(405); return res.end('use POST'); }
    return handleApi(req, res, path.split('?')[0]);
  }
  return handleStatic(req, res, path);
});

server.listen(PORT, () => {
  const p = getProvider();
  console.log(`今天不低头 后端 · http://localhost:${PORT}  (LLM provider: ${p.name})`);
  console.log(`打开游戏: http://localhost:${PORT}/index.html`);
});
