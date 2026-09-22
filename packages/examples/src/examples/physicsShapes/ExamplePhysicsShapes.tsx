/**
 * melonJS — collision shapes from a shape editor, on every physics backend.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * One shape file, one body definition, three solvers. The buttons along the
 * top switch backend; nothing else in the scene changes when they do.
 *
 * Every body is drawn from what the adapter reports as its ACTUAL collision
 * geometry (`world.adapter.getBodyShapes`) rather than from a sprite, so what
 * is on screen is what collides — including each solver's own approximations.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import { MatterAdapter } from "@melonjs/matter-adapter";
import { PlanckAdapter } from "@melonjs/planck-adapter";
import {
	Application,
	BuiltinAdapter,
	type CanvasRenderer,
	game,
	loader,
	Matrix3d,
	plugin,
	Rect,
	Renderable,
	RoundRect,
	Stage,
	state,
	Text,
	timer,
	UIBaseElement,
	Vector2d,
	video,
	type WebGLRenderer,
} from "melonjs";
import { createExampleComponent } from "../utils";

const VIEWPORT_W = 960;
const VIEWPORT_H = 640;

/**
 * matter's own default fall speed, measured in this scene by timing a 200px
 * free fall. It is the reference the other two backends are matched to, so
 * the three piles are comparable.
 */
const GRAVITY_PX_S2 = 900;

const PARAMS = new URLSearchParams(globalThis.location.search);
const BACKEND = PARAMS.get("physics") ?? "matter";

/**
 * The backends, and the honest one-line version of what each one does with a
 * body once it has it. The built-in solver looking different here is the point
 * of the example rather than a fault in it.
 */
const BACKENDS = [
	{
		id: "builtin",
		label: "built-in",
		note: "arcade SAT. The outlines are tilted here because the example calls `body.rotate()`, which turns the shape points themselves: `setAngle` would turn the sprite alone, since the SAT never reads `body.angle`. So rotation is a one-time bake, not a tracked angle, and nothing tumbles on impact. Stacked bodies also rest overlapping. Use matter or planck to rotate and stack for real",
	},
	{
		id: "matter",
		label: "matter",
		note: "full rigid body: compound shapes rotate and stack for real",
	},
	{
		id: "planck",
		label: "planck",
		note: "full rigid body (Box2D): compound shapes rotate and stack for real",
	},
] as const;

const ACTIVE = BACKENDS.find((b) => {
	return b.id === BACKEND;
});

/** The bodies in the shape file, and how each one was authored. */
const BODIES = [
	{ id: "star", colour: "#ffd166", note: "6 convex pieces" },
	{ id: "hook", colour: "#06d6a0", note: "3 pieces, as points" },
	{ id: "cog", colour: "#ef476f", note: "circle + 4 polygons" },
	{ id: "crate", colour: "#118ab2", note: "1 convex piece" },
] as const;

/**
 * The artwork is generated FROM the shape file, by
 * `scripts/generate-physics-shape-sprites.mjs`, in the same coordinate
 * space: image pixel (0, 0) is the body's local origin. So the sprite and
 * the collision outline are drawn from one source of truth, and any gap
 * between them on screen is a real bug rather than an authoring mismatch.
 *
 * That gap is the whole reason the art exists. Drawing only the outlines
 * each adapter reports looks correct by construction, because the outline
 * IS the visual: a body placed slightly wrong draws a slightly wrong
 * outline and nothing looks amiss. The matter adapter shipped exactly that
 * bug (polygon placement, fixed in 1.4.1) and this scene could not show it.
 */
const ART = "#e8eaf2";

/**
 * Scratch for undoing a renderable's own transform, reused every frame so
 * the draw path allocates nothing.
 */
const INVERSE = new Matrix3d();

const INK = "#e8eaf2";
const DIM = "#7c84a3";
const PANEL = "#1b1f33";

/**
 * A body drawn from its own collision geometry.
 *
 * Two placement rules apply to any custom `draw()`, and both bite silently:
 * the renderer is not pre-translated to the renderable's `pos`, and `preDraw`
 * still applies the anchor offset even when `autoTransform` is off. So read
 * `this.pos`, and zero the anchor.
 *
 * `autoTransform` is off deliberately: the shapes the adapter reports are
 * already in their simulated orientation, so letting the renderable apply its
 * own transform on top would turn everything twice.
 */
class ShapeBody extends Renderable {
	readonly colour: string;
	readonly art: string;

