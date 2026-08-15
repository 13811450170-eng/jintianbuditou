// jd-gateway.js · 京东 LLM 网关 adapter(目标 provider,接口/鉴权待确认)
// ------------------------------------------------------------
// o2 探路结论(2026-08-14):
//   - o2 里没有"一行直调"的通用文本对话 CLI。
//   - 但存在 JD LLM Gateway(gpt-image2 CLI 的生图即走此网关)。
//   - 该网关很可能同时暴露文本 completion,但确切 endpoint + 鉴权方式尚未确认。
//
// 待办(接口确认后只改这一个文件):
//   1. 填 GATEWAY_URL 与鉴权(装 gpt-image2 反推,或查网关内网文档)。
//   2. 在 chat() 里按网关的 request/response 格式收发。
//   3. 把两个方法的 prompt 调好(intro 引导 / analyze 康复点评)。
//
// key/endpoint 全走环境变量,永不硬编码、永不进 git(见 .gitignore)。

const GATEWAY_URL = process.env.JD_LLM_GATEWAY_URL || '';
const GATEWAY_KEY = process.env.JD_LLM_GATEWAY_KEY || '';
const MODEL = process.env.JD_LLM_MODEL || '';

function assertConfigured() {
  if (!GATEWAY_URL || !GATEWAY_KEY) {
    const e = new Error('JD LLM Gateway 未配置(缺 JD_LLM_GATEWAY_URL / JD_LLM_GATEWAY_KEY)。接口确认前请用 LLM_PROVIDER=stub。');
    e.code = 'PROVIDER_NOT_CONFIGURED';
    throw e;
  }
}

// 单一收发点:接口确认后按网关格式实现这一个函数即可
async function chat(messages, { json = false } = {}) {
  assertConfigured();
  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GATEWAY_KEY}` },
    body: JSON.stringify({ model: MODEL, messages, ...(json ? { response_format: { type: 'json_object' } } : {}) }),
  });
  if (!res.ok) throw new Error(`JD LLM Gateway HTTP ${res.status}`);
  const data = await res.json();
  // TODO: 按网关真实响应结构取回复文本
  return data.choices?.[0]?.message?.content ?? '';
}

const SYS_INTRO = '你是京东 IP 小狗 Joy,陪用户做颈椎康复。用轻松、略毒舌但暖心的口吻,开局问 1-2 个引导问题。只输出 JSON。';
const SYS_ANALYZE = '你是颈椎康复教练 Joy。根据用户本次逐轴动作数据(转头/抬头低头/侧屈的次数、峰值角度、保持时长、甩头次数)给出鼓励+纠正。康复原则:奖励慢而稳,甩头是要纠正的。只输出 JSON。';
const SYS_RECOMMEND = '你是京东 IP 小狗 Joy。根据用户问诊回答(脖子感觉、今天目标),推荐一个关卡并给出理由。可选关卡:walk(散步,轻柔)/boxing(拳击,高强度)/lunch(喂饭,定向大幅活动)/fireworks(烟花,慢速精确)。酸胀→推轻柔的 walk 且灵敏度调低;想认真练→boxing。只输出 JSON:{level,reason,suggestSensitivity,tone}。';

export const jdGatewayAdapter = {
  async intro({ profile } = {}) {
    const txt = await chat([
      { role: 'system', content: SYS_INTRO },
      { role: 'user', content: `用户画像:${JSON.stringify(profile || {})}` },
    ], { json: true });
    return JSON.parse(txt);
  },
  async analyze({ session } = {}) {
    const txt = await chat([
      { role: 'system', content: SYS_ANALYZE },
      { role: 'user', content: `本次数据:${JSON.stringify(session || {})}` },
    ], { json: true });
    return JSON.parse(txt);
  },
  async recommend({ answers } = {}) {
    const txt = await chat([
      { role: 'system', content: SYS_RECOMMEND },
      { role: 'user', content: `用户问诊回答:${JSON.stringify(answers || {})}` },
    ], { json: true });
    return JSON.parse(txt);
  },
};
