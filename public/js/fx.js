// Effets visuels côté client : particules, marqueurs de clic, nombres de dégâts, secousses, fil des éliminations.

const MAX_PARTS = 700;

export class Fx {
  constructor() {
    this.clear();
  }

  clear() {
    this.parts = [];
    this.rings = [];
    this.markers = [];
    this.numbers = [];
    this.feed = [];
    this.banner = null;
    this.shakeAmt = 0;
    this.trails = [];
  }

  update(dt) {
    for (const p of this.parts) {
      p.life -= dt;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy *= k;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter((r) => r.t < r.life);
    for (const m of this.markers) m.t += dt;
    this.markers = this.markers.filter((m) => m.t < m.life);
    for (const n of this.numbers) n.t += dt;
    this.numbers = this.numbers.filter((n) => n.t < n.life);
    for (const tr of this.trails) tr.t += dt;
    this.trails = this.trails.filter((tr) => tr.t < tr.life);
    for (const f of this.feed) f.t += dt;
    this.feed = this.feed.filter((f) => f.t < 6);
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > this.banner.life) this.banner = null;
    }
    this.shakeAmt *= Math.exp(-dt * 9);
    if (this.shakeAmt < 0.1) this.shakeAmt = 0;
  }

  // Marqueur de déplacement façon MOBA (clic droit).
  click(x, y) {
    this.markers.push({ x, y, t: 0, life: 0.42 });
  }

  burst(x, y, color, n = 14, speed = 260, life = 0.45, size = 4) {
    for (let i = 0; i < n && this.parts.length < MAX_PARTS; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      this.parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: life * (0.6 + Math.random() * 0.4), max: life, size: size * (0.6 + Math.random() * 0.6), color, drag: 3.5,
      });
    }
  }

  spark(x, y, vx, vy, color, life = 0.3, size = 3) {
    if (this.parts.length >= MAX_PARTS) return;
    this.parts.push({ x, y, vx, vy, life, max: life, size, color, drag: 2 });
  }

  ring(x, y, color, r0, r1, life = 0.35, width = 4) {
    this.rings.push({ x, y, color, r0, r1, life, width, t: 0 });
  }

  trail(x, y, color, r, life = 0.25) {
    this.trails.push({ x, y, color, r, life, t: 0 });
  }

  number(x, y, text, color, big = false) {
    this.numbers.push({ x: x + (Math.random() - 0.5) * 20, y, text, color, big, t: 0, life: 0.9 });
  }

  shake(a) {
    this.shakeAmt = Math.min(16, this.shakeAmt + a);
  }

  shakeOffset() {
    if (!this.shakeAmt) return { x: 0, y: 0 };
    return { x: (Math.random() - 0.5) * this.shakeAmt, y: (Math.random() - 0.5) * this.shakeAmt };
  }

  // parts : [{ text, color }]
  pushFeed(parts) {
    this.feed.push({ parts, t: 0 });
    if (this.feed.length > 5) this.feed.shift();
  }

  setBanner(text, sub = '', color = '#e9eef3', life = 1.6) {
    this.banner = { text, sub, color, life, t: 0 };
  }

  // Dessin en coordonnées monde (le contexte est déjà mis à l'échelle de l'arène).
  drawWorld(ctx) {
    ctx.save();
    for (const tr of this.trails) {
      const a = 1 - tr.t / tr.life;
      ctx.globalAlpha = a * 0.35;
      ctx.fillStyle = tr.color;
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, tr.r * (0.7 + 0.3 * a), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + 0.5 * a), 0, Math.PI * 2);
      ctx.fill();
    }
    for (const r of this.rings) {
      const k = r.t / r.life;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - k * 0.6);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * (1 - (1 - k) * (1 - k)), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    // Marqueurs de clic : un anneau qui se resserre et quatre chevrons.
    for (const m of this.markers) {
      const k = m.t / m.life;
      const a = 1 - k;
      const r = 26 * (1 - k * 0.6);
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#6ee7a0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(m.x, m.y, r, r * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#6ee7a0';
      for (let i = 0; i < 4; i++) {
        const ang = (i * Math.PI) / 2 + Math.PI / 4;
        const d = 12 + 22 * (1 - k);
        const cx = m.x + Math.cos(ang) * d, cy = m.y + Math.sin(ang) * d * 0.62;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ang + Math.PI);
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-4, -6);
        ctx.lineTo(-4, 6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const n of this.numbers) {
      const k = n.t / n.life;
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      const size = n.big ? 34 : 26;
      ctx.font = `900 ${size}px "Big Shoulders Display", "Barlow", sans-serif`;
      const y = n.y - 30 - 46 * Math.sqrt(k);
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(8,12,18,0.85)';
      ctx.strokeText(n.text, n.x, y);
      ctx.fillStyle = n.color;
      ctx.fillText(n.text, n.x, y);
    }
    ctx.restore();
  }
}
