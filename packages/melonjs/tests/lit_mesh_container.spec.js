import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	boot,
	Camera3d,
	Container,
	Light3d,
	Matrix3d,
	Mesh,
	state,
	TextureAtlas,
	Vector3d,
} from "../src/index.js";
import { packMeshLights } from "../src/video/webgl/lighting/pack3d.ts";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

/**
 * A lit mesh inside a moved or turned `Container` was lit as though the
 * container were not there.
 *
 * `mesh-lit.vert` takes `uModelMatrix * position` as the world position and
 * `mat3(uModelMatrix) * normal` as the world normal, but `uModelMatrix` is
 * only the mesh's OWN placement: every ancestor's transform is folded into
 * `uViewMatrix` by `Container#draw` / `preDraw`. `Light3d` positions and
 * directions are uploaded in the world's frame. So a mesh one container down
 * is lit in its PARENT's frame against lights in the world's: drawn in the
 * right place, but with a point light measured from the wrong spot and a
 * face turned by its container still lit as if it faced the old way.
 *
 * Proven at the pixel: a nested mesh must be lit exactly like the same mesh
 * placed directly at the same world position and orientation.
 */
describe("lit mesh inside a transformed container", () => {
	const SIZE = 128;
	let renderer;
	let cam;
	let stage;
	let savedLights;

	beforeAll(async () => {
		await boot();
		try {
			renderer = await getWebGLRenderer(SIZE, SIZE);
		} catch {
			// genuinely unavailable — every test below skips
		}
		cam = new Camera3d(0, 0, SIZE, SIZE);
		cam.setPosition(0, 0, 0);
		cam.update(0);
		stage = state.current();
		savedLights = stage?._activeLights3d;
	});

	afterAll(() => {
		if (stage) {
			stage._activeLights3d = savedLights;
		}
		releaseWebGLRenderer();
	});

	const requireWebGL = (ctx) => {
		if (renderer === undefined || stage === undefined) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	const white = () => {
		const canvas = document.createElement("canvas");
		canvas.width = 4;
		canvas.height = 4;
		const c2d = canvas.getContext("2d");
		c2d.fillStyle = "#ffffff";
		c2d.fillRect(0, 0, 4, 4);
		return new TextureAtlas(
			{ framewidth: 4, frameheight: 4, image: canvas },
			canvas,
		);
	};

	// a lit 200 × 200 quad centred on its origin, normal toward the camera
	const litQuad = () => {
		const mesh = new Mesh(0, 0, {
			vertices: new Float32Array([
				-100, -100, 0, 100, -100, 0, 100, 100, 0, -100, 100, 0,
			]),
			uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
			indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
			normals: new Float32Array([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]),
			texture: white(),
			width: 200,
			height: 200,
			scale: 1,
			normalize: false,
			cullBackFaces: false,
			castGroundShadow: false,
			lit: true,
		});
		return mesh;
	};

	const makeRoot = () => {
		const root = new Container(0, 0, Infinity, Infinity);
		root.autoDepth = false;
		root.root = true;
		return root;
	};

	/** red channel of the centre pixel after drawing `root` under `lights` */
	const centre = (root, lights) => {
		const markInView = (c) => {
			for (const child of c.getChildren()) {
				child.inViewport = true;
				// what `Mesh#onActivateEvent` sets when a mesh joins a world
				// whose camera is a Camera3d (this app's own is a Camera2d), and
				// what keeps the 2D anchor offset out of the world-space path
				if (child instanceof Mesh) {
					child._useWorldSpace = true;
				}
				if (child instanceof Container) {
					markInView(child);
				}
			}
		};
		markInView(root);
		stage._activeLights3d = new Set(lights);
		renderer.backgroundColor.setColor(0, 0, 0, 255);
		renderer.clear();
		cam.draw(renderer, root);
		renderer.flush();
		const gl = renderer.gl;
		gl.finish();
		const px = new Uint8Array(4);
		gl.readPixels(SIZE / 2, SIZE / 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
		return px[0];
	};

	// a point light just in front of the quad's centre, with a short reach
	const lamp = () => {
		return new Light3d({
			type: "point",
			position: [0, 0, 250],
			range: 400,
			intensity: 1,
			color: [1, 1, 1],
		});
	};

	// a sun shining straight away from the camera onto a face that faces it
	const sun = () => {
		return new Light3d({
			type: "directional",
			direction: [0, 0, 1],
			intensity: 1,
			color: [1, 1, 1],
		});
	};

	describe("the bug: lit in the parent's frame, not the world's", () => {
		it("a point light reaches a mesh carried there by a moved container", (ctx) => {
			requireWebGL(ctx);
			const flat = makeRoot();
			flat.addChild(litQuad(), 300);
			const expected = centre(flat, [lamp()]);
			// sanity: the lamp really lights the quad
			expect(expected).toBeGreaterThan(100);

			// the same world placement, reached through a container moved 1000
			// to the right holding the mesh 1000 to the left
			const root = makeRoot();
			const group = new Container(0, 0, Infinity, Infinity);
			group.autoDepth = false;
			group.pos.x = 1000;
			root.addChild(group, 0);
			const mesh = litQuad();
			group.addChild(mesh, 300);
			mesh.pos.x = -1000;
			expect(Math.abs(centre(root, [lamp()]) - expected)).toBeLessThanOrEqual(
				2,
			);
		});

		it("a face turned away by its container is not lit as if it faced the sun", (ctx) => {
			requireWebGL(ctx);
			// reference: the quad turned half a turn by its OWN transform,
			// so its lit face points away from the camera and the sun
			const flat = makeRoot();
			const own = litQuad();
			own.rotate(Math.PI, new Vector3d(0, 1, 0));
			flat.addChild(own, 300);
			const expected = centre(flat, [sun()]);

			// unturned, it is fully lit: the turn is what makes the difference
			const facing = makeRoot();
			facing.addChild(litQuad(), 300);
			expect(centre(facing, [sun()])).toBeGreaterThan(expected + 50);

			// the same turn done by a container
			const root = makeRoot();
			const group = new Container(0, 0, Infinity, Infinity);
			group.autoDepth = false;
			group.rotate(Math.PI, new Vector3d(0, 1, 0));
			root.addChild(group, 0);
			// half a turn about Y takes local z = -300 to world z = 300
			group.addChild(litQuad(), -300);
			expect(Math.abs(centre(root, [sun()]) - expected)).toBeLessThanOrEqual(2);
		});

		it("a transparent lit mesh, replayed after the walk, is lit the same way", (ctx) => {
			requireWebGL(ctx);
			const faded = () => {
				const mesh = litQuad();
				mesh.transparent = true;
				return mesh;
			};
			const flat = makeRoot();
			flat.addChild(faded(), 300);
			const expected = centre(flat, [lamp()]);
			expect(expected).toBeGreaterThan(100);

			const root = makeRoot();
			const group = new Container(0, 0, Infinity, Infinity);
			group.autoDepth = false;
			group.pos.x = 1000;
			root.addChild(group, 0);
			const mesh = faded();
			group.addChild(mesh, 300);
			mesh.pos.x = -1000;
			expect(Math.abs(centre(root, [lamp()]) - expected)).toBeLessThanOrEqual(
				2,
			);
		});
	});

	describe("normal behaviour the fix must keep", () => {
		// record what the lit batcher is handed for each lit draw
		const spaces = (root, lights) => {
			const seen = [];
			const original = renderer._lightSpaceInverse;
			if (original === undefined) {
				// no light space at all: every light goes up as authored
				centre(root, lights);
				return seen;
			}
			renderer._lightSpaceInverse = function () {
				const m = original.call(this);
				seen.push(m === null ? null : Array.from(m.val));
				return m;
			};
			try {
				centre(root, lights);
			} finally {
				renderer._lightSpaceInverse = original;
			}
			return seen;
		};

		it("a lit mesh straight in the world gets its lights exactly as authored", (ctx) => {
			requireWebGL(ctx);
			const root = makeRoot();
			root.addChild(litQuad(), 300);
			const seen = spaces(root, [lamp(), sun()]);
			for (const m of seen) {
				expect(m).toBe(null);
			}
			expect(centre(root, [lamp()])).toBeGreaterThan(100);
		});

		it("so does one in a container that is not moved or turned", (ctx) => {
			requireWebGL(ctx);
			const root = makeRoot();
			const group = new Container(0, 0, Infinity, Infinity);
			group.autoDepth = false;
			root.addChild(group, 0);
			group.addChild(litQuad(), 300);
			const seen = spaces(root, [lamp()]);
			for (const m of seen) {
				expect(m).toBe(null);
			}
		});

		it("a sun is unchanged by a container that only moves", (ctx) => {
			requireWebGL(ctx);
			const flat = makeRoot();
			flat.addChild(litQuad(), 300);
			const expected = centre(flat, [sun()]);
			const root = makeRoot();
			const group = new Container(0, 0, Infinity, Infinity);
			group.autoDepth = false;
			group.pos.x = 1000;
			root.addChild(group, 0);
			const mesh = litQuad();
			group.addChild(mesh, 300);
			mesh.pos.x = -1000;
			expect(centre(root, [sun()])).toBe(expected);
		});

		it("an ambient light is unchanged by a turned container", (ctx) => {
			requireWebGL(ctx);
			const ambient = () => {
				return new Light3d({ type: "ambient", intensity: 0.5 });
			};
			const flat = makeRoot();
			flat.addChild(litQuad(), 300);
			const expected = centre(flat, [ambient()]);
			expect(expected).toBeGreaterThan(50);
			const root = makeRoot();
			const group = new Container(0, 0, Infinity, Infinity);
			group.autoDepth = false;
			group.rotate(Math.PI, new Vector3d(0, 1, 0));
			root.addChild(group, 0);
			group.addChild(litQuad(), -300);
			expect(centre(root, [ambient()])).toBe(expected);
		});

		it("an unlit mesh in a moved container is drawn as before", (ctx) => {
			requireWebGL(ctx);
			const unlit = () => {
				const mesh = litQuad();
				mesh.lit = false;
				return mesh;
			};
			const flat = makeRoot();
			flat.addChild(unlit(), 300);
			const expected = centre(flat, [lamp()]);
			expect(expected).toBe(255);
			const root = makeRoot();
			const group = new Container(0, 0, Infinity, Infinity);
			group.autoDepth = false;
			group.pos.x = 1000;
			root.addChild(group, 0);
			const mesh = unlit();
			group.addChild(mesh, 300);
			mesh.pos.x = -1000;
			expect(centre(root, [lamp()])).toBe(expected);
		});

		it("a draw outside any world walk keeps the lights as authored", (ctx) => {
			requireWebGL(ctx);
			if (renderer._lightSpaceInverse === undefined) {
				return;
			}
			renderer.resetFrameState();
			renderer.currentTransform.translate(123, 45, 6);
			try {
				expect(renderer._lightSpaceInverse()).toBe(null);
			} finally {
				renderer.currentTransform.identity();
			}
		});
	});
});

describe("packMeshLights carrying lights into a mesh's frame", () => {
	const lights = () => {
		return [
			new Light3d({
				type: "point",
				position: [10, 20, 30],
				range: 50,
				color: [1, 0, 0],
			}),
			new Light3d({ type: "directional", direction: [1, 0, 0] }),
			new Light3d({
				type: "spot",
				position: [0, 0, 0],
				direction: [0, 0, 1],
				outerConeAngle: 0.5,
			}),
			new Light3d({ type: "ambient", intensity: 0.25 }),
		];
	};

	const snapshot = (packed) => {
		return {
			count: packed.count,
			posRange: Array.from(packed.posRange),
			dirCone: Array.from(packed.dirCone),
			colorInner: Array.from(packed.colorInner),
			ambient: Array.from(packed.ambient),
		};
	};

	it("no space, or null, packs exactly as before", () => {
		const plain = snapshot(packMeshLights(lights()));
		expect(snapshot(packMeshLights(lights(), null))).toEqual(plain);
		expect(snapshot(packMeshLights(lights(), undefined))).toEqual(plain);
	});

	it("moves positions, turns directions, and leaves the rest alone", () => {
		const plain = snapshot(packMeshLights(lights()));
		// a quarter turn about Y, then 100 along x
		const m = new Matrix3d();
		m.translate(100, 0, 0);
		m.rotate(Math.PI / 2, new Vector3d(0, 1, 0));
		const moved = snapshot(packMeshLights(lights(), m));
		const at = new Vector3d(10, 20, 30);
		m.apply(at);
		// point: position through the whole matrix, range kept
		expect(moved.posRange[0]).toBeCloseTo(at.x, 4);
		expect(moved.posRange[1]).toBeCloseTo(at.y, 4);
		expect(moved.posRange[2]).toBeCloseTo(at.z, 4);
		expect(moved.posRange[3]).toBe(plain.posRange[3]);
		// a point light has no direction, and keeps none
		expect(moved.dirCone.slice(0, 4)).toEqual(plain.dirCone.slice(0, 4));
		// directional: still the sentinel, direction turned and unit length
		expect(moved.posRange.slice(4, 8)).toEqual(plain.posRange.slice(4, 8));
		const d = moved.dirCone.slice(4, 7);
		expect(Math.hypot(d[0], d[1], d[2])).toBeCloseTo(1, 5);
		expect(d[0]).toBeCloseTo(0, 5);
		expect(d[2]).toBeCloseTo(1, 5);
		// spot: cone cosine untouched
		expect(moved.dirCone[11]).toBe(plain.dirCone[11]);
		// colours and the ambient sum are not positional
		expect(moved.colorInner).toEqual(plain.colorInner);
		expect(moved.ambient).toEqual(plain.ambient);
		expect(moved.count).toBe(plain.count);
	});

	it("a scaling frame still hands the shader unit directions", () => {
		const m = new Matrix3d();
		m.scale(3, 3, 3);
		const moved = snapshot(packMeshLights(lights(), m));
		const d = moved.dirCone.slice(4, 7);
		expect(Math.hypot(d[0], d[1], d[2])).toBeCloseTo(1, 5);
	});
});
