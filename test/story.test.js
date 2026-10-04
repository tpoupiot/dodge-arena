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

// ---------------------------------------------------------------- ennemis et boss : définitions

import { MOBS, mobDef, MOB_TEAM, ELITE } from '../shared/story/mobs.js';
import { BOSSES, bossDef } from '../shared/story/bosses.js';

test('définition d\'un ennemi : chapitre, élite et nombre de joueurs', () => {
  const base = mobDef('m1', 'rodeur');
  assert.deepEqual(
    { team: base.team, mob: base.mob, maxHp: base.maxHp, spd: base.spd, r: base.r, cc: base.cc, dmg: base.dmg, elite: base.elite, name: base.name },
    { team: MOB_TEAM, mob: 'rodeur', maxHp: 34, spd: 255, r: 28, cc: 1, dmg: 10, elite: false, name: 'Rôdeur' },
  );
  assert.equal(mobDef('m2', 'rodeur', { chapter: 2 }).maxHp, 71);
  assert.equal(mobDef('m2', 'tireur', { chapter: 2 }).dmg, 13);
  const elite = mobDef('m3', 'belier', { chapter: 1, elite: true });
  assert.equal(elite.maxHp, 225);
  assert.equal(elite.r, 45);
  assert.equal(elite.cc, 0.5);
  assert.equal(elite.name, 'Bélier d\'élite');
  assert.ok(Math.abs(elite.atkCd - 4.5 * ELITE.cd) < 1e-9);
  assert.equal(mobDef('m4', 'rodeur', { heroes: 3 }).maxHp, 82);
  const u = createPlayer(elite, 0);
  assert.equal(u.hp, 225);
  assert.equal(u.elite, true);
  assert.equal(u.mob, 'belier');
  assert.deepEqual(Object.keys(MOBS), ['rodeur', 'tireur', 'bombe', 'pyro', 'belier', 'sentinelle']);
});

test('définition d\'un boss : insensible aux contrôles, PV selon le nombre de joueurs', () => {
  const b = bossDef('m9', 'gardien');
  assert.equal(b.maxHp, 620);
  assert.equal(b.cc, 0);
  assert.equal(b.boss, true);
  assert.equal(b.mob, 'gardien');
  assert.equal(b.team, MOB_TEAM);
  assert.equal(bossDef('m9', 'archonte', 3).maxHp, 2600);
  assert.deepEqual(Object.keys(BOSSES), ['gardien', 'forgeronne', 'archonte']);
  assert.equal(createPlayer(b, 0).boss, true);
});

// ---------------------------------------------------------------- salles

import {
  generateRun, CHAPTERS, ROOM_SIZES, BOSS_SIZE, TRAPS, MAX_ALIVE, doorZone, entryPoints,
} from '../shared/story/rooms.js';

test('la même graine donne la même run, une autre graine une autre run', () => {
  assert.deepEqual(generateRun(12), generateRun(12));
  assert.notDeepEqual(generateRun(12), generateRun(13));
});

test('une run : 3 chapitres de 5 salles, chacun terminé par son boss', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const rooms = generateRun(seed);
    assert.equal(rooms.length, 15);
    rooms.forEach((r, i) => {
      const c = CHAPTERS[r.chapter];
      assert.equal(r.index, i);
      assert.equal(r.chapter, Math.floor(i / 5));
      assert.equal(r.n, (i % 5) + 1);
      if (r.n === 5) {
        assert.equal(r.type, 'boss');
        assert.equal(r.boss, c.boss);
        assert.deepEqual({ w: r.w, h: r.h }, BOSS_SIZE);
        assert.equal(r.trap, null);
        assert.deepEqual(r.waves, []);
      } else {
        assert.equal(r.type, 'combat');
        assert.equal(r.boss, null);
        assert.ok(ROOM_SIZES.some((s) => s.w === r.w && s.h === r.h));
        assert.equal(r.waves.length, [1, 2, 2, 3][r.n - 1]);
        for (const wave of r.waves) {
          assert.ok(wave.length >= 1 && wave.length <= MAX_ALIVE);
          for (const m of wave) assert.ok(c.mobs.includes(m.type), `${m.type} au chapitre ${r.chapter + 1}`);
        }
        const elites = r.waves.flat().filter((m) => m.elite);
        assert.ok(elites.length <= 1);
        if (elites.length) {
          assert.ok(r.chapter >= 1 && r.n >= 3, 'élites à partir du chapitre 2, salles 3 et 4');
          assert.ok(r.waves[r.waves.length - 1].includes(elites[0]), 'dans la dernière vague');
        }
      }
      assert.ok(['E', 'N', 'S'].includes(r.exit));
      assert.notEqual(r.exit, r.entry);
      assert.equal(r.entry, i === 0 ? 'W' : { E: 'W', N: 'S', S: 'N' }[rooms[i - 1].exit]);
      if (r.trap) assert.ok(c.traps.includes(r.trap) && TRAPS[r.trap]);
    });
    for (let ch = 0; ch < 3; ch++) {
      const trapped = rooms.filter((r) => r.chapter === ch && r.trap);
      assert.equal(trapped.length, CHAPTERS[ch].trapRooms);
      assert.ok(trapped.every((r) => r.n >= 2 && r.n <= 4), 'jamais la première salle ni celle du boss');
    }
  }
});

