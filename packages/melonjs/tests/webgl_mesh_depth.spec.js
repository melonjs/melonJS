import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	boot,
	Matrix3d,
	TextureAtlas,
	video,
	WebGLRenderer,
} from "../src/index.js";

/**
 * Tests for the mesh depth-handling refactor proposed by issue #1468.
 *
 * The old behaviour cleared `DEPTH_BUFFER_BIT` and toggled depth/blend state
 * inside every `drawMesh()` call. That made each mesh self-occlude in
 * isolation: the painter sort decides inter-mesh ordering, the per-mesh
 * depth buffer handles intra-mesh ordering. Cost: N depth clears + N state
 * toggle pairs per frame.
 *
 * The proposed behaviour (matches Three.js): clear depth once per camera
 * draw, keep depth-test on through a run of consecutive mesh draws, restore
 * blend/depth state only when a non-mesh draw call needs it. The GPU's
 * depth test resolves inter-mesh intersection correctly per pixel without
 * any per-mesh clear — same well-proven approach Three.js has shipped for
 * years.
 *
 * Two layers of tests guard the refactor:
 *
 * - **Layer 1 (call-order)** — spies on the WebGL context to count
 *   `clear(DEPTH_BUFFER_BIT)`, `enable(DEPTH_TEST)`, etc. inside a frame of
 *   N mesh draws. Catches the structural goal: 1 clear + 1 enable per
 *   frame, not N. Doesn't render pixels, but verifies the new code path
 *   actually does what the refactor claims.
 *
 * - **Layer 2 (pixel-level)** — renders intersecting / out-of-painter-order
 *   meshes and reads pixels back via `gl.readPixels`. Catches the
 *   correctness goal: the closer mesh wins per pixel via the GPU's depth
 *   test even when the painter sort would have drawn it first.
 *
 * Like the existing `tmxlayer-shader.spec.js`, both layers skip when
 * WebGL2 isn't available (headless CI without GPU flags) — they run
 * locally and on GPU-backed runners.
 */
