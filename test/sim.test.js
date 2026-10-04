// Tests de la simulation partagée (déplacements, sorts, collisions, parties complètes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DT, MOVE_SPEED, ARENA_W, ARENA_H, SUDDEN_DEATH_AT, SLOTS, PLAYER_COLORS, arenaSize } from '../shared/constants.js';
import { ABILITIES, AUTO, DEFAULT_BUILD, sanitizeBuild } from '../shared/abilities.js';
import { createPlayer, stepPlayer, applyCommand, boundsAt, packPlayer, unpackInto } from '../shared/sim.js';
import { Match } from '../shared/match.js';

const rules = { playAt: 0, shrink: false, allowed: SLOTS, frozen: false };

function run(p, from, seconds) {
  let t = from;
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    stepPlayer(p, t, t + DT, rules);
    t += DT;
  }
  return t;
}

test('le joueur avance vers sa cible à la vitesse de base puis s\'arrête', () => {
  const p = createPlayer({ id: 'a', name: 'A', color: '#fff' }, 0);
  p.x = 400; p.y = 450;
  applyCommand(p, { k: 'move', x: 1200, y: 450 }, 1, rules);
  run(p, 1, 1);
  assert.ok(Math.abs(p.x - (400 + MOVE_SPEED)) < 1, `x=${p.x}`);
  run(p, 2, 5);
  assert.equal(p.x, 1200);
  assert.equal(p.mv, false);
});

test('le délai d\'incantation immobilise puis le déplacement reprend', () => {
  const p = createPlayer({ id: 'a', name: 'A', color: '#fff' }, 0);
  p.x = 400; p.y = 450;
  applyCommand(p, { k: 'move', x: 1200, y: 450 }, 1, rules);
  assert.ok(applyCommand(p, { k: 'cast', slot: 'Q', x: 400, y: 100 }, 1, rules));
  run(p, 1, ABILITIES.trait.windup - DT);
  assert.equal(p.x, 400, 'immobile pendant l\'incantation');
  run(p, 1 + ABILITIES.trait.windup, 0.5);
  assert.ok(p.x > 500, 'reprend sa route');
  assert.equal(applyCommand(p, { k: 'cast', slot: 'Q', x: 0, y: 0 }, 1.5, rules), false, 'Q en recharge');
});

test('Flash : 400 unités max, recharge, impossible enraciné', () => {
  const p = createPlayer({ id: 'a', name: 'A', color: '#fff' }, 0);
  p.x = 800; p.y = 450;
  assert.ok(applyCommand(p, { k: 'cast', slot: 'D', x: 1600, y: 450 }, 1, rules));
  assert.equal(Math.round(p.x), 1200);
  assert.equal(applyCommand(p, { k: 'cast', slot: 'D', x: 0, y: 450 }, 2, rules), false);
  const q = createPlayer({ id: 'b', name: 'B', color: '#fff' }, 0);
  q.rootUntil = 5;
  assert.equal(applyCommand(q, { k: 'cast', slot: 'D', x: 0, y: 450 }, 1, rules), false);
  assert.equal(applyCommand(q, { k: 'cast', slot: 'E', x: 0, y: 450 }, 1, rules), false);
  assert.ok(applyCommand(q, { k: 'cast', slot: 'Q', x: 0, y: 450 }, 1, rules), 'on peut tirer enraciné');
});

test('rien ne bouge pendant le décompte', () => {
  const p = createPlayer({ id: 'a', name: 'A', color: '#fff' }, 0);
  const r = { ...rules, playAt: 10 };
  assert.equal(applyCommand(p, { k: 'move', x: 0, y: 0 }, 5, r), false);
});

test('l\'arène rétrécit en mort subite', () => {
  const r = { playAt: 0, shrink: true };
  assert.deepEqual(boundsAt(r, 10), { x0: 0, y0: 0, x1: ARENA_W, y1: ARENA_H });
  const b = boundsAt(r, SUDDEN_DEATH_AT + 100);
  assert.ok(b.x1 - b.x0 < ARENA_W * 0.5);
});

