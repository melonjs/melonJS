/**
 * melonJS — Isometric Dungeon example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import type { Grid } from "@melonjs/pathfinding-plugin";
import {
	collision,
	input,
	type Light2d,
	loader,
	type ParticleEmitter,
	Polygon,
	type Renderer,
	Sprite,
	TextureAtlas,
	timer,
	Vector2d,
} from "melonjs";
import {
	FEET_X,
	FEET_Y,
	HERO_SPEED,
	PICKUP_FRAME_MS,
	REACH,
	RUN_FRAME_MS,
	SIGHT_RADIUS,
	SIGHT_SQUASH,
	TORCH_INTENSITY,
} from "../constants";
import { footstep } from "../fx/sound";
import { breath, flicker } from "../fx/torch";
import type { Dungeon } from "./dungeon";
import { Exit, type Usable } from "./usables";

// heading for each map direction (sign of x, sign of y)
const HEADING: Record<string, string> = {
	"-1,-1": "n",
	"0,-1": "ne",
	"1,-1": "e",
	"1,0": "se",
	"1,1": "s",
	"0,1": "sw",
	"-1,1": "w",
	"-1,0": "nw",
};
const HEADINGS = Object.values(HEADING);

// a direction, projected between the map and the screen
const direction = new Vector2d();
// facing()'s own: it must not overwrite the velocity held in `direction`
const offset = new Vector2d();

// where a click was, before it becomes a path
const clicked = new Vector2d();

// how close (in pixels) to a point of the path counts as reaching it: a
// step of the walk, so the hero never overshoots and turns back
const ARRIVE = HERO_SPEED * 1.5;
// frames of walking without getting any closer before the hero asks for a
// new path from where it stands. The grid sees the hero as a point, and a
// straight stretch of path runs right along the walls: at a corner the
// hero's feet catch on the stone and slide off the line, and from there the
// next point can be behind the corner
const STUCK_FRAMES = 12;
// new paths asked for after one click, before the hero gives up (something
// the grid does not know about is in the way)
const REPLANS = 3;

// frames per animation in the atlas
const FRAMES = { idle: 1, run: 10, pickup: 10 };

let atlas: TextureAtlas | undefined;
function heroAtlas() {
	if (!atlas) {
		const image = loader.getImage("hero");
		if (!image) {
			throw new Error("hero image not loaded");
		}
		atlas = new TextureAtlas(loader.getJSON("hero"), image);
	}
	return atlas;
}

let shadow: HTMLCanvasElement | undefined;
// soft dark ellipse, wider than tall like the footprint
function shadowTexture() {
	if (!shadow) {
		shadow = document.createElement("canvas");
		shadow.width = 32;
		shadow.height = 16;
		const context = shadow.getContext("2d");
		if (!context) {
			throw new Error("could not create a 2d context");
		}
		context.scale(1, 0.5);
		const fill = context.createRadialGradient(16, 16, 0, 16, 16, 16);
		fill.addColorStop(0, "rgba(0, 0, 0, 0.45)");
		fill.addColorStop(0.6, "rgba(0, 0, 0, 0.25)");
		fill.addColorStop(1, "rgba(0, 0, 0, 0)");
		context.fillStyle = fill;
		context.fillRect(0, 0, 32, 32);
	}
	return shadow;
}

export class Hero extends Sprite {
	dungeon: Dungeon | undefined;
	torch?: Light2d;
	// how far the darkness opens around the hero
	sight?: Light2d;
	dust?: ParticleEmitter;
	// called every frame with whatever is in reach
	onReach?: (target: Usable | undefined) => void;
	// camera target: the feet, on a whole pixel (the camera's offset looks
	// a bit above them)
	readonly focus = new Vector2d();
	// where the feet are, to find what is in reach
	private readonly feet = new Vector2d();
	private heading = "s";
	// true during the pickup animation
	private busy = false;
	// the pathfinding grid of the level, set by the stage
	grid?: Grid | null;
	// the points still to walk to, after a click
	private route: Vector2d[] = [];
	// what was clicked, to use once it is in reach
	private goal: Usable | undefined;
	// where the route leads
	private readonly destination = new Vector2d();
	// frames spent walking without getting closer, and new paths asked for
	private stuck = 0;
	private replans = 0;
	private lastDistance = Number.POSITIVE_INFINITY;

	constructor(x: number, y: number) {
		// (x, y) is where the feet are; the atlas holds the hero's frames only
		super(x - FEET_X, y - FEET_Y, heroAtlas().getAnimationSettings());
		this.name = "hero";
		// the camera follows `focus`, which is only moved by update()
		this.alwaysUpdate = true;
		// same anchor as the wall sprites, so they sort the same way
		this.anchorPoint.set(0, 0);

		for (const heading of HEADINGS) {
			this.addAnimation(`idle_${heading}`, frames("idle", heading));
			this.addAnimation(`run_${heading}`, frames("run", heading), RUN_FRAME_MS);
			this.addAnimation(
				`pickup_${heading}`,
				frames("pickup", heading),
				PICKUP_FRAME_MS,
			);
		}
		this.setCurrentAnimation("idle_s");

		// diamond shaped footprint, about as wide as the feet: 10 Tiled units
		// across, well inside the 38 unit doorways
		this.bodyDef = {
			type: "dynamic",
			shapes: [
				new Polygon(0, 0, [
					new Vector2d(FEET_X, FEET_Y - 5),
					new Vector2d(FEET_X + 10, FEET_Y),
					new Vector2d(FEET_X, FEET_Y + 5),
					new Vector2d(FEET_X - 10, FEET_Y),
				]),
			],
			collisionType: collision.types.PLAYER_OBJECT,
			// only the collision layer and the doors: every wall and prop tile
			// object has a body of its own over its whole image
			collisionMask: collision.types.WORLD_SHAPE,
			frictionAir: 0,
			gravityScale: 0,
		};
		this.focus.set(x, y);
	}

	get feetX() {
		return this.pos.x + FEET_X;
	}
	get feetY() {
		return this.pos.y + FEET_Y;
	}

	/**
	 * Walk to a point of the map, clicked or tapped: along the path the grid
	 * finds round the walls (and the doors still shut). A click on something
	 * usable walks up to it and uses it.
	 * @param x - world x of the click
	 * @param y - world y of the click
	 */
	goTo(x: number, y: number) {
		if (!this.grid || this.busy) {
			return;
		}
		this.goal = this.dungeon?.nearest(clicked.set(x, y), REACH);
		this.destination.setV(this.goal ? this.goal.spot : clicked);
		this.replans = 0;
		this.plan();
	}

	/** the path from where the hero stands to the destination */
	private plan() {
		if (!this.grid) {
			return;
		}
		const result = this.grid.findPath(
			this.feet.set(this.feetX, this.feetY),
			this.destination,
			{
				// a corner is never cut past a wall
				diagonalMode: "onlyIfNoObstacles",
				// straight across open floor, rather than cell by cell
				smooth: true,
				// a click on a wall (or a door still shut) walks as near as it can
				allowPartialPath: true,
			},
		);
		// path[0] is where the hero stands
		this.route = result.path.slice(1);
		this.stuck = 0;
		this.lastDistance = Number.POSITIVE_INFINITY;
	}

	/**
	 * The velocity toward the next point of the route, or null when there is
	 * no route left to walk.
	 */
	private followRoute() {
		while (this.route.length > 0) {
			const next = this.route[0];
			const dx = next.x - this.feetX;
			const dy = next.y - this.feetY;
			const distance = Math.hypot(dx, dy);
			if (distance < ARRIVE) {
				this.route.shift();
				this.lastDistance = Number.POSITIVE_INFINITY;
				continue;
			}
			// caught on a corner: a new path from here; still blocked after a
			// few, something the grid does not know is in the way: give up
			this.stuck = distance < this.lastDistance - 0.5 ? 0 : this.stuck + 1;
			this.lastDistance = Math.min(this.lastDistance, distance);
			if (this.stuck > STUCK_FRAMES) {
				if (this.replans < REPLANS) {
					this.replans++;
					this.plan();
					continue;
				}
				this.route = [];
				break;
			}
			// the screen offset as a map direction, at the keyboard's speed
			direction.set(dx, dy).to2d().normalize().toIso().scale(HERO_SPEED);
			this.heading = facing(dx, dy);
			return direction;
		}
		return null;
	}

	override update(dt: number) {
		// keys to map direction: up is (-1, -1), right is (1, -1)
		let mx = 0;
		let my = 0;
		if (!this.busy) {
			if (input.isKeyPressed("up")) {
				mx -= 1;
				my -= 1;
			}
			if (input.isKeyPressed("down")) {
				mx += 1;
				my += 1;
			}
			if (input.isKeyPressed("right")) {
				mx += 1;
				my -= 1;
			}
			if (input.isKeyPressed("left")) {
				mx -= 1;
				my += 1;
			}
		}
		const sx = Math.sign(mx);
		const sy = Math.sign(my);
		if (sx !== 0 || sy !== 0) {
			// the keys always win over a click
			this.route = [];
			this.goal = undefined;
			// normalize, then project the map direction on the screen
			direction.set(sx, sy).normalize().toIso().scale(HERO_SPEED);
			this.body.setVelocity(direction.x, direction.y);
			this.heading = HEADING[`${sx},${sy}`];
			this.setCurrentAnimation(`run_${this.heading}`, {
				onFrame: this.footfall,
			});
		} else if (!this.busy && this.route.length > 0 && this.followRoute()) {
			this.body.setVelocity(direction.x, direction.y);
			this.setCurrentAnimation(`run_${this.heading}`, {
				onFrame: this.footfall,
			});
		} else {
			this.body.setVelocity(0, 0);
			if (!this.busy) {
				this.setCurrentAnimation(`idle_${this.heading}`);
			}
		}

		const target = this.busy
			? undefined
			: this.dungeon?.nearest(this.feet.set(this.feetX, this.feetY), REACH);
		this.onReach?.(target);
		// arriving at what was clicked: use it, even when something else (the
		// other half of a double door) happens to be nearer
		const goal = this.goal;
		if (
			goal &&
			!this.busy &&
			!goal.used &&
			goal.spot.distance(this.feet) < REACH
		) {
			this.route = [];
			this.goal = undefined;
			this.use(goal);
		} else if (target && input.isKeyPressed("action")) {
			this.route = [];
			this.goal = undefined;
			this.use(target);
		}

		const seconds = timer.getTime() / 1000;
		if (this.torch) {
			this.torch.setPosition(this.feetX, this.feetY - 50);
			this.torch.intensity = TORCH_INTENSITY * flicker(seconds);
		}
		if (this.sight) {
			this.sight.setPosition(this.feetX, this.feetY - 70);
			// the opening breathes with the torch
			const radius = SIGHT_RADIUS * breath(seconds);
			this.sight.setRadii(radius, radius * SIGHT_SQUASH);
		}

		// on a whole pixel, so the camera comes to rest on one and the
		// scene is sharp; it still glides between them while following
		this.focus.set(Math.round(this.feetX), Math.round(this.feetY));
		super.update(dt);
		return true;
	}

	override draw(renderer: Renderer) {
		// a shadow under the feet, about the size of the footprint: the
		// footprint never reaches a wall, so neither does the shadow
		renderer.drawImage(
			shadowTexture(),
			0,
			0,
			32,
			16,
			this.pos.x + FEET_X - 12,
			this.pos.y + FEET_Y - 6,
			24,
			12,
		);
		super.draw(renderer);
	}

	// the feet touch the ground on frames 3 and 8 of the run
	private readonly footfall = (frame: number) => {
		if (frame === 3 || frame === 8) {
			this.step();
		}
	};

	private step() {
		footstep();
		if (this.dust) {
			this.dust.setPosition(this.feetX - 11, this.feetY - 6);
			this.dust.burstParticles();
		}
	}

	private use(target: Usable) {
		const dungeon = this.dungeon;
		if (!dungeon) {
			return;
		}
		if (target instanceof Exit) {
			target.use(dungeon);
			return;
		}
		// face the target and play the pickup animation before opening it
		this.heading = facing(
			target.spot.x - this.feetX,
			target.spot.y - this.feetY,
		);
		this.busy = true;
		this.setCurrentAnimation(`pickup_${this.heading}`, {
			// then stand still, facing it
			next: `idle_${this.heading}`,
			onComplete: () => {
				target.use(dungeon);
				this.busy = false;
			},
		});
	}
}

function frames(anim: keyof typeof FRAMES, heading: string) {
	return Array.from(
		{ length: FRAMES[anim] },
		(_, f) => `${anim}_${heading}_${f}`,
	);
}

// closest heading for a screen offset
function facing(dx: number, dy: number) {
	// screen to map
	const { x: mx, y: my } = offset.set(dx, dy).to2d();
	const step = Math.round(Math.atan2(my, mx) / (Math.PI / 4));
	const dir = [
		[1, 0],
		[1, 1],
		[0, 1],
		[-1, 1],
		[-1, 0],
		[-1, -1],
		[0, -1],
		[1, -1],
	][(step + 8) % 8];
	return HEADING[`${dir[0]},${dir[1]}`];
}