describe("Mesh depth handling (issue #1468)", () => {
	let renderer;

	beforeAll(async () => {
		await boot();
		try {
			video.init(128, 128, {
				parent: "screen",
				renderer: video.WEBGL,
				// Chromium headless uses a software GL backend that trips
				// the "major performance caveat" flag — without this opt-
				// out, `isWebGLSupported` returns false and the renderer
				// falls back to Canvas, skipping every test below.
				failIfMajorPerformanceCaveat: false,
			});
		} catch {
			// Genuine WebGL absence (no GL of any kind) — tests skip below.
		}
		if (
			video.renderer instanceof WebGLRenderer &&
			video.renderer.WebGLVersion === 2
		) {
			renderer = video.renderer;
		}
	});

	afterAll(() => {
		// Restore the video subsystem to AUTO so this spec doesn't leak
		// a forced-WebGL renderer into other test files that share the
		// `video` global. Mirrors the cleanup pattern in the existing
		// `tmxlayer-shader.spec.js` / `texture-resource.spec.js` WebGL2
		// integration specs.
		try {
			video.init(128, 128, {
				parent: "screen",
				renderer: video.AUTO,
			});
		} catch {
			// ignore — nothing to restore if init never succeeded
		}
	});

	const requireWebGL2 = (ctx) => {
		if (renderer === undefined) {
			ctx.skip("WebGL2 renderer not available in this environment");
		}
	};

	let _sharedAtlas = null;
	const getWhiteAtlas = () => {
		if (_sharedAtlas) {
			return _sharedAtlas;
		}
		const tex = document.createElement("canvas");
		tex.width = 1;
		tex.height = 1;
		const ctx = tex.getContext("2d");
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, 1, 1);
		_sharedAtlas = new TextureAtlas(
			{ framewidth: 1, frameheight: 1, image: tex, name: "white_1x1" },
			tex,
			false,
		);
		return _sharedAtlas;
	};

	/**
	 * Build a fake "mesh" — a POJO with the duck-typed shape
	 * (`vertices`, `uvs`, `indices`, `texture`, `cullBackFaces`) that
	 * `renderer.drawMesh` and `MeshBatcher.addMesh` consume. Bypasses
	 * `Mesh.draw` (which runs `_projectVertices` and, under the Camera2d
	 * code path, forces every vertex z to 0 — defeating depth tests).
	 * Vertices are in canvas-space (0..128) so they project 1:1 under
	 * the ortho projection set up in `setupOrthoProjection`.
	 */
	const makeQuadMesh = (cx, cy, z, tintRGBA, half = 24) => {
		const verts = new Float32Array([
			cx - half,
			cy - half,
			z, // 0: top-left
			cx + half,
			cy - half,
			z, // 1: top-right
			cx + half,
			cy + half,
			z, // 2: bottom-right
			cx - half,
			cy + half,
			z, // 3: bottom-left
		]);
		const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
		const idx = new Uint16Array([0, 1, 2, 0, 2, 3]);
		return {
			vertices: verts,
			uvs,
			indices: idx,
			texture: getWhiteAtlas(),
			// Disable culling — the Y-flipped ortho makes CCW winding
			// read as CW from the GPU's perspective, which the default
			// CULL_BACK would reject. We don't care about winding
			// correctness here, only depth resolution.
			cullBackFaces: false,
			tintRGBA,
			// 0 = no cutout (default). The alpha-cutout tests below set this.
			alphaCutoff: 0,
		};
	};

	// ──────────────────────────────────────────────────────────────────────
	// Layer 1 — call-order invariants
	// ──────────────────────────────────────────────────────────────────────

	describe("call-order invariants (Layer 1)", () => {
		const spyGL = (gl) => {
			const calls = { clear: [], enable: [], disable: [], drawElements: 0 };
			const origClear = gl.clear.bind(gl);
			const origEnable = gl.enable.bind(gl);
			const origDisable = gl.disable.bind(gl);
			const origDraw = gl.drawElements.bind(gl);
			gl.clear = (mask) => {
				calls.clear.push(mask);
				return origClear(mask);
			};
			gl.enable = (cap) => {
				calls.enable.push(cap);
				return origEnable(cap);
			};
			gl.disable = (cap) => {
				calls.disable.push(cap);
				return origDisable(cap);
			};
			gl.drawElements = (...args) => {
				calls.drawElements++;
				return origDraw(...args);
			};
			const restore = () => {
				gl.clear = origClear;
				gl.enable = origEnable;
				gl.disable = origDisable;
				gl.drawElements = origDraw;
			};
			return { calls, restore };
		};

		it("a frame of 5 mesh draws issues at most 1 depth clear", (ctx) => {
			requireWebGL2(ctx);
			const mesh = makeQuadMesh(64, 64, 0, [200, 50, 50, 255]);
			const { calls, restore } = spyGL(renderer.gl);
			try {
				for (let i = 0; i < 5; i++) {
					renderer.drawMesh(mesh);
				}
				const depthBit = renderer.gl.DEPTH_BUFFER_BIT;
				const depthClears = calls.clear.filter((mask) => {
					return (mask & depthBit) === depthBit;
				}).length;
				// Pre-refactor: 5. Post-refactor: at most 1.
				expect(depthClears).toBeLessThanOrEqual(1);
			} finally {
				restore();
			}
		});

		it("DEPTH_TEST is enabled at most once across a run of consecutive meshes", (ctx) => {
			requireWebGL2(ctx);
			const mesh = makeQuadMesh(64, 64, 0, [200, 50, 50, 255]);
			const { calls, restore } = spyGL(renderer.gl);
			try {
				for (let i = 0; i < 5; i++) {
					renderer.drawMesh(mesh);
				}
				const depthTest = renderer.gl.DEPTH_TEST;
				const enableCount = calls.enable.filter((cap) => {
					return cap === depthTest;
				}).length;
				// Pre-refactor: 5. Post-refactor: at most 1.
				expect(enableCount).toBeLessThanOrEqual(1);
			} finally {
				restore();
			}
		});

		it("BLEND is disabled at most once across a run of consecutive meshes", (ctx) => {
			requireWebGL2(ctx);
			const mesh = makeQuadMesh(64, 64, 0, [200, 50, 50, 255]);
			const { calls, restore } = spyGL(renderer.gl);
			try {
				for (let i = 0; i < 5; i++) {
					renderer.drawMesh(mesh);
				}
				const blend = renderer.gl.BLEND;
				const disableCount = calls.disable.filter((cap) => {
					return cap === blend;
				}).length;
				// Pre-refactor: 5. Post-refactor: at most 1.
				expect(disableCount).toBeLessThanOrEqual(1);
			} finally {
				restore();
			}
		});

		it("drawElements still fires once per mesh draw (no draws lost)", (ctx) => {
			requireWebGL2(ctx);
			const mesh = makeQuadMesh(64, 64, 0, [200, 50, 50, 255]);
			const { calls, restore } = spyGL(renderer.gl);
			try {
				for (let i = 0; i < 5; i++) {
					renderer.drawMesh(mesh);
				}
				// Each drawMesh must result in at least one drawElements —
				// the renderer might chunk for buffer limits and fire more,
				// but never less.
				expect(calls.drawElements).toBeGreaterThanOrEqual(5);
			} finally {
				restore();
			}
		});
	});

	// ──────────────────────────────────────────────────────────────────────
	// Layer 2 — pixel-level depth correctness
	// ──────────────────────────────────────────────────────────────────────

	describe("depth correctness (Layer 2)", () => {
		const readCenterPixel = () => {
			const gl = renderer.gl;
			const px = new Uint8Array(4);
			// Force the driver to flush all pending GL work so readPixels
			// returns the actual rendered output, not a partial frame.
			gl.finish();
			gl.readPixels(64, 64, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
			return px;
		};

		/**
		 * Configure a known ortho projection mapping the canvas (128x128)
		 * 1:1 to NDC, with a wide z range so test meshes at z=±10 stay
		 * inside the visible volume. Standalone drawMesh calls (outside
		 * the camera/world tree) inherit whatever was last set up — the
		 * tests don't go through a camera's draw, so we set the
		 * projection explicitly.
		 *
		 * `ortho(left, right, bottom, top, near, far)` — bottom > top so
		 * the y axis matches the engine's "y grows downward" convention,
		 * same as Camera2d's ortho setup.
		 */
		const setupOrthoProjection = () => {
			const proj = new Matrix3d();
			proj.ortho(0, 128, 128, 0, -1000, 1000);
			renderer.setProjection(proj);
		};

		const drawWithTint = (mesh) => {
			renderer.currentTint.setColor(...mesh.tintRGBA);
			renderer.drawMesh(mesh);
		};

		it("closer mesh wins per-pixel even when drawn before a farther mesh (painter sort wrong)", (ctx) => {
			requireWebGL2(ctx);
			setupOrthoProjection();
			// Deliberately draw in painter-wrong order. Under the engine's
			// projection convention `z = +N` is closer to the camera than
			// `z = -N` (matches "higher pos.z draws on top" painter sort):
			//   1. red mesh at z=+10 (closer, should win)
			//   2. green mesh at z=-10 (farther, drawn second — should be
			//      rejected by the GPU depth test, NOT overwrite red).
			// Both overlap at the canvas centre (64,64).
			//
			// With per-mesh depth clear (pre-refactor): each mesh draw
			// resets the depth attachment. Green draws second against a
			// blank buffer → green wins where red was → BUG.
			//
			// Without per-mesh clear (post-refactor): red's depth values
			// persist. Green's farther z fails the LEQUAL test against
			// red's stored depth → green pixels rejected → red stays
			// visible → CORRECT.
			//
			// Use `renderer.clear()` (not `clearColor()`) so the lazy
			// depth clear is re-armed via the `RENDER_TARGET_CHANGED`
			// event broadcast — otherwise depth values written by a
			// previous test in the same spec file persist into this
			// run and the readback becomes order-dependent.
			renderer.backgroundColor.setColor(0, 0, 0, 255);
			renderer.clear();
			const red = makeQuadMesh(64, 64, 10, [220, 20, 20, 255]);
			const green = makeQuadMesh(64, 64, -10, [20, 220, 20, 255]);
			// makeQuadMesh sets `cullBackFaces: false`, so drawMesh skips
			// the CULL_FACE toggle entirely — no need to disable it here
			// (which would leak the disabled state across to other tests).
			drawWithTint(red);
			drawWithTint(green);
			const px = readCenterPixel();
			// Red wins → red channel dominant, green channel low.
			expect(px[0]).toBeGreaterThan(150);
			expect(px[1]).toBeLessThan(80);
		});

		it("non-intersecting meshes at the same Z don't mutually occlude", (ctx) => {
			requireWebGL2(ctx);
			setupOrthoProjection();
			// Two meshes side by side at the same z. Neither should hide
			// the other — this is a smoke test that the shared depth
			// buffer doesn't accidentally reject same-z pixels via
			// LEQUAL's edge case.
			//
			// `clear()` (not `clearColor()`) so the lazy depth clear
			// re-arms via `RENDER_TARGET_CHANGED`.
			renderer.backgroundColor.setColor(0, 0, 0, 255);
			renderer.clear();
			const left = makeQuadMesh(32, 64, 0, [220, 20, 20, 255]);
			const right = makeQuadMesh(96, 64, 0, [20, 20, 220, 255]);
			drawWithTint(left);
			drawWithTint(right);
			const gl = renderer.gl;
			gl.finish();
			const pxLeft = new Uint8Array(4);
			const pxRight = new Uint8Array(4);
			gl.readPixels(32, 64, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pxLeft);
			gl.readPixels(96, 64, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pxRight);
			expect(pxLeft[0]).toBeGreaterThan(150);
			expect(pxRight[2]).toBeGreaterThan(150);
		});

		// ── ADVERSARIAL: depth accumulation across many meshes ──────────────
		// Each drawMesh flushes immediately (separate draw call), so inter-mesh
		// occlusion relies entirely on the depth buffer ACCUMULATING across a
		// long run of draws via the one-shot per-target clear. These probe the
		// exact glTF-scene shape: many props + platforms in one mesh run.
		//
		// The lazy depth clear fires on the first MeshBatcher.bind() of a new
		// target — i.e. on a batcher *transition*. A real frame always has 2D
		// / camera content before the mesh run, so the transition (and thus
		// the depth clear) happens every frame. These tests share one renderer
		// across the file, and consecutive mesh-only tests would otherwise
		// leak stale depth into each other, so `freshFrame()` reproduces a real
		// frame: clear (arms the lazy depth clear) + a 2D draw (puts the
		// batcher in non-mesh state) so the first mesh below transitions and
		// triggers the clear. Without this, the assertions become order-
		// dependent (a test artifact, not an engine bug — every case here
		// passes in isolation).
		const freshFrame = () => {
			renderer.backgroundColor.setColor(0, 0, 0, 255);
			renderer.clear();
			renderer.setColor("#000000");
			renderer.fillRect(0, 0, 1, 1); // force a non-mesh batcher state
		};

		it("a near mesh survives MANY farther meshes drawn after it", (ctx) => {
			requireWebGL2(ctx);
			setupOrthoProjection();
			freshFrame();
			// closest mesh first, then 16 farther meshes all over the centre.
			// If the depth buffer is wiped/not-accumulated between draws, a
			// later far mesh overwrites the near one → red lost.
			drawWithTint(makeQuadMesh(64, 64, 100, [220, 20, 20, 255]));
			for (let i = 0; i < 16; i++) {
				drawWithTint(makeQuadMesh(64, 64, 80 - i * 5, [20, 220, 20, 255]));
			}
			const px = readCenterPixel();
			expect(px[0]).toBeGreaterThan(150); // red (nearest) still wins
			expect(px[1]).toBeLessThan(80);
		});

		it("a large far 'platform' drawn LAST does not overwrite a near 'prop'", (ctx) => {
			requireWebGL2(ctx);
			setupOrthoProjection();
			freshFrame();
			// THE glTF-scene scenario: a small near prop drawn first, then a
			// big far platform (full canvas) drawn LAST that covers the prop's
			// screen pixels. Correct depth → the platform's farther z is
			// rejected and the prop survives. A depth-accumulation bug → the
			// platform paints over the prop → prop "sinks into" the platform.
			drawWithTint(makeQuadMesh(64, 64, 50, [220, 20, 20, 255], 12)); // prop
			drawWithTint(makeQuadMesh(64, 64, -50, [20, 220, 20, 255], 64)); // platform
			const px = readCenterPixel();
			expect(px[0]).toBeGreaterThan(150); // prop (red) survives
			expect(px[1]).toBeLessThan(80);
		});

		it("a near 'prop' drawn AFTER a far 'platform' also wins (painter-correct order)", (ctx) => {
			requireWebGL2(ctx);
			setupOrthoProjection();
			freshFrame();
			// the other order: platform first, prop second. Prop is nearer →
			// must paint over the platform regardless of order.
			drawWithTint(makeQuadMesh(64, 64, -50, [20, 220, 20, 255], 64)); // platform
			drawWithTint(makeQuadMesh(64, 64, 50, [220, 20, 20, 255], 12)); // prop
			const px = readCenterPixel();
			expect(px[0]).toBeGreaterThan(150); // prop (red) on top
			expect(px[1]).toBeLessThan(80);
		});
	});

	// ──────────────────────────────────────────────────────────────────────
	// Layer 2 — alpha cutout (glTF alphaMode MASK)
	// ──────────────────────────────────────────────────────────────────────
	//
	// The mesh shaders `discard` a fragment whose final alpha is below
	// `uAlphaCutoff`. With no blending (mesh mode disables BLEND), a discarded
	// fragment leaves the background untouched. These drive the fragment alpha
	// via the global alpha (which becomes `vColor.a` through the batcher) and
	// read back the centre pixel: below the cutoff → background survives; at /
	// above → the mesh paints. Doubles as a smoke test that both shaders still
	// COMPILE with the new uniform and the batcher's `setUniform` path runs.

	describe("alpha cutout (Layer 2)", () => {
		const readCenter = () => {
			const gl = renderer.gl;
			const px = new Uint8Array(4);
			gl.finish();
			gl.readPixels(64, 64, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
			return px;
		};

		const setupOrtho = () => {
			const proj = new Matrix3d();
			proj.ortho(0, 128, 128, 0, -1000, 1000);
			renderer.setProjection(proj);
		};

		const freshFrame = () => {
			renderer.backgroundColor.setColor(0, 0, 0, 255);
			renderer.clear();
			renderer.setColor("#000000");
			renderer.fillRect(0, 0, 1, 1); // force a non-mesh batcher state
		};

		const drawCutoutMesh = (alpha) => {
			const mesh = makeQuadMesh(64, 64, 0, [220, 20, 20, 255]);
			mesh.alphaCutoff = 0.5;
			renderer.currentTint.setColor(...mesh.tintRGBA);
			renderer.setGlobalAlpha(alpha); // becomes vColor.a in the shader
			renderer.drawMesh(mesh);
			renderer.setGlobalAlpha(1); // restore for sibling tests
		};

		it("discards fragments whose alpha is below the cutoff (background survives)", (ctx) => {
			requireWebGL2(ctx);
			setupOrtho();
			freshFrame();
			drawCutoutMesh(0.3); // 0.3 < 0.5 → discard every fragment
			const px = readCenter();
			expect(px[0]).toBeLessThan(60); // red dropped → black background
		});

		it("keeps fragments at or above the cutoff", (ctx) => {
			requireWebGL2(ctx);
			setupOrtho();
			freshFrame();
			drawCutoutMesh(0.9); // 0.9 >= 0.5 → fragment kept
			const px = readCenter();
			expect(px[0]).toBeGreaterThan(150); // red paints through
		});

		it("a zero cutoff (default) keeps a fragment a non-zero cutoff would drop", (ctx) => {
			requireWebGL2(ctx);
			setupOrtho();
			freshFrame();
			// At alpha 0.45 the cutout=0.5 case (test above) discards to black.
			// With alphaCutoff at its 0 default, `a < 0` is never true → the same
			// fragment survives. Output RGB is premultiplied (≈ 220·0.45 ≈ 99),
			// so a kept fragment reads clearly above the discarded-to-black floor.
			const mesh = makeQuadMesh(64, 64, 0, [220, 20, 20, 255]);
			renderer.currentTint.setColor(...mesh.tintRGBA);
			renderer.setGlobalAlpha(0.45);
			renderer.drawMesh(mesh);
			renderer.setGlobalAlpha(1);
			const px = readCenter();
			expect(px[0]).toBeGreaterThan(50); // kept (≈99), not discarded (≈0)
		});
	});
});