test('tailles, portes et décors varient d\'une run à l\'autre', () => {
  const sizes = new Set(), exits = new Set(), decors = new Set(), elites = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    for (const r of generateRun(seed)) {
      if (r.type === 'combat') sizes.add(`${r.w}x${r.h}`);
      exits.add(r.exit);
      decors.add(r.decor);
      if (r.waves.flat().some((m) => m.elite)) elites.add(r.chapter);
    }
  }
  assert.equal(sizes.size, ROOM_SIZES.length);
  assert.equal(exits.size, 3);
  assert.equal(decors.size, 3);
  assert.deepEqual([...elites].sort(), [1, 2]);
});

test('porte et points d\'entrée', () => {
  const room = { w: 1600, h: 900, entry: 'W', exit: 'E' };
  assert.deepEqual(doorZone(room, 'E'), { x0: 1490, y0: 330, x1: 1600, y1: 570 });
  assert.deepEqual(doorZone(room, 'W'), { x0: 0, y0: 330, x1: 110, y1: 570 });
  assert.deepEqual(doorZone(room, 'N'), { x0: 680, y0: 0, x1: 920, y1: 110 });
  assert.deepEqual(doorZone(room, 'S'), { x0: 680, y0: 790, x1: 920, y1: 900 });
  const pts = entryPoints(room, 3);
  assert.deepEqual(pts.map((p) => [p.x, p.y, p.ang]), [[175, 360, 0], [175, 450, 0], [175, 540, 0]]);
  const south = entryPoints({ ...room, entry: 'S' }, 1)[0];
  assert.deepEqual([south.x, south.y], [800, 725]);
  assert.ok(Math.abs(south.ang + Math.PI / 2) < 1e-9, 'tourné vers l\'intérieur de la salle');
});

// ---------------------------------------------------------------- déroulement d'une run

import { StoryMatch, INTRO_DELAY, ROOM_DELAY, EXIT_WAIT } from '../shared/story/match.js';

const LETHAL = { id: 999, dmg: 100000, owner: null, team: 'M', def: 'test', kind: 'line' };

function stepUntil(m, cond, max = 60 * 60) {
  for (let i = 0; i < max && !cond(); i++) m.step();
}

const solo = (seed = 1) => new StoryMatch({ players: [{ id: 'a', name: 'A' }], seed });
const duo = (seed = 1) => new StoryMatch({ players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], seed });

// Tue les ennemis vague après vague jusqu'à ce que la salle soit vidée.
function clearRoom(m) {
  stepUntil(m, () => {
    for (const u of m.mobs.values()) if (u.alive) m.kill(u, null, m.time);
    return m.room.cleared || m.over;
  });
}

// Place un joueur au milieu de la porte de sortie.
function toExit(m, id) {
  const p = m.players.get(id), z = m.room.exit;
  p.x = (z.x0 + z.x1) / 2; p.y = (z.y0 + z.y1) / 2; p.tx = p.x; p.ty = p.y; p.mv = false;
}

// Vide la salle puis fait franchir la porte à tous les joueurs vivants.
function nextRoom(m) {
  clearRoom(m);
  const i = m.room.def.index;
  for (const id of m.order) if (m.players.get(id).alive) toExit(m, id);
  stepUntil(m, () => m.over || m.room.def.index !== i, 10);
}

test('première salle : décompte, annonce puis apparition de la première vague', () => {
  const m = solo(1);
  const def = m.rooms[0];
  const ev = m.events.find((e) => e.e === 'room');
  assert.equal(ev.i, 0);
  assert.equal(ev.of, 5);
  assert.equal(ev.rules.w, def.w);
  assert.equal(ev.rules.playAt, INTRO_DELAY);
  assert.deepEqual(ev.door, m.room.exit);
  assert.equal(m.rules.w, def.w);
  assert.equal(m.rules.h, def.h);
  assert.equal(m.events.filter((e) => e.e === 'warn').length, def.waves[0].length);
  assert.equal(m.mobs.size, 0);
  const h = m.players.get('a');
  assert.ok(h.x < 250, 'entrée à l\'ouest');
  assert.equal(m.botCommand('a', { k: 'move', x: 800, y: 400 }), false, 'immobile pendant le décompte');
  stepUntil(m, () => m.mobs.size > 0);
  assert.ok(m.time > INTRO_DELAY);
  assert.equal(m.mobs.size, def.waves[0].length);
  assert.equal(m.events.filter((e) => e.e === 'spawn').length, def.waves[0].length);
  for (const u of m.mobs.values()) {
    assert.equal(u.team, 'M');
    assert.ok(Math.hypot(u.x - h.x, u.y - h.y) >= 400, 'loin du joueur');
    assert.ok(m.units.includes(u));
  }
});

