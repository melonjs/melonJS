/**
 * melonJS — Starsweep: the playing field.
 *
 * One `Renderable` runs a run of levels: it loads each level, counts the
 * score and lives, decides what happens when Bolt, the monsters, the
 * sparks and the power-ups meet, and goes from one phase to the next (a
 * level's intro, play, a lost life, a cleared level, the end). Each part
 * of the game is a class of its own, in this folder, which the field puts
 * together:
 * - `Station`, the board as it is played (the level's Tiled map);
 * - `Bolt` (in `entities/`), the robot the player moves, and `Sparks`,
 *   what it zaps;
 * - `Navigation`, where monsters can go, with the pathfinding plugin;
 * - `Monsters`, the monsters and how each kind moves;
 * - `Powers`, the power-ups; and `Hud` (in `ui/`), what is shown around the
 *   board.
 *
 * One-shot animations are `Tween`s, and pausing is the engine's
 * `state.pause()`.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { type Container, event, game, Renderable, state, Tween } from "melonjs";
import * as sfx from "../audio/sfx";
import { centreX, centreY, HEIGHT, TILE, WIDTH } from "../config/layout";
import { loadHiscore, saveHiscore } from "../data/score";
import { GLOW } from "../entities/Actor";
import type { Bolt, BoltPose } from "../entities/Bolt";
import type { Monster } from "../entities/Monster";
import { fallAway } from "../entities/movers";
import { POWER_COLORS, type PowerKind } from "../entities/PowerUp";
import { SPARK_COLOR } from "../entities/Spark";
import type { DeepSpace } from "../fx/DeepSpace";
import type { Effects } from "../fx/Effects";
import type { NebulaBackdrop } from "../fx/NebulaBackdrop";
import type { SpaceBackdrop } from "../fx/SpaceBackdrop";
import { aberrationBurst } from "../fx/screenFx";
import type { Controls } from "../input/Controls";
import { type Cell, idx, isSolidGround } from "../rules/board";
import { LEVEL_FILES, type LevelDef } from "../rules/levels";
import { Hud, MAX_LIVES } from "../ui/Hud";
import type { Renderer } from "../utils/draw";
import { Navigation } from "../world/Navigation";
import { type Board, Station } from "../world/Station";
import { FieldFront } from "./FieldFront";
import { Monsters } from "./Monsters";
import { POWER_TIME, Powers } from "./Powers";
import { Sparks } from "./Sparks";

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

/** points for a panel lit, a gem, and each second under par */
const PAINT_POINTS = 10;
const GEM_POINTS = 500;
const TIME_BONUS = 25;
/** a monster that falls off is worth this many times its score */
const FALL_BONUS = 2;
/** a streak of panels keeps going if the next comes within this, in seconds */
const STREAK_WINDOW = 0.5;

/** how close, as a share of a cell, a monster catches Bolt */
const CATCH_REACH = 0.62;

