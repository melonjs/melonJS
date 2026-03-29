const base = `${import.meta.env.BASE_URL}assets/spine/data/`;

export const resources = [
	// alien
	{ name: "alien-ess.json", type: "spine", src: `${base}alien-ess.json` },
	{ name: "alien.atlas", type: "spine", src: `${base}alien.atlas` },
	// coin
	{ name: "coin-pma.atlas", type: "spine", src: `${base}coin-pma.atlas` },
	{ name: "coin-pro.json", type: "spine", src: `${base}coin-pro.json` },
	// dragon
	{ name: "dragon-ess.json", type: "spine", src: `${base}dragon-ess.json` },
	{ name: "dragon-pma.atlas", type: "spine", src: `${base}dragon-pma.atlas` },
	// owl
	{ name: "owl-pma.atlas", type: "spine", src: `${base}owl-pma.atlas` },
	{ name: "owl-pro.json", type: "spine", src: `${base}owl-pro.json` },
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
	// spineboy
	{
		name: "spineboy-pma.atlas",
		type: "spine",
		src: `${base}spineboy-pma.atlas`,
	},
	{
		name: "spineboy-pro.json",
		type: "spine",
		src: `${base}spineboy-pro.json`,
	},
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
];

export const characters = [
	{
		name: "spineboy",
		label: "Spineboy",
		atlas: "spineboy-pma.atlas",
		json: "spineboy-pro.json",
		animation: "walk",
		x: 750,
		y: 900,
	},
	{
		name: "alien",
		label: "Alien",
		atlas: "alien.atlas",
		json: "alien-ess.json",
		animation: "death",
		x: 750,
		y: 950,
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
		name: "dragon",
		label: "Dragon",
		atlas: "dragon-pma.atlas",
		json: "dragon-ess.json",
		animation: "flying",
		x: 750,
		y: 700,
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
		name: "mix-and-match",
		label: "Mix & Match",
		atlas: "mix-and-match-pma.atlas",
		json: "mix-and-match-pro.json",
		animation: "dance",
		x: 750,
		y: 900,
		skin: "full-skins/girl",
	},
];
