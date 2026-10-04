// Chef d'orchestre : menus, sessions de jeu (solo, IA, en ligne), boucle d'affichage, effets et sons.

import { Renderer, drawAbilityIcon } from './render.js';
import { Fx } from './fx.js';
import { Sfx } from './audio.js';
import { Input } from './input.js';
import { LocalGame } from './localgame.js';
import { Online } from './net.js';
import {
  settings, saveSettings, resetBinds, ACTIONS, keyLabel, loadKeyboardLayout, formatTime,
} from './settings.js';
import { ABILITIES, ENV_SPELLS, spellName, abilityOf, poolFor, sanitizeBuild, BUILD_SLOTS, AUTO, describe, RARITIES } from '../../shared/abilities.js';
import { storyBestLine, saveStoryRecord, renderOffer, fillStoryResults } from './story-ui.js';
import { HOSTILE } from './render-story.js';
import { ENV_COLOR, MODES, PLAYER_RADIUS } from '../../shared/constants.js';
import { linePos } from '../../shared/sim.js';
import { BOT_LEVELS } from '../../shared/bot.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const canvas = $('#game');
const renderer = new Renderer(canvas);
const fx = new Fx();
const demoFx = new Fx();
const sfx = new Sfx();
sfx.setVolume(settings.volume);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const DIFF_LABEL = { facile: 'facile', normal: 'normale', difficile: 'difficile', hardcore: 'un seul coup' };
const ENV_DESC = {
  trait: 'Projectile rapide et fin, 15 dégâts.',
  lien: 'Orbe lente qui enracine 1,2 s, 10 dégâts.',
  eruption: 'Zone qui explose après un délai et ralentit, 20 dégâts.',
  grappin: 'Crochet qui t\'attire vers son lanceur, 8 dégâts.',
  salve: 'Série d\'explosions en ligne, 12 dégâts chacune.',
  fleche: 'Grosse flèche qui étourdit 1,4 s, 25 dégâts.',
  rayon: 'Rayon qui traverse l\'arène après 1 s d\'avertissement, 30 dégâts.',
  boomerang: 'Lame qui part puis revient, 12 dégâts par passage.',
  cage: 'Anneau : toucher son bord étourdit 1,3 s, 10 dégâts.',
};

let session = null; // LocalGame ou NetGame
let sessionType = null; // 'survival' | 'bots' | 'online'
let screen = 'menu'; // 'menu' | 'queue' | 'lobby' | 'game'
let demo = makeDemo();
let lastRoom = null;
let resultsTimer = null;
let lastCount = 0;
let lastMatchEnd = null;
const hud = { best: 0, dodges: 0, survived: 0 };
const mobLook = new Map(); // apparence des ennemis du mode histoire, gardée pour les effets de leur mort
const isStory = () => !!session && session.kind === 'story';

// ------------------------------------------------------------ réseau

const online = new Online({
  onRoom,
  onQueue,
  onStart,
  onEvents: handleEvents,
  onChat,
  onError: (msg) => {
    toast(msg);
    if (screen === 'menu') setStatus(msg, true);
  },
  onLeft: () => {
    if (sessionType === 'online') endSession();
    if (screen !== 'game') showScreen('menu');
  },
  onClose: () => {
    if (sessionType === 'online' || screen === 'lobby' || screen === 'queue') {
      toast('Connexion au serveur perdue.');
      if (sessionType === 'online') endSession();
      hideOverlay('results');
      hideOverlay('pause');
      showScreen('menu');
    }
  },
});

// ------------------------------------------------------------ entrées

const input = new Input(canvas, renderer, {
  command: (cmd) => {
    if (!anyOverlay()) sendCommand(cmd);
  },
  click: (x, y, attack) => fx.click(x, y, attack),
  // Ennemi sous le curseur (pour l'auto-attaque au clic droit). En mode histoire : un ennemi, jamais un allié.
  pick: (x, y) => {
    if (!session) return null;
    const v = session.view();
    let best = null, bd = 22;
    for (const p of v.mobs || v.players) {
      if (p.isYou || !p.alive) continue;
      const d = Math.hypot(p.x - x, p.y - y) - (p.st ? p.st.r : PLAYER_RADIUS);
      if (d < bd) { bd = d; best = p.id; }
    }
    return best;
  },
  // Sorts sans visée (boucliers, vitesse, soin...) : toujours lancés à l'appui.
  instant: (slot) => {
    const kit = isStory() ? session.view().me : { build: settings.build };
    const ab = kit && abilityOf(kit, slot);
    return !!ab && ab.kind === 'buff';
  },
  escape: onEscape,
  enter: onEnter,
});

window.addEventListener('resize', () => renderer.resize());
window.addEventListener('pointerdown', () => sfx.unlock(), { capture: true });
window.addEventListener('keydown', (e) => {
  sfx.unlock();
  if (!$('#results').classList.contains('hidden') && (e.code === 'Space' || e.code === 'Enter') && !isTypingTarget(e)) {
    e.preventDefault();
    $('#res-again').click();
  }
  // Fenêtre du coffre : les touches 1, 2, 3 choisissent une carte.
  if (!$('#loot').classList.contains('hidden') && /^(Digit|Numpad)[1-3]$/.test(e.code)) {
    const card = $$('.loot-card')[Number(e.code.slice(-1)) - 1];
    if (card) {
      e.preventDefault();
      card.click();
    }
  }
}, { capture: true });

function isTypingTarget(e) {
  const el = e.target;
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
}

// ------------------------------------------------------------ écrans et fenêtres

function showScreen(name) {
  screen = name;
  for (const id of ['menu', 'queue', 'lobby']) $('#' + id).classList.toggle('hidden', id !== name);
  const inGame = name === 'game';
  document.body.classList.toggle('in-game', inGame);
  document.body.classList.toggle('in-menu', !inGame);
  renderer.setMode(inGame ? 'game' : 'demo');
  $('#game-chat').classList.toggle('hidden', !(inGame && sessionType === 'online'));
  closeGameChat();
  refreshInput();
  if (inGame && document.activeElement) document.activeElement.blur();
}

