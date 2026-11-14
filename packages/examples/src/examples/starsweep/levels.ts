/**
 * melonJS — Starsweep: the levels, made in the Tiled map editor.
 *
 * Each level is a Tiled map in `public/assets/starsweep/levels/`
 * (`level01.tmj` …), 11 tiles wide and 15 tall, all sharing the
 * `starsweep-tiles.tsj` tileset. Open one in Tiled (mapeditor.org),
 * paint, save, reload the game. Adding a level is adding a map and its
 * name to {@link LEVEL_FILES}.
 *
 * - The `station` tile layer is the board. Each board tile in the tileset
 *   has a `kind` property: `wall`, `floor`, `ice`, `arrow-up` / `-right` /
 *   `-down` / `-left`, `crack`, `portal` (monsters come out, an animated
 *   tile), `start` (where Bolt begins, exactly one), `goo` (monsters avoid
 *   it and wade through it slowly), `gate` (shut until a `switch` is lit)
 *   and `gate-open`. An empty cell is open space.
 * - The `power` tile layer starts empty: the game lights a panel by
 *   setting the tile whose `lit` property names its kind there, and
 *   tints the layer with the level's colour (see `field.ts`).
 * - The map's custom properties set the rest: `title`, `hint`, `theme`
 *   (one of {@link THEMES}), `enemies` (the order monsters come out in,
 *   comma separated: `wobbler`, `muncher`, `chaser`, `drone`), `maxEnemies`,
 *   `spawnEvery` (seconds) and `par` (seconds, for the time bonus).
 *
 * The engine draws the maps. Their `station` layer is also turned into the
 * text rows the game's rules run on (see `board.ts` for the characters),
 * so `levels.test.ts` checks the Tiled files themselves: every panel
 * reachable, no move that never ends, no resting spot you cannot leave
 * safely.
 *
 * `title`, not `name`: map properties are set over the map's own fields,
 * so a `name` property would replace the level's name in the engine.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */

export type EnemyKind = "wobbler" | "muncher" | "chaser" | "drone";

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

export const THEMES = {
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

/** the level maps, in play order: `public/assets/starsweep/levels/<name>.tmj` */
export const LEVEL_FILES = [
	"level01",
	"level02",
	"level03",
	"level04",
	"level05",
	"level06",
	"level07",
	// goo and gates, then drones, before the final station
	"level09",
	"level10",
	"level08",
] as const;

/** the tileset every map uses: `public/assets/starsweep/levels/<name>.tsj` */
export const TILESET_FILE = "starsweep-tiles";

/** the subset of Tiled's JSON map format read here */
export interface TiledProperty {
	name: string;
	type?: string;
	value: unknown;
}

export interface TiledMap {
	width: number;
	height: number;
	layers: { type: string; name: string; data?: number[] }[];
	tilesets: { firstgid: number; source?: string }[];
	properties?: TiledProperty[];
}

export interface TiledTileset {
	tiles?: { id: number; properties?: TiledProperty[] }[];
}

/** tileset `kind` → the board character it stands for */
const KIND_CHARS: Record<string, string> = {
	wall: "#",
	floor: ".",
	ice: "~",
	"arrow-up": "^",
	"arrow-right": ">",
	"arrow-down": "v",
	"arrow-left": "<",
	crack: "%",
	portal: "E",
	start: "P",
	goo: "g",
	gate: "D",
	"gate-open": "O",
	switch: "S",
};

const ENEMY_KINDS: readonly EnemyKind[] = [
	"wobbler",
	"muncher",
	"chaser",
	"drone",
];

// Tiled keeps flip and rotation flags in the top bits of a gid
const GID_MASK = 0x0fffffff;

/**
 * Turn a Tiled map (and the tileset it uses) into a level.
 * @param map - the parsed `.tmj`
 * @param tileset - the parsed `.tsj`
 * @param file - the map's name, for error messages
 */
export const levelFromTiled = (
	map: TiledMap,
	tileset: TiledTileset,
	file: string,
): LevelDef => {
	const fail = (why: string): never => {
		throw new Error(`${file}: ${why}`);
	};
	const prop = (props: TiledProperty[] | undefined, name: string) =>
		props?.find((p) => p.name === name)?.value;

	const chars = new Map<number, string>();
	for (const tile of tileset.tiles ?? []) {
		// only board tiles have a kind: lit overlays and animation frames do not
		const kind = prop(tile.properties, "kind");
		if (kind === undefined) {
			continue;
		}
		const ch = typeof kind === "string" ? KIND_CHARS[kind] : undefined;
		if (ch === undefined) {
			fail(`tileset tile ${tile.id} has an unknown "kind" (${String(kind)})`);
		} else {
			chars.set(tile.id, ch);
		}
	}

	const layer =
		map.layers.find((l) => l.type === "tilelayer" && l.name === "station") ??
		map.layers.find((l) => l.type === "tilelayer");
	if (!layer?.data) {
		return fail('no "station" tile layer');
	}
	const data = layer.data;
	const firstgid = map.tilesets[0]?.firstgid ?? 1;
	const rows: string[] = [];
	for (let y = 0; y < map.height; y++) {
		let row = "";
		for (let x = 0; x < map.width; x++) {
			const gid = data[y * map.width + x] & GID_MASK;
			if (gid === 0) {
				row += " ";
				continue;
			}
			const ch = chars.get(gid - firstgid);
			if (ch === undefined) {
				fail(`tile ${x},${y} uses gid ${gid}, which is not in the tileset`);
			}
			row += ch;
		}
		rows.push(row);
	}

	const props = map.properties;
	const text = (name: string, fallback?: string) => {
		const v = prop(props, name) ?? fallback;
		return typeof v === "string" ? v : fail(`missing "${name}" property`);
	};
	const num = (name: string, fallback: number) => {
		const v = prop(props, name) ?? fallback;
		return typeof v === "number" ? v : fail(`"${name}" must be a number`);
	};

	const themeName = text("theme", "cyan");
	const theme = (THEMES as Record<string, Theme>)[themeName];
	if (!theme) {
		fail(
			`unknown theme "${themeName}" (try ${Object.keys(THEMES).join(", ")})`,
		);
	}
	const enemies = text("enemies", "wobbler")
		.split(",")
		.map((e) => e.trim())
		.filter(Boolean) as EnemyKind[];
	for (const e of enemies) {
		if (!ENEMY_KINDS.includes(e)) {
			fail(`unknown enemy "${e}" (try ${ENEMY_KINDS.join(", ")})`);
		}
	}

	return {
		name: text("title", file),
		hint: text("hint", ""),
		map: rows,
		theme,
		enemies: enemies.length > 0 ? enemies : ["wobbler"],
		maxEnemies: num("maxEnemies", 3),
		spawnEvery: num("spawnEvery", 5),
		par: num("par", 80),
	};
};

/** the levels in play order, filled from the Tiled maps once they load */
export const LEVELS: LevelDef[] = [];
