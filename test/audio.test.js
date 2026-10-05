// Tests du moteur sonore. Le graphe WebAudio programmé par chaque son est enregistré par un faux contexte strict
// (voir fake-audio.js), puis examiné : validité, niveau, durée, position.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeAudioContext, isSource, reachesOutput, downstream, levelAtOutput } from './fake-audio.js';

const made = [];
class Ctx extends FakeAudioContext {
  constructor() {
    super();
    made.push(this);
  }
}
globalThis.window = { AudioContext: Ctx };

const { Sfx } = await import('../public/js/audio.js');

const NAMES = [
  'cast', 'castHeavy', 'flash', 'dash', 'buff', 'hit', 'hurt', 'boom', 'beam', 'cage', 'die',
  'tick', 'go', 'win', 'lose', 'ui', 'spawn', 'chest', 'pick', 'door', 'boss',
];

// Moteur prêt à jouer, avec son contexte.
function ready(volume = 1) {
  const sfx = new Sfx();
  sfx.setVolume(volume);
  sfx.unlock();
  return { sfx, ctx: made[made.length - 1] };
}

// Joue un son une seconde plus tard (hors de la fenêtre anti-empilement) et décrit ce qu'il a programmé.
function played(sfx, ctx, ...args) {
  ctx.advance(1);
  const mark = ctx.nodes.length;
  sfx.play(...args);
  const nodes = ctx.nodes.slice(mark);
  const sources = nodes.filter(isSource);
  return {
    nodes,
    sources,
    // Niveau nominal : somme des niveaux de chaque couche à la sortie.
    level: sources.reduce((sum, s) => sum + levelAtOutput(s), 0),
    // Durée jusqu'à l'arrêt de la dernière couche.
    length: Math.max(0, ...sources.map((s) => s.stopTime - ctx.currentTime)),
    // Nombre de départs de notes distincts.
    onsets: new Set(sources.filter((s) => s.kind === 'oscillator').map((s) => s.startTime.toFixed(3))).size,
  };
}

const near = (a, b) => Math.abs(a - b) < 1e-9;

// Fige le hasard le temps d'un test. La valeur se change ensuite avec `.value`.
function fixRandom(t, value) {
  const real = Math.random, dice = { value };
  Math.random = () => dice.value;
  t.after(() => {
    Math.random = real;
  });
  return dice;
}

test('aucun son avant le premier geste, à volume nul, trop faible pour s\'entendre ou inconnu', () => {
  const before = made.length;
  const cold = new Sfx();
  cold.play('hit');
  assert.equal(made.length, before, 'pas de contexte créé sans geste du joueur');

  const muted = ready(0);
  assert.equal(played(muted.sfx, muted.ctx, 'hit').nodes.length, 0, 'volume nul');

  const { sfx, ctx } = ready();
  assert.equal(played(sfx, ctx, 'hit', 0.02).nodes.length, 0, 'son trop lointain');
  assert.equal(played(sfx, ctx, 'hit', NaN).nodes.length, 0, 'volume invalide');
  assert.equal(played(sfx, ctx, 'inconnu').nodes.length, 0, 'son inconnu');
  assert.equal(played(sfx, ctx, 'constructor').nodes.length, 0, 'nom hérité de Object, pas un son');
  assert.ok(played(sfx, ctx, 'hit').sources.length > 0, 'le même moteur joue bien un son normal');
});

test('unlock ne crée qu\'un contexte et réveille un contexte suspendu', () => {
  const before = made.length;
  const sfx = new Sfx();
  sfx.unlock();
  sfx.unlock();
  sfx.unlock();
  assert.equal(made.length, before + 1);
  const ctx = made[made.length - 1];
  ctx.state = 'suspended';
  sfx.unlock();
  assert.equal(ctx.state, 'running');
});

