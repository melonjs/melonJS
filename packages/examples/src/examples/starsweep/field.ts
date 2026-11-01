/**
 * melonJS — Starsweep: the playing field.
 *
 * One `Renderable` owns the whole round: the deck, Bolt, the monsters,
 * sparks, power-ups and particles. Its `update` runs the game and its
 * `draw` paints it. Movement is tile-to-tile: an actor
 * is always between a `from` tile and a `to` tile, with `t` going 0 → 1.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { game, Renderable, save, Text } from "melonjs";
import {
	arrowDir,
	COLS,
	type Dir,
	DX,
	DY,
	forcedDir,
	inBounds,
	isPaintable,
	isSolidGround,
	opposite,
	parseMap,
	ROWS,
	Tile,
} from "./board";
import { drawBolt, drawMonster } from "./characters";
import type { Controls } from "./controls";
import {
	drawChevron,
	drawCracks,
	drawGlow,
	drawIceSheen,
	drawNest,
	drawPanelDetail,
	drawPlanet,
	drawPower,
	drawSky,
	drawSlab,
	drawWall,
	FONT,
	makeStars,
	POWER_COLORS,
	type PowerKind,
	type Renderer,
	type Star,
	TILE,
} from "./draw";
import { aberrationBurst, type NebulaBackdrop } from "./fx";
import { type EnemyKind, LEVELS, type LevelDef } from "./levels";
import * as sfx from "./sfx";

// portrait, 9:16, so it fills a phone held upright
export const WIDTH = 576;
export const HEIGHT = 1024;
const OX = (WIDTH - COLS * TILE) / 2;
const OY = 118;
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
type TimedPower = "freeze" | "shield" | "burst";
const POWER_TIME: Record<TimedPower, number> = {
	freeze: 5,
	shield: 7,
	burst: 9,
};
const ENEMY_SPEED: Record<EnemyKind, number> = {
	wobbler: 3.1,
	muncher: 2.7,
	chaser: 3.3,
};
const ENEMY_SCORE: Record<EnemyKind, number> = {
	wobbler: 100,
	muncher: 150,
	chaser: 200,
};

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
	seed: number;
}

interface Spark {
	x: number;
	y: number;
	dir: Dir;
}

interface Power {
	x: number;
	y: number;
	kind: PowerKind;
	life: number;
}

interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	max: number;
	size: number;
	color: string;
}

type Phase = "intro" | "play" | "dying" | "clear" | "gameover" | "victory";

const tileX = (x: number) => OX + x * TILE;
const tileY = (y: number) => OY + y * TILE;
const moverX = (m: Mover) => tileX(m.fx + (m.tx - m.fx) * m.t) + TILE / 2;
const moverY = (m: Mover) => tileY(m.fy + (m.ty - m.fy) * m.t) + TILE / 2 - 4;
const idx = (x: number, y: number) => y * COLS + x;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(list: readonly T[]) =>
	list[Math.floor(Math.random() * list.length)];

export class Field extends Renderable {
	/** called when the run ends and the player confirms */
	onExit: () => void = () => {};

	private controls: Controls;
	private stars: Star[];
	/** the shader sky behind the board, when the renderer can run it */
	sky: NebulaBackdrop | null = null;
	private time = 0;

	private levelIndex = 0;
	private level!: LevelDef;
	private tiles: Tile[] = [];
	private lit: boolean[] = [];
	private litAt: number[] = [];
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
	private particles: Particle[] = [];

	private phase: Phase = "intro";
	private phaseTime = 0;
	private paused = false;
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
	private chase: Int16Array = new Int16Array(COLS * ROWS);
	private chaseTimer = 0;
	private bonus = 0;
	/** > 0 while Bolt is pleased with itself */
	private cheer = 0;

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

	constructor(controls: Controls) {
		super(0, 0, WIDTH, HEIGHT);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
		this.controls = controls;
		this.stars = makeStars(120, WIDTH, HEIGHT);
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

	private loadLevel(i: number) {
		this.levelIndex = i;
		this.level = LEVELS[i];
		this.sky?.setLevelTheme(this.level.theme);
		const parsed = parseMap(this.level.map);
		this.tiles = parsed.tiles;
		this.start = parsed.start;
		this.nests = parsed.nests;
		const n = COLS * ROWS;
		this.lit = new Array(n).fill(false);
		this.litAt = new Array(n).fill(-10);
		this.crumble = new Array(n).fill(0);
		this.gone = new Array(n).fill(0);
		this.paintTotal = this.tiles.filter(isPaintable).length;
		this.paintCount = 0;
		this.powers = [];
		this.levelTime = 0;
		this.spawnCount = 0;
		this.powerTimer = rand(...POWER_EVERY);
		this.freeze = this.shield = this.burst = 0;
		this.levelText.setText(
			`${i + 1} / ${LEVELS.length}  ·  ${this.level.name.toUpperCase()}`,
		);
		this.resetActors();
		this.paint(this.start.x, this.start.y, true);
		this.setPhase("intro");
		this.showMessage(this.level.name, this.level.hint);
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
		this.sparks = [];
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

	private showMessage(big: string, sub = "") {
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
		this.litAt[i] = this.time;
		this.paintCount++;
		if (!silent) {
			this.addScore(10);
			sfx.sfxPaint(this.streak);
			this.streak++;
			this.streakTimer = 0.5;
			this.burstAt(
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
		this.paintCount--;
		sfx.sfxUnpaint();
		this.burstAt(tileX(x) + TILE / 2, tileY(y) + TILE / 2, "#3a3a66", 4, 50);
	}

	// ---------------------------------------------------------------------
	// update
	// ---------------------------------------------------------------------

	override update(dtMs: number) {
		const dt = Math.min(dtMs / 1000, 1 / 20);
		this.controls.poll();

		if (this.controls.pause() && (this.phase === "play" || this.paused)) {
			this.paused = !this.paused;
			this.showMessage(
				this.paused ? "Paused" : "",
				this.paused ? "Press P or Esc to resume" : "",
			);
		}
		if (this.paused) {
			this.updateHud();
			return true;
		}

		this.time += dt;
		this.phaseTime += dt;
		this.updateParticles(dt);
		this.updateCracks(dt);

		switch (this.phase) {
			case "intro":
				if (
					this.phaseTime > 2.2 ||
					(this.phaseTime > 0.4 && this.controls.confirm())
				) {
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
				this.checkHits();
				break;
			case "dying":
				this.updateFall(dt);
				if (this.phaseTime > 1.6) {
					if (this.lives <= 0) {
						this.setPhase("gameover");
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
						this.loadLevel(this.levelIndex + 1);
					} else {
						this.setPhase("victory");
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
		return true;
	}

	private levelCleared() {
		this.setPhase("clear");
		sfx.sfxClear();
		this.bonus = Math.max(0, Math.round(this.level.par - this.levelTime)) * 25;
		this.addScore(this.bonus);
		// every enemy pops in celebration
		for (const e of this.enemies) {
			this.burstAt(moverX(e), moverY(e), "#ffffff", 14, 160);
		}
		this.enemies = [];
		this.sparks = [];
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
		// fade the big message on the clear screen so the board shows through
		if (this.phase === "intro" && this.phaseTime > 1.8) {
			const a = Math.max(0, 1 - (this.phaseTime - 1.8) / 0.4);
			this.bigText.alpha = a;
			this.subText.alpha = a;
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
					sfx.sfxCrumble();
					this.burstAt(
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
				}
			}
		}
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
			this.sparks.push({ x: moverX(p), y: moverY(p), dir: d });
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
			p.falling = 1;
			sfx.sfxFall();
		} else {
			sfx.sfxDie();
			this.burstAt(moverX(p), moverY(p), "#fff2a8", 30, 220, 300);
			game.viewport.shake(8, 350);
		}
		aberrationBurst(fell ? 4 : 9);
	}

	private updateFall(dt: number) {
		const p = this.player;
		if (p.falling > 0) {
			p.falling = Math.max(0, p.falling - dt * 1.2);
		}
		for (const e of this.enemies) {
			if (e.falling > 0) {
				e.falling = Math.max(0, e.falling - dt * 1.2);
				if (e.falling === 0) {
					e.falling = -1;
				}
			}
		}
		this.enemies = this.enemies.filter((e) => e.falling !== -1);
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

		this.chaseTimer -= dt;
		if (this.chaseTimer <= 0) {
			this.chaseTimer = 0.25;
			this.buildChaseMap();
		}

		for (const e of this.enemies) {
			if (e.falling > 0) {
				e.falling = Math.max(0, e.falling - dt * 1.2);
				if (e.falling === 0) {
					e.falling = -1; // gone
				}
				continue;
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
			let time = dt;
			const speed = e.speed * (1 + this.levelIndex * 0.03);
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
		this.enemies.push({
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
			seed: Math.random() * 10,
		});
		sfx.sfxSpawn();
	}

	private enemyCanEnter(x: number, y: number) {
		const i = idx(x, y);
		// enemies keep off a tile that is about to crumble
		return isSolidGround(this.ground(x, y)) && this.crumble[i] <= 0;
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
		if (e.kind === "chaser" && Math.random() > 0.15) {
			d = choices.reduce((best, c) =>
				this.chase[idx(e.tx + DX[c], e.ty + DY[c])] <
				this.chase[idx(e.tx + DX[best], e.ty + DY[best])]
					? c
					: best,
			);
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
		e.falling = 1;
		e.moving = false;
		e.fx = e.tx = e.t < 0.5 ? e.fx : e.tx;
		e.fy = e.ty = e.t < 0.5 ? e.fy : e.ty;
		e.t = 0;
		this.addScore(ENEMY_SCORE[e.kind] * 2);
		sfx.sfxFall();
	}

	/** breadth-first distance from Bolt to every tile, for the hunters */
	private buildChaseMap() {
		this.chase.fill(32767);
		const p = this.player;
		const sx = p.t < 0.5 ? p.fx : p.tx;
		const sy = p.t < 0.5 ? p.fy : p.ty;
		if (!inBounds(sx, sy)) {
			return;
		}
		const queue = [idx(sx, sy)];
		this.chase[queue[0]] = 0;
		for (let q = 0; q < queue.length; q++) {
			const i = queue[q];
			const x = i % COLS;
			const y = (i - x) / COLS;
			for (let d = 0; d < 4; d++) {
				const nx = x + DX[d];
				const ny = y + DY[d];
				if (!inBounds(nx, ny) || !isSolidGround(this.ground(nx, ny))) {
					continue;
				}
				const n = idx(nx, ny);
				if (this.chase[n] > this.chase[i] + 1) {
					this.chase[n] = this.chase[i] + 1;
					queue.push(n);
				}
			}
		}
	}

	// --- sparks, power-ups, hits -------------------------------------------

	private updateSparks(dt: number) {
		const step = SPARK_SPEED * TILE * dt;
		this.sparks = this.sparks.filter((s) => {
			s.x += DX[s.dir] * step;
			s.y += DY[s.dir] * step;
			this.particles.push({
				x: s.x,
				y: s.y,
				vx: 0,
				vy: 0,
				life: 0.15,
				max: 0.15,
				size: 4,
				color: "#fff2a8",
			});
			const gx = Math.floor((s.x - OX) / TILE);
			const gy = Math.floor((s.y + 4 - OY) / TILE);
			if (!inBounds(gx, gy) || this.tiles[idx(gx, gy)] === Tile.WALL) {
				this.burstAt(s.x, s.y, "#fff2a8", 5, 80);
				return false;
			}
			for (const e of this.enemies) {
				if (e.spawning > 0 || e.falling !== 0) {
					continue;
				}
				if (Math.hypot(moverX(e) - s.x, moverY(e) - s.y) < TILE * 0.55) {
					this.popEnemy(e);
					return false;
				}
			}
			return true;
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
		this.burstAt(moverX(e), moverY(e), color, 22, 200, 260);
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
					(t === Tile.FLOOR || t === Tile.ICE) &&
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
		const roll = Math.random();
		let kind: PowerKind;
		if (roll < 0.08 && this.lives < MAX_LIVES) {
			kind = "life";
		} else if (roll < 0.35) {
			kind = "gem";
		} else if (roll < 0.55) {
			kind = "freeze";
		} else if (roll < 0.78) {
			kind = "shield";
		} else {
			kind = "burst";
		}
		this.powers.push({ ...pick(spots), kind, life: POWER_LIFE });
	}

	private collect(pw: Power) {
		this.cheer = 0.8;
		sfx.sfxPickup();
		this.burstAt(
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
			if (Math.hypot(moverX(e) - px, moverY(e) - py) < TILE * 0.62) {
				if (this.shield > 0) {
					this.popEnemy(e);
				} else if (p.invuln <= 0) {
					this.killPlayer(false);
					return;
				}
			}
		}
	}

	// --- particles ------------------------------------------------------------

	private burstAt(
		x: number,
		y: number,
		color: string,
		count: number,
		speed: number,
		life = 220,
	) {
		for (let i = 0; i < count; i++) {
			const a = Math.random() * Math.PI * 2;
			const v = speed * (0.3 + Math.random() * 0.7);
			const l = (life / 1000) * (0.6 + Math.random() * 0.6);
			this.particles.push({
				x,
				y,
				vx: Math.cos(a) * v,
				vy: Math.sin(a) * v,
				life: l,
				max: l,
				size: 2 + Math.random() * 3,
				color,
			});
		}
	}

	private updateParticles(dt: number) {
		for (const pt of this.particles) {
			pt.life -= dt;
			pt.x += pt.vx * dt;
			pt.y += pt.vy * dt;
			pt.vx *= 0.92;
			pt.vy *= 0.92;
		}
		this.particles = this.particles.filter((pt) => pt.life > 0);
	}

	// ---------------------------------------------------------------------
	// draw
	// ---------------------------------------------------------------------

	override draw(r: Renderer) {
		const theme = this.level.theme;
		if (this.sky) {
			drawPlanet(r, WIDTH - 40, OY + 70, this.time, theme.litSide);
		} else {
			drawSky(
				r,
				theme.sky,
				this.stars,
				WIDTH,
				HEIGHT,
				this.time,
				theme.litSide,
			);
		}
		this.drawTopBar(r);

		for (let y = 0; y < ROWS; y++) {
			for (let x = 0; x < COLS; x++) {
				this.drawTile(r, x, y);
			}
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

		for (const e of this.enemies) {
			this.drawEnemy(r, e);
		}

		this.drawPlayer(r);

		for (const s of this.sparks) {
			drawGlow(r, s.x, s.y, 16, "#fff2a8", 1);
			r.setColor("#ffffff");
			r.fillEllipse(s.x, s.y, 5, 5);
		}

		r.setBlendMode("additive");
		for (const pt of this.particles) {
			r.setGlobalAlpha(pt.life / pt.max);
			r.setColor(pt.color);
			r.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
		}
		r.setGlobalAlpha(1);
		r.setBlendMode("normal");

		if (
			this.phase === "intro" ||
			this.phase === "clear" ||
			this.phase === "gameover" ||
			this.phase === "victory" ||
			this.paused
		) {
			const a =
				this.phase === "intro"
					? Math.max(0, 1 - Math.max(0, this.phaseTime - 1.8) / 0.4)
					: 1;
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
		// lives as small Bolts
		for (let i = 0; i < Math.min(this.lives, MAX_LIVES); i++) {
			drawBolt(r, OX + 14 + i * 30, 96, 2, this.time + i, { scale: 0.5 });
		}
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

	private drawTile(r: Renderer, x: number, y: number) {
		const i = idx(x, y);
		const t = this.tiles[i];
		const px = tileX(x);
		const py = tileY(y);
		if (t === Tile.VOID) {
			return;
		}
		if (t === Tile.WALL) {
			drawWall(r, px, py, this.level.theme.wall, this.level.theme.wallSide);
			return;
		}

		let scale = 1;
		let alpha = 1;
		let shakeX = 0;
		if (t === Tile.CRACK) {
			if (this.gone[i] > 0) {
				// grows back over the last 0.6 s
				const grow = 1 - this.gone[i] / 0.6;
				if (grow <= 0) {
					return;
				}
				scale = grow;
				alpha = grow;
			} else if (this.crumble[i] > 0) {
				shakeX = Math.sin(this.time * 80) * 2;
			}
		}

		const theme = this.level.theme;
		const lit = this.lit[i];
		const ice = t === Tile.ICE;
		const face = lit ? theme.lit : ice ? "#8fc4ec" : "#2b3052";
		const side = lit ? theme.litSide : ice ? "#3f6f99" : "#161a32";
		r.setGlobalAlpha(alpha);
		drawSlab(r, px + shakeX, py, face, side, scale);
		if (scale < 1) {
			r.setGlobalAlpha(1);
			return;
		}
		if (!ice) {
			drawPanelDetail(r, px + shakeX, py, lit);
		}
		if (lit) {
			r.setGlobalAlpha(0.45);
			r.setColor(theme.litHi);
			r.fillRoundRect(px + 7 + shakeX, py + 6, TILE - 14, 5, 3);
			r.setGlobalAlpha(1);
			// flash when it lights
			const since = this.time - this.litAt[i];
			if (since < 0.35) {
				r.setBlendMode("additive");
				r.setGlobalAlpha(1 - since / 0.35);
				r.setColor("#ffffff");
				r.fillRoundRect(px + 2, py + 2, TILE - 4, TILE - 10, 6);
				r.setGlobalAlpha(1);
				r.setBlendMode("normal");
			}
		}
		if (ice) {
			drawIceSheen(r, px, py);
		}
		const arrow = arrowDir(t);
		if (arrow !== -1) {
			drawChevron(
				r,
				px + TILE / 2,
				py + TILE / 2 - 4,
				arrow,
				lit ? "#ffffff" : "#ffd23d",
				this.time,
			);
		}
		if (t === Tile.CRACK) {
			drawCracks(r, px + shakeX, py);
		}
		if (t === Tile.NEST) {
			drawNest(r, px + TILE / 2, py + TILE / 2, this.time);
		}
		r.setGlobalAlpha(1);
	}

	private drawPlayer(r: Renderer) {
		const p = this.player;
		const x = moverX(p);
		const y = moverY(p);
		if (this.phase === "dying") {
			if (p.falling > 0) {
				// tumbling down into space
				drawBolt(r, x, y + (1 - p.falling) * 20, p.facing, this.time, {
					scale: p.falling,
					alpha: p.falling,
					mood: "ko",
				});
			} else {
				// knocked out: X eyes, then fades away
				const fade = Math.max(0, 1 - this.phaseTime / 1.3);
				drawBolt(r, x, y - this.phaseTime * 12, 2, this.time, {
					alpha: fade,
					mood: "ko",
				});
			}
			return;
		}
		if (this.phase === "clear") {
			// a little victory hop
			const hop = Math.abs(Math.sin(this.phaseTime * 8)) * 10;
			drawBolt(r, x, y - hop, 2, this.time, { mood: "happy" });
			return;
		}
		const blink = p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0;
		drawBolt(r, x, y, p.facing, this.time, {
			walking: p.moving && !p.forced,
			alpha: blink ? 0.35 : 1,
			shield: this.shield > 0,
			mood: this.cheer > 0 ? "happy" : "normal",
		});
	}

	private drawEnemy(r: Renderer, e: Enemy) {
		const x = moverX(e);
		const y = moverY(e);
		if (e.falling > 0) {
			drawMonster(
				r,
				e.kind,
				x,
				y + (1 - e.falling) * 20,
				e.dir,
				this.time,
				e.seed,
				{
					scale: e.falling,
					alpha: e.falling,
					walking: false,
				},
			);
			return;
		}
		if (e.spawning > 0) {
			const grow = 1 - e.spawning;
			drawMonster(r, e.kind, x, y, -1, this.time, e.seed, {
				scale: 0.2 + grow * 0.8,
				alpha: grow * 0.8,
				walking: false,
			});
			return;
		}
		drawMonster(r, e.kind, x, y, e.dir, this.time, e.seed, {
			frozen: this.freeze > 0,
			walking: this.freeze <= 0,
		});
	}
}
