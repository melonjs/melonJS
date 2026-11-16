/**
 * melonJS — Starsweep: the playing field.
 *
 * One `Renderable` runs a run of levels: it loads each level, moves Bolt,
 * fires its sparks, counts the score and lives, and goes from one phase to
 * the next (a level's intro, play, a lost life, a cleared level, the end).
 * The rest is in its own module, which the field puts together:
 * - `station.ts`, the board as it is played (the level's Tiled map);
 * - `navigation.ts`, where monsters can go, with the pathfinding plugin;
 * - `monsters.ts`, the monsters and how each kind moves;
 * - `powers.ts`, the power-ups; `hud.ts`, what is shown around the board.
 *
 * Bolt and the monsters are `Sprite`s from the cast sheet (see `cast.ts`).
 * Bursts come from a `ParticleEmitter` and spark trails are `Trail`s (see
 * `fx.ts`), one-shot animations are `Tween`s, and pausing is the engine's
 * `state.pause()`.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Container,
	event,
	game,
	Renderable,
	state,
	type Trail,
	Tween,
	Vector2d,
} from "melonjs";
import * as sfx from "../audio/sfx";
import {
	ACTOR_Z,
	cellUnder,
	centreX,
	centreY,
	HEIGHT,
	TILE,
	WIDTH,
} from "../config/layout";
import { Actor, boltAnimation, GLOW, placeFalling } from "../entities/Actor";
import type { Bolt } from "../entities/Bolt";
import type { DeepSpace } from "../fx/DeepSpace";
import type { Effects } from "../fx/Effects";
import type { NebulaBackdrop } from "../fx/NebulaBackdrop";
import type { SpaceBackdrop } from "../fx/SpaceBackdrop";
import { aberrationBurst } from "../fx/screenFx";
import type { Controls } from "../input/Controls";
import {
	type Cell,
	canStep,
	type Dir,
	DX,
	DY,
	forcedDir,
	idx,
	inBounds,
	isSolidGround,
	Tile,
} from "../rules/board";
import { LEVEL_FILES, type LevelDef } from "../rules/levels";
import { Hud, MAX_LIVES } from "../ui/Hud";
import {
	drawGlow,
	POWER_COLORS,
	type PowerKind,
	type Renderer,
} from "../utils/draw";
import { loadHiscore, saveHiscore } from "../utils/score";
import { FieldFront } from "./FieldFront";
import {
	ENEMY_SCORE,
	type Enemy,
	enemyX,
	enemyY,
	isActive,
	Monsters,
} from "./Monsters";
import {
	beginStep,
	land,
	type Mover,
	moverX,
	moverY,
	nearestCell,
	standingOn,
	walk,
} from "./movers";
import { Navigation } from "./Navigation";
import { POWER_TIME, Powers } from "./Powers";
import { type Board, Station } from "./Station";

/** Bolt's walking speed, in cells per second */
const WALK_SPEED = 5.2;
/** Bolt's speed when ice or an arrow carries it */
const SLIDE_SPEED = 9;
/** a spark's speed, in cells per second */
const SPARK_SPEED = 15;
/** seconds between two zaps */
const SPARK_COOLDOWN = 0.22;
/** sparks on the board at once: one, or one each way during a burst */
const MAX_SPARKS = 1;
const BURST_SPARKS = 4;
const START_LIVES = 3;
/** seconds Bolt cannot be hurt after coming back */
const INVULN_TIME = 2.5;
/** the longest frame the field steps at once, in seconds */
const MAX_STEP = 1 / 20;

/** how long the level's name shows, then fades, before play starts */
const INTRO_HOLD = 1.8;
const INTRO_FADE = 0.4;
/** the intro can be skipped after this, in seconds */
const INTRO_SKIP_AFTER = 0.4;
/** seconds after a lost life, and after a cleared level, before going on */
const DYING_TIME = 1.6;
const CLEAR_TIME = 2.8;
/** the end screens take input after this, in seconds */
const END_WAIT = 1;
/** seconds Bolt takes to fall away, and to fade when knocked out */
const FALL_TIME = 0.83;
const KO_TIME = 1.3;
/** how far a knocked-out Bolt floats up as it fades, in pixels */
const KO_RISE = 16;

