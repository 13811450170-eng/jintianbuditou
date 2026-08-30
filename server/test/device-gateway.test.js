import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

import { createDeviceGateway } from '../device/gateway.js';
import { deviceStore } from '../device/store.js';

async function withGateway(fn) {
  deviceStore.reset();
  const server = createDeviceGateway({ token: 'test-device-token', store: deviceStore });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  try { await fn(`http://127.0.0.1:${port}`); }
  finally { server.close(); await once(server, 'close'); }
}

function send(base, path, body, token = 'test-device-token') {
  return fetch(base + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Device-Token': token },
    body: JSON.stringify(body),
  });
}

test('device gateway rejects an invalid token', async () => {
  await withGateway(async base => {
    const res = await send(base, '/device/v1/register', { deviceId: 'cam-1' }, 'wrong');
    assert.equal(res.status, 401);
  });
});

test('device event is normalized and appears in app snapshot', async () => {
  await withGateway(async base => {
    const res = await send(base, '/device/v1/events', {
      deviceId: 'cam-1', name: 'Desk Coach', type: 'GOOD_REP', exercise: 'squat',
      cue: '很好，第 1 个', severity: 'good', metrics: { reps: 1, invalid: 'drop-me' },
    });
    assert.equal(res.status, 200);
    const snapshot = deviceStore.snapshot();
    assert.equal(snapshot.devices[0].status, 'online');
    assert.equal(snapshot.latestEvent.type, 'GOOD_REP');
    assert.deepEqual(snapshot.latestEvent.metrics, { reps: 1 });
  });
});

test('session summaries keep structured metrics without frames', async () => {
  await withGateway(async base => {
    const res = await send(base, '/device/v1/sessions', {
      deviceId: 'cam-1', sessionId: 's-1', exercise: 'squat', durationMs: 12000,
      metrics: { reps: 5, validReps: 4 }, events: [{ type: 'TOO_SHALLOW', count: 1 }],
    });
    assert.equal(res.status, 200);
    const session = deviceStore.snapshot().latestSession;
    assert.equal(session.metrics.validReps, 4);
    assert.equal('frame' in session, false);
  });
});

test('web command is delivered once to the requested device', async () => {
  await withGateway(async base => {
    await send(base, '/device/v1/register', { deviceId: 'cam-1', name: 'Coach' });
    const queued = deviceStore.enqueueCommand({
      deviceId: 'cam-1', type: 'START_SET', payload: { set: 1, totalSets: 3, targetReps: 10 },
    });
    assert.equal(queued.type, 'START_SET');
    const first = await (await send(base, '/device/v1/commands/poll', { deviceId: 'cam-1' })).json();
    const second = await (await send(base, '/device/v1/commands/poll', { deviceId: 'cam-1' })).json();
    assert.equal(first.command.payload.targetReps, 10);
    assert.equal(second.command, null);
  });
});