function duel(seed) {
  const players = [
    { id: 'a', name: 'A', color: PLAYER_COLORS[0] },
    { id: 'b', name: 'B', color: PLAYER_COLORS[1] },
  ];
  return new Match({ kind: 'versus', players, settings: { roundsToWin: 2, env: 'off' }, seed });
}

function stepUntil(m, cond, max = 60 * 30) {
  for (let i = 0; i < max && !cond(); i++) m.step();
}

test('un Q touche une cible immobile, inflige des dégâts et disparaît', () => {
  const m = duel(1);
  stepUntil(m, () => m.phase === 'playing');
  const a = m.players.get('a'), b = m.players.get('b');
  m.queueInput('a', 1, m.time, { k: 'cast', slot: 'Q', x: b.x, y: b.y });
  let hit = null;
  stepUntil(m, () => {
    hit = m.events.find((e) => e.e === 'hit');
    return !!hit;
  }, 120);
  assert.ok(hit, 'le sort touche');
  assert.equal(hit.tid, 'b');
  assert.equal(b.hp, 100 - ABILITIES.trait.dmg);
  assert.equal(m.spells.size, 0);
  assert.equal(m.stats.a.hits, 1);
  assert.ok(a.hp === 100);
});

test('un étourdissement pendant l\'incantation annule le sort', () => {
  const m = duel(2);
  stepUntil(m, () => m.phase === 'playing');
  const a = m.players.get('a'), b = m.players.get('b');
  m.queueInput('a', 1, m.time, { k: 'cast', slot: 'Q', x: b.x, y: b.y });
  m.step();
  assert.equal(m.spells.size, 1);
  const spell = [...m.spells.values()][0];
  m.hit({ id: 99, dmg: 1, stun: 1, owner: null, def: 'test' }, a, m.time, a.x, a.y);
  assert.equal(m.spells.has(spell.id), false);
  assert.ok(m.events.some((e) => e.e === 'end' && e.why === 'cancel'));
});

test('une partie 1v1 entre IA se termine avec un vainqueur', () => {
  const players = [
    { id: 'a', name: 'A', color: PLAYER_COLORS[0], bot: true, botLevel: 'normal' },
    { id: 'b', name: 'B', color: PLAYER_COLORS[1], bot: true, botLevel: 'normal' },
  ];
  const m = new Match({ kind: 'versus', players, settings: { roundsToWin: 2, env: 'normal' }, seed: 7 });
  stepUntil(m, () => m.over, 60 * 600);
  assert.ok(m.over);
  assert.equal(m.scores[m.winner], 2);
});

test('une partie 1v1v1 entre IA se termine avec un vainqueur', () => {
  const players = ['a', 'b', 'c'].map((id, i) => ({ id, name: id, color: PLAYER_COLORS[i], bot: true, botLevel: 'normal' }));
  const m = new Match({ kind: 'versus', players, settings: { roundsToWin: 1, env: 'normal' }, seed: 11 });
  stepUntil(m, () => m.over, 60 * 600);
  assert.ok(m.over);
  assert.equal(m.scores[m.winner], 1);
});

test('la survie se termine et donne un temps', () => {
  const m = new Match({ kind: 'survival', players: [{ id: 'you', name: 'Toi', color: '#fff' }], settings: { difficulty: 'difficile' }, seed: 3 });
  stepUntil(m, () => m.over, 60 * 300);
  assert.ok(m.over, 'un joueur immobile finit par tomber');
  assert.ok(m.result.survived > 1);
});

test('en survie, seuls les sorts E, D et F sont utilisables', () => {
  const m = new Match({ kind: 'survival', players: [{ id: 'you', name: 'Toi', color: '#fff' }], settings: { difficulty: 'normal' }, seed: 3 });
  stepUntil(m, () => m.phase === 'playing');
  assert.equal(m.botCommand('you', { k: 'cast', slot: 'Q', x: 0, y: 0 }), false);
  assert.equal(m.botCommand('you', { k: 'cast', slot: 'D', x: 100, y: 100 }), true);
});

