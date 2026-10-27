/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 *
 * The play field: a port of the original game loop (main.c, actor.c,
 * player.c, bullet.c and particle.c). It runs at the original fixed 50 ticks
 * per second in the original 160x120 pixel space, on top of the Tiled map
 * melonJS loads and draws; actors, bullets and particles are drawn here, in
 * the same order as the original game did.
 */
import {
	audio,
	input,
	level,
	Renderable,
	type Renderer,
	type TMXLayer,
	type TMXTileMap,
} from "melonjs";
import {
	MAP_ROWS,
	PALETTE,
	SCALE,
	SCREEN_W,
	TICK_MS,
	WIN_EXIT,
	WIN_KILL_ALL,
	WIN_KILL_GUARDIAN,
} from "../constants";
import { gameState } from "../gameState";
import { drawSprite, spriteSize } from "../gfx";
import type { Spawn } from "./spawns";
import {
	AC_BALL,
	AC_DEAD,
	AC_EAT,
	AC_FLAT,
	AC_FULL,
	AC_NORM,
	AC_SPIT,
	ACF_BOUNCEABLE,
	ACF_FLATABLE,
	ACF_HURTS,
	ACF_JUMPABLE,
	ACF_ROLLABLE,
	ACF_ROLLABLE_BACK,
	ACF_SHOOTABLE,
	Actor,
	type ActorType,
	type Bullet,
	bbCollision,
	type Particle,
	rand,
} from "./types";

const MAX_PARTICLES = 200;
const MAX_BULLETS = 64;

/** collision grid cell values */
const SOLID = 1;
const BREAKABLE = 2;

type Rect = { x: number; y: number; w: number; h: number };

export type FieldStatus = "playing" | "done" | "died";

export class PlayField extends Renderable {
	/** map size, in tiles */
	cols = 0;
	rows = MAP_ROWS;
	grid: Uint8Array = new Uint8Array(0);
	/** pickups, keyed by cell index */
	items = new Map<number, string>();
	spins = new Set<number>();
	/** 0 = none, 1 = water, 2 = water surface */
	water: Uint8Array = new Uint8Array(0);
	deadly: Rect[] = [];
	exits: Rect[] = [];
	lola: { x: number; y: number }[] = [];

	foreground: TMXLayer | undefined;

	alex: Actor;
	actors: Actor[] = [];
	bullets: Bullet[] = [];
	particles: Particle[] = [];

	// player data
	jumping = false;
	jumpPressed = false;
	eatPressed = false;
	eatCounter = 0;
	angle = 0;
	wounded = 0;
	pendingDy = 0;

	// map state
	win = WIN_EXIT;
	winFulfilled = 0;
	numEnemies = 0;
	offsetX = 0;
	gameCount = 0;
	status: FieldStatus = "playing";
	paused = false;
	private accumulator = 0;

	// camera state (static variables in the original)
	private camSide = [1, 1];
	private camStep = [0, 0];
	private camCount = [0, 0];

	/** called once when Alex dies, and when the death fall is over */
	onAlexDies: (() => void) | undefined;
	onDiedFallOver: (() => void) | undefined;
	onLevelDone: (() => void) | undefined;

	constructor(spawns: Spawn[]) {
		const map = level.getCurrentLevel() as unknown as {
			cols: number;
			win?: number;
		};
		super(0, 0, map.cols * 64, 480);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
		this.cols = map.cols;
		this.win = map.win ?? WIN_EXIT;
		this.alex = new Actor("alex", 0, 0);
		this.readMap(spawns);
	}

	// ----------------------------------------------------------------------
	// map setup
	// ----------------------------------------------------------------------