/** points for a panel lit, a gem, and each second under par */
const PAINT_POINTS = 10;
const GEM_POINTS = 500;
const TIME_BONUS = 25;
/** a monster that falls off is worth this many times its score */
const FALL_BONUS = 2;
/** a streak of panels keeps going if the next comes within this, in seconds */
const STREAK_WINDOW = 0.5;
/** seconds Bolt cheers after picking something up */
const CHEER_TIME = 0.8;

/** how close, as a share of a cell, a monster catches Bolt */
const CATCH_REACH = 0.62;
/** how close, as a share of a cell, a spark hits a monster */
const SPARK_REACH = 0.55;

/** a spark's colour, and the burst where it stops */
const SPARK_COLOR = "#fff2a8";
/** a gate's colour as it slides open, and the far-off burst it sets off */
const GATE_COLOR = "#ff3b5c";
const GATE_NOVA = "#ff5d7a";
/** the dust of a cracked panel */
const CRACK_COLOR = "#8a7a6a";

/** Bolt, as it plays */
interface Player extends Mover {
	/** the way it looks; a slide on ice keeps it */
	facing: Dir;
	/** ice or an arrow is carrying it */
	forced: boolean;
	/** 0 on its feet; from 1 down to 0 as it falls (tweened); -1 once gone */
	falling: number;
	/** seconds it cannot be hurt for, after coming back */
	invuln: number;
}

/** Bolt's own fields, standing on its feet, facing down */
const BOLT_STILL = { facing: 2, forced: false, falling: 0, invuln: 0 } as const;

/** a spark Bolt zapped, flying straight until it hits something */
interface Spark {
	/** where it is, which its trail follows */
	at: Vector2d;
	dir: Dir;
	trail: Trail;
}

type Phase =
	| "loading"
	| "intro"
	| "play"
	| "dying"
	| "clear"
	| "gameover"
	| "victory";

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
	/**
	 * load a level's Tiled map into the board container
	 * @returns its tile layers, and the Bolt its `Bolt` object was built into
	 */
	loadBoard: (file: string) => Promise<{ layers: Board; bolt: Bolt }>;
}

/** The playing field: a run of levels, from the first to the last. */
export class Field extends Renderable {
	/** called when the run ends and the player confirms */
	onExit: () => void = () => {};
	/** sparks and the message panel, drawn over the characters */
	readonly front: Renderable;
	/** the labels and the progress bar, for the screen to add */
	readonly hudItems: Renderable[];

	private readonly host: FieldHost;
	private readonly controls: Controls;
	private readonly effects: Effects;
	private readonly station: Station;
	private readonly nav: Navigation;
	private readonly monsters: Monsters;
	private readonly powers = new Powers();
	private readonly hud: Hud;

	private time = 0;
	private levelIndex = 0;
	private level!: LevelDef;
	private player: Player = { ...standingOn({ x: 0, y: 0 }), ...BOLT_STILL };
	private sparks: Spark[] = [];
	private sparkCooldown = 0;

	private phase: Phase = "loading";
	private phaseTime = 0;
	/** the dimming and panel behind a message, 0 to 1 */
	private overlay = 0;
	private introFade: Tween | null = null;
	/** what was on screen when the game paused, put back on resume */
	private beforePause: { big: string; sub: string; alpha: number } | null =
		null;
	/** Bolt knocked out: fading and floating up, both tweened */
	private readonly ko = { alpha: 1, rise: 0 };
	private score = 0;
	private hiscore = 0;
	private lives = START_LIVES;
	private levelTime = 0;
	private streak = 0;
	private streakTimer = 0;
	/** > 0 while Bolt is pleased with itself */
	private cheer = 0;

	// Bolt on screen: built by each level, from its map
	private bolt: Bolt | null = null;
	private readonly shieldRing = new Actor("shield");