const OVERLAYS = ['results', 'pause', 'settings', 'help', 'build', 'loot'];

function anyOverlay() {
  return OVERLAYS.some((id) => !$('#' + id).classList.contains('hidden'));
}

function showOverlay(id) {
  $('#' + id).classList.remove('hidden');
  refreshInput();
  const first = $('#' + id).querySelector('button.primary');
  if (first) first.focus({ preventScroll: true });
}

function hideOverlay(id) {
  $('#' + id).classList.add('hidden');
  refreshInput();
}

function refreshInput() {
  const typing = !$('#game-chat-form').classList.contains('hidden');
  input.enable(screen === 'game' && !anyOverlay() && !typing && !!session);
}

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3400);
}

function setStatus(msg, isError = false) {
  const el = $('#online-status');
  el.textContent = msg;
  el.classList.toggle('error', isError);
}

function currentName() {
  return $('#name').value.trim().slice(0, 16) || 'Joueur';
}

// ------------------------------------------------------------ menu principal

const hadName = !!settings.name;

function initMenu() {
  const nameInput = $('#name');
  if (!settings.name) {
    settings.name = 'Joueur' + Math.floor(100 + Math.random() * 900);
    saveSettings();
  }
  nameInput.value = settings.name;
  nameInput.addEventListener('input', () => {
    settings.name = nameInput.value.trim().slice(0, 16);
    saveSettings();
  });

  for (const sec of $$('.mode')) {
    sec.querySelector('.mode-head').addEventListener('click', () => {
      for (const other of $$('.mode')) {
        const open = other === sec;
        other.classList.toggle('open', open);
        other.querySelector('.mode-head').setAttribute('aria-expanded', String(open));
      }
    });
  }

  for (const seg of $$('.seg[data-setting]')) {
    const key = seg.dataset.setting;
    const numeric = seg.dataset.type === 'number';
    for (const b of seg.querySelectorAll('button')) {
      b.setAttribute('role', 'radio');
      b.addEventListener('click', () => {
        settings[key] = numeric ? Number(b.dataset.v) : b.dataset.v;
        saveSettings();
        syncSegs();
        updateBestLine();
      });
    }
  }
  syncSegs();
  updateBestLine();

  $('#play-survival').addEventListener('click', startSurvival);
  $('#play-bots').addEventListener('click', startBots);
  $('#play-story').addEventListener('click', startStory);
  $('#story-best').textContent = storyBestLine();
  $('#quick-1v1').addEventListener('click', () => goOnline(() => online.queue('1v1')));
  $('#quick-1v1v1').addEventListener('click', () => goOnline(() => online.queue('1v1v1')));
  $('#create-1v1').addEventListener('click', () => goOnline(() => online.create('1v1')));
  $('#create-1v1v1').addEventListener('click', () => goOnline(() => online.create('1v1v1')));
  $('#join-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = $('#join-code').value.trim().toUpperCase();
    if (code.length < 4) return setStatus('Le code du salon fait 4 caractères.', true);
    goOnline(() => online.join(code));
  });
  $('#open-settings').addEventListener('click', openSettings);
  $('#open-help').addEventListener('click', openHelp);
  $('#queue-cancel').addEventListener('click', () => {
    online.unqueue();
    showScreen('menu');
  });

  const coarse = window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(pointer: fine)').matches;
  $('#touch-note').hidden = !coarse;
}

function syncSegs() {
  for (const seg of $$('.seg[data-setting]')) {
    const v = String(settings[seg.dataset.setting]);
    for (const b of seg.querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.v === v));
  }
}

function updateBestLine() {
  const best = settings.best[settings.survivalDifficulty] || 0;
  $('#best-line').textContent = best > 0
    ? `Ton record dans cette difficulté : ${formatTime(best)}`
    : 'Aucun record dans cette difficulté pour l\'instant.';
}

async function goOnline(action) {
  sfx.unlock();
  setStatus('Connexion au serveur…');
  try {
    await online.connect(currentName(), settings.build);
    online.send({ type: 'hello', name: currentName(), build: settings.build }); // pseudo et build à jour
    setStatus('');
    action();
  } catch {
    setStatus('Impossible de joindre le serveur de jeu. Lance le projet avec « npm start » puis ouvre l\'adresse affichée.', true);
  }
}

// ------------------------------------------------------------ sessions locales

function makeDemo() {
  const d = new LocalGame({ kind: 'survival', demo: true, settings: { difficulty: 'demo' } });
  // On avance un peu pour que des sorts soient déjà à l'écran.
  for (let i = 0; i < 60 * 7; i++) d.match.step();
  d.absorb(d.match.drainEvents());
  if (reducedMotion) d.paused = true;
  return d;
}

function endSession() {
  clearTimeout(resultsTimer);
  session = null;
  sessionType = null;
  fx.clear();
  mobLook.clear();
  hideOverlay('loot');
}

function startSurvival() {
  sfx.unlock();
  endSession();
  hideOverlay('results');
  const diff = settings.survivalDifficulty;
  session = new LocalGame({ kind: 'survival', name: currentName(), settings: { difficulty: diff }, build: settings.build });
  sessionType = 'survival';
  hud.best = settings.best[diff] || 0;
  hud.dodges = 0;
  hud.survived = 0;
  showScreen('game');
}

function startBots() {
  sfx.unlock();
  endSession();
  hideOverlay('results');
  session = new LocalGame({
    build: settings.build,
    kind: 'versus',
    name: currentName(),
    bots: settings.vsMode === '1v1v1' ? 2 : 1,
    botLevel: settings.vsBot,
    settings: { roundsToWin: settings.vsRounds, env: settings.vsEnv },
  });
  sessionType = 'bots';
  showScreen('game');
}

function startStory() {
  sfx.unlock();
  endSession();
  hideOverlay('results');
  session = new LocalGame({ kind: 'story', name: currentName() });
  sessionType = 'story';
  showScreen('game');
}

// Envoie une commande de jeu à la partie en cours, locale ou en ligne.
function sendCommand(cmd) {
  if (!session) return;
  if (sessionType === 'online') online.input(cmd);
  else session.input(cmd);
}

