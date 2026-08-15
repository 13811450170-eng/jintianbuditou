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

// 档案画像的 stub(规则化,基于档案里的部位评级)。DeepSeek 版由 jd-gateway.analyzeProfile 出。
function profileStub({ profile } = {}) {
  const p = profile || {};
  const insights = [];
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
};

const METHODS = ['intro', 'analyze', 'recommend', 'screen', 'coach', 'analyzeProfile'];

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
