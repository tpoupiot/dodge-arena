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
      if (phase === 3) this.m.say(`boss${this.m.room.def.chapter + 1}p3`);
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

// ---------------------------------------------------------------- La Forgeronne des braises

// Éventail de braises : 5 projectiles sur 50°, 7 en phase 2. Phase 3 : un second éventail décalé d'un demi-pas.
function eventail(b, u, h, t) {
  const n = b.phase >= 2 ? 7 : 5;
  const fan = (now, shift) => {
    const tg = h.alive ? h : b.nearest();
    if (!tg) return;
    const a0 = Math.atan2(tg.y - u.y, tg.x - u.x);
    const step = (50 * DEG) / (n - 1);
    b.hold(now, 0.6, a0);
    for (let i = 0; i < n; i++) {
      const a = a0 + (i - (n - 1) / 2 + shift) * step;
      b.spell({
        kind: 'line', def: 'b_eventail', t0: now, tl: now + 0.6, ox: u.x, oy: u.y, dx: Math.cos(a), dy: Math.sin(a),
        speed: 1150, range: 1500, radius: 26, ret: false, pierce: false, dmg: 12,
      });
    }
  };
  fan(t, 0);
  if (b.phase < 3) return 0.9;
  b.at(t + 0.5, (now) => fan(now, 0.5));
  return 1.4;
}

// Roue de feu : 12 projectiles dans toutes les directions, puis une vague tournée de 15°. Trois vagues en phase 3.
function roue(b, u, h, t) {
  const waves = b.phase >= 3 ? 3 : 2;
  b.hold(t, 0.7 * waves);
  for (let w = 0; w < waves; w++) {
    const t0 = t + w * 0.7;
    for (let i = 0; i < 12; i++) {
      const a = (i * 30 + w * 15) * DEG;
      b.spell({
        kind: 'line', def: 'b_roue', t0, tl: t0 + 0.7, ox: u.x, oy: u.y, dx: Math.cos(a), dy: Math.sin(a),
        speed: 800, range: 1600, radius: 28, ret: false, pierce: false, dmg: 12,
      });
    }
  }
  return 0.7 * waves + 0.4;
}

// Lames boomerang : trois lames qui partent puis reviennent en traversant tout.
function lames(b, u, h, t) {
  const a0 = Math.atan2(h.y - u.y, h.x - u.x);
  b.hold(t, 0.6, a0);
  for (const off of [-25, 0, 25]) {
    const a = a0 + off * DEG;
    b.spell({
      kind: 'line', def: 'boomerang', t0: t, tl: t + 0.6, ox: u.x, oy: u.y, dx: Math.cos(a), dy: Math.sin(a),
      speed: 1100, range: 900, radius: 40, ret: true, pierce: true, dmg: 10,
    });
  }
  return 2.4;
}

// Rayons croisés : trois rayons qui se croisent sur la position de la cible.
function rayons(b, u, h, t) {
  const { w, h: H } = b.m.rules;
  const cx = clamp(h.x, 1, w - 1), cy = clamp(h.y, 1, H - 1);
  const a0 = b.m.rng() * Math.PI;
  b.hold(t, 0.8);
  for (let i = 0; i < 3; i++) {
    const a = a0 + (i * Math.PI) / 3, ux = Math.cos(a), uy = Math.sin(a);
    const da = rayToRect(cx, cy, ux, uy, 0, 0, w, H), db = rayToRect(cx, cy, -ux, -uy, 0, 0, w, H);
    const t0 = t + i * 0.35;
    b.spell({
      kind: 'beam', def: 'rayon', t0, tl: t0, ta: t0 + 1, te: t0 + 1.25,
      ax: cx + ux * da, ay: cy + uy * da, bx: cx - ux * db, by: cy - uy * db, hw: 55, dmg: 22,
    });
  }
  return 2.2;
}

// Se tient à distance. S'écarte d'un bond si un joueur approche à moins de 250 (une fois toutes les 6 s).
function forgeronneMove(b, u, t) {
  const h = b.nearest();
  if (!h) return;
  const dx = h.x - u.x, dy = h.y - u.y, d = Math.hypot(dx, dy) || 1;
  if (d < 250 && t >= b.bondAt) {
    b.bondAt = t + 6;
    const { w, h: H } = b.m.rules;
    let tx = u.x - (dx / d) * 420, ty = u.y - (dy / d) * 420;
    if (tx < u.r || tx > w - u.r || ty < u.r || ty > H - u.r) {
      // Dos au mur : bond vers le centre de la salle.
      const cx = w / 2 - u.x, cy = H / 2 - u.y, c = Math.hypot(cx, cy) || 1;
      tx = u.x + (cx / c) * 420;
      ty = u.y + (cy / c) * 420;
    }
    u.mv = false;
    u.dash = { k: 'dash', fx: u.x, fy: u.y, tx: clamp(tx, u.r, w - u.r), ty: clamp(ty, u.r, H - u.r), ts: t, te: t + 0.2 };
    b.m.emit({ e: 'dash', id: u.id, t });
    return;
  }
  if (d > 700) b.go(h.x - (dx / d) * 600, h.y - (dy / d) * 600);
  else if (d < 450) b.go(u.x - (dx / d) * 200, u.y - (dy / d) * 200);
  else u.mv = false;
}

// ---------------------------------------------------------------- L'Archonte du Vide

