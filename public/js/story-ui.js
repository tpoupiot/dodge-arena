// Interface du mode histoire : record, cartes du coffre, résultats de la run.

import { settings, saveSettings, formatTime } from './settings.js';

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
