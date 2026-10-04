// Butin du mode histoire : kit de départ, raretés des coffres, tirage des cartes.

import { ABILITIES } from '../abilities.js';
import { pickWeighted } from '../util.js';

export const STORY_TEAM = 'P';
export const STORY_COLORS = ['#38bdf8', '#4ade80', '#f1f5f9'];
export const SKIP_HEAL = 30;   // PV rendus quand on passe un coffre

// Chances (en %) de chaque rareté, du Commun au Légendaire, par chapitre.
export const RARITY_WEIGHTS = [
  [70, 25, 5, 0],
  [45, 35, 17, 3],
  [25, 38, 27, 10],
];

export function startLoadout() {
  return {
    build: { Q: 'trait', W: null, E: null, R: null, D: null, F: null },
    rar: { Q: 0, W: 0, E: 0, R: 0, D: 0, F: 0 },
  };
}

// Définition d'un joueur du mode histoire : équipe commune, couleur d'allié, kit de départ.
export function heroDef(def, i) {
  return { ...def, team: STORY_TEAM, color: STORY_COLORS[i % STORY_COLORS.length], loadout: startLoadout() };
}

// Rareté d'une carte. Coffre de boss : table du chapitre suivant, au moins Rare.
export function rollRarity(rng, chapter, bossChest = false) {
  const table = RARITY_WEIGHTS[Math.min(RARITY_WEIGHTS.length - 1, chapter + (bossChest ? 1 : 0))];
  const lvl = pickWeighted(rng, table.map((w, v) => ({ w, v })));
  return bossChest ? Math.max(1, lvl) : lvl;
}

// Touche sur laquelle irait un sort pour ce joueur.
// Sort d'invocateur : sa touche s'il est déjà possédé, sinon la touche vide (D d'abord), sinon la moins rare.
export function slotFor(hero, id) {
  const cat = ABILITIES[id].slot;
  if (cat !== 'S') return cat;
  const b = hero.build, r = hero.rar;
  if (b.D === id) return 'D';
  if (b.F === id) return 'F';
  if (!b.D) return 'D';
  if (!b.F) return 'F';
  return r.F < r.D ? 'F' : 'D';
}

// Tire jusqu'à 3 cartes { ab, rar, slot } pour un joueur. chapter : 0 à 2.
export function drawOffer(rng, hero, chapter, bossChest = false) {
  let pool = [];
  for (const id in ABILITIES) {
    const slot = slotFor(hero, id);
    const rar = rollRarity(rng, chapter, bossChest);
    const cur = hero.build[slot];
    // Jamais moins bien que le kit : ni rareté inférieure, ni le même sort à rareté égale.
    if (cur && (rar < hero.rar[slot] || (cur === id && rar === hero.rar[slot]))) continue;
    pool.push({ w: cur ? 1 : 4, v: { ab: id, rar, slot } });
  }
  const cards = [];
  while (cards.length < 3 && pool.length) {
    // Trois touches différentes tant que c'est possible.
    const used = new Set(cards.map((c) => c.slot));
    const fresh = pool.filter((c) => !used.has(c.v.slot));
    const card = pickWeighted(rng, fresh.length ? fresh : pool);
    cards.push(card);
    pool = pool.filter((c) => c.v.ab !== card.ab);
  }
  return cards;
}

export function applyCard(hero, card) {
  hero.build[card.slot] = card.ab;
  hero.rar[card.slot] = card.rar;
  hero.cds[card.slot] = 0;
}
