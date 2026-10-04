// Rendu du mode histoire : sol par chapitre, porte, coffre, ennemis, boss et haut d'écran.

import { CHAPTERS } from '../../shared/story/rooms.js';
import { BOSSES } from '../../shared/story/bosses.js';
import { clamp } from '../../shared/util.js';
import { FONT_D, FONT_B, C, rgba, mix } from './draw.js';
import { formatTime } from './settings.js';

// Palette du sol par chapitre : dégradé de base, teinte des gravures (r,g,b), couleur de la porte.
export const THEMES = [
  { base: ['#223042', '#19222f', '#111821'], accent: '170,200,230', door: '#93c5fd' },
  { base: ['#3d2717', '#26180f', '#150d08'], accent: '251,146,60', door: '#fb923c' },
  { base: ['#2c2148', '#1a1330', '#0d091a'], accent: '167,139,250', door: '#c4b5fd' },
];

// Couleur des sorts ennemis sans lanceur connu (pièges, ennemi déjà mort).
export const HOSTILE = '#f87171';

// Style du sol pour une vue : celui de l'arène, ou celui de la salle en mode histoire.
export function floorStyle(view) {
  const room = view && view.story && view.story.room;
  if (!room) return { key: 'arena', theme: THEMES[0], decor: 'cercles' };
  return { key: `story${room.i}`, theme: THEMES[room.ch], decor: room.decor };
}

// ------------------------------------------------------------ salle : porte, coffre, apparitions

export function drawStoryGround(ctx, r, view, t) {
  const st = view.story, room = st.room;
  if (!room) return;
  drawDoor(ctx, room, st.cleared, t);
  if (st.chest) drawChest(ctx, r, st.chest, t);
  for (const w of st.warns) drawWarn(ctx, w, t);
}

function drawDoor(ctx, room, open, t) {
  const z = room.door, color = THEMES[room.ch].door;
  const w = z.x1 - z.x0, h = z.y1 - z.y0;
  ctx.save();
  if (!open) {
    // Fermée : grille sombre.
    ctx.fillStyle = 'rgba(4,7,11,0.55)';
    ctx.fillRect(z.x0, z.y0, w, h);
    ctx.strokeStyle = 'rgba(233,238,243,0.22)';
    ctx.lineWidth = 3;
    ctx.strokeRect(z.x0 + 1.5, z.y0 + 1.5, w - 3, h - 3);
    const along = room.exit === 'E' || room.exit === 'W';
    ctx.beginPath();
    for (let i = 1; i < 5; i++) {
      if (along) {
        ctx.moveTo(z.x0, z.y0 + (h * i) / 5);
        ctx.lineTo(z.x1, z.y0 + (h * i) / 5);
      } else {
        ctx.moveTo(z.x0 + (w * i) / 5, z.y0);
        ctx.lineTo(z.x0 + (w * i) / 5, z.y1);
      }
    }
    ctx.stroke();
  } else {
    const pulse = 0.6 + 0.4 * Math.sin(t * 4);
    ctx.fillStyle = rgba(color, 0.14 + 0.1 * pulse);
    ctx.fillRect(z.x0, z.y0, w, h);
    ctx.strokeStyle = rgba(color, 0.6 + 0.35 * pulse);
    ctx.lineWidth = 4;
    ctx.strokeRect(z.x0 + 2, z.y0 + 2, w - 4, h - 4);
    // Chevrons qui défilent vers la sortie.
    const [dx, dy] = { E: [1, 0], W: [-1, 0], N: [0, -1], S: [0, 1] }[room.exit];
    const cx = (z.x0 + z.x1) / 2, cy = (z.y0 + z.y1) / 2;
    ctx.fillStyle = rgba(color, 0.85);
    for (let i = 0; i < 3; i++) {
      const k = ((t * 1.2 + i / 3) % 1) * 60 - 30;
      chevron(ctx, cx + dx * k, cy + dy * k, dx, dy, 14);
    }
  }
  ctx.restore();
}

