// health-assessment.stub.js · 颈肩健康评估 adapter 骨架
// ------------------------------------------------------------
// 对应 skill: skills/health-assessment/SKILL.md
// 现有 stub.js 的 analyze() 已做逐轴点评 + 甩头红线;本文件是它的规则超集骨架:
// 把"红旗硬门槛 + 8 向 ROM 四态分流"补齐到评估侧。不覆盖 stub.js,先留接口。
//
// 接入方式(接口确认后):在 provider.js 的 ADAPTERS 里注册,或把这里的
// screen()/assess() 合并进对应 provider 的 analyze()。
//
// 隐私红线:只接收数值化 session,绝不接收任何画面。

import { stubAdapter } from './stub.js';   // 复用其 analyze() 的逐轴 insights

const RED_FLAG_NECK = ['近期头颈外伤', '进行性剧烈症状', '手脚无力笨拙', '走路不稳', '吞咽或呼吸困难', '大小便功能新变化'];
const RED_FLAG_SHOULDER = ['近期肩部外伤', '肩臂变形或肿胀', '无法正常抬臂', '持续麻木或无力', '发热不适', '胸痛或呼吸困难'];
const NECK_AXES = ['protrusion', 'flexion', 'retraction', 'extension', 'lateralL', 'lateralR', 'rotationL', 'rotationR'];

// 各向 ROM 目标角(度) —— 取解剖极限 ~70-80%,舒展而非极限(医学背书见 SKILL.md 第3节)。
// ⚠️ 需真机校准:摄像头实测 rel 角与真实颈部角有系统偏差,这些是 demo 起点值。
const NECK_TARGET_ROM = {
  flexion: 40, extension: 30, lateralL: 35, lateralR: 35, rotationL: 60, rotationR: 60,
  protrusion: 12, retraction: 12,  // 前突/后缩 FaceLandmarker 难测,颈部这两向暂不采集
};

// 命中任意红旗 → 硬拦截
function hitRedFlag(flags = {}) {
  const vals = Array.isArray(flags) ? flags : Object.values(flags);
  return vals.some(Boolean);
}

// 单方向四态判定:available / limited / remeasure / stop
// target:该向目标角(0=不判幅度);m.value:本次实测峰值角,达标率=value/target。
function axisStatus(m = {}, calibOk = true, target = 0) {
  if (m.discomfort) return 'stop';                       // 该方向不适 → 停
  if (!calibOk || (m.confidence ?? 1) < 0.5) return 'remeasure';  // 追踪不可信 → 重测
  if ((m.compensation && m.compensation.length >= 2)) return 'limited';  // 代偿明显但无痛 → 降级
  if (target > 0 && Math.abs(m.value ?? 0) / target < 0.8) return 'limited';  // 幅度不足 → 降级(下调目标后仍可练)
  return 'available';
}

// §1.5 分流:颈/肩是否各自有可用方向
function classifyFlow(neckOk, shoulderOk) {
  if (neckOk && shoulderOk) return 'both';
  if (neckOk) return 'neckOnly';
  if (shoulderOk) return 'shoulderOnly';
  return 'none';
}

export const healthAssessmentStub = {
  // 练习前筛查 + 基线 → gate / flow / baseline
  async screen({ redFlags = {}, pain = {}, calib = {}, romNeck = {}, baselineShoulder = {} } = {}) {
    if (hitRedFlag(redFlags.neck) || hitRedFlag(redFlags.shoulder)) {
      return { gate: 'refer', flow: 'none', referReasons: ['触发安全门槛,建议线下医疗评估'], tone: 'gentle' };
    }
    const calibOk = !!(calib.shoulderLine && calib.trunkRef && (calib.keypointQuality ?? 0) >= 0.5);

    const neck = {};
    for (const ax of NECK_AXES) {
      if (romNeck[ax]) neck[ax] = { effectiveRom: romNeck[ax].value ?? 0, status: axisStatus(romNeck[ax], calibOk, NECK_TARGET_ROM[ax] || 0) };
    }
    const shoulder = {};
    for (const k of ['flexionL', 'flexionR', 'scapularRetraction']) {
      if (baselineShoulder[k]) shoulder[k] = { status: axisStatus(baselineShoulder[k], calibOk) };
    }

    const neckOk = Object.values(neck).some(v => v.status === 'available' || v.status === 'limited');
    const shoulderOk = Object.values(shoulder).some(v => v.status === 'available' || v.status === 'limited');
    const flow = classifyFlow(neckOk, shoulderOk);

    return {
      gate: flow === 'none' ? 'refer' : 'pass',
      flow,
      baseline: { neck, shoulder },
      pain: { level: pain.level ?? 0, region: pain.region ?? 'none' },
      referReasons: flow === 'none' ? ['未获得可用基线,建议线下评估'] : [],
      tone: (pain.level ?? 0) >= 6 ? 'gentle' : 'cheer',
    };
  },

  // 练后安全闭环:异常信号 → 是否停止/转介。复用现有 stub.analyze 的 insights 结构。
  async assessPost({ session = {}, feedback = {} } = {}) {
    const referSignals = [];
    if (feedback.radiating) referSignals.push('症状向肩/上肢/手指延伸');
    if (feedback.newNumbness) referSignals.push('出现新的麻木区');
    if (feedback.weakness) referSignals.push('明显无力');
    if (feedback.dizziness) referSignals.push('眩晕');
    if (feedback.romDropped) referSignals.push('练后活动度下降');
    if (feedback.painPersist) referSignals.push('疼痛持续加重');

    // 复用 stub.analyze 出本次逐轴点评,再把练后异常信号作为 warn 级 insight 叠加,
    // 保持前端 insights[].level ∈ {good,warn,todo} 契约不变。
    let insights = [];
    let headline = '', advice = '';
    try {
      const a = await stubAdapter.analyze({ session });
      insights = a.insights || [];
      headline = a.headline || '';
      advice = a.advice || '';
    } catch {}
    for (const sig of referSignals) {
      insights.unshift({ axis: 'safety', level: 'warn', text: `⚠️ ${sig} —— 建议停止并做线下评估。` });
    }

    return {
      gate: referSignals.length ? 'refer' : 'pass',
      referReasons: referSignals,
      headline: referSignals.length ? '有几个信号要留意' : headline,
      insights,
      advice,
      tone: referSignals.length ? 'gentle' : 'cheer',
    };
  },
};
