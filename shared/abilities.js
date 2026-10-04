// Définitions des sorts des joueurs (choisis dans le build), de l'auto-attaque et des sorts de l'arène.
// Les noms sont originaux ; les mécaniques reprennent des archétypes connus des MOBA.

// slot : touche à laquelle le sort peut être placé ('S' = sort d'invocateur, sur D ou F).
export const ABILITIES = {
	// ---------------------------------------------------------------- Q
	trait: {
		slot: "Q",
		name: "Trait arcanique",
		kind: "line",
		def: "q",
		windup: 0.2,
		speed: 2000,
		radius: 30,
		range: 1100,
		dmg: 18,
		cd: 1.6,
		desc: "Projectile rapide et fin, 18 dégâts.",
	},
	lien: {
		slot: "Q",
		name: "Lien obscur",
		kind: "line",
		def: "lienq",
		windup: 0.25,
		speed: 1250,
		radius: 42,
		range: 1150,
		dmg: 12,
		root: 1.4,
		cd: 9,
		desc: "Orbe lente qui enracine 1,4 s, 12 dégâts.",
	},
	grappin: {
		slot: "Q",
		name: "Grappin",
		kind: "line",
		def: "grappinq",
		windup: 0.25,
		speed: 1700,
		radius: 34,
		range: 1000,
		dmg: 10,
		pull: 380,
		cd: 11,
		desc: "Crochet qui attire la cible vers toi, 10 dégâts.",
	},
	orbe: {
		slot: "Q",
		name: "Orbe d'aller-retour",
		kind: "line",
		def: "orbe",
		windup: 0.25,
		speed: 1500,
		radius: 38,
		range: 880,
		ret: true,
		pierce: true,
		dmg: 12,
		cd: 6,
		desc: "Part puis revient en traversant tout, 12 dégâts par passage.",
	},
	javelot: {
		slot: "Q",
		name: "Javelot",
		kind: "line",
		def: "javelot",
		windup: 0.25,
		speed: 1900,
		radius: 28,
		range: 1300,
		dmg: 8,
		dmgMax: 28,
		dmgMaxAt: 600, // distance à partir de laquelle les dégâts sont au maximum
		cd: 3.5,
		desc: "Projectile fin : de 8 à 28 dégâts selon la distance, maximum dès 600 unités.",
	},
	// ---------------------------------------------------------------- W
	eruption: {
		slot: "W",
		name: "Éruption",
		kind: "circle",
		def: "w",
		windup: 0.25,
		castRange: 850,
		radius: 130,
		delay: 0.7,
		dmg: 22,
		slow: 0.35,
		slowDur: 1.5,
		cd: 7,
		desc: "Zone qui explose après 0,7 s et ralentit de 35 %, 22 dégâts.",
	},
	salve: {
		slot: "W",
		name: "Salve",
		kind: "salvo",
		def: "salvew",
		windup: 0.25,
		castRange: 800,
		count: 4,
		spacing: 120,
		delay: 0.55,
		stagger: 0.1,
		radius: 85,
		dmg: 13,
		cd: 9,
		desc: "Quatre explosions en ligne vers le curseur, 13 dégâts chacune.",
	},
	cage: {
		slot: "W",
		name: "Cage",
		kind: "ring",
		def: "cagew",
		windup: 0.25,
		castRange: 800,
		radius: 210,
		thickness: 32,
		delay: 0.55,
		active: 2.2,
		dmg: 8,
		stun: 1.2,
		cd: 16,
		desc: "Anneau au curseur : le toucher étourdit 1,2 s.",
	},
	bouclier: {
		slot: "W",
		name: "Bouclier",
		kind: "buff",
		shield: 20,
		shieldDur: 3,
		cd: 13,
		desc: "Bouclier qui absorbe 20 dégâts pendant 3 s.",
	},
	flux: {
		slot: "W",
		name: "Flux marqué",
		kind: "line",
		def: "flux",
		windup: 0.2,
		speed: 1700,
		radius: 44,
		range: 1100,
		dmg: 0,
		mark: 4,
		markDmg: 20,
		cd: 8,
		desc: "Marque la cible 4 s : ton prochain sort ou ta prochaine auto-attaque sur elle inflige +20 dégâts.",
	},
	// ---------------------------------------------------------------- E
	bond: {
		slot: "E",
		name: "Bond",
		kind: "dash",
		range: 340,
		duration: 0.16,
		cd: 7,
		desc: "Ruée rapide vers le curseur.",
	},
	elan: {
		slot: "E",
		name: "Élan",
		kind: "buff",
		speed: 1.6,
		speedDur: 1.6,
		cd: 9,
		desc: "+60 % de vitesse pendant 1,6 s.",
	},
	voile: {
		slot: "E",
		name: "Voile anti-sort",
		kind: "buff",
		spellShield: 1.5,
		cd: 14,
		desc: "Bloque le prochain sort reçu pendant 1,5 s.",
	},
	stase: {
		slot: "E",
		name: "Stase",
		kind: "buff",
		stasis: 1.5,
		cd: 18,
		desc: "Invulnérable pendant 1,5 s, mais immobile et sans sort.",
	},
	// ---------------------------------------------------------------- R
	glace: {
		slot: "R",
		name: "Lien de glace",
		kind: "line",
		def: "r",
		windup: 0.3,
		speed: 1500,
		radius: 50,
		range: 2200,
		dmg: 25,
		stun: 1.5,
		cd: 22,
		desc: "Grand projectile qui traverse l'arène et étourdit 1,5 s, 25 dégâts.",
	},
	rayon: {
		slot: "R",
		name: "Rayon final",
		kind: "beam",
		def: "rayonr",
		windup: 0.3,
		delay: 0.9,
		active: 0.25,
		length: 1500,
		halfWidth: 65,
		dmg: 35,
		cd: 30,
		desc: "Laser annoncé qui frappe toute la ligne après 0,9 s, 35 dégâts.",
	},
	meteore: {
		slot: "R",
		name: "Météore",
		kind: "circle",
		def: "meteore",
		windup: 0.3,
		castRange: 1200,
		radius: 200,
		delay: 1.1,
		dmg: 40,
		cd: 28,
		desc: "Énorme zone qui s'écrase après 1,1 s, 40 dégâts.",
	},
	barrage: {
		slot: "R",
		name: "Barrage",
		kind: "line",
		def: "barrage",
		windup: 0.5,
		speed: 1100,
		radius: 110,
		range: 2600,
		pierce: true,
		dmg: 30,
		cd: 32,
		desc: "Onde très large et lente qui traverse l'arène et tous les joueurs, 30 dégâts.",
	},
	// ---------------------------------------------------------------- sorts d'invocateur (D / F)
	flash: {
		slot: "S",
		name: "Flash",
		kind: "blink",
		range: 400,
		cd: 15,
		desc: "Téléportation instantanée sur 400 unités.",
	},
	fantome: {
		slot: "S",
		name: "Fantôme",
		kind: "buff",
		speed: 1.45,
		speedDur: 3.5,
		cd: 24,
		desc: "+45 % de vitesse pendant 3,5 s.",
	},
	soin: {
		slot: "S",
		name: "Soin",
		kind: "buff",
		heal: 20,
		speed: 1.3,
		speedDur: 1,
		cd: 30,
		desc: "Rend 20 PV et donne +30 % de vitesse 1 s.",
	},
	purge: {
		slot: "S",
		name: "Purge",
		kind: "buff",
		cleanse: true,
		cd: 22,
		desc: "Retire étourdissement, enracinement et ralentissement. Utilisable étourdi.",
	},
	barriere: {
		slot: "S",
		name: "Barrière",
		kind: "buff",
		shield: 45,
		shieldDur: 2.5,
		cd: 30,
		desc: "Bouclier qui absorbe 45 dégâts pendant 2,5 s.",
	},
}
for (const id in ABILITIES) ABILITIES[id].id = id

