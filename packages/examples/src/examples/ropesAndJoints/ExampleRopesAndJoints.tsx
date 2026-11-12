/**
 * melonJS — joints: a rope bridge and a wrecking ball.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * Every joint here is made with `world.addJoint()`, the same call on the
 * planck and Rapier adapters. The bridge is planks hinged end to end between
 * two posts. The wrecking ball hangs from a chain of hinged links, with a
 * rope joint from the hook to the ball so the chain cannot stretch. Planks
 * and links are ordinary bodies, so the rope and the bridge collide like
 * anything else.
 *
 * The buttons switch adapter with `world.setAdapter()` and leave the scene
 * alone: every body, and every joint, is built again where it stands.
 * Clicking a joint removes it with `world.removeJoint()`.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import { PlanckAdapter } from "@melonjs/planck-adapter";
import { RapierAdapter } from "@melonjs/rapier2d-adapter";
import {
	Application,
	type CanvasRenderer,
	Ellipse,
	event,
	input,
	type JointDefinition,
	type PhysicsAdapter,
	type PhysicsJoint,
	type Pointer,
	plugin,
	Rect,
	Renderable,
	Stage,
	state,
	Text,
	timer,
	UITextButton,
	Vector2d,
	video,
	type WebGLRenderer,
} from "melonjs";
import { createExampleComponent } from "../utils";

const VIEWPORT_W = 960;
const VIEWPORT_H = 640;

/** in pixels per second², which both adapters take */
const GRAVITY = { x: 0, y: 900 };

const BACKGROUND = "#10121c";
const INK = "#e8eaf2";
const DIM = "#7c84a3";
const PANEL = "#1b1f33";
const EDGE = "#39406b";
const PLANK = "#ffd166";
const CRATE = "#118ab2";
const BOX = "#06d6a0";
const BALL = "#ef476f";

/** the cliff tops, and the gap the bridge spans */
const GROUND_Y = 380;
const GAP_LEFT = 200;
const GAP_RIGHT = 520;

const PLANKS = 9;
const PLANK_LENGTH = 40;
const LINKS = 11;
const LINK_LENGTH = 16;
const BALL_RADIUS = 24;
/** where the chain hangs from */
const HOOK = { x: 680, y: 112 };

const PARAMS = new URLSearchParams(globalThis.location.search);
/** the adapter in use: `?physics=rapier` picks the first one, the buttons the rest */
let backend = PARAMS.get("physics") === "rapier" ? "rapier" : "planck";

/**
 * The adapters that have joints (`capabilities.constraints`). The built-in
 * and matter adapters have none: `world.addJoint()` returns `null` there.
 */
const BACKENDS = [
	{
		id: "planck",
		note: "planck: each hinge is a Box2D RevoluteJoint, the rope a RopeJoint",
	},
	{
		id: "rapier",
		note: "rapier: the same joints, built again by world.setAdapter()",
	},
] as const;

/**
 * A fresh adapter. `create()` is the same call on both: it waits for the
 * adapter to load (Rapier downloads and compiles its WebAssembly the first
 * time), then constructs it.
 * @param id - the adapter's id
 * @returns the adapter
 */
const createAdapter = (id: string): Promise<PhysicsAdapter> => {
	if (id === "rapier") {
		return RapierAdapter.create({ gravity: GRAVITY });
	}
	return PlanckAdapter.create({ gravity: GRAVITY });
};

/**
 * Where `n` links of `length` hang between two points `x0` and `x1` at the
 * same height: each one turned a little less than the one before, so the
 * chain sags evenly. The sag is found by bisection, so the links span the gap
 * exactly and every joint starts with its two ends together.
 * @param x0 - the left end
 * @param x1 - the right end
 * @param y - the height of both ends
 * @param n - the number of links
 * @param length - each link's length
 * @returns the n + 1 points the links run between
 */
const sagging = (
	x0: number,
	x1: number,
	y: number,
	n: number,
	length: number,
) => {
	const angleOf = (i: number, steepest: number) => {
		return steepest * (1 - (2 * (i + 0.5)) / n);
	};
	let low = 0;
	let high = Math.PI / 2;
	for (let k = 0; k < 40; k++) {
		const mid = (low + high) / 2;
		let span = 0;
		for (let i = 0; i < n; i++) {
			span += length * Math.cos(angleOf(i, mid));
		}
		if (span > x1 - x0) {
			low = mid;
		} else {
			high = mid;
		}
	}
	const points = [{ x: x0, y }];
	for (let i = 0; i < n; i++) {
		const last = points[i];
		const angle = angleOf(i, low);
		points.push({
			x: last.x + length * Math.cos(angle),
			y: last.y + length * Math.sin(angle),
		});
	}
	return points;
};