// ------------------------------------------------------------ coffre (mode histoire)

function openLoot() {
  const v = session.view();
  if (!v.story || !v.story.offer || !v.me) return;
  renderOffer(v.story.offer, v.me, iconCanvas, pickLoot);
  showOverlay('loot');
  sfx.play('chest');
}

// i : indice de la carte, ou -1 pour passer.
function pickLoot(i) {
  hideOverlay('loot');
  sendCommand({ k: 'loot', i });
}

// ------------------------------------------------------------ en ligne : salon et file

function onQueue(m) {
  showScreen('queue');
  $('#queue-title').textContent = m.mode === '1v1' ? 'Recherche d\'un adversaire' : 'Recherche de deux adversaires';
  $('#queue-count').textContent = `${m.count} joueur${m.count > 1 ? 's' : ''} sur ${m.need} dans la file`;
}

function onRoom(room) {
  lastRoom = room;
  renderLobby(room);
  if (room.state === 'lobby') {
    if (screen === 'game' && sessionType === 'online') {
      updateRematchHint();
    } else if (screen !== 'lobby') {
      showScreen('lobby');
    }
  }
}

function onStart(game) {
  clearTimeout(resultsTimer);
  session = game;
  sessionType = 'online';
  fx.clear();
  hideOverlay('results');
  hideOverlay('pause');
  $('#game-chat-log').textContent = '';
  showScreen('game');
}

function renderLobby(room) {
  $('#room-code').textContent = room.code;
  const me = online.id;
  const isHost = room.host === me;
  const cap = MODES[room.settings.mode];
  const ul = $('#slots');
  ul.textContent = '';
  for (let i = 0; i < cap; i++) {
    const p = room.players[i];
    const li = document.createElement('li');
    li.className = 'slot';
    const sw = document.createElement('span');
    sw.className = 'swatch';
    const name = document.createElement('div');
    const side = document.createElement('div');
    side.className = 'slot-side';
    if (p) {
      sw.style.background = p.color;
      const n = document.createElement('span');
      n.className = 'slot-name';
      n.textContent = p.name;
      name.append(n);
      const tags = [];
      if (p.id === me) tags.push('toi');
      if (p.id === room.host) tags.push('hôte');
      if (tags.length) {
        const tg = document.createElement('span');
        tg.className = 'slot-tag';
        tg.textContent = tags.join(', ');
        name.append(tg);
      }
      if (p.bot) {
        side.append(`IA ${(BOT_LEVELS[p.botLevel] || BOT_LEVELS.normal).label.toLowerCase()}`);
        if (isHost) {
          const rm = document.createElement('button');
          rm.className = 'link';
          rm.textContent = 'Retirer';
          rm.addEventListener('click', () => online.removeBot(p.id));
          side.append(rm);
        }
      } else {
        const st = document.createElement('span');
        st.className = p.ready ? 'ok' : '';
        st.textContent = p.ready ? 'Prêt' : 'Pas prêt';
        side.append(st);
      }
    } else {
      sw.style.background = 'transparent';
      sw.style.border = '1px dashed #4a5869';
      const n = document.createElement('span');
      n.className = 'slot-name empty';
      n.textContent = 'Place libre';
      name.append(n);
      if (isHost) {
        const sel = document.createElement('select');
        sel.setAttribute('aria-label', 'Niveau de l\'IA');
        for (const [v, l] of Object.entries(BOT_LEVELS)) {
          const o = document.createElement('option');
          o.value = v;
          o.textContent = l.label;
          if (v === 'normal') o.selected = true;
          sel.append(o);
        }
        const add = document.createElement('button');
        add.className = 'secondary small';
        add.textContent = 'Ajouter une IA';
        add.addEventListener('click', () => online.addBot(sel.value));
        side.append(sel, add);
      } else {
        side.append('En attente');
      }
    }
    li.append(sw, name, side);
    ul.append(li);
  }

  for (const seg of $$('.seg[data-room]')) {
    const v = String(room.settings[seg.dataset.room]);
    seg.classList.toggle('locked', !isHost);
    for (const b of seg.querySelectorAll('button')) {
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(b.dataset.v === v));
      b.disabled = !isHost;
    }
  }
  const host = room.players.find((p) => p.id === room.host);
  $('#host-note').textContent = isHost
    ? 'Tu es l\'hôte : tu choisis les réglages et tu peux ajouter des IA.'
    : `${host ? host.name : 'L\'hôte'} choisit les réglages.`;
  const mine = room.players.find((p) => p.id === me);
  $('#ready-btn').textContent = mine && mine.ready ? 'Je ne suis plus prêt' : 'Je suis prêt';
}

function initLobby() {
  for (const seg of $$('.seg[data-room]')) {
    const key = seg.dataset.room;
    const numeric = seg.dataset.type === 'number';
    for (const b of seg.querySelectorAll('button')) {
      b.addEventListener('click', () => {
        if (!lastRoom) return;
        online.settings({ ...lastRoom.settings, [key]: numeric ? Number(b.dataset.v) : b.dataset.v });
      });
    }
  }
  $('#ready-btn').addEventListener('click', () => {
    if (!lastRoom) return;
    const mine = lastRoom.players.find((p) => p.id === online.id);
    online.ready(!(mine && mine.ready));
  });
  $('#leave-btn').addEventListener('click', () => {
    online.leave();
    showScreen('menu');
  });
  $('#copy-link').addEventListener('click', async () => {
    if (!lastRoom) return;
    const url = `${location.origin}${location.pathname}?salon=${lastRoom.code}`;
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      const tmp = document.createElement('input');
      tmp.value = url;
      document.body.append(tmp);
      tmp.select();
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      tmp.remove();
    }
    toast(ok ? 'Lien d\'invitation copié.' : url);
  });
  $('#lobby-chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = $('#lobby-chat-input');
    if (inp.value.trim()) online.chat(inp.value);
    inp.value = '';
  });
}

// ------------------------------------------------------------ chat