	/**
	 * @param host - the screen's parts the field plays in
	 * @param levels - the levels, in play order (see `levels.ts`)
	 */
	constructor(
		host: FieldHost,
		private readonly levels: readonly LevelDef[],
	) {
		super(0, 0, WIDTH, HEIGHT);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
		// level.load clears the world of everything that is not persistent
		this.isPersistent = true;
		this.host = host;
		this.controls = host.controls;
		this.effects = host.effects;
		this.station = new Station({
			crumbled: (cell) => this.crumbled(cell),
			regrown: (cell) => {
				this.nav.refreshCell(cell);
				this.burstAt(cell, CRACK_COLOR, 6, 40);
			},
			gatesOpened: (cells) => this.gatesOpened(cells),
		});
		this.nav = new Navigation(host.actors);
		this.monsters = new Monsters(
			{
				station: this.station,
				nav: this.nav,
				bolt: () => ({
					cell: nearestCell(this.player),
					x: moverX(this.player),
					y: moverY(this.player),
				}),
				fell: (e) => {
					this.fall(e);
					this.addScore(ENEMY_SCORE[e.kind] * FALL_BONUS);
					sfx.sfxFall();
				},
				munched: (cell) => this.unpaint(cell),
			},
			host.actors,
		);
		this.hud = new Hud(host.actors);
		this.hudItems = this.hud.items;
		this.shieldRing.isPersistent = true;
		host.actors.addChild(this.shieldRing, ACTOR_Z.shield);
		this.front = new FieldFront(this);
		this.hiscore = loadHiscore();
		// paused by the player or by the page losing focus: say so
		event.on(event.STATE_PAUSE, this.onPause);
		event.on(event.STATE_RESUME, this.onResume);
	}

	override onDestroyEvent() {
		event.off(event.STATE_PAUSE, this.onPause);
		event.off(event.STATE_RESUME, this.onResume);
		this.monsters.destroy();
	}

	private readonly onPause = () => {
		if (this.beforePause) {
			return;
		}
		this.beforePause = {
			...this.hud.message,
			alpha: this.hud.messageAlpha,
		};
		this.hud.show(
			"Paused",
			this.controls.onScreen ? "" : "Press P or Esc to resume",
		);
	};

	private readonly onResume = () => {
		const was = this.beforePause;
		if (!was) {
			return;
		}
		this.beforePause = null;
		this.hud.show(was.big, was.sub);
		this.hud.messageAlpha = was.alpha;
	};

	/** whether the player may pause now */
	get canPause() {
		return this.phase === "play";
	}

	/** start a brand new run */
	newGame() {
		this.score = 0;
		this.lives = START_LIVES;
		void this.loadLevel(0);
	}

	// ---------------------------------------------------------------------
	// level flow
	// ---------------------------------------------------------------------

	private async loadLevel(i: number) {
		this.setPhase("loading");
		this.levelIndex = i;
		this.level = this.levels[i];
		this.station.unload();
		this.monsters.reset();
		this.clearSparks();
		const theme = this.level.theme;
		this.host.sky?.setLevelTheme(theme);
		this.host.backdrop.setTheme(theme);
		this.host.space?.setColors([theme.lit, theme.litHi, "#ffffff"]);
		const { layers, bolt } = await this.host.loadBoard(LEVEL_FILES[i]);
		layers.power.tint.parseCSS(theme.lit);
		this.station.load(layers, this.level);
		this.takeBolt(bolt);
		this.nav.build(this.station);
		this.nav.showRoutes(null);
		this.monsters.startLevel(this.level, i);
		this.powers.reset();
		this.levelTime = 0;
		this.hud.setLevel(i + 1, this.levels.length, this.level.name, theme.lit);
		this.resetActors();
		this.station.paint(this.station.start.x, this.station.start.y);
		this.setPhase("intro");
		this.hud.show(this.level.name, this.level.hint);
		this.overlay = 1;
		// the message stays a moment, then fades off the board, and play starts
		this.introFade = new Tween(this)
			.to(
				{ overlay: 0 },
				{ duration: INTRO_FADE * 1000, delay: INTRO_HOLD * 1000 },
			)
			.onUpdate(() => {
				this.hud.messageAlpha = this.overlay;
			})
			.onComplete(() => this.startPlay())
			.start();
	}

	/**
	 * The level built Bolt where its map's `Bolt` object is: draw it with the
	 * other characters, over the glows the field draws under them, in place
	 * of the last level's.
	 */
	private takeBolt(bolt: Bolt) {
		if (this.bolt) {
			this.host.actors.removeChildNow(this.bolt);
		}
		this.bolt = bolt;
		bolt.isPersistent = true;
		// adding a child to another container moves it there
		this.host.actors.addChild(bolt, ACTOR_Z.bolt);
	}

