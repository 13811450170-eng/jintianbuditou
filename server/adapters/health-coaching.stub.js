// health-coaching.stub.js · 颈肩练习指导 adapter 骨架
// ------------------------------------------------------------
// 对应 skill: skills/health-coaching/SKILL.md
// 现有 stub.js 的 recommend() 已做"问诊 → 关卡 + 灵敏度 + Joy 点评";本文件是它的规则超集骨架:
// 在 recommend 之上叠加 flow 门禁、基线 downscale 与当日 plan 生成。不覆盖 stub.js,先留接口。

const NECK_MOVES = ['flexion', 'extension', 'lateralL', 'lateralR', 'rotationL', 'rotationR'];  // protrusion/retraction 暂未匹配玩法
const SHOULDER_MOVES = ['flexionL', 'flexionR', 'scapularRetraction'];
const SAFETY_CUES = ['慢而稳', '回中立位再做下一次', '无痛范围内', '不甩头', '不加压'];

// 按 flow 决定开放哪些部位的动作,并剔除 stop 方向、降级 limited
function openMoves(flow, baseline = {}) {
  const pick = (keys, part) => keys
    .filter(k => baseline[part] && baseline[part][k] && baseline[part][k].status !== 'stop')
    .map(k => {
      const s = baseline[part][k];
      const cap = s.effectiveRom ?? 0;
      // limited 方向进一步下调目标(这里取 80% 占位,TODO: 换成临床阈值曲线)
      const targetRom = s.status === 'limited' ? Math.round(cap * 0.8) : cap;
      return { axis: k, targetRom, safetyCap: cap, cues: SAFETY_CUES.slice(0, 3) };
    });

  if (flow === 'both') return [...pick(NECK_MOVES, 'neck'), ...pick(SHOULDER_MOVES, 'shoulder')];
  if (flow === 'neckOnly') return pick(NECK_MOVES, 'neck');
  if (flow === 'shoulderOnly') return pick(SHOULDER_MOVES, 'shoulder');
  return [];  // none
}

// 沿用现有 stub.recommend 的问诊 → 关卡映射
function pickLevel({ feel, goal } = {}) {
  if (feel === '酸胀') return { level: 'walk', sensitivity: 35, tone: 'gentle', reason: '脖子有点酸的话,先跟我散散步、轻轻活动开,别急着发力。' };
  if (goal === '认真练一组') return { level: 'boxing', sensitivity: 55, tone: 'cheer', reason: '想好好练一组?那来打一场,跟着节拍闪避出击,出出汗!' };
  if (feel === '发紧') return { level: 'lunch', sensitivity: 50, tone: 'cheer', reason: '发紧就多做些大方向的转头,来喂喂饿了的伙伴,把僵住的地方舒展开。' };
  return { level: 'walk', sensitivity: 50, tone: 'cheer', reason: '那我们轻松散个步吧,边走边活动,舒舒服服的~' };
}

export const healthCoachingStub = {
  // 输入为 health-assessment 的输出 + 问诊 answers
  async recommend({ flow = 'both', baseline = {}, pain = {}, answers = {} } = {}) {
    if (flow === 'none') {
      return { level: null, reason: '这次先不做动作游戏,建议线下评估后再来~', suggestSensitivity: null, tone: 'gentle', plan: [], breaks: '' };
    }
    const base = pickLevel(answers);
    // 高疼痛再压一档灵敏度(省力)
    const sensitivity = (pain.level ?? 0) >= 6 ? Math.min(base.sensitivity, 35) : base.sensitivity;

    return {
      level: base.level,
      reason: base.reason,
      suggestSensitivity: sensitivity,
      tone: (pain.level ?? 0) >= 6 ? 'gentle' : base.tone,
      plan: openMoves(flow, baseline),
      // 组合而非单点:动作 + 规律间歇/工位提醒(CUH NHS + 指南2010:久坐约每小时改变体位)
      breaks: '每练两三组歇一会;久坐的话约每小时起身活动、改变体位。',
    };
  },
};