test('auto-attaque : clic droit sur un ennemi, poursuite puis projectile qui touche', () => {
  const m = duel(5);
  stepUntil(m, () => m.phase === 'playing');
  const b = m.players.get('b');
  m.queueInput('a', 1, m.time, { k: 'attack', id: 'b' });
  let hit = null;
  stepUntil(m, () => {
    hit = m.events.find((e) => e.e === 'hit' && e.def === 'auto');
    return !!hit;
  }, 60 * 4);
  assert.ok(hit, 'l\'auto-attaque finit par toucher');
  assert.equal(b.hp, 100 - AUTO.dmg);
  assert.ok(Math.hypot(m.players.get('a').x - b.x, m.players.get('a').y - b.y) <= AUTO.range + 40, 'a s\'est rapproché');
});

test('le build choisit les sorts : un Grappin sur Q attire la cible', () => {
  const players = [
    { id: 'a', name: 'A', color: PLAYER_COLORS[0], build: { ...DEFAULT_BUILD, Q: 'grappin' } },
    { id: 'b', name: 'B', color: PLAYER_COLORS[1] },
  ];
  const m = new Match({ kind: 'versus', players, settings: { roundsToWin: 2, env: 'off' }, seed: 4 });
  stepUntil(m, () => m.phase === 'playing');
  const a = m.players.get('a'), b = m.players.get('b');
  const before = Math.abs(b.x - a.x);
  m.queueInput('a', 1, m.time, { k: 'cast', slot: 'Q', x: b.x, y: b.y });
  stepUntil(m, () => m.events.some((e) => e.e === 'hit'), 120);
  stepUntil(m, () => !b.dash, 60);
  assert.ok(Math.abs(b.x - a.x) < before - 200, 'la cible a été attirée');
});

test('bouclier et voile anti-sort réduisent ou bloquent les dégâts', () => {
  const m = duel(6);
  stepUntil(m, () => m.phase === 'playing');
  const b = m.players.get('b');
  b.shield = 10; b.shieldUntil = m.time + 2;
  m.hit({ id: 98, dmg: 18, owner: 'a', def: 'q', kind: 'line' }, b, m.time, b.x, b.y);
  assert.equal(b.hp, 92);
  b.spellShieldUntil = m.time + 1;
  m.hit({ id: 97, dmg: 18, owner: 'a', def: 'q', kind: 'line' }, b, m.time, b.x, b.y);
  assert.equal(b.hp, 92, 'sort bloqué');
});

test('un build invalide est corrigé', () => {
  const b = sanitizeBuild({ Q: 'flash', W: 'nimporte', D: 'soin', F: 'soin' });
  assert.equal(b.Q, DEFAULT_BUILD.Q);
  assert.equal(b.W, DEFAULT_BUILD.W);
  assert.notEqual(b.D, b.F);
});

// ---------------------------------------------------------------- taille de l'arène

test('l\'arène garde sa taille en 1v1 et s\'agrandit en 1v1v1', () => {
  assert.deepEqual(arenaSize(1), { w: ARENA_W, h: ARENA_H });
  assert.deepEqual(arenaSize(2), { w: ARENA_W, h: ARENA_H });
  const big = arenaSize(3);
  assert.ok(big.w > ARENA_W && big.h > ARENA_H);
  assert.equal(big.w / big.h, ARENA_W / ARENA_H, 'même format');

  assert.equal(duel(1).rules.w, ARENA_W);
  const players = ['a', 'b', 'c'].map((id, i) => ({ id, name: id, color: PLAYER_COLORS[i] }));
  const m = new Match({ kind: 'versus', players, settings: { roundsToWin: 1, env: 'off' }, seed: 1 });
  assert.equal(m.rules.w, big.w);
  assert.equal(m.rules.h, big.h);
  assert.deepEqual(boundsAt(m.rules, 0), { x0: 0, y0: 0, x1: big.w, y1: big.h });
  const round = m.events.find((e) => e.e === 'round');
  assert.equal(round.rules.w, big.w, 'la taille est envoyée aux clients');
  // Apparitions centrées sur la grande arène et plus écartées qu'avant.
  const ps = [...m.players.values()];
  const cx = ps.reduce((s, p) => s + p.x, 0) / 3;
  assert.ok(Math.abs(cx - big.w / 2) < 1, `cx=${cx}`);
  assert.ok(Math.max(...ps.map((p) => Math.hypot(p.x - big.w / 2, p.y - big.h / 2))) > 420);
  // On peut marcher jusqu'au bord de la grande arène.
  stepUntil(m, () => m.phase === 'playing');
  const a = m.players.get('a');
  m.queueInput('a', 1, m.time, { k: 'move', x: 5000, y: a.y });
  m.step();
  stepUntil(m, () => !a.mv, 60 * 10);
  assert.ok(a.x > ARENA_W, `x=${a.x}`);
  // La mort subite rétrécit autour du centre de la grande arène.
  const b = boundsAt({ ...m.rules, playAt: 0 }, SUDDEN_DEATH_AT + 100);
  assert.equal((b.x0 + b.x1) / 2, big.w / 2);
});

