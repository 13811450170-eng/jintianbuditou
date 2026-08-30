const MAX_EVENTS = 200;
const MAX_SESSIONS = 20;

class DeviceStore {
  constructor() {
    this.devices = new Map();
    this.events = [];
    this.sessions = [];
    this.commands = new Map();
  }

  register(input = {}, remoteAddress = '') {
    const now = Date.now();
    const deviceId = cleanId(input.deviceId);
    if (!deviceId) throw taggedError('INVALID_DEVICE_ID', 'deviceId required');
    const previous = this.devices.get(deviceId) || {};
    const device = {
      ...previous,
      deviceId,
      name: cleanText(input.name, 80) || previous.name || deviceId,
      model: cleanText(input.model, 40) || previous.model || 'MaixCAM',
      firmware: cleanText(input.firmware, 40) || previous.firmware || '',
      capabilities: normalizeCapabilities(input.capabilities || previous.capabilities),
      remoteAddress,
      registeredAt: previous.registeredAt || now,
      lastSeenAt: now,
    };
    this.devices.set(deviceId, device);
    return this.publicDevice(device);
  }

  heartbeat(input = {}, remoteAddress = '') {
    const device = this.register(input, remoteAddress);
    return { ...device, status: 'online' };
  }

  addEvent(input = {}, remoteAddress = '') {
    const device = this.register(input, remoteAddress);
    const event = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      deviceId: device.deviceId,
      sessionId: cleanId(input.sessionId) || null,
      ts: finiteNumber(input.ts) || Date.now(),
      receivedAt: Date.now(),
      type: cleanId(input.type) || 'unknown',
      exercise: cleanId(input.exercise) || null,
      severity: ['info', 'good', 'warning', 'stop'].includes(input.severity) ? input.severity : 'info',
      cue: cleanText(input.cue, 160),
      metrics: numericObject(input.metrics),
      quality: numericObject(input.quality),
    };
    this.events.unshift(event);
    this.events = this.events.slice(0, MAX_EVENTS);
    return event;
  }

  addSession(input = {}, remoteAddress = '') {
    const device = this.register(input, remoteAddress);
    const session = {
      deviceId: device.deviceId,
      sessionId: cleanId(input.sessionId) || `${device.deviceId}-${Date.now()}`,
      exercise: cleanId(input.exercise) || 'unknown',
      startedAt: finiteNumber(input.startedAt) || null,
      endedAt: finiteNumber(input.endedAt) || Date.now(),
      durationMs: finiteNumber(input.durationMs) || 0,
      metrics: numericObject(input.metrics),
      quality: numericObject(input.quality),
      events: Array.isArray(input.events) ? input.events.slice(0, 50).map(e => ({
        type: cleanId(e?.type) || 'unknown', count: finiteNumber(e?.count) || 0,
        side: cleanId(e?.side) || null,
      })) : [],
      receivedAt: Date.now(),
    };
    this.sessions.unshift(session);
    this.sessions = this.sessions.slice(0, MAX_SESSIONS);
    return session;
  }

  enqueueCommand(input = {}) {
    const deviceId = cleanId(input.deviceId);
    const type = cleanId(input.type).toUpperCase();
    const allowed = new Set(['CALIBRATE', 'START_SESSION', 'START_SET', 'PAUSE', 'RESUME', 'STOP']);
    if (!deviceId || !this.devices.has(deviceId)) throw taggedError('UNKNOWN_DEVICE', 'known deviceId required');
    if (!allowed.has(type)) throw taggedError('INVALID_COMMAND', 'unsupported command');
    const command = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      deviceId,
      type,
      createdAt: Date.now(),
      payload: {
        sessionId: cleanId(input.payload?.sessionId) || null,
        exercise: cleanId(input.payload?.exercise) || null,
        set: finiteNumber(input.payload?.set),
        totalSets: finiteNumber(input.payload?.totalSets),
        targetReps: finiteNumber(input.payload?.targetReps),
        restSeconds: finiteNumber(input.payload?.restSeconds),
      },
    };
    const queue = this.commands.get(deviceId) || [];
    queue.push(command);
    this.commands.set(deviceId, queue.slice(-20));
    return command;
  }

  pollCommand(input = {}, remoteAddress = '') {
    const device = this.register(input, remoteAddress);
    const queue = this.commands.get(device.deviceId) || [];
    const command = queue.shift() || null;
    this.commands.set(device.deviceId, queue);
    return command;
  }

  snapshot() {
    return {
      devices: [...this.devices.values()].map(d => this.publicDevice(d)),
      latestEvent: this.events[0] || null,
      latestSession: this.sessions[0] || null,
      events: this.events.slice(0, 30),
      generatedAt: Date.now(),
    };
  }

  publicDevice(device) {
    const online = Date.now() - device.lastSeenAt < 15000;
    const { remoteAddress, ...safe } = device;
    return { ...safe, status: online ? 'online' : 'offline' };
  }

  reset() {
    this.devices.clear(); this.events = []; this.sessions = []; this.commands.clear();
  }
}

function cleanId(value) {
  return typeof value === 'string' ? value.trim().replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 80) : '';
}
function cleanText(value, max) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function finiteNumber(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function numericObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, 40).flatMap(([k, v]) => {
    const n = finiteNumber(v); return n == null ? [] : [[cleanId(k), n]];
  }));
}
function normalizeCapabilities(value) {
  return Array.isArray(value) ? value.map(cleanId).filter(Boolean).slice(0, 20) : [];
}
function taggedError(code, message) { const e = new Error(message); e.code = code; return e; }

export const deviceStore = new DeviceStore();