function onChat(m) {
  for (const logId of ['#lobby-chat-log', '#game-chat-log']) {
    const log = $(logId);
    const p = document.createElement('p');
    if (m.sys) {
      p.className = 'chat-sys';
      p.textContent = m.text;
    } else {
      const who = document.createElement('span');
      who.className = 'chat-name';
      const pl = lastRoom && lastRoom.players.find((x) => x.id === m.id);
      who.style.color = pl ? pl.color : '#e9eef3';
      who.textContent = m.name + ' : ';
      p.append(who, document.createTextNode(m.text));
    }
    log.append(p);
    while (log.children.length > 60) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
    if (logId === '#game-chat-log') setTimeout(() => p.classList.add('faded'), 8000);
  }
}

function openGameChat() {
  $('#game-chat-form').classList.remove('hidden');
  $('#game-chat').classList.add('typing');
  refreshInput();
  $('#game-chat-input').focus();
}

function closeGameChat() {
  $('#game-chat-form').classList.add('hidden');
  $('#game-chat').classList.remove('typing');
  const inp = $('#game-chat-input');
  inp.value = '';
  inp.blur();
  refreshInput();
}

function initGameChat() {
  $('#game-chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('#game-chat-input').value;
    if (v.trim()) online.chat(v);
    closeGameChat();
  });
  $('#game-chat-input').addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      e.stopPropagation();
      closeGameChat();
    }
  });
}

// ------------------------------------------------------------ touches globales

function onEscape() {
  if (!$('#loot').classList.contains('hidden')) return;
  if (!$('#settings').classList.contains('hidden')) return closeSettings();
  if (!$('#help').classList.contains('hidden')) return hideOverlay('help');
  if (!$('#build').classList.contains('hidden')) return hideOverlay('build');
  if (!$('#results').classList.contains('hidden')) return;
  if (!$('#pause').classList.contains('hidden')) return resume();
  if (screen === 'game' && session) openPause();
}

function onEnter(e) {
  if (screen === 'game' && sessionType === 'online' && !anyOverlay()) {
    // Sans ça, la même frappe d'Entrée soumettrait aussitôt le champ vide.
    if (e) e.preventDefault();
    openGameChat();
  }
}

function openPause() {
  const local = sessionType !== 'online';
  if (local) session.paused = true;
  $('#pause-title').textContent = local ? 'Pause' : 'Menu';
  $('#pause-note').textContent = local ? '' : 'La partie continue pendant que ce menu est ouvert.';
  $('#pause-quit').textContent = local ? 'Abandonner la partie' : 'Quitter la partie';
  showOverlay('pause');
}

function resume() {
  if (session && sessionType !== 'online') session.paused = false;
  hideOverlay('pause');
}

function initPause() {
  $('#pause-resume').addEventListener('click', resume);
  $('#pause-settings').addEventListener('click', openSettings);
  $('#pause-quit').addEventListener('click', () => {
    hideOverlay('pause');
    if (sessionType === 'online') online.leave();
    endSession();
    showScreen('menu');
  });
}

// ------------------------------------------------------------ résultats

function showSurvivalResults(survived, dodges, record, prev) {
  const label = DIFF_LABEL[settings.survivalDifficulty];
  $('#res-title').textContent = formatTime(survived);
  $('#res-sub').textContent = record
    ? `Nouveau record en difficulté ${label}.`
    : `Ton record en difficulté ${label} : ${formatTime(prev)}.`;
  $('#res-table').textContent = '';
  $('#res-kit').textContent = '';
  $('#res-hint').textContent = `${dodges} sort${dodges > 1 ? 's' : ''} esquivé${dodges > 1 ? 's' : ''}. Espace pour rejouer.`;
  $('#res-again').textContent = 'Rejouer';
  $('#res-menu').textContent = 'Menu';
  showOverlay('results');
}

function showVersusResults(ev, players) {
  const you = sessionType === 'online' ? online.id : 'you';
  const winner = players.find((p) => p.id === ev.winner);
  const youWon = ev.winner === you;
  $('#res-title').textContent = !winner ? 'Fin de partie' : youWon ? 'Victoire' : 'Défaite';
  const sorted = [...players].sort((a, b) => (ev.scores[b.id] || 0) - (ev.scores[a.id] || 0));
  let sub = '';
  const rtw = (sessionType === 'online' ? lastRoom && lastRoom.settings.roundsToWin : settings.vsRounds) || 2;
  if (winner && (ev.scores[winner.id] || 0) < rtw) {
    sub = youWon
      ? `Victoire par abandon : ${players.length === 2 ? 'ton adversaire a' : 'les autres joueurs ont'} quitté la partie.`
      : `${winner.name} gagne par abandon.`;
  } else if (winner) {
    const who = youWon ? 'Tu remportes' : `${winner.name} remporte`;
    if (players.length === 2) {
      const other = sorted.find((p) => p.id !== winner.id);
      sub = `${who} la partie ${ev.scores[winner.id] || 0} à ${other ? ev.scores[other.id] || 0 : 0}.`;
    } else {
      const n = ev.scores[winner.id] || 0;
      sub = `${who} la partie avec ${n} manche${n > 1 ? 's' : ''}.`;
    }
  } else {
    sub = 'Il ne reste plus assez de joueurs.';
  }
  $('#res-sub').textContent = sub;

  const table = $('#res-table');
  table.textContent = '';
  $('#res-kit').textContent = '';
  const head = document.createElement('tr');
  for (const [txt, num] of [['Joueur', false], ['Manches', true], ['Éliminations', true], ['Dégâts', true], ['Précision', true]]) {
    const th = document.createElement('th');
    th.textContent = txt;
    if (num) th.className = 'num';
    head.append(th);
  }
  table.append(head);
  for (const p of sorted) {
    const st = (ev.stats && ev.stats[p.id]) || { kills: 0, dmg: 0, hits: 0, casts: 0 };
    const tr = document.createElement('tr');
    const name = document.createElement('td');
    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = p.color;
    name.append(sw, p.name + (p.id === you ? ' (toi)' : ''));
    tr.append(name);
    const acc = st.casts ? Math.round((st.hits / st.casts) * 100) + ' %' : '—';
    for (const v of [ev.scores[p.id] || 0, st.kills, Math.round(st.dmg), acc]) {
      const td = document.createElement('td');
      td.className = 'num';
      td.textContent = String(v);
      tr.append(td);
    }
    table.append(tr);
  }

  if (sessionType === 'online') {
    $('#res-menu').textContent = 'Quitter le salon';
    updateRematchHint();
  } else {
    $('#res-again').textContent = 'Rejouer';
    $('#res-menu').textContent = 'Menu';
    $('#res-hint').textContent = '';
  }
  showOverlay('results');
}

