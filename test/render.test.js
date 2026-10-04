// Test de fumée du rendu : le code de dessin s'exécute sans erreur sur de vraies vues de jeu.
// Le canvas est simulé : toute méthode est acceptée, les propriétés écrites sont relues telles quelles.
import { test } from 'node:test';
import assert from 'node:assert/strict';

let calls = 0;

function fakeCtx() {
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get(o, k) {
      if (k in o) return o[k];
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
      if (k === 'measureText') return (s) => ({ width: String(s).length * 7 });
      return () => {
        calls++;
      };
    },
    set(o, k, v) {
      o[k] = v;
      return true;
    },
  });
}

const fakeCanvas = () => ({ width: 0, height: 0, style: {}, getContext: () => fakeCtx() });
globalThis.window = { devicePixelRatio: 1, innerWidth: 1600, innerHeight: 900 };
globalThis.document = { createElement: () => fakeCanvas() };

const { Renderer } = await import('../public/js/render.js');
const { Fx } = await import('../public/js/fx.js');
const { LocalGame } = await import('../public/js/localgame.js');
const { Pilot } = await import('../tools/pilot.js');

function renderer() {
  const r = new Renderer(fakeCanvas());
  r.setMode('game');
  return r;
}

test('rendu des modes existants', () => {
  const r = renderer();
  const games = [
    new LocalGame({ kind: 'survival', settings: { difficulty: 'difficile' }, seed: 2 }),
    new LocalGame({ kind: 'versus', bots: 2, settings: { roundsToWin: 1, env: 'chaos' }, seed: 2 }),
  ];
  for (const g of games) {
    const fx = new Fx();
    for (let i = 0; i < 60 * 12; i++) {
      g.match.step();
      g.absorb(g.match.drainEvents());
      if (i % 20 === 0) {
        r.render(g.view(), fx, { aim: { slot: 'QWERDF'[(i / 20) % 6], x: 500, y: 300 }, perf: { fps: 60, ping: null }, best: 0, dodges: 0, survived: 0 });
      }
    }
  }
  assert.ok(calls > 1000);
});

test('rendu d\'une run histoire complète, salle après salle', () => {
  const r = renderer();
  const fx = new Fx();
  const g = new LocalGame({ kind: 'story', name: 'Tim', seed: 11 });
  const pilot = new Pilot(g.match, 'you', { god: true });
  const seen = new Set();
  for (let i = 0; i < 60 * 60 * 40 && !g.match.over; i++) {
    pilot.update();
    g.match.step();
    g.absorb(g.match.drainEvents());
    if (i % 15 === 0) {
      const v = g.view();
      for (const m of v.mobs) seen.add(m.st.mob);
      // Visée sur chaque touche à tour de rôle, y compris une touche encore vide.
      r.render(v, fx, { aim: { slot: 'QWERDF'[(i / 15) % 6], x: 700, y: 300 }, perf: { fps: 60, ping: 20 } });
    }
  }
  assert.equal(g.match.result.win, true);
  for (const k of ['gardien', 'forgeronne', 'archonte']) assert.ok(seen.has(k), `${k} dessiné`);
  r.render(g.view(), fx, {});
});

test('rendu de chaque ennemi, de chaque boss et des éléments de salle', () => {
  const r = renderer();
  const fx = new Fx();
  const g = new LocalGame({ kind: 'story', name: 'Tim', seed: 2 });
  const m = g.match;
  const sync = (n) => {
    for (let i = 0; i < n; i++) {
      m.step();
      g.absorb(m.drainEvents());
    }
  };
  sync(60 * 6);
  const h = m.players.get('you');
  h.maxHp = 100000;
  h.hp = 100000;
  let x = 300;
  for (const type of ['rodeur', 'tireur', 'bombe', 'pyro', 'belier', 'sentinelle']) {
    m.addMob({ type, elite: false, x, y: 250 }, m.time);
    m.addMob({ type, elite: true, x, y: 550 }, m.time);
    x += 130;
  }
  for (const boss of ['gardien', 'forgeronne', 'archonte']) m.addMob({ boss, x: (x += 60), y: 400 }, m.time);
  const target = [...m.mobs.values()].find((u) => u.mob === 'sentinelle');
  m.hit({ id: 98, dmg: 1, stun: 1, root: 1, slow: 0.3, slowDur: 1, mark: 2, markDmg: 5, owner: 'you', team: 'P', def: 'flux', kind: 'line' }, target, m.time, target.x, target.y);
  m.botCommand('you', { k: 'attack', id: target.id });
  const before = calls;
  for (let i = 0; i < 60 * 5; i++) {
    sync(1);
    if (i % 6 === 0) r.render(g.view(), fx, {});
  }
  assert.ok(calls > before + 5000);
  // Salle vidée : coffre, porte ouverte, consigne.
  for (const u of m.mobs.values()) if (u.alive) m.kill(u, null, m.time);
  sync(3);
  assert.equal(g.view().story.cleared, true);
  r.render(g.view(), fx, {});
  h.x = m.room.chest.x;
  h.y = m.room.chest.y;
  sync(1);
  g.input({ k: 'loot', i: -1 });
  sync(1);
  assert.equal(g.view().story.chest.opened, true);
  r.render(g.view(), fx, {});
  // Éléments de coop : allié, joueur à terre, compteur de porte.
  const v = g.view();
  v.players.push({ ...v.players[0], id: 'ally', name: 'Ami', isYou: false, color: '#4ade80' });
  v.players.push({ ...v.players[0], id: 'down', name: 'Tombé', isYou: false, alive: false, color: '#f1f5f9' });
  v.story.exit = { n: 1, of: 2, until: v.t + 5 };
  r.render(v, fx, {});
  v.me = { ...v.me, alive: false };
  v.players[0].alive = false;
  r.render(v, fx, {});
});