// Auto-attaque : clic droit sur un ennemi (projectile à tête chercheuse, comme les attaques à distance de LoL).
export const AUTO = { range: 200, windup: 0.22, cd: 1.0, speed: 1700, dmg: 6 }

export const BUILD_SLOTS = ["Q", "W", "E", "R", "D", "F"]
export const DEFAULT_BUILD = {
	Q: "trait",
	W: "eruption",
	E: "bond",
	R: "glace",
	D: "flash",
	F: "fantome",
}

export function poolFor(slot) {
	const cat = slot === "D" || slot === "F" ? "S" : slot
	return Object.keys(ABILITIES).filter((id) => ABILITIES[id].slot === cat)
}

// Corrige un build reçu (réseau, sauvegarde) : sorts valides, pas deux fois le même invocateur.
export function sanitizeBuild(b) {
	const out = { ...DEFAULT_BUILD }
	if (b && typeof b === "object") {
		for (const slot of BUILD_SLOTS) {
			if (typeof b[slot] === "string" && poolFor(slot).includes(b[slot])) out[slot] = b[slot]
		}
	}
	if (out.D === out.F) out.F = out.D === "flash" ? "fantome" : "flash"
	return out
}

export function randomBuild(rng = Math.random) {
	const b = {}
	for (const slot of ["Q", "W", "E", "R"]) {
		const pool = poolFor(slot)
		b[slot] = pool[Math.floor(rng() * pool.length)]
	}
	b.D = "flash"
	const others = poolFor("F").filter((id) => id !== "flash")
	b.F = others[Math.floor(rng() * others.length)]
	return b
}

