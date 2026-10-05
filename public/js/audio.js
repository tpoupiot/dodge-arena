// Effets sonores synthétisés avec WebAudio (aucun fichier audio à charger).
// Chaque son est une recette de quelques couches : impact grave, souffle, cloche de cristal, cuivres.
// Les couches passent par un bus qui règle le volume, la position gauche-droite et la part de réverbération.

import { clamp } from '../../shared/util.js';

// Note en demi-tons à partir du ré 4 : tous les sons accordés partagent la tonalité de ré.
const hz = (st) => 293.66 * 2 ** (st / 12);
// Variation aléatoire de hauteur, pour qu'un son répété ne sonne jamais deux fois pareil.
const jit = (amt) => 1 + (Math.random() * 2 - 1) * amt;
// Notes du carillon des sorts : ré, mi, sol, la, ré. Ni majeur ni mineur, pour s'accorder avec tous les autres sons.
const CHIME = [24, 26, 29, 31, 36];

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.mix = null;
    this.verb = null;
    this.noiseBuf = null;
    this.curve = null;
    this.bus = null;
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
    const c = new AC();
    this.ctx = c;
    // Sortie : tous les sons → compresseur → volume du joueur. Le compresseur ne retient que les empilements
    // de sons forts ; le volume vient après lui, pour que le mixage reste le même à tous les réglages.
    this.master = c.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(c.destination);
    this.mix = c.createDynamicsCompressor();
    this.mix.threshold.value = -8;
    this.mix.knee.value = 6;
    this.mix.ratio.value = 12;
    this.mix.attack.value = 0.003;
    this.mix.release.value = 0.2;
    this.mix.connect(this.master);
    // Réverbération : une grande salle de pierre, privée de ses graves pour ne pas brouiller les impacts.
    const wet = c.createGain();
    wet.gain.value = 1.6;
    wet.connect(this.mix);
    const hall = c.createConvolver();
    hall.buffer = this.impulse(2.2);
    hall.connect(wet);
    this.verb = c.createBiquadFilter();
    this.verb.type = 'highpass';
    this.verb.frequency.value = 300;
    this.verb.connect(hall);
    // Bruit blanc, lu en boucle par les souffles et les craquements.
    const len = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // Courbe de saturation douce.
    this.curve = new Float32Array(257);
    for (let i = 0; i < 257; i++) this.curve[i] = Math.tanh((i / 128 - 1) * 3);
  }

  // Écho d'une salle : un bruit qui s'éteint en s'assombrissant, différent à gauche et à droite.
  impulse(seconds) {
    const c = this.ctx, len = Math.floor(c.sampleRate * seconds), pre = Math.floor(c.sampleRate * 0.012);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let low = 0;
      for (let i = pre; i < len; i++) {
        const x = (i - pre) / (len - pre);
        low += (Math.random() * 2 - 1 - low) * (0.85 - 0.6 * x);
        d[i] = low * (1 - x) ** 3;
      }
    }
    return buf;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  // ------------------------------------------------------------ couches

  // Enveloppe de volume : montée en `a` secondes, palier `hold`, puis extinction jusqu'à `dur`.
  env(gain, t, peak, a, dur, hold = 0) {
    gain.setValueAtTime(0, t);
    gain.linearRampToValueAtTime(peak, t + a);
    if (hold) gain.setValueAtTime(peak, t + a + hold);
    gain.exponentialRampToValueAtTime(peak * 0.001, t + dur);
  }

  // Programme l'arrêt d'une source. La dernière à s'arrêter libérera le bus.
  until(src, end) {
    src.stop(end + 0.02);
    if (end > this.bus.end) {
      this.bus.end = end;
      this.bus.last = src;
    }
  }

  // Filtre dont la fréquence glisse de f0 à f1 pendant `dur`.
  filter(node, type, f0, f1, q, t, dur) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    node.connect(f);
    return f;
  }

  // Saturation douce (amount : 0 à 1). Elle ajoute des harmoniques : les graves s'entendent aussi sur de petits
  // haut-parleurs.
  saturate(node, amount) {
    const pre = this.ctx.createGain(), shaper = this.ctx.createWaveShaper();
    pre.gain.value = amount;
    shaper.curve = this.curve;
    node.connect(pre);
    pre.connect(shaper);
    return shaper;
  }

  // Oscillateur dont la hauteur glisse de f0 à f1. Options : a (attaque), hold (palier), pt (durée du glissement,
  // sinon tout le son), lp ([f0, f1] d'un passe-bas), drive (saturation), det (désaccord en cents).
  tone(type, f0, f1, dur, gain, at = 0, o = {}) {
    const c = this.ctx, t = this.bus.t + at;
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + (o.pt || dur));
    if (o.det) osc.detune.value = o.det;
    let node = osc;
    if (o.drive) node = this.saturate(node, o.drive);
    if (o.lp) node = this.filter(node, 'lowpass', o.lp[0], o.lp[1], 0.7, t, dur);
    const g = c.createGain();
    this.env(g.gain, t, gain, o.a || 0.005, dur, o.hold);
    node.connect(g);
    g.connect(this.bus.in);
    osc.start(t);
    this.until(osc, t + dur);
  }

  // Impact grave : un sinus saturé dont la hauteur chute dès l'attaque, comme une peau de tambour.
  thump(f0, f1, dur, gain, at = 0, drive = 0.5) {
    this.tone('sine', f0, f1, dur, gain, at, { a: 0.002, pt: dur * 0.3, drive });
  }

  // Bruit blanc filtré dont la fréquence glisse de f0 à f1 : souffles, craquements, grondements.
  noise(dur, gain, f0, f1, q = 1, type = 'bandpass', at = 0, a = 0.008) {
    const c = this.ctx, t = this.bus.t + at;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const g = c.createGain();
    this.env(g.gain, t, gain, a, dur);
    this.filter(src, type, f0, f1, q, t, dur).connect(g);
    g.connect(this.bus.in);
    src.start(t, Math.random() * this.noiseBuf.duration);
    this.until(src, t + dur);
  }

  // Cloche : un sinus modulé en fréquence par un autre, dont l'éclat s'éteint avant la note. C'est le timbre de
  // cristal de la magie. ratio : hauteur du modulateur (non entier = plus métallique). index : quantité d'éclat.
  bell(f, dur, gain, at = 0, ratio = 3.5, index = 2) {
    const c = this.ctx, t = this.bus.t + at;
    const car = c.createOscillator(), mod = c.createOscillator(), depth = c.createGain(), g = c.createGain();
    car.frequency.value = f;
    mod.frequency.value = f * ratio;
    depth.gain.setValueAtTime(f * index, t);
    depth.gain.exponentialRampToValueAtTime(f * index * 0.05, t + dur * 0.7);
    mod.connect(depth);
    depth.connect(car.frequency);
    this.env(g.gain, t, gain, 0.003, dur);
    car.connect(g);
    g.connect(this.bus.in);
    mod.start(t);
    car.start(t);
    this.until(mod, t + dur);
    this.until(car, t + dur);
  }

  // Cuivres : chaque note est jouée par deux dents de scie légèrement désaccordées, l'une à gauche et l'autre à
  // droite, derrière un filtre qui s'ouvre à l'attaque puis se referme. Options : hold (palier), top (ouverture du
  // filtre en Hz), bend (affaissement de la hauteur, en cents), drive (saturation).
  brass(notes, dur, gain, at = 0, o = {}) {
    const c = this.ctx, t = this.bus.t + at, top = o.top || 2400, voices = Math.sqrt(notes.length * 2);
    for (const side of [-1, 1]) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 2;
      f.frequency.setValueAtTime(top * 0.15, t);
      f.frequency.exponentialRampToValueAtTime(top, t + 0.06);
      f.frequency.exponentialRampToValueAtTime(top * 0.35, t + dur);
      const g = c.createGain();
      this.env(g.gain, t, gain / voices, 0.025, dur, o.hold ?? dur * 0.25);
      (o.drive ? this.saturate(f, o.drive / Math.sqrt(notes.length)) : f).connect(g);
      this.panned(g, side * 0.5).connect(this.bus.in);
      for (const note of notes) {
        const osc = c.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = note;
        osc.detune.setValueAtTime(side * 8, t);
        if (o.bend) osc.detune.linearRampToValueAtTime(side * 8 + o.bend, t + dur);
        osc.connect(f);
        osc.start(t);
        this.until(osc, t + dur);
      }
    }
  }

  // Place un nœud entre gauche (-1) et droite (1). Les anciens Safari n'ont pas de panoramique : le son reste
  // alors au centre.
  panned(node, pan) {
    if (!this.ctx.createStereoPanner) return node;
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    node.connect(p);
    return p;
  }

  // Part du son envoyée à la réverbération (0 : sec, 0,6 : très loin dans la salle).
  reverb(amount) {
    this.bus.send.gain.value = amount;
  }

  // ------------------------------------------------------------ lecture

  // vol : 0..1 (atténuation selon la distance, par exemple). k : variante ou intensité du son (rareté du sort pris,
  // dégâts, taille de l'explosion, boss...), décrite avec chaque recette. pan : position, de -1 (gauche) à 1 (droite).
  play(name, vol = 1, k = 0, pan = 0) {
    const recipe = SOUNDS[name];
    if (!this.ctx || !recipe || this.volume <= 0 || !(vol > 0.02)) return;
    // Évite l'empilement d'un même son dans la même image.
    const now = this.ctx.currentTime;
    if (now - (this.last.get(name) ?? -1) < 0.03) return;
    this.last.set(name, now);
    this.open(now, Math.min(1, vol), clamp(pan || 0, -1, 1));
    recipe(this, k || 0);
    // La dernière couche débranche le bus en s'arrêtant ; la queue de réverbération continue sans lui.
    const { tap, send } = this.bus;
    this.bus.last.onended = () => {
      tap.disconnect();
      send.disconnect();
    };
  }

  // Bus d'un son : volume, position gauche-droite, envoi vers la réverbération.
  open(t, vol, pan) {
    const c = this.ctx;
    const input = c.createGain();
    input.gain.value = vol;
    const tap = this.panned(input, pan);
    tap.connect(this.mix);
    const send = c.createGain();
    send.gain.value = 0.25;
    tap.connect(send);
    send.connect(this.verb);
    this.bus = { t, in: input, tap, send, end: 0, last: null };
  }
}

