// Mode histoire en ligne : la partie côté client suit la partie serveur.
// Serveur et client tournent dans le même processus, avec une latence et un temps simulés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StoryMatch } from '../shared/story/match.js';
import { applyCard } from '../shared/story/loot.js';
import { NetGame, TimeSync } from '../public/js/netgame.js';
import { DT } from '../shared/constants.js';

const LAT = 0.04;   // latence dans chaque sens (s)

function harness(seed = 1) {
  const m = new StoryMatch({ players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], time: 0, seed });
  const clock = new TimeSync();
  for (let i = 0; i < 5; i++) clock.addSample(i, i + LAT, i + 2 * LAT);
  const ng = new NetGame({ players: m.heroDefs, you: 'a', settings: {}, clock, kind: 'story' });
  const toClient = [], toServer = [], hist = new Map(), errs = [], events = [];
  let ticks = 0;
  const step = () => {
    // Le pas traite tout ce qui est arrivé avant la fin du tick (t1 = m.time + DT), comme le vrai serveur.
    while (toServer.length && toServer[0].at <= m.time + DT) {
      const x = toServer.shift();
      m.queueInput('a', x.s, x.t, x.cmd);
    }
    m.step();
    if (++ticks % 2 === 0 || m.over) toClient.push({ at: m.time + LAT, msg: { ...m.snapshot(), e: m.drainEvents() } });
    const now = m.time;
    while (toClient.length && toClient[0].at <= now) {
      const { msg } = toClient.shift();
      const me = msg.p.find((p) => p.i === 'a');
      const h = hist.get(msg.t);
      if (h && me.al && ng.phase.name === 'playing') errs.push(Math.hypot(h.x - me.x, h.y - me.y));
      events.push(...ng.onSnapshot(msg, now));
    }
    ng.update(now);
    if (ng.local) hist.set(ng.predT, { x: ng.local.x, y: ng.local.y });
  };
  // Envoie une commande comme le ferait le client : prédite tout de suite, reçue par le serveur après la latence.
  const input = (cmd) => {
    const msg = ng.input(cmd, m.time);
    if (!msg) return;
    const { type, s, t, ...wire } = msg;
    toServer.push({ at: m.time + LAT, s, t, cmd: wire });
  };
  const run = (sec) => {
    for (let i = 0; i < sec * 60; i++) step();
  };
  return { m, ng, run, input, errs, events };
}

test('en ligne : salle, ennemis et kit suivent le serveur, la prédiction reste exacte', () => {
  const { m, ng, run, input, errs, events } = harness(1);
  // Le joueur suivi ne doit pas mourir pendant les mesures.
  const hero = m.players.get('a');
  hero.maxHp = 100000;
  hero.hp = 100000;
  run(0.5);
  let v = ng.view();
  assert.equal(v.kind, 'story');
  assert.equal(v.story.room.i, 0);
  assert.equal(v.rules.w, m.rules.w);
  assert.equal(v.phase.name, 'countdown');
  assert.equal(v.players.length, 2);
  assert.deepEqual(v.mobs, []);
  assert.ok(v.story.warns.length > 0);
  run(5);
  v = ng.view();
  assert.equal(v.phase.name, 'playing');
  assert.ok(v.mobs.length > 0);
  assert.equal(v.mobs.length, m.mobs.size);
  const sm = [...m.mobs.values()][0];
  const cm = v.mobs.find((x) => x.id === sm.id);
  assert.ok(Math.hypot(cm.x - sm.x, cm.y - sm.y) < 60, 'position extrapolée proche de celle du serveur');
  assert.equal(cm.st.maxHp, sm.maxHp);
  assert.equal(cm.st.mob, sm.mob);
  // Déplacements, tir, touche vide.
  for (let i = 0; i < 12; i++) {
    const r = i % 4;
    if (r === 3) input({ k: 'cast', slot: 'Q', x: sm.x, y: sm.y });
    else if (r === 2) input({ k: 'cast', slot: 'W', x: 500, y: 500 });
    else input({ k: 'move', x: 200 + ((i * 397) % 900), y: 150 + ((i * 211) % 500) });
    run(0.25);
  }
  // Un sort gagné côté serveur devient utilisable côté client.
  applyCard(hero, { ab: 'flash', rar: 0, slot: 'D' });
  m.emit({ e: 'kit', id: 'a', slot: 'D', ab: 'flash', rar: 0, t: m.time });
  run(0.3);
  assert.equal(ng.view().me.build.D, 'flash');
  input({ k: 'cast', slot: 'D', x: hero.x + 300, y: hero.y });
  run(0.5);
  input({ k: 'move', x: 400, y: 400 });
  run(1);
  errs.sort((x, y) => x - y);
  assert.ok(errs.length > 100, `échantillons : ${errs.length}`);
  const p95 = errs[Math.floor(errs.length * 0.95)];
  assert.ok(p95 < 1, `erreur de prédiction p95 = ${p95}`);
  for (const e of ['room', 'warn', 'spawn', 'go', 'say']) assert.ok(events.some((x) => x.e === e), `événement ${e} relayé`);
  // Un ennemi tué côté serveur disparaît côté client.
  m.kill(sm, null, m.time);
  run(0.3);
  assert.ok(!ng.view().mobs.some((x) => x.id === sm.id));
  // Fin de run.
  for (const id of ['a', 'b']) {
    const p = m.players.get(id);
    if (p.alive) m.kill(p, null, m.time);
  }
  run(0.3);
  assert.equal(ng.view().phase.name, 'over');
  assert.equal(ng.view().story.result.win, false);
});

test('en ligne : une commande de butin part avec son indice', async () => {
  const { cmdToWire } = await import('../public/js/netgame.js');
  assert.deepEqual(cmdToWire({ k: 'loot', i: -1 }), { k: 'loot', i: -1 });
  assert.deepEqual(cmdToWire({ k: 'loot', i: 2 }), { k: 'loot', i: 2 });
  assert.deepEqual(cmdToWire({ k: 'stop' }), { k: 'stop' });
});