export function abilityOf(p, slot) {
	return ABILITIES[(p.build && p.build[slot]) || DEFAULT_BUILD[slot]]
}

// Sorts lancés par l'arène (mode survie et pression en versus).
// unlock = secondes avant apparition (survie normale), weight = fréquence relative.
export const ENV_SPELLS = {
	trait: {
		name: "Trait",
		kind: "line",
		windup: 0.35,
		speed: 1700,
		radius: 30,
		dmg: 15,
		unlock: 0,
		weight: 10,
	},
	lien: {
		name: "Lien obscur",
		kind: "line",
		windup: 0.45,
		speed: 1150,
		radius: 40,
		dmg: 10,
		root: 1.2,
		unlock: 6,
		weight: 6,
	},
	eruption: {
		name: "Éruption",
		kind: "circle",
		delay: 0.85,
		radius: 140,
		dmg: 20,
		slow: 0.4,
		slowDur: 1.5,
		unlock: 10,
		weight: 6,
	},
	grappin: {
		name: "Grappin",
		kind: "line",
		windup: 0.4,
		speed: 1600,
		radius: 34,
		dmg: 8,
		pull: 300,
		unlock: 18,
		weight: 4,
	},
	salve: {
		name: "Salve",
		kind: "salvo",
		count: 5,
		spacing: 120,
		delay: 0.75,
		stagger: 0.11,
		radius: 95,
		dmg: 12,
		unlock: 28,
		weight: 3,
	},
	fleche: {
		name: "Flèche de glace",
		kind: "line",
		windup: 0.6,
		speed: 1350,
		radius: 55,
		dmg: 25,
		stun: 1.4,
		unlock: 36,
		weight: 3,
	},
	rayon: {
		name: "Rayon",
		kind: "beam",
		delay: 1.0,
		active: 0.25,
		halfWidth: 60,
		dmg: 30,
		unlock: 45,
		weight: 2,
	},
	boomerang: {
		name: "Boomerang",
		kind: "line",
		windup: 0.35,
		speed: 1400,
		radius: 40,
		range: 950,
		ret: true,
		pierce: true,
		dmg: 12,
		unlock: 55,
		weight: 3,
	},
	cage: {
		name: "Cage",
		kind: "ring",
		delay: 0.6,
		radius: 230,
		thickness: 34,
		active: 2.6,
		dmg: 10,
		stun: 1.3,
		unlock: 70,
		weight: 2,
	},
}

export const PULL_DURATION = 0.25

// Nom lisible d'un sort (pour les messages "éliminé par ...").
export function spellName(def) {
	if (def === "auto") return "une auto-attaque"
	if (ENV_SPELLS[def]) return ENV_SPELLS[def].name
	const ab = Object.values(ABILITIES).find((a) => a.def === def)
	return ab ? ab.name : def
}
