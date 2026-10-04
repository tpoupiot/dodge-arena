// Tests de la généralisation du moteur : stats par unité, équipes, rareté, points d'extension.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DT, MOVE_SPEED, MAX_HP, PLAYER_RADIUS, SLOTS, ARENA_W } from '../shared/constants.js';
import { AUTO } from '../shared/abilities.js';
import { createPlayer, stepPlayer, applyCommand, extrapolate } from '../shared/sim.js';

const rules = { playAt: 0, shrink: false, allowed: SLOTS, frozen: false };

function run(p, from, seconds, world) {
  let t = from;
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    stepPlayer(p, t, t + DT, rules, world);
    t += DT;
  }
  return t;
}

test('une unité a par défaut les stats d\'un joueur et sa propre équipe', () => {
  const p = createPlayer({ id: 'a', name: 'A', color: '#fff' }, 0);
  assert.equal(p.team, 'a');
  assert.equal(p.r, PLAYER_RADIUS);
  assert.equal(p.maxHp, MAX_HP);
  assert.equal(p.hp, MAX_HP);
  assert.equal(p.spd, MOVE_SPEED);
  assert.equal(p.cc, 1);
  assert.equal(p.mob, '');
  assert.equal(p.elite, false);
  assert.equal(p.boss, false);
  assert.equal(p.rar, null);
});

test('une unité garde les stats de sa définition', () => {
  const m = createPlayer({ id: 'm1', name: 'Bélier', color: '#b45309', team: 'M', mob: 'belier', elite: true, r: 45, maxHp: 150, spd: 170, cc: 0.5 }, 0);
  assert.equal(m.team, 'M');
  assert.equal(m.hp, 150);
  assert.equal(m.elite, true);
  assert.equal(m.boss, false);
  m.x = 400; m.y = 450;
  applyCommand(m, { k: 'move', x: 1200, y: 450 }, 1, rules);
  run(m, 1, 1);
  assert.ok(Math.abs(m.x - 570) < 1, `x=${m.x}`);
  // Le rayon sert au bord de l'arène et à l'interpolation visuelle.
  applyCommand(m, { k: 'move', x: 5000, y: 450 }, 2, rules);
  run(m, 2, 12);
  assert.equal(m.x, ARENA_W - 45);
  m.x = ARENA_W - 46; m.tx = 5000; m.mv = true;
  assert.equal(extrapolate(m, 14, 0.2, rules).x, ARENA_W - 45);
});

test('un soin ne dépasse pas les PV max de l\'unité', () => {
  const p = createPlayer({ id: 'a', name: 'A', color: '#fff', maxHp: 150, build: { F: 'soin' } }, 0);
  p.hp = 140;
  assert.ok(applyCommand(p, { k: 'cast', slot: 'F', x: 0, y: 0 }, 1, rules));
  assert.equal(p.hp, 150);
});

test('auto-attaque : portée mesurée jusqu\'au bord de la cible, un allié n\'est pas une cible', () => {
  const a = createPlayer({ id: 'a', name: 'A', color: '#fff', team: 'P' }, 0);
  const ally = createPlayer({ id: 'b', name: 'B', color: '#fff', team: 'P' }, 1);
  const big = createPlayer({ id: 'm1', name: 'Boss', color: '#fff', team: 'M', r: 80 }, 0);
  a.x = 400; a.y = 450; ally.x = 500; ally.y = 450;
  big.x = 400 + AUTO.range + 70; big.y = 450;
  const units = new Map([['a', a], ['b', ally], ['m1', big]]);
  let shots = 0;
  const world = { get: (id) => units.get(id), onAttack: () => { shots++; } };
  applyCommand(a, { k: 'attack', id: 'm1' }, 1, rules);
  run(a, 1, 0.1, world);
  assert.equal(shots, 1, 'tire sans avancer');
  assert.equal(a.x, 400);
  applyCommand(a, { k: 'attack', id: 'b' }, 2, rules);
  run(a, 2, 0.1, world);
  assert.equal(a.atk, null, 'cible alliée abandonnée');
  assert.equal(shots, 1);
});

// ---------------------------------------------------------------- rareté et touches vides

import { ABILITIES, RARITIES, scaled, abilityOf, describe } from '../shared/abilities.js';
import { Match } from '../shared/match.js';
import { PLAYER_COLORS } from '../shared/constants.js';

