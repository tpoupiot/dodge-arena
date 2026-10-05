// Outil de test : faux AudioContext qui enregistre le graphe programmé par le moteur sonore.
// Il refuse ce qu'un navigateur refuse (rampe exponentielle vers 0, arrêt avant le départ...), et aussi ce qu'un
// navigateur accepte en silence mais qui s'entend mal : valeur hors plage, date passée, rampe exponentielle
// partant de 0, bruit qui s'arrête avant la fin de son enveloppe. Il ne connaît que ce dont le moteur se sert.

const SAMPLE_RATE = 48000;
const NYQUIST = SAMPLE_RATE / 2;

function finite(v, what) {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new TypeError(`${what} : valeur non finie (${v})`);
}

function oneOf(v, list, what) {
  if (!list.includes(v)) throw new TypeError(`${what} : « ${v} » n'est pas une valeur permise`);
}

class FakeParam {
  constructor(node, name, value, min = -Infinity, max = Infinity) {
    this.node = node;
    this.name = `${node.kind}.${name}`;
    this.min = min;
    this.max = max;
    this.v = value;
    this.events = [];
  }

  get value() {
    return this.v;
  }

  set value(v) {
    this.check(v);
    this.v = v;
  }

  check(v) {
    finite(v, this.name);
    if (v < this.min || v > this.max) throw new RangeError(`${this.name} : ${v} hors de [${this.min}, ${this.max}]`);
  }

  // Date d'un événement : jamais dans le passé, jamais avant l'événement précédent.
  at(t) {
    finite(t, `${this.name} (date)`);
    if (t < this.node.context.currentTime) throw new RangeError(`${this.name} : date ${t} dans le passé`);
    const last = this.events[this.events.length - 1];
    if (last && t < last.t) throw new RangeError(`${this.name} : date ${t} avant l'événement précédent (${last.t})`);
    return t;
  }

  // Valeur au dernier événement programmé.
  get end() {
    return this.events.length ? this.events[this.events.length - 1].v : this.v;
  }

  // Plus grande valeur absolue atteinte.
  get peak() {
    return this.events.length ? Math.max(...this.events.map((e) => Math.abs(e.v))) : Math.abs(this.v);
  }

  setValueAtTime(v, t) {
    this.check(v);
    this.events.push({ v, t: this.at(t) });
    return this;
  }

  linearRampToValueAtTime(v, t) {
    this.check(v);
    this.events.push({ v, t: this.at(t) });
    return this;
  }

  exponentialRampToValueAtTime(v, t) {
    this.check(v);
    if (v === 0) throw new RangeError(`${this.name} : rampe exponentielle vers 0`);
    const from = this.end;
    if (from === 0 || from * v < 0) throw new RangeError(`${this.name} : rampe exponentielle de ${from} vers ${v}, ignorée par le navigateur`);
    this.events.push({ v, t: this.at(t) });
    return this;
  }
}

class FakeNode {
  constructor(context, kind) {
    this.context = context;
    this.kind = kind;
    this.outputs = [];
    context.nodes.push(this);
  }

  connect(dest) {
    if (!(dest instanceof FakeNode) && !(dest instanceof FakeParam)) throw new TypeError(`${this.kind}.connect : destination invalide`);
    const ctx = dest instanceof FakeNode ? dest.context : dest.node.context;
    if (ctx !== this.context) throw new Error(`${this.kind}.connect : destination d'un autre contexte`);
    this.outputs.push(dest);
    return dest instanceof FakeNode ? dest : undefined;
  }

  disconnect() {
    this.outputs = [];
  }
}

class FakeSource extends FakeNode {
  constructor(context, kind) {
    super(context, kind);
    this.startTime = null;
    this.stopTime = null;
    this.onended = null;
    this.ended = false;
  }

  start(when = 0) {
    if (this.startTime !== null) throw new Error(`${this.kind}.start : déjà démarré`);
    finite(when, `${this.kind}.start`);
    if (when < this.context.currentTime) throw new RangeError(`${this.kind}.start : date ${when} dans le passé`);
    this.startTime = when;
  }

