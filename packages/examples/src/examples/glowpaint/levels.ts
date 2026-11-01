/**
 * melonJS — Glowpaint: the levels.
 *
 * Map legend (15 x 11):
 *   ` ` void (fall in and you lose a life)   `#` wall
 *   `.` floor   `~` ice (you slide across)   `^ > v <` arrow pads
 *   `%` crumbling tile (falls away behind you, grows back lit)
 *   `P` where you start   `E` ink nest (enemies come out of these)
 *
 * Every map is checked by `levels.test.ts`: all tiles reachable, no move
 * that never ends, and no resting spot you cannot leave safely.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */

export type EnemyKind = "blot" | "smudge" | "hunter";

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
		name: "First Light",
		hint: "Walk over every tile to light it up",
		theme: THEMES.cyan,
		enemies: ["blot"],
		maxEnemies: 2,
		spawnEvery: 6,
		par: 60,
		map: [
			"               ",
			" ............. ",
			" .#.#.#.#.#.#. ",
			" ............. ",
			" .#.#.#.#.#.#. ",
			" ......P...... ",
			" .#.#.#.#.#.#. ",
			" ............. ",
			" .#.#.#.#.#.#. ",
			" ......E...... ",
			"               ",
		],
	},
	{
		name: "Cold Feet",
		hint: "Ice keeps you sliding until you hit something",
		theme: THEMES.pink,
		enemies: ["blot"],
		maxEnemies: 3,
		spawnEvery: 5.5,
		par: 65,
		map: [
			"               ",
			" ############# ",
			" #...........# ",
			" #.~~~~#~~~~.# ",
			" #.~.......~.# ",
			" #.#..P.E..#.# ",
			" #.~.......~.# ",
			" #.~~~~#~~~~.# ",
			" #...........# ",
			" ############# ",
			"               ",
		],
	},
	{
		name: "Rush Hour",
		hint: "Arrow pads push you along. Ink smudges unpaint tiles!",
		theme: THEMES.lime,
		enemies: ["blot", "smudge"],
		maxEnemies: 3,
		spawnEvery: 5,
		par: 70,
		map: [
			"               ",
			" ...>>>>>>>... ",
			" .#.#######.#. ",
			" .^.........v. ",
			" .^.#.#.#.#.v. ",
			" .^...P.E...v. ",
			" .^.#.#.#.#.v. ",
			" .^.........v. ",
			" .#.#######.#. ",
			" ...<<<<<<<... ",
			"               ",
		],
	},
	{
		name: "Brittle Bridges",
		hint: "Cracked tiles crumble behind you, then grow back",
		theme: THEMES.amber,
		enemies: ["blot", "hunter"],
		maxEnemies: 3,
		spawnEvery: 5,
		par: 75,
		map: [
			"               ",
			" ....     .... ",
			" .##.%%%%%.##. ",
			" .#..  %  ..#. ",
			" ....  %  .... ",
			"  %%%%%P%%%%%  ",
			" ....  %  .... ",
			" .#..  %  ..#. ",
			" .##.%%%%%.##. ",
			" ....  E  .... ",
			"               ",
		],
	},
	{
		name: "Skating Rink",
		hint: "Plan your slides. The edge is a long way down",
		theme: THEMES.violet,
		enemies: ["blot", "smudge", "hunter"],
		maxEnemies: 3,
		spawnEvery: 5,
		par: 80,
		map: [
			"               ",
			" ############# ",
			" #~~~~~.~~~~~# ",
			" #~#~~~~~~~#~# ",
			" #~~.~~#~~.~~# ",
			" #.~~~.P.~~~.# ",
			" #~~.~~#~~.~~# ",
			" #~#~~~~~~~#~# ",
			" #~~~~~E~~~~~# ",
			" ############# ",
			"               ",
		],
	},
	{
		name: "Clockwork",
		hint: "The pads spin you round the gears",
		theme: THEMES.coral,
		enemies: ["smudge", "blot", "hunter"],
		maxEnemies: 4,
		spawnEvery: 4.5,
		par: 85,
		map: [
			"               ",
			" ............. ",
			" ..>v......>v. ",
			" .^#v.###.^#v. ",
			" .^<<.....^<<. ",
			" .....#P#..... ",
			" ..>v......>v. ",
			" .^#v.###.^#v. ",
			" .^<<..E..^<<. ",
			" ............. ",
			"               ",
		],
	},
	{
		name: "Floating Gardens",
		hint: "Islands, bridges and a lot of empty sky",
		theme: THEMES.lime,
		enemies: ["hunter", "smudge", "blot"],
		maxEnemies: 4,
		spawnEvery: 4.5,
		par: 90,
		map: [
			"               ",
			" ...  ...  ... ",
			" .E.%%.~.%%.E. ",
			" ...  ...  ... ",
			"  %    %    %  ",
			" ...  .P.  ... ",
			" .~.%%...%%.~. ",
			" ...  ...  ... ",
			"  %    %    %  ",
			" ...%%...%%... ",
			"               ",
		],
	},
	{
		name: "Last Light",
		hint: "Everything at once. Good luck!",
		theme: THEMES.cyan,
		enemies: ["hunter", "smudge", "blot", "smudge"],
		maxEnemies: 5,
		spawnEvery: 4,
		par: 100,
		map: [
			"               ",
			" ....>>>>>.... ",
			" .##.......##. ",
			" .#~~~.%.~~~#. ",
			" ^.~#~.%.~#~.v ",
			" ^...%%P%%...v ",
			" ^.~#~.%.~#~.v ",
			" .#~~~.%.~~~#. ",
			" .##.......##. ",
			" ....<<E<<.... ",
			"               ",
		],
	},
];