test('navigateur sans WebAudio : le jeu continue sans son', () => {
  window.AudioContext = undefined;
  try {
    const sfx = new Sfx();
    sfx.unlock();
    sfx.setVolume(0.8);
    sfx.play('hit');
  } finally {
    window.AudioContext = Ctx;
  }
});

test('navigateur sans panoramique : le son sort quand même, sans erreur', () => {
  class Old extends Ctx {}
  Old.prototype.createStereoPanner = undefined;
  window.AudioContext = Old;
  try {
    const { sfx, ctx } = ready();
    for (const name of ['cast', 'go']) {
      const p = played(sfx, ctx, name, 1, 0, -1);
      assert.ok(p.sources.length > 0);
      for (const n of p.nodes) assert.ok(reachesOutput(n), `${name} : ${n.kind} branché`);
    }
  } finally {
    window.AudioContext = Ctx;
  }
});

test('chaque son programme un graphe valide, quels que soient le volume, la variante et la position', (t) => {
  const dice = fixRandom(t, 0.5);
  // [volume, variante, position] : valeurs normales, extrêmes et invalides.
  const cases = [[], [1, 0, 0], [0.03, 0, 0], [1, 1, -1], [1, 2, 1], [1, 3, 0.4], [1, 0.5, 0], [1, -1, 0], [1, 7, 0], [5, 0, 9], [1, NaN, NaN]];
  for (const rnd of [0, 0.5, 0.999999]) {
    dice.value = rnd;
    const { sfx, ctx } = ready();
    for (const name of NAMES) {
      for (const c of cases) {
        const label = `${name}(${c.join(', ')}) hasard ${rnd}`;
        let p;
        assert.doesNotThrow(() => { p = played(sfx, ctx, name, ...c); }, label);
        assert.ok(p.sources.length > 0, `${label} : aucune couche`);
        assert.ok(p.nodes.length <= 120, `${label} : ${p.nodes.length} nœuds`);
        assert.ok(p.length > 0.02 && p.length <= 4, `${label} : durée ${p.length}`);
        for (const s of p.sources) {
          assert.ok(s.startTime !== null && s.stopTime !== null, `${label} : source jamais arrêtée`);
          assert.ok(levelAtOutput(s) <= 0.6, `${label} : couche à ${levelAtOutput(s)}`);
        }
        for (const n of p.nodes) assert.ok(reachesOutput(n), `${label} : ${n.kind} jamais branché`);
      }
    }
  }
});

test('tous les sons que demande main.js existent', () => {
  const src = readFileSync(new URL('../public/js/main.js', import.meta.url), 'utf8');
  const asked = new Set();
  for (const call of src.matchAll(/sfx\.play\(([^,)]+)/g)) {
    for (const name of call[1].matchAll(/(?:^|[?:])\s*'(\w+)'/g)) asked.add(name[1]);
  }
  assert.ok(asked.size > 10, `appels trouvés dans main.js : ${[...asked].join(', ')}`);
  const { sfx, ctx } = ready();
  for (const name of asked) {
    assert.ok(played(sfx, ctx, name).sources.length > 0, `main.js joue « ${name} », inconnu de audio.js`);
  }
});

test('le même son ne s\'empile pas dans la même image', () => {
  const { sfx, ctx } = ready();
  ctx.currentTime = 0;
  sfx.play('hit');
  const first = ctx.nodes.length;
  assert.ok(ctx.nodes.some(isSource), 'le tout premier son passe, même à l\'instant où le contexte démarre');
  sfx.play('hit');
  assert.equal(ctx.nodes.length, first, 'deuxième appel immédiat ignoré');
  sfx.play('boom');
  const other = ctx.nodes.length;
  assert.ok(other > first, 'un autre son passe');
  ctx.advance(0.05);
  sfx.play('hit');
  assert.ok(ctx.nodes.length > other, 'le même son repasse 50 ms plus tard');
});

