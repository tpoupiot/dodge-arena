// Simulation déterministe partagée : déplacement des joueurs, commandes, trajectoires des sorts.
// Utilisée par le serveur (autorité), par le navigateur (prédiction locale) et par les IA.

import {
  ARENA_W, ARENA_H, PLAYER_RADIUS, MOVE_SPEED, MAX_HP,
  SUDDEN_DEATH_AT, SHRINK_DURATION, SHRINK_MIN,
} from './constants.js';
import { AUTO, abilityOf, sanitizeBuild } from './abilities.js';
import { clamp, round2 } from './util.js';

// ---------------------------------------------------------------- joueurs

export function createPlayer(def, slot) {
  return {
    id: def.id, name: def.name, color: def.color, slot, bot: !!def.bot,
    build: sanitizeBuild(def.build),
    x: ARENA_W / 2, y: ARENA_H / 2, tx: ARENA_W / 2, ty: ARENA_H / 2, mv: false, ang: 0,
    hp: MAX_HP, alive: true, left: false,
    castUntil: 0, castDur: 0, castSlot: '', rootUntil: 0, stunUntil: 0, slowUntil: 0, slowAmt: 0,
    ghostUntil: 0, boostMul: 1, shield: 0, shieldUntil: 0, spellShieldUntil: 0,
    atk: null, atkReady: 0,
    dash: null,
    cds: { Q: 0, W: 0, E: 0, R: 0, D: 0, F: 0 },
    seq: 0,
  };
}

export function clonePlayer(p) {
  return { ...p, cds: { ...p.cds }, dash: p.dash ? { ...p.dash } : null };
}

export function resetForRound(p, sp) {
  p.x = sp.x; p.y = sp.y; p.tx = sp.x; p.ty = sp.y; p.mv = false; p.ang = sp.ang;
  p.hp = MAX_HP; p.alive = !p.left;
  p.castUntil = 0; p.castSlot = ''; p.rootUntil = 0; p.stunUntil = 0;
  p.slowUntil = 0; p.slowAmt = 0; p.ghostUntil = 0; p.boostMul = 1; p.dash = null;
  p.shield = 0; p.shieldUntil = 0; p.spellShieldUntil = 0; p.atk = null; p.atkReady = 0; p.castDur = 0;
  for (const k in p.cds) p.cds[k] = 0;
}

export function spawnPoints(kind, n) {
  const cx = ARENA_W / 2, cy = ARENA_H / 2;
  if (kind === 'survival' || n <= 1) return [{ x: cx, y: cy, ang: -Math.PI / 2 }];
  if (n === 2) return [{ x: cx - 430, y: cy, ang: 0 }, { x: cx + 430, y: cy, ang: Math.PI }];
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    pts.push({ x: cx + Math.cos(a) * 420, y: cy + Math.sin(a) * 270, ang: a + Math.PI });
  }
  return pts;
}

// ---------------------------------------------------------------- arène

export const FULL_BOUNDS = Object.freeze({ x0: 0, y0: 0, x1: ARENA_W, y1: ARENA_H });

// rules = { playAt, shrink, allowed, frozen } : règles de la manche en cours.
export function boundsAt(rules, t) {
  if (!rules || !rules.shrink) return FULL_BOUNDS;
  const s = rules.playAt + SUDDEN_DEATH_AT;
  if (t <= s) return FULL_BOUNDS;
  const k = Math.min(1, (t - s) / SHRINK_DURATION);
  const f = 1 - (1 - SHRINK_MIN) * k;
  const hw = (ARENA_W * f) / 2, hh = (ARENA_H * f) / 2;
  return { x0: ARENA_W / 2 - hw, y0: ARENA_H / 2 - hh, x1: ARENA_W / 2 + hw, y1: ARENA_H / 2 + hh };
}

export function clampToBounds(p, b) {
  p.x = clamp(p.x, b.x0 + PLAYER_RADIUS, b.x1 - PLAYER_RADIUS);
  p.y = clamp(p.y, b.y0 + PLAYER_RADIUS, b.y1 - PLAYER_RADIUS);
}

// ---------------------------------------------------------------- états

export const isStunned = (p, t) => t < p.stunUntil;
export const isRooted = (p, t) => t < p.rootUntil;
export const isCasting = (p, t) => t < p.castUntil;

