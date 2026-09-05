import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	boot,
	Camera3d,
	Color,
	Container,
	InstancedMesh,
	Matrix3d,
	Mesh,
	TextureAtlas,
	Vector3d,
} from "../src/index.js";
import meshVert from "../src/video/webgl/shaders/mesh.vert";
import meshInstancedVert from "../src/video/webgl/shaders/mesh-instanced.vert";
import meshLitVert from "../src/video/webgl/shaders/mesh-lit.vert";
import meshLitInstancedVert from "../src/video/webgl/shaders/mesh-lit-instanced.vert";
import meshShadowInstancedVert from "../src/video/webgl/shaders/mesh-shadow-instanced.vert";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

/**
 * Distance fog, at the pixel (#1622).
 *
 * Fog is folded in by the mesh fragment shaders, and the one thing that is
 * easy to get wrong there is the alpha. `vColor` is PREMULTIPLIED by the
 * vertex stage, so the fog colour has to be scaled by the fragment's own
 * coverage before it is mixed in. The naive `mix(fogColor, rgb, f)` writes
 * full-strength fog onto near-transparent fragments — grey halos around every
 * alpha-cutout leaf — and this spec pins the difference numerically.
 *
 * Fog is driven through `renderer.setFog` directly rather than through a
 * camera: these draws never go through a camera's `draw()`, and the resolved
 * state is exactly what a camera would have installed.
 */
const Z_AXIS = new Vector3d(0, 0, 1);

