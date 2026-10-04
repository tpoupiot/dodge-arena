// Rendu canvas : arène, sorts, joueurs, indicateurs de visée et interface de jeu (HUD).

import { ARENA_W, ARENA_H, PLAYER_RADIUS as R, MAX_HP, SUDDEN_DEATH_AT } from '../../shared/constants.js';
import { abilityOf, AUTO, RARITIES } from '../../shared/abilities.js';
import { boundsAt, linePos, lineEnd } from '../../shared/sim.js';
import { mulberry32, clamp } from '../../shared/util.js';
import { settings, keyLabel, formatTime } from './settings.js';
import { FONT_D, FONT_B, C, rgba, mix } from './draw.js';
import {
  HOSTILE, floorStyle, drawStoryGround, drawMobs, drawMobOverheads, drawStoryTop, drawStoryOverlay,
} from './render-story.js';

const SLOT_TINT = { Q: '#38bdf8', W: '#fb923c', E: '#4ade80', R: '#93c5fd', D: '#facc15', F: '#5eead4' };
const HUD_SLOTS = ['Q', 'W', 'E', 'R', 'D', 'F'];

// Points de bouclier encore actifs d'un joueur.
const shieldOf = (st, t) => (st && st.shield > 0 && t < st.shieldUntil ? st.shield : 0);

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mode = 'demo';
    this.glowCache = new Map();
    this.floor = null;
    this.aw = ARENA_W;
    this.ah = ARENA_H;
    this.floorStyle = floorStyle(null);   // palette et décor du sol (changent par salle en mode histoire)
    this.floorKey = this.floorStyle.key;
    this.resize();
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    this.dpr = dpr;
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.hud = clamp(Math.min(w / 1600, h / 940), 0.7, 1.25);
    if (this.mode === 'game') {
      const top = 64 * this.hud, bottom = 122 * this.hud, side = 14;
      this.scale = Math.min((w - side * 2) / this.aw, (h - top - bottom) / this.ah);
      this.ox = (w - this.aw * this.scale) / 2;
      this.oy = top + (h - top - bottom - this.ah * this.scale) / 2;
    } else {
      this.scale = Math.max(w / this.aw, h / this.ah) * 1.04;
      this.ox = (w - this.aw * this.scale) / 2;
      this.oy = (h - this.ah * this.scale) / 2;
    }
    this.floor = null;
  }

  toWorld(px, py) {
    return { x: (px - this.ox) / this.scale, y: (py - this.oy) / this.scale };
  }

  // ------------------------------------------------------------ sol de l'arène (mis en cache)

  buildFloor() {
    const s = this.scale * this.dpr;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(this.aw * s);
    cv.height = Math.ceil(this.ah * s);
    const g = cv.getContext('2d');
    g.scale(s, s);
    const cx = this.aw / 2, cy = this.ah / 2;

    const { theme, decor } = this.floorStyle;
    const base = g.createRadialGradient(cx, cy, 40, cx, cy, (980 * this.aw) / ARENA_W);
    base.addColorStop(0, theme.base[0]);
    base.addColorStop(0.55, theme.base[1]);
    base.addColorStop(1, theme.base[2]);
    g.fillStyle = base;
    g.fillRect(0, 0, this.aw, this.ah);

    // Dalles de pierre irrégulières.
    const rng = mulberry32(1234);
    const tile = 100;
    for (let y = 0; y < this.ah; y += tile) {
      let x = (y / tile) % 2 ? -tile / 2 : 0;
      for (; x < this.aw; x += tile) {
        const v = rng();
        g.fillStyle = v > 0.5 ? `rgba(255,255,255,${(v - 0.5) * 0.045})` : `rgba(0,0,0,${(0.5 - v) * 0.12})`;
        g.fillRect(x + 2, y + 2, tile - 4, tile - 4);
      }
    }
    g.strokeStyle = 'rgba(0,0,0,0.32)';
    g.lineWidth = 2.5;
    for (let y = 0; y <= this.ah; y += tile) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(this.aw, y);
      g.stroke();
      const off = (y / tile) % 2 ? tile / 2 : 0;
      for (let x = off; x <= this.aw; x += tile) {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x, Math.min(this.ah, y + tile));
        g.stroke();
      }
    }
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(255,255,255,${0.012 + rng() * 0.03})`;
      g.fillRect(rng() * this.aw, rng() * this.ah, 1.6, 1.6);
    }

    // Gravures au centre, à la teinte du chapitre. Décor « dalles » : aucune gravure.
    const ink = (a) => `rgba(${theme.accent},${a})`;
    const engrave = (r, w, a) => {
      g.lineWidth = w;
      g.strokeStyle = `rgba(0,0,0,${a * 1.6})`;
      g.beginPath();
      g.arc(cx, cy + 2, r, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = ink(a);
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
    };
    if (decor === 'cercles') {
      engrave(150, 3, 0.08);
      engrave(310, 4, 0.07);
      engrave(330, 1.5, 0.05);
      engrave(480, 3, 0.05);
      g.strokeStyle = ink(0.045);
      g.lineWidth = 2;
      for (let i = 0; i < 24; i++) {
        const a = (i * Math.PI) / 12;
        const r0 = i % 2 ? 330 : 150, r1 = i % 2 ? 480 : 310;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        g.stroke();
      }
      g.fillStyle = ink(0.06);
      for (let i = 0; i < 48; i++) {
        const a = (i * Math.PI) / 24;
        g.save();
        g.translate(cx + Math.cos(a) * 320, cy + Math.sin(a) * 320);
        g.rotate(a);
        g.fillRect(-1.5, -7, 3, 14);
        g.restore();
      }
    } else if (decor === 'runes') {
      engrave(260, 3, 0.07);
      engrave(300, 1.5, 0.05);
      g.strokeStyle = ink(0.09);
      g.lineWidth = 3;
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        g.save();
        g.translate(cx + Math.cos(a) * 280, cy + Math.sin(a) * 280);
        g.rotate(a + Math.PI / 2);
        g.beginPath();
        g.moveTo(-8, -9);
        g.lineTo(8, -9);
        g.lineTo(0, 9);
        g.closePath();
        if (i % 3 === 0) {
          g.moveTo(-8, 0);
          g.lineTo(8, 0);
        }
        g.stroke();
        g.restore();
      }
      g.strokeStyle = ink(0.05);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx - 240, cy);
      g.lineTo(cx + 240, cy);
      g.moveTo(cx, cy - 240);
      g.lineTo(cx, cy + 240);
      g.stroke();
    }

    // Ombre portée des murs et liseré.
    const edge = 70;
    const sides = [
      [0, 0, this.aw, edge, 0, 0, 0, edge],
      [0, this.ah - edge, this.aw, edge, 0, this.ah, 0, this.ah - edge],
      [0, 0, edge, this.ah, 0, 0, edge, 0],
      [this.aw - edge, 0, edge, this.ah, this.aw, 0, this.aw - edge, 0],
    ];
    for (const [x, y, w, h, x0, y0, x1, y1] of sides) {
      const lg = g.createLinearGradient(x0, y0, x1, y1);
      lg.addColorStop(0, 'rgba(4,7,11,0.55)');
      lg.addColorStop(1, 'rgba(4,7,11,0)');
      g.fillStyle = lg;
      g.fillRect(x, y, w, h);
    }
    g.strokeStyle = 'rgba(233,238,243,0.16)';
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, this.aw - 3, this.ah - 3);
    this.floor = cv;
  }

  glow(color) {
    let c = this.glowCache.get(color);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grd.addColorStop(0, rgba(color, 0.95));
      grd.addColorStop(0.22, rgba(color, 0.45));
      grd.addColorStop(0.55, rgba(color, 0.12));
      grd.addColorStop(1, rgba(color, 0));
      g.fillStyle = grd;
      g.fillRect(0, 0, 128, 128);
      this.glowCache.set(color, c);
    }
    return c;
  }

  drawGlow(ctx, color, x, y, r, alpha = 1) {
    const prevOp = ctx.globalCompositeOperation, prevA = ctx.globalAlpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.glow(color), x - r, y - r, r * 2, r * 2);
    ctx.globalCompositeOperation = prevOp;
    ctx.globalAlpha = prevA;
  }

  // ------------------------------------------------------------ image complète

  render(view, fx, ui = {}) {
    const ctx = this.ctx, dpr = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = C.night;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    // L'arène change de taille selon le nombre de joueurs ou la salle : on recadre et on redessine le sol.
    const aw = (view && view.rules && view.rules.w) || ARENA_W, ah = (view && view.rules && view.rules.h) || ARENA_H;
    if (aw !== this.aw || ah !== this.ah) {
      this.aw = aw;
      this.ah = ah;
      this.resize();
    }
    // En mode histoire, le décor change d'une salle à l'autre.
    const style = floorStyle(view);
    if (style.key !== this.floorKey) {
      this.floorKey = style.key;
      this.floorStyle = style;
      this.floor = null;
    }
    if (!this.floor) this.buildFloor();
    const sh = fx ? fx.shakeOffset() : { x: 0, y: 0 };
    const ox = this.ox + sh.x, oy = this.oy + sh.y;
    ctx.drawImage(this.floor, Math.round(ox * dpr), Math.round(oy * dpr));

    const k = this.scale * dpr;
    ctx.setTransform(k, 0, 0, k, ox * dpr, oy * dpr);
    if (view) {
      const t = view.t;
      const units = view.mobs ? [...view.players, ...view.mobs] : view.players;
      const colors = new Map(units.map((p) => [p.id, p.color]));
      const other = view.story ? HOSTILE : C.env;   // sort sans lanceur connu
      this.pos = new Map(units.map((p) => [p.id, p]));
      const spells = [...view.spells];
      this.drawBounds(ctx, view, t);
      if (view.story) drawStoryGround(ctx, this, view, t);
      for (const s of spells) this.drawGroundSpell(ctx, s, t, colors.get(s.owner) || other);
      if (view.mobs) drawMobs(ctx, this, view, t);
      this.drawPlayers(ctx, view, t);
      for (const s of spells) this.drawAirSpell(ctx, s, t, colors.get(s.owner) || other);
      if (ui.aim) this.drawAim(ctx, view, ui.aim);
    }
    if (fx) fx.drawWorld(ctx);
    if (view) {
      if (view.mobs) drawMobOverheads(ctx, view);
      this.drawOverheads(ctx, view, view.t);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.mode === 'game' && view) this.drawHud(ctx, view, fx, ui);
  }

  // ------------------------------------------------------------ arène qui rétrécit

  drawBounds(ctx, view, t) {
    const rules = view.rules;
    if (!rules || !rules.shrink || !(t > rules.playAt + SUDDEN_DEATH_AT)) return;
    const b = boundsAt(rules, t);
    ctx.save();
    ctx.fillStyle = 'rgba(40,6,24,0.55)';
    ctx.beginPath();
    ctx.rect(0, 0, this.aw, this.ah);
    ctx.rect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    ctx.fill('evenodd');
    ctx.clip('evenodd');
    ctx.strokeStyle = 'rgba(244,63,94,0.13)';
    ctx.lineWidth = 10;
    const off = (t * 40) % 40;
    for (let x = -this.ah; x < this.aw; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x + off, 0);
      ctx.lineTo(x + off + this.ah, this.ah);
      ctx.stroke();
    }
    ctx.restore();
    const pulse = 0.6 + 0.4 * Math.sin(t * 6);
    ctx.strokeStyle = rgba('#f43f5e', 0.55 + 0.35 * pulse);
    ctx.lineWidth = 4;
    ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  }

  // ------------------------------------------------------------ sorts au sol (zones, avertissements)

  drawGroundSpell(ctx, s, t, color) {
    if (t < s.t0 - 0.05) return;
    if (s.kind === 'circle') return this.drawCircleSpell(ctx, s, t, color);
    if (s.kind === 'beam') return this.drawBeamWarning(ctx, s, t, color);
    if (s.kind === 'ring') return this.drawRing(ctx, s, t, color);
    if (s.kind === 'line' && t < s.tl && s.cut === Infinity) this.drawCharge(ctx, s, t, color);
  }

  drawCircleSpell(ctx, s, t, color) {
    if (s.cut < s.td) return;
    if (t < s.tl) return;
    if (t < s.td) {
      const k = clamp((t - s.tl) / (s.td - s.tl), 0, 1);
      ctx.save();
      ctx.fillStyle = rgba(color, 0.08 + 0.06 * k);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba(color, 0.18 + 0.12 * k);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(mix(color, '#ffffff', 0.25), 0.55 + 0.4 * k);
      ctx.lineWidth = 3;
      ctx.setLineDash([16, 10]);
      ctx.lineDashOffset = -t * 40;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }
    const e = (t - s.td) / 0.35;
    if (e > 1) return;
    ctx.save();
    ctx.globalAlpha = 1 - e;
    ctx.fillStyle = rgba(mix(color, '#ffffff', 0.5), 0.5);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * (1 + e * 0.12), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    this.drawGlow(ctx, color, s.x, s.y, s.r * 1.8, (1 - e) * 0.9);
  }

  drawBeamWarning(ctx, s, t, color) {
    if (t >= s.ta) return;
    const k = clamp((t - s.t0) / (s.ta - s.t0), 0, 1);
    const dx = s.bx - s.ax, dy = s.by - s.ay;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    ctx.save();
    ctx.fillStyle = rgba(color, 0.05 + 0.08 * k);
    ctx.beginPath();
    ctx.moveTo(s.ax + nx * s.hw, s.ay + ny * s.hw);
    ctx.lineTo(s.bx + nx * s.hw, s.by + ny * s.hw);
    ctx.lineTo(s.bx - nx * s.hw, s.by - ny * s.hw);
    ctx.lineTo(s.ax - nx * s.hw, s.ay - ny * s.hw);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba(color, 0.35 + 0.3 * k);
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 12]);
    for (const sg of [1, -1]) {
      ctx.beginPath();
      ctx.moveTo(s.ax + nx * s.hw * sg, s.ay + ny * s.hw * sg);
      ctx.lineTo(s.bx + nx * s.hw * sg, s.by + ny * s.hw * sg);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    const pulse = 0.5 + 0.5 * Math.sin(t * 30);
    ctx.strokeStyle = rgba(mix(color, '#ffffff', 0.4), 0.4 + 0.5 * pulse * k);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(s.ax, s.ay);
    ctx.lineTo(s.ax + dx * k, s.ay + dy * k);
    ctx.stroke();
    ctx.restore();
  }

  drawRing(ctx, s, t, color) {
    if (t > s.te + 0.25) return;
    ctx.save();
    if (t < s.ta) {
      const k = clamp((t - s.t0) / (s.ta - s.t0), 0, 1);
      ctx.strokeStyle = rgba(color, 0.25 + 0.4 * k);
      ctx.lineWidth = s.th * (0.4 + 0.6 * k);
      ctx.setLineDash([22, 16]);
      ctx.lineDashOffset = t * 60;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const fade = t > s.te ? 1 - (t - s.te) / 0.25 : 1;
      const pulse = 0.85 + 0.15 * Math.sin(t * 12);
      ctx.globalAlpha = fade;
      ctx.strokeStyle = rgba(color, 0.75 * pulse);
      ctx.lineWidth = s.th;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = rgba('#ffffff', 0.75 * pulse);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(color, 0.25);
      ctx.lineWidth = s.th * 2.2;
      ctx.stroke();
    }
    ctx.restore();
  }

  // Charge d'un projectile avant le tir (lanceur de l'arène ou joueur).
  drawCharge(ctx, s, t, color) {
    const k = clamp((t - s.t0) / Math.max(0.01, s.tl - s.t0), 0, 1);
    ctx.save();
    const r = 46 - 26 * k;
    ctx.strokeStyle = rgba(color, 0.3 + 0.6 * k);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(s.ox, s.oy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
    ctx.stroke();
    // Amorce de trajectoire : indique la direction du tir.
    const len = 70 + 150 * k;
    const grd = ctx.createLinearGradient(s.ox, s.oy, s.ox + s.dx * len, s.oy + s.dy * len);
    grd.addColorStop(0, rgba(color, 0.45 * k + 0.1));
    grd.addColorStop(1, rgba(color, 0));
    ctx.strokeStyle = grd;
    ctx.lineWidth = s.radius * 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s.ox + s.dx * 20, s.oy + s.dy * 20);
    ctx.lineTo(s.ox + s.dx * len, s.oy + s.dy * len);
    ctx.stroke();
    ctx.restore();
    this.drawGlow(ctx, color, s.ox, s.oy, 40 + 30 * k, 0.4 + 0.5 * k);
  }

  // ------------------------------------------------------------ projectiles et rayons actifs

  drawAirSpell(ctx, s, t, color) {
    if (s.kind === 'homing') return this.drawAuto(ctx, s, t, color);
    if (s.kind === 'beam') return this.drawBeamActive(ctx, s, t, color);
    if (s.kind !== 'line') return;
    if (t < s.tl || t >= s.cut || s.hiddenAt != null) return;
    const end = lineEnd(s);
    if (t > end) return;
    const p = linePos(s, t);
    const back = linePos(s, Math.max(s.tl, t - 0.09));
    const def = s.def;
    if (def === 'grappin' || def === 'grappinq') return this.drawHook(ctx, s, p, color);
    if (def === 'lien' || def === 'lienq') return this.drawOrb(ctx, s, p, back, t, color);
    if (def === 'boomerang' || def === 'orbe') return this.drawBlade(ctx, s, p, t, color);
    if (def === 'r' || def === 'fleche') return this.drawArrow(ctx, s, p, back, color);
    this.drawBolt(ctx, s, p, back, color);
  }

  // Auto-attaque : petit projectile qui file vers la position affichée de sa cible.
  drawAuto(ctx, s, t, color) {
    if (t < s.tl || t >= s.cut) return;
    const tg = this.pos && this.pos.get(s.tgt);
    if (!tg) return;
    const dx = tg.x - s.ox, dy = tg.y - s.oy;
    const len = Math.hypot(dx, dy) || 1;
    const d = Math.min(len - R * 0.6, (t - s.tl) * s.speed);
    if (d < 0) return;
    const x = s.ox + (dx / len) * d, y = s.oy + (dy / len) * d;
    ctx.save();
    ctx.strokeStyle = rgba(color, 0.6);
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - (dx / len) * 34, y - (dy / len) * 34);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    this.drawGlow(ctx, color, x, y, 26, 0.8);
  }

  drawBolt(ctx, s, p, back, color) {
    ctx.save();
    ctx.lineCap = 'round';
    const grd = ctx.createLinearGradient(back.x, back.y, p.x, p.y);
    grd.addColorStop(0, rgba(color, 0));
    grd.addColorStop(1, rgba(color, 0.75));
    ctx.strokeStyle = grd;
    ctx.lineWidth = s.radius * 1.6;
    ctx.beginPath();
    ctx.moveTo(back.x, back.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.strokeStyle = rgba('#ffffff', 0.95);
    ctx.lineWidth = s.radius * 0.55;
    ctx.beginPath();
    ctx.moveTo(p.x - s.dx * s.radius * 1.3, p.y - s.dy * s.radius * 1.3);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.restore();
    this.drawGlow(ctx, color, p.x, p.y, s.radius * 2.8, 0.95);
  }

  drawOrb(ctx, s, p, back, t, color) {
    ctx.save();
    for (let i = 1; i <= 4; i++) {
      const k = i / 5;
      ctx.fillStyle = rgba(color, 0.18 * (1 - k));
      ctx.beginPath();
      ctx.arc(p.x + (back.x - p.x) * k * 1.6, p.y + (back.y - p.y) * k * 1.6, s.radius * (1 - k * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#1f1233';
    ctx.beginPath();
    ctx.arc(p.x, p.y, s.radius * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(mix(color, '#ffffff', 0.3), 0.95);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, s.radius * 0.9, t * 9, t * 9 + Math.PI * 1.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x, p.y, s.radius * 0.55, -t * 12, -t * 12 + Math.PI);
    ctx.stroke();
    ctx.restore();
    this.drawGlow(ctx, color, p.x, p.y, s.radius * 2.6, 0.8);
  }

  drawHook(ctx, s, p, color) {
    ctx.save();
    ctx.strokeStyle = 'rgba(200,210,225,0.55)';
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 7]);
    ctx.beginPath();
    ctx.moveTo(s.ox, s.oy);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(s.dy, s.dx));
    ctx.fillStyle = '#d6dde8';
    ctx.strokeStyle = rgba(color, 0.9);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(s.radius * 1.1, 0);
    ctx.lineTo(-s.radius * 0.5, -s.radius * 0.85);
    ctx.lineTo(-s.radius * 0.15, 0);
    ctx.lineTo(-s.radius * 0.5, s.radius * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    this.drawGlow(ctx, color, p.x, p.y, s.radius * 2.2, 0.55);
  }

  drawArrow(ctx, s, p, back, color) {
    const ice = mix(color, '#ffffff', 0.55);
    ctx.save();
    const tail = 2.4;
    const grd = ctx.createLinearGradient(p.x - s.dx * s.radius * 5, p.y - s.dy * s.radius * 5, p.x, p.y);
    grd.addColorStop(0, rgba(color, 0));
    grd.addColorStop(1, rgba(color, 0.55));
    ctx.fillStyle = grd;
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(s.dy, s.dx));
    const r = s.radius;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.55);
    ctx.lineTo(-r * 5, 0);
    ctx.lineTo(0, r * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = ice;
    ctx.strokeStyle = rgba(color, 0.95);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(r * 1.15, 0);
    ctx.lineTo(-r * 0.6, -r * 0.95);
    ctx.lineTo(-r * 0.25, 0);
    ctx.lineTo(-r * 0.6, r * 0.95);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = rgba(ice, 0.9);
    ctx.fillRect(-r * tail, -r * 0.12, r * (tail - 0.3), r * 0.24);
    ctx.restore();
    void back;
    this.drawGlow(ctx, color, p.x, p.y, r * 3, 0.85);
  }

  drawBlade(ctx, s, p, t, color) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(t * 16);
    ctx.fillStyle = rgba(mix(color, '#ffffff', 0.35), 0.95);
    for (let i = 0; i < 3; i++) {
      ctx.rotate((Math.PI * 2) / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(s.radius * 0.9, -s.radius * 0.5, s.radius * 1.1, s.radius * 0.15);
      ctx.quadraticCurveTo(s.radius * 0.45, 0, 0, s.radius * 0.25);
      ctx.fill();
    }
    ctx.restore();
    this.drawGlow(ctx, color, p.x, p.y, s.radius * 2.4, 0.75);
  }

  drawBeamActive(ctx, s, t, color) {
    if (t < s.ta || t > s.te + 0.2) return;
    const fade = t > s.te ? 1 - (t - s.te) / 0.2 : 1;
    const flick = 0.85 + 0.15 * Math.sin(t * 70);
    ctx.save();
    ctx.lineCap = 'butt';
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = fade;
    ctx.strokeStyle = rgba(color, 0.35 * flick);
    ctx.lineWidth = s.hw * 2.6;
    ctx.beginPath();
    ctx.moveTo(s.ax, s.ay);
    ctx.lineTo(s.bx, s.by);
    ctx.stroke();
    ctx.strokeStyle = rgba(color, 0.7);
    ctx.lineWidth = s.hw * 2;
    ctx.stroke();
    ctx.strokeStyle = rgba('#ffffff', 0.9 * flick);
    ctx.lineWidth = s.hw * 0.7;
    ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------ joueurs

  drawPlayers(ctx, view, t) {
    for (const p of view.players) {
      if (!p.alive) continue;
      const st = p.st;
      const col = p.color;
      ctx.save();
      // Ombre
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 12, R * 1.05, R * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cible de l'auto-attaque en cours : anneau rouge, et portée d'attaque autour de soi.
      const me = view.players.find((q) => q.isYou);
      if (me && me.st && me.st.atk === p.id && me.alive) {
        ctx.strokeStyle = 'rgba(248,113,113,0.9)';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 6]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, R + 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (p.isYou && p.st && p.st.atk) {
        ctx.strokeStyle = 'rgba(248,113,113,0.18)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, AUTO.range + R, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (p.isYou) {
        ctx.strokeStyle = rgba(C.self, 0.55);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, R + 9, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (st && t < st.ghostUntil) {
        this.drawGlow(ctx, '#5eead4', p.x, p.y, R * 2.4, 0.45);
      }

      // Corps
      const body = ctx.createRadialGradient(p.x - R * 0.3, p.y - R * 0.35, 4, p.x, p.y, R);
      body.addColorStop(0, mix(col, '#ffffff', 0.35));
      body.addColorStop(0.55, mix(col, '#0b1018', 0.35));
      body.addColorStop(1, mix(col, '#0b1018', 0.7));
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = mix(col, '#ffffff', 0.2);
      ctx.lineWidth = 4;
      ctx.stroke();

      // Orientation
      const a = st ? st.ang : 0;
      ctx.fillStyle = C.chalk;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(a) * (R + 11), p.y + Math.sin(a) * (R + 11));
      ctx.lineTo(p.x + Math.cos(a + 0.32) * (R - 2), p.y + Math.sin(a + 0.32) * (R - 2));
      ctx.lineTo(p.x + Math.cos(a - 0.32) * (R - 2), p.y + Math.sin(a - 0.32) * (R - 2));
      ctx.closePath();
      ctx.fill();

      if (st) this.drawStatus(ctx, p, st, t);
      ctx.restore();
    }
  }

  drawStatus(ctx, p, st, t, rad = R) {
    // Stase : le joueur est figé dans un bloc doré.
    if (t < st.stasisUntil) {
      ctx.fillStyle = 'rgba(250,204,21,0.38)';
      ctx.strokeStyle = 'rgba(253,230,138,0.95)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 + Math.PI / 6;
        ctx.lineTo(p.x + Math.cos(a) * (rad + 12), p.y + Math.sin(a) * (rad + 12));
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Marque du Flux : anneau qui se referme, à la couleur du lanceur.
    if (t < st.markUntil) {
      const by = this.pos && this.pos.get(st.markBy);
      const k = 1 + 0.12 * Math.sin(t * 9);
      ctx.strokeStyle = rgba(by ? by.color : '#fb923c', 0.95);
      ctx.lineWidth = 4;
      ctx.setLineDash([14, 8]);
      ctx.lineDashOffset = -t * 40;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (rad + 16) * k, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Incantation en cours : arc de progression.
    if (t < st.spellShieldUntil) {
      ctx.fillStyle = 'rgba(253,230,138,0.16)';
      ctx.strokeStyle = 'rgba(253,230,138,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad + 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    if (t < st.castUntil && st.castDur > 0) {
      const w = st.castDur;
      const k = clamp(1 - (st.castUntil - t) / w, 0, 1);
      ctx.strokeStyle = rgba('#ffffff', 0.9);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
      ctx.stroke();
      this.drawGlow(ctx, p.color, p.x, p.y, rad * 2, 0.35 + 0.4 * k);
    }
    if (t < st.slowUntil) {
      ctx.fillStyle = 'rgba(147,197,253,0.28)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    if (t < st.rootUntil) {
      ctx.strokeStyle = 'rgba(192,132,252,0.95)';
      ctx.lineWidth = 5;
      ctx.setLineDash([9, 7]);
      ctx.lineDashOffset = t * 30;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 6, rad + 8, (rad + 8) * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (t < st.stunUntil && !(st.dash && st.dash.k === 'pull')) {
      ctx.fillStyle = '#fde68a';
      for (let i = 0; i < 3; i++) {
        const a = t * 6 + (i * Math.PI * 2) / 3;
        const x = p.x + Math.cos(a) * 26, y = p.y - rad - 12 + Math.sin(a) * 7;
        ctx.beginPath();
        for (let j = 0; j < 8; j++) {
          const r = j % 2 ? 2.5 : 7;
          const aa = (j * Math.PI) / 4;
          ctx.lineTo(x + Math.cos(aa) * r, y + Math.sin(aa) * r);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  drawOverheads(ctx, view, t) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (const p of view.players) {
      if (!p.alive) continue;
      const w = 80, h = 10;
      const x = p.x - w / 2, y = p.y - R - 30;
      const hp = clamp(p.st ? p.st.hp : p.hp, 0, MAX_HP);
      ctx.fillStyle = 'rgba(6,9,14,0.85)';
      ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
      // Le bouclier prolonge la barre de vie (la barre se tasse s'il dépasse le maximum).
      const sh = shieldOf(p.st, t), tot = Math.max(MAX_HP, hp + sh);
      ctx.fillStyle = p.isYou ? C.self : C.enemy;
      ctx.fillRect(x, y, (w * hp) / tot, h);
      ctx.fillStyle = C.shield;
      ctx.fillRect(x + (w * hp) / tot, y, (w * sh) / tot, h);
      ctx.fillStyle = 'rgba(6,9,14,0.7)';
      for (let i = 1; i < 4; i++) ctx.fillRect(x + (w * i * MAX_HP) / (4 * tot) - 1, y, 2, h);
      ctx.font = `600 15px ${FONT_B}`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(6,9,14,0.85)';
      ctx.strokeText(p.name, p.x, y - 6);
      ctx.fillStyle = p.isYou ? C.chalk : mix(p.color, '#ffffff', 0.45);
      ctx.fillText(p.name, p.x, y - 6);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ indicateurs de visée (modes avec indicateur)

  drawAim(ctx, view, aim) {
    const me = view.players.find((p) => p.isYou);
    if (!me || !me.alive) return;
    const ab = me.st ? abilityOf(me.st, aim.slot) : null;
    if (!ab) return;
    const dx = aim.x - me.x, dy = aim.y - me.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    ctx.save();
    const fill = 'rgba(147,197,253,0.16)', edge = 'rgba(191,219,254,0.7)';
    if (ab.kind === 'line') {
      const nx = -uy, ny = ux, w = ab.radius;
      const ex = me.x + ux * ab.range, ey = me.y + uy * ab.range;
      ctx.fillStyle = fill;
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(me.x + nx * w, me.y + ny * w);
      ctx.lineTo(ex + nx * w, ey + ny * w);
      ctx.lineTo(ex + ux * w, ey + uy * w);
      ctx.lineTo(ex - nx * w, ey - ny * w);
      ctx.lineTo(me.x - nx * w, me.y - ny * w);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (ab.kind === 'beam') {
      const nx = -uy, ny = ux, w = ab.halfWidth;
      const ex = me.x + ux * ab.length, ey = me.y + uy * ab.length;
      ctx.fillStyle = fill;
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(me.x + nx * w, me.y + ny * w);
      ctx.lineTo(ex + nx * w, ey + ny * w);
      ctx.lineTo(ex - nx * w, ey - ny * w);
      ctx.lineTo(me.x - nx * w, me.y - ny * w);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (ab.kind === 'salvo') {
      ctx.fillStyle = fill;
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      for (let i = 0; i < ab.count; i++) {
        const k = 150 + i * ab.spacing;
        ctx.beginPath();
        ctx.arc(me.x + ux * k, me.y + uy * k, ab.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else if (ab.kind === 'ring') {
      const k = Math.min(d, ab.castRange);
      ctx.strokeStyle = 'rgba(191,219,254,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(me.x, me.y, ab.castRange, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = edge;
      ctx.lineWidth = ab.thickness;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.arc(me.x + ux * k, me.y + uy * k, ab.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (ab.kind === 'circle') {
      const k = Math.min(d, ab.castRange);
      ctx.strokeStyle = 'rgba(191,219,254,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(me.x, me.y, ab.castRange, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = fill;
      ctx.strokeStyle = edge;
      ctx.beginPath();
      ctx.arc(me.x + ux * k, me.y + uy * k, ab.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (ab.kind === 'dash' || ab.kind === 'blink') {
      const k = Math.min(d, ab.range);
      ctx.strokeStyle = 'rgba(191,219,254,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(me.x, me.y, ab.range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = fill;
      ctx.strokeStyle = edge;
      ctx.beginPath();
      ctx.arc(me.x + ux * k, me.y + uy * k, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ HUD

  drawHud(ctx, view, fx, ui) {
    const s = this.hud;
    const t = view.t;
    this.drawAbilityBar(ctx, view, s, t);
    if (view.kind === 'survival') this.drawSurvivalTop(ctx, view, s, t, ui);
    else if (view.kind === 'story') drawStoryTop(ctx, this, view, s, t);
    else this.drawVersusTop(ctx, view, s, t);
    this.drawCenter(ctx, view, fx, s, t);
    if (view.kind === 'story') drawStoryOverlay(ctx, this, view, s, t);
    if (fx) this.drawFeed(ctx, fx, s);
    if (settings.showPerf && ui.perf) {
      ctx.save();
      ctx.font = `500 ${12 * s}px ${FONT_B}`;
      ctx.fillStyle = C.mist;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      const parts = [];
      if (ui.perf.ping != null) parts.push(`${Math.round(ui.perf.ping)} ms`);
      parts.push(`${Math.round(ui.perf.fps)} fps`);
      ctx.fillText(parts.join('   '), this.w - 14, 12);
      ctx.restore();
    }
  }

  drawAbilityBar(ctx, view, s, t) {
    const me = view.me;
    if (!me) return;
    const size = 54 * s, gap = 8 * s, split = 22 * s;
    const total = size * 6 + gap * 4 + split;
    const x0 = (this.w - total) / 2;
    const y0 = this.h - size - 22 * s;
    const allowed = view.rules ? view.rules.allowed : [];

    // Barre de vie
    const hpY = y0 - 26 * s, hpH = 16 * s;
    const hp = clamp(me.hp, 0, MAX_HP);
    ctx.save();
    ctx.fillStyle = 'rgba(8,12,18,0.85)';
    ctx.fillRect(x0 - 3, hpY - 3, total + 6, hpH + 6);
    ctx.fillStyle = '#1d2a22';
    ctx.fillRect(x0, hpY, total, hpH);
    const sh = shieldOf(me, t), tot = Math.max(MAX_HP, hp + sh);
    ctx.fillStyle = C.self;
    ctx.fillRect(x0, hpY, (total * hp) / tot, hpH);
    ctx.fillStyle = C.shield;
    ctx.fillRect(x0 + (total * hp) / tot, hpY, (total * sh) / tot, hpH);
    ctx.fillStyle = 'rgba(8,12,18,0.55)';
    for (const i of [1, 3]) ctx.fillRect(x0 + (total * i * MAX_HP) / (4 * tot) - 1, hpY, 2, hpH);
    const hpText = `${Math.ceil(hp)}${sh > 0 ? ` (+${Math.ceil(sh)})` : ''} / ${MAX_HP}`;
    ctx.font = `700 ${12 * s}px ${FONT_B}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(8,12,18,0.85)';
    ctx.strokeText(hpText, x0 + total / 2, hpY + hpH / 2 + 1);
    ctx.fillStyle = C.chalk;
    ctx.fillText(hpText, x0 + total / 2, hpY + hpH / 2 + 1);

    // États (étourdi, enraciné...)
    const chips = [];
    if (t < me.stasisUntil) chips.push(['Stase', me.stasisUntil - t, '#facc15']);
    if (t < me.markUntil) chips.push(['Marqué', me.markUntil - t, '#fb923c']);
    if (t < me.stunUntil) chips.push(['Étourdi', me.stunUntil - t, '#fde68a']);
    if (t < me.rootUntil) chips.push(['Enraciné', me.rootUntil - t, '#c084fc']);
    if (t < me.slowUntil) chips.push([`Ralenti ${Math.round(me.slowAmt * 100)} %`, me.slowUntil - t, '#93c5fd']);
    if (t < me.ghostUntil) chips.push([`Vitesse +${Math.round((me.boostMul - 1) * 100)} %`, me.ghostUntil - t, '#5eead4']);
    if (me.shield > 0 && t < me.shieldUntil) chips.push([`Bouclier ${Math.ceil(me.shield)}`, me.shieldUntil - t, '#f1f5f9']);
    if (t < me.spellShieldUntil) chips.push(['Anti-sort', me.spellShieldUntil - t, '#fde68a']);
    if (chips.length) {
      ctx.font = `600 ${13 * s}px ${FONT_B}`;
      const widths = chips.map((c) => ctx.measureText(`${c[0]} ${c[1].toFixed(1)}`).width + 18 * s);
      let cx = this.w / 2 - (widths.reduce((a, b) => a + b, 0) + (chips.length - 1) * 6) / 2;
      const cy = hpY - 26 * s;
      chips.forEach((c, i) => {
        ctx.fillStyle = 'rgba(8,12,18,0.8)';
        ctx.fillRect(cx, cy, widths[i], 20 * s);
        ctx.fillStyle = c[2];
        ctx.fillRect(cx, cy, 3 * s, 20 * s);
        ctx.textAlign = 'left';
        ctx.fillText(`${c[0]} ${c[1].toFixed(1)}`, cx + 10 * s, cy + 10.5 * s);
        cx += widths[i] + 6;
      });
    }

    // Compétences
    let x = x0;
    HUD_SLOTS.forEach((slot, i) => {
      if (i === 4) x += split - gap;
      const ab = abilityOf(me, slot);
      if (!ab) this.drawEmptySlot(ctx, x, y0, size, slot, s);
      else {
        const ok = allowed.includes(slot);
        const remain = Math.max(0, (me.cds[slot] || 0) - t);
        const blocked = t < me.stunUntil || t < me.stasisUntil || ((ab.kind === 'dash' || ab.kind === 'blink') && t < me.rootUntil) || !me.alive;
        // Mode histoire : bordure à la couleur de la rareté du sort.
        const edge = me.rar ? (RARITIES[me.rar[slot]] || RARITIES[0]).color : null;
        this.drawSlot(ctx, x, y0, size, slot, ab, ok, remain, blocked, s, edge);
      }
      x += size + gap;
    });
    ctx.restore();
  }

  drawSlot(ctx, x, y, size, slot, ab, ok, remain, blocked, s, edge) {
    ctx.save();
    ctx.globalAlpha = ok ? 1 : 0.32;
    const tint = SLOT_TINT[slot];
    const bg = ctx.createLinearGradient(x, y, x, y + size);
    bg.addColorStop(0, mix(tint, '#121a24', 0.62));
    bg.addColorStop(1, mix(tint, '#0b1018', 0.85));
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, size, size);
    drawAbilityIcon(ctx, ab.id, x + size / 2, y + size / 2, size * 0.36);
    if (remain > 0 && ok) {
      const f = clamp(remain / ab.cd, 0, 1);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, size, size);
      ctx.clip();
      ctx.fillStyle = 'rgba(5,8,12,0.72)';
      ctx.beginPath();
      ctx.moveTo(x + size / 2, y + size / 2);
      ctx.arc(x + size / 2, y + size / 2, size, -Math.PI / 2 + Math.PI * 2 * (1 - f), Math.PI * 1.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.font = `900 ${24 * s}px ${FONT_D}`;
      ctx.fillStyle = C.chalk;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(remain >= 1 ? String(Math.ceil(remain)) : remain.toFixed(1), x + size / 2, y + size / 2 + 1);
    }
    if (blocked && ok) {
      ctx.fillStyle = 'rgba(5,8,12,0.55)';
      ctx.fillRect(x, y, size, size);
    }
    if (edge) ctx.strokeStyle = rgba(edge, remain > 0 || !ok ? 0.5 : 1);
    else ctx.strokeStyle = remain > 0 || !ok ? 'rgba(147,161,176,0.35)' : rgba(mix(tint, '#ffffff', 0.4), 0.85);
    ctx.lineWidth = edge ? 3 : 2;
    ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
    if (!ok) {
      ctx.strokeStyle = 'rgba(233,238,243,0.5)';
      ctx.beginPath();
      ctx.moveTo(x + 8, y + size - 8);
      ctx.lineTo(x + size - 8, y + 8);
      ctx.stroke();
    }
    this.drawKeyLabel(ctx, x, y, size, slot, s);
    ctx.restore();
  }

  // Touche vide du mode histoire : case sombre marquée d'un tiret.
  drawEmptySlot(ctx, x, y, size, slot, s) {
    ctx.save();
    ctx.fillStyle = 'rgba(11,16,24,0.7)';
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = 'rgba(147,161,176,0.25)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(147,161,176,0.5)';
    ctx.beginPath();
    ctx.moveTo(x + size * 0.38, y + size / 2);
    ctx.lineTo(x + size * 0.62, y + size / 2);
    ctx.stroke();
    this.drawKeyLabel(ctx, x, y, size, slot, s);
    ctx.restore();
  }

  drawKeyLabel(ctx, x, y, size, slot, s) {
    const label = keyLabel(settings.binds[slot]);
    ctx.font = `700 ${12 * s}px ${FONT_B}`;
    const lw = Math.max(16 * s, ctx.measureText(label).width + 8 * s);
    ctx.fillStyle = 'rgba(8,12,18,0.92)';
    ctx.fillRect(x - 3 * s, y + size - 13 * s, lw, 17 * s);
    ctx.fillStyle = C.chalk;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x - 3 * s + lw / 2, y + size - 4.5 * s);
  }

  drawSurvivalTop(ctx, view, s, t, ui) {
    const rules = view.rules;
    const elapsed = view.phase.name === 'over' ? ui.survived || 0 : Math.max(0, t - rules.playAt);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `900 ${46 * s}px ${FONT_D}`;
    ctx.fillStyle = C.chalk;
    ctx.fillText(formatTime(elapsed), this.w / 2, 8 * s);
    ctx.font = `500 ${14 * s}px ${FONT_B}`;
    ctx.fillStyle = C.mist;
    ctx.textAlign = 'right';
    ctx.fillText(ui.best ? `Record ${formatTime(ui.best)}` : 'Pas encore de record', this.w / 2 - 92 * s, 26 * s);
    ctx.textAlign = 'left';
    const d = ui.dodges || 0;
    ctx.fillText(`${d} esquive${d > 1 ? 's' : ''}`, this.w / 2 + 92 * s, 26 * s);
    ctx.restore();
  }

  drawVersusTop(ctx, view, s, t) {
    const rules = view.rules, phase = view.phase;
    const rtw = view.roundsToWin || 2;
    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${16 * s}px ${FONT_B}`;
    const entries = view.players.map((p) => {
      const w = ctx.measureText(p.name).width + 36 * s + rtw * 14 * s;
      return { p, w };
    });
    const gap = 30 * s;
    const total = entries.reduce((a, e) => a + e.w, 0) + gap * (entries.length - 1);
    let x = (this.w - total) / 2;
    const y = 40 * s;
    ctx.textAlign = 'center';
    ctx.font = `500 ${13 * s}px ${FONT_B}`;
    ctx.fillStyle = C.mist;
    ctx.fillText(`Manche ${phase.round || 1}`, this.w / 2, 14 * s);
    for (const { p, w } of entries) {
      const score = (phase.scores && phase.scores[p.id]) || 0;
      ctx.globalAlpha = p.alive || phase.name !== 'playing' ? 1 : 0.45;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(x + 6 * s, y, 6 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `600 ${16 * s}px ${FONT_B}`;
      ctx.fillStyle = p.isYou ? C.chalk : mix(p.color, '#ffffff', 0.5);
      ctx.textAlign = 'left';
      ctx.fillText(p.name, x + 18 * s, y + 1);
      const nameW = ctx.measureText(p.name).width;
      for (let i = 0; i < rtw; i++) {
        const px = x + 36 * s + nameW + i * 14 * s;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, y, 4.5 * s, 0, Math.PI * 2);
        if (i < score) {
          ctx.fillStyle = p.color;
          ctx.fill();
        }
        ctx.stroke();
      }
      x += w + gap;
    }
    ctx.globalAlpha = 1;
    // Chrono de manche et mort subite
    if (phase.name === 'playing' || phase.name === 'roundEnd') {
      const el = Math.max(0, t - rules.playAt);
      ctx.textAlign = 'right';
      ctx.font = `900 ${28 * s}px ${FONT_D}`;
      ctx.fillStyle = C.chalk;
      const right = this.w - 18;
      ctx.fillText(formatTime(el).slice(0, 5), right, 50 * s);
      ctx.font = `600 ${13 * s}px ${FONT_B}`;
      if (el > SUDDEN_DEATH_AT) {
        ctx.fillStyle = '#fb7185';
        ctx.fillText('Mort subite : l\'arène rétrécit', right, 74 * s);
      } else if (el > SUDDEN_DEATH_AT - 10) {
        ctx.fillStyle = '#fb7185';
        ctx.fillText(`Mort subite dans ${Math.ceil(SUDDEN_DEATH_AT - el)} s`, right, 74 * s);
      }
    }
    ctx.restore();
  }

  drawCenter(ctx, view, fx, s, t) {
    const phase = view.phase;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = this.w / 2, cy = this.oy + (this.ah * this.scale) * 0.42;
    if (phase.name === 'countdown' && view.rules && view.kind !== 'story') {
      const rem = view.rules.playAt - t;
      if (rem > 0) {
        const n = Math.ceil(rem);
        const frac = rem - Math.floor(rem);
        const pop = 1 + 0.25 * Math.max(0, frac - 0.75) * 4;
        ctx.font = `900 ${150 * s * pop}px ${FONT_D}`;
        ctx.lineWidth = 8;
        ctx.strokeStyle = 'rgba(8,12,18,0.7)';
        ctx.strokeText(String(n), cx, cy);
        ctx.fillStyle = C.chalk;
        ctx.fillText(String(n), cx, cy);
        if (view.kind === 'versus') {
          ctx.font = `600 ${20 * s}px ${FONT_B}`;
          ctx.fillStyle = C.mist;
          ctx.fillText(`Manche ${phase.round}`, cx, cy + 100 * s);
        }
      }
    }
    if (fx && fx.banner) {
      const b = fx.banner;
      const k = b.t / b.life;
      const a = k < 0.12 ? k / 0.12 : k > 0.8 ? (1 - k) / 0.2 : 1;
      const scale = 1 + 0.15 * Math.max(0, 0.12 - k) * 8;
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.font = `900 ${96 * s * scale}px ${FONT_D}`;
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(8,12,18,0.7)';
      ctx.strokeText(b.text, cx, cy);
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, cx, cy);
      if (b.sub) {
        ctx.font = `600 ${20 * s}px ${FONT_B}`;
        ctx.fillStyle = C.chalk;
        ctx.fillText(b.sub, cx, cy + 74 * s);
      }
    }
    ctx.restore();
  }

  drawFeed(ctx, fx, s) {
    if (!fx.feed.length) return;
    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${14 * s}px ${FONT_B}`;
    let y = 104 * s;
    for (const f of fx.feed) {
      const a = f.t > 5 ? 6 - f.t : 1;
      ctx.globalAlpha = clamp(a, 0, 1);
      const widths = f.parts.map((p) => ctx.measureText(p.text).width);
      const total = widths.reduce((x, w) => x + w, 0) + 16 * s;
      let x = this.w - 14 - total;
      ctx.fillStyle = 'rgba(8,12,18,0.72)';
      ctx.fillRect(x, y - 12 * s, total, 24 * s);
      x += 8 * s;
      f.parts.forEach((p, i) => {
        ctx.fillStyle = p.color;
        ctx.textAlign = 'left';
        ctx.fillText(p.text, x, y + 1);
        x += widths[i];
      });
      y += 30 * s;
    }
    ctx.restore();
  }
}

