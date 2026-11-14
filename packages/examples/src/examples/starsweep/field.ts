/**
 * melonJS — Starsweep: the playing field.
 *
 * One `Renderable` runs the round: Bolt, the monsters, sparks and
 * power-ups. Bolt and the monsters are `Sprite`s from the cast sheet (see
 * `cast.ts`), placed here each frame. The station itself is the level's Tiled map, drawn by the
 * engine: lighting a panel sets a tile on its `power` layer, and a panel
 * that crumbles is cleared from its `station` layer (`setTile` /
 * `clearTile`). Bursts come from a `ParticleEmitter`, spark trails are
 * `Trail`s, one-shot animations are `Tween`s, and pausing is the engine's
 * `state.pause()`. Movement is tile-to-tile: an actor is always between a
 * `from` tile and a `to` tile, with `t` going 0 → 1, except for drones,
 * which fly freely.
 *
 * Monsters find their way with `@melonjs/pathfinding-plugin`: chasers plan
 * across a grid read from the station layer (walls, gates and fallen cracks
 * block it, goo costs more, and they keep off each other's cells, so they
 * flank Bolt), and drones across a second grid where holes are open too,
 * diagonally, along smoothed straight lines. When Bolt is out of reach,
 * they head for the nearest point. A force-field blocks cells for a while,
 * and the scanner shows every plan with the plugin's debug overlay.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */

import {
	Grid,
	PathfindingDebug,
	type PathPoint,
	type PathResult,
} from "@melonjs/pathfinding-plugin";
import {
	type Container,
	event,
	game,
	type Tile as MapTile,
	Renderable,
	save,
	Text,
	type TMXLayer,
	type Trail,
	Tween,
	type Vector2d,
} from "melonjs";
import {
	COLS,
	type Dir,
	DX,
	DY,
	forcedDir,
	inBounds,
	isBlocking,
	isPaintable,
	isSolidGround,
	opposite,
	parseMap,
	ROWS,
	Tile,
} from "./board";
import { Actor, boltAnimation, GLOW, monsterAnimation } from "./cast";
import type { Controls } from "./controls";
import {
	drawGlow,
	drawPower,
	FONT,
	POWER_COLORS,
	type PowerKind,
	type Renderer,
	TILE,
} from "./draw";
import {
	aberrationBurst,
	type DeepSpace,
	type Effects,
	type NebulaBackdrop,
	type SpaceBackdrop,
	trailPoint,
} from "./fx";
import { type EnemyKind, LEVEL_FILES, LEVELS, type LevelDef } from "./levels";
import * as sfx from "./sfx";

// portrait, 9:16, so it fills a phone held upright
export const WIDTH = 576;
export const HEIGHT = 1024;
export const OX = (WIDTH - COLS * TILE) / 2;
export const OY = 118;
/** where the board ends and the touch controls' zone begins */
export const BOARD_BOTTOM = OY + ROWS * TILE;

const WALK_SPEED = 5.2; // tiles per second
const SLIDE_SPEED = 9;
const SPARK_SPEED = 15;
const SPARK_COOLDOWN = 0.22;
const START_LIVES = 3;
const MAX_LIVES = 6;
const CRUMBLE_DELAY = 0.3;
const REGROW_TIME = 6;
const INVULN_TIME = 2.5;
const POWER_EVERY = [9, 14] as const;
const POWER_LIFE = 9;
type TimedPower = "freeze" | "shield" | "burst" | "field" | "scan";
const POWER_TIME: Record<TimedPower, number> = {
	freeze: 5,
	shield: 7,
	burst: 9,
	field: 6,
	scan: 7,
};
const ENEMY_SPEED: Record<EnemyKind, number> = {
	wobbler: 3.1,
	muncher: 2.7,
	chaser: 3.3,
	drone: 1.9,
};
const ENEMY_SCORE: Record<EnemyKind, number> = {
	wobbler: 100,
	muncher: 150,
	chaser: 200,
	drone: 250,
};
/** what crossing goo costs a monster's search */
const GOO_COST = 4;
/** how fast a monster wades through goo */
const GOO_SLOW = 0.45;
/** what another monster's cell costs a chaser's search: they spread out */
const FLANK_COST = 4;
/** the most cells one search may look at */
const SEARCH_CAP = 400;
/** seconds between two plans of a drone */
const DRONE_REPLAN = 0.4;

export const HISCORE_KEY = "starsweepHiscore";

interface Mover {
	fx: number;
	fy: number;
	tx: number;
	ty: number;
	t: number;
	moving: boolean;
	dir: Dir;
}

interface Player extends Mover {
	facing: Dir;
	forced: boolean;
	falling: number; // > 0 while dropping into the void
	invuln: number;
}

interface Enemy extends Mover {
	kind: EnemyKind;
	speed: number;
	spawning: number; // > 0 while still coming out of the nest
	falling: number;
	/** a flying drone's free position and route, not tied to tiles */
	air?: { x: number; y: number; path: PathPoint[]; replan: number };
	/** the last route planned (chasers and drones), for the scanner */
	plan?: PathResult;
}

interface Spark {
	/** where it is, which its trail follows */
	at: Vector2d;
	dir: Dir;
	trail: Trail;
}

interface Power {
	x: number;
	y: number;
	kind: PowerKind;
	life: number;
}

type Phase =
	| "loading"
	| "intro"
	| "play"
	| "dying"
	| "clear"
	| "gameover"
	| "victory";

/** the two tile layers of a level, once loaded */
export interface Board {
	/** the station: what is there to walk on */
	station: TMXLayer;
	/** the lit panels, drawn over it and tinted with the level's colour */
	power: TMXLayer;
}

/** what the field needs from the screen that owns it */
export interface FieldHost {
	controls: Controls;
	effects: Effects;
	/** where the characters' sprites go, above the board */
	actors: Container;
	backdrop: SpaceBackdrop;
	sky: NebulaBackdrop | null;
	/** the 3D space behind the game, when the renderer can draw it */
	space: DeepSpace | null;
	/** load a level's Tiled map into the board container */
	loadBoard: (file: string) => Promise<Board>;
}

const tileX = (x: number) => OX + x * TILE;
const tileY = (y: number) => OY + y * TILE;
const moverX = (m: Mover) => tileX(m.fx + (m.tx - m.fx) * m.t) + TILE / 2;
const moverY = (m: Mover) => tileY(m.fy + (m.ty - m.fy) * m.t) + TILE / 2 - 4;
const idx = (x: number, y: number) => y * COLS + x;
const enemyX = (e: Enemy) => (e.air ? e.air.x : moverX(e));
const enemyY = (e: Enemy) => (e.air ? e.air.y : moverY(e));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(list: readonly T[]) =>
	list[Math.floor(Math.random() * list.length)];

export class Field extends Renderable {
	/** called when the run ends and the player confirms */
	onExit: () => void = () => {};