	/** build the collision grid and spawn everything placed on the map */
	private readMap(spawns: Spawn[]) {
		const cols = this.cols;
		this.grid = new Uint8Array(cols * this.rows);
		this.water = new Uint8Array(cols * this.rows);

		const layers = (level.getCurrentLevel() as TMXTileMap).getLayers();
		for (const l of layers) {
			if (l.name === "Foreground") {
				this.foreground = l as TMXLayer;
			}
			if (l.name === "Collision") {
				const coll = l as TMXLayer;
				for (let y = 0; y < this.rows; y++) {
					for (let x = 0; x < cols; x++) {
						const tile = coll.cellAt(x, y);
						if (tile) {
							const props = tile.tileset.getTileProperties(tile.tileId) as
								| { type?: string }
								| undefined;
							this.grid[y * cols + x] =
								props?.type === "breakable" ? BREAKABLE : SOLID;
						}
					}
				}
			}
		}

		gameState.cherriesTotal = 0;
		gameState.starsTotal = 0;
		gameState.cherries = 0;
		gameState.stars = 0;

		for (const s of spawns) {
			// objects are placed on the 64 pixel grid; actors stand on the
			// bottom of their box (the Alex4-WE guardian box is 2 tiles high)
			const tx = Math.round(s.x / 64);
			const ty = Math.round(s.y / 64);
			const by = Math.round((s.y + s.height) / 64) - 1;
			const ox = s.x / SCALE;
			const oy = s.y / SCALE;
			const w = s.width / SCALE;
			const h = s.height / SCALE;
			switch (s.name) {
				case "player": {
					this.alex.x = tx * 16;
					this.alex.y = by * 16 + 16;
					this.alex.direction = s.facing === "left" ? 0 : 1;
					break;
				}
				case "cherry":
				case "star":
				case "heart":
				case "oneup":
				case "egg":
					this.items.set(ty * cols + tx, s.name);
					if (s.name === "cherry") gameState.cherriesTotal++;
					if (s.name === "star") gameState.starsTotal++;
					break;
				case "lola":
					this.lola.push({ x: tx * 16, y: ty * 16 });
					break;
				case "spin":
					this.spins.add(ty * cols + tx);
					break;
				case "water":
					for (let i = 0; i < Math.round(w / 16); i++) {
						this.water[ty * cols + tx + i] = s.surface ? 2 : 1;
					}
					break;
				case "spike": {
					// Alex4-WE spikes only hurt on their pointy half
					const r = { x: ox, y: oy, w, h };
					switch (s.direction) {
						case "up":
							r.y += h / 2;
							r.h /= 2;
							break;
						case "down":
							r.h /= 2;
							break;
						case "left":
							r.x += w / 2;
							r.w /= 2;
							break;
						case "right":
							r.w /= 2;
							break;
					}
					this.deadly.push(r);
					break;
				}
				case "exit":
					this.exits.push({ x: ox, y: oy, w, h });
					break;
				case "enemy1":
				case "enemy2":
				case "crusher":
				case "spikefish":
				case "jellyfish":
				case "cannon":
				case "boss1":
				case "boss2": {
					const a = this.makeActor(s.name, tx * 16, by * 16 + 16);
					if (s.name === "enemy2" && s.width > 64) {
						// Alex4-WE patrol area, starting from its right end
						a.patrolStart = ox;
						a.patrolEnd = ox + w - 16;
						a.x = Math.round(a.patrolEnd);
					}
					break;
				}
			}
		}

		this.alex.frames = ["hero000", "hero001", "hero002", "hero003"];
		this.alex.status = gameState.ammo ? AC_FULL : AC_NORM;
		gameState.health = Math.max(gameState.health, 1);

		// initial camera position
		this.offsetX = this.clampOffset(
			this.alex.x - (this.alex.direction ? 60 : 85),
		);

		// let the actors settle on the ground before the first frame
		for (const a of this.actors) {
			this.updateActor(a);
		}
	}

	/** create an enemy, as the original `init_map` did */
	private makeActor(type: ActorType, x: number, y: number) {
		const a = new Actor(type, x, y);
		switch (type) {
			case "enemy1":
				a.frames = ["enemy1_01", "enemy1_02", "enemy1_03", "enemy1_04"];
				a.flatFrame = "enemy1_05";
				a.w = 12;
				a.h = 14;
				a.ox = 2;
				a.oy = 2;
				a.flags =
					ACF_JUMPABLE |
					ACF_FLATABLE |
					ACF_HURTS |
					ACF_SHOOTABLE |
					ACF_ROLLABLE;
				this.numEnemies++;
				break;
			case "enemy2":
				a.frames = ["enemy2_01", "enemy2_02", "enemy2_03", "enemy2_04"];
				a.flatFrame = "enemy2_05";
				a.w = 12;
				a.h = 19;
				a.ox = 2;
				a.oy = 5;
				a.flags =
					ACF_JUMPABLE |
					ACF_FLATABLE |
					ACF_HURTS |
					ACF_SHOOTABLE |
					ACF_ROLLABLE;
				this.numEnemies++;
				break;
			case "crusher":
				a.frames = ["enemy3"];
				a.w = 30;
				a.h = 16;
				a.ox = 1;
				a.oy = 112 - 16;
				a.flags = ACF_HURTS;
				break;
			case "spikefish":
				a.frames = ["enemy4"];
				a.w = 12;
				a.h = 14;
				a.ox = 2;
				a.oy = 2;
				a.flags = ACF_HURTS | ACF_SHOOTABLE | ACF_ROLLABLE;
				this.numEnemies++;
				break;
			case "jellyfish":
				a.frames = ["enemy5_01"];
				a.w = 12;
				a.h = 14;
				a.ox = 2;
				a.oy = 2;
				a.flags = ACF_JUMPABLE | ACF_HURTS | ACF_SHOOTABLE | ACF_ROLLABLE;
				this.numEnemies++;
				break;
			case "cannon":
				a.frames = [];
				a.flags = 0;
				break;
			case "boss1":
				a.energy = 100;
				a.frames = ["guard1_1", "guard1_2", "guard1_3", "guard1_4"];
				a.hitFrames = ["guard1_5", "guard1_6", "guard1_7", "guard1_8"];
				a.w = 32;
				a.h = 32;
				a.flags = ACF_HURTS | ACF_ROLLABLE_BACK;
				this.numEnemies++;
				break;
			case "boss2":
				a.energy = 150;
				a.frames = ["guard2_1a", "guard2_1b"];
				a.w = 32;
				a.h = 32;
				a.oy = 16;
				a.flags = ACF_HURTS | ACF_JUMPABLE | ACF_BOUNCEABLE;
				this.numEnemies++;
				break;
		}
		this.actors.push(a);
		return a;
	}

	// ----------------------------------------------------------------------
	// map queries
	// ----------------------------------------------------------------------

	/** true if there is ground at the given pixel (`is_ground`) */
	isGround(x: number, y: number) {
		const tx = x >> 4;
		const ty = y >> 4;
		if (tx < 0 || tx >= this.cols) return true;
		if (ty < 0 || ty >= this.rows) return false;
		return this.grid[ty * this.cols + tx] !== 0;
	}

	private adjustY(x: number, y: number, ground: boolean, dy: number) {
		const oy = y;
		if (ground) {
			while (this.isGround(x, y)) y += dy;
		} else {
			while (!this.isGround(x, y)) y += dy;
		}
		return y - oy;
	}

