import test from 'node:test';
import assert from 'node:assert/strict';

import { CoachVoice, chooseChineseVoice } from '../../js/services/coach-voice.js';

class FakeUtterance { constructor(text) { this.text = text; } }

function setup() {
  const spoken = [];
  const synthesis = {
    speaking: false, pending: false, cancelled: 0,
    getVoices: () => [], addEventListener() {},
    speak: utterance => spoken.push(utterance),
    cancel() { this.cancelled += 1; },
  };
  let time = 10000;
  const voice = new CoachVoice({ synthesis, Utterance: FakeUtterance, now: () => time });
  return { voice, synthesis, spoken, advance: ms => { time += ms; } };
}

test('natural mainland Chinese voice is preferred', () => {
  const selected = chooseChineseVoice([
    { name: 'English', lang: 'en-US' },
    { name: '普通中文', lang: 'zh-CN', localService: true },
    { name: 'Microsoft Xiaoxiao Online (Natural)', lang: 'zh-CN', localService: false },
  ]);
  assert.match(selected.name, /Xiaoxiao/);
  assert.equal(chooseChineseVoice([{ name: 'English', lang: 'en-US' }]), null);
});

test('repeated coaching cue observes cooldown', () => {
  const { voice, spoken, advance } = setup();
  assert.equal(voice.speak('再蹲深一点', { key: 'form_warning', cooldown: 5000 }), true);
  advance(1000);
  assert.equal(voice.speak('再蹲深一点', { key: 'form_warning', cooldown: 5000 }), false);
  advance(5000);
  assert.equal(voice.speak('再蹲深一点', { key: 'form_warning', cooldown: 5000 }), true);
  assert.equal(spoken.length, 2);
});

test('low priority praise is dropped while speaking and urgent cue interrupts', () => {
  const { voice, synthesis, spoken } = setup();
  synthesis.speaking = true;
  assert.equal(voice.speak('很好', { key: 'good_rep', priority: 'low' }), false);
  assert.equal(voice.speak('请停下来', { key: 'safety', priority: 'urgent' }), true);
  assert.equal(synthesis.cancelled, 1);
  assert.equal(spoken[0].text, '请停下来');
});
