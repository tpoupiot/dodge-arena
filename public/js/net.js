// Connexion WebSocket au serveur : salons, file d'attente, chat et partie en cours.

import { NetGame, TimeSync } from './netgame.js';

const nowSec = () => performance.now() / 1000;

export class Online {
  // h : { onRoom, onQueue, onStart, onEvents, onChat, onError, onLeft, onClose }
  constructor(h) {
    this.h = h;
    this.ws = null;
    this.id = null;
    this.room = null;
    this.game = null;
    this.clock = new TimeSync();
    this.pingTimer = null;
    this.connecting = null;
  }

  get connected() {
    return !!(this.ws && this.ws.readyState === 1 && this.id);
  }

  get ping() {
    return this.clock.samples.length ? this.clock.rtt * 1000 : null;
  }

  connect(name, build) {
    if (this.connected) return Promise.resolve();
    if (this.connecting) return this.connecting;
    this.clock = new TimeSync(); // nouvelle connexion : on repart de mesures fraîches
    this.connecting = new Promise((resolve, reject) => {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      let ws;
      try {
        ws = new WebSocket(`${proto}//${location.host}/ws`);
      } catch (err) {
        this.connecting = null;
        reject(err);
        return;
      }
      this.ws = ws;
      let welcomed = false;
      const timer = setTimeout(() => ws.close(), 7000);
      ws.onopen = () => ws.send(JSON.stringify({ type: 'hello', name, build }));
      ws.onmessage = (ev) => {
        let m;
        try {
          m = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (m.type === 'welcome' && !welcomed) {
          welcomed = true;
          clearTimeout(timer);
          this.id = m.id;
          this.connecting = null;
          this.startPing();
          resolve(m);
        }
        this.onMessage(m);
      };
      ws.onclose = () => {
        clearTimeout(timer);
        this.stopPing();
        this.ws = null;
        this.id = null;
        this.room = null;
        this.game = null;
        this.connecting = null;
        if (!welcomed) reject(new Error('connexion impossible'));
        else if (this.h.onClose) this.h.onClose();
      };
      ws.onerror = () => {};
    });
    return this.connecting;
  }

  send(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  startPing() {
    this.stopPing();
    const tick = () => this.send({ type: 'ping', c: nowSec() });
    tick();
    // Pings rapprochés au début pour caler l'horloge, puis réguliers.
    let n = 0;
    this.pingTimer = setInterval(() => {
      tick();
      if (++n === 8) {
        clearInterval(this.pingTimer);
        this.pingTimer = setInterval(tick, 400);
      }
    }, 120);
  }

  stopPing() {
    clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  onMessage(m) {
    const now = nowSec();
    switch (m.type) {
      case 'pong':
        this.clock.addSample(m.c, m.s, now);
        break;
      case 'room':
        this.room = m;
        if (this.h.onRoom) this.h.onRoom(m);
        break;
      case 'queue':
        if (this.h.onQueue) this.h.onQueue(m);
        break;
      case 'start':
        this.game = new NetGame({ players: m.players, you: this.id, settings: m.settings, clock: this.clock });
        if (this.h.onStart) this.h.onStart(this.game, m);
        break;
      case 's':
        if (this.game) {
          const evs = this.game.onSnapshot(m, now);
          if (this.h.onEvents) this.h.onEvents(evs);
        }
        break;
      case 'chat':
        if (this.h.onChat) this.h.onChat(m);
        break;
      case 'error':
        if (this.h.onError) this.h.onError(m.msg);
        break;
      case 'left':
        this.room = null;
        this.game = null;
        if (this.h.onLeft) this.h.onLeft();
        break;
    }
  }

  input(cmd) {
    if (!this.game) return;
    const msg = this.game.input(cmd, nowSec());
    if (msg) this.send(msg);
  }

  queue(mode) {
    this.send({ type: 'queue', mode });
  }

  unqueue() {
    this.send({ type: 'unqueue' });
  }

  create(mode) {
    this.send({ type: 'create', mode });
  }

  join(code) {
    this.send({ type: 'join', code });
  }

  leave() {
    this.game = null;
    this.send({ type: 'leave' });
  }

  ready(v) {
    this.send({ type: 'ready', v });
  }

  settings(s) {
    this.send({ type: 'settings', ...s });
  }

  addBot(level) {
    this.send({ type: 'addBot', level });
  }

  removeBot(id) {
    this.send({ type: 'removeBot', id });
  }

  sendBuild(build) {
    this.send({ type: 'build', build });
  }

  chat(text) {
    this.send({ type: 'chat', text });
  }
}
