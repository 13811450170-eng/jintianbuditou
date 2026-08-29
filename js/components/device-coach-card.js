import { postJSONSafe } from '../services/api.js';
import { element } from '../core/dom.js';

const POLL_MS = 2000;

function createCard() {
  const card = element('aside', { className: 'device-coach', attrs: { 'data-online': 'false', 'aria-live': 'polite' } });
  const head = element('div', { className: 'device-coach__head' });
  const dot = element('span', { className: 'device-coach__dot' });
  const title = element('div', { className: 'device-coach__title', text: 'MaixCAM 外置教练' });
  const status = element('div', { className: 'device-coach__status', text: '未连接' });
  const cue = element('div', { className: 'device-coach__cue', text: '设备连接后，Joy 会在这里同步动作反馈。' });
  const meta = element('div', { className: 'device-coach__meta', text: '仅同步关键点指标，不上传视频画面' });
  head.append(dot, title, status); card.append(head, cue, meta); document.body.appendChild(card);
  return { card, status, cue, meta };
}

function render(ui, snapshot) {
  const device = snapshot?.devices?.find(d => d.status === 'online') || snapshot?.devices?.[0];
  const online = device?.status === 'online';
  ui.card.dataset.online = online ? 'true' : 'false';
  ui.status.textContent = online ? '在线' : device ? '离线' : '未连接';
  if (!device) return;

  const event = snapshot.latestEvent?.deviceId === device.deviceId ? snapshot.latestEvent : null;
  const session = snapshot.latestSession?.deviceId === device.deviceId ? snapshot.latestSession : null;
  ui.cue.textContent = event?.cue || (online ? '设备已就绪，等待你开始动作。' : '设备最近离线，可检查 Wi-Fi 或 USB 网络。');
  const reps = session?.metrics?.validReps ?? session?.metrics?.reps;
  ui.meta.textContent = [device.name || device.deviceId, session?.exercise, reps != null ? `${reps} 次有效动作` : null]
    .filter(Boolean).join(' · ') || '仅同步关键点指标，不上传视频画面';
}

async function start() {
  const ui = createCard();
  let stopped = false;
  async function poll() {
    const data = await postJSONSafe('/api/device/status', {}, { timeout: 2500 });
    if (!data.degraded) render(ui, data);
    if (!stopped) setTimeout(poll, POLL_MS);
  }
  document.addEventListener('visibilitychange', () => {
    stopped = document.hidden;
    if (!stopped) poll();
  });
  poll();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
