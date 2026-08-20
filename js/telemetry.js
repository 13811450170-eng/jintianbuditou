// ============================================================
// telemetry.js · 试点埋点(ES module)
// ------------------------------------------------------------
// 给复赛试点收留存/游玩数据用。极简:一个匿名 uid + 一个 track() 上报。
//
// 隐私红线(延续 health-store):只上报 {uid, event, 数值/枚举字段},
// 绝不上报任何画面、摄像头帧、原始视频。uid 是本地生成的随机匿名串,
// 不含任何个人身份信息,仅用于把同一浏览器的多次游玩串成留存曲线。
//
// 上报走 POST /api/track,后端 appendFile 落到 server/data/pilot-events.jsonl。
// 失败静默(埋点绝不能影响游戏体验)。
// ============================================================

const UID_KEY = 'pilot_uid_v1';

// 匿名 uid:首次生成并存 localStorage,之后复用。格式 u_<时间基><随机>,无个人信息。
export function getUid() {
  try {
    let uid = localStorage.getItem(UID_KEY);
    if (!uid) {
      const rand = Math.random().toString(36).slice(2, 10);
      uid = `u_${Date.now().toString(36)}${rand}`;
      localStorage.setItem(UID_KEY, uid);
    }
    return uid;
  } catch {
    return 'u_nostorage';   // 隐私模式禁用 storage 时兜底,仍可上报(只是不稳定复用)
  }
}

// 上报一个事件。event 如 'app_open' / 'level_start' / 'level_finish' / 'feel'。
// data 为数值/枚举字段对象(如 {level:'boxing', dodges:8, combo:5, durationMs:40000})。
// 优先 sendBeacon(页面关闭也能发出),不可用则 fetch keepalive。永不抛错。
export function track(event, data = null) {
  const payload = JSON.stringify({ uid: getUid(), event, data });
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      if (navigator.sendBeacon('/api/track', blob)) return;
    }
  } catch {}
  // 兜底:fetch keepalive(允许在卸载时仍完成请求)
  try {
    fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
  } catch {}
}
