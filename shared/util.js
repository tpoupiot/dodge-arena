// Petites fonctions mathématiques partagées.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, k) => a + (b - a) * k;

export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

// Paramètre k (0..1) du point du segment [A,B] le plus proche de P.
export function segParam(ax, ay, bx, by, px, py) {
  const abx = bx - ax, aby = by - ay;
  const len2 = abx * abx + aby * aby;
  if (len2 <= 1e-9) return 0;
  return clamp(((px - ax) * abx + (py - ay) * aby) / len2, 0, 1);
}

// Distance au carré entre le point P et le segment [A,B].
export function segPointDist2(ax, ay, bx, by, px, py) {
  const k = segParam(ax, ay, bx, by, px, py);
  const cx = ax + (bx - ax) * k - px;
  const cy = ay + (by - ay) * k - py;
  return cx * cx + cy * cy;
}

// Distance entre P (à l'intérieur du rectangle) et le bord, le long de la direction (dx, dy).
export function rayToRect(px, py, dx, dy, x0, y0, x1, y1) {
  let t = Infinity;
  if (dx > 1e-9) t = Math.min(t, (x1 - px) / dx);
  else if (dx < -1e-9) t = Math.min(t, (x0 - px) / dx);
  if (dy > 1e-9) t = Math.min(t, (y1 - py) / dy);
  else if (dy < -1e-9) t = Math.min(t, (y0 - py) / dy);
  return Math.max(0, t);
}

// Générateur pseudo-aléatoire déterministe (pour rejouer une partie avec la même graine).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Loi normale centrée réduite (Box-Muller).
export function gauss(rng) {
  let u = 0;
  while (u === 0) u = rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Tirage pondéré : items = [{ w, v }].
export function pickWeighted(rng, items) {
  let total = 0;
  for (const it of items) total += it.w;
  let r = rng() * total;
  for (const it of items) {
    r -= it.w;
    if (r <= 0) return it.v;
  }
  return items[items.length - 1].v;
}

export const round2 = (v) => Math.round(v * 100) / 100;
