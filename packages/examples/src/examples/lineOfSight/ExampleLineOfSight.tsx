/**
 * melonJS — raycast demo (line of sight).
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * Key API (new in 19.5):
 *
 *     const hit = app.world.adapter.raycast(from, to);
 *     if (hit) {
 *         // hit.renderable — the body the ray entered
 *         // hit.point      — entry point on the body's surface
 *         // hit.normal     — surface normal at the entry
 *         // hit.fraction   — 0..1 along the ray, from `from` to `to`
 *     }
 *
 * Same call works unchanged under BuiltinAdapter, MatterAdapter, and
 * PlanckAdapter — game code never branches on the active engine.
 *
 * This demo wraps `raycast` in a stealth-style vision cone: a fan of
 * 21 rays cast each frame from a rotating "sentry" across its forward
 * arc. The hit points form the visible-area polygon (same building
 * block, used 21× per frame), so obstacles correctly occlude
 * everything behind them. Arrow keys move the sentry; drag the green
 * shapes to rearrange the obstacles.
 *
 * Square blocks are placed by their top left corner, round pillars by
 * their centre: a ray finds each where it is drawn. Intruders walk the
 * edges of the room and a corridor, and the sentry spots one in its cone when the
 * first hit of a ray towards it (`hit.fraction` along the ray) lies
 * further away than the intruder does.
 */
