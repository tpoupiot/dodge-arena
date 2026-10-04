// Interface du mode histoire : record, cartes du coffre, résultats de la run.

import { ABILITIES, RARITIES, scaled, describe } from '../../shared/abilities.js';
import { settings, saveSettings, keyLabel, formatTime } from './settings.js';

const $ = (sel) => document.querySelector(sel);

// ------------------------------------------------------------ record

// ev : fin de run { win, cleared, time }.
export function saveStoryRecord(ev) {
  const s = settings.story;
  s.bestRooms = Math.max(s.bestRooms, ev.cleared);
  if (ev.win) {
    s.wins++;
    s.bestTime = s.bestTime ? Math.min(s.bestTime, ev.time) : ev.time;
  }
  saveSettings();
}

export function storyBestLine() {
  const s = settings.story;
  if (!s.bestRooms) return 'Aucune descente pour l\'instant.';
  let line = `Meilleure descente : ${s.bestRooms} salle${s.bestRooms > 1 ? 's' : ''} sur 15`;
  if (s.wins) line += ` · ${s.wins} victoire${s.wins > 1 ? 's' : ''}, meilleur temps ${formatTime(s.bestTime)}`;
  return line + '.';
}

// ------------------------------------------------------------ coffre

// Ce que la carte change sur sa touche. hero : objet avec build et rar.
export function lootReplaceText(hero, card) {
  const cur = hero.build[card.slot];
  if (!cur) return 'Touche vide';
  const now = (RARITIES[hero.rar[card.slot]] || RARITIES[0]).name;
  if (cur === card.ab) return `Amélioration : ${now} → ${RARITIES[card.rar].name}`;
  return `Remplace ${ABILITIES[cur].name} (${now})`;
}

// Remplit la fenêtre du coffre. onPick(i) : carte choisie. iconCanvas : dessin d'icône fourni par main.js.
export function renderOffer(offer, hero, iconCanvas, onPick) {
  const box = $('#loot-cards');
  box.textContent = '';
  offer.cards.forEach((card, i) => {
    const ab = scaled(card.ab, card.rar), rar = RARITIES[card.rar];
    const b = document.createElement('button');
    b.className = 'loot-card';
    b.style.setProperty('--rar', rar.color);
    const add = (tag, cls, text) => {
      const el = document.createElement(tag);
      el.className = cls;
      el.textContent = text;
      b.append(el);
    };
    add('span', 'loot-key', String(i + 1));
    b.append(iconCanvas(card.ab, card.slot, 72));
    add('span', 'loot-rar', rar.name);
    add('strong', 'loot-name', ab.name);
    add('span', 'loot-slot', `Touche ${keyLabel(settings.binds[card.slot])}`);
    add('p', 'loot-desc', `${describe(ab)} Recharge ${String(ab.cd).replace('.', ',')} s.`);
    add('p', 'loot-repl', lootReplaceText(hero, card));
    b.addEventListener('click', () => onPick(i));
    box.append(b);
  });
  $('#loot-hint').textContent = offer.cards.length
    ? 'Choisis un sort avec la souris ou les touches 1, 2, 3. Passer rend des PV.'
    : 'Ce coffre n\'a rien de mieux que tes sorts.';
  $('#loot-skip').textContent = `Passer (+${offer.heal} PV)`;
}