test('les vagues s\'enchaînent, puis la salle est vidée : coffre et porte', () => {
  const m = solo(1);
  nextRoom(m);
  const def = m.room.def;
  assert.equal(def.index, 1);
  assert.equal(def.waves.length, 2);
  stepUntil(m, () => m.mobs.size > 0);
  for (const u of m.mobs.values()) m.kill(u, null, m.time);
  stepUntil(m, () => m.pending.length > 0, 10);
  assert.equal(m.room.cleared, false);
  assert.equal(m.pending.length, def.waves[1].length, 'deuxième vague annoncée');
  stepUntil(m, () => m.mobs.size > 0);
  assert.equal(m.mobs.size, def.waves[1].length);
  m.drainEvents();
  for (const u of m.mobs.values()) m.kill(u, null, m.time);
  stepUntil(m, () => m.room.cleared, 10);
  const clear = m.events.find((e) => e.e === 'clear');
  assert.deepEqual(clear.chest, { x: def.w / 2, y: def.h / 2, boss: false });
  assert.equal(m.cleared, 2);
  assert.equal(m.spawner, null);
  assert.equal(m.units.length, 1, 'les ennemis morts sont retirés');
});

test('franchir la porte : salle suivante, PV et recharges conservés, contrôles retirés', () => {
  const m = solo(2);
  const h = m.players.get('a');
  clearRoom(m);
  h.hp = 63; h.cds.Q = m.time + 50; h.slowUntil = m.time + 50; h.slowAmt = 0.3;
  const prev = m.room.def;
  m.drainEvents();
  nextRoom(m);
  const def = m.room.def;
  assert.equal(def.index, 1);
  assert.equal(def.entry, { E: 'W', N: 'S', S: 'N' }[prev.exit]);
  assert.equal(h.hp, 63);
  assert.ok(h.cds.Q > m.time);
  assert.equal(h.slowUntil, 0);
  assert.equal(m.phase, 'countdown');
  assert.equal(m.rules.w, def.w);
  assert.equal(m.spells.size, 0);
  const ev = m.events.find((e) => e.e === 'room');
  assert.equal(ev.i, 1);
  assert.ok(Math.abs(ev.rules.playAt - ev.t - ROOM_DELAY) < 1e-9);
});

test('les pièges ne touchent que les joueurs', () => {
  const m = solo(1);
  stepUntil(m, () => m.mobs.size > 0);
  const s = m.addSpell({ kind: 'circle', def: 'eruption', owner: null, target: 'a', t0: m.time, tl: m.time, td: m.time + 0.1, x: 0, y: 0, r: 5000, dmg: 20, fx: '' });
  assert.equal(s.team, 'M');
  stepUntil(m, () => !m.spells.has(s.id), 30);
  assert.equal(m.players.get('a').hp, 80);
  for (const u of m.mobs.values()) assert.equal(u.hp, u.maxHp);
});

test('une salle piégée fait tourner le générateur de l\'arène, limité à son piège', () => {
  const m = solo(1);
  const idx = m.rooms.findIndex((r) => r.trap);
  while (m.room.def.index < idx) nextRoom(m);
  assert.ok(m.spawner);
  assert.deepEqual(m.spawner.p.only, TRAPS[m.room.def.trap].only);
  stepUntil(m, () => m.phase === 'playing');
  m.players.get('a').maxHp = 100000;
  m.players.get('a').hp = 100000;
  const until = m.time + 6;
  stepUntil(m, () => m.time >= until, 60 * 7);
  const traps = m.events.filter((e) => e.e === 'sp' && e.s.owner === null);
  assert.ok(traps.length > 0, 'le piège tire');
  assert.ok(traps.every((e) => m.spawner.p.only.includes(e.s.def)));
});

test('solo : la mort du joueur termine la run en défaite', () => {
  const m = solo(1);
  stepUntil(m, () => m.phase === 'playing');
  const h = m.players.get('a');
  m.hit(LETHAL, h, m.time, h.x, h.y);
  assert.equal(m.over, true);
  assert.equal(m.phase, 'over');
  const end = m.events.find((e) => e.e === 'storyEnd');
  assert.deepEqual({ win: end.win, ch: end.ch, n: end.n, cleared: end.cleared }, { win: false, ch: 0, n: 1, cleared: 0 });
  assert.deepEqual(end.kits.a.build, EMPTY_KIT);
  assert.equal(end.stats.a.deaths, 1);
  m.step();
  assert.equal(m.botCommand('a', { k: 'move', x: 1, y: 1 }), false);
});

