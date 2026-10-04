// IA : esquive les sorts en évaluant des trajets candidats, tire sur l'adversaire le plus proche.
// Elle tourne là où tourne la partie (serveur pour le mode en ligne, navigateur pour l'entraînement).

import { PLAYER_RADIUS as R } from './constants.js';
import { ABILITIES } from './abilities.js';
import { boundsAt, canCast, linePos, lineEnd, speedAt } from './sim.js';
import { gauss, segPointDist2, clamp } from './util.js';

export const BOT_LEVELS = {
  facile: { react: 0.3, think: 0.18, aimErr: 0.15, lead: 0.35, notice: 0.75, blink: 0.35, aggro: 0.45, margin: 4, label: 'Facile' },
  normal: { react: 0.2, think: 0.11, aimErr: 0.07, lead: 0.7, notice: 0.92, blink: 0.75, aggro: 0.75, margin: 8, label: 'Normale' },
  difficile: { react: 0.13, think: 0.07, aimErr: 0.035, lead: 0.95, notice: 1, blink: 1, aggro: 1, margin: 12, label: 'Difficile' },
};

const HORIZON = 1.1;
const STEP = 0.05;
const tmpA = { x: 0, y: 0, ph: 0 };
const tmpB = { x: 0, y: 0, ph: 0 };

function weightOf(s) {
  return (s.dmg || 10) + (s.stun ? 30 : 0) + (s.root ? 18 : 0) + (s.pull ? 18 : 0) + (s.slow ? 6 : 0);
}

export class Bot {
  constructor(match, id, level) {
    this.m = match;
    this.id = id;
    this.L = BOT_LEVELS[level] || BOT_LEVELS.normal;
    this.prefDist = 560 + match.rng() * 160;
    this.reset();
  }

  reset() {
    this.nextThink = 0;
    this.nextAttack = 0;
    this.goal = null;
    this.seen = new Map();
    this.track = new Map();
    this.tgt = null;
    this.tgtUntil = 0;
    this.cur = null;
  }

  get me() {
    return this.m.players.get(this.id);
  }

  cmd(c) {
    return this.m.botCommand(this.id, c);
  }

  update(t) {
    const me = this.me;
    if (!me || !me.alive) return;
    if (t < this.nextThink) return;
    this.nextThink = t + this.L.think * (0.8 + this.m.rng() * 0.4);
    this.trackEnemies(t);
    this.cur = this.m.kind === 'versus' ? this.chooseTarget(t) : null;
    const spells = this.visibleSpells(t);
    this.plan(t, spells);
    if (this.m.kind === 'versus') this.attack(t, spells);
  }

  // ------------------------------------------------------------ perception

  visibleSpells(t) {
    const out = [];
    for (const s of this.m.spells.values()) {
      if (s.owner === this.id) continue;
      let vis = this.seen.get(s.id);
      if (vis === undefined) {
        // Les sorts des joueurs se lisent à partir du lancement du projectile, ceux de l'arène dès la charge.
        const base = s.owner ? (s.tl ?? s.t0) : s.t0;
        vis = base + this.L.react * (s.owner ? 0.85 : 1) + (this.m.rng() < this.L.notice ? 0 : 0.35);
        this.seen.set(s.id, vis);
      }
      if (t >= vis) out.push(s);
    }
    if (this.seen.size > 300) {
      for (const id of this.seen.keys()) if (!this.m.spells.has(id)) this.seen.delete(id);
    }
    return out;
  }

  trackEnemies(t) {
    for (const p of this.m.players.values()) {
      if (p.id === this.id) continue;
      const tr = this.track.get(p.id);
      if (!tr) {
        this.track.set(p.id, { x: p.x, y: p.y, t, vx: 0, vy: 0 });
        continue;
      }
      const dt = t - tr.t;
      if (dt <= 0) continue;
      const vx = (p.x - tr.x) / dt, vy = (p.y - tr.y) / dt;
      const k = 0.6;
      tr.vx = tr.vx * (1 - k) + vx * k;
      tr.vy = tr.vy * (1 - k) + vy * k;
      if (Math.hypot(tr.vx, tr.vy) > 600) { tr.vx = 0; tr.vy = 0; } // Flash / Bond : on ignore
      tr.x = p.x; tr.y = p.y; tr.t = t;
    }
  }

  enemies() {
    const out = [];
    for (const p of this.m.players.values()) if (p.id !== this.id && p.alive) out.push(p);
    return out;
  }

  // Garde sa cible quelques secondes et évite de s'acharner à plusieurs IA sur le même joueur.
  chooseTarget(t) {
    if (this.tgt && t < this.tgtUntil) {
      const p = this.m.players.get(this.tgt);
      if (p && p.alive) return p;
    }
    const me = this.me;
    let best = null, bs = Infinity;
    for (const e of this.enemies()) {
      let sc = Math.hypot(e.x - me.x, e.y - me.y) + e.hp * 1.5 + this.m.rng() * 220;
      for (const b of this.m.bots.values()) if (b !== this && b.tgt === e.id) sc += 380;
      if (sc < bs) { bs = sc; best = e; }
    }
    this.tgt = best ? best.id : null;
    this.tgtUntil = t + 4 + this.m.rng() * 4;
    return best;
  }

