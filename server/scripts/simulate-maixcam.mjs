const host = process.env.DEVICE_GATEWAY_URL || 'http://127.0.0.1:3180';
const token = process.env.DEVICE_TOKEN || 'dev-maixcam-token-change-me';
const device = {
  deviceId: 'maixcam-simulator-01', name: 'Joy MaixCAM 模拟器', model: 'MaixCAM Simulator',
  firmware: 'sim-1', capabilities: ['pose17', 'squat', 'realtime_feedback'],
};

async function post(path, body) {
  const res = await fetch(host + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Device-Token': token },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} HTTP ${res.status}`);
  return res.json();
}

const sessionId = `sim-${Date.now()}`;
await post('/device/v1/register', device);
await post('/device/v1/heartbeat', device);

const cues = [
  ['READY', '站位很好，准备开始', 'info'],
  ['GOOD_REP', '很好，第 1 个', 'good'],
  ['TOO_SHALLOW', '这次稍浅，下一个再蹲深一点', 'warning'],
  ['GOOD_REP', '漂亮，第 2 个', 'good'],
];
for (let i = 0; i < cues.length; i++) {
  const [type, cue, severity] = cues[i];
  await post('/device/v1/events', {
    ...device, sessionId, exercise: 'squat', type, cue, severity,
    metrics: { reps: i, validReps: Math.max(0, i - 1), kneeAngle: 100 + i * 4 },
    quality: { keypointConfidence: 0.86 },
  });
  await new Promise(resolve => setTimeout(resolve, 500));
}

await post('/device/v1/sessions', {
  ...device, sessionId, exercise: 'squat', startedAt: Date.now() - 10000,
  endedAt: Date.now(), durationMs: 10000,
  metrics: { reps: 3, validReps: 2, depthScore: 82, stabilityScore: 88 },
  quality: { keypointConfidence: 0.86 }, events: [{ type: 'TOO_SHALLOW', count: 1 }],
});
console.log(`MaixCAM simulation complete: ${sessionId}`);
