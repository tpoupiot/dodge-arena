// État de jeu côté client pour le mode en ligne.
// - Synchro d'horloge avec le serveur (ping/pong).
// - Prédiction immédiate de son propre champion, corrigée à chaque snapshot (réconciliation).
// - Extrapolation des adversaires et calcul exact des sorts (trajectoires déterministes).
// Tout est rendu au "temps d'action" : l'instant serveur où nos commandes prendront effet.
// Ce module n'utilise pas le DOM : il est testable dans Node.

import { DT, PLAYER_RADIUS as R } from '../../shared/constants.js';
import {
  createPlayer, clonePlayer, unpackInto, stepPlayer, applyCommand, extrapolate, spellEnd, linePos, lineEnd,
} from '../../shared/sim.js';
import { clamp, segPointDist2 } from '../../shared/util.js';

export class TimeSync {
  constructor() {
    this.samples = [];
    this.offset = null;
    this.rtt = 0.08;
    this.jitter = 0.01;
  }

  // c : heure client d'envoi, s : heure serveur à la réception, now : heure client au retour (secondes).
  addSample(c, s, now) {
    const rtt = now - c;
    if (!(rtt >= 0 && rtt < 3)) return;
    this.samples.push({ rtt, off: s + rtt / 2 - now });
    if (this.samples.length > 15) this.samples.shift();
    let best = this.samples[0];
    for (const x of this.samples) if (x.rtt < best.rtt) best = x;
    const rtts = this.samples.map((x) => x.rtt).sort((a, b) => a - b);
    this.rtt = rtts[rtts.length >> 1];
    this.jitter = (rtts[Math.floor((rtts.length - 1) * 0.8)] - rtts[0]) / 2;
    if (this.offset === null || Math.abs(best.off - this.offset) > 0.04) this.offset = best.off;
    else this.offset += (best.off - this.offset) * 0.2;
  }

  get synced() {
    return this.offset !== null;
  }

  serverNow(now) {
    return now + (this.offset || 0);
  }

  // Avance prise sur le serveur : demi-aller-retour + marge de gigue + demi-tick.
  targetLead() {
    return clamp(this.rtt / 2 + Math.min(this.jitter, 0.04) + DT / 2, 0.01, 0.25);
  }
}

export class NetGame {
  // players : [{ id, name, color, bot }] (ordre = slots), you : notre id,
  // clock : TimeSync partagé (déjà synchronisé pendant le salon)
  constructor({ players, you, settings, clock }) {
    this.you = you;
    this.settings = settings || {};
    this.kind = 'versus';
    this.clock = clock || new TimeSync();
    this.lead = 0.06;
    this.players = new Map();
    this.order = [];
    players.forEach((def, i) => {
      this.players.set(def.id, createPlayer(def, i));
      this.order.push(def.id);
    });
    this.snapT = null;
    this.local = null;
    this.predT = 0;
    this.pending = [];
    this.seq = 0;
    this.lastStamp = -Infinity;
    this.corr = { x: 0, y: 0 };
    this.remote = new Map(); // id -> { ox, oy } décalage de lissage
    this.spells = new Map();
    this.rules = { playAt: Infinity, shrink: true, allowed: [], frozen: true };
    this.phase = { name: 'waiting', round: 0, scores: {}, winner: null };
    this.renderT = 0;
    this.lastFrame = null;
    this.localFx = [];
    this.localHooks = {
      onBlink: (p, fx, fy, t) => this.localFx.push({ e: 'flash', id: p.id, fx, fy, x: p.x, y: p.y, t, local: true }),
      onDash: (p, t) => this.localFx.push({ e: 'dash', id: p.id, t, local: true }),
      onBuff: (p, slot, t) => this.localFx.push({ e: 'buff', id: p.id, slot, t, local: true }),
      onCast: (p, ab, x, y, t) => this.localFx.push({ e: 'cast', id: p.id, slot: ab.slot, x, y, t, local: true }),
    };
  }

  get ready() {
    return this.snapT !== null && this.clock.synced;
  }

  // ------------------------------------------------------------ entrées

  // Crée le message réseau d'une commande et l'applique tout de suite à la prédiction.
  input(rawCmd, now) {
    if (!this.ready) return null;
    const cmd = cmdToWire(rawCmd); // mêmes valeurs arrondies côté client et serveur
    let t = this.clock.serverNow(now) + this.lead;
    if (t < this.lastStamp) t = this.lastStamp;
    this.lastStamp = t;
    const inp = { seq: ++this.seq, t, cmd, done: false };
    this.pending.push(inp);
    if (this.pending.length > 240) this.pending.shift();
    // Application immédiate si le tick visé est déjà passé dans la prédiction.
    if (this.local && inp.t <= this.predT) {
      applyCommand(this.local, cmd, this.predT, this.rules, this.localHooks);
      inp.done = true;
    }
    return { type: 'in', s: inp.seq, t, ...cmd };
  }

