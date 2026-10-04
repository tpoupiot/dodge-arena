# Dodge Arena

Jeu d'esquive de sorts dans le navigateur, avec les contrôles de League of Legends : clic droit pour bouger, Q W E R pour les sorts, Flash sur D. Trois façons de jouer :

- **Survie** : seul face aux sorts de l'arène, qui arrivent de plus en plus vite.
- **Contre l'IA** : duel hors ligne en 1v1 ou 1v1v1.
- **En ligne** : 1v1 ou 1v1v1 contre des amis (salon privé avec code) ou en partie rapide. L'hôte peut compléter un salon avec des IA.

En versus, chacun joue avec son build. Des sorts de l'arène tombent sur tout le monde, et le dernier debout gagne la manche. L'arène est plus grande en 1v1v1 qu'en 1v1. Au bout de 60 s, elle rétrécit (mort subite).

## Lancer le jeu

Il faut [Node.js](https://nodejs.org) 18 ou plus récent.

```bash
npm install
npm start
```

Ouvre ensuite http://localhost:3000.

## Jouer à plusieurs

- **Même réseau (Wi-Fi, LAN)** : au démarrage, le serveur affiche une adresse « Réseau local » du type `http://192.168.1.20:3000`. Les autres joueurs l'ouvrent dans leur navigateur.
- **Par Internet** : héberge le projet chez n'importe quel service qui fait tourner Node.js avec les WebSockets (Render, Railway, Fly.io, un VPS...). Commande de démarrage : `npm start`. Le port est lu dans la variable `PORT`. Un `Dockerfile` est fourni.
- **Inviter** : dans un salon, « Copier le lien d'invitation » donne une adresse `?salon=CODE` qui fait rejoindre directement. On peut aussi taper le code à 4 caractères dans le menu.

## Commandes

| Touche | Action |
| --- | --- |
| Clic droit | Se déplacer (maintenu : suit le curseur) |
| Clic droit sur un ennemi | Le poursuivre et l'auto-attaquer |
| S | S'arrêter |
| Q W E R | Sorts du build |
| D F | Sorts d'invocateur |
| Échap | Pause (solo) ou menu (en ligne) |
| Entrée | Discuter (en ligne) |

Les touches suivent leur position sur le clavier, comme dans LoL : sur un clavier AZERTY, les sorts sont sur A Z E R. Tout se reconfigure dans *Paramètres*, y compris le mode de lancement : rapide, rapide avec indicateur, ou normal (clic gauche).

**Auto-attaque** : portée 550, 6 dégâts, une attaque par seconde. Le projectile suit sa cible, comme les attaques à distance de LoL ; seuls un Flash ou un Bond bien placés permettent de sortir de portée.

## Builds

« Modifier le build », dans le menu ou dans le salon, permet de choisir un sort par touche :

| Touche | Choix |
| --- | --- |
| Q | Trait arcanique (rapide), Lien obscur (enracine), Grappin (attire), Orbe d'aller-retour, Javelot (dégâts selon la distance) |
| W | Éruption (zone, ralentit), Salve (explosions en ligne), Cage (anneau qui étourdit), Bouclier, Flux marqué (marque à faire exploser) |
| E | Bond (ruée), Élan (vitesse), Voile anti-sort (bloque un sort), Stase (invulnérable mais immobile) |
| R | Lien de glace (étourdit), Rayon final (laser), Météore (énorme zone), Barrage (onde qui traverse tout) |
| D, F | Flash, Fantôme, Soin, Purge, Barrière |

Le build est envoyé au serveur et s'applique dès la partie suivante. Les IA tirent un build au hasard. En survie, seuls E, D et F servent.

## Comment ça marche

- Le serveur fait autorité : il simule la partie 60 fois par seconde et envoie 30 snapshots par seconde.
- Le navigateur prédit ton propre déplacement immédiatement, puis se recale sur le serveur (réconciliation). Même avec 200 ms de latence, la position prédite reste exacte au centième d'unité près.
- Les trajectoires des sorts sont déterministes : le serveur envoie seulement leur apparition, et chaque client les calcule. Tout est affiché au moment où tes commandes arriveront sur le serveur, donc ce qui t'évite à l'écran t'évite vraiment.
- La même simulation (`shared/`) tourne sur le serveur et dans le navigateur. C'est elle qui sert pour le solo et contre l'IA, hors ligne.

## Structure

```
server/   serveur HTTP + WebSocket, salons, file d'attente
shared/   simulation commune : règles, sorts, IA, parties
public/   client : rendu canvas, contrôles, menus, réseau
test/     tests (npm test)
```

Pour rééquilibrer le jeu :

- sorts disponibles, dégâts, portées, recharges et auto-attaque : `shared/abilities.js` (un sort ajouté là apparaît automatiquement dans l'écran de build) ;
- fréquence des sorts de l'arène par difficulté : `shared/spawner.js` ;
- vitesse, taille de l'arène (de base et à 3 joueurs) et durée avant la mort subite : `shared/constants.js`.

## Tests

```bash
npm test
```

Les tests couvrent les règles de jeu, des parties complètes entre IA, le serveur (salons, file rapide, IA, abandon, messages invalides) et la prédiction réseau avec une latence simulée.

---

Projet de fan, non affilié à Riot Games. Les noms des sorts et tous les visuels sont originaux. Polices Big Shoulders Display et Barlow sous licence SIL Open Font License (voir `public/fonts`).
