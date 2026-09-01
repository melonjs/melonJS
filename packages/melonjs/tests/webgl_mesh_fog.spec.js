import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, Matrix3d, Mesh, TextureAtlas } from "../src/index.js";
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
	const quad = (x = 0, half = 4) => {
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
			lit: false,
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
	const fog = (over) => {
		return {
			mode: 1,
			near: 0,
			invRange: 1 / 1000,
			density: 0,
			color: new Float32Array([1, 1, 1]),
			// uniform fog: a zero falloff collapses the height integral to 1
			heightFalloff: 0,
			fogHeight: 0,
			cameraY: 0,
			...over,
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
			const px = drawRed(quad(), 500, 0.5);
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