export function speedAt(p, t) {
  let s = MOVE_SPEED;
  if (t < p.slowUntil) s *= 1 - p.slowAmt;
  if (t < p.ghostUntil) s *= p.boostMul || 1;
  return s;
}

// Peut-on se déplacer pendant le tick qui se termine à t ?
export function canWalk(p, t, rules) {
  return p.alive && !p.dash && t > rules.playAt && t >= p.stunUntil && t >= p.rootUntil && t >= p.castUntil;
}

// Avance un joueur de t0 à t1 (un tick).
// world (facultatif) : { get(id) -> joueur, onAttack(p, cible, t) } pour l'auto-attaque.
export function stepPlayer(p, t0, t1, rules, world) {
  if (!p.alive) return;
  const b = boundsAt(rules, t1);
  if (p.atk && world) autoAttack(p, t1, rules, world);
  if (p.dash) {
    const d = p.dash;
    const k = d.te > d.ts ? clamp((t1 - d.ts) / (d.te - d.ts), 0, 1) : 1;
    p.x = d.fx + (d.tx - d.fx) * k;
    p.y = d.fy + (d.ty - d.fy) * k;
    if (t1 >= d.te) p.dash = null;
  } else if (p.mv && canWalk(p, t1, rules)) {
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    const step = speedAt(p, t1) * (t1 - t0);
    if (d <= step) {
      p.x = p.tx; p.y = p.ty; p.mv = false;
    } else {
      p.x += (dx / d) * step;
      p.y += (dy / d) * step;
      p.ang = Math.atan2(dy, dx);
    }
  }
  clampToBounds(p, b);
}

// Poursuit la cible puis lance une auto-attaque dès qu'elle est à portée.
function autoAttack(p, t, rules, world) {
  const tg = world.get(p.atk);
  if (!tg || !tg.alive || tg.id === p.id) {
    p.atk = null;
    return;
  }
  if (p.dash || t < p.castUntil) return;
  const dx = tg.x - p.x, dy = tg.y - p.y;
  if (Math.hypot(dx, dy) <= AUTO.range + PLAYER_RADIUS) {
    p.mv = false;
    p.ang = Math.atan2(dy, dx);
    if (t >= p.atkReady && t >= p.stunUntil && t > rules.playAt && !rules.frozen) {
      p.castUntil = t + AUTO.windup;
      p.castDur = AUTO.windup;
      p.castSlot = 'A';
      p.atkReady = t + AUTO.cd;
      if (world.onAttack) world.onAttack(p, tg, t);
    }
  } else {
    p.tx = tg.x; p.ty = tg.y; p.mv = true;
  }
}

// Point visé par un Flash / Bond : vers (x, y), au plus maxD, dans l'arène.
function towards(p, x, y, maxD, b) {
  const dx = x - p.x, dy = y - p.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return null;
  const k = Math.min(d, maxD) / d;
  return {
    x: clamp(p.x + dx * k, b.x0 + PLAYER_RADIUS, b.x1 - PLAYER_RADIUS),
    y: clamp(p.y + dy * k, b.y0 + PLAYER_RADIUS, b.y1 - PLAYER_RADIUS),
  };
}

// Applique une commande joueur au temps t. hooks (serveur) crée les sorts et les événements.
// Renvoie true si la commande a été acceptée.
export function applyCommand(p, cmd, t, rules, hooks) {
  if (!p.alive || !(t > rules.playAt) || rules.frozen) return false;
  if (cmd.k === 'move') {
    const b = boundsAt(rules, t);
    p.tx = clamp(cmd.x, b.x0 + PLAYER_RADIUS, b.x1 - PLAYER_RADIUS);
    p.ty = clamp(cmd.y, b.y0 + PLAYER_RADIUS, b.y1 - PLAYER_RADIUS);
    p.mv = true;
    p.atk = null;
    return true;
  }
  if (cmd.k === 'stop') {
    p.mv = false;
    p.atk = null;
    return true;
  }
  if (cmd.k === 'attack') {
    if (typeof cmd.id !== 'string' || cmd.id === p.id) return false;
    p.atk = cmd.id;
    return true;
  }
  if (cmd.k === 'cast') return tryCast(p, cmd.slot, cmd.x, cmd.y, t, rules, hooks);
  return false;
}

