// Boss du mode histoire : caractéristiques, moteur d'attaques et kits.

import { clamp, rayToRect, gauss, round2 } from '../util.js';
import { MOB_TEAM } from './mobs.js';
import { MAX_ALIVE, SPAWN_WARN } from './rooms.js';

export const BOSSES = {
  gardien: { name: 'Le Gardien de pierre', color: '#d6d3d1', hp: 620, spd: 150, r: 80 },
  forgeronne: { name: 'La Forgeronne des braises', color: '#fb923c', hp: 780, spd: 230, r: 64 },
  archonte: { name: 'L\'Archonte du Vide', color: '#d946ef', hp: 1000, spd: 0, r: 72 },
};

export const COOP_BOSS_HP = 0.8;   // PV en plus par joueur supplémentaire

// Définition d'unité d'un boss : insensible aux étourdissements, enracinements et attractions (cc = 0).
export function bossDef(id, key, heroes = 1) {
  const b = BOSSES[key];
  return {
    id, name: b.name, color: b.color, team: MOB_TEAM, mob: key, boss: true,
    maxHp: Math.round(b.hp * (1 + COOP_BOSS_HP * (heroes - 1))), spd: b.spd, r: b.r, cc: 0,
  };
}

// ---------------------------------------------------------------- moteur d'attaques

const DEG = Math.PI / 180;

