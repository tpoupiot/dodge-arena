// Gestion des connexions, de la file de matchmaking et des salons.

import { Match } from '../shared/match.js';
import {
  MODES, PLAYER_COLORS, SNAPSHOT_EVERY, DT, MAX_NAME, MAX_CHAT, SLOTS, ARENA_W, ARENA_H,
} from '../shared/constants.js';
import { botName, BOT_LEVELS } from '../shared/bot.js';
import { sanitizeBuild, randomBuild } from '../shared/abilities.js';
import { clamp } from '../shared/util.js';

export const serverNow = () => performance.now() / 1000;

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ENV_LEVELS = ['off', 'leger', 'normal', 'chaos'];
const ROUND_OPTIONS = [1, 2, 3, 5];
const MAX_ROOMS = 500;
const MSG_PER_SEC = 150;

let nextId = 1;
const newId = (prefix) => prefix + (nextId++).toString(36);

function cleanText(s, max) {
  if (typeof s !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

class Client {
  constructor(ws) {
    this.id = newId('p');
    this.ws = ws;
    this.name = 'Joueur';
    this.build = sanitizeBuild(null);
    this.room = null;
    this.queue = null;
    this.msgWindow = 0;
    this.msgCount = 0;
    this.chatTimes = [];
  }

  send(msg) {
    if (this.ws.readyState === 1) this.ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
}

export class Lobby {
  constructor() {
    this.clients = new Set();
    this.rooms = new Map();
    this.queues = { '1v1': [], '1v1v1': [] };
    this.loop = setInterval(() => this.update(), 4);
  }

  close() {
    clearInterval(this.loop);
  }

  update() {
    const now = serverNow();
    for (const room of this.rooms.values()) room.update(now);
  }

  // ------------------------------------------------------------ connexions

  connect(ws) {
    const c = new Client(ws);
    this.clients.add(c);
    ws.on('message', (data, isBinary) => this.onRaw(c, data, isBinary));
    ws.on('close', () => this.disconnect(c));
    ws.on('error', () => {});
    return c;
  }

  disconnect(c) {
    this.dequeue(c);
    this.leaveRoom(c);
    this.clients.delete(c);
  }

  onRaw(c, data, isBinary) {
    if (isBinary) return;
    const now = Date.now();
    if (now - c.msgWindow > 1000) {
      c.msgWindow = now;
      c.msgCount = 0;
    }
    if (++c.msgCount > MSG_PER_SEC) {
      if (c.msgCount > MSG_PER_SEC * 3) c.ws.close(1008, 'flood');
      return;
    }
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== 'string') return;
    try {
      this.handle(c, msg);
    } catch (err) {
      console.error('[lobby] erreur sur le message', msg.type, err);
    }
  }

  handle(c, m) {
    switch (m.type) {
      case 'hello':
        c.name = cleanText(m.name, MAX_NAME) || 'Joueur' + Math.floor(100 + Math.random() * 900);
        if (m.build) c.build = sanitizeBuild(m.build);
        c.send({ type: 'welcome', id: c.id, name: c.name, online: this.clients.size });
        break;
      case 'build':
        c.build = sanitizeBuild(m.build);
        break;
      case 'ping':
        c.send({ type: 'pong', c: m.c, s: serverNow() });
        break;
      case 'queue':
        this.enqueue(c, m.mode);
        break;
      case 'unqueue':
        this.dequeue(c);
        c.send({ type: 'unqueued' });
        break;
      case 'create':
        this.createRoom(c, m.mode);
        break;
      case 'join':
        this.joinRoom(c, m.code);
        break;
      case 'leave':
        this.leaveRoom(c);
        c.send({ type: 'left' });
        break;
      case 'ready':
        if (c.room) c.room.setReady(c, !!m.v);
        break;
      case 'settings':
        if (c.room) c.room.updateSettings(c, m);
        break;
      case 'addBot':
        if (c.room) c.room.addBot(c, m.level);
        break;
      case 'removeBot':
        if (c.room) c.room.removeBot(c, m.id);
        break;
      case 'chat':
        if (c.room) c.room.chat(c, m.text);
        break;
      case 'in':
        if (c.room) c.room.input(c, m);
        break;
    }
  }

  // ------------------------------------------------------------ matchmaking

  enqueue(c, mode) {
    if (!MODES[mode]) return;
    this.leaveRoom(c);
    this.dequeue(c);
    this.queues[mode].push(c);
    c.queue = mode;
    this.tryMatch(mode);
  }

  dequeue(c) {
    if (!c.queue) return;
    const q = this.queues[c.queue];
    const i = q.indexOf(c);
    if (i >= 0) q.splice(i, 1);
    const mode = c.queue;
    c.queue = null;
    this.broadcastQueue(mode);
  }

  tryMatch(mode) {
    const q = this.queues[mode];
    const need = MODES[mode];
    while (q.length >= need) {
      const group = q.splice(0, need);
      const room = this.newRoom(mode, true);
      if (!room) {
        for (const c of group) c.send({ type: 'error', msg: 'Serveur plein, réessaie plus tard.' });
        break;
      }
      for (const c of group) {
        c.queue = null;
        room.addClient(c, true);
      }
      for (const m of room.members.values()) m.ready = true;
      room.broadcastRoom();
      room.maybeStart();
    }
    this.broadcastQueue(mode);
  }

  broadcastQueue(mode) {
    const q = this.queues[mode];
    for (const c of q) c.send({ type: 'queue', mode, count: q.length, need: MODES[mode] });
  }

  // ------------------------------------------------------------ salons

  newRoom(mode, fromQueue) {
    if (this.rooms.size >= MAX_ROOMS) return null;
    let code;
    do {
      code = '';
      for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    } while (this.rooms.has(code));
    const room = new Room(this, code, MODES[mode] ? mode : '1v1', fromQueue);
    this.rooms.set(code, room);
    return room;
  }

  createRoom(c, mode) {
    this.leaveRoom(c);
    this.dequeue(c);
    const room = this.newRoom(mode, false);
    if (!room) return c.send({ type: 'error', msg: 'Serveur plein, réessaie plus tard.' });
    room.addClient(c);
  }

  joinRoom(c, rawCode) {
    const code = cleanText(String(rawCode || ''), 8).toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return c.send({ type: 'error', msg: `Salon ${code || '?'} introuvable.` });
    if (room === c.room) return room.broadcastRoom();
    if (room.state !== 'lobby') return c.send({ type: 'error', msg: 'Une partie est déjà en cours dans ce salon.' });
    if (room.members.size >= room.capacity) return c.send({ type: 'error', msg: 'Ce salon est complet.' });
    this.leaveRoom(c);
    this.dequeue(c);
    room.addClient(c);
  }

  leaveRoom(c) {
    if (c.room) c.room.removeClient(c);
  }

  removeRoom(room) {
    this.rooms.delete(room.code);
  }
}

class Room {
  constructor(lobby, code, mode, fromQueue) {
    this.lobby = lobby;
    this.code = code;
    this.fromQueue = fromQueue;
    this.settings = { mode, roundsToWin: 2, env: 'normal' };
    this.members = new Map();
    this.hostId = null;
    this.state = 'lobby';
    this.match = null;
    this.ticks = 0;
    this.botCount = 0;
  }

  get capacity() {
    return MODES[this.settings.mode];
  }

  humans() {
    return [...this.members.values()].filter((m) => !m.bot);
  }

  broadcast(msg) {
    const str = typeof msg === 'string' ? msg : JSON.stringify(msg);
    for (const m of this.members.values()) if (m.client) m.client.send(str);
  }

  system(text) {
    this.broadcast({ type: 'chat', sys: true, text });
  }

  broadcastRoom() {
    const list = [...this.members.values()];
    this.broadcast({
      type: 'room',
      code: this.code,
      host: this.hostId,
      settings: this.settings,
      state: this.state,
      fromQueue: this.fromQueue,
      players: list.map((m, i) => ({
        id: m.id, name: m.name, ready: m.ready, bot: m.bot, botLevel: m.botLevel || '', color: PLAYER_COLORS[i],
      })),
    });
  }

  addClient(c, silent) {
    this.members.set(c.id, { id: c.id, name: c.name, client: c, bot: false, ready: false });
    c.room = this;
    if (!this.hostId) this.hostId = c.id;
    if (!silent) {
      this.broadcastRoom();
      this.system(`${c.name} a rejoint le salon.`);
    }
  }

  removeClient(c) {
    if (!this.members.has(c.id)) return;
    this.members.delete(c.id);
    c.room = null;
    if (this.match && !this.match.over) this.match.removePlayer(c.id);
    if (this.humans().length === 0) {
      this.lobby.removeRoom(this);
      this.match = null;
      return;
    }
    if (this.hostId === c.id) this.hostId = this.humans()[0].id;
    this.system(`${c.name} a quitté le salon.`);
    this.broadcastRoom();
  }

  isHost(c) {
    return c.id === this.hostId;
  }

  setReady(c, v) {
    const m = this.members.get(c.id);
    if (!m || this.state !== 'lobby') return;
    m.ready = v;
    this.broadcastRoom();
    this.maybeStart();
  }

  updateSettings(c, s) {
    if (!this.isHost(c) || this.state !== 'lobby') return;
    const next = { ...this.settings };
    if (MODES[s.mode]) next.mode = s.mode;
    if (ROUND_OPTIONS.includes(s.roundsToWin)) next.roundsToWin = s.roundsToWin;
    if (ENV_LEVELS.includes(s.env)) next.env = s.env;
    if (MODES[next.mode] < this.members.size) {
      // On retire des IA si besoin pour passer en 1v1.
      for (const m of [...this.members.values()].reverse()) {
        if (this.members.size <= MODES[next.mode]) break;
        if (m.bot) this.members.delete(m.id);
      }
      if (this.members.size > MODES[next.mode]) {
        return c.send({ type: 'error', msg: 'Trop de joueurs dans le salon pour ce mode.' });
      }
    }
    this.settings = next;
    for (const m of this.members.values()) if (!m.bot) m.ready = false;
    this.broadcastRoom();
  }

  addBot(c, level) {
    if (!this.isHost(c) || this.state !== 'lobby') return;
    if (this.members.size >= this.capacity) return c.send({ type: 'error', msg: 'Le salon est déjà complet.' });
    const id = newId('b');
    const botLevel = BOT_LEVELS[level] ? level : 'normal';
    this.members.set(id, { id, name: botName(this.botCount++), client: null, bot: true, botLevel, ready: true });
    this.broadcastRoom();
    this.maybeStart();
  }

  removeBot(c, id) {
    if (!this.isHost(c) || this.state !== 'lobby') return;
    const m = this.members.get(id);
    if (!m || !m.bot) return;
    this.members.delete(id);
    this.broadcastRoom();
  }

  chat(c, raw) {
    const text = cleanText(raw, MAX_CHAT);
    if (!text) return;
    const now = Date.now();
    c.chatTimes = c.chatTimes.filter((t) => now - t < 5000);
    if (c.chatTimes.length >= 5) return;
    c.chatTimes.push(now);
    this.broadcast({ type: 'chat', id: c.id, name: c.name, text });
  }

  maybeStart() {
    if (this.state !== 'lobby' || this.members.size !== this.capacity) return;
    for (const m of this.members.values()) if (!m.ready) return;
    this.startMatch();
  }

  startMatch() {
    const players = [...this.members.values()].map((m, i) => ({
      id: m.id, name: m.name, color: PLAYER_COLORS[i], bot: m.bot, botLevel: m.botLevel,
      build: m.bot ? randomBuild() : m.client.build,
    }));
    this.match = new Match({
      kind: 'versus',
      players,
      settings: { roundsToWin: this.settings.roundsToWin, env: this.settings.env },
      time: serverNow(),
    });
    this.state = 'ingame';
    this.ticks = 0;
    this.broadcast({ type: 'start', players, settings: this.settings, t: this.match.time });
    this.broadcastRoom();
  }

  update(now) {
    const match = this.match;
    if (!match || this.state !== 'ingame') return;
    let n = 0;
    while (match.time + DT <= now && n < 30) {
      match.step();
      n++;
      this.ticks++;
      if (this.ticks % SNAPSHOT_EVERY === 0 || match.over) {
        this.sendSnapshot();
        if (match.over) return this.endMatch();
      }
    }
  }

  sendSnapshot() {
    const snap = this.match.snapshot();
    this.broadcast({ type: 's', t: snap.t, p: snap.p, e: this.match.drainEvents() });
  }

  endMatch() {
    this.state = 'lobby';
    for (const m of this.members.values()) m.ready = !!m.bot;
    this.broadcastRoom();
  }

  input(c, m) {
    const match = this.match;
    if (!match || match.over || this.state !== 'ingame') return;
    const seq = Number.isInteger(m.s) ? m.s : 0;
    const t = Number(m.t);
    const fx = Number(m.x), fy = Number(m.y);
    let cmd = null;
    if (m.k === 'move' && Number.isFinite(fx) && Number.isFinite(fy)) {
      cmd = { k: 'move', x: clamp(fx, -200, ARENA_W + 200), y: clamp(fy, -200, ARENA_H + 200) };
    } else if (m.k === 'stop') {
      cmd = { k: 'stop' };
    } else if (m.k === 'attack' && typeof m.id === 'string' && m.id.length < 24) {
      cmd = { k: 'attack', id: m.id };
    } else if (m.k === 'cast' && SLOTS.includes(m.slot) && Number.isFinite(fx) && Number.isFinite(fy)) {
      cmd = { k: 'cast', slot: m.slot, x: clamp(fx, -2000, ARENA_W + 2000), y: clamp(fy, -2000, ARENA_H + 2000) };
    }
    if (cmd) match.queueInput(c.id, seq, t, cmd);
  }
}