	private readonly host: FieldHost;
	private readonly controls: Controls;
	private readonly fx: Effects;
	private time = 0;

	// the Tiled board, and the tiles it is drawn with, found by property
	private board: Board | null = null;
	private kindGid = new Map<string, number>();
	private litGid = new Map<string, number>();
	/** each cell's tile kind, as the map has it (start, portal, ...) */
	private kinds: (string | null)[] = [];

	private levelIndex = 0;
	private level!: LevelDef;
	private tiles: Tile[] = [];
	private lit: boolean[] = [];
	private crumble: number[] = []; // > 0: about to fall away
	private gone: number[] = []; // > 0: fallen, time until it grows back
	private start = { x: 0, y: 0 };
	private nests: { x: number; y: number }[] = [];
	private paintTotal = 0;
	private paintCount = 0;

	private player!: Player;
	private enemies: Enemy[] = [];
	private sparks: Spark[] = [];
	private powers: Power[] = [];

	private phase: Phase = "loading";
	private phaseTime = 0;
	private paused = false;
	/** the dimming and panel behind a message, 0 to 1 */
	private overlay = 0;
	private introFade: Tween | null = null;
	/** Bolt knocked out: fading and floating up, both tweened */
	private readonly ko = { alpha: 1, rise: 0 };
	private score = 0;
	private hiscore = 0;
	private lives = START_LIVES;
	private levelTime = 0;
	private spawnTimer = 0;
	private spawnCount = 0;
	private powerTimer = 0;
	private sparkCooldown = 0;
	private streak = 0;
	private streakTimer = 0;
	private freeze = 0;
	private shield = 0;
	private burst = 0;
	/** where monsters walk, read from the station layer by the plugin */
	private walkGrid: Grid | null = null;
	/** where drones fly: anywhere but walls and shut gates */
	private airGrid: Grid | null = null;
	/** force-field cells, and the time each has left */
	private fields = new Map<number, number>();
	private scan = 0;
	/** the scanner: the plugin's debug overlay, showing only the plans */
	private scanner: PathfindingDebug | null = null;
	private bonus = 0;
	/** > 0 while Bolt is pleased with itself */
	private cheer = 0;

	// the characters on screen
	private readonly bolt = new Actor("bolt-idle-down");
	private readonly shieldRing = new Actor("shield");
	private readonly lifeIcons: Actor[] = [];
	private readonly monsters = new Map<Enemy, Actor>();
	/** sparks and the message panel, drawn over the characters */
	readonly front: Renderable;

	// HUD
	readonly hud: Text[] = [];
	private scoreText: Text;
	private hiText: Text;
	private levelText: Text;
	private bigText: Text;
	private subText: Text;
	/** how to play, under the board: keyboard or touch, whichever is in use */
	private hintText: Text;
	private hintTouch: boolean | null = null;
	private shownScore = -1;
	private shownHi = -1;

	constructor(host: FieldHost) {
		super(0, 0, WIDTH, HEIGHT);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
		// level.load clears the world of everything that is not persistent
		this.isPersistent = true;
		this.host = host;
		this.controls = host.controls;
		this.fx = host.effects;
		const actors = host.actors;
		actors.addChild(this.bolt, 1);
		actors.addChild(this.shieldRing, 2);
		// lives, as small Bolts in the top bar
		for (let i = 0; i < MAX_LIVES; i++) {
			const icon = new Actor("bolt-idle-down").place(
				OX + 14 + i * 30,
				96,
				0.5,
				0,
			);
			// not all bobbing in step
			icon.setAnimationFrame(i * 3);
			this.lifeIcons.push(icon);
			actors.addChild(icon, 0);
		}
		this.front = new FieldFront(this);
		this.hiscore =
			(save as unknown as Record<string, number>)[HISCORE_KEY] ?? 0;

		const label = (
			x: number,
			y: number,
			size: number,
			align: "left" | "center" | "right",
			color = "#ffffff",
		) => {
			const t = new Text(x, y, {
				font: FONT,
				size,
				fillStyle: color,
				textAlign: align,
				textBaseline: "top",
				text: " ",
			});
			t.floating = true;
			t.isPersistent = true;
			this.hud.push(t);
			return t;
		};
		this.scoreText = label(OX, 18, 26, "left");
		this.hiText = label(WIDTH - OX, 18, 26, "right", "#ffd23d");
		this.levelText = label(WIDTH / 2, 56, 16, "center", "#c9c3ff");
		this.bigText = label(WIDTH / 2, OY + 250, 38, "center");
		this.subText = label(WIDTH / 2, OY + 306, 15, "center", "#e6e1ff");
		this.hintText = label(
			WIDTH / 2,
			BOARD_BOTTOM + 70,
			15,
			"center",
			"#8f88c9",
		);
		// paused by the player or by the page losing focus: say so
		event.on(event.STATE_PAUSE, this.onPause);
		event.on(event.STATE_RESUME, this.onResume);
	}

	override onDestroyEvent() {
		event.off(event.STATE_PAUSE, this.onPause);
		event.off(event.STATE_RESUME, this.onResume);
	}

	/** what was on screen when the game paused, put back on resume */
	private beforePause: { big: string; sub: string; alpha: number } | null =
		null;

	private readonly onPause = () => {
		if (this.paused) {
			return;
		}
		this.paused = true;
		this.beforePause = {
			...this.message,
			alpha: this.bigText.alpha,
		};
		this.showMessage(
			"Paused",
			this.controls.onScreen ? "" : "Press P or Esc to resume",
		);
	};

	private readonly onResume = () => {
		if (!this.paused) {
			return;
		}
		this.paused = false;
		const was = this.beforePause;
		this.showMessage(was?.big ?? "", was?.sub ?? "");
		this.bigText.alpha = this.subText.alpha = was?.alpha ?? 0;
	};

	/** whether the player may pause now */
	get canPause() {
		return this.phase === "play";
	}

	/** start a brand new run */
	newGame() {
		this.score = 0;
		this.lives = START_LIVES;
		this.loadLevel(0);
	}

	// ---------------------------------------------------------------------
	// level flow
	// ---------------------------------------------------------------------