	/** remove a breakable block, with a burst of particles */
	private breakTile(tx: number, ty: number, amount: number) {
		const i = ty * this.cols + tx;
		if (this.grid[i] !== BREAKABLE) {
			return false;
		}
		this.grid[i] = 0;
		this.foreground?.clearTile(tx, ty);
		this.createBurst((tx << 4) + 7, (ty << 4) + 7, amount, 64, 0, "");
		this.createBurst((tx << 4) + 7, (ty << 4) + 7, amount, 64, 0, "");
		audio.play("crush");
		return true;
	}

	private clampOffset(x: number) {
		return Math.max(0, Math.min(x, this.cols * 16 - SCREEN_W));
	}

	// ----------------------------------------------------------------------
	// main loop
	// ----------------------------------------------------------------------

	override update(dt: number) {
		if (this.paused) {
			return true;
		}
		this.accumulator = Math.min(this.accumulator + dt, TICK_MS * 10);
		while (this.accumulator >= TICK_MS) {
			this.accumulator -= TICK_MS;
			this.tick();
		}
		// scroll the camera (and the parallax layers with it)
		const viewport = this.parentApp?.viewport;
		if (viewport) {
			viewport.moveTo(this.offsetX * SCALE, 0);
		}
		return true;
	}

	/** one logic tick of the original game (`play()`) */
	private tick() {
		this.gameCount++;
		if (this.status === "died") {
			return;
		}

		this.updatePlayer();

		const alex = this.alex;
		if (alex.y > 160) {
			if (alex.status !== AC_DEAD) {
				this.killAlex();
				alex.y = 150;
				alex.dy = -20;
			} else {
				this.status = "died";
				this.onDiedFallOver?.();
				return;
			}
		}

		this.updateCamera();

		for (const a of this.actors) {
			if (!a.active) continue;
			if (a.type === "boss1" || a.type === "boss2") {
				this.updateActor(a);
			} else if (a.x > this.offsetX - 32 && a.x < this.offsetX + 160 + 32) {
				// only actors close to the screen move
				this.updateActor(a);
			}
		}
		this.actors = this.actors.filter((a) => a.active);

		if (this.pendingDy) {
			alex.dy = this.pendingDy;
			this.pendingDy = 0;
		}

		for (const p of this.particles) {
			this.updateParticle(p);
		}
		this.particles = this.particles.filter((p) => p.life > 0);

		for (const b of this.bullets) {
			this.updateBullet(b);
		}

		this.checkBulletsWithEnemies();
		this.checkAlexWithEnemies();
		this.checkBulletsWithAlex();
		this.bullets = this.bullets.filter((b) => b.exist > 0);

		if (this.numEnemies <= 0) {
			this.winFulfilled |= this.win & WIN_KILL_ALL;
		}
		if (this.status === "playing" && this.winFulfilled === this.win) {
			this.status = "done";
			this.onLevelDone?.();
		}
	}

	// ----------------------------------------------------------------------
	// Alex
	// ----------------------------------------------------------------------

	private killAlex() {
		const alex = this.alex;
		gameState.lives--;
		gameState.ammo = 0;
		gameState.health = 0;
		this.wounded = 0;
		alex.status = AC_DEAD;
		alex.dy = -15;
		audio.play("die");
		this.onAlexDies?.();
	}

	private woundAlex() {
		if (this.wounded) return;
		gameState.health--;
		this.wounded = 100;
		if (gameState.health <= 0) {
			this.killAlex();
		} else {
			audio.play("hurt");
		}
	}

