// Tests du mode histoire côté client : état reconstruit à partir des événements, partie locale.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StoryState } from '../shared/story/state.js';
import { LocalGame } from '../public/js/localgame.js';

const ROOM0 = {
  e: 'room', t: 0, rules: { playAt: 5, w: 1600, h: 900 }, i: 0, ch: 0, n: 1, of: 5, type: 'combat', decor: 'runes',
  entry: 'W', exit: 'E', door: { x0: 1490, y0: 330, x1: 1600, y1: 570 }, trap: null, boss: null,
};
const ROOM1 = {
  e: 'room', t: 16, rules: { playAt: 17.5, w: 1400, h: 800 }, i: 1, ch: 0, n: 2, of: 5, type: 'combat', decor: 'dalles',
  entry: 'W', exit: 'N', door: { x0: 580, y0: 0, x1: 820, y1: 110 }, trap: 'fleches', boss: null,
};

test('l\'état de la salle se reconstruit à partir des événements', () => {
  const s = new StoryState('a');
  assert.equal(s.room, null);
  s.apply(ROOM0);
  assert.equal(s.room.decor, 'runes');
  assert.deepEqual(s.room.door, ROOM0.door);
  assert.equal(s.runStart, 5);
  s.apply({ e: 'warn', x: 900, y: 400, r: 28, at: 5, t: 0 });
  s.prune(4);
  assert.equal(s.warns.length, 1);
  s.prune(6);
  assert.equal(s.warns.length, 0);
  s.apply({ e: 'boss', id: 'm9', key: 'gardien', phase: 2, t: 9 });
  assert.deepEqual(s.boss, { id: 'm9', key: 'gardien', phase: 2 });
  s.apply({ e: 'die', id: 'm3', t: 10 });
  assert.ok(s.boss, 'la mort d\'un autre ennemi ne retire pas le boss');
  s.apply({ e: 'die', id: 'm9', t: 10 });
  assert.equal(s.boss, null);
  s.apply({ e: 'warn', x: 100, y: 100, r: 28, at: 99, t: 10 });
  s.apply({ e: 'clear', i: 0, chest: { x: 800, y: 450, boss: false }, t: 11 });
  assert.equal(s.cleared, true);
  assert.deepEqual(s.warns, [], 'plus d\'apparition annoncée une fois la salle vidée');
  assert.deepEqual(s.chest, { x: 800, y: 450, boss: false, opened: false });
  s.apply({ e: 'offer', id: 'b', cards: [], heal: 30, t: 12 });
  assert.equal(s.offer, null, 'le tirage d\'un autre joueur ne nous concerne pas');
  s.apply({ e: 'offer', id: 'a', cards: [{ ab: 'bond', rar: 1, slot: 'E' }], heal: 30, t: 12 });
  assert.equal(s.offer.cards.length, 1);
  assert.equal(s.offer.heal, 30);
  s.apply({ e: 'looted', id: 'b', t: 13 });
  assert.ok(s.offer, 'le choix d\'un autre joueur ne ferme pas notre tirage');
  s.apply({ e: 'looted', id: 'a', t: 13 });
  assert.equal(s.offer, null);
  assert.equal(s.chest.opened, true);
  s.apply({ e: 'exit', n: 1, of: 2, until: 30, t: 14 });
  assert.deepEqual(s.exit, { n: 1, of: 2, until: 30 });
  s.apply({ e: 'say', k: 'intro', t: 14 });
  assert.deepEqual(s.say, { k: 'intro', t: 14 });
});

test('un tirage encore ouvert disparaît au changement de salle', () => {
  const s = new StoryState('a');
  s.apply(ROOM0);
  s.apply({ e: 'clear', i: 0, chest: { x: 800, y: 450, boss: false }, t: 11 });
  s.apply({ e: 'offer', id: 'a', cards: [], heal: 30, t: 15 });
  s.apply(ROOM1);
  assert.equal(s.offer, null);
  assert.equal(s.cleared, false);
  assert.equal(s.chest, null);
  assert.deepEqual(s.exit, { n: 0, of: 0, until: 0 });
  assert.equal(s.room.i, 1);
  assert.equal(s.runStart, 5, 'le chrono de la run ne repart pas');
  s.apply({ e: 'storyEnd', win: false, ch: 0, n: 2, cleared: 1, time: 40, stats: {}, kits: {}, t: 56 });
  assert.equal(s.result.win, false);
});

