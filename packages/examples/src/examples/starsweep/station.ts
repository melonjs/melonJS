/**
 * melonJS — Starsweep: the station, a level's board as it is played.
 *
 * The board is the level's Tiled map, drawn by the engine. Lighting a panel
 * sets a tile on the map's `power` layer, tinted with the level's colour; a
 * cracked panel that gives way is cleared from the `station` layer and set
 * again when it grows back; a gate that opens is swapped for an open one
 * (`setTile` / `clearTile`). The tiles are found by their properties, so
 * the tileset can be rearranged in Tiled: `kind` on the station tiles, `lit`
 * on their lit versions.
 *
 * The station keeps the rules' view of the board in step with the map, and
 * tells the field what happened (a crack gave way, gates opened) through
 * {@link StationEvents}, so the field decides what that does to whoever
 * stands there, and how it looks and sounds.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import type { Tile as MapTile, TMXLayer } from "melonjs";
import {
	type Cell,
	cellOf,
	idx,
	inBounds,
	isPaintable,
	readBoard,
	Tile,
} from "./board";
import type { LevelDef } from "./levels";

/** how long a cracked panel holds once Bolt steps off it, in seconds */
const CRUMBLE_DELAY = 0.3;
/** how long a fallen crack takes to grow back, in seconds */
const REGROW_TIME = 6;

/** the two tile layers of a level, once loaded */
export interface Board {
	/** the station: what is there to walk on */
	station: TMXLayer;
	/** the lit panels, drawn over it and tinted with the level's colour */
	power: TMXLayer;
}

/**
 * a map tile's `kind` property, set on the board tiles in Tiled
 * @returns the kind, or undefined for an empty cell or a tile without one
 */
export const kindOf = (tile: MapTile | null) => {
	if (tile === null) {
		return undefined;
	}
	const props = tile.tileset.getTileProperties(tile.tileId) as
		| { kind?: string }
		| undefined;
	return props?.kind;
};

/** what the station tells the field as a level is played */
export interface StationEvents {
	/** a cracked panel gave way: anything standing on it falls */
	crumbled: (cell: Cell) => void;
	/** a fallen crack grew back */
	regrown: (cell: Cell) => void;
	/** a switch was lit, and these gates slid open */
	gatesOpened: (cells: Cell[]) => void;
}

/** The level's board as it is played: its map, and the rules' view of it. */
export class Station {
	/** the level's map, or null while one loads */
	layers: Board | null = null;
	/** each cell's tile, as the rules see it now (see `board.ts`) */
	tiles: Tile[] = [];
	/** where Bolt begins */
	start: Cell = { x: 0, y: 0 };
	/** where monsters come out */
	portals: Cell[] = [];

	/** each cell's tile kind, which `clearTile` would otherwise lose */
	private kinds: (string | null)[] = [];
	private lit: boolean[] = [];
	/** > 0: seconds before a cracked panel gives way */
	private crumble: number[] = [];
	/** > 0: seconds before a fallen crack grows back */
	private gone: number[] = [];
	private kindGid = new Map<string, number>();
	private litGid = new Map<string, number>();
	private paintTotal = 0;
	private paintCount = 0;

	constructor(private readonly events: StationEvents) {}

	/**
	 * Play a level on its freshly loaded map.
	 * @param layers - the map's tile layers
	 * @param level - the level, for each cell's tile kind
	 */
	load(layers: Board, level: LevelDef) {
		this.layers = layers;
		this.readTileset(layers.station);
		const board = readBoard(level.kinds, level.start, level.portals);
		this.tiles = board.tiles;
		this.start = board.start;
		this.portals = board.portals;
		this.kinds = [...level.kinds];
		const n = this.tiles.length;
		this.lit = new Array(n).fill(false);
		this.crumble = new Array(n).fill(0);
		this.gone = new Array(n).fill(0);
		this.paintTotal = this.tiles.filter(isPaintable).length;
		this.paintCount = 0;
	}

	/** forget the map, while the next one loads */
	unload() {
		this.layers = null;
	}

	/** the share of the panels lit, 0 to 1 */
	get progress() {
		return this.paintTotal > 0 ? this.paintCount / this.paintTotal : 0;
	}

	/** whether every panel is lit */
	get cleared() {
		return this.paintCount >= this.paintTotal;
	}

	/** the tile as it is right now: off the board, or a fallen crack, is void */
	ground(x: number, y: number): Tile {
		if (!inBounds(x, y)) {
			return Tile.VOID;
		}
		const i = idx(x, y);
		return this.gone[i] > 0 ? Tile.VOID : this.tiles[i];
	}

