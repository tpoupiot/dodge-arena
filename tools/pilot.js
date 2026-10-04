// Pilote scripté : joue une run du mode histoire sans intervention (tests, équilibrage).
// Il vise l'ennemi le plus proche, garde ses distances, ouvre les coffres et passe les portes.

import { abilityOf } from '../shared/abilities.js';
import { predictPos } from '../shared/sim.js';

const AIMED = ['line', 'circle', 'salvo', 'ring', 'beam'];

export class Pilot {
  // god : les PV sont remis au maximum à chaque appel (le pilote ne meurt jamais).
  constructor(match, id, { god = false } = {}) {
    this.m = match;
    this.id = id;
    this.god = god;
    this.next = 0;
  }

  cmd(c) {
    return this.m.botCommand(this.id, c);
  }

  update() {
    const m = this.m, p = m.players.get(this.id), t = m.time;
    if (m.over || !p.alive) return;
    if (this.god) p.hp = p.maxHp;
    if (m.phase !== 'playing' || t < this.next) return;
    this.next = t + 0.1;
    const room = m.room;
    const offer = room.offers.get(this.id);
    if (offer && !offer.done) return void this.cmd({ k: 'loot', i: this.choose(p, offer.cards) });
    if (room.cleared) {
      const c = room.chest, z = room.exit;
      if (c && !offer) return void this.cmd({ k: 'move', x: c.x, y: c.y });
      return void this.cmd({ k: 'move', x: (z.x0 + z.x1) / 2, y: (z.y0 + z.y1) / 2 });
    }
    let tg = null, bd = Infinity;
    for (const u of m.mobs.values()) {
      if (!u.alive) continue;
      const d = Math.hypot(u.x - p.x, u.y - p.y);
      if (d < bd) {
        bd = d;
        tg = u;
      }
    }
    if (!tg) return;
    if (bd < 700) {
      // Vise un peu en avant d'une cible qui se déplace.
      const aim = predictPos(tg, t, 0.3 + bd / 1800, 1);
      for (const slot of ['R', 'W', 'Q']) {
        const ab = abilityOf(p, slot);
        if (ab && AIMED.includes(ab.kind) && this.cmd({ k: 'cast', slot, x: aim.x, y: aim.y })) return;
      }
    }
    const ux = (tg.x - p.x) / (bd || 1), uy = (tg.y - p.y) / (bd || 1);
    if (bd > 560) this.cmd({ k: 'move', x: p.x + ux * 200, y: p.y + uy * 200 });
    else if (bd < 340) this.cmd({ k: 'move', x: p.x - ux * 200, y: p.y - uy * 200 });
  }

  // Une carte pour une touche vide d'abord, sinon la plus rare. -1 (passer) si le coffre est vide.
  choose(p, cards) {
    let best = -1, score = -1;
    cards.forEach((c, i) => {
      const sc = (p.build[c.slot] ? 0 : 10) + c.rar;
      if (sc > score) {
        score = sc;
        best = i;
      }
    });
    return best;
  }
}