	/** port of `update_player` */
	private updatePlayer() {
		const alex = this.alex;
		const oldX = alex.x;
		const x1 = alex.direction ? 2 : 13;
		const x2 = alex.direction ? 10 : 6;

		const left = input.isKeyPressed("left");
		const right = input.isKeyPressed("right");
		const jump = input.isKeyPressed("jump") || input.isKeyPressed("up");
		const fire = input.isKeyPressed("fire");

		if (this.wounded) this.wounded--;

		if (alex.status === AC_DEAD) {
			alex.y += alex.dy >> 2;
			alex.dy++;
			alex.x += alex.direction ? 1 : -1;
			return;
		}

		// eating animation
		if (alex.status === AC_EAT) {
			this.eatCounter++;
			if (this.eatCounter === 8) {
				alex.status = AC_FULL;
				this.eatCounter = 0;
			}
		}

		// spitting eggs
		if (fire && alex.status === AC_FULL && !this.eatPressed) {
			alex.status = AC_SPIT;
			this.eatPressed = true;
			if (gameState.ammo) {
				this.fireBullet(
					alex.x + 7,
					alex.y - 14,
					alex.direction ? 4 : -4,
					0,
					"egg2",
					false,
				);
				gameState.ammo--;
				audio.play("spit");
			}
		}
		if (!fire) {
			this.eatPressed = false;
			if (this.eatCounter === 0 && alex.status !== AC_BALL) {
				alex.status = gameState.ammo ? AC_FULL : AC_NORM;
			}
		}

		// horizontal movement
		if (left && alex.status !== AC_BALL) {
			alex.x -= 1;
			if (alex.direction) alex.x -= 3;
			alex.direction = 0;
			alex.animate();
		} else if (right && alex.status !== AC_BALL) {
			alex.x += 1;
			if (!alex.direction) alex.x += 3;
			alex.direction = 1;
			alex.animate();
		}

		// rolling
		if (alex.status === AC_BALL) {
			if (alex.direction) {
				this.angle += 8;
				alex.x += 2;
			} else {
				this.angle -= 8;
				alex.x -= 2;
			}
		}

		// horizontal tile collision
		if (
			this.isGround(alex.x + x1, alex.y - 1) ||
			this.isGround(alex.x + x2, alex.y - 1) ||
			this.isGround(alex.x + x1, alex.y - 15) ||
			this.isGround(alex.x + x2, alex.y - 15)
		) {
			alex.x = oldX;
			if (alex.status === AC_BALL) {
				audio.play("hit");
				alex.status = AC_NORM;
			}
		}

		// vertical movement
		if (
			!this.isGround(alex.x + x1, alex.y) &&
			!this.isGround(alex.x + x2, alex.y)
		) {
			alex.dy++;
			this.jumping = true;
		} else {
			this.jumping = false;
			alex.dy = 0;
		}

		if (jump && !this.jumping && !this.jumpPressed) {
			alex.dy = -16;
			this.jumping = true;
			this.jumpPressed = true;
			audio.play("jump");
		}
		if (!jump) {
			if (alex.dy < 0) alex.dy >>= 1;
			this.jumpPressed = false;
		}

		alex.y += alex.dy >> 2;

		// floor
		while (this.isGround(alex.x + x1, alex.y - 1)) {
			alex.y--;
			this.jumping = false;
		}
		while (this.isGround(alex.x + x2, alex.y - 1)) {
			alex.y--;
			this.jumping = false;
		}
		// roof
		while (this.isGround(alex.x + x1, alex.y - 15)) {
			alex.y++;
			alex.dy = 0;
		}
		while (this.isGround(alex.x + x2, alex.y - 15)) {
			alex.y++;
			alex.dy = 0;
		}

		// pickups
		let tx = (alex.x + (alex.direction ? 10 : 6)) >> 4;
		let ty = (alex.y - 10) >> 4;
		const key = ty * this.cols + tx;
		const item =
			tx >= 0 && tx < this.cols && ty >= 0 && ty < this.rows
				? this.items.get(key)
				: undefined;
		if (item !== undefined && item !== "lola") {
			this.items.delete(key);
			if (alex.status !== AC_BALL) alex.status = AC_EAT;
			this.eatCounter = 0;
			switch (item) {
				case "egg":
					gameState.ammo++;
					audio.play("eat");
					break;
				case "heart":
					if (gameState.health >= 2) {
						gameState.score += 100;
					} else {
						gameState.health++;
					}
					audio.play("heart");
					break;
				case "star":
					gameState.score += 100;
					gameState.stars++;
					audio.play("star");
					if (gameState.stars === gameState.starsTotal) {
						this.addParticle((tx << 4) + 4, ty << 4, 0, -0.5, 0, 50, "all100");
					}
					break;
				case "cherry":
					gameState.score += 10;
					gameState.cherries++;
					audio.play("cherry");
					if (gameState.cherries === gameState.cherriesTotal) {
						this.addParticle((tx << 4) + 8, ty << 4, 0, -0.5, 0, 50, "all100");
					}
					break;
				case "oneup":
					this.createBurst((tx << 4) + 7, (ty << 4) + 7, 4, 32, 0, "");
					gameState.lives++;
					audio.play("xtralife");
					break;
			}
		}

		// middle point: spikes and exits
		const mx = alex.x + 7;
		const my = alex.y - 7;
		this.winFulfilled &= ~WIN_EXIT;
		for (const r of this.deadly) {
			if (mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h) {
				this.killAlex();
				return;
			}
		}
		for (const r of this.exits) {
			if (mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h) {
				this.winFulfilled |= this.win & WIN_EXIT;
			}
		}

		// breakables
		if (alex.status === AC_BALL) {
			tx = (alex.x + (alex.direction ? 15 : 0)) >> 4;
			ty = (alex.y - 7) >> 4;
			if (tx >= 0 && tx < this.cols && ty >= 0 && ty < this.rows) {
				this.breakTile(tx, ty, 16);
			}
		}

		// floors: spinners turn Alex into a ball
		tx = (alex.x + 7) >> 4;
		ty = (alex.y + 4) >> 4;
		if (alex.status !== AC_BALL && this.spins.has(ty * this.cols + tx)) {
			const fx = tx + (alex.direction ? 1 : -1);
			const fy = ty - 1;
			if (
				fx >= 0 &&
				fx < this.cols &&
				fy >= 0 &&
				this.grid[fy * this.cols + fx] === 0
			) {
				alex.status = AC_BALL;
				audio.play("turn");
			}
		}
	}

	// ----------------------------------------------------------------------
	// enemies (`update_actor_with_map`)
	// ----------------------------------------------------------------------