function showStoryResults(ev, players) {
  fillStoryResults(ev, players, sessionType === 'online' ? online.id : 'you', iconCanvas);
  $('#res-again').textContent = 'Rejouer';
  $('#res-menu').textContent = 'Menu';
  $('#res-hint').textContent = '';
  showOverlay('results');
}

function updateRematchHint() {
  if (sessionType !== 'online' || !lastRoom) return;
  const others = lastRoom.players.filter((p) => p.id !== online.id && !p.bot);
  const ready = others.filter((p) => p.ready).map((p) => p.name);
  const cap = MODES[lastRoom.settings.mode];
  const full = lastRoom.players.length >= cap;
  let txt = 'La revanche démarre quand tout le monde est prêt.';
  if (!full) txt = 'Il manque un joueur : retourne au salon pour inviter quelqu\'un ou ajouter une IA.';
  else if (ready.length) txt += ` Déjà prêt : ${ready.join(', ')}.`;
  $('#res-hint').textContent = txt;
  $('#res-again').textContent = full ? 'Revanche' : 'Retour au salon';
}

function initResults() {
  $('#loot-skip').addEventListener('click', () => pickLoot(-1));
  $('#res-again').addEventListener('click', () => {
    hideOverlay('results');
    if (sessionType === 'survival') startSurvival();
    else if (sessionType === 'bots') startBots();
    else if (sessionType === 'story') startStory();
    else if (sessionType === 'online') {
      const full = lastRoom && lastRoom.players.length >= MODES[lastRoom.settings.mode];
      if (full) online.ready(true);
      endSession();
      showScreen('lobby');
    }
  });
  $('#res-menu').addEventListener('click', () => {
    hideOverlay('results');
    if (sessionType === 'online') online.leave();
    endSession();
    showScreen('menu');
  });
}

// ------------------------------------------------------------ build

const SLOT_TINTS = { Q: '#38bdf8', W: '#fb923c', E: '#4ade80', R: '#93c5fd', D: '#facc15', F: '#5eead4' };

// Petite icône de sort dessinée dans un canvas (même dessin que dans le jeu).
function iconCanvas(id, slot, size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, size);
  grd.addColorStop(0, SLOT_TINTS[slot] + '66');
  grd.addColorStop(1, '#0b1018');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  drawAbilityIcon(g, id, size / 2, size / 2, size * 0.34);
  return c;
}

function renderBuildStrip() {
  const box = $('#build-icons');
  box.textContent = '';
  for (const slot of BUILD_SLOTS) {
    const c = iconCanvas(settings.build[slot], slot);
    c.title = `${slot} : ${ABILITIES[settings.build[slot]].name}`;
    box.append(c);
  }
}

function renderBuildModal() {
  const root = $('#build-slots');
  root.textContent = '';
  for (const slot of BUILD_SLOTS) {
    const row = document.createElement('div');
    row.className = 'build-slot';
    const key = document.createElement('div');
    key.className = 'build-key';
    key.textContent = keyLabel(settings.binds[slot]);
    const right = document.createElement('div');
    const opts = document.createElement('div');
    opts.className = 'build-options';
    opts.setAttribute('role', 'radiogroup');
    opts.setAttribute('aria-label', `Sort ${slot}`);
    for (const id of poolFor(slot)) {
      const ab = ABILITIES[id];
      const b = document.createElement('button');
      b.className = 'build-opt';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(settings.build[slot] === id));
      b.append(iconCanvas(id, slot), ab.name);
      b.addEventListener('click', () => chooseSpell(slot, id));
      opts.append(b);
    }
    const desc = document.createElement('p');
    desc.className = 'build-desc';
    const cur = ABILITIES[settings.build[slot]];
    desc.textContent = `${describe(cur)} Recharge ${String(cur.cd).replace('.', ',')} s.`;
    right.append(opts, desc);
    row.append(key, right);
    root.append(row);
  }
}

function chooseSpell(slot, id) {
  const b = { ...settings.build };
  // Un même sort d'invocateur ne peut pas être sur D et F : on échange.
  const other = slot === 'D' ? 'F' : slot === 'F' ? 'D' : null;
  if (other && b[other] === id) b[other] = b[slot];
  b[slot] = id;
  settings.build = sanitizeBuild(b);
  saveSettings();
  renderBuildModal();
  renderBuildStrip();
  if (online.connected) online.sendBuild(settings.build);
}

function initBuild() {
  renderBuildStrip();
  const open = () => {
    renderBuildModal();
    showOverlay('build');
  };
  $('#open-build').addEventListener('click', open);
  $('#lobby-build').addEventListener('click', open);
  $('#close-build').addEventListener('click', () => hideOverlay('build'));
}

// ------------------------------------------------------------ paramètres et aide

let waitingBind = null;

function openSettings() {
  buildBinds();
  for (const r of $$('input[name="castMode"]')) r.checked = r.value === settings.castMode;
  $('#volume').value = String(settings.volume);
  $('#show-perf').checked = settings.showPerf;
  showOverlay('settings');
}

function closeSettings() {
  waitingBind = null;
  hideOverlay('settings');
}

function buildBinds() {
  const table = $('#binds');
  table.textContent = '';
  for (const a of ACTIONS) {
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    td1.textContent = a.label;
    const td2 = document.createElement('td');
    const b = document.createElement('button');
    b.className = 'key-btn';
    b.textContent = keyLabel(settings.binds[a.id]);
    b.addEventListener('click', () => {
      waitingBind = a.id;
      for (const x of $$('.key-btn')) x.classList.remove('waiting');
      b.classList.add('waiting');
      b.textContent = 'Appuie…';
    });
    td2.append(b);
    tr.append(td1, td2);
    table.append(tr);
  }
}