test('les sorts de l\'arène couvrent la grande arène en 1v1v1', () => {
  const players = ['a', 'b', 'c'].map((id, i) => ({ id, name: id, color: PLAYER_COLORS[i] }));
  const m = new Match({ kind: 'versus', players, settings: { roundsToWin: 9, env: 'chaos' }, seed: 5 });
  let far = 0;
  for (let i = 0; i < 60 * 40 && !m.over; i++) {
    m.step();
    for (const s of m.spells.values()) if (!s.owner && s.kind === 'line') far = Math.max(far, s.ox);
  }
  assert.ok(far > ARENA_W + 1, `un projectile part du bord droit agrandi (max ox=${far})`);
});

// ---------------------------------------------------------------- nouveaux sorts

function duelWith(build, seed = 1) {
  const players = [
    { id: 'a', name: 'A', color: PLAYER_COLORS[0], build: { ...DEFAULT_BUILD, ...build } },
    { id: 'b', name: 'B', color: PLAYER_COLORS[1] },
  ];
  const m = new Match({ kind: 'versus', players, settings: { roundsToWin: 2, env: 'off' }, seed });
  stepUntil(m, () => m.phase === 'playing');
  return m;
}

function castAndWaitHit(m, slot, def) {
  const b = m.players.get('b');
  m.drainEvents();
  m.queueInput('a', 1, m.time, { k: 'cast', slot, x: b.x, y: b.y });
  stepUntil(m, () => m.events.some((e) => e.e === 'hit' && e.def === def), 60 * 3);
  return m.events.find((e) => e.e === 'hit' && e.def === def);
}

test('Flux marqué : marque sans dégâts, le sort suivant du lanceur fait exploser la marque', () => {
  const m = duelWith({ W: 'flux' });
  const b = m.players.get('b');
  assert.ok(castAndWaitHit(m, 'W', ABILITIES.flux.def), 'le flux touche');
  assert.equal(b.hp, 100, 'aucun dégât');
  assert.ok(b.markUntil > m.time);
  assert.equal(b.markBy, 'a');
  assert.ok(castAndWaitHit(m, 'Q', ABILITIES.trait.def));
  assert.equal(b.hp, 100 - ABILITIES.trait.dmg - ABILITIES.flux.markDmg);
  assert.ok(!(b.markUntil > m.time), 'marque consommée');
  // Sans marque : dégâts normaux.
  const before = b.hp;
  m.hit({ id: 90, dmg: 10, owner: 'a', def: 'q', kind: 'line' }, b, m.time, b.x, b.y);
  assert.equal(b.hp, before - 10);
});

test('Flux marqué : la marque expire et ne profite qu\'à son lanceur', () => {
  const m = duelWith({ W: 'flux' });
  const b = m.players.get('b');
  castAndWaitHit(m, 'W', ABILITIES.flux.def);
  m.hit({ id: 91, dmg: 10, owner: null, def: 'trait', kind: 'line' }, b, m.time, b.x, b.y);
  assert.equal(b.hp, 90, 'un sort de l\'arène ne déclenche pas la marque');
  assert.ok(b.markUntil > m.time);
  m.hit({ id: 92, dmg: 10, owner: 'a', def: 'q', kind: 'line' }, b, b.markUntil + 0.1, b.x, b.y);
  assert.equal(b.hp, 80, 'marque expirée');
});