	private updateActor(a: Actor) {
		if (a.energy <= 0 && a.status === AC_NORM) {
			a.status = AC_DEAD;
			audio.play("kill");
			a.dy = a.type === "boss1" ? -16 : -8;
		}

		if (a.status === AC_DEAD) {
			a.x += a.direction ? -1 : 1;
			a.dy++;
			a.y += a.dy >> 2;
			if (a.type === "boss1" && this.particles.length < MAX_PARTICLES) {
				this.addParticle(
					a.x + 8 + (rand() % 16),
					a.y - 8 - (rand() % 16),
					0,
					0,
					-1,
					16,
					"smoke1",
				);
			}
		} else if (a.status === AC_FLAT) {
			if (a.counter > 200) {
				a.x += (a.counter % 3) - 1;
			}
			if (++a.counter > 250) a.status = AC_NORM;
			this.fall(a);
		} else if (a.type === "cannon") {
			a.mode++;
			if (a.mode >= 125) {
				const diff = this.alex.x + 8 - (a.x + 8);
				this.fireBullet(
					a.x + (diff > 0 ? 8 : -12),
					a.y - 16,
					diff > 0 ? 3 : -3,
					0,
					"enemy6",
					true,
				);
				this.createBurst(
					a.x + (diff > 0 ? 18 : -2),
					a.y - 8,
					8,
					8,
					25,
					"particle_dust",
				);
				a.mode = 0;
				audio.play("shoot");
			}
		} else if (a.type === "spikefish" || a.type === "jellyfish") {
			if (a.mode === 0) {
				const b = [8, 14, 18, 21, 23, 26, 28];
				a.ymax = a.y;
				a.y = 120;
				a.mode++;
				a.dy =
					-b[Math.min(Math.max(Math.trunc(Math.abs(a.ymax - a.y) / 16), 0), 6)];
				a.ymax = a.dy;
			} else if (a.mode === 1) {
				a.dy++;
				a.y += a.dy >> 2;
				if (a.y >= 120) {
					a.y = 130;
					a.mode = 2;
				}
				if (a.type === "jellyfish") {
					a.frames[0] = a.dy < 0 ? "enemy5_02" : "enemy5_01";
				}
			} else if (a.mode >= 2) {
				a.mode++;
				if (a.mode > 40) {
					a.y = 120;
					a.dy = a.ymax;
					a.mode = 1;
				}
			}
		} else if (a.type === "crusher") {
			if (a.mode === 0) {
				a.ymax = a.y;
				a.mode++;
				a.dy = 0;
			} else if (a.mode === 1) {
				const diff = Math.abs(this.alex.x + 8 - (a.x + 16));
				if (diff < 32) {
					a.mode = 2;
					a.dy = -4;
				}
			} else if (a.mode === 2) {
				let hit = false;
				a.dy++;
				a.y += a.dy >> 2;
				while (this.isGround(a.x + 8, a.y - 1)) {
					a.y--;
					hit = true;
				}
				while (this.isGround(a.x + 24, a.y - 1)) {
					a.y--;
					hit = true;
				}
				if (hit) {
					a.dy = -1;
					a.mode = 3;
					audio.play("impact");
					this.createBurst(a.x + 16, a.y, 8, 6, 25, "particle_dust");
				}
			} else if (a.mode >= 3) {
				a.mode++;
				if (a.mode > 25) {
					if (this.gameCount & 1) a.y += a.dy;
					if (a.y <= a.ymax) a.mode = 1;
				}
			}
		} else if (a.type === "boss2") {
			this.updateGroundPounder(a);
		} else if (a.status === AC_NORM) {
			// walking humans and the spike truck
			if (this.gameCount & 1) {
				a.x += a.direction ? 1 : -1;
			}
			a.animate();

			if (a.type === "enemy2" || a.type === "boss1") {
				if (!this.isGround(a.x + (a.direction ? a.w - 1 : 0), a.y + 2)) {
					a.direction = a.direction ? 0 : 1;
				}
			} else {
				this.fall(a);
			}
			if (this.isGround(a.x + (a.direction ? a.w : -1), a.y - 2)) {
				a.direction = a.direction ? 0 : 1;
			}
			// patrol areas from the Alex4-WE maps
			if (a.direction === 0 && a.x <= a.patrolStart) a.direction = 1;
			if (a.direction === 1 && a.x >= a.patrolEnd) a.direction = 0;
		}

		const isBoss = a.type === "boss1" || a.type === "boss2";
		if (a.y > 160 + (isBoss ? 600 : 0)) {
			if (isBoss) {
				this.winFulfilled |= this.win & WIN_KILL_GUARDIAN;
			}
			a.active = false;
			// enemies falling off the map without being killed still count
			if (a.status !== AC_DEAD) {
				this.numEnemies--;
			}
		}
	}

	/** small walkers fall down when there is no ground under them */
	private fall(a: Actor) {
		if (!this.isGround(a.x + 2, a.y) && !this.isGround(a.x + 13, a.y)) {
			a.dy++;
			a.y += a.dy >> 2;
			while (this.isGround(a.x + 13, a.y - 1)) {
				a.y--;
				a.dy = 0;
			}
			while (this.isGround(a.x + 2, a.y - 1)) {
				a.y--;
				a.dy = 0;
			}
		}
	}

	/** jumping guardian: lands with a cloud of dust */
	private crushJump(a: Actor) {
		a.y += a.dy >> 2;
		a.dy++;
		if (a.x < a.tx) a.x++;
		if (a.x > a.tx) a.x--;
		if (this.isGround(a.x, a.y - 1)) a.x++;
		if (this.isGround(a.x + 31, a.y - 1)) a.x--;
		for (const px of [1, 15, 30]) {
			if (this.isGround(a.x + px, a.y)) {
				a.y += this.adjustY(a.x + px, a.y - 1, true, -1);
				this.createBurst(a.x + 8, a.y, 8, 10, 25, "particle_dust");
				this.createBurst(a.x + 16, a.y, 8, 10, 25, "particle_dust");
				this.createBurst(a.x + 24, a.y, 8, 10, 25, "particle_dust");
				audio.play("impact");
				a.mode++;
				return;
			}
		}
	}