	/** the intro is over, or skipped: play */
	private startPlay() {
		if (this.phase !== "intro") {
			return;
		}
		this.introFade?.stop();
		this.introFade = null;
		this.overlay = 0;
		this.hud.show("");
		this.setPhase("play");
	}

	private clearSparks() {
		for (const s of this.sparks) {
			this.effects.stop(s.trail);
		}
		this.sparks = [];
	}

	/** Bolt back at the start, the monsters gone, for a level or a new life */
	private resetActors() {
		this.player = { ...standingOn(this.station.start), ...BOLT_STILL };
		this.monsters.reset();
		this.clearSparks();
		this.ko.alpha = 1;
		this.ko.rise = 0;
		this.streak = 0;
		this.controls.reset();
	}

	private setPhase(phase: Phase) {
		this.phase = phase;
		this.phaseTime = 0;
		// a press from an earlier moment must not skip this one
		this.controls.reset();
	}

	/** the end of the run: a message, and any key or tap goes back */
	private endRun(phase: "gameover" | "victory", big: string, sub: string) {
		this.setPhase(phase);
		this.overlay = 1;
		this.hud.show(big, `${sub}  ·  ${this.continueHint()}`);
	}

	/** how to move on from a message, for the controls in use */
	private continueHint() {
		return this.controls.onScreen ? "tap to go on" : "click or press Enter";
	}

	private addScore(points: number) {
		this.score += points;
		if (this.score > this.hiscore) {
			this.hiscore = this.score;
			saveHiscore(this.hiscore);
		}
	}

	// ---------------------------------------------------------------------
	// the board
	// ---------------------------------------------------------------------

	/** a burst of particles from a cell's centre */
	private burstAt(
		cell: Cell,
		color: string,
		count: number,
		speed: number,
		life?: number,
	) {
		this.effects.burst(
			centreX(cell.x),
			centreY(cell.y),
			color,
			count,
			speed,
			life,
		);
	}

	/** Bolt lands on a panel: light it, and keep the streak going */
	private paint(cell: Cell) {
		if (!this.station.paint(cell.x, cell.y)) {
			return;
		}
		this.addScore(PAINT_POINTS);
		sfx.sfxPaint(this.streak);
		this.streak++;
		this.streakTimer = STREAK_WINDOW;
		this.effects.burst(
			moverX(this.player),
			moverY(this.player),
			this.level.theme.lit,
			6,
			90,
		);
		if (this.station.cleared && this.phase === "play") {
			this.levelCleared();
		}
	}

	/** a muncher eats a panel's light */
	private unpaint(cell: Cell) {
		if (this.station.unpaint(cell.x, cell.y)) {
			sfx.sfxUnpaint();
			this.burstAt(cell, "#3a3a66", 4, 50);
		}
	}

	/** a cracked panel gave way: whoever stands on it falls */
	private crumbled(cell: Cell) {
		this.nav.refreshCell(cell);
		sfx.sfxCrumble();
		this.burstAt(cell, CRACK_COLOR, 10, 70, 160);
		const on = (m: Mover) => {
			const at = nearestCell(m);
			return at.x === cell.x && at.y === cell.y;
		};
		if (this.phase === "play" && on(this.player)) {
			this.killPlayer(true);
		}
		for (const e of this.monsters.list) {
			if (!e.air && isActive(e) && on(e)) {
				this.monsters.drop(e);
			}
		}
	}

	/** a switch was lit, and the gates slid open */
	private gatesOpened(cells: Cell[]) {
		for (const cell of cells) {
			this.nav.refreshCell(cell);
			this.burstAt(cell, GATE_COLOR, 10, 120);
		}
		sfx.sfxPickup();
		this.host.space?.burst(GATE_NOVA, 0.6);
	}

	// ---------------------------------------------------------------------
	// update
	// ---------------------------------------------------------------------

