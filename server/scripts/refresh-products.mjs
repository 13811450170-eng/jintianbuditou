// refresh-products.mjs · 用 o2 metasearch 拉真实京东商品,重写 server/data/products.json
// ------------------------------------------------------------
// 这是「离线刷新脚本」,不在请求路径里 —— 请求路径读的是它产出的 products.json(零依赖)。
//
// 依赖(仅本脚本需要,后端运行不需要):
//   1. o2 CLI 的 metasearch(京东元搜索)。安装:
//        o2 install metasearch          # 若 pip 私有源 OK
//      本机是用 python3.12 venv 装的 wheel,可执行文件在 ~/.local/msvenv/bin/metasearch。
//   2. 网络能连京东内网 A2A 网关(metasearch 开箱即用,无需凭证)。
//
// 用法:
//   node server/scripts/refresh-products.mjs                    # 用默认 metasearch 可执行
//   METASEARCH_BIN=~/.local/msvenv/bin/metasearch node server/scripts/refresh-products.mjs
//
// 产出:server/data/products.json —— 按品类分组,每条已归一化为前端/推荐器直接可用的形状。

import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'data', 'products.json');

// metasearch 可执行:优先环境变量,其次本机 venv,最后 PATH 上的 metasearch。
const METASEARCH_BIN = process.env.METASEARCH_BIN
  || join(homedir(), '.local/msvenv/bin/metasearch');

// 品类 → 搜索词。品类键与 products.js 意图映射一一对应。
const CATEGORIES = [
  { key: 'neck-massager',     label: '颈椎按摩仪',   query: '颈椎按摩仪' },
  { key: 'shoulder-massager', label: '肩颈按摩披肩', query: '肩颈按摩披肩' },
  { key: 'neck-pillow',       label: '护颈枕',       query: '护颈枕 颈椎' },
  { key: 'laptop-stand',      label: '笔记本支架',   query: '笔记本支架 升降' },
  { key: 'ergonomic-chair',   label: '人体工学椅',   query: '人体工学椅' },
  { key: 'eye-mask',          label: '蒸汽眼罩',     query: '热敷眼罩 缓解疲劳' },
  { key: 'eye-lamp',          label: '护眼台灯',     query: '护眼台灯' },
];

const PER_CATEGORY = 4;   // 每品类留几条(推荐器再从中挑 1-2)

// 调 metasearch 搜一个词,返回归一化商品数组。失败抛错(由 main 决定是否中止)。
function search(query) {
  return new Promise((resolve, reject) => {
    const args = ['--json', 'search', query, '--domain', 'sku'];
    const child = spawn(METASEARCH_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', d => (out += d));
    child.stderr.on('data', d => (err += d));
    child.on('error', reject);   // 可执行不存在等
    child.on('close', code => {
      if (code !== 0) return reject(new Error(`metasearch 退出码 ${code}: ${err.trim() || '(无 stderr)'}`));
      try {
        const data = JSON.parse(out);
        if (!data.ok) return reject(new Error(`metasearch ok=false: ${data.text || JSON.stringify(data).slice(0, 200)}`));
        resolve(data.data?.results || []);
      } catch (e) {
        reject(new Error(`解析 metasearch 输出失败: ${e.message}`));
      }
    });
  });
}

// 把 metasearch 的一条结果压成前端/推荐器要的最小形状。
function normalize(r) {
  const e = r.extra || {};
  return {
    id: r.id,
    name: (e.clean_name || r.name || '').trim(),
    fullName: r.name,
    price: r.price,
    image: r.image,
    url: r.item_url,
    shop: e.shop_name || '',
    isSelf: e.is_self === true,
    goodRate: e.good_rate || null,          // 好评率(百分数字符串)
    salesYear: e.sales_year || null,        // 年销量档
    sellingPoints: e.selling_points || '',  // "A|B|C"
  };
}

async function main() {
  console.log(`metasearch: ${METASEARCH_BIN}`);
  const catalog = {};
  const errors = [];

  for (const c of CATEGORIES) {
    process.stdout.write(`  搜「${c.query}」(${c.key}) … `);
    try {
      const raw = await search(c.query);
      // 优先自营,再按好评率降序,取前 N
      const items = raw
        .map(normalize)
        .filter(x => x.id && x.image && x.url)
        .sort((a, b) => (b.isSelf - a.isSelf) || (Number(b.goodRate || 0) - Number(a.goodRate || 0)))
        .slice(0, PER_CATEGORY);
      catalog[c.key] = { label: c.label, query: c.query, items };
      console.log(`${items.length} 条`);
    } catch (err) {
      console.log(`失败:${err.message}`);
      errors.push({ key: c.key, message: err.message });
      catalog[c.key] = { label: c.label, query: c.query, items: [] };
    }
  }

  const total = Object.values(catalog).reduce((s, c) => s + c.items.length, 0);
  if (total === 0) {
    console.error('\n✗ 一条商品都没拉到 —— 不覆盖现有 products.json。检查 metasearch 是否可用、内网是否可达。');
    process.exit(1);
  }

  const payload = {
    generatedBy: 'refresh-products.mjs',
    note: '真实京东商品,由 o2 metasearch 拉取。请求路径只读本文件,不实时调 metasearch。',
    categories: catalog,
  };
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`\n✓ 写入 ${OUT} · 共 ${total} 条商品` + (errors.length ? ` · ${errors.length} 个品类失败` : ''));
}

main().catch(e => { console.error('刷新失败:', e.message); process.exit(1); });
