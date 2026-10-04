// Réglages du joueur (touches, mode de lancement, volume, records), sauvegardés dans le navigateur.

import { sanitizeBuild, DEFAULT_BUILD } from '../../shared/abilities.js';

const KEY = 'dodge-arena-settings-v1';

// Les touches sont stockées par position physique (event.code), comme LoL :
// sur un clavier AZERTY, les sorts tombent naturellement sur A Z E R.
export const ACTIONS = [
  { id: 'Q', label: 'Sort Q' },
  { id: 'W', label: 'Sort W' },
  { id: 'E', label: 'Sort E' },
  { id: 'R', label: 'Sort R (ultime)' },
  { id: 'D', label: 'Sort d\'invocateur D' },
  { id: 'F', label: 'Sort d\'invocateur F' },
  { id: 'stop', label: 'Stop' },
];

const DEFAULTS = {
  name: '',
  binds: { Q: 'KeyQ', W: 'KeyW', E: 'KeyE', R: 'KeyR', D: 'KeyD', F: 'KeyF', stop: 'KeyS' },
  castMode: 'quick',
  volume: 0.6,
  showPerf: true,
  survivalDifficulty: 'normal',
  vsMode: '1v1',
  vsBot: 'normal',
  vsRounds: 2,
  vsEnv: 'normal',
  build: { ...DEFAULT_BUILD },
  best: { facile: 0, normal: 0, difficile: 0, hardcore: 0 },
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const s = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULTS),
      ...s,
      binds: { ...DEFAULTS.binds, ...(s.binds || {}) },
      best: { ...DEFAULTS.best, ...(s.best || {}) },
      build: sanitizeBuild(s.build),
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export const settings = load();

export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Navigation privée ou stockage bloqué : les réglages restent valables pour cette session.
  }
}

export function resetBinds() {
  settings.binds = { ...DEFAULTS.binds };
  saveSettings();
}

// ------------------------------------------------------------ libellés des touches

let layoutMap = null;
const lang = (typeof navigator !== 'undefined' && navigator.language) || '';
const guessAzerty = /^fr(-FR|-BE|-LU|-MC)?$/i.test(lang);
const AZERTY = { KeyQ: 'A', KeyA: 'Q', KeyW: 'Z', KeyZ: 'W', Semicolon: 'M', KeyM: ',' };
const NAMED = {
  Space: 'Espace', Tab: 'Tab', Enter: 'Entrée', Backspace: 'Retour', Escape: 'Échap',
  ShiftLeft: 'Maj', ShiftRight: 'Maj D', ControlLeft: 'Ctrl', ControlRight: 'Ctrl D',
  AltLeft: 'Alt', AltRight: 'Alt Gr', CapsLock: 'Verr. maj',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
};
// Caractères réellement produits par les touches, appris au fil des frappes (utile sans getLayoutMap).
const learned = {};

export function learnKey(e) {
  if (e.key && e.key.length === 1 && e.key.trim()) learned[e.code] = e.key.toUpperCase();
}

export async function loadKeyboardLayout() {
  try {
    if (navigator.keyboard && navigator.keyboard.getLayoutMap) layoutMap = await navigator.keyboard.getLayoutMap();
  } catch {
    layoutMap = null;
  }
}

export function keyLabel(code) {
  if (!code) return '—';
  const mapped = layoutMap && layoutMap.get(code);
  if (mapped && mapped.trim()) return mapped.toUpperCase();
  if (learned[code]) return learned[code];
  if (guessAzerty && AZERTY[code]) return AZERTY[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Pavé ' + code.slice(6);
  return NAMED[code] || code;
}

export function formatTime(sec) {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${String(m).padStart(2, '0')}:${r.toFixed(1).padStart(4, '0')}`;
}
