// Boss du mode histoire : caractéristiques, moteur d'attaques et kits.

import { MOB_TEAM } from './mobs.js';

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