// ------------------------------------------------------------ recettes
// Chaque recette reçoit le moteur et la variante k. Les durées sont en secondes, les fréquences en Hz ; les gains
// sont réglés pour qu'un son seul reste loin de la saturation.

const SOUNDS = {
  __proto__: null,

  // Sort lancé : souffle résonant qui retombe, trait sifflant, et une note du carillon tirée au hasard.
  cast(s) {
    const j = jit(0.1);
    s.reverb(0.2);
    s.noise(0.22, 0.24, 3400 * j, 700 * j, 2.5);
    s.tone('triangle', 1250 * j, 280 * j, 0.14, 0.07);
    s.bell(hz(CHIME[Math.floor(Math.random() * CHIME.length)]), 0.2, 0.04, 0, 2.4, 1.5);
  },

  // Sort lourd (Lien de glace, Flèche de glace) : départ sourd, long souffle grave, éclats de glace.
  castHeavy(s) {
    const j = jit(0.06);
    s.reverb(0.35);
    s.thump(150 * j, 48, 0.3, 0.24);
    s.noise(0.5, 0.27, 2000 * j, 260, 1.6);
    s.tone('sawtooth', 220 * j, 70 * j, 0.42, 0.08, 0, { lp: [1800, 300] });
    s.noise(0.22, 0.06, 7000, 9500, 0.8, 'highpass');
    s.bell(hz(31), 0.4, 0.06, 0.02, 3.01, 1.2);
    s.bell(hz(36), 0.45, 0.05, 0.07, 3.01, 1);
  },

  // Flash : aspiration vers l'aigu, claquement, puis scintillement à l'arrivée.
  flash(s) {
    s.reverb(0.4);
    s.tone('sine', 420, 2600, 0.11, 0.15);
    s.noise(0.14, 0.1, 4000, 9000, 0.7, 'highpass');
    s.thump(210, 90, 0.09, 0.12);
    s.bell(hz(24), 0.4, 0.08, 0.07);
    s.bell(hz(31), 0.35, 0.06, 0.11);
  },

  // Bond : souffle qui enfle vers l'aigu, corps grave.
  dash(s) {
    const j = jit(0.08);
    s.reverb(0.15);
    s.noise(0.24, 0.42, 600 * j, 4200 * j, 1.2, 'bandpass', 0, 0.03);
    s.tone('sine', 170 * j, 70, 0.17, 0.1);
    s.tone('triangle', 300 * j, 950 * j, 0.15, 0.06);
  },

  // Bouclier, vitesse, soin, retour d'un allié : une quinte qui monte, deux cloches claires.
  buff(s) {
    s.reverb(0.45);
    s.tone('triangle', hz(0), hz(12), 0.34, 0.09);
    s.tone('triangle', hz(7), hz(19), 0.34, 0.06, 0.05);
    s.noise(0.32, 0.045, 1500, 5200, 0.8, 'bandpass', 0, 0.1);
    s.bell(hz(24), 0.55, 0.06, 0.12);
    s.bell(hz(28), 0.55, 0.045, 0.19);
  },

  // Coup porté : impact grave, claquement, étincelle. k : dégâts, de 0 à 1. Plus le coup est fort, plus il est
  // grave et long.
  hit(s, k) {
    const j = jit(0.08);
    k = clamp(k, 0, 1);
    s.reverb(0.15 + 0.1 * k);
    s.thump((210 - 70 * k) * j, 58, 0.12 + 0.1 * k, 0.24 + 0.06 * k);
    s.tone('triangle', 950 * j, 240, 0.07 + 0.03 * k, 0.22);
    s.noise(0.07 + 0.05 * k, 0.32 + 0.1 * k, 3600 * j, 1100, 0.8, 'bandpass', 0, 0.002);
    s.bell(1320 * j, 0.12, 0.05, 0, 1.41, 2.5);
  },

  // Coup reçu. k : dégâts, de 0 à 1. Plus lourd et plus sale que le coup porté, avec un frottement de demi-ton.
  hurt(s, k) {
    k = clamp(k, 0, 1);
    s.reverb(0.2);
    s.thump(135, 38, 0.3 + 0.2 * k, 0.32 + 0.06 * k, 0, 0.8);
    s.tone('square', 420, 70, 0.16, 0.16, 0, { lp: [2600, 300] });
    s.tone('sawtooth', hz(-16), hz(-18), 0.34, 0.1, 0, { lp: [1500, 250] });
    s.noise(0.07, 0.36, 3200, 1200, 0.8, 'bandpass', 0, 0.002);
    s.noise(0.24 + 0.12 * k, 0.3, 1700, 220, 0.8, 'bandpass', 0, 0.002);
  },

  // Explosion de zone. k : taille, de 0 à 1. Une grande zone descend plus bas et gronde plus longtemps.
  boom(s, k) {
    const j = jit(0.07);
    k = clamp(k, 0, 1);
    s.reverb(0.3 + 0.15 * k);
    s.thump((125 - 40 * k) * j, 40 - 10 * k, 0.45 + 0.4 * k, 0.32, 0, 0.8);
    s.noise(0.5 + 0.45 * k, 0.34, 1600 * j, 80, 0.7, 'lowpass');
    s.noise(0.3 + 0.25 * k, 0.22, 900 * j, 250, 0.7, 'bandpass', 0, 0.004);
    s.noise(0.1, 0.36, 3000 * j, 600, 0.8, 'bandpass', 0, 0.002);
    s.noise(0.35 + 0.3 * k, 0.1, 3200, 1600, 0.7, 'highpass', 0.03);
  },

  // Rayon : coup grave, quinte de cuivres qui s'affaisse, sifflement qui tombe, souffle large.
  beam(s) {
    s.reverb(0.4);
    s.thump(115, 40, 0.4, 0.24, 0, 0.7);
    s.brass([hz(-12), hz(-5)], 0.55, 0.17, 0, { top: 3400, hold: 0.15, bend: -200 });
    s.tone('sawtooth', 1760, 300, 0.3, 0.05, 0, { lp: [7000, 900] });
    s.noise(0.45, 0.14, 3600, 900, 0.6);
  },

  // Cage qui se referme : fracas métallique, deux cloches fêlées.
  cage(s) {
    s.reverb(0.45);
    s.thump(180, 70, 0.13, 0.14);
    s.noise(0.08, 0.14, 2600, 1200, 3, 'bandpass', 0, 0.002);
    s.bell(hz(7), 0.75, 0.11, 0, 1.41, 3);
    s.bell(hz(12), 0.65, 0.08, 0.03, 2.76, 2);
  },

  // Mort. k : 0 ennemi (éclat bref), 1 joueur (chute et glas), 2 boss (effondrement, la magie se disperse).
  die(s, k) {
    const j = jit(0.08);
    if (k >= 2) {
      s.reverb(0.55);
      s.thump(95, 26, 1.5, 0.36, 0, 0.9);
      s.thump(80, 30, 0.7, 0.22, 0.28, 0.8);
      s.thump(70, 28, 0.8, 0.2, 0.55, 0.8);
      s.noise(1.7, 0.3, 1800, 50, 0.7, 'lowpass');
      s.noise(0.14, 0.32, 3000, 400, 0.8, 'bandpass', 0, 0.002);
      s.brass([hz(-24), hz(-17), hz(-12)], 1.6, 0.15, 0, { top: 1800, bend: -300, drive: 0.6 });
      [24, 19, 15, 12].forEach((st, i) => s.bell(hz(st), 0.7, 0.06, 0.15 + i * 0.16));
    } else if (k >= 1) {
      s.reverb(0.45);
      s.thump(125, 34, 0.55, 0.3, 0, 0.7);
      s.tone('sawtooth', 300, 45, 0.85, 0.11, 0, { lp: [2500, 150] });
      s.tone('sawtooth', 300, 45, 0.85, 0.11, 0, { lp: [2500, 150], det: 25 });
      s.noise(0.7, 0.24, 1600, 90, 0.7, 'lowpass');
      s.noise(0.08, 0.26, 3000, 800, 0.8, 'bandpass', 0, 0.002);
      s.bell(hz(0), 1.2, 0.09, 0.05, 1.41, 2.5);
    } else {
      s.reverb(0.25);
      s.thump(150 * j, 45, 0.2, 0.2);
      s.tone('sawtooth', 330 * j, 55, 0.36, 0.16, 0, { lp: [3000, 250] });
      s.noise(0.26, 0.3, 2600 * j, 500, 0.9);
      s.bell(hz(12) * j, 0.25, 0.05, 0, 1.41, 3);
    }
  },

  // Décompte : tambour de guerre et note de ré.
  tick(s) {
    s.reverb(0.3);
    s.thump(150, 55, 0.3, 0.3, 0, 0.6);
    s.noise(0.07, 0.3, 1400, 400, 1, 'bandpass', 0, 0.002);
    s.bell(hz(12), 0.3, 0.17, 0, 2, 1.5);
  },

  // Départ : accord de cuivres ré-la-ré, cymbale, grand coup de tambour.
  go(s) {
    s.reverb(0.45);
    s.thump(115, 36, 0.55, 0.32, 0, 0.7);
    s.noise(0.08, 0.14, 2600, 600, 0.8, 'bandpass', 0, 0.002);
    s.noise(0.6, 0.06, 5200, 3200, 0.7, 'highpass');
    s.brass([hz(-12), hz(-5), hz(0)], 0.75, 0.2, 0, { hold: 0.18 });
    s.brass([hz(12)], 0.5, 0.05);
  },

  // Victoire. k : 0 salle vidée (trois cloches), 1 manche gagnée (do puis ré majeur), 2 victoire finale
  // (si bémol, do, ré majeur : la cadence des fanfares). La fanfare attend un instant, le temps du dernier coup.
  win(s, k) {
    s.reverb(0.5);
    if (k < 1) {
      [7, 12, 19].forEach((st, i) => s.bell(hz(st), 0.5, 0.06, i * 0.075));
      s.brass([hz(0), hz(7)], 0.4, 0.04);
      return;
    }
    const chords = [[-16, -4, 0, 3], [-14, -2, 2, 5], [-12, 0, 4, 7, 12]].slice(k >= 2 ? 0 : 1);
    const n = chords.length, final = 0.15 + (n - 1) * 0.24;
    chords.forEach((chord, i) => {
      const at = 0.15 + i * 0.24;
      if (i < n - 1) {
        // Accords de levée : brefs, sur un coup de tambour léger.
        s.brass(chord.map(hz), 0.36, 0.035 * n, at, { hold: 0.1 });
        s.thump(130, 55, 0.25, 0.2, at, 0.6);
      } else {
        // Accord final : tenu, sur le grand tambour, sous une cymbale et un arpège de cloches.
        s.brass(chord.map(hz), 0.9 + 0.3 * n, 0.035 * n, at, { hold: 0.35 });
        s.thump(110, 36, 0.6, 0.3, at, 0.6);
      }
    });
    s.noise(0.9, 0.06, 5200, 3000, 0.7, 'highpass', final);
    [12, 16, 19, 24, 28, 31].slice(0, 2 * n).forEach((st, i) => s.bell(hz(st), 0.6, 0.06, final + 0.08 + i * 0.07));
  },

  // Défaite. k : 1 manche perdue (deux notes qui tombent), 2 défaite finale (la, fa, puis un ré qui s'affaisse
  // sous un coup sourd et un glas).
  lose(s, k) {
    s.reverb(0.5);
    if (k < 2) {
      s.brass([hz(3)], 0.45, 0.1, 0, { top: 1400 });
      s.brass([hz(-12), hz(0)], 0.8, 0.13, 0.22, { top: 1200, bend: -60 });
      return;
    }
    s.brass([hz(-5), hz(7)], 0.5, 0.14, 0.2, { top: 1500 });
    s.brass([hz(-9), hz(3)], 0.5, 0.14, 0.5, { top: 1300 });
    s.brass([hz(-24), hz(-12), hz(0)], 1.5, 0.19, 0.8, { top: 1100, bend: -120, hold: 0.3 });
    s.thump(90, 32, 0.9, 0.3, 0.8, 0.7);
    s.noise(1.2, 0.1, 700, 80, 0.7, 'lowpass', 0.8);
    s.bell(hz(0), 1.4, 0.05, 0.8, 1.41, 2.5);
  },

  // Interface : petit clic doux.
  ui(s) {
    s.reverb(0.05);
    s.tone('sine', 1300, 900, 0.05, 0.09, 0, { a: 0.002 });
    s.noise(0.03, 0.03, 5000, 4000, 0.7, 'highpass', 0, 0.001);
  },

  // Apparition. k : 0 ennemi (déchirure sombre qui enfle), 1 boss (la même, puis il atterrit).
  spawn(s, k) {
    const j = jit(0.1);
    s.reverb(k >= 1 ? 0.5 : 0.3);
    s.noise(0.3, 0.3, 300 * j, 2200 * j, 1.4, 'bandpass', 0, 0.07);
    s.tone('sine', 80 * j, 190 * j, 0.26, 0.11, 0, { a: 0.04 });
    s.tone('sawtooth', 110 * j, 330 * j, 0.26, 0.1, 0, { a: 0.06, lp: [600, 2600] });
    s.bell(hz(7) * j, 0.2, 0.07, 0.2, 1.41, 2);
    if (k >= 1) {
      s.thump(100, 30, 0.9, 0.32, 0.24, 0.8);
      s.noise(0.9, 0.32, 1000, 60, 0.7, 'lowpass', 0.24);
      s.noise(0.12, 0.4, 2200, 400, 0.8, 'bandpass', 0.24, 0.002);
    }
  },

  // Coffre : le couvercle, un souffle de magie qui s'échappe, trois cloches qui montent.
  chest(s) {
    s.reverb(0.5);
    s.thump(165, 70, 0.13, 0.16);
    s.noise(0.1, 0.09, 900, 300, 0.7, 'lowpass', 0, 0.002);
    s.noise(0.5, 0.045, 1200, 5200, 0.7, 'bandpass', 0.04, 0.18);
    s.bell(hz(7), 0.5, 0.08, 0.06);
    s.bell(hz(12), 0.7, 0.09, 0.16);
    s.bell(hz(19), 0.9, 0.065, 0.26);
  },

  // Sort pris au coffre. k : rareté, de 0 à 3. Deux notes pour un sort commun, une de plus par niveau ; un sort
  // épique scintille, un sort légendaire tombe avec un coup de tambour et des cuivres.
  pick(s, k) {
    k = clamp(Math.round(k), 0, 3);
    s.reverb(0.35 + 0.07 * k);
    const notes = [12, 19, 24, 28, 31].slice(0, 2 + k);
    const final = (notes.length - 1) * 0.075;
    notes.forEach((st, i) => {
      s.bell(hz(st), 0.5 + 0.1 * k, 0.1 - 0.014 * Math.min(k, 2), i * 0.075);
      s.tone('triangle', hz(st - 12), hz(st - 12), 0.2, 0.045, i * 0.075);
    });
    if (k >= 2) s.noise(0.6, 0.04, 5000, 8500, 0.7, 'highpass', final, 0.05);
    if (k >= 3) {
      s.thump(110, 38, 0.6, 0.26, final, 0.6);
      s.brass([hz(-12), hz(-5), hz(0)], 1, 0.045, final, { hold: 0.25 });
    }
  },

  // Porte de pierre : la dalle racle, puis claque.
  door(s) {
    s.reverb(0.45);
    s.noise(0.42, 0.2, 420, 150, 2, 'lowpass', 0, 0.06);
    s.noise(0.4, 0.2, 1400, 500, 1.2, 'bandpass', 0, 0.08);
    s.tone('sawtooth', 58, 44, 0.42, 0.09, 0, { a: 0.05, lp: [320, 130] });
    s.thump(98, 36, 0.45, 0.32, 0.34, 0.8);
    s.noise(0.12, 0.4, 1600, 300, 0.8, 'bandpass', 0.34, 0.002);
  },

  // Entrée d'un boss : cuivres graves saturés sur ré, frottement d'un demi-ton, coup de tonnerre. Le tout part
  // un tiers de seconde après la porte, pour tomber sur son claquement.
  boss(s) {
    s.reverb(0.6);
    s.thump(100, 30, 1, 0.34, 0.32, 0.9);
    s.noise(1.3, 0.24, 1100, 60, 0.7, 'lowpass', 0.32);
    s.noise(0.14, 0.3, 2400, 500, 0.8, 'bandpass', 0.32, 0.002);
    s.tone('sine', hz(-36), hz(-37), 2.2, 0.3, 0.32, { a: 0.04, hold: 0.6, drive: 0.6 });
    s.brass([hz(-24), hz(-17), hz(-12)], 2.2, 0.3, 0.32, { top: 2200, hold: 0.7, drive: 0.7 });
    s.brass([hz(-11)], 1.8, 0.07, 0.4, { top: 1600, hold: 0.5 });
  },
};
