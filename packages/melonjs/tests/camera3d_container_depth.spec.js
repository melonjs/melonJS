import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	boot,
	Camera2d,
	Camera3d,
	Container,
	GLTFModel,
	Mesh,
	ParticleEmitter,
	Renderable,
	Sprite,
	TextureAtlas,
} from "../src/index.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

/**
 * Under `Camera3d` a child of a `Container` ignored the container's depth.
 *
 * Culling (`getAbsolutePosition`) and the `"depth"` sort both add every
 * ancestor's `pos.z`, but drawing did not: `Container#draw` translated the
 * renderer by the container's `pos.x` / `pos.y` only, `Renderable#preDraw`
 * set the depth ABSOLUTELY with `setDepth(this.depth)`, and a mesh's model
 * matrix carries only its own depth. So a sprite or a mesh in a container at
 * depth 200 drew as though the container sat at depth 0 — larger, nearer,
 * and in front of things it should have been behind — while being culled
 * and sorted where it really was.
 *
 * Proven at the pixel, through a real `Camera3d` draw: a quad nested in a
 * container must cover exactly the pixels of the same quad placed directly
 * at the summed world position. Under `Camera2d` depth is draw order only,
 * and must stay out of the transform: the specs at the bottom pin that.
 */
describe("Camera3d draws a container's children at the container's depth", () => {
	const SIZE = 128;
	let renderer;
	let cam;

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
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	const requireWebGL = (ctx) => {
		if (renderer === undefined) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	const whiteCanvas = (size = 4) => {
		const canvas = document.createElement("canvas");
		canvas.width = size;
		canvas.height = size;
		const c2d = canvas.getContext("2d");
		c2d.fillStyle = "#ffffff";
		c2d.fillRect(0, 0, size, size);
		return canvas;
	};

	// a 40 × 40 quad centred on its origin, facing the camera
	const quadMesh = () => {
		const canvas = whiteCanvas();
		const mesh = new Mesh(0, 0, {
			vertices: new Float32Array([
				-20, -20, 0, 20, -20, 0, 20, 20, 0, -20, 20, 0,
			]),
			uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
			indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
			texture: new TextureAtlas(
				{ framewidth: 4, frameheight: 4, image: canvas },
				canvas,
			),
			width: 40,
			height: 40,
			scale: 1,
			normalize: false,
			cullBackFaces: false,
			castGroundShadow: false,
		});
		return mesh;
	};

	const quadSprite = () => {
		const sprite = new Sprite(0, 0, { image: whiteCanvas(40) });
		return sprite;
	};

	/**
	 * Draw `root` through the camera and return how many pixels of the middle
	 * row are lit. Every renderable is marked in view by hand: no world
	 * update runs here, so nothing else would.
	 */
	const litWidth = (root) => {
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
		renderer.backgroundColor.setColor(0, 0, 0, 255);
		renderer.clear();
		cam.draw(renderer, root);
		renderer.flush();
		const gl = renderer.gl;
		gl.finish();
		const row = new Uint8Array(SIZE * 4);
		gl.readPixels(0, SIZE / 2, SIZE, 1, gl.RGBA, gl.UNSIGNED_BYTE, row);
		let lit = 0;
		for (let i = 0; i < SIZE; i++) {
			if (row[i * 4] > 128) {
				lit++;
			}
		}
		return lit;
	};

	const makeRoot = () => {
		const root = new Container(0, 0, Infinity, Infinity);
		root.autoDepth = false;
		root.root = true;
		return root;
	};

	// the same renderable placed straight in the root at `z`
	const direct = (make, z) => {
		const root = makeRoot();
		root.addChild(make(), z);
		return litWidth(root);
	};

	// the renderable at `childZ` inside a container at `containerZ`
	const nested = (make, containerZ, childZ) => {
		const root = makeRoot();
		const group = new Container(0, 0, Infinity, Infinity);
		group.autoDepth = false;
		group.anchorPoint.set(0, 0);
		root.addChild(group, containerZ);
		group.addChild(make(), childZ);
		return litWidth(root);
	};

	describe("the bug: a nested child drawn at its own depth alone", () => {
		it("a mesh in a container at depth 200 draws at 200 + its own 100", (ctx) => {
			requireWebGL(ctx);
			const expected = direct(quadMesh, 300);
			// sanity: the quad is visible and depth changes its size
			expect(expected).toBeGreaterThan(4);
			expect(direct(quadMesh, 100)).toBeGreaterThan(expected + 4);
			expect(nested(quadMesh, 200, 100)).toBe(expected);
		});

		it("a sprite in a container at depth 200 draws at 200 + its own 100", (ctx) => {
			requireWebGL(ctx);
			const expected = direct(quadSprite, 300);
			expect(expected).toBeGreaterThan(4);
			expect(direct(quadSprite, 100)).toBeGreaterThan(expected + 4);
			expect(nested(quadSprite, 200, 100)).toBe(expected);
		});

		it("two levels of containers add up", (ctx) => {
			requireWebGL(ctx);
			const expected = direct(quadMesh, 300);
			const root = makeRoot();
			const outer = new Container(0, 0, Infinity, Infinity);
			const inner = new Container(0, 0, Infinity, Infinity);
			outer.autoDepth = false;
			inner.autoDepth = false;
			root.addChild(outer, 100);
			outer.addChild(inner, 150);
			inner.addChild(quadMesh(), 50);
			expect(litWidth(root)).toBe(expected);
		});

		it("an emitter in a container adds the container's depth too", (ctx) => {
			requireWebGL(ctx);
			const root = makeRoot();
			const group = new Container(0, 0, Infinity, Infinity);
			group.autoDepth = false;
			root.addChild(group, 100);
			const emitter = new ParticleEmitter(0, 0, {
				totalParticles: 1,
				speed: 0,
				speedVariation: 0,
			});
			group.addChild(emitter, 200);
			emitter.burstParticles();
			const particle = emitter.getChildren()[0];
			particle.depth = 7;
			const [z] = probeDepths(root, [particle]);
			// what culling and the sort already said
			expect(z).toBeCloseTo(particle.getAbsolutePosition().z, 4);
			expect(z).toBeCloseTo(307, 4);
		});
	});

	/**
	 * Where a draw call made by `r` actually lands in depth: a quad corner is
	 * `(x, y, currentDepth)` multiplied by the renderer transform, which under
	 * this camera (at the origin, unturned) carries no rotation, so its z is
	 * the transform's z translation plus `currentDepth`.
	 */
	const probeDepths = (root, probes) => {
		const seen = new Map();
		for (const p of probes) {
			const draw = p.draw.bind(p);
			p.draw = (r, viewport) => {
				seen.set(p, r.currentTransform.val[14] + r.currentDepth);
				draw(r, viewport);
			};
		}
		litWidth(root);
		return probes.map((p) => {
			return seen.get(p);
		});
	};

	describe("normal behaviour the fix must keep", () => {
		// a 40-wide quad at depth z under a 60 degree fov on a 128 px canvas
		const projectedWidth = (z) => {
			return (40 * (SIZE / 2 / Math.tan(Math.PI / 6))) / z;
		};

		it("a mesh straight in the world draws where it always did", (ctx) => {
			requireWebGL(ctx);
			expect(
				Math.abs(direct(quadMesh, 300) - projectedWidth(300)),
			).toBeLessThan(1.5);
			expect(
				Math.abs(direct(quadMesh, 100) - projectedWidth(100)),
			).toBeLessThan(1.5);
		});

		it("a sprite straight in the world draws where it always did", (ctx) => {
			requireWebGL(ctx);
			expect(
				Math.abs(direct(quadSprite, 300) - projectedWidth(300)),
			).toBeLessThan(1.5);
		});

		it("a container at depth 0 changes nothing", (ctx) => {
			requireWebGL(ctx);
			expect(nested(quadMesh, 0, 300)).toBe(direct(quadMesh, 300));
			expect(nested(quadSprite, 0, 300)).toBe(direct(quadSprite, 300));
		});

		it("a container's x/y still moves its children as before", (ctx) => {
			requireWebGL(ctx);
			const root = makeRoot();
			const group = new Container(0, 0, Infinity, Infinity);
			group.autoDepth = false;
			root.addChild(group, 200);
			group.pos.x = 1000; // off the right of the view
			group.addChild(quadMesh(), 100);
			expect(litWidth(root)).toBe(0);
		});

		it("a particle draws at its emitter's depth plus its own, not twice the emitter's", (ctx) => {
			requireWebGL(ctx);
			const root = makeRoot();
			const emitter = new ParticleEmitter(0, 0, {
				totalParticles: 1,
				speed: 0,
				speedVariation: 0,
			});
			root.addChild(emitter, 300);
			emitter.burstParticles();
			const particle = emitter.getChildren()[0];
			particle.depth = 7;
			const [z] = probeDepths(root, [particle]);
			expect(z).toBeCloseTo(307, 4);
			expect(particle.getAbsolutePosition().z).toBeCloseTo(307, 4);
		});

		it("a GLTFModel at a depth draws its parts there once, not twice", (ctx) => {
			requireWebGL(ctx);
			const data = {
				bounds: { min: [-20, -20, 0], max: [20, 20, 0] },
				graph: {
					roots: [0],
					nodes: {
						0: {
							index: 0,
							name: "quad",
							translation: [0, 0, 0],
							rotation: [0, 0, 0, 1],
							scale: [1, 1, 1],
							matrix: null,
							children: [],
							primitives: [
								{
									vertices: new Float32Array([
										-20, -20, 0, 20, -20, 0, 20, 20, 0, -20, 20, 0,
									]),
									uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
									indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
									normals: undefined,
									vertexCount: 4,
									image: whiteCanvas(),
									baseColorFactor: [1, 1, 1, 1],
									doubleSided: true,
								},
							],
						},
					},
				},
				animations: [],
			};
			const model = new GLTFModel(data, {
				scale: 1,
				rightHanded: false,
				castGroundShadow: false,
			});
			const root = makeRoot();
			root.addChild(model, 300);
			model._pose();
			expect(litWidth(root)).toBe(direct(quadMesh, 300));
		});

		it("a floating container's children stay in screen space", (ctx) => {
			requireWebGL(ctx);
			const root = makeRoot();
			const hud = new Container(0, 0, SIZE, SIZE);
			hud.floating = true;
			hud.autoDepth = false;
			root.addChild(hud, 10000);
			const label = new Renderable(10, 10, 8, 8);
			label.alwaysUpdate = true;
			hud.addChild(label, 5);
			const [z] = probeDepths(root, [label]);
			// screen projection: neither depth reaches the transform or the
			// vertex z (`setDepth` zeroes it under an orthographic projection)
			expect(z).toBe(0);
		});
	});
});

/**
 * Under `Camera2d` a container's depth is DRAW ORDER only: it must not reach
 * the transform, or a large sort key (`autoDepth` on a big world, a
 * `baseZ + pos.y` sort) would push its children past the orthographic near /
 * far planes and they would silently vanish. These pass before and after.
 */
describe("Camera2d keeps a container's depth out of the transform", () => {
	const SIZE = 128;
	let renderer;
	let cam;

	beforeAll(async () => {
		await boot();
		try {
			renderer = await getWebGLRenderer(SIZE, SIZE);
		} catch {
			// genuinely unavailable — every test below skips
		}
		cam = new Camera2d(0, 0, SIZE, SIZE);
		cam.update(0);
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	const requireWebGL = (ctx) => {
		if (renderer === undefined) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	const square = () => {
		const canvas = document.createElement("canvas");
		canvas.width = 40;
		canvas.height = 40;
		const c2d = canvas.getContext("2d");
		c2d.fillStyle = "#ffffff";
		c2d.fillRect(0, 0, 40, 40);
		return new Sprite(SIZE / 2, SIZE / 2, { image: canvas });
	};

	const draw = (root) => {
		const markInView = (c) => {
			for (const child of c.getChildren()) {
				child.inViewport = true;
				if (child instanceof Container) {
					markInView(child);
				}
			}
		};
		markInView(root);
		renderer.backgroundColor.setColor(0, 0, 0, 255);
		renderer.clear();
		cam.draw(renderer, root);
		renderer.flush();
		const gl = renderer.gl;
		gl.finish();
		const row = new Uint8Array(SIZE * 4);
		gl.readPixels(0, SIZE / 2, SIZE, 1, gl.RGBA, gl.UNSIGNED_BYTE, row);
		let lit = 0;
		for (let i = 0; i < SIZE; i++) {
			if (row[i * 4] > 128) {
				lit++;
			}
		}
		return lit;
	};

	const makeRoot = () => {
		const root = new Container(0, 0, Infinity, Infinity);
		root.autoDepth = false;
		root.root = true;
		return root;
	};

	it("a sprite in a container at a huge depth still draws, at the same size", (ctx) => {
		requireWebGL(ctx);
		const flat = makeRoot();
		flat.addChild(square(), 0);
		const expected = draw(flat);
		expect(expected).toBe(40);

		const root = makeRoot();
		const group = new Container(0, 0, Infinity, Infinity);
		group.autoDepth = false;
		root.addChild(group, 50000);
		group.addChild(square(), 25000);
		expect(draw(root)).toBe(expected);
	});

	it("the container never multiplies a depth into the renderer transform", (ctx) => {
		requireWebGL(ctx);
		const root = makeRoot();
		const group = new Container(0, 0, Infinity, Infinity);
		group.autoDepth = false;
		root.addChild(group, 500);
		const sprite = square();
		group.addChild(sprite, 3);
		const transform = renderer.transform.bind(renderer);
		let transformed = 0;
		renderer.transform = (...args) => {
			transformed++;
			return transform(...args);
		};
		let seen;
		const spriteDraw = sprite.draw.bind(sprite);
		sprite.draw = (r, viewport) => {
			seen = [r.currentTransform.val[14], r.currentDepth];
			spriteDraw(r, viewport);
		};
		try {
			draw(root);
		} finally {
			renderer.transform = transform;
		}
		expect(transformed).toBe(0);
		expect(seen).toEqual([0, 0]);
	});
});
