/**
 * melonJS — Starsweep: the levels.
 *
 * Map legend (11 wide x 15 tall, portrait):
 *   ` ` void (fall in and you lose a life)   `#` wall
 *   `.` deck panel   `~` frozen panel (you slide)   `^ > v <` conveyor pads
 *   `%` damaged panel (drops away behind you, comes back powered)
 *   `P` where you start   `E` monster portal (enemies come out of these)
 *
 * Every map is checked by `levels.test.ts`: all tiles reachable, no move
 * that never ends, and no resting spot you cannot leave safely.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */

export type EnemyKind = "wobbler" | "muncher" | "chaser";

export interface Theme {
	/** lit tile face */
	lit: string;
	/** lit tile highlight */
	litHi: string;
	/** lit tile side */
	litSide: string;
	/** wall top */
	wall: string;
	/** wall front */
	wallSide: string;
	/** sky behind the board */
	sky: string;
}

export interface LevelDef {
	name: string;
	hint: string;
	map: readonly string[];
	theme: Theme;
	/** enemies leave the nests in this order, then the list repeats */
	enemies: readonly EnemyKind[];
	/** most enemies on the board at once */
	maxEnemies: number;
	/** seconds between two enemies leaving a nest */
	spawnEvery: number;
	/** clear the board within this many seconds for a time bonus */
	par: number;
}

const THEMES = {
	cyan: {
		lit: "#2ee6d6",
		litHi: "#b8fff6",
		litSide: "#128a87",
		wall: "#5a4fa8",
		wallSide: "#2e2766",
		sky: "#0b0a24",
	},
	pink: {
		lit: "#ff5fb8",
		litHi: "#ffd0ec",
		litSide: "#a12a6f",
		wall: "#2f6f8f",
		wallSide: "#173a4d",
		sky: "#140a1e",
	},
	lime: {
		lit: "#9dff4a",
		litHi: "#e8ffc9",
		litSide: "#4f8f1f",
		wall: "#8a4fb0",
		wallSide: "#45255c",
		sky: "#0a1418",
	},
	amber: {
		lit: "#ffb43d",
		litHi: "#fff0c4",
		litSide: "#a8641a",
		wall: "#3d5fae",
		wallSide: "#1f3160",
		sky: "#120d1c",
	},
	violet: {
		lit: "#b98bff",
		litHi: "#efe2ff",
		litSide: "#5f3fa8",
		wall: "#2c8a6e",
		wallSide: "#154a3a",
		sky: "#0c0b1a",
	},
	coral: {
		lit: "#ff7a5c",
		litHi: "#ffe0d6",
		litSide: "#a63d27",
		wall: "#4a6e9e",
		wallSide: "#253a57",
		sky: "#0f0c18",
	},
} satisfies Record<string, Theme>;

