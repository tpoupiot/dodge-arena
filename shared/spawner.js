// Générateur des sorts de l'arène : fréquence croissante, déblocage progressif des sorts,
// visée avec anticipation aléatoire (parfois sur la position actuelle, parfois en avance).

import { SUDDEN_DEATH_AT } from './constants.js';
import { ENV_SPELLS } from './abilities.js';
import { speedAt } from './sim.js';
import { clamp, rayToRect, pickWeighted, gauss } from './util.js';

// r0 / rMax : sorts par seconde au début / à terme, tau : vitesse de montée (s),
// speed : bonus de vitesse max des projectiles, unlock : multiplicateur des temps de déblocage,
// first : délai avant le premier sort, sudden : multiplicateur en mort subite (versus).
export const SURVIVAL_PRESETS = {
  facile: { r0: 0.55, rMax: 2.4, tau: 150, speed: 0.15, unlock: 1.4, first: 0.6 },
  normal: { r0: 0.8, rMax: 3.3, tau: 115, speed: 0.25, unlock: 1.0, first: 0.5 },
  difficile: { r0: 1.1, rMax: 4.4, tau: 90, speed: 0.35, unlock: 0.6, first: 0.4 },
  hardcore: { r0: 0.8, rMax: 3.3, tau: 115, speed: 0.25, unlock: 1.0, first: 0.5 },
  demo: { r0: 2.0, rMax: 2.4, tau: 60, speed: 0.1, unlock: 0, first: 0.2 }, // fond animé du menu
};

export const VERSUS_PRESETS = {
  leger: { r0: 0.2, rMax: 0.9, tau: 70, speed: 0.1, unlock: 0.4, first: 3.5, sudden: 2.2 },
  normal: { r0: 0.4, rMax: 1.6, tau: 65, speed: 0.15, unlock: 0.3, first: 2.5, sudden: 1.9 },
  chaos: { r0: 0.85, rMax: 2.6, tau: 60, speed: 0.2, unlock: 0.12, first: 1.5, sudden: 1.6 },
};

export function makeSpawner(match) {
  if (match.kind === 'survival') {
    return new EnvSpawner(match, SURVIVAL_PRESETS[match.settings.difficulty] || SURVIVAL_PRESETS.normal);
  }
  const preset = VERSUS_PRESETS[match.settings.env];
  return preset ? new EnvSpawner(match, preset) : null;
}


export class EnvSpawner {
  constructor(match, preset) {
    this.m = match;
    this.p = preset;
    this.start = match.rules.playAt;
    this.next = this.start + preset.first;
    this.rr = Math.floor(match.rng() * 3);
  }

  // Taille de l'arène de la partie en cours.
  get W() {
    return this.m.rules.w;
  }

  get H() {
    return this.m.rules.h;
  }

  elapsed(t) {
    return t - this.start;
  }

  rate(t) {
    const e = this.elapsed(t), p = this.p;
    let r = p.r0 + (p.rMax - p.r0) * (1 - Math.exp(-e / p.tau));
    if (p.sudden && e > SUDDEN_DEATH_AT) r *= p.sudden;
    return r;
  }

  speedMul(t) {
    return 1 + this.p.speed * Math.min(1, this.elapsed(t) / 180);
  }

  update(t) {
    let guard = 0;
    while (t >= this.next && guard++ < 8) {
      this.spawn(t);
      this.next += (1 / this.rate(t)) * (0.65 + this.m.rng() * 0.7);
    }
  }

  pickTarget() {
    const alive = this.m.order.map((id) => this.m.players.get(id)).filter((p) => p.alive);
    if (!alive.length) return null;
    this.rr = (this.rr + 1) % alive.length;
    return alive[this.rr];
  }

  available(t) {
    const e = this.elapsed(t);
    const out = [];
    for (const key in ENV_SPELLS) {
      const d = ENV_SPELLS[key];
      if (e >= d.unlock * this.p.unlock) out.push({ w: d.weight, v: key });
    }
    return out;
  }

  // Position estimée de la cible dans dt secondes (k = part d'anticipation, 0 = position actuelle).
  predict(p, t, dt, k) {
    if (!p.mv || p.dash || k <= 0) return { x: p.x, y: p.y };
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return { x: p.x, y: p.y };
    const travel = Math.min(d, speedAt(p, t) * dt * k);
    return { x: p.x + (dx / d) * travel, y: p.y + (dy / d) * travel };
  }

  spawn(t) {
    const target = this.pickTarget();
    if (!target) return;
    const key = pickWeighted(this.m.rng, this.available(t));
    const def = ENV_SPELLS[key];
    const sm = this.speedMul(t);
    switch (def.kind) {
      case 'line': return this.spawnLine(key, def, target, t, sm);
      case 'circle': return this.spawnCircle(key, def, target, t, sm);
      case 'salvo': return this.spawnSalvo(key, def, target, t, sm);
      case 'beam': return this.spawnBeam(key, def, target, t, sm);
      case 'ring': return this.spawnRing(key, def, target, t);
    }
  }