	override update(dtMs: number) {
		const dt = Math.min(dtMs / 1000, MAX_STEP);
		if (this.phase === "loading") {
			this.placeActors();
			return false;
		}
		this.controls.poll();
		this.time += dt;
		this.phaseTime += dt;
		this.station.update(dt);

		switch (this.phase) {
			case "intro":
				if (this.phaseTime > INTRO_SKIP_AFTER && this.controls.confirm()) {
					this.startPlay();
				}
				break;
			case "play":
				this.updatePlay(dt);
				break;
			case "dying":
				// the ones falling away finish going (their fall is tweened)
				this.monsters.prune();
				if (this.phaseTime > DYING_TIME) {
					this.afterDying();
				}
				break;
			case "clear":
				if (this.phaseTime > CLEAR_TIME) {
					this.afterClear();
				}
				break;
			case "gameover":
			case "victory":
				if (this.phaseTime > END_WAIT && this.controls.confirm()) {
					this.onExit();
				}
				break;
		}

		this.hud.update(
			this.score,
			this.hiscore,
			this.station.progress,
			this.station.layers ? this.lives : 0,
			this.controls.onScreen,
		);
		this.placeActors();
		return true;
	}

	private updatePlay(dt: number) {
		this.levelTime += dt;
		this.updatePlayer(dt);
		this.monsters.update(dt, this.powers.active("freeze"));
		this.updateSparks(dt);
		this.powers.update(
			dt,
			this.station,
			nearestCell(this.player),
			this.lives < MAX_LIVES,
		);
		this.nav.update(dt);
		this.nav.showRoutes(this.monsters.routes());
		this.checkHits();
	}

	/** a life lost: game over, or Bolt back at the start */
	private afterDying() {
		if (this.lives <= 0) {
			sfx.sfxGameOver();
			this.endRun("gameover", "Game Over", `Score ${this.score}`);
			return;
		}
		this.resetActors();
		this.player.invuln = INVULN_TIME;
		this.setPhase("play");
	}

	/** a level cleared: the next one, or the run is won */
	private afterClear() {
		if (this.levelIndex + 1 < this.levels.length) {
			void this.loadLevel(this.levelIndex + 1);
			return;
		}
		this.endRun("victory", "Station saved!", `Final score ${this.score}`);
	}

	private levelCleared() {
		this.setPhase("clear");
		sfx.sfxClear();
		const bonus =
			Math.max(0, Math.round(this.level.par - this.levelTime)) * TIME_BONUS;
		this.addScore(bonus);
		// fireworks far out in space
		this.host.space?.burst(this.level.theme.lit, 1.2);
		this.host.space?.burst(this.level.theme.litHi, 0.8);
		// every monster pops in celebration
		for (const e of this.monsters.list) {
			this.effects.burst(enemyX(e), enemyY(e), "#ffffff", 14, 160);
		}
		this.monsters.reset();
		this.nav.showRoutes(null);
		this.clearSparks();
		this.overlay = 1;
		this.hud.show("Level clear!", bonus > 0 ? `Time bonus +${bonus}` : "");
	}

	// --- Bolt -------------------------------------------------------------

	private updatePlayer(dt: number) {
		const p = this.player;
		p.invuln = Math.max(0, p.invuln - dt);
		this.sparkCooldown = Math.max(0, this.sparkCooldown - dt);
		this.cheer = Math.max(0, this.cheer - dt);
		this.streakTimer -= dt;
		if (this.streakTimer <= 0) {
			this.streak = 0;
		}
		walk(p, dt, {
			speed: () => (p.forced ? SLIDE_SPEED : WALK_SPEED),
			next: () => {
				const d = this.controls.dir;
				if (d === -1) {
					return false;
				}
				p.facing = d;
				return this.startStep(d, false);
			},
			arrive: () => this.arrive(),
			going: () => this.phase === "play",
		});
		if (this.controls.fire() && this.sparkCooldown <= 0) {
			this.fire();
		}
	}

	/**
	 * Begin one of Bolt's steps.
	 * @param d - which way
	 * @param forced - ice or an arrow carries it
	 * @returns false when the way is blocked
	 */
	private startStep(d: Dir, forced: boolean) {
		const p = this.player;
		if (!canStep(this.station.ground(p.toX + DX[d], p.toY + DY[d]), forced)) {
			return false;
		}
		// a cracked panel gives way once Bolt steps off it: monsters keep off
		if (this.station.stepOff(p.toX, p.toY)) {
			this.nav.keepOff({ x: p.toX, y: p.toY });
		}
		beginStep(p, d);
		p.forced = forced;
		return true;
	}

