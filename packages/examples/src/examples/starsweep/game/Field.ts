/**
 * melonJS — Starsweep: the playing field, a run of levels.
 *
 * The field holds the rules of a run: it loads each level, goes from one
 * phase to the next (a level's intro, play, a lost life, a cleared level,
 * the end), and tells the `Score` what each thing is worth. Everything on
 * the board is an entity of its own (in `entities/`) that moves, touches
 * others and shows itself; the field is told what happened through the
 * `world` each one is given (Bolt landed on a panel, a monster popped, a
 * power-up was picked up, a life was lost) and decides what that is worth.
 *
 * It steps Bolt, the monsters, the sparks and the power-ups itself, in a
 * fixed order each frame, and draws what lies under the characters: the
 * force-fields, the wobblers' goals, the glows and the power-up timers.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { type Container, event, Renderable, state, Tween } from "melonjs";
import * as sfx from "../audio/sfx";
import { HEIGHT, WIDTH } from "../config/layout";
import type { Bolt, BoltPose } from "../entities/Bolt";
import type { PowerKind } from "../entities/PowerUp";
import type { DeepSpace } from "../fx/DeepSpace";
import type { Effects } from "../fx/Effects";
import type { NebulaBackdrop } from "../fx/NebulaBackdrop";
import type { SpaceBackdrop } from "../fx/SpaceBackdrop";
import type { Controls } from "../input/Controls";
import type { Cell } from "../rules/board";
import { LEVEL_FILES, type LevelDef } from "../rules/levels";
import { Hud } from "../ui/Hud";
import type { Renderer } from "../utils/draw";
import { Navigation } from "../world/Navigation";
import { type Board, Station } from "../world/Station";
import { FieldFront } from "./FieldFront";
import { Monsters } from "./Monsters";
import { POWER_TIME, Powers } from "./Powers";
import { Score } from "./Score";
import { Sparks } from "./Sparks";

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
	/** the message panel, drawn over the characters */
	readonly front: Renderable;
	/** the labels and the progress bar, for the screen to add */
	readonly hudItems: Renderable[];

	private readonly host: FieldHost;
	private readonly controls: Controls;
	private readonly station: Station;
	private readonly nav: Navigation;
	/** Bolt, built by each level from its map; none until the first loads */
	private bolt: Bolt | null = null;
	private readonly monsters: Monsters;
	private readonly powers: Powers;
	private readonly sparks: Sparks;
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
	private readonly score = new Score();

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
		this.nav = new Navigation(host.actors);
		this.station = new Station(
			{
				crumbled: (cell) => this.crumbled(cell),
				regrown: (cell) => this.nav.refreshCell(cell),
				gatesOpened: (cells) => {
					for (const cell of cells) {
						this.nav.refreshCell(cell);
					}
				},
			},
			host.effects,
			host.space,
		);
		this.monsters = new Monsters(
			{
				station: this.station,
				nav: this.nav,
				effects: host.effects,
				space: host.space,
				bolt: () => this.bolt as Bolt,
				fell: (m) => this.score.fell(m.score),
				popped: (m) => this.score.popped(m.score),
				munched: (cell) => this.station.unpaint(cell.x, cell.y),
			},
			host.actors,
		);
		this.powers = new Powers(host.actors, host.effects, host.space);
		this.sparks = new Sparks(this.station, host.effects, host.actors);
		this.hud = new Hud(host.actors);
		this.hudItems = this.hud.items;
		this.front = new FieldFront(this);
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
		this.score.newRun();
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
		this.score.newLevel();
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
	 * place of the last level's, and is told how the game around it goes.
	 */
	private takeBolt(bolt: Bolt) {
		this.bolt?.leave();
		this.bolt = bolt;
		bolt.join({
			station: this.station,
			nav: this.nav,
			controls: this.controls,
			effects: this.host.effects,
			actors: this.host.actors,
			playing: () => this.phase === "play",
			shielded: () => this.powers.active("shield"),
			landed: (cell) => this.painted(cell),
			lost: () => this.lifeLost(),
			collected: (kind) => this.collected(kind),
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
		this.bolt?.reset(this.station.start, invuln);
		this.monsters.reset();
		this.sparks.clear();
		this.controls.reset();
	}

	private setPhase(phase: Phase) {
		this.phase = phase;
		this.phaseTime = 0;
		// a press from an earlier moment must not skip this one
		this.controls.reset();
	}

	/** a life lost: game over, or Bolt back at the start */
	private afterDying() {
		if (this.score.out) {
			sfx.sfxGameOver();
			this.endRun("gameover", "Game Over", `Score ${this.score.points}`);
			return;
		}
		this.resetActors(INVULN_TIME);
		this.setPhase("play");
	}

	/** every panel is lit: a time bonus, fireworks, and the monsters go */
	private levelCleared() {
		this.setPhase("clear");
		sfx.sfxClear();
		const bonus = this.score.levelBonus(this.level.par);
		this.host.space?.celebrate(this.level.theme.lit, this.level.theme.litHi);
		this.monsters.celebrate();
		this.nav.showRoutes(null);
		this.sparks.clear();
		this.overlay = 1;
		this.hud.show("Level clear!", bonus > 0 ? `Time bonus +${bonus}` : "");
	}

	/** a level cleared: the next one, or the run is won */
	private afterClear() {
		if (this.levelIndex + 1 < this.levels.length) {
			void this.loadLevel(this.levelIndex + 1);
			return;
		}
		this.endRun(
			"victory",
			"Station saved!",
			`Final score ${this.score.points}`,
		);
	}

	/** the end of the run: a message, and any key or tap goes back */
	private endRun(phase: "gameover" | "victory", big: string, sub: string) {
		this.setPhase(phase);
		this.overlay = 1;
		const go = this.controls.onScreen ? "tap to go on" : "click or press Enter";
		this.hud.show(big, `${sub}  ·  ${go}`);
	}

	// ---------------------------------------------------------------------
	// what things are worth
	// ---------------------------------------------------------------------

	/** Bolt landed on a panel: lit, it scores and keeps the streak going */
	private painted(cell: Cell) {
		if (!this.station.light(cell, this.score.streak)) {
			return;
		}
		this.score.panelLit();
		if (this.station.cleared && this.phase === "play") {
			this.levelCleared();
		}
	}

	/** Bolt was caught, or fell */
	private lifeLost() {
		this.score.loseLife();
		this.setPhase("dying");
	}

	/** a cracked panel gave way: whoever stands on it falls */
	private crumbled(cell: Cell) {
		this.nav.refreshCell(cell);
		const at = this.bolt?.cell;
		if (at?.x === cell.x && at.y === cell.y) {
			this.bolt?.fall();
		}
		this.monsters.dropOn(cell);
	}

	/** what a power-up Bolt picked up does */
	private collected(kind: PowerKind) {
		switch (kind) {
			case "gem":
				this.score.gem();
				break;
			case "life":
				this.score.gainLife();
				break;
			case "field":
				this.nav.raiseFieldsAround(
					(this.bolt as Bolt).cell,
					this.station,
					this.monsters.cells(),
					POWER_TIME.field,
				);
				break;
			default:
				this.powers.start(kind);
				break;
		}
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
			this.score.points,
			this.score.best,
			this.station.progress,
			this.station.layers ? this.score.lives : 0,
			this.controls.onScreen,
		);
		this.placeActors();
		return true;
	}

	/**
	 * One step of play, everything in a fixed order. Who touches whom is
	 * found by the engine's collision detection, after this.
	 */
	private updatePlay(dt: number) {
		const bolt = this.bolt as Bolt;
		this.score.update(dt);
		bolt.step(dt, () => this.phase === "play");
		if (this.controls.fire()) {
			this.sparks.fire(
				bolt.x,
				bolt.y,
				bolt.facing,
				this.powers.active("burst"),
			);
		}
		this.monsters.update(dt, this.powers.active("freeze"));
		this.sparks.update(dt);
		this.powers.update(dt, this.station, bolt.cell, this.score.wantsLife);
		this.nav.update(dt);
		this.nav.showRoutes(this.monsters.routes());
	}

	// ---------------------------------------------------------------------
	// draw
	// ---------------------------------------------------------------------

	/** under the characters: the timers, force-fields, goals and glows */
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
