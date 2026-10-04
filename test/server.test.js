// Tests d'intégration du serveur : salons, file rapide, IA, abandon, messages invalides.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { startServer } from '../server/app.js';
import { TestClient, sleep } from './helpers.js';

let app, url, httpUrl;
const clients = [];

before(async () => {
  app = startServer({ port: 0, host: '127.0.0.1' });
  const port = await app.ready;
  url = `ws://127.0.0.1:${port}/ws`;
  httpUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  for (const c of clients) c.close();
  await app.close();
});

async function player(name) {
  const c = await new TestClient(url).open(name);
  clients.push(c);
  const w = await c.waitType('welcome');
  c.id = w.id;
  return c;
}

test('les fichiers du jeu sont servis, sans sortir des dossiers publics', async () => {
  const home = await fetch(httpUrl + '/');
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Dodge Arena/);
  const shared = await fetch(httpUrl + '/shared/sim.js');
  assert.equal(shared.status, 200);
  assert.match(shared.headers.get('content-type'), /javascript/);
  const evil = await fetch(httpUrl + '/shared/..%2fserver%2flobby.js');
  assert.notEqual(evil.status, 200);
});

test('salon privé : création, invitation par code, partie lancée quand tout le monde est prêt', async () => {
  const a = await player('Alice');
  const b = await player('Bob');
  a.send({ type: 'create', mode: '1v1' });
  const room = await a.waitType('room');
  assert.equal(room.code.length, 4);
  assert.equal(room.host, a.id);
  b.send({ type: 'join', code: room.code.toLowerCase() });
  await b.waitType('room', 2000, (m) => m.players.length === 2);
  a.send({ type: 'ready', v: true });
  b.send({ type: 'ready', v: true });
  const start = await b.waitType('start', 2000);
  assert.deepEqual(start.players.map((p) => p.name), ['Alice', 'Bob']);
  const snap = await b.waitType('s', 2000);
  assert.equal(snap.p.length, 2);
  assert.ok(snap.e.some((e) => e.e === 'round'));
  b.send({ type: 'leave' });
  a.send({ type: 'leave' });
});

test('rejoindre un salon inconnu ou complet renvoie une erreur claire', async () => {
  const a = await player('A');
  a.send({ type: 'join', code: 'ZZZZ' });
  const err = await a.waitType('error');
  assert.match(err.msg, /introuvable/);
  const b = await player('B'), c = await player('C');
  a.send({ type: 'create', mode: '1v1' });
  const room = await a.waitType('room');
  b.send({ type: 'join', code: room.code });
  await b.waitType('room');
  c.send({ type: 'join', code: room.code });
  const full = await c.waitType('error');
  assert.match(full.msg, /complet/);
  for (const x of [a, b]) x.send({ type: 'leave' });
});

test('partie rapide 1v1v1 : trois joueurs en file démarrent ensemble', async () => {
  const ps = [await player('P1'), await player('P2'), await player('P3')];
  for (const p of ps) p.send({ type: 'queue', mode: '1v1v1' });
  const starts = await Promise.all(ps.map((p) => p.waitType('start', 3000)));
  for (const s of starts) assert.equal(s.players.length, 3);
  for (const p of ps) p.send({ type: 'leave' });
});

test('l\'hôte peut ajouter des IA et changer les réglages, pas les invités', async () => {
  const h = await player('Hote');
  const g = await player('Invite');
  h.send({ type: 'create', mode: '1v1v1' });
  const room = await h.waitType('room');
  g.send({ type: 'join', code: room.code });
  await g.waitType('room', 2000, (m) => m.players.length === 2);
  g.send({ type: 'settings', mode: '1v1', roundsToWin: 5, env: 'chaos' });
  g.send({ type: 'addBot', level: 'difficile' });
  await sleep(150);
  h.send({ type: 'settings', mode: '1v1v1', roundsToWin: 1, env: 'leger' });
  const r1 = await g.waitType('room', 2000, (m) => m.settings.env === 'leger');
  assert.equal(r1.settings.roundsToWin, 1);
  assert.equal(r1.players.length, 2, 'l\'invité n\'a pas pu ajouter d\'IA');
  h.send({ type: 'addBot', level: 'facile' });
  const r2 = await g.waitType('room', 2000, (m) => m.players.length === 3);
  assert.ok(r2.players[2].bot);
  h.send({ type: 'ready', v: true });
  g.send({ type: 'ready', v: true });
  const start = await g.waitType('start', 2000);
  assert.equal(start.players.length, 3);
  for (const x of [h, g]) x.send({ type: 'leave' });
});

test('si un joueur quitte la partie, l\'autre gagne et le salon revient à l\'attente', async () => {
  const a = await player('Reste');
  const b = await player('Part');
  a.send({ type: 'create', mode: '1v1' });
  const room = await a.waitType('room');
  b.send({ type: 'join', code: room.code });
  await b.waitType('room');
  a.send({ type: 'ready', v: true });
  b.send({ type: 'ready', v: true });
  await a.waitType('start', 2000);
  b.close();
  const end = await a.waitFor((m) => m.type === 's' && m.e.some((e) => e.e === 'matchEnd'), 3000, 'matchEnd');
  assert.equal(end.e.find((e) => e.e === 'matchEnd').winner, a.id);
  const back = await a.waitType('room', 2000, (m) => m.state === 'lobby' && m.players.length === 1);
  assert.equal(back.host, a.id);
  a.send({ type: 'leave' });
});

