// server/scripts/pilot-report.mjs · 试点数据聚合(零依赖)
// ------------------------------------------------------------
// 读 server/data/pilot-events.jsonl,算出答辩要用的几个数:
//   参与人数、总局数、人均局数、次日留存、5日留存、按日活跃、各关卡分布。
// 用法:node server/scripts/pilot-report.mjs
//   可选:PILOT_START=2026-08-24 node ... 指定试点第0天,留存按天差对齐。
// 隐私:只处理匿名 uid 和数值,不含任何身份信息。

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FILE = join(__dirname, '..', 'data', 'pilot-events.jsonl');

if (!existsSync(FILE)) {
  console.log('还没有埋点数据文件:', FILE);
  console.log('先起后端(node server/index.js)并让参与者玩几局,数据会自动落到这里。');
  process.exit(0);
}

// —— 读取 + 解析(容错:坏行跳过) ——
const events = [];
for (const line of readFileSync(FILE, 'utf8').split('\n')) {
  const s = line.trim();
  if (!s) continue;
  try { events.push(JSON.parse(s)); } catch {}
}
if (!events.length) { console.log('数据文件为空。'); process.exit(0); }

// —— 按 uid 归拢 ——
const byUid = new Map();
for (const e of events) {
  if (!byUid.has(e.uid)) byUid.set(e.uid, { opens: new Set(), finishes: [], days: new Set() });
  const u = byUid.get(e.uid);
  if (e.date) u.days.add(e.date);
  if (e.event === 'app_open') u.opens.add(e.date);
  if (e.event === 'level_finish') u.finishes.push(e);
}

const uids = [...byUid.keys()];
const totalUsers = uids.length;
const totalFinishes = events.filter(e => e.event === 'level_finish').length;
const avgFinishes = totalUsers ? (totalFinishes / totalUsers) : 0;

// —— 留存:每个 uid 的首次活跃日为其第0天,看第+1天/第+4天(=5日留存的第5天)是否还有活跃 ——
function dayDiff(a, b) {   // 'YYYY-MM-DD' 差天数
  return Math.round((new Date(a) - new Date(b)) / 86400000);
}
let d1 = 0, d5 = 0, multiDay = 0;
for (const u of byUid.values()) {
  const days = [...u.days].sort();
  if (!days.length) continue;
  const first = days[0];
  const diffs = new Set(days.map(d => dayDiff(d, first)));
  if (diffs.has(1)) d1++;             // 次日留存
  if (diffs.has(4)) d5++;             // 第5天(第0天起+4)留存
  if (days.length >= 2) multiDay++;   // 多日活跃(宽口径留存)
}

// —— 按日活跃 ——
const dayActive = new Map();
for (const e of events) {
  if (!e.date) continue;
  if (!dayActive.has(e.date)) dayActive.set(e.date, new Set());
  dayActive.get(e.date).add(e.uid);
}

// —— 关卡分布 ——
const levelCount = {};
for (const e of events) {
  if (e.event === 'level_finish' && e.data && e.data.level) {
    levelCount[e.data.level] = (levelCount[e.data.level] || 0) + 1;
  }
}

const pct = (n) => totalUsers ? Math.round(n / totalUsers * 100) : 0;

console.log('\n===== 今天不低头 · 试点数据报告 =====\n');
console.log(`参与人数(唯一 uid): ${totalUsers}`);
console.log(`总完成局数:          ${totalFinishes}`);
console.log(`人均完成局数:        ${avgFinishes.toFixed(1)}`);
console.log('');
console.log(`次日留存:            ${d1}/${totalUsers}  (${pct(d1)}%)`);
console.log(`5日留存(第5天):     ${d5}/${totalUsers}  (${pct(d5)}%)`);
console.log(`多日活跃(≥2天):     ${multiDay}/${totalUsers}  (${pct(multiDay)}%)  ← 宽口径留存`);
console.log('');
console.log('按日活跃人数:');
for (const d of [...dayActive.keys()].sort()) {
  console.log(`  ${d}: ${dayActive.get(d).size} 人`);
}
console.log('');
console.log('各关卡完成分布:');
for (const [lv, n] of Object.entries(levelCount)) console.log(`  ${lv}: ${n} 局`);
console.log('\n答辩话术示例:');
console.log(`  "${totalUsers} 位真实用户试用,人均玩 ${avgFinishes.toFixed(1)} 局,5 日留存 ${pct(d5)}%。"`);
console.log('');