function initSettings() {
  window.addEventListener('keydown', (e) => {
    if (!waitingBind) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.code !== 'Escape') {
      const prev = settings.binds[waitingBind];
      for (const id in settings.binds) {
        if (id !== waitingBind && settings.binds[id] === e.code) settings.binds[id] = prev;
      }
      settings.binds[waitingBind] = e.code;
      saveSettings();
    }
    waitingBind = null;
    buildBinds();
  }, { capture: true });
  $('#reset-binds').addEventListener('click', () => {
    resetBinds();
    buildBinds();
  });
  for (const r of $$('input[name="castMode"]')) {
    r.addEventListener('change', () => {
      settings.castMode = r.value;
      saveSettings();
    });
  }
  $('#volume').addEventListener('input', (e) => {
    settings.volume = Number(e.target.value);
    sfx.setVolume(settings.volume);
    saveSettings();
  });
  $('#volume').addEventListener('change', () => sfx.play('hit'));
  $('#show-perf').addEventListener('change', (e) => {
    settings.showPerf = e.target.checked;
    saveSettings();
  });
  $('#close-settings').addEventListener('click', closeSettings);
}

function kbd(text) {
  const k = document.createElement('kbd');
  k.textContent = text;
  return k;
}

function row(table, keys, desc, title) {
  const tr = document.createElement('tr');
  const k = document.createElement('td');
  k.className = 'k';
  keys.forEach((x, i) => {
    if (i) k.append(' ');
    k.append(kbd(x));
  });
  const d = document.createElement('td');
  d.className = 'desc';
  if (title) {
    const s = document.createElement('strong');
    s.textContent = title + '. ';
    d.append(s);
  }
  d.append(desc);
  tr.append(k, d);
  table.append(tr);
}

function openHelp() {
  const keys = $('#help-keys');
  keys.textContent = '';
  row(keys, ['Clic droit'], 'Se déplacer. Garde le bouton enfoncé pour suivre le curseur.');
  row(keys, [keyLabel(settings.binds.stop)], 'S\'arrêter net.');
  row(keys, ['Q', 'W', 'E', 'R'].map((s) => keyLabel(settings.binds[s])), 'Lancer un sort vers le curseur.');
  row(keys, [keyLabel(settings.binds.D), keyLabel(settings.binds.F)], 'Flash et Fantôme.');
  row(keys, ['Échap'], 'Pause en solo, menu en ligne. Annule aussi une visée.');
  row(keys, ['Entrée'], 'Discuter pendant une partie en ligne.');
  const kit = $('#help-kit');
  kit.textContent = '';
  for (const slot of ['Q', 'W', 'E', 'R', 'D', 'F']) {
    const ab = abilityOf({ build: settings.build }, slot);
    row(kit, [keyLabel(settings.binds[slot])], `${describe(ab)} Recharge ${String(ab.cd).replace('.', ',')} s.`, ab.name);
  }
  {
    row(kit, ['Clic droit'], `Sur un ennemi : le poursuit et l'attaque à ${AUTO.range} unités, ${AUTO.dmg} dégâts par coup, une attaque par seconde.`, 'Auto-attaque');
  }
  const env = $('#help-env');
  env.textContent = '';
  for (const key of Object.keys(ENV_SPELLS)) {
    const tr = document.createElement('tr');
    const n = document.createElement('td');
    n.className = 'k';
    const s = document.createElement('strong');
    s.textContent = ENV_SPELLS[key].name;
    n.append(s);
    const d = document.createElement('td');
    d.className = 'desc';
    d.textContent = ENV_DESC[key];
    tr.append(n, d);
    env.append(tr);
  }
  showOverlay('help');
}

// ------------------------------------------------------------ événements de jeu → effets et sons

// Joueur ou, en mode histoire, ennemi.
function playerById(view, id) {
  if (!view) return null;
  return view.players.find((p) => p.id === id) || (view.mobs && view.mobs.find((p) => p.id === id)) || null;
}

