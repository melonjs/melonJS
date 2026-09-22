/**
 * melonJS — what each physics backend does with a `Line`.
 *
 * A `Line` is two points and no area, and Tiled emits one for every polyline
 * you draw, so it is the natural way to author a slope or a bit of ground.
 * Every backend accepts one, and every backend does something different with
 * it, none of which is announced.
 *
 * The scene authors four static pieces of geometry and drops a crate on each.
 * Both layers are drawn: what was AUTHORED, dim and dashed, and what the
 * adapter REPORTS as its collision geometry, bright. Where the bright shape
 * leaves the dim one, the body is not the shape you asked for.
 *
 * That comparison is the whole point. An overlay drawn from the adapter alone
 * always looks self-consistent, because the outline IS the visual; only a
 * second, independent reference shows the substitution.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import { MatterAdapter } from "@melonjs/matter-adapter";
import { PlanckAdapter } from "@melonjs/planck-adapter";
import {
	Application,
	BuiltinAdapter,
	type CanvasRenderer,
	game,
	Line,
	plugin,
	Rect,
	Renderable,
	RoundRect,
	Stage,
	state,
	Text,
	UIBaseElement,
	Vector2d,
	video,
	type WebGLRenderer,
} from "melonjs";
import { createExampleComponent } from "../utils";

const VIEWPORT_W = 960;
const VIEWPORT_H = 640;

/** Matched across backends, as the physics shapes example does. */
const GRAVITY_PX_S2 = 900;

const PARAMS = new URLSearchParams(globalThis.location.search);
const BACKEND = PARAMS.get("physics") ?? "builtin";

const BACKENDS = [
	{
		id: "builtin",
		label: "built-in",
		note: "collides with every segment, sloped ones included, but has no SURFACE friction: nothing removes the pull of gravity along an incline, so the crate slides down the diagonal and off its end, and swings from arm to arm of the valley for a while before settling on the flat. matter and planck have real friction and settle sooner",
	},
	{
		id: "matter",
		label: "matter",
		note: "has no segment primitive, so a line is simulated as a thin quad following it: the crate lands on the slope and slides off the end, and settles in the valley of the polyline",
	},
	{
		id: "planck",
		label: "planck",
		note: "Box2D needs three vertices and silently substitutes a one-metre box for fewer, so a line is simulated as a thin quad following it instead: the crate lands on the slope and settles in the valley of the polyline",
	},
] as const;

const ACTIVE = BACKENDS.find((b) => {
	return b.id === BACKEND;
});

const INK = "#e8eaf2";
const DIM = "#7c84a3";
const PANEL = "#1b1f33";
/** what you asked for */
const AUTHORED = "#5f6b9a";
/** what actually collides */
const REPORTED = "#ff6b6b";

/**
 * A static piece of ground, drawn twice: the shape it was built from, and the
 * shape the adapter says it simulates.
 */
class Ground extends Renderable {
	private readonly authored: Polygon[];
	readonly caption: string;

	constructor(
		x: number,
		y: number,
		w: number,
		h: number,
		shapes: Polygon[],
		caption: string,
	) {
		super(x, y, w, h);
		this.anchorPoint.set(0, 0);
		this.isKinematic = false;
		this.caption = caption;
		this.authored = shapes.map((s) => {
			return s.clone();
		});
		this.bodyDef = { type: "static", shapes };
	}

	override draw(renderer: WebGLRenderer | CanvasRenderer) {
		renderer.save();
		renderer.translate(this.pos.x, this.pos.y);

		// what was authored
		renderer.setColor(AUTHORED);
		renderer.lineWidth = 6;
		for (const shape of this.authored) {
			renderer.stroke(shape, false);
		}

		// what the adapter reports as colliding. These bodies are static and
		// never rotated, so `currentTransform` is the identity and the
		// reported geometry needs no transform undone (see the physics
		// shapes example for the rotating case).
		renderer.setColor(REPORTED);
		renderer.lineWidth = 2;
		for (const shape of game.world.adapter.getBodyShapes(this)) {
			renderer.stroke(shape, false);
		}

		renderer.restore();
	}
}

/** A crate to drop on it. */
class Crate extends Renderable {
	constructor(x: number, y: number) {
		super(x, y, 28, 28);
		this.anchorPoint.set(0, 0);
		this.isKinematic = false;
		this.alwaysUpdate = true;
		this.bodyDef = { type: "dynamic", shapes: [new Rect(0, 0, 28, 28)] };
	}

	override update() {
		// let anything that falls through go
		return this.pos.y < VIEWPORT_H + 600;
	}

	override draw(renderer: WebGLRenderer | CanvasRenderer) {
		renderer.setColor("#ffd166");
		renderer.fillRect(this.pos.x, this.pos.y, this.width, this.height);
	}
}

/** One backend button. */
class BackendButton extends UIBaseElement {
	private readonly active: boolean;
	private readonly target: string;

	constructor(x: number, y: number, label: string, target: string) {
		super(x, y, 108, 30);
		this.target = target;
		this.active = target === BACKEND;
		this.anchorPoint.set(0, 0);
		const text = new Text(54, 15, {
			font: "monospace",
			size: 14,
			fillStyle: this.active ? "#10121c" : INK,
			textAlign: "center",
			textBaseline: "middle",
			text: label,
		});
		text.floating = false;
		this.addChild(text);
	}