  // Direction d'arrivée : on évite les tirs à bout portant quand la cible longe un mur.
  pickDirection(px, py, maxDist) {
    const rng = this.m.rng;
    let best = null;
    for (let i = 0; i < 6; i++) {
      const a = rng() * Math.PI * 2;
      const ux = Math.cos(a), uy = Math.sin(a);
      const d = rayToRect(px, py, ux, uy, 0, 0, this.W, this.H);
      const ok = d >= 260 && (!maxDist || d <= maxDist);
      if (ok) return { ux, uy };
      if (!best || (maxDist ? Math.abs(d - maxDist * 0.7) < best.score : d > best.score)) {
        best = { ux, uy, score: maxDist ? Math.abs(d - maxDist * 0.7) : d };
      }
    }
    return best;
  }

  spawnLine(key, def, target, t, sm) {
    const rng = this.m.rng;
    const speed = def.speed * sm;
    const dir = this.pickDirection(target.x, target.y, def.range ? def.range - 150 : 0);
    const d0 = rayToRect(target.x, target.y, dir.ux, dir.uy, 0, 0, this.W, this.H);
    const lead = rng() < 0.35 ? 0 : 0.3 + rng() * 0.6;
    const aim = this.predict(target, t, def.windup + d0 / speed, lead);
    aim.x = clamp(aim.x + gauss(rng) * 16, 20, this.W - 20);
    aim.y = clamp(aim.y + gauss(rng) * 16, 20, this.H - 20);
    const d1 = rayToRect(aim.x, aim.y, dir.ux, dir.uy, 0, 0, this.W, this.H);
    const ox = aim.x + dir.ux * d1, oy = aim.y + dir.uy * d1;
    const dx = -dir.ux, dy = -dir.uy;
    const d2 = rayToRect(aim.x, aim.y, dx, dy, 0, 0, this.W, this.H);
    this.m.addSpell({
      kind: 'line', def: key, owner: null, target: target.id,
      t0: t, tl: t + def.windup, ox, oy, dx, dy, speed,
      range: def.range || d1 + d2 + 80, radius: def.radius,
      ret: !!def.ret, pierce: !!def.pierce,
      dmg: def.dmg, root: def.root || 0, stun: def.stun || 0, pull: def.pull || 0, slow: 0,
      fx: def.stun ? 'stun' : def.root ? 'root' : def.pull ? 'pull' : '',
    });
  }

  spawnCircle(key, def, target, t, sm) {
    const rng = this.m.rng;
    const delay = def.delay / (1 + (sm - 1) * 0.6);
    const aim = this.predict(target, t, delay, rng() * 0.8);
    const x = clamp(aim.x + gauss(rng) * 30, 0, this.W), y = clamp(aim.y + gauss(rng) * 30, 0, this.H);
    this.m.addSpell({
      kind: 'circle', def: key, owner: null, target: target.id,
      t0: t, tl: t, td: t + delay, x, y, r: def.radius,
      dmg: def.dmg, slow: def.slow || 0, slowDur: def.slowDur || 0, fx: def.slow ? 'slow' : '',
    });
  }

  spawnSalvo(key, def, target, t, sm) {
    const rng = this.m.rng;
    const a = rng() * Math.PI * 2;
    const ux = Math.cos(a), uy = Math.sin(a);
    const c = this.predict(target, t, def.delay, 0.5);
    const half = (def.count - 1) / 2;
    const delay = def.delay / (1 + (sm - 1) * 0.6);
    for (let i = 0; i < def.count; i++) {
      const off = (i - half) * def.spacing;
      const x = c.x + ux * off, y = c.y + uy * off;
      if (x < -def.radius || x > this.W + def.radius || y < -def.radius || y > this.H + def.radius) continue;
      this.m.addSpell({
        kind: 'circle', def: key, owner: null, target: i === Math.round(half) ? target.id : null,
        t0: t, tl: t, td: t + delay + i * def.stagger, x, y, r: def.radius, dmg: def.dmg, fx: '',
      });
    }
  }

  spawnBeam(key, def, target, t, sm) {
    const rng = this.m.rng;
    const a = rng() * Math.PI * 2;
    const ux = Math.cos(a), uy = Math.sin(a);
    const delay = def.delay / (1 + (sm - 1) * 0.5);
    const aim = this.predict(target, t, delay, rng() * 0.5);
    aim.x = clamp(aim.x, 1, this.W - 1);
    aim.y = clamp(aim.y, 1, this.H - 1);
    const da = rayToRect(aim.x, aim.y, ux, uy, 0, 0, this.W, this.H);
    const db = rayToRect(aim.x, aim.y, -ux, -uy, 0, 0, this.W, this.H);
    this.m.addSpell({
      kind: 'beam', def: key, owner: null, target: target.id,
      t0: t, ta: t + delay, te: t + delay + def.active,
      ax: aim.x + ux * da, ay: aim.y + uy * da, bx: aim.x - ux * db, by: aim.y - uy * db,
      hw: def.halfWidth, dmg: def.dmg, fx: '',
    });
  }

  spawnRing(key, def, target, t) {
    const rng = this.m.rng;
    const x = clamp(target.x + gauss(rng) * 25, 0, this.W), y = clamp(target.y + gauss(rng) * 25, 0, this.H);
    this.m.addSpell({
      kind: 'ring', def: key, owner: null, target: target.id,
      t0: t, ta: t + def.delay, te: t + def.delay + def.active,
      x, y, r: def.radius, th: def.thickness, dmg: def.dmg, stun: def.stun || 0, fx: 'stun',
    });
  }
}