	private async loadLevel(i: number) {
		this.setPhase("loading");
		this.levelIndex = i;
		this.level = LEVELS[i];
		this.clearSparks();
		this.enemies = [];
		this.powers = [];
		this.board = null;
		const theme = this.level.theme;
		this.host.sky?.setLevelTheme(theme);
		this.host.backdrop.setTheme(theme);
		this.host.space?.setColors([theme.lit, theme.litHi, "#ffffff"]);
		const board = await this.host.loadBoard(LEVEL_FILES[i]);
		board.power.tint.parseCSS(theme.lit);
		this.readTileset(board.station);
		this.board = board;

		const parsed = parseMap(this.level.map);
		this.tiles = parsed.tiles;
		this.start = parsed.start;
		this.nests = parsed.nests;
		const n = COLS * ROWS;
		this.lit = new Array(n).fill(false);
		this.crumble = new Array(n).fill(0);
		this.gone = new Array(n).fill(0);
		this.paintTotal = this.tiles.filter(isPaintable).length;
		this.paintCount = 0;
		this.powers = [];
		this.levelTime = 0;
		this.spawnCount = 0;
		this.powerTimer = rand(...POWER_EVERY);
		this.freeze = this.shield = this.burst = this.scan = 0;
		this.fields.clear();
		if (this.scanner?.ancestor) {
			this.host.actors.removeChild(this.scanner, true);
		}
		this.buildGrids(board.station);
		this.levelText.setText(
			`${i + 1} / ${LEVELS.length}  ·  ${this.level.name.toUpperCase()}`,
		);
		this.resetActors();
		this.paint(this.start.x, this.start.y, true);
		this.setPhase("intro");
		this.showMessage(this.level.name, this.level.hint);
		this.overlay = 1;
		// the message stays a moment, then fades off the board
		this.introFade = new Tween(this)
			.to({ overlay: 0 }, { duration: 400, delay: 1800 })
			.onUpdate(() => {
				this.bigText.alpha = this.subText.alpha = this.overlay;
			})
			.start();
	}