test('partie locale : la vue expose les ennemis et l\'état de la salle', () => {
  const g = new LocalGame({ kind: 'story', name: 'Tim', seed: 1 });
  assert.equal(g.kind, 'story');
  let v = g.view();
  assert.equal(v.kind, 'story');
  assert.equal(v.phase.name, 'countdown');
  assert.equal(v.story.room.i, 0);
  assert.equal(v.me.build.W, null);
  assert.deepEqual(v.mobs, []);
  assert.ok(v.story.warns.length > 0);
  assert.equal(v.rules.w, g.match.rooms[0].w);
  let now = 0;
  g.update(now);
  for (let i = 0; i < 60 * 6; i++) {
    now += 1 / 60;
    g.update(now);
  }
  v = g.view();
  assert.equal(v.phase.name, 'playing');
  assert.ok(v.mobs.length > 0);
  const mob = v.mobs[0];
  assert.ok(mob.st.mob && mob.color && mob.alive && Number.isFinite(mob.x) && mob.st.r > 0);
  assert.equal(v.players.length, 1);
  assert.equal(v.players[0].name, 'Tim');
  assert.equal(v.players[0].isYou, true);
  // Une commande de butin passe par la partie locale sans erreur.
  g.input({ k: 'loot', i: 0 });
  assert.equal(g.match.room.offers.size, 0);
});

test('partie locale : la fin de run passe la phase à « over »', () => {
  const g = new LocalGame({ kind: 'story', name: 'Tim', seed: 1 });
  const m = g.match, h = m.players.get('you');
  for (let i = 0; i < 60 * 6; i++) m.step();
  m.hit({ id: 99, dmg: 100000, owner: null, team: 'M', def: 'test', kind: 'line' }, h, m.time, h.x, h.y);
  g.absorb(m.drainEvents());
  assert.equal(g.view().phase.name, 'over');
  assert.equal(g.view().story.result.win, false);
});

test('les autres modes de la partie locale ne changent pas', () => {
  const g = new LocalGame({ kind: 'survival', settings: { difficulty: 'normal' }, seed: 1 });
  const v = g.view();
  assert.equal(v.kind, 'survival');
  assert.equal(v.story, undefined);
  assert.equal(v.mobs, undefined);
});

// ---------------------------------------------------------------- record

import { settings } from '../public/js/settings.js';
import { storyBestLine, saveStoryRecord } from '../public/js/story-ui.js';

test('record du mode histoire', () => {
  assert.deepEqual(settings.story, { bestRooms: 0, wins: 0, bestTime: 0 });
  assert.equal(storyBestLine(), 'Aucune descente pour l\'instant.');
  saveStoryRecord({ win: false, cleared: 1, time: 60 });
  assert.equal(storyBestLine(), 'Meilleure descente : 1 salle sur 15.');
  saveStoryRecord({ win: false, cleared: 4, time: 300 });
  saveStoryRecord({ win: false, cleared: 2, time: 90 });
  assert.equal(settings.story.bestRooms, 4, 'le record ne baisse pas');
  assert.equal(storyBestLine(), 'Meilleure descente : 4 salles sur 15.');
  saveStoryRecord({ win: true, cleared: 15, time: 1000 });
  saveStoryRecord({ win: true, cleared: 15, time: 800 });
  saveStoryRecord({ win: true, cleared: 15, time: 950 });
  assert.deepEqual(settings.story, { bestRooms: 15, wins: 3, bestTime: 800 });
  assert.equal(storyBestLine(), 'Meilleure descente : 15 salles sur 15 · 3 victoires, meilleur temps 13:20.0.');
});
