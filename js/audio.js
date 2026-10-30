'use strict';
// ===================================================================
//  AUDIO – everything is synthesised with WebAudio (no asset files)
// ===================================================================
const Snd = {
  ctx: null, master: null, sfxBus: null, musicBus: null, ready: false, muted: false,
  radioOn: true, radioPlaying: false, nextStep: 0, step: 0, timer: null, bar: 0,
  phrase: [], tempo: 148,

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = 0.8; this.master.connect(c.destination);
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
    this.musicBus = c.createGain(); this.musicBus.gain.value = 0.0; this.musicBus.connect(this.master);
    // white noise buffer reused by all noise-based sounds
    const len = c.sampleRate * 2, nb = c.createBuffer(1, len, c.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    // engine
    this.engOsc = c.createOscillator(); this.engOsc.type = 'sawtooth'; this.engOsc.frequency.value = 50;
    this.engOsc2 = c.createOscillator(); this.engOsc2.type = 'square'; this.engOsc2.frequency.value = 25;
    this.engF = c.createBiquadFilter(); this.engF.type = 'lowpass'; this.engF.frequency.value = 380;
    this.engG = c.createGain(); this.engG.gain.value = 0;
    this.engOsc.connect(this.engF); this.engOsc2.connect(this.engF); this.engF.connect(this.engG); this.engG.connect(this.sfxBus);
    this.engOsc.start(); this.engOsc2.start();
    // city ambience: filtered noise bed
    this.amb = c.createBufferSource(); this.amb.buffer = nb; this.amb.loop = true;
    this.ambF = c.createBiquadFilter(); this.ambF.type = 'lowpass'; this.ambF.frequency.value = 520;
    this.ambG = c.createGain(); this.ambG.gain.value = 0.05;
    this.amb.connect(this.ambF); this.ambF.connect(this.ambG); this.ambG.connect(this.sfxBus); this.amb.start();
    // siren
    this.sirOsc = c.createOscillator(); this.sirOsc.type = 'square'; this.sirG = c.createGain(); this.sirG.gain.value = 0;
    this.sirF = c.createBiquadFilter(); this.sirF.type = 'lowpass'; this.sirF.frequency.value = 1800;
    this.sirOsc.connect(this.sirF); this.sirF.connect(this.sirG); this.sirG.connect(this.sfxBus); this.sirOsc.start();
    this.ready = true;
    this.setPhrase();
  },

  noise(dur, type, f0, f1, vol, q) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime, s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); if (q) f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  },
  tone(freq, dur, type, vol, slideTo, delay) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfxBus); o.start(t); o.stop(t + dur + 0.05);
  },
  shot(kind, vol) {
    vol = vol === undefined ? 1 : vol; if (vol <= 0.02) return;
    if (kind === 'shotgun') { this.noise(0.35, 'lowpass', 2600, 120, 0.9 * vol); this.tone(90, 0.25, 'sine', 0.6 * vol, 40); }
    else if (kind === 'smg') { this.noise(0.1, 'bandpass', 2200, 700, 0.6 * vol, 1); }
    else { this.noise(0.17, 'bandpass', 2600, 500, 0.75 * vol, 0.8); this.tone(180, 0.1, 'sine', 0.3 * vol, 60); }
  },
  boom(vol) { vol = vol === undefined ? 1 : vol; if (vol <= 0.02) return; this.noise(1.1, 'lowpass', 1400, 50, 1.2 * vol); this.tone(70, 0.8, 'sine', 0.9 * vol, 28); },
  punch(vol) { this.noise(0.09, 'lowpass', 900, 200, 0.7 * (vol === undefined ? 1 : vol)); this.tone(120, 0.08, 'sine', 0.3, 60); },
  crash(vol) { vol = Math.min(1, vol); if (vol < 0.05) return; this.noise(0.25, 'lowpass', 1800, 150, 0.8 * vol); this.tone(95, 0.2, 'square', 0.18 * vol, 50); },
  horn(pitch, vol) {
    if (!this.ready) return; vol = vol === undefined ? 1 : vol; if (vol <= 0.03) return; pitch = pitch || 1;
    const dbl = (d) => { this.tone(430 * pitch, 0.16, 'square', 0.09 * vol, 0, d); this.tone(540 * pitch, 0.16, 'square', 0.07 * vol, 0, d); };
    dbl(0); dbl(0.2);
  },
  cash() { this.tone(988, 0.1, 'sine', 0.22); this.tone(1319, 0.22, 'sine', 0.22, 0, 0.08); },
  pickup() { this.tone(660, 0.08, 'triangle', 0.25); this.tone(990, 0.14, 'triangle', 0.25, 0, 0.07); },
  buy() { this.tone(520, 0.08, 'square', 0.12); this.tone(780, 0.14, 'square', 0.12, 0, 0.07); },
  fail() { this.tone(300, 0.25, 'sawtooth', 0.2, 120); this.tone(180, 0.4, 'sawtooth', 0.2, 70, 0.2); },
  win() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.25, 0, i * 0.11)); },
  bell() { this.tone(880, 1.4, 'sine', 0.07); this.tone(1318, 1.0, 'sine', 0.04); },
  siren(vol, t) {
    if (!this.ready) return;
    this.sirG.gain.setTargetAtTime(vol * 0.05, this.ctx.currentTime, 0.1);
    const ph = (t * 0.9) % 1; this.sirOsc.frequency.setTargetAtTime(700 + 450 * Math.abs(Math.sin(ph * Math.PI)), this.ctx.currentTime, 0.03);
  },
  engine(on, speedN, throttle) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const f = 38 + speedN * 95 + throttle * 12;
    this.engOsc.frequency.setTargetAtTime(f, t, 0.08); this.engOsc2.frequency.setTargetAtTime(f * 0.5, t, 0.08);
    this.engF.frequency.setTargetAtTime(260 + speedN * 600 + throttle * 160, t, 0.1);
    this.engG.gain.setTargetAtTime(on ? 0.1 + speedN * 0.08 : 0, t, 0.12);
  },
  ambience(traffic, night) {
    if (!this.ready) return; const t = this.ctx.currentTime;
    this.ambG.gain.setTargetAtTime(0.03 + traffic * 0.012, t, 0.5);
    this.ambF.frequency.setTargetAtTime(night ? 380 : 620, t, 0.5);
  },

  // ----------------------------------------------------------- radio: procedural kuthu beat
  setRadio(on) {
    if (!this.ready) return;
    const want = on && this.radioOn;
    if (want && !this.radioPlaying) {
      this.radioPlaying = true; this.nextStep = this.ctx.currentTime + 0.08; this.step = 0;
      this.musicBus.gain.setTargetAtTime(0.55, this.ctx.currentTime, 0.2);
      this.timer = setInterval(() => this.sched(), 30);
    } else if (!want && this.radioPlaying) {
      this.radioPlaying = false; this.musicBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
      clearInterval(this.timer);
    }
  },
  setPhrase() {
    // Mayamalavagowla-ish: Sa Re(b) Ga Ma Pa Dha(b) Ni Sa'
    const sc = [0, 1, 4, 5, 7, 8, 11, 12, 13, 16];
    const base = [0, 2, 3, 2, 4, 3, 2, 1], p = [];
    for (let i = 0; i < 16; i++) p.push(Math.random() < 0.3 ? -1 : clamp(base[i % 8] + (Math.random() < 0.35 ? 1 : 0) - (Math.random() < 0.2 ? 1 : 0) + (i > 11 ? 2 : 0), 0, sc.length - 1));
    p[0] = 0; this.phrase = p; this.scale = sc;
  },
  sched() {
    const c = this.ctx;
    while (this.nextStep < c.currentTime + 0.14) {
      this.playStep(this.step % 16, this.nextStep);
      this.nextStep += 60 / this.tempo / 4; this.step++;
      if (this.step % 64 === 0) this.setPhrase();
    }
  },
  playStep(s, t) {
    const c = this.ctx, out = this.musicBus;
    const kick = [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0], thap = [0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0];
    if (kick[s]) { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.25); }
    if (thap[s]) { // thappu drum: sharp noisy slap
      const n = c.createBufferSource(); n.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = s % 4 === 3 ? 3200 : 1700; f.Q.value = 2.2;
      const g = c.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07); n.connect(f); f.connect(g); g.connect(out); n.start(t, Math.random()); n.stop(t + 0.1);
    }
    if (s % 2 === 0) { // shaker
      const n = c.createBufferSource(); n.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
      const g = c.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04); n.connect(f); f.connect(g); g.connect(out); n.start(t, Math.random()); n.stop(t + 0.06);
    }
    if (s === 0 || s === 6 || s === 8 || s === 14) { // bass pulse on Sa
      const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = 55 * (s === 14 ? 1.5 : 1);
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
      g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28); o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + 0.3);
    }
    const nI = this.phrase[s];
    if (nI >= 0) { // lead (nadaswaram-ish reedy saw)
      const fr = 220 * Math.pow(2, this.scale[nI] / 12);
      const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      o.type = 'sawtooth'; o2.type = 'square'; o.frequency.setValueAtTime(fr * 1.03, t); o.frequency.exponentialRampToValueAtTime(fr, t + 0.05); o2.frequency.value = fr * 2.002;
      f.type = 'lowpass'; f.frequency.value = 2200; f.Q.value = 4;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o.connect(f); o2.connect(f); f.connect(g); g.connect(out); o.start(t); o2.start(t); o.stop(t + 0.25); o2.stop(t + 0.25);
    }
  },
};