function shuffle(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Point ramené dans la salle.
function inRoom(b, x, y) {
  const { w, h } = b.m.rules;
  return { x: clamp(x, 0, w), y: clamp(y, 0, h) };
}

// IA d'un boss : trois phases selon ses PV, un cycle d'attaques par phase, des sous-attaques programmées.
export class BossBrain {
  constructor(match, unit, def, t) {
    this.m = match;
    this.u = unit;
    this.def = def;
    this.kit = KITS[unit.mob];
    this.phase = 1;
    this.queue = [];             // sous-attaques programmées : { at, run }
    this.busyUntil = t + 1.2;    // fin de l'attaque en cours, pause comprise
    this.nextMove = t;
    this.rot = [];               // attaques restantes du cycle
    this.turn = 0;               // alternance des cibles
    this.bondAt = 0;
    match.emit({ e: 'boss', id: unit.id, key: unit.mob, phase: 1, t });
  }

  heroes() {
    return this.m.order.map((id) => this.m.players.get(id)).filter((p) => p.alive);
  }

  // Cible de la prochaine attaque : les joueurs vivants, à tour de rôle.
  target() {
    const alive = this.heroes();
    return alive.length ? alive[this.turn++ % alive.length] : null;
  }

  nearest() {
    let best = null, bd = Infinity;
    for (const p of this.heroes()) {
      const d = Math.hypot(p.x - this.u.x, p.y - this.u.y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  // Programme une sous-attaque. Elle ne part pas si le boss meurt avant.
  at(t, run) {
    this.queue.push({ at: t, run });
  }

  update(t) {
    const u = this.u;
    if (!u.alive || !this.kit) return;
    if (this.queue.some((a) => a.at <= t)) {
      const due = this.queue.filter((a) => a.at <= t);
      this.queue = this.queue.filter((a) => a.at > t);
      for (const a of due) a.run(t);
    }
    const phase = u.hp > u.maxHp * 0.66 ? 1 : u.hp > u.maxHp * 0.33 ? 2 : 3;
    if (phase > this.phase) {
      this.phase = phase;
      this.rot = [];
      this.m.emit({ e: 'boss', id: u.id, key: u.mob, phase, t });
      if (this.kit.onPhase) this.kit.onPhase(this, u, t);
    }
    if (t >= this.busyUntil) {
      if (!this.rot.length) this.rot = shuffle(this.kit.attacks.filter((a) => a.phase <= this.phase), this.m.rng);
      const h = this.target();
      if (!h) return;
      const dur = this.rot.pop().run(this, u, h, t);
      this.busyUntil = t + dur + this.kit.rest[this.phase - 1];
    } else if (this.kit.move && t >= this.nextMove && t >= u.castUntil && !u.dash) {
      this.nextMove = t + 0.15;
      this.kit.move(this, u, t);
    }
  }

  // Immobilise le boss pendant la préparation d'une attaque.
  hold(t, dur, ang) {
    const u = this.u;
    u.mv = false;
    if (ang !== undefined) u.ang = ang;
    u.castUntil = Math.max(u.castUntil, t + dur);
    u.castDur = dur;
    u.castSlot = 'A';
  }

  spell(spec) {
    return this.m.addSpell({ owner: this.u.id, target: null, fx: '', ...spec });
  }

  go(x, y) {
    const u = this.u, { w, h } = this.m.rules;
    u.tx = clamp(x, u.r, w - u.r);
    u.ty = clamp(y, u.r, h - u.r);
    u.mv = true;
  }

  // Invoque des ennemis, sans dépasser le nombre maximum d'ennemis vivants.
  summon(type, n, t) {
    const m = this.m;
    for (let i = 0; i < n && m.mobs.size + m.pending.length < MAX_ALIVE; i++) {
      m.announce({ type, elite: false }, t + SPAWN_WARN);
    }
  }

  // Traversée en ligne droite vers un joueur, jusqu'au mur : couloir annoncé pendant `warn`, puis ruée de `dur`.
  dashThrough(h, t, warn, dur, hw, dmg, def) {
    const u = this.u, { w, h: H } = this.m.rules;
    const a = Math.atan2(h.y - u.y, h.x - u.x);
    const ux = Math.cos(a), uy = Math.sin(a);
    const len = rayToRect(clamp(u.x, u.r, w - u.r), clamp(u.y, u.r, H - u.r), ux, uy, u.r, u.r, w - u.r, H - u.r);
    const ex = u.x + ux * len, ey = u.y + uy * len;
    const ta = t + warn, te = ta + dur;
    this.hold(t, warn + dur, a);
    this.spell({ kind: 'beam', def, t0: t, tl: t, ta, te, ax: u.x, ay: u.y, bx: ex, by: ey, hw, dmg });
    u.dash = { k: 'dash', fx: u.x, fy: u.y, tx: ex, ty: ey, ts: ta, te };
  }

  // Point de la salle à au moins minD de chaque joueur, ou à défaut le plus éloigné trouvé.
  farPoint(minD) {
    const { w, h } = this.m.rules, heroes = this.heroes();
    let best = { x: this.u.x, y: this.u.y }, bestD = -1;
    for (let k = 0; k < 20; k++) {
      const x = 150 + this.m.rng() * (w - 300), y = 150 + this.m.rng() * (h - 300);
      let d = Infinity;
      for (const p of heroes) d = Math.min(d, Math.hypot(p.x - x, p.y - y));
      if (d >= minD) return { x: round2(x), y: round2(y) };
      if (d > bestD) {
        bestD = d;
        best = { x: round2(x), y: round2(y) };
      }
    }
    return best;
  }
}

// Une attaque : (cerveau, boss, cible, temps) → durée avant l'attaque suivante (la pause de phase s'y ajoute).

// ---------------------------------------------------------------- Le Gardien de pierre

// Ondes de choc : anneaux successifs centrés sur lui.
function ondes(b, u, h, t) {
  const n = b.phase >= 2 ? 4 : 3;
  b.hold(t, 0.7);
  for (let i = 0; i < n; i++) {
    const t0 = t + i * 0.45;
    b.spell({ kind: 'ring', def: 'b_onde', t0, tl: t0, ta: t0 + 0.7, te: t0 + 0.95, x: u.x, y: u.y, r: 220 + i * 180, th: 60, dmg: 14, stun: 0 });
  }
  return 0.95 + (n - 1) * 0.45;
}

// Poing sismique : grande zone sur la cible, puis une traînée d'explosions dans le prolongement.
function poing(b, u, h, t) {
  const a = Math.atan2(h.y - u.y, h.x - u.x);
  b.hold(t, 1, a);
  b.spell({ kind: 'circle', def: 'b_poing', t0: t, tl: t, td: t + 1, x: h.x, y: h.y, r: 210, dmg: 24 });
  for (let i = 0; i < 4; i++) {
    const p = inRoom(b, h.x + Math.cos(a) * (320 + i * 150), h.y + Math.sin(a) * (320 + i * 150));
    b.spell({ kind: 'circle', def: 'b_replique', t0: t + 1, tl: t + 1, td: t + 1.25 + i * 0.15, x: p.x, y: p.y, r: 90, dmg: 12 });
  }
  return 1.9;
}

// Éboulement : 8 zones près des joueurs, étalées sur 2,4 s.
function eboulement(b, u, h, t) {
  b.hold(t, 0.6);
  for (let i = 0; i < 8; i++) {
    b.at(t + 0.3 + i * 0.3, (now) => {
      const heroes = b.heroes();
      if (!heroes.length) return;
      const tg = heroes[i % heroes.length];
      const p = inRoom(b, tg.x + gauss(b.m.rng) * 140, tg.y + gauss(b.m.rng) * 140);
      b.spell({ kind: 'circle', def: 'b_roche', t0: now, tl: now, td: now + 0.9, x: p.x, y: p.y, r: 110, dmg: 16 });
    });
  }
  return 2.7;
}

// Charge : deux traversées de la salle à la suite.
function charge(b, u, h, t) {
  b.dashThrough(h, t, 0.9, 0.45, 95, 26, 'b_charge');
  b.at(t + 1.7, (now) => {
    const h2 = b.target();
    if (h2) b.dashThrough(h2, now, 0.9, 0.45, 95, 26, 'b_charge');
  });
  return 3.05;
}

// ---------------------------------------------------------------- kits

// rest : pause après une attaque, par phase. attacks : attaques disponibles à partir de la phase indiquée.
const KITS = {
  gardien: {
    rest: [1.6, 1.2, 0.8],
    // Marche lentement vers le joueur le plus proche.
    move(b, u) {
      const h = b.nearest();
      if (h && Math.hypot(h.x - u.x, h.y - u.y) > 260) b.go(h.x, h.y);
      else u.mv = false;
    },
    onPhase(b, u, t) {
      b.summon('rodeur', 2, t);
    },
    attacks: [
      { phase: 1, run: ondes },
      { phase: 1, run: poing },
      { phase: 2, run: eboulement },
      { phase: 3, run: charge },
    ],
  },
};