  // ------------------------------------------------------------ réseau

  onPong(msg, now) {
    this.clock.addSample(msg.c, msg.s, now);
  }

  // Applique un snapshot ; renvoie les événements à afficher (effets, sons).
  onSnapshot(msg, now) {
    const out = [];
    const A = this.renderT;
    const before = new Map();
    if (this.snapT !== null) {
      for (const id of this.order) {
        if (id !== this.you) before.set(id, this.remotePos(id, A));
      }
    }

    for (const ev of msg.e) this.applyEvent(ev, out);

    this.snapT = msg.t;
    for (const o of msg.p) {
      const p = this.players.get(o.i);
      if (p) unpackInto(o, p);
    }

    // Lissage des adversaires : on absorbe le saut entre ancienne et nouvelle extrapolation.
    for (const [id, old] of before) {
      const now2 = this.remotePos(id, A, true);
      // old inclut déjà l'ancien décalage : le nouveau décalage garantit la continuité à l'écran.
      const r = this.remote.get(id) || { ox: 0, oy: 0 };
      const dx = old.x - now2.x, dy = old.y - now2.y;
      const big = dx * dx + dy * dy > 140 * 140;
      r.ox = big ? 0 : dx;
      r.oy = big ? 0 : dy;
      this.remote.set(id, r);
    }

    this.reconcile(msg.t);
    return out;
  }

  applyEvent(ev, out) {
    switch (ev.e) {
      case 'round':
        this.rules = { ...ev.rules };
        this.phase = { name: 'countdown', round: ev.round, scores: ev.scores, winner: null, until: ev.rules.playAt };
        this.spells.clear();
        this.pending = this.pending.filter((p) => p.t > ev.t);
        out.push(ev);
        break;
      case 'go':
        this.phase = { ...this.phase, name: 'playing' };
        out.push(ev);
        break;
      case 'sp': {
        const s = { ...ev.s, end: spellEnd(ev.s), cut: Infinity, hiddenAt: null, noPredict: false };
        this.spells.set(s.id, s);
        out.push({ e: 'spell', s });
        break;
      }
      case 'end': {
        const s = this.spells.get(ev.id);
        if (s) {
          s.cut = ev.t;
          s.cutWhy = ev.why;
          s.cx = ev.x;
          s.cy = ev.y;
        }
        out.push(ev);
        break;
      }
      case 'roundEnd':
        this.rules.frozen = true;
        this.phase = { name: 'roundEnd', round: ev.round, scores: ev.scores, winner: ev.winner };
        out.push(ev);
        break;
      case 'matchEnd':
        this.rules.frozen = true;
        this.phase = { name: 'matchEnd', round: this.phase.round, scores: ev.scores, winner: ev.winner, stats: ev.stats };
        out.push(ev);
        break;
      case 'flash':
      case 'dash':
      case 'buff':
        if (ev.id !== this.you) out.push(ev);
        break;
      default:
        out.push(ev);
    }
  }

  // Reconstruit la prédiction locale à partir de l'état serveur + commandes non confirmées.
  reconcile(Ts) {
    const srv = this.players.get(this.you);
    if (!srv) return;
    while (this.pending.length && this.pending[0].seq <= srv.seq) this.pending.shift();
    const st = clonePlayer(srv);
    let t = Ts;
    for (const inp of this.pending) inp.done = false;
    const target = this.local ? Math.max(this.predT, Ts) : Ts;
    let n = 0;
    while (t + DT <= target + 1e-9 && n++ < 120) {
      const tn = t + DT;
      for (const inp of this.pending) {
        if (!inp.done && inp.t <= tn) {
          applyCommand(st, inp.cmd, tn, this.rules, null);
          inp.done = true;
        }
      }
      stepPlayer(st, t, tn, this.rules);
      t = tn;
    }
    if (this.local) {
      const ex = this.local.x - st.x, ey = this.local.y - st.y;
      if (ex * ex + ey * ey > 150 * 150 || !this.local.alive) {
        this.corr.x = 0;
        this.corr.y = 0;
      } else {
        this.corr.x += ex;
        this.corr.y += ey;
      }
    }
    this.local = st;
    this.predT = t;
  }

  // ------------------------------------------------------------ image

