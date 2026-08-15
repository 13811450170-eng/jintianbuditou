// jd-gateway.js · 京东内网 DeepSeek 网关 adapter(OpenAI 兼容)
// ------------------------------------------------------------
// 网关调用方式(2026-08-15 确认):
//   POST http://llm-gw.jd.local/v1/chat/completions
//   Authorization: Bearer <key>   body: { model, messages, stream }
//   model = DeepSeek-V4-Flash
// 标准 OpenAI 兼容形状,与本 adapter 原占位一致。
//
// key/url/model 全走环境变量(server/.env,被 .gitignore 排除,绝不进 git)。
// 内网域名本地连不上属正常 —— 调用失败抛错,由 provider 层降级到 stub。

const GATEWAY_URL = process.env.JD_LLM_GATEWAY_URL || '';
const GATEWAY_KEY = process.env.JD_LLM_GATEWAY_KEY || '';
const MODEL = process.env.JD_LLM_MODEL || '';
const TIMEOUT_MS = Number(process.env.JD_LLM_TIMEOUT_MS || 12000);

export function isConfigured() {
  return !!(GATEWAY_URL && GATEWAY_KEY && MODEL);
}

function assertConfigured() {
  if (!isConfigured()) {
    const e = new Error('DeepSeek 网关未配置(缺 JD_LLM_GATEWAY_URL/KEY/MODEL)。用 LLM_PROVIDER=stub 本地跑。');
    e.code = 'PROVIDER_NOT_CONFIGURED';
    throw e;
  }
}

// 单一收发点。非流式,超时用 AbortController。
async function chat(messages) {
  assertConfigured();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GATEWAY_KEY}` },
      body: JSON.stringify({ model: MODEL, messages, stream: false }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`DeepSeek 网关 HTTP ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timer);
  }
}

// 容错解析:模型可能返回 ```json 包裹或前后有解释文字,提取第一个 JSON 块。
function parseJSON(txt) {
  if (!txt) throw new Error('模型返回空');
  const fenced = txt.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : txt;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(body.slice(start, end + 1));
  return JSON.parse(body);
}

async function chatJSON(sys, user) {
  const txt = await chat([
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ]);
  return parseJSON(txt);
}

const SYS_INTRO = '你是京东 IP 小狗 Joy,陪用户做颈椎康复。用轻松、略毒舌但暖心的口吻开局问 1-2 个引导问题。严格只输出 JSON:{greeting, questions:[{id,q,options:[]}], suggestSensitivity}。';
const SYS_ANALYZE = '你是颈椎康复教练 Joy。根据用户本次逐轴动作数据(转头/抬头低头/侧屈的次数、峰值角度、保持时长、甩头次数)给鼓励+纠正。奖励慢而稳,甩头要纠正。严格只输出 JSON:{headline, insights:[{axis,level,text}], advice, tone}。level∈{good,warn,todo}。';
const SYS_RECOMMEND = '你是 Joy。根据问诊回答推荐一个关卡。可选:walk(散步轻柔)/boxing(拳击高强度)/lunch(喂饭定向大幅)/fireworks(烟花慢速精确)。酸胀→walk且灵敏度低;认真练→boxing。严格只输出 JSON:{level,reason,suggestSensitivity,tone}。';
const SYS_SCREEN = '你是颈肩健康评估助手。根据红旗问卷、疼痛、颈部各向ROM判定能否练习。红旗命中任一→gate=refer不进游戏。严格只输出 JSON:{gate,flow,baseline,pain,referReasons,tone}。gate∈{pass,refer},flow∈{both,neckOnly,shoulderOnly,none}。不诊断,refer只提示线下评估。';
const SYS_COACH = '你是颈肩练习指导教练。根据评估分流flow+基线baseline+问诊answers给今天的低负荷方案。不做绕圈/甩头/极限。严格只输出 JSON:{level,reason,suggestSensitivity,tone,plan:[{axis,targetRom,safetyCap,cues:[]}],breaks}。';
const SYS_PROFILE = '你是颈肩健康画像分析师 Joy。根据用户健康档案(各部位活动度评级、训练历史、评估结论、趋势)给整体画像:指出薄弱维度、变化趋势、下一步建议。不诊断、不宣称治疗。严格只输出 JSON:{headline, insights:[{dimension,level,text}], advice, tone}。level∈{good,warn,todo}。';

export const jdGatewayAdapter = {
  async intro({ profile } = {}) {
    return chatJSON(SYS_INTRO, `用户画像:${JSON.stringify(profile || {})}`);
  },
  async analyze({ session } = {}) {
    return chatJSON(SYS_ANALYZE, `本次逐轴数据:${JSON.stringify(session || {})}`);
  },
  async recommend({ answers } = {}) {
    return chatJSON(SYS_RECOMMEND, `问诊回答:${JSON.stringify(answers || {})}`);
  },
  async screen(input = {}) {
    return chatJSON(SYS_SCREEN, `评估输入:${JSON.stringify(input)}`);
  },
  async coach(input = {}) {
    return chatJSON(SYS_COACH, `评估结论+问诊:${JSON.stringify(input)}`);
  },
  async analyzeProfile({ profile } = {}) {
    return chatJSON(SYS_PROFILE, `健康档案:${JSON.stringify(profile || {})}`);
  },
};