	constructor(x: number, y: number, id: string, colour: string, still = false) {
		// sized from the artwork, which is sized from the shape file, so the
		// renderable's bounds agree with both rather than being a guess
		const image = loader.getImage(id);
		super(x, y, image?.width ?? 64, image?.height ?? 64);
		this.art = id;
		this.colour = colour;
		// (0, 0) is load-bearing here, not a default. `anchorPoint` shifts a
		// renderable's bounds and its drawing, but NOT its collision shapes,
		// which are measured from `pos`. Any other anchor therefore draws the
		// body offset from the geometry it collides with: measured at anchor
		// 0.5, a 44px crate rests with its shapes on the floor at 360 while
		// its bounds stop at 338. The physics is identical either way.
		this.anchorPoint.set(0, 0);
		// ON, so `preDraw` turns the sprite and, just as importantly,
		// `updateBounds()` reports the rotated extent. With it off the engine
		// does not know the renderable is turned at all, and the debug
		// panel's green bounds stay stuck on the unrotated frame while the
		// artwork tilts inside them. The collision shapes below need the
		// transform UNDONE rather than never applied, which is what the
		// inverse in `draw()` is for.
		this.autoTransform = true;
		this.isKinematic = false;
		// the shape file, named by the key it was preloaded under, and the
		// body to read out of it. Identical on all three backends.
		this.bodyDef = {
			type: still ? "static" : "dynamic",
			shapes: "shapes",
			id,
		};
	}

	override update() {
		// let anything that has fallen out of the world go
		return this.pos.y < VIEWPORT_H + 400;
	}

	override draw(renderer: WebGLRenderer | CanvasRenderer) {
		// The sprite just draws at `pos`. `preDraw` has already applied this
		// renderable's transform, which the adapter keeps in step with the
		// body's angle, so this is exactly what any ordinary game sprite
		// gets and it needs no special handling here.
		const image = loader.getImage(this.art);
		if (image !== null) {
			renderer.drawImage(image, this.pos.x, this.pos.y);
		}

		// The collision geometry is the odd one out: `getBodyShapes()`
		// reports it ALREADY in its simulated pose, so `preDraw`'s transform
		// has to be undone or every shape turns twice.
		//
		// `preDraw` maps a point v to `pos + T(v - pos - anchor)`, so placing
		// an already-posed point q takes v = pos + anchor + T⁻¹(q). The
		// anchor is (0, 0) here, which leaves the translate and the inverse
		// below.
		const shapes = game.world.adapter.getBodyShapes(this);
		renderer.save();
		renderer.translate(this.pos.x, this.pos.y);
		if (!this.currentTransform.isIdentity()) {
			INVERSE.copy(this.currentTransform).invert();
			renderer.transform(INVERSE);
		}
		renderer.setColor(ART);
		renderer.lineWidth = 1;
		for (const shape of shapes) {
			renderer.stroke(shape, false);
		}
		renderer.restore();
	}
}

/** A static wall, authored in code rather than imported. */
class Wall extends Renderable {
	constructor(x: number, y: number, w: number, h: number) {
		super(x, y, w, h);
		this.anchorPoint.set(0, 0);
		this.autoTransform = false;
		this.isKinematic = false;
		// authored shapes and imported ones live side by side
		this.bodyDef = { type: "static", shapes: [new Rect(0, 0, w, h)] };
	}

	override draw(renderer: WebGLRenderer | CanvasRenderer) {
		renderer.setColor("#39406b");
		renderer.fillRect(this.pos.x, this.pos.y, this.width, this.height);
	}
}