/** a gate's colour as it slides open, and the far-off burst it sets off */
const GATE_COLOR = "#ff3b5c";
const GATE_NOVA = "#ff5d7a";
/** the dust of a cracked panel */
const CRACK_COLOR = "#8a7a6a";

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
	/** the panel behind a message, drawn over the characters */
	readonly front: Renderable;
	/** the labels and the progress bar, for the screen to add */
	readonly hudItems: Renderable[];

	private readonly host: FieldHost;
	private readonly controls: Controls;
	private readonly effects: Effects;
	private readonly station: Station;
	private readonly nav: Navigation;
	/** Bolt, built by each level from its map; set by the first one */
	private bolt!: Bolt;
	private readonly sparks: Sparks;
	private readonly monsters: Monsters;
	private readonly powers: Powers;
	private readonly hud: Hud;

	private time = 0;
	private levelIndex = 0;
	private level!: LevelDef;

	private phase: Phase = "loading";
	private phaseTime = 0;
	/** the dimming and panel behind a message, 0 to 1 */
	private overlay = 0;
	private introFade: Tween | null = null;
	/** what was on screen when the game paused, put back on resume */
	private beforePause: { big: string; sub: string; alpha: number } | null =
		null;
	private score = 0;
	private hiscore = 0;
	private lives = START_LIVES;
	private levelTime = 0;
	private streak = 0;
	private streakTimer = 0;

	/**
	 * @param host - the screen's parts the field plays in
	 * @param levels - the levels, in play order (see `rules/levels.ts`)
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
				bolt: () => this.bolt,
				fell: (m) => {
					fallAway(m);
					this.addScore(m.score * FALL_BONUS);
					sfx.sfxFall();
				},
				munched: (cell) => this.unpaint(cell),
			},
			host.actors,
		);
		this.powers = new Powers(host.actors);
		this.sparks = new Sparks({
			station: this.station,
			effects: this.effects,
			actors: host.actors,
			monsters: () => this.monsters.list,
			hit: (m) => this.popEnemy(m),
		});
		this.hud = new Hud(host.actors);
		this.hudItems = this.hud.items;
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
		this.sparks.clear();
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
	 * The level built Bolt where its map's `Bolt` object is: it takes the
	 * place of the last level's.
	 */
	private takeBolt(bolt: Bolt) {
		this.bolt?.leave();
		this.bolt = bolt;
		bolt.join({
			station: this.station,
			nav: this.nav,
			controls: this.controls,
			actors: this.host.actors,
			landed: (cell) => this.paint(cell),
			fellOff: () => this.killPlayer(true),
		});
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

	/**
	 * Bolt back at the start, the monsters gone, for a level or a new life.
	 * @param invuln - seconds Bolt cannot be hurt for
	 */
	private resetActors(invuln = 0) {
		this.bolt.reset(this.station.start, invuln);
		this.monsters.reset();
		this.sparks.clear();
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
		this.effects.burst(this.bolt.x, this.bolt.y, this.level.theme.lit, 6, 90);
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
		const on = (at: Cell) => at.x === cell.x && at.y === cell.y;
		if (this.phase === "play" && on(this.bolt.cell)) {
			this.killPlayer(true);
		}
		for (const m of this.monsters.list) {
			if (!m.flies && m.isLoose && on(m.cell)) {
				m.drop();
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
		this.streakTimer -= dt;
		if (this.streakTimer <= 0) {
			this.streak = 0;
		}
		this.bolt.step(dt, () => this.phase === "play");
		if (this.controls.fire()) {
			const p = this.bolt;
			this.sparks.fire(p.x, p.y, p.facing, this.powers.active("burst"));
		}
		this.monsters.update(dt, this.powers.active("freeze"));
		this.sparks.update(dt);
		this.powers.update(
			dt,
			this.station,
			this.bolt.cell,
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
		this.resetActors(INVULN_TIME);
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
		for (const m of this.monsters.list) {
			this.effects.burst(m.x, m.y, "#ffffff", 14, 160);
		}
		this.monsters.reset();
		this.nav.showRoutes(null);
		this.sparks.clear();
		this.overlay = 1;
		this.hud.show("Level clear!", bonus > 0 ? `Time bonus +${bonus}` : "");
	}

	// ---------------------------------------------------------------------
	// Bolt meets things
	// ---------------------------------------------------------------------

	/** Bolt caught by a monster, or fallen off into space */
	private killPlayer(fell: boolean) {
		if (this.phase !== "play") {
			return;
		}
		this.lives--;
		this.setPhase("dying");
		this.streak = 0;
		if (fell) {
			this.bolt.fall();
			sfx.sfxFall();
		} else {
			sfx.sfxDie();
			this.effects.burst(this.bolt.x, this.bolt.y, SPARK_COLOR, 30, 220, 300);
			game.viewport.shake(8, 350);
			this.bolt.knockOut();
		}
		aberrationBurst(fell ? 4 : 9);
	}

	/** a monster zapped, or run into under a shield: it pops */
	private popEnemy(m: Monster) {
		this.monsters.remove(m);
		this.addScore(m.score);
		sfx.sfxPop();
		const color = GLOW[m.kind];
		this.effects.burst(m.x, m.y, color, 22, 200, 260);
		this.host.space?.burst(color, 0.35);
	}

	/** Bolt picked up a power-up on a cell */
	private collect(kind: PowerKind, at: Cell) {
		this.bolt.cheerUp();
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
		const at = this.bolt.cell;
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
		const { x, y } = this.bolt;
		const pw = this.powers.pickUp(x, y);
		if (pw) {
			this.collect(pw.kind, pw.cell);
		}
		for (const m of [...this.monsters.list]) {
			if (!m.isLoose || Math.hypot(m.x - x, m.y - y) >= TILE * CATCH_REACH) {
				continue;
			}
			if (this.powers.active("shield")) {
				this.popEnemy(m);
			} else if (this.bolt.canBeHurt) {
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
		// a soft glow under each character
		this.monsters.drawGlows(r);
		this.bolt?.drawGlow(r);
	}

	/** over the characters: the panel behind a message */
	drawFront(r: Renderer) {
		if (!this.station.layers) {
			return;
		}
		this.hud.drawPanel(
			r,
			state.isPaused() ? 1 : this.overlay,
			this.level.theme.lit,
		);
	}

	/** put each character's sprite where it is, playing what it is doing */
	private placeActors() {
		// no Bolt yet while the first level loads
		this.bolt?.pose(
			this.boltPose(),
			this.phaseTime,
			this.powers.active("shield"),
		);
		this.monsters.pose(this.powers.active("freeze"));
	}

	/** how Bolt is drawn, from the phase */
	private boltPose(): BoltPose {
		if (!this.station.layers) {
			return "hidden";
		}
		if (this.phase === "dying") {
			return "knocked-out";
		}
		return this.phase === "clear" ? "cheering" : "playing";
	}
}
