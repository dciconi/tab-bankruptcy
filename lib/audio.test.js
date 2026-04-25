// audio.test.js — Unit tests for lib/audio.js

function describe(name, fn) { console.log(`\n${name}`); fn(); }
function it(name, fn) { try { fn(); console.log(`  ✓ ${name}`); } catch (e) { console.log(`  ✗ ${name}: ${e.message}`); } }
function assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `Expected ${a} === ${b}`); }
function assertTrue(v, msg) { if (!v) throw new Error(msg || 'Expected true'); }
function assertType(v, t, msg) { if (typeof v !== t) throw new Error(msg || `Expected type ${t}`); }

// Mock window + AudioContext chain (osc → filter → gain → dest)
function makeConnectable() { return { connect: () => makeConnectable() }; }
globalThis.AudioContext = function() {
  this.currentTime = 0;
  this.state = 'running';
  this.createOscillator = () => { oscCount++; return { type: 'sine', frequency: { value: 440, linearRampToValueAtTime: () => {} }, start: () => {}, stop: () => {}, connect: () => makeConnectable() }; };
  this.createGain = () => ({ gain: { value: 0.3, linearRampToValueAtTime: () => {} }, connect: () => makeConnectable() });
  this.createBiquadFilter = () => ({ type: 'lowpass', frequency: { value: 2000 }, connect: () => makeConnectable() });
  this.destination = {};
};
globalThis.window = { AudioContext: globalThis.AudioContext, webkitAudioContext: null };

// Mock chrome.storage (sync for mute, matching audio.js)
globalThis.chrome = {
  storage: {
    sync: {
      _store: {},
      get(keys, cb) { cb({ muted: this._store.muted }); },
      set(obj, cb) { Object.assign(this._store, obj); cb && cb(); }
    }
  }
};

let oscCount = 0; // counter for oscillator calls

const audio = require('./audio.js');

describe('Audio exports', () => {
  it('exports all play functions', () => {
    assertType(audio.playClick, 'function');
    assertType(audio.playNuke, 'function');
    assertType(audio.playKeep, 'function');
    assertType(audio.playSave, 'function');
    assertType(audio.playCompletion, 'function');
  });
  it('exports mute controls', () => {
    assertType(audio.loadMute, 'function');
    assertType(audio.setMute, 'function');
  });
});

describe('Mute toggle via storage', () => {
  it('setMute(true) then loadMute returns true', async () => {
    await audio.setMute(true);
    const m = await audio.loadMute();
    assertEqual(m, true);
  });
  it('setMute(false) restores unmuted', async () => {
    await audio.setMute(false);
    const m = await audio.loadMute();
    assertEqual(m, false);
  });
});

describe('Sound playback (no crash)', () => {
  it('playClick does not throw', () => {
    oscCount = 0;
    audio.playClick();
    assertTrue(oscCount >= 1, 'oscillator created');
  });
  it('playNuke creates multiple oscs', () => {
    oscCount = 0;
    audio.playNuke();
    assertTrue(oscCount >= 2, 'multiple oscillators');
  });
  it('playKeep creates harmonics', () => {
    oscCount = 0;
    audio.playKeep();
    assertTrue(oscCount >= 2, 'harmonics');
  });
  it('playSave does not throw', () => {
    audio.playSave();
  });
  it('playCompletion does not throw', () => {
    audio.playCompletion();
  });
});
