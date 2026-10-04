// Une partie complète : manches, collisions, dégâts, sorts de l'arène, IA, scores.
// Le serveur en fait tourner une par salon ; le navigateur en fait tourner une pour le solo.

import {
  DT, COUNTDOWN, SURVIVAL_COUNTDOWN, ROUND_END_DELAY,
  SLOTS, SURVIVAL_SLOTS, MAX_INPUT_LEAD, arenaSize,
} from './constants.js';
import { PULL_DURATION, AUTO, randomBuild } from './abilities.js';
import {
  createPlayer, resetForRound, spawnPoints, stepPlayer, applyCommand, boundsAt,
  linePos, lineEnd, packPlayer, packSpell,
} from './sim.js';
import { makeSpawner } from './spawner.js';
import { Bot } from './bot.js';
import { mulberry32, segPointDist2, segParam, clamp, round2 } from './util.js';

const DEFAULTS = {
  survival: { difficulty: 'normal' },
  versus: { roundsToWin: 2, env: 'normal' },
  story: {},
};

// Un sort ne touche pas l'équipe de son lanceur. Sans équipe (sorts de l'arène), il touche tout le monde.
const friendly = (s, p) => s.team != null && s.team === p.team;

export class Match {
  // o = { kind: 'survival' | 'versus', players: [{ id, name, color, bot, botLevel }], settings, time, seed }
  constructor(o) {
    this.kind = o.kind;
    this.settings = { ...DEFAULTS[o.kind], ...(o.settings || {}) };
    this.oneHit = this.kind === 'survival' && this.settings.difficulty === 'hardcore';
    this.time = o.time || 0;
    this.seed = (o.seed ?? Math.floor(Math.random() * 4294967296)) >>> 0;
    this.rng = mulberry32(this.seed);

    this.players = new Map();
    this.order = [];
    this.units = [];        // toutes les unités : joueurs, puis ennemis du mode histoire
    this.mobs = new Map();  // ennemis du mode histoire
    this.inputs = new Map();
    this.lastInputT = new Map();
    this.scores = {};
    this.stats = {};
    o.players.forEach((def, i) => {
      const p = createPlayer(def.bot && !def.build ? { ...def, build: randomBuild(this.rng) } : def, i);
      this.players.set(p.id, p);
      this.order.push(p.id);
      this.units.push(p);
      this.inputs.set(p.id, []);
      this.lastInputT.set(p.id, -Infinity);
      this.scores[p.id] = 0;
      this.stats[p.id] = { dmg: 0, hits: 0, casts: 0, kills: 0, deaths: 0, dodges: 0 };
    });

    this.spells = new Map();
    this.nextSpellId = 1;
    this.events = [];
    this.round = 0;
    this.phase = 'countdown';
    this.phaseUntil = 0;
    this.arena = arenaSize(o.players.length); // fixée pour toute la partie
    this.rules = { playAt: 0, shrink: false, allowed: SLOTS, frozen: false, ...this.arena };
    this.spawner = null;
    this.winner = null;
    this.over = false;
    this.deathTime = 0;

    this.bots = new Map();
    for (const def of o.players) {
      if (def.bot) this.bots.set(def.id, new Bot(this, def.id, def.botLevel || 'normal'));
    }

    this.hooks = {
      onCast: (p, ab, x, y, t) => this.onCast(p, ab, x, y, t),
      onBlink: (p, fx, fy, t) => this.emit({ e: 'flash', id: p.id, fx: round2(fx), fy: round2(fy), x: round2(p.x), y: round2(p.y), t }),
      onDash: (p, t) => this.emit({ e: 'dash', id: p.id, t }),
      onBuff: (p, ab, t) => this.emit({ e: 'buff', id: p.id, ab: ab.id, heal: ab.heal || 0, t }),
    };
    this.world = {
      get: (id) => this.unit(id),
      onAttack: (p, tg, t) => this.onAttack(p, tg, t),
    };

    this.setup(o);
    this.startRound();
  }

  // ------------------------------------------------------------ points d'extension (mode histoire)

  // Appelé une fois, avant la première manche.
  setup() {}

  // Appelé à chaque pas de jeu, avant la mise à jour des sorts.
  tick() {}

  // Applique une commande de joueur ; une sous-classe peut ajouter les siennes.
  command(p, cmd, t) {
    return applyCommand(p, cmd, t, this.rules, this.hooks);
  }

  unit(id) {
    return this.players.get(id) || this.mobs.get(id);
  }

  // ------------------------------------------------------------ API

  emit(ev) {
    this.events.push(ev);
  }

  drainEvents() {
    const ev = this.events;
    this.events = [];
    return ev;
  }

