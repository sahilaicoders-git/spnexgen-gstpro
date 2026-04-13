const { ipcRenderer } = require('electron');
const fs   = require('fs');
const path = require('path');

// ── Default config ─────────────────────────────────────────────────────────
const defaultConfig = {
  appName:         'SPGST',
  kicker:          'GST Management Software',
  tagline:         'Smart • Accurate • Professional',
  durationMs:      2800,
  autoOpenMain:    true,
};

function loadAnimationConfig() {
  try {
    const configPath = path.join(__dirname, '..', 'data', 'opening-animation.json');
    const raw = fs.readFileSync(configPath, 'utf8');
    return { ...defaultConfig, ...JSON.parse(raw) };
  } catch {
    return defaultConfig;
  }
}

// ── Status messages shown during progress ──────────────────────────────────
const STEPS = [
  { at: 0.00, text: 'Initializing',        step: 0 },
  { at: 0.20, text: 'Loading modules',     step: 0 },
  { at: 0.42, text: 'Connecting services', step: 1 },
  { at: 0.65, text: 'Reading client data', step: 1 },
  { at: 0.85, text: 'Almost ready',        step: 2 },
  { at: 0.98, text: 'Launching',           step: 2 },
];

// ── Easing ─────────────────────────────────────────────────────────────────
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ── Apply config to DOM ────────────────────────────────────────────────────
function applyConfig(config) {
  const eyebrow    = document.getElementById('eyebrow');
  const brandTitle = document.getElementById('brandTitle');
  const tagline    = document.getElementById('tagline');

  if (eyebrow)    eyebrow.textContent    = config.kicker;
  if (tagline)    tagline.textContent    = config.tagline;

  // Title: keep the PRO badge, replace just the text node
  if (brandTitle) {
    const badge = brandTitle.querySelector('.pro-badge');
    brandTitle.textContent = (config.appName || 'SPGST').toUpperCase();
    if (badge) brandTitle.appendChild(badge);
  }
}

// ── Progress runner ────────────────────────────────────────────────────────
function runProgress(durationMs) {
  const scene      = document.getElementById('scene');
  const loader     = document.getElementById('loader');
  const loaderText = document.getElementById('loaderText');
  const steps      = document.querySelectorAll('.step');

  if (!scene || !loader) return;

  const start = performance.now();
  let lastStepIdx = -1;

  function tick(now) {
    const elapsed  = now - start;
    const raw      = Math.min(elapsed / durationMs, 1);
    const eased    = easeInOutCubic(raw);

    // Update progress bar
    loader.style.transform = `scaleX(${eased.toFixed(4)})`;

    // Find current step message
    let currentStep = STEPS[0];
    for (let i = STEPS.length - 1; i >= 0; i--) {
      if (raw >= STEPS[i].at) { currentStep = STEPS[i]; break; }
    }

    if (loaderText && loaderText.textContent !== currentStep.text) {
      loaderText.style.opacity = '0';
      setTimeout(() => {
        if (loaderText) {
          loaderText.textContent = currentStep.text;
          loaderText.style.transition = 'opacity 0.25s ease';
          loaderText.style.opacity = '1';
        }
      }, 150);
    }

    // Update step label highlights
    const si = currentStep.step;
    if (si !== lastStepIdx) {
      lastStepIdx = si;
      steps.forEach((el, i) => {
        el.classList.remove('active', 'complete');
        if (i < si)  el.classList.add('complete');
        if (i === si) el.classList.add('active');
      });
    }

    if (raw < 1) {
      requestAnimationFrame(tick);
      return;
    }

    // All steps complete
    steps.forEach(el => { el.classList.remove('active'); el.classList.add('complete'); });

    // Exit animation
    setTimeout(() => {
      scene.classList.remove('animate-in');
      scene.classList.add('animate-out');
      setTimeout(() => {
        ipcRenderer.send('open-main-app');
      }, 400);
    }, 200);
  }

  requestAnimationFrame(tick);
}

// ── Boot ───────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const config = loadAnimationConfig();
  applyConfig(config);

  const scene = document.getElementById('scene');
  if (scene) scene.classList.add('animate-in');

  if (config.autoOpenMain) {
    // Short delay so CSS animations have fired first
    setTimeout(() => runProgress(config.durationMs), 60);
  }
});
