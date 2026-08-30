import { postJSONSafe } from '../services/api.js';
import { element } from '../core/dom.js';
import { createCoachVoice } from '../services/coach-voice.js';

const POLL_MS = 1500;
const PLAN = { exercise: 'squat', totalSets: 3, targetReps: 10, restSeconds: 60 };
const voice = createCoachVoice();

function createCard() {
  const card = element('aside', { className: 'device-coach', attrs: { 'data-online': 'false', 'aria-live': 'polite' } });
  const head = element('div', { className: 'device-coach__head' });
  const dot = element('span', { className: 'device-coach__dot' });
  const title = element('div', { className: 'device-coach__title', text: 'MaixCAM 外置教练' });
  const status = element('div', { className: 'device-coach__status', text: '未连接' });
  const cue = element('div', { className: 'device-coach__cue', text: '设备连接后，Joy 会在这里同步动作反馈。' });
  const meta = element('div', { className: 'device-coach__meta', text: '仅同步关键点指标，不上传视频画面' });
  const startButton = element('button', { className: 'device-coach__start', text: '开始深蹲训练' });
  startButton.type = 'button'; startButton.disabled = true;
  head.append(dot, title, status); card.append(head, cue, meta, startButton); document.body.appendChild(card);
  return { card, status, cue, meta, startButton };
}

function createTrainingPanel() {
  const panel = document.createElement('section'); panel.className = 'coach-training'; panel.hidden = true;
  panel.innerHTML = `<div class="coach-training__sheet" role="dialog" aria-modal="true" aria-label="MaixCoach 深蹲训练">
    <button class="coach-training__close" type="button" aria-label="关闭">×</button>
    <div class="coach-training__eyebrow">MAIXCOACH · 今日训练</div><h2>深蹲基础训练</h2>
    <p class="coach-training__guide">请将相机放在斜前方 2.5–3.5 米处，确保肩、髋、膝和脚踝完整入镜。</p>
    <div class="coach-training__progress">准备连接设备</div><div class="coach-training__count">3 组 × 10 次</div>
    <div class="coach-training__cue">连接耳机后，点击准备就绪。</div>
    <div class="coach-training__actions"><button class="coach-training__primary" type="button">准备就绪，开始训练</button>
    <button class="coach-training__secondary" type="button">暂停</button><button class="coach-training__stop" type="button">结束训练</button></div></div>`;
  document.body.appendChild(panel);
  return { panel, close: panel.querySelector('.coach-training__close'), progress: panel.querySelector('.coach-training__progress'),
    count: panel.querySelector('.coach-training__count'), cue: panel.querySelector('.coach-training__cue'),
    primary: panel.querySelector('.coach-training__primary'), pause: panel.querySelector('.coach-training__secondary'), stop: panel.querySelector('.coach-training__stop') };
}

function command(deviceId, type, payload = {}) { return postJSONSafe('/api/device/command', { deviceId, type, payload }, { timeout: 2500 }); }

function render(ui, snapshot, state) {
  const device = snapshot?.devices?.find(d => d.status === 'online') || snapshot?.devices?.[0];
  const online = device?.status === 'online'; state.device = device || null;
  ui.card.dataset.online = online ? 'true' : 'false'; ui.status.textContent = online ? '在线' : device ? '离线' : '未连接'; ui.startButton.disabled = !online;
  if (!device) return;
  const event = snapshot.latestEvent?.deviceId === device.deviceId ? snapshot.latestEvent : null;
  const session = snapshot.latestSession?.deviceId === device.deviceId ? snapshot.latestSession : null;
  ui.cue.textContent = event?.cue || (online ? '设备已就绪，可以开始今天的训练。' : '设备最近离线，可检查网络。');
  const reps = event?.metrics?.validReps ?? session?.metrics?.validReps;
  ui.meta.textContent = [device.name || device.deviceId, event?.exercise || session?.exercise, reps != null ? `${reps} 次有效动作` : null].filter(Boolean).join(' · ');
  if (event && event.id !== state.lastEventId) { state.lastEventId = event.id; handleEvent(event, state); }
}