	/**
	 * Find the tiles by their properties, so the tileset can be rearranged
	 * in Tiled: `kind` on the station tiles, `lit` on their lit versions.
	 * Also note each cell's kind, which `clearTile` would otherwise lose.
	 */
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
		this.kinds = [];
		for (let y = 0; y < ROWS; y++) {
			for (let x = 0; x < COLS; x++) {
				const tile = station.cellAt(x, y);
				const props = tile?.tileset.getTileProperties(tile.tileId) as
					| { kind?: string }
					| undefined;
				this.kinds.push(props?.kind ?? null);
			}
		}
	}

	/**
	 * The two grids the monsters plan across, from the pathfinding plugin.
	 * Walkers: the station layer itself, each tile's kind read from the
	 * tileset, so a tile set or cleared on the layer is seen by refreshing
	 * its cell. Drones: anywhere but walls and shut gates, holes included.
	 */
	private buildGrids(station: TMXLayer) {
		const kindOf = (tile: MapTile | null) => {
			return tile === null
				? undefined
				: (
						tile.tileset.getTileProperties(tile.tileId) as
							| { kind?: string }
							| undefined
					)?.kind;
		};
		this.walkGrid = Grid.fromTileLayer(station, {
			walkable: (tile) => {
				const kind = kindOf(tile);
				return kind !== undefined && kind !== "wall" && kind !== "gate";
			},
			cost: (tile) => {
				return kindOf(tile) === "goo" ? GOO_COST : 1;
			},
		});
		this.airGrid = new Grid({
			cols: COLS,
			rows: ROWS,
			tileWidth: TILE,
			tileHeight: TILE,
			x: OX,
			y: OY,
			walkable: (col, row) => {
				return !isBlocking(this.tiles[idx(col, row)]);
			},
		});
		if (this.scanner) {
			this.scanner.grid = this.walkGrid;
		} else {
			this.scanner = new PathfindingDebug(this.walkGrid);
			this.scanner.showBlocked = false;
			this.scanner.showCost = false;
			this.scanner.showTrace = false;
			this.scanner.isPersistent = true;
		}
	}

	/** a cell changed on the station layer, or by a force-field: re-read it */
	private refreshCell(x: number, y: number) {
		this.walkGrid?.refreshCell(x, y);
		this.airGrid?.refreshCell(x, y);
		if (this.fields.has(idx(x, y))) {
			this.walkGrid?.setWalkable(x, y, false);
			this.airGrid?.setWalkable(x, y, false);
		}
	}

	/** a switch is lit: every gate slides open */
	private openGates() {
		const station = this.board?.station;
		const gid = this.kindGid.get("gate-open");
		let opened = 0;
		for (let i = 0; i < this.tiles.length; i++) {
			if (this.tiles[i] !== Tile.GATE) {
				continue;
			}
			const x = i % COLS;
			const y = Math.floor(i / COLS);
			this.tiles[i] = Tile.GATE_OPEN;
			this.kinds[i] = "gate-open";
			if (station && gid !== undefined) {
				station.setTile(station.getTileById(gid, x, y), x, y);
			}
			this.refreshCell(x, y);
			this.fx.burst(
				tileX(x) + TILE / 2,
				tileY(y) + TILE / 2,
				"#ff3b5c",
				10,
				120,
			);
			opened++;
		}
		if (opened > 0) {
			sfx.sfxPickup();
			this.host.space?.burst("#ff5d7a", 0.6);
		}
	}

	/** light a panel on the board's power layer */
	private setLit(x: number, y: number, on: boolean) {
		const power = this.board?.power;
		if (!power) {
			return;
		}
		const gid = on ? this.litGid.get(this.kinds[idx(x, y)] ?? "") : undefined;
		if (gid === undefined) {
			power.clearTile(x, y);
		} else {
			power.setTile(power.getTileById(gid, x, y), x, y);
		}
	}

	private clearSparks() {
		for (const s of this.sparks) {
			this.fx.stop(s.trail);
		}
		this.sparks = [];
	}

	private resetActors() {
		this.player = {
			fx: this.start.x,
			fy: this.start.y,
			tx: this.start.x,
			ty: this.start.y,
			t: 0,
			moving: false,
			dir: 2,
			facing: 2,
			forced: false,
			falling: 0,
			invuln: 0,
		};
		this.enemies = [];
		this.clearSparks();
		this.ko.alpha = 1;
		this.ko.rise = 0;
		this.spawnTimer = 1.5;
		this.streak = 0;
		this.controls.reset();
	}

	private setPhase(phase: Phase) {
		this.phase = phase;
		this.phaseTime = 0;
		// a tap from an earlier moment must not skip this one
		this.controls.reset();
	}

	/** the message on screen */
	private message = { big: "", sub: "" };

	private showMessage(big: string, sub = "") {
		this.message = { big, sub };
		this.bigText.setText(big || " ");
		this.subText.setText(sub || " ");
		this.bigText.alpha = big ? 1 : 0;
		this.subText.alpha = sub ? 1 : 0;
	}

	/** how to move on from a message, for the controls in use */
	private continueHint() {
		return this.controls.onScreen ? "tap to go on" : "tap or press Enter";
	}

	private addScore(points: number) {
		this.score += points;
		if (this.score > this.hiscore) {
			this.hiscore = this.score;
			(save as unknown as Record<string, number>)[HISCORE_KEY] = this.hiscore;
		}
	}

	// ---------------------------------------------------------------------
	// board helpers
	// ---------------------------------------------------------------------

	/** the tile as it is right now: fallen cracks read as void */
	private ground(x: number, y: number): Tile {
		if (!inBounds(x, y)) {
			return Tile.VOID;
		}
		const i = idx(x, y);
		return this.gone[i] > 0 ? Tile.VOID : this.tiles[i];
	}

	private paint(x: number, y: number, silent = false) {
		const i = idx(x, y);
		if (this.lit[i] || !isPaintable(this.tiles[i])) {
			return;
		}
		this.lit[i] = true;
		this.setLit(x, y, true);
		this.paintCount++;
		if (this.tiles[i] === Tile.SWITCH) {
			this.openGates();
		}
		if (!silent) {
			this.addScore(10);
			sfx.sfxPaint(this.streak);
			this.streak++;
			this.streakTimer = 0.5;
			this.fx.burst(
				tileX(x) + TILE / 2,
				tileY(y) + TILE / 2 - 4,
				this.level.theme.lit,
				6,
				90,
			);
		}
		if (this.paintCount >= this.paintTotal && this.phase === "play") {
			this.levelCleared();
		}
	}

	private unpaint(x: number, y: number) {
		const i = idx(x, y);
		if (!this.lit[i]) {
			return;
		}
		this.lit[i] = false;
		this.setLit(x, y, false);
		this.paintCount--;
		sfx.sfxUnpaint();
		this.fx.burst(tileX(x) + TILE / 2, tileY(y) + TILE / 2, "#3a3a66", 4, 50);
	}

	// ---------------------------------------------------------------------
	// update
	// ---------------------------------------------------------------------

	override update(dtMs: number) {
		const dt = Math.min(dtMs / 1000, 1 / 20);
		if (this.phase === "loading") {
			this.placeActors();
			return false;
		}
		this.controls.poll();
		this.time += dt;
		this.phaseTime += dt;
		this.updateCracks(dt);

		switch (this.phase) {
			case "intro":
				if (
					this.phaseTime > 2.2 ||
					(this.phaseTime > 0.4 && this.controls.confirm())
				) {
					this.introFade?.stop();
					this.overlay = 0;
					this.showMessage("");
					this.controls.reset();
					this.setPhase("play");
				}
				break;
			case "play":
				this.levelTime += dt;
				this.updatePlayer(dt);
				this.updateEnemies(dt);
				this.updateSparks(dt);
				this.updatePowers(dt);
				this.updateFields(dt);
				this.checkHits();
				break;
			case "dying":
				// the ones falling away finish going (their fall is tweened)
				this.enemies = this.enemies.filter((e) => e.falling !== -1);
				if (this.phaseTime > 1.6) {
					if (this.lives <= 0) {
						this.setPhase("gameover");
						this.overlay = 1;
						sfx.sfxGameOver();
						this.showMessage(
							"Game Over",
							`Score ${this.score}  ·  ${this.continueHint()}`,
						);
					} else {
						this.resetActors();
						this.player.invuln = INVULN_TIME;
						this.setPhase("play");
					}
				}
				break;
			case "clear":
				if (this.phaseTime > 2.8) {
					if (this.levelIndex + 1 < LEVELS.length) {
						void this.loadLevel(this.levelIndex + 1);
					} else {
						this.setPhase("victory");
						this.overlay = 1;
						this.showMessage(
							"Station saved!",
							`Final score ${this.score}  ·  ${this.continueHint()}`,
						);
					}
				}
				break;
			case "gameover":
			case "victory":
				if (this.phaseTime > 1 && this.controls.confirm()) {
					this.onExit();
				}
				break;
		}

		this.updateHud();
		this.placeActors();
		return true;
	}

	private levelCleared() {
		this.setPhase("clear");
		sfx.sfxClear();
		this.bonus = Math.max(0, Math.round(this.level.par - this.levelTime)) * 25;
		this.addScore(this.bonus);
		// fireworks far out in space
		this.host.space?.burst(this.level.theme.lit, 1.2);
		this.host.space?.burst(this.level.theme.litHi, 0.8);
		// every enemy pops in celebration
		for (const e of this.enemies) {
			this.fx.burst(enemyX(e), enemyY(e), "#ffffff", 14, 160);
		}
		this.enemies = [];
		this.clearSparks();
		this.overlay = 1;
		this.showMessage(
			"Level clear!",
			this.bonus > 0 ? `Time bonus +${this.bonus}` : "",
		);
	}

	private updateHud() {
		const touch = this.controls.onScreen;
		if (touch !== this.hintTouch) {
			this.hintTouch = touch;
			this.hintText.setText(
				touch
					? "LEFT: DRAG TO MOVE  -  RIGHT: ZAP"
					: "ARROWS / WASD TO MOVE  -  SPACE TO ZAP",
			);
		}
		if (this.score !== this.shownScore) {
			this.shownScore = this.score;
			this.scoreText.setText(this.score.toString().padStart(6, "0"));
		}
		if (this.hiscore !== this.shownHi) {
			this.shownHi = this.hiscore;
			this.hiText.setText(`HI ${this.hiscore.toString().padStart(6, "0")}`);
		}
	}

	private updateCracks(dt: number) {
		for (let i = 0; i < this.crumble.length; i++) {
			if (this.crumble[i] > 0) {
				this.crumble[i] -= dt;
				if (this.crumble[i] <= 0) {
					this.crumble[i] = 0;
					this.gone[i] = REGROW_TIME;
					const x = i % COLS;
					const y = Math.floor(i / COLS);
					this.board?.station.clearTile(x, y);
					this.board?.power.clearTile(x, y);
					this.refreshCell(x, y);
					sfx.sfxCrumble();
					this.fx.burst(
						tileX(x) + TILE / 2,
						tileY(y) + TILE / 2,
						"#8a7a6a",
						10,
						70,
						160,
					);
					// anything standing there drops
					if (this.phase === "play" && this.nearestTile(this.player) === i) {
						this.killPlayer(true);
					}
					for (const e of this.enemies) {
						if (
							!e.air &&
							e.spawning <= 0 &&
							e.falling <= 0 &&
							this.nearestTile(e) === i
						) {
							this.dropEnemy(e);
						}
					}
				}
			} else if (this.gone[i] > 0) {
				this.gone[i] -= dt;
				if (this.gone[i] <= 0) {
					this.gone[i] = 0;
					this.regrow(i);
				}
			}
		}
	}

	/** a fallen crack grows back, lit if it was */
	private regrow(i: number) {
		const station = this.board?.station;
		const gid = this.kindGid.get("crack");
		if (!station || gid === undefined) {
			return;
		}
		const x = i % COLS;
		const y = Math.floor(i / COLS);
		station.setTile(station.getTileById(gid, x, y), x, y);
		this.refreshCell(x, y);
		this.setLit(x, y, this.lit[i]);
		this.fx.burst(tileX(x) + TILE / 2, tileY(y) + TILE / 2, "#8a7a6a", 6, 40);
	}

	private nearestTile(m: Mover) {
		return m.t < 0.5 ? idx(m.fx, m.fy) : idx(m.tx, m.ty);
	}

	// --- player -----------------------------------------------------------

	private updatePlayer(dt: number) {
		const p = this.player;
		p.invuln = Math.max(0, p.invuln - dt);
		this.freeze = Math.max(0, this.freeze - dt);
		this.shield = Math.max(0, this.shield - dt);
		this.burst = Math.max(0, this.burst - dt);
		this.sparkCooldown = Math.max(0, this.sparkCooldown - dt);
		this.cheer = Math.max(0, this.cheer - dt);
		this.streakTimer -= dt;
		if (this.streakTimer <= 0) {
			this.streak = 0;
		}

		let time = dt;
		while (time > 0 && this.phase === "play") {
			if (!p.moving) {
				const d = this.controls.dir;
				if (d === -1) {
					break;
				}
				p.facing = d;
				if (!this.startStep(p, d, false)) {
					break;
				}
			}
			const speed = p.forced ? SLIDE_SPEED : WALK_SPEED;
			const need = (1 - p.t) / speed;
			if (time < need) {
				p.t += time * speed;
				time = 0;
			} else {
				time -= need;
				this.arrive(p);
			}
		}

		if (this.controls.fire() && this.sparkCooldown <= 0) {
			if (this.sparks.length < (this.burst > 0 ? 4 : 1)) {
				this.fire(p);
			}
		}
	}

	/** begin a step; false when the way is blocked */
	private startStep(p: Player, d: Dir, forced: boolean) {
		const nx = p.tx + DX[d];
		const ny = p.ty + DY[d];
		const g = this.ground(nx, ny);
		if (g === Tile.WALL || (!forced && !isSolidGround(g))) {
			return false;
		}
		// a cracked tile gives way once you step off it
		const here = idx(p.tx, p.ty);
		if (this.tiles[here] === Tile.CRACK && this.gone[here] <= 0) {
			this.crumble[here] = CRUMBLE_DELAY;
			// monsters keep off a tile about to crumble
			this.walkGrid?.setWalkable(p.tx, p.ty, false);
		}
		p.fx = p.tx;
		p.fy = p.ty;
		p.tx = nx;
		p.ty = ny;
		p.t = 0;
		p.moving = true;
		p.dir = d;
		p.forced = forced;
		return true;
	}

	private arrive(p: Player) {
		p.fx = p.tx;
		p.fy = p.ty;
		p.t = 0;
		p.moving = false;
		const g = this.ground(p.tx, p.ty);
		if (g === Tile.VOID) {
			this.killPlayer(true);
			return;
		}
		this.paint(p.tx, p.ty);
		const f = forcedDir(g, p.dir);
		if (f !== -1) {
			p.facing = g === Tile.ICE ? p.facing : f;
			if (!this.startStep(p, f, true)) {
				p.forced = false;
			}
		} else {
			p.forced = false;
		}
	}

	private fire(p: Player) {
		this.sparkCooldown = SPARK_COOLDOWN;
		sfx.sfxShoot();
		const dirs: Dir[] = this.burst > 0 ? [0, 1, 2, 3] : [p.facing];
		for (const d of dirs) {
			if (this.sparks.length >= (this.burst > 0 ? 4 : 1)) {
				break;
			}
			const at = trailPoint(moverX(p), moverY(p));
			this.sparks.push({ at, dir: d, trail: this.fx.trail(at) });
		}
	}

	private killPlayer(fell: boolean) {
		if (this.phase !== "play") {
			return;
		}
		this.lives--;
		this.setPhase("dying");
		this.streak = 0;
		const p = this.player;
		if (fell) {
			this.fall(p);
			sfx.sfxFall();
		} else {
			sfx.sfxDie();
			this.fx.burst(moverX(p), moverY(p), "#fff2a8", 30, 220, 300);
			game.viewport.shake(8, 350);
			// knocked out: X eyes, floating up as it fades away
			new Tween(this.ko).to({ alpha: 0, rise: 16 }, { duration: 1300 }).start();
		}
		aberrationBurst(fell ? 4 : 9);
	}

	/** drop into the void: `falling` tweens from 1 down to 0, then it is gone */
	private fall(m: Player | Enemy) {
		m.falling = 1;
		new Tween(m)
			.to({ falling: 0 }, { duration: 830 })
			.easing(Tween.Easing.Quadratic.In)
			.onComplete(() => {
				m.falling = -1;
			})
			.start();
	}

	// --- enemies ------------------------------------------------------------

	private updateEnemies(dt: number) {
		this.spawnTimer -= dt;
		if (
			this.spawnTimer <= 0 &&
			this.enemies.filter((e) => e.falling === 0).length < this.level.maxEnemies
		) {
			this.spawnEnemy();
		}

		for (const e of this.enemies) {
			if (e.falling !== 0) {
				continue; // falling away, tweened
			}
			if (e.spawning > 0) {
				e.spawning -= dt;
				if (e.spawning <= 0) {
					this.chooseDir(e);
				}
				continue;
			}
			if (this.freeze > 0) {
				continue;
			}
			if (e.air) {
				this.updateDrone(e, dt);
				continue;
			}
			let time = dt;
			// wading through goo
			const goo = this.tiles[this.nearestTile(e)] === Tile.GOO;
			const speed =
				e.speed * (1 + this.levelIndex * 0.03) * (goo ? GOO_SLOW : 1);
			while (time > 0 && e.falling === 0) {
				if (!e.moving) {
					if (!this.chooseDir(e)) {
						break;
					}
				}
				const need = (1 - e.t) / speed;
				if (time < need) {
					e.t += time * speed;
					time = 0;
				} else {
					time -= need;
					this.enemyArrive(e);
				}
			}
		}
		this.enemies = this.enemies.filter((e) => e.falling !== -1);
	}

	private spawnEnemy() {
		const nest = pick(this.nests);
		const kinds = this.level.enemies;
		const kind = kinds[this.spawnCount % kinds.length];
		this.spawnCount++;
		this.spawnTimer = this.level.spawnEvery;
		const enemy: Enemy = {
			fx: nest.x,
			fy: nest.y,
			tx: nest.x,
			ty: nest.y,
			t: 0,
			moving: false,
			dir: 2,
			kind,
			speed: ENEMY_SPEED[kind],
			spawning: 1,
			falling: 0,
		};
		if (kind === "drone") {
			enemy.air = {
				x: tileX(nest.x) + TILE / 2,
				y: tileY(nest.y) + TILE / 2 - 4,
				path: [],
				replan: 0,
			};
		}
		this.enemies.push(enemy);
		sfx.sfxSpawn();
	}

	private enemyCanEnter(x: number, y: number) {
		const i = idx(x, y);
		// enemies keep off a tile that is about to crumble, and force-fields
		return (
			isSolidGround(this.ground(x, y)) &&
			this.crumble[i] <= 0 &&
			!this.fields.has(i)
		);
	}

	/**
	 * A chaser plans the cheapest way to Bolt with the plugin: round walls,
	 * shut gates, fallen floor and goo, and off the cells of the other
	 * monsters, so they come at Bolt from different sides. Out of reach, the
	 * plan leads as near as it can.
	 * @returns the first step, or -1 to wander
	 */
	private chaseStep(e: Enemy): Dir | -1 {
		const grid = this.walkGrid;
		if (!grid) {
			return -1;
		}
		const p = this.player;
		const others = this.enemies
			.filter((o) => {
				return o !== e && !o.air && o.falling === 0 && o.spawning <= 0;
			})
			.map((o) => {
				return { x: o.tx, y: o.ty };
			});
		const plan = grid.findPath(
			{ x: e.tx, y: e.ty },
			{ x: p.t < 0.5 ? p.fx : p.tx, y: p.t < 0.5 ? p.fy : p.ty },
			{
				tiles: true,
				avoid: others,
				avoidCost: FLANK_COST,
				maxNodes: SEARCH_CAP,
			},
		);
		e.plan = plan;
		const next = plan.cells[0];
		if (next === undefined) {
			return -1;
		}
		const dx = next.col - e.tx;
		const dy = next.row - e.ty;
		return dx > 0 ? 1 : dx < 0 ? 3 : dy > 0 ? 2 : 0;
	}

	/**
	 * A drone flies: it plans across the air grid (holes are open to it),
	 * diagonally, along smoothed straight lines, and heads for each point in
	 * turn, planning again a few times a second as Bolt moves.
	 */
	private updateDrone(e: Enemy, dt: number) {
		const air = e.air;
		const grid = this.airGrid;
		if (!air || !grid) {
			return;
		}
		air.replan -= dt;
		if (air.replan <= 0) {
			air.replan = DRONE_REPLAN;
			const p = this.player;
			const others = this.enemies
				.filter((o) => {
					return o !== e && o.air !== undefined && o.falling === 0;
				})
				.map((o) => {
					return { x: enemyX(o), y: enemyY(o) };
				});
			e.plan = grid.findPath(
				{ x: air.x, y: air.y + 4 },
				{ x: moverX(p), y: moverY(p) + 4 },
				{
					diagonal: true,
					smooth: true,
					avoid: others,
					avoidCost: FLANK_COST,
					maxNodes: SEARCH_CAP,
				},
			);
			air.path = e.plan.path.map((point) => {
				return { x: point.x, y: point.y - 4 };
			});
		}
		let step = e.speed * TILE * dt;
		while (step > 0 && air.path.length > 0) {
			const to = air.path[0];
			const dx = to.x - air.x;
			const dy = to.y - air.y;
			const d = Math.hypot(dx, dy);
			if (d > 0.5) {
				// look the way it flies
				e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
			}
			if (d <= step) {
				air.x = to.x;
				air.y = to.y;
				air.path.shift();
				step -= d;
			} else {
				air.x += (dx / d) * step;
				air.y += (dy / d) * step;
				step = 0;
			}
		}
	}

	private chooseDir(e: Enemy) {
		const options: Dir[] = [];
		for (const d of [0, 1, 2, 3] as Dir[]) {
			if (this.enemyCanEnter(e.tx + DX[d], e.ty + DY[d])) {
				options.push(d);
			}
		}
		if (options.length === 0) {
			return false;
		}
		const forward = options.filter((d) => d !== opposite(e.dir));
		const choices = forward.length > 0 ? forward : options;
		let d: Dir;
		const chase =
			e.kind === "chaser" && Math.random() > 0.1 ? this.chaseStep(e) : -1;
		if (chase !== -1 && options.includes(chase)) {
			d = chase;
		} else if (e.kind === "muncher" && Math.random() < 0.75) {
			const onLit = choices.filter(
				(c) => this.lit[idx(e.tx + DX[c], e.ty + DY[c])],
			);
			d = pick(onLit.length > 0 ? onLit : choices);
		} else {
			d = pick(choices);
		}
		e.fx = e.tx;
		e.fy = e.ty;
		e.tx += DX[d];
		e.ty += DY[d];
		e.t = 0;
		e.dir = d;
		e.moving = true;
		return true;
	}

	private enemyArrive(e: Enemy) {
		e.fx = e.tx;
		e.fy = e.ty;
		e.t = 0;
		e.moving = false;
		if (this.ground(e.tx, e.ty) === Tile.VOID) {
			this.dropEnemy(e);
			return;
		}
		if (e.kind === "muncher") {
			this.unpaint(e.tx, e.ty);
		}
	}

	private dropEnemy(e: Enemy) {
		this.fall(e);
		e.moving = false;
		e.fx = e.tx = e.t < 0.5 ? e.fx : e.tx;
		e.fy = e.ty = e.t < 0.5 ? e.fy : e.ty;
		e.t = 0;
		this.addScore(ENEMY_SCORE[e.kind] * 2);
		sfx.sfxFall();
	}

	// --- sparks, power-ups, hits -------------------------------------------

	private updateSparks(dt: number) {
		const step = SPARK_SPEED * TILE * dt;
		this.sparks = this.sparks.filter((s) => {
			const at = s.at;
			at.x += DX[s.dir] * step;
			at.y += DY[s.dir] * step;
			const gx = Math.floor((at.x - OX) / TILE);
			const gy = Math.floor((at.y + 4 - OY) / TILE);
			let hit = !inBounds(gx, gy) || this.tiles[idx(gx, gy)] === Tile.WALL;
			if (hit) {
				this.fx.burst(at.x, at.y, "#fff2a8", 5, 80);
			} else {
				const e = this.enemies.find(
					(e) =>
						e.spawning <= 0 &&
						e.falling === 0 &&
						Math.hypot(enemyX(e) - at.x, enemyY(e) - at.y) < TILE * 0.55,
				);
				if (e) {
					this.popEnemy(e);
					hit = true;
				}
			}
			if (hit) {
				this.fx.stop(s.trail);
			}
			return !hit;
		});
	}

	private popEnemy(e: Enemy) {
		e.falling = -1;
		this.addScore(ENEMY_SCORE[e.kind]);
		sfx.sfxPop();
		const color =
			e.kind === "chaser"
				? "#ff6a7f"
				: e.kind === "muncher"
					? "#3cf0c8"
					: "#9a6bff";
		this.fx.burst(enemyX(e), enemyY(e), color, 22, 200, 260);
		this.host.space?.burst(color, 0.35);
		this.enemies = this.enemies.filter((o) => o !== e);
	}

	private updatePowers(dt: number) {
		this.powerTimer -= dt;
		if (this.powerTimer <= 0) {
			this.powerTimer = rand(...POWER_EVERY);
			this.spawnPower();
		}
		for (const pw of this.powers) {
			pw.life -= dt;
		}
		this.powers = this.powers.filter((pw) => pw.life > 0);
	}

	private spawnPower() {
		const p = this.player;
		const spots: { x: number; y: number }[] = [];
		for (let y = 0; y < ROWS; y++) {
			for (let x = 0; x < COLS; x++) {
				const t = this.tiles[idx(x, y)];
				if (
					(t === Tile.FLOOR || t === Tile.ICE || t === Tile.GOO) &&
					Math.abs(x - p.tx) + Math.abs(y - p.ty) >= 3 &&
					!this.powers.some((pw) => pw.x === x && pw.y === y)
				) {
					spots.push({ x, y });
				}
			}
		}
		if (spots.length === 0) {
			return;
		}
		// the scanner only where some monster plans a route
		const planners = this.level.enemies.some((k) => {
			return k === "chaser" || k === "drone";
		});
		const odds: [PowerKind, number][] = [
			["life", this.lives < MAX_LIVES ? 0.08 : 0],
			["gem", 0.22],
			["freeze", 0.16],
			["shield", 0.16],
			["burst", 0.14],
			["field", 0.12],
			["scan", planners ? 0.12 : 0],
		];
		let roll = Math.random() * odds.reduce((sum, [, w]) => sum + w, 0);
		let kind: PowerKind = "gem";
		for (const [k, w] of odds) {
			roll -= w;
			if (roll < 0) {
				kind = k;
				break;
			}
		}
		this.powers.push({ ...pick(spots), kind, life: POWER_LIFE });
	}

	private collect(pw: Power) {
		this.cheer = 0.8;
		sfx.sfxPickup();
		this.host.space?.burst(POWER_COLORS[pw.kind], 0.6);
		this.fx.burst(
			tileX(pw.x) + TILE / 2,
			tileY(pw.y) + TILE / 2 - 6,
			POWER_COLORS[pw.kind],
			16,
			160,
		);
		switch (pw.kind) {
			case "gem":
				this.addScore(500);
				break;
			case "life":
				this.lives = Math.min(MAX_LIVES, this.lives + 1);
				break;
			case "freeze":
				this.freeze = POWER_TIME.freeze;
				break;
			case "shield":
				this.shield = POWER_TIME.shield;
				break;
			case "burst":
				this.burst = POWER_TIME.burst;
				break;
			case "field":
				this.raiseFields();
				break;
			case "scan":
				this.scan = POWER_TIME.scan;
				break;
		}
	}

	/**
	 * A force-field on every open cell around Bolt: monsters cannot go
	 * through it, so their plans go round. Bolt can.
	 */
	private raiseFields() {
		const p = this.player;
		const cx = p.t < 0.5 ? p.fx : p.tx;
		const cy = p.t < 0.5 ? p.fy : p.ty;
		const taken = new Set(
			this.enemies.map((e) => {
				return e.air
					? idx(
							Math.floor((e.air.x - OX) / TILE),
							Math.floor((e.air.y + 4 - OY) / TILE),
						)
					: this.nearestTile(e);
			}),
		);
		for (let dy = -1; dy <= 1; dy++) {
			for (let dx = -1; dx <= 1; dx++) {
				const x = cx + dx;
				const y = cy + dy;
				const i = idx(x, y);
				if (
					(dx === 0 && dy === 0) ||
					!inBounds(x, y) ||
					!isSolidGround(this.ground(x, y)) ||
					taken.has(i)
				) {
					continue;
				}
				this.fields.set(i, POWER_TIME.field);
				this.walkGrid?.setWalkable(x, y, false);
				this.airGrid?.setWalkable(x, y, false);
			}
		}
	}

	/** count the force-fields and the scanner down */
	private updateFields(dt: number) {
		for (const [i, left] of this.fields) {
			if (left - dt <= 0) {
				this.fields.delete(i);
				this.refreshCell(i % COLS, Math.floor(i / COLS));
			} else {
				this.fields.set(i, left - dt);
			}
		}
		this.scan = Math.max(0, this.scan - dt);
		const scanner = this.scanner;
		if (!scanner) {
			return;
		}
		if (this.scan > 0 && this.phase === "play") {
			if (!scanner.ancestor) {
				this.host.actors.addChild(scanner, -1);
			}
			scanner.paths = this.enemies
				.filter((e) => {
					return e.plan !== undefined && e.falling === 0 && e.spawning <= 0;
				})
				.map((e) => {
					return {
						result: e.plan as PathResult,
						from: { x: enemyX(e), y: enemyY(e) },
						color: GLOW[e.kind],
					};
				});
		} else if (scanner.ancestor) {
			this.host.actors.removeChild(scanner, true);
		}
	}

	private checkHits() {
		if (this.phase !== "play") {
			return;
		}
		const p = this.player;
		const px = moverX(p);
		const py = moverY(p);
		this.powers = this.powers.filter((pw) => {
			const hit =
				Math.hypot(
					tileX(pw.x) + TILE / 2 - px,
					tileY(pw.y) + TILE / 2 - 4 - py,
				) <
				TILE * 0.5;
			if (hit) {
				this.collect(pw);
			}
			return !hit;
		});
		for (const e of [...this.enemies]) {
			if (e.spawning > 0 || e.falling !== 0) {
				continue;
			}
			if (Math.hypot(enemyX(e) - px, enemyY(e) - py) < TILE * 0.62) {
				if (this.shield > 0) {
					this.popEnemy(e);
				} else if (p.invuln <= 0) {
					this.killPlayer(false);
					return;
				}
			}
		}
	}

	// ---------------------------------------------------------------------
	// draw
	// ---------------------------------------------------------------------

	override draw(r: Renderer) {
		// the station (the Tiled layers) and the sky are drawn under this,
		// the characters' sprites over it
		if (!this.board) {
			return;
		}
		this.drawTopBar(r);

		// force-fields: a pulsing barrier on each cell, fading as it runs out
		for (const [i, left] of this.fields) {
			const x = tileX(i % COLS);
			const y = tileY(Math.floor(i / COLS));
			const fade = Math.min(1, left / 1.5);
			const pulse = 0.55 + 0.25 * Math.sin(this.time * 9 + i);
			drawGlow(r, x + TILE / 2, y + TILE / 2 - 4, 30, POWER_COLORS.field, fade);
			r.setGlobalAlpha(pulse * fade);
			r.setColor(POWER_COLORS.field);
			r.lineWidth = 3;
			r.strokeRoundRect(x + 5, y + 3, TILE - 10, TILE - 14, 8);
			r.setGlobalAlpha(1);
		}

		for (const pw of this.powers) {
			const blink = pw.life < 2 && Math.floor(pw.life * 8) % 2 === 0 ? 0.3 : 1;
			drawPower(
				r,
				pw.kind,
				tileX(pw.x) + TILE / 2,
				tileY(pw.y) + TILE / 2 - 2,
				this.time,
				blink,
			);
		}

		// a soft glow under each character
		for (const [e, sprite] of this.monsters) {
			const k = sprite.alpha * (e.falling > 0 ? e.falling : 1);
			drawGlow(r, sprite.pos.x, sprite.pos.y, 26 * k, GLOW[e.kind], 0.7 * k);
		}
		if (this.bolt.alpha > 0) {
			drawGlow(
				r,
				this.bolt.pos.x,
				this.bolt.pos.y,
				28,
				GLOW.bolt,
				0.8 * this.bolt.alpha,
			);
		}
	}

	/** over the characters: the sparks, and the panel behind a message */
	drawFront(r: Renderer) {
		if (!this.board) {
			return;
		}
		for (const s of this.sparks) {
			drawGlow(r, s.at.x, s.at.y, 16, "#fff2a8", 1);
			r.setColor("#ffffff");
			r.fillEllipse(s.at.x, s.at.y, 5, 5);
		}

		const a = this.paused ? 1 : this.overlay;
		if (a > 0) {
			r.setGlobalAlpha(0.5 * a);
			r.setColor("#05030f");
			r.fillRect(0, OY - 8, WIDTH, ROWS * TILE + 16);
			// a panel behind the message so it reads over any board
			r.setGlobalAlpha(0.92 * a);
			r.setColor("#120a2e");
			r.fillRoundRect(WIDTH / 2 - 258, OY + 225, 516, 120, 18);
			r.setColor(this.level.theme.lit);
			r.lineWidth = 3;
			r.strokeRoundRect(WIDTH / 2 - 258, OY + 225, 516, 120, 18);
			r.setGlobalAlpha(1);
		}
	}

	private drawTopBar(r: Renderer) {
		// paint progress
		const bx = OX + MAX_LIVES * 30 + 12;
		const bw = WIDTH - OX - bx;
		const by = 88;
		r.setColor("#1b1838");
		r.fillRoundRect(bx, by, bw, 12, 6);
		const pct = this.paintTotal > 0 ? this.paintCount / this.paintTotal : 0;
		if (pct > 0) {
			r.setColor(this.level.theme.lit);
			r.fillRoundRect(bx, by, Math.max(12, bw * pct), 12, 6);
			r.setGlobalAlpha(0.5);
			r.setColor(this.level.theme.litHi);
			r.fillRoundRect(bx + 3, by + 2, Math.max(6, bw * pct - 6), 3, 2);
			r.setGlobalAlpha(1);
		}
		// running power-ups, as icons with a draining ring, centred in the
		// controls' zone between the stick and the button
		const timers = (
			[
				["burst", this.burst],
				["shield", this.shield],
				["freeze", this.freeze],
				["field", Math.max(0, ...this.fields.values())],
				["scan", this.scan],
			] as [TimedPower, number][]
		).filter(([, left]) => left > 0);
		let ix = WIDTH / 2 - ((timers.length - 1) * 40) / 2;
		const iy = BOARD_BOTTOM + 30;
		for (const [kind, left] of timers) {
			const total = POWER_TIME[kind];
			r.setColor(POWER_COLORS[kind]);
			r.lineWidth = 3;
			r.strokeArc(
				ix,
				iy,
				15,
				-Math.PI / 2,
				-Math.PI / 2 + Math.PI * 2 * (left / total),
			);
			r.setGlobalAlpha(0.9);
			r.fillEllipse(ix, iy, 7, 7);
			r.setGlobalAlpha(1);
			ix += 40;
		}
	}

	/** put each character's sprite where it is, playing what it is doing */
	private placeActors() {
		for (let i = 0; i < this.lifeIcons.length; i++) {
			this.lifeIcons[i].alpha = this.board && i < this.lives ? 1 : 0;
		}
		this.placeBolt();

		// a sprite for each monster, gone with it
		for (const [e, sprite] of this.monsters) {
			if (!this.enemies.includes(e)) {
				this.host.actors.removeChild(sprite);
				this.monsters.delete(e);
			}
		}
		for (const e of this.enemies) {
			let sprite = this.monsters.get(e);
			if (!sprite) {
				sprite = new Actor(monsterAnimation(e.kind, -1));
				// not all stepping in time
				sprite.setAnimationFrame(Math.floor(Math.random() * 8));
				this.monsters.set(e, sprite);
				this.host.actors.addChild(sprite, 3);
			}
			this.placeMonster(e, sprite);
		}
	}

	private placeBolt() {
		const p = this.player;
		const sprite = this.bolt;
		let shield = false;
		if (!this.board || !p) {
			sprite.alpha = 0;
		} else {
			const x = moverX(p);
			const y = moverY(p);
			if (this.phase === "dying") {
				sprite.play("bolt-ko");
				if (p.falling > 0) {
					// tumbling down into space
					sprite.place(x, y + (1 - p.falling) * 20, p.falling, p.falling);
				} else if (p.falling === 0) {
					// knocked out: floats up as it fades away
					sprite.place(x, y - this.ko.rise, 1, this.ko.alpha);
				} else {
					sprite.alpha = 0;
				}
			} else if (this.phase === "clear") {
				// a little victory hop
				const hop = Math.abs(Math.sin(this.phaseTime * 8)) * 10;
				sprite.play("bolt-cheer");
				sprite.place(x, y - hop);
			} else {
				const blink = p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0;
				sprite.play(
					this.cheer > 0
						? "bolt-cheer"
						: boltAnimation(p.moving && !p.forced, p.facing),
				);
				sprite.place(x, y, 1, blink ? 0.35 : 1);
				shield = this.shield > 0;
			}
		}
		this.shieldRing.place(sprite.pos.x, sprite.pos.y, 1, shield ? 1 : 0);
	}

	private placeMonster(e: Enemy, sprite: Actor) {
		const x = enemyX(e);
		const y = enemyY(e);
		if (e.falling > 0) {
			sprite.play(monsterAnimation(e.kind, -1));
			sprite.place(x, y + (1 - e.falling) * 20, e.falling, e.falling);
		} else if (e.spawning > 0) {
			// coming out of the portal
			const grow = 1 - e.spawning;
			sprite.play(monsterAnimation(e.kind, -1));
			sprite.place(x, y, 0.2 + grow * 0.8, grow * 0.8);
		} else if (this.freeze > 0) {
			sprite.play(`${e.kind}-frozen`);
			sprite.place(x, y);
		} else {
			sprite.play(monsterAnimation(e.kind, e.dir));
			sprite.place(x, y);
		}
	}
}

/** draws the field's front layer, over the characters */
class FieldFront extends Renderable {
	constructor(private readonly field: Field) {
		super(0, 0, WIDTH, HEIGHT);
		this.anchorPoint.set(0, 0);
		this.isPersistent = true;
	}

	override draw(r: Renderer) {
		this.field.drawFront(r);
	}
}
