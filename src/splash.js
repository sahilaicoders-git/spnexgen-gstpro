const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

const defaultConfig = {
  appName: 'SPGST',
  kicker: 'Welcome',
  tagline: 'Smart GST Management',
  durationMs: 2000,
  primaryColor: '#2cc98f',
  accentColor: '#23d4c8',
  backgroundStart: '#0F172A',
  backgroundEnd: '#1E293B',
  autoOpenMain: true
};

function loadAnimationConfig() {
  try {
    const configPath = path.join(__dirname, '..', 'data', 'opening-animation.json');
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...defaultConfig, ...parsed };
  } catch (error) {
    console.error('Could not read opening-animation.json. Using defaults.', error);
    return defaultConfig;
  }
}

function applyConfig(config) {
  const scene = document.getElementById('scene');
  const kicker = document.getElementById('kicker');
  const brandTitle = document.getElementById('brandTitle');
  const tagline = document.getElementById('tagline');

  document.documentElement.style.setProperty('--primary', config.primaryColor);
  document.documentElement.style.setProperty('--accent', config.accentColor);
  document.documentElement.style.setProperty('--bg-start', config.backgroundStart);
  document.documentElement.style.setProperty('--bg-end', config.backgroundEnd);

  kicker.textContent = config.kicker;
  brandTitle.textContent = config.appName;
  tagline.textContent = config.tagline;

  scene.classList.add('animate-in');
}

function runProgress(durationMs) {
  const scene = document.getElementById('scene');
  const loader = document.getElementById('loader');
  const start = performance.now();

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / durationMs, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    loader.style.transform = `scaleX(${eased.toFixed(4)})`;

    if (progress < 1) {
      requestAnimationFrame(tick);
      return;
    }

    scene.classList.remove('animate-in');
    scene.classList.add('animate-out');
    setTimeout(() => {
      ipcRenderer.send('open-main-app');
    }, 320);
  }

  requestAnimationFrame(tick);
}

window.addEventListener('DOMContentLoaded', () => {
  const config = loadAnimationConfig();
  applyConfig(config);

  if (config.autoOpenMain) {
    runProgress(config.durationMs);
  }
});
