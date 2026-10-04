// Interface du mode histoire : record, cartes du coffre, résultats de la run.

import { ABILITIES, RARITIES, BUILD_SLOTS, scaled, describe } from '../../shared/abilities.js';
import { SCRIPT } from '../../shared/story/script.js';
import { CHAPTERS } from '../../shared/story/rooms.js';
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

// ------------------------------------------------------------ fin de run

export function storyResultLine(ev) {
  const s = ev.cleared > 1 ? 's' : '';
  return `Chapitre ${ev.ch + 1} : ${CHAPTERS[ev.ch].name}, salle ${ev.n} sur 5. ${ev.cleared} salle${s} vidée${s} en ${formatTime(ev.time)}.`;
}

// Remplit l'écran de résultats. players : [{ id, name, color }], you : id du joueur local.
export function fillStoryResults(ev, players, you, iconCanvas) {
  $('#res-title').textContent = ev.win ? 'Victoire' : 'Défaite';
  $('#res-sub').textContent = storyResultLine(ev);
  $('#res-story').textContent = SCRIPT[ev.win ? 'win' : 'lose'].text;
  const kit = $('#res-kit');
  kit.textContent = '';
  const mine = ev.kits[you];
  for (const slot of BUILD_SLOTS) {
    const id = mine && mine.build[slot];
    if (!id || !ABILITIES[id]) continue;
    const rar = RARITIES[mine.rar[slot]] || RARITIES[0];
    const c = iconCanvas(id, slot, 56);
    c.style.borderColor = rar.color;
    c.title = `${ABILITIES[id].name} (${rar.name})`;
    kit.append(c);
  }
  const table = $('#res-table');
  table.textContent = '';
  const head = document.createElement('tr');
  for (const [txt, num] of [['Joueur', false], ['Dégâts', true], ['Éliminations', true], ['Morts', true]]) {
    const th = document.createElement('th');
    th.textContent = txt;
    if (num) th.className = 'num';
    head.append(th);
  }
  table.append(head);
  for (const p of players) {
    const st = ev.stats[p.id] || { dmg: 0, kills: 0, deaths: 0 };
    const tr = document.createElement('tr');
    const name = document.createElement('td');
    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = p.color;
    name.append(sw, p.name + (p.id === you ? ' (toi)' : ''));
    tr.append(name);
    for (const v of [Math.round(st.dmg), st.kills, st.deaths]) {
      const td = document.createElement('td');
      td.className = 'num';
      td.textContent = String(v);
      tr.append(td);
    }
    table.append(tr);
  }
}