/**
 * A rectangle with a body, drawn as itself. `anchorPoint` (0, 0) puts `pos`
 * on the top-left corner of its shape, and the adapter keeps
 * `currentTransform` in step with the body's angle, so `draw()` only fills
 * the rectangle at `pos`.
 */
class Block extends Renderable {
	readonly colour: string;
	readonly radius: number;

	constructor(
		x: number,
		y: number,
		w: number,
		h: number,
		colour: string,
		type: "static" | "dynamic",
		density = 1,
	) {
		super(x, y, w, h);
		this.anchorPoint.set(0, 0);
		this.colour = colour;
		this.radius = Math.min(3, w / 2, h / 2);
		this.bodyDef = {
			type,
			shapes: [new Rect(0, 0, w, h)],
			density,
			friction: 0.6,
		};
	}

	override update(dt: number) {
		// whatever falls into the gap is let go
		if (this.pos.y > VIEWPORT_H + 100) {
			this.parentApp?.world.removeChild(this);
		}
		return super.update(dt);
	}

	override draw(renderer: WebGLRenderer | CanvasRenderer) {
		renderer.setColor(this.colour);
		renderer.fillRoundRect(
			this.pos.x,
			this.pos.y,
			this.width,
			this.height,
			this.radius,
		);
	}
}

/** A crate: a block that is updated even off screen, so one that falls through the gap is removed. */
class Crate extends Block {
	constructor(x: number, y: number) {
		super(x, y, 30, 30, CRATE, "dynamic");
		this.alwaysUpdate = true;
	}
}

/**
 * The wrecking ball. While it is dragged it is steered by its velocity
 * towards the pointer, so the chain and everything it hits still feel it.
 */
class Ball extends Renderable {
	/** where the pointer holds it, or null when it is let go */
	held: Vector2d | null = null;
	private readonly push = new Vector2d();

	constructor(cx: number, cy: number) {
		super(cx - BALL_RADIUS, cy - BALL_RADIUS, BALL_RADIUS * 2, BALL_RADIUS * 2);
		this.anchorPoint.set(0, 0);
		this.bodyDef = {
			type: "dynamic",
			shapes: [
				new Ellipse(BALL_RADIUS, BALL_RADIUS, BALL_RADIUS * 2, BALL_RADIUS * 2),
			],
			// heavy, so it scatters the boxes rather than bouncing off them
			density: 8,
		};
	}

	/** the centre of the ball, in the world */
	get centre() {
		return {
			x: this.pos.x + BALL_RADIUS,
			y: this.pos.y + BALL_RADIUS,
		};
	}

	override update(dt: number) {
		if (this.held !== null) {
			const { x, y } = this.centre;
			this.push.set((this.held.x - x) * 8, (this.held.y - y) * 8);
			this.parentApp?.world.adapter.setVelocity(this, this.push);
		}
		return super.update(dt);
	}

	override draw(renderer: WebGLRenderer | CanvasRenderer) {
		const { x, y } = this.centre;
		renderer.setColor(BALL);
		renderer.fillEllipse(x, y, BALL_RADIUS, BALL_RADIUS);
	}
}

/**
 * A joint drawn as a dot, and clicked to cut it. `point` is where the joint
 * holds `body`, in the body's own space: the same anchor the joint was made
 * with.
 */
interface Marker {
	joint: PhysicsJoint;
	body: Renderable;
	point: { x: number; y: number };
	/** joints removed with this one */
	with: PhysicsJoint[];
}

/** scratch for placing a marker, reused every frame */
const AT = new Vector2d();

/**
 * Where a point given in a body's own space is in the world: `pos` plus the
 * point turned by the transform the adapter keeps in step with the body.
 * @param body - the renderable
 * @param point - the point, in its own space
 * @param out - receives the world point
 * @returns `out`
 */
const worldPoint = (
	body: Renderable,
	point: { x: number; y: number },
	out: Vector2d,
) => {
	out.set(point.x, point.y);
	body.currentTransform.apply(out);
	return out.add(body.pos);
};

