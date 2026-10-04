// La prédiction locale du client doit coller à l'état du serveur malgré la latence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../server/app.js';
import { TestClient, nowSec, sleep } from './helpers.js';
import { NetGame } from '../public/js/netgame.js';

test('prédiction locale exacte avec 60 ms de latence et de la gigue', async () => {
  const app = startServer({ port: 0, host: '127.0.0.1' });
  const port = await app.ready;
  const url = `ws://127.0.0.1:${port}/ws`;
  const A = await new TestClient(url, { latency: 60, jitter: 25 }).open('Alice');
  const B = await new TestClient(url).open('Bob');
  const wa = await A.waitType('welcome');
  await B.waitType('welcome');
  A.send({ type: 'create', mode: '1v1' });
  const room = await A.waitType('room');
  A.send({ type: 'settings', mode: '1v1', roundsToWin: 2, env: 'off' });
  await A.waitType('room', 2000, (m) => m.settings.env === 'off');
  B.send({ type: 'join', code: room.code });
  await B.waitType('room');
  A.send({ type: 'ready', v: true });
  B.send({ type: 'ready', v: true });
  const start = await A.waitType('start', 3000);

  const ng = new NetGame({ players: start.players, you: wa.id, settings: start.settings });
  const hist = new Map();
  const errs = [];
  A.on((m) => {
    const now = nowSec();
    if (m.type === 'pong') ng.onPong(m, now);
    if (m.type === 's') {
      const me = m.p.find((p) => p.i === wa.id);
      const h = hist.get(m.t);
      if (h && me && ng.phase.name === 'playing') errs.push(Math.hypot(h.x - me.x, h.y - me.y));
      ng.onSnapshot(m, now);
    }
  });
  const pinger = setInterval(() => A.send({ type: 'ping', c: nowSec() }), 150);
  const frame = setInterval(() => {
    ng.update(nowSec());
    if (ng.local) hist.set(ng.predT, { x: ng.local.x, y: ng.local.y });
  }, 7);
  await sleep(3300);
  for (let i = 0; i < 18; i++) {
    const r = i % 6;
    const cmd = r === 5 ? { k: 'cast', slot: 'D', x: 200 + i * 60, y: 300 } : r === 4 ? { k: 'stop' } : { k: 'move', x: 150 + ((i * 397) % 1300), y: 120 + ((i * 211) % 650) };
    const msg = ng.input(cmd, nowSec());
    if (msg) A.send(msg);
    await sleep(140);
  }
  await sleep(400);
  clearInterval(frame);
  clearInterval(pinger);
  errs.sort((a, b) => a - b);
  assert.ok(errs.length > 50, `échantillons : ${errs.length}`);
  const p95 = errs[Math.floor(errs.length * 0.95)];
  assert.ok(p95 < 1, `erreur de prédiction p95 = ${p95}`);
  A.close();
  B.close();
  await app.close();
});