export function canCast(p, slot, t, rules) {
  const ab = abilityOf(p, slot);
  if (!ab || !p.alive || !rules.allowed.includes(slot)) return false;
  if (t < p.cds[slot]) return false;
  if (p.dash && !ab.cleanse) return false;
  if (t < p.stunUntil && !ab.cleanse) return false;
  const aimed = ab.kind !== 'blink' && ab.kind !== 'buff';
  if (aimed && t < p.castUntil) return false;
  if ((ab.kind === 'dash' || ab.kind === 'blink') && t < p.rootUntil) return false;
  return true;
}

function tryCast(p, slot, x, y, t, rules, hooks) {
  if (!canCast(p, slot, t, rules)) return false;
  const ab = abilityOf(p, slot);
  const b = boundsAt(rules, t);
  switch (ab.kind) {
    case 'line':
    case 'circle':
    case 'salvo':
    case 'ring':
    case 'beam': {
      let dx = x - p.x, dy = y - p.y;
      if (dx * dx + dy * dy < 1) {
        dx = Math.cos(p.ang); dy = Math.sin(p.ang);
        x = p.x + dx; y = p.y + dy;
      }
      p.ang = Math.atan2(dy, dx);
      p.castUntil = t + ab.windup;
      p.castDur = ab.windup;
      p.castSlot = slot;
      p.cds[slot] = t + ab.cd;
      if (hooks && hooks.onCast) hooks.onCast(p, ab, x, y, t);
      return true;
    }
    case 'dash': {
      const d = towards(p, x, y, ab.range, b);
      if (!d) return false;
      p.dash = { k: 'dash', fx: p.x, fy: p.y, tx: d.x, ty: d.y, ts: t, te: t + ab.duration };
      p.ang = Math.atan2(d.y - p.y, d.x - p.x);
      p.cds[slot] = t + ab.cd;
      if (hooks && hooks.onDash) hooks.onDash(p, t);
      return true;
    }
    case 'blink': {
      const d = towards(p, x, y, ab.range, b);
      if (!d) return false;
      const fx = p.x, fy = p.y;
      p.x = d.x; p.y = d.y;
      p.ang = Math.atan2(p.y - fy, p.x - fx);
      p.cds[slot] = t + ab.cd;
      if (hooks && hooks.onBlink) hooks.onBlink(p, fx, fy, t);
      return true;
    }
    case 'buff': {
      applyBuff(p, ab, t);
      p.cds[slot] = t + ab.cd;
      if (hooks && hooks.onBuff) hooks.onBuff(p, ab, t);
      return true;
    }
  }
  return false;
}

function applyBuff(p, ab, t) {
  if (ab.speed) {
    p.ghostUntil = t + ab.speedDur;
    p.boostMul = ab.speed;
  }
  if (ab.shield) {
    p.shield = ab.shield;
    p.shieldUntil = t + ab.shieldDur;
  }
  if (ab.spellShield) p.spellShieldUntil = t + ab.spellShield;
  if (ab.heal) p.hp = Math.min(MAX_HP, p.hp + ab.heal);
  if (ab.cleanse) {
    p.stunUntil = Math.min(p.stunUntil, t);
    p.rootUntil = Math.min(p.rootUntil, t);
    p.slowUntil = Math.min(p.slowUntil, t);
    if (p.dash && p.dash.k === 'pull') p.dash = null;
  }
}

// Position prédite d'un joueur dt secondes après son état courant (sans nouvelle commande).
// Sert à l'interpolation visuelle entre deux ticks.
export function extrapolate(p, t, dt, rules) {
  if (dt <= 0 || !p.alive) return { x: p.x, y: p.y };
  const q = { x: p.x, y: p.y, tx: p.tx, ty: p.ty, mv: p.mv, dash: p.dash, alive: true,
    stunUntil: p.stunUntil, rootUntil: p.rootUntil, castUntil: p.castUntil,
    slowUntil: p.slowUntil, slowAmt: p.slowAmt, ghostUntil: p.ghostUntil, boostMul: p.boostMul, ang: p.ang };
  stepPlayer(q, t, t + dt, rules);
  return { x: q.x, y: q.y };
}

// ---------------------------------------------------------------- sorts

export function lineEnd(s) {
  return s.tl + ((s.ret ? 2 : 1) * s.range) / s.speed;
}

export function spellEnd(s) {
  switch (s.kind) {
    case 'line': return lineEnd(s);
    case 'circle': return s.td;
    case 'beam':
    case 'ring': return s.te;
    case 'homing': return s.tl + 3;
    default: return s.t0;
  }
}

