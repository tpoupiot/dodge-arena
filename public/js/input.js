// Contrôles façon MOBA :
// - clic droit (maintenu ou non) pour se déplacer, avec marqueur de clic ;
// - S pour s'arrêter ;
// - Q W E R / D F pour lancer, en "rapide", "rapide avec indicateur" ou "normal" (clic gauche).

import { settings, learnKey } from './settings.js';

function isTyping(e) {
  const el = e.target;
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

export class Input {
  // handlers : { command(cmd), click(x, y), escape(), enter(), typingAllowed() }
  constructor(canvas, renderer, handlers) {
    this.canvas = canvas;
    this.r = renderer;
    this.h = handlers;
    this.mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.rmb = false;
    this.lastMoveAt = 0;
    this.lastMovePos = null;
    this.aim = null;
    this.enabled = false;

    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) this.rmb = false;
    });
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('blur', () => {
      this.rmb = false;
      this.aim = null;
    });
  }

  enable(v) {
    this.enabled = v;
    if (!v) {
      this.rmb = false;
      this.aim = null;
    }
  }

  world() {
    return this.r.toWorld(this.mouse.x, this.mouse.y);
  }

  actionFor(code) {
    for (const id in settings.binds) if (settings.binds[id] === code) return id;
    return null;
  }

  onMouseDown(e) {
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
    if (!this.enabled) return;
    if (e.button === 2) {
      e.preventDefault();
      if (this.aim && settings.castMode === 'normal') this.aim = null; // clic droit = annuler
      this.rmb = true;
      this.move(true);
    } else if (e.button === 0) {
      e.preventDefault();
      if (this.aim && settings.castMode === 'normal') {
        this.cast(this.aim.slot);
        this.aim = null;
      }
    }
  }

  move(isClick) {
    const w = this.world();
    const target = this.h.pick ? this.h.pick(w.x, w.y) : null;
    if (target) {
      // Clic droit sur un ennemi : on le poursuit et on l'attaque, comme dans LoL.
      if (isClick || target !== this.lastTarget) this.h.command({ k: 'attack', id: target });
      if (isClick) this.h.click(w.x, w.y, true);
      this.lastTarget = target;
    } else {
      this.h.command({ k: 'move', x: w.x, y: w.y });
      if (isClick) this.h.click(w.x, w.y, false);
      this.lastTarget = null;
    }
    this.lastMoveAt = performance.now();
    this.lastMovePos = w;
  }

  // Clic droit maintenu : nouvelle commande dès que le curseur bouge (comme dans LoL).
  update() {
    if (!this.enabled || !this.rmb) return;
    const now = performance.now();
    const w = this.world();
    const moved = !this.lastMovePos || Math.hypot(w.x - this.lastMovePos.x, w.y - this.lastMovePos.y) > 6;
    if ((moved && now - this.lastMoveAt > 45) || now - this.lastMoveAt > 250) this.move(false);
  }

  cast(slot) {
    const w = this.world();
    this.h.command({ k: 'cast', slot, x: w.x, y: w.y });
  }

  onKeyDown(e) {
    learnKey(e);
    if (isTyping(e)) return;
    if (e.code === 'Escape') {
      if (this.aim) this.aim = null;
      else if (this.h.escape) this.h.escape(e);
      return;
    }
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      if (this.h.enter) this.h.enter(e);
      return;
    }
    if (!this.enabled) return;
    const action = this.actionFor(e.code);
    if (!action) {
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      return;
    }
    e.preventDefault();
    if (e.repeat) return;
    if (action === 'stop') {
      this.h.command({ k: 'stop' });
      return;
    }
    const mode = settings.castMode;
    if (mode === 'quick' || (this.h.instant && this.h.instant(action))) this.cast(action);
    else if (mode === 'indicator') this.aim = { slot: action };
    else this.aim = this.aim && this.aim.slot === action ? null : { slot: action };
  }

  onKeyUp(e) {
    if (!this.enabled || settings.castMode !== 'indicator' || !this.aim) return;
    if (this.actionFor(e.code) === this.aim.slot) {
      this.cast(this.aim.slot);
      this.aim = null;
    }
  }

  aimState() {
    if (!this.aim || !this.enabled) return null;
    const w = this.world();
    return { slot: this.aim.slot, x: w.x, y: w.y };
  }
}
