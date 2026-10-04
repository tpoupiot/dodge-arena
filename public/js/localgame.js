// Partie hors ligne (survie, contre l'IA, démo du menu) : la simulation tourne dans le navigateur.

import { Match } from '../../shared/match.js';
import { DT, PLAYER_COLORS } from '../../shared/constants.js';
import { extrapolate, spellEnd } from '../../shared/sim.js';
import { botName } from '../../shared/bot.js';
import { randomBuild } from '../../shared/abilities.js';

export class LocalGame {
  // kind : 'survival' | 'versus' ; bots : nombre d'IA adverses ; demo : une IA joue seule (fond du menu)
  constructor({ kind, name = 'Toi', settings = {}, bots = 0, botLevel = 'normal', demo = false, seed, build }) {
    this.kind = kind;
    this.you = demo ? null : 'you';
    const players = [];
    if (demo) players.push({ id: 'demo', name: 'IA', color: PLAYER_COLORS[0], bot: true, botLevel: 'difficile' });
    else players.push({ id: 'you', name, color: PLAYER_COLORS[0], build });
    for (let i = 0; i < bots; i++) {
      players.push({ id: 'b' + i, name: botName(i), color: PLAYER_COLORS[(i + 1) % PLAYER_COLORS.length], bot: true, botLevel, build: randomBuild() });
    }
    this.match = new Match({ kind, players, settings, time: 0, seed });
    this.settings = this.match.settings;
    this.acc = 0;
    this.last = null;
    this.paused = false;
    this.speed = 1;
    this.spells = new Map();
    this.phase = { name: 'countdown', round: 1, scores: {}, winner: null };
    this.backlog = this.absorb(this.match.drainEvents());
  }

  get players() {
    return this.match.players;
  }

  input(cmd) {
    if (!this.you || this.paused) return;
    this.match.botCommand(this.you, cmd);
  }

  // Tient à jour la liste des sorts affichés et la phase de jeu à partir des événements.
  absorb(events) {
    for (const ev of events) {
      switch (ev.e) {
        case 'round':
          this.spells.clear();
          this.phase = { name: 'countdown', round: ev.round, scores: ev.scores, winner: null };
          break;
        case 'go':
          this.phase = { ...this.phase, name: 'playing' };
          break;
        case 'sp':
          this.spells.set(ev.s.id, { ...ev.s, end: spellEnd(ev.s), cut: Infinity, hiddenAt: null });
          break;
        case 'end': {
          const s = this.spells.get(ev.id);
          if (s) {
            s.cut = ev.t;
            s.cutWhy = ev.why;
          }
          break;
        }
        case 'roundEnd':
          this.phase = { name: 'roundEnd', round: ev.round, scores: ev.scores, winner: ev.winner };
          break;
        case 'matchEnd':
          this.phase = { name: 'matchEnd', round: this.phase.round, scores: ev.scores, winner: ev.winner, stats: ev.stats };
          break;
        case 'over':
          this.phase = { ...this.phase, name: 'over' };
          break;
      }
    }
    return events;
  }

  update(now) {
    if (this.last === null) this.last = now;
    const dt = Math.min(0.25, now - this.last) * this.speed;
    this.last = now;
    const out = this.backlog;
    this.backlog = [];
    if (this.paused) return out;
    this.acc += dt;
    while (this.acc >= DT) {
      this.match.step();
      this.acc -= DT;
      out.push(...this.absorb(this.match.drainEvents()));
    }
    out.push(...this.absorb(this.match.drainEvents()));
    const t = this.match.time;
    for (const [id, s] of this.spells) if (t > Math.min(s.end, s.cut) + 1.5) this.spells.delete(id);
    return out;
  }

  view() {
    const m = this.match;
    const t = m.time + this.acc;
    const players = m.order.map((id) => {
      const p = m.players.get(id);
      const e = extrapolate(p, m.time, this.acc, m.rules);
      return {
        id, name: p.name, color: p.color, slot: p.slot, bot: p.bot,
        x: e.x, y: e.y, st: p, isYou: id === this.you, alive: p.alive, hp: p.hp,
      };
    });
    return {
      t,
      kind: this.kind,
      rules: m.rules,
      phase: this.phase,
      you: this.you,
      me: this.you ? m.players.get(this.you) : null,
      players,
      spells: [...this.spells.values()],
      roundsToWin: this.settings.roundsToWin,
    };
  }
}