test('les messages invalides sont ignorés sans faire tomber le serveur', async () => {
  const ws = new WebSocket(url);
  await new Promise((r) => ws.on('open', r));
  ws.send('pas du json');
  ws.send(JSON.stringify({ type: 'in', s: 'x', t: 'y', k: 'cast', slot: 'Z', x: NaN }));
  ws.send(JSON.stringify({ type: 'join', code: { evil: true } }));
  ws.send(JSON.stringify({ type: 'chat', text: 42 }));
  ws.send(JSON.stringify(null));
  await sleep(100);
  const c = await player('Apres');
  c.send({ type: 'ping', c: 1 });
  const pong = await c.waitType('pong');
  assert.equal(pong.c, 1);
  ws.close();
});

// ---------------------------------------------------------------- mode histoire

test('salon histoire : trois places, pas d\'IA, démarre quand les présents sont prêts', async () => {
  const a = await player('Ana');
  a.send({ type: 'create', mode: 'story' });
  const room = await a.waitType('room');
  assert.equal(room.settings.mode, 'story');
  a.send({ type: 'addBot', level: 'normal' });
  assert.match((await a.waitType('error')).msg, /IA/);
  a.send({ type: 'settings', mode: '1v1', roundsToWin: 5, env: 'chaos' });
  const b = await player('Bea');
  b.send({ type: 'join', code: room.code });
  const r2 = await b.waitType('room', 2000, (m) => m.players.length === 2);
  assert.equal(r2.settings.mode, 'story', 'les réglages d\'un salon histoire ne changent pas');
  assert.equal(r2.settings.roundsToWin, 2);
  a.send({ type: 'ready', v: true });
  b.send({ type: 'ready', v: true });
  const start = await b.waitType('start', 2000);
  assert.equal(start.kind, 'story');
  assert.equal(start.players.length, 2);
  for (const p of start.players) {
    assert.equal(p.team, 'P');
    assert.deepEqual(p.loadout.build, { Q: 'trait', W: null, E: null, R: null, D: null, F: null });
  }
  assert.notEqual(start.players[0].color, start.players[1].color);
  const snap = await b.waitType('s', 2000);
  assert.ok(Array.isArray(snap.m));
  assert.equal(snap.e.find((e) => e.e === 'room').i, 0);
  assert.ok(snap.e.some((e) => e.e === 'warn'));
  // Commandes de butin malformées ou sans tirage : ignorées, le serveur reste disponible.
  for (const i of [0, 7, -5, 1.5, 'x', null]) b.send({ type: 'in', s: 1, t: 0, k: 'loot', i });
  b.send({ type: 'ping', c: 5 });
  assert.equal((await b.waitType('pong', 2000, (m) => m.c === 5)).c, 5);
  // Les ennemis arrivent dans les snapshots après le décompte.
  const withMobs = await a.waitFor((m) => m.type === 's' && m.m && m.m.length > 0, 8000, 'ennemis');
  assert.equal(withMobs.m[0].length, 17);
  // Un joueur part : la run continue pour l'autre.
  b.close();
  await a.waitFor((m) => m.type === 's' && m.e.some((e) => e.e === 'left'), 3000, 'left');
  a.clear();
  const later = await a.waitType('s', 2000);
  assert.ok(!later.e.some((e) => e.e === 'storyEnd'));
  a.send({ type: 'leave' });
});

test('salon histoire : un joueur seul lance la run ; pas de partie rapide', async () => {
  const a = await player('Solo');
  a.send({ type: 'queue', mode: 'story' });
  a.send({ type: 'ping', c: 9 });
  await a.waitType('pong', 2000, (m) => m.c === 9);
  assert.ok(!a.msgs.some((m) => m.type === 'queue'), 'la file rapide refuse le mode histoire');
  a.send({ type: 'create', mode: 'story' });
  assert.equal((await a.waitType('room')).players.length, 1);
  a.send({ type: 'ready', v: true });
  const start = await a.waitType('start', 2000);
  assert.equal(start.kind, 'story');
  assert.equal(start.players.length, 1);
  a.send({ type: 'leave' });
});

test('un salon versus annonce son type au démarrage', async () => {
  const a = await player('V1'), b = await player('V2');
  a.send({ type: 'create', mode: '1v1' });
  const room = await a.waitType('room');
  b.send({ type: 'join', code: room.code });
  await b.waitType('room');
  a.send({ type: 'ready', v: true });
  b.send({ type: 'ready', v: true });
  const start = await a.waitType('start', 2000);
  assert.equal(start.kind, 'versus');
  assert.equal((await a.waitType('s', 2000)).m, undefined);
  for (const x of [a, b]) x.send({ type: 'leave' });
});