/**
 * One backend button. `UIBaseElement` carries the pointer plumbing, so this
 * only has to say what it looks like and what a click means.
 */
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
		// the adapter is chosen when the Application is constructed, so
		// switching one means booting the example again
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
	private spawned = 0;

	override onResetEvent() {
		game.world.backgroundColor.parseCSS("#10121c");

		game.world.addChild(new Wall(0, VIEWPORT_H - 40, VIEWPORT_W, 40), 10);
		game.world.addChild(new Wall(0, 0, 24, VIEWPORT_H), 10);
		game.world.addChild(new Wall(VIEWPORT_W - 24, 0, 24, VIEWPORT_H), 10);
		// a shelf for the specimens, and a shallow funnel so the pile builds
		// where it can be seen
		game.world.addChild(new Wall(24, 236, VIEWPORT_W - 48, 10), 10);
		game.world.addChild(new Wall(24, VIEWPORT_H - 150, 130, 16), 10);
		game.world.addChild(
			new Wall(VIEWPORT_W - 154, VIEWPORT_H - 150, 130, 16),
			10,
		);

		this.addHeader();
		this.addSpecimens();

		// then drop a pile of the same bodies onto the floor. Deterministic
		// columns rather than a random x: bodies dropped on top of each other
		// would be born overlapping, which no solver is required to untangle.
		const columns = 5;
		timer.setInterval(() => {
			if (this.spawned >= 25) {
				return;
			}
			const body = BODIES[this.spawned % BODIES.length];
			const column = this.spawned % columns;
			const x = 230 + column * ((VIEWPORT_W - 560) / (columns - 1));
			const shape = new ShapeBody(x, 290, body.id, body.colour);
			game.world.addChild(shape, 20);
			// drop each one already tilted, so it lands off balance and has
			// somewhere to topple to
			const tilt = ((this.spawned * 37) % 360) * (Math.PI / 180);
			if (BACKEND === "builtin") {
				// `setAngle` on the builtin solver turns the SPRITE only: its
				// SAT never reads `body.angle`, so the hitbox would stay
				// upright under the artwork. `body.rotate()` is the supported
				// way to get rotated collision there, and it genuinely turns
				// the shape points.
				//
				// It bakes the rotation in rather than tracking an angle, so
				// the pivot has to be captured BEFORE the call (rotating the
				// shapes moves the bounds, and with it their centre), and the
				// sprite is turned about that same point by hand. `angle` is
				// left at 0 deliberately: non-zero makes the body re-sync its
				// own transform every step, from the NEW bounds centre, which
				// would pull the sprite off the shapes it just matched.
				const pivot = shape.body.getBounds().center;
				const px = pivot.x;
				const py = pivot.y;
				shape.body.rotate(tilt);
				shape.currentTransform
					.translate(px, py)
					.rotate(tilt)
					.translate(-px, -py);
			} else {
				shape.body.setAngle?.(tilt);
			}
			this.spawned++;
		}, 460);
	}

	/** Title, backend buttons, and what the running backend does. */
	private addHeader() {
		const title = new Text(40, 16, {
			font: "monospace",
			size: 15,
			fillStyle: INK,
			text: "One shape file, one bodyDef, three physics backends",
		});
		title.isKinematic = true;
		game.world.addChild(title, 100);

		BACKENDS.forEach((backend, i) => {
			game.world.addChild(
				new BackendButton(40 + i * 120, 46, backend.label, backend.id),
				100,
			);
		});

		// what the two layers on every body mean. Worth stating outright:
		// the sprite is generated from the shape file, so wherever the
		// outline leaves the artwork, the body is not where it looks.
		const legend = new Text(40, VIEWPORT_H - 26, {
			font: "monospace",
			size: 12,
			fillStyle: DIM,
			text: "sprite = artwork from the shape file    outline = the geometry the adapter reports as colliding    [S] debug panel",
		});
		legend.isKinematic = true;
		game.world.addChild(legend, 100);

		const note = new Text(408, 50, {
			font: "monospace",
			size: 12,
			fillStyle: DIM,
			text: ACTIVE?.note ?? "",
			wordWrapWidth: VIEWPORT_W - 448,
		});
		note.isKinematic = true;
		game.world.addChild(note, 100);
	}

	/** One still specimen of each body, so the geometry can be read. */
	private addSpecimens() {
		BODIES.forEach((body, i) => {
			const x = 84 + i * 214;
			game.world.addChild(
				new ShapeBody(x, 130, body.id, body.colour, true),
				20,
			);
			const label = new Text(x, 200, {
				font: "monospace",
				size: 12,
				fillStyle: body.colour,
				text: `${body.id}: ${body.note}`,
				wordWrapWidth: 200,
			});
			label.isKinematic = true;
			game.world.addChild(label, 100);
		});
	}
}

const createGame = async () => {
	const scaleTarget = document.getElementById("screen") ?? undefined;

	// Gravity matched to MATTER across all three, which takes explicit numbers
	// because the defaults are not comparable. Measured by timing a 200px free
	// fall in this very scene: the built-in world falls at ~4450 px/s², matter
	// at ~900 and planck at ~330, a thirteenfold spread. Each is "Earth-like"
	// in its own unit (the built-in applies gravity per FRAME, integrated
	// against `timer.tick`; planck takes px/s²; matter takes its own scaled
	// figure), and comparing backends is worthless unless they agree.
	const physic =
		BACKEND === "planck"
			? new PlanckAdapter({ gravity: { x: 0, y: GRAVITY_PX_S2 } })
			: BACKEND === "matter"
				? new MatterAdapter() // the reference: its own default
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

	// The debug panel reads its hitboxes from `adapter.getBodyShapes()`, the
	// same call this example draws its outlines with, so the two overlays
	// agree by construction. Press S to open it.
	plugin.register(DebugPanelPlugin, "debugPanel");

	await loader.preload([
		// the shape editor's export, preloaded like any other JSON
		{ name: "shapes", type: "json", src: "assets/physicsShapes/shapes.json" },
		// and the artwork generated from it, one image per body, each keyed
		// by the body name so a sprite and its shapes cannot be wired to
		// different bodies by mistake
		...BODIES.map((body) => {
			return {
				name: body.id,
				type: "image" as const,
				src: `assets/physicsShapes/${body.id}.png`,
			};
		}),
	]);

	state.set(state.PLAY, new PlayScreen());
	state.change(state.PLAY);
};

export const ExamplePhysicsShapes = createExampleComponent(createGame);