  // ------------------------------------------------------------ danger

  // Premier instant (s) où le sort s touche un joueur qui attend `delay` puis marche de (x0,y0) vers la cible.
  hitTime(s, x0, y0, ux, uy, len, v, delay, t, margin) {
    for (let tau = 0; tau <= HORIZON; tau += STEP) {
      const tt = t + tau;
      const d = Math.min(len, Math.max(0, tau - delay) * v);
      const px = x0 + ux * d, py = y0 + uy * d;
      switch (s.kind) {
        case 'line': {
          if (tt < s.tl) break;
          const end = lineEnd(s);
          if (tt - STEP > end) return Infinity;
          const a = linePos(s, Math.max(s.tl, tt - STEP), tmpA);
          const b = linePos(s, Math.min(end, tt), tmpB);
          const rr = s.radius + R + margin;
          if (segPointDist2(a.x, a.y, b.x, b.y, px, py) < rr * rr) return tau;
          break;
        }
        case 'circle': {
          if (tt - STEP > s.td) return Infinity;
          if (tt >= s.td) {
            const rr = s.r + R + margin;
            if ((px - s.x) ** 2 + (py - s.y) ** 2 < rr * rr) return tau;
          }
          break;
        }
        case 'beam': {
          if (tt - STEP > s.te) return Infinity;
          if (tt >= s.ta && !s.hit.has(this.id)) {
            const rr = s.hw + R + margin;
            if (segPointDist2(s.ax, s.ay, s.bx, s.by, px, py) < rr * rr) return tau;
          }
          break;
        }
        case 'ring': {
          if (tt - STEP > s.te) return Infinity;
          if (tt >= s.ta && !s.hit.has(this.id)) {
            const dd = Math.hypot(px - s.x, py - s.y);
            if (Math.abs(dd - s.r) < s.th / 2 + R + margin) return tau;
          }
          break;
        }
      }
    }
    return Infinity;
  }

  pathDanger(x0, y0, x1, y1, v, delay, t, spells) {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const ux = len > 0 ? dx / len : 0, uy = len > 0 ? dy / len : 0;
    let total = 0, first = Infinity;
    for (const s of spells) {
      const h = this.hitTime(s, x0, y0, ux, uy, len, v, delay, t, this.L.margin);
      if (h < Infinity) {
        total += weightOf(s) * (1.6 - h / HORIZON);
        if (h < first) first = h;
      }
    }
    return { total, first };
  }

  standDanger(t, duration, spells, x, y) {
    const me = this.me;
    x = x ?? me.x; y = y ?? me.y;
    let total = 0;
    for (const s of spells) {
      const h = this.hitTime(s, x, y, 0, 0, 0, 0, 0, t, this.L.margin);
      if (h <= duration) total += weightOf(s);
    }
    return total;
  }

  strategic(x, y, b) {
    const me = this.me;
    let c = 0;
    const edge = Math.min(x - b.x0, b.x1 - x, y - b.y0, b.y1 - y);
    if (edge < 170) c += (170 - edge) * 0.03;
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    if (this.m.kind === 'survival') {
      c += Math.hypot(x - cx, y - cy) * 0.004;
    } else {
      const e = this.cur;
      if (e) {
        const pref = me.hp < e.hp - 20 ? this.prefDist + 150 : this.prefDist;
        c += Math.abs(Math.hypot(x - e.x, y - e.y) - pref) * 0.006;
      }
      c += Math.hypot(x - cx, y - cy) * 0.0015;
    }
    c += Math.hypot(x - me.x, y - me.y) * 0.0008;
    return c;
  }

  // ------------------------------------------------------------ déplacement

  plan(t, spells) {
    const me = this.me, m = this.m, L = this.L;
    const rules = m.rules;
    const b = boundsAt(rules, t + 0.6);
    const v = speedAt(me, t);
    const delay = Math.max(0, me.castUntil - t, me.rootUntil - t, me.stunUntil - t);
    if (me.dash) return;

    const lo = { x: b.x0 + R + 12, y: b.y0 + R + 12 }, hi = { x: b.x1 - R - 12, y: b.y1 - R - 12 };
    const cands = [[me.x, me.y]];
    if (this.goal) cands.push(this.goal);
    const jitter = m.rng() * Math.PI / 8;
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8 + jitter;
      for (const d of [90, 200, 330]) cands.push([me.x + Math.cos(a) * d, me.y + Math.sin(a) * d]);
    }

