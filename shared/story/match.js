// Une run du mode histoire : enchaînement des salles, vagues d'ennemis, porte de sortie, fin de run.

import { Match } from '../match.js';
import { SLOTS } from '../constants.js';
import { createPlayer } from '../sim.js';
import { EnvSpawner } from '../spawner.js';
import { round2 } from '../util.js';
import { generateRun, TRAPS, doorZone, entryPoints, ROOMS_PER_CHAPTER, SPAWN_WARN } from './rooms.js';
import { MOBS, ELITE, MOB_TEAM, mobDef, MobBrain } from './mobs.js';
import { BOSSES, bossDef } from './bosses.js';
import { heroDef, drawOffer, applyCard, SKIP_HEAL } from './loot.js';

// Décompte à l'entrée d'une salle (secondes).
export const INTRO_DELAY = 5;      // première salle : le temps de lire l'intro
export const CHAPTER_DELAY = 4;    // première salle des chapitres 2 et 3
export const BOSS_DELAY = 3.5;
export const ROOM_DELAY = 1.5;
export const EXIT_WAIT = 12;       // coop : départ forcé après l'arrivée du premier joueur dans la porte
export const REVIVE_HP = 0.5;      // coop : part des PV d'un joueur mort à son retour
export const CHEST_RANGE = 130;    // distance à laquelle un joueur ouvre le coffre

export class StoryMatch extends Match {
  // o = { players: [{ id, name }], time, seed }
  constructor(o) {
    const heroes = o.players.map(heroDef);
    super({ ...o, kind: 'story', players: heroes });
    this.heroDefs = heroes;   // définitions envoyées aux clients : équipe, couleur, kit de départ
  }

  setup() {
    this.rooms = generateRun(this.seed);
    this.room = null;
    this.brains = new Map();   // IA des ennemis, par id
    this.pending = [];         // apparitions annoncées : { type, elite, boss, at, x, y }
    this.nextMobId = 1;
    this.runStart = 0;
    this.cleared = 0;          // nombre de salles vidées
    this.result = null;
  }

  startRound() {
    this.enterRoom(0);
  }

  heroes() {
    return this.order.map((id) => this.players.get(id));
  }

  // Les pièges (sorts sans lanceur) sont du côté des ennemis : ils ne touchent que les joueurs.
  addSpell(spec) {
    return super.addSpell(spec.owner == null && spec.team === undefined ? { ...spec, team: MOB_TEAM } : spec);
  }

  cancelEnemySpells(t) {
    for (const s of this.spells.values()) {
      if (s.team === MOB_TEAM) this.endSpell(s, t, s.ox ?? s.x ?? s.ax, s.oy ?? s.y ?? s.ay, 'cancel');
    }
  }

  // ------------------------------------------------------------ salles

  enterRoom(i) {
    const def = this.rooms[i], t = this.time;
    this.spells.clear();
    this.mobs.clear();
    this.brains.clear();
    this.pending = [];
    this.units = this.units.filter((u) => !u.mob);
    const present = this.heroes().filter((p) => !p.left);
    const pts = entryPoints(def, present.length);
    present.forEach((p, k) => {
      if (!p.alive) {
        p.alive = true;
        p.hp = Math.ceil(p.maxHp * REVIVE_HP);
        this.emit({ e: 'revive', id: p.id, hp: p.hp, t });
      }
      const sp = pts[k];
      p.x = sp.x; p.y = sp.y; p.tx = sp.x; p.ty = sp.y; p.mv = false; p.ang = sp.ang;
      p.atk = null; p.dash = null; p.castUntil = 0; p.castSlot = '';
      p.stunUntil = 0; p.rootUntil = 0; p.slowUntil = 0; p.slowAmt = 0;
    });
    const delay = i === 0 ? INTRO_DELAY : def.type === 'boss' ? BOSS_DELAY : def.n === 1 ? CHAPTER_DELAY : ROOM_DELAY;
    const playAt = t + delay;
    if (i === 0) this.runStart = playAt;
    this.rules = { playAt, shrink: false, allowed: SLOTS, frozen: false, w: def.w, h: def.h };
    this.phase = 'countdown';
    this.phaseUntil = playAt;
    this.spawner = def.trap ? new EnvSpawner(this, TRAPS[def.trap]) : null;
    this.room = {
      def, wave: -1, cleared: false, heroes: present.length,
      chest: null, offers: new Map(),
      exit: doorZone(def, def.exit), exitSince: null, inExit: 0, exitOf: 0,
    };
    this.emit({
      e: 'room', t, rules: { ...this.rules },
      i, ch: def.chapter, n: def.n, of: ROOMS_PER_CHAPTER, type: def.type, decor: def.decor,
      entry: def.entry, exit: def.exit, door: this.room.exit, trap: def.trap, boss: def.boss,
    });
    this.nextWave(playAt);
  }

