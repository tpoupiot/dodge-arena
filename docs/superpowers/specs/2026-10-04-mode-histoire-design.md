# Mode histoire : design

Date : 2026-10-04
Statut : design validé en discussion, spec en attente de relecture

## 1. Objectif

Ajouter à Dodge Arena un mode histoire, jouable seul hors ligne ou en coopération en ligne de 1 à 3 joueurs. Le joueur descend sous l'Arène de salle en salle, affronte des ennemis et trois boss, et reconstitue son kit de sorts en ouvrant des coffres.

Les modes actuels (Survie, Contre l'IA, En ligne) gardent exactement leur comportement.

## 2. Décisions validées

| Sujet | Décision |
| --- | --- |
| Structure | Run roguelite d'environ 15 à 20 minutes : 3 chapitres, chacun terminé par un boss. Salles, ennemis et butin tirés au hasard. Mort = on recommence du début. |
| Kit de départ | Un seul sort : Trait arcanique sur Q. Les touches W, E, R, D et F sont vides. |
| Butin | Un coffre par salle vidée. Il propose 3 sorts tirés au hasard, on en garde un ou on passe. |
| Rareté | Qualité du sort trouvé : Commun, Rare, Épique, Légendaire. Elle améliore ses chiffres. |
| Salles | Elles varient par la taille, le décor, les ennemis, les pièges et le côté de la porte. Pas d'obstacles. |
| Multi | Coopération en ligne par les salons, sans tir allié, butin individuel. |
| Histoire | Un récit court, raconté par un bandeau en jeu et des répliques de boss, sans bloquer la partie. |

## 3. Hors périmètre

Obstacles et murs, dialogues à choix, alliés contrôlés par l'IA, partie rapide en mode histoire, sauvegarde en cours de run, niveaux de difficulté.

## 4. Déroulement d'une run

Une run compte 15 salles : 3 chapitres de 5 salles, soit 4 salles de combat puis la salle du boss.

Cycle d'une salle :

1. **Entrée.** Les joueurs apparaissent côté entrée. Un décompte court bloque les déplacements. Les ennemis de la première vague sont annoncés par un cercle au sol.
2. **Combat.** Les vagues s'enchaînent : la suivante est annoncée dès que la précédente est éliminée.
3. **Salle vidée.** Les sorts ennemis encore en vol sont annulés, le piège s'arrête, un coffre apparaît au centre et la porte de sortie s'ouvre.
4. **Coffre.** Un joueur vivant qui s'approche à moins de 130 unités reçoit son tirage.
5. **Sortie.** Quand tous les joueurs vivants sont dans la zone de la porte, la salle suivante commence.

Durée des décomptes : 5 s pour la première salle (le temps de lire l'intro), 4 s à l'entrée des chapitres 2 et 3, 3,5 s pour une salle de boss, 1,5 s sinon.

Les PV, les recharges et le kit se conservent d'une salle à l'autre. Les contrôles subis (étourdissement, enracinement, ralentissement) sont retirés à l'entrée.

Soins : passer un coffre rend 30 PV, battre un boss soigne entièrement tous les joueurs vivants.

Fin de run : victoire à la mort du troisième boss, défaite quand plus aucun joueur n'est vivant.

## 5. Salles

### Génération

`generateRun(seed)` produit les 15 salles à partir de la graine de la partie. La même graine donne la même run.

| Élément | Variation |
| --- | --- |
| Taille | Tirée parmi 1400×800, 1600×900, 1900×1000, 1250×1000 et 2200×900. Salle de boss : toujours 1900×1000. |
| Décor | Palette du chapitre (voir ci-dessous) et motif au sol tiré parmi `cercles`, `dalles`, `runes`. |
| Porte de sortie | Côté tiré parmi est, nord, sud, différent du côté d'entrée. On entre par le côté opposé à la sortie précédente. Première salle : entrée à l'ouest. La zone de la porte fait 240 unités de large sur 110 de profondeur, au milieu du mur. |
| Vagues | 1 vague en salle 1, 2 en salles 2 et 3, 3 en salle 4. |
| Piège | Aucun en salle 1 ni en salle de boss. Une salle piégée au chapitre 1, deux aux chapitres 2 et 3. |

Chapitres :

| Chapitre | Nom | Palette | Ennemis disponibles | Boss |
| --- | --- | --- | --- | --- |
| 1 | Les Catacombes | pierre bleu-gris (le sol actuel) | rôdeur, tireur, bombe | Le Gardien de pierre |
| 2 | La Forge | brun et braise, accent orange | + pyromancien, bélier | La Forgeronne des braises |
| 3 | Le Sanctuaire du Vide | violet sombre, accent violet clair | + sentinelle | L'Archonte du Vide |

### Vagues

Chaque ennemi a un coût. Une vague dépense un budget de `base + 1,5 × (n − 1)`, où `n` est le numéro de la salle dans le chapitre (1 à 4) et `base` vaut 5, 8 et 9 pour les chapitres 1, 2 et 3. Les ennemis sont tirés parmi ceux du chapitre jusqu'à épuisement du budget, avec au plus 10 ennemis vivants à la fois.

À partir du chapitre 2, les salles 3 et 4 ont une chance sur deux de contenir un ennemi d'élite, un seul par salle.

Les points d'apparition sont tirés à plus de 400 unités de chaque joueur. Chaque apparition est annoncée 0,9 s avant par un cercle au sol.

### Pièges

Un piège réutilise le générateur de sorts de l'arène (`EnvSpawner`) avec un seul type de sort et une cadence faible. Les pièges ne touchent que les joueurs.

| Piège | Sort de l'arène | Cadence (sorts par seconde) | Chapitres |
| --- | --- | --- | --- |
| `fleches` | Trait | 0,4 puis 0,6 | 1, 2, 3 |
| `eruptions` | Éruption | 0,35 puis 0,5 | 2, 3 |
| `lasers` | Rayon | 0,25 puis 0,4 | 3 |

## 6. Ennemis

Toutes les attaques sont annoncées et esquivables. Un ennemi étourdi ou attiré pendant sa préparation perd son attaque. Les ennemis ne se blessent pas entre eux et n'infligent aucun dégât de contact.

Valeurs de départ, au chapitre 1. Elles seront ajustées à l'équilibrage (section 14).

| Ennemi | PV | Vitesse | Rayon | Coût | Comportement et attaque |
| --- | --- | --- | --- | --- | --- |
| Rôdeur | 34 | 255 | 28 | 2 | Fonce au contact. À moins de 110 unités, frappe une zone de rayon 85 sur la position du joueur après 0,55 s : 10 dégâts. Recharge 1,5 s. |
| Tireur | 26 | 215 | 26 | 2 | Se tient entre 520 et 680 unités, recule si on approche à moins de 320. Tire un projectile en ligne (préparation 0,55 s, vitesse 1250, rayon 26) : 9 dégâts. Recharge 2,4 s. |
| Bombe | 16 | 315 | 22 | 1,5 | Court vers le joueur. À moins de 120 unités, s'arrête et explose après 0,75 s dans un rayon de 150 : 20 dégâts, puis meurt. Tuée avant, elle n'explose pas. |
| Pyromancien | 30 | 200 | 28 | 3 | Se tient entre 600 et 800 unités. Lance une éruption de rayon 120 sur la position prévue du joueur, qui explose après 0,95 s : 14 dégâts et ralentissement de 30 % pendant 1,5 s. Recharge 3,2 s. |
| Bélier | 60 | 225 | 36 | 4 | S'approche à 600 unités, annonce un couloir de 650 unités pendant 0,75 s puis le traverse en 0,3 s : 16 dégâts. Recharge 4,5 s. |
| Sentinelle | 55 | 0 | 34 | 4 | Immobile. Tire un éventail de 3 projectiles écartés de 18° (préparation 0,7 s, vitesse 1100) : 9 dégâts chacun. Recharge 3 s. |

Multiplicateurs par chapitre : PV ×1 / ×1,5 / ×1,7, dégâts ×1 / ×1,2 / ×1,45.

**Élite** : PV ×2,5, rayon ×1,25, recharge d'attaque ×0,75, durée des contrôles subis divisée par deux, insensible aux attractions. Coût ×2,5. La sentinelle d'élite tire 5 projectiles.

Comportement commun : chaque ennemi cible le joueur vivant le plus proche et garde sa cible quelques secondes. Sa première attaque part au plus tôt 0,6 s après son apparition. Les ennemis ne se poussent pas : ils se répartissent autour de leur cible en choisissant des points d'arrivée distincts.

## 7. Boss

Règles communes :

- Trois phases selon les PV : au-dessus de 66 %, de 66 à 33 %, sous 33 %. Chaque phase ajoute des attaques et raccourcit les pauses.
- Insensibles aux étourdissements, enracinements et attractions. Les ralentissements s'appliquent.
- Une barre de vie en haut de l'écran, avec le nom et les seuils de phase.
- À sa mort, les ennemis invoqués meurent et tous les sorts ennemis sont annulés.
- Les PV et dégâts ci-dessous sont donnés tels quels, sans multiplicateur de chapitre. Les ennemis invoqués, eux, suivent les multiplicateurs de leur chapitre.

Valeurs de départ, ajustées à l'équilibrage.

### Le Gardien de pierre (chapitre 1)

620 PV, vitesse 150, rayon 80. Marche lentement vers sa cible entre deux attaques.

| Attaque | Phase | Effet |
| --- | --- | --- |
| Ondes de choc | 1 | 3 anneaux centrés sur lui, de rayons 220, 400 et 580 et d'épaisseur 60, annoncés 0,7 s et décalés de 0,45 s : 14 dégâts chacun. 4 anneaux à partir de la phase 2. |
| Poing sismique | 1 | Zone de rayon 210 sur la cible après 1 s : 24 dégâts. Puis 4 explosions de rayon 90 en ligne dans le prolongement : 12 dégâts chacune. |
| Éboulement | 2 | 8 zones de rayon 110 près des joueurs, étalées sur 2,4 s : 16 dégâts chacune. |
| Invocation | 2 et 3 | 2 rôdeurs à l'entrée de la phase. |
| Charge | 3 | Couloir large annoncé 0,9 s puis traversée de la salle : 26 dégâts. Deux fois de suite. |

### La Forgeronne des braises (chapitre 2)

780 PV, vitesse 230, rayon 64. Se tient à environ 600 unités et s'écarte d'un bond si un joueur approche à moins de 250.

| Attaque | Phase | Effet |
| --- | --- | --- |
| Éventail de braises | 1 | 5 projectiles sur 50° vers la cible : 12 dégâts chacun. 7 projectiles en phase 2. En phase 3, deux éventails à 0,5 s d'écart, le second décalé d'un demi-pas. |
| Roue de feu | 1 | 12 projectiles dans toutes les directions, puis 12 autres tournés de 15° après 0,7 s : 12 dégâts chacun. Trois vagues en phase 3. |
| Lames boomerang | 2 | 3 lames qui partent et reviennent en traversant tout : 10 dégâts par passage. |
| Rayons croisés | 3 | 3 rayons qui se croisent sur la cible, annoncés 1 s et décalés de 0,35 s : 22 dégâts chacun. |

### L'Archonte du Vide (chapitre 3)

1000 PV, immobile, rayon 72. Se déplace seulement par téléportation.

| Attaque | Phase | Effet |
| --- | --- | --- |
| Téléportation et nova | 1 | Se téléporte à plus de 450 unités des joueurs, puis déclenche un anneau de rayon 260 et 10 projectiles en étoile : 14 dégâts. |
| Prison | 1 | Cage de rayon 230 autour de la cible (toucher le bord étourdit 1 s), puis 2 éruptions de rayon 120 à l'intérieur : 18 dégâts chacune. |
| Aiguilles | 1 | 8 rayons partant de lui, tournés de 45° en 45° et décalés de 0,28 s, comme une aiguille qui balaie la salle : 20 dégâts. Deux aiguilles opposées en phase 3. |
| Grappin du vide | 2 | Crochet qui attire la cible vers lui, suivi d'une zone de rayon 200 autour de lui : 10 puis 24 dégâts. |
| Invocation | 2 et 3 | 3 bombes à l'entrée de la phase. |
| Pluie de météores | 3 | Un météore de rayon 200 sur chaque joueur et 3 au hasard, deux fois de suite : 30 dégâts. |

## 8. Butin et rareté

### Rareté

| Rareté | Couleur | Dégâts, soins, boucliers | Recharge |
| --- | --- | --- | --- |
| Commun | gris | ×1 | ×1 |
| Rare | bleu | ×1,25 | ×0,9 |
| Épique | violet | ×1,5 | ×0,8 |
| Légendaire | or | ×2 | ×0,65 |

Les champs multipliés sont `dmg`, `dmgMax`, `markDmg`, `shield` et `heal`, arrondis à l'entier. La recharge est arrondie au dixième de seconde. Les sorts sans dégâts (Bond, Flash, Élan, Fantôme, Voile, Stase, Purge) ne gagnent que la recharge.

### Tirage d'un coffre

Le tirage est propre à chaque joueur et se fait au moment où il atteint le coffre.

1. Chaque sort a une touche de destination. Les sorts Q, W, E et R vont sur leur touche. Un sort d'invocateur va sur la touche vide entre D et F (D d'abord), sinon sur celle des deux qui porte la rareté la plus basse (D en cas d'égalité). Un sort d'invocateur déjà possédé garde sa touche.
2. La rareté de chaque carte est tirée selon le chapitre :

| Chapitre | Commun | Rare | Épique | Légendaire |
| --- | --- | --- | --- | --- |
| 1 | 70 % | 25 % | 5 % | 0 % |
| 2 | 45 % | 35 % | 17 % | 3 % |
| 3 | 25 % | 38 % | 27 % | 10 % |

   Un coffre de boss utilise la table du chapitre suivant (table 2 après le boss 1, table 3 après le boss 2) et garantit au moins du Rare.
3. Une carte est écartée si sa rareté est inférieure à celle du sort déjà sur la touche, ou si c'est le même sort à rareté égale. Le même sort à rareté supérieure est une amélioration.
4. Un sort dont la touche est vide a quatre fois plus de chances de sortir.
5. Les 3 cartes visent 3 touches différentes quand c'est possible. S'il reste moins de 3 cartes valables, le coffre en propose moins.

Prendre une carte place le sort sur sa touche, prêt à être lancé. Passer rend 30 PV.

Le coffre du troisième boss n'existe pas : la run se termine à sa mort.

## 9. Histoire

Le récit : sous l'Arène dort celui qui l'a bâtie, l'Archonte du Vide. Il s'éveille, aspire la magie des champions et scelle leurs sorts dans des coffres gardés par ses serviteurs. Le joueur descend les reprendre.

Les textes s'affichent dans un bandeau en jeu, sans bloquer la partie. Durée d'affichage : 2,5 s plus 0,28 s par mot, entre 3,5 et 9 s. Les répliques de boss portent le nom du boss.

| Clé | Moment | Qui parle | Texte |
| --- | --- | --- | --- |
| `intro` | Début de la run | Narration | Sous l'Arène dort celui qui l'a bâtie. Cette nuit, il s'est éveillé et a pris toute ta magie. Il ne te reste qu'un sort. Les autres sont en bas. Descends. |
| `boss1` | Entrée, salle du boss 1 | Le Gardien de pierre | Nul ne descend plus bas. |
| `boss1p3` | Phase 3 du boss 1 | Le Gardien de pierre | La pierre… ne cède… pas ! |
| `boss1end` | Mort du boss 1 | Narration | Le Gardien s'effondre. Derrière lui, un escalier, et une lueur rouge. |
| `ch2` | Entrée du chapitre 2 | Narration | La chaleur monte. C'est ici qu'on forge les coffres qui retiennent tes sorts. |
| `boss2` | Entrée, salle du boss 2 | La Forgeronne des braises | Tes sorts font de très bons lingots. |
| `boss2p3` | Phase 3 du boss 2 | La Forgeronne des braises | Assez joué. Au feu ! |
| `boss2end` | Mort du boss 2 | Narration | Les fourneaux s'éteignent. Le dernier escalier s'enfonce dans le noir. |
| `ch3` | Entrée du chapitre 3 | Narration | Plus de murs, plus de ciel. Seulement lui, et tout ce qu'il a volé. |
| `boss3` | Entrée, salle du boss 3 | L'Archonte du Vide | Chaque sort lancé là-haut m'a nourri. Les tiens aussi. |
| `boss3p3` | Phase 3 du boss 3 | L'Archonte du Vide | Ils sont à moi. Tous ! |
| `win` | Écran de victoire | Narration | L'Archonte se dissipe. La magie qu'il retenait remonte d'un coup vers l'Arène, et retombe en pluie de sorts. Là-haut, il va falloir apprendre à esquiver. |
| `lose` | Écran de défaite | Narration | Le Vide garde tes sorts. L'Arène attendra un autre champion. |

## 10. Coop

- De 1 à 3 joueurs dans un salon de type `story`. La partie démarre quand tous les joueurs présents sont prêts, sans attendre que le salon soit plein. Pas d'IA alliée.
- Pas de tir allié. Les sorts personnels (soin, boucliers) ne touchent que leur lanceur.
- Couleurs des joueurs : bleu `#38bdf8`, vert `#4ade80`, blanc `#f1f5f9`. Les ennemis et leurs sorts sont dans des tons chauds.
- PV des ennemis ×(1 + 0,7 × (n − 1)) et PV des boss ×(1 + 0,8 × (n − 1)) pour `n` joueurs présents à l'entrée de la salle.
- Un joueur mort regarde la fin de la salle. Il revient à la salle suivante avec 50 % de ses PV. Il ne reçoit pas le coffre de la salle où il est mort.
- Sortie : la salle suivante commence quand tous les joueurs vivants sont dans la zone de la porte, ou 12 s après l'arrivée du premier. Un tirage de coffre encore ouvert à ce moment est perdu.
- Un joueur qui quitte la partie est retiré. La run continue pour les autres.

## 11. Interface

### Menu

Une section « Histoire » en tête de la liste des modes, ouverte par défaut. Elle contient une phrase de présentation, la ligne de record, un bouton « Jouer en solo » et un bouton « Créer un salon coop ». Rejoindre un salon coop se fait avec le code ou le lien d'invitation, comme aujourd'hui.

Le build du menu ne s'applique pas au mode histoire.

### Salon coop

Trois places, pas de réglages de manches ni de sorts de l'arène, pas de bouton « Ajouter une IA ».

### En jeu

- **Haut de l'écran** : « Chapitre 1 : Les Catacombes », « Salle 2 / 5 », le chrono de la run. En salle de boss, la barre de vie du boss.
- **Barre de sorts** : une touche vide est sombre et marquée d'un tiret. Un sort porte une bordure à la couleur de sa rareté.
- **Ennemis** : une silhouette propre à chaque type, une barre de vie courte au-dessus. Les élites ont une aura et leur nom.
- **Salle** : cercles d'apparition, coffre au centre, porte fermée puis lumineuse une fois ouverte.
- **Bandeau de narration** : le texte en cours, avec le nom du boss s'il parle.
- **Coop** : PV des alliés en haut à gauche, compteur « 1 / 2 dans la porte », mention « À terre : retour à la prochaine salle » pour un joueur mort.

Au début d'une salle, le gros décompte chiffré du mode versus est remplacé par le titre de la salle.

### Coffre

Une fenêtre avec les cartes proposées et un bouton « Passer (+30 PV) ». Chaque carte montre l'icône du sort, son nom, sa rareté, sa touche, sa description avec les chiffres réels, sa recharge, et ce qu'elle remplace (« Touche vide », « Remplace Flash (Commun) » ou « Amélioration »). Les touches 1, 2 et 3 choisissent une carte. Échap ne ferme pas la fenêtre. Le joueur s'arrête de marcher à l'ouverture.

### Fin de run

L'écran de résultats affiche « Victoire » ou « Défaite », le texte `win` ou `lose`, le chapitre et la salle atteints, le temps, les sorts du kit final avec leur rareté et un tableau par joueur (dégâts, éliminations, morts). Boutons : « Rejouer » et « Menu » en solo, « Rejouer » et « Quitter le salon » en coop.

### Record

Enregistré dans les réglages du navigateur (`settings.story`) : nombre de salles vidées au mieux, nombre de victoires, meilleur temps d'une victoire.

### Sons

Cinq sons synthétisés en plus : apparition d'ennemis, ouverture du coffre, sort pris (plus aigu selon la rareté), porte, entrée d'un boss.

## 12. Architecture

Approche retenue : étendre le moteur actuel. Les ennemis sont des unités du même type que les joueurs, avec une équipe. Tous les sorts et contrôles existants s'appliquent donc aux ennemis sans code propre. Le mode histoire est une sous-classe de `Match`.

### 12.1 Moteur

Ces changements ont des valeurs par défaut qui reproduisent le comportement actuel.

**`shared/sim.js`**

- `createPlayer(def, slot)` gagne les champs `team` (par défaut l'id du joueur), `r` (rayon, par défaut `PLAYER_RADIUS`), `maxHp` (`MAX_HP`), `spd` (`MOVE_SPEED`), `cc` (multiplicateur de durée des contrôles subis, 1 par défaut, 0 pour un boss), `mob` (type d'ennemi, vide pour un joueur) et `rar` (rareté par touche, `null` par défaut).
- Si `def.loadout` est fourni, `build` et `rar` en sont copiés tels quels, touches vides comprises. Sinon `sanitizeBuild` s'applique comme aujourd'hui.
- `speedAt`, `clampToBounds`, `towards`, `applyBuff`, `resetForRound` et `extrapolate` lisent `spd`, `r` et `maxHp` sur l'unité.
- `autoAttack` abandonne une cible de la même équipe et mesure la portée jusqu'au bord de la cible.
- `packMob` et `unpackMob` : version compacte d'une unité ennemie pour le réseau (un tableau d'environ 17 valeurs).

**`shared/abilities.js`**

- `RARITIES` : les quatre raretés, leur nom, leur couleur et leurs multiplicateurs.
- `scaled(id, niveau)` : le sort avec ses chiffres de rareté, mis en cache. Au niveau 0, renvoie l'objet d'origine.
- `abilityOf(p, slot)` : renvoie `undefined` pour une touche vide et applique la rareté. Le repli sur `DEFAULT_BUILD` ne sert plus que si le build ne définit pas la touche.
- Les descriptions deviennent des gabarits (`{dmg}`, `{shield}`…). `describe(ab)` les remplit avec les chiffres réels du sort. Le menu de build et l'aide passent par `describe`.

**`shared/match.js`**

- `units` : la liste de toutes les unités, joueurs puis ennemis. `mobs` : les ennemis par id. `unit(id)` cherche dans les deux. `players` et `order` ne contiennent toujours que les joueurs.
- Chaque sort porte l'équipe de son lanceur. Un sort touche toute unité vivante d'une autre équipe. Un sort sans équipe touche tout le monde, comme les sorts de l'arène aujourd'hui. En versus, l'équipe d'un joueur est son id : le comportement ne change pas.
- Les collisions utilisent le rayon de la cible. Les durées d'étourdissement et d'enracinement sont multipliées par `cc`. Une attraction demande `cc` égal à 1.
- `interrupt` annule aussi les sorts dont le champ `cu` (annulable jusqu'à) n'est pas dépassé, pour les attaques d'ennemis en préparation.
- Points d'extension, sans effet dans la classe de base : `setup(o)` avant la première manche, `tick(t0, t1)` à chaque pas de jeu, `command(p, cmd, t)` pour les commandes.

**`shared/spawner.js`**

- Un préréglage peut porter `only`, la liste des sorts autorisés.

### 12.2 `shared/story/`

| Fichier | Rôle | Interface principale |
| --- | --- | --- |
| `match.js` | `StoryMatch extends Match` : état de la run et de la salle, vagues, coffre, porte, butin, retour des morts, fin de run. | `new StoryMatch({ players, time, seed })`, mêmes méthodes que `Match` |
| `rooms.js` | Chapitres, tailles, pièges, budget des vagues, génération de la run. | `CHAPTERS`, `generateRun(seed)` |
| `mobs.js` | Définitions des ennemis et leur IA. | `MOBS`, `MobBrain` |
| `bosses.js` | Les trois boss, leurs phases et leurs attaques. | `BOSSES`, `BossBrain` |
| `loot.js` | Kit de départ, tables de rareté, tirage d'un coffre. | `heroDef(def)`, `drawOffer(rng, hero, chapitre, coffreDeBoss)` |
| `script.js` | Les textes de la section 9. | `SCRIPT` |
| `state.js` | État de la salle reconstruit à partir des événements, pour l'affichage. | `StoryState`, `apply(ev)` |

`StoryMatch` remplace `startRound` (entrée dans une salle) et `checkEnd`, et branche sa logique sur `setup`, `tick` et `command`. L'IA des ennemis crée ses sorts avec `addSpell`, comme le fait `EnvSpawner`. Elle déplace les ennemis avec le même modèle de déplacement que les joueurs, ce qui permet aux clients d'extrapoler leur position entre deux snapshots.

Les sorts de piège reçoivent l'équipe des ennemis : ils ne touchent donc que les joueurs.

Les ennemis morts sont retirés au début du pas de jeu suivant, jamais pendant le parcours des collisions.

`StoryState` est utilisé par la partie locale et par la partie en ligne. Les deux affichent ainsi la même chose à partir des mêmes événements.

### 12.3 Client

| Fichier | Changement |
| --- | --- |
| `public/js/localgame.js` | Accepte `kind: 'story'`, crée un `StoryMatch`, alimente un `StoryState`, expose `mobs` et `story` dans `view()`. |
| `public/js/netgame.js` | Accepte `kind: 'story'` : ennemis créés par l'événement `spawn`, mis à jour par les snapshots, extrapolés comme les adversaires. Prédiction des impacts par équipe. |
| `public/js/net.js` | Transmet `kind` à `NetGame`. |
| `public/js/render.js` | Touches vides et bordure de rareté dans la barre de sorts, rayon et PV max lus sur l'unité, aiguillage vers le rendu histoire. |
| `public/js/render-story.js` (nouveau) | Sol par chapitre et motif, ennemis, boss, coffre, porte, cercles d'apparition, haut d'écran, barre de boss, bandeau de narration. |
| `public/js/story-ui.js` (nouveau) | Section du menu, fenêtre du coffre, résultats de la run, record. |
| `public/js/main.js` | Démarrage des sessions histoire, événements histoire vers effets et sons, clic droit sur un ennemi. |
| `public/js/input.js` | Aucun changement de logique : la cible du clic droit et les sorts sans visée viennent de `main.js`. |
| `public/js/audio.js`, `settings.js`, `index.html`, `style.css` | Sons, record, section du menu, fenêtre du coffre. |

### 12.4 Serveur et protocole

**`server/lobby.js`** : `create` accepte le mode `story`. Un salon `story` a 3 places, refuse les IA et les changements de réglages, et démarre quand tous les présents sont prêts. Il crée un `StoryMatch`. La file de partie rapide refuse ce mode.

Messages :

| Sens | Message | Contenu |
| --- | --- | --- |
| client vers serveur | `create` | `mode: 'story'` |
| client vers serveur | `in` | nouvelle commande `k: 'loot'`, `i` de −1 (passer) à 2 |
| serveur vers client | `start` | ajoute `kind: 'story'`, les joueurs portent `team` et `loadout` |
| serveur vers client | `s` | ajoute `m`, la liste compacte des ennemis vivants |

Événements ajoutés au flux existant :

| Événement | Rôle |
| --- | --- |
| `room` | Entrée dans une salle : règles (taille, décompte), chapitre, numéro, type, décor, porte. Remplace `round` en mode histoire. |
| `warn` | Cercle d'apparition : position, rayon, instant. |
| `spawn` | Nouvel ennemi : définition et état initial. |
| `boss` | Entrée d'un boss ou changement de phase. |
| `clear` | Salle vidée : position du coffre, porte ouverte. |
| `offer` | Tirage d'un joueur : cartes et soin en cas de refus. |
| `kit` | Un joueur a pris un sort : touche, sort, rareté. |
| `looted` | Un joueur a répondu à son tirage. |
| `heal` | Soin reçu : joueur et montant. |
| `revive` | Retour d'un joueur mort. |
| `exit` | Joueurs dans la porte : nombre, total, échéance. |
| `say` | Texte à afficher : clé de `SCRIPT`. |
| `storyEnd` | Fin de run : victoire ou défaite, salle atteinte, temps, statistiques, kits. |

Les événements `sp`, `end`, `hit`, `die`, `go`, `flash`, `dash`, `buff` et `left` servent tels quels.

## 13. Cas limites et erreurs

- **Commande de butin invalide** (pas de tirage en attente, indice hors bornes, joueur mort) : ignorée.
- **Joueur qui marche vers la porte en ouvrant le coffre** : le serveur l'arrête à l'ouverture du tirage.
- **Tirage en attente au changement de salle** : perdu, sans soin.
- **Joueur déconnecté** : retiré de la partie. S'il ne reste aucun joueur vivant, la run se termine en défaite. S'il ne reste aucun humain, le salon est supprimé, comme aujourd'hui.
- **Tous les sorts au maximum** : le coffre propose moins de 3 cartes, voire seulement le soin.
- **Touche vide** : la commande de lancement est refusée, le client n'affiche pas de visée.
- **Boss tué pendant une attaque en cours** : tous les sorts ennemis sont annulés.
- **Perte de connexion** : retour au menu avec un message, comme aujourd'hui.

## 14. Tests

Tests automatiques (`node --test`), dans le style des tests actuels :

- **Moteur** : pas de tir allié dans une même équipe, un sort ennemi ne touche pas un ennemi, collisions selon le rayon de la cible, `cc` réduit ou annule les contrôles. Les 32 tests actuels restent verts.
- **Rareté** : `scaled` multiplie les bons champs, une touche vide ne lance rien, `describe` affiche les chiffres réels.
- **Butin** : cartes distinctes, touches vides favorisées, jamais de carte inférieure, prise et amélioration, soin en passant, même tirage avec la même graine.
- **Salles** : même run avec la même graine, 3 chapitres terminés par un boss, tailles et portes variées.
- **Déroulement** : vagues successives, salle vidée, coffre, porte, salle suivante avec PV conservés.
- **Ennemis** : chaque type touche un joueur immobile, rate un joueur qui s'écarte, perd son attaque s'il est étourdi pendant la préparation.
- **Boss** : chaque boss enchaîne toutes ses attaques sans erreur, change de phase aux bons seuils, ignore les étourdissements. La mort du troisième boss donne la victoire.
- **Mort** : défaite en solo. En coop, retour à la salle suivante avec 50 % des PV.
- **Run complète** : un pilote scripté joue les 15 salles avec une graine fixe jusqu'à la victoire.
- **Serveur** : salon `story`, démarrage à deux, ennemis dans les snapshots, commande de butin, départ d'un joueur sans arrêter la run.
- **Réseau** : la prédiction locale reste exacte en mode histoire.

Équilibrage : un script de simulation fait jouer des runs à un pilote scripté sur plusieurs graines et mesure la durée et les dégâts subis par salle. Les valeurs des sections 5 à 8 sont ajustées pour viser une run de 15 à 20 minutes.

Vérification à l'écran : le jeu est lancé dans le navigateur pour contrôler le rendu des salles, des ennemis, des boss, du coffre et des écrans.

## 15. Ordre de construction

1. Moteur : équipes, stats par unité, rareté, touches vides. Aucun changement visible.
2. Histoire sans affichage : salles, vagues, ennemis, butin, porte, fin de run.
3. Histoire solo jouable : partie locale, rendu, interface, menu.
4. Boss et narration.
5. Coop en ligne : serveur, protocole, partie en ligne.
6. Équilibrage et README.

Chaque étape laisse le jeu jouable et les tests verts.

## 16. Critères de réussite

1. Depuis le menu, une run solo se joue de la première salle au dernier boss, hors ligne.
2. Deux ou trois joueurs font la même run ensemble par un salon.
3. On démarre avec le seul sort Q. Les coffres proposent 3 sorts avec une rareté, et le sort choisi est utilisable aussitôt.
4. Les salles diffèrent par la taille, le décor, les ennemis, les pièges et la porte.
5. Les trois boss ont des attaques propres et trois phases.
6. Les textes de la section 9 s'affichent aux moments prévus.
7. Survie, Contre l'IA et En ligne se comportent comme avant, et tous les tests passent.
