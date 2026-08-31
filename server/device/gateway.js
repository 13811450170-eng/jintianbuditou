import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { deviceStore } from './store.js';

const MAX_BODY = 256 * 1024;

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Connection': 'close',
  });
  res.end(body);
}

function authorized(req, expectedToken) {
  if (!expectedToken) return false;
  const actual = String(req.headers['x-device-token'] || '');
  const a = Buffer.from(actual), b = Buffer.from(expectedToken);
  return a.length === b.length && timingSafeEqual(a, b);
}

function readJSON(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) { const e = new Error('payload too large'); e.code = 'PAYLOAD_TOO_LARGE'; reject(e); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch { const e = new Error('bad json'); e.code = 'BAD_JSON'; reject(e); }
    });
    req.on('error', reject);
  });
}

export function createDeviceGateway({ token, store = deviceStore } = {}) {
  return http.createServer(async (req, res) => {
    const path = (req.url || '').split('?')[0];
    if (req.method === 'GET' && path === '/device/v1/health') {
      return sendJSON(res, 200, { ok: true, service: 'maixcam-device-gateway' });
    }
    if (req.method !== 'POST' || !path.startsWith('/device/v1/')) return sendJSON(res, 404, { error: 'not_found' });
    if (!authorized(req, token)) return sendJSON(res, 401, { error: 'unauthorized' });

    let payload;
    try { payload = await readJSON(req); }
    catch (e) { return sendJSON(res, e.code === 'PAYLOAD_TOO_LARGE' ? 413 : 400, { error: e.code || 'bad_request' }); }

    const remote = req.socket.remoteAddress || '';
    try {
      if (path === '/device/v1/register') return sendJSON(res, 200, { ok: true, device: store.register(payload, remote) });
      if (path === '/device/v1/heartbeat') return sendJSON(res, 200, { ok: true, device: store.heartbeat(payload, remote) });
      if (path === '/device/v1/events') return sendJSON(res, 200, { ok: true, event: store.addEvent(payload, remote) });
      if (path === '/device/v1/sessions') return sendJSON(res, 200, { ok: true, session: store.addSession(payload, remote) });
      if (path === '/device/v1/commands/poll') return sendJSON(res, 200, { ok: true, command: store.pollCommand(payload, remote) });
      return sendJSON(res, 404, { error: 'not_found' });
    } catch (e) {
      return sendJSON(res, 400, { error: e.code || 'invalid_payload' });
    }
  });
}

export function startDeviceGatewayFromEnv() {
  if (process.env.DEVICE_GATEWAY_ENABLED !== '1') return null;
  const token = process.env.DEVICE_TOKEN || '';
  if (!token) throw new Error('DEVICE_GATEWAY_ENABLED=1 requires DEVICE_TOKEN');
  const host = process.env.DEVICE_HOST || '0.0.0.0';
  const port = Number(process.env.DEVICE_PORT || 3180);
  const gateway = createDeviceGateway({ token });
  gateway.listen(port, host, () => console.log(`MaixCAM Device Gateway · http://${host}:${port}`));
  return gateway;
}
