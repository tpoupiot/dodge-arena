// Ennemis du mode histoire : caractéristiques et IA.

export const MOB_TEAM = 'M';

// Valeurs au chapitre 1. cost : poids dans le budget d'une vague. dmg et cd : attaque de l'ennemi.
export const MOBS = {
  rodeur: { name: 'Rôdeur', color: '#f97316', hp: 34, spd: 255, r: 28, cost: 2, dmg: 10, cd: 1.5 },
  tireur: { name: 'Tireur', color: '#ef4444', hp: 26, spd: 215, r: 26, cost: 2, dmg: 9, cd: 2.4 },
  bombe: { name: 'Bombe', color: '#facc15', hp: 16, spd: 315, r: 22, cost: 1.5, dmg: 20, cd: 0 },
  pyro: { name: 'Pyromancien', color: '#fb7185', hp: 30, spd: 200, r: 28, cost: 3, dmg: 14, cd: 3.2 },
  belier: { name: 'Bélier', color: '#b45309', hp: 60, spd: 225, r: 36, cost: 4, dmg: 16, cd: 4.5 },
  sentinelle: { name: 'Sentinelle', color: '#e879f9', hp: 55, spd: 0, r: 34, cost: 4, dmg: 9, cd: 3 },
};

export const CHAPTER_HP = [1, 1.5, 2.1];
export const CHAPTER_DMG = [1, 1.2, 1.45];
export const ELITE = { hp: 2.5, r: 1.25, cd: 0.75, cc: 0.5, cost: 2.5 };
export const COOP_HP = 0.7;   // PV en plus par joueur supplémentaire

// Définition d'unité (pour createPlayer) d'un ennemi. chapter : 0 à 2, heroes : joueurs présents.
export function mobDef(id, type, { chapter = 0, elite = false, heroes = 1 } = {}) {
  const m = MOBS[type];
  return {
    id, name: elite ? `${m.name} d'élite` : m.name, color: m.color, team: MOB_TEAM, mob: type, elite,
    maxHp: Math.round(m.hp * CHAPTER_HP[chapter] * (1 + COOP_HP * (heroes - 1)) * (elite ? ELITE.hp : 1)),
    spd: m.spd, r: Math.round(m.r * (elite ? ELITE.r : 1)), cc: elite ? ELITE.cc : 1,
    dmg: Math.round(m.dmg * CHAPTER_DMG[chapter]), atkCd: m.cd * (elite ? ELITE.cd : 1),
  };
}