  snapshot() {
    return { t: this.time, p: this.order.map((id) => packPlayer(this.players.get(id), this.time)) };
  }

  // Input réseau ou local : appliqué au premier tick dont le temps >= t.
  queueInput(pid, seq, t, cmd) {
    const q = this.inputs.get(pid);
    if (!q) return;
    if (!Number.isFinite(t)) t = this.time;
    t = Math.min(t, this.time + MAX_INPUT_LEAD);
    t = Math.max(t, this.lastInputT.get(pid));
    this.lastInputT.set(pid, t);
    q.push({ seq, t, cmd });
  }

  botCommand(id, cmd) {
    const p = this.players.get(id);
    return p ? this.command(p, cmd, this.time) : false;
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p || p.left) return;
    p.left = true;
    if (p.alive) {
      this.interrupt(p, this.time);
      p.alive = false;
    }
    this.bots.delete(id);
    this.inputs.get(id).length = 0;
    this.emit({ e: 'left', id, t: this.time });
    if (this.over || this.kind !== 'versus') return;
    const remaining = this.order.filter((i) => !this.players.get(i).left);
    if (remaining.length <= 1) {
      this.rules.frozen = true;
      this.finishMatch(remaining[0] ?? null, this.time);
    }
  }

  // ------------------------------------------------------------ boucle

  step() {
    const t0 = this.time, t1 = t0 + DT;
    this.time = t1;
    const rules = this.rules;

    if (this.phase === 'countdown' && t1 > rules.playAt) {
      this.phase = 'playing';
      this.emit({ e: 'go', t: t1 });
    }

    for (const id of this.order) {
      const q = this.inputs.get(id);
      const p = this.players.get(id);
      while (q.length && q[0].t <= t1) {
        const inp = q.shift();
        if (inp.seq > p.seq) p.seq = inp.seq;
        this.command(p, inp.cmd, t1);
      }
    }

    if (this.phase === 'playing') for (const bot of this.bots.values()) bot.update(t1);

    for (const u of this.units) stepPlayer(u, t0, t1, rules, this.world);

    if (this.phase === 'playing') {
      if (this.spawner) this.spawner.update(t1);
      this.tick(t0, t1);
      this.updateSpells(t0, t1);
      this.checkEnd(t1);
    } else if (this.phase === 'roundEnd' && t1 >= this.phaseUntil) {
      this.startRound();
    }
  }

  startRound() {
    this.round++;
    this.spells.clear();
    const active = this.order.filter((id) => !this.players.get(id).left);
    const pts = spawnPoints(this.kind, active.length, this.arena.w, this.arena.h);
    active.forEach((id, i) => resetForRound(this.players.get(id), pts[(i + this.round - 1) % pts.length]));
    for (const id of this.order) {
      const p = this.players.get(id);
      if (p.left) p.alive = false;
    }
    const playAt = this.time + (this.kind === 'survival' ? SURVIVAL_COUNTDOWN : COUNTDOWN);
    this.rules = {
      playAt,
      shrink: this.kind === 'versus',
      allowed: this.kind === 'survival' ? SURVIVAL_SLOTS : SLOTS,
      frozen: false,
      ...this.arena,
    };
    this.phase = 'countdown';
    this.phaseUntil = playAt;
    this.spawner = makeSpawner(this);
    for (const b of this.bots.values()) b.reset();
    this.emit({ e: 'round', round: this.round, t: this.time, rules: { ...this.rules }, scores: { ...this.scores } });
  }

  // ------------------------------------------------------------ sorts

  addSpell(spec) {
    const owner = spec.owner ? this.unit(spec.owner) : null;
    const team = spec.team !== undefined ? spec.team : owner ? owner.team : null;
    const s = { ...spec, team, id: this.nextSpellId++, hit: new Set(), hitBack: new Set(), anyHit: false };
    this.spells.set(s.id, s);
    this.emit({ e: 'sp', s: packSpell(s) });
    return s;
  }

  onCast(p, ab, x, y, t) {
    this.stats[p.id].casts++;
    const b = boundsAt(this.rules, t);
    let dx = x - p.x, dy = y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    const tl = t + ab.windup;
    // Point visé, limité à la portée de lancement.
    const reach = ab.castRange ? Math.min(d, ab.castRange) : d;
    const ax = clamp(p.x + ux * reach, b.x0, b.x1), ay = clamp(p.y + uy * reach, b.y0, b.y1);
    const base = { def: ab.def, owner: p.id, target: null, t0: t, dmg: ab.dmg };
    if (ab.kind === 'line') {
      this.addSpell({
        ...base, kind: 'line', tl, ox: p.x, oy: p.y, dx: ux, dy: uy,
        speed: ab.speed, range: ab.range, radius: ab.radius, ret: !!ab.ret, pierce: !!ab.pierce,
        stun: ab.stun || 0, root: ab.root || 0, pull: ab.pull || 0, slow: 0,
        mark: ab.mark || 0, markDmg: ab.markDmg || 0, dmgMax: ab.dmgMax || 0, dmgMaxAt: ab.dmgMaxAt || ab.range,
        fx: ab.stun ? 'stun' : ab.root ? 'root' : ab.pull ? 'pull' : ab.mark ? 'mark' : '',
      });
    } else if (ab.kind === 'circle') {
      this.addSpell({
        ...base, kind: 'circle', tl, td: tl + ab.delay, x: ax, y: ay, r: ab.radius,
        slow: ab.slow || 0, slowDur: ab.slowDur || 0, fx: ab.slow ? 'slow' : '',
      });
    } else if (ab.kind === 'salvo') {
      for (let i = 0; i < ab.count; i++) {
        const k = 150 + i * ab.spacing;
        this.addSpell({
          ...base, kind: 'circle', tl, td: tl + ab.delay + i * ab.stagger,
          x: clamp(p.x + ux * k, b.x0, b.x1), y: clamp(p.y + uy * k, b.y0, b.y1), r: ab.radius, fx: '',
        });
      }
    } else if (ab.kind === 'ring') {
      this.addSpell({
        ...base, kind: 'ring', tl, ta: tl + ab.delay, te: tl + ab.delay + ab.active,
        x: ax, y: ay, r: ab.radius, th: ab.thickness, stun: ab.stun || 0, fx: 'stun',
      });
    } else if (ab.kind === 'beam') {
      this.addSpell({
        ...base, kind: 'beam', tl, ta: t + ab.delay, te: t + ab.delay + ab.active,
        ax: p.x, ay: p.y, bx: p.x + ux * ab.length, by: p.y + uy * ab.length, hw: ab.halfWidth, fx: '',
      });
    }
  }

  onAttack(p, tg, t) {
    this.stats[p.id].casts++;
    this.addSpell({
      kind: 'homing', def: 'auto', owner: p.id, target: null, tgt: tg.id, t0: t, tl: t + AUTO.windup,
      ox: p.x, oy: p.y, px: p.x, py: p.y, speed: AUTO.speed, dmg: AUTO.dmg, fx: '',
    });
  }

  // Fin anticipée (touché, annulé) : les clients en sont informés.
  endSpell(s, t, x, y, why) {
    this.spells.delete(s.id);
    this.emit({ e: 'end', id: s.id, t, x: round2(x), y: round2(y), why });
  }

  // Fin naturelle : les clients la calculent eux-mêmes.
  expireSpell(s) {
    this.spells.delete(s.id);
    if (s.target && !s.anyHit) {
      const p = this.players.get(s.target);
      if (p && p.alive) this.stats[p.id].dodges++;
    }
  }

  updateSpells(t0, t1) {
    for (const s of this.spells.values()) {
      if (s.kind === 'homing') this.updateHoming(s, t0, t1);
      else if (s.kind === 'line') this.updateLine(s, t0, t1);
      else if (s.kind === 'circle') {
        if (t1 >= s.td) {
          for (const p of this.units) {
            if (!p.alive || friendly(s, p)) continue;
            if ((p.x - s.x) ** 2 + (p.y - s.y) ** 2 < (s.r + p.r) ** 2) this.hit(s, p, t1, p.x, p.y);
          }
          this.expireSpell(s);
        }
      } else {
        if (t1 >= s.ta) {
          for (const p of this.units) {
            if (!p.alive || friendly(s, p) || s.hit.has(p.id)) continue;
            let touched;
            if (s.kind === 'beam') {
              touched = segPointDist2(s.ax, s.ay, s.bx, s.by, p.x, p.y) < (s.hw + p.r) ** 2;
            } else {
              touched = Math.abs(Math.hypot(p.x - s.x, p.y - s.y) - s.r) < s.th / 2 + p.r;
            }
            if (touched) {
              s.hit.add(p.id);
              this.hit(s, p, t1, p.x, p.y);
            }
          }
        }
        if (t1 >= s.te) this.expireSpell(s);
      }
    }
  }

  // Auto-attaque : suit sa cible jusqu'à la toucher.
  updateHoming(s, t0, t1) {
    if (t1 <= s.tl) return;
    const tg = this.unit(s.tgt);
    if (!tg || !tg.alive) return this.endSpell(s, t1, s.px, s.py, 'cancel');
    const step = s.speed * (t1 - Math.max(t0, s.tl));
    const dx = tg.x - s.px, dy = tg.y - s.py;
    const d = Math.hypot(dx, dy);
    if (d <= step + tg.r * 0.5) {
      this.hit(s, tg, t1, tg.x - (dx / (d || 1)) * tg.r, tg.y - (dy / (d || 1)) * tg.r);
      return this.endSpell(s, t1, tg.x, tg.y, 'hit');
    }
    s.px += (dx / d) * step;
    s.py += (dy / d) * step;
    if (t1 > s.tl + 3) this.endSpell(s, t1, s.px, s.py, 'cancel');
  }

  updateLine(s, t0, t1) {
    if (t1 <= s.tl) return;
    const end = lineEnd(s);
    const ta = Math.max(t0, s.tl), tb = Math.min(t1, end);
    if (tb > ta) {
      const segs = [];
      if (s.ret) {
        const apex = s.tl + s.range / s.speed;
        if (ta < apex && tb > apex) segs.push([ta, apex, 1], [apex, tb, 2]);
        else segs.push([ta, tb, tb <= apex ? 1 : 2]);
      } else {
        segs.push([ta, tb, 1]);
      }
      for (const [a, b, ph] of segs) {
        const pa = linePos(s, a), pb = linePos(s, b);
        const hitSet = ph === 2 ? s.hitBack : s.hit;
        let best = null, bestK = 2;
        for (const p of this.units) {
          if (!p.alive || friendly(s, p) || hitSet.has(p.id)) continue;
          if (segPointDist2(pa.x, pa.y, pb.x, pb.y, p.x, p.y) >= (s.radius + p.r) ** 2) continue;
          const k = segParam(pa.x, pa.y, pb.x, pb.y, p.x, p.y);
          if (s.pierce) {
            hitSet.add(p.id);
            this.hit(s, p, t1, pa.x + (pb.x - pa.x) * k, pa.y + (pb.y - pa.y) * k);
          } else if (k < bestK) {
            bestK = k;
            best = p;
          }
        }
        if (best) {
          const hx = pa.x + (pb.x - pa.x) * bestK, hy = pa.y + (pb.y - pa.y) * bestK;
          hitSet.add(best.id);
          // Javelot : dégâts selon la distance parcourue.
          const far = s.dmgMax ? clamp(Math.hypot(hx - s.ox, hy - s.oy) / s.dmgMaxAt, 0, 1) : 0;
          this.hit(far ? { ...s, dmg: Math.round(s.dmg + (s.dmgMax - s.dmg) * far) } : s, best, t1, hx, hy);
          s.anyHit = true;
          this.endSpell(s, t1, hx, hy, 'hit');
          return;
        }
      }
    }
    if (t1 >= end) this.expireSpell(s);
  }

  // ------------------------------------------------------------ dégâts et contrôles

  hit(s, p, t, hx, hy) {
    s.anyHit = true;
    // Voile anti-sort : bloque entièrement un sort (pas les auto-attaques).
    if (t < p.spellShieldUntil && s.kind !== 'homing') {
      p.spellShieldUntil = 0;
      this.emit({ e: 'hit', sid: s.id, def: s.def, tid: p.id, by: s.owner, dmg: 0, t, x: round2(hx), y: round2(hy), fx: 'block' });
      return;
    }
    // Stase : rien ne touche (ni sort, ni auto-attaque).
    if (t < p.stasisUntil) {
      this.emit({ e: 'hit', sid: s.id, def: s.def, tid: p.id, by: s.owner, dmg: 0, t, x: round2(hx), y: round2(hy), fx: 'block' });
      return;
    }
    let dmg = this.oneHit ? p.hp : s.dmg || 0;
    // Flux marqué : le prochain coup du lanceur sur la cible marquée fait exploser la marque.
    let popped = false;
    if (s.mark) {
      p.markUntil = t + s.mark;
      p.markBy = s.owner;
      p.markDmg = s.markDmg;
    } else if (s.owner && p.markBy === s.owner && t < p.markUntil) {
      dmg += p.markDmg;
      p.markUntil = 0;
      popped = true;
    }
    if (!this.oneHit && t < p.shieldUntil && p.shield > 0) {
      const absorbed = Math.min(p.shield, dmg);
      p.shield -= absorbed;
      dmg -= absorbed;
    }
    const before = p.hp;
    p.hp = Math.max(0, p.hp - dmg);
    const dealt = before - p.hp;
    if (s.owner && this.stats[s.owner]) {
      this.stats[s.owner].dmg += dealt;
      this.stats[s.owner].hits++;
    }
    let fx = s.mark ? 'mark' : popped ? 'pop' : '';
    if (p.hp > 0) {
      if (s.slow) {
        p.slowAmt = t < p.slowUntil ? Math.max(p.slowAmt, s.slow) : s.slow;
        p.slowUntil = Math.max(p.slowUntil, t + s.slowDur);
        fx = 'slow';
      }
      // cc : multiplicateur des contrôles subis (0,5 pour une élite, 0 pour un boss).
      const cc = p.cc ?? 1;
      if (s.root && cc > 0) {
        p.rootUntil = Math.max(p.rootUntil, t + s.root * cc);
        fx = 'root';
      }
      if (s.stun && cc > 0) {
        p.stunUntil = Math.max(p.stunUntil, t + s.stun * cc);
        p.mv = false;
        this.interrupt(p, t);
        fx = 'stun';
      }
      if (s.pull && cc >= 1) {
        this.pull(p, s, t);
        fx = 'pull';
      }
    }
    this.emit({ e: 'hit', sid: s.id, def: s.def, tid: p.id, by: s.owner, dmg: dealt, t, x: round2(hx), y: round2(hy), fx });
    if (p.hp <= 0) this.kill(p, s, t);
  }

  pull(p, s, t) {
    const dx = s.ox - p.x, dy = s.oy - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const pd = Math.min(s.pull, Math.max(0, d - p.r * 1.5));
    const b = boundsAt(this.rules, t);
    p.dash = {
      k: 'pull', fx: p.x, fy: p.y,
      tx: clamp(p.x + (dx / d) * pd, b.x0 + p.r, b.x1 - p.r),
      ty: clamp(p.y + (dy / d) * pd, b.y0 + p.r, b.y1 - p.r),
      ts: t, te: t + PULL_DURATION,
    };
    p.stunUntil = Math.max(p.stunUntil, t + PULL_DURATION);
    p.mv = false;
    this.interrupt(p, t);
  }

  // Un contrôle dur pendant l'incantation annule le sort.
  // cu (annulable jusqu'à) : pour les attaques d'ennemis dont la préparation dépasse le départ du sort.
  interrupt(p, t) {
    if (!(t < p.castUntil)) return;
    p.castUntil = t;
    for (const s of this.spells.values()) {
      if (s.owner === p.id && t < (s.cu ?? s.tl ?? s.t0)) {
        this.endSpell(s, t, s.ox ?? s.x ?? s.ax, s.oy ?? s.y ?? s.ay, 'cancel');
      }
    }
  }

  kill(p, s, t) {
    this.interrupt(p, t);
    p.alive = false;
    p.mv = false;
    p.dash = null;
    if (this.stats[p.id]) this.stats[p.id].deaths++;
    const by = s ? s.owner : null;
    if (by && by !== p.id && this.stats[by]) this.stats[by].kills++;
    this.emit({ e: 'die', id: p.id, by, def: s ? s.def : '', t, x: round2(p.x), y: round2(p.y) });
    if (this.kind === 'survival') this.deathTime = t;
  }

  // ------------------------------------------------------------ fin de manche / partie

  checkEnd(t) {
    if (this.kind === 'survival') {
      const p = this.players.get(this.order[0]);
      if (!p.alive) this.finishSurvival(t);
      return;
    }
    const alive = this.order.filter((id) => this.players.get(id).alive);
    if (alive.length > 1) return;
    const winner = alive.length === 1 ? alive[0] : null;
    this.rules.frozen = true;
    if (winner) this.scores[winner]++;
    const remaining = this.order.filter((id) => !this.players.get(id).left);
    if ((winner && this.scores[winner] >= this.settings.roundsToWin) || remaining.length <= 1) {
      this.finishMatch(winner ?? remaining[0] ?? null, t);
    } else {
      this.phase = 'roundEnd';
      this.phaseUntil = t + ROUND_END_DELAY;
      this.emit({ e: 'roundEnd', winner, round: this.round, scores: { ...this.scores }, t });
    }
  }

  finishMatch(winner, t) {
    this.phase = 'matchEnd';
    this.over = true;
    this.winner = winner;
    this.emit({ e: 'matchEnd', winner, scores: { ...this.scores }, stats: JSON.parse(JSON.stringify(this.stats)), t });
  }

  finishSurvival(t) {
    this.phase = 'over';
    this.over = true;
    const id = this.order[0];
    const survived = Math.max(0, this.deathTime - this.rules.playAt);
    this.result = { survived, dodges: this.stats[id].dodges, difficulty: this.settings.difficulty };
    this.emit({ e: 'over', survived, dodges: this.stats[id].dodges, t });
  }
}
