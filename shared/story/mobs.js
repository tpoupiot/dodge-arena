// Ennemis du mode histoire : caractéristiques et IA.

import { predictPos } from '../sim.js';
import { clamp } from '../util.js';

export const MOB_TEAM = 'M';

// Valeurs au chapitre 1. cost : poids dans le budget d'une vague. dmg et cd : attaque de l'ennemi.
export const MOBS = {
  rodeur: { name: 'Rôdeur', color: '#f97316', hp: 34, spd: 255, r: 28, cost: 2, dmg: 10, cd: 1.5 },
  tireur: { name: 'Tireur', color: '#ef4444', hp: 26, spd: 215, r: 26, cost: 2, dmg: 9, cd: 2.4 },
  bombe: { name: 'Bombe', color: '#facc15', hp: 16, spd: 315, r: 22, cost: 1.5, dmg: 20, cd: 0 },
  pyro: { name: 'Pyromancien', color: '#fb7185', hp: 30, spd: 200, r: 28, cost: 3, dmg: 14, cd: 3.2 },
  belier: { name: 'Bélier', color: '#b45309', hp: 60, spd: 225, r: 36, cost: 4, dmg: 16, cd: 4.5 },
  sentinelle: { name: 'Sentinelle', color: '#e879f9', hp: 55, spd: 0, r: 34, cost: 4, dmg: 9, cd: 3 },
};

export const CHAPTER_HP = [1, 1.5, 2.1];
export const CHAPTER_DMG = [1, 1.2, 1.45];
export const ELITE = { hp: 2.5, r: 1.25, cd: 0.75, cc: 0.5, cost: 2.5 };
export const COOP_HP = 0.7;   // PV en plus par joueur supplémentaire

// Définition d'unité (pour createPlayer) d'un ennemi. chapter : 0 à 2, heroes : joueurs présents.
export function mobDef(id, type, { chapter = 0, elite = false, heroes = 1 } = {}) {
  const m = MOBS[type];
  return {
    id, name: elite ? `${m.name} d'élite` : m.name, color: m.color, team: MOB_TEAM, mob: type, elite,
    maxHp: Math.round(m.hp * CHAPTER_HP[chapter] * (1 + COOP_HP * (heroes - 1)) * (elite ? ELITE.hp : 1)),
    spd: m.spd, r: Math.round(m.r * (elite ? ELITE.r : 1)), cc: elite ? ELITE.cc : 1,
    dmg: Math.round(m.dmg * CHAPTER_DMG[chapter]), atkCd: m.cd * (elite ? ELITE.cd : 1),
  };
}

// ---------------------------------------------------------------- IA

const THINK = 0.15;          // intervalle entre deux décisions (s)
const DEG = Math.PI / 180;

export class MobBrain {
  constructor(match, unit, def, t) {
    this.m = match;
    this.u = unit;
    this.def = def;
    this.next = t;
    this.ready = t + 0.6 + match.rng() * 0.6;   // première attaque : jamais dès l'apparition
    this.slot = match.rng() * Math.PI * 2;      // place autour de la cible, pour ne pas s'empiler
    this.side = match.rng() < 0.5 ? 1 : -1;     // côté de fuite
    this.tgt = null;
    this.tgtUntil = 0;
    this.fuse = 0;                              // bombe : id du sort d'explosion en cours
    this.boomAt = 0;
  }