test('la rareté multiplie dégâts, soins et boucliers, et réduit la recharge', () => {
  assert.equal(RARITIES.length, 4);
  assert.equal(scaled('trait', 0), ABILITIES.trait, 'niveau 0 : le sort d\'origine');
  const leg = scaled('trait', 3);
  assert.equal(leg.dmg, 36);
  assert.equal(leg.cd, 1);
  assert.equal(leg.rarity, 3);
  assert.equal(scaled('javelot', 2).dmgMax, 42);
  assert.equal(scaled('soin', 1).heal, 25);
  assert.equal(scaled('barriere', 3).shield, 90);
  assert.equal(scaled('flux', 2).markDmg, 30);
  assert.equal(scaled('flash', 3).cd, 9.8);
  assert.equal(scaled('flash', 3).range, 400, 'les autres champs ne changent pas');
  assert.equal(scaled('trait', 3), leg, 'mis en cache');
  assert.equal(ABILITIES.trait.dmg, 18, 'le sort d\'origine n\'est pas modifié');
});

test('un niveau de rareté hors bornes ou un sort inconnu ne cassent rien', () => {
  assert.equal(scaled('trait', 9).dmg, 36, 'borné au niveau maximum');
  assert.equal(scaled('trait', -2), ABILITIES.trait);
  assert.equal(scaled('trait', 1.7).rarity, 1);
  assert.equal(scaled('trait', undefined), ABILITIES.trait);
  assert.equal(scaled('inconnu', 2), undefined);
  const p = createPlayer({ id: 'a', name: 'A', color: '#fff', loadout: { build: { Q: 'inconnu', W: null }, rar: { Q: 7, W: 0 } } }, 0);
  assert.equal(abilityOf(p, 'Q'), undefined);
  assert.equal(applyCommand(p, { k: 'cast', slot: 'Q', x: 0, y: 0 }, 1, rules), false);
});

test('une touche vide ne lance rien, un kit applique sa rareté', () => {
  const p = createPlayer({ id: 'a', name: 'A', color: '#fff', loadout: {
    build: { Q: 'trait', W: null, E: null, R: null, D: null, F: null },
    rar: { Q: 2, W: 0, E: 0, R: 0, D: 0, F: 0 },
  } }, 0);
  assert.equal(abilityOf(p, 'W'), undefined);
  assert.equal(abilityOf(p, 'Q').dmg, 27);
  assert.equal(applyCommand(p, { k: 'cast', slot: 'W', x: 0, y: 0 }, 1, rules), false);
  assert.ok(applyCommand(p, { k: 'cast', slot: 'Q', x: 100, y: 0 }, 1, rules));
  assert.equal(p.cds.Q, 1 + scaled('trait', 2).cd, 'recharge de la rareté');
  // Un build classique reste complété par les sorts par défaut.
  const v = createPlayer({ id: 'b', name: 'B', color: '#fff', build: { Q: 'lien' } }, 0);
  assert.equal(abilityOf(v, 'Q').id, 'lien');
  assert.equal(abilityOf(v, 'W').id, 'eruption');
  assert.equal(abilityOf({ build: null }, 'E').id, 'bond');
});

test('les descriptions affichent les chiffres réels du sort', () => {
  assert.equal(describe(ABILITIES.trait), 'Projectile rapide et fin, 18 dégâts.');
  assert.equal(describe(scaled('trait', 3)), 'Projectile rapide et fin, 36 dégâts.');
  assert.match(describe(scaled('javelot', 1)), /de 10 à 35 dégâts selon la distance, maximum dès 600 unités/);
  for (const id in ABILITIES) {
    for (let lvl = 0; lvl < RARITIES.length; lvl++) {
      const text = describe(scaled(id, lvl));
      assert.ok(!/[{}]|undefined|NaN/.test(text), `${id} : ${text}`);
    }
  }
});

test('l\'événement de buff porte le soin réellement rendu', () => {
  const m = new Match({ kind: 'versus', players: [
    { id: 'a', name: 'A', color: PLAYER_COLORS[0], loadout: {
      build: { Q: 'trait', W: null, E: null, R: null, D: 'soin', F: null },
      rar: { Q: 0, W: 0, E: 0, R: 0, D: 2, F: 0 },
    } },
    { id: 'b', name: 'B', color: PLAYER_COLORS[1] },
  ], settings: { env: 'off' }, seed: 1 });
  for (let i = 0; i < 60 * 4 && m.phase !== 'playing'; i++) m.step();
  m.players.get('a').hp = 40;
  assert.equal(m.botCommand('a', { k: 'cast', slot: 'D', x: 0, y: 0 }), true);
  assert.equal(m.players.get('a').hp, 70);
  assert.equal(m.events.find((e) => e.e === 'buff').heal, 30);
});