// Icône vectorielle d'un sort (aussi utilisée dans l'écran de build).
export function drawAbilityIcon(ctx, id, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = C.chalk;
  ctx.fillStyle = C.chalk;
  ctx.lineWidth = Math.max(2, r * 0.16);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const line = (x0, y0, x1, y1) => {
    ctx.beginPath();
    ctx.moveTo(x0 * r, y0 * r);
    ctx.lineTo(x1 * r, y1 * r);
    ctx.stroke();
  };
  const circle = (x, y, rr, fill) => {
    ctx.beginPath();
    ctx.arc(x * r, y * r, rr * r, 0, Math.PI * 2);
    if (fill) ctx.fill();
    else ctx.stroke();
  };
  const tri = (x0, y0, x1, y1, x2, y2) => {
    ctx.beginPath();
    ctx.moveTo(x0 * r, y0 * r);
    ctx.lineTo(x1 * r, y1 * r);
    ctx.lineTo(x2 * r, y2 * r);
    ctx.closePath();
    ctx.fill();
  };
  const star = (n, inner) => {
    ctx.beginPath();
    for (let j = 0; j < n * 2; j++) {
      const rr = j % 2 ? r * inner : r;
      const a = (j * Math.PI) / n - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  };
  const shield = () => {
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.85, -r * 0.6);
    ctx.quadraticCurveTo(r * 0.8, r * 0.5, 0, r);
    ctx.quadraticCurveTo(-r * 0.8, r * 0.5, -r * 0.85, -r * 0.6);
    ctx.closePath();
    ctx.stroke();
  };
  switch (id) {
    case 'trait':
      line(-1, 0.8, 0.75, -0.75);
      tri(1, -1, 0.15, -0.82, 0.82, -0.15);
      ctx.globalAlpha = 0.55;
      line(-1, 0.15, -0.45, -0.4);
      line(-0.2, 1, 0.35, 0.45);
      break;
    case 'lien':
      circle(0.35, -0.35, 0.45, true);
      for (const k of [0, 0.35, 0.7]) circle(-0.55 + k * 0.5, 0.55 - k * 0.5, 0.14, false);
      break;
    case 'grappin':
      line(-0.9, 0.9, 0.3, -0.3);
      ctx.beginPath();
      ctx.arc(0.45 * r, -0.2 * r, 0.45 * r, -Math.PI * 0.9, Math.PI * 0.3);
      ctx.stroke();
      break;
    case 'orbe':
      circle(0, 0, 0.3, true);
      ctx.beginPath();
      ctx.arc(0, 0, 0.8 * r, -Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 0.8 * r, Math.PI * 0.8, Math.PI * 1.8);
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      break;
    case 'eruption':
      circle(0, 0, 0.95, false);
      circle(0, 0, 0.35, true);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        line(Math.cos(a) * 0.55, Math.sin(a) * 0.55, Math.cos(a) * 0.75, Math.sin(a) * 0.75);
      }
      break;
    case 'salve':
      for (let i = 0; i < 4; i++) circle(-0.75 + i * 0.5, 0.75 - i * 0.5, 0.18 + i * 0.04, true);
      break;
    case 'cage':
      circle(0, 0, 0.8, false);
      ctx.setLineDash([r * 0.25, r * 0.18]);
      circle(0, 0, 0.5, false);
      break;
    case 'bouclier':
    case 'barriere':
      shield();
      if (id === 'barriere') line(-0.4, 0, 0.4, 0);
      break;
    case 'bond':
      for (const off of [-0.45, 0.25]) {
        ctx.beginPath();
        ctx.moveTo((off - 0.35) * r, -0.7 * r);
        ctx.lineTo((off + 0.35) * r, 0);
        ctx.lineTo((off - 0.35) * r, 0.7 * r);
        ctx.stroke();
      }
      break;
    case 'elan':
    case 'fantome':
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-r, i * r * 0.55);
        ctx.quadraticCurveTo(r * 0.2, i * r * 0.55 - r * 0.25, r * 0.9, i * r * 0.55);
        ctx.stroke();
      }
      if (id === 'elan') tri(1, 0, 0.55, -0.3, 0.55, 0.3);
      break;
    case 'voile':
      circle(0, 0, 0.9, false);
      ctx.globalAlpha = 0.4;
      circle(0, 0, 0.6, true);
      break;
    case 'glace':
      line(-1, 0, 0.4, 0);
      tri(1, 0, 0.2, -0.55, 0.2, 0.55);
      line(-0.7, 0, -0.95, -0.35);
      line(-0.7, 0, -0.95, 0.35);
      break;
    case 'rayon':
      ctx.lineWidth = r * 0.45;
      line(-1, 0.5, 1, -0.5);
      ctx.strokeStyle = '#0b1018';
      ctx.lineWidth = r * 0.12;
      line(-1, 0.5, 1, -0.5);
      break;
    case 'meteore':
      circle(0.3, 0.3, 0.45, true);
      ctx.globalAlpha = 0.6;
      line(-0.9, -0.9, 0.05, 0.05);
      line(-0.4, -1, 0.3, -0.3);
      line(-1, -0.4, -0.3, 0.3);
      break;
    case 'javelot':
      line(-1, 1, 0.6, -0.6);
      tri(1, -1, 0.25, -0.85, 0.85, -0.25);
      break;
    case 'flux':
      circle(0.25, -0.25, 0.3, true);
      circle(0.25, -0.25, 0.65, false);
      line(-1, 1, -0.3, 0.3);
      break;
    case 'stase':
      ctx.beginPath();
      ctx.moveTo(-0.6 * r, -0.85 * r);
      ctx.lineTo(0.6 * r, -0.85 * r);
      ctx.lineTo(-0.6 * r, 0.85 * r);
      ctx.lineTo(0.6 * r, 0.85 * r);
      ctx.closePath();
      ctx.stroke();
      break;
    case 'barrage':
      for (const k of [-0.6, 0, 0.6]) {
        ctx.beginPath();
        ctx.arc((k - 1.1) * r, 0, 1.2 * r, -0.75, 0.75);
        ctx.stroke();
      }
      break;
    case 'flash':
      star(4, 0.28);
      break;
    case 'soin':
      ctx.lineWidth = r * 0.35;
      line(0, -0.8, 0, 0.8);
      line(-0.8, 0, 0.8, 0);
      break;
    case 'purge':
      star(6, 0.45);
      break;
    default:
      circle(0, 0, 0.6, false);
  }
  ctx.restore();
}