  // Annonce la vague suivante : ses ennemis apparaissent à l'instant `at`.
  nextWave(at) {
    const room = this.room, def = room.def;
    room.wave++;
    const list = def.type === 'boss' ? [{ boss: def.boss }] : def.waves[room.wave];
    for (const m of list) this.announce(m, at);
  }

  // Annonce une apparition : cercle au sol, puis l'ennemi à l'instant `at`.
  announce(m, at) {
    const def = this.room.def;
    const pos = m.boss ? { x: def.w / 2, y: def.h / 2 } : this.spawnPoint();
    const x = round2(pos.x), y = round2(pos.y);
    const r = m.boss ? BOSSES[m.boss].r : Math.round(MOBS[m.type].r * (m.elite ? ELITE.r : 1));
    this.pending.push({ ...m, at, x, y });
    this.emit({ e: 'warn', x, y, r, at, t: this.time });
  }

  // Point d'apparition loin des joueurs et des autres apparitions annoncées.
  spawnPoint() {
    const { w, h } = this.rules;
    const alive = this.heroes().filter((p) => p.alive);
    let best = null, bestD = -1;
    for (let k = 0; k < 20; k++) {
      const x = 80 + this.rng() * (w - 160), y = 80 + this.rng() * (h - 160);
      let d = Infinity;
      for (const p of alive) d = Math.min(d, Math.hypot(p.x - x, p.y - y));
      for (const q of this.pending) if (Math.hypot(q.x - x, q.y - y) < 90) d = 0;
      if (d >= 400) return { x, y };
      if (d > bestD) {
        bestD = d;
        best = { x, y };
      }
    }
    return best;
  }

  // s = { type, elite, x, y } pour un ennemi, { boss, x, y } pour un boss.
  addMob(s, t) {
    const id = 'm' + this.nextMobId++;
    const def = s.boss
      ? bossDef(id, s.boss, this.room.heroes)
      : mobDef(id, s.type, { chapter: this.room.def.chapter, elite: !!s.elite, heroes: this.room.heroes });
    const u = createPlayer(def, 0);
    u.x = s.x; u.y = s.y; u.tx = s.x; u.ty = s.y;
    this.mobs.set(id, u);
    this.units.push(u);
    if (!s.boss) this.brains.set(id, new MobBrain(this, u, def, t));
    this.emit({ e: 'spawn', u: def, x: u.x, y: u.y, t });
    return u;
  }

  // ------------------------------------------------------------ boucle

  tick(t0, t1) {
    const room = this.room;
    this.sweep();
    this.spawnDue(t1);
    for (const b of this.brains.values()) b.update(t1);
    if (room.cleared) {
      this.updateChest(t1);
      this.updateExit(t1);
    }
    else if (!this.mobs.size && !this.pending.length) {
      if (room.def.type === 'combat' && room.wave + 1 < room.def.waves.length) this.nextWave(t1 + SPAWN_WARN);
      else this.clearRoom(t1);
    }
  }

  // Retire les ennemis morts. Jamais pendant le parcours des collisions : seulement ici, en début de pas.
  sweep() {
    let dead = false;
    for (const m of this.mobs.values()) {
      if (m.alive) continue;
      this.mobs.delete(m.id);
      this.brains.delete(m.id);
      dead = true;
    }
    if (dead) this.units = this.units.filter((u) => u.alive || !u.mob);
  }

  spawnDue(t) {
    if (!this.pending.length || this.pending.every((s) => s.at > t)) return;
    const due = this.pending.filter((s) => s.at <= t);
    this.pending = this.pending.filter((s) => s.at > t);
    for (const s of due) this.addMob(s, t);
  }

  clearRoom(t) {
    const room = this.room, def = room.def;
    room.cleared = true;
    this.cleared++;
    this.spawner = null;
    this.cancelEnemySpells(t);
    if (def.index === this.rooms.length - 1) return this.finishStory(true, t);
    if (def.type === 'boss') {
      // Battre un boss soigne entièrement tous les joueurs vivants.
      for (const p of this.heroes()) {
        if (!p.alive || p.hp >= p.maxHp) continue;
        this.emit({ e: 'heal', id: p.id, amt: p.maxHp - p.hp, t });
        p.hp = p.maxHp;
      }
    }
    room.chest = { x: def.w / 2, y: def.h / 2, boss: def.type === 'boss' };
    this.emit({ e: 'clear', i: def.index, chest: room.chest, t });
  }

