// provider.js · LLM provider 适配器接口 + 选择器 + 自动降级
// ------------------------------------------------------------
// 后端把"调 LLM"隔离在 adapter 后面。切 provider 只改这里,业务代码不动。
//
// 能力(6 个方法): intro / analyze / recommend / screen / coach / analyzeProfile
//   - intro/analyze/recommend: 现有闭环(开局引导/结果分析/关卡推荐)
//   - screen: 健康评估(红旗+ROM四态分流)   来自 health-assessment
//   - coach:  练习指导(分流→当日方案)       来自 health-coaching
//   - analyzeProfile: 档案健康画像分析
//
// 降级铁律:provider=jd-gateway 时,任一方法调用失败(内网连不上/超时/解析错)
//   → 自动回退到对应的 stub 实现。所以本地连不上内网也能演示,生产内网可用则走 DeepSeek。

import { stubAdapter } from './stub.js';
import { jdGatewayAdapter } from './jd-gateway.js';
import { healthAssessmentStub } from './health-assessment.stub.js';
import { healthCoachingStub } from './health-coaching.stub.js';

// 档案画像的 stub(规则化)。两种输入都支持:
//   ① basics(录入即时画像):年龄/BMI/久坐/屏幕/职业/主诉/病史 → 生成"第一印象"
//   ② zones(训练后档案画像):各部位 rating
// DeepSeek 版由 jd-gateway.analyzeProfile 出。
function profileStub({ profile } = {}) {
  const p = profile || {};
  const insights = [];

  // —— ① 基于录入的基础资料出"第一印象" ——
  const b = p.basics || null;
  if (b) {
    const COMPLAINT_CN = { neck: '颈椎', shoulder: '肩颈', eye: '眼部' };
    if (b.sitHoursPerDay >= 8) {
      insights.push({ dimension: 'sit', level: 'warn', text: `每天久坐约 ${b.sitHoursPerDay} 小时,颈肩长期处在静态负荷下,最容易僵和酸。` });
    } else if (b.sitHoursPerDay >= 5) {
      insights.push({ dimension: 'sit', level: 'warn', text: `每天坐着约 ${b.sitHoursPerDay} 小时,记得每小时起来动一动。` });
    } else if (b.sitHoursPerDay != null) {
      insights.push({ dimension: 'sit', level: 'good', text: `久坐时间控制得不错(约 ${b.sitHoursPerDay} 小时),继续保持~` });
    }
    if (b.screenHoursPerDay >= 8) {
      insights.push({ dimension: 'eye', level: 'warn', text: `每天看屏幕约 ${b.screenHoursPerDay} 小时,眼睛和颈椎都在超负荷,试试 20-20-20 法则。` });
    }
    if (b.bmi != null) {
      if (b.bmi >= 28) insights.push({ dimension: 'bmi', level: 'warn', text: `BMI ${b.bmi} 偏高,体重会加重颈肩腰的日常负担。` });
      else if (b.bmi >= 24) insights.push({ dimension: 'bmi', level: 'todo', text: `BMI ${b.bmi} 略偏重,规律活动对颈肩和整体都有帮助。` });
      else if (b.bmi < 18.5) insights.push({ dimension: 'bmi', level: 'todo', text: `BMI ${b.bmi} 偏低,注意营养和核心力量,支撑颈椎更省力。` });
      else insights.push({ dimension: 'bmi', level: 'good', text: `BMI ${b.bmi} 在正常区间,身体基础不错。` });
    }
    if (Array.isArray(b.history) && b.history.length) {
      insights.push({ dimension: 'history', level: 'todo', text: `你提到有${b.history.join('、')},Joy 会把训练难度调低、动作放缓,量力而行。` });
    }
    if (b.chiefComplaint && COMPLAINT_CN[b.chiefComplaint]) {
      insights.push({ dimension: b.chiefComplaint, level: 'warn', text: `你最想缓解${COMPLAINT_CN[b.chiefComplaint]},Joy 会优先安排这个部位的关卡。` });
    }
    // 职业+年龄组合的一句人格化开场
    const who = [b.age ? `${b.age} 岁` : '', b.occupation || ''].filter(Boolean).join('的');
    const headline = who ? `${who},Joy 已经大概懂你了` : 'Joy 已经大概懂你了';
    return {
      headline,
      insights: insights.slice(0, 4),
      advice: '这些只是初步判断,待会儿实测你的活动度会更准。别担心,Joy 陪你慢慢来~',
      tone: insights.some(i => i.level === 'warn') ? 'gentle' : 'cheer',
    };
  }

  // —— ② 基于训练后档案的部位评级(原逻辑) ——
  const zones = p.zones || {};
  for (const [dim, z] of Object.entries(zones)) {
    if (!z || z.rating == null) continue;
    const level = z.rating >= 70 ? 'good' : z.rating >= 45 ? 'warn' : 'todo';
    const label = { neck: '颈部', shoulder: '肩部', eye: '眼部' }[dim] || dim;
    insights.push({ dimension: dim, level,
      text: `${label}活动度 ${z.rating} 分${level === 'good' ? ',状态不错,保持~' : level === 'warn' ? ',偏紧,多留意这个方向。' : ',比较受限,建议多练或线下看看。'}` });
  }
  const sessions = p.totalSessions ?? 0;
  return {
    headline: sessions > 0 ? `已练 ${sessions} 次,来看看你的身体画像` : '还没有足够数据,先练几次吧',
    insights,
    advice: '每天两三组、慢而稳,比一次练很多更有用。坚持记录,Joy 帮你看长期变化~',
    tone: insights.some(i => i.level === 'todo') ? 'gentle' : 'cheer',
  };
}

// 完整 stub 能力集:6 方法齐全,作为降级兜底与本地默认。
const STUB = {
  intro:  (a) => stubAdapter.intro(a),
  analyze:(a) => stubAdapter.analyze(a),
  recommend:(a) => stubAdapter.recommend(a),
  screen: (a) => healthAssessmentStub.screen(a),
  coach:  (a) => healthCoachingStub.recommend(a),      // coaching 的入口叫 recommend
  analyzeProfile: (a) => profileStub(a),
  intake: (a) => stubAdapter.intake(a),
};

const METHODS = ['intro', 'analyze', 'recommend', 'screen', 'coach', 'analyzeProfile', 'intake'];

// 给 jd-gateway 包一层降级:调用失败自动回退 STUB 对应方法。
function withFallback(primary, name) {
  const wrapped = { name };
  for (const m of METHODS) {
    wrapped[m] = async (arg) => {
      if (typeof primary[m] === 'function') {
        try { return await primary[m](arg); }
        catch (e) {
          console.warn(`[provider:${name}] ${m}() 失败,降级 stub:`, e.code || e.message);
        }
      }
      return STUB[m](arg);   // 主 adapter 无此方法 或 调用失败 → stub
    };
  }
  return wrapped;
}

export function getProvider() {
  const name = process.env.LLM_PROVIDER || 'stub';
  if (name === 'jd-gateway') return withFallback(jdGatewayAdapter, 'jd-gateway');
  if (name === 'stub') return { name: 'stub', ...STUB };
  console.warn(`[provider] 未知 LLM_PROVIDER="${name}",回退 stub`);
  return { name: 'stub', ...STUB };
}
