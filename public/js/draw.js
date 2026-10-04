// Couleurs, polices et outils de dessin communs au rendu de l'arène et du mode histoire.

import { ENV_COLOR } from '../../shared/constants.js';

export const FONT_D = '"Big Shoulders Display", "Barlow", sans-serif';
export const FONT_B = '"Barlow", system-ui, sans-serif';
export const C = {
  night: '#10161f', stone: '#1b2430', stoneHi: '#263241', line: '#33404f',
  chalk: '#e9eef3', mist: '#93a1b0', self: '#5ee08f', enemy: '#ef4b54', shield: '#f1f5f9', env: ENV_COLOR,
};

export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function mix(hex, hex2, k) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(hex2.slice(1), 16);
  const ch = (s) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}
