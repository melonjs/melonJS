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
 * boxes to rearrange the obstacles.
 */
import {
	Application,
	Color,
	ColorLayer,
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

import { createExampleComponent } from "../utils";

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

const OBSTACLE_LIT_COLOR = new Color(255, 60, 90);
const OBSTACLE_DEFAULT_COLOR = new Color(60, 220, 140);
const OBSTACLE_OUTLINE_WIDTH = 2;

/**
 * Static rectangular obstacle. Declarative `bodyDef` — the engine
 * forwards it to the active physics adapter (BuiltinAdapter here, but
 * the same code runs unchanged under Matter or Planck) on `addChild`,
 * which creates the actual `body` and wires it into the broadphase
 * so raycasts can find it. The user can drag obstacles around; the
 * body's bounds follow `pos`, so the next raycast picks up the new
 * position automatically.
 */
class Obstacle extends Renderable {
	private isLit = false;
	private isDragging = false;
	private readonly grabOffset: Vector2d;

	constructor(x: number, y: number, width: number, height: number) {
		super(x, y, width, height);
		this.anchorPoint.set(0, 0);
		this.isKinematic = false;
		this.bodyDef = {
			type: "static",
			shapes: [new Rect(0, 0, width, height)],
		};
		this.grabOffset = new Vector2d(0, 0);
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
		this.pos.set(
			event.gameX - this.grabOffset.x,
			event.gameY - this.grabOffset.y,
		);
		return false;
	};

	override draw(renderer: Renderer): void {
		const color = this.isLit ? OBSTACLE_LIT_COLOR : OBSTACLE_DEFAULT_COLOR;
		renderer.save();
		renderer.translate(this.pos.x, this.pos.y);
		renderer.setGlobalAlpha(0.5);
		renderer.setColor(color);
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
	private litObstacles = new Set<Obstacle>();
	// Scratch vectors reused across the per-ray loop to avoid 2 × rayCount
	// Vector2d allocations per frame.
	private readonly rayFrom = new Vector2d(0, 0);
	private readonly rayTo = new Vector2d(0, 0);

	constructor(sentry: Sentry, adapter: PhysicsAdapter) {
		super(0, 0, 1, 1);
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

		const nextLit = new Set<Obstacle>();

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
				nextLit.add(hit.renderable as Obstacle);
			}
		}

		// Diff lit set: un-light those that left the cone, light the new ones.
		for (const obstacle of this.litObstacles) {
			if (!nextLit.has(obstacle)) {
				obstacle.setLit(false);
			}
		}
		for (const obstacle of nextLit) {
			if (!this.litObstacles.has(obstacle)) {
				obstacle.setLit(true);
			}
		}
		this.litObstacles = nextLit;

		// Refresh polygon edges / bounds from the mutated points array.
		this.conePolygon.setVertices(this.polyPoints as Polyline);

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
				text: "drag the green boxes to rearrange the obstacles",
			}),
			200,
		);

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
			app.world.addChild(new Obstacle(x, y, OBSTACLE_SIZE, OBSTACLE_SIZE), 1);
		}

		// Sentry at the viewport centre. The cone owns a reference to
		// the sentry (reads `pos` + `angle` each frame) and to the
		// world's active physics adapter (where it dispatches the
		// per-frame raycasts).
		const sentry = new Sentry(app.viewport.width / 2, app.viewport.height / 2);
		app.world.addChild(new VisionCone(sentry, app.world.adapter), 5);
		app.world.addChild(sentry, 10);
	}
}

const createGame = (): void => {
	// 19.x bootstrap: `Application` owns the renderer, world, and the
	// active physics adapter (BuiltinAdapter by default). Replaces the
	// legacy `video.init` + global `game` singleton pattern.
	const scaleTarget = document.getElementById("screen");
	// eslint-disable-next-line no-new
	new Application(VIEWPORT_W, VIEWPORT_H, {
		parent: "screen",
		scaleMethod: "fit",
		// Conditionally spread `scaleTarget` only when the element
		// exists. `exactOptionalPropertyTypes` forbids passing `undefined`
		// to an optional `HTMLElement` field, so omit the key entirely
		// in the (rare) no-target case.
		...(scaleTarget ? { scaleTarget } : {}),
		renderer: video.AUTO,
	});

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