test('Javelot : les dégâts augmentent avec la distance parcourue', () => {
  const ab = ABILITIES.javelot;
  const dmgAt = (dist) => {
    const m = duelWith({ Q: 'javelot' });
    const a = m.players.get('a'), b = m.players.get('b');
    b.x = a.x + dist; b.y = a.y;
    castAndWaitHit(m, 'Q', ab.def);
    return 100 - b.hp;
  };
  const near = dmgAt(150), far = dmgAt(ab.range - 100);
  assert.ok(near >= ab.dmg && near < ab.dmg + 6, `près=${near}`);
  assert.ok(far > ab.dmgMax - 6 && far <= ab.dmgMax, `loin=${far}`);
});

test('Stase : invulnérable mais immobile et sans sort', () => {
  const m = duelWith({ E: 'stase' });
  const a = m.players.get('a');
  m.queueInput('a', 1, m.time, { k: 'cast', slot: 'E', x: a.x, y: a.y });
  m.step();
  assert.ok(a.stasisUntil > m.time);
  m.hit({ id: 93, dmg: 30, stun: 1, owner: 'b', def: 'q', kind: 'line' }, a, m.time, a.x, a.y);
  m.hit({ id: 94, dmg: 6, owner: 'b', def: 'auto', kind: 'homing' }, a, m.time, a.x, a.y);
  assert.equal(a.hp, 100);
  assert.ok(!(a.stunUntil > m.time), 'aucun contrôle');
  const x = a.x;
  m.queueInput('a', 2, m.time, { k: 'move', x: 0, y: a.y });
  m.queueInput('a', 3, m.time, { k: 'cast', slot: 'Q', x: 0, y: a.y });
  for (let i = 0; i < 30; i++) m.step();
  assert.equal(a.x, x, 'immobile');
  assert.equal(m.spells.size, 0, 'aucun sort lancé');
  stepUntil(m, () => m.time > a.stasisUntil + 0.5, 60 * 3);
  assert.ok(a.x < x, 'repart ensuite');
  m.hit({ id: 95, dmg: 30, owner: 'b', def: 'q', kind: 'line' }, a, m.time, a.x, a.y);
  assert.equal(a.hp, 70);
});

test('Barrage : traverse tous les joueurs sur son passage', () => {
  const players = [
    { id: 'a', name: 'A', color: PLAYER_COLORS[0], build: { ...DEFAULT_BUILD, R: 'barrage' } },
    { id: 'b', name: 'B', color: PLAYER_COLORS[1] },
    { id: 'c', name: 'C', color: PLAYER_COLORS[2] },
  ];
  const m = new Match({ kind: 'versus', players, settings: { roundsToWin: 2, env: 'off' }, seed: 2 });
  stepUntil(m, () => m.phase === 'playing');
  const a = m.players.get('a'), b = m.players.get('b'), c = m.players.get('c');
  a.x = 100; a.y = 500; b.x = 700; b.y = 520; c.x = 1900; c.y = 480;
  m.queueInput('a', 1, m.time, { k: 'cast', slot: 'R', x: 1000, y: 500 });
  stepUntil(m, () => c.hp < 100, 60 * 5);
  assert.equal(b.hp, 100 - ABILITIES.barrage.dmg);
  assert.equal(c.hp, 100 - ABILITIES.barrage.dmg);
});

test('les nouveaux états passent par le snapshot réseau', () => {
  const p = createPlayer({ id: 'a', name: 'A', color: '#fff' }, 0);
  p.markUntil = 5; p.markBy = 'b'; p.stasisUntil = 4;
  const q = unpackInto(packPlayer(p, 1), createPlayer({ id: 'a', name: 'A', color: '#fff' }, 0));
  assert.equal(q.markUntil, 5);
  assert.equal(q.markBy, 'b');
  assert.equal(q.stasisUntil, 4);
});