export const LEVELS: readonly LevelDef[] = [
	{
		name: "Docking Bay",
		hint: "Walk over every panel to power it up",
		theme: THEMES.cyan,
		enemies: ["wobbler"],
		maxEnemies: 2,
		spawnEvery: 6,
		par: 60,
		map: [
			"           ",
			" ......... ",
			" .#.#.#.#. ",
			" ......... ",
			" .#.#.#.#. ",
			" ......... ",
			" .#.#.#.#. ",
			" ....P...E ",
			" .#.#.#.#. ",
			" ......... ",
			" .#.#.#.#. ",
			" ......... ",
			" .#.#.#.#. ",
			" ......... ",
			"           ",
		],
	},
	{
		name: "Cryo Deck",
		hint: "Frozen panels keep you sliding until you bump into something",
		theme: THEMES.pink,
		enemies: ["wobbler"],
		maxEnemies: 3,
		spawnEvery: 5.5,
		par: 65,
		map: [
			"           ",
			" ######### ",
			" #.......# ",
			" #.~~#~~.# ",
			" #.~...~.# ",
			" #.~...~.# ",
			" #.~.P.~.# ",
			" #.#...#.# ",
			" #.~.E.~.# ",
			" #.~...~.# ",
			" #.~...~.# ",
			" #.~~#~~.# ",
			" #.......# ",
			" ######### ",
			"           ",
		],
	},
	{
		name: "Cargo Belts",
		hint: "Conveyor pads push you along. Munchers eat the power back up!",
		theme: THEMES.lime,
		enemies: ["wobbler", "muncher"],
		maxEnemies: 3,
		spawnEvery: 5,
		par: 70,
		map: [
			"           ",
			" ......... ",
			" .#<<<<<#. ",
			" ......... ",
			" v#.#.#.#^ ",
			" v#.....#^ ",
			" v#.#P#.#^ ",
			" v#.....#^ ",
			" v#.#E#.#^ ",
			" v#.....#^ ",
			" v#.#.#.#^ ",
			" ......... ",
			" .#>>>>>#. ",
			" ......... ",
			"           ",
		],
	},
	{
		name: "Rusty Gantries",
		hint: "Damaged panels drop away behind you, then get repaired",
		theme: THEMES.amber,
		enemies: ["wobbler", "chaser"],
		maxEnemies: 3,
		spawnEvery: 5,
		par: 75,
		map: [
			"           ",
			" .... .... ",
			" .##.%.##. ",
			" .#..%..#. ",
			" ....%.... ",
			"  %  %  %  ",
			"  %  %  %  ",
			"  %%%P%%%E ",
			"  %  %  %  ",
			"  %  %  %  ",
			" ....%.... ",
			" .#..%..#. ",
			" .##.%.##. ",
			" .... .... ",
			"           ",
		],
	},
	{
		name: "Coolant Leak",
		hint: "Plan your slides. Space is a long way down",
		theme: THEMES.violet,
		enemies: ["wobbler", "muncher", "chaser"],
		maxEnemies: 3,
		spawnEvery: 5,
		par: 80,
		map: [
			"           ",
			" ######### ",
			" #~~~.~~~# ",
			" #~#~~~#~# ",
			" #~~.~.~~# ",
			" #~~~~~~~# ",
			" #~~~.~~~# ",
			" #.~#P#~E# ",
			" #~~~.~~~# ",
			" #~~~~~~~# ",
			" #~~.~.~~# ",
			" #~#~~~#~# ",
			" #~~~.~~~# ",
			" ######### ",
			"           ",
		],
	},
	{
		name: "Reactor Gears",
		hint: "The pads spin you round the gears. Chasers come for you!",
		theme: THEMES.coral,
		enemies: ["muncher", "wobbler", "chaser"],
		maxEnemies: 4,
		spawnEvery: 4.5,
		par: 85,
		map: [
			"           ",
			" ......... ",
			" ..<<..<<. ",
			" .v#^.v#^. ",
			" .>>^.>>^. ",
			" ......... ",
			" ..#.#.#.. ",
			" ..#.P.#E. ",
			" ..#.#.#.. ",
			" ......... ",
			" ..<<..<<. ",
			" .v#^.v#^. ",
			" .>>^.>>^. ",
			" ......... ",
			"           ",
		],
	},
	{
		name: "Asteroid Hop",
		hint: "Islands, gantries and a lot of empty space",
		theme: THEMES.lime,
		enemies: ["chaser", "muncher", "wobbler"],
		maxEnemies: 4,
		spawnEvery: 4.5,
		par: 90,
		map: [
			"           ",
			" ... ... . ",
			" .E.%.~.%. ",
			" ... ... . ",
			"  %   %  % ",
			"  %   %  % ",
			" ... ... . ",
			" .~.%P..%. ",
			" ... ... . ",
			"  %   %  % ",
			"  %   %  % ",
			" ... ... . ",
			" .E.%.~.%. ",
			" ... ... . ",
			"           ",
		],
	},
	{
		name: "Core Station",
		hint: "Everything at once. Good luck!",
		theme: THEMES.cyan,
		enemies: ["chaser", "muncher", "wobbler", "muncher"],
		maxEnemies: 5,
		spawnEvery: 4,
		par: 100,
		map: [
			"           ",
			" ...<<<... ",
			" .##...##. ",
			" .#~~.~~#. ",
			" ..~#.#~.. ",
			" v.~~%~~.^ ",
			" v...%...^ ",
			" v.%%P%%.E ",
			" v...%...^ ",
			" v.~~%~~.^ ",
			" ..~#.#~.. ",
			" .#~~.~~#. ",
			" .##...##. ",
			" ...>>>... ",
			"           ",
		],
	},
];
