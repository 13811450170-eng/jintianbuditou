// provider.js · LLM provider 适配器接口 + 选择器
// ------------------------------------------------------------
// 后端把"调 LLM"这件事隔离在 adapter 后面。切换 provider 只改这里,
// 上层 /api/intro、/api/analyze 的业务代码不动。
//
// 每个 adapter 实现:
//   async intro({ profile })      -> { questions:[...], greeting } 或 { text }
//   async analyze({ session, ... })-> { headline, insights:[...], advice, tone }
//
// 目标 adapter 是 jd-gateway(京东 LLM 网关,接口/鉴权待确认);
// 在网关接口确认前,用 stub adapter 把整条闭环(埋点→后端→渲染)先跑通。

import { stubAdapter } from './stub.js';
import { jdGatewayAdapter } from './jd-gateway.js';

const ADAPTERS = {
  stub: stubAdapter,
  'jd-gateway': jdGatewayAdapter,
};

// 用环境变量选 provider,默认 stub(本地 demo 零配置即可跑)
export function getProvider() {
  const name = process.env.LLM_PROVIDER || 'stub';
  const adapter = ADAPTERS[name];
  if (!adapter) {
    console.warn(`[provider] 未知 LLM_PROVIDER="${name}",回退到 stub`);
    return { name: 'stub', ...stubAdapter };
  }
  return { name, ...adapter };
}