	override onClick() {
		globalThis.location.search = `?physics=${this.target}`;
		return true;
	}

	override draw(renderer: WebGLRenderer | CanvasRenderer) {
		const pill = new RoundRect(
			this.pos.x,
			this.pos.y,
			this.width,
			this.height,
			8,
		);
		renderer.setColor(this.active ? INK : PANEL);
		renderer.stroke(pill, true);
		renderer.setColor(this.active ? INK : "#39406b");
		renderer.lineWidth = 1;
		renderer.stroke(pill, false);
		super.draw(renderer);
	}
}

class PlayScreen extends Stage {
	override onResetEvent() {
		game.world.backgroundColor.parseCSS("#10121c");

		const title = new Text(40, 16, {
			font: "monospace",
			size: 15,
			fillStyle: INK,
			text: "What each backend does with a Line",
		});
		title.isKinematic = true;
		game.world.addChild(title, 100);

		BACKENDS.forEach((b, i) => {
			game.world.addChild(
				new BackendButton(40 + i * 120, 46, b.label, b.id),
				100,
			);
		});

		const note = new Text(408, 50, {
			font: "monospace",
			size: 12,
			fillStyle: DIM,
			text: ACTIVE?.note ?? "",
			wordWrapWidth: VIEWPORT_W - 448,
		});
		note.isKinematic = true;
		game.world.addChild(note, 100);

		const legend = new Text(40, VIEWPORT_H - 26, {
			font: "monospace",
			size: 12,
			fillStyle: DIM,
			text: "dim = the shape authored     red = the geometry the adapter reports as colliding     [S] debug panel",
		});
		legend.isKinematic = true;
		game.world.addChild(legend, 100);

		// four pieces of ground, 220px apart, each with a crate above it
		const column = (i: number) => {
			return 60 + i * 225;
		};

		// 0: a Rect, as a control. Every backend gets this right.
		game.world.addChild(
			new Ground(
				column(0),
				420,
				180,
				20,
				[new Rect(0, 0, 180, 20)],
				"Rect (control)",
			),
			10,
		);
		// 1: a horizontal Line
		game.world.addChild(
			new Ground(
				column(1),
				420,
				180,
				20,
				[new Line(0, 0, [new Vector2d(0, 0), new Vector2d(180, 0)])],
				"Line, horizontal",
			),
			10,
		);
		// 2: a diagonal Line, the slope case
		game.world.addChild(
			new Ground(
				column(2),
				360,
				180,
				100,
				[new Line(0, 0, [new Vector2d(0, 0), new Vector2d(180, 100)])],
				"Line, diagonal",
			),
			10,
		);
		// 3: a polyline, as Tiled actually emits one: a CHAIN OF SEGMENTS,
		// not a closed polygon. Authoring the same points as a single
		// `Polygon` would close the loop back to the start and, for points
		// like these, self-intersect into a bow tie with no well defined
		// inside, which is a different bug from anything the backends do.
		game.world.addChild(
			new Ground(
				column(3),
				380,
				180,
				80,
				[
					new Line(0, 0, [new Vector2d(0, 10), new Vector2d(60, 60)]),
					new Line(0, 0, [new Vector2d(60, 60), new Vector2d(120, 60)]),
					new Line(0, 0, [new Vector2d(120, 60), new Vector2d(180, 10)]),
				],
				"polyline, 3 segments",
			),
			10,
		);

		for (const child of game.world.getChildren()) {
			if (child instanceof Ground) {
				const label = new Text(child.pos.x, 500, {
					font: "monospace",
					size: 12,
					fillStyle: DIM,
					text: child.caption,
					wordWrapWidth: 200,
				});
				label.isKinematic = true;
				game.world.addChild(label, 100);
				// The polyline gets its crate over the LEFT slope rather than
				// the middle, so it slides down the incline and comes to rest
				// on the flat segment: three segments acting as one surface is
				// the thing worth seeing, not a single contact.
				game.world.addChild(
					new Crate(
						child.pos.x + (child.caption.startsWith("polyline") ? 14 : 70),
						120,
					),
					20,
				);
			}
		}
	}
}

const createGame = async () => {
	const scaleTarget = document.getElementById("screen") ?? undefined;

	// the same per-backend gravity units as the physics shapes example
	const physic =
		BACKEND === "planck"
			? new PlanckAdapter({ gravity: { x: 0, y: GRAVITY_PX_S2 } })
			: BACKEND === "matter"
				? new MatterAdapter()
				: new BuiltinAdapter({
						gravity: new Vector2d(0, (GRAVITY_PX_S2 / 4453) * 0.98),
					});

	const app = new Application(VIEWPORT_W, VIEWPORT_H, {
		parent: "screen",
		scaleMethod: "fit",
		scaleTarget,
		renderer: video.AUTO,
		antiAlias: true,
		physic,
	});
	await app.init();

	// The panel's hitbox overlay reads the same `getBodyShapes()` this example
	// strokes, so the two agree: it is the quickest way to check what a
	// backend is really simulating. Press S.
	plugin.register(DebugPanelPlugin, "debugPanel");

	state.set(state.PLAY, new PlayScreen());
	state.change(state.PLAY);
};

export const ExampleLineCollision = createExampleComponent(createGame);