/** The joints' dots, drawn over the scene, with a ring on the one under the pointer. */
class JointMarkers extends Renderable {
	readonly markers: Marker[] = [];
	hover: Marker | undefined;

	constructor() {
		super(0, 0, VIEWPORT_W, VIEWPORT_H);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
	}

	/**
	 * The joint nearest to a point, if one is close enough to click.
	 * @param x - world x
	 * @param y - world y
	 * @returns the marker, or undefined
	 */
	near(x: number, y: number) {
		let best: Marker | undefined;
		let bestDistance = 12;
		for (const marker of this.markers) {
			if (marker.joint.native === null) {
				continue;
			}
			const p = worldPoint(marker.body, marker.point, AT);
			const distance = Math.hypot(p.x - x, p.y - y);
			if (distance < bestDistance) {
				best = marker;
				bestDistance = distance;
			}
		}
		return best;
	}

	override update() {
		// the bodies move every frame
		return true;
	}

	override draw(renderer: WebGLRenderer | CanvasRenderer) {
		for (const marker of this.markers) {
			if (marker.joint.native === null) {
				continue;
			}
			const p = worldPoint(marker.body, marker.point, AT);
			renderer.setColor(BACKGROUND);
			renderer.fillEllipse(p.x, p.y, 4.5, 4.5);
			renderer.setColor(INK);
			renderer.fillEllipse(p.x, p.y, 3, 3);
			if (marker === this.hover) {
				renderer.setColor(BALL);
				renderer.lineWidth = 2;
				renderer.strokeEllipse(p.x, p.y, 10, 10);
				renderer.lineWidth = 1;
			}
		}
	}
}

class PlayScreen extends Stage {
	private app!: Application;
	private markers!: JointMarkers;
	private ball!: Ball;
	private joints: PhysicsJoint[] = [];
	private count!: Text;
	private note!: Text;
	private buttons: { id: string; button: UITextButton }[] = [];
	private readonly pointer = new Vector2d();

	override onResetEvent(app: Application) {
		this.app = app;
		this.build();
		// the whole screen: a click anywhere drops a crate, cuts a joint or
		// grabs the ball. Asked before every other region, so it lets the
		// buttons' clicks through by returning nothing
		input.registerPointerEvent("pointerdown", app.viewport, this.onDown);
		input.registerPointerEvent("pointerup", app.viewport, this.onUp);
		event.on(event.POINTERMOVE, this.onMove);
	}

	override onDestroyEvent() {
		input.releasePointerEvent("pointerdown", this.app.viewport);
		input.releasePointerEvent("pointerup", this.app.viewport);
		event.off(event.POINTERMOVE, this.onMove);
	}

	/** The cliffs, the bridge, the wrecking ball, the stack and the header. */
	build() {
		const world = this.app.world;
		world.backgroundColor.parseCSS(BACKGROUND);
		this.joints = [];
		this.markers = new JointMarkers();

		// the cliffs stop short of the posts, so the end planks swing clear
		world.addChild(
			new Block(
				0,
				GROUND_Y,
				GAP_LEFT - 6,
				VIEWPORT_H - GROUND_Y,
				PANEL,
				"static",
			),
			10,
		);
		world.addChild(
			new Block(
				GAP_RIGHT + 6,
				GROUND_Y,
				VIEWPORT_W - GAP_RIGHT - 6,
				VIEWPORT_H - GROUND_Y,
				PANEL,
				"static",
			),
			10,
		);
		this.buildBridge();
		this.buildWreckingBall();

		// a stack of boxes in the ball's path
		for (const [x, y] of [
			[712, 346],
			[746, 346],
			[780, 346],
			[729, 312],
			[763, 312],
			[746, 278],
		]) {
			world.addChild(new Block(x, y, 34, 34, BOX, "dynamic"), 20);
		}
		// and two crates to land on the bridge
		world.addChild(new Crate(270, 300), 20);
		world.addChild(new Crate(410, 280), 20);

		world.addChild(this.markers, 50);
		this.addHeader();
	}

	/**
	 * Join two bodies, and draw the joint as a dot that a click cuts.
	 * @param definition - the joint
	 * @param body - the body the dot follows
	 * @param point - where the joint holds that body, in its own space
	 * @param also - joints removed with this one
	 * @returns the joint
	 */
	private join(
		definition: JointDefinition,
		body: Renderable,
		point: { x: number; y: number },
		also: PhysicsJoint[] = [],
	) {
		const joint = this.app.world.addJoint(definition);
		this.joints.push(joint);
		this.markers.markers.push({ joint, body, point, with: also });
		return joint;
	}

