import {
	Application,
	Box3d,
	boot,
	Camera3d,
	Container,
	collision,
	Matrix3d,
	Mesh,
	plugin,
	Renderable,
	video,
} from "melonjs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DebugPanelPlugin } from "../src/index.js";

/**
 * The hitbox overlay in a 3D scene.
 *
 * Under a `Camera3d` the renderer is mid-perspective-projection, so the flat
 * `renderer.stroke(shape)` the 2D overlay uses draws nothing viewable — a box
 * has to be projected corner by corner and stroked against a screen ortho.
 * Only the mesh GEOMETRY box did that, which left two holes:
 *
 * - a `Mesh` returned straight after its green box and never drew the
 *   collision shapes, so a 3D body was invisible in the overlay;
 * - a `GLTFModel` is a `Container`, not a `Mesh`, so it fell through to the
 *   2D path and drew nothing at all.
 */

/** the 12 edges of a box — what one wireframe costs in `strokeLine` calls */
const BOX_EDGE_COUNT = 12;

/**
 * A renderer double that records the overlay's drawing calls. The overlay is
 * pure geometry, so the test asserts WHAT was asked for rather than pixels.
 * @returns the double plus the recorded calls
 */
function recorder() {
	const lines = [];
	const strokes = [];
	const rects = [];
	let color = null;
	const base = {
		projectionMatrix: new Matrix3d(),
		currentTransform: new Matrix3d(),
		lineWidth: 1,
		setColor(value) {
			color = value;
		},
		stroke(shape) {
			strokes.push({ color, type: shape.type });
		},
		strokeLine(x0, y0, x1, y1) {
			lines.push({ color, x0, y0, x1, y1 });
		},
		strokeRect(x, y, w, h) {
			rects.push({ color, x, y, w, h });
		},
	};
	// `postDraw` runs the renderable's whole teardown, not just the overlay, so
	// anything the double does not care about answers with a no-op rather than
	// being listed here — the test is about the geometry, not the state calls
	const renderer = new Proxy(base, {
		get(target, key) {
			if (key in target) {
				return target[key];
			}
			return () => {};
		},
	});

	return { renderer, lines, strokes, rects };
}

/** a sensor body definition carrying a single Box3d */
const box3dBody = () => {
	return {
		type: "static",
		shapes: [new Box3d(0, 0, 0, 40, 50, 60)],
		collisionType: collision.types.ENEMY_OBJECT,
		collisionMask: collision.types.ALL_OBJECT,
		isSensor: true,
	};
};

