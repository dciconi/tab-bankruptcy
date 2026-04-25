// Tab Bankruptcy — Audio (Web Audio API, no external files)
// Mute state via chrome.storage.local key 'tb_mute'

let ctx = null;
let muted = false;

function getContext() {
  if (!ctx) {
    const AC = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) || null;
    if (!AC) return null; // test env fallback
    ctx = new AC();
  }
  return ctx;
}

async function loadMute() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['muted'], ({ muted: m }) => {
      muted = !!m;
      resolve(muted);
    });
  });
}

async function setMute(val) {
  muted = !!val;
  return new Promise(resolve => {
    chrome.storage.sync.set({ muted }, () => resolve());
  });
}

function osc(type, freq, time, dur, vol = 0.3, sweep = null) {
  const c = getContext();
  if (!c || muted) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  if (sweep) {
    o.frequency.linearRampToValueAtTime(sweep.to, time + dur);
  }
  g.gain.value = vol;
  g.gain.linearRampToValueAtTime(0.001, time + dur);
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 2000;
  o.connect(f);
  f.connect(g);
  g.connect(c.destination);
  o.start(time);
  o.stop(time + dur);
}

function playClick() {
  const c = getContext();
  const t = c.currentTime;
  osc('sine', 600, t, 0.02, 0.2);
}

function playNuke() {
  const c = getContext();
  const t = c.currentTime;
  // Low whoosh: sweep down 400→80Hz
  osc('sawtooth', 400, t, 0.35, 0.25, { to: 80 });
  // Subtle explosion noise via second osc
  osc('square', 120, t + 0.15, 0.2, 0.15, { to: 60 });
}

function playKeep() {
  const c = getContext();
  const t = c.currentTime;
  // Cha-ching: ascending sweep + harmonics
  osc('sine', 880, t, 0.12, 0.25);
  osc('triangle', 1320, t + 0.08, 0.1, 0.2);
  osc('sine', 1760, t + 0.16, 0.08, 0.18);
}

function playSave() {
  const c = getContext();
  const t = c.currentTime;
  // Medium tone with slight envelope
  osc('sine', 660, t, 0.18, 0.28);
  osc('sine', 880, t + 0.05, 0.12, 0.18);
}

function playCompletion() {
  const c = getContext();
  const t = c.currentTime;
  // Fanfare: 3 ascending notes (C4-E4-G4)
  osc('sine', 523, t, 0.15, 0.3);
  osc('sine', 659, t + 0.12, 0.15, 0.3);
  osc('sine', 784, t + 0.24, 0.25, 0.35);
}

// Export for popup/background use
if (typeof module !== 'undefined') {
  module.exports = { playClick, playNuke, playKeep, playSave, playCompletion, loadMute, setMute };
}
// ES module exports for browser extension (popup.js uses import)
export { playClick, playNuke, playKeep, playSave, playCompletion, loadMute, setMute };