	/** whether a panel is lit */
	isLit(x: number, y: number) {
		return this.lit[idx(x, y)];
	}

	/** whether a cracked panel is about to give way */
	isCrumbling(x: number, y: number) {
		return this.crumble[idx(x, y)] > 0;
	}

	/**
	 * Light a panel. A switch also opens every gate.
	 * @returns true if it was not lit yet
	 */
	paint(x: number, y: number) {
		const i = idx(x, y);
		if (this.lit[i] || !isPaintable(this.tiles[i])) {
			return false;
		}
		this.lit[i] = true;
		this.paintCount++;
		this.setLit(x, y, true);
		if (this.tiles[i] === Tile.SWITCH) {
			this.openGates();
		}
		return true;
	}

	/**
	 * Put a panel's light out (a muncher ate it).
	 * @returns true if it was lit
	 */
	unpaint(x: number, y: number) {
		const i = idx(x, y);
		if (!this.lit[i]) {
			return false;
		}
		this.lit[i] = false;
		this.paintCount--;
		this.setLit(x, y, false);
		return true;
	}

	/**
	 * Bolt steps off a cell: a cracked panel there starts to give way.
	 * @returns true if it did
	 */
	stepOff(x: number, y: number) {
		const i = idx(x, y);
		if (this.tiles[i] !== Tile.CRACK || this.gone[i] > 0) {
			return false;
		}
		this.crumble[i] = CRUMBLE_DELAY;
		return true;
	}

	/** count the cracks down: panels give way, and grow back */
	update(dt: number) {
		for (let i = 0; i < this.crumble.length; i++) {
			if (this.crumble[i] > 0) {
				this.crumble[i] -= dt;
				if (this.crumble[i] <= 0) {
					this.crumbleAway(i);
				}
			} else if (this.gone[i] > 0) {
				this.gone[i] -= dt;
				if (this.gone[i] <= 0) {
					this.regrow(i);
				}
			}
		}
	}

	/** a cracked panel gives way: gone from the map until it grows back */
	private crumbleAway(i: number) {
		this.crumble[i] = 0;
		this.gone[i] = REGROW_TIME;
		const cell = cellOf(i);
		this.layers?.station.clearTile(cell.x, cell.y);
		this.layers?.power.clearTile(cell.x, cell.y);
		this.events.crumbled(cell);
	}

	/** a fallen crack grows back, lit if it was */
	private regrow(i: number) {
		this.gone[i] = 0;
		const cell = cellOf(i);
		this.setTile(this.layers?.station, this.kindGid.get("crack"), cell);
		this.setLit(cell.x, cell.y, this.lit[i]);
		this.events.regrown(cell);
	}

	/** a switch is lit: every gate slides open */
	private openGates() {
		const opened: Cell[] = [];
		for (let i = 0; i < this.tiles.length; i++) {
			if (this.tiles[i] === Tile.GATE) {
				const cell = cellOf(i);
				this.tiles[i] = Tile.GATE_OPEN;
				this.kinds[i] = "gate-open";
				this.setTile(this.layers?.station, this.kindGid.get("gate-open"), cell);
				opened.push(cell);
			}
		}
		if (opened.length > 0) {
			this.events.gatesOpened(opened);
		}
	}

	/** light or darken a panel on the power layer */
	private setLit(x: number, y: number, on: boolean) {
		const power = this.layers?.power;
		if (!power) {
			return;
		}
		const gid = on ? this.litGid.get(this.kinds[idx(x, y)] ?? "") : undefined;
		if (gid === undefined) {
			power.clearTile(x, y);
		} else {
			this.setTile(power, gid, { x, y });
		}
	}

	/** put the tileset's tile `gid` in a cell of a layer */
	private setTile(
		layer: TMXLayer | undefined,
		gid: number | undefined,
		cell: Cell,
	) {
		if (layer && gid !== undefined) {
			layer.setTile(layer.getTileById(gid, cell.x, cell.y), cell.x, cell.y);
		}
	}

	/** find the tiles by their `kind` and `lit` properties */
	private readTileset(station: TMXLayer) {
		this.kindGid.clear();
		this.litGid.clear();
		const tileset = station.tilesets.getTilesetByIndex(0);
		for (let gid = tileset.firstgid; gid <= tileset.lastgid; gid++) {
			const props = tileset.getTileProperties(gid) as
				| { kind?: string; lit?: string }
				| undefined;
			if (props?.kind !== undefined) {
				this.kindGid.set(props.kind, gid);
			}
			if (props?.lit !== undefined) {
				this.litGid.set(props.lit, gid);
			}
		}
	}
}
