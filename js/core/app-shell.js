function ensureViewport() {
  if (document.querySelector('meta[name="viewport"]')) return;
  const meta = document.createElement('meta');
  meta.name = 'viewport';
  meta.content = 'width=device-width,initial-scale=1,viewport-fit=cover';
  document.head.appendChild(meta);
}

function updateViewportUnit() {
  const height = window.visualViewport?.height || window.innerHeight;
  document.documentElement.style.setProperty('--app-vh', `${height * 0.01}px`);
}

function updateDeviceState() {
  const mobile = matchMedia('(max-width: 768px)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  document.documentElement.dataset.viewport = mobile ? 'mobile' : 'desktop';
  document.documentElement.dataset.input = coarse ? 'touch' : 'pointer';
}

ensureViewport();
updateViewportUnit();
updateDeviceState();

window.addEventListener('resize', updateDeviceState, { passive: true });
window.visualViewport?.addEventListener('resize', updateViewportUnit, { passive: true });
window.addEventListener('orientationchange', updateViewportUnit, { passive: true });

document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('app-safe-screen');
  document.dispatchEvent(new CustomEvent('app:ready', {
    detail: { viewport: document.documentElement.dataset.viewport },
  }));
}, { once: true });