function chevron(ctx, x, y, dx, dy, s) {
  const nx = -dy, ny = dx;
  ctx.beginPath();
  ctx.moveTo(x + dx * s, y + dy * s);
  ctx.lineTo(x - dx * s * 0.5 + nx * s, y - dy * s * 0.5 + ny * s);
  ctx.lineTo(x - dx * s * 0.1, y - dy * s * 0.1);
  ctx.lineTo(x - dx * s * 0.5 - nx * s, y - dy * s * 0.5 - ny * s);
  ctx.closePath();
  ctx.fill();
}

function drawChest(ctx, r, c, t) {
  const gold = c.boss ? '#fbbf24' : '#d6b370';
  const bob = c.opened ? 0 : Math.sin(t * 3) * 3;
  if (!c.opened) r.drawGlow(ctx, gold, c.x, c.y, 120 + 14 * Math.sin(t * 3), c.boss ? 0.7 : 0.45);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(c.x, c.y + 26, 46, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(c.x, c.y + bob);
  ctx.globalAlpha = c.opened ? 0.55 : 1;
  ctx.fillStyle = '#5b3a1e';
  ctx.strokeStyle = gold;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.rect(-36, -8, 72, 34);
  ctx.fill();
  ctx.stroke();
  // Couvercle : relevé une fois le coffre ouvert.
  ctx.fillStyle = '#7a4f28';
  ctx.beginPath();
  if (c.opened) ctx.rect(-36, -34, 72, 12);
  else {
    ctx.moveTo(-36, -8);
    ctx.quadraticCurveTo(0, -42, 36, -8);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = gold;
  ctx.fillRect(-5, -4, 10, 14);
  ctx.restore();
}

// Cercle d'annonce d'une apparition : il se remplit jusqu'à l'instant où l'ennemi arrive.
function drawWarn(ctx, w, t) {
  if (t >= w.at + 0.3) return;
  const k = clamp((t - w.t) / Math.max(0.01, w.at - w.t), 0, 1);
  ctx.save();
  ctx.strokeStyle = rgba(HOSTILE, 0.35 + 0.5 * k);
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.lineDashOffset = -t * 50;
  ctx.beginPath();
  ctx.arc(w.x, w.y, w.r + 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = rgba(HOSTILE, 0.1 + 0.18 * k);
  ctx.beginPath();
  ctx.arc(w.x, w.y, (w.r + 14) * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------ ennemis et boss

function poly(ctx, x, y, r, n, rot) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i * Math.PI * 2) / n;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

function body(ctx) {
  ctx.fill();
  ctx.stroke();
}

// Détails dessinés dans le repère de l'unité, tournée vers sa cible.
function facing(ctx, x, y, ang, draw) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  draw();
  ctx.restore();
}

// Silhouette de chaque type : (ctx, x, y, rayon, angle, temps, unité). Le remplissage et le contour sont déjà réglés.
const SHAPES = {
  // Rôdeur : disque à trois griffes vers l'avant.
  rodeur(ctx, x, y, R, ang) {
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    body(ctx);
    facing(ctx, x, y, ang, () => {
      ctx.fillStyle = C.chalk;
      for (const a of [-0.5, 0, 0.5]) {
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (R + 12), Math.sin(a) * (R + 12));
        ctx.lineTo(Math.cos(a + 0.2) * (R - 3), Math.sin(a + 0.2) * (R - 3));
        ctx.lineTo(Math.cos(a - 0.2) * (R - 3), Math.sin(a - 0.2) * (R - 3));
        ctx.closePath();
        ctx.fill();
      }
    });
  },
  // Tireur : losange avec un arc tendu.
  tireur(ctx, x, y, R, ang) {
    poly(ctx, x, y, R * 1.15, 4, ang);
    body(ctx);
    facing(ctx, x, y, ang, () => {
      ctx.strokeStyle = C.chalk;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(R * 0.2, 0, R * 0.75, -1.1, 1.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-R * 0.3, 0);
      ctx.lineTo(R * 1.1, 0);
      ctx.stroke();
    });
  },
  // Bombe : disque à mèche, qui clignote pendant la mise à feu.
  bombe(ctx, x, y, R, ang, t, st) {
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    body(ctx);
    ctx.fillStyle = t < st.castUntil && Math.sin(t * 40) > 0 ? '#ffffff' : '#7f1d1d';
    ctx.beginPath();
    ctx.arc(x, y, R * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y - R);
    ctx.quadraticCurveTo(x + 8, y - R - 10, x + 3, y - R - 16);
    ctx.stroke();
  },
  // Pyromancien : hexagone avec une flamme.
  pyro(ctx, x, y, R, ang, t) {
    poly(ctx, x, y, R * 1.08, 6, Math.PI / 6);
    body(ctx);
    const k = 1 + 0.12 * Math.sin(t * 9);
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.moveTo(x, y - R * 0.6 * k);
    ctx.quadraticCurveTo(x + R * 0.5, y, x, y + R * 0.45);
    ctx.quadraticCurveTo(x - R * 0.5, y, x, y - R * 0.6 * k);
    ctx.fill();
  },
  // Bélier : carré trapu à deux cornes.
  belier(ctx, x, y, R, ang) {
    poly(ctx, x, y, R * 1.2, 4, ang + Math.PI / 4);
    body(ctx);
    facing(ctx, x, y, ang, () => {
      ctx.fillStyle = C.chalk;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(R * 0.7, s * R * 0.35);
        ctx.lineTo(R * 1.45, s * R * 0.7);
        ctx.lineTo(R * 0.75, s * R * 0.8);
        ctx.closePath();
        ctx.fill();
      }
    });
  },
  // Sentinelle : octogone à œil central, avec un canon.
  sentinelle(ctx, x, y, R, ang, t) {
    poly(ctx, x, y, R * 1.08, 8, Math.PI / 8);
    body(ctx);
    facing(ctx, x, y, ang, () => {
      ctx.fillStyle = C.chalk;
      ctx.fillRect(R * 0.3, -5, R * 0.95, 10);
    });
    ctx.fillStyle = rgba('#ffffff', 0.7 + 0.3 * Math.sin(t * 6));
    ctx.beginPath();
    ctx.arc(x, y, R * 0.3, 0, Math.PI * 2);
    ctx.fill();
  },
  // Gardien de pierre : bloc irrégulier, fissure lumineuse.
  gardien(ctx, x, y, R, ang) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI * 2) / 10, k = i % 2 ? 0.9 : 1.08;
      ctx.lineTo(x + Math.cos(a) * R * k, y + Math.sin(a) * R * k);
    }
    ctx.closePath();
    body(ctx);
    facing(ctx, x, y, ang, () => {
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-R * 0.45, -R * 0.2);
      ctx.lineTo(0, R * 0.1);
      ctx.lineTo(-R * 0.1, R * 0.45);
      ctx.stroke();
      ctx.fillStyle = '#fde68a';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(R * 0.45, s * R * 0.28, R * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  },
  // Forgeronne des braises : disque couronné de braises, marteau.
  forgeronne(ctx, x, y, R, ang, t) {
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    body(ctx);
    ctx.fillStyle = '#fde68a';
    for (let i = 0; i < 8; i++) {
      const a = t * 1.5 + (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * (R + 12), y + Math.sin(a) * (R + 12), 5, 0, Math.PI * 2);
      ctx.fill();
    }
    facing(ctx, x, y, ang, () => {
      ctx.fillStyle = C.chalk;
      ctx.fillRect(-R * 0.1, -5, R * 0.8, 10);
      ctx.fillRect(R * 0.6, -R * 0.38, R * 0.36, R * 0.76);
    });
  },
  // Archonte du Vide : étoile à cœur noir, satellites en orbite.
  archonte(ctx, x, y, R, ang, t) {
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = t * 0.4 + (i * Math.PI) / 8, k = i % 2 ? 0.72 : 1.12;
      ctx.lineTo(x + Math.cos(a) * R * k, y + Math.sin(a) * R * k);
    }
    ctx.closePath();
    body(ctx);
    ctx.fillStyle = '#07040f';
    ctx.beginPath();
    ctx.arc(x, y, R * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f5d0fe';
    for (let i = 0; i < 3; i++) {
      const a = -t * 2 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * R * 0.3, y + Math.sin(a) * R * 0.3, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

export function drawMobs(ctx, r, view, t) {
  const me = view.players.find((p) => p.isYou);
  for (const m of view.mobs) {
    if (!m.alive) continue;
    const st = m.st, R = st.r;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(m.x, m.y + R * 0.33, R * 1.05, R * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cible de l'auto-attaque en cours.
    if (me && me.alive && me.st && me.st.atk === m.id) {
      ctx.strokeStyle = 'rgba(248,113,113,0.9)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.arc(m.x, m.y, R + 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (st.elite || st.boss) r.drawGlow(ctx, m.color, m.x, m.y, R * (st.boss ? 2.6 : 2.2), 0.35 + 0.1 * Math.sin(t * 5));
    const grd = ctx.createRadialGradient(m.x - R * 0.3, m.y - R * 0.35, R * 0.1, m.x, m.y, R);
    grd.addColorStop(0, mix(m.color, '#ffffff', 0.3));
    grd.addColorStop(0.6, mix(m.color, '#0b1018', 0.4));
    grd.addColorStop(1, mix(m.color, '#0b1018', 0.75));
    ctx.fillStyle = grd;
    ctx.strokeStyle = mix(m.color, '#ffffff', st.elite ? 0.55 : 0.15);
    ctx.lineWidth = st.boss ? 6 : st.elite ? 5 : 3.5;
    (SHAPES[st.mob] || SHAPES.rodeur)(ctx, m.x, m.y, R, st.ang, t, st);
    r.drawStatus(ctx, m, st, t, R);
    ctx.restore();
  }
}

// Barre de vie au-dessus d'un ennemi blessé ou d'élite. Le boss a la sienne en haut de l'écran.
export function drawMobOverheads(ctx, view) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (const m of view.mobs) {
    const st = m.st;
    if (!m.alive || st.boss) continue;
    if (st.hp >= st.maxHp && !st.elite) continue;
    const w = clamp(st.r * 1.7, 44, 96), h = st.elite ? 8 : 6;
    const x = m.x - w / 2, y = m.y - st.r - 20;
    ctx.fillStyle = 'rgba(6,9,14,0.85)';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = C.enemy;
    ctx.fillRect(x, y, (w * clamp(st.hp, 0, st.maxHp)) / st.maxHp, h);
    if (st.elite) {
      ctx.font = `600 13px ${FONT_B}`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(6,9,14,0.85)';
      ctx.strokeText(m.name, m.x, y - 6);
      ctx.fillStyle = mix(m.color, '#ffffff', 0.5);
      ctx.fillText(m.name, m.x, y - 6);
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------ interface (coordonnées écran)

export function drawStoryTop(ctx, r, view, s, t) {
  const st = view.story, room = st.room;
  if (!room) return;
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.font = `500 ${13 * s}px ${FONT_B}`;
  ctx.fillStyle = C.mist;
  ctx.fillText(`Chapitre ${room.ch + 1} : ${CHAPTERS[room.ch].name}`, r.w / 2, 14 * s);
  const boss = st.boss && view.mobs.find((m) => m.id === st.boss.id);
  if (boss) drawBossBar(ctx, r, boss, st.boss, s);
  else {
    ctx.font = `900 ${28 * s}px ${FONT_D}`;
    ctx.fillStyle = C.chalk;
    ctx.fillText(room.type === 'boss' ? 'Salle du boss' : `Salle ${room.n} / ${room.of}`, r.w / 2, 40 * s);
  }
  // Chrono de la run.
  if (st.runStart !== null) {
    const el = st.result ? st.result.time : Math.max(0, t - st.runStart);
    ctx.textAlign = 'right';
    ctx.font = `900 ${28 * s}px ${FONT_D}`;
    ctx.fillStyle = C.chalk;
    ctx.fillText(formatTime(el).slice(0, 5), r.w - 18, 50 * s);
  }
  // Alliés (coop) : nom et vie, en haut à gauche.
  let y = 30 * s;
  ctx.textAlign = 'left';
  for (const p of view.players) {
    if (p.isYou) continue;
    const w = 150 * s, h = 8 * s, x = 18;
    ctx.globalAlpha = p.alive ? 1 : 0.5;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(x + 6 * s, y, 6 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `600 ${15 * s}px ${FONT_B}`;
    ctx.fillStyle = C.chalk;
    ctx.fillText(p.alive ? p.name : `${p.name} (à terre)`, x + 18 * s, y + 1);
    ctx.fillStyle = 'rgba(8,12,18,0.85)';
    ctx.fillRect(x, y + 14 * s, w, h);
    ctx.fillStyle = C.self;
    ctx.fillRect(x, y + 14 * s, p.alive ? (w * clamp(p.st.hp, 0, p.st.maxHp)) / p.st.maxHp : 0, h);
    y += 42 * s;
  }
  ctx.restore();
}

function drawBossBar(ctx, r, boss, info, s) {
  const w = Math.min(560 * s, r.w * 0.5), h = 16 * s, x = (r.w - w) / 2, y = 46 * s;
  ctx.font = `700 ${17 * s}px ${FONT_B}`;
  ctx.fillStyle = mix(boss.color, '#ffffff', 0.4);
  ctx.fillText(BOSSES[info.key].name, r.w / 2, 32 * s);
  ctx.fillStyle = 'rgba(8,12,18,0.85)';
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = '#3b1219';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = C.enemy;
  ctx.fillRect(x, y, w * clamp(boss.st.hp / boss.st.maxHp, 0, 1), h);
  // Seuils de phase.
  ctx.fillStyle = 'rgba(8,12,18,0.8)';
  for (const f of [0.33, 0.66]) ctx.fillRect(x + w * f - 1, y, 2, h);
}

// Textes au centre : titre de la salle à l'entrée, consigne une fois la salle vidée, joueur à terre.
export function drawStoryOverlay(ctx, r, view, s, t) {
  const st = view.story, room = st.room;
  if (!room) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = r.w / 2, cy = r.oy + r.ah * r.scale * 0.42;
  const rem = view.rules ? view.rules.playAt - t : 0;
  if (view.phase.name === 'countdown' && rem > 0) {
    const title = room.type === 'boss' ? BOSSES[room.boss].name : `Salle ${room.n}`;
    ctx.globalAlpha = clamp(rem / 0.4, 0, 1);
    ctx.font = `900 ${84 * s}px ${FONT_D}`;
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(8,12,18,0.7)';
    ctx.strokeText(title, cx, cy);
    ctx.fillStyle = C.chalk;
    ctx.fillText(title, cx, cy);
    ctx.font = `600 ${20 * s}px ${FONT_B}`;
    ctx.fillStyle = C.mist;
    ctx.fillText(`Chapitre ${room.ch + 1} : ${CHAPTERS[room.ch].name}`, cx, cy + 64 * s);
    ctx.globalAlpha = 1;
  }
  const me = view.me;
  if (st.cleared && !st.result) {
    let hint = st.chest && !st.chest.opened && me && me.alive ? 'Ouvre le coffre au centre, puis passe la porte' : 'Passe la porte';
    if (st.exit.of > 1 && st.exit.n > 0) {
      hint = `${st.exit.n} / ${st.exit.of} dans la porte, départ dans ${Math.max(0, Math.ceil(st.exit.until - t))} s`;
    }
    ctx.font = `600 ${17 * s}px ${FONT_B}`;
    const w = ctx.measureText(hint).width + 28 * s;
    ctx.fillStyle = 'rgba(8,12,18,0.72)';
    ctx.fillRect(cx - w / 2, 78 * s, w, 30 * s);
    ctx.fillStyle = C.chalk;
    ctx.fillText(hint, cx, 93.5 * s);
  }
  if (me && !me.alive && !st.result) {
    const text = 'À terre : retour à la prochaine salle';
    ctx.font = `700 ${22 * s}px ${FONT_B}`;
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(8,12,18,0.8)';
    ctx.strokeText(text, cx, r.h - 150 * s);
    ctx.fillStyle = '#fb7185';
    ctx.fillText(text, cx, r.h - 150 * s);
  }
  ctx.restore();
}
