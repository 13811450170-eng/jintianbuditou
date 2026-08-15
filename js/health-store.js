// ============================================================
// health-store.js · 统一健康数据存档(ES module)
// ------------------------------------------------------------
// 把两个来源的真实数据汇总成一份健康档案,供档案页(mock-body-profile)读取与 AI 画像分析:
//   ① 评估闸门产出:颈部6向ROM、flow、baseline、红旗结果(assessment.js 写)
//   ② 关卡埋点产出:逐轴表现 byAxis、甩头数、时长(mock-walk 等关卡结算写)
//
// 存 localStorage['health_profile_v1']。隐私红线:只存角度/计数/评级数值,绝无画面。
// 无数据的部位(肩/眼)保持 null,档案页显示"待采集"。
// ============================================================

const KEY = 'health_profile_v1';

const DEFAULT_PROFILE = {
  updatedAt: 0,
  totalSessions: 0,
  // 三部位画像。rating 0-100(由 ROM 达标率或关卡表现折算),null=未采集。
  zones: {
    neck:     { rating: null, romNeck: null, flow: null, lastAssessAt: 0 },
    shoulder: { rating: null },   // 待肩部关卡(下一轮)
    eye:      { rating: null },   // 待眼部关卡
  },
  // 最近若干次关卡表现(逐轴),给 AI 看趋势
  recentSessions: [],
};

export function loadProfile() {
  try { return { ...DEFAULT_PROFILE, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; }
  catch { return { ...DEFAULT_PROFILE }; }
}

function save(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
}

// 颈部ROM达标率 → rating(0-100)。目标角与后端 NECK_TARGET_ROM 对齐。
const NECK_TARGET = { flexion: 40, extension: 30, lateralL: 35, lateralR: 35, rotationL: 60, rotationR: 60 };
function neckRatingFromRom(romNeck) {
  if (!romNeck) return null;
  const ratios = [];
  for (const [k, target] of Object.entries(NECK_TARGET)) {
    const v = romNeck[k] && romNeck[k].value;
    if (v != null) ratios.push(Math.min(1, Math.abs(v) / target));
  }
  if (!ratios.length) return null;
  return Math.round((ratios.reduce((s, r) => s + r, 0) / ratios.length) * 100);
}

// 评估结束写入(assessment.js 调用)
export function recordAssessment({ flow, baseline, romNeck, ts } = {}) {
  const p = loadProfile();
  p.zones.neck.romNeck = romNeck || p.zones.neck.romNeck;
  p.zones.neck.flow = flow ?? p.zones.neck.flow;
  p.zones.neck.rating = neckRatingFromRom(romNeck) ?? p.zones.neck.rating;
  p.zones.neck.lastAssessAt = ts || 0;
  p.updatedAt = ts || 0;
  save(p);
  return p;
}

// 关卡结算写入(mock-walk 等关卡调用,传 lastRun.session 摘要)
export function recordSession({ level, byAxis, flingCount, durationMs, ts } = {}) {
  const p = loadProfile();
  p.totalSessions += 1;
  p.recentSessions.unshift({ level, byAxis, flingCount, durationMs, ts });
  p.recentSessions = p.recentSessions.slice(0, 10);   // 只留最近 10 次
  p.updatedAt = ts || 0;
  save(p);
  return p;
}