  // Salle suivante quand tous les joueurs vivants sont dans la porte, ou EXIT_WAIT après le premier.
  updateExit(t) {
    const room = this.room, z = room.exit;
    let alive = 0, inside = 0;
    for (const p of this.heroes()) {
      if (!p.alive) continue;
      alive++;
      if (p.x >= z.x0 && p.x <= z.x1 && p.y >= z.y0 && p.y <= z.y1) inside++;
    }
    if (!inside) room.exitSince = null;
    else if (room.exitSince === null) room.exitSince = t;
    if (inside !== room.inExit || alive !== room.exitOf) {
      room.inExit = inside;
      room.exitOf = alive;
      this.emit({ e: 'exit', n: inside, of: alive, until: inside ? room.exitSince + EXIT_WAIT : 0, t });
    }
    if (inside && (inside === alive || t - room.exitSince >= EXIT_WAIT)) this.enterRoom(room.def.index + 1);
  }

  // ------------------------------------------------------------ coffre

  // Commande de butin, en plus des commandes du moteur. Pas de déplacement pendant un tirage en attente.
  command(p, cmd, t) {
    if (cmd.k === 'loot') return this.takeLoot(p, cmd.i, t);
    const offer = this.room.offers.get(p.id);
    if (offer && !offer.done && (cmd.k === 'move' || cmd.k === 'attack')) return false;
    return super.command(p, cmd, t);
  }

  // Un joueur vivant qui atteint le coffre reçoit son tirage, une seule fois par salle.
  updateChest(t) {
    const room = this.room, c = room.chest;
    if (!c) return;
    for (const p of this.heroes()) {
      if (!p.alive || room.offers.has(p.id)) continue;
      if (Math.hypot(p.x - c.x, p.y - c.y) > CHEST_RANGE) continue;
      const cards = drawOffer(this.rng, p, room.def.chapter, c.boss);
      room.offers.set(p.id, { cards, done: false });
      p.mv = false;
      p.atk = null;
      this.emit({ e: 'offer', id: p.id, cards, heal: SKIP_HEAL, t });
    }
  }

  // i : indice de la carte prise, ou -1 pour passer (rend des PV).
  takeLoot(p, i, t) {
    const offer = this.room.offers.get(p.id);
    if (!offer || offer.done || !p.alive || !Number.isInteger(i)) return false;
    if (i === -1) {
      const amt = Math.min(SKIP_HEAL, p.maxHp - p.hp);
      p.hp += amt;
      this.emit({ e: 'heal', id: p.id, amt, t });
    } else {
      const card = offer.cards[i];
      if (!card) return false;
      applyCard(p, card);
      this.emit({ e: 'kit', id: p.id, slot: card.slot, ab: card.ab, rar: card.rar, t });
    }
    offer.done = true;
    this.emit({ e: 'looted', id: p.id, t });
    return true;
  }

  // ------------------------------------------------------------ morts et fin de run

  // Un bélier arrêté pendant sa préparation ne charge pas.
  interrupt(p, t) {
    if (p.mob && p.dash && t < p.dash.ts) p.dash = null;
    super.interrupt(p, t);
  }

  kill(p, s, t) {
    super.kill(p, s, t);
    if (p.mob || this.over) return;
    if (!this.heroes().some((h) => h.alive)) this.finishStory(false, t);
  }

  // La défaite est décidée à la mort du dernier joueur, la victoire à la mort du dernier boss.
  checkEnd() {}

  removePlayer(id) {
    super.removePlayer(id);
    if (this.over) return;
    const rest = this.heroes().filter((p) => !p.left);
    if (rest.length && !rest.some((p) => p.alive)) this.finishStory(false, this.time);
  }

  finishStory(win, t) {
    if (this.over) return;
    this.phase = 'over';
    this.over = true;
    this.rules.frozen = true;
    const def = this.room.def;
    const kits = {};
    for (const p of this.heroes()) kits[p.id] = { build: { ...p.build }, rar: { ...p.rar } };
    this.result = { win, ch: def.chapter, n: def.n, cleared: this.cleared, time: Math.max(0, t - this.runStart) };
    this.emit({ e: 'storyEnd', ...this.result, stats: JSON.parse(JSON.stringify(this.stats)), kits, t });
  }
}
