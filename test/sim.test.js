// Tests de la simulation partagée (déplacements, sorts, collisions, parties complètes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DT, MOVE_SPEED, ARENA_W, ARENA_H, SUDDEN_DEATH_AT, SLOTS, PLAYER_COLORS } from '../shared/constants.js';
import { ABILITIES, AUTO, DEFAULT_BUILD, sanitizeBuild } from '../shared/abilities.js';
import { createPlayer, stepPlayer, applyCommand, boundsAt } from '../shared/sim.js';
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
