// État de la salle en cours, reconstruit à partir des événements de la partie.
// La partie locale et la partie en ligne l'alimentent de la même façon : elles affichent donc la même chose.

export class StoryState {
  // you : id du joueur local (pour ne garder que son tirage de coffre)
  constructor(you) {
    this.you = you;
    this.room = null;
    this.cleared = false;
    this.chest = null;
    this.warns = [];
    this.exit = { n: 0, of: 0, until: 0 };
    this.boss = null;
    this.offer = null;
    this.say = null;
    this.result = null;
    this.runStart = null;
  }

  apply(ev) {
    switch (ev.e) {
      case 'room':
        this.room = {
          i: ev.i, ch: ev.ch, n: ev.n, of: ev.of, type: ev.type, decor: ev.decor,
          entry: ev.entry, exit: ev.exit, door: ev.door, trap: ev.trap, boss: ev.boss,
        };
        this.cleared = false;
        this.chest = null;
        this.warns = [];
        this.exit = { n: 0, of: 0, until: 0 };
        this.boss = null;
        this.offer = null;
        if (ev.i === 0) this.runStart = ev.rules.playAt;
        break;
      case 'warn':
        this.warns.push({ x: ev.x, y: ev.y, r: ev.r, at: ev.at, t: ev.t });
        break;
      case 'boss':
        this.boss = { id: ev.id, key: ev.key, phase: ev.phase };
        break;
      case 'die':
        if (this.boss && ev.id === this.boss.id) this.boss = null;
        break;
      case 'clear':
        this.cleared = true;
        this.warns = [];   // les apparitions annoncées par un boss n'arrivent plus
        this.chest = { ...ev.chest, opened: false };
        break;
      case 'offer':
        if (ev.id === this.you) this.offer = { cards: ev.cards, heal: ev.heal };
        break;
      case 'looted':
        if (ev.id === this.you) {
          this.offer = null;
          if (this.chest) this.chest.opened = true;
        }
        break;
      case 'exit':
        this.exit = { n: ev.n, of: ev.of, until: ev.until };
        break;
      case 'say':
        this.say = { k: ev.k, t: ev.t };
        break;
      case 'storyEnd':
        this.result = ev;
        break;
    }
  }

  // Oublie les cercles d'apparition dépassés.
  prune(t) {
    if (this.warns.length) this.warns = this.warns.filter((w) => t < w.at + 0.3);
  }
}