function handleEvents(evs) {
  if (!session) return;
  const view = session.view();
  for (const ev of evs) {
    switch (ev.e) {
      case 'round':
        fx.clear();
        lastCount = 0;
        break;
      case 'go':
        sfx.play('go');
        if (!isStory()) fx.setBanner(sessionType === 'survival' ? 'Survivez' : 'Combattez', '', '#e9eef3', 0.9);
        break;
      case 'hit': {
        const target = playerById(view, ev.tid);
        const owner = ev.by ? playerById(view, ev.by) : null;
        const color = owner ? owner.color : view.story ? HOSTILE : ENV_COLOR;
        fx.burst(ev.x, ev.y, color, 16, 300, 0.4, 4);
        fx.ring(ev.x, ev.y, color, 8, 54, 0.25, 4);
        const isMe = ev.tid === view.you;
        if (target && ev.fx === 'block') fx.number(target.x, target.y - 20, 'Bloqué', '#fde68a');
        if (target && ev.fx === 'mark') fx.number(target.x, target.y - 20, 'Marqué', '#fb923c');
        if (target && ev.fx === 'pop') fx.ring(target.x, target.y, color, 30, 130, 0.35, 7);
        if (ev.dmg > 0) {
          const at = target || { x: ev.x, y: ev.y };
          fx.number(at.x, at.y - 20, `-${ev.dmg}`, isMe ? '#ff6b6b' : ev.by === view.you ? '#fde68a' : '#e9eef3', ev.dmg >= 25);
        }
        if (isMe) {
          sfx.play('hurt');
          fx.shake(5 + ev.dmg * 0.25);
        } else {
          sfx.play('hit', ev.by === view.you ? 1 : 0.55);
        }
        break;
      }
      case 'die': {
        const mob = mobLook.get(ev.id);
        if (mob) {
          // Ennemi du mode histoire : éclat à sa couleur, pas de message.
          fx.burst(ev.x, ev.y, mob.color, mob.boss ? 60 : 22, mob.boss ? 520 : 340, mob.boss ? 1 : 0.5, 5);
          fx.ring(ev.x, ev.y, mob.color, mob.r * 0.5, mob.r * (mob.boss ? 4 : 2.4), mob.boss ? 0.7 : 0.35, 6);
          sfx.play('die', mob.boss ? 1 : 0.45);
          if (mob.boss) fx.shake(14);
          mobLook.delete(ev.id);
          break;
        }
        const victim = playerById(view, ev.id);
        const color = victim ? victim.color : '#e9eef3';
        fx.burst(ev.x, ev.y, color, 44, 460, 0.8, 6);
        fx.ring(ev.x, ev.y, color, 20, 170, 0.5, 8);
        sfx.play('die', ev.id === view.you ? 1 : 0.7);
        if (ev.id === view.you) fx.shake(12);
        if (isStory()) {
          if (victim) fx.pushFeed([{ text: victim.name, color }, { text: ' est à terre', color: '#93a1b0' }]);
        } else if (sessionType !== 'survival' && victim) {
          const killer = ev.by ? playerById(view, ev.by) : null;
          if (killer && killer.id !== ev.id) {
            fx.pushFeed([{ text: killer.name, color: killer.color }, { text: ' a éliminé ', color: '#93a1b0' }, { text: victim.name, color }]);
          } else {
            fx.pushFeed([{ text: victim.name, color }, { text: ' éliminé par ', color: '#93a1b0' }, { text: spellName(ev.def), color: ENV_COLOR }]);
          }
        }
        break;
      }
      case 'flash':
        fx.burst(ev.fx, ev.fy, '#facc15', 14, 220, 0.35, 4);
        fx.ring(ev.fx, ev.fy, '#fde68a', 10, 64, 0.3, 4);
        fx.burst(ev.x, ev.y, '#fde68a', 18, 260, 0.4, 4);
        fx.ring(ev.x, ev.y, '#facc15', 72, 18, 0.3, 4);
        sfx.play('flash');
        break;
      case 'dash':
        sfx.play('dash', 0.8);
        break;
      case 'buff': {
        const p = playerById(view, ev.id);
        if (p) fx.ring(p.x, p.y, '#5eead4', 20, 84, 0.4, 5);
        if (p && ev.heal) fx.number(p.x, p.y - 20, `+${ev.heal}`, '#5ee08f');
        sfx.play('buff', 0.7);
        break;
      }
      case 'end':
        if (ev.why === 'cancel') fx.burst(ev.x, ev.y, '#93a1b0', 8, 120, 0.3, 3);
        break;
      case 'roundEnd': {
        const w = ev.winner ? playerById(view, ev.winner) : null;
        if (!w) fx.setBanner('Égalité', 'Personne ne marque cette manche', '#e9eef3', 2.8);
        else if (w.id === view.you) {
          fx.setBanner('Manche gagnée', '', '#5ee08f', 2.8);
          sfx.play('win');
        } else {
          fx.setBanner(`${w.name} gagne la manche`, '', w.color, 2.8);
          sfx.play('lose');
        }
        break;
      }
      case 'matchEnd': {
        const youWon = ev.winner === view.you;
        fx.setBanner(youWon ? 'Victoire' : 'Défaite', '', youWon ? '#5ee08f' : '#ef4b54', 2);
        sfx.play(youWon ? 'win' : 'lose');
        lastMatchEnd = ev;
        const players = view.players.map((p) => ({ id: p.id, name: p.name, color: p.color }));
        clearTimeout(resultsTimer);
        resultsTimer = setTimeout(() => showVersusResults(ev, players), 1600);
        break;
      }
      case 'over': {
        const diff = settings.survivalDifficulty;
        const prev = settings.best[diff] || 0;
        const record = ev.survived > prev;
        if (record) {
          settings.best[diff] = ev.survived;
          saveSettings();
          updateBestLine();
        }
        hud.survived = ev.survived;
        sfx.play(record ? 'win' : 'lose');
        clearTimeout(resultsTimer);
        resultsTimer = setTimeout(() => showSurvivalResults(ev.survived, ev.dodges, record, prev), 900);
        break;
      }
      case 'room':
        fx.clear();
        lastCount = 0;
        mobLook.clear();
        hideOverlay('loot');
        if (ev.i > 0) sfx.play('door');
        if (ev.type === 'boss') sfx.play('boss');
        break;
      case 'spawn':
        mobLook.set(ev.u.id, { name: ev.u.name, color: ev.u.color, r: ev.u.r, boss: !!ev.u.boss });
        fx.ring(ev.x, ev.y, ev.u.color, ev.u.r * 2.2, ev.u.r, 0.3, 5);
        sfx.play('spawn', ev.u.boss ? 1 : 0.5);
        break;
      case 'clear':
        fx.setBanner('Salle vidée', '', '#5ee08f', 1.3);
        sfx.play('win', 0.6);
        break;
      case 'heal': {
        const p = playerById(view, ev.id);
        if (p && ev.amt > 0) fx.number(p.x, p.y - 20, `+${ev.amt}`, '#5ee08f');
        if (ev.amt > 0) sfx.play('buff', 0.6);
        break;
      }
      case 'revive': {
        const p = playerById(view, ev.id);
        if (p) fx.ring(p.x, p.y, '#5ee08f', 20, 120, 0.5, 6);
        sfx.play('buff', 0.8);
        break;
      }
      case 'boss':
        if (ev.phase > 1) {
          fx.setBanner(`Phase ${ev.phase}`, '', '#fb7185', 1.1);
          fx.shake(8);
        }
        break;
      case 'offer':
        if (ev.id === view.you) openLoot();
        break;
      case 'kit': {
        const p = playerById(view, ev.id);
        const rar = RARITIES[ev.rar] || RARITIES[0];
        if (p) {
          fx.ring(p.x, p.y, rar.color, 24, 110, 0.5, 6);
          fx.number(p.x, p.y - 30, ABILITIES[ev.ab].name, rar.color, ev.rar >= 2);
        }
        if (ev.id === view.you) sfx.play('pick', 1, ev.rar);
        break;
      }
      case 'storyEnd': {
        hideOverlay('loot');
        fx.setBanner(ev.win ? 'Victoire' : 'Défaite', '', ev.win ? '#5ee08f' : '#ef4b54', 2);
        sfx.play(ev.win ? 'win' : 'lose');
        saveStoryRecord(ev);
        $('#story-best').textContent = storyBestLine();
        const players = view.players.map((p) => ({ id: p.id, name: p.name, color: p.color }));
        clearTimeout(resultsTimer);
        resultsTimer = setTimeout(() => showStoryResults(ev, players), 1600);
        break;
      }
      case 'left': {
        const p = playerById(view, ev.id);
        if (p) fx.pushFeed([{ text: p.name, color: p.color }, { text: ' a quitté la partie', color: '#93a1b0' }]);
        break;
      }
    }
  }
}

