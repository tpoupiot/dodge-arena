// Simulation d'équilibrage : fait jouer des runs au pilote scripté et mesure chaque salle.
// Usage : node tools/balance.js [nombre de graines]
// Le pilote est immortel et n'esquive pas : les dégâts subis sont un repère de pression, pas une prédiction.

import { StoryMatch } from '../shared/story/match.js';
import { Pilot } from './pilot.js';

const seeds = Number(process.argv[2]) || 20;
const rooms = Array.from({ length: 15 }, () => ({ time: 0, dmg: 0, n: 0 }));
let total = 0, wins = 0;

for (let seed = 1; seed <= seeds; seed++) {
  const m = new StoryMatch({ players: [{ id: 'a', name: 'A' }], seed });
  const pilot = new Pilot(m, 'a', { god: true });
  let cur = 0, enter = 0;
  for (let i = 0; i < 60 * 60 * 60 && !m.over; i++) {
    pilot.update();
    m.step();
    for (const ev of m.drainEvents()) {
      if (ev.e === 'room') {
        cur = ev.i;
        enter = ev.rules.playAt;
      } else if (ev.e === 'hit' && ev.tid === 'a') rooms[cur].dmg += ev.dmg;
      else if (ev.e === 'clear' || ev.e === 'storyEnd') {
        rooms[cur].time += ev.t - enter;
        rooms[cur].n++;
      }
    }
  }
  if (m.result && m.result.win) {
    wins++;
    total += m.result.time;
  }
}

console.log(`${wins}/${seeds} runs terminées, durée moyenne ${(total / Math.max(1, wins) / 60).toFixed(1)} min`);
console.log('salle  durée (s)  dégâts subis');
rooms.forEach((r, i) => {
  const n = Math.max(1, r.n);
  console.log(`${String(i + 1).padStart(5)}  ${(r.time / n).toFixed(1).padStart(9)}  ${(r.dmg / n).toFixed(0).padStart(12)}`);
});
