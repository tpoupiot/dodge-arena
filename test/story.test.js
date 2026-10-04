// Tests du mode histoire : butin, salles, ennemis, boss, déroulement d'une run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ABILITIES } from '../shared/abilities.js';
import { createPlayer } from '../shared/sim.js';
import { mulberry32 } from '../shared/util.js';
import {
  startLoadout, heroDef, drawOffer, applyCard, slotFor, rollRarity, STORY_TEAM, STORY_COLORS, SKIP_HEAL,
} from '../shared/story/loot.js';

const EMPTY_KIT = { Q: 'trait', W: null, E: null, R: null, D: null, F: null };
const FULL_KIT = { W: 'eruption', E: 'bond', R: 'meteore', D: 'flash', F: 'soin' };

// Joueur du mode histoire, avec un kit de départ éventuellement complété.
function hero(build = {}, rar = {}) {
  const def = heroDef({ id: 'a', name: 'A' }, 0);
  Object.assign(def.loadout.build, build);
  Object.assign(def.loadout.rar, rar);
  return createPlayer(def, 0);
}

test('kit de départ : un seul sort sur Q, équipe et couleur d\'allié', () => {
  const h = hero();
  assert.deepEqual(h.build, EMPTY_KIT);
  assert.deepEqual(h.rar, { Q: 0, W: 0, E: 0, R: 0, D: 0, F: 0 });
  assert.equal(h.team, STORY_TEAM);
  assert.equal(h.color, STORY_COLORS[0]);
  assert.equal(heroDef({ id: 'c', name: 'C' }, 2).color, STORY_COLORS[2]);
  assert.notEqual(startLoadout().build, startLoadout().build, 'un kit neuf par joueur');
  assert.equal(SKIP_HEAL, 30);
});

test('un coffre propose 3 sorts sur 3 touches différentes, surtout des touches vides', () => {
  const rng = mulberry32(42);
  let empty = 0, total = 0;
  for (let i = 0; i < 200; i++) {
    const cards = drawOffer(rng, hero(), 0);
    assert.equal(cards.length, 3);
    assert.equal(new Set(cards.map((c) => c.slot)).size, 3);
    assert.equal(new Set(cards.map((c) => c.ab)).size, 3);
    for (const c of cards) {
      assert.ok(ABILITIES[c.ab], c.ab);
      assert.ok(c.rar >= 0 && c.rar <= 2, 'pas de légendaire au chapitre 1');
      total++;
      if (c.slot !== 'Q') empty++;
    }
  }
  assert.ok(empty / total > 0.85, `touches vides : ${empty}/${total}`);
});

test('un coffre ne propose jamais moins bien que le kit', () => {
  const rng = mulberry32(7);
  const h = hero(FULL_KIT, { Q: 1, W: 2, E: 1, R: 3, D: 1, F: 2 });
  for (let i = 0; i < 300; i++) {
    for (const c of drawOffer(rng, h, 2)) {
      assert.ok(c.rar >= h.rar[c.slot], `${c.ab} ${c.rar} sur ${c.slot}`);
      if (c.ab === h.build[c.slot]) assert.ok(c.rar > h.rar[c.slot], 'même sort : seulement en amélioration');
      if (ABILITIES[c.ab].slot !== 'S') assert.equal(c.slot, ABILITIES[c.ab].slot);
      else if (c.ab === 'flash') assert.equal(c.slot, 'D', 'un sort d\'invocateur possédé garde sa touche');
      else if (c.ab === 'soin') assert.equal(c.slot, 'F');
      else assert.equal(c.slot, 'D', 'sinon la touche la moins rare');
    }
  }
});

test('coffre de boss : au moins du Rare, table du chapitre suivant', () => {
  const rng = mulberry32(3);
  let legendary = 0;
  for (let i = 0; i < 400; i++) {
    const r = rollRarity(rng, 0, true);
    assert.ok(r >= 1);
    if (r === 3) legendary++;
  }
  assert.ok(legendary > 0, 'la table du chapitre 2 permet le légendaire');
  for (let i = 0; i < 400; i++) assert.ok(rollRarity(rng, 0, false) <= 2);
  for (let i = 0; i < 50; i++) assert.ok(rollRarity(rng, 2, true) >= 1, 'pas de table après le chapitre 3');
});

test('tout au maximum : le coffre propose moins de 3 cartes', () => {
  const h = hero(FULL_KIT, { Q: 3, W: 3, E: 3, R: 3, D: 3, F: 3 });
  assert.deepEqual(drawOffer(mulberry32(1), h, 0), []);
});

test('même graine, même tirage', () => {
  assert.deepEqual(drawOffer(mulberry32(5), hero(), 1), drawOffer(mulberry32(5), hero(), 1));
});

test('prendre une carte place le sort sur sa touche, prêt à être lancé', () => {
  const h = hero();
  h.cds.W = 99;
  applyCard(h, { ab: 'salve', rar: 2, slot: 'W' });
  assert.equal(h.build.W, 'salve');
  assert.equal(h.rar.W, 2);
  assert.equal(h.cds.W, 0);
  assert.equal(slotFor(h, 'flash'), 'D', 'D d\'abord');
  applyCard(h, { ab: 'flash', rar: 0, slot: 'D' });
  assert.equal(slotFor(h, 'purge'), 'F', 'puis la touche vide restante');
  assert.equal(slotFor(h, 'flash'), 'D');
});
