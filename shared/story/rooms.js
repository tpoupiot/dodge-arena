// Salles du mode histoire : chapitres, tailles, pièges, génération d'une run, géométrie des portes.

import { mulberry32 } from '../util.js';
import { MOBS, ELITE } from './mobs.js';

export const ROOMS_PER_CHAPTER = 5;   // 4 salles de combat puis le boss
export const MAX_ALIVE = 10;          // ennemis vivants à la fois
export const SPAWN_WARN = 0.9;        // durée du cercle d'annonce avant une apparition (s)
export const DOOR_W = 240;            // largeur de la porte le long du mur
export const DOOR_D = 110;            // profondeur de la zone de porte

export const ROOM_SIZES = [
  { w: 1400, h: 800 }, { w: 1600, h: 900 }, { w: 1900, h: 1000 }, { w: 1250, h: 1000 }, { w: 2200, h: 900 },
];
export const BOSS_SIZE = { w: 1900, h: 1000 };
export const DECORS = ['cercles', 'dalles', 'runes'];

// budget : budget d'une vague en salle 1. trapRooms : nombre de salles piégées du chapitre.
export const CHAPTERS = [
  { id: 'catacombes', name: 'Les Catacombes', boss: 'gardien', mobs: ['rodeur', 'tireur', 'bombe'], budget: 5, traps: ['fleches'], trapRooms: 1 },
  { id: 'forge', name: 'La Forge', boss: 'forgeronne', mobs: ['rodeur', 'tireur', 'bombe', 'pyro', 'belier'], budget: 8, traps: ['fleches', 'eruptions'], trapRooms: 2 },
  { id: 'sanctuaire', name: 'Le Sanctuaire du Vide', boss: 'archonte', mobs: ['rodeur', 'tireur', 'bombe', 'pyro', 'belier', 'sentinelle'], budget: 9, traps: ['fleches', 'eruptions', 'lasers'], trapRooms: 2 },
];

// Pièges : préréglages d'EnvSpawner limités à un sort de l'arène, à faible cadence.
export const TRAPS = {
  fleches: { only: ['trait'], r0: 0.4, rMax: 0.6, tau: 30, speed: 0, unlock: 0, first: 1.5 },
  eruptions: { only: ['eruption'], r0: 0.35, rMax: 0.5, tau: 30, speed: 0, unlock: 0, first: 1.5 },
  lasers: { only: ['rayon'], r0: 0.25, rMax: 0.4, tau: 30, speed: 0, unlock: 0, first: 2 },
};

const WAVES = [1, 2, 2, 3];   // nombre de vagues des salles 1 à 4
const OPPOSITE = { E: 'W', W: 'E', N: 'S', S: 'N' };
const INWARD = { E: [-1, 0], W: [1, 0], N: [0, 1], S: [0, -1] };

const pick = (rng, list) => list[Math.floor(rng() * list.length)];

// Une vague : des ennemis du chapitre tirés jusqu'à épuisement du budget.
function makeWave(rng, ch, n, elite) {
  const c = CHAPTERS[ch];
  let budget = c.budget + 1.5 * (n - 1);
  const wave = [];
  if (elite) {
    const type = pick(rng, c.mobs.filter((t) => t !== 'bombe'));
    wave.push({ type, elite: true });
    budget -= MOBS[type].cost * ELITE.cost;
  }
  while (wave.length < MAX_ALIVE) {
    const fits = c.mobs.filter((t) => MOBS[t].cost <= budget);
    if (!fits.length) break;
    const type = pick(rng, fits);
    wave.push({ type, elite: false });
    budget -= MOBS[type].cost;
  }
  return wave;
}

// Les 15 salles d'une run. La même graine donne la même run.
export function generateRun(seed) {
  const rng = mulberry32((seed ^ 0x5bd1e995) >>> 0);
  const rooms = [];
  let entry = 'W';
  for (let ch = 0; ch < CHAPTERS.length; ch++) {
    const c = CHAPTERS[ch];
    const trapped = new Set();   // salles piégées : jamais la première ni celle du boss
    while (trapped.size < c.trapRooms) trapped.add(2 + Math.floor(rng() * 3));
    for (let n = 1; n <= ROOMS_PER_CHAPTER; n++) {
      const boss = n === ROOMS_PER_CHAPTER;
      const size = boss ? BOSS_SIZE : pick(rng, ROOM_SIZES);
      const exit = pick(rng, ['E', 'N', 'S'].filter((s) => s !== entry));
      const waves = [];
      if (!boss) {
        const elite = ch > 0 && n >= 3 && rng() < 0.5;
        for (let i = 0; i < WAVES[n - 1]; i++) waves.push(makeWave(rng, ch, n, elite && i === WAVES[n - 1] - 1));
      }
      rooms.push({
        index: rooms.length, chapter: ch, n, type: boss ? 'boss' : 'combat', w: size.w, h: size.h,
        decor: pick(rng, DECORS), entry, exit,
        trap: !boss && trapped.has(n) ? pick(rng, c.traps) : null,
        waves, boss: boss ? c.boss : null,
      });
      entry = OPPOSITE[exit];
    }
  }
  return rooms;
}

// Zone rectangulaire de la porte, au milieu du mur du côté donné.
export function doorZone(room, side) {
  const { w, h } = room;
  if (side === 'E') return { x0: w - DOOR_D, y0: h / 2 - DOOR_W / 2, x1: w, y1: h / 2 + DOOR_W / 2 };
  if (side === 'W') return { x0: 0, y0: h / 2 - DOOR_W / 2, x1: DOOR_D, y1: h / 2 + DOOR_W / 2 };
  if (side === 'N') return { x0: w / 2 - DOOR_W / 2, y0: 0, x1: w / 2 + DOOR_W / 2, y1: DOOR_D };
  return { x0: w / 2 - DOOR_W / 2, y0: h - DOOR_D, x1: w / 2 + DOOR_W / 2, y1: h };
}

// Points d'apparition de n joueurs, devant la porte d'entrée et tournés vers la salle.
export function entryPoints(room, n) {
  const z = doorZone(room, room.entry);
  const [ix, iy] = INWARD[room.entry];
  const cx = (z.x0 + z.x1) / 2 + ix * 120, cy = (z.y0 + z.y1) / 2 + iy * 120;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 90;   // côte à côte, le long du mur
    pts.push({ x: cx + Math.abs(iy) * off, y: cy + Math.abs(ix) * off, ang: Math.atan2(iy, ix) });
  }
  return pts;
}