// Position d'un projectile linéaire au temps t (bornée à sa portée). ph : 0 incantation, 1 aller, 2 retour.
export function linePos(s, t, out) {
  out = out || { x: 0, y: 0, ph: 0 };
  if (t <= s.tl) {
    out.x = s.ox; out.y = s.oy; out.ph = 0;
    return out;
  }
  let d = (t - s.tl) * s.speed;
  const max = s.ret ? 2 * s.range : s.range;
  if (d > max) d = max;
  let along = d;
  out.ph = 1;
  if (d > s.range) {
    along = 2 * s.range - d;
    out.ph = 2;
  }
  out.x = s.ox + s.dx * along;
  out.y = s.oy + s.dy * along;
  return out;
}

// ---------------------------------------------------------------- réseau

const tm = (v, t) => (v > t ? v : 0);

export function packPlayer(p, t) {
  return {
    i: p.id,
    x: round2(p.x), y: round2(p.y),
    m: p.mv ? 1 : 0, tx: round2(p.tx), ty: round2(p.ty),
    a: Math.round(p.ang * 1000) / 1000,
    hp: p.hp, al: p.alive ? 1 : 0,
    cu: tm(p.castUntil, t), cd: p.castDur, cs: p.castSlot,
    ru: tm(p.rootUntil, t), su: tm(p.stunUntil, t),
    lu: tm(p.slowUntil, t), la: p.slowAmt, gu: tm(p.ghostUntil, t), bm: p.boostMul,
    sh: p.shieldUntil > t ? p.shield : 0, shu: tm(p.shieldUntil, t), ss: tm(p.spellShieldUntil, t),
    at: p.atk || 0, ar: tm(p.atkReady, t),
    d: p.dash ? [p.dash.k, round2(p.dash.fx), round2(p.dash.fy), round2(p.dash.tx), round2(p.dash.ty), p.dash.ts, p.dash.te] : 0,
    c: [tm(p.cds.Q, t), tm(p.cds.W, t), tm(p.cds.E, t), tm(p.cds.R, t), tm(p.cds.D, t), tm(p.cds.F, t)],
    q: p.seq,
  };
}

export function unpackInto(o, p) {
  p.x = o.x; p.y = o.y;
  p.mv = !!o.m; p.tx = o.tx; p.ty = o.ty; p.ang = o.a;
  p.hp = o.hp; p.alive = !!o.al;
  p.castUntil = o.cu; p.castDur = o.cd; p.castSlot = o.cs;
  p.boostMul = o.bm; p.shield = o.sh; p.shieldUntil = o.shu; p.spellShieldUntil = o.ss;
  p.atk = o.at || null; p.atkReady = o.ar;
  p.rootUntil = o.ru; p.stunUntil = o.su;
  p.slowUntil = o.lu; p.slowAmt = o.la; p.ghostUntil = o.gu;
  p.dash = o.d ? { k: o.d[0], fx: o.d[1], fy: o.d[2], tx: o.d[3], ty: o.d[4], ts: o.d[5], te: o.d[6] } : null;
  p.cds.Q = o.c[0]; p.cds.W = o.c[1]; p.cds.E = o.c[2];
  p.cds.R = o.c[3]; p.cds.D = o.c[4]; p.cds.F = o.c[5];
  p.seq = o.q;
  return p;
}

const SPELL_FIELDS = {
  line: ['ox', 'oy', 'dx', 'dy', 'speed', 'range', 'radius', 'tl', 'ret', 'pierce'],
  circle: ['x', 'y', 'r', 'tl', 'td'],
  beam: ['ax', 'ay', 'bx', 'by', 'hw', 'ta', 'te'],
  ring: ['x', 'y', 'r', 'th', 'ta', 'te'],
  homing: ['ox', 'oy', 'tgt', 'speed', 'tl'],
};

// Version allégée d'un sort pour le réseau (les infos serveur comme les cibles touchées restent sur le serveur).
export function packSpell(s) {
  const o = { id: s.id, kind: s.kind, def: s.def, owner: s.owner, t0: s.t0, fx: s.fx || '' };
  for (const k of SPELL_FIELDS[s.kind]) {
    const v = s[k];
    if (v === undefined) continue;
    o[k] = typeof v === 'number' && (k === 'ox' || k === 'oy' || k === 'x' || k === 'y' || k === 'ax' || k === 'ay' || k === 'bx' || k === 'by') ? round2(v) : v;
  }
  return o;
}
