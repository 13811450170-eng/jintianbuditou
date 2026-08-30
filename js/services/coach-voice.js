const DEFAULT_COOLDOWNS = {
  good_rep: 900,
  form_warning: 5000,
  visibility: 7000,
  status: 1200,
};

function normalizeLang(value = '') {
  return String(value).toLowerCase().replace('_', '-');
}

export function scoreChineseVoice(voice) {
  const name = String(voice?.name || '').toLowerCase();
  const lang = normalizeLang(voice?.lang);
  if (!lang.startsWith('zh') && !/xiaoxiao|yunxi|tingting|meijia|sinji/.test(name)) return -100;
  let score = lang === 'zh-cn' || lang === 'zh-hans' ? 30 : 18;
  if (/natural|neural|premium|enhanced/.test(name)) score += 50;
  if (/xiaoxiao|xiaoyi|yunxi|yunyang|tingting|meijia|sinji/.test(name)) score += 24;
  if (/microsoft|apple|google/.test(name)) score += 8;
  if (voice?.localService === false) score += 4;
  return score;
}

export function chooseChineseVoice(voices = []) {
  const ranked = [...voices].sort((a, b) => scoreChineseVoice(b) - scoreChineseVoice(a));
  return ranked.length && scoreChineseVoice(ranked[0]) >= 0 ? ranked[0] : null;
}

export class CoachVoice {
  constructor({ synthesis, Utterance, now = () => Date.now(), cooldowns = {} } = {}) {
    this.synthesis = synthesis || globalThis.speechSynthesis;
    this.Utterance = Utterance || globalThis.SpeechSynthesisUtterance;
    this.now = now;
    this.cooldowns = { ...DEFAULT_COOLDOWNS, ...cooldowns };
    this.lastSpoken = new Map();
    this.voice = null;
    this.enabled = Boolean(this.synthesis && this.Utterance);
    this.refreshVoice = this.refreshVoice.bind(this);
    this.refreshVoice();
    this.synthesis?.addEventListener?.('voiceschanged', this.refreshVoice);
  }

  refreshVoice() {
    this.voice = chooseChineseVoice(this.synthesis?.getVoices?.() || []);
    return this.voice;
  }

  speak(text, { key = text, priority = 'normal', cooldown, rate, pitch } = {}) {
    if (!this.enabled || !text) return false;
    const timestamp = this.now();
    const cooldownMs = cooldown ?? this.cooldowns[key] ?? 0;
    if (timestamp - (this.lastSpoken.get(key) || -Infinity) < cooldownMs) return false;

    // Safety/status prompts take control. Low-priority praise never piles up behind an unfinished sentence.
    if (priority === 'urgent') this.synthesis.cancel();
    else if (priority === 'low' && (this.synthesis.speaking || this.synthesis.pending)) return false;

    const utterance = new this.Utterance(String(text));
    utterance.lang = this.voice?.lang || 'zh-CN';
    utterance.voice = this.voice || null;
    utterance.rate = rate ?? (priority === 'urgent' ? 0.98 : 1.02);
    utterance.pitch = pitch ?? (priority === 'low' ? 1.08 : 1.02);
    utterance.volume = 1;
    this.lastSpoken.set(key, timestamp);
    this.synthesis.speak(utterance);
    return true;
  }

  stop() {
    this.synthesis?.cancel?.();
  }
}

export function createCoachVoice() {
  return new CoachVoice();
}