	/** jumping guardian with spikes out: breaks the blocks it lands on */
	private spikeJump(a: Actor) {
		a.y += a.dy >> 2;
		a.dy++;
		if (a.x < a.tx) a.x++;
		if (a.x > a.tx) a.x--;
		if (this.isGround(a.x, a.y - 1)) a.x++;
		if (this.isGround(a.x + 31, a.y - 1)) a.x--;
		for (const px of [1, 15, 30]) {
			if (this.isGround(a.x + px, a.y)) {
				const tx = (a.x + px) >> 4;
				const ty = a.y >> 4;
				if (ty >= 0 && ty < this.rows && tx >= 0 && tx < this.cols) {
					this.breakTile(tx, ty, 32);
				}
				this.createBurst(a.x + 16, a.y, 8, 6, 25, "particle_dust");
				audio.play("impact");
				// don't crush any more: fall and land
				a.toggle = 1;
			}
		}
	}

	/** the second guardian, the ground pounder */
	private updateGroundPounder(a: Actor) {
		const alex = this.alex;
		switch (a.mode) {
			case 0: // wait
				a.frames = ["guard2_1a", "guard2_1b"];
				a.counter++;
				if (a.counter > 60) {
					a.mode++;
					a.counter = 0;
				}
				break;
			case 1: // aim
				a.tx = alex.x - 8;
				a.dy = -Math.min(
					Math.max(Math.trunc(Math.abs(a.x - a.tx) / 2), 10),
					30,
				);
				a.mode++;
				break;
			case 2: // jump
				a.frames = ["guard2_2", "guard2_2"];
				this.crushJump(a);
				break;
			case 3: // landed
				a.mode = 0;
				break;
			case 4: // spikes on, wait
				a.frames = ["guard2_3", "guard2_3"];
				a.counter++;
				if (a.counter > 50) {
					a.mode++;
					a.counter = 0;
				}
				break;
			case 5: // aim
				a.tx = alex.x - 8;
				a.dy = -Math.max(Math.trunc(Math.abs(a.x - a.tx) / 2), 10);
				a.mode++;
				a.toggle = 0;
				break;
			case 6: // spike jump
				a.frames = ["guard2_4", "guard2_4"];
				if (a.toggle) this.crushJump(a);
				else this.spikeJump(a);
				break;
			case 7: // landed, short wait
				a.frames = ["guard2_5", "guard2_5"];
				a.counter++;
				if (a.counter > 50) {
					a.mode++;
					a.counter = 0;
				}
				break;
			case 8: // fire
				audio.play("shoot");
				for (let i = 0; i < 3; i++) {
					const b = this.fireBullet(
						a.x + 16,
						a.y - 32,
						(rand() % 5) - 2,
						-((rand() % 5) + 2),
						"bullet_1",
						true,
					);
					if (b) {
						b.animate = true;
						b.gravity = true;
						b.sprite2 = "bullet_2";
					}
				}
				a.mode++;
				break;
			case 9:
			case 11: // wait
				a.counter++;
				if (a.counter > 10) {
					a.mode++;
					a.counter = 0;
				}
				break;
			case 10: // spikes off
				a.frames = ["guard2_6", "guard2_6"];
				a.mode++;
				break;
			case 12: // back to the start
				a.frames = ["guard2_1a", "guard2_1b"];
				a.mode = 0;
				break;
		}
		a.animate();
	}

	// ----------------------------------------------------------------------
	// collisions
	// ----------------------------------------------------------------------

	private killActor(a: Actor) {
		a.status = AC_DEAD;
		a.dy = -10;
	}

	private checkBulletsWithEnemies() {
		for (const b of this.bullets) {
			if (b.exist <= 0 || b.bad) continue;
			for (const e of this.actors) {
				if (
					e.active &&
					e.status === AC_NORM &&
					e.flags & ACF_SHOOTABLE &&
					bbCollision(b.x, b.y, 7, 6, e.x, e.y - e.h, 16, e.h)
				) {
					this.killActor(e);
					this.numEnemies--;
					e.direction = b.dx > 0 ? 0 : 1;
					b.exist = 0;
					this.createBurst(b.x + 4, b.y + 3, 4, 8, 0, "");
					audio.play("kill");
					break;
				}
			}
		}
	}

	private checkBulletsWithAlex() {
		const alex = this.alex;
		for (const b of this.bullets) {
			if (b.exist <= 0 || !b.bad || alex.status === AC_DEAD) continue;
			if (
				bbCollision(
					b.x + 1,
					b.y + 1,
					b.w - 1,
					b.h - 1,
					alex.x + 4,
					alex.y - 16,
					8,
					16,
				)
			) {
				if (!this.wounded) {
					this.woundAlex();
				}
				b.exist = 0;
				this.createBurst(b.x + 4, b.y + 3, 4, 16, 0, "");
			}
		}
	}