	/** Planks hinged end to end, from a post on one cliff to a post on the other. */
	private buildBridge() {
		const world = this.app.world;
		// the posts the bridge hangs from: their bottom corners are the ends
		const left = new Block(
			GAP_LEFT - 10,
			GROUND_Y - 26,
			10,
			26,
			EDGE,
			"static",
		);
		const right = new Block(GAP_RIGHT, GROUND_Y - 26, 10, 26, EDGE, "static");
		world.addChild(left, 10);
		world.addChild(right, 10);

		const points = sagging(GAP_LEFT, GAP_RIGHT, GROUND_Y, PLANKS, PLANK_LENGTH);
		const leftEnd = { x: 0, y: 5 };
		const rightEnd = { x: PLANK_LENGTH, y: 5 };
		let previous: Renderable = left;
		for (let i = 0; i < PLANKS; i++) {
			const p = points[i];
			const q = points[i + 1];
			const plank = new Block(
				(p.x + q.x) / 2 - PLANK_LENGTH / 2,
				(p.y + q.y) / 2 - 5,
				PLANK_LENGTH,
				10,
				PLANK,
				"dynamic",
				0.5,
			);
			world.addChild(plank, 20);
			// turned about its centre, so its two ends sit on the curve
			world.adapter.setAngle?.(plank, Math.atan2(q.y - p.y, q.x - p.x));
			// no anchor on `a`: the joint holds it where b's anchor is now
			this.join(
				{ type: "hinge", a: previous, b: plank, anchorB: leftEnd },
				plank,
				leftEnd,
			);
			previous = plank;
		}
		this.join(
			{ type: "hinge", a: right, b: previous, anchorB: rightEnd },
			previous,
			rightEnd,
		);
	}

	/** A ball on a chain of hinged links, pulled back so it swings in at once. */
	private buildWreckingBall() {
		const world = this.app.world;
		// the gantry the chain hangs from
		world.addChild(new Block(628, 92, 284, 12, PANEL, "static"), 10);
		world.addChild(
			new Block(896, 104, 12, GROUND_Y - 104, PANEL, "static"),
			10,
		);
		const hook = new Block(HOOK.x - 8, HOOK.y - 8, 16, 8, EDGE, "static");
		world.addChild(hook, 15);

		// the links run down from the hook along this direction, each one
		// turned to match, so every joint starts with its two ends together
		const tilt = -0.73;
		const down = { x: Math.sin(tilt), y: Math.cos(tilt) };
		const linkTop = { x: 3, y: 0 };
		let previous: Renderable = hook;
		const links: { body: Renderable; definition: JointDefinition }[] = [];
		for (let i = 0; i < LINKS; i++) {
			const along = LINK_LENGTH * (i + 0.5);
			const link = new Block(
				HOOK.x + down.x * along - 3,
				HOOK.y + down.y * along - LINK_LENGTH / 2,
				6,
				LINK_LENGTH,
				INK,
				"dynamic",
				2,
			);
			world.addChild(link, 20);
			world.adapter.setAngle?.(link, -tilt);
			links.push({
				body: link,
				definition: { type: "hinge", a: previous, b: link, anchorB: linkTop },
			});
			previous = link;
		}
		const reach = LINK_LENGTH * LINKS + BALL_RADIUS;
		this.ball = new Ball(HOOK.x + down.x * reach, HOOK.y + down.y * reach);
		world.addChild(this.ball, 25);
		world.adapter.setAngle?.(this.ball, -tilt);

		// a rope from the hook to the ball: the chain cannot stretch, however
		// hard the ball swings. Invisible, so cutting the chain cuts it too
		const rope = world.addJoint({ type: "rope", a: hook, b: this.ball });
		this.joints.push(rope);
		for (const { body, definition } of links) {
			this.join(definition, body, linkTop, [rope]);
		}
		const ballTop = { x: BALL_RADIUS, y: 0 };
		this.join(
			{ type: "hinge", a: previous, b: this.ball, anchorB: ballTop },
			this.ball,
			ballTop,
			[rope],
		);
	}