  update(now) {
    const frameDt = this.lastFrame === null ? 0 : Math.min(0.1, now - this.lastFrame);
    this.lastFrame = now;
    // L'avance suit doucement la latence mesurée.
    const target = this.clock.targetLead();
    const maxStep = 0.03 * frameDt + 0.0005;
    this.lead += clamp(target - this.lead, -maxStep, maxStep);
    const A = this.clock.serverNow(now) + this.lead;
    this.renderT = A;

    if (this.local) {
      let n = 0;
      while (this.predT + DT <= A + 1e-9 && n++ < 120) {
        const tn = this.predT + DT;
        for (const inp of this.pending) {
          if (!inp.done && inp.t <= tn) {
            applyCommand(this.local, inp.cmd, tn, this.rules, this.localHooks);
            inp.done = true;
          }
        }
        stepPlayer(this.local, this.predT, tn, this.rules);
        this.predT = tn;
      }
    }

    const k = Math.exp(-frameDt * 14);
    this.corr.x *= k;
    this.corr.y *= k;
    for (const r of this.remote.values()) {
      r.ox *= k;
      r.oy *= k;
    }

    this.predictHits(A);
    // Nettoyage des sorts terminés.
    for (const [id, s] of this.spells) if (A > Math.min(s.end, s.cut) + 1.5) this.spells.delete(id);

    const fx = this.localFx;
    this.localFx = [];
    return fx;
  }

  // Position affichée d'un adversaire au temps A (dernier état serveur extrapolé).
  remotePos(id, A, noSmooth) {
    const p = this.players.get(id);
    if (!p || this.snapT === null) return { x: 0, y: 0 };
    let x, y;
    if (!p.alive || A <= this.snapT) {
      x = p.x; y = p.y;
    } else {
      const q = clonePlayer(p);
      let t = this.snapT, n = 0;
      while (t + DT <= A && n++ < 40) {
        stepPlayer(q, t, t + DT, this.rules);
        t += DT;
      }
      const e = extrapolate(q, t, A - t, this.rules);
      x = e.x; y = e.y;
    }
    const r = this.remote.get(id);
    if (r && !noSmooth) {
      x += r.ox;
      y += r.oy;
    }
    return { x, y };
  }

  localPos() {
    if (!this.local) return { x: 0, y: 0 };
    const e = extrapolate(this.local, this.predT, this.renderT - this.predT, this.rules);
    return { x: e.x + this.corr.x, y: e.y + this.corr.y };
  }

  // Masque un projectile dès qu'il touche visuellement un joueur (le serveur confirme ensuite).
  predictHits(A) {
    const prev = this._prevA ?? A;
    this._prevA = A;
    const timeout = Math.max(0.25, this.clock.rtt + 0.12);
    const pos = new Map();
    for (const id of this.order) {
      const p = id === this.you ? this.local : this.players.get(id);
      if (p && p.alive) pos.set(id, id === this.you ? this.localPos() : this.remotePos(id, A));
    }
    for (const s of this.spells.values()) {
      if (s.kind !== 'line' || s.pierce || s.cut < Infinity) continue;
      if (s.hiddenAt !== null) {
        if (A - s.hiddenAt > timeout) {
          s.hiddenAt = null;
          s.noPredict = true;
        }
        continue;
      }
      if (s.noPredict || A < s.tl || A > lineEnd(s)) continue;
      const a = linePos(s, Math.max(s.tl, prev)), b = linePos(s, A);
      const rr = (s.radius + R) ** 2;
      for (const [id, p] of pos) {
        if (id === s.owner) continue;
        if (segPointDist2(a.x, a.y, b.x, b.y, p.x, p.y) < rr) {
          s.hiddenAt = A;
          break;
        }
      }
    }
  }

  // Vue consommée par le moteur de rendu.
  view() {
    const A = this.renderT;
    const players = [];
    for (const id of this.order) {
      const p = this.players.get(id);
      const isYou = id === this.you;
      const st = isYou && this.local ? this.local : p;
      const pos = isYou ? this.localPos() : this.remotePos(id, A);
      players.push({ id, name: p.name, color: p.color, slot: p.slot, bot: p.bot, x: pos.x, y: pos.y, st, isYou, alive: st.alive && !p.left, hp: p.hp });
    }
    return {
      t: A,
      kind: 'versus',
      rules: this.rules,
      phase: this.phase,
      you: this.you,
      me: this.local || this.players.get(this.you),
      players,
      spells: [...this.spells.values()],
      roundsToWin: this.settings.roundsToWin,
    };
  }
}

export function cmdToWire(cmd) {
  if (cmd.k === 'move') return { k: 'move', x: Math.round(cmd.x * 10) / 10, y: Math.round(cmd.y * 10) / 10 };
  if (cmd.k === 'cast') return { k: 'cast', slot: cmd.slot, x: Math.round(cmd.x * 10) / 10, y: Math.round(cmd.y * 10) / 10 };
  return { k: cmd.k };
}
