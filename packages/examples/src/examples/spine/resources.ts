/**
 * melonJS — Spine 4.2 runtime animation example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
const base = `${import.meta.env.BASE_URL}assets/spine/data/`;

export const resources = [
	// alien
	{ name: "alien-ess.json", type: "spine", src: `${base}alien-ess.json` },
	{ name: "alien.atlas", type: "spine", src: `${base}alien.atlas` },
	// coin
	{ name: "coin-pma.atlas", type: "spine", src: `${base}coin-pma.atlas` },
	{ name: "coin-pro.json", type: "spine", src: `${base}coin-pro.json` },
	// cloud-pot
	{
		name: "cloud-pot-pma.atlas",
		type: "spine",
		src: `${base}cloud-pot-pma.atlas`,
	},
	{ name: "cloud-pot.json", type: "spine", src: `${base}cloud-pot.json` },
	// dragon
	{ name: "dragon-ess.json", type: "spine", src: `${base}dragon-ess.json` },
	{ name: "dragon-pma.atlas", type: "spine", src: `${base}dragon-pma.atlas` },
	// goblins
	{ name: "goblins-pma.atlas", type: "spine", src: `${base}goblins-pma.atlas` },
	{ name: "goblins-pro.json", type: "spine", src: `${base}goblins-pro.json` },
	// hero
	{ name: "hero-pma.atlas", type: "spine", src: `${base}hero-pma.atlas` },
	{ name: "hero-pro.json", type: "spine", src: `${base}hero-pro.json` },
	// mix-and-match
	{
		name: "mix-and-match-pma.atlas",
		type: "spine",
		src: `${base}mix-and-match-pma.atlas`,
	},
	{
		name: "mix-and-match-pro.json",
		type: "spine",
		src: `${base}mix-and-match-pro.json`,
	},
	// owl
	{ name: "owl-pma.atlas", type: "spine", src: `${base}owl-pma.atlas` },
	{ name: "owl-pro.json", type: "spine", src: `${base}owl-pro.json` },
	// powerup
	{ name: "powerup-pma.atlas", type: "spine", src: `${base}powerup-pma.atlas` },
	{ name: "powerup-pro.json", type: "spine", src: `${base}powerup-pro.json` },
	// raptor
	{ name: "raptor-pma.atlas", type: "spine", src: `${base}raptor-pma.atlas` },
	{ name: "raptor-pro.json", type: "spine", src: `${base}raptor-pro.json` },
	// sack
	{ name: "sack-pma.atlas", type: "spine", src: `${base}sack-pma.atlas` },
	{ name: "sack-pro.json", type: "spine", src: `${base}sack-pro.json` },
	// speedy
	{ name: "speedy-pma.atlas", type: "spine", src: `${base}speedy-pma.atlas` },
	{ name: "speedy-ess.json", type: "spine", src: `${base}speedy-ess.json` },
	// spineboy
	{
		name: "spineboy-pma.atlas",
		type: "spine",
		src: `${base}spineboy-pma.atlas`,
	},
	{ name: "spineboy-pro.json", type: "spine", src: `${base}spineboy-pro.json` },
	// stretchyman
	{
		name: "stretchyman-pma.atlas",
		type: "spine",
		src: `${base}stretchyman-pma.atlas`,
	},
	{
		name: "stretchyman-pro.json",
		type: "spine",
		src: `${base}stretchyman-pro.json`,
	},
	// tank
	{ name: "tank-pma.atlas", type: "spine", src: `${base}tank-pma.atlas` },
	{ name: "tank-pro.json", type: "spine", src: `${base}tank-pro.json` },
	// vine
	{ name: "vine-pma.atlas", type: "spine", src: `${base}vine-pma.atlas` },
	{ name: "vine-pro.json", type: "spine", src: `${base}vine-pro.json` },
	// windmill
	{
		name: "windmill-pma.atlas",
		type: "spine",
		src: `${base}windmill-pma.atlas`,
	},
	{ name: "windmill-ess.json", type: "spine", src: `${base}windmill-ess.json` },
];

export const characters = [
	{
		name: "spineboy",
		label: "Spineboy",
		atlas: "spineboy-pma.atlas",
		json: "spineboy-pro.json",
		animation: "walk",
		x: 600,
		y: 950,
	},
	{
		name: "alien",
		label: "Alien",
		atlas: "alien.atlas",
		json: "alien-ess.json",
		animation: "death",
		x: 600,
		y: 1000,
	},
	{
		name: "coin",
		label: "Coin",
		atlas: "coin-pma.atlas",
		json: "coin-pro.json",
		animation: "animation",
		x: 750,
		y: 500,
	},
	{
		name: "cloud-pot",
		label: "Cloud Pot",
		atlas: "cloud-pot-pma.atlas",
		json: "cloud-pot.json",
		animation: "playing-in-the-rain",
		x: 600,
		y: 950,
		scale: 0.6,
	},
	{
		name: "dragon",
		label: "Dragon",
		atlas: "dragon-pma.atlas",
		json: "dragon-ess.json",
		animation: "flying",
		x: 750,
		y: 850,
	},
	{
		name: "goblins",
		label: "Goblins",
		atlas: "goblins-pma.atlas",
		json: "goblins-pro.json",
		animation: "walk",
		x: 600,
		y: 900,
		skin: "goblin",
	},
	{
		name: "hero",
		label: "Hero",
		atlas: "hero-pma.atlas",
		json: "hero-pro.json",
		animation: "idle",
		x: 750,
		y: 900,
	},
	{
		name: "mix-and-match",
		label: "Mix & Match",
		atlas: "mix-and-match-pma.atlas",
		json: "mix-and-match-pro.json",
		animation: "dance",
		x: 750,
		y: 950,
		skin: "full-skins/girl",
	},
	{
		name: "owl",
		label: "Owl",
		atlas: "owl-pma.atlas",
		json: "owl-pro.json",
		animation: "idle",
		x: 750,
		y: 800,
	},
	{
		name: "powerup",
		label: "Powerup",
		atlas: "powerup-pma.atlas",
		json: "powerup-pro.json",
		animation: "bounce",
		x: 750,
		y: 700,
	},
	{
		name: "raptor",
		label: "Raptor",
		atlas: "raptor-pma.atlas",
		json: "raptor-pro.json",
		animation: "walk",
		x: 550,
		y: 1050,
		scale: 0.7,
	},
	{
		name: "sack",
		label: "Sack",
		atlas: "sack-pma.atlas",
		json: "sack-pro.json",
		animation: "walk",
		x: 750,
		y: 950,
	},
	{
		name: "speedy",
		label: "Speedy",
		atlas: "speedy-pma.atlas",
		json: "speedy-ess.json",
		animation: "run",
		x: 750,
		y: 700,
	},
	{
		name: "tank",
		label: "Tank",
		atlas: "tank-pma.atlas",
		json: "tank-pro.json",
		animation: "drive",
		x: 750,
		y: 800,
		scale: 0.5,
	},
	{
		name: "vine",
		label: "Vine",
		atlas: "vine-pma.atlas",
		json: "vine-pro.json",
		animation: "grow",
		x: 750,
		y: 1100,
	},
	{
		name: "windmill",
		label: "Windmill",
		atlas: "windmill-pma.atlas",
		json: "windmill-ess.json",
		animation: "animation",
		x: 750,
		y: 700,
		scale: 0.75,
	},
];
