// Constantes communes au serveur et au navigateur.
// Unités : "unités de jeu" proches de celles de LoL (vitesse ~340, Flash 400).

export const TICK_RATE = 60;               // ticks de simulation par seconde
export const DT = 1 / TICK_RATE;
export const SNAPSHOT_EVERY = 2;           // 1 snapshot réseau tous les 2 ticks (30/s)

export const ARENA_W = 1600;              // taille de base (survie, 1v1)
export const ARENA_H = 900;
export const ARENA_SCALE_3 = 1.25;         // agrandissement à 3 joueurs

// Taille de l'arène selon le nombre de joueurs de la partie.
export function arenaSize(n) {
  const k = n >= 3 ? ARENA_SCALE_3 : 1;
  return { w: ARENA_W * k, h: ARENA_H * k };
}

export const PLAYER_RADIUS = 36;           // hitbox des joueurs
export const MOVE_SPEED = 340;             // vitesse de déplacement de base
export const MAX_HP = 100;

export const COUNTDOWN = 3;                // décompte avant une manche (versus)
export const SURVIVAL_COUNTDOWN = 1.5;     // décompte avant une partie de survie
export const ROUND_END_DELAY = 3.5;        // pause entre deux manches

// Mort subite (versus) : l'arène rétrécit pour forcer une fin de manche.
export const SUDDEN_DEATH_AT = 60;         // secondes après le début de la manche
export const SHRINK_DURATION = 30;         // durée du rétrécissement
export const SHRINK_MIN = 0.45;            // taille finale (fraction de l'arène)

export const MAX_INPUT_LEAD = 0.3;         // un input ne peut pas viser plus loin dans le futur

export const MAX_NAME = 16;
export const MAX_CHAT = 120;

export const PLAYER_COLORS = ['#38bdf8', '#f43f5e', '#f5b83d'];
export const ENV_COLOR = '#b48cff';

export const SLOTS = ['Q', 'W', 'E', 'R', 'D', 'F'];
export const SURVIVAL_SLOTS = ['E', 'D', 'F'];

// Nombre de joueurs par mode en ligne.
export const MODES = { '1v1': 2, '1v1v1': 3 };
