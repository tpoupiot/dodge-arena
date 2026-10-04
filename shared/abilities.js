// Définitions des compétences des joueurs et des sorts de l'arène.
// Les noms sont originaux ; les mécaniques reprennent des archétypes connus des MOBA.

// Compétences des joueurs (touches par défaut Q W E R D F).
export const ABILITIES = {
  Q: {
    slot: 'Q', name: 'Trait arcanique', kind: 'line', def: 'q',
    windup: 0.2, speed: 2000, radius: 30, range: 1100, dmg: 18, cd: 1.6,
    desc: 'Projectile rapide et fin. Délai d\'incantation 0,2 s.',
  },
  W: {
    slot: 'W', name: 'Éruption', kind: 'circle', def: 'w',
    windup: 0.25, castRange: 850, radius: 130, delay: 0.7, dmg: 22, slow: 0.35, slowDur: 1.5, cd: 7,
    desc: 'Zone qui explose après 0,7 s et ralentit de 35 %.',
  },
  E: {
    slot: 'E', name: 'Bond', kind: 'dash', range: 340, duration: 0.16, cd: 7,
    desc: 'Ruée rapide vers le curseur.',
  },
  R: {
    slot: 'R', name: 'Lien de glace', kind: 'line', def: 'r',
    windup: 0.3, speed: 1500, radius: 50, range: 2200, dmg: 25, stun: 1.5, cd: 22,
    desc: 'Grand projectile qui traverse l\'arène et étourdit 1,5 s.',
  },
  D: {
    slot: 'D', name: 'Flash', kind: 'blink', range: 400, cd: 15,
    desc: 'Téléportation instantanée sur 400 unités.',
  },
  F: {
    slot: 'F', name: 'Fantôme', kind: 'buff', duration: 3.5, speedMul: 1.45, cd: 24,
    desc: '+45 % de vitesse de déplacement pendant 3,5 s.',
  },
};

// Sorts lancés par l'arène (mode survie et pression en versus).
// unlock = secondes avant apparition (survie normale), weight = fréquence relative.
export const ENV_SPELLS = {
  trait: {
    name: 'Trait', kind: 'line', windup: 0.35, speed: 1700, radius: 30, dmg: 15,
    unlock: 0, weight: 10,
  },
  lien: {
    name: 'Lien obscur', kind: 'line', windup: 0.45, speed: 1150, radius: 40, dmg: 10, root: 1.2,
    unlock: 6, weight: 6,
  },
  eruption: {
    name: 'Éruption', kind: 'circle', delay: 0.85, radius: 140, dmg: 20, slow: 0.4, slowDur: 1.5,
    unlock: 10, weight: 6,
  },
  grappin: {
    name: 'Grappin', kind: 'line', windup: 0.4, speed: 1600, radius: 34, dmg: 8, pull: 300,
    unlock: 18, weight: 4,
  },
  salve: {
    name: 'Salve', kind: 'salvo', count: 5, spacing: 120, delay: 0.75, stagger: 0.11, radius: 95, dmg: 12,
    unlock: 28, weight: 3,
  },
  fleche: {
    name: 'Flèche de glace', kind: 'line', windup: 0.6, speed: 1350, radius: 55, dmg: 25, stun: 1.4,
    unlock: 36, weight: 3,
  },
  rayon: {
    name: 'Rayon', kind: 'beam', delay: 1.0, active: 0.25, halfWidth: 60, dmg: 30,
    unlock: 45, weight: 2,
  },
  boomerang: {
    name: 'Boomerang', kind: 'line', windup: 0.35, speed: 1400, radius: 40, range: 950, ret: true, pierce: true, dmg: 12,
    unlock: 55, weight: 3,
  },
  cage: {
    name: 'Cage', kind: 'ring', delay: 0.6, radius: 230, thickness: 34, active: 2.6, dmg: 10, stun: 1.3,
    unlock: 70, weight: 2,
  },
};

export const PULL_DURATION = 0.25;

// Nom lisible d'un sort (pour les messages "éliminé par ...").
export function spellName(def) {
  if (ENV_SPELLS[def]) return ENV_SPELLS[def].name;
  const ab = Object.values(ABILITIES).find((a) => a.def === def);
  return ab ? ab.name : def;
}