  // Joueur vivant le plus proche. La cible est gardée quelques secondes.
  target(t) {
    const cur = this.tgt && this.m.players.get(this.tgt);
    if (cur && cur.alive && t < this.tgtUntil) return cur;
    let best = null, bd = Infinity;
    for (const id of this.m.order) {
      const p = this.m.players.get(id);
      if (!p.alive) continue;
      const d = Math.hypot(p.x - this.u.x, p.y - this.u.y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    this.tgt = best ? best.id : null;
    this.tgtUntil = t + 2 + this.m.rng() * 2;
    return best;
  }

  update(t) {
    const u = this.u;
    if (!u.alive) return;
    if (this.fuse) {
      if (!this.m.spells.has(this.fuse)) this.fuse = 0;             // mise à feu annulée par un contrôle
      else if (t >= this.boomAt) return this.m.kill(u, null, t);    // la bombe disparaît dans son explosion
    }
    if (t < this.next) return;
    this.next = t + THINK * (0.8 + this.m.rng() * 0.4);
    if (t < u.stunUntil || t < u.castUntil || u.dash) return;
    const h = this.target(t);
    if (!h) {
      u.mv = false;
      return;
    }
    const dx = h.x - u.x, dy = h.y - u.y;
    const d = Math.hypot(dx, dy) || 1;
    BEHAVIORS[u.mob](this, u, h, d, dx / d, dy / d, t);
  }

  // Déplacement vers un point, borné à la salle. Même modèle que les joueurs : les clients l'extrapolent.
  go(x, y) {
    const u = this.u, { w, h } = this.m.rules;
    u.tx = clamp(x, u.r, w - u.r);
    u.ty = clamp(y, u.r, h - u.r);
    u.mv = true;
  }

  // Se tient entre min et max de sa cible. S'éloigne en biais si elle approche à moins de flee.
  keepRange(h, d, ux, uy, min, max, flee) {
    const u = this.u;
    if (d < flee) this.go(u.x - ux * 240 - uy * this.side * 150, u.y - uy * 240 + ux * this.side * 150);
    else if (d > max) this.go(h.x - (ux * (min + max)) / 2, h.y - (uy * (min + max)) / 2);
    else if (d < min) this.go(u.x - ux * 120, u.y - uy * 120);
    else u.mv = false;
  }

  // Début d'une attaque : l'ennemi s'immobilise pendant la préparation, puis recharge.
  windup(t, dur, ang) {
    const u = this.u;
    u.mv = false;
    u.ang = ang;
    u.castUntil = t + dur;
    u.castDur = dur;
    u.castSlot = 'A';
    this.ready = t + dur + this.def.atkCd;
  }

  spell(spec) {
    return this.m.addSpell({ owner: this.u.id, target: null, dmg: this.def.dmg, fx: '', ...spec });
  }
}

// Comportement de chaque type : (cerveau, unité, cible, distance, direction x, direction y, temps).
// Toute attaque est annoncée : cu donne l'instant jusqu'auquel un contrôle ou la mort l'annule.
const BEHAVIORS = {
  // Rôdeur : va au contact, puis frappe une zone sur la position du joueur.
  rodeur(b, u, h, d, ux, uy, t) {
    if (d <= 110 && t >= b.ready) {
      b.windup(t, 0.55, Math.atan2(uy, ux));
      b.spell({ kind: 'circle', def: 'm_frappe', t0: t, tl: t, td: t + 0.55, cu: t + 0.55, x: h.x, y: h.y, r: 85 });
      return;
    }
    const reach = h.r + u.r + 14;
    b.go(h.x + Math.cos(b.slot) * reach, h.y + Math.sin(b.slot) * reach);
  },

  // Tireur : garde ses distances et tire un projectile en ligne, avec un peu d'anticipation.
  tireur(b, u, h, d, ux, uy, t) {
    if (d <= 760 && t >= b.ready) {
      const aim = predictPos(h, t, 0.55 + d / 1250, 0.5);
      const a = Math.atan2(aim.y - u.y, aim.x - u.x);
      b.windup(t, 0.55, a);
      b.spell({
        kind: 'line', def: 'm_tir', t0: t, tl: t + 0.55, ox: u.x, oy: u.y, dx: Math.cos(a), dy: Math.sin(a),
        speed: 1250, range: 1000, radius: 26, ret: false, pierce: false,
      });
      return;
    }
    b.keepRange(h, d, ux, uy, 520, 680, 320);
  },

  // Bombe : court vers le joueur, s'arrête au contact et explose.
  bombe(b, u, h, d, ux, uy, t) {
    if (d > 120) return b.go(h.x, h.y);
    b.windup(t, 0.75, Math.atan2(uy, ux));
    b.fuse = b.spell({ kind: 'circle', def: 'm_explosion', t0: t, tl: t, td: t + 0.75, cu: t + 0.75, x: u.x, y: u.y, r: 150 }).id;
    b.boomAt = t + 0.75;
  },

  // Pyromancien : reste loin et lance une éruption sur la position prévue du joueur.
  pyro(b, u, h, d, ux, uy, t) {
    if (d <= 900 && t >= b.ready) {
      const aim = predictPos(h, t, 0.95, 0.6);
      b.windup(t, 0.4, Math.atan2(aim.y - u.y, aim.x - u.x));
      b.spell({
        kind: 'circle', def: 'm_eruption', t0: t, tl: t, td: t + 0.95, cu: t + 0.4, x: aim.x, y: aim.y, r: 120,
        slow: 0.3, slowDur: 1.5, fx: 'slow',
      });
      return;
    }
    b.keepRange(h, d, ux, uy, 600, 800, 300);
  },

  // Bélier : annonce un couloir, puis le traverse.
  belier(b, u, h, d, ux, uy, t) {
    if (d <= 600 && t >= b.ready) {
      const { w, h: H } = b.m.rules;
      const ex = clamp(u.x + ux * 650, u.r, w - u.r), ey = clamp(u.y + uy * 650, u.r, H - u.r);
      const ta = t + 0.75, te = ta + 0.3;
      b.windup(t, 1.05, Math.atan2(uy, ux));
      b.spell({ kind: 'beam', def: 'm_charge', t0: t, tl: t, ta, te, cu: ta, ax: u.x, ay: u.y, bx: ex, by: ey, hw: u.r + 14 });
      u.dash = { k: 'dash', fx: u.x, fy: u.y, tx: ex, ty: ey, ts: ta, te };
      return;
    }
    if (d > 520) b.go(h.x, h.y);
    else u.mv = false;
  },

  // Sentinelle : immobile, tire un éventail de projectiles (3, ou 5 pour une élite).
  sentinelle(b, u, h, d, ux, uy, t) {
    u.ang = Math.atan2(uy, ux);
    if (d > 1100 || t < b.ready) return;
    const aim = predictPos(h, t, 0.7 + d / 1100, 0.4);
    const a0 = Math.atan2(aim.y - u.y, aim.x - u.x);
    const n = u.elite ? 5 : 3;
    b.windup(t, 0.7, a0);
    for (let i = 0; i < n; i++) {
      const a = a0 + (i - (n - 1) / 2) * 18 * DEG;
      b.spell({
        kind: 'line', def: 'm_tir', t0: t, tl: t + 0.7, ox: u.x, oy: u.y, dx: Math.cos(a), dy: Math.sin(a),
        speed: 1100, range: 1200, radius: 24, ret: false, pierce: false,
      });
    }
  },
};