test('vider les 15 salles donne la victoire ; battre un boss soigne', () => {
  const m = solo(3);
  const h = m.players.get('a');
  for (let k = 0; k < 20 && !m.over; k++) {
    if (m.room.def.type === 'boss' && m.room.def.index < 14) {
      h.hp = 40;
      clearRoom(m);
      assert.equal(h.hp, h.maxHp, 'soin complet après un boss');
      assert.equal(m.room.chest.boss, true);
    }
    nextRoom(m);
  }
  assert.equal(m.over, true);
  assert.equal(m.result.win, true);
  assert.equal(m.result.cleared, 15);
  assert.ok(m.result.time > 0);
  assert.equal(m.events.filter((e) => e.e === 'room').length, 15);
  assert.equal(m.events.filter((e) => e.e === 'clear').length, 14, 'pas de coffre après le dernier boss');
  assert.equal(m.events.filter((e) => e.e === 'spawn' && e.u.boss).length, 3);
});

test('coop : on change de salle quand tous les vivants sont dans la porte, ou 12 s après le premier', () => {
  const m = duo(1);
  clearRoom(m);
  m.drainEvents();
  toExit(m, 'a');
  stepUntil(m, () => m.room.def.index === 1, 60 * 5);
  assert.equal(m.room.def.index, 0, 'on attend l\'autre joueur');
  const ex = m.events.find((e) => e.e === 'exit');
  assert.deepEqual({ n: ex.n, of: ex.of }, { n: 1, of: 2 });
  assert.equal(ex.until, ex.t + EXIT_WAIT);
  stepUntil(m, () => m.room.def.index === 1, 60 * 8);
  assert.equal(m.room.def.index, 1, 'départ forcé');
  assert.ok(Math.abs(m.time - ex.until) < 0.05);
  // Les deux joueurs dans la porte : départ immédiat.
  clearRoom(m);
  toExit(m, 'a');
  toExit(m, 'b');
  stepUntil(m, () => m.room.def.index === 2, 5);
  assert.equal(m.room.def.index, 2);
});

test('coop : les PV des ennemis suivent le nombre de joueurs', () => {
  const m1 = solo(1), m2 = duo(1);
  stepUntil(m1, () => m1.mobs.size > 0);
  stepUntil(m2, () => m2.mobs.size > 0);
  const u1 = [...m1.mobs.values()][0], u2 = [...m2.mobs.values()][0];
  assert.equal(u1.mob, u2.mob, 'même graine, même salle');
  assert.equal(u2.maxHp, Math.round(u1.maxHp * 1.7));
  assert.equal(m2.players.get('b').color, STORY_COLORS[1]);
});

test('coop : un joueur qui part ne stoppe pas la run ; plus aucun vivant, c\'est la défaite', () => {
  const m = duo(1);
  stepUntil(m, () => m.phase === 'playing');
  m.removePlayer('b');
  assert.equal(m.over, false);
  nextRoom(m);
  assert.equal(m.room.def.index, 1, 'la porte n\'attend que les joueurs présents');
  assert.equal(m.room.heroes, 1);
  // Le dernier vivant s'en va alors que l'autre est mort.
  const m2 = duo(1);
  stepUntil(m2, () => m2.phase === 'playing');
  const a = m2.players.get('a');
  m2.hit(LETHAL, a, m2.time, a.x, a.y);
  assert.equal(m2.over, false, 'b est encore en vie');
  m2.removePlayer('b');
  assert.equal(m2.over, true);
  assert.equal(m2.result.win, false);
  // Un joueur attendu à la porte s'en va : la porte s'ouvre pour l'autre.
  const m3 = duo(1);
  clearRoom(m3);
  toExit(m3, 'a');
  stepUntil(m3, () => false, 30);
  assert.equal(m3.room.def.index, 0);
  m3.removePlayer('b');
  stepUntil(m3, () => m3.room.def.index === 1, 5);
  assert.equal(m3.room.def.index, 1);
});

test('coop : un joueur mort revient à la salle suivante avec la moitié de ses PV', () => {
  const m = duo(1);
  stepUntil(m, () => m.phase === 'playing');
  const b = m.players.get('b');
  m.hit(LETHAL, b, m.time, b.x, b.y);
  assert.equal(b.alive, false);
  assert.equal(m.over, false);
  nextRoom(m);
  assert.equal(b.alive, true);
  assert.equal(b.hp, 50);
  assert.ok(m.events.some((e) => e.e === 'revive' && e.id === 'b' && e.hp === 50));
  assert.equal(m.room.heroes, 2);
});