	/** Bolt reached a cell: it falls, or lights it and may be carried on */
	private arrive() {
		const p = this.player;
		land(p);
		const g = this.station.ground(p.toX, p.toY);
		if (g === Tile.VOID) {
			this.killPlayer(true);
			return;
		}
		this.paint({ x: p.toX, y: p.toY });
		const f = forcedDir(g, p.dir);
		if (f !== -1) {
			// an arrow turns Bolt round; ice slides it on as it was
			p.facing = g === Tile.ICE ? p.facing : f;
			p.forced = this.startStep(f, true);
		} else {
			p.forced = false;
		}
	}

	/** zap: a spark the way Bolt faces, or one each way during a burst */
	private fire() {
		const burst = this.powers.active("burst");
		const most = burst ? BURST_SPARKS : MAX_SPARKS;
		if (this.sparks.length >= most) {
			return;
		}
		this.sparkCooldown = SPARK_COOLDOWN;
		sfx.sfxShoot();
		const p = this.player;
		const dirs: Dir[] = burst ? [0, 1, 2, 3] : [p.facing];
		for (const d of dirs) {
			if (this.sparks.length >= most) {
				break;
			}
			const at = new Vector2d(moverX(p), moverY(p));
			this.sparks.push({ at, dir: d, trail: this.effects.trail(at) });
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
			this.effects.burst(moverX(p), moverY(p), SPARK_COLOR, 30, 220, 300);
			game.viewport.shake(8, 350);
			// knocked out: X eyes, floating up as it fades away
			new Tween(this.ko)
				.to({ alpha: 0, rise: KO_RISE }, { duration: KO_TIME * 1000 })
				.start();
		}
		aberrationBurst(fell ? 4 : 9);
	}

	/** drop into the void: `falling` tweens from 1 down to 0, then it is gone */
	private fall(m: Player | Enemy) {
		m.falling = 1;
		new Tween(m)
			.to({ falling: 0 }, { duration: FALL_TIME * 1000 })
			.easing(Tween.Easing.Quadratic.In)
			.onComplete(() => {
				m.falling = -1;
			})
			.start();
	}

	// --- sparks, power-ups, hits -------------------------------------------

	private updateSparks(dt: number) {
		const step = SPARK_SPEED * TILE * dt;
		this.sparks = this.sparks.filter((s) => {
			const at = s.at;
			at.x += DX[s.dir] * step;
			at.y += DY[s.dir] * step;
			const cell = cellUnder(at.x, at.y);
			let hit =
				!inBounds(cell.x, cell.y) ||
				this.station.tiles[idx(cell.x, cell.y)] === Tile.WALL;
			if (hit) {
				this.effects.burst(at.x, at.y, SPARK_COLOR, 5, 80);
			} else {
				const e = this.monsters.list.find(
					(e) =>
						isActive(e) &&
						Math.hypot(enemyX(e) - at.x, enemyY(e) - at.y) < TILE * SPARK_REACH,
				);
				if (e) {
					this.popEnemy(e);
					hit = true;
				}
			}
			if (hit) {
				this.effects.stop(s.trail);
			}
			return !hit;
		});
	}

	/** a monster zapped, or run into under a shield: it pops */
	private popEnemy(e: Enemy) {
		this.monsters.remove(e);
		this.addScore(ENEMY_SCORE[e.kind]);
		sfx.sfxPop();
		const color = GLOW[e.kind];
		this.effects.burst(enemyX(e), enemyY(e), color, 22, 200, 260);
		this.host.space?.burst(color, 0.35);
	}

	/** Bolt picked up a power-up on a cell */
	private collect(kind: PowerKind, at: Cell) {
		this.cheer = CHEER_TIME;
		sfx.sfxPickup();
		this.host.space?.burst(POWER_COLORS[kind], 0.6);
		this.effects.burst(
			centreX(at.x),
			centreY(at.y) - 6,
			POWER_COLORS[kind],
			16,
			160,
		);
		switch (kind) {
			case "gem":
				this.addScore(GEM_POINTS);
				break;
			case "life":
				this.lives = Math.min(MAX_LIVES, this.lives + 1);
				break;
			case "field":
				this.raiseFields();
				break;
			default:
				this.powers.start(kind);
				break;
		}
	}

