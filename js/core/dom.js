export const byId = id => document.getElementById(id);

export function setText(target, value = '') {
  const el = typeof target === 'string' ? byId(target) : target;
  if (el) el.textContent = String(value ?? '');
  return el;
}

export function show(target, visible = true, display = '') {
  const el = typeof target === 'string' ? byId(target) : target;
  if (el) el.style.display = visible ? display : 'none';
  return el;
}

export function clear(target) {
  const el = typeof target === 'string' ? byId(target) : target;
  if (el) el.replaceChildren();
  return el;
}

export function element(tag, { className, text, attrs } = {}) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = String(text);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value != null) el.setAttribute(key, String(value));
  }
  return el;
}

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
}