	/** Title, adapter buttons, what the running adapter does, and the joint count. */
	private addHeader() {
		const world = this.app.world;
		const text = (
			x: number,
			y: number,
			size: number,
			fill: string,
			value: string,
		) => {
			const label = new Text(x, y, {
				font: "monospace",
				size,
				fillStyle: fill,
				text: value,
			});
			label.isKinematic = true;
			world.addChild(label, 100);
			return label;
		};
		text(
			40,
			16,
			15,
			INK,
			"Ropes & Joints · hinge, rope, removeJoint(), setAdapter()",
		);
		this.count = text(VIEWPORT_W - 140, 18, 12, DIM, "");
		this.note = text(272, 54, 12, DIM, "");
		text(
			40,
			VIEWPORT_H - 26,
			12,
			DIM,
			"click: drop a crate  ·  click a joint: cut it  ·  drag the ball and let go  ·  [S] debug panel",
		);

		const button = (x: number, label: string, onClick: () => void) => {
			const b = new UITextButton(x, 46, {
				font: "monospace",
				size: 14,
				text: label,
				labelFillStyle: INK,
				width: 96,
				height: 30,
				hoverOffColor: PANEL,
				hoverOnColor: EDGE,
				borderColor: EDGE,
				onClick,
			});
			world.addChild(b, 100);
			return b;
		};
		this.buttons = BACKENDS.map(({ id }, i) => {
			return {
				id,
				button: button(40 + i * 104, id, () => {
					void this.switchBackend(id);
				}),
			};
		});
		button(VIEWPORT_W - 136, "reset", () => {
			// once this click is over: the reset removes the button
			timer.setTimeout(() => {
				this.app.world.reset();
				this.build();
			}, 0);
		});
		this.showBackend();
	}

	/** The running adapter's button is the one that cannot be pressed. */
	private showBackend() {
		for (const { id, button } of this.buttons) {
			button.enabled = id !== backend;
		}
		this.note.setText(
			BACKENDS.find((b) => {
				return b.id === backend;
			})?.note ?? "",
		);
	}

	/**
	 * Switch adapter and keep the scene: `setAdapter()` builds every body
	 * again where it stands, then every joint between them.
	 * @param id - the adapter to switch to
	 */
	private async switchBackend(id: string) {
		if (id === backend) {
			return;
		}
		const adapter = await createAdapter(id);
		backend = id;
		this.app.world.setAdapter(adapter);
		this.showBackend();
	}

	override update(dt: number) {
		const live = this.joints.filter((joint) => {
			return joint.native !== null;
		}).length;
		this.count.setText(`${live} joints`);
		this.markers.hover = this.markers.near(this.pointer.x, this.pointer.y);
		return super.update(dt);
	}

	private readonly onMove = (pointer: Pointer) => {
		this.pointer.set(pointer.gameWorldX, pointer.gameWorldY);
		if (this.ball.held !== null) {
			this.ball.held.set(pointer.gameWorldX, pointer.gameWorldY);
		}
	};

	private readonly onDown = (pointer: Pointer) => {
		const x = pointer.gameWorldX;
		const y = pointer.gameWorldY;
		// the header: the buttons have it
		if (y < 90) {
			return;
		}
		const centre = this.ball.centre;
		if (Math.hypot(x - centre.x, y - centre.y) < BALL_RADIUS + 6) {
			this.ball.held = new Vector2d(x, y);
			return;
		}
		const marker = this.markers.near(x, y);
		if (marker !== undefined) {
			this.app.world.removeJoint(marker.joint);
			for (const joint of marker.with) {
				this.app.world.removeJoint(joint);
			}
			return;
		}
		if (y < GROUND_Y - 30) {
			this.app.world.addChild(new Crate(x - 15, y - 15), 20);
		}
	};

	private readonly onUp = () => {
		this.ball.held = null;
	};
}

const createGame = async () => {
	const screen = document.getElementById("screen");

	const app = new Application(VIEWPORT_W, VIEWPORT_H, {
		parent: "screen",
		scaleMethod: "fit",
		...(screen === null ? {} : { scaleTarget: screen }),
		renderer: video.AUTO,
		antiAlias: true,
		physic: await createAdapter(backend),
	});
	await app.init();

	// press S for the debug panel: it draws every body the adapter reports
	plugin.register(DebugPanelPlugin, "debugPanel");

	state.set(state.PLAY, new PlayScreen());
	state.change(state.PLAY);

	// compile Rapier's WebAssembly in the background, so switching to it is
	// instant; a load that fails here is tried again, and reported, by the
	// switch
	RapierAdapter.load().catch(() => {});
};

export const ExampleRopesAndJoints = createExampleComponent(createGame);
