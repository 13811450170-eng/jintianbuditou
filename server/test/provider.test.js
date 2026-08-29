import test from 'node:test';
import assert from 'node:assert/strict';

import { configStatus } from '../adapters/jd-gateway.js';
import { getProvider } from '../adapters/provider.js';
import { productsAdapter } from '../adapters/products.js';

const ENV_KEYS = [
  'LLM_PROVIDER', 'JD_LLM_GATEWAY_URL', 'JD_LLM_GATEWAY_KEY',
  'JD_LLM_MODEL', 'JD_LLM_TIMEOUT_MS',
];

function withEnv(values, fn) {
  const old = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));
  Object.assign(process.env, values);
  return Promise.resolve(fn()).finally(() => {
    for (const k of ENV_KEYS) {
      if (old[k] === undefined) delete process.env[k];
      else process.env[k] = old[k];
    }
  });
}

test('gateway config is read at call time, after module import', { concurrency: false }, async () => {
  await withEnv({
    JD_LLM_GATEWAY_URL: 'http://127.0.0.1:1/v1/chat/completions',
    JD_LLM_GATEWAY_KEY: 'test-key',
    JD_LLM_MODEL: 'test-model',
  }, () => {
    assert.deepEqual(configStatus(), {
      configured: true, hasUrl: true, hasKey: true, hasModel: true,
    });
  });
});

test('unreachable gateway falls back explicitly instead of impersonating AI', { concurrency: false }, async () => {
  await withEnv({
    LLM_PROVIDER: 'jd-gateway',
    JD_LLM_GATEWAY_URL: 'http://127.0.0.1:1/v1/chat/completions',
    JD_LLM_GATEWAY_KEY: 'test-key',
    JD_LLM_MODEL: 'test-model',
    JD_LLM_TIMEOUT_MS: '50',
  }, async () => {
    const result = await getProvider().intro({ profile: {} });
    assert.equal(result.llm.requested, 'jd-gateway');
    assert.equal(result.llm.used, 'stub');
    assert.equal(result.llm.fallback, true);
    assert.ok(Array.isArray(result.questions));
  });
});

test('product recommendations accept the complete nested health record', async () => {
  const result = await productsAdapter.recommend({
    level: 'walk',
    profile: { basics: { chiefComplaint: 'eye', screenHoursPerDay: 9 } },
  });
  assert.ok(result.products.length > 0);
  assert.ok(result.products.some(p => p.category === 'eye-mask' || p.category === 'eye-lamp'));
});

test('device session gets a deterministic coach summary in stub mode', async () => {
  await withEnv({ LLM_PROVIDER: 'stub' }, async () => {
    const result = await getProvider().analyzeDeviceSession({
      session: { metrics: { reps: 3, validReps: 2 }, events: [{ type: 'TOO_SHALLOW', count: 1 }] },
    });
    assert.match(result.headline, /2 个有效动作/);
    assert.match(result.focus, /深度/);
  });
});