import {
	Application,
	Color,
	ColorLayer,
	Ellipse,
	input,
	type PhysicsAdapter,
	type Pointer,
	Polygon,
	Rect,
	Renderable,
	type Renderer,
	Stage,
	state,
	Text,
	Vector2d,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";

/**
 * Internal type for the strict tuple shape `Polygon` / `setVertices`
 * expect. We build the polyPoints array dynamically (push in a loop),
 * so TypeScript can't prove it's a 3+-tuple — the runtime invariant
 * is held by construction (`CONE_RAY_COUNT + 1 >= 3`).
 */
type Polyline = [Vector2d, Vector2d, Vector2d, ...Vector2d[]];

/** Subset of the concrete renderer surface this demo actually calls. */
type DemoRenderer = Renderer & {
	fillPolygon(p: Polygon): void;
};

const VIEWPORT_W = 800;
const VIEWPORT_H = 600;
const OBSTACLE_SIZE = 150;

/** Sentry rotation speed (rad/frame) — ~120°/s at 60 fps. */
const SENTRY_ROTATION_SPEED = 0.0125;
/** Visual radius of the sentry indicator; also used as the grab handle. */
const SENTRY_RADIUS = 10;
const SENTRY_COLOR = "#ffeb3b";
/** Keyboard translation speed in pixels per frame. */
const SENTRY_KEY_SPEED = 4;

/** Angular spread of the vision cone (rad). 90° matches a typical guard FOV. */
const CONE_SPREAD = Math.PI * 0.5;
/** Number of rays cast per frame across the cone. Odd → there's a centre ray. */
const CONE_RAY_COUNT = 21;
/** Maximum sight distance. Wider than the viewport so the cone exits cleanly. */
const CONE_REACH = 1200;
const CONE_FILL_COLOR = "#ff5e9a";
const CONE_FILL_ALPHA = 0.18;

const PILLAR_RADIUS = 34;

/** How fast an intruder walks its beat, in pixels per frame. */
const INTRUDER_SPEED = 1.2;
const INTRUDER_RADIUS = 7;
const INTRUDER_COLOR = "#7fb4ff";
const SPOTTED_COLOR = "#ff3355";

const OBSTACLE_LIT_COLOR = new Color(255, 60, 90);
const OBSTACLE_DEFAULT_COLOR = new Color(60, 220, 140);
const OBSTACLE_OUTLINE_WIDTH = 2;

/**
 * Something the sentry cannot see through. Declarative `bodyDef` — the
 * engine forwards it to the active physics adapter (BuiltinAdapter here,
 * but the same code runs unchanged under Matter or Planck) on `addChild`,
 * which creates the actual `body` and wires it into the broadphase so
 * raycasts can find it. The user can drag obstacles around; the body
 * follows `pos`, so the next raycast picks up the new position
 * automatically.
 */
abstract class Obstacle extends Renderable {
	protected isLit = false;
	private isDragging = false;
	private readonly grabOffset = new Vector2d(0, 0);

	constructor(
		x: number,
		y: number,
		width: number,
		height: number,
		shape: Rect | Ellipse,
	) {
		super(x, y, width, height);
		this.isKinematic = false;
		this.bodyDef = {
			type: "static",
			shapes: [shape],
		};
	}

	override onActivateEvent(): void {
		input.registerPointerEvent("pointerdown", this, this.onPointerDown);
		input.registerPointerEvent("pointerup", this, this.onPointerUp);
		input.registerPointerEvent("pointercancel", this, this.onPointerUp);
		input.registerPointerEvent("pointermove", this, this.onPointerMove);
	}

	override onDeactivateEvent(): void {
		input.releasePointerEvent("pointerdown", this);
		input.releasePointerEvent("pointerup", this);
		input.releasePointerEvent("pointercancel", this);
		input.releasePointerEvent("pointermove", this);
	}

	/** Set by `VisionCone.update` each frame when at least one ray hits this obstacle. */
	setLit(lit: boolean): void {
		this.isLit = lit;
	}

	protected get color(): Color {
		return this.isLit ? OBSTACLE_LIT_COLOR : OBSTACLE_DEFAULT_COLOR;
	}

	private onPointerDown = (event: Pointer): boolean => {
		this.isDragging = true;
		this.grabOffset.set(event.gameX, event.gameY).sub(this.pos);
		return false;
	};

	private onPointerUp = (): boolean => {
		this.isDragging = false;
		return false;
	};

	private onPointerMove = (event: Pointer): boolean => {
		if (!this.isDragging) {
			return false;
		}
		// setPosition keeps the depth, where pos.set() would reset it
		this.setPosition(
			event.gameX - this.grabOffset.x,
			event.gameY - this.grabOffset.y,
		);
		return false;
	};
}

/** A square block, placed by its top left corner. */
class Block extends Obstacle {
	constructor(x: number, y: number, size: number) {
		super(x, y, size, size, new Rect(0, 0, size, size));
		this.anchorPoint.set(0, 0);
	}

	override draw(renderer: Renderer): void {
		renderer.save();
		renderer.translate(this.pos.x, this.pos.y);
		renderer.setGlobalAlpha(0.5);
		renderer.setColor(this.color);
		renderer.fillRect(0, 0, this.width, this.height);
		renderer.setGlobalAlpha(1.0);
		renderer.lineWidth = OBSTACLE_OUTLINE_WIDTH;
		renderer.strokeRect(
			OBSTACLE_OUTLINE_WIDTH,
			OBSTACLE_OUTLINE_WIDTH,
			this.width - OBSTACLE_OUTLINE_WIDTH * 2,
			this.height - OBSTACLE_OUTLINE_WIDTH * 2,
		);
		renderer.restore();
	}
}

/**
 * A round pillar, placed by its centre: the anchor most renderables have,
 * and a `Sprite`'s default. Its body is a circle in the frame the pillar
 * draws in, which starts half its size before `pos`, and that is where
 * the rays find it.
 */
class Pillar extends Obstacle {
	constructor(x: number, y: number, radius: number) {
		const size = radius * 2;
		super(x, y, size, size, new Ellipse(radius, radius, size, size));
		this.anchorPoint.set(0.5, 0.5);
	}

	override draw(renderer: Renderer): void {
		// in the anchored frame, so the centre is half the size from its corner
		const radius = this.width / 2;
		const cx = this.pos.x + radius;
		const cy = this.pos.y + radius;
		renderer.save();
		renderer.setGlobalAlpha(0.5);
		renderer.setColor(this.color);
		renderer.fillEllipse(cx, cy, radius, radius);
		renderer.setGlobalAlpha(1.0);
		renderer.lineWidth = OBSTACLE_OUTLINE_WIDTH;
		renderer.strokeEllipse(
			cx,
			cy,
			radius - OBSTACLE_OUTLINE_WIDTH,
			radius - OBSTACLE_OUTLINE_WIDTH,
		);
		renderer.restore();
	}
}

/**
 * Walks back and forth between two points. It has no body, so the rays of
 * the cone pass through it: the sentry spots it with a ray of its own.
 */
class Intruder extends Renderable {
	/** Set by `VisionCone.update` each frame. */
	spotted = false;
	private readonly from: Vector2d;
	private readonly to: Vector2d;
	// how far along its beat, 0 at `from` and 1 at `to`
	private t: number;
	private step: number;

	constructor(from: Vector2d, to: Vector2d, start: number) {
		super(from.x, from.y, INTRUDER_RADIUS * 2, INTRUDER_RADIUS * 2);
		// pos is its centre
		this.anchorPoint.set(0.5, 0.5);
		this.alwaysUpdate = true;
		this.from = from;
		this.to = to;
		this.t = start;
		this.step = INTRUDER_SPEED / from.distance(to);
	}

	override update(_dt: number): boolean {
		this.t += this.step;
		if (this.t >= 1 || this.t <= 0) {
			this.t = Math.min(Math.max(this.t, 0), 1);
			this.step = -this.step;
		}
		this.setPosition(
			this.from.x + (this.to.x - this.from.x) * this.t,
			this.from.y + (this.to.y - this.from.y) * this.t,
		);
		return true;
	}

	override draw(renderer: Renderer): void {
		const cx = this.pos.x + INTRUDER_RADIUS;
		const cy = this.pos.y + INTRUDER_RADIUS;
		renderer.save();
		renderer.setColor(this.spotted ? SPOTTED_COLOR : INTRUDER_COLOR);
		renderer.fillEllipse(cx, cy, INTRUDER_RADIUS, INTRUDER_RADIUS);
		if (this.spotted) {
			// an exclamation mark over its head
			renderer.lineWidth = 3;
			renderer.strokeLine(
				cx,
				cy - INTRUDER_RADIUS - 14,
				cx,
				cy - INTRUDER_RADIUS - 7,
			);
			renderer.fillRect(cx - 1.5, cy - INTRUDER_RADIUS - 5, 3, 3);
		}
		renderer.restore();
	}
}

/**
 * Draggable origin of the vision cone. Owns its own facing angle that
 * rotates continuously, plus the pointer-drag handlers so the user can
 * reposition the sentry on the playfield. Drawn as a small filled dot
 * with a short forward-direction tick.
 */
class Sentry extends Renderable {
	/** Current facing angle (radians, 0 = pointing right). */
	angle = 0;

	constructor(x: number, y: number) {
		super(x, y, SENTRY_RADIUS * 2, SENTRY_RADIUS * 2);
		// Default `(0, 0)` anchor. With `(0.5, 0.5)` the engine's
		// `preDraw` translates the renderer by `(-width/2, -height/2)`
		// before `draw` runs, but the VisionCone reads `sentry.pos`
		// directly — that mismatch put the cone apex half a sprite
		// off from the visible dot.
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
		// Render above obstacles and the cone fill.
		this.depth = 100;
	}

	override update(_dt: number): boolean {
		// Arrow keys are bound to "left" / "right" / "up" / "down"
		// actions in `createGame`. Movement is purely translational —
		// the cone continues to auto-rotate independent of player input.
		let dx = 0;
		let dy = 0;
		if (input.isKeyPressed("left")) {
			dx -= SENTRY_KEY_SPEED;
		}
		if (input.isKeyPressed("right")) {
			dx += SENTRY_KEY_SPEED;
		}
		if (input.isKeyPressed("up")) {
			dy -= SENTRY_KEY_SPEED;
		}
		if (input.isKeyPressed("down")) {
			dy += SENTRY_KEY_SPEED;
		}
		if (dx !== 0 || dy !== 0) {
			this.pos.set(this.pos.x + dx, this.pos.y + dy);
		}

		this.angle += SENTRY_ROTATION_SPEED;
		// Keep angle bounded to avoid float drift over long sessions.
		if (this.angle > Math.PI * 2) {
			this.angle -= Math.PI * 2;
		}
		return true;
	}

	/** Visual centre, also the cone's apex — `pos` + half the bounds. */
	override get centerX(): number {
		return this.pos.x + SENTRY_RADIUS;
	}
	override get centerY(): number {
		return this.pos.y + SENTRY_RADIUS;
	}

	override draw(renderer: Renderer): void {
		const cx = this.centerX;
		const cy = this.centerY;
		renderer.save();
		renderer.setColor(SENTRY_COLOR);
		renderer.fillEllipse(cx, cy, SENTRY_RADIUS, SENTRY_RADIUS);
		// Forward direction tick — points along the current facing.
		renderer.lineWidth = 2;
		renderer.strokeLine(
			cx,
			cy,
			cx + Math.cos(this.angle) * SENTRY_RADIUS * 1.6,
			cy + Math.sin(this.angle) * SENTRY_RADIUS * 1.6,
		);
		renderer.restore();
	}
}

/**
 * Vision cone driven by the sentry. Each frame:
 *   1. Cast `CONE_RAY_COUNT` rays across the sentry's forward arc.
 *   2. Build the visible-area polygon from the hit points (or
 *      uninterrupted segment endpoints).
 *   3. Toggle `isLit` on the set of currently-hit obstacles, diffing
 *      against last frame's set to avoid re-flagging the unchanged.
 *
 * All raycasts go through `world.adapter.raycast(from, to)` — the same
 * call works under Builtin / Matter / Planck.
 */
class VisionCone extends Renderable {
	private readonly sentry: Sentry;
	private readonly adapter: PhysicsAdapter;
	private readonly conePolygon: Polygon;
	private readonly polyPoints: Vector2d[];
	// Two member sets swapped each frame so we never allocate a new
	// `Set<Obstacle>` per update — `litObstacles` holds the previous
	// frame's lit set, `nextLit` is filled fresh this frame, then we
	// swap references at the end.
	private litObstacles = new Set<Obstacle>();
	private nextLit = new Set<Obstacle>();
	// Scratch vectors reused across the per-ray loop to avoid 2 × rayCount
	// Vector2d allocations per frame.
	private readonly rayFrom = new Vector2d(0, 0);
	private readonly rayTo = new Vector2d(0, 0);
	private readonly intruders: Intruder[];
	private readonly status: Text;
	private spottedCount = -1;

	constructor(
		sentry: Sentry,
		adapter: PhysicsAdapter,
		intruders: Intruder[],
		status: Text,
	) {
		super(0, 0, 1, 1);
		this.intruders = intruders;
		this.status = status;
		this.alwaysUpdate = true;
		// The cone's polygon is drawn at arbitrary world positions far
		// from `this.pos`, so the default in-viewport check (which uses
		// the renderable's own bounds) culls the draw whenever those
		// tiny bounds drift outside the camera. `floating = true` opts
		// out of that culling entirely.
		this.floating = true;
		// Drawn below the sentry but above the background; obstacle bodies
		// sit on top so the lit colour reads through the cone fill.
		this.depth = 5;
		this.sentry = sentry;
		this.adapter = adapter;

		// Pre-allocate the polygon (1 origin + N ray endpoints) and the
		// Vector2d slots inside it. We mutate the slots in place every
		// frame and call setVertices to refresh edges + bounds.
		this.polyPoints = [];
		for (let i = 0; i < CONE_RAY_COUNT + 1; i++) {
			this.polyPoints.push(new Vector2d(0, 0));
		}
		this.conePolygon = new Polygon(0, 0, this.polyPoints as Polyline);
	}

	override update(_dt: number): boolean {
		const raycast = this.adapter.raycast?.bind(this.adapter);
		if (!raycast) {
			return true;
		}

		const originX = this.sentry.centerX;
		const originY = this.sentry.centerY;
		const baseAngle = this.sentry.angle;
		const halfSpread = CONE_SPREAD / 2;

		// Polygon vertex 0 anchors the cone at the sentry's visual centre.
		this.polyPoints[0].set(originX, originY);

		this.nextLit.clear();

		for (let i = 0; i < CONE_RAY_COUNT; i++) {
			const t = i / (CONE_RAY_COUNT - 1);
			const theta = baseAngle - halfSpread + t * CONE_SPREAD;
			const dirX = Math.cos(theta);
			const dirY = Math.sin(theta);
			this.rayFrom.set(originX, originY);
			this.rayTo.set(originX + dirX * CONE_REACH, originY + dirY * CONE_REACH);

			const hit = raycast(this.rayFrom, this.rayTo);
			const endX = hit ? hit.point.x : this.rayTo.x;
			const endY = hit ? hit.point.y : this.rayTo.y;
			this.polyPoints[i + 1].set(endX, endY);

			if (hit) {
				this.nextLit.add(hit.renderable as Obstacle);
			}
		}

		// Diff lit set: un-light those that left the cone, light the new ones.
		for (const obstacle of this.litObstacles) {
			if (!this.nextLit.has(obstacle)) {
				obstacle.setLit(false);
			}
		}
		for (const obstacle of this.nextLit) {
			if (!this.litObstacles.has(obstacle)) {
				obstacle.setLit(true);
			}
		}
		// Swap references so next frame's `nextLit.clear()` clears the
		// just-consumed previous-frame set.
		const tmp = this.litObstacles;
		this.litObstacles = this.nextLit;
		this.nextLit = tmp;

		// Refresh polygon edges / bounds from the mutated points array.
		this.conePolygon.setVertices(this.polyPoints as Polyline);

		// Spot the intruders: one in the cone is seen when the first thing a
		// ray towards it enters lies further away than it does. `fraction`
		// is how far along the ray the hit is, 0 at `from` and 1 at `to`.
		let spotted = 0;
		for (const intruder of this.intruders) {
			const dx = intruder.pos.x - originX;
			const dy = intruder.pos.y - originY;
			const distance = Math.hypot(dx, dy);
			let off = Math.atan2(dy, dx) - baseAngle;
			off = Math.atan2(Math.sin(off), Math.cos(off));
			intruder.spotted = false;
			if (distance <= CONE_REACH && Math.abs(off) <= halfSpread) {
				this.rayFrom.set(originX, originY);
				this.rayTo.set(
					originX + (dx / distance) * CONE_REACH,
					originY + (dy / distance) * CONE_REACH,
				);
				const hit = raycast(this.rayFrom, this.rayTo);
				intruder.spotted = !hit || hit.fraction * CONE_REACH > distance;
			}
			if (intruder.spotted) {
				spotted++;
			}
		}
		if (spotted !== this.spottedCount) {
			this.spottedCount = spotted;
			this.status.setText(
				spotted > 0
					? `INTRUDER SPOTTED (${spotted} / ${this.intruders.length})`
					: "all quiet",
			);
		}

		return true;
	}

	override draw(renderer: Renderer): void {
		// Filled visible-area polygon — semi-transparent so the obstacles
		// inside it still read. `fillPolygon` exists on both concrete
		// renderers (CanvasRenderer / WebGLRenderer) but isn't declared
		// on the abstract `Renderer` base — narrow via local type alias.
		renderer.save();
		renderer.setGlobalAlpha(CONE_FILL_ALPHA);
		renderer.setColor(CONE_FILL_COLOR);
		(renderer as DemoRenderer).fillPolygon(this.conePolygon);
		renderer.restore();

		// the sentry's line of sight to everyone it spots
		renderer.save();
		renderer.setColor(SPOTTED_COLOR);
		renderer.lineWidth = 1.5;
		for (const intruder of this.intruders) {
			if (intruder.spotted) {
				renderer.strokeLine(
					this.sentry.centerX,
					this.sentry.centerY,
					intruder.pos.x,
					intruder.pos.y,
				);
			}
		}
		renderer.restore();
	}
}

class PlayScreen extends Stage {
	override onResetEvent(app: Application): void {
		// Dark background — high contrast against the magenta cone fill
		// and the neon-green obstacles.
		app.world.addChild(new ColorLayer("background", "#0a0a18"), 0);

		// On-screen instructions, centred at the top of the viewport.
		app.world.addChild(
			new Text(app.viewport.width / 2, 12, {
				font: "bold Courier New",
				size: 14,
				fillStyle: "#ffeb3b",
				textAlign: "center",
				textBaseline: "top",
				text: "ARROW KEYS TO MOVE THE SENTRY",
			}),
			200,
		);
		app.world.addChild(
			new Text(app.viewport.width / 2, 32, {
				font: "Courier New",
				size: 11,
				fillStyle: "#a8b0e8",
				textAlign: "center",
				textBaseline: "top",
				text: "drag the green shapes to rearrange the obstacles",
			}),
			200,
		);
		// what the sentry sees, updated by the cone
		const status = new Text(app.viewport.width / 2, 50, {
			font: "bold Courier New",
			size: 12,
			fillStyle: SPOTTED_COLOR,
			textAlign: "center",
			textBaseline: "top",
			text: "all quiet",
		});
		app.world.addChild(status, 200);

		// Obstacle layout — six static rectangles with gaps the cone
		// can sweep through. The top-middle box sits a bit higher than
		// the other top-row boxes so the sentry (spawning at viewport
		// centre) doesn't start inside it.
		const positions: ReadonlyArray<[number, number]> = [
			[50, 80],
			[50, 400],
			[300, 65],
			[300, 360],
			[600, 200],
			[600, 410],
		];
		for (const [x, y] of positions) {
			app.world.addChild(new Block(x, y, OBSTACLE_SIZE), 1);
		}
		// round pillars in the gaps, placed by their centre
		const pillars: ReadonlyArray<[number, number]> = [
			[250, 300],
			[525, 300],
			[680, 120],
		];
		for (const [x, y] of pillars) {
			app.world.addChild(new Pillar(x, y, PILLAR_RADIUS), 1);
		}

		// intruders walking the edges of the room and the corridor in the
		// middle, out of step
		const intruders = [
			new Intruder(new Vector2d(25, 70), new Vector2d(25, 580), 0),
			new Intruder(new Vector2d(775, 70), new Vector2d(775, 580), 0.5),
			new Intruder(new Vector2d(468, 70), new Vector2d(468, 580), 0.25),
		];
		for (const intruder of intruders) {
			app.world.addChild(intruder, 8);
		}

		// Sentry at the viewport centre. The cone owns a reference to
		// the sentry (reads `pos` + `angle` each frame) and to the
		// world's active physics adapter (where it dispatches the
		// per-frame raycasts).
		const sentry = new Sentry(app.viewport.width / 2, app.viewport.height / 2);
		app.world.addChild(
			new VisionCone(sentry, app.world.adapter, intruders, status),
			5,
		);
		app.world.addChild(sentry, 10);
	}
}

const createGame = async (): Promise<void> => {
	// 19.x bootstrap: `Application` owns the renderer, world, and the
	// active physics adapter (BuiltinAdapter by default). Replaces the
	// legacy `video.init` + global `game` singleton pattern.
	const scaleTarget = document.getElementById("screen");
	// eslint-disable-next-line no-new
	const app = new Application(VIEWPORT_W, VIEWPORT_H, {
		parent: "screen",
		scaleMethod: "fit",
		// Conditionally spread `scaleTarget` only when the element
		// exists. `exactOptionalPropertyTypes` forbids passing `undefined`
		// to an optional `HTMLElement` field, so omit the key entirely
		// in the (rare) no-target case.
		...(scaleTarget ? { scaleTarget } : {}),
		renderer: video.AUTO,
	});
	await app.init();

	// Map the arrow keys to portable action names the Sentry reads via
	// `input.isKeyPressed("left")` etc. Done once at bootstrap.
	input.bindKey(input.KEY.LEFT, "left");
	input.bindKey(input.KEY.RIGHT, "right");
	input.bindKey(input.KEY.UP, "up");
	input.bindKey(input.KEY.DOWN, "down");

	state.set(state.PLAY, new PlayScreen());
	state.change(state.PLAY);
};

export const ExampleLineOfSight = createExampleComponent(createGame);