  stop(when = 0) {
    if (this.startTime === null) throw new Error(`${this.kind}.stop : jamais démarré`);
    finite(when, `${this.kind}.stop`);
    if (when <= this.startTime) throw new RangeError(`${this.kind}.stop : arrêt (${when}) avant le départ (${this.startTime})`);
    this.stopTime = when;
  }
}

class FakeOscillator extends FakeSource {
  constructor(context) {
    super(context, 'oscillator');
    this.wave = 'sine';
    this.frequency = new FakeParam(this, 'frequency', 440, -NYQUIST, NYQUIST);
    this.detune = new FakeParam(this, 'detune', 0, -153600, 153600);
  }

  get type() {
    return this.wave;
  }

  set type(v) {
    oneOf(v, ['sine', 'square', 'sawtooth', 'triangle'], 'oscillator.type');
    this.wave = v;
  }
}

class FakeBuffer {
  constructor(channels, length, sampleRate) {
    if (!Number.isInteger(channels) || channels < 1 || channels > 32) throw new Error(`createBuffer : ${channels} canaux`);
    if (!Number.isInteger(length) || length < 1) throw new Error(`createBuffer : longueur ${length}`);
    if (!(sampleRate >= 8000 && sampleRate <= 96000)) throw new Error(`createBuffer : fréquence ${sampleRate}`);
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this.data = Array.from({ length: channels }, () => new Float32Array(length));
  }

  getChannelData(ch) {
    if (!Number.isInteger(ch) || ch < 0 || ch >= this.numberOfChannels) throw new Error(`getChannelData : canal ${ch}`);
    return this.data[ch];
  }
}

class FakeBufferSource extends FakeSource {
  constructor(context) {
    super(context, 'bufferSource');
    this.buf = null;
    this.loop = false;
    this.offset = 0;
    this.playbackRate = new FakeParam(this, 'playbackRate', 1, 0.01, 100);
  }

  get buffer() {
    return this.buf;
  }

  set buffer(b) {
    if (!(b instanceof FakeBuffer)) throw new TypeError('bufferSource.buffer : tampon invalide');
    if (this.buf) throw new Error('bufferSource.buffer : tampon déjà fixé');
    this.buf = b;
  }

  start(when = 0, offset = 0) {
    if (!this.buf) throw new Error('bufferSource.start : pas de tampon');
    finite(offset, 'bufferSource.start (décalage)');
    if (offset < 0 || offset >= this.buf.duration) throw new RangeError(`bufferSource.start : décalage ${offset} hors du tampon`);
    super.start(when);
    this.offset = offset;
  }

  stop(when = 0) {
    super.stop(when);
    const left = (this.buf.duration - this.offset) / this.playbackRate.value;
    if (!this.loop && this.stopTime - this.startTime > left) {
      throw new RangeError('bufferSource.stop : le tampon se termine avant l\'arrêt programmé');
    }
  }
}

class FakeGain extends FakeNode {
  constructor(context) {
    super(context, 'gain');
    this.gain = new FakeParam(this, 'gain', 1);
  }
}

class FakeBiquad extends FakeNode {
  constructor(context) {
    super(context, 'biquad');
    this.mode = 'lowpass';
    this.frequency = new FakeParam(this, 'frequency', 350, 10, NYQUIST);
    this.Q = new FakeParam(this, 'Q', 1, 0.0001, 100);
  }

  get type() {
    return this.mode;
  }

  set type(v) {
    oneOf(v, ['lowpass', 'highpass', 'bandpass', 'lowshelf', 'highshelf', 'peaking', 'notch', 'allpass'], 'biquad.type');
    this.mode = v;
  }
}

class FakeCompressor extends FakeNode {
  constructor(context) {
    super(context, 'compressor');
    this.threshold = new FakeParam(this, 'threshold', -24, -100, 0);
    this.knee = new FakeParam(this, 'knee', 30, 0, 40);
    this.ratio = new FakeParam(this, 'ratio', 12, 1, 20);
    this.attack = new FakeParam(this, 'attack', 0.003, 0, 1);
    this.release = new FakeParam(this, 'release', 0.25, 0, 1);
  }
}