	private checkAlexWithEnemies() {
		const alex = this.alex;
		if (alex.status === AC_DEAD) return;
		const jump = input.isKeyPressed("jump") || input.isKeyPressed("up");
		for (const e of this.actors) {
			e.isHit = false;
			if (!e.active || alex.status === AC_DEAD || !(e.flags & ACF_HURTS)) {
				continue;
			}
			// did Alex jump on it?
			if (
				alex.dy >= 0 &&
				e.status === AC_NORM &&
				this.jumping &&
				alex.status !== AC_BALL &&
				e.flags & ACF_JUMPABLE
			) {
				if (
					bbCollision(
						alex.x + 2,
						alex.y + 12 - 16,
						12,
						8,
						e.x,
						e.y - e.h,
						e.w,
						4,
					)
				) {
					this.addParticle(
						e.x + (e.w >> 1),
						alex.y,
						0,
						0,
						0,
						5,
						"particle_bopp",
					);
					if (e.flags & ACF_FLATABLE) {
						e.status = AC_FLAT;
						e.counter = 0;
					} else if (!(e.flags & ACF_BOUNCEABLE)) {
						this.killActor(e);
						this.numEnemies--;
						e.direction = alex.direction ? 0 : 1;
					}
					if (e.flags & ACF_BOUNCEABLE) {
						alex.y = e.y - e.h - 6;
						this.pendingDy = -15;
						this.jumping = true;
						audio.play("jump");
						if (e.mode === 0) {
							e.mode = 4;
							e.counter = 0;
						}
					} else {
						this.pendingDy = -5;
						audio.play("stomp");
						if (jump) {
							this.pendingDy = -20;
							this.jumping = true;
							audio.play("jump");
						}
					}
				}
				continue;
			}
			// does Alex get hurt, or knock them over?
			if (
				e.status === AC_NORM ||
				(e.status === AC_FLAT && alex.status === AC_BALL)
			) {
				if (
					bbCollision(
						alex.x + (alex.direction ? 0 : 8),
						alex.y - 16,
						8,
						16,
						e.x + e.ox,
						e.y - e.h,
						e.w,
						e.h,
					)
				) {
					let wounded = false;
					if (alex.status === AC_BALL) {
						if (e.flags & ACF_ROLLABLE) {
							this.killActor(e);
							this.numEnemies--;
							e.direction = alex.direction ? 0 : 1;
							audio.play("kill");
						} else if (e.flags & ACF_ROLLABLE_BACK) {
							if (e.direction === alex.direction) {
								e.energy--;
								e.isHit = true;
								audio.play("hit");
							} else {
								wounded = true;
							}
						} else {
							wounded = true;
						}
					} else {
						wounded = true;
					}
					if (!this.wounded && wounded) {
						this.woundAlex();
						if (alex.status === AC_DEAD) {
							alex.direction = e.direction;
						}
					}
				}
			} else if (e.status === AC_FLAT && alex.status !== AC_BALL) {
				// eat the flattened enemy
				if (
					bbCollision(
						alex.x + (alex.direction ? 16 : -8),
						alex.y,
						8,
						16,
						e.x + 2,
						e.y + 8,
						12,
						8,
					)
				) {
					e.active = false;
					this.numEnemies--;
					alex.status = AC_EAT;
					gameState.score += 50;
					this.eatCounter = 0;
					audio.play("eat");
				}
			}
		}
	}

	// ----------------------------------------------------------------------
	// bullets & particles
	// ----------------------------------------------------------------------

	private fireBullet(
		x: number,
		y: number,
		dx: number,
		dy: number,
		sprite: string,
		bad: boolean,
	) {
		if (this.bullets.length >= MAX_BULLETS) return undefined;
		const size = spriteSize(sprite);
		const b: Bullet = {
			x,
			y,
			dx,
			dy,
			exist: 160,
			sprite,
			sprite2: sprite,
			w: size.w,
			h: size.h,
			bad,
			animate: false,
			gravity: false,
		};
		this.bullets.push(b);
		return b;
	}

	private updateBullet(b: Bullet) {
		b.x += b.dx;
		b.y += b.dy;
		if (b.gravity) b.dy += 0.1;
		if (b.exist > 0) b.exist--;
		const cx = Math.trunc(b.x + b.w / 2);
		const cy = Math.trunc(b.y + b.h / 2);
		if (this.isGround(cx, cy)) {
			this.createBurst(cx, cy, 4, 16, 0, "");
			b.exist = 0;
		}
	}

	private addParticle(
		x: number,
		y: number,
		dx: number,
		dy: number,
		color: number,
		life: number,
		sprite: string,
	) {
		if (this.particles.length >= MAX_PARTICLES) return;
		this.particles.push({ x, y, dx, dy, color, life, sprite, count: 0 });
	}

	/** a little fireworks "bang" (`create_burst`) */
	private createBurst(
		x: number,
		y: number,
		spread: number,
		num: number,
		life: number,
		sprite: string,
	) {
		for (let i = 0; i < num; i++) {
			this.addParticle(
				x + (rand() % spread) - spread / 2,
				y + (rand() % spread) - spread / 2,
				(rand() % 100) / 100 - 0.5,
				(rand() % 100) / 100 - 0.5,
				(rand() % 4) + 1,
				life ? life : 70 - (rand() % 50),
				sprite,
			);
		}
	}

	private updateParticle(p: Particle) {
		p.x += p.dx;
		p.y += p.dy;
		if (p.sprite === "") {
			p.dy += 0.1;
		}
		p.life--;
		p.count++;
	}

	// ----------------------------------------------------------------------
	// camera (`calculate_camera_pos`)
	// ----------------------------------------------------------------------