	/**
	 * A force-field on every open cell around Bolt that no monster is on:
	 * monsters cannot go through it, so their plans go round. Bolt can.
	 */
	private raiseFields() {
		const at = nearestCell(this.player);
		const taken = new Set(this.monsters.cells().map((c) => idx(c.x, c.y)));
		const cells: Cell[] = [];
		for (let dy = -1; dy <= 1; dy++) {
			for (let dx = -1; dx <= 1; dx++) {
				const x = at.x + dx;
				const y = at.y + dy;
				if (
					(dx !== 0 || dy !== 0) &&
					isSolidGround(this.station.ground(x, y)) &&
					!taken.has(idx(x, y))
				) {
					cells.push({ x, y });
				}
			}
		}
		this.nav.raiseFields(cells, POWER_TIME.field);
	}

	/** Bolt picks up power-ups, and meets monsters */
	private checkHits() {
		if (this.phase !== "play") {
			return;
		}
		const p = this.player;
		const px = moverX(p);
		const py = moverY(p);
		const pw = this.powers.pickUp(px, py);
		if (pw) {
			this.collect(pw.kind, pw);
		}
		for (const e of [...this.monsters.list]) {
			if (
				!isActive(e) ||
				Math.hypot(enemyX(e) - px, enemyY(e) - py) >= TILE * CATCH_REACH
			) {
				continue;
			}
			if (this.powers.active("shield")) {
				this.popEnemy(e);
			} else if (p.invuln <= 0) {
				this.killPlayer(false);
				return;
			}
		}
	}

	// ---------------------------------------------------------------------
	// draw
	// ---------------------------------------------------------------------

	override draw(r: Renderer) {
		// the station (the Tiled layers) and the sky are drawn under this,
		// the characters' sprites over it
		if (!this.station.layers) {
			return;
		}
		this.hud.drawTimers(r, [
			["burst", this.powers.timeLeft("burst")],
			["shield", this.powers.timeLeft("shield")],
			["freeze", this.powers.timeLeft("freeze")],
			["field", this.nav.fieldTimeLeft],
		]);
		this.nav.drawFields(r, this.time);
		if (this.nav.showingRoutes) {
			this.monsters.drawGoals(r, this.time);
		}
		this.powers.draw(r, this.time);
		// a soft glow under each character
		this.monsters.drawGlows(r);
		if (this.bolt && this.bolt.alpha > 0) {
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
		if (!this.station.layers) {
			return;
		}
		for (const s of this.sparks) {
			drawGlow(r, s.at.x, s.at.y, 16, SPARK_COLOR, 1);
			r.setColor("#ffffff");
			r.fillEllipse(s.at.x, s.at.y, 5, 5);
		}
		this.hud.drawPanel(
			r,
			state.isPaused() ? 1 : this.overlay,
			this.level.theme.lit,
		);
	}

	/** put each character's sprite where it is, playing what it is doing */
	private placeActors() {
		this.placeBolt();
		this.monsters.place(this.powers.active("freeze"));
	}

	private placeBolt() {
		const p = this.player;
		const sprite = this.bolt;
		if (!sprite) {
			this.shieldRing.alpha = 0;
			return;
		}
		let shield = false;
		if (!this.station.layers) {
			sprite.alpha = 0;
		} else {
			const x = moverX(p);
			const y = moverY(p);
			if (this.phase === "dying") {
				sprite.play("bolt-ko");
				if (p.falling > 0) {
					// tumbling down into space
					placeFalling(sprite, x, y, p.falling);
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
				// blinking while it cannot be hurt
				const blink = p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0;
				sprite.play(
					this.cheer > 0
						? "bolt-cheer"
						: boltAnimation(p.moving && !p.forced, p.facing),
				);
				sprite.place(x, y, 1, blink ? 0.35 : 1);
				shield = this.powers.active("shield");
			}
		}
		this.shieldRing.place(sprite.pos.x, sprite.pos.y, 1, shield ? 1 : 0);
	}
}