class FakeConvolver extends FakeNode {
  constructor(context) {
    super(context, 'convolver');
    this.buf = null;
  }

  get buffer() {
    return this.buf;
  }

  set buffer(b) {
    if (!(b instanceof FakeBuffer)) throw new TypeError('convolver.buffer : tampon invalide');
    if (![1, 2, 4].includes(b.numberOfChannels)) throw new Error(`convolver.buffer : ${b.numberOfChannels} canaux`);
    if (b.sampleRate !== this.context.sampleRate) throw new Error('convolver.buffer : fréquence d\'échantillonnage différente du contexte');
    this.buf = b;
  }
}

class FakeShaper extends FakeNode {
  constructor(context) {
    super(context, 'shaper');
    this.table = null;
  }

  get curve() {
    return this.table;
  }

  set curve(c) {
    if (!(c instanceof Float32Array) || c.length < 2) throw new Error('shaper.curve : courbe invalide');
    if (c.some((v) => !Number.isFinite(v))) throw new Error('shaper.curve : valeur non finie');
    this.table = c;
  }
}

class FakePanner extends FakeNode {
  constructor(context) {
    super(context, 'panner');
    this.pan = new FakeParam(this, 'pan', 0, -1, 1);
  }
}

export class FakeAudioContext {
  constructor() {
    this.sampleRate = SAMPLE_RATE;
    this.currentTime = 10;
    this.state = 'running';
    this.nodes = [];
    this.destination = new FakeNode(this, 'destination');
  }

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }

  // Avance l'horloge et prévient les sources arrivées à leur arrêt, comme le fait un navigateur.
  advance(dt) {
    this.currentTime += dt;
    for (const n of this.nodes) {
      if (n instanceof FakeSource && !n.ended && n.stopTime !== null && n.stopTime <= this.currentTime) {
        n.ended = true;
        if (n.onended) n.onended();
      }
    }
  }

  createGain() { return new FakeGain(this); }
  createOscillator() { return new FakeOscillator(this); }
  createBufferSource() { return new FakeBufferSource(this); }
  createBiquadFilter() { return new FakeBiquad(this); }
  createDynamicsCompressor() { return new FakeCompressor(this); }
  createConvolver() { return new FakeConvolver(this); }
  createWaveShaper() { return new FakeShaper(this); }
  createStereoPanner() { return new FakePanner(this); }
  createBuffer(channels, length, sampleRate) { return new FakeBuffer(channels, length, sampleRate); }
}

export const isSource = (n) => n instanceof FakeSource;

// Vrai si le signal du nœud atteint la sortie, directement ou en modulant un paramètre d'un nœud qui l'atteint.
export function reachesOutput(node, seen = new Set()) {
  if (node.kind === 'destination') return true;
  if (seen.has(node)) return false;
  seen.add(node);
  return node.outputs.some((o) => reachesOutput(o instanceof FakeParam ? o.node : o, seen));
}

// Nœuds traversés par le signal entre un nœud et la sortie (tous chemins confondus).
export function downstream(node, seen = new Set()) {
  for (const o of node.outputs) {
    if (o instanceof FakeNode && !seen.has(o)) {
      seen.add(o);
      downstream(o, seen);
    }
  }
  return seen;
}

// Niveau nominal d'un nœud à la sortie : produit des gains du chemin le plus fort. Les autres nœuds comptent
// pour 1, et une saturation ramène à 1 ce qui la précède.
export function levelAtOutput(node) {
  if (node.kind === 'destination') return 1;
  const g = node.kind === 'gain' ? node.gain.peak : 1;
  let best = 0;
  for (const o of node.outputs) {
    if (o instanceof FakeNode) best = Math.max(best, (o.kind === 'shaper' ? 1 : g) * levelAtOutput(o));
  }
  return best;
}