// Effets déclenchés par le temps : départ des projectiles, explosions, rayons, traînées.
function timedEffects(view, f, withSound) {
  const t = view.t;
  const me = view.players.find((p) => p.isYou);
  const vol = (x, y) => (me ? Math.max(0.3, 1 - Math.hypot(x - me.x, y - me.y) / 1500) : 0.5);
  const colorOf = (owner) => {
    const p = owner && playerById(view, owner);
    return p ? p.color : view.story ? HOSTILE : ENV_COLOR;
  };
  for (const s of view.spells) {
    if (s.kind === 'line') {
      const flying = t >= s.tl && t < s.cut && t < s.end && s.hiddenAt == null;
      if (!s._launched && t >= s.tl && t < s.cut) {
        s._launched = true;
        if (withSound) sfx.play(s.def === 'r' || s.def === 'fleche' ? 'castHeavy' : 'cast', vol(s.ox, s.oy) * (s.owner ? 1 : 0.6));
      }
      if (flying && (s.def === 'r' || s.def === 'fleche') && Math.random() < 0.7) {
        const p = linePos(s, t);
        f.spark(
          p.x - s.dx * s.radius * 1.2, p.y - s.dy * s.radius * 1.2,
          (Math.random() - 0.5) * 90 - s.dx * 60, (Math.random() - 0.5) * 90 - s.dy * 60,
          '#dbeafe', 0.35, 3,
        );
      }
    } else if (s.kind === 'circle') {
      if (!s._boom && t >= s.td && s.cut >= s.td) {
        s._boom = true;
        const c = colorOf(s.owner);
        f.burst(s.x, s.y, c, 22, 360, 0.5, 5);
        f.ring(s.x, s.y, c, s.r * 0.5, s.r * 1.15, 0.4, 6);
        if (withSound) sfx.play('boom', vol(s.x, s.y) * 0.8);
      }
    } else if (s.kind === 'beam') {
      if (!s._fired && t >= s.ta) {
        s._fired = true;
        if (withSound) sfx.play('beam', 0.8);
        for (let i = 0; i <= 6; i++) {
          const k = i / 6;
          f.burst(s.ax + (s.bx - s.ax) * k, s.ay + (s.by - s.ay) * k, colorOf(s.owner), 6, 260, 0.4, 4);
        }
      }
    } else if (s.kind === 'ring') {
      if (!s._closed && t >= s.ta) {
        s._closed = true;
        if (withSound) sfx.play('cage', vol(s.x, s.y));
      }
    }
  }
  for (const p of view.players) {
    if (!p.alive || !p.st) continue;
    if (t < p.st.ghostUntil && Math.random() < 0.5) f.trail(p.x, p.y, '#5eead4', PLAYER_RADIUS * 0.9, 0.3);
    if (p.st.dash && p.st.dash.k === 'dash') f.trail(p.x, p.y, p.color, PLAYER_RADIUS, 0.22);
  }
}

// ------------------------------------------------------------ boucle principale

let lastFrame = performance.now() / 1000;
let fps = 60;

function frame(ms) {
  const now = ms / 1000;
  const dt = Math.min(0.1, Math.max(0, now - lastFrame));
  lastFrame = now;
  if (dt > 0) fps += (1 / dt - fps) * 0.05;

  if (screen === 'game' && session) {
    input.update();
    const evs = session.update(now);
    if (evs && evs.length) handleEvents(evs);
    if (!session) return requestAnimationFrame(frame);
    const view = session.view();
    if (view.phase.name === 'countdown' && view.rules && view.kind !== 'story') {
      const n = Math.ceil(view.rules.playAt - view.t);
      if (n !== lastCount && n > 0 && n <= 3) sfx.play('tick');
      lastCount = n;
    }
    timedEffects(view, fx, true);
    if (sessionType === 'survival') hud.dodges = session.match.stats.you.dodges;
    fx.update(dt);
    renderer.render(view, fx, {
      aim: input.aimState(),
      perf: { fps, ping: sessionType === 'online' ? online.ping : null },
      best: hud.best,
      dodges: hud.dodges,
      survived: hud.survived,
    });
  } else {
    demo.update(now);
    const v = demo.view();
    timedEffects(v, demoFx, false);
    demoFx.update(dt);
    renderer.render(v, demoFx);
    if (demo.match.over && !reducedMotion) {
      demo = makeDemo();
      demoFx.clear();
    }
  }
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------ démarrage

initMenu();
initLobby();
initGameChat();
initPause();
initResults();
initSettings();
initBuild();
$('#close-help').addEventListener('click', () => hideOverlay('help'));
loadKeyboardLayout();
showScreen('menu');

// Lien d'invitation (?salon=CODE) : un joueur qui a déjà un pseudo rejoint directement,
// un nouveau joueur choisit d'abord son pseudo.
const invite = new URLSearchParams(location.search).get('salon');
if (invite) {
  const code = invite.trim().toUpperCase().slice(0, 4);
  $('#join-code').value = code;
  $('.mode[data-mode="online"] .mode-head').click();
  if (hadName) goOnline(() => online.join(code));
  else {
    setStatus(`Choisis ton pseudo puis clique sur « Rejoindre » pour entrer dans le salon ${code}.`);
    $('#name').focus();
    $('#name').select();
  }
}

requestAnimationFrame(frame);

// Accès pratique pour le débogage dans la console.
window.dodgeArena = { get session() { return session; }, online, settings, renderer, get lastMatchEnd() { return lastMatchEnd; } };