function handleEvent(event, state) {
  if (!state.running) return;
  state.panel.cue.textContent = event.cue || '';
  const speech = {
    GOOD_REP: { key: 'good_rep', priority: 'low', cooldown: 900, pitch: 1.08 },
    TOO_SHALLOW: { key: 'form_warning', priority: 'normal', cooldown: 5000, rate: 0.98 },
    BODY_NOT_VISIBLE: { key: 'visibility', priority: 'urgent', cooldown: 7000, rate: 0.96 },
    PERSON_MISSING: { key: 'visibility', priority: 'urgent', cooldown: 7000, rate: 0.96 },
    SET_COMPLETE: { key: 'set_complete', priority: 'urgent', cooldown: 0 },
  }[event.type];
  if (speech) voice.speak(event.cue, speech);
  const reps = event.metrics?.setValidReps;
  if (reps != null) state.panel.count.textContent = `第 ${state.currentSet}/${PLAN.totalSets} 组 · ${reps}/${PLAN.targetReps} 次`;
  if (event.type === 'SET_COMPLETE') beginRest(state);
}

function beginRest(state) {
  state.running = false; let remaining = PLAN.restSeconds;
  state.panel.progress.textContent = `第 ${state.currentSet} 组完成`;
  voice.speak(`第 ${state.currentSet} 组完成。做得不错，休息 ${remaining} 秒。放松呼吸。`, { key: 'rest', priority: 'urgent' });
  clearInterval(state.restTimer); state.restTimer = setInterval(async () => {
    remaining -= 1; state.panel.count.textContent = `休息 ${remaining} 秒`;
    if (remaining > 0) return;
    clearInterval(state.restTimer);
    if (state.currentSet >= PLAN.totalSets) return finishTraining(state);
    state.currentSet += 1; state.running = true; state.panel.progress.textContent = `第 ${state.currentSet}/${PLAN.totalSets} 组`; state.panel.count.textContent = `0/${PLAN.targetReps} 次`;
    await command(state.device.deviceId, 'START_SET', { ...PLAN, set: state.currentSet, sessionId: state.sessionId });
    voice.speak(`休息结束。第 ${state.currentSet} 组，准备。三，二，一，开始。`, { key: 'countdown', priority: 'urgent', rate: 0.96 });
  }, 1000);
}

async function finishTraining(state) {
  state.running = false; clearInterval(state.restTimer);
  if (state.device) await command(state.device.deviceId, 'STOP', { sessionId: state.sessionId });
  state.panel.progress.textContent = '训练完成'; state.panel.count.textContent = '3 组训练已完成';
  state.panel.cue.textContent = '做得很好，正在生成本次训练总结。'; state.panel.primary.disabled = true;
  voice.speak('今天的训练完成了。做得很好，慢慢放松呼吸。', { key: 'finished', priority: 'urgent', rate: 0.96 });
}

function wireTraining(ui, panel, state) {
  state.panel = panel;
  ui.startButton.addEventListener('click', () => { panel.panel.hidden = false; panel.progress.textContent = state.device?.status === 'online' ? '设备在线 · 等待开始' : '设备未连接'; panel.primary.disabled = state.device?.status !== 'online'; });
  panel.close.addEventListener('click', () => { panel.panel.hidden = true; });
  panel.primary.addEventListener('click', async () => {
    if (!state.device || state.running) return;
    state.sessionId = `web-${Date.now()}`; state.currentSet = 1; state.running = true; state.paused = false;
    panel.progress.textContent = '第 1/3 组'; panel.count.textContent = '0/10 次'; panel.cue.textContent = '准备就绪，三、二、一，开始。'; panel.primary.disabled = true;
    await command(state.device.deviceId, 'START_SESSION', { ...PLAN, sessionId: state.sessionId });
    await command(state.device.deviceId, 'START_SET', { ...PLAN, set: 1, sessionId: state.sessionId });
    voice.speak('设备准备好了。第一组深蹲，准备。三，二，一，开始。', { key: 'countdown', priority: 'urgent', rate: 0.96 });
  });
  panel.pause.addEventListener('click', async () => {
    if (!state.device || !state.running) return;
    state.paused = !state.paused; await command(state.device.deviceId, state.paused ? 'PAUSE' : 'RESUME', { sessionId: state.sessionId });
    panel.pause.textContent = state.paused ? '继续' : '暂停';
    voice.speak(state.paused ? '训练已暂停。' : '继续训练。', { key: 'status', priority: 'urgent' });
  });
  panel.stop.addEventListener('click', () => finishTraining(state));
}

async function start() {
  const ui = createCard(); const panel = createTrainingPanel();
  const state = { device: null, lastEventId: null, running: false, paused: false, currentSet: 0, restTimer: null }; wireTraining(ui, panel, state);
  let stopped = false;
  async function poll() { const data = await postJSONSafe('/api/device/status', {}, { timeout: 2500 }); if (!data.degraded) render(ui, data, state); if (!stopped) setTimeout(poll, POLL_MS); }
  document.addEventListener('visibilitychange', () => { stopped = document.hidden; if (!stopped) poll(); }); poll();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