describe("mesh distance fog (#1622)", () => {
	const SIZE = 128;
	let renderer;

	beforeAll(async () => {
		await boot();
		try {
			renderer = await getWebGLRenderer(SIZE, SIZE);
		} catch {
			// genuinely unavailable — every test below skips
		}
	});

	afterAll(() => {
		try {
			renderer?.setFog(null);
			releaseWebGLRenderer();
		} catch {
			// ignore
		}
	});

	const requireWebGL = (ctx) => {
		if (renderer === undefined) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	let _atlas = null;
	const whiteAtlas = () => {
		if (_atlas === null) {
			const canvas = document.createElement("canvas");
			canvas.width = 1;
			canvas.height = 1;
			const c2d = canvas.getContext("2d");
			c2d.fillStyle = "#ffffff";
			c2d.fillRect(0, 0, 1, 1);
			_atlas = new TextureAtlas(
				{ framewidth: 1, frameheight: 1, image: canvas },
				canvas,
			);
		}
		return _atlas;
	};

	/**
	 * A small quad centred on world (x, 0). Kept small on purpose: the fog
	 * distance is interpolated from the corners, so a tiny quad's centre
	 * pixel reads essentially the quad's own distance.
	 */
	const quad = (x = 0, half = 4, lit = false) => {
		const mesh = new Mesh(0, 0, {
			vertices: [
				-half,
				-half,
				0,
				half,
				-half,
				0,
				half,
				half,
				0,
				-half,
				half,
				0,
			],
			uvs: [0, 0, 1, 0, 1, 1, 0, 1],
			indices: [0, 1, 2, 0, 2, 3],
			texture: whiteAtlas(),
			// geometry normalizes to a unit box, so world size comes from here
			width: half * 2,
			height: half * 2,
			cullBackFaces: false,
			lit,
		});
		// the world-space (Camera3d) branch, without needing a live stage
		mesh._useWorldSpace = true;
		mesh.pos.set(x, 0, 0);
		// `preDraw` installs the renderable's OWN tint, so setting
		// `renderer.currentTint` around the draw would be overwritten
		mesh.tint.setColor(255, 0, 0);
		return mesh;
	};

	/** world (0,0) at the canvas centre, so a quad's x offsets it on screen */
	const setup = () => {
		const proj = new Matrix3d();
		proj.ortho(-SIZE / 2, SIZE / 2, SIZE / 2, -SIZE / 2, -10000, 10000);
		renderer.setProjection(proj);
		renderer.backgroundColor.setColor(0, 0, 0, 255);
		renderer.clear();
	};

	/** place a mesh `z` in front of the camera (the view stays identity) */
	const drawAt = (mesh, z) => {
		mesh.depth = z;
		mesh.preDraw(renderer);
		mesh.draw(renderer);
		mesh.postDraw(renderer);
	};

	const readPixel = (x = SIZE / 2, y = SIZE / 2) => {
		const gl = renderer.gl;
		const px = new Uint8Array(4);
		gl.finish();
		gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
		return px;
	};

	/** fog state in the shape a camera resolves */
	const fog = (over = {}) => {
		// The camera bakes the height integral into two operands before it
		// reaches a batcher. With no camera rotation the world-up axis in view
		// space is (0, 1, 0), so the falloff lands entirely in y — these tests
		// keep expressing the fog in the world terms an author uses.
		const { heightFalloff: k = 0, fogHeight = 0, cameraY = 0, ...rest } = over;
		return {
			mode: 1,
			near: 0,
			invRange: 1 / 1000,
			density: 0,
			color: new Float32Array([1, 1, 1]),
			// uniform fog: a zero falloff collapses the height integral to 1
			heightAxis: new Float32Array([0, k, 0]),
			heightBase: Math.exp(
				Math.min(30, Math.max(-30, k * (cameraY - fogHeight))),
			),
			...rest,
		};
	};

	/** draw one red quad and read the centre pixel */
	const drawRed = (mesh, z, alpha = 1) => {
		setup();
		renderer.save();
		mesh.setOpacity(alpha);
		drawAt(mesh, z);
		const px = readPixel();
		renderer.restore();
		return px;
	};

	describe("the off path is untouched", () => {
		it("draws the mesh colour exactly when fog was never enabled", (ctx) => {
			requireWebGL(ctx);
			// The regression guard for the whole feature: with no fog the
			// shader must be the one that shipped before fog existed, and the
			// extra view-space product in the vertex stage must not perturb a
			// single pixel.
			renderer.setFog(null);
			const px = drawRed(quad(), 500);
			expect([px[0], px[1], px[2]]).toEqual([255, 0, 0]);
		});
	});

	describe("a custom mesh shader survives the fog variant swap", () => {
		it("does not swap away from a program the batcher does not own", (ctx) => {
			requireWebGL(ctx);
			// Fog is a COMPILED VARIANT, so the retained draw picks its program
			// per draw. That swap must only ever replace the batcher's OWN
			// program: `WebGLRenderer.drawMesh` binds a renderable's custom
			// shader immediately before calling in here, and re-binding
			// unconditionally threw it away — the mesh drew with built-in
			// shading, silently, in every scene whether or not fog was on.
			//
			// Asserted on the bound program rather than on pixels: what broke
			// was which program the draw ran, and `drawMesh` restores the
			// default afterwards, so a pixel read cannot see it.
			renderer.setFog(null);
			setup();
			const batcher = renderer.setBatcher("mesh");
			const own = batcher.defaultShader;
			// stand in for a renderable's hosted shader: any GLShader that is
			// not one of the batcher's own
			const foreign = renderer.setBatcher("quad").defaultShader;
			renderer.setBatcher("mesh");
			batcher.useShader(foreign);
			expect(batcher.currentShader).toBe(foreign);

			const mesh = quad();
			mesh.pos.set(0, 0, 0);
			mesh.depth = 500;
			batcher.drawRetainedMesh(mesh, mesh._composeModelMatrix(), 0xffffffff);

			expect(batcher.currentShader).toBe(foreign);
			batcher.useShader(own);
		});

		it("leaves a foreign program bound with fog ENABLED, and does not throw", (ctx) => {
			requireWebGL(ctx);
			// The question this answers: is it safe to put a `ShaderEffect` on a
			// mesh while the camera has fog? The custom program has no fog
			// uniforms and no fog variant, so the batcher must neither swap it
			// out nor try to push fog into it. It renders unfogged — surprising
			// perhaps, but defined, and it must not fail.
			setup();
			const batcher = renderer.setBatcher("mesh");
			const own = batcher.defaultShader;
			const foreign = renderer.setBatcher("quad").defaultShader;
			renderer.setBatcher("mesh");
			batcher.useShader(foreign);
			renderer.setFog(fog());

			const mesh = quad();
			mesh.depth = 500;
			expect(() => {
				batcher.drawRetainedMesh(mesh, mesh._composeModelMatrix(), 0xffffffff);
			}).not.toThrow();
			expect(batcher.currentShader).toBe(foreign);
			// and no fog program was minted on its behalf
			expect(batcher.shaderVariants.has("mesh|fog")).toBe(false);

			renderer.setFog(null);
			batcher.useShader(own);
		});

		it("still swaps its own program when fog turns on", (ctx) => {
			requireWebGL(ctx);
			setup();
			const batcher = renderer.setBatcher("mesh");
			batcher.useShader(batcher.defaultShader);
			renderer.setFog(fog());
			const mesh = quad();
			mesh.depth = 500;
			batcher.drawRetainedMesh(mesh, mesh._composeModelMatrix(), 0xffffffff);
			const fogged = batcher.currentShader;
			expect(fogged).not.toBe(batcher.defaultShader);
			// every compiled variant lives in one keyed cache, so there is a
			// single place to release them however many axes are added
			expect(fogged).toBe(batcher.shaderVariants.get("mesh|fog"));

			renderer.setFog(null);
			batcher.drawRetainedMesh(mesh, mesh._composeModelMatrix(), 0xffffffff);
			expect(batcher.currentShader).toBe(batcher.defaultShader);
		});
	});

	describe("the variant cache", () => {
		it("keeps every compiled variant in one map, so there is one release site", (ctx) => {
			requireWebGL(ctx);
			// Each optional feature used to own a field — `fogShader`,
			// `shadowFogShader`, a numeric map for the instanced tiers — and
			// each had to be released in BOTH `init()` (context loss) and
			// `destroy()`. Six sites for two axes. A missed one leaks a program
			// that later tries to recompile against a dead context.
			setup();
			const batcher = renderer.setBatcher("mesh");
			batcher.shaderVariants.forEach((shader) => {
				shader.destroy();
			});
			batcher.shaderVariants.clear();

			renderer.setFog(fog());
			const mesh = quad();
			mesh.depth = 500;
			batcher.drawRetainedMesh(mesh, mesh._composeModelMatrix(), 0xffffffff);
			renderer.setFog(null);

			expect(batcher.shaderVariants.has("mesh|fog")).toBe(true);
			// namespaced, so the instanced and shadow families cannot collide
			// with it or with each other
			for (const key of batcher.shaderVariants.keys()) {
				expect(key).toMatch(/^(mesh|instanced|shadow)\|?/);
			}
		});
	});

	describe("the curves", () => {
		it("linear reaches the halfway mix at the halfway distance", (ctx) => {
			requireWebGL(ctx);
			// near 0, far 1000, quad at 500 → half the scene colour survives,
			// mixed toward white: (255, 128, 128)
			renderer.setFog(fog());
			const px = drawRed(quad(), 500);
			renderer.setFog(null);
			expect(px[0]).toBe(255);
			expect(px[1]).toBeGreaterThan(120);
			expect(px[1]).toBeLessThan(136);
			expect(px[2]).toBeGreaterThan(120);
			expect(px[2]).toBeLessThan(136);
		});

		it("linear saturates past far and is clear before near", (ctx) => {
			requireWebGL(ctx);
			renderer.setFog(fog({ near: 400, invRange: 1 / 600 }));
			const beyond = drawRed(quad(), 1500);
			const before = drawRed(quad(), 100);
			renderer.setFog(null);
			// past `far`: nothing of the mesh survives — pure fog colour
			expect([beyond[0], beyond[1], beyond[2]]).toEqual([255, 255, 255]);
			// before `near`: untouched
			expect([before[0], before[1], before[2]]).toEqual([255, 0, 0]);
		});

		it("exp2 follows exp(-(density * d)^2), not exp(-density * d)", (ctx) => {
			requireWebGL(ctx);
			const density = 0.001;
			const z = 1000;
			renderer.setFog(fog({ mode: 2, density }));
			const px = drawRed(quad(), z);
			renderer.setFog(null);
			// squared: exp(-1) ≈ 0.368 → green/blue ≈ (1 - 0.368) * 255 ≈ 161
			// single: exp(-1) is the same here BY CONSTRUCTION, so pick a
			// distance where they differ instead
			const survive = Math.exp(-((density * z) ** 2));
			expect(px[1]).toBeGreaterThan((1 - survive) * 255 - 6);
			expect(px[1]).toBeLessThan((1 - survive) * 255 + 6);
		});

		it("exp2 is distinguishable from a single exponential", (ctx) => {
			requireWebGL(ctx);
			const density = 0.001;
			const z = 400; // d*density = 0.4 → exp(-0.16)=0.852 vs exp(-0.4)=0.670
			renderer.setFog(fog({ mode: 2, density }));
			const px = drawRed(quad(), z);
			renderer.setFog(null);
			const squared = (1 - Math.exp(-0.16)) * 255; // ≈ 37.7
			const single = (1 - Math.exp(-0.4)) * 255; // ≈ 84.2
			expect(Math.abs(px[1] - squared)).toBeLessThan(Math.abs(px[1] - single));
		});
	});

	describe("height falloff", () => {
		it("is uniform at falloff 0, matching the fog that shipped without it", (ctx) => {
			requireWebGL(ctx);
			// the whole design rests on this: zero is not a special case, it is
			// the integral with the dial at zero, and it must be EXACT
			renderer.setFog(fog());
			const plain = drawRed(quad(), 500);
			renderer.setFog(fog({ heightFalloff: 0, fogHeight: 400, cameraY: 90 }));
			const withZero = drawRed(quad(), 500);
			renderer.setFog(null);
			expect(Array.from(withZero)).toEqual(Array.from(plain));
		});

		it("fogs low ground MORE than high ground — Y is down", (ctx) => {
			requireWebGL(ctx);
			// The sign trap. Render space is Y-down, so a GREATER y is LOWER in
			// the world and must fog harder. Every published form of this
			// formula assumes Y-up, and flipping it silently inverts the
			// effect: mist would sit on the peaks instead of in the valley.
			//
			// Both quads stay inside the ortho and are read at their own screen
			// positions — placing them far apart in Y would put them off-screen
			// and read the cleared background instead, which looks like "no fog"
			// and proves nothing.
			const common = {
				near: 0,
				invRange: 1 / 1000,
				heightFalloff: 0.02,
				fogHeight: 0,
				cameraY: 0,
			};
			const sample = (worldY, glY) => {
				setup();
				renderer.setFog(fog(common));
				const mesh = quad();
				mesh.pos.set(0, worldY, 0);
				mesh.depth = 500;
				mesh.preDraw(renderer);
				mesh.draw(renderer);
				mesh.postDraw(renderer);
				const px = readPixel(SIZE / 2, glY);
				renderer.setFog(null);
				return px;
			};
			// ortho maps world y=-64 to the top of the drawing buffer and
			// y=+64 to the bottom; readPixels counts from the bottom
			const low = sample(40, 24); // greater y = lower in the world
			const high = sample(-40, 104);

			// both actually drew: a background read would be pure black
			expect(low[0]).toBeGreaterThan(200);
			expect(high[0]).toBeGreaterThan(200);
			// more fog = more white mixed into the red
			expect(low[1]).toBeGreaterThan(high[1] + 20);
		});

		it("survives a horizontal ray, where the integral is 0/0", (ctx) => {
			requireWebGL(ctx);
			// looking straight across a valley is exactly dy = 0; a guard that
			// returned something else here would step visibly as the ray
			// flattened out
			renderer.setFog(fog({ heightFalloff: 0.004, fogHeight: 0, cameraY: 0 }));
			const level = quad();
			level.pos.set(0, 0, 0); // same Y as the camera
			const px = drawRed(level, 500);
			renderer.setFog(null);
			for (const channel of [0, 1, 2]) {
				expect(Number.isFinite(px[channel])).toBe(true);
			}
			// and it is fogged, not blanked or left untouched
			expect(px[1]).toBeGreaterThan(0);
			expect(px[1]).toBeLessThan(255);
		});

		it("does not blow up with the camera far below the reference height", (ctx) => {
			requireWebGL(ctx);
			// The extreme end of the range must produce a usable frame rather
			// than NaN. Note this does NOT prove the clamp inside
			// `fogHeightFactor`: with or without it the result saturates to
			// fully-fogged, because an infinite distance is clamped by the fog
			// curve anyway. The clamp is insurance against a driver carrying
			// `Inf` into an interpolated varying, which this cannot observe.
			renderer.setFog(
				fog({ heightFalloff: 0.05, fogHeight: -5000, cameraY: 20000 }),
			);
			const px = drawRed(quad(), 500);
			renderer.setFog(null);
			for (const channel of [0, 1, 2]) {
				expect(Number.isNaN(px[channel])).toBe(false);
			}
		});
	});

	describe("under a transformed ancestor (#1641)", () => {
		// `Container.draw` folds every ancestor transform into the view matrix,
		// so the position a vertex stage computes — `uModelMatrix * position` —
		// is the mesh's PARENT space, not the world. The height integral used
		// to read its altitude straight off that, which put the fog floor at
		// the wrong height for anything under a scaled container: a diorama, a
		// model scaled to fit a panel, a grow animation.
		//
		// Each pair below places the quad at the SAME point in view space and
		// differs only in how the transform is split between the ancestor and
		// the mesh. Same distance, same world height — so the fog must come
		// out the same however the split is made.
		const common = {
			near: 0,
			invRange: 1 / 1000,
			heightFalloff: 0.02,
			fogHeight: 0,
			cameraY: 0,
		};
		// ortho maps world y=-64 to the top and y=+64 to the bottom;
		// readPixels counts from the bottom, so world y=40 is row 24
		const WORLD_Y = 40;
		const ROW = 24;

		/**
		 * Draw one quad whose view-space centre is always (0, WORLD_Y, 500).
		 * `ancestor` installs the container transform; `place` returns where
		 * the mesh has to sit in the parent space that transform creates.
		 */
		const sample = ({ ancestor, place, half = 3, lit = false, over = {} }) => {
			setup();
			renderer.setFog(fog({ ...common, ...over }));
			renderer.save();
			ancestor?.(renderer.currentTransform);
			const mesh = quad(0, half, lit);
			const [px, py] = place ?? [0, WORLD_Y];
			mesh.pos.set(px, py, 0);
			drawAt(mesh, 500);
			renderer.restore();
			const read = readPixel(SIZE / 2, ROW);
			renderer.setFog(null);
			return read;
		};

		const REFERENCE = { ancestor: undefined, place: [0, WORLD_Y] };

		for (const lit of [false, true]) {
			const tier = lit ? "lit" : "unlit";

			it(`fogs by the mesh's WORLD height under a uniform scale (${tier})`, (ctx) => {
				requireWebGL(ctx);
				const plain = sample({ ...REFERENCE, lit });
				const scaled = sample({
					ancestor: (m) => {
						return m.scale(2, 2, 1);
					},
					place: [0, WORLD_Y / 2],
					half: 1.5,
					lit,
				});
				// both actually drew: a background read would be pure black
				expect(plain[0]).toBeGreaterThan(100);
				expect(scaled[0]).toBeGreaterThan(100);
				// and they agree. Reading the height pre-view instead halves
				// it under this ancestor, well past this bound.
				expect(Math.abs(scaled[1] - plain[1])).toBeLessThan(6);
			});

			it(`fogs by the mesh's WORLD height under a NON-uniform scale (${tier})`, (ctx) => {
				requireWebGL(ctx);
				const plain = sample({ ...REFERENCE, lit });
				const scaled = sample({
					ancestor: (m) => {
						return m.scale(2, 4, 1);
					},
					place: [0, WORLD_Y / 4],
					half: 1.5,
					lit,
				});
				expect(scaled[0]).toBeGreaterThan(100);
				expect(Math.abs(scaled[1] - plain[1])).toBeLessThan(8);
			});

			it(`fogs by the mesh's WORLD height under a ROTATED ancestor (${tier})`, (ctx) => {
				requireWebGL(ctx);
				// the case the old design could not express at all: a height
				// read pre-view has no way to know the ancestor turned. The
				// mesh sits at the pre-image of (0, WORLD_Y) under R(theta).
				const theta = 0.4;
				const plain = sample({ ...REFERENCE, lit });
				const rotated = sample({
					ancestor: (m) => {
						return m.rotate(theta, Z_AXIS);
					},
					place: [WORLD_Y * Math.sin(theta), WORLD_Y * Math.cos(theta)],
					lit,
				});
				expect(rotated[0]).toBeGreaterThan(100);
				expect(Math.abs(rotated[1] - plain[1])).toBeLessThan(8);
			});
		}

		it("is not merely self-consistent — the height term does something", (ctx) => {
			requireWebGL(ctx);
			// The agreement tests above compare two draws against each other,
			// so a height factor stuck at 1.0 would satisfy them both. Pin
			// that the falloff actually moves the result.
			const withFalloff = sample(REFERENCE);
			const without = sample({ ...REFERENCE, over: { heightFalloff: 0 } });
			expect(withFalloff[0]).toBeGreaterThan(100);
			expect(Math.abs(withFalloff[1] - without[1])).toBeGreaterThan(20);
		});

		it("still fogs low ground harder than high ground under that ancestor", (ctx) => {
			requireWebGL(ctx);
			// the Y-down sign has to survive the change of space too
			const at = (worldY, row) => {
				setup();
				renderer.setFog(fog(common));
				renderer.save();
				renderer.currentTransform.scale(2, 2, 1);
				const mesh = quad(0, 2);
				mesh.pos.set(0, worldY / 2, 0);
				drawAt(mesh, 500);
				renderer.restore();
				const px = readPixel(SIZE / 2, row);
				renderer.setFog(null);
				return px;
			};
			const low = at(40, 24); // greater y = lower in the world
			const high = at(-40, 104);
			expect(low[0]).toBeGreaterThan(200);
			expect(high[0]).toBeGreaterThan(200);
			expect(low[1]).toBeGreaterThan(high[1] + 20);
		});
	});

	describe("the baked altitude term reaches the shader", () => {
		it("fogs more from a camera lower than the fog floor", (ctx) => {
			requireWebGL(ctx);
			// `heightBase` is the only operand the camera's own altitude feeds
			// now — the fragment's height comes from the view-space position
			// instead, so this varies heightBase and NOTHING else. Every other
			// height test here sits at cameraY 0, where heightBase is exactly
			// 1 and a shader ignoring it entirely would pass.
			const common = {
				near: 0,
				invRange: 1 / 1000,
				heightFalloff: 0.002,
				fogHeight: 0,
			};
			const at = (cameraY) => {
				setup();
				renderer.setFog(fog({ ...common, cameraY }));
				const mesh = quad(0, 3);
				mesh.pos.set(0, 40, 0);
				drawAt(mesh, 500);
				const px = readPixel(SIZE / 2, 24);
				renderer.setFog(null);
				return px;
			};
			// Y-down: a GREATER cameraY is LOWER, so it sits in denser air.
			// exp(0.002 * 300) = 1.82 against exp(0) = 1.
			const level = at(0);
			const below = at(300);
			expect(level[0]).toBeGreaterThan(200);
			expect(below[0]).toBeGreaterThan(200);
			expect(below[1]).toBeGreaterThan(level[1] + 20);
		});
	});

	describe("the axis is a direction, not a scalar height", () => {
		it("reads all three components, not just y", (ctx) => {
			requireWebGL(ctx);
			// The whole point of the fix is that the height is a DOT PRODUCT
			// against a view-space axis: once the camera turns, the world-up
			// axis is no longer (0, 1, 0). Every other test here uses an
			// unturned camera, where a shader reading `uFogHeight.y *
			// viewPos.y` and ignoring x and z is indistinguishable.
			//
			// These two quads sit at the same view-space Y and differ only in
			// X, so an axis-aligned reading fogs them identically.
			const k = 0.01;
			const axis = new Float32Array([k * 0.6, k * 0.8, 0]);
			const at = (worldX, column) => {
				setup();
				renderer.setFog(fog({ near: 0, invRange: 1 / 1000, heightAxis: axis }));
				const mesh = quad(worldX, 3);
				mesh.pos.set(worldX, 0, 0);
				drawAt(mesh, 500);
				const px = readPixel(column, SIZE / 2);
				renderer.setFog(null);
				return px;
			};
			const left = at(-30, SIZE / 2 - 30);
			const right = at(30, SIZE / 2 + 30);
			expect(left[0]).toBeGreaterThan(200);
			expect(right[0]).toBeGreaterThan(200);
			// +x is further along the axis, so it sits deeper in the fog
			expect(right[1]).toBeGreaterThan(left[1] + 10);
		});
	});

	describe("a mesh that opted out leaves the height block neutral", () => {
		it("uploads the neutral, and does not poison the next fogged draw", (ctx) => {
			requireWebGL(ctx);
			// `w` multiplies the WHOLE height factor, so a 0 written for an
			// opted-out mesh would cancel the fog rather than leave it
			// uniform — and the redundant-upload cache would carry that 0
			// into the next mesh that did want fog.
			const common = {
				near: 0,
				invRange: 1 / 1000,
				heightFalloff: 0.002,
				fogHeight: 0,
				cameraY: 300,
			};
			setup();
			renderer.setFog(fog(common));
			const optedOut = quad(0, 3);
			optedOut.fog = false;
			optedOut.pos.set(0, 40, 0);
			drawAt(optedOut, 500);
			const batcher = renderer.currentBatcher;
			expect(batcher.currentFogBase).toBe(1);

			const fogged = quad(0, 3);
			fogged.pos.set(0, 40, 0);
			drawAt(fogged, 500);
			const px = readPixel(SIZE / 2, 24);
			renderer.setFog(null);
			expect(px[0]).toBeGreaterThan(200);
			expect(px[1]).toBeGreaterThan(100); // still fogged
			expect(batcher.currentFogBase).toBeCloseTo(Math.exp(0.6), 4);
		});
	});

	describe("end to end, through a real Camera3d", () => {
		// Every other pixel test in this file installs a hand-built fog state
		// through `renderer.setFog`, which pins the SHADER's convention;
		// `camera3d_fog.spec.js` pins the CAMERA's. Nothing checked the two
		// against EACH OTHER, so a sign flipped in both — or a `heightBase`
		// anchored at a different origin than the axis expects — would pass
		// every one of them. This drives the real path end to end:
		// `camera.setFog` → `camera.draw` → a pixel.
		const EYE_Z = 600;

		// ONE camera for the whole block, destroyed after. A `Camera2d`
		// subscribes to engine events in its constructor, and this spec shares
		// its WebGL context with every other spec in the run — a camera per
		// draw leaks those subscriptions into unrelated files.
		let camera = null;

		beforeAll(() => {
			if (renderer === undefined) {
				return;
			}
			camera = new Camera3d(0, 0, SIZE, SIZE);
			Object.defineProperty(camera, "isDefault", {
				get: () => {
					return true;
				},
			});
			camera.pos.set(0, 0, -EYE_Z);
			camera.screenProjection.ortho(0, SIZE, SIZE, 0, -1e6, 1e6);
		});

		afterAll(() => {
			// `camera.draw` installs fog and a projection ON THE RENDERER, and
			// clearing the camera's own options does not undo either. Left
			// behind, they fog and mis-project every spec that runs after this
			// one on the same shared context.
			try {
				renderer?.setFog(null);
				renderer?.currentTransform.identity();
				camera?.destroy();
			} catch {
				// the renderer may already be released
			}
			camera = null;
		});

		/**
		 * Mean green over the pixels the mesh actually covered. Fog mixes
		 * white INTO the red quad, so more fog reads as more green — and
		 * scanning rather than predicting a pixel keeps this honest under a
		 * perspective projection, where the landing spot is not obvious.
		 */
		const meanFogOverDrawn = () => {
			const gl = renderer.gl;
			const buf = new Uint8Array(SIZE * SIZE * 4);
			gl.finish();
			gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, buf);
			let n = 0;
			let sum = 0;
			for (let i = 0; i < SIZE * SIZE; i++) {
				if (buf[i * 4] > 100) {
					n++;
					sum += buf[i * 4 + 1];
				}
			}
			return { covered: n, green: n === 0 ? -1 : sum / n };
		};

		const drawThroughCamera = (worldY, fogOptions, ancestorScale = 1) => {
			renderer.backgroundColor.setColor(0, 0, 0, 255);
			renderer.clear();
			camera.setFog(fogOptions);
			const world = new Container(0, 0, SIZE, SIZE);
			const mesh = quad(0, 40 / ancestorScale);
			mesh.pos.set(0, worldY / ancestorScale, 0);
			// `Container.draw` skips a child the culling pass has not marked,
			// and nothing runs that pass without a live game loop
			mesh.inViewport = true;
			// z is NOT scaled by a 2D container scale, so the depth stays put
			// and only the height is split between the two
			mesh.depth = EYE_Z;
			if (ancestorScale !== 1) {
				const inner = new Container(0, 0, SIZE, SIZE);
				inner.inViewport = true;
				// the real property a game would set, not a hand-written
				// matrix — `Container` rebuilds `currentTransform` each frame
				inner.scale(ancestorScale, ancestorScale);
				inner.addChild(mesh);
				world.addChild(inner);
			} else {
				world.addChild(mesh);
			}
			camera.draw(renderer, world);
			renderer.flush();
			const out = meanFogOverDrawn();
			// clear on BOTH sides: the camera's options and the renderer's
			// installed state are separate, and only the second one leaks
			camera.setFog(null);
			renderer.setFog(null);
			world.destroy();
			return out;
		};

		const FOG = {
			mode: "linear",
			near: 0,
			far: 1400,
			heightFalloff: 0.02,
			fogHeight: 0,
			color: new Color(255, 255, 255),
		};

		it("fogs at all, through the camera's own resolved state", (ctx) => {
			requireWebGL(ctx);
			const fogged = drawThroughCamera(0, FOG);
			const clear = drawThroughCamera(0, null);
			expect(clear.covered).toBeGreaterThan(20);
			expect(fogged.covered).toBeGreaterThan(20);
			expect(fogged.green).toBeGreaterThan(clear.green + 20);
		});

		it("fogs low ground harder than high ground — the sign, end to end", (ctx) => {
			requireWebGL(ctx);
			// Render space is Y-DOWN, so a GREATER y is LOWER in the world and
			// must sit in denser air. This is the assertion that ties the
			// camera's convention to the shader's: both specs agreeing on a
			// flipped sign would pass everything except this.
			const low = drawThroughCamera(40, FOG);
			const high = drawThroughCamera(-40, FOG);
			expect(low.covered).toBeGreaterThan(20);
			expect(high.covered).toBeGreaterThan(20);
			expect(low.green).toBeGreaterThan(high.green + 10);
		});

		it("fogs by WORLD height under a scaled container, end to end", (ctx) => {
			requireWebGL(ctx);
			// #1641 on the real path: a genuine child Container carrying the
			// scale, folded into the view by `Container.draw` exactly as a
			// game's would be.
			const plain = drawThroughCamera(40, FOG);
			const scaled = drawThroughCamera(40, FOG, 2);
			expect(plain.covered).toBeGreaterThan(20);
			expect(scaled.covered).toBeGreaterThan(20);
			expect(Math.abs(scaled.green - plain.green)).toBeLessThan(10);
		});
	});

	describe("every mesh vertex shader takes the height in view space", () => {
		// The ground-shadow tier has no pixel coverage here — its fog could be
		// deleted outright and the whole suite stayed green. These are source
		// contracts rather than behaviour, which is a weaker guarantee, but
		// they do pin the one thing #1641 got wrong: the height must come from
		// a VIEW-space position, never from `uModelMatrix * position`, which
		// is the mesh's parent space once an ancestor is folded into the view.
		const SHADERS = [
			["mesh.vert", meshVert],
			["mesh-lit.vert", meshLitVert],
			["mesh-instanced.vert", meshInstancedVert],
			["mesh-lit-instanced.vert", meshLitInstancedVert],
			["mesh-shadow-instanced.vert", meshShadowInstancedVert],
		];

		it("declares the view-space signature", () => {
			for (const [name, src] of SHADERS) {
				expect(src, name).toContain("float fogHeightFactor(vec3 viewPos)");
				expect(src, name).toContain("dot(uFogHeight.xyz, viewPos)");
				expect(src, name).toContain("return uFogHeight.w * t;");
			}
		});

		it("feeds it the view-space position, and still writes vFogDepth", () => {
			for (const [name, src] of SHADERS) {
				// the #1641 bug in the shape it had
				expect(src, name).not.toMatch(/fogHeightFactor\([^)]*\.y\)/);
				expect(src, name).not.toMatch(/fogHeightFactor\(\s*worldPos\./);
				// and the depth is a real length, not stubbed out
				expect(src, name).toMatch(
					/vFogDepth = length\(viewPos(\.xyz)?\)\s*\*\s*fogHeightFactor\(\s*viewPos(\.xyz)?\s*\)/,
				);
			}
		});
	});

	describe("the instanced tiers fog too", () => {
		// Fog could be deleted outright from `mesh-instanced.vert` and
		// `mesh-lit-instanced.vert` and the whole suite stayed green: nothing
		// here ever built an `InstancedMesh`. A forest, a crowd, a particle
		// scatter — the tier most likely to BE the distant geometry fog exists
		// for — was riding entirely on inspection.
		const common = {
			near: 0,
			invRange: 1 / 1000,
			fogHeight: 0,
			cameraY: 0,
		};

		const instanced = (worldY, lit, half = 2) => {
			const h = half;
			const mesh = new InstancedMesh(0, 0, {
				vertices: [-h, -h, 0, h, -h, 0, h, h, 0, -h, h, 0],
				uvs: [0, 0, 1, 0, 1, 1, 0, 1],
				indices: [0, 1, 2, 0, 2, 3],
				normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
				texture: whiteAtlas(),
				width: h * 2,
				height: h * 2,
				cullBackFaces: false,
				normalize: false,
				instanceCount: 1,
				lit,
			});
			// placed through `pos`, with the instance record at identity: the
			// point here is the instanced VERTEX SHADER's fog path, and an
			// instance-local offset is not carried into the mesh's bounds, so
			// it culls before it can be read
			const placement = new Matrix3d();
			placement.identity();
			mesh.setInstance(0, placement);
			mesh._useWorldSpace = true;
			mesh.pos.set(0, worldY, 0);
			mesh.tint.setColor(255, 0, 0);
			return mesh;
		};

		for (const lit of [false, true]) {
			const tier = lit ? "lit" : "unlit";

			it(`fogs an instanced mesh at all (${tier})`, (ctx) => {
				requireWebGL(ctx);
				setup();
				renderer.setFog(fog({ ...common, heightFalloff: 0 }));
				drawAt(instanced(0, lit), 500);
				const fogged = readPixel(SIZE / 2, SIZE / 2);
				renderer.setFog(null);

				setup();
				drawAt(instanced(0, lit), 500);
				const clear = readPixel(SIZE / 2, SIZE / 2);

				expect(clear[0]).toBeGreaterThan(100); // it drew
				// uniform fog at half the range mixes the fog colour in;
				// `vFogDepth = 0` would leave it identical to the clear draw
				expect(fogged[1]).toBeGreaterThan(clear[1] + 40);
			});

			it(`applies the height falloff on the instanced tier (${tier})`, (ctx) => {
				requireWebGL(ctx);
				// and it is the HEIGHT term, not just distance: same distance,
				// different altitude
				const at = (worldY, row) => {
					setup();
					renderer.setFog(fog({ ...common, heightFalloff: 0.02 }));
					drawAt(instanced(worldY, lit), 500);
					const px = readPixel(SIZE / 2, row);
					renderer.setFog(null);
					return px;
				};
				const low = at(40, 24); // greater y = lower in the world
				const high = at(-40, 104);
				expect(low[0]).toBeGreaterThan(100);
				expect(high[0]).toBeGreaterThan(100);
				expect(low[1]).toBeGreaterThan(high[1] + 20);
			});

			it(`fogs an instanced mesh by its WORLD height under a scaled ancestor (${tier})`, (ctx) => {
				requireWebGL(ctx);
				const sample = (scale) => {
					setup();
					renderer.setFog(fog({ ...common, heightFalloff: 0.02 }));
					renderer.save();
					if (scale !== 1) {
						renderer.currentTransform.scale(scale, scale, 1);
					}
					drawAt(instanced(40 / scale, lit, 2 / scale), 500);
					renderer.restore();
					const px = readPixel(SIZE / 2, 24);
					renderer.setFog(null);
					return px;
				};
				const plain = sample(1);
				const scaled = sample(2);
				expect(plain[0]).toBeGreaterThan(100);
				expect(scaled[0]).toBeGreaterThan(100);
				expect(Math.abs(scaled[1] - plain[1])).toBeLessThan(8);
			});
		}
	});

	describe("the height uniforms survive a program switch", () => {
		it("drops the height and eye caches when the program changes under it", (ctx) => {
			requireWebGL(ctx);
			// The placement uniforms live on the PROGRAM, so a swapped shader
			// starts at its own defaults and the batcher's redundant-set cache
			// has to be dropped with it. The height block was missing from
			// that list, and the omission hid behind its old neutral being all
			// zeros — which is also GL's default for an untouched uniform, so
			// a stale cache and a fresh program happened to agree. They no
			// longer do: the neutral carries a 1.
			//
			// Reachable within one batcher because fog is compiled in and the
			// instanced tier is its own variant: a fogged instanced draw and a
			// fogged plain one, same frame and same fog values, are two
			// programs and one cache. The second would silently keep whatever
			// its uniform happened to hold — for the height block, a `w` of 0,
			// which multiplies the entire height factor away.
			setup();
			renderer.setFog(fog({ heightFalloff: 0.02 }));
			// lit: it is the tier that carries BOTH blocks — the eye position
			// only exists on the lit program
			const mesh = quad(0, 4, true);
			mesh.pos.set(0, 40, 0);
			drawAt(mesh, 500);
			const batcher = renderer.currentBatcher;
			renderer.setFog(null);

			// primed by the draw above, so the reset below is observable
			expect(batcher.currentFogAxisY).not.toBeNaN();
			expect(batcher.currentEyeX).not.toBeNaN();

			batcher.useShader(batcher.defaultShader);

			for (const field of [
				"currentFogAxisX",
				"currentFogAxisY",
				"currentFogAxisZ",
				"currentFogBase",
				"currentEyeX",
				"currentEyeY",
				"currentEyeZ",
			]) {
				expect(batcher[field]).toBeNaN();
			}
		});
	});

	describe("the distance is radial", () => {
		it("fogs an off-axis mesh more than one dead ahead at the same depth", (ctx) => {
			requireWebGL(ctx);
			// Same view-space z, different x. Under a view-space-z
			// implementation these are identical; radially the off-axis one is
			// further away and fogs harder. This is the "swimming fog" guard:
			// planar depth makes fog slide as the camera turns.
			// 40 across at 100 deep is 107.7 away, not 100 — a ~7 level
			// difference here, where the same pair at 500 deep would round to
			// the same byte and prove nothing
			renderer.setFog(fog({ invRange: 1 / 250 }));
			setup();
			renderer.save();
			drawAt(quad(0), 100);
			drawAt(quad(40), 100);
			const ahead = readPixel(SIZE / 2, SIZE / 2);
			const offAxis = readPixel(SIZE / 2 + 40, SIZE / 2);
			renderer.restore();
			renderer.setFog(null);
			expect(offAxis[1]).toBeGreaterThan(ahead[1] + 2);
		});
	});

	describe("premultiplied alpha", () => {
		it("scales the fog colour by coverage instead of painting over it", (ctx) => {
			requireWebGL(ctx);
			// Fully fogged, at half alpha. The colour written is premultiplied,
			// so the correct result is fogColour × alpha = 128, not 255.
			//
			// The naive `mix(uFogColor, rgb, f)` writes 255 here — which on an
			// alpha-cutout mesh is the grey halo around every cut edge. The
			// upper bound below is what excludes it.
			renderer.setFog(fog({ near: 0, invRange: 1 / 100 }));
			// pinned to the OPAQUE pass: this is about the fog blend maths, and
			// a fractional alpha would otherwise route the draw into the
			// transparent pass (#1516), where the pixel is composited rather
			// than replaced and the assertion below would measure something
			// else entirely
			const opaque = quad();
			opaque.transparent = false;
			const px = drawRed(opaque, 500, 0.5);
			renderer.setFog(null);
			// Only the colour channels are read: the drawing buffer reports an
			// opaque alpha on readback whatever the fragment wrote, so px[3]
			// would prove nothing here.
			for (const channel of [0, 1, 2]) {
				expect(px[channel]).toBeGreaterThan(120);
				expect(px[channel]).toBeLessThan(136);
			}
		});
	});

	describe("the per-mesh opt-out", () => {
		it("leaves a mesh with fog === false untouched in saturated fog", (ctx) => {
			requireWebGL(ctx);
			renderer.setFog(fog({ near: 0, invRange: 1 / 100 }));
			const exempt = quad();
			exempt.fog = false;
			const px = drawRed(exempt, 500);
			renderer.setFog(null);
			expect([px[0], px[1], px[2]]).toEqual([255, 0, 0]);
		});

		it("fogs a mesh with fog === true, and one that never set it", (ctx) => {
			requireWebGL(ctx);
			renderer.setFog(fog({ near: 0, invRange: 1 / 100 }));
			const explicit = quad();
			explicit.fog = true;
			const withTrue = drawRed(explicit, 500);
			const withNothing = drawRed(quad(), 500);
			renderer.setFog(null);
			expect([withTrue[0], withTrue[1], withTrue[2]]).toEqual([255, 255, 255]);
			expect([withNothing[0], withNothing[1], withNothing[2]]).toEqual([
				255, 255, 255,
			]);
		});
	});

	describe("the lit tier agrees with the unlit one", () => {
		it("fogs a lit mesh to the same place as its unlit twin", (ctx) => {
			requireWebGL(ctx);
			renderer.setFog(fog());
			const unlit = drawRed(quad(), 500);
			const litMesh = quad();
			litMesh.lit = true;
			// no normals and no lights: the lit shader takes its degenerate
			// early return, which is the exit most easily left unfogged
			const lit = drawRed(litMesh, 500);
			renderer.setFog(null);
			for (const channel of [1, 2]) {
				expect(Math.abs(lit[channel] - unlit[channel])).toBeLessThan(10);
			}
		});
	});
});