describe("DebugPanelPlugin hitbox overlay in 3D", () => {
	let panel;
	let app;

	beforeAll(async () => {
		await boot();
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.AUTO,
			cameraClass: Camera3d,
		});
		await app.init();
		plugin.register(DebugPanelPlugin, "debugPanel");
		panel = plugin.cache.debugPanel;
	});

	beforeEach(() => {
		panel.options.hitbox = true;
		panel.options.velocity = false;
		app.world.reset();
	});

	/**
	 * Put a renderable in the world so it resolves `parentApp` (for the camera
	 * and the physics adapter), and register its body.
	 * @param child - the renderable to add
	 * @returns the same renderable
	 */
	const place = (child) => {
		child.isKinematic = false;
		app.world.addChild(child, 400);
		child.pos.set(0, 0, 400);
		return child;
	};

	const mesh = () => {
		return new Mesh(0, 0, {
			vertices: new Float32Array([-8, -8, 0, 8, -8, 0, 0, 8, 0]),
			width: 16,
			height: 16,
		});
	};

	it("draws a mesh's collision shape, not just its geometry box", () => {
		const subject = mesh();
		subject.bodyDef = box3dBody();
		place(subject);
		const { renderer, lines } = recorder();

		subject.postDraw(renderer);

		// green is the geometry box, red is what it collides as — the red one
		// was never drawn, because the mesh path returned first
		const red = lines.filter((line) => {
			return line.color === "red";
		});
		const green = lines.filter((line) => {
			return line.color === "green";
		});
		expect(green).toHaveLength(BOX_EDGE_COUNT);
		expect(red).toHaveLength(BOX_EDGE_COUNT);
	});

	it("draws the shapes of a CONTAINER that is not a Mesh", () => {
		// the `GLTFModel` shape: a container carrying the body, which used to
		// fall through to the 2D path and render nothing
		const model = new Container(0, 0, Infinity, Infinity);
		model.bodyDef = box3dBody();
		place(model);
		const { renderer, lines, strokes } = recorder();

		model.postDraw(renderer);

		expect(
			lines.filter((line) => {
				return line.color === "red";
			}),
		).toHaveLength(BOX_EDGE_COUNT);
		// and NOT via the flat 2D path, which cannot project
		expect(strokes).toHaveLength(0);
	});

	it("draws a Box3d at its real depth, not as a flat rectangle", () => {
		const subject = mesh();
		subject.bodyDef = box3dBody();
		place(subject);
		const { renderer, lines } = recorder();

		subject.postDraw(renderer);

		// A flat box projects its two faces to identical screen points, so
		// every connecting edge would have zero length. A box with depth
		// projects them apart.
		const red = lines.filter((line) => {
			return line.color === "red";
		});
		const withLength = red.filter((line) => {
			return line.x0 !== line.x1 || line.y0 !== line.y1;
		});
		expect(withLength).toHaveLength(BOX_EDGE_COUNT);
	});

	it("draws nothing extra when the overlay is off", () => {
		const subject = mesh();
		subject.bodyDef = box3dBody();
		place(subject);
		panel.options.hitbox = false;
		const { renderer, lines, strokes } = recorder();

		subject.postDraw(renderer);

		expect(lines).toHaveLength(0);
		expect(strokes).toHaveLength(0);
	});

	it("leaves a body-less mesh to its geometry box alone", () => {
		const subject = place(mesh());
		const { renderer, lines } = recorder();

		subject.postDraw(renderer);

		expect(
			lines.filter((line) => {
				return line.color === "green";
			}),
		).toHaveLength(BOX_EDGE_COUNT);
		expect(
			lines.filter((line) => {
				return line.color === "red";
			}),
		).toHaveLength(0);
	});
});

describe("DebugPanelPlugin hitbox overlay in 2D", () => {
	// The 3D branch is entered on the CAMERA, not on the renderable, so a 2D
	// game must be completely unaffected by it: under a `Camera2d` a mesh
	// self-projects and everything falls through to the flat overlay, which is
	// the path the great majority of games are on.
	let panel;
	let app;

	beforeAll(async () => {
		await boot();
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.AUTO,
		});
		await app.init();
		panel = plugin.cache.debugPanel;
	});

	beforeEach(() => {
		panel.options.hitbox = true;
		app.world.reset();
	});

	it("strokes a Box3d body without leaning on the engine dispatcher", () => {
		// `Renderer#stroke` only learned `Box3d` in melonJS 20.5 and threw
		// `Invalid geometry` before that. The plugin supports older engines, so
		// the 2D path draws the footprint itself.
		const subject = new Renderable(0, 0, 32, 48);
		subject.isKinematic = false;
		subject.bodyDef = {
			type: "static",
			shapes: [new Box3d(0, 0, 0, 40, 50, 60)],
			collisionType: collision.types.ENEMY_OBJECT,
			collisionMask: collision.types.ALL_OBJECT,
			isSensor: true,
		};
		app.world.addChild(subject);
		const { renderer, strokes, rects } = recorder();

		expect(() => {
			return subject.postDraw(renderer);
		}).not.toThrow();

		// the footprint went out as a plain rect, never through `stroke(shape)`
		expect(rects.length).toBeGreaterThan(0);
		expect(
			strokes.some((entry) => {
				return entry.type === "Box3d";
			}),
		).toBe(false);
	});

	it("still strokes the flat bounds under a Camera2d", () => {
		const subject = new Renderable(0, 0, 32, 48);
		subject.isKinematic = false;
		app.world.addChild(subject);
		const { renderer, lines, strokes } = recorder();

		subject.postDraw(renderer);

		// the green renderable bounds, through the 2D path — and no projected
		// wireframe, because there is no 3D camera to project against
		expect(
			strokes.filter((entry) => {
				return entry.color === "green";
			}).length,
		).toBeGreaterThan(0);
		expect(lines).toHaveLength(0);
	});
});