    let best = null, bestScore = Infinity, bestDg = null;
    for (const c of cands) {
      const cx = clamp(c[0], lo.x, hi.x), cy = clamp(c[1], lo.y, hi.y);
      const dg = this.pathDanger(me.x, me.y, cx, cy, v, delay, t, spells);
      let score = dg.total * 10 + this.strategic(cx, cy, b) + m.rng() * 0.15;
      if (this.goal && c === this.goal) score -= 0.35; // garder le cap évite de trembler
      if (score < bestScore) { bestScore = score; best = [cx, cy]; bestDg = dg; }
    }

    // Danger imminent impossible à éviter en marchant : Bond, Flash ou Fantôme.
    if (bestDg.total > 0 && bestDg.first < 0.4 && m.rng() < L.blink) {
      if (this.tryBlink(t, spells, b)) return;
      if (canCast(me, 'F', t, rules) && bestDg.first > 0.15) this.cmd({ k: 'cast', slot: 'F', x: me.x, y: me.y });
    }

    const moved = !this.goal || Math.hypot(best[0] - this.goal[0], best[1] - this.goal[1]) > 22;
    const stay = Math.hypot(best[0] - me.x, best[1] - me.y) < 8;
    if (stay) {
      if (me.mv) this.cmd({ k: 'stop' });
      this.goal = null;
    } else if (moved || !me.mv) {
      this.cmd({ k: 'move', x: best[0], y: best[1] });
      this.goal = best;
    }
  }

  tryBlink(t, spells, b) {
    const me = this.me, rules = this.m.rules;
    const options = [];
    if (canCast(me, 'E', t, rules)) options.push('E');
    if (canCast(me, 'D', t, rules)) options.push('D');
    for (const slot of options) {
      const range = ABILITIES[slot].range;
      let best = null, bestD = Infinity;
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        const x = clamp(me.x + Math.cos(a) * range, b.x0 + R + 8, b.x1 - R - 8);
        const y = clamp(me.y + Math.sin(a) * range, b.y0 + R + 8, b.y1 - R - 8);
        const dg = this.standDanger(t + (slot === 'E' ? 0.16 : 0), 0.6, spells, x, y) + this.strategic(x, y, b) * 0.2;
        if (dg < bestD) { bestD = dg; best = { x, y }; }
      }
      if (best && bestD < 5) {
        this.cmd({ k: 'cast', slot, x: best.x, y: best.y });
        this.goal = null;
        return true;
      }
    }
    return false;
  }

  // ------------------------------------------------------------ attaque

  attack(t, spells) {
    const me = this.me, L = this.L, m = this.m, rules = m.rules;
    if (t < this.nextAttack || t < me.castUntil || me.dash) return;
    const e = this.cur;
    if (!e || !e.alive) return;
    const d = Math.hypot(e.x - me.x, e.y - me.y);
    const tr = this.track.get(e.id) || { vx: 0, vy: 0 };
    const locked = t < e.stunUntil || t < e.rootUntil;
    const rng = m.rng;

    const shootLine = (slot) => {
      const ab = ABILITIES[slot];
      if (!canCast(me, slot, t, rules) || d > ab.range + 30) return false;
      if (this.standDanger(t, ab.windup + 0.08, spells) > 0) return false;
      const tt = ab.windup + d / ab.speed;
      const k = locked ? 0 : L.lead;
      const px = e.x + tr.vx * tt * k, py = e.y + tr.vy * tt * k;
      const ang = Math.atan2(py - me.y, px - me.x) + gauss(rng) * L.aimErr;
      const dd = Math.max(100, Math.hypot(px - me.x, py - me.y));
      this.cmd({ k: 'cast', slot, x: me.x + Math.cos(ang) * dd, y: me.y + Math.sin(ang) * dd });
      return true;
    };

    const shootCircle = () => {
      const ab = ABILITIES.W;
      if (!canCast(me, 'W', t, rules) || d > ab.castRange + ab.radius * 0.6) return false;
      if (this.standDanger(t, ab.windup + 0.08, spells) > 0) return false;
      const tt = ab.windup + ab.delay;
      const k = locked ? 0 : L.lead * 0.75;
      const err = (1 - L.lead) * 90;
      this.cmd({
        k: 'cast', slot: 'W',
        x: e.x + tr.vx * tt * k + gauss(rng) * err,
        y: e.y + tr.vy * tt * k + gauss(rng) * err,
      });
      return true;
    };

    let done = false;
    if (locked) done = shootLine('R') || shootCircle() || shootLine('Q');
    if (!done && rng() < L.aggro) done = shootLine('Q');
    if (!done && rng() < 0.35 * L.aggro) done = shootCircle();
    if (!done && d < 950 && rng() < 0.08 * L.aggro) done = shootLine('R');
    if (!done && me.hp < 35 && canCast(me, 'F', t, rules) && rng() < 0.1) {
      this.cmd({ k: 'cast', slot: 'F', x: me.x, y: me.y });
    }
    this.nextAttack = t + (done ? 0.35 : 0.15) + (rng() * 0.4) / L.aggro;
  }
}

export function botName(i) {
  const names = ['Nova', 'Orion', 'Vega', 'Lyra', 'Atlas', 'Sirius'];
  return 'IA ' + names[i % names.length];
}
