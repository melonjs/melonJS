import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	boot,
	Camera3d,
	Sprite3d,
	video,
	WebGLRenderer,
} from "../src/index.js";

/**
 * Sprite3d through the real WebGL draw path.
 *
 * The other Sprite3d specs run under the Canvas renderer and exercise the
 * billboard / atlas / flip *math* directly (`_projectVerticesWorld`, `uvs`,
 * `originalVertices`) — they never push a Sprite3d through `WebGLRenderer.
 * drawMesh` → `MeshBatcher` (texture upload, the `uAlphaCutoff` uniform, atlas
 * UVs reaching the GPU). That path was previously only validated by hand via the
 * Billboard example screenshot — and it's exactly where a regression hid once
 * (an atlas resolved without a usable `getTexture()` → `MeshBatcher.uploadTexture`
 * read `.width` of `undefined`). These smokes draw real Sprite3d instances under
 * a `Camera3d` + WebGL renderer and assert the draw actually reaches the GPU
 * without throwing.
 *
 * Skips when WebGL2 isn't available (headless CI without GPU flags); runs
 * locally and on GPU-backed runners. Mirrors the harness in
 * `webgl_mesh_depth.spec.js`.
 */
describe("Sprite3d — WebGL draw path", () => {
	let renderer;

	beforeAll(async () => {
		await boot();
		try {
			video.init(128, 128, {
				parent: "screen",
				renderer: video.WEBGL,
				// headless chromium uses a software GL backend that trips the
				// "major performance caveat" flag — opt out so the WebGL renderer
				// is actually used instead of falling back to Canvas
				failIfMajorPerformanceCaveat: false,
			});
		} catch {
			// genuine WebGL absence — tests skip below
		}
		if (
			video.renderer instanceof WebGLRenderer &&
			typeof video.renderer.gl !== "undefined"
		) {
			renderer = video.renderer;
		}
	});

	afterAll(() => {
		// restore AUTO so this spec doesn't leak a forced-WebGL renderer into
		// other specs sharing the `video` global
		try {
			video.init(128, 128, { parent: "screen", renderer: video.AUTO });
		} catch {
			// ignore
		}
	});

	const requireWebGL2 = (ctx) => {
		if (renderer === undefined) {
			ctx.skip("WebGL2 renderer not available in this environment");
		}
	};

	// solid opaque texture (alpha = 1 everywhere, so alphaCutoff keeps it all)
	const makeTex = (w, h) => {
		const c = document.createElement("canvas");
		c.width = w;
		c.height = h;
		const ctx = c.getContext("2d");
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, w, h);
		return c;
	};

	// spy gl.drawElements to confirm the mesh actually reached the GPU (a draw
	// that silently no-ops would pass a bare "didn't throw" check)
	const spyDraw = (gl) => {
		let count = 0;
		const orig = gl.drawElements.bind(gl);
		gl.drawElements = (...args) => {
			count++;
			return orig(...args);
		};
		return {
			count: () => {
				return count;
			},
			restore: () => {
				gl.drawElements = orig;
			},
		};
	};

	// draw a Sprite3d head-on under a Camera3d; returns the drawElements count
	const drawOnce = (sprite) => {
		const cam = new Camera3d(0, 0, 128, 128);
		cam.pos.set(0, 0, 400);
		cam.lookAt(0, 0, 0);
		const spy = spyDraw(renderer.gl);
		try {
			renderer.clear();
			sprite.preDraw(renderer, cam);
			sprite.draw(renderer, cam);
			sprite.postDraw(renderer, cam);
			renderer.flush();
			return spy.count();
		} finally {
			spy.restore();
		}
	};

	it("draws a plain-image Sprite3d (no framewidth) — the getTexture path", (ctx) => {
		requireWebGL2(ctx);
		// the exact regression case: a plain image with no framewidth must
		// resolve a frame-aware atlas whose getTexture() the batcher can upload
		const s = new Sprite3d(0, 0, {
			image: makeTex(32, 32),
			width: 64,
			height: 64,
			z: 0,
			billboard: "cylindrical",
		});
		let draws = 0;
		expect(() => {
			draws = drawOnce(s);
		}).not.toThrow();
		expect(draws).toBeGreaterThan(0);
	});

	it("draws an animated spritesheet Sprite3d (atlas UVs reach the GPU)", (ctx) => {
		requireWebGL2(ctx);
		const s = new Sprite3d(0, 0, {
			image: makeTex(128, 32), // 4× 32px frames
			framewidth: 32,
			frameheight: 32,
			width: 48,
			height: 48,
			z: 0,
			billboard: "spherical",
		});
		s.addAnimation("walk", [0, 1, 2, 3], 100);
		s.setCurrentAnimation("walk");
		s.update(120); // advance a frame so non-default UVs are uploaded
		let draws = 0;
		expect(() => {
			draws = drawOnce(s);
		}).not.toThrow();
		expect(draws).toBeGreaterThan(0);
	});

	it("draws with alphaCutoff (default 0.5) — sets the uniform without throwing", (ctx) => {
		requireWebGL2(ctx);
		const s = new Sprite3d(0, 0, {
			image: makeTex(32, 32),
			width: 64,
			height: 64,
			z: 0,
			billboard: "cylindrical",
		});
		expect(s.alphaCutoff).toBe(0.5);
		expect(() => {
			drawOnce(s);
		}).not.toThrow();
		// re-draw with cutout disabled (different uniform value) — also fine
		const opaque = new Sprite3d(0, 0, {
			image: makeTex(32, 32),
			width: 64,
			height: 64,
			z: 0,
			alphaCutoff: 0,
		});
		expect(() => {
			drawOnce(opaque);
		}).not.toThrow();
	});

	it("draws a flipped Sprite3d without throwing", (ctx) => {
		requireWebGL2(ctx);
		const s = new Sprite3d(0, 0, {
			image: makeTex(32, 32),
			width: 64,
			height: 64,
			z: 0,
			billboard: "cylindrical",
			flipX: true,
		});
		expect(() => {
			drawOnce(s);
		}).not.toThrow();
	});

	describe("retained-mode billboards (issue #1507)", () => {
		const makeBillboard = () => {
			return new Sprite3d(0, 0, {
				image: makeTex(32, 32),
				width: 64,
				height: 64,
				z: 0,
				billboard: "cylindrical",
			});
		};

		const countUploads = (gl) => {
			const calls = { array: 0, drawElements: 0 };
			const orig = gl.bufferData.bind(gl);
			const origDraw = gl.drawElements.bind(gl);
			gl.bufferData = (target, ...rest) => {
				if (target === gl.ARRAY_BUFFER) {
					calls.array++;
				}
				return orig(target, ...rest);
			};
			gl.drawElements = (...args) => {
				calls.drawElements++;
				return origDraw(...args);
			};
			return {
				calls,
				restore: () => {
					gl.bufferData = orig;
					gl.drawElements = origDraw;
				},
			};
		};

		it("the billboard model matrix agrees with the CPU corner projection", (ctx) => {
			requireWebGL2(ctx);
			// The billboard basis is now applied twice over: once on the CPU for
			// renderers without retained geometry, once as a matrix for the GPU.
			// If those ever disagree the card would face a different way
			// depending on the backend, so pin them against each other.
			const s = makeBillboard();
			const cam = new Camera3d(0, 0, 128, 128);
			cam.pos.set(120, 60, 400);
			cam.lookAt(0, 0, 0);
			s.pos.set(17, -23, 0);
			s.depth = 9;
			s._billboardCam = cam;
			// without this both sides would fall back to the plain mesh
			// placement and agree for the wrong reason
			expect(s._billboardBasis()).not.toBe(false);

			const m = s._composeModelMatrix().val;
			s._projectVerticesWorld(s.pos.x, s.pos.y, s.depth);
			const cpu = Array.from(s.vertices);

			for (let i = 0; i < 4; i++) {
				const x = s.originalVertices[i * 3];
				const y = s.originalVertices[i * 3 + 1];
				const z = s.originalVertices[i * 3 + 2];
				// column-major: m[col * 4 + row]
				expect(m[0] * x + m[4] * y + m[8] * z + m[12]).toBeCloseTo(
					cpu[i * 3],
					4,
				);
				expect(m[1] * x + m[5] * y + m[9] * z + m[13]).toBeCloseTo(
					cpu[i * 3 + 1],
					4,
				);
				expect(m[2] * x + m[6] * y + m[10] * z + m[14]).toBeCloseTo(
					cpu[i * 3 + 2],
					4,
				);
			}
		});

		it("re-orienting a billboard across frames uploads nothing", (ctx) => {
			requireWebGL2(ctx);
			const s = makeBillboard();
			drawOnce(s);
			const { calls, restore } = countUploads(renderer.gl);
			try {
				const cam = new Camera3d(0, 0, 128, 128);
				for (let i = 1; i <= 4; i++) {
					// orbit the camera so the card re-faces it every frame
					cam.pos.set(i * 40, i * 15, 400);
					cam.lookAt(0, 0, 0);
					renderer.clear();
					s.preDraw(renderer, cam);
					s.draw(renderer, cam);
					s.postDraw(renderer, cam);
					renderer.flush();
				}
				// facing the camera is a matrix, not a geometry edit — but only
				// meaningful if the frames actually drew: zero uploads is also
				// what "nothing happened at all" looks like
				expect(calls.drawElements).toBe(4);
				expect(calls.array).toBe(0);
			} finally {
				restore();
			}
		});

		it("changing animation frame re-uploads exactly once", (ctx) => {
			requireWebGL2(ctx);
			// a frame change rewrites the quad's UVs in place, which IS a
			// geometry edit and must invalidate the retained copy — but only once
			const s = makeBillboard();
			drawOnce(s);
			const { calls, restore } = countUploads(renderer.gl);
			try {
				s._applyFrame(s._region);
				drawOnce(s);
				expect(calls.array).toBe(1);
				drawOnce(s);
				drawOnce(s);
				expect(calls.array).toBe(1);
			} finally {
				restore();
			}
		});
	});
});