// Téléportation loin des joueurs, puis nova : un anneau et 10 projectiles en étoile.
function nova(b, u, h, t) {
  const p = b.farPoint(450);
  const fx = u.x, fy = u.y;
  u.x = p.x; u.y = p.y; u.tx = p.x; u.ty = p.y;
  b.m.emit({ e: 'flash', id: u.id, fx: round2(fx), fy: round2(fy), x: u.x, y: u.y, t });
  b.hold(t, 0.7);
  b.spell({ kind: 'ring', def: 'b_nova', t0: t, tl: t, ta: t + 0.7, te: t + 0.95, x: u.x, y: u.y, r: 260, th: 70, dmg: 14, stun: 0 });
  const a0 = b.m.rng() * Math.PI * 2;
  for (let i = 0; i < 10; i++) {
    const a = a0 + (i * Math.PI) / 5;
    b.spell({
      kind: 'line', def: 'b_vide', t0: t, tl: t + 0.7, ox: u.x, oy: u.y, dx: Math.cos(a), dy: Math.sin(a),
      speed: 900, range: 1500, radius: 28, ret: false, pierce: false, dmg: 14,
    });
  }
  return 1.2;
}

// Prison : une cage autour de la cible, puis deux éruptions à l'intérieur.
function prison(b, u, h, t) {
  b.hold(t, 0.6, Math.atan2(h.y - u.y, h.x - u.x));
  b.spell({ kind: 'ring', def: 'cage', t0: t, tl: t, ta: t + 0.6, te: t + 3.2, x: h.x, y: h.y, r: 230, th: 34, dmg: 8, stun: 1, fx: 'stun' });
  for (const dt of [0.7, 1.6]) {
    b.at(t + dt, (now) => {
      const tg = h.alive ? h : b.nearest();
      if (tg) b.spell({ kind: 'circle', def: 'b_eruption', t0: now, tl: now, td: now + 0.9, x: tg.x, y: tg.y, r: 120, dmg: 18 });
    });
  }
  return 2.2;
}

// Aiguilles : 8 rayons tournés de 45° en 45°, comme une aiguille qui balaie la salle. Deux aiguilles opposées en phase 3.
function aiguilles(b, u, h, t) {
  const a0 = Math.atan2(h.y - u.y, h.x - u.x) + Math.PI / 4;
  const dir = b.m.rng() < 0.5 ? 1 : -1;
  const hands = b.phase >= 3 ? 2 : 1;
  b.hold(t, 0.9);
  for (let i = 0; i < 8; i++) {
    const t0 = t + i * 0.28;
    for (let k = 0; k < hands; k++) {
      const a = a0 + (dir * i * Math.PI) / 4 + k * Math.PI;
      b.spell({
        kind: 'beam', def: 'b_aiguille', t0, tl: t0, ta: t0 + 0.9, te: t0 + 1.1,
        ax: u.x, ay: u.y, bx: u.x + Math.cos(a) * 1400, by: u.y + Math.sin(a) * 1400, hw: 45, dmg: 20,
      });
    }
  }
  return 3.1;
}

// Grappin du vide : attire la cible vers lui, puis une zone explose autour de lui.
function grappin(b, u, h, t) {
  const a = Math.atan2(h.y - u.y, h.x - u.x);
  b.hold(t, 0.5, a);
  b.spell({
    kind: 'line', def: 'grappin', t0: t, tl: t + 0.5, ox: u.x, oy: u.y, dx: Math.cos(a), dy: Math.sin(a),
    speed: 1500, range: 1100, radius: 34, ret: false, pierce: false, dmg: 10, pull: 420, fx: 'pull',
  });
  b.at(t + 1, (now) => b.spell({ kind: 'circle', def: 'b_implosion', t0: now, tl: now, td: now + 0.8, x: u.x, y: u.y, r: 200, dmg: 24 }));
  return 2;
}

// Pluie de météores : un sur chaque joueur et trois au hasard, deux fois de suite.
function meteores(b, u, h, t) {
  const volley = (now) => {
    const { w, h: H } = b.m.rules;
    for (const p of b.heroes()) b.spell({ kind: 'circle', def: 'meteore', t0: now, tl: now, td: now + 1.1, x: p.x, y: p.y, r: 200, dmg: 30 });
    for (let i = 0; i < 3; i++) {
      b.spell({ kind: 'circle', def: 'meteore', t0: now, tl: now, td: now + 1.1, x: b.m.rng() * w, y: b.m.rng() * H, r: 200, dmg: 30 });
    }
  };
  b.hold(t, 0.6);
  volley(t);
  b.at(t + 0.9, volley);
  return 2.2;
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
  forgeronne: {
    rest: [1.4, 1, 0.7],
    move: forgeronneMove,
    attacks: [
      { phase: 1, run: eventail },
      { phase: 1, run: roue },
      { phase: 2, run: lames },
      { phase: 3, run: rayons },
    ],
  },
  // Immobile : il ne se déplace que par téléportation (attaque nova).
  archonte: {
    rest: [1.3, 1, 0.7],
    onPhase(b, u, t) {
      b.summon('bombe', 3, t);
    },
    attacks: [
      { phase: 1, run: nova },
      { phase: 1, run: prison },
      { phase: 1, run: aiguilles },
      { phase: 2, run: grappin },
      { phase: 3, run: meteores },
    ],
  },
};
