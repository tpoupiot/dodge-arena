# Mode histoire — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter à Dodge Arena un mode histoire roguelite (15 salles, 3 boss, sorts trouvés dans des coffres avec rareté), jouable seul hors ligne ou en coop en ligne de 1 à 3 joueurs.

**Architecture:** Le moteur partagé (`shared/sim.js`, `shared/match.js`) est généralisé : toute unité porte une équipe, un rayon, des PV max et une vitesse, et un sort ne touche que les autres équipes. Les ennemis sont des unités du même type que les joueurs, pilotées par une IA. Le mode histoire est une sous-classe `StoryMatch` de `Match`, dans `shared/story/`. La partie locale et la partie en ligne affichent la même chose en appliquant les mêmes événements à un `StoryState`.

**Tech Stack:** JavaScript (modules ES), Node.js ≥ 18, `ws`, canvas 2D, tests avec `node --test`. Aucune dépendance ajoutée.

**Spec:** `docs/superpowers/specs/2026-10-04-mode-histoire-design.md`

## Global Constraints

- Node ≥ 18, aucune dépendance en plus de `ws`.
- Survie, Contre l'IA et En ligne gardent exactement leur comportement. Tous les tests existants restent verts à la fin de chaque tâche (`npm test`).
- Dans `shared/`, tout tirage au hasard passe par `match.rng` ou par un générateur créé à partir de la graine. Jamais `Math.random`.
- Textes d'interface en français, tutoiement, accents complets. Les 13 textes de la section 9 de la spec sont repris mot pour mot.
- Valeurs de jeu : celles des sections 5 à 8 de la spec. Elles ne changent qu'à la tâche 23 (équilibrage).
- Au plus 10 ennemis vivants à la fois.
- Style du fichier modifié : 2 espaces, guillemets simples, points-virgules. Exception : `shared/abilities.js` utilise des tabulations, des guillemets doubles et pas de point-virgule. Commentaires en français, aussi rares que dans le code actuel.
- `node --test` exécute tout fichier `.js` placé dans `test/`. Les outils (pilote scripté, simulation d'équilibrage) vont donc dans `tools/`.
- Travail sur la branche `mode-histoire`. Un commit par tâche, message court en anglais comme les commits actuels, terminé par la ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

Cas que la spec implique sans les détailler, et qui gêneraient un joueur. Chacun a son test dans la tâche qui possède le code.

1. **Tirage de coffre encore ouvert au changement de salle** (porte forcée en coop) : le tirage est perdu, une commande de butin tardive est refusée, la fenêtre se ferme. Tests : tâche 8 (serveur) et tâche 11 (`StoryState`).
2. **Commande de butin malformée venant du réseau** (`i` non entier, hors bornes, sans tirage en attente, joueur mort) : ignorée sans erreur. Tests : tâche 8 et tâche 20.
3. **Départ d'un joueur en pleine run** : s'il était le dernier vivant, défaite ; s'il était attendu à la porte, la porte ne l'attend plus. Test : tâche 7.
4. **Kit incohérent** (rareté hors bornes, sort inconnu) : aucune erreur, le sort inconnu ne se lance pas. Test : tâche 2.
5. **Ennemi ou boss tué au milieu d'une attaque** : son attaque en préparation est annulée et aucune attaque programmée ne part après sa mort. Tests : tâche 9 (ennemis) et tâche 16 (boss).

S'y ajoute la visée sur une touche vide, couverte par le test de rendu de la tâche 12.

## Structure des fichiers

Nouveaux fichiers :

| Fichier | Rôle |
| --- | --- |
| `shared/story/loot.js` | Kit de départ, tables de rareté, tirage d'un coffre |
| `shared/story/mobs.js` | Définitions des ennemis et leur IA (`MobBrain`) |
| `shared/story/bosses.js` | Définitions des boss, moteur d'attaques (`BossBrain`), trois kits |
| `shared/story/rooms.js` | Chapitres, tailles, pièges, génération de la run, géométrie des portes |
| `shared/story/match.js` | `StoryMatch` : salles, vagues, coffre, porte, fin de run |
| `shared/story/script.js` | Les 13 textes de l'histoire |
| `shared/story/state.js` | `StoryState` : état de la salle reconstruit à partir des événements |
| `public/js/draw.js` | Couleurs, polices et outils de dessin communs (sortis de `render.js`) |
| `public/js/render-story.js` | Sol par chapitre, porte, coffre, ennemis, boss, haut d'écran, narration |
| `public/js/story-ui.js` | Record, cartes du coffre, résultats de la run |
| `tools/pilot.js` | Pilote scripté qui joue une run (tests, équilibrage) |
| `tools/balance.js` | Simulation d'équilibrage |
| `test/engine.test.js` | Généralisation du moteur |
| `test/story.test.js` | Butin, salles, ennemis, boss, déroulement |
| `test/story-client.test.js` | `StoryState`, partie locale |
| `test/render.test.js` | Test de fumée du rendu sur un canvas simulé |
| `test/story-netcode.test.js` | Partie en ligne côté client, serveur simulé dans le même processus |

Fichiers modifiés : `shared/sim.js`, `shared/abilities.js`, `shared/match.js`, `shared/spawner.js`, `server/lobby.js`, `public/js/localgame.js`, `public/js/netgame.js`, `public/js/net.js`, `public/js/render.js`, `public/js/main.js`, `public/js/audio.js`, `public/js/settings.js`, `public/index.html`, `public/style.css`, `test/server.test.js`, `README.md`.

## Tâches

| # | Tâche | Étape de la spec |
| --- | --- | --- |
| 0 | Préparation : branche, commit des changements en cours | |
| 1 | Stats d'unité et équipes dans `sim.js` | 1. Moteur |
| 2 | Rareté, touches vides, descriptions | 1. Moteur |
| 3 | Équipes, rayons et points d'extension dans `match.js` | 1. Moteur |
| 4 | Butin : kit de départ et tirage des coffres | 2. Histoire sans affichage |
| 5 | Définitions des ennemis et des boss | 2. Histoire sans affichage |
| 6 | Génération des salles | 2. Histoire sans affichage |
| 7 | `StoryMatch` : salles, vagues, porte, fin de run | 2. Histoire sans affichage |
| 8 | Coffre : tirage, prise, soin | 2. Histoire sans affichage |
| 9 | IA des ennemis | 2. Histoire sans affichage |
| 10 | Pilote scripté et run complète | 2. Histoire sans affichage |
| 11 | État d'affichage et partie locale | 3. Solo jouable |
| 12 | Rendu du mode histoire | 3. Solo jouable |
| 13 | Menu et lancement d'une run solo | 3. Solo jouable |
| 14 | Fenêtre du coffre | 3. Solo jouable |
| 15 | Fin de run et record | 3. Solo jouable |
| 16 | Boss : moteur d'attaques et Gardien de pierre | 4. Boss et narration |
| 17 | Forgeronne des braises | 4. Boss et narration |
| 18 | Archonte du Vide | 4. Boss et narration |
| 19 | Narration | 4. Boss et narration |
| 20 | Réseau : snapshots et salon `story` | 5. Coop |
| 21 | Partie en ligne côté client | 5. Coop |
| 22 | Interface coop | 5. Coop |
| 23 | Équilibrage | 6. Équilibrage et README |
| 24 | README | 6. Équilibrage et README |

Conventions du plan : « **Créer `chemin` :** » donne le contenu complet d'un nouveau fichier. « **Ajouter à la fin de `chemin` :** » donne un bloc à ajouter tel quel en fin de fichier. Les autres changements sont donnés sous la forme « remplacer ceci par cela ».

---

### Task 0 : Préparation

**Files:**
- Aucun fichier de code. Branche git et deux commits.

Trois fichiers ont des changements non commités sur `main` (`shared/abilities.js`, `shared/match.js`, `test/sim.test.js` : dégâts max du Javelot dès 600 unités). Les tâches 2 et 3 modifient ces mêmes fichiers : ces changements sont donc commités à part, avant tout le reste.

- [ ] **Étape 1 : créer la branche**

```bash
git checkout -b mode-histoire
```

- [ ] **Étape 2 : vérifier l'état de départ**

Run: `npm test`
Expected: tous les tests passent (`fail 0`).

- [ ] **Étape 3 : commiter les changements en cours**

```bash
git add shared/abilities.js shared/match.js test/sim.test.js
git commit -m "javelot: max damage from 600 units" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Étape 4 : commiter la spec et le plan**

```bash
git add docs/superpowers
git commit -m "docs: story mode spec and plan" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1 : Stats d'unité et équipes dans `sim.js`

**Files:**
- Modify: `shared/sim.js` (`createPlayer`, `resetForRound`, `clampToBounds`, `speedAt`, `autoAttack`, `towards`, `applyCommand`, `applyBuff`, `extrapolate`)
- Test: `test/engine.test.js` (nouveau)

**Interfaces:**
- Consumes: rien.
- Produces: `createPlayer(def, slot)` renvoie une unité avec `team` (défaut : `def.id`), `r` (défaut `PLAYER_RADIUS`), `maxHp` (défaut `MAX_HP`), `spd` (défaut `MOVE_SPEED`), `cc` (défaut 1), `mob` (défaut `''`), `elite`, `boss` (booléens), `rar` (défaut `null`). Si `def.loadout = { build, rar }` est fourni, `build` et `rar` en sont copiés tels quels.

- [ ] **Étape 1 : écrire les tests qui échouent**

**Créer `test/engine.test.js` :**

```js
// Tests de la généralisation du moteur : stats par unité, équipes, rareté, points d'extension.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DT, MOVE_SPEED, MAX_HP, PLAYER_RADIUS, SLOTS, ARENA_W } from '../shared/constants.js';
import { AUTO } from '../shared/abilities.js';
import { createPlayer, stepPlayer, applyCommand, extrapolate } from '../shared/sim.js';

const rules = { playAt: 0, shrink: false, allowed: SLOTS, frozen: false };

function run(p, from, seconds, world) {
  let t = from;
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    stepPlayer(p, t, t + DT, rules, world);
    t += DT;
  }
  return t;
}

test('une unité a par défaut les stats d\'un joueur et sa propre équipe', () => {
  const p = createPlayer({ id: 'a', name: 'A', color: '#fff' }, 0);
  assert.equal(p.team, 'a');
  assert.equal(p.r, PLAYER_RADIUS);
  assert.equal(p.maxHp, MAX_HP);
  assert.equal(p.hp, MAX_HP);
  assert.equal(p.spd, MOVE_SPEED);
  assert.equal(p.cc, 1);
  assert.equal(p.mob, '');
  assert.equal(p.elite, false);
  assert.equal(p.boss, false);
  assert.equal(p.rar, null);
});

test('une unité garde les stats de sa définition', () => {
  const m = createPlayer({ id: 'm1', name: 'Bélier', color: '#b45309', team: 'M', mob: 'belier', elite: true, r: 45, maxHp: 150, spd: 170, cc: 0.5 }, 0);
  assert.equal(m.team, 'M');
  assert.equal(m.hp, 150);
  assert.equal(m.elite, true);
  assert.equal(m.boss, false);
  m.x = 400; m.y = 450;
  applyCommand(m, { k: 'move', x: 1200, y: 450 }, 1, rules);
  run(m, 1, 1);
  assert.ok(Math.abs(m.x - 570) < 1, `x=${m.x}`);
  // Le rayon sert au bord de l'arène et à l'interpolation visuelle.
  applyCommand(m, { k: 'move', x: 5000, y: 450 }, 2, rules);
  run(m, 2, 12);
  assert.equal(m.x, ARENA_W - 45);
  m.x = ARENA_W - 46; m.tx = 5000; m.mv = true;
  assert.equal(extrapolate(m, 14, 0.2, rules).x, ARENA_W - 45);
});

test('un soin ne dépasse pas les PV max de l\'unité', () => {
  const p = createPlayer({ id: 'a', name: 'A', color: '#fff', maxHp: 150, build: { F: 'soin' } }, 0);
  p.hp = 140;
  assert.ok(applyCommand(p, { k: 'cast', slot: 'F', x: 0, y: 0 }, 1, rules));
  assert.equal(p.hp, 150);
});

test('auto-attaque : portée mesurée jusqu\'au bord de la cible, un allié n\'est pas une cible', () => {
  const a = createPlayer({ id: 'a', name: 'A', color: '#fff', team: 'P' }, 0);
  const ally = createPlayer({ id: 'b', name: 'B', color: '#fff', team: 'P' }, 1);
  const big = createPlayer({ id: 'm1', name: 'Boss', color: '#fff', team: 'M', r: 80 }, 0);
  a.x = 400; a.y = 450; ally.x = 500; ally.y = 450;
  big.x = 400 + AUTO.range + 70; big.y = 450;
  const units = new Map([['a', a], ['b', ally], ['m1', big]]);
  let shots = 0;
  const world = { get: (id) => units.get(id), onAttack: () => { shots++; } };
  applyCommand(a, { k: 'attack', id: 'm1' }, 1, rules);
  run(a, 1, 0.1, world);
  assert.equal(shots, 1, 'tire sans avancer');
  assert.equal(a.x, 400);
  applyCommand(a, { k: 'attack', id: 'b' }, 2, rules);
  run(a, 2, 0.1, world);
  assert.equal(a.atk, null, 'cible alliée abandonnée');
  assert.equal(shots, 1);
});
```

- [ ] **Étape 2 : lancer les tests et constater l'échec**

Run: `node --test test/engine.test.js`
Expected: FAIL. Le premier test échoue sur `p.team` (`undefined !== 'a'`).

- [ ] **Étape 3 : écrire l'implémentation**

Dans `shared/sim.js`, remplacer toute la fonction `createPlayer` par :

```js
export function createPlayer(def, slot) {
  const maxHp = def.maxHp ?? MAX_HP;
  return {
    id: def.id, name: def.name, color: def.color, slot, bot: !!def.bot,
    // Équipe, gabarit et vitesse : par défaut ceux d'un joueur seul dans son équipe.
    team: def.team ?? def.id, r: def.r ?? PLAYER_RADIUS, maxHp, spd: def.spd ?? MOVE_SPEED, cc: def.cc ?? 1,
    mob: def.mob || '', elite: !!def.elite, boss: !!def.boss,
    // loadout (mode histoire) : kit repris tel quel, touches vides comprises.
    build: def.loadout ? { ...def.loadout.build } : sanitizeBuild(def.build),
    rar: def.loadout ? { ...def.loadout.rar } : null,
    x: ARENA_W / 2, y: ARENA_H / 2, tx: ARENA_W / 2, ty: ARENA_H / 2, mv: false, ang: 0,
    hp: maxHp, alive: true, left: false,
    castUntil: 0, castDur: 0, castSlot: '', rootUntil: 0, stunUntil: 0, slowUntil: 0, slowAmt: 0,
    ghostUntil: 0, boostMul: 1, shield: 0, shieldUntil: 0, spellShieldUntil: 0,
    stasisUntil: 0, markUntil: 0, markBy: null, markDmg: 0,
    atk: null, atkReady: 0,
    dash: null,
    cds: { Q: 0, W: 0, E: 0, R: 0, D: 0, F: 0 },
    seq: 0,
  };
}
```

Dans `resetForRound`, remplacer `p.hp = MAX_HP; p.alive = !p.left;` par :

```js
  p.hp = p.maxHp; p.alive = !p.left;
```

Remplacer le corps de `clampToBounds` par :

```js
export function clampToBounds(p, b) {
  p.x = clamp(p.x, b.x0 + p.r, b.x1 - p.r);
  p.y = clamp(p.y, b.y0 + p.r, b.y1 - p.r);
}
```

Dans `speedAt`, remplacer `let s = MOVE_SPEED;` par :

```js
  let s = p.spd;
```

Dans `autoAttack`, remplacer :

```js
  if (!tg || !tg.alive || tg.id === p.id) {
```

par :

```js
  if (!tg || !tg.alive || tg.team === p.team) {
```

et remplacer `if (Math.hypot(dx, dy) <= AUTO.range + PLAYER_RADIUS) {` par :

```js
  if (Math.hypot(dx, dy) <= AUTO.range + tg.r) {
```

Dans `towards`, remplacer le `return` par :

```js
  return {
    x: clamp(p.x + dx * k, b.x0 + p.r, b.x1 - p.r),
    y: clamp(p.y + dy * k, b.y0 + p.r, b.y1 - p.r),
  };
```

Dans `applyCommand`, branche `move`, remplacer les deux lignes `p.tx = …` et `p.ty = …` par :

```js
    p.tx = clamp(cmd.x, b.x0 + p.r, b.x1 - p.r);
    p.ty = clamp(cmd.y, b.y0 + p.r, b.y1 - p.r);
```

Dans `applyBuff`, remplacer `if (ab.heal) p.hp = Math.min(MAX_HP, p.hp + ab.heal);` par :

```js
  if (ab.heal) p.hp = Math.min(p.maxHp, p.hp + ab.heal);
```

Dans `extrapolate`, remplacer la construction de `q` par :

```js
  const q = { x: p.x, y: p.y, tx: p.tx, ty: p.ty, mv: p.mv, dash: p.dash, alive: true, r: p.r, spd: p.spd,
    stunUntil: p.stunUntil, rootUntil: p.rootUntil, castUntil: p.castUntil,
    stasisUntil: p.stasisUntil, slowUntil: p.slowUntil, slowAmt: p.slowAmt, ghostUntil: p.ghostUntil, boostMul: p.boostMul, ang: p.ang };
```

- [ ] **Étape 4 : lancer les tests**

Run: `node --test test/engine.test.js`
Expected: PASS, 4 tests.

Run: `npm test`
Expected: tous les tests passent.

- [ ] **Étape 5 : commit**

```bash
git add shared/sim.js test/engine.test.js
git commit -m "engine: per-unit team, radius, max hp and speed" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2 : Rareté, touches vides, descriptions

**Files:**
- Modify: `shared/abilities.js` (descriptions en gabarits, `RARITIES`, `scaled`, `describe`, `abilityOf`)
- Modify: `shared/match.js` (événement `buff` : montant du soin)
- Modify: `public/js/netgame.js` (même événement, côté prédiction)
- Modify: `public/js/main.js` (import de `describe`, deux usages, soin affiché)
- Test: `test/engine.test.js`

**Interfaces:**
- Consumes: `createPlayer` avec `def.loadout` (tâche 1).
- Produces:
  - `RARITIES` : tableau de 4 objets `{ id, name, color, pow, cd }`, indices 0 (Commun) à 3 (Légendaire).
  - `scaled(id, level)` → sort avec les chiffres de sa rareté, champ `rarity` en plus. Niveau 0 : l'objet de `ABILITIES`. Sort inconnu : `undefined`.
  - `abilityOf(p, slot)` → sort de la touche avec la rareté de `p.rar`, ou `undefined` si la touche est vide.
  - `describe(ab)` → description avec les chiffres réels.
  - Événement `buff` : champ `heal` (0 si le sort ne soigne pas).

- [ ] **Étape 1 : écrire les tests qui échouent**

**Ajouter à la fin de `test/engine.test.js` :**

```js

// ---------------------------------------------------------------- rareté et touches vides

import { ABILITIES, RARITIES, scaled, abilityOf, describe } from '../shared/abilities.js';
import { Match } from '../shared/match.js';
import { PLAYER_COLORS } from '../shared/constants.js';

test('la rareté multiplie dégâts, soins et boucliers, et réduit la recharge', () => {
  assert.equal(RARITIES.length, 4);
  assert.equal(scaled('trait', 0), ABILITIES.trait, 'niveau 0 : le sort d\'origine');
  const leg = scaled('trait', 3);
  assert.equal(leg.dmg, 36);
  assert.equal(leg.cd, 1);
  assert.equal(leg.rarity, 3);
  assert.equal(scaled('javelot', 2).dmgMax, 42);
  assert.equal(scaled('soin', 1).heal, 25);
  assert.equal(scaled('barriere', 3).shield, 90);
  assert.equal(scaled('flux', 2).markDmg, 30);
  assert.equal(scaled('flash', 3).cd, 9.8);
  assert.equal(scaled('flash', 3).range, 400, 'les autres champs ne changent pas');
  assert.equal(scaled('trait', 3), leg, 'mis en cache');
  assert.equal(ABILITIES.trait.dmg, 18, 'le sort d\'origine n\'est pas modifié');
});

test('un niveau de rareté hors bornes ou un sort inconnu ne cassent rien', () => {
  assert.equal(scaled('trait', 9).dmg, 36, 'borné au niveau maximum');
  assert.equal(scaled('trait', -2), ABILITIES.trait);
  assert.equal(scaled('trait', 1.7).rarity, 1);
  assert.equal(scaled('trait', undefined), ABILITIES.trait);
  assert.equal(scaled('inconnu', 2), undefined);
  const p = createPlayer({ id: 'a', name: 'A', color: '#fff', loadout: { build: { Q: 'inconnu', W: null }, rar: { Q: 7, W: 0 } } }, 0);
  assert.equal(abilityOf(p, 'Q'), undefined);
  assert.equal(applyCommand(p, { k: 'cast', slot: 'Q', x: 0, y: 0 }, 1, rules), false);
});

test('une touche vide ne lance rien, un kit applique sa rareté', () => {
  const p = createPlayer({ id: 'a', name: 'A', color: '#fff', loadout: {
    build: { Q: 'trait', W: null, E: null, R: null, D: null, F: null },
    rar: { Q: 2, W: 0, E: 0, R: 0, D: 0, F: 0 },
  } }, 0);
  assert.equal(abilityOf(p, 'W'), undefined);
  assert.equal(abilityOf(p, 'Q').dmg, 27);
  assert.equal(applyCommand(p, { k: 'cast', slot: 'W', x: 0, y: 0 }, 1, rules), false);
  assert.ok(applyCommand(p, { k: 'cast', slot: 'Q', x: 100, y: 0 }, 1, rules));
  assert.equal(p.cds.Q, 1 + scaled('trait', 2).cd, 'recharge de la rareté');
  // Un build classique reste complété par les sorts par défaut.
  const v = createPlayer({ id: 'b', name: 'B', color: '#fff', build: { Q: 'lien' } }, 0);
  assert.equal(abilityOf(v, 'Q').id, 'lien');
  assert.equal(abilityOf(v, 'W').id, 'eruption');
  assert.equal(abilityOf({ build: null }, 'E').id, 'bond');
});

test('les descriptions affichent les chiffres réels du sort', () => {
  assert.equal(describe(ABILITIES.trait), 'Projectile rapide et fin, 18 dégâts.');
  assert.equal(describe(scaled('trait', 3)), 'Projectile rapide et fin, 36 dégâts.');
  assert.match(describe(scaled('javelot', 1)), /de 10 à 35 dégâts selon la distance, maximum dès 600 unités/);
  for (const id in ABILITIES) {
    for (let lvl = 0; lvl < RARITIES.length; lvl++) {
      const text = describe(scaled(id, lvl));
      assert.ok(!/[{}]|undefined|NaN/.test(text), `${id} : ${text}`);
    }
  }
});

test('l\'événement de buff porte le soin réellement rendu', () => {
  const m = new Match({ kind: 'versus', players: [
    { id: 'a', name: 'A', color: PLAYER_COLORS[0], loadout: {
      build: { Q: 'trait', W: null, E: null, R: null, D: 'soin', F: null },
      rar: { Q: 0, W: 0, E: 0, R: 0, D: 2, F: 0 },
    } },
    { id: 'b', name: 'B', color: PLAYER_COLORS[1] },
  ], settings: { env: 'off' }, seed: 1 });
  for (let i = 0; i < 60 * 4 && m.phase !== 'playing'; i++) m.step();
  m.players.get('a').hp = 40;
  assert.equal(m.botCommand('a', { k: 'cast', slot: 'D', x: 0, y: 0 }), true);
  assert.equal(m.players.get('a').hp, 70);
  assert.equal(m.events.find((e) => e.e === 'buff').heal, 30);
});
```

- [ ] **Étape 2 : lancer les tests et constater l'échec**

Run: `node --test test/engine.test.js`
Expected: FAIL au chargement : `shared/abilities.js` n'exporte pas `RARITIES`.

- [ ] **Étape 3 : passer les descriptions en gabarits**

Dans `shared/abilities.js`, remplacer la valeur de `desc` de ces 15 sorts (les autres ne changent pas) :

| Sort | Nouvelle valeur de `desc` |
| --- | --- |
| `trait` | `"Projectile rapide et fin, {dmg} dégâts."` |
| `lien` | `"Orbe lente qui enracine 1,4 s, {dmg} dégâts."` |
| `grappin` | `"Crochet qui attire la cible vers toi, {dmg} dégâts."` |
| `orbe` | `"Part puis revient en traversant tout, {dmg} dégâts par passage."` |
| `javelot` | `"Projectile fin : de {dmg} à {dmgMax} dégâts selon la distance, maximum dès {dmgMaxAt} unités."` |
| `eruption` | `"Zone qui explose après 0,7 s et ralentit de 35 %, {dmg} dégâts."` |
| `salve` | `"Quatre explosions en ligne vers le curseur, {dmg} dégâts chacune."` |
| `bouclier` | `"Bouclier qui absorbe {shield} dégâts pendant 3 s."` |
| `flux` | `"Marque la cible 4 s : ton prochain sort ou ta prochaine auto-attaque sur elle inflige +{markDmg} dégâts."` |
| `glace` | `"Grand projectile qui traverse l'arène et étourdit 1,5 s, {dmg} dégâts."` |
| `rayon` | `"Laser annoncé qui frappe toute la ligne après 0,9 s, {dmg} dégâts."` |
| `meteore` | `"Énorme zone qui s'écrase après 1,1 s, {dmg} dégâts."` |
| `barrage` | `"Onde très large et lente qui traverse l'arène et tous les joueurs, {dmg} dégâts."` |
| `soin` | `"Rend {heal} PV et donne +30 % de vitesse 1 s."` |
| `barriere` | `"Bouclier qui absorbe {shield} dégâts pendant 2,5 s."` |

- [ ] **Étape 4 : ajouter la rareté**

Dans `shared/abilities.js`, juste après la ligne `for (const id in ABILITIES) ABILITIES[id].id = id`, ajouter (indentation par tabulations, comme le reste du fichier) :

```js

// Raretés du mode histoire : pow multiplie dégâts, soins et boucliers, cd multiplie la recharge.
export const RARITIES = [
	{ id: "commun", name: "Commun", color: "#cbd5e1", pow: 1, cd: 1 },
	{ id: "rare", name: "Rare", color: "#60a5fa", pow: 1.25, cd: 0.9 },
	{ id: "epique", name: "Épique", color: "#c084fc", pow: 1.5, cd: 0.8 },
	{ id: "legendaire", name: "Légendaire", color: "#fbbf24", pow: 2, cd: 0.65 },
]
const POWER_FIELDS = ["dmg", "dmgMax", "markDmg", "shield", "heal"]
const scaledCache = new Map()

// Sort avec les chiffres de sa rareté. Niveau 0 : le sort d'origine. Le niveau est borné aux raretés connues.
export function scaled(id, level) {
	const base = ABILITIES[id]
	const lvl = Math.max(0, Math.min(RARITIES.length - 1, Math.floor(level) || 0))
	if (!base || !lvl) return base
	const key = id + ":" + lvl
	let ab = scaledCache.get(key)
	if (!ab) {
		const r = RARITIES[lvl]
		ab = { ...base, rarity: lvl, cd: Math.round(base.cd * r.cd * 10) / 10 }
		for (const f of POWER_FIELDS) if (base[f]) ab[f] = Math.round(base[f] * r.pow)
		scaledCache.set(key, ab)
	}
	return ab
}

// Description d'un sort avec ses chiffres réels (un sort amélioré affiche ses valeurs de rareté).
export function describe(ab) {
	return ab.desc.replace(/\{(\w+)\}/g, (_, k) => String(ab[k]))
}
```

Remplacer la fonction `abilityOf` par :

```js
// Sort placé sur une touche, avec la rareté du kit. Touche vide (mode histoire) : undefined.
export function abilityOf(p, slot) {
	const id = p.build && slot in p.build ? p.build[slot] : DEFAULT_BUILD[slot]
	return id ? scaled(id, p.rar ? p.rar[slot] : 0) : undefined
}
```

- [ ] **Étape 5 : brancher `describe` et le montant du soin**

Dans `public/js/main.js`, ajouter `describe` à l'import de `../../shared/abilities.js` :

```js
import { ABILITIES, ENV_SPELLS, spellName, abilityOf, poolFor, sanitizeBuild, BUILD_SLOTS, AUTO, describe } from '../../shared/abilities.js';
```

Dans `renderBuildModal`, remplacer :

```js
    desc.textContent = `${cur.desc} Recharge ${String(cur.cd).replace('.', ',')} s.`;
```

par :

```js
    desc.textContent = `${describe(cur)} Recharge ${String(cur.cd).replace('.', ',')} s.`;
```

Dans `openHelp`, remplacer :

```js
    row(kit, [keyLabel(settings.binds[slot])], `${ab.desc} Recharge ${String(ab.cd).replace('.', ',')} s.`, ab.name);
```

par :

```js
    row(kit, [keyLabel(settings.binds[slot])], `${describe(ab)} Recharge ${String(ab.cd).replace('.', ',')} s.`, ab.name);
```

Dans `handleEvents`, cas `'buff'`, remplacer :

```js
        if (p && ev.ab === 'soin') fx.number(p.x, p.y - 20, `+${ABILITIES.soin.heal}`, '#5ee08f');
```

par :

```js
        if (p && ev.heal) fx.number(p.x, p.y - 20, `+${ev.heal}`, '#5ee08f');
```

Dans `shared/match.js`, constructeur, remplacer :

```js
      onBuff: (p, ab, t) => this.emit({ e: 'buff', id: p.id, ab: ab.id, t }),
```

par :

```js
      onBuff: (p, ab, t) => this.emit({ e: 'buff', id: p.id, ab: ab.id, heal: ab.heal || 0, t }),
```

Dans `public/js/netgame.js`, constructeur, remplacer :

```js
      onBuff: (p, ab, t) => this.localFx.push({ e: 'buff', id: p.id, ab: ab.id, t, local: true }),
```

par :

```js
      onBuff: (p, ab, t) => this.localFx.push({ e: 'buff', id: p.id, ab: ab.id, heal: ab.heal || 0, t, local: true }),
```

Vérifier qu'aucun autre code ne lit `.desc` directement :

Run: `grep -rn "\.desc\b" public/js shared server`
Expected: une seule ligne, `ab.desc.replace(` dans `shared/abilities.js`.

- [ ] **Étape 6 : lancer les tests**

Run: `node --test test/engine.test.js`
Expected: PASS, 9 tests.

Run: `npm test`
Expected: tous les tests passent.

- [ ] **Étape 7 : commit**

```bash
git add shared/abilities.js shared/match.js public/js/netgame.js public/js/main.js test/engine.test.js
git commit -m "abilities: rarity scaling, empty slots, templated descriptions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3 : Équipes, rayons et points d'extension dans `match.js`

**Files:**
- Modify: `shared/match.js` (imports, `DEFAULTS`, constructeur, `botCommand`, `step`, `addSpell`, `updateSpells`, `updateHoming`, `updateLine`, `hit`, `pull`, `interrupt`, `kill`)
- Modify: `shared/sim.js` (nouvelle fonction `predictPos`)
- Modify: `shared/spawner.js` (`available`, `predict`)
- Test: `test/engine.test.js`

**Interfaces:**
- Consumes: unités avec `team`, `r`, `cc` (tâche 1).
- Produces:
  - `match.units` : tableau de toutes les unités (joueurs puis ennemis). `match.mobs` : `Map` des ennemis par id. `match.unit(id)` : joueur ou ennemi.
  - Un sort créé par `addSpell(spec)` porte `team` : `spec.team` s'il est fourni, sinon l'équipe du lanceur, sinon `null`. Un sort ne touche pas une unité de son équipe.
  - Champ de sort `cu` (annulable jusqu'à) : `interrupt` annule le sort tant que `t < cu`.
  - Points d'extension : `setup(o)`, `tick(t0, t1)`, `command(p, cmd, t)` (renvoie un booléen).
  - `predictPos(p, t, dt, k)` dans `sim.js` → `{ x, y }`.
  - Préréglage d'`EnvSpawner` : champ facultatif `only` (liste de clés de `ENV_SPELLS`).

- [ ] **Étape 1 : écrire les tests qui échouent**

**Ajouter à la fin de `test/engine.test.js` :**

```js

// ---------------------------------------------------------------- équipes et points d'extension

import { EnvSpawner } from '../shared/spawner.js';

function stepUntil(m, cond, max = 60 * 30) {
  for (let i = 0; i < max && !cond(); i++) m.step();
}

// Partie à trois joueurs ; defs complète la définition de chacun (équipe, rayon, cc).
function trio(defs = {}) {
  const players = ['a', 'b', 'c'].map((id, i) => ({ id, name: id, color: PLAYER_COLORS[i], ...(defs[id] || {}) }));
  const m = new Match({ kind: 'versus', players, settings: { roundsToWin: 3, env: 'off' }, seed: 1 });
  stepUntil(m, () => m.phase === 'playing');
  return m;
}

test('un projectile traverse les alliés et touche les ennemis', () => {
  const m = trio({ a: { team: 'P' }, b: { team: 'P' } });
  const a = m.players.get('a'), b = m.players.get('b'), c = m.players.get('c');
  a.x = 300; a.y = 500; b.x = 600; b.y = 500; c.x = 900; c.y = 500;
  m.queueInput('a', 1, m.time, { k: 'cast', slot: 'Q', x: 900, y: 500 });
  stepUntil(m, () => c.hp < 100, 120);
  assert.equal(b.hp, 100, 'l\'allié n\'est pas touché');
  assert.equal(c.hp, 82);
});

test('une zone ne touche pas l\'équipe de son lanceur', () => {
  const m = trio({ a: { team: 'P' }, b: { team: 'P' } });
  const a = m.players.get('a'), b = m.players.get('b'), c = m.players.get('c');
  a.x = 300; a.y = 500; b.x = 700; b.y = 500; c.x = 760; c.y = 500;
  m.queueInput('a', 1, m.time, { k: 'cast', slot: 'W', x: 730, y: 500 });
  stepUntil(m, () => c.hp < 100, 120);
  assert.equal(b.hp, 100);
  assert.equal(c.hp, 78);
});

test('les collisions utilisent le rayon de la cible', () => {
  const m = trio({ c: { r: 90 } });
  const a = m.players.get('a'), b = m.players.get('b'), c = m.players.get('c');
  a.x = 300; a.y = 500; b.x = 700; b.y = 600; c.x = 1000; c.y = 600;
  m.queueInput('a', 1, m.time, { k: 'cast', slot: 'Q', x: 1300, y: 500 });
  stepUntil(m, () => c.hp < 100, 120);
  assert.equal(b.hp, 100, 'cible normale hors d\'atteinte : 100 > 30 + 36');
  assert.equal(c.hp, 82, 'grosse cible touchée : 100 < 30 + 90');
});

test('cc réduit ou annule les contrôles', () => {
  const m = trio({ b: { cc: 0.5 }, c: { cc: 0 } });
  const b = m.players.get('b'), c = m.players.get('c');
  const t = m.time;
  m.hit({ id: 90, dmg: 5, stun: 2, root: 2, owner: 'a', team: 'a', def: 'q', kind: 'line' }, b, t, b.x, b.y);
  assert.ok(Math.abs(b.stunUntil - (t + 1)) < 1e-9);
  assert.ok(Math.abs(b.rootUntil - (t + 1)) < 1e-9);
  const cx = c.x;
  m.hit({ id: 91, dmg: 5, stun: 2, root: 2, pull: 300, ox: 0, oy: 0, slow: 0.3, slowDur: 1, owner: 'a', team: 'a', def: 'q', kind: 'line' }, c, t, c.x, c.y);
  assert.equal(c.hp, 95, 'les dégâts passent');
  assert.ok(!(c.stunUntil > t) && !(c.rootUntil > t) && !c.dash, 'aucun contrôle dur');
  assert.ok(c.slowUntil > t, 'le ralentissement s\'applique');
  assert.equal(c.x, cx);
  // Une attraction demande cc = 1.
  b.stunUntil = 0;
  m.hit({ id: 92, dmg: 0, pull: 300, ox: 0, oy: 0, owner: 'a', team: 'a', def: 'q', kind: 'line' }, b, t, b.x, b.y);
  assert.equal(b.dash, null);
});

test('un sort en préparation est annulé tant que son champ cu n\'est pas dépassé', () => {
  const m = trio();
  const a = m.players.get('a');
  const t = m.time;
  a.castUntil = t + 1;
  const s = m.addSpell({ kind: 'circle', def: 'test', owner: 'a', target: null, t0: t, tl: t, td: t + 1, cu: t + 1, x: 500, y: 500, r: 80, dmg: 10, fx: '' });
  assert.equal(s.team, 'a', 'le sort porte l\'équipe de son lanceur');
  assert.equal(m.addSpell({ kind: 'circle', def: 'test', owner: null, target: null, t0: t, tl: t, td: t + 9, x: 0, y: 0, r: 1, dmg: 0, fx: '' }).team, null);
  m.hit({ id: 93, dmg: 1, stun: 1, owner: 'b', team: 'b', def: 'q', kind: 'line' }, a, t + 0.5, a.x, a.y);
  assert.equal(m.spells.has(s.id), false);
  const end = m.events.find((e) => e.e === 'end' && e.id === s.id);
  assert.ok(Number.isFinite(end.x) && Number.isFinite(end.y));
});

test('une sous-classe branche sa logique sur setup, tick et command', () => {
  const log = [];
  class Custom extends Match {
    setup(o) { this.custom = o.custom; log.push('setup'); }
    startRound() { log.push('round:' + this.custom); super.startRound(); }
    tick() { if (!this.ticked) { this.ticked = true; log.push('tick'); } }
    command(p, cmd, t) {
      if (cmd.k === 'ping') { log.push('ping'); return true; }
      return super.command(p, cmd, t);
    }
  }
  const players = [{ id: 'a', name: 'A', color: '#fff' }, { id: 'b', name: 'B', color: '#fff' }];
  const m = new Custom({ kind: 'versus', custom: 7, players, settings: { env: 'off' }, seed: 1 });
  assert.deepEqual(log, ['setup', 'round:7']);
  assert.equal(m.unit('a'), m.players.get('a'));
  assert.equal(m.unit('zz'), undefined);
  assert.deepEqual(m.units.map((u) => u.id), ['a', 'b']);
  assert.equal(m.mobs.size, 0);
  stepUntil(m, () => m.phase === 'playing');
  m.queueInput('a', 1, m.time, { k: 'ping' });
  m.step();
  assert.equal(m.botCommand('a', { k: 'ping' }), true);
  assert.equal(m.botCommand('a', { k: 'move', x: 100, y: 100 }), true);
  assert.deepEqual(log, ['setup', 'round:7', 'tick', 'ping', 'ping']);
});

test('un préréglage de piège limite les sorts de l\'arène à sa liste', () => {
  const m = trio();
  const sp = new EnvSpawner(m, { only: ['rayon'], r0: 5, rMax: 5, tau: 30, speed: 0, unlock: 0, first: 0 });
  for (let i = 0; i < 30; i++) {
    m.step();
    sp.update(m.time);
  }
  assert.deepEqual([...new Set([...m.spells.values()].map((s) => s.def))], ['rayon']);
});
```

- [ ] **Étape 2 : lancer les tests et constater l'échec**

Run: `node --test test/engine.test.js`
Expected: FAIL. « un projectile traverse les alliés » échoue (`b.hp` vaut 82), « une sous-classe branche sa logique » échoue (`log` ne contient pas `setup`).

- [ ] **Étape 3 : généraliser `shared/match.js`**

Remplacer l'import des constantes par (plus de `PLAYER_RADIUS as R`) :

```js
import {
  DT, COUNTDOWN, SURVIVAL_COUNTDOWN, ROUND_END_DELAY,
  SLOTS, SURVIVAL_SLOTS, MAX_INPUT_LEAD, arenaSize,
} from './constants.js';
```

Remplacer `DEFAULTS` par :

```js
const DEFAULTS = {
  survival: { difficulty: 'normal' },
  versus: { roundsToWin: 2, env: 'normal' },
  story: {},
};

// Un sort ne touche pas l'équipe de son lanceur. Sans équipe (sorts de l'arène), il touche tout le monde.
const friendly = (s, p) => s.team != null && s.team === p.team;
```

Dans le constructeur, remplacer :

```js
    this.players = new Map();
    this.order = [];
```

par :

```js
    this.players = new Map();
    this.order = [];
    this.units = [];        // toutes les unités : joueurs, puis ennemis du mode histoire
    this.mobs = new Map();  // ennemis du mode histoire
```

Toujours dans le constructeur, remplacer :

```js
      this.players.set(p.id, p);
      this.order.push(p.id);
```

par :

```js
      this.players.set(p.id, p);
      this.order.push(p.id);
      this.units.push(p);
```

Remplacer la fin du constructeur :

```js
    this.world = {
      get: (id) => this.players.get(id),
      onAttack: (p, tg, t) => this.onAttack(p, tg, t),
    };

    this.startRound();
  }
```

par :

```js
    this.world = {
      get: (id) => this.unit(id),
      onAttack: (p, tg, t) => this.onAttack(p, tg, t),
    };

    this.setup(o);
    this.startRound();
  }

  // ------------------------------------------------------------ points d'extension (mode histoire)

  // Appelé une fois, avant la première manche.
  setup() {}

  // Appelé à chaque pas de jeu, avant la mise à jour des sorts.
  tick() {}

  // Applique une commande de joueur ; une sous-classe peut ajouter les siennes.
  command(p, cmd, t) {
    return applyCommand(p, cmd, t, this.rules, this.hooks);
  }

  unit(id) {
    return this.players.get(id) || this.mobs.get(id);
  }
```

Dans `botCommand`, remplacer la ligne `return` par :

```js
    return p ? this.command(p, cmd, this.time) : false;
```

Dans `step`, remplacer :

```js
        applyCommand(p, inp.cmd, t1, rules, this.hooks);
```

par :

```js
        this.command(p, inp.cmd, t1);
```

remplacer :

```js
    for (const id of this.order) stepPlayer(this.players.get(id), t0, t1, rules, this.world);
```

par :

```js
    for (const u of this.units) stepPlayer(u, t0, t1, rules, this.world);
```

et remplacer :

```js
      if (this.spawner) this.spawner.update(t1);
      this.updateSpells(t0, t1);
```

par :

```js
      if (this.spawner) this.spawner.update(t1);
      this.tick(t0, t1);
      this.updateSpells(t0, t1);
```

Remplacer `addSpell` par :

```js
  addSpell(spec) {
    const owner = spec.owner ? this.unit(spec.owner) : null;
    const team = spec.team !== undefined ? spec.team : owner ? owner.team : null;
    const s = { ...spec, team, id: this.nextSpellId++, hit: new Set(), hitBack: new Set(), anyHit: false };
    this.spells.set(s.id, s);
    this.emit({ e: 'sp', s: packSpell(s) });
    return s;
  }
```

Remplacer `updateSpells` par :

```js
  updateSpells(t0, t1) {
    for (const s of this.spells.values()) {
      if (s.kind === 'homing') this.updateHoming(s, t0, t1);
      else if (s.kind === 'line') this.updateLine(s, t0, t1);
      else if (s.kind === 'circle') {
        if (t1 >= s.td) {
          for (const p of this.units) {
            if (!p.alive || friendly(s, p)) continue;
            if ((p.x - s.x) ** 2 + (p.y - s.y) ** 2 < (s.r + p.r) ** 2) this.hit(s, p, t1, p.x, p.y);
          }
          this.expireSpell(s);
        }
      } else {
        if (t1 >= s.ta) {
          for (const p of this.units) {
            if (!p.alive || friendly(s, p) || s.hit.has(p.id)) continue;
            let touched;
            if (s.kind === 'beam') {
              touched = segPointDist2(s.ax, s.ay, s.bx, s.by, p.x, p.y) < (s.hw + p.r) ** 2;
            } else {
              touched = Math.abs(Math.hypot(p.x - s.x, p.y - s.y) - s.r) < s.th / 2 + p.r;
            }
            if (touched) {
              s.hit.add(p.id);
              this.hit(s, p, t1, p.x, p.y);
            }
          }
        }
        if (t1 >= s.te) this.expireSpell(s);
      }
    }
  }
```

Dans `updateHoming`, remplacer :

```js
    const tg = this.players.get(s.tgt);
```

par :

```js
    const tg = this.unit(s.tgt);
```

et remplacer :

```js
    if (d <= step + R * 0.5) {
      this.hit(s, tg, t1, tg.x - (dx / (d || 1)) * R, tg.y - (dy / (d || 1)) * R);
```

par :

```js
    if (d <= step + tg.r * 0.5) {
      this.hit(s, tg, t1, tg.x - (dx / (d || 1)) * tg.r, tg.y - (dy / (d || 1)) * tg.r);
```

Dans `updateLine`, remplacer :

```js
      const rr = (s.radius + R) ** 2;
      for (const [a, b, ph] of segs) {
        const pa = linePos(s, a), pb = linePos(s, b);
        const hitSet = ph === 2 ? s.hitBack : s.hit;
        let best = null, bestK = 2;
        for (const id of this.order) {
          const p = this.players.get(id);
          if (!p.alive || p.id === s.owner || hitSet.has(p.id)) continue;
          if (segPointDist2(pa.x, pa.y, pb.x, pb.y, p.x, p.y) >= rr) continue;
```

par :

```js
      for (const [a, b, ph] of segs) {
        const pa = linePos(s, a), pb = linePos(s, b);
        const hitSet = ph === 2 ? s.hitBack : s.hit;
        let best = null, bestK = 2;
        for (const p of this.units) {
          if (!p.alive || friendly(s, p) || hitSet.has(p.id)) continue;
          if (segPointDist2(pa.x, pa.y, pb.x, pb.y, p.x, p.y) >= (s.radius + p.r) ** 2) continue;
```

Dans `hit`, remplacer le bloc des contrôles :

```js
      if (s.root) {
        p.rootUntil = Math.max(p.rootUntil, t + s.root);
        fx = 'root';
      }
      if (s.stun) {
        p.stunUntil = Math.max(p.stunUntil, t + s.stun);
        p.mv = false;
        this.interrupt(p, t);
        fx = 'stun';
      }
      if (s.pull) {
        this.pull(p, s, t);
        fx = 'pull';
      }
```

par :

```js
      // cc : multiplicateur des contrôles subis (0,5 pour une élite, 0 pour un boss).
      const cc = p.cc ?? 1;
      if (s.root && cc > 0) {
        p.rootUntil = Math.max(p.rootUntil, t + s.root * cc);
        fx = 'root';
      }
      if (s.stun && cc > 0) {
        p.stunUntil = Math.max(p.stunUntil, t + s.stun * cc);
        p.mv = false;
        this.interrupt(p, t);
        fx = 'stun';
      }
      if (s.pull && cc >= 1) {
        this.pull(p, s, t);
        fx = 'pull';
      }
```

Dans `pull`, remplacer les trois usages de `R` par `p.r` :

```js
    const pd = Math.min(s.pull, Math.max(0, d - p.r * 1.5));
    const b = boundsAt(this.rules, t);
    p.dash = {
      k: 'pull', fx: p.x, fy: p.y,
      tx: clamp(p.x + (dx / d) * pd, b.x0 + p.r, b.x1 - p.r),
      ty: clamp(p.y + (dy / d) * pd, b.y0 + p.r, b.y1 - p.r),
      ts: t, te: t + PULL_DURATION,
    };
```

Remplacer `interrupt` par :

```js
  // Un contrôle dur pendant l'incantation annule le sort.
  // cu (annulable jusqu'à) : pour les attaques d'ennemis dont la préparation dépasse le départ du sort.
  interrupt(p, t) {
    if (!(t < p.castUntil)) return;
    p.castUntil = t;
    for (const s of this.spells.values()) {
      if (s.owner === p.id && t < (s.cu ?? s.tl ?? s.t0)) {
        this.endSpell(s, t, s.ox ?? s.x ?? s.ax, s.oy ?? s.y ?? s.ay, 'cancel');
      }
    }
  }
```

Dans `kill`, remplacer `this.stats[p.id].deaths++;` par :

```js
    if (this.stats[p.id]) this.stats[p.id].deaths++;
```

Vérifier qu'il ne reste aucun `R` isolé :

Run: `grep -nw R shared/match.js`
Expected: aucune ligne.

- [ ] **Étape 4 : `predictPos` et pièges dans le générateur de l'arène**

Dans `shared/sim.js`, ajouter après `speedAt` :

```js
// Position estimée d'une unité dans dt secondes (k = part d'anticipation, 0 = position actuelle).
export function predictPos(p, t, dt, k) {
  if (!p.mv || p.dash || k <= 0) return { x: p.x, y: p.y };
  const dx = p.tx - p.x, dy = p.ty - p.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return { x: p.x, y: p.y };
  const travel = Math.min(d, speedAt(p, t) * dt * k);
  return { x: p.x + (dx / d) * travel, y: p.y + (dy / d) * travel };
}
```

Dans `shared/spawner.js`, remplacer l'import de `./sim.js` par :

```js
import { predictPos } from './sim.js';
```

remplacer la méthode `predict` par :

```js
  predict(p, t, dt, k) {
    return predictPos(p, t, dt, k);
  }
```

et remplacer la méthode `available` par :

```js
  available(t) {
    const e = this.elapsed(t);
    const out = [];
    for (const key in ENV_SPELLS) {
      if (this.p.only && !this.p.only.includes(key)) continue;   // piège du mode histoire : un seul type de sort
      const d = ENV_SPELLS[key];
      if (e >= d.unlock * this.p.unlock) out.push({ w: d.weight, v: key });
    }
    return out;
  }
```

- [ ] **Étape 5 : lancer les tests**

Run: `node --test test/engine.test.js`
Expected: PASS, 16 tests.

Run: `npm test`
Expected: tous les tests passent, y compris les parties complètes entre IA et le test de prédiction réseau.

- [ ] **Étape 6 : commit**

```bash
git add shared/match.js shared/sim.js shared/spawner.js test/engine.test.js
git commit -m "engine: team-based targeting, cc multiplier, subclass hooks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4 : Butin — kit de départ et tirage des coffres

**Files:**
- Create: `shared/story/loot.js`
- Test: `test/story.test.js` (nouveau)

**Interfaces:**
- Consumes: `ABILITIES` (`shared/abilities.js`), `pickWeighted` (`shared/util.js`), `createPlayer` avec `def.loadout` (tâche 1).
- Produces:
  - `STORY_TEAM = 'P'`, `STORY_COLORS` (3 couleurs), `SKIP_HEAL = 30`, `RARITY_WEIGHTS` (3 tables de 4 poids).
  - `startLoadout()` → `{ build, rar }` neuf.
  - `heroDef(def, i)` → `def` complété par `team`, `color`, `loadout`.
  - `rollRarity(rng, chapter, bossChest)` → niveau 0 à 3.
  - `slotFor(hero, id)` → touche de destination d'un sort (`'Q'`…`'F'`).
  - `drawOffer(rng, hero, chapter, bossChest)` → tableau de 0 à 3 cartes `{ ab, rar, slot }`.
  - `applyCard(hero, card)` : place le sort sur sa touche, recharge à zéro.

- [ ] **Étape 1 : écrire les tests qui échouent**

**Créer `test/story.test.js` :**

```js
// Tests du mode histoire : butin, salles, ennemis, boss, déroulement d'une run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ABILITIES } from '../shared/abilities.js';
import { createPlayer } from '../shared/sim.js';
import { mulberry32 } from '../shared/util.js';
import {
  startLoadout, heroDef, drawOffer, applyCard, slotFor, rollRarity, STORY_TEAM, STORY_COLORS, SKIP_HEAL,
} from '../shared/story/loot.js';

const EMPTY_KIT = { Q: 'trait', W: null, E: null, R: null, D: null, F: null };
const FULL_KIT = { W: 'eruption', E: 'bond', R: 'meteore', D: 'flash', F: 'soin' };

// Joueur du mode histoire, avec un kit de départ éventuellement complété.
function hero(build = {}, rar = {}) {
  const def = heroDef({ id: 'a', name: 'A' }, 0);
  Object.assign(def.loadout.build, build);
  Object.assign(def.loadout.rar, rar);
  return createPlayer(def, 0);
}

test('kit de départ : un seul sort sur Q, équipe et couleur d\'allié', () => {
  const h = hero();
  assert.deepEqual(h.build, EMPTY_KIT);
  assert.deepEqual(h.rar, { Q: 0, W: 0, E: 0, R: 0, D: 0, F: 0 });
  assert.equal(h.team, STORY_TEAM);
  assert.equal(h.color, STORY_COLORS[0]);
  assert.equal(heroDef({ id: 'c', name: 'C' }, 2).color, STORY_COLORS[2]);
  assert.notEqual(startLoadout().build, startLoadout().build, 'un kit neuf par joueur');
  assert.equal(SKIP_HEAL, 30);
});

test('un coffre propose 3 sorts sur 3 touches différentes, surtout des touches vides', () => {
  const rng = mulberry32(42);
  let empty = 0, total = 0;
  for (let i = 0; i < 200; i++) {
    const cards = drawOffer(rng, hero(), 0);
    assert.equal(cards.length, 3);
    assert.equal(new Set(cards.map((c) => c.slot)).size, 3);
    assert.equal(new Set(cards.map((c) => c.ab)).size, 3);
    for (const c of cards) {
      assert.ok(ABILITIES[c.ab], c.ab);
      assert.ok(c.rar >= 0 && c.rar <= 2, 'pas de légendaire au chapitre 1');
      total++;
      if (c.slot !== 'Q') empty++;
    }
  }
  assert.ok(empty / total > 0.85, `touches vides : ${empty}/${total}`);
});

test('un coffre ne propose jamais moins bien que le kit', () => {
  const rng = mulberry32(7);
  const h = hero(FULL_KIT, { Q: 1, W: 2, E: 1, R: 3, D: 1, F: 2 });
  for (let i = 0; i < 300; i++) {
    for (const c of drawOffer(rng, h, 2)) {
      assert.ok(c.rar >= h.rar[c.slot], `${c.ab} ${c.rar} sur ${c.slot}`);
      if (c.ab === h.build[c.slot]) assert.ok(c.rar > h.rar[c.slot], 'même sort : seulement en amélioration');
      if (ABILITIES[c.ab].slot !== 'S') assert.equal(c.slot, ABILITIES[c.ab].slot);
      else if (c.ab === 'flash') assert.equal(c.slot, 'D', 'un sort d\'invocateur possédé garde sa touche');
      else if (c.ab === 'soin') assert.equal(c.slot, 'F');
      else assert.equal(c.slot, 'D', 'sinon la touche la moins rare');
    }
  }
});

test('coffre de boss : au moins du Rare, table du chapitre suivant', () => {
  const rng = mulberry32(3);
  let legendary = 0;
  for (let i = 0; i < 400; i++) {
    const r = rollRarity(rng, 0, true);
    assert.ok(r >= 1);
    if (r === 3) legendary++;
  }
  assert.ok(legendary > 0, 'la table du chapitre 2 permet le légendaire');
  for (let i = 0; i < 400; i++) assert.ok(rollRarity(rng, 0, false) <= 2);
  for (let i = 0; i < 50; i++) assert.ok(rollRarity(rng, 2, true) >= 1, 'pas de table après le chapitre 3');
});

test('tout au maximum : le coffre propose moins de 3 cartes', () => {
  const h = hero(FULL_KIT, { Q: 3, W: 3, E: 3, R: 3, D: 3, F: 3 });
  assert.deepEqual(drawOffer(mulberry32(1), h, 0), []);
});

test('même graine, même tirage', () => {
  assert.deepEqual(drawOffer(mulberry32(5), hero(), 1), drawOffer(mulberry32(5), hero(), 1));
});

test('prendre une carte place le sort sur sa touche, prêt à être lancé', () => {
  const h = hero();
  h.cds.W = 99;
  applyCard(h, { ab: 'salve', rar: 2, slot: 'W' });
  assert.equal(h.build.W, 'salve');
  assert.equal(h.rar.W, 2);
  assert.equal(h.cds.W, 0);
  assert.equal(slotFor(h, 'flash'), 'D', 'D d\'abord');
  applyCard(h, { ab: 'flash', rar: 0, slot: 'D' });
  assert.equal(slotFor(h, 'purge'), 'F', 'puis la touche vide restante');
  assert.equal(slotFor(h, 'flash'), 'D');
});
```

- [ ] **Étape 2 : lancer les tests et constater l'échec**

Run: `node --test test/story.test.js`
Expected: FAIL au chargement : module `shared/story/loot.js` introuvable.

- [ ] **Étape 3 : écrire l'implémentation**

**Créer `shared/story/loot.js` :**

```js
// Butin du mode histoire : kit de départ, raretés des coffres, tirage des cartes.

import { ABILITIES } from '../abilities.js';
import { pickWeighted } from '../util.js';

export const STORY_TEAM = 'P';
export const STORY_COLORS = ['#38bdf8', '#4ade80', '#f1f5f9'];
export const SKIP_HEAL = 30;   // PV rendus quand on passe un coffre

// Chances (en %) de chaque rareté, du Commun au Légendaire, par chapitre.
export const RARITY_WEIGHTS = [
  [70, 25, 5, 0],
  [45, 35, 17, 3],
  [25, 38, 27, 10],
];

export function startLoadout() {
  return {
    build: { Q: 'trait', W: null, E: null, R: null, D: null, F: null },
    rar: { Q: 0, W: 0, E: 0, R: 0, D: 0, F: 0 },
  };
}

// Définition d'un joueur du mode histoire : équipe commune, couleur d'allié, kit de départ.
export function heroDef(def, i) {
  return { ...def, team: STORY_TEAM, color: STORY_COLORS[i % STORY_COLORS.length], loadout: startLoadout() };
}

// Rareté d'une carte. Coffre de boss : table du chapitre suivant, au moins Rare.
export function rollRarity(rng, chapter, bossChest = false) {
  const table = RARITY_WEIGHTS[Math.min(RARITY_WEIGHTS.length - 1, chapter + (bossChest ? 1 : 0))];
  const lvl = pickWeighted(rng, table.map((w, v) => ({ w, v })));
  return bossChest ? Math.max(1, lvl) : lvl;
}

// Touche sur laquelle irait un sort pour ce joueur.
// Sort d'invocateur : sa touche s'il est déjà possédé, sinon la touche vide (D d'abord), sinon la moins rare.
export function slotFor(hero, id) {
  const cat = ABILITIES[id].slot;
  if (cat !== 'S') return cat;
  const b = hero.build, r = hero.rar;
  if (b.D === id) return 'D';
  if (b.F === id) return 'F';
  if (!b.D) return 'D';
  if (!b.F) return 'F';
  return r.F < r.D ? 'F' : 'D';
}

// Tire jusqu'à 3 cartes { ab, rar, slot } pour un joueur. chapter : 0 à 2.
export function drawOffer(rng, hero, chapter, bossChest = false) {
  let pool = [];
  for (const id in ABILITIES) {
    const slot = slotFor(hero, id);
    const rar = rollRarity(rng, chapter, bossChest);
    const cur = hero.build[slot];
    // Jamais moins bien que le kit : ni rareté inférieure, ni le même sort à rareté égale.
    if (cur && (rar < hero.rar[slot] || (cur === id && rar === hero.rar[slot]))) continue;
    pool.push({ w: cur ? 1 : 4, v: { ab: id, rar, slot } });
  }
  const cards = [];
  while (cards.length < 3 && pool.length) {
    // Trois touches différentes tant que c'est possible.
    const used = new Set(cards.map((c) => c.slot));
    const fresh = pool.filter((c) => !used.has(c.v.slot));
    const card = pickWeighted(rng, fresh.length ? fresh : pool);
    cards.push(card);
    pool = pool.filter((c) => c.v.ab !== card.ab);
  }
  return cards;
}

export function applyCard(hero, card) {
  hero.build[card.slot] = card.ab;
  hero.rar[card.slot] = card.rar;
  hero.cds[card.slot] = 0;
}
```

- [ ] **Étape 4 : lancer les tests**

Run: `node --test test/story.test.js`
Expected: PASS, 7 tests.

- [ ] **Étape 5 : commit**

```bash
git add shared/story/loot.js test/story.test.js
git commit -m "story: starting kit and chest draws with rarity" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5 : Définitions des ennemis et des boss

**Files:**
- Create: `shared/story/mobs.js` (données ; l'IA arrive à la tâche 9)
- Create: `shared/story/bosses.js` (données ; les attaques arrivent aux tâches 16 à 18)
- Test: `test/story.test.js`

**Interfaces:**
- Consumes: `createPlayer` (tâche 1).
- Produces:
  - `MOB_TEAM = 'M'`, `MOBS` (clés `rodeur`, `tireur`, `bombe`, `pyro`, `belier`, `sentinelle` ; champs `name, color, hp, spd, r, cost, dmg, cd`), `CHAPTER_HP`, `CHAPTER_DMG`, `ELITE`.
  - `mobDef(id, type, { chapter, elite, heroes })` → définition d'unité avec en plus `dmg` (dégâts de l'attaque) et `atkCd` (recharge de l'attaque).
  - `BOSSES` (clés `gardien`, `forgeronne`, `archonte` ; champs `name, color, hp, spd, r`).
  - `bossDef(id, key, heroes)` → définition d'unité avec `boss: true`, `cc: 0`.

- [ ] **Étape 1 : écrire les tests qui échouent**

**Ajouter à la fin de `test/story.test.js` :**

```js

// ---------------------------------------------------------------- ennemis et boss : définitions

import { MOBS, mobDef, MOB_TEAM, ELITE } from '../shared/story/mobs.js';
import { BOSSES, bossDef } from '../shared/story/bosses.js';

test('définition d\'un ennemi : chapitre, élite et nombre de joueurs', () => {
  const base = mobDef('m1', 'rodeur');
  assert.deepEqual(
    { team: base.team, mob: base.mob, maxHp: base.maxHp, spd: base.spd, r: base.r, cc: base.cc, dmg: base.dmg, elite: base.elite, name: base.name },
    { team: MOB_TEAM, mob: 'rodeur', maxHp: 34, spd: 255, r: 28, cc: 1, dmg: 10, elite: false, name: 'Rôdeur' },
  );
  assert.equal(mobDef('m2', 'rodeur', { chapter: 2 }).maxHp, 71);
  assert.equal(mobDef('m2', 'tireur', { chapter: 2 }).dmg, 13);
  const elite = mobDef('m3', 'belier', { chapter: 1, elite: true });
  assert.equal(elite.maxHp, 225);
  assert.equal(elite.r, 45);
  assert.equal(elite.cc, 0.5);
  assert.equal(elite.name, 'Bélier d\'élite');
  assert.ok(Math.abs(elite.atkCd - 4.5 * ELITE.cd) < 1e-9);
  assert.equal(mobDef('m4', 'rodeur', { heroes: 3 }).maxHp, 82);
  const u = createPlayer(elite, 0);
  assert.equal(u.hp, 225);
  assert.equal(u.elite, true);
  assert.equal(u.mob, 'belier');
  assert.deepEqual(Object.keys(MOBS), ['rodeur', 'tireur', 'bombe', 'pyro', 'belier', 'sentinelle']);
});

test('définition d\'un boss : insensible aux contrôles, PV selon le nombre de joueurs', () => {
  const b = bossDef('m9', 'gardien');
  assert.equal(b.maxHp, 620);
  assert.equal(b.cc, 0);
  assert.equal(b.boss, true);
  assert.equal(b.mob, 'gardien');
  assert.equal(b.team, MOB_TEAM);
  assert.equal(bossDef('m9', 'archonte', 3).maxHp, 2600);
  assert.deepEqual(Object.keys(BOSSES), ['gardien', 'forgeronne', 'archonte']);
  assert.equal(createPlayer(b, 0).boss, true);
});
```

- [ ] **Étape 2 : lancer les tests et constater l'échec**

Run: `node --test test/story.test.js`
Expected: FAIL au chargement : module `shared/story/mobs.js` introuvable.

- [ ] **Étape 3 : écrire l'implémentation**

**Créer `shared/story/mobs.js` :**

```js
// Ennemis du mode histoire : caractéristiques et IA.

export const MOB_TEAM = 'M';

// Valeurs au chapitre 1. cost : poids dans le budget d'une vague. dmg et cd : attaque de l'ennemi.
export const MOBS = {
  rodeur: { name: 'Rôdeur', color: '#f97316', hp: 34, spd: 255, r: 28, cost: 2, dmg: 10, cd: 1.5 },
  tireur: { name: 'Tireur', color: '#ef4444', hp: 26, spd: 215, r: 26, cost: 2, dmg: 9, cd: 2.4 },
  bombe: { name: 'Bombe', color: '#facc15', hp: 16, spd: 315, r: 22, cost: 1.5, dmg: 20, cd: 0 },
  pyro: { name: 'Pyromancien', color: '#fb7185', hp: 30, spd: 200, r: 28, cost: 3, dmg: 14, cd: 3.2 },
  belier: { name: 'Bélier', color: '#b45309', hp: 60, spd: 225, r: 36, cost: 4, dmg: 16, cd: 4.5 },
  sentinelle: { name: 'Sentinelle', color: '#e879f9', hp: 55, spd: 0, r: 34, cost: 4, dmg: 9, cd: 3 },
};

export const CHAPTER_HP = [1, 1.5, 2.1];
export const CHAPTER_DMG = [1, 1.2, 1.45];
export const ELITE = { hp: 2.5, r: 1.25, cd: 0.75, cc: 0.5, cost: 2.5 };
export const COOP_HP = 0.7;   // PV en plus par joueur supplémentaire

// Définition d'unité (pour createPlayer) d'un ennemi. chapter : 0 à 2, heroes : joueurs présents.
export function mobDef(id, type, { chapter = 0, elite = false, heroes = 1 } = {}) {
  const m = MOBS[type];
  return {
    id, name: elite ? `${m.name} d'élite` : m.name, color: m.color, team: MOB_TEAM, mob: type, elite,
    maxHp: Math.round(m.hp * CHAPTER_HP[chapter] * (1 + COOP_HP * (heroes - 1)) * (elite ? ELITE.hp : 1)),
    spd: m.spd, r: Math.round(m.r * (elite ? ELITE.r : 1)), cc: elite ? ELITE.cc : 1,
    dmg: Math.round(m.dmg * CHAPTER_DMG[chapter]), atkCd: m.cd * (elite ? ELITE.cd : 1),
  };
}
```

**Créer `shared/story/bosses.js` :**

```js
// Boss du mode histoire : caractéristiques, moteur d'attaques et kits.

import { MOB_TEAM } from './mobs.js';

export const BOSSES = {
  gardien: { name: 'Le Gardien de pierre', color: '#d4a373', hp: 620, spd: 150, r: 80 },
  forgeronne: { name: 'La Forgeronne des braises', color: '#fb923c', hp: 780, spd: 230, r: 64 },
  archonte: { name: 'L\'Archonte du Vide', color: '#d946ef', hp: 1000, spd: 0, r: 72 },
};

export const COOP_BOSS_HP = 0.8;   // PV en plus par joueur supplémentaire

// Définition d'unité d'un boss : insensible aux étourdissements, enracinements et attractions (cc = 0).
export function bossDef(id, key, heroes = 1) {
  const b = BOSSES[key];
  return {
    id, name: b.name, color: b.color, team: MOB_TEAM, mob: key, boss: true,
    maxHp: Math.round(b.hp * (1 + COOP_BOSS_HP * (heroes - 1))), spd: b.spd, r: b.r, cc: 0,
  };
}
```

- [ ] **Étape 4 : lancer les tests**

Run: `node --test test/story.test.js`
Expected: PASS, 9 tests.

- [ ] **Étape 5 : commit**

```bash
git add shared/story/mobs.js shared/story/bosses.js test/story.test.js
git commit -m "story: enemy and boss definitions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6 : Génération des salles

**Files:**
- Create: `shared/story/rooms.js`
- Test: `test/story.test.js`

**Interfaces:**
- Consumes: `MOBS`, `ELITE` (tâche 5), `mulberry32` (`shared/util.js`).
- Produces:
  - `CHAPTERS` : 3 objets `{ id, name, boss, mobs, budget, traps, trapRooms }`.
  - `ROOM_SIZES`, `BOSS_SIZE`, `DECORS`, `TRAPS` (préréglages d'`EnvSpawner` avec `only`), `ROOMS_PER_CHAPTER = 5`, `MAX_ALIVE = 10`, `SPAWN_WARN = 0.9`, `DOOR_W = 240`, `DOOR_D = 110`.
  - `generateRun(seed)` → tableau de 15 salles `{ index, chapter, n, type, w, h, decor, entry, exit, trap, waves, boss }`. `waves` : tableau de vagues, chacune un tableau de `{ type, elite }`. `type` vaut `'combat'` ou `'boss'`.
  - `doorZone(room, side)` → `{ x0, y0, x1, y1 }`. `side` vaut `'E'`, `'W'`, `'N'` ou `'S'`.
  - `entryPoints(room, n)` → `n` points `{ x, y, ang }` devant la porte d'entrée.

- [ ] **Étape 1 : écrire les tests qui échouent**

**Ajouter à la fin de `test/story.test.js` :**

```js

// ---------------------------------------------------------------- salles

import {
  generateRun, CHAPTERS, ROOM_SIZES, BOSS_SIZE, TRAPS, MAX_ALIVE, doorZone, entryPoints,
} from '../shared/story/rooms.js';

test('la même graine donne la même run, une autre graine une autre run', () => {
  assert.deepEqual(generateRun(12), generateRun(12));
  assert.notDeepEqual(generateRun(12), generateRun(13));
});

test('une run : 3 chapitres de 5 salles, chacun terminé par son boss', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const rooms = generateRun(seed);
    assert.equal(rooms.length, 15);
    rooms.forEach((r, i) => {
      const c = CHAPTERS[r.chapter];
      assert.equal(r.index, i);
      assert.equal(r.chapter, Math.floor(i / 5));
      assert.equal(r.n, (i % 5) + 1);
      if (r.n === 5) {
        assert.equal(r.type, 'boss');
        assert.equal(r.boss, c.boss);
        assert.deepEqual({ w: r.w, h: r.h }, BOSS_SIZE);
        assert.equal(r.trap, null);
        assert.deepEqual(r.waves, []);
      } else {
        assert.equal(r.type, 'combat');
        assert.equal(r.boss, null);
        assert.ok(ROOM_SIZES.some((s) => s.w === r.w && s.h === r.h));
        assert.equal(r.waves.length, [1, 2, 2, 3][r.n - 1]);
        for (const wave of r.waves) {
          assert.ok(wave.length >= 1 && wave.length <= MAX_ALIVE);
          for (const m of wave) assert.ok(c.mobs.includes(m.type), `${m.type} au chapitre ${r.chapter + 1}`);
        }
        const elites = r.waves.flat().filter((m) => m.elite);
        assert.ok(elites.length <= 1);
        if (elites.length) {
          assert.ok(r.chapter >= 1 && r.n >= 3, 'élites à partir du chapitre 2, salles 3 et 4');
          assert.ok(r.waves[r.waves.length - 1].includes(elites[0]), 'dans la dernière vague');
        }
      }
      assert.ok(['E', 'N', 'S'].includes(r.exit));
      assert.notEqual(r.exit, r.entry);
      assert.equal(r.entry, i === 0 ? 'W' : { E: 'W', N: 'S', S: 'N' }[rooms[i - 1].exit]);
      if (r.trap) assert.ok(c.traps.includes(r.trap) && TRAPS[r.trap]);
    });
    for (let ch = 0; ch < 3; ch++) {
      const trapped = rooms.filter((r) => r.chapter === ch && r.trap);
      assert.equal(trapped.length, CHAPTERS[ch].trapRooms);
      assert.ok(trapped.every((r) => r.n >= 2 && r.n <= 4), 'jamais la première salle ni celle du boss');
    }
  }
});

test('tailles, portes et décors varient d\'une run à l\'autre', () => {
  const sizes = new Set(), exits = new Set(), decors = new Set(), elites = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    for (const r of generateRun(seed)) {
      if (r.type === 'combat') sizes.add(`${r.w}x${r.h}`);
      exits.add(r.exit);
      decors.add(r.decor);
      if (r.waves.flat().some((m) => m.elite)) elites.add(r.chapter);
    }
  }
  assert.equal(sizes.size, ROOM_SIZES.length);
  assert.equal(exits.size, 3);
  assert.equal(decors.size, 3);
  assert.deepEqual([...elites].sort(), [1, 2]);
});

test('porte et points d\'entrée', () => {
  const room = { w: 1600, h: 900, entry: 'W', exit: 'E' };
  assert.deepEqual(doorZone(room, 'E'), { x0: 1490, y0: 330, x1: 1600, y1: 570 });
  assert.deepEqual(doorZone(room, 'W'), { x0: 0, y0: 330, x1: 110, y1: 570 });
  assert.deepEqual(doorZone(room, 'N'), { x0: 680, y0: 0, x1: 920, y1: 110 });
  assert.deepEqual(doorZone(room, 'S'), { x0: 680, y0: 790, x1: 920, y1: 900 });
  const pts = entryPoints(room, 3);
  assert.deepEqual(pts.map((p) => [p.x, p.y, p.ang]), [[175, 360, 0], [175, 450, 0], [175, 540, 0]]);
  const south = entryPoints({ ...room, entry: 'S' }, 1)[0];
  assert.deepEqual([south.x, south.y], [800, 725]);
  assert.ok(Math.abs(south.ang + Math.PI / 2) < 1e-9, 'tourné vers l\'intérieur de la salle');
});
```

- [ ] **Étape 2 : lancer les tests et constater l'échec**

Run: `node --test test/story.test.js`
Expected: FAIL au chargement : module `shared/story/rooms.js` introuvable.

- [ ] **Étape 3 : écrire l'implémentation**

**Créer `shared/story/rooms.js` :**

```js
// Salles du mode histoire : chapitres, tailles, pièges, génération d'une run, géométrie des portes.

import { mulberry32 } from '../util.js';
import { MOBS, ELITE } from './mobs.js';

export const ROOMS_PER_CHAPTER = 5;   // 4 salles de combat puis le boss
export const MAX_ALIVE = 10;          // ennemis vivants à la fois
export const SPAWN_WARN = 0.9;        // durée du cercle d'annonce avant une apparition (s)
export const DOOR_W = 240;            // largeur de la porte le long du mur
export const DOOR_D = 110;            // profondeur de la zone de porte

export const ROOM_SIZES = [
  { w: 1400, h: 800 }, { w: 1600, h: 900 }, { w: 1900, h: 1000 }, { w: 1250, h: 1000 }, { w: 2200, h: 900 },
];
export const BOSS_SIZE = { w: 1900, h: 1000 };
export const DECORS = ['cercles', 'dalles', 'runes'];

// budget : budget d'une vague en salle 1. trapRooms : nombre de salles piégées du chapitre.
export const CHAPTERS = [
  { id: 'catacombes', name: 'Les Catacombes', boss: 'gardien', mobs: ['rodeur', 'tireur', 'bombe'], budget: 5, traps: ['fleches'], trapRooms: 1 },
  { id: 'forge', name: 'La Forge', boss: 'forgeronne', mobs: ['rodeur', 'tireur', 'bombe', 'pyro', 'belier'], budget: 8, traps: ['fleches', 'eruptions'], trapRooms: 2 },
  { id: 'sanctuaire', name: 'Le Sanctuaire du Vide', boss: 'archonte', mobs: ['rodeur', 'tireur', 'bombe', 'pyro', 'belier', 'sentinelle'], budget: 11, traps: ['fleches', 'eruptions', 'lasers'], trapRooms: 2 },
];

// Pièges : préréglages d'EnvSpawner limités à un sort de l'arène, à faible cadence.
export const TRAPS = {
  fleches: { only: ['trait'], r0: 0.4, rMax: 0.6, tau: 30, speed: 0, unlock: 0, first: 1.5 },
  eruptions: { only: ['eruption'], r0: 0.35, rMax: 0.5, tau: 30, speed: 0, unlock: 0, first: 1.5 },
  lasers: { only: ['rayon'], r0: 0.25, rMax: 0.4, tau: 30, speed: 0, unlock: 0, first: 2 },
};

const WAVES = [1, 2, 2, 3];   // nombre de vagues des salles 1 à 4
const OPPOSITE = { E: 'W', W: 'E', N: 'S', S: 'N' };
const INWARD = { E: [-1, 0], W: [1, 0], N: [0, 1], S: [0, -1] };

const pick = (rng, list) => list[Math.floor(rng() * list.length)];

// Une vague : des ennemis du chapitre tirés jusqu'à épuisement du budget.
function makeWave(rng, ch, n, elite) {
  const c = CHAPTERS[ch];
  let budget = c.budget + 1.5 * (n - 1);
  const wave = [];
  if (elite) {
    const type = pick(rng, c.mobs.filter((t) => t !== 'bombe'));
    wave.push({ type, elite: true });
    budget -= MOBS[type].cost * ELITE.cost;
  }
  while (wave.length < MAX_ALIVE) {
    const fits = c.mobs.filter((t) => MOBS[t].cost <= budget);
    if (!fits.length) break;
    const type = pick(rng, fits);
    wave.push({ type, elite: false });
    budget -= MOBS[type].cost;
  }
  return wave;
}

// Les 15 salles d'une run. La même graine donne la même run.
export function generateRun(seed) {
  const rng = mulberry32((seed ^ 0x5bd1e995) >>> 0);
  const rooms = [];
  let entry = 'W';
  for (let ch = 0; ch < CHAPTERS.length; ch++) {
    const c = CHAPTERS[ch];
    const trapped = new Set();   // salles piégées : jamais la première ni celle du boss
    while (trapped.size < c.trapRooms) trapped.add(2 + Math.floor(rng() * 3));
    for (let n = 1; n <= ROOMS_PER_CHAPTER; n++) {
      const boss = n === ROOMS_PER_CHAPTER;
      const size = boss ? BOSS_SIZE : pick(rng, ROOM_SIZES);
      const exit = pick(rng, ['E', 'N', 'S'].filter((s) => s !== entry));
      const waves = [];
      if (!boss) {
        const elite = ch > 0 && n >= 3 && rng() < 0.5;
        for (let i = 0; i < WAVES[n - 1]; i++) waves.push(makeWave(rng, ch, n, elite && i === WAVES[n - 1] - 1));
      }
      rooms.push({
        index: rooms.length, chapter: ch, n, type: boss ? 'boss' : 'combat', w: size.w, h: size.h,
        decor: pick(rng, DECORS), entry, exit,
        trap: !boss && trapped.has(n) ? pick(rng, c.traps) : null,
        waves, boss: boss ? c.boss : null,
      });
      entry = OPPOSITE[exit];
    }
  }
  return rooms;
}

// Zone rectangulaire de la porte, au milieu du mur du côté donné.
export function doorZone(room, side) {
  const { w, h } = room;
  if (side === 'E') return { x0: w - DOOR_D, y0: h / 2 - DOOR_W / 2, x1: w, y1: h / 2 + DOOR_W / 2 };
  if (side === 'W') return { x0: 0, y0: h / 2 - DOOR_W / 2, x1: DOOR_D, y1: h / 2 + DOOR_W / 2 };
  if (side === 'N') return { x0: w / 2 - DOOR_W / 2, y0: 0, x1: w / 2 + DOOR_W / 2, y1: DOOR_D };
  return { x0: w / 2 - DOOR_W / 2, y0: h - DOOR_D, x1: w / 2 + DOOR_W / 2, y1: h };
}

// Points d'apparition de n joueurs, devant la porte d'entrée et tournés vers la salle.
export function entryPoints(room, n) {
  const z = doorZone(room, room.entry);
  const [ix, iy] = INWARD[room.entry];
  const cx = (z.x0 + z.x1) / 2 + ix * 120, cy = (z.y0 + z.y1) / 2 + iy * 120;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 90;   // côte à côte, le long du mur
    pts.push({ x: cx + Math.abs(iy) * off, y: cy + Math.abs(ix) * off, ang: Math.atan2(iy, ix) });
  }
  return pts;
}
```

- [ ] **Étape 4 : lancer les tests**

Run: `node --test test/story.test.js`
Expected: PASS, 13 tests.

- [ ] **Étape 5 : commit**

```bash
git add shared/story/rooms.js test/story.test.js
git commit -m "story: seeded run generation, rooms, doors" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7 : `StoryMatch` — salles, vagues, porte, fin de run

**Files:**
- Create: `shared/story/match.js`
- Test: `test/story.test.js`

**Interfaces:**
- Consumes: `Match` et ses points d'extension (tâche 3), `heroDef` (tâche 4), `mobDef`, `bossDef`, `MOBS`, `ELITE`, `BOSSES`, `MOB_TEAM` (tâche 5), `generateRun`, `TRAPS`, `doorZone`, `entryPoints`, `ROOMS_PER_CHAPTER`, `SPAWN_WARN` (tâche 6), `EnvSpawner` avec `only` (tâche 3).
- Produces:
  - `new StoryMatch({ players: [{ id, name }], time, seed })`. Champs : `heroDefs`, `rooms`, `room`, `mobs`, `brains` (`Map` id → IA), `pending`, `cleared`, `result`.
  - `room` : `{ def, wave, cleared, heroes, chest, offers, exit, exitSince, inExit, exitOf }`. `chest` vaut `null` puis `{ x, y, boss }`. `offers` : `Map` id de joueur → `{ cards, done }` (remplie à la tâche 8).
  - Méthodes : `heroes()`, `enterRoom(i)`, `announce({ type, elite } | { boss }, at)`, `addMob({ type, elite, x, y } | { boss, x, y }, t)` → unité, `cancelEnemySpells(t)`, `finishStory(win, t)`.
  - Constantes : `INTRO_DELAY = 5`, `CHAPTER_DELAY = 4`, `BOSS_DELAY = 3.5`, `ROOM_DELAY = 1.5`, `EXIT_WAIT = 12`, `REVIVE_HP = 0.5`.
  - Événements : `room { t, rules, i, ch, n, of, type, decor, entry, exit, door, trap, boss }`, `warn { x, y, r, at, t }`, `spawn { u, x, y, t }`, `clear { i, chest, t }`, `heal { id, amt, t }`, `revive { id, hp, t }`, `exit { n, of, until, t }`, `storyEnd { win, ch, n, cleared, time, stats, kits, t }`.

- [ ] **Étape 1 : écrire les tests qui échouent**

**Ajouter à la fin de `test/story.test.js` :**

```js

// ---------------------------------------------------------------- déroulement d'une run

import { StoryMatch, INTRO_DELAY, ROOM_DELAY, EXIT_WAIT } from '../shared/story/match.js';

const LETHAL = { id: 999, dmg: 100000, owner: null, team: 'M', def: 'test', kind: 'line' };

function stepUntil(m, cond, max = 60 * 60) {
  for (let i = 0; i < max && !cond(); i++) m.step();
}

const solo = (seed = 1) => new StoryMatch({ players: [{ id: 'a', name: 'A' }], seed });
const duo = (seed = 1) => new StoryMatch({ players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], seed });

// Tue les ennemis vague après vague jusqu'à ce que la salle soit vidée.
function clearRoom(m) {
  stepUntil(m, () => {
    for (const u of m.mobs.values()) if (u.alive) m.kill(u, null, m.time);
    return m.room.cleared || m.over;
  });
}

// Place un joueur au milieu de la porte de sortie.
function toExit(m, id) {
  const p = m.players.get(id), z = m.room.exit;
  p.x = (z.x0 + z.x1) / 2; p.y = (z.y0 + z.y1) / 2; p.tx = p.x; p.ty = p.y; p.mv = false;
}

// Vide la salle puis fait franchir la porte à tous les joueurs vivants.
function nextRoom(m) {
  clearRoom(m);
  const i = m.room.def.index;
  for (const id of m.order) if (m.players.get(id).alive) toExit(m, id);
  stepUntil(m, () => m.over || m.room.def.index !== i, 10);
}

test('première salle : décompte, annonce puis apparition de la première vague', () => {
  const m = solo(1);
  const def = m.rooms[0];
  const ev = m.events.find((e) => e.e === 'room');
  assert.equal(ev.i, 0);
  assert.equal(ev.of, 5);
  assert.equal(ev.rules.w, def.w);
  assert.equal(ev.rules.playAt, INTRO_DELAY);
  assert.deepEqual(ev.door, m.room.exit);
  assert.equal(m.rules.w, def.w);
  assert.equal(m.rules.h, def.h);
  assert.equal(m.events.filter((e) => e.e === 'warn').length, def.waves[0].length);
  assert.equal(m.mobs.size, 0);
  const h = m.players.get('a');
  assert.ok(h.x < 250, 'entrée à l\'ouest');
  assert.equal(m.botCommand('a', { k: 'move', x: 800, y: 400 }), false, 'immobile pendant le décompte');
  stepUntil(m, () => m.mobs.size > 0);
  assert.ok(m.time > INTRO_DELAY);
  assert.equal(m.mobs.size, def.waves[0].length);
  assert.equal(m.events.filter((e) => e.e === 'spawn').length, def.waves[0].length);
  for (const u of m.mobs.values()) {
    assert.equal(u.team, 'M');
    assert.ok(Math.hypot(u.x - h.x, u.y - h.y) >= 400, 'loin du joueur');
    assert.ok(m.units.includes(u));
  }
});

test('les vagues s\'enchaînent, puis la salle est vidée : coffre et porte', () => {
  const m = solo(1);
  nextRoom(m);
  const def = m.room.def;
  assert.equal(def.index, 1);
  assert.equal(def.waves.length, 2);
  stepUntil(m, () => m.mobs.size > 0);
  for (const u of m.mobs.values()) m.kill(u, null, m.time);
  stepUntil(m, () => m.pending.length > 0, 10);
  assert.equal(m.room.cleared, false);
  assert.equal(m.pending.length, def.waves[1].length, 'deuxième vague annoncée');
  stepUntil(m, () => m.mobs.size > 0);
  assert.equal(m.mobs.size, def.waves[1].length);
  m.drainEvents();
  for (const u of m.mobs.values()) m.kill(u, null, m.time);
  stepUntil(m, () => m.room.cleared, 10);
  const clear = m.events.find((e) => e.e === 'clear');
  assert.deepEqual(clear.chest, { x: def.w / 2, y: def.h / 2, boss: false });
  assert.equal(m.cleared, 2);
  assert.equal(m.spawner, null);
  assert.equal(m.units.length, 1, 'les ennemis morts sont retirés');
});

test('franchir la porte : salle suivante, PV et recharges conservés, contrôles retirés', () => {
  const m = solo(2);
  const h = m.players.get('a');
  clearRoom(m);
  h.hp = 63; h.cds.Q = m.time + 50; h.slowUntil = m.time + 50; h.slowAmt = 0.3;
  const prev = m.room.def;
  m.drainEvents();
  nextRoom(m);
  const def = m.room.def;
  assert.equal(def.index, 1);
  assert.equal(def.entry, { E: 'W', N: 'S', S: 'N' }[prev.exit]);
  assert.equal(h.hp, 63);
  assert.ok(h.cds.Q > m.time);
  assert.equal(h.slowUntil, 0);
  assert.equal(m.phase, 'countdown');
  assert.equal(m.rules.w, def.w);
  assert.equal(m.spells.size, 0);
  const ev = m.events.find((e) => e.e === 'room');
  assert.equal(ev.i, 1);
  assert.ok(Math.abs(ev.rules.playAt - ev.t - ROOM_DELAY) < 1e-9);
});

test('les pièges ne touchent que les joueurs', () => {
  const m = solo(1);
  stepUntil(m, () => m.mobs.size > 0);
  const s = m.addSpell({ kind: 'circle', def: 'eruption', owner: null, target: 'a', t0: m.time, tl: m.time, td: m.time + 0.1, x: 0, y: 0, r: 5000, dmg: 20, fx: '' });
  assert.equal(s.team, 'M');
  stepUntil(m, () => !m.spells.has(s.id), 30);
  assert.equal(m.players.get('a').hp, 80);
  for (const u of m.mobs.values()) assert.equal(u.hp, u.maxHp);
});

test('une salle piégée fait tourner le générateur de l\'arène, limité à son piège', () => {
  const m = solo(1);
  const idx = m.rooms.findIndex((r) => r.trap);
  while (m.room.def.index < idx) nextRoom(m);
  assert.ok(m.spawner);
  assert.deepEqual(m.spawner.p.only, TRAPS[m.room.def.trap].only);
  stepUntil(m, () => m.phase === 'playing');
  m.players.get('a').maxHp = 100000;
  m.players.get('a').hp = 100000;
  const until = m.time + 6;
  stepUntil(m, () => m.time >= until, 60 * 7);
  const traps = m.events.filter((e) => e.e === 'sp' && e.s.owner === null);
  assert.ok(traps.length > 0, 'le piège tire');
  assert.ok(traps.every((e) => m.spawner.p.only.includes(e.s.def)));
});

test('solo : la mort du joueur termine la run en défaite', () => {
  const m = solo(1);
  stepUntil(m, () => m.phase === 'playing');
  const h = m.players.get('a');
  m.hit(LETHAL, h, m.time, h.x, h.y);
  assert.equal(m.over, true);
  assert.equal(m.phase, 'over');
  const end = m.events.find((e) => e.e === 'storyEnd');
  assert.deepEqual({ win: end.win, ch: end.ch, n: end.n, cleared: end.cleared }, { win: false, ch: 0, n: 1, cleared: 0 });
  assert.deepEqual(end.kits.a.build, EMPTY_KIT);
  assert.equal(end.stats.a.deaths, 1);
  m.step();
  assert.equal(m.botCommand('a', { k: 'move', x: 1, y: 1 }), false);
});

test('vider les 15 salles donne la victoire ; battre un boss soigne', () => {
  const m = solo(3);
  const h = m.players.get('a');
  for (let k = 0; k < 20 && !m.over; k++) {
    if (m.room.def.type === 'boss' && m.room.def.index < 14) {
      h.hp = 40;
      clearRoom(m);
      assert.equal(h.hp, h.maxHp, 'soin complet après un boss');
      assert.equal(m.room.chest.boss, true);
    }
    nextRoom(m);
  }
  assert.equal(m.over, true);
  assert.equal(m.result.win, true);
  assert.equal(m.result.cleared, 15);
  assert.ok(m.result.time > 0);
  assert.equal(m.events.filter((e) => e.e === 'room').length, 15);
  assert.equal(m.events.filter((e) => e.e === 'clear').length, 14, 'pas de coffre après le dernier boss');
  assert.equal(m.events.filter((e) => e.e === 'spawn' && e.u.boss).length, 3);
});

test('coop : on change de salle quand tous les vivants sont dans la porte, ou 12 s après le premier', () => {
  const m = duo(1);
  clearRoom(m);
  m.drainEvents();
  toExit(m, 'a');
  stepUntil(m, () => m.room.def.index === 1, 60 * 5);
  assert.equal(m.room.def.index, 0, 'on attend l\'autre joueur');
  const ex = m.events.find((e) => e.e === 'exit');
  assert.deepEqual({ n: ex.n, of: ex.of }, { n: 1, of: 2 });
  assert.equal(ex.until, ex.t + EXIT_WAIT);
  stepUntil(m, () => m.room.def.index === 1, 60 * 8);
  assert.equal(m.room.def.index, 1, 'départ forcé');
  assert.ok(Math.abs(m.time - ex.until) < 0.05);
  // Les deux joueurs dans la porte : départ immédiat.
  clearRoom(m);
  toExit(m, 'a');
  toExit(m, 'b');
  stepUntil(m, () => m.room.def.index === 2, 5);
  assert.equal(m.room.def.index, 2);
});

test('coop : les PV des ennemis suivent le nombre de joueurs', () => {
  const m1 = solo(1), m2 = duo(1);
  stepUntil(m1, () => m1.mobs.size > 0);
  stepUntil(m2, () => m2.mobs.size > 0);
  const u1 = [...m1.mobs.values()][0], u2 = [...m2.mobs.values()][0];
  assert.equal(u1.mob, u2.mob, 'même graine, même salle');
  assert.equal(u2.maxHp, Math.round(u1.maxHp * 1.7));
  assert.equal(m2.players.get('b').color, STORY_COLORS[1]);
});

test('coop : un joueur qui part ne stoppe pas la run ; plus aucun vivant, c\'est la défaite', () => {
  const m = duo(1);
  stepUntil(m, () => m.phase === 'playing');
  m.removePlayer('b');
  assert.equal(m.over, false);
  nextRoom(m);
  assert.equal(m.room.def.index, 1, 'la porte n\'attend que les joueurs présents');
  assert.equal(m.room.heroes, 1);
  // Le dernier vivant s'en va alors que l'autre est mort.
  const m2 = duo(1);
  stepUntil(m2, () => m2.phase === 'playing');
  const a = m2.players.get('a');
  m2.hit(LETHAL, a, m2.time, a.x, a.y);
  assert.equal(m2.over, false, 'b est encore en vie');
  m2.removePlayer('b');
  assert.equal(m2.over, true);
  assert.equal(m2.result.win, false);
  // Un joueur attendu à la porte s'en va : la porte s'ouvre pour l'autre.
  const m3 = duo(1);
  clearRoom(m3);
  toExit(m3, 'a');
  stepUntil(m3, () => false, 30);
  assert.equal(m3.room.def.index, 0);
  m3.removePlayer('b');
  stepUntil(m3, () => m3.room.def.index === 1, 5);
  assert.equal(m3.room.def.index, 1);
});

test('coop : un joueur mort revient à la salle suivante avec la moitié de ses PV', () => {
  const m = duo(1);
  stepUntil(m, () => m.phase === 'playing');
  const b = m.players.get('b');
  m.hit(LETHAL, b, m.time, b.x, b.y);
  assert.equal(b.alive, false);
  assert.equal(m.over, false);
  nextRoom(m);
  assert.equal(b.alive, true);
  assert.equal(b.hp, 50);
  assert.ok(m.events.some((e) => e.e === 'revive' && e.id === 'b' && e.hp === 50));
  assert.equal(m.room.heroes, 2);
});
```

- [ ] **Étape 2 : lancer les tests et constater l'échec**

Run: `node --test test/story.test.js`
Expected: FAIL au chargement : module `shared/story/match.js` introuvable.

- [ ] **Étape 3 : écrire l'implémentation**

**Créer `shared/story/match.js` :**

```js
// Une run du mode histoire : enchaînement des salles, vagues d'ennemis, porte de sortie, fin de run.

import { Match } from '../match.js';
import { SLOTS } from '../constants.js';
import { createPlayer } from '../sim.js';
import { EnvSpawner } from '../spawner.js';
import { round2 } from '../util.js';
import { generateRun, TRAPS, doorZone, entryPoints, ROOMS_PER_CHAPTER, SPAWN_WARN } from './rooms.js';
import { MOBS, ELITE, MOB_TEAM, mobDef } from './mobs.js';
import { BOSSES, bossDef } from './bosses.js';
import { heroDef } from './loot.js';

// Décompte à l'entrée d'une salle (secondes).
export const INTRO_DELAY = 5;      // première salle : le temps de lire l'intro
export const CHAPTER_DELAY = 4;    // première salle des chapitres 2 et 3
export const BOSS_DELAY = 3.5;
export const ROOM_DELAY = 1.5;
export const EXIT_WAIT = 12;       // coop : départ forcé après l'arrivée du premier joueur dans la porte
export const REVIVE_HP = 0.5;      // coop : part des PV d'un joueur mort à son retour

export class StoryMatch extends Match {
  // o = { players: [{ id, name }], time, seed }
  constructor(o) {
    const heroes = o.players.map(heroDef);
    super({ ...o, kind: 'story', players: heroes });
    this.heroDefs = heroes;   // définitions envoyées aux clients : équipe, couleur, kit de départ
  }

  setup() {
    this.rooms = generateRun(this.seed);
    this.room = null;
    this.brains = new Map();   // IA des ennemis, par id
    this.pending = [];         // apparitions annoncées : { type, elite, boss, at, x, y }
    this.nextMobId = 1;
    this.runStart = 0;
    this.cleared = 0;          // nombre de salles vidées
    this.result = null;
  }

  startRound() {
    this.enterRoom(0);
  }

  heroes() {
    return this.order.map((id) => this.players.get(id));
  }

  // Les pièges (sorts sans lanceur) sont du côté des ennemis : ils ne touchent que les joueurs.
  addSpell(spec) {
    return super.addSpell(spec.owner == null && spec.team === undefined ? { ...spec, team: MOB_TEAM } : spec);
  }

  cancelEnemySpells(t) {
    for (const s of this.spells.values()) {
      if (s.team === MOB_TEAM) this.endSpell(s, t, s.ox ?? s.x ?? s.ax, s.oy ?? s.y ?? s.ay, 'cancel');
    }
  }

  // ------------------------------------------------------------ salles

  enterRoom(i) {
    const def = this.rooms[i], t = this.time;
    this.spells.clear();
    this.mobs.clear();
    this.brains.clear();
    this.pending = [];
    this.units = this.units.filter((u) => !u.mob);
    const present = this.heroes().filter((p) => !p.left);
    const pts = entryPoints(def, present.length);
    present.forEach((p, k) => {
      if (!p.alive) {
        p.alive = true;
        p.hp = Math.ceil(p.maxHp * REVIVE_HP);
        this.emit({ e: 'revive', id: p.id, hp: p.hp, t });
      }
      const sp = pts[k];
      p.x = sp.x; p.y = sp.y; p.tx = sp.x; p.ty = sp.y; p.mv = false; p.ang = sp.ang;
      p.atk = null; p.dash = null; p.castUntil = 0; p.castSlot = '';
      p.stunUntil = 0; p.rootUntil = 0; p.slowUntil = 0; p.slowAmt = 0;
    });
    const delay = i === 0 ? INTRO_DELAY : def.type === 'boss' ? BOSS_DELAY : def.n === 1 ? CHAPTER_DELAY : ROOM_DELAY;
    const playAt = t + delay;
    if (i === 0) this.runStart = playAt;
    this.rules = { playAt, shrink: false, allowed: SLOTS, frozen: false, w: def.w, h: def.h };
    this.phase = 'countdown';
    this.phaseUntil = playAt;
    this.spawner = def.trap ? new EnvSpawner(this, TRAPS[def.trap]) : null;
    this.room = {
      def, wave: -1, cleared: false, heroes: present.length,
      chest: null, offers: new Map(),
      exit: doorZone(def, def.exit), exitSince: null, inExit: 0, exitOf: 0,
    };
    this.emit({
      e: 'room', t, rules: { ...this.rules },
      i, ch: def.chapter, n: def.n, of: ROOMS_PER_CHAPTER, type: def.type, decor: def.decor,
      entry: def.entry, exit: def.exit, door: this.room.exit, trap: def.trap, boss: def.boss,
    });
    this.nextWave(playAt);
  }

  // Annonce la vague suivante : ses ennemis apparaissent à l'instant `at`.
  nextWave(at) {
    const room = this.room, def = room.def;
    room.wave++;
    const list = def.type === 'boss' ? [{ boss: def.boss }] : def.waves[room.wave];
    for (const m of list) this.announce(m, at);
  }

  // Annonce une apparition : cercle au sol, puis l'ennemi à l'instant `at`.
  announce(m, at) {
    const def = this.room.def;
    const pos = m.boss ? { x: def.w / 2, y: def.h / 2 } : this.spawnPoint();
    const x = round2(pos.x), y = round2(pos.y);
    const r = m.boss ? BOSSES[m.boss].r : Math.round(MOBS[m.type].r * (m.elite ? ELITE.r : 1));
    this.pending.push({ ...m, at, x, y });
    this.emit({ e: 'warn', x, y, r, at, t: this.time });
  }

  // Point d'apparition loin des joueurs et des autres apparitions annoncées.
  spawnPoint() {
    const { w, h } = this.rules;
    const alive = this.heroes().filter((p) => p.alive);
    let best = null, bestD = -1;
    for (let k = 0; k < 20; k++) {
      const x = 80 + this.rng() * (w - 160), y = 80 + this.rng() * (h - 160);
      let d = Infinity;
      for (const p of alive) d = Math.min(d, Math.hypot(p.x - x, p.y - y));
      for (const q of this.pending) if (Math.hypot(q.x - x, q.y - y) < 90) d = 0;
      if (d >= 400) return { x, y };
      if (d > bestD) {
        bestD = d;
        best = { x, y };
      }
    }
    return best;
  }

  // s = { type, elite, x, y } pour un ennemi, { boss, x, y } pour un boss.
  addMob(s, t) {
    const id = 'm' + this.nextMobId++;
    const def = s.boss
      ? bossDef(id, s.boss, this.room.heroes)
      : mobDef(id, s.type, { chapter: this.room.def.chapter, elite: !!s.elite, heroes: this.room.heroes });
    const u = createPlayer(def, 0);
    u.x = s.x; u.y = s.y; u.tx = s.x; u.ty = s.y;
    this.mobs.set(id, u);
    this.units.push(u);
    this.emit({ e: 'spawn', u: def, x: u.x, y: u.y, t });
    return u;
  }

  // ------------------------------------------------------------ boucle

  tick(t0, t1) {
    const room = this.room;
    this.sweep();
    this.spawnDue(t1);
    for (const b of this.brains.values()) b.update(t1);
    if (room.cleared) this.updateExit(t1);
    else if (!this.mobs.size && !this.pending.length) {
      if (room.def.type === 'combat' && room.wave + 1 < room.def.waves.length) this.nextWave(t1 + SPAWN_WARN);
      else this.clearRoom(t1);
    }
  }

  // Retire les ennemis morts. Jamais pendant le parcours des collisions : seulement ici, en début de pas.
  sweep() {
    let dead = false;
    for (const m of this.mobs.values()) {
      if (m.alive) continue;
      this.mobs.delete(m.id);
      this.brains.delete(m.id);
      dead = true;
    }
    if (dead) this.units = this.units.filter((u) => u.alive || !u.mob);
  }

  spawnDue(t) {
    if (!this.pending.length || this.pending.every((s) => s.at > t)) return;
    const due = this.pending.filter((s) => s.at <= t);
    this.pending = this.pending.filter((s) => s.at > t);
    for (const s of due) this.addMob(s, t);
  }

  clearRoom(t) {
    const room = this.room, def = room.def;
    room.cleared = true;
    this.cleared++;
    this.spawner = null;
    this.cancelEnemySpells(t);
    if (def.index === this.rooms.length - 1) return this.finishStory(true, t);
    if (def.type === 'boss') {
      // Battre un boss soigne entièrement tous les joueurs vivants.
      for (const p of this.heroes()) {
        if (!p.alive || p.hp >= p.maxHp) continue;
        this.emit({ e: 'heal', id: p.id, amt: p.maxHp - p.hp, t });
        p.hp = p.maxHp;
      }
    }
    room.chest = { x: def.w / 2, y: def.h / 2, boss: def.type === 'boss' };
    this.emit({ e: 'clear', i: def.index, chest: room.chest, t });
  }

  // Salle suivante quand tous les joueurs vivants sont dans la porte, ou EXIT_WAIT après le premier.
  updateExit(t) {
    const room = this.room, z = room.exit;
    let alive = 0, inside = 0;
    for (const p of this.heroes()) {
      if (!p.alive) continue;
      alive++;
      if (p.x >= z.x0 && p.x <= z.x1 && p.y >= z.y0 && p.y <= z.y1) inside++;
    }
    if (!inside) room.exitSince = null;
    else if (room.exitSince === null) room.exitSince = t;
    if (inside !== room.inExit || alive !== room.exitOf) {
      room.inExit = inside;
      room.exitOf = alive;
      this.emit({ e: 'exit', n: inside, of: alive, until: inside ? room.exitSince + EXIT_WAIT : 0, t });
    }
    if (inside && (inside === alive || t - room.exitSince >= EXIT_WAIT)) this.enterRoom(room.def.index + 1);
  }

  // ------------------------------------------------------------ morts et fin de run

  kill(p, s, t) {
    super.kill(p, s, t);
    if (p.mob || this.over) return;
    if (!this.heroes().some((h) => h.alive)) this.finishStory(false, t);
  }

  // La défaite est décidée à la mort du dernier joueur, la victoire à la mort du dernier boss.
  checkEnd() {}

  removePlayer(id) {
    super.removePlayer(id);
    if (this.over) return;
    const rest = this.heroes().filter((p) => !p.left);
    if (rest.length && !rest.some((p) => p.alive)) this.finishStory(false, this.time);
  }

  finishStory(win, t) {
    if (this.over) return;
    this.phase = 'over';
    this.over = true;
    this.rules.frozen = true;
    const def = this.room.def;
    const kits = {};
    for (const p of this.heroes()) kits[p.id] = { build: { ...p.build }, rar: { ...p.rar } };
    this.result = { win, ch: def.chapter, n: def.n, cleared: this.cleared, time: Math.max(0, t - this.runStart) };
    this.emit({ e: 'storyEnd', ...this.result, stats: JSON.parse(JSON.stringify(this.stats)), kits, t });
  }
}
```

- [ ] **Étape 4 : lancer les tests**

Run: `node --test test/story.test.js`
Expected: PASS, 24 tests.

Run: `npm test`
Expected: tous les tests passent.

- [ ] **Étape 5 : commit**

```bash
git add shared/story/match.js test/story.test.js
git commit -m "story: room flow, waves, exit door, end of run" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8 : Coffre — tirage, prise, soin

**Files:**
- Modify: `shared/story/match.js` (import, constante, `tick`, nouvelles méthodes `command`, `updateChest`, `takeLoot`)
- Test: `test/story.test.js`

**Interfaces:**
- Consumes: `drawOffer`, `applyCard`, `SKIP_HEAL` (tâche 4), `room.chest`, `room.offers` (tâche 7).
- Produces:
  - Commande de joueur `{ k: 'loot', i }` : `i` de 0 à 2 pour une carte, −1 pour passer. Renvoie `true` si acceptée.
  - `CHEST_RANGE = 130`.
  - Événements : `offer { id, cards, heal, t }`, `kit { id, slot, ab, rar, t }`, `looted { id, t }`, `heal` (déjà défini).
  - Un joueur avec un tirage en attente ne peut ni marcher ni attaquer.

- [ ] **Étape 1 : écrire les tests qui échouent**

**Ajouter à la fin de `test/story.test.js` :**

```js

// ---------------------------------------------------------------- coffre

// Amène un joueur au coffre et renvoie son tirage.
function openChest(m, id = 'a') {
  const p = m.players.get(id), c = m.room.chest;
  p.x = c.x + 40; p.y = c.y; p.tx = p.x; p.ty = p.y; p.mv = false;
  m.step();
  return m.room.offers.get(id);
}

test('coffre : s\'approcher donne un tirage, prendre une carte équipe le sort', () => {
  const m = solo(1);
  const h = m.players.get('a');
  clearRoom(m);
  m.step();
  assert.equal(m.room.offers.size, 0, 'trop loin du coffre');
  m.drainEvents();
  const offer = openChest(m);
  assert.equal(offer.cards.length, 3);
  const ev = m.events.find((e) => e.e === 'offer');
  assert.equal(ev.id, 'a');
  assert.deepEqual(ev.cards, offer.cards);
  assert.equal(ev.heal, SKIP_HEAL);
  assert.equal(m.botCommand('a', { k: 'move', x: 0, y: 0 }), false, 'on ne marche pas pendant le choix');
  assert.equal(m.botCommand('a', { k: 'attack', id: 'm1' }), false);
  const card = offer.cards[1];
  assert.equal(m.botCommand('a', { k: 'loot', i: 1 }), true);
  assert.equal(h.build[card.slot], card.ab);
  assert.equal(h.rar[card.slot], card.rar);
  const kit = m.events.find((e) => e.e === 'kit');
  assert.deepEqual({ id: kit.id, slot: kit.slot, ab: kit.ab, rar: kit.rar }, { id: 'a', slot: card.slot, ab: card.ab, rar: card.rar });
  assert.ok(m.events.some((e) => e.e === 'looted' && e.id === 'a'));
  assert.equal(m.botCommand('a', { k: 'cast', slot: card.slot, x: h.x + 200, y: h.y }), true, 'utilisable aussitôt');
  assert.equal(m.botCommand('a', { k: 'loot', i: 0 }), false, 'un seul choix par coffre');
  assert.equal(m.botCommand('a', { k: 'move', x: h.x - 50, y: h.y }), true);
  m.step();
  m.step();
  assert.equal(m.events.filter((e) => e.e === 'offer').length, 1, 'pas de second tirage');
});

test('coffre : passer rend des PV, sans dépasser le maximum', () => {
  const m = solo(1);
  const h = m.players.get('a');
  clearRoom(m);
  h.hp = 50;
  openChest(m);
  m.drainEvents();
  assert.equal(m.botCommand('a', { k: 'loot', i: -1 }), true);
  assert.equal(h.hp, 80);
  assert.deepEqual(h.build, EMPTY_KIT);
  assert.equal(m.events.find((e) => e.e === 'heal').amt, 30);
  nextRoom(m);
  clearRoom(m);
  h.hp = 90;
  openChest(m);
  m.botCommand('a', { k: 'loot', i: -1 });
  assert.equal(h.hp, 100);
});

test('commande de butin invalide : ignorée', () => {
  const m = solo(1);
  assert.equal(m.botCommand('a', { k: 'loot', i: 0 }), false, 'pas de coffre');
  clearRoom(m);
  assert.equal(m.botCommand('a', { k: 'loot', i: 0 }), false, 'pas de tirage en attente');
  openChest(m);
  for (const i of [3, -2, 1.5, '0', null, undefined, NaN]) {
    assert.equal(m.botCommand('a', { k: 'loot', i }), false, `i=${i}`);
  }
  assert.equal(m.room.offers.get('a').done, false);
  assert.deepEqual(m.players.get('a').build, EMPTY_KIT);
});

test('coop : chacun son tirage ; un tirage en attente est perdu au changement de salle ; un mort n\'a pas de coffre', () => {
  const m = duo(1);
  clearRoom(m);
  const oa = openChest(m, 'a'), ob = openChest(m, 'b');
  assert.ok(oa && ob && oa !== ob);
  assert.equal(m.botCommand('a', { k: 'loot', i: 0 }), true);
  // b garde son tirage ouvert, a attend dans la porte jusqu'au départ forcé.
  toExit(m, 'a');
  stepUntil(m, () => m.room.def.index === 1, 60 * 13);
  assert.equal(m.room.def.index, 1);
  assert.equal(m.room.offers.size, 0);
  assert.equal(m.botCommand('b', { k: 'loot', i: 0 }), false, 'tirage perdu');
  assert.deepEqual(m.players.get('b').build, EMPTY_KIT);
  // Un joueur mort ne reçoit pas de tirage.
  stepUntil(m, () => m.phase === 'playing');
  const b = m.players.get('b');
  m.hit(LETHAL, b, m.time, b.x, b.y);
  clearRoom(m);
  b.x = m.room.chest.x; b.y = m.room.chest.y;
  m.step();
  assert.equal(m.room.offers.has('b'), false);
});
```

- [ ] **Étape 2 : lancer les tests et constater l'échec**

Run: `node --test test/story.test.js`
Expected: FAIL. « coffre : s'approcher donne un tirage » échoue : `offer` vaut `undefined`.

- [ ] **Étape 3 : écrire l'implémentation**

Dans `shared/story/match.js`, remplacer l'import de `./loot.js` par :

```js
import { heroDef, drawOffer, applyCard, SKIP_HEAL } from './loot.js';
```

Ajouter après `export const REVIVE_HP = 0.5;` :

```js
export const CHEST_RANGE = 130;    // distance à laquelle un joueur ouvre le coffre
```

Dans `tick`, remplacer :

```js
    if (room.cleared) this.updateExit(t1);
```

par :

```js
    if (room.cleared) {
      this.updateChest(t1);
      this.updateExit(t1);
    }
```

Ajouter ces méthodes dans la classe, avant le commentaire `// ---- morts et fin de run` :

```js
  // ------------------------------------------------------------ coffre

  // Commande de butin, en plus des commandes du moteur. Pas de déplacement pendant un tirage en attente.
  command(p, cmd, t) {
    if (cmd.k === 'loot') return this.takeLoot(p, cmd.i, t);
    const offer = this.room.offers.get(p.id);
    if (offer && !offer.done && (cmd.k === 'move' || cmd.k === 'attack')) return false;
    return super.command(p, cmd, t);
  }

  // Un joueur vivant qui atteint le coffre reçoit son tirage, une seule fois par salle.
  updateChest(t) {
    const room = this.room, c = room.chest;
    if (!c) return;
    for (const p of this.heroes()) {
      if (!p.alive || room.offers.has(p.id)) continue;
      if (Math.hypot(p.x - c.x, p.y - c.y) > CHEST_RANGE) continue;
      const cards = drawOffer(this.rng, p, room.def.chapter, c.boss);
      room.offers.set(p.id, { cards, done: false });
      p.mv = false;
      p.atk = null;
      this.emit({ e: 'offer', id: p.id, cards, heal: SKIP_HEAL, t });
    }
  }

  // i : indice de la carte prise, ou -1 pour passer (rend des PV).
  takeLoot(p, i, t) {
    const offer = this.room.offers.get(p.id);
    if (!offer || offer.done || !p.alive || !Number.isInteger(i)) return false;
    if (i === -1) {
      const amt = Math.min(SKIP_HEAL, p.maxHp - p.hp);
      p.hp += amt;
      this.emit({ e: 'heal', id: p.id, amt, t });
    } else {
      const card = offer.cards[i];
      if (!card) return false;
      applyCard(p, card);
      this.emit({ e: 'kit', id: p.id, slot: card.slot, ab: card.ab, rar: card.rar, t });
    }
    offer.done = true;
    this.emit({ e: 'looted', id: p.id, t });
    return true;
  }
```

- [ ] **Étape 4 : lancer les tests**

Run: `node --test test/story.test.js`
Expected: PASS, 28 tests.

- [ ] **Étape 5 : commit**

```bash
git add shared/story/match.js test/story.test.js
git commit -m "story: chest offers, loot command, skip heal" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9 : IA des ennemis

**Files:**
- Modify: `shared/story/mobs.js` (imports, classe `MobBrain`, comportements)
- Modify: `shared/story/match.js` (import, `addMob`, nouvelle méthode `interrupt`)
- Test: `test/story.test.js`

**Interfaces:**
- Consumes: `predictPos` (tâche 3), champ de sort `cu` (tâche 3), `match.addSpell`, `match.kill`, `match.rng`, `match.rules`, `match.players`, `match.order`, définition `mobDef` avec `dmg` et `atkCd` (tâche 5).
- Produces:
  - `new MobBrain(match, unit, def, t)` avec `update(t)`, appelée à chaque pas de jeu par `StoryMatch.tick`.
  - Sorts d'ennemis : `def` vaut `m_frappe` (rôdeur), `m_tir` (tireur, sentinelle), `m_explosion` (bombe), `m_eruption` (pyromancien), `m_charge` (bélier). `owner` est l'id de l'ennemi.
  - Pendant sa préparation, l'ennemi a `castUntil > t` et ne bouge pas.

- [ ] **Étape 1 : écrire les tests qui échouent**

**Ajouter à la fin de `test/story.test.js` :**

```js

// ---------------------------------------------------------------- IA des ennemis

// Un joueur seul face à un ennemi du type voulu, à `dist` unités sur sa droite.
function duelMob(type, { elite = false, dist = 300 } = {}) {
  const m = solo(1);
  stepUntil(m, () => m.mobs.size > 0);
  for (const u of m.mobs.values()) u.alive = false;
  const hero = m.players.get('a');
  hero.x = 400; hero.y = 400; hero.tx = 400; hero.ty = 400; hero.mv = false;
  const mob = m.addMob({ type, elite, x: 400 + dist, y: 400 }, m.time);
  return { m, hero, mob };
}

const DUEL_DIST = { rodeur: 300, tireur: 600, bombe: 300, pyro: 700, belier: 500, sentinelle: 600 };

for (const type of Object.keys(DUEL_DIST)) {
  test(`${type} : touche un joueur immobile, rate un joueur qui s'écarte`, () => {
    const still = duelMob(type, { dist: DUEL_DIST[type] });
    stepUntil(still.m, () => still.hero.hp < 100, 60 * 8);
    assert.ok(still.hero.hp < 100, 'le joueur immobile est touché');
    assert.equal(still.m.events.find((e) => e.e === 'hit' && e.tid === 'a').by, still.mob.id);

    const { m, hero, mob } = duelMob(type, { dist: DUEL_DIST[type] });
    stepUntil(m, () => mob.castUntil > m.time, 60 * 8);
    assert.ok(mob.castUntil > m.time, 'l\'ennemi prépare son attaque');
    assert.equal(mob.mv, false, 'immobile pendant la préparation');
    m.botCommand('a', { k: 'move', x: hero.x, y: hero.y + 420 });
    const until = m.time + 2;
    stepUntil(m, () => m.time >= until, 60 * 3);
    assert.equal(hero.hp, 100, 'l\'attaque est esquivée');
  });
}

test('un ennemi étourdi ou tué pendant sa préparation perd son attaque', () => {
  for (const type of Object.keys(DUEL_DIST)) {
    const { m, hero, mob } = duelMob(type, { dist: DUEL_DIST[type] });
    stepUntil(m, () => mob.castUntil > m.time, 60 * 8);
    const spells = [...m.spells.values()].filter((s) => s.owner === mob.id);
    assert.ok(spells.length > 0, type);
    m.hit({ id: 99, dmg: 1, stun: 1.5, owner: 'a', team: 'P', def: 'q', kind: 'line' }, mob, m.time, mob.x, mob.y);
    for (const s of spells) assert.equal(m.spells.has(s.id), false, `${type} : sort annulé`);
    assert.equal(mob.dash, null, `${type} : charge annulée`);
    const until = m.time + 1.2;
    stepUntil(m, () => m.time >= until, 60 * 2);
    assert.equal(hero.hp, 100, type);
    assert.ok(mob.alive, `${type} : toujours en vie`);
  }
  // Tué pendant la préparation : même résultat.
  const { m, hero, mob } = duelMob('rodeur');
  stepUntil(m, () => mob.castUntil > m.time, 60 * 8);
  m.kill(mob, null, m.time);
  const until = m.time + 1.2;
  stepUntil(m, () => m.time >= until, 60 * 2);
  assert.equal(hero.hp, 100);
});

test('une bombe disparaît dans son explosion', () => {
  const { m, hero, mob } = duelMob('bombe');
  stepUntil(m, () => !mob.alive, 60 * 8);
  assert.equal(mob.alive, false);
  assert.equal(hero.hp, 80);
  assert.equal(m.stats.a.kills, 0, 'personne n\'est crédité');
});

test('élite : sentinelle à 5 projectiles, contrôles réduits de moitié', () => {
  const { m, mob } = duelMob('sentinelle', { elite: true, dist: 600 });
  stepUntil(m, () => mob.castUntil > m.time, 60 * 8);
  assert.equal([...m.spells.values()].filter((s) => s.owner === mob.id).length, 5);
  const t = m.time;
  m.hit({ id: 99, dmg: 1, stun: 2, owner: 'a', team: 'P', def: 'q', kind: 'line' }, mob, t, mob.x, mob.y);
  assert.ok(Math.abs(mob.stunUntil - (t + 1)) < 1e-9);
});

test('les ennemis ne se blessent pas entre eux et ne s\'empilent pas', () => {
  const { m, hero } = duelMob('rodeur');
  hero.maxHp = 100000; hero.hp = 100000;
  m.addMob({ type: 'rodeur', elite: false, x: 720, y: 400 }, m.time);
  m.addMob({ type: 'bombe', elite: false, x: 700, y: 430 }, m.time);
  const until = m.time + 6;
  stepUntil(m, () => m.time >= until, 60 * 7);
  const hits = m.events.filter((e) => e.e === 'hit');
  assert.ok(hits.length > 0);
  assert.ok(hits.every((e) => e.tid === 'a'), 'seul le joueur est touché');
  const rod = [...m.mobs.values()].filter((u) => u.alive && u.mob === 'rodeur');
  assert.equal(rod.length, 2);
  assert.ok(Math.hypot(rod[0].x - rod[1].x, rod[0].y - rod[1].y) > 20, 'chacun sa place autour de la cible');
});

test('un joueur immobile face à un rôdeur finit par perdre', () => {
  const { m } = duelMob('rodeur');
  stepUntil(m, () => m.over, 60 * 60);
  assert.equal(m.over, true);
  assert.equal(m.result.win, false);
});
```

- [ ] **Étape 2 : lancer les tests et constater l'échec**

Run: `node --test test/story.test.js`
Expected: FAIL. Les tests par type d'ennemi échouent : « le joueur immobile est touché » (les ennemis n'attaquent pas encore).

- [ ] **Étape 3 : écrire l'IA**

Dans `shared/story/mobs.js`, ajouter après le commentaire d'en-tête :

```js
import { predictPos } from '../sim.js';
import { clamp } from '../util.js';
```

**Ajouter à la fin de `shared/story/mobs.js` :**

```js

// ---------------------------------------------------------------- IA

const THINK = 0.15;          // intervalle entre deux décisions (s)
const DEG = Math.PI / 180;

export class MobBrain {
  constructor(match, unit, def, t) {
    this.m = match;
    this.u = unit;
    this.def = def;
    this.next = t;
    this.ready = t + 0.6 + match.rng() * 0.6;   // première attaque : jamais dès l'apparition
    this.slot = match.rng() * Math.PI * 2;      // place autour de la cible, pour ne pas s'empiler
    this.side = match.rng() < 0.5 ? 1 : -1;     // côté de fuite
    this.tgt = null;
    this.tgtUntil = 0;
    this.fuse = 0;                              // bombe : id du sort d'explosion en cours
    this.boomAt = 0;
  }

  // Joueur vivant le plus proche. La cible est gardée quelques secondes.
  target(t) {
    const cur = this.tgt && this.m.players.get(this.tgt);
    if (cur && cur.alive && t < this.tgtUntil) return cur;
    let best = null, bd = Infinity;
    for (const id of this.m.order) {
      const p = this.m.players.get(id);
      if (!p.alive) continue;
      const d = Math.hypot(p.x - this.u.x, p.y - this.u.y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    this.tgt = best ? best.id : null;
    this.tgtUntil = t + 2 + this.m.rng() * 2;
    return best;
  }

  update(t) {
    const u = this.u;
    if (!u.alive) return;
    if (this.fuse) {
      if (!this.m.spells.has(this.fuse)) this.fuse = 0;             // mise à feu annulée par un contrôle
      else if (t >= this.boomAt) return this.m.kill(u, null, t);    // la bombe disparaît dans son explosion
    }
    if (t < this.next) return;
    this.next = t + THINK * (0.8 + this.m.rng() * 0.4);
    if (t < u.stunUntil || t < u.castUntil || u.dash) return;
    const h = this.target(t);
    if (!h) {
      u.mv = false;
      return;
    }
    const dx = h.x - u.x, dy = h.y - u.y;
    const d = Math.hypot(dx, dy) || 1;
    BEHAVIORS[u.mob](this, u, h, d, dx / d, dy / d, t);
  }

  // Déplacement vers un point, borné à la salle. Même modèle que les joueurs : les clients l'extrapolent.
  go(x, y) {
    const u = this.u, { w, h } = this.m.rules;
    u.tx = clamp(x, u.r, w - u.r);
    u.ty = clamp(y, u.r, h - u.r);
    u.mv = true;
  }

  // Se tient entre min et max de sa cible. S'éloigne en biais si elle approche à moins de flee.
  keepRange(h, d, ux, uy, min, max, flee) {
    const u = this.u;
    if (d < flee) this.go(u.x - ux * 240 - uy * this.side * 150, u.y - uy * 240 + ux * this.side * 150);
    else if (d > max) this.go(h.x - (ux * (min + max)) / 2, h.y - (uy * (min + max)) / 2);
    else if (d < min) this.go(u.x - ux * 120, u.y - uy * 120);
    else u.mv = false;
  }

  // Début d'une attaque : l'ennemi s'immobilise pendant la préparation, puis recharge.
  windup(t, dur, ang) {
    const u = this.u;
    u.mv = false;
    u.ang = ang;
    u.castUntil = t + dur;
    u.castDur = dur;
    u.castSlot = 'A';
    this.ready = t + dur + this.def.atkCd;
  }

  spell(spec) {
    return this.m.addSpell({ owner: this.u.id, target: null, dmg: this.def.dmg, fx: '', ...spec });
  }
}

// Comportement de chaque type : (cerveau, unité, cible, distance, direction x, direction y, temps).
// Toute attaque est annoncée : cu donne l'instant jusqu'auquel un contrôle ou la mort l'annule.
const BEHAVIORS = {
  // Rôdeur : va au contact, puis frappe une zone sur la position du joueur.
  rodeur(b, u, h, d, ux, uy, t) {
    if (d <= 110 && t >= b.ready) {
      b.windup(t, 0.55, Math.atan2(uy, ux));
      b.spell({ kind: 'circle', def: 'm_frappe', t0: t, tl: t, td: t + 0.55, cu: t + 0.55, x: h.x, y: h.y, r: 85 });
      return;
    }
    const reach = h.r + u.r + 14;
    b.go(h.x + Math.cos(b.slot) * reach, h.y + Math.sin(b.slot) * reach);
  },

  // Tireur : garde ses distances et tire un projectile en ligne, avec un peu d'anticipation.
  tireur(b, u, h, d, ux, uy, t) {
    if (d <= 760 && t >= b.ready) {
      const aim = predictPos(h, t, 0.55 + d / 1250, 0.5);
      const a = Math.atan2(aim.y - u.y, aim.x - u.x);
      b.windup(t, 0.55, a);
      b.spell({
        kind: 'line', def: 'm_tir', t0: t, tl: t + 0.55, ox: u.x, oy: u.y, dx: Math.cos(a), dy: Math.sin(a),
        speed: 1250, range: 1000, radius: 26, ret: false, pierce: false,
      });
      return;
    }
    b.keepRange(h, d, ux, uy, 520, 680, 320);
  },

  // Bombe : court vers le joueur, s'arrête au contact et explose.
  bombe(b, u, h, d, ux, uy, t) {
    if (d > 120) return b.go(h.x, h.y);
    b.windup(t, 0.75, Math.atan2(uy, ux));
    b.fuse = b.spell({ kind: 'circle', def: 'm_explosion', t0: t, tl: t, td: t + 0.75, cu: t + 0.75, x: u.x, y: u.y, r: 150 }).id;
    b.boomAt = t + 0.75;
  },

  // Pyromancien : reste loin et lance une éruption sur la position prévue du joueur.
  pyro(b, u, h, d, ux, uy, t) {
    if (d <= 900 && t >= b.ready) {
      const aim = predictPos(h, t, 0.95, 0.6);
      b.windup(t, 0.4, Math.atan2(aim.y - u.y, aim.x - u.x));
      b.spell({
        kind: 'circle', def: 'm_eruption', t0: t, tl: t, td: t + 0.95, cu: t + 0.4, x: aim.x, y: aim.y, r: 120,
        slow: 0.3, slowDur: 1.5, fx: 'slow',
      });
      return;
    }
    b.keepRange(h, d, ux, uy, 600, 800, 300);
  },

  // Bélier : annonce un couloir, puis le traverse.
  belier(b, u, h, d, ux, uy, t) {
    if (d <= 600 && t >= b.ready) {
      const { w, h: H } = b.m.rules;
      const ex = clamp(u.x + ux * 650, u.r, w - u.r), ey = clamp(u.y + uy * 650, u.r, H - u.r);
      const ta = t + 0.75, te = ta + 0.3;
      b.windup(t, 1.05, Math.atan2(uy, ux));
      b.spell({ kind: 'beam', def: 'm_charge', t0: t, tl: t, ta, te, cu: ta, ax: u.x, ay: u.y, bx: ex, by: ey, hw: u.r + 14 });
      u.dash = { k: 'dash', fx: u.x, fy: u.y, tx: ex, ty: ey, ts: ta, te };
      return;
    }
    if (d > 520) b.go(h.x, h.y);
    else u.mv = false;
  },

  // Sentinelle : immobile, tire un éventail de projectiles (3, ou 5 pour une élite).
  sentinelle(b, u, h, d, ux, uy, t) {
    u.ang = Math.atan2(uy, ux);
    if (d > 1100 || t < b.ready) return;
    const aim = predictPos(h, t, 0.7 + d / 1100, 0.4);
    const a0 = Math.atan2(aim.y - u.y, aim.x - u.x);
    const n = u.elite ? 5 : 3;
    b.windup(t, 0.7, a0);
    for (let i = 0; i < n; i++) {
      const a = a0 + (i - (n - 1) / 2) * 18 * DEG;
      b.spell({
        kind: 'line', def: 'm_tir', t0: t, tl: t + 0.7, ox: u.x, oy: u.y, dx: Math.cos(a), dy: Math.sin(a),
        speed: 1100, range: 1200, radius: 24, ret: false, pierce: false,
      });
    }
  },
};
```

- [ ] **Étape 4 : brancher l'IA sur la partie**

Dans `shared/story/match.js`, remplacer l'import de `./mobs.js` par :

```js
import { MOBS, ELITE, MOB_TEAM, mobDef, MobBrain } from './mobs.js';
```

Dans `addMob`, remplacer :

```js
    this.mobs.set(id, u);
    this.units.push(u);
```

par :

```js
    this.mobs.set(id, u);
    this.units.push(u);
    if (!s.boss) this.brains.set(id, new MobBrain(this, u, def, t));
```

Ajouter cette méthode dans la classe, avant `kill` :

```js
  // Un bélier arrêté pendant sa préparation ne charge pas.
  interrupt(p, t) {
    if (p.mob && p.dash && t < p.dash.ts) p.dash = null;
    super.interrupt(p, t);
  }
```

- [ ] **Étape 5 : lancer les tests**

Run: `node --test test/story.test.js`
Expected: PASS, 39 tests.

Run: `npm test`
Expected: tous les tests passent.

- [ ] **Étape 6 : commit**

```bash
git add shared/story/mobs.js shared/story/match.js test/story.test.js
git commit -m "story: enemy AI with telegraphed, cancellable attacks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10 : Pilote scripté et run complète

**Files:**
- Create: `tools/pilot.js`
- Test: `test/story.test.js`

**Interfaces:**
- Consumes: `StoryMatch` (`room`, `mobs`, `botCommand`, `over`, `phase`), `abilityOf` (tâche 2).
- Produces: `new Pilot(match, id, { god })` avec `update()`, à appeler avant chaque `match.step()`. Avec `god: true`, les PV du joueur sont remis au maximum à chaque appel. Sert aux tests (tâches 10, 12, 16 à 18) et à l'équilibrage (tâche 23).

- [ ] **Étape 1 : écrire le test qui échoue**

**Ajouter à la fin de `test/story.test.js` :**

```js

// ---------------------------------------------------------------- run complète

import { Pilot } from '../tools/pilot.js';

test('run complète : un pilote scripté va de la première salle à la victoire', () => {
  const m = solo(11);
  const pilot = new Pilot(m, 'a', { god: true });
  stepUntil(m, () => {
    pilot.update();
    return m.over;
  }, 60 * 60 * 40);
  assert.equal(m.over, true, `bloqué en salle ${m.room.def.index + 1}`);
  assert.equal(m.result.win, true);
  assert.equal(m.result.cleared, 15);
  assert.ok(m.result.time > 120, `run trop courte : ${m.result.time} s`);
  const h = m.players.get('a');
  assert.ok(['W', 'E', 'R', 'D', 'F'].every((s) => h.build[s]), 'le kit est complet en fin de run');
  assert.ok(m.stats.a.kills > 30);
});
```

- [ ] **Étape 2 : lancer le test et constater l'échec**

Run: `node --test test/story.test.js`
Expected: FAIL au chargement : module `tools/pilot.js` introuvable.

- [ ] **Étape 3 : écrire le pilote**

**Créer `tools/pilot.js` :**

```js
// Pilote scripté : joue une run du mode histoire sans intervention (tests, équilibrage).
// Il vise l'ennemi le plus proche, garde ses distances, ouvre les coffres et passe les portes.

import { abilityOf } from '../shared/abilities.js';
import { predictPos } from '../shared/sim.js';

const AIMED = ['line', 'circle', 'salvo', 'ring', 'beam'];

export class Pilot {
  // god : les PV sont remis au maximum à chaque appel (le pilote ne meurt jamais).
  constructor(match, id, { god = false } = {}) {
    this.m = match;
    this.id = id;
    this.god = god;
    this.next = 0;
  }

  cmd(c) {
    return this.m.botCommand(this.id, c);
  }

  update() {
    const m = this.m, p = m.players.get(this.id), t = m.time;
    if (m.over || !p.alive) return;
    if (this.god) p.hp = p.maxHp;
    if (m.phase !== 'playing' || t < this.next) return;
    this.next = t + 0.1;
    const room = m.room;
    const offer = room.offers.get(this.id);
    if (offer && !offer.done) return void this.cmd({ k: 'loot', i: this.choose(p, offer.cards) });
    if (room.cleared) {
      const c = room.chest, z = room.exit;
      if (c && !offer) return void this.cmd({ k: 'move', x: c.x, y: c.y });
      return void this.cmd({ k: 'move', x: (z.x0 + z.x1) / 2, y: (z.y0 + z.y1) / 2 });
    }
    let tg = null, bd = Infinity;
    for (const u of m.mobs.values()) {
      if (!u.alive) continue;
      const d = Math.hypot(u.x - p.x, u.y - p.y);
      if (d < bd) {
        bd = d;
        tg = u;
      }
    }
    if (!tg) return;
    if (bd < 700) {
      // Vise un peu en avant d'une cible qui se déplace.
      const aim = predictPos(tg, t, 0.3 + bd / 1800, 1);
      for (const slot of ['R', 'W', 'Q']) {
        const ab = abilityOf(p, slot);
        if (ab && AIMED.includes(ab.kind) && this.cmd({ k: 'cast', slot, x: aim.x, y: aim.y })) return;
      }
    }
    const ux = (tg.x - p.x) / (bd || 1), uy = (tg.y - p.y) / (bd || 1);
    if (bd > 560) this.cmd({ k: 'move', x: p.x + ux * 200, y: p.y + uy * 200 });
    else if (bd < 340) this.cmd({ k: 'move', x: p.x - ux * 200, y: p.y - uy * 200 });
  }

  // Une carte pour une touche vide d'abord, sinon la plus rare. -1 (passer) si le coffre est vide.
  choose(p, cards) {
    let best = -1, score = -1;
    cards.forEach((c, i) => {
      const sc = (p.build[c.slot] ? 0 : 10) + c.rar;
      if (sc > score) {
        score = sc;
        best = i;
      }
    });
    return best;
  }
}
```

- [ ] **Étape 4 : lancer les tests**

Run: `node --test test/story.test.js`
Expected: PASS, 40 tests. Le test de run complète prend quelques secondes.

Si le pilote reste bloqué (message « bloqué en salle N »), afficher l'état pour comprendre avant de corriger : `m.room.cleared`, `m.mobs.size`, `m.pending.length`, la position du joueur et celle des ennemis vivants.

- [ ] **Étape 5 : commit**

```bash
git add tools/pilot.js test/story.test.js
git commit -m "story: scripted pilot and full-run test" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11 : État d'affichage et partie locale

**Files:**
- Create: `shared/story/state.js`
- Modify: `public/js/localgame.js` (imports, constructeur, `absorb`, `view`)
- Test: `test/story-client.test.js` (nouveau)

**Interfaces:**
- Consumes: événements de `StoryMatch` (tâches 7 et 8), `StoryMatch` (tâche 7).
- Produces:
  - `new StoryState(you)` avec `apply(ev)` et `prune(t)`. Champs lus par le rendu et l'interface : `room` (`{ i, ch, n, of, type, decor, entry, exit, door, trap, boss }` ou `null`), `cleared`, `chest` (`{ x, y, boss, opened }` ou `null`), `warns` (`[{ x, y, r, at, t }]`), `exit` (`{ n, of, until }`), `boss` (`{ id, key, phase }` ou `null`), `offer` (`{ cards, heal }` ou `null`), `say` (`{ k, t }` ou `null`), `result` (événement `storyEnd` ou `null`), `runStart` (temps ou `null`).
  - `new LocalGame({ kind: 'story', name, seed })`. `view()` renvoie en plus `story` (le `StoryState`) et `mobs` : `[{ id, name, color, x, y, st, alive, hp }]`, où `st` est l'unité (champs `mob`, `elite`, `boss`, `r`, `maxHp`, `hp`, `ang`…).

- [ ] **Étape 1 : écrire les tests qui échouent**

**Créer `test/story-client.test.js` :**

```js
// Tests du mode histoire côté client : état reconstruit à partir des événements, partie locale.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StoryState } from '../shared/story/state.js';
import { LocalGame } from '../public/js/localgame.js';

const ROOM0 = {
  e: 'room', t: 0, rules: { playAt: 5, w: 1600, h: 900 }, i: 0, ch: 0, n: 1, of: 5, type: 'combat', decor: 'runes',
  entry: 'W', exit: 'E', door: { x0: 1490, y0: 330, x1: 1600, y1: 570 }, trap: null, boss: null,
};
const ROOM1 = {
  e: 'room', t: 16, rules: { playAt: 17.5, w: 1400, h: 800 }, i: 1, ch: 0, n: 2, of: 5, type: 'combat', decor: 'dalles',
  entry: 'W', exit: 'N', door: { x0: 580, y0: 0, x1: 820, y1: 110 }, trap: 'fleches', boss: null,
};

test('l\'état de la salle se reconstruit à partir des événements', () => {
  const s = new StoryState('a');
  assert.equal(s.room, null);
  s.apply(ROOM0);
  assert.equal(s.room.decor, 'runes');
  assert.deepEqual(s.room.door, ROOM0.door);
  assert.equal(s.runStart, 5);
  s.apply({ e: 'warn', x: 900, y: 400, r: 28, at: 5, t: 0 });
  s.prune(4);
  assert.equal(s.warns.length, 1);
  s.prune(6);
  assert.equal(s.warns.length, 0);
  s.apply({ e: 'boss', id: 'm9', key: 'gardien', phase: 2, t: 9 });
  assert.deepEqual(s.boss, { id: 'm9', key: 'gardien', phase: 2 });
  s.apply({ e: 'die', id: 'm3', t: 10 });
  assert.ok(s.boss, 'la mort d\'un autre ennemi ne retire pas le boss');
  s.apply({ e: 'die', id: 'm9', t: 10 });
  assert.equal(s.boss, null);
  s.apply({ e: 'warn', x: 100, y: 100, r: 28, at: 99, t: 10 });
  s.apply({ e: 'clear', i: 0, chest: { x: 800, y: 450, boss: false }, t: 11 });
  assert.equal(s.cleared, true);
  assert.deepEqual(s.warns, [], 'plus d\'apparition annoncée une fois la salle vidée');
  assert.deepEqual(s.chest, { x: 800, y: 450, boss: false, opened: false });
  s.apply({ e: 'offer', id: 'b', cards: [], heal: 30, t: 12 });
  assert.equal(s.offer, null, 'le tirage d\'un autre joueur ne nous concerne pas');
  s.apply({ e: 'offer', id: 'a', cards: [{ ab: 'bond', rar: 1, slot: 'E' }], heal: 30, t: 12 });
  assert.equal(s.offer.cards.length, 1);
  assert.equal(s.offer.heal, 30);
  s.apply({ e: 'looted', id: 'b', t: 13 });
  assert.ok(s.offer, 'le choix d\'un autre joueur ne ferme pas notre tirage');
  s.apply({ e: 'looted', id: 'a', t: 13 });
  assert.equal(s.offer, null);
  assert.equal(s.chest.opened, true);
  s.apply({ e: 'exit', n: 1, of: 2, until: 30, t: 14 });
  assert.deepEqual(s.exit, { n: 1, of: 2, until: 30 });
  s.apply({ e: 'say', k: 'intro', t: 14 });
  assert.deepEqual(s.say, { k: 'intro', t: 14 });
});

test('un tirage encore ouvert disparaît au changement de salle', () => {
  const s = new StoryState('a');
  s.apply(ROOM0);
  s.apply({ e: 'clear', i: 0, chest: { x: 800, y: 450, boss: false }, t: 11 });
  s.apply({ e: 'offer', id: 'a', cards: [], heal: 30, t: 15 });
  s.apply(ROOM1);
  assert.equal(s.offer, null);
  assert.equal(s.cleared, false);
  assert.equal(s.chest, null);
  assert.deepEqual(s.exit, { n: 0, of: 0, until: 0 });
  assert.equal(s.room.i, 1);
  assert.equal(s.runStart, 5, 'le chrono de la run ne repart pas');
  s.apply({ e: 'storyEnd', win: false, ch: 0, n: 2, cleared: 1, time: 40, stats: {}, kits: {}, t: 56 });
  assert.equal(s.result.win, false);
});

test('partie locale : la vue expose les ennemis et l\'état de la salle', () => {
  const g = new LocalGame({ kind: 'story', name: 'Tim', seed: 1 });
  assert.equal(g.kind, 'story');
  let v = g.view();
  assert.equal(v.kind, 'story');
  assert.equal(v.phase.name, 'countdown');
  assert.equal(v.story.room.i, 0);
  assert.equal(v.me.build.W, null);
  assert.deepEqual(v.mobs, []);
  assert.ok(v.story.warns.length > 0);
  assert.equal(v.rules.w, g.match.rooms[0].w);
  let now = 0;
  g.update(now);
  for (let i = 0; i < 60 * 6; i++) {
    now += 1 / 60;
    g.update(now);
  }
  v = g.view();
  assert.equal(v.phase.name, 'playing');
  assert.ok(v.mobs.length > 0);
  const mob = v.mobs[0];
  assert.ok(mob.st.mob && mob.color && mob.alive && Number.isFinite(mob.x) && mob.st.r > 0);
  assert.equal(v.players.length, 1);
  assert.equal(v.players[0].name, 'Tim');
  assert.equal(v.players[0].isYou, true);
  // Une commande de butin passe par la partie locale sans erreur.
  g.input({ k: 'loot', i: 0 });
  assert.equal(g.match.room.offers.size, 0);
});

test('partie locale : la fin de run passe la phase à « over »', () => {
  const g = new LocalGame({ kind: 'story', name: 'Tim', seed: 1 });
  const m = g.match, h = m.players.get('you');
  for (let i = 0; i < 60 * 6; i++) m.step();
  m.hit({ id: 99, dmg: 100000, owner: null, team: 'M', def: 'test', kind: 'line' }, h, m.time, h.x, h.y);
  g.absorb(m.drainEvents());
  assert.equal(g.view().phase.name, 'over');
  assert.equal(g.view().story.result.win, false);
});

test('les autres modes de la partie locale ne changent pas', () => {
  const g = new LocalGame({ kind: 'survival', settings: { difficulty: 'normal' }, seed: 1 });
  const v = g.view();
  assert.equal(v.kind, 'survival');
  assert.equal(v.story, undefined);
  assert.equal(v.mobs, undefined);
});
```

- [ ] **Étape 2 : lancer les tests et constater l'échec**

Run: `node --test test/story-client.test.js`
Expected: FAIL au chargement : module `shared/story/state.js` introuvable.

- [ ] **Étape 3 : écrire l'état d'affichage**

**Créer `shared/story/state.js` :**

```js
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
```

- [ ] **Étape 4 : brancher la partie locale**

Dans `public/js/localgame.js`, ajouter aux imports :

```js
import { StoryMatch } from '../../shared/story/match.js';
import { StoryState } from '../../shared/story/state.js';
```

Remplacer le commentaire placé au-dessus du constructeur et le début du constructeur, jusqu'à la ligne `this.settings = this.match.settings;` comprise, par :

```js
  // kind : 'survival' | 'versus' | 'story' ; bots : nombre d'IA adverses ; demo : une IA joue seule (fond du menu)
  constructor({ kind, name = 'Toi', settings = {}, bots = 0, botLevel = 'normal', demo = false, seed, build }) {
    this.kind = kind;
    this.you = demo ? null : 'you';
    if (kind === 'story') {
      this.match = new StoryMatch({ players: [{ id: 'you', name }], time: 0, seed });
    } else {
      const players = [];
      if (demo) players.push({ id: 'demo', name: 'IA', color: PLAYER_COLORS[0], bot: true, botLevel: 'difficile' });
      else players.push({ id: 'you', name, color: PLAYER_COLORS[0], build });
      for (let i = 0; i < bots; i++) {
        players.push({ id: 'b' + i, name: botName(i), color: PLAYER_COLORS[(i + 1) % PLAYER_COLORS.length], bot: true, botLevel, build: randomBuild() });
      }
      this.match = new Match({ kind, players, settings, time: 0, seed });
    }
    this.story = kind === 'story' ? new StoryState(this.you) : null;
    this.settings = this.match.settings;
```

Dans `absorb`, remplacer :

```js
    for (const ev of events) {
      switch (ev.e) {
```

par :

```js
    for (const ev of events) {
      if (this.story) this.story.apply(ev);
      switch (ev.e) {
        case 'room':
          this.spells.clear();
          this.phase = { name: 'countdown', round: ev.i + 1, scores: {}, winner: null };
          break;
        case 'storyEnd':
          this.phase = { ...this.phase, name: 'over' };
          break;
```

Dans `view`, remplacer le `return { … };` final par :

```js
    const view = {
      t,
      kind: this.kind,
      rules: m.rules,
      phase: this.phase,
      you: this.you,
      me: this.you ? m.players.get(this.you) : null,
      players,
      spells: [...this.spells.values()],
      roundsToWin: this.settings.roundsToWin,
    };
    if (this.story) {
      this.story.prune(t);
      view.story = this.story;
      view.mobs = [...m.mobs.values()].map((u) => {
        const e = extrapolate(u, m.time, this.acc, m.rules);
        return { id: u.id, name: u.name, color: u.color, x: e.x, y: e.y, st: u, alive: u.alive, hp: u.hp };
      });
    }
    return view;
```

- [ ] **Étape 5 : lancer les tests**

Run: `node --test test/story-client.test.js`
Expected: PASS, 5 tests.

Run: `npm test`
Expected: tous les tests passent.

- [ ] **Étape 6 : commit**

```bash
git add shared/story/state.js public/js/localgame.js test/story-client.test.js
git commit -m "story: display state from events, local game support" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12 : Rendu du mode histoire

**Files:**
- Create: `public/js/draw.js` (outils sortis de `render.js`)
- Create: `public/js/render-story.js`
- Modify: `public/js/render.js` (imports, constructeur, `buildFloor`, `render`, `drawStatus`, `drawAbilityBar`, `drawSlot`, `drawHud`, `drawCenter`)
- Test: `test/render.test.js` (nouveau)

**Interfaces:**
- Consumes: vue de `LocalGame` avec `story` et `mobs` (tâche 11), `RARITIES` (tâche 2), `CHAPTERS` (tâche 6), `BOSSES` (tâche 5), `Pilot` (tâche 10).
- Produces:
  - `draw.js` : `FONT_D`, `FONT_B`, `C`, `rgba(hex, a)`, `mix(hex, hex2, k)`.
  - `render-story.js` : `THEMES`, `HOSTILE`, `floorStyle(view)` → `{ key, theme, decor }`, `drawStoryGround(ctx, r, view, t)`, `drawMobs(ctx, r, view, t)`, `drawMobOverheads(ctx, view)`, `drawStoryTop(ctx, r, view, s, t)`, `drawStoryOverlay(ctx, r, view, s, t)`. `r` est le `Renderer`, `s` l'échelle de l'interface.
  - `Renderer.drawStatus(ctx, p, st, t, rad)` accepte un rayon.

Le rendu se teste sans navigateur : un faux contexte canvas accepte tous les appels, et le test échoue si le code de dessin lève une erreur.

- [ ] **Étape 1 : écrire le test qui échoue**

**Créer `test/render.test.js` :**

```js
// Test de fumée du rendu : le code de dessin s'exécute sans erreur sur de vraies vues de jeu.
// Le canvas est simulé : toute méthode est acceptée, les propriétés écrites sont relues telles quelles.
import { test } from 'node:test';
import assert from 'node:assert/strict';

let calls = 0;

function fakeCtx() {
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get(o, k) {
      if (k in o) return o[k];
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
      if (k === 'measureText') return (s) => ({ width: String(s).length * 7 });
      return () => {
        calls++;
      };
    },
    set(o, k, v) {
      o[k] = v;
      return true;
    },
  });
}

const fakeCanvas = () => ({ width: 0, height: 0, style: {}, getContext: () => fakeCtx() });
globalThis.window = { devicePixelRatio: 1, innerWidth: 1600, innerHeight: 900 };
globalThis.document = { createElement: () => fakeCanvas() };

const { Renderer } = await import('../public/js/render.js');
const { Fx } = await import('../public/js/fx.js');
const { LocalGame } = await import('../public/js/localgame.js');
const { Pilot } = await import('../tools/pilot.js');

function renderer() {
  const r = new Renderer(fakeCanvas());
  r.setMode('game');
  return r;
}

test('rendu des modes existants', () => {
  const r = renderer();
  const games = [
    new LocalGame({ kind: 'survival', settings: { difficulty: 'difficile' }, seed: 2 }),
    new LocalGame({ kind: 'versus', bots: 2, settings: { roundsToWin: 1, env: 'chaos' }, seed: 2 }),
  ];
  for (const g of games) {
    const fx = new Fx();
    for (let i = 0; i < 60 * 12; i++) {
      g.match.step();
      g.absorb(g.match.drainEvents());
      if (i % 20 === 0) {
        r.render(g.view(), fx, { aim: { slot: 'QWERDF'[(i / 20) % 6], x: 500, y: 300 }, perf: { fps: 60, ping: null }, best: 0, dodges: 0, survived: 0 });
      }
    }
  }
  assert.ok(calls > 1000);
});

test('rendu d\'une run histoire complète, salle après salle', () => {
  const r = renderer();
  const fx = new Fx();
  const g = new LocalGame({ kind: 'story', name: 'Tim', seed: 11 });
  const pilot = new Pilot(g.match, 'you', { god: true });
  const seen = new Set();
  for (let i = 0; i < 60 * 60 * 40 && !g.match.over; i++) {
    pilot.update();
    g.match.step();
    g.absorb(g.match.drainEvents());
    if (i % 15 === 0) {
      const v = g.view();
      for (const m of v.mobs) seen.add(m.st.mob);
      // Visée sur chaque touche à tour de rôle, y compris une touche encore vide.
      r.render(v, fx, { aim: { slot: 'QWERDF'[(i / 15) % 6], x: 700, y: 300 }, perf: { fps: 60, ping: 20 } });
    }
  }
  assert.equal(g.match.result.win, true);
  for (const k of ['gardien', 'forgeronne', 'archonte']) assert.ok(seen.has(k), `${k} dessiné`);
  r.render(g.view(), fx, {});
});

test('rendu de chaque ennemi, de chaque boss et des éléments de salle', () => {
  const r = renderer();
  const fx = new Fx();
  const g = new LocalGame({ kind: 'story', name: 'Tim', seed: 2 });
  const m = g.match;
  const sync = (n) => {
    for (let i = 0; i < n; i++) {
      m.step();
      g.absorb(m.drainEvents());
    }
  };
  sync(60 * 6);
  const h = m.players.get('you');
  h.maxHp = 100000;
  h.hp = 100000;
  let x = 300;
  for (const type of ['rodeur', 'tireur', 'bombe', 'pyro', 'belier', 'sentinelle']) {
    m.addMob({ type, elite: false, x, y: 250 }, m.time);
    m.addMob({ type, elite: true, x, y: 550 }, m.time);
    x += 130;
  }
  for (const boss of ['gardien', 'forgeronne', 'archonte']) m.addMob({ boss, x: (x += 60), y: 400 }, m.time);
  const target = [...m.mobs.values()].find((u) => u.mob === 'sentinelle');
  m.hit({ id: 98, dmg: 1, stun: 1, root: 1, slow: 0.3, slowDur: 1, mark: 2, markDmg: 5, owner: 'you', team: 'P', def: 'flux', kind: 'line' }, target, m.time, target.x, target.y);
  m.botCommand('you', { k: 'attack', id: target.id });
  const before = calls;
  for (let i = 0; i < 60 * 5; i++) {
    sync(1);
    if (i % 6 === 0) r.render(g.view(), fx, {});
  }
  assert.ok(calls > before + 5000);
  // Salle vidée : coffre, porte ouverte, consigne.
  for (const u of m.mobs.values()) if (u.alive) m.kill(u, null, m.time);
  sync(3);
  assert.equal(g.view().story.cleared, true);
  r.render(g.view(), fx, {});
  h.x = m.room.chest.x;
  h.y = m.room.chest.y;
  sync(1);
  g.input({ k: 'loot', i: -1 });
  sync(1);
  assert.equal(g.view().story.chest.opened, true);
  r.render(g.view(), fx, {});
  // Éléments de coop : allié, joueur à terre, compteur de porte.
  const v = g.view();
  v.players.push({ ...v.players[0], id: 'ally', name: 'Ami', isYou: false, color: '#4ade80' });
  v.players.push({ ...v.players[0], id: 'down', name: 'Tombé', isYou: false, alive: false, color: '#f1f5f9' });
  v.story.exit = { n: 1, of: 2, until: v.t + 5 };
  r.render(v, fx, {});
  v.me = { ...v.me, alive: false };
  v.players[0].alive = false;
  r.render(v, fx, {});
});
```

- [ ] **Étape 2 : lancer le test et constater l'échec**

Run: `node --test test/render.test.js`
Expected: FAIL. « rendu des modes existants » passe déjà. « rendu d'une run histoire complète » échoue sur `g.match.result.win` ou sur une erreur de dessin (`ab` indéfini dans `drawAbilityBar`, touche vide). C'est la preuve que le test exerce bien le rendu.

- [ ] **Étape 3 : sortir les outils de dessin communs**

**Créer `public/js/draw.js` :**

```js
// Couleurs, polices et outils de dessin communs au rendu de l'arène et du mode histoire.

import { ENV_COLOR } from '../../shared/constants.js';

export const FONT_D = '"Big Shoulders Display", "Barlow", sans-serif';
export const FONT_B = '"Barlow", system-ui, sans-serif';
export const C = {
  night: '#10161f', stone: '#1b2430', stoneHi: '#263241', line: '#33404f',
  chalk: '#e9eef3', mist: '#93a1b0', self: '#5ee08f', enemy: '#ef4b54', shield: '#f1f5f9', env: ENV_COLOR,
};

export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function mix(hex, hex2, k) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(hex2.slice(1), 16);
  const ch = (s) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}
```

Dans `public/js/render.js`, remplacer tout ce qui se trouve entre le commentaire d'en-tête et la ligne `// Points de bouclier encore actifs d'un joueur.` (les imports, `FONT_D`, `FONT_B`, `C`, `SLOT_TINT`, `HUD_SLOTS`, `rgba` et `mix`) par :

```js
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
```

- [ ] **Étape 4 : écrire le rendu du mode histoire**

**Créer `public/js/render-story.js` :**

```js
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
```

- [ ] **Étape 5 : brancher le rendu dans `Renderer`**

Dans `public/js/render.js`, constructeur, remplacer :

```js
    this.aw = ARENA_W;
    this.ah = ARENA_H;
    this.resize();
```

par :

```js
    this.aw = ARENA_W;
    this.ah = ARENA_H;
    this.floorStyle = floorStyle(null);   // palette et décor du sol (changent par salle en mode histoire)
    this.floorKey = this.floorStyle.key;
    this.resize();
```

Dans `buildFloor`, deux changements. Les quatre lignes du dégradé de base (`const base = …` et ses trois `addColorStop` aux couleurs `#223042`, `#19222f`, `#111821`) sont remplacées par :

```js
    const { theme, decor } = this.floorStyle;
    const base = g.createRadialGradient(cx, cy, 40, cx, cy, (980 * this.aw) / ARENA_W);
    base.addColorStop(0, theme.base[0]);
    base.addColorStop(0.55, theme.base[1]);
    base.addColorStop(1, theme.base[2]);
```

Le bloc des gravures (du commentaire `// Cercles gravés au centre (arène de duel).` jusqu'à la boucle des 48 petites marques comprise) est remplacé par :

```js
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
```

Le reste de `buildFloor` (dalles, joints, grain, ombre des murs, liseré) ne change pas. Avec le style par défaut (`THEMES[0]`, `cercles`), le sol est identique à celui d'aujourd'hui.

Remplacer la méthode `render` par :

```js
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
```

Changer la signature de `drawStatus` en `drawStatus(ctx, p, st, t, rad = R)`, puis remplacer chacun des 10 `R` du corps de cette méthode par `rad` (`R + 12` deux fois, `R + 16`, `R + 14`, `R + 5`, `R * 2`, `R`, `R + 8` deux fois, `p.y - R - 12`). Vérifier :

Run: `awk '/^  drawStatus\(/,/^  drawOverheads\(/' public/js/render.js | grep -cw R`
Expected: `1` (la valeur par défaut `rad = R` de la signature).

Dans `drawAbilityBar`, remplacer la boucle `HUD_SLOTS.forEach(...)` par :

```js
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
```

Dans `drawSlot`, ajouter le paramètre `edge` à la signature (`drawSlot(ctx, x, y, size, slot, ab, ok, remain, blocked, s, edge)`), remplacer :

```js
    ctx.strokeStyle = remain > 0 || !ok ? 'rgba(147,161,176,0.35)' : rgba(mix(tint, '#ffffff', 0.4), 0.85);
    ctx.lineWidth = 2;
```

par :

```js
    if (edge) ctx.strokeStyle = rgba(edge, remain > 0 || !ok ? 0.5 : 1);
    else ctx.strokeStyle = remain > 0 || !ok ? 'rgba(147,161,176,0.35)' : rgba(mix(tint, '#ffffff', 0.4), 0.85);
    ctx.lineWidth = edge ? 3 : 2;
```

et remplacer la fin de la méthode, du commentaire `// Touche associée` jusqu'au `ctx.restore();` final, par :

```js
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
```

Dans `drawHud`, remplacer :

```js
    if (view.kind === 'survival') this.drawSurvivalTop(ctx, view, s, t, ui);
    else this.drawVersusTop(ctx, view, s, t);
    this.drawCenter(ctx, view, fx, s, t);
```

par :

```js
    if (view.kind === 'survival') this.drawSurvivalTop(ctx, view, s, t, ui);
    else if (view.kind === 'story') drawStoryTop(ctx, this, view, s, t);
    else this.drawVersusTop(ctx, view, s, t);
    this.drawCenter(ctx, view, fx, s, t);
    if (view.kind === 'story') drawStoryOverlay(ctx, this, view, s, t);
```

Dans `drawCenter`, remplacer `if (phase.name === 'countdown' && view.rules) {` par (le titre de la salle remplace le gros décompte chiffré) :

```js
    if (phase.name === 'countdown' && view.rules && view.kind !== 'story') {
```

- [ ] **Étape 6 : lancer les tests**

Run: `node --test test/render.test.js`
Expected: PASS, 3 tests.

Run: `npm test`
Expected: tous les tests passent.

- [ ] **Étape 7 : vérifier que le jeu actuel s'affiche comme avant**

Lancer `npm start`, ouvrir http://localhost:3000 et démarrer une partie de Survie puis une partie Contre l'IA. Le sol, les sorts, la barre de sorts et le haut d'écran sont identiques à avant. La console du navigateur ne montre aucune erreur.

- [ ] **Étape 8 : commit**

```bash
git add public/js/draw.js public/js/render-story.js public/js/render.js test/render.test.js
git commit -m "story: rendering of rooms, enemies, bosses and hud" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13 : Menu et lancement d'une run solo

**Files:**
- Create: `public/js/story-ui.js` (record)
- Modify: `public/js/settings.js` (`DEFAULTS`, `load`)
- Modify: `public/js/audio.js` (`play` : 5 sons, paramètre de hauteur)
- Modify: `public/index.html` (section « Histoire » du menu)
- Modify: `public/js/main.js` (imports, état, contrôles, `initMenu`, `endSession`, `startStory`, `playerById`, `handleEvents`, `timedEffects`, `frame`)
- Test: `test/story-client.test.js`

**Interfaces:**
- Consumes: `LocalGame({ kind: 'story' })` (tâche 11), rendu (tâche 12), événements `room`, `spawn`, `clear`, `heal`, `revive`, `boss` (tâches 7, 8, 16).
- Produces:
  - `settings.story = { bestRooms, wins, bestTime }`.
  - `story-ui.js` : `saveStoryRecord(ev)` (`ev` : `{ win, cleared, time }`), `storyBestLine()` → texte.
  - `Sfx.play(name, vol, k)` : sons `spawn`, `chest`, `pick` (`k` = rareté 0 à 3), `door`, `boss`.
  - Dans `main.js` : `sessionType === 'story'` pour une run solo, `isStory()` (vrai aussi pour une run en ligne), `mobLook` (`Map` id → `{ name, color, r, boss }`), `playerById(view, id)` cherche aussi parmi les ennemis.

- [ ] **Étape 1 : écrire le test qui échoue**

**Ajouter à la fin de `test/story-client.test.js` :**

```js

// ---------------------------------------------------------------- record

import { settings } from '../public/js/settings.js';
import { storyBestLine, saveStoryRecord } from '../public/js/story-ui.js';

test('record du mode histoire', () => {
  assert.deepEqual(settings.story, { bestRooms: 0, wins: 0, bestTime: 0 });
  assert.equal(storyBestLine(), 'Aucune descente pour l\'instant.');
  saveStoryRecord({ win: false, cleared: 1, time: 60 });
  assert.equal(storyBestLine(), 'Meilleure descente : 1 salle sur 15.');
  saveStoryRecord({ win: false, cleared: 4, time: 300 });
  saveStoryRecord({ win: false, cleared: 2, time: 90 });
  assert.equal(settings.story.bestRooms, 4, 'le record ne baisse pas');
  assert.equal(storyBestLine(), 'Meilleure descente : 4 salles sur 15.');
  saveStoryRecord({ win: true, cleared: 15, time: 1000 });
  saveStoryRecord({ win: true, cleared: 15, time: 800 });
  saveStoryRecord({ win: true, cleared: 15, time: 950 });
  assert.deepEqual(settings.story, { bestRooms: 15, wins: 3, bestTime: 800 });
  assert.equal(storyBestLine(), 'Meilleure descente : 15 salles sur 15 · 3 victoires, meilleur temps 13:20.0.');
});
```

- [ ] **Étape 2 : lancer le test et constater l'échec**

Run: `node --test test/story-client.test.js`
Expected: FAIL au chargement : module `public/js/story-ui.js` introuvable.

- [ ] **Étape 3 : record et sons**

Dans `public/js/settings.js`, ajouter à `DEFAULTS`, après la ligne `best: { … },` :

```js
  story: { bestRooms: 0, wins: 0, bestTime: 0 },   // mode histoire : salles vidées au mieux, victoires, meilleur temps
```

et dans `load`, dans l'objet renvoyé, après la ligne `best: { ...DEFAULTS.best, ...(s.best || {}) },` :

```js
      story: { ...DEFAULTS.story, ...(s.story || {}) },
```

**Créer `public/js/story-ui.js` :**

```js
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
```

Dans `public/js/audio.js`, remplacer la signature `play(name, vol = 1) {` par :

```js
  // vol : 0..1 (atténuation selon la distance, par exemple). k : variante du son (rareté du sort pris).
  play(name, vol = 1, k = 0) {
```

(en retirant l'ancien commentaire `// vol : 0..1 …` placé au-dessus), puis ajouter ces cas dans le `switch`, avant `case 'ui':` :

```js
      case 'spawn':
        this.noise(0.25, 0.14 * v, 300, 1400, 1.2);
        this.tone('sine', 140, 280, 0.22, 0.12 * v);
        break;
      case 'chest':
        this.tone('triangle', 392, 392, 0.12, 0.14 * v);
        this.tone('triangle', 587, 587, 0.2, 0.14 * v, 0.1);
        break;
      case 'pick':
        // Deux notes pour un sort commun, une de plus par niveau de rareté.
        [0, 4, 7, 12, 16].slice(0, 2 + k).forEach((st, i) => {
          const f = 523 * 2 ** (st / 12);
          this.tone('triangle', f, f, 0.2, 0.14 * v, i * 0.07);
        });
        break;
      case 'door':
        this.noise(0.35, 0.2 * v, 500, 120, 0.8, 'lowpass');
        this.tone('sine', 90, 60, 0.3, 0.2 * v);
        break;
      case 'boss':
        this.tone('sawtooth', 110, 55, 0.9, 0.12 * v);
        this.tone('sine', 55, 41, 1.1, 0.3 * v);
        this.noise(0.8, 0.16 * v, 700, 90, 0.7, 'lowpass');
        break;
```

- [ ] **Étape 4 : section « Histoire » du menu**

Dans `public/index.html`, juste après `<div class="modes" id="modes">`, ajouter :

```html
      <section class="mode open" data-mode="story">
        <button class="mode-head" aria-expanded="true" aria-controls="mode-story">
          <span class="mode-title">Histoire</span>
          <span class="mode-desc">Descends sous l'Arène de salle en salle, bats trois boss et retrouve tes sorts dans les coffres.</span>
        </button>
        <div class="mode-body" id="mode-story">
          <p class="hint" id="story-best"></p>
          <div class="button-row">
            <button class="primary" id="play-story">Jouer en solo</button>
          </div>
        </div>
      </section>

```

La section Survie n'est plus ouverte par défaut. Remplacer :

```html
      <section class="mode open" data-mode="survival">
        <button class="mode-head" aria-expanded="true" aria-controls="mode-survival">
```

par :

```html
      <section class="mode" data-mode="survival">
        <button class="mode-head" aria-expanded="false" aria-controls="mode-survival">
```

- [ ] **Étape 5 : lancer une run depuis `main.js`**

Ajouter aux imports de `public/js/main.js` :

```js
import { storyBestLine } from './story-ui.js';
import { HOSTILE } from './render-story.js';
```

Après la ligne `const hud = { best: 0, dodges: 0, survived: 0 };`, ajouter :

```js
const mobLook = new Map(); // apparence des ennemis du mode histoire, gardée pour les effets de leur mort
const isStory = () => !!session && session.kind === 'story';
```

Dans la création de `input`, remplacer les gestionnaires `pick` et `instant` (et leurs commentaires) par :

```js
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
```

Dans `initMenu`, après `$('#play-bots').addEventListener('click', startBots);`, ajouter :

```js
  $('#play-story').addEventListener('click', startStory);
  $('#story-best').textContent = storyBestLine();
```

Dans `endSession`, après `fx.clear();`, ajouter :

```js
  mobLook.clear();
```

Après la fonction `startBots`, ajouter :

```js
function startStory() {
  sfx.unlock();
  endSession();
  hideOverlay('results');
  session = new LocalGame({ kind: 'story', name: currentName() });
  sessionType = 'story';
  showScreen('game');
}
```

Remplacer `playerById` par :

```js
// Joueur ou, en mode histoire, ennemi.
function playerById(view, id) {
  if (!view) return null;
  return view.players.find((p) => p.id === id) || (view.mobs && view.mobs.find((p) => p.id === id)) || null;
}
```

Dans `handleEvents`, cas `'go'`, remplacer la ligne `fx.setBanner(…)` par :

```js
        if (!isStory()) fx.setBanner(sessionType === 'survival' ? 'Survivez' : 'Combattez', '', '#e9eef3', 0.9);
```

Cas `'hit'` : remplacer `const color = owner ? owner.color : ENV_COLOR;` par :

```js
        const color = owner ? owner.color : view.story ? HOSTILE : ENV_COLOR;
```

et remplacer :

```js
        if (target && ev.dmg > 0) {
          fx.number(target.x, target.y - 20, `-${ev.dmg}`, isMe ? '#ff6b6b' : ev.by === view.you ? '#fde68a' : '#e9eef3', ev.dmg >= 25);
        }
```

par (un ennemi tué par ce coup n'est déjà plus dans la vue : le nombre s'affiche au point d'impact) :

```js
        if (ev.dmg > 0) {
          const at = target || { x: ev.x, y: ev.y };
          fx.number(at.x, at.y - 20, `-${ev.dmg}`, isMe ? '#ff6b6b' : ev.by === view.you ? '#fde68a' : '#e9eef3', ev.dmg >= 25);
        }
```

Remplacer tout le cas `'die'` par :

```js
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
```

Ajouter ces cas dans le `switch` de `handleEvents`, avant `case 'left':` :

```js
      case 'room':
        fx.clear();
        lastCount = 0;
        mobLook.clear();
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
```

Dans `timedEffects`, remplacer `colorOf` par :

```js
  const colorOf = (owner) => {
    const p = owner && playerById(view, owner);
    return p ? p.color : view.story ? HOSTILE : ENV_COLOR;
  };
```

Dans `frame`, remplacer `if (view.phase.name === 'countdown' && view.rules) {` par (pas de bips de décompte à l'entrée d'une salle) :

```js
    if (view.phase.name === 'countdown' && view.rules && view.kind !== 'story') {
```

- [ ] **Étape 6 : lancer les tests**

Run: `node --test test/story-client.test.js`
Expected: PASS, 6 tests.

Run: `npm test`
Expected: tous les tests passent.

- [ ] **Étape 7 : vérifier à l'écran**

Lancer `npm start` et ouvrir http://localhost:3000. Vérifier, console du navigateur ouverte :

1. Le menu montre « Histoire » en premier, ouvert, avec « Aucune descente pour l'instant. » et le bouton « Jouer en solo ». Survie, Contre l'IA et En ligne s'ouvrent toujours au clic.
2. « Jouer en solo » affiche « Salle 1 » et « Chapitre 1 : Les Catacombes », puis des cercles rouges, puis les ennemis.
3. La barre de sorts montre le Q avec une bordure grise et cinq cases vides marquées d'un tiret.
4. Q touche les ennemis, un clic droit sur un ennemi lance l'auto-attaque, les nombres de dégâts s'affichent. Les ennemis attaquent avec des zones et des projectiles annoncés.
5. Une fois les ennemis morts : bandeau « Salle vidée », coffre au centre, porte lumineuse sur un côté. En contournant le coffre (sa fenêtre arrive à la tâche 14) et en entrant dans la porte, la salle 2 commence avec une autre taille.
6. Échap met la partie en pause. « Abandonner la partie » ramène au menu.
7. Aucune erreur dans la console.

- [ ] **Étape 8 : commit**

```bash
git add public/js/story-ui.js public/js/settings.js public/js/audio.js public/index.html public/js/main.js test/story-client.test.js
git commit -m "story: menu entry, solo run, in-game events and sounds" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14 : Fenêtre du coffre

**Files:**
- Modify: `public/index.html` (fenêtre `#loot`)
- Modify: `public/style.css` (cartes)
- Modify: `public/js/story-ui.js` (`lootReplaceText`, `renderOffer`)
- Modify: `public/js/main.js` (imports, `OVERLAYS`, `sendCommand`, `openLoot`, `pickLoot`, événements `offer` et `kit`, touches 1 à 3, Échap)
- Test: `test/story-client.test.js`

**Interfaces:**
- Consumes: `StoryState.offer` (tâche 11), commande `{ k: 'loot', i }` (tâche 8), `scaled`, `describe`, `RARITIES` (tâche 2), `iconCanvas(id, slot, size)` de `main.js`.
- Produces:
  - `lootReplaceText(hero, card)` → « Touche vide », « Amélioration : X → Y » ou « Remplace Nom (Rareté) ». `hero` : objet avec `build` et `rar`.
  - `renderOffer(offer, hero, iconCanvas, onPick)` : remplit `#loot-cards`, `#loot-hint`, `#loot-skip`. `onPick(i)` est appelé avec l'indice de la carte cliquée.
  - Dans `main.js` : `sendCommand(cmd)` envoie une commande à la partie locale ou en ligne.

- [ ] **Étape 1 : écrire le test qui échoue**

**Ajouter à la fin de `test/story-client.test.js` :**

```js

// ---------------------------------------------------------------- coffre

import { lootReplaceText } from '../public/js/story-ui.js';

test('carte de coffre : ce que le sort remplace', () => {
  const hero = {
    build: { Q: 'trait', W: null, E: null, R: null, D: 'flash', F: null },
    rar: { Q: 1, W: 0, E: 0, R: 0, D: 0, F: 0 },
  };
  assert.equal(lootReplaceText(hero, { ab: 'salve', rar: 0, slot: 'W' }), 'Touche vide');
  assert.equal(lootReplaceText(hero, { ab: 'trait', rar: 3, slot: 'Q' }), 'Amélioration : Rare → Légendaire');
  assert.equal(lootReplaceText(hero, { ab: 'soin', rar: 2, slot: 'D' }), 'Remplace Flash (Commun)');
});
```

- [ ] **Étape 2 : lancer le test et constater l'échec**

Run: `node --test test/story-client.test.js`
Expected: FAIL au chargement : `story-ui.js` n'exporte pas `lootReplaceText`.

- [ ] **Étape 3 : fenêtre et style**

Dans `public/index.html`, ajouter avant le commentaire `<!-- Build -->` :

```html
  <!-- Coffre (mode histoire) -->
  <section id="loot" class="overlay hidden" role="dialog" aria-modal="true" aria-labelledby="loot-title">
    <div class="panel wide">
      <h2 class="screen-title" id="loot-title">Coffre</h2>
      <p class="hint" id="loot-hint"></p>
      <div class="loot-cards" id="loot-cards"></div>
      <div class="button-row">
        <button class="secondary" id="loot-skip"></button>
      </div>
    </div>
  </section>

```

Dans `public/style.css`, ajouter avant `.toast {` :

```css
/* Coffre du mode histoire : une carte par sort proposé, bordée à la couleur de sa rareté */
.loot-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 18px;
}

.loot-card {
  position: relative;
  display: grid;
  justify-items: start;
  align-content: start;
  gap: 6px;
  padding: 14px;
  background: rgba(16, 22, 31, 0.6);
  border: 2px solid var(--rar);
  text-align: left;
}

.loot-card:hover,
.loot-card:focus-visible {
  background: rgba(233, 238, 243, 0.08);
}

.loot-card canvas {
  width: 56px;
  height: 56px;
}

.loot-key {
  position: absolute;
  top: 8px;
  right: 10px;
  color: var(--mist);
  font: 700 0.875rem var(--font-b);
}

.loot-rar {
  color: var(--rar);
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.loot-name {
  font: 700 1.5625rem/1 var(--font-d);
}

.loot-slot,
.loot-repl {
  margin: 0;
  color: var(--mist);
  font-size: 0.875rem;
  font-weight: 600;
}

.loot-desc {
  margin: 0;
  font-size: 0.9375rem;
}

@media (max-width: 640px) {
  .loot-cards {
    grid-template-columns: 1fr;
  }
}

```

- [ ] **Étape 4 : cartes du coffre**

Dans `public/js/story-ui.js`, remplacer la ligne d'import par :

```js
import { ABILITIES, RARITIES, scaled, describe } from '../../shared/abilities.js';
import { settings, saveSettings, keyLabel, formatTime } from './settings.js';

const $ = (sel) => document.querySelector(sel);
```

**Ajouter à la fin de `public/js/story-ui.js` :**

```js

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
```

- [ ] **Étape 5 : brancher la fenêtre dans `main.js`**

Remplacer l'import de `./story-ui.js` par :

```js
import { storyBestLine, renderOffer } from './story-ui.js';
```

Ajouter `RARITIES` à l'import de `../../shared/abilities.js` :

```js
import { ABILITIES, ENV_SPELLS, spellName, abilityOf, poolFor, sanitizeBuild, BUILD_SLOTS, AUTO, describe, RARITIES } from '../../shared/abilities.js';
```

Dans la création de `input`, remplacer le gestionnaire `command` par :

```js
  command: (cmd) => {
    if (!anyOverlay()) sendCommand(cmd);
  },
```

Dans le gestionnaire `keydown` global (celui qui appelle `sfx.unlock()`), ajouter avant la fermeture de la fonction :

```js
  // Fenêtre du coffre : les touches 1, 2, 3 choisissent une carte.
  if (!$('#loot').classList.contains('hidden') && /^(Digit|Numpad)[1-3]$/.test(e.code)) {
    const card = $$('.loot-card')[Number(e.code.slice(-1)) - 1];
    if (card) {
      e.preventDefault();
      card.click();
    }
  }
```

Remplacer la liste `OVERLAYS` par :

```js
const OVERLAYS = ['results', 'pause', 'settings', 'help', 'build', 'loot'];
```

Dans `endSession`, après `mobLook.clear();`, ajouter :

```js
  hideOverlay('loot');
```

Après la fonction `startStory`, ajouter :

```js
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
```

Dans `onEscape`, ajouter en première ligne (la fenêtre du coffre ne se ferme pas avec Échap) :

```js
  if (!$('#loot').classList.contains('hidden')) return;
```

Dans `handleEvents`, cas `'room'`, ajouter après `mobLook.clear();` :

```js
        hideOverlay('loot');
```

et ajouter ces cas avant `case 'left':` :

```js
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
```

Dans `initResults`, à la fin de la fonction, ajouter :

```js
  $('#loot-skip').addEventListener('click', () => pickLoot(-1));
```

- [ ] **Étape 6 : lancer les tests**

Run: `node --test test/story-client.test.js`
Expected: PASS, 7 tests.

Run: `npm test`
Expected: tous les tests passent.

- [ ] **Étape 7 : vérifier à l'écran**

Lancer `npm start`, jouer une run solo et vider la première salle :

1. En s'approchant du coffre, la fenêtre « Coffre » s'ouvre avec 3 cartes sur 3 touches différentes. Chaque carte a une bordure à la couleur de sa rareté, son icône, son nom, sa touche, sa description chiffrée, sa recharge et « Touche vide ».
2. Un clic sur une carte ferme la fenêtre. Le sort apparaît dans la barre avec sa bordure de rareté et se lance aussitôt avec sa touche.
3. Dans la salle suivante, la touche 2 choisit la deuxième carte. « Passer (+30 PV) » rend des PV (nombre vert au-dessus du joueur).
4. Échap ne ferme pas la fenêtre du coffre.
5. Une carte qui vise une touche déjà occupée affiche « Remplace … » ou « Amélioration : … ».

- [ ] **Étape 8 : commit**

```bash
git add public/index.html public/style.css public/js/story-ui.js public/js/main.js test/story-client.test.js
git commit -m "story: chest window with rarity cards" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15 : Fin de run et record

**Files:**
- Modify: `public/index.html` (`#res-kit`)
- Modify: `public/style.css` (kit de fin de run)
- Modify: `public/js/story-ui.js` (`storyResultLine`, `fillStoryResults`)
- Modify: `public/js/main.js` (import, `showStoryResults`, événement `storyEnd`, bouton « Rejouer », nettoyage de `#res-kit`)
- Test: `test/story-client.test.js`

**Interfaces:**
- Consumes: événement `storyEnd { win, ch, n, cleared, time, stats, kits }` (tâche 7), `saveStoryRecord`, `storyBestLine` (tâche 13), `CHAPTERS` (tâche 6).
- Produces:
  - `storyResultLine(ev)` → « Chapitre 2 : La Forge, salle 3 sur 5. 7 salles vidées en 10:12.3. ».
  - `fillStoryResults(ev, players, you, iconCanvas)` : remplit `#res-title`, `#res-sub`, `#res-kit`, `#res-table`. `players` : `[{ id, name, color }]`.
  - Dans `main.js` : `showStoryResults(ev, players)`.

- [ ] **Étape 1 : écrire le test qui échoue**

**Ajouter à la fin de `test/story-client.test.js` :**

```js

// ---------------------------------------------------------------- fin de run

import { storyResultLine } from '../public/js/story-ui.js';

test('résumé de fin de run', () => {
  assert.equal(
    storyResultLine({ ch: 1, n: 3, cleared: 7, time: 612.3 }),
    'Chapitre 2 : La Forge, salle 3 sur 5. 7 salles vidées en 10:12.3.',
  );
  assert.equal(
    storyResultLine({ ch: 0, n: 2, cleared: 1, time: 45 }),
    'Chapitre 1 : Les Catacombes, salle 2 sur 5. 1 salle vidée en 00:45.0.',
  );
});
```

- [ ] **Étape 2 : lancer le test et constater l'échec**

Run: `node --test test/story-client.test.js`
Expected: FAIL au chargement : `story-ui.js` n'exporte pas `storyResultLine`.

- [ ] **Étape 3 : écran de résultats**

Dans `public/index.html`, dans `#results`, après `<p class="res-sub" id="res-sub"></p>`, ajouter :

```html
      <div class="res-kit" id="res-kit"></div>
```

Dans `public/style.css`, ajouter avant `.panel .button-row {` :

```css
/* Sorts du kit en fin de run (mode histoire) */
.res-kit {
  display: flex;
  gap: 6px;
  margin-top: 16px;
}

.res-kit:empty {
  display: none;
}

.res-kit canvas {
  width: 44px;
  height: 44px;
  border: 2px solid var(--line-hi);
}

```

Dans `public/js/story-ui.js`, remplacer les deux lignes d'import par :

```js
import { ABILITIES, RARITIES, BUILD_SLOTS, scaled, describe } from '../../shared/abilities.js';
import { CHAPTERS } from '../../shared/story/rooms.js';
import { settings, saveSettings, keyLabel, formatTime } from './settings.js';
```

**Ajouter à la fin de `public/js/story-ui.js` :**

```js

// ------------------------------------------------------------ fin de run

export function storyResultLine(ev) {
  const s = ev.cleared > 1 ? 's' : '';
  return `Chapitre ${ev.ch + 1} : ${CHAPTERS[ev.ch].name}, salle ${ev.n} sur 5. ${ev.cleared} salle${s} vidée${s} en ${formatTime(ev.time)}.`;
}

// Remplit l'écran de résultats. players : [{ id, name, color }], you : id du joueur local.
export function fillStoryResults(ev, players, you, iconCanvas) {
  $('#res-title').textContent = ev.win ? 'Victoire' : 'Défaite';
  $('#res-sub').textContent = storyResultLine(ev);
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
```

- [ ] **Étape 4 : brancher la fin de run dans `main.js`**

Remplacer l'import de `./story-ui.js` par :

```js
import { storyBestLine, saveStoryRecord, renderOffer, fillStoryResults } from './story-ui.js';
```

Dans `showSurvivalResults` et dans `showVersusResults`, ajouter après la ligne `$('#res-table').textContent = '';` (dans `showVersusResults` : après `table.textContent = '';`) :

```js
  $('#res-kit').textContent = '';
```

Après la fonction `updateRematchHint`, ajouter :

```js
function showStoryResults(ev, players) {
  fillStoryResults(ev, players, sessionType === 'online' ? online.id : 'you', iconCanvas);
  $('#res-again').textContent = 'Rejouer';
  $('#res-menu').textContent = 'Menu';
  $('#res-hint').textContent = '';
  showOverlay('results');
}
```

Dans `initResults`, gestionnaire de `#res-again`, remplacer :

```js
    else if (sessionType === 'bots') startBots();
```

par :

```js
    else if (sessionType === 'bots') startBots();
    else if (sessionType === 'story') startStory();
```

Dans `handleEvents`, ajouter ce cas avant `case 'left':` :

```js
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
```

- [ ] **Étape 5 : lancer les tests**

Run: `node --test test/story-client.test.js`
Expected: PASS, 8 tests.

Run: `npm test`
Expected: tous les tests passent.

- [ ] **Étape 6 : vérifier à l'écran**

Lancer `npm start`, jouer une run solo et se laisser tuer :

1. Bandeau « Défaite », puis l'écran de résultats : titre, chapitre et salle atteints, temps, les icônes des sorts du kit bordées de leur rareté, une ligne de tableau avec dégâts, éliminations et morts.
2. « Rejouer » (ou Espace) relance une run à la salle 1 avec le seul sort Q.
3. « Menu » ramène au menu, où la ligne de record de la section Histoire est à jour.
4. Après une partie de Survie, l'écran de résultats ne montre aucune icône de kit.

- [ ] **Étape 7 : commit**

```bash
git add public/index.html public/style.css public/js/story-ui.js public/js/main.js test/story-client.test.js
git commit -m "story: end-of-run screen and local record" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16 : Boss — moteur d'attaques et Gardien de pierre

**Files:**
- Modify: `shared/story/bosses.js` (imports, `BossBrain`, kit du Gardien)
- Modify: `shared/story/match.js` (import, `addMob`, `kill`)
- Test: `test/story.test.js`

**Interfaces:**
- Consumes: `match.addSpell`, `match.announce`, `match.mobs`, `match.pending`, `match.rules`, `match.rng`, `MAX_ALIVE`, `SPAWN_WARN` (tâche 6), `cancelEnemySpells` (tâche 7).
- Produces:
  - `new BossBrain(match, unit, def, t)` avec `update(t)`, `phase` (1 à 3) et `queue` (actions programmées). Émet `boss { id, key, phase, t }` à sa création et à chaque changement de phase.
  - Outils pour les kits : `heroes()`, `target()`, `nearest()`, `at(t, run)`, `hold(t, dur, ang)`, `spell(spec)`, `go(x, y)`, `summon(type, n, t)`, `dashThrough(h, t, warn, dur, hw, dmg, def)`, `farPoint(minD)`.
  - Un kit : `{ rest: [s, s, s], attacks: [{ phase, run(b, u, h, t) → durée }], move?(b, u, t), onPhase?(b, u, t) }`.
  - Sorts du Gardien : `b_onde`, `b_poing`, `b_replique`, `b_roche`, `b_charge`.
  - À la mort d'un boss : ses invocations meurent, les apparitions annoncées et les sorts ennemis sont annulés.

- [ ] **Étape 1 : écrire les tests qui échouent**

**Ajouter à la fin de `test/story.test.js` :**

```js

// ---------------------------------------------------------------- boss

// Un joueur immortel et immobile face à un boss, pour observer ses attaques.
function bossFight(key) {
  const m = solo(1);
  stepUntil(m, () => m.mobs.size > 0);
  for (const u of m.mobs.values()) u.alive = false;
  const hero = m.players.get('a');
  hero.maxHp = 100000; hero.hp = 100000;
  hero.x = 300; hero.y = 400; hero.tx = 300; hero.ty = 400; hero.mv = false;
  const boss = m.addMob({ boss: key, x: 900, y: 400 }, m.time);
  const defs = new Set();
  // Avance de `sec` secondes en notant les sorts lancés par le boss.
  const watch = (sec) => {
    const until = m.time + sec;
    stepUntil(m, () => {
      for (const s of m.spells.values()) if (s.owner === boss.id) defs.add(s.def);
      return m.time >= until;
    }, 60 * (sec + 1));
  };
  return { m, hero, boss, brain: m.brains.get(boss.id), defs, watch };
}

// Taille des salves d'une attaque : nombre de sorts annoncés au même instant.
function volleys(m, def) {
  const by = new Map();
  for (const e of m.events) if (e.e === 'sp' && e.s.def === def) by.set(e.s.t0, (by.get(e.s.t0) || 0) + 1);
  return [...by.values()];
}

test('Gardien de pierre : enchaîne ses attaques, change de phase, ignore les contrôles', () => {
  const { m, hero, boss, brain, defs, watch } = bossFight('gardien');
  assert.ok(m.events.some((e) => e.e === 'boss' && e.id === boss.id && e.key === 'gardien' && e.phase === 1));
  watch(20);
  assert.ok(defs.has('b_onde') && defs.has('b_poing') && defs.has('b_replique'), [...defs].join());
  assert.ok(!defs.has('b_roche') && !defs.has('b_charge'), 'attaques réservées aux phases suivantes');
  assert.ok(volleys(m, 'b_onde').length > 0);
  const t = m.time;
  m.hit({ id: 99, dmg: 10, stun: 2, root: 2, pull: 300, ox: 0, oy: 0, owner: 'a', team: 'P', def: 'q', kind: 'line' }, boss, t, boss.x, boss.y);
  assert.ok(!(boss.stunUntil > t) && !(boss.rootUntil > t), 'insensible aux contrôles');
  // Phase 2 : éboulement et invocation de rôdeurs.
  boss.hp = boss.maxHp * 0.6;
  watch(25);
  assert.equal(brain.phase, 2);
  assert.ok(m.events.some((e) => e.e === 'boss' && e.phase === 2));
  assert.ok(defs.has('b_roche'));
  assert.ok(m.events.filter((e) => e.e === 'spawn' && e.u.mob === 'rodeur').length >= 2);
  // Phase 3 : charge à travers la salle.
  boss.hp = boss.maxHp * 0.3;
  watch(25);
  assert.equal(brain.phase, 3);
  assert.ok(defs.has('b_charge'));
  assert.ok(hero.hp < hero.maxHp, 'un joueur immobile est touché');
  assert.ok(m.mobs.size <= 10);
});

test('mort d\'un boss : invocations, annonces et sorts disparaissent, plus rien ne part ensuite', () => {
  const { m, boss, brain } = bossFight('gardien');
  boss.hp = boss.maxHp * 0.6;
  stepUntil(m, () => [...m.mobs.values()].some((u) => u.mob === 'rodeur'), 60 * 30);
  stepUntil(m, () => brain.queue.length > 0, 60 * 60);
  assert.ok(brain.queue.length > 0, 'une attaque programmée est en cours');
  m.kill(boss, null, m.time);
  assert.ok([...m.mobs.values()].every((u) => !u.alive), 'les invocations meurent avec lui');
  assert.equal([...m.spells.values()].filter((s) => s.team === 'M').length, 0);
  assert.equal(m.pending.length, 0);
  const until = m.time + 3;
  stepUntil(m, () => m.time >= until, 60 * 4);
  assert.equal([...m.spells.values()].filter((s) => s.team === 'M').length, 0, 'aucune attaque programmée ne part après sa mort');
  assert.equal(m.room.cleared, true);
});
```

- [ ] **Étape 2 : lancer les tests et constater l'échec**

Run: `node --test test/story.test.js`
Expected: FAIL. « Gardien de pierre » échoue : aucun événement `boss`, `brain` vaut `undefined`.

- [ ] **Étape 3 : écrire le moteur d'attaques et le kit du Gardien**

Dans `shared/story/bosses.js`, remplacer l'import par :

```js
import { clamp, rayToRect, gauss, round2 } from '../util.js';
import { MOB_TEAM } from './mobs.js';
import { MAX_ALIVE, SPAWN_WARN } from './rooms.js';
```

**Ajouter à la fin de `shared/story/bosses.js` :**

```js

// ---------------------------------------------------------------- moteur d'attaques

const DEG = Math.PI / 180;

function shuffle(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Point ramené dans la salle.
function inRoom(b, x, y) {
  const { w, h } = b.m.rules;
  return { x: clamp(x, 0, w), y: clamp(y, 0, h) };
}

// IA d'un boss : trois phases selon ses PV, un cycle d'attaques par phase, des sous-attaques programmées.
export class BossBrain {
  constructor(match, unit, def, t) {
    this.m = match;
    this.u = unit;
    this.def = def;
    this.kit = KITS[unit.mob];
    this.phase = 1;
    this.queue = [];             // sous-attaques programmées : { at, run }
    this.busyUntil = t + 1.2;    // fin de l'attaque en cours, pause comprise
    this.nextMove = t;
    this.rot = [];               // attaques restantes du cycle
    this.turn = 0;               // alternance des cibles
    this.bondAt = 0;
    match.emit({ e: 'boss', id: unit.id, key: unit.mob, phase: 1, t });
  }

  heroes() {
    return this.m.order.map((id) => this.m.players.get(id)).filter((p) => p.alive);
  }

  // Cible de la prochaine attaque : les joueurs vivants, à tour de rôle.
  target() {
    const alive = this.heroes();
    return alive.length ? alive[this.turn++ % alive.length] : null;
  }

  nearest() {
    let best = null, bd = Infinity;
    for (const p of this.heroes()) {
      const d = Math.hypot(p.x - this.u.x, p.y - this.u.y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  // Programme une sous-attaque. Elle ne part pas si le boss meurt avant.
  at(t, run) {
    this.queue.push({ at: t, run });
  }

  update(t) {
    const u = this.u;
    if (!u.alive || !this.kit) return;
    if (this.queue.some((a) => a.at <= t)) {
      const due = this.queue.filter((a) => a.at <= t);
      this.queue = this.queue.filter((a) => a.at > t);
      for (const a of due) a.run(t);
    }
    const phase = u.hp > u.maxHp * 0.66 ? 1 : u.hp > u.maxHp * 0.33 ? 2 : 3;
    if (phase > this.phase) {
      this.phase = phase;
      this.rot = [];
      this.m.emit({ e: 'boss', id: u.id, key: u.mob, phase, t });
      if (this.kit.onPhase) this.kit.onPhase(this, u, t);
    }
    if (t >= this.busyUntil) {
      if (!this.rot.length) this.rot = shuffle(this.kit.attacks.filter((a) => a.phase <= this.phase), this.m.rng);
      const h = this.target();
      if (!h) return;
      const dur = this.rot.pop().run(this, u, h, t);
      this.busyUntil = t + dur + this.kit.rest[this.phase - 1];
    } else if (this.kit.move && t >= this.nextMove && t >= u.castUntil && !u.dash) {
      this.nextMove = t + 0.15;
      this.kit.move(this, u, t);
    }
  }

  // Immobilise le boss pendant la préparation d'une attaque.
  hold(t, dur, ang) {
    const u = this.u;
    u.mv = false;
    if (ang !== undefined) u.ang = ang;
    u.castUntil = Math.max(u.castUntil, t + dur);
    u.castDur = dur;
    u.castSlot = 'A';
  }

  spell(spec) {
    return this.m.addSpell({ owner: this.u.id, target: null, fx: '', ...spec });
  }

  go(x, y) {
    const u = this.u, { w, h } = this.m.rules;
    u.tx = clamp(x, u.r, w - u.r);
    u.ty = clamp(y, u.r, h - u.r);
    u.mv = true;
  }

  // Invoque des ennemis, sans dépasser le nombre maximum d'ennemis vivants.
  summon(type, n, t) {
    const m = this.m;
    for (let i = 0; i < n && m.mobs.size + m.pending.length < MAX_ALIVE; i++) {
      m.announce({ type, elite: false }, t + SPAWN_WARN);
    }
  }

  // Traversée en ligne droite vers un joueur, jusqu'au mur : couloir annoncé pendant `warn`, puis ruée de `dur`.
  dashThrough(h, t, warn, dur, hw, dmg, def) {
    const u = this.u, { w, h: H } = this.m.rules;
    const a = Math.atan2(h.y - u.y, h.x - u.x);
    const ux = Math.cos(a), uy = Math.sin(a);
    const len = rayToRect(clamp(u.x, u.r, w - u.r), clamp(u.y, u.r, H - u.r), ux, uy, u.r, u.r, w - u.r, H - u.r);
    const ex = u.x + ux * len, ey = u.y + uy * len;
    const ta = t + warn, te = ta + dur;
    this.hold(t, warn + dur, a);
    this.spell({ kind: 'beam', def, t0: t, tl: t, ta, te, ax: u.x, ay: u.y, bx: ex, by: ey, hw, dmg });
    u.dash = { k: 'dash', fx: u.x, fy: u.y, tx: ex, ty: ey, ts: ta, te };
  }

  // Point de la salle à au moins minD de chaque joueur, ou à défaut le plus éloigné trouvé.
  farPoint(minD) {
    const { w, h } = this.m.rules, heroes = this.heroes();
    let best = { x: this.u.x, y: this.u.y }, bestD = -1;
    for (let k = 0; k < 20; k++) {
      const x = 150 + this.m.rng() * (w - 300), y = 150 + this.m.rng() * (h - 300);
      let d = Infinity;
      for (const p of heroes) d = Math.min(d, Math.hypot(p.x - x, p.y - y));
      if (d >= minD) return { x: round2(x), y: round2(y) };
      if (d > bestD) {
        bestD = d;
        best = { x: round2(x), y: round2(y) };
      }
    }
    return best;
  }
}

// Une attaque : (cerveau, boss, cible, temps) → durée avant l'attaque suivante (la pause de phase s'y ajoute).

// ---------------------------------------------------------------- Le Gardien de pierre

// Ondes de choc : anneaux successifs centrés sur lui.
function ondes(b, u, h, t) {
  const n = b.phase >= 2 ? 4 : 3;
  b.hold(t, 0.7);
  for (let i = 0; i < n; i++) {
    const t0 = t + i * 0.45;
    b.spell({ kind: 'ring', def: 'b_onde', t0, tl: t0, ta: t0 + 0.7, te: t0 + 0.95, x: u.x, y: u.y, r: 220 + i * 180, th: 60, dmg: 14, stun: 0 });
  }
  return 0.95 + (n - 1) * 0.45;
}

// Poing sismique : grande zone sur la cible, puis une traînée d'explosions dans le prolongement.
function poing(b, u, h, t) {
  const a = Math.atan2(h.y - u.y, h.x - u.x);
  b.hold(t, 1, a);
  b.spell({ kind: 'circle', def: 'b_poing', t0: t, tl: t, td: t + 1, x: h.x, y: h.y, r: 210, dmg: 24 });
  for (let i = 0; i < 4; i++) {
    const p = inRoom(b, h.x + Math.cos(a) * (320 + i * 150), h.y + Math.sin(a) * (320 + i * 150));
    b.spell({ kind: 'circle', def: 'b_replique', t0: t + 1, tl: t + 1, td: t + 1.25 + i * 0.15, x: p.x, y: p.y, r: 90, dmg: 12 });
  }
  return 1.9;
}

// Éboulement : 8 zones près des joueurs, étalées sur 2,4 s.
function eboulement(b, u, h, t) {
  b.hold(t, 0.6);
  for (let i = 0; i < 8; i++) {
    b.at(t + 0.3 + i * 0.3, (now) => {
      const heroes = b.heroes();
      if (!heroes.length) return;
      const tg = heroes[i % heroes.length];
      const p = inRoom(b, tg.x + gauss(b.m.rng) * 140, tg.y + gauss(b.m.rng) * 140);
      b.spell({ kind: 'circle', def: 'b_roche', t0: now, tl: now, td: now + 0.9, x: p.x, y: p.y, r: 110, dmg: 16 });
    });
  }
  return 2.7;
}

// Charge : deux traversées de la salle à la suite.
function charge(b, u, h, t) {
  b.dashThrough(h, t, 0.9, 0.45, 95, 26, 'b_charge');
  b.at(t + 1.7, (now) => {
    const h2 = b.target();
    if (h2) b.dashThrough(h2, now, 0.9, 0.45, 95, 26, 'b_charge');
  });
  return 3.05;
}

// ---------------------------------------------------------------- kits

// rest : pause après une attaque, par phase. attacks : attaques disponibles à partir de la phase indiquée.
const KITS = {
  gardien: {
    rest: [1.6, 1.2, 0.8],
    // Marche lentement vers le joueur le plus proche.
    move(b, u) {
      const h = b.nearest();
      if (h && Math.hypot(h.x - u.x, h.y - u.y) > 260) b.go(h.x, h.y);
      else u.mv = false;
    },
    onPhase(b, u, t) {
      b.summon('rodeur', 2, t);
    },
    attacks: [
      { phase: 1, run: ondes },
      { phase: 1, run: poing },
      { phase: 2, run: eboulement },
      { phase: 3, run: charge },
    ],
  },
};
```

- [ ] **Étape 4 : brancher les boss sur la partie**

Dans `shared/story/match.js`, remplacer l'import de `./bosses.js` par :

```js
import { BOSSES, bossDef, BossBrain } from './bosses.js';
```

Dans `addMob`, remplacer :

```js
    if (!s.boss) this.brains.set(id, new MobBrain(this, u, def, t));
```

par :

```js
    this.brains.set(id, s.boss ? new BossBrain(this, u, def, t) : new MobBrain(this, u, def, t));
```

Remplacer `kill` par :

```js
  kill(p, s, t) {
    super.kill(p, s, t);
    if (p.boss) {
      // Le boss emporte ses invocations, les apparitions annoncées et tous les sorts ennemis.
      this.pending = [];
      for (const m of this.mobs.values()) if (m.alive) super.kill(m, null, t);
      this.cancelEnemySpells(t);
      return;
    }
    if (p.mob || this.over) return;
    if (!this.heroes().some((h) => h.alive)) this.finishStory(false, t);
  }
```

- [ ] **Étape 5 : lancer les tests**

Run: `node --test test/story.test.js`
Expected: PASS, 42 tests. La run complète du pilote passe toujours, avec un Gardien qui attaque.

Run: `npm test`
Expected: tous les tests passent, y compris le rendu d'une run complète.

- [ ] **Étape 6 : commit**

```bash
git add shared/story/bosses.js shared/story/match.js test/story.test.js
git commit -m "story: boss attack engine and stone guardian" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17 : Forgeronne des braises

**Files:**
- Modify: `shared/story/bosses.js` (attaques et kit de la Forgeronne)
- Test: `test/story.test.js`

**Interfaces:**
- Consumes: `BossBrain` et ses outils (tâche 16).
- Produces: kit `forgeronne`. Sorts : `b_eventail`, `b_roue`, `boomerang` (lames), `rayon` (rayons croisés). Événement `dash` quand elle s'écarte d'un bond.

- [ ] **Étape 1 : écrire le test qui échoue**

**Ajouter à la fin de `test/story.test.js` :**

```js

test('Forgeronne des braises : éventail, roue de feu, lames, rayons croisés, bond d\'esquive', () => {
  const { m, hero, boss, brain, defs, watch } = bossFight('forgeronne');
  watch(20);
  assert.ok(defs.has('b_eventail') && defs.has('b_roue'), [...defs].join());
  assert.ok(!defs.has('boomerang') && !defs.has('rayon'));
  assert.ok(volleys(m, 'b_eventail').every((n) => n === 5), 'éventail de 5 projectiles');
  assert.ok(volleys(m, 'b_roue').every((n) => n === 12), 'roue de 12 projectiles par vague');
  assert.ok(volleys(m, 'b_roue').length >= 2, 'deux vagues');
  // Elle s'écarte d'un bond quand un joueur approche.
  hero.x = boss.x + 100; hero.y = boss.y; hero.tx = hero.x; hero.ty = hero.y;
  m.drainEvents();
  stepUntil(m, () => m.events.some((e) => e.e === 'dash' && e.id === boss.id), 60 * 8);
  assert.ok(m.events.some((e) => e.e === 'dash' && e.id === boss.id));
  stepUntil(m, () => !boss.dash, 30);
  assert.ok(Math.hypot(hero.x - boss.x, hero.y - boss.y) > 250);
  // Phase 2 : éventail de 7, lames boomerang.
  boss.hp = boss.maxHp * 0.6;
  m.drainEvents();
  watch(20);
  assert.equal(brain.phase, 2);
  assert.ok(volleys(m, 'b_eventail').includes(7));
  assert.ok(volleys(m, 'boomerang').includes(3), 'trois lames');
  // Phase 3 : rayons croisés, trois vagues de roue.
  boss.hp = boss.maxHp * 0.3;
  m.drainEvents();
  watch(25);
  assert.equal(brain.phase, 3);
  assert.ok(defs.has('rayon'));
  assert.ok(m.events.filter((e) => e.e === 'sp' && e.s.def === 'rayon').length >= 3);
  assert.ok(hero.hp < hero.maxHp);
});
```

- [ ] **Étape 2 : lancer le test et constater l'échec**

Run: `node --test test/story.test.js`
Expected: FAIL. « Forgeronne des braises » échoue : `defs` est vide (le boss n'a pas encore de kit).

- [ ] **Étape 3 : écrire les attaques et le kit**

Dans `shared/story/bosses.js`, ajouter avant la ligne `// ---------------------------------------------------------------- kits` :

```js
// ---------------------------------------------------------------- La Forgeronne des braises

// Éventail de braises : 5 projectiles sur 50°, 7 en phase 2. Phase 3 : un second éventail décalé d'un demi-pas.
function eventail(b, u, h, t) {
  const n = b.phase >= 2 ? 7 : 5;
  const fan = (now, shift) => {
    const tg = h.alive ? h : b.nearest();
    if (!tg) return;
    const a0 = Math.atan2(tg.y - u.y, tg.x - u.x);
    const step = (50 * DEG) / (n - 1);
    b.hold(now, 0.6, a0);
    for (let i = 0; i < n; i++) {
      const a = a0 + (i - (n - 1) / 2 + shift) * step;
      b.spell({
        kind: 'line', def: 'b_eventail', t0: now, tl: now + 0.6, ox: u.x, oy: u.y, dx: Math.cos(a), dy: Math.sin(a),
        speed: 1150, range: 1500, radius: 26, ret: false, pierce: false, dmg: 12,
      });
    }
  };
  fan(t, 0);
  if (b.phase < 3) return 0.9;
  b.at(t + 0.5, (now) => fan(now, 0.5));
  return 1.4;
}

// Roue de feu : 12 projectiles dans toutes les directions, puis une vague tournée de 15°. Trois vagues en phase 3.
function roue(b, u, h, t) {
  const waves = b.phase >= 3 ? 3 : 2;
  b.hold(t, 0.7 * waves);
  for (let w = 0; w < waves; w++) {
    const t0 = t + w * 0.7;
    for (let i = 0; i < 12; i++) {
      const a = (i * 30 + w * 15) * DEG;
      b.spell({
        kind: 'line', def: 'b_roue', t0, tl: t0 + 0.7, ox: u.x, oy: u.y, dx: Math.cos(a), dy: Math.sin(a),
        speed: 800, range: 1600, radius: 28, ret: false, pierce: false, dmg: 12,
      });
    }
  }
  return 0.7 * waves + 0.4;
}

// Lames boomerang : trois lames qui partent puis reviennent en traversant tout.
function lames(b, u, h, t) {
  const a0 = Math.atan2(h.y - u.y, h.x - u.x);
  b.hold(t, 0.6, a0);
  for (const off of [-25, 0, 25]) {
    const a = a0 + off * DEG;
    b.spell({
      kind: 'line', def: 'boomerang', t0: t, tl: t + 0.6, ox: u.x, oy: u.y, dx: Math.cos(a), dy: Math.sin(a),
      speed: 1100, range: 900, radius: 40, ret: true, pierce: true, dmg: 10,
    });
  }
  return 2.4;
}

// Rayons croisés : trois rayons qui se croisent sur la position de la cible.
function rayons(b, u, h, t) {
  const { w, h: H } = b.m.rules;
  const cx = clamp(h.x, 1, w - 1), cy = clamp(h.y, 1, H - 1);
  const a0 = b.m.rng() * Math.PI;
  b.hold(t, 0.8);
  for (let i = 0; i < 3; i++) {
    const a = a0 + (i * Math.PI) / 3, ux = Math.cos(a), uy = Math.sin(a);
    const da = rayToRect(cx, cy, ux, uy, 0, 0, w, H), db = rayToRect(cx, cy, -ux, -uy, 0, 0, w, H);
    const t0 = t + i * 0.35;
    b.spell({
      kind: 'beam', def: 'rayon', t0, tl: t0, ta: t0 + 1, te: t0 + 1.25,
      ax: cx + ux * da, ay: cy + uy * da, bx: cx - ux * db, by: cy - uy * db, hw: 55, dmg: 22,
    });
  }
  return 2.2;
}

// Se tient à distance. S'écarte d'un bond si un joueur approche à moins de 250 (une fois toutes les 6 s).
function forgeronneMove(b, u, t) {
  const h = b.nearest();
  if (!h) return;
  const dx = h.x - u.x, dy = h.y - u.y, d = Math.hypot(dx, dy) || 1;
  if (d < 250 && t >= b.bondAt) {
    b.bondAt = t + 6;
    const { w, h: H } = b.m.rules;
    let tx = u.x - (dx / d) * 420, ty = u.y - (dy / d) * 420;
    if (tx < u.r || tx > w - u.r || ty < u.r || ty > H - u.r) {
      // Dos au mur : bond vers le centre de la salle.
      const cx = w / 2 - u.x, cy = H / 2 - u.y, c = Math.hypot(cx, cy) || 1;
      tx = u.x + (cx / c) * 420;
      ty = u.y + (cy / c) * 420;
    }
    u.mv = false;
    u.dash = { k: 'dash', fx: u.x, fy: u.y, tx: clamp(tx, u.r, w - u.r), ty: clamp(ty, u.r, H - u.r), ts: t, te: t + 0.2 };
    b.m.emit({ e: 'dash', id: u.id, t });
    return;
  }
  if (d > 700) b.go(h.x - (dx / d) * 600, h.y - (dy / d) * 600);
  else if (d < 450) b.go(u.x - (dx / d) * 200, u.y - (dy / d) * 200);
  else u.mv = false;
}

```

Dans `KITS`, ajouter après le kit `gardien` :

```js
  forgeronne: {
    rest: [1.4, 1, 0.7],
    move: forgeronneMove,
    attacks: [
      { phase: 1, run: eventail },
      { phase: 1, run: roue },
      { phase: 2, run: lames },
      { phase: 3, run: rayons },
    ],
  },
```

- [ ] **Étape 4 : lancer les tests**

Run: `node --test test/story.test.js`
Expected: PASS, 43 tests.

Run: `npm test`
Expected: tous les tests passent.

- [ ] **Étape 5 : commit**

```bash
git add shared/story/bosses.js test/story.test.js
git commit -m "story: ember smith boss" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18 : Archonte du Vide

**Files:**
- Modify: `shared/story/bosses.js` (attaques et kit de l'Archonte)
- Test: `test/story.test.js`

**Interfaces:**
- Consumes: `BossBrain` et ses outils (tâche 16).
- Produces: kit `archonte`. Sorts : `b_nova` et `b_vide` (nova), `cage` et `b_eruption` (prison), `b_aiguille`, `grappin` et `b_implosion`, `meteore`. Événement `flash { id, fx, fy, x, y, t }` à chaque téléportation.

- [ ] **Étape 1 : écrire le test qui échoue**

**Ajouter à la fin de `test/story.test.js` :**

```js

test('Archonte du Vide : téléportation, prison, aiguilles, grappin, météores, invocations', () => {
  const { m, hero, boss, brain, defs, watch } = bossFight('archonte');
  watch(30);
  for (const d of ['b_nova', 'b_vide', 'cage', 'b_eruption', 'b_aiguille']) assert.ok(defs.has(d), `${d} : ${[...defs].join()}`);
  assert.ok(!defs.has('grappin') && !defs.has('meteore'));
  const jumps = m.events.filter((e) => e.e === 'flash' && e.id === boss.id);
  assert.ok(jumps.length > 0, 'il se téléporte');
  for (const j of jumps) assert.ok(Math.hypot(j.x - j.fx, j.y - j.fy) > 1);
  assert.equal(boss.mv, false, 'il ne marche jamais');
  assert.ok(volleys(m, 'b_vide').every((n) => n === 10), 'nova de 10 projectiles');
  assert.ok(volleys(m, 'b_aiguille').every((n) => n === 1), 'une seule aiguille en phase 1');
  assert.equal(m.events.filter((e) => e.e === 'sp' && e.s.def === 'b_aiguille').length % 8, 0, '8 rayons par balayage');
  // Phase 2 : grappin suivi d'une implosion, invocation de bombes.
  boss.hp = boss.maxHp * 0.6;
  m.drainEvents();
  watch(30);
  assert.equal(brain.phase, 2);
  assert.ok(defs.has('grappin') && defs.has('b_implosion'));
  assert.equal(m.events.filter((e) => e.e === 'warn').length >= 3, true, '3 bombes annoncées');
  assert.ok(m.events.some((e) => e.e === 'spawn' && e.u.mob === 'bombe'));
  // Phase 3 : météores, deux aiguilles opposées.
  boss.hp = boss.maxHp * 0.3;
  m.drainEvents();
  watch(35);
  assert.equal(brain.phase, 3);
  assert.ok(defs.has('meteore'));
  assert.ok(volleys(m, 'meteore').every((n) => n === 4), 'un météore par joueur et trois au hasard');
  assert.ok(volleys(m, 'b_aiguille').includes(2), 'deux aiguilles opposées');
  assert.ok(hero.hp < hero.maxHp);
  assert.ok(m.mobs.size <= 10);
});
```

- [ ] **Étape 2 : lancer le test et constater l'échec**

Run: `node --test test/story.test.js`
Expected: FAIL. « Archonte du Vide » échoue : `defs` est vide.

- [ ] **Étape 3 : écrire les attaques et le kit**

Dans `shared/story/bosses.js`, ajouter avant la ligne `// ---------------------------------------------------------------- kits` :

```js
// ---------------------------------------------------------------- L'Archonte du Vide

// Téléportation loin des joueurs, puis nova : un anneau et 10 projectiles en étoile.
function nova(b, u, h, t) {
  const p = b.farPoint(450);
  const fx = u.x, fy = u.y;
  u.x = p.x; u.y = p.y; u.tx = p.x; u.ty = p.y;
  b.m.emit({ e: 'flash', id: u.id, fx: round2(fx), fy: round2(fy), x: u.x, y: u.y, t });
  b.hold(t, 0.7);
  b.spell({ kind: 'ring', def: 'b_nova', t0: t, tl: t, ta: t + 0.7, te: t + 0.95, x: u.x, y: u.y, r: 260, th: 70, dmg: 14, stun: 0 });
  const a0 = b.m.rng() * Math.PI * 2;
  for (let i = 0; i < 10; i++) {
    const a = a0 + (i * Math.PI) / 5;
    b.spell({
      kind: 'line', def: 'b_vide', t0: t, tl: t + 0.7, ox: u.x, oy: u.y, dx: Math.cos(a), dy: Math.sin(a),
      speed: 900, range: 1500, radius: 28, ret: false, pierce: false, dmg: 14,
    });
  }
  return 1.2;
}

// Prison : une cage autour de la cible, puis deux éruptions à l'intérieur.
function prison(b, u, h, t) {
  b.hold(t, 0.6, Math.atan2(h.y - u.y, h.x - u.x));
  b.spell({ kind: 'ring', def: 'cage', t0: t, tl: t, ta: t + 0.6, te: t + 3.2, x: h.x, y: h.y, r: 230, th: 34, dmg: 8, stun: 1, fx: 'stun' });
  for (const dt of [0.7, 1.6]) {
    b.at(t + dt, (now) => {
      const tg = h.alive ? h : b.nearest();
      if (tg) b.spell({ kind: 'circle', def: 'b_eruption', t0: now, tl: now, td: now + 0.9, x: tg.x, y: tg.y, r: 120, dmg: 18 });
    });
  }
  return 2.2;
}

// Aiguilles : 8 rayons tournés de 45° en 45°, comme une aiguille qui balaie la salle. Deux aiguilles opposées en phase 3.
function aiguilles(b, u, h, t) {
  const a0 = Math.atan2(h.y - u.y, h.x - u.x) + Math.PI / 4;
  const dir = b.m.rng() < 0.5 ? 1 : -1;
  const hands = b.phase >= 3 ? 2 : 1;
  b.hold(t, 0.9);
  for (let i = 0; i < 8; i++) {
    const t0 = t + i * 0.28;
    for (let k = 0; k < hands; k++) {
      const a = a0 + (dir * i * Math.PI) / 4 + k * Math.PI;
      b.spell({
        kind: 'beam', def: 'b_aiguille', t0, tl: t0, ta: t0 + 0.9, te: t0 + 1.1,
        ax: u.x, ay: u.y, bx: u.x + Math.cos(a) * 1400, by: u.y + Math.sin(a) * 1400, hw: 45, dmg: 20,
      });
    }
  }
  return 3.1;
}

// Grappin du vide : attire la cible vers lui, puis une zone explose autour de lui.
function grappin(b, u, h, t) {
  const a = Math.atan2(h.y - u.y, h.x - u.x);
  b.hold(t, 0.5, a);
  b.spell({
    kind: 'line', def: 'grappin', t0: t, tl: t + 0.5, ox: u.x, oy: u.y, dx: Math.cos(a), dy: Math.sin(a),
    speed: 1500, range: 1100, radius: 34, ret: false, pierce: false, dmg: 10, pull: 420, fx: 'pull',
  });
  b.at(t + 1, (now) => b.spell({ kind: 'circle', def: 'b_implosion', t0: now, tl: now, td: now + 0.8, x: u.x, y: u.y, r: 200, dmg: 24 }));
  return 2;
}

// Pluie de météores : un sur chaque joueur et trois au hasard, deux fois de suite.
function meteores(b, u, h, t) {
  const volley = (now) => {
    const { w, h: H } = b.m.rules;
    for (const p of b.heroes()) b.spell({ kind: 'circle', def: 'meteore', t0: now, tl: now, td: now + 1.1, x: p.x, y: p.y, r: 200, dmg: 30 });
    for (let i = 0; i < 3; i++) {
      b.spell({ kind: 'circle', def: 'meteore', t0: now, tl: now, td: now + 1.1, x: b.m.rng() * w, y: b.m.rng() * H, r: 200, dmg: 30 });
    }
  };
  b.hold(t, 0.6);
  volley(t);
  b.at(t + 0.9, volley);
  return 2.2;
}

```

Dans `KITS`, ajouter après le kit `forgeronne` :

```js
  // Immobile : il ne se déplace que par téléportation (attaque nova).
  archonte: {
    rest: [1.3, 1, 0.7],
    onPhase(b, u, t) {
      b.summon('bombe', 3, t);
    },
    attacks: [
      { phase: 1, run: nova },
      { phase: 1, run: prison },
      { phase: 1, run: aiguilles },
      { phase: 2, run: grappin },
      { phase: 3, run: meteores },
    ],
  },
```

- [ ] **Étape 4 : lancer les tests**

Run: `node --test test/story.test.js`
Expected: PASS, 44 tests. La run complète du pilote se termine toujours par la victoire, cette fois contre les trois boss actifs.

Run: `npm test`
Expected: tous les tests passent.

- [ ] **Étape 5 : vérifier à l'écran**

Lancer `npm start` et jouer jusqu'au premier boss. Sa barre de vie et son nom sont en haut de l'écran, ses anneaux, zones et couloirs sont annoncés avant de frapper, « Phase 2 » s'affiche quand sa vie passe sous les deux tiers. Aucune erreur dans la console.

- [ ] **Étape 6 : commit**

```bash
git add shared/story/bosses.js test/story.test.js
git commit -m "story: void archon boss" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 19 : Narration

**Files:**
- Create: `shared/story/script.js`
- Modify: `shared/story/match.js` (nouvelle méthode `say`, `enterRoom`, `kill`)
- Modify: `shared/story/bosses.js` (réplique de phase 3)
- Modify: `public/js/render-story.js` (bandeau de narration)
- Modify: `public/js/story-ui.js` (texte de fin de run)
- Modify: `public/index.html` (`#res-story`), `public/js/main.js` (nettoyage de `#res-story`)
- Test: `test/story.test.js`

**Interfaces:**
- Consumes: `StoryState.say` (tâche 11), `BOSSES` (tâche 5), `drawStoryOverlay` (tâche 12), `fillStoryResults` (tâche 15).
- Produces:
  - `SCRIPT` : 13 entrées `{ who, text }`. `who` est une clé de `BOSSES` ou `''` pour la narration. Clés : `intro`, `boss1`, `boss1p3`, `boss1end`, `ch2`, `boss2`, `boss2p3`, `boss2end`, `ch3`, `boss3`, `boss3p3`, `win`, `lose`.
  - Événement `say { k, t }`, émis par `StoryMatch.say(k)`.

- [ ] **Étape 1 : écrire les tests qui échouent**

**Ajouter à la fin de `test/story.test.js` :**

```js

// ---------------------------------------------------------------- narration

import { SCRIPT } from '../shared/story/script.js';

test('les 13 textes de l\'histoire', () => {
  assert.deepEqual(Object.keys(SCRIPT), [
    'intro', 'boss1', 'boss1p3', 'boss1end', 'ch2', 'boss2', 'boss2p3', 'boss2end', 'ch3', 'boss3', 'boss3p3', 'win', 'lose',
  ]);
  for (const k in SCRIPT) {
    assert.ok(SCRIPT[k].text.length > 10, k);
    assert.ok(SCRIPT[k].who === '' || BOSSES[SCRIPT[k].who], k);
  }
  assert.equal(SCRIPT.intro.text, 'Sous l\'Arène dort celui qui l\'a bâtie. Cette nuit, il s\'est éveillé et a pris toute ta magie. Il ne te reste qu\'un sort. Les autres sont en bas. Descends.');
  assert.deepEqual(SCRIPT.boss2, { who: 'forgeronne', text: 'Tes sorts font de très bons lingots.' });
  assert.equal(SCRIPT.win.text, 'L\'Archonte se dissipe. La magie qu\'il retenait remonte d\'un coup vers l\'Arène, et retombe en pluie de sorts. Là-haut, il va falloir apprendre à esquiver.');
  assert.equal(SCRIPT.lose.text, 'Le Vide garde tes sorts. L\'Arène attendra un autre champion.');
});

test('narration : les textes arrivent aux moments prévus', () => {
  const m = solo(3);
  const says = () => m.events.filter((e) => e.e === 'say').map((e) => e.k);
  const boss = () => [...m.mobs.values()].find((u) => u.boss && u.alive);
  assert.deepEqual(says(), ['intro']);
  while (m.room.def.index < 4) nextRoom(m);
  assert.deepEqual(says(), ['intro', 'boss1'], 'aucun texte dans les salles ordinaires');
  stepUntil(m, () => boss());
  boss().hp = boss().maxHp * 0.3;
  stepUntil(m, () => says().includes('boss1p3'), 60 * 5);
  m.kill(boss(), null, m.time);
  assert.deepEqual(says(), ['intro', 'boss1', 'boss1p3', 'boss1end']);
  nextRoom(m);
  assert.equal(says().at(-1), 'ch2');
  while (!m.over) nextRoom(m);
  assert.deepEqual(says(), ['intro', 'boss1', 'boss1p3', 'boss1end', 'ch2', 'boss2', 'boss2end', 'ch3', 'boss3']);
});
```

- [ ] **Étape 2 : lancer les tests et constater l'échec**

Run: `node --test test/story.test.js`
Expected: FAIL au chargement : module `shared/story/script.js` introuvable.

- [ ] **Étape 3 : textes et événements**

**Créer `shared/story/script.js` :**

```js
// Textes de l'histoire. who : clé du boss qui parle (voir BOSSES), ou '' pour la narration.

export const SCRIPT = {
  intro: { who: '', text: 'Sous l\'Arène dort celui qui l\'a bâtie. Cette nuit, il s\'est éveillé et a pris toute ta magie. Il ne te reste qu\'un sort. Les autres sont en bas. Descends.' },
  boss1: { who: 'gardien', text: 'Nul ne descend plus bas.' },
  boss1p3: { who: 'gardien', text: 'La pierre… ne cède… pas !' },
  boss1end: { who: '', text: 'Le Gardien s\'effondre. Derrière lui, un escalier, et une lueur rouge.' },
  ch2: { who: '', text: 'La chaleur monte. C\'est ici qu\'on forge les coffres qui retiennent tes sorts.' },
  boss2: { who: 'forgeronne', text: 'Tes sorts font de très bons lingots.' },
  boss2p3: { who: 'forgeronne', text: 'Assez joué. Au feu !' },
  boss2end: { who: '', text: 'Les fourneaux s\'éteignent. Le dernier escalier s\'enfonce dans le noir.' },
  ch3: { who: '', text: 'Plus de murs, plus de ciel. Seulement lui, et tout ce qu\'il a volé.' },
  boss3: { who: 'archonte', text: 'Chaque sort lancé là-haut m\'a nourri. Les tiens aussi.' },
  boss3p3: { who: 'archonte', text: 'Ils sont à moi. Tous !' },
  win: { who: '', text: 'L\'Archonte se dissipe. La magie qu\'il retenait remonte d\'un coup vers l\'Arène, et retombe en pluie de sorts. Là-haut, il va falloir apprendre à esquiver.' },
  lose: { who: '', text: 'Le Vide garde tes sorts. L\'Arène attendra un autre champion.' },
};
```

Dans `shared/story/match.js`, ajouter cette méthode après `cancelEnemySpells` :

```js
  // Demande aux clients d'afficher un texte de l'histoire (clé de SCRIPT).
  say(k) {
    this.emit({ e: 'say', k, t: this.time });
  }
```

Dans `enterRoom`, juste avant `this.nextWave(playAt);`, ajouter :

```js
    if (i === 0) this.say('intro');
    else if (def.type === 'boss') this.say(`boss${def.chapter + 1}`);
    else if (def.n === 1) this.say(`ch${def.chapter + 1}`);
```

Dans `kill`, dans le bloc `if (p.boss) {`, après `this.cancelEnemySpells(t);`, ajouter (le dernier boss n'a pas de texte de mort : la fin est sur l'écran de victoire) :

```js
      const def = this.room.def;
      if (def.index < this.rooms.length - 1) this.say(`boss${def.chapter + 1}end`);
```

Dans `shared/story/bosses.js`, méthode `update` de `BossBrain`, dans le bloc `if (phase > this.phase) {`, après la ligne `this.m.emit({ e: 'boss', … });`, ajouter :

```js
      if (phase === 3) this.m.say(`boss${this.m.room.def.chapter + 1}p3`);
```

- [ ] **Étape 4 : bandeau de narration**

Dans `public/js/render-story.js`, ajouter aux imports :

```js
import { SCRIPT } from '../../shared/story/script.js';
```

Dans `drawStoryOverlay`, remplacer le `ctx.restore();` final par :

```js
  ctx.restore();
  drawNarration(ctx, r, st, s, t);
```

**Ajouter à la fin de `public/js/render-story.js` :**

```js

// Bandeau de narration : texte du récit ou réplique de boss, affiché quelques secondes sans bloquer la partie.
function drawNarration(ctx, r, st, s, t) {
  const line = st.say && SCRIPT[st.say.k];
  if (!line) return;
  const dur = clamp(2.5 + line.text.split(' ').length * 0.28, 3.5, 9);
  const age = t - st.say.t;
  if (age < 0 || age > dur) return;
  const who = line.who ? BOSSES[line.who] : null;
  ctx.save();
  ctx.globalAlpha = clamp(Math.min(age / 0.3, (dur - age) / 0.5), 0, 1);
  ctx.font = `500 ${19 * s}px ${FONT_B}`;
  const boxW = Math.min(760 * s, r.w - 60);
  const lines = wrap(ctx, who ? `« ${line.text} »` : line.text, boxW - 40 * s);
  const lh = 27 * s, head = who ? 26 * s : 0;
  const boxH = lines.length * lh + head + 24 * s;
  const x = (r.w - boxW) / 2, y = r.h - 190 * s - boxH;
  ctx.fillStyle = 'rgba(8,12,18,0.82)';
  ctx.fillRect(x, y, boxW, boxH);
  ctx.fillStyle = who ? who.color : C.mist;
  ctx.fillRect(x, y, 3 * s, boxH);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  if (who) {
    ctx.font = `700 ${15 * s}px ${FONT_B}`;
    ctx.fillText(who.name, x + 20 * s, y + 22 * s);
    ctx.font = `500 ${19 * s}px ${FONT_B}`;
  }
  ctx.fillStyle = C.chalk;
  lines.forEach((l, i) => ctx.fillText(l, x + 20 * s, y + 12 * s + head + lh * (i + 0.5)));
  ctx.restore();
}

// Coupe un texte en lignes qui tiennent dans maxW.
function wrap(ctx, text, maxW) {
  const out = [];
  let cur = '';
  for (const word of text.split(' ')) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && ctx.measureText(next).width > maxW) {
      out.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}
```

- [ ] **Étape 5 : texte de fin sur l'écran de résultats**

Dans `public/index.html`, dans `#results`, après `<p class="res-sub" id="res-sub"></p>`, ajouter :

```html
      <p class="hint" id="res-story"></p>
```

Dans `public/js/story-ui.js`, ajouter aux imports :

```js
import { SCRIPT } from '../../shared/story/script.js';
```

et dans `fillStoryResults`, après la ligne `$('#res-sub').textContent = storyResultLine(ev);`, ajouter :

```js
  $('#res-story').textContent = SCRIPT[ev.win ? 'win' : 'lose'].text;
```

Dans `public/js/main.js`, dans `showSurvivalResults` et dans `showVersusResults`, après la ligne `$('#res-kit').textContent = '';`, ajouter :

```js
  $('#res-story').textContent = '';
```

- [ ] **Étape 6 : lancer les tests**

Run: `node --test test/story.test.js`
Expected: PASS, 46 tests.

Run: `npm test`
Expected: tous les tests passent. Le test de rendu d'une run complète dessine maintenant les bandeaux de narration.

- [ ] **Étape 7 : vérifier à l'écran**

Lancer `npm start` et démarrer une run solo :

1. L'intro s'affiche dans un bandeau au-dessus de la barre de sorts pendant le décompte de la première salle, puis disparaît seule.
2. À l'entrée de la salle du premier boss, le bandeau porte le nom « Le Gardien de pierre » et sa réplique entre guillemets.
3. À la mort du joueur, l'écran de résultats affiche le texte de défaite sous le résumé.
4. Après une partie de Survie, l'écran de résultats n'affiche aucun texte d'histoire.

- [ ] **Étape 8 : commit**

```bash
git add shared/story/script.js shared/story/match.js shared/story/bosses.js public/js/render-story.js public/js/story-ui.js public/index.html public/js/main.js test/story.test.js
git commit -m "story: narration banner, boss lines, ending texts" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 20 : Réseau — snapshots et salon `story`

**Files:**
- Modify: `shared/sim.js` (`packMob`, `unpackMob`, `packSpell`)
- Modify: `shared/story/match.js` (import, `snapshot`)
- Modify: `server/lobby.js` (imports, constantes, `newRoom`, classe `Room`)
- Test: `test/story.test.js`, `test/server.test.js`

**Interfaces:**
- Consumes: `StoryMatch` et `heroDefs` (tâche 7), commande `loot` (tâche 8), `STORY_COLORS` (tâche 4).
- Produces:
  - `packMob(p, t)` → tableau de 17 valeurs : `[id, x, y, mv, tx, ty, ang, hp, castUntil, castDur, stunUntil, rootUntil, slowUntil, slowAmt, markUntil, markBy, dash]`. `unpackMob(a, p)` applique ce tableau à une unité et la renvoie.
  - `packSpell(s)` ajoute `team` quand l'équipe du sort diffère de son lanceur.
  - `StoryMatch.snapshot()` → `{ t, p, m }`, `m` étant la liste des ennemis vivants compactés.
  - Protocole : `create` accepte `mode: 'story'` ; `start` porte `kind` (`'story'` ou `'versus'`) ; `s` porte `m` en mode histoire ; `in` accepte `k: 'loot'` avec `i` entier de −1 à 2.

- [ ] **Étape 1 : écrire les tests qui échouent**

**Ajouter à la fin de `test/story.test.js` :**

```js

// ---------------------------------------------------------------- réseau

import { packMob, unpackMob, packSpell } from '../shared/sim.js';

test('réseau : état compact d\'un ennemi, snapshot, équipe des sorts', () => {
  const m = solo(1);
  stepUntil(m, () => m.mobs.size > 0);
  const u = [...m.mobs.values()][0];
  u.hp = 17; u.stunUntil = m.time + 1; u.markUntil = m.time + 2; u.markBy = 'a';
  u.dash = { k: 'dash', fx: 1, fy: 2, tx: 3, ty: 4, ts: m.time, te: m.time + 0.3 };
  const a = packMob(u, m.time);
  assert.equal(a.length, 17);
  assert.equal(a[0], u.id);
  const copy = unpackMob(a, createPlayer(mobDef(u.id, u.mob), 0));
  const r2 = (v) => Math.round(v * 100) / 100;
  for (const k of ['x', 'y', 'tx', 'ty']) assert.equal(copy[k], r2(u[k]), k);
  for (const k of ['mv', 'hp', 'castUntil', 'castDur', 'stunUntil', 'rootUntil', 'slowUntil', 'slowAmt', 'markUntil', 'markBy']) {
    assert.equal(copy[k], u[k], k);
  }
  assert.deepEqual(copy.dash, u.dash);
  const snap = m.snapshot();
  assert.equal(snap.p.length, 1);
  assert.equal(snap.m.length, m.mobs.size);
  u.alive = false;
  assert.equal(m.snapshot().m.length, m.mobs.size - 1, 'seuls les ennemis vivants sont envoyés');
  // L'équipe d'un sort n'est envoyée que si elle diffère de son lanceur.
  const spell = { kind: 'circle', def: 'w', target: null, t0: 0, tl: 0, td: 9, x: 0, y: 0, r: 1, dmg: 0, fx: '' };
  assert.equal(packSpell(m.addSpell({ ...spell, owner: 'a' })).team, 'P');
  assert.equal(packSpell(m.addSpell({ ...spell, owner: null })).team, 'M');
  assert.equal(packSpell({ ...spell, id: 1, owner: 'a', team: 'a' }).team, undefined, 'versus : rien de plus sur le réseau');
});
```

**Ajouter à la fin de `test/server.test.js` :**

```js

// ---------------------------------------------------------------- mode histoire

test('salon histoire : trois places, pas d\'IA, démarre quand les présents sont prêts', async () => {
  const a = await player('Ana');
  a.send({ type: 'create', mode: 'story' });
  const room = await a.waitType('room');
  assert.equal(room.settings.mode, 'story');
  a.send({ type: 'addBot', level: 'normal' });
  assert.match((await a.waitType('error')).msg, /IA/);
  a.send({ type: 'settings', mode: '1v1', roundsToWin: 5, env: 'chaos' });
  const b = await player('Bea');
  b.send({ type: 'join', code: room.code });
  const r2 = await b.waitType('room', 2000, (m) => m.players.length === 2);
  assert.equal(r2.settings.mode, 'story', 'les réglages d\'un salon histoire ne changent pas');
  assert.equal(r2.settings.roundsToWin, 2);
  a.send({ type: 'ready', v: true });
  b.send({ type: 'ready', v: true });
  const start = await b.waitType('start', 2000);
  assert.equal(start.kind, 'story');
  assert.equal(start.players.length, 2);
  for (const p of start.players) {
    assert.equal(p.team, 'P');
    assert.deepEqual(p.loadout.build, { Q: 'trait', W: null, E: null, R: null, D: null, F: null });
  }
  assert.notEqual(start.players[0].color, start.players[1].color);
  const snap = await b.waitType('s', 2000);
  assert.ok(Array.isArray(snap.m));
  assert.equal(snap.e.find((e) => e.e === 'room').i, 0);
  assert.ok(snap.e.some((e) => e.e === 'warn'));
  // Commandes de butin malformées ou sans tirage : ignorées, le serveur reste disponible.
  for (const i of [0, 7, -5, 1.5, 'x', null]) b.send({ type: 'in', s: 1, t: 0, k: 'loot', i });
  b.send({ type: 'ping', c: 5 });
  assert.equal((await b.waitType('pong', 2000, (m) => m.c === 5)).c, 5);
  // Les ennemis arrivent dans les snapshots après le décompte.
  const withMobs = await a.waitFor((m) => m.type === 's' && m.m && m.m.length > 0, 8000, 'ennemis');
  assert.equal(withMobs.m[0].length, 17);
  // Un joueur part : la run continue pour l'autre.
  b.close();
  await a.waitFor((m) => m.type === 's' && m.e.some((e) => e.e === 'left'), 3000, 'left');
  a.clear();
  const later = await a.waitType('s', 2000);
  assert.ok(!later.e.some((e) => e.e === 'storyEnd'));
  a.send({ type: 'leave' });
});

test('salon histoire : un joueur seul lance la run ; pas de partie rapide', async () => {
  const a = await player('Solo');
  a.send({ type: 'queue', mode: 'story' });
  a.send({ type: 'ping', c: 9 });
  await a.waitType('pong', 2000, (m) => m.c === 9);
  assert.ok(!a.msgs.some((m) => m.type === 'queue'), 'la file rapide refuse le mode histoire');
  a.send({ type: 'create', mode: 'story' });
  assert.equal((await a.waitType('room')).players.length, 1);
  a.send({ type: 'ready', v: true });
  const start = await a.waitType('start', 2000);
  assert.equal(start.kind, 'story');
  assert.equal(start.players.length, 1);
  a.send({ type: 'leave' });
});

test('un salon versus annonce son type au démarrage', async () => {
  const a = await player('V1'), b = await player('V2');
  a.send({ type: 'create', mode: '1v1' });
  const room = await a.waitType('room');
  b.send({ type: 'join', code: room.code });
  await b.waitType('room');
  a.send({ type: 'ready', v: true });
  b.send({ type: 'ready', v: true });
  const start = await a.waitType('start', 2000);
  assert.equal(start.kind, 'versus');
  assert.equal((await a.waitType('s', 2000)).m, undefined);
  for (const x of [a, b]) x.send({ type: 'leave' });
});
```

- [ ] **Étape 2 : lancer les tests et constater l'échec**

Run: `node --test test/story.test.js`
Expected: FAIL au chargement : `shared/sim.js` n'exporte pas `packMob`.

Run: `node --test test/server.test.js`
Expected: FAIL. « salon histoire : trois places » échoue : le salon créé est en mode `1v1`.

- [ ] **Étape 3 : état compact des ennemis**

Dans `shared/sim.js`, ajouter après `unpackInto` :

```js
// Version compacte d'un ennemi du mode histoire : un tableau de 17 valeurs, dans cet ordre.
export function packMob(p, t) {
  return [
    p.id, round2(p.x), round2(p.y), p.mv ? 1 : 0, round2(p.tx), round2(p.ty),
    Math.round(p.ang * 1000) / 1000, p.hp,
    tm(p.castUntil, t), p.castDur, tm(p.stunUntil, t), tm(p.rootUntil, t),
    tm(p.slowUntil, t), p.slowAmt, tm(p.markUntil, t), p.markUntil > t ? p.markBy : 0,
    p.dash ? [p.dash.k, round2(p.dash.fx), round2(p.dash.fy), round2(p.dash.tx), round2(p.dash.ty), p.dash.ts, p.dash.te] : 0,
  ];
}

export function unpackMob(a, p) {
  p.x = a[1]; p.y = a[2]; p.mv = !!a[3]; p.tx = a[4]; p.ty = a[5]; p.ang = a[6]; p.hp = a[7];
  p.castUntil = a[8]; p.castDur = a[9]; p.stunUntil = a[10]; p.rootUntil = a[11];
  p.slowUntil = a[12]; p.slowAmt = a[13]; p.markUntil = a[14]; p.markBy = a[15] || null;
  const d = a[16];
  p.dash = d ? { k: d[0], fx: d[1], fy: d[2], tx: d[3], ty: d[4], ts: d[5], te: d[6] } : null;
  return p;
}
```

Dans `packSpell`, après la ligne `const o = { id: s.id, … };`, ajouter :

```js
  // Mode histoire : l'équipe du sort, quand elle diffère de son lanceur, sert à prédire les impacts côté client.
  if (s.team != null && s.team !== s.owner) o.team = s.team;
```

Dans `shared/story/match.js`, remplacer l'import de `../sim.js` par :

```js
import { createPlayer, packMob } from '../sim.js';
```

et ajouter cette méthode après `say` :

```js
  // Les ennemis vivants voyagent dans les snapshots, en version compacte.
  snapshot() {
    const snap = super.snapshot();
    snap.m = [];
    for (const u of this.mobs.values()) if (u.alive) snap.m.push(packMob(u, this.time));
    return snap;
  }
```

- [ ] **Étape 4 : salon `story` côté serveur**

Dans `server/lobby.js`, ajouter aux imports :

```js
import { StoryMatch } from '../shared/story/match.js';
import { STORY_COLORS } from '../shared/story/loot.js';
```

Après `const MSG_PER_SEC = 150;`, ajouter :

```js
const STORY_MODE = 'story';   // salon coop du mode histoire : 1 à 3 joueurs, pas d'IA, pas de réglages
const STORY_CAPACITY = 3;
```

Dans `Lobby.newRoom`, remplacer :

```js
    const room = new Room(this, code, MODES[mode] ? mode : '1v1', fromQueue);
```

par :

```js
    const room = new Room(this, code, mode === STORY_MODE || MODES[mode] ? mode : '1v1', fromQueue);
```

Dans la classe `Room`, remplacer le getter `capacity` par :

```js
  get story() {
    return this.settings.mode === STORY_MODE;
  }

  get capacity() {
    return this.story ? STORY_CAPACITY : MODES[this.settings.mode];
  }
```

Dans `broadcastRoom`, remplacer `color: PLAYER_COLORS[i],` par :

```js
        color: (this.story ? STORY_COLORS : PLAYER_COLORS)[i],
```

Dans `updateSettings`, remplacer la première ligne par :

```js
    if (!this.isHost(c) || this.state !== 'lobby' || this.story) return;
```

Dans `addBot`, après la première ligne (`if (!this.isHost(c) || this.state !== 'lobby') return;`), ajouter :

```js
    if (this.story) return c.send({ type: 'error', msg: 'Pas d\'IA en mode histoire.' });
```

Remplacer `maybeStart` et `startMatch` par :

```js
  // Versus : le salon doit être plein. Histoire : il suffit que tous les présents soient prêts.
  maybeStart() {
    if (this.state !== 'lobby') return;
    if (this.story ? this.members.size < 1 : this.members.size !== this.capacity) return;
    for (const m of this.members.values()) if (!m.ready) return;
    this.startMatch();
  }

  startMatch() {
    let players;
    if (this.story) {
      // Pas de build : la partie donne à chacun son équipe, sa couleur et son kit de départ.
      const heroes = [...this.members.values()].map((m) => ({ id: m.id, name: m.name }));
      this.match = new StoryMatch({ players: heroes, time: serverNow() });
      players = this.match.heroDefs;
    } else {
      players = [...this.members.values()].map((m, i) => ({
        id: m.id, name: m.name, color: PLAYER_COLORS[i], bot: m.bot, botLevel: m.botLevel,
        build: m.bot ? randomBuild() : m.client.build,
      }));
      this.match = new Match({
        kind: 'versus',
        players,
        settings: { roundsToWin: this.settings.roundsToWin, env: this.settings.env },
        time: serverNow(),
      });
    }
    this.state = 'ingame';
    this.ticks = 0;
    this.broadcast({ type: 'start', kind: this.story ? 'story' : 'versus', players, settings: this.settings, t: this.match.time });
    this.broadcastRoom();
  }
```

Remplacer `sendSnapshot` par :

```js
  sendSnapshot() {
    this.broadcast({ type: 's', ...this.match.snapshot(), e: this.match.drainEvents() });
  }
```

Dans `input`, après la branche `cast`, ajouter avant `if (cmd) match.queueInput(c.id, seq, t, cmd);` :

```js
    // Choix au coffre du mode histoire : indice de carte, ou -1 pour passer.
    if (m.k === 'loot' && Number.isInteger(m.i) && m.i >= -1 && m.i <= 2) cmd = { k: 'loot', i: m.i };
```

- [ ] **Étape 5 : lancer les tests**

Run: `node --test test/story.test.js test/server.test.js`
Expected: PASS, 47 tests pour `story.test.js`, 10 pour `server.test.js`. Le test du salon histoire attend environ 6 s (le décompte de la première salle).

Run: `npm test`
Expected: tous les tests passent.

- [ ] **Étape 6 : commit**

```bash
git add shared/sim.js shared/story/match.js server/lobby.js test/story.test.js test/server.test.js
git commit -m "story: co-op rooms on the server, enemies in snapshots" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 21 : Partie en ligne côté client

**Files:**
- Modify: `public/js/netgame.js` (imports, constructeur, `onSnapshot`, `applyEvent`, `remotePos`, `predictHits`, `view`, `cmdToWire`)
- Modify: `public/js/net.js` (transmet `kind`)
- Test: `test/story-netcode.test.js` (nouveau)

**Interfaces:**
- Consumes: messages `start` (avec `kind`) et `s` (avec `m`) de la tâche 20, `unpackMob` (tâche 20), `StoryState` (tâche 11), événements de `StoryMatch`.
- Produces:
  - `new NetGame({ players, you, settings, clock, kind })`. Avec `kind: 'story'` : champs `mobs` (`Map`) et `story` (`StoryState`), et `view()` renvoie `kind: 'story'`, `story` et `mobs` au même format que `LocalGame` (tâche 11).
  - `cmdToWire({ k: 'loot', i })` → `{ k: 'loot', i }`.

Le test fait tourner le serveur et le client dans le même processus, avec une latence simulée et un temps simulé : il traverse le décompte de 5 s sans attendre.

- [ ] **Étape 1 : écrire le test qui échoue**

**Créer `test/story-netcode.test.js` :**

```js
// Mode histoire en ligne : la partie côté client suit la partie serveur.
// Serveur et client tournent dans le même processus, avec une latence et un temps simulés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StoryMatch } from '../shared/story/match.js';
import { applyCard } from '../shared/story/loot.js';
import { NetGame, TimeSync } from '../public/js/netgame.js';

const LAT = 0.04;   // latence dans chaque sens (s)

function harness(seed = 1) {
  const m = new StoryMatch({ players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], time: 0, seed });
  const clock = new TimeSync();
  for (let i = 0; i < 5; i++) clock.addSample(i, i + LAT, i + 2 * LAT);
  const ng = new NetGame({ players: m.heroDefs, you: 'a', settings: {}, clock, kind: 'story' });
  const toClient = [], toServer = [], hist = new Map(), errs = [], events = [];
  let ticks = 0;
  const step = () => {
    while (toServer.length && toServer[0].at <= m.time) {
      const x = toServer.shift();
      m.queueInput('a', x.s, x.t, x.cmd);
    }
    m.step();
    if (++ticks % 2 === 0 || m.over) toClient.push({ at: m.time + LAT, msg: { ...m.snapshot(), e: m.drainEvents() } });
    const now = m.time;
    while (toClient.length && toClient[0].at <= now) {
      const { msg } = toClient.shift();
      const me = msg.p.find((p) => p.i === 'a');
      const h = hist.get(msg.t);
      if (h && me.al && ng.phase.name === 'playing') errs.push(Math.hypot(h.x - me.x, h.y - me.y));
      events.push(...ng.onSnapshot(msg, now));
    }
    ng.update(now);
    if (ng.local) hist.set(ng.predT, { x: ng.local.x, y: ng.local.y });
  };
  // Envoie une commande comme le ferait le client : prédite tout de suite, reçue par le serveur après la latence.
  const input = (cmd) => {
    const msg = ng.input(cmd, m.time);
    if (!msg) return;
    const { type, s, t, ...wire } = msg;
    toServer.push({ at: m.time + LAT, s, t, cmd: wire });
  };
  const run = (sec) => {
    for (let i = 0; i < sec * 60; i++) step();
  };
  return { m, ng, run, input, errs, events };
}

test('en ligne : salle, ennemis et kit suivent le serveur, la prédiction reste exacte', () => {
  const { m, ng, run, input, errs, events } = harness(1);
  // Le joueur suivi ne doit pas mourir pendant les mesures.
  const hero = m.players.get('a');
  hero.maxHp = 100000;
  hero.hp = 100000;
  run(0.5);
  let v = ng.view();
  assert.equal(v.kind, 'story');
  assert.equal(v.story.room.i, 0);
  assert.equal(v.rules.w, m.rules.w);
  assert.equal(v.phase.name, 'countdown');
  assert.equal(v.players.length, 2);
  assert.deepEqual(v.mobs, []);
  assert.ok(v.story.warns.length > 0);
  run(5);
  v = ng.view();
  assert.equal(v.phase.name, 'playing');
  assert.ok(v.mobs.length > 0);
  assert.equal(v.mobs.length, m.mobs.size);
  const sm = [...m.mobs.values()][0];
  const cm = v.mobs.find((x) => x.id === sm.id);
  assert.ok(Math.hypot(cm.x - sm.x, cm.y - sm.y) < 60, 'position extrapolée proche de celle du serveur');
  assert.equal(cm.st.maxHp, sm.maxHp);
  assert.equal(cm.st.mob, sm.mob);
  // Déplacements, tir, touche vide.
  for (let i = 0; i < 12; i++) {
    const r = i % 4;
    if (r === 3) input({ k: 'cast', slot: 'Q', x: sm.x, y: sm.y });
    else if (r === 2) input({ k: 'cast', slot: 'W', x: 500, y: 500 });
    else input({ k: 'move', x: 200 + ((i * 397) % 900), y: 150 + ((i * 211) % 500) });
    run(0.25);
  }
  // Un sort gagné côté serveur devient utilisable côté client.
  applyCard(hero, { ab: 'flash', rar: 0, slot: 'D' });
  m.emit({ e: 'kit', id: 'a', slot: 'D', ab: 'flash', rar: 0, t: m.time });
  run(0.3);
  assert.equal(ng.view().me.build.D, 'flash');
  input({ k: 'cast', slot: 'D', x: hero.x + 300, y: hero.y });
  run(0.5);
  input({ k: 'move', x: 400, y: 400 });
  run(1);
  errs.sort((x, y) => x - y);
  assert.ok(errs.length > 100, `échantillons : ${errs.length}`);
  const p95 = errs[Math.floor(errs.length * 0.95)];
  assert.ok(p95 < 1, `erreur de prédiction p95 = ${p95}`);
  for (const e of ['room', 'warn', 'spawn', 'go', 'say']) assert.ok(events.some((x) => x.e === e), `événement ${e} relayé`);
  // Un ennemi tué côté serveur disparaît côté client.
  m.kill(sm, null, m.time);
  run(0.3);
  assert.ok(!ng.view().mobs.some((x) => x.id === sm.id));
  // Fin de run.
  for (const id of ['a', 'b']) {
    const p = m.players.get(id);
    if (p.alive) m.kill(p, null, m.time);
  }
  run(0.3);
  assert.equal(ng.view().phase.name, 'over');
  assert.equal(ng.view().story.result.win, false);
});

test('en ligne : une commande de butin part avec son indice', async () => {
  const { cmdToWire } = await import('../public/js/netgame.js');
  assert.deepEqual(cmdToWire({ k: 'loot', i: -1 }), { k: 'loot', i: -1 });
  assert.deepEqual(cmdToWire({ k: 'loot', i: 2 }), { k: 'loot', i: 2 });
  assert.deepEqual(cmdToWire({ k: 'stop' }), { k: 'stop' });
});
```

- [ ] **Étape 2 : lancer le test et constater l'échec**

Run: `node --test test/story-netcode.test.js`
Expected: FAIL. Le premier test échoue sur `v.kind` (`'versus'` au lieu de `'story'`), le second sur `cmdToWire` (l'indice `i` est perdu).

- [ ] **Étape 3 : partie en ligne**

Dans `public/js/netgame.js`, remplacer les imports par :

```js
import { DT } from '../../shared/constants.js';
import {
  createPlayer, clonePlayer, unpackInto, unpackMob, stepPlayer, applyCommand, extrapolate, spellEnd, linePos, lineEnd,
} from '../../shared/sim.js';
import { clamp, segPointDist2 } from '../../shared/util.js';
import { StoryState } from '../../shared/story/state.js';
```

Dans le constructeur de `NetGame`, remplacer :

```js
  constructor({ players, you, settings, clock }) {
    this.you = you;
    this.settings = settings || {};
    this.kind = 'versus';
```

par :

```js
  // kind : 'versus' ou 'story' (mode histoire en coop)
  constructor({ players, you, settings, clock, kind = 'versus' }) {
    this.you = you;
    this.settings = settings || {};
    this.kind = kind;
    this.mobs = new Map();   // ennemis du mode histoire, créés par l'événement « spawn »
    this.story = kind === 'story' ? new StoryState(you) : null;
```

et remplacer :

```js
    this.world = { get: (id) => this.players.get(id) };
```

par :

```js
    this.world = { get: (id) => this.unit(id) };
```

Ajouter cette méthode après le getter `ready` :

```js
  unit(id) {
    return this.players.get(id) || this.mobs.get(id);
  }
```

Remplacer `onSnapshot` par :

```js
  // Applique un snapshot ; renvoie les événements à afficher (effets, sons).
  onSnapshot(msg, now) {
    const out = [];
    const A = this.renderT;
    const before = new Map();
    if (this.snapT !== null) {
      for (const id of this.order) {
        if (id !== this.you) before.set(id, this.remotePos(id, A));
      }
      for (const id of this.mobs.keys()) before.set(id, this.remotePos(id, A));
    }

    for (const ev of msg.e) this.applyEvent(ev, out);

    this.snapT = msg.t;
    for (const o of msg.p) {
      const p = this.players.get(o.i);
      if (p) unpackInto(o, p);
    }
    if (msg.m) {
      for (const a of msg.m) {
        const u = this.mobs.get(a[0]);
        if (u) unpackMob(a, u);
      }
    }

    // Lissage des adversaires et des ennemis : on absorbe le saut entre ancienne et nouvelle extrapolation.
    for (const [id, old] of before) {
      if (!this.unit(id)) continue;   // ennemi mort depuis
      const now2 = this.remotePos(id, A, true);
      // old inclut déjà l'ancien décalage : le nouveau décalage garantit la continuité à l'écran.
      const r = this.remote.get(id) || { ox: 0, oy: 0 };
      const dx = old.x - now2.x, dy = old.y - now2.y;
      const big = dx * dx + dy * dy > 140 * 140;
      r.ox = big ? 0 : dx;
      r.oy = big ? 0 : dy;
      this.remote.set(id, r);
    }

    this.reconcile(msg.t);
    return out;
  }
```

Dans `applyEvent`, remplacer la ligne `switch (ev.e) {` par :

```js
    if (this.story) this.story.apply(ev);
    switch (ev.e) {
      case 'room':
        this.rules = { ...ev.rules };
        this.phase = { name: 'countdown', round: ev.i + 1, scores: {}, winner: null, until: ev.rules.playAt };
        this.spells.clear();
        for (const id of this.mobs.keys()) this.remote.delete(id);
        this.mobs.clear();
        this.pending = this.pending.filter((p) => p.t > ev.t);
        out.push(ev);
        break;
      case 'spawn': {
        const u = createPlayer(ev.u, 0);
        u.x = ev.x; u.y = ev.y; u.tx = ev.x; u.ty = ev.y;
        this.mobs.set(u.id, u);
        out.push(ev);
        break;
      }
      case 'die':
        if (this.mobs.delete(ev.id)) this.remote.delete(ev.id);
        out.push(ev);
        break;
      case 'kit': {
        const p = this.players.get(ev.id);
        if (p) {
          p.build[ev.slot] = ev.ab;
          p.rar[ev.slot] = ev.rar;
        }
        out.push(ev);
        break;
      }
      case 'storyEnd':
        this.rules.frozen = true;
        this.phase = { ...this.phase, name: 'over' };
        out.push(ev);
        break;
```

Dans `remotePos`, remplacer `const p = this.players.get(id);` par :

```js
    const p = this.unit(id);
```

Remplacer `predictHits` par :

```js
  // Masque un projectile dès qu'il touche visuellement une unité d'une autre équipe (le serveur confirme ensuite).
  predictHits(A) {
    const prev = this._prevA ?? A;
    this._prevA = A;
    const timeout = Math.max(0.25, this.clock.rtt + 0.12);
    const pos = [];   // position affichée, rayon et équipe de chaque unité vivante
    for (const id of this.order) {
      const p = id === this.you ? this.local : this.players.get(id);
      if (!p || !p.alive) continue;
      const q = id === this.you ? this.localPos() : this.remotePos(id, A);
      pos.push({ x: q.x, y: q.y, r: p.r, team: p.team });
    }
    for (const [id, u] of this.mobs) {
      const q = this.remotePos(id, A);
      pos.push({ x: q.x, y: q.y, r: u.r, team: u.team });
    }
    for (const s of this.spells.values()) {
      if (s.kind !== 'line' || s.pierce || s.cut < Infinity) continue; // auto-attaques : le serveur décide
      if (s.hiddenAt !== null) {
        if (A - s.hiddenAt > timeout) {
          s.hiddenAt = null;
          s.noPredict = true;
        }
        continue;
      }
      if (s.noPredict || A < s.tl || A > lineEnd(s)) continue;
      const a = linePos(s, Math.max(s.tl, prev)), b = linePos(s, A);
      const team = s.team ?? s.owner;   // l'équipe n'est envoyée que si elle diffère du lanceur
      for (const p of pos) {
        if (team != null && p.team === team) continue;
        if (segPointDist2(a.x, a.y, b.x, b.y, p.x, p.y) < (s.radius + p.r) ** 2) {
          s.hiddenAt = A;
          break;
        }
      }
    }
  }
```

Dans `view`, remplacer le `return { … };` final par :

```js
    const view = {
      t: A,
      kind: this.kind,
      rules: this.rules,
      phase: this.phase,
      you: this.you,
      me: this.local || this.players.get(this.you),
      players,
      spells: [...this.spells.values()],
      roundsToWin: this.settings.roundsToWin,
    };
    if (this.story) {
      this.story.prune(A);
      view.story = this.story;
      view.mobs = [];
      for (const [id, u] of this.mobs) {
        const pos = this.remotePos(id, A);
        view.mobs.push({ id, name: u.name, color: u.color, x: pos.x, y: pos.y, st: u, alive: u.alive, hp: u.hp });
      }
    }
    return view;
```

Dans `cmdToWire`, ajouter avant la dernière ligne `return { k: cmd.k };` :

```js
  if (cmd.k === 'loot') return { k: 'loot', i: cmd.i };
```

Dans `public/js/net.js`, cas `'start'` de `onMessage`, remplacer la création de la partie par :

```js
        this.game = new NetGame({ players: m.players, you: this.id, settings: m.settings, clock: this.clock, kind: m.kind });
```

- [ ] **Étape 4 : lancer les tests**

Run: `node --test test/story-netcode.test.js test/netcode.test.js`
Expected: PASS, 2 tests pour le mode histoire, 1 pour le test de prédiction existant.

Run: `npm test`
Expected: tous les tests passent.

- [ ] **Étape 5 : commit**

```bash
git add public/js/netgame.js public/js/net.js test/story-netcode.test.js
git commit -m "story: online client follows rooms, enemies and kit" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 22 : Interface coop

**Files:**
- Modify: `public/index.html` (bouton « Créer un salon coop », note du salon)
- Modify: `public/js/main.js` (`initMenu`, `renderLobby`, `updateRematchHint`, `initResults`, `showStoryResults`)

**Interfaces:**
- Consumes: salon `story` (tâche 20), `NetGame` en mode histoire (tâche 21), `online.create(mode)`, `goOnline(action)`.
- Produces: rien pour les tâches suivantes.

Cette tâche n'a pas de test automatique : elle ne touche que des éléments du DOM. Elle se vérifie avec deux onglets (étape 3).

- [ ] **Étape 1 : menu et salon**

Dans `public/index.html`, section `data-mode="story"`, remplacer :

```html
          <div class="button-row">
            <button class="primary" id="play-story">Jouer en solo</button>
          </div>
```

par :

```html
          <div class="button-row">
            <button class="primary" id="play-story">Jouer en solo</button>
            <button class="secondary" id="create-story">Créer un salon coop</button>
          </div>
          <p class="hint">À deux ou trois : crée un salon et envoie le lien, ou rejoins un ami avec son code dans « En ligne ».</p>
```

Dans la section `#lobby`, juste avant `<div class="room-settings" id="room-settings">`, ajouter :

```html
    <p class="hint" id="story-note" hidden>Mode histoire : la run démarre dès que tous les joueurs présents sont prêts, à un, deux ou trois. Chacun part avec le seul sort Q et trouve les autres dans les coffres.</p>
```

- [ ] **Étape 2 : brancher l'interface dans `main.js`**

Dans `initMenu`, après `$('#play-story').addEventListener('click', startStory);`, ajouter :

```js
  $('#create-story').addEventListener('click', () => goOnline(() => online.create('story')));
```

Dans `renderLobby`, remplacer `const cap = MODES[room.settings.mode];` par :

```js
  const story = room.settings.mode === 'story';
  const cap = story ? 3 : MODES[room.settings.mode];
```

Toujours dans `renderLobby`, dans la branche d'une place libre, remplacer `if (isHost) {` par `if (isHost && !story) {` et remplacer :

```js
      } else {
        side.append('En attente');
      }
```

par :

```js
      } else {
        side.append(story ? 'Facultatif' : 'En attente');
      }
```

Après la boucle `for (let i = 0; i < cap; i++) { … }`, ajouter :

```js
  // Salon histoire : ni réglages de manches, ni build.
  $('#room-settings').classList.toggle('hidden', story);
  $('#story-note').hidden = !story;
  $('#lobby-build').classList.toggle('hidden', story);
```

Dans `updateRematchHint`, après la première ligne (`if (sessionType !== 'online' || !lastRoom) return;`), ajouter :

```js
  if (lastRoom.settings.mode === 'story') {
    $('#res-hint').textContent = 'Une nouvelle run démarre quand tous les joueurs du salon sont prêts.';
    $('#res-again').textContent = 'Rejouer';
    return;
  }
```

Dans `initResults`, gestionnaire de `#res-again`, remplacer :

```js
      const full = lastRoom && lastRoom.players.length >= MODES[lastRoom.settings.mode];
```

par :

```js
      const full = lastRoom && (lastRoom.settings.mode === 'story' || lastRoom.players.length >= MODES[lastRoom.settings.mode]);
```

Remplacer `showStoryResults` par :

```js
function showStoryResults(ev, players) {
  fillStoryResults(ev, players, sessionType === 'online' ? online.id : 'you', iconCanvas);
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
```

- [ ] **Étape 3 : vérifier à deux onglets**

Run: `npm test`
Expected: tous les tests passent.

Lancer `npm start` et ouvrir http://localhost:3000 dans deux onglets :

1. Onglet A : « Créer un salon coop ». Le salon affiche trois places, la note du mode histoire, pas de réglages de manches, pas de bouton « Ajouter une IA », pas de lien « Modifier mon build ».
2. Onglet B : rejoindre avec le code. Les deux joueurs ont des couleurs différentes (bleu et vert).
3. Les deux cliquent « Je suis prêt » : la run démarre dans les deux onglets, avec la même salle et les mêmes ennemis.
4. Un sort de A traverse B sans le blesser et blesse les ennemis. Les PV de l'allié sont en haut à gauche.
5. Salle vidée : chacun ouvre le coffre et reçoit ses propres cartes. Un seul joueur dans la porte affiche « 1 / 2 dans la porte, départ dans … s ». Les deux dans la porte : la salle suivante commence.
6. Si A meurt, il voit « À terre : retour à la prochaine salle » et revient à la salle suivante avec la moitié de ses PV.
7. Les deux morts : écran « Défaite » dans les deux onglets avec une ligne par joueur. « Rejouer » puis « Je suis prêt » des deux côtés relance une run.
8. Fermer l'onglet B pendant une run : A continue seul, avec le message « … a quitté la partie ».
9. Un salon 1v1 classique fonctionne comme avant.

- [ ] **Étape 4 : commit**

```bash
git add public/index.html public/js/main.js
git commit -m "story: co-op lobby and results" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 23 : Équilibrage

**Files:**
- Create: `tools/balance.js`
- Modify (selon les mesures) : `shared/story/mobs.js` (`MOBS`, `CHAPTER_HP`, `CHAPTER_DMG`), `shared/story/rooms.js` (`budget` des chapitres), `shared/story/bosses.js` (`hp` des boss), `test/story.test.js` et la spec si une valeur testée ou documentée change

**Interfaces:**
- Consumes: `StoryMatch`, `Pilot` (tâche 10).
- Produces: `node tools/balance.js [graines]` affiche la durée et les dégâts subis par salle.

But : une run de 15 à 20 minutes pour un joueur. Le pilote ne choisit pas longuement au coffre et n'esquive pas : on vise donc 9 à 14 minutes de combat simulé.

- [ ] **Étape 1 : écrire la simulation**

**Créer `tools/balance.js` :**

```js
// Simulation d'équilibrage : fait jouer des runs au pilote scripté et mesure chaque salle.
// Usage : node tools/balance.js [nombre de graines]
// Le pilote est immortel et n'esquive pas : les dégâts subis sont un repère de pression, pas une prédiction.

import { StoryMatch } from '../shared/story/match.js';
import { Pilot } from './pilot.js';

const seeds = Number(process.argv[2]) || 20;
const rooms = Array.from({ length: 15 }, () => ({ time: 0, dmg: 0, n: 0 }));
let total = 0, wins = 0;

for (let seed = 1; seed <= seeds; seed++) {
  const m = new StoryMatch({ players: [{ id: 'a', name: 'A' }], seed });
  const pilot = new Pilot(m, 'a', { god: true });
  let cur = 0, enter = 0;
  for (let i = 0; i < 60 * 60 * 60 && !m.over; i++) {
    pilot.update();
    m.step();
    for (const ev of m.drainEvents()) {
      if (ev.e === 'room') {
        cur = ev.i;
        enter = ev.rules.playAt;
      } else if (ev.e === 'hit' && ev.tid === 'a') rooms[cur].dmg += ev.dmg;
      else if (ev.e === 'clear' || ev.e === 'storyEnd') {
        rooms[cur].time += ev.t - enter;
        rooms[cur].n++;
      }
    }
  }
  if (m.result && m.result.win) {
    wins++;
    total += m.result.time;
  }
}

console.log(`${wins}/${seeds} runs terminées, durée moyenne ${(total / Math.max(1, wins) / 60).toFixed(1)} min`);
console.log('salle  durée (s)  dégâts subis');
rooms.forEach((r, i) => {
  const n = Math.max(1, r.n);
  console.log(`${String(i + 1).padStart(5)}  ${(r.time / n).toFixed(1).padStart(9)}  ${(r.dmg / n).toFixed(0).padStart(12)}`);
});
```

- [ ] **Étape 2 : mesurer**

Run: `node tools/balance.js 30`
Expected: une ligne de résumé (`30/30 runs terminées, durée moyenne … min`) et 15 lignes, une par salle. Les salles 5, 10 et 15 sont les boss.

- [ ] **Étape 3 : ajuster**

Cibles pour le pilote :

| Mesure | Cible |
| --- | --- |
| Runs terminées | toutes |
| Durée moyenne d'une run | 9 à 14 minutes |
| Durée d'une salle de combat | 75 s au plus |
| Durée d'un boss | 40 à 120 s |
| Dégâts subis par salle | repère seulement : une salle au-dessus de 300 est à regarder à l'écran |

Réglages, un à la fois, en relançant la mesure après chacun :

| Constat | Réglage |
| --- | --- |
| Salles de combat trop longues dans un chapitre | baisser `CHAPTER_HP` de ce chapitre dans `shared/story/mobs.js` |
| Trop d'ennemis à la fois, dégâts subis très élevés | baisser `budget` de ce chapitre dans `shared/story/rooms.js` |
| Un boss trop long ou trop court | changer son `hp` dans `BOSSES` (`shared/story/bosses.js`) |
| Run trop courte | monter `CHAPTER_HP` des chapitres 2 et 3 |
| Un type d'ennemi fait l'essentiel des dégâts | baisser son `dmg` ou monter son `cd` dans `MOBS` |

Si une valeur change, la reporter dans la spec (sections 5 à 7) et dans les assertions de `test/story.test.js` qui la citent (PV du rôdeur, de l'élite, des boss).

- [ ] **Étape 4 : jouer une run complète**

Lancer `npm start` et jouer une run solo jusqu'au bout, ou jusqu'à la mort :

1. Le chapitre 1 se passe avec le Q et un ou deux sorts trouvés, sans frôler la mort en jouant correctement.
2. Chaque attaque d'ennemi ou de boss qui touche avait été annoncée assez tôt pour être évitée.
3. Les coffres proposent régulièrement des améliorations une fois les six touches remplies.
4. La durée de la run est proche de 15 à 20 minutes.

Corriger les valeurs si un point échoue, puis relancer les étapes 2 et 3.

- [ ] **Étape 5 : lancer les tests et commit**

Run: `npm test`
Expected: tous les tests passent.

```bash
git add tools/balance.js shared/story test/story.test.js docs/superpowers/specs
git commit -m "story: balance pass from simulated runs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 24 : README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: rien.
- Produces: rien.

- [ ] **Étape 1 : mettre à jour le README**

Remplacer la phrase d'introduction et la liste des modes par :

```markdown
Jeu d'esquive de sorts dans le navigateur, avec les contrôles de League of Legends : clic droit pour bouger, Q W E R pour les sorts, Flash sur D. Quatre façons de jouer :

- **Histoire** : descends sous l'Arène de salle en salle, bats trois boss et retrouve tes sorts dans des coffres. Seul hors ligne, ou à deux ou trois en coop en ligne.
- **Survie** : seul face aux sorts de l'arène, qui arrivent de plus en plus vite.
- **Contre l'IA** : duel hors ligne en 1v1 ou 1v1v1.
- **En ligne** : 1v1 ou 1v1v1 contre des amis (salon privé avec code) ou en partie rapide. L'hôte peut compléter un salon avec des IA.
```

Ajouter cette section après la section `## Builds` :

```markdown
## Mode histoire

Une run compte 15 salles : trois chapitres de quatre salles de combat et un boss. Les salles, les ennemis et le butin sont tirés au hasard à chaque partie. Si tu meurs, la run recommence du début.

- **Kit** : tu pars avec le seul Trait arcanique sur Q. Le build du menu ne sert pas.
- **Coffres** : chaque salle vidée fait apparaître un coffre. Il propose trois sorts : tu en gardes un, ou tu passes pour récupérer 30 PV.
- **Rareté** : Commun, Rare, Épique ou Légendaire. Plus un sort est rare, plus il frappe fort et plus il se recharge vite. Retrouver un sort en plus rare l'améliore.
- **Salles** : elles changent de taille, de décor, d'ennemis et de pièges. Une fois la salle vidée, la porte s'ouvre sur un côté.
- **Boss** : le Gardien de pierre, la Forgeronne des braises et l'Archonte du Vide ont chacun leurs attaques et trois phases. Les battre te soigne entièrement.
- **Coop** : « Créer un salon coop » ouvre un salon de une à trois places. Chacun a son tirage au coffre, il n'y a pas de tir allié, et un joueur mort revient à la salle suivante avec la moitié de ses PV.
```

Dans la section `## Structure`, remplacer le bloc de code par :

```
server/   serveur HTTP + WebSocket, salons, file d'attente
shared/   simulation commune : règles, sorts, IA, parties
shared/story/   mode histoire : salles, ennemis, boss, butin, textes
public/   client : rendu canvas, contrôles, menus, réseau
tools/    pilote scripté et simulation d'équilibrage
test/     tests (npm test)
```

Dans la liste « Pour rééquilibrer le jeu », ajouter :

```markdown
- mode histoire : ennemis dans `shared/story/mobs.js`, boss dans `shared/story/bosses.js`, salles, vagues et pièges dans `shared/story/rooms.js`, raretés des coffres dans `shared/story/loot.js`. `node tools/balance.js` simule des runs et affiche la durée et les dégâts subis par salle.
```

Dans la section `## Tests`, remplacer le paragraphe qui suit le bloc `npm test` par :

```markdown
Les tests couvrent les règles de jeu, des parties complètes entre IA, le mode histoire (butin, salles, ennemis, boss, une run complète jouée par un pilote scripté), le rendu sur un canvas simulé, le serveur (salons, file rapide, IA, coop, abandon, messages invalides) et la prédiction réseau avec une latence simulée.
```

- [ ] **Étape 2 : vérifier et commit**

Run: `npm test`
Expected: tous les tests passent.

```bash
git add README.md
git commit -m "docs: story mode in the readme" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Correspondance avec la spec

| Section de la spec | Tâches |
| --- | --- |
| 4. Déroulement d'une run | 7, 8 |
| 5. Salles (génération, vagues, pièges) | 3, 6, 7 |
| 6. Ennemis | 5, 9 |
| 7. Boss | 5, 16, 17, 18 |
| 8. Butin et rareté | 2, 4, 8 |
| 9. Histoire | 19 |
| 10. Coop | 7, 8, 20, 21, 22 |
| 11. Interface | 12, 13, 14, 15, 19, 22 |
| 12. Architecture | 1, 2, 3, 7, 11, 12, 20, 21 |
| 13. Cas limites | 2, 7, 8, 9, 11, 16, 20 |
| 14. Tests, équilibrage, vérification à l'écran | toutes, 23 |
| 16. Critères de réussite | 10 (run complète), 15 (solo jouable), 22 (coop), 24 |