test('le volume du joueur et le volume du son règlent le niveau', (t) => {
  fixRandom(t, 0.5);
  const a = ready(0.5), b = ready(0.25);
  const full = played(a.sfx, a.ctx, 'boom').level;
  assert.ok(full > 0);
  assert.ok(near(played(b.sfx, b.ctx, 'boom').level, full / 2), 'volume réglé avant le premier geste');
  assert.ok(near(played(a.sfx, a.ctx, 'boom', 0.5).level, full / 2), 'son joué à moitié');
  a.sfx.setVolume(1);
  assert.ok(near(played(a.sfx, a.ctx, 'boom').level, full * 2), 'volume changé en cours de partie');
});

// Panoramiques traversés par les couches d'un son. Celui du bus est le dernier, juste avant le compresseur.
function panners(p) {
  const all = [...new Set(p.sources.flatMap((s) => [...downstream(s)]).filter((n) => n.kind === 'panner'))];
  const atBus = (n) => n.outputs.some((o) => o.kind === 'compressor');
  return { bus: all.filter(atBus), layers: all.filter((n) => !atBus(n)) };
}

test('un son placé à gauche sort à gauche, sans dépasser -1..1', () => {
  const { sfx, ctx } = ready();
  const panOf = (name, pan) => {
    const { bus } = panners(played(sfx, ctx, name, 1, 0, pan));
    assert.equal(bus.length, 1, 'un seul panoramique de position pour toutes les couches du son');
    return bus[0].pan.value;
  };
  assert.equal(panOf('cast', -0.5), -0.5);
  assert.equal(panOf('cast', 0), 0);
  assert.equal(panOf('cast', 4), 1);
  assert.equal(panOf('go', -4), -1);
});

test('les cuivres s\'ouvrent en stéréo, à gauche et à droite de la position du son', () => {
  const { sfx, ctx } = ready();
  for (const name of ['go', 'boss']) {
    const sides = panners(played(sfx, ctx, name)).layers.map((n) => n.pan.value);
    assert.ok(sides.some((v) => v < 0) && sides.some((v) => v > 0), `${name} : couches à ${sides.join(', ') || 'aucune position'}`);
  }
});

test('variantes : plus l\'événement est gros, plus le son dure ou frappe fort', (t) => {
  fixRandom(t, 0.5);
  const { sfx, ctx } = ready();
  const len = (name, k) => played(sfx, ctx, name, 1, k).length;
  const lvl = (name, k) => played(sfx, ctx, name, 1, k).level;
  assert.ok(len('die', 2) > len('die', 1) && len('die', 1) > len('die', 0), 'mort : boss > joueur > ennemi');
  assert.ok(len('spawn', 1) > len('spawn', 0), 'apparition : boss > ennemi');
  assert.ok(len('win', 2) > len('win', 1) && len('win', 1) > len('win', 0), 'victoire : finale > manche > salle vidée');
  assert.ok(len('lose', 2) > len('lose', 1), 'défaite : finale > manche');
  assert.ok(len('boom', 1) > len('boom', 0), 'explosion : grande zone > petite');
  assert.ok(lvl('hit', 1) > lvl('hit', 0), 'coup porté : gros dégâts > petits');
  assert.ok(lvl('hurt', 1) > lvl('hurt', 0), 'coup reçu : gros dégâts > petits');
});

test('pick : deux notes pour un sort commun, une de plus par niveau de rareté', () => {
  const { sfx, ctx } = ready();
  assert.deepEqual([0, 1, 2, 3].map((k) => played(sfx, ctx, 'pick', 1, k).onsets), [2, 3, 4, 5]);
});

test('un son terminé est débranché de la sortie', () => {
  const { sfx, ctx } = ready();
  const p = played(sfx, ctx, 'boss');
  for (const s of p.sources) assert.equal(reachesOutput(s), true);
  ctx.advance(p.length + 0.5);
  for (const s of p.sources) assert.equal(reachesOutput(s), false);
});