	private updateCamera() {
		const alex = this.alex;
		const ball = alex.status === AC_BALL;
		const c = ball ? 1 : 0;
		const x = alex.x - this.offsetX;
		let pan = true;

		if (this.camSide[c]) {
			if (ball ? x < 34 && x > 8 : x < 60 && x > 40) pan = false;
		} else if (ball ? x < 136 && x > 111 : x < 105 && x > 85) {
			pan = false;
		}

		if (pan) {
			this.camSide[c] = alex.direction;
			this.camCount[c] = 0;
		} else {
			this.camStep[c] = 0;
			if (++this.camCount[c] > 50) pan = true;
		}

		if (!pan) return;

		let tox: number;
		if (ball) {
			tox = this.clampOffset(alex.x - (alex.direction ? 34 : 112));
		} else {
			tox = this.clampOffset(alex.x - (alex.direction ? 60 : 85));
		}
		const d = tox - this.offsetX;
		const ad = Math.abs(d);
		let step = 0;
		if (ball) {
			if (ad > 70) step = 8;
			else if (ad > 60) step = 7;
			else if (ad > 50) step = 6;
			else if (ad > 40) step = 5;
			else if (ad > 30) step = 4;
			else if (ad > 20) step = 3;
			else if (ad > 1) step = 2;
			else if (ad > 0) step = 1;
		} else {
			step = ad > 1 ? 2 : ad > 0 ? 1 : 0;
		}
		step *= Math.sign(d);
		if (this.camStep[c] > step) this.camStep[c]--;
		if (this.camStep[c] < step) this.camStep[c]++;
		this.offsetX = this.clampOffset(this.offsetX + this.camStep[c]);
	}

	// ----------------------------------------------------------------------
	// drawing
	// ----------------------------------------------------------------------

	override draw(renderer: Renderer) {
		const gc = Math.abs(this.gameCount);
		const first = Math.max(0, this.offsetX >> 4);
		const last = Math.min(this.cols - 1, first + 11);

		// items, spinners and water, per map cell
		for (let ty = 0; ty < this.rows; ty++) {
			for (let tx = first; tx <= last; tx++) {
				const i = ty * this.cols + tx;
				const item = this.items.get(i);
				if (item !== undefined) {
					drawSprite(renderer, item, tx * 16, ty * 16);
				}
				if (this.spins.has(i)) {
					drawSprite(renderer, `spin${1 + ((gc >> 2) % 4)}`, tx * 16, ty * 16);
				}
				const w = this.water[i];
				if (w === 1) {
					drawSprite(renderer, `water_${(gc >> 2) % 4}`, tx * 16, ty * 16);
				} else if (w === 2) {
					drawSprite(renderer, `surface_${(gc >> 2) % 8}`, tx * 16, ty * 16);
				}
			}
		}
		for (const l of this.lola) {
			drawSprite(renderer, "lola", l.x, l.y);
		}

		// actors
		for (const a of this.actors) {
			if (!a.active || a.frames.length === 0) continue;
			if (a.x < this.offsetX - 48 || a.x > this.offsetX + SCREEN_W + 16)
				continue;
			let sprite: string;
			if (a.status === AC_FLAT) {
				sprite = a.flatFrame;
			} else {
				const f = a.frame % a.frames.length;
				sprite = a.isHit && a.hitFrames.length ? a.hitFrames[f] : a.frames[f];
			}
			const size = spriteSize(sprite);
			drawSprite(renderer, sprite, a.x, a.y - size.h, {
				flipX: a.direction === 1,
				flipY: a.status === AC_DEAD,
			});
		}

		// particles
		for (const p of this.particles) {
			if (p.sprite === "") {
				renderer.setColor(PALETTE[Math.max(0, p.color - 1)]);
				renderer.fillRect(
					Math.round(p.x) * SCALE,
					Math.round(p.y) * SCALE,
					SCALE,
					SCALE,
				);
			} else {
				let sprite = p.sprite;
				if (p.color === -1) {
					sprite = `smoke${Math.min(8, 1 + (p.count >> 1))}`;
				}
				const size = spriteSize(sprite);
				drawSprite(renderer, sprite, p.x - (size.w >> 1), p.y - (size.h >> 1));
			}
		}

		this.drawAlex(renderer);

		// bullets
		for (const b of this.bullets) {
			if (!b.animate) {
				drawSprite(renderer, b.sprite, b.x, b.y, { flipX: b.dx >= 0 });
			} else {
				drawSprite(
					renderer,
					this.gameCount & 4 ? b.sprite : b.sprite2,
					b.x,
					b.y,
				);
			}
		}
	}

	/** port of `draw_player` */
	private drawAlex(renderer: Renderer) {
		const alex = this.alex;
		const x = alex.x;
		const y = alex.y;
		if (this.wounded && this.gameCount % 2) return;

		if (alex.status === AC_DEAD) {
			drawSprite(renderer, "hero_jump", x, y - 32, { flipY: true });
			drawSprite(renderer, "hero_norm", x, y - 16, { flipY: true });
			return;
		}
		if (alex.status === AC_BALL) {
			const angle = (this.angle * Math.PI * 2) / 256;
			drawSprite(renderer, "hero_ball", x, y - 16, {
				angle,
				flipX: alex.direction === 1,
			});
			return;
		}
		const flipX = alex.direction === 1;
		if (alex.status !== AC_EAT) {
			const head =
				alex.status === AC_FULL
					? "hero_full"
					: alex.status === AC_SPIT
						? "hero_spit"
						: "hero_norm";
			const body = this.jumping ? "hero_jump" : alex.frames[alex.frame];
			drawSprite(renderer, body, x, y - 16, { flipX });
			drawSprite(renderer, head, x, y - 16, { flipX });
		} else if (!this.jumping) {
			drawSprite(renderer, "hero_eat", flipX ? x : x - 16, y - 16, { flipX });
		} else {
			drawSprite(renderer, "hero_jump", x, y - 16, { flipX });
			drawSprite(renderer, "hero_spit", x, y - 16, { flipX });
		}
	}
}
