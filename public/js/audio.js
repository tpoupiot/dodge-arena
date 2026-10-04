// Effets sonores synthétisés avec WebAudio (aucun fichier audio à charger).

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.volume = 0.6;
    this.last = new Map();
  }

  // Les navigateurs exigent un geste de l'utilisateur avant de produire du son.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  tone(type, f0, f1, dur, gain, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, gain, f0, f1, q = 1, type = 'bandpass', delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  // vol : 0..1 (atténuation selon la distance, par exemple). k : variante du son (rareté du sort pris).
  play(name, vol = 1, k = 0) {
    if (!this.ctx || this.volume <= 0 || vol <= 0.02) return;
    // Évite l'empilement d'un même son dans la même frame.
    const now = this.ctx.currentTime;
    const prev = this.last.get(name) || 0;
    if (now - prev < 0.03) return;
    this.last.set(name, now);
    const v = Math.min(1, vol);
    switch (name) {
      case 'cast':
        this.noise(0.18, 0.22 * v, 2400, 500, 1.2);
        break;
      case 'castHeavy':
        this.noise(0.35, 0.3 * v, 1600, 240, 1.5);
        this.tone('sawtooth', 180, 90, 0.3, 0.05 * v);
        break;
      case 'flash':
        this.tone('sine', 520, 1900, 0.13, 0.22 * v);
        this.noise(0.12, 0.12 * v, 5000, 2500, 2, 'highpass');
        break;
      case 'dash':
        this.noise(0.16, 0.24 * v, 900, 3200, 0.9);
        break;
      case 'buff':
        this.tone('triangle', 330, 660, 0.25, 0.12 * v);
        this.tone('triangle', 495, 990, 0.25, 0.08 * v, 0.05);
        break;
      case 'hit':
        this.tone('sine', 190, 70, 0.14, 0.3 * v);
        this.noise(0.08, 0.15 * v, 1800, 600, 1);
        break;
      case 'hurt':
        this.tone('square', 120, 45, 0.22, 0.16 * v);
        this.tone('sine', 90, 40, 0.3, 0.4 * v);
        this.noise(0.15, 0.25 * v, 1200, 200, 0.8);
        break;
      case 'boom':
        this.noise(0.4, 0.3 * v, 900, 80, 0.7, 'lowpass');
        this.tone('sine', 110, 38, 0.35, 0.22 * v);
        break;
      case 'beam':
        this.tone('sawtooth', 240, 120, 0.35, 0.12 * v);
        this.noise(0.35, 0.18 * v, 3000, 800, 0.6);
        break;
      case 'cage':
        this.tone('triangle', 880, 440, 0.3, 0.1 * v);
        this.tone('triangle', 660, 330, 0.3, 0.08 * v, 0.04);
        break;
      case 'die':
        this.tone('sawtooth', 300, 60, 0.6, 0.12 * v);
        this.noise(0.5, 0.2 * v, 1400, 100, 0.7, 'lowpass');
        break;
      case 'tick':
        this.tone('sine', 660, 660, 0.09, 0.18 * v);
        break;
      case 'go':
        this.tone('sine', 880, 880, 0.28, 0.2 * v);
        this.tone('sine', 1320, 1320, 0.28, 0.1 * v);
        break;
      case 'win':
        [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.22, 0.15 * v, i * 0.09));
        break;
      case 'lose':
        [392, 330, 262].forEach((f, i) => this.tone('triangle', f, f * 0.98, 0.3, 0.14 * v, i * 0.12));
        break;
      case 'spawn':
        this.noise(0.25, 0.14 * v, 300, 1400, 1.2);
        this.tone('sine', 140, 280, 0.22, 0.12 * v);
        break;
      case 'chest':
        this.tone('triangle', 392, 392, 0.12, 0.14 * v);
        this.tone('triangle', 587, 587, 0.2, 0.14 * v, 0.1);
        break;
      case 'pick':
        // Deux notes pour un sort commun, une de plus par niveau de rareté.
        [0, 4, 7, 12, 16].slice(0, 2 + k).forEach((st, i) => {
          const f = 523 * 2 ** (st / 12);
          this.tone('triangle', f, f, 0.2, 0.14 * v, i * 0.07);
        });
        break;
      case 'door':
        this.noise(0.35, 0.2 * v, 500, 120, 0.8, 'lowpass');
        this.tone('sine', 90, 60, 0.3, 0.2 * v);
        break;
      case 'boss':
        this.tone('sawtooth', 110, 55, 0.9, 0.12 * v);
        this.tone('sine', 55, 41, 1.1, 0.3 * v);
        this.noise(0.8, 0.16 * v, 700, 90, 0.7, 'lowpass');
        break;
      case 'ui':
        this.tone('sine', 1200, 900, 0.05, 0.08 * v);
        break;
    }
  }
}
