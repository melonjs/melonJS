import { beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	event,
	Light2d,
	QuadBatcher,
	ShaderEffect,
	video,
	WebGLRenderer,
} from "../src/index.js";

/**
 * Adversarial VAO validation (#1509) — hunting the failure mode VAO bugs
 * are worst at: wrong vertex data with NO_ERROR. Storms of random
 * operations followed by full layout readback and pixel-truth checks.
 */
describe("WebGL VAO adversarial", () => {
	let renderer;
	let gl;
	let isWebGL;

	let app;
	beforeAll(async () => {
		boot();
		app = new Application(64, 64, {
			parent: "screen",
			renderer: video.WEBGL,
			failIfMajorPerformanceCaveat: false,
			antiAlias: false,
		});
		await app.init();
		renderer = app.renderer;
		isWebGL = renderer instanceof WebGLRenderer;
		if (isWebGL) {
			gl = renderer.gl;
			// bare-harness gotcha: no game loop runs here, so the camera
			// never installs its projection — screen-space ortho or every
			// quad lands outside clip space
			renderer.projectionMatrix.ortho(0, 64, 64, 0, -1, 1);
		}
	});

	const requireWebGL = (ctx) => {
		if (!isWebGL) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	const tick = () => {
		return new Promise((resolve) => {
			setTimeout(resolve, 0);
		});
	};

	// deterministic LCG so the fuzz sequence is reproducible
	function makeRandom(seed) {
		let state = seed >>> 0;
		return () => {
			state = (state * 1664525 + 1013904223) >>> 0;
			return state / 0xffffffff;
		};
	}

	function solidCanvas(r, g, b) {
		const c = document.createElement("canvas");
		c.width = c.height = 16;
		const ctx2d = c.getContext("2d");
		ctx2d.fillStyle = `rgb(${r},${g},${b})`;
		ctx2d.fillRect(0, 0, 16, 16);
		return c;
	}

	// full vertex-state readback for one batcher (binds its VAO raw, then
	// restores the previous binding)
	function snapshotLayout(batcher) {
		const previous = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
		gl.bindVertexArray(batcher.vertexState.handle);
		const snap = batcher.attributes.map((attr) => {
			const loc = batcher.defaultShader.getAttribLocation(attr.name);
			if (loc === -1) {
				return `${attr.name}:absent`;
			}
			return [
				attr.name,
				gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_ENABLED),
				gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_STRIDE),
				gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_SIZE),
				gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_TYPE),
				gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_NORMALIZED),
				gl.getVertexAttribOffset(loc, gl.VERTEX_ATTRIB_ARRAY_POINTER),
			].join("|");
		});
		gl.bindVertexArray(previous);
		return snap.join(" ~ ");
	}

	function snapshotAll() {
		const all = {};
		for (const [name, batcher] of renderer.batchers) {
			all[name] = snapshotLayout(batcher);
		}
		return all;
	}

	// read one pixel from the default framebuffer (y flipped to screen space)
	function pixelAt(x, y) {
		const px = new Uint8Array(4);
		gl.readPixels(
			x,
			gl.drawingBufferHeight - 1 - y,
			1,
			1,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			px,
		);
		return px;
	}

	// deterministic mini-scene exercised between storms: red quad on the
	// left, green stroked square on the right (quad + primitive layouts —
	// the mesh layout is pinned by the recreation/state specs)
	function drawTruthSceneAndAssert() {
		// projection uniforms are synced at batcher-SWITCH time; a bare
		// harness (no game loop) may never switch, leaving the init-era
		// identity in the program — toggle to push the ortho into both
		renderer.setBatcher("primitive");
		renderer.setBatcher("quad");
		renderer.clearColor("#000000ff");
		const red = solidCanvas(255, 0, 0);
		renderer.drawImage(red, 0, 0, 16, 16, 4, 24, 16, 16);
		renderer.setColor("#00ff00");
		renderer.fillRect(40, 24, 16, 16);
		renderer.setColor("#ffffff");
		renderer.flush();

		const inRed = pixelAt(12, 32);
		expect(inRed[0], "red quad").toBeGreaterThan(200);
		expect(inRed[1], "red quad").toBeLessThan(60);
		const inGreen = pixelAt(48, 32);
		expect(inGreen[1], "green fill").toBeGreaterThan(200);
		expect(inGreen[0], "green fill").toBeLessThan(60);
		expect(gl.getError()).toBe(gl.NO_ERROR);
	}

	// An explicit timeout, for the same reason the config raises
	// `hookTimeout`: this file runs in well under a second on its own, but
	// the shared browser session gets slower as specs accumulate, and a
	// software rasterizer under load stretches several hundred GL ops by more
	// than an order of magnitude. It is a slow test, not a hanging one — and
	// cutting the iteration count to fit would trade real fuzz coverage for a
	// round number.
	it("fuzz: several hundred random ops leave every frozen layout byte-identical", (ctx) => {
		requireWebGL(ctx);
		const before = snapshotAll();
		const random = makeRandom(0xc0ffee);
		const tex = solidCanvas(0, 0, 255);
		const effect = new ShaderEffect(
			renderer,
			"vec4 apply(vec4 color, vec2 uv) { return color; }",
		);

		let firstError = "none";
		for (let i = 0; i < 300; i++) {
			const op = Math.floor(random() * 6);
			switch (op) {
				case 0:
					renderer.drawImage(
						tex,
						0,
						0,
						16,
						16,
						random() * 40,
						random() * 40,
						16,
						16,
					);
					break;
				case 1:
					renderer.strokeRect(random() * 40, random() * 40, 10, 8);
					break;
				case 2:
					renderer.setBatcher(random() < 0.5 ? "quad" : "primitive");
					break;
				case 3: {
					renderer.customShader = effect;
					renderer.drawImage(
						tex,
						0,
						0,
						16,
						16,
						random() * 40,
						random() * 40,
						16,
						16,
					);
					renderer.customShader = undefined;
					break;
				}
				case 4:
					renderer.flush();
					break;
				case 5:
					// engine-faithful reset flow: a batcher is reset while
					// current (renderer.reset re-binds afterwards); a naked
					// cross-batcher reset would setUniform on a non-current
					// program — not an engine path
					renderer.setBatcher("quad");
					renderer.batchers.get("quad").reset();
					break;
			}
			if (firstError === "none") {
				const e = gl.getError();
				if (e !== gl.NO_ERROR) {
					firstError = `op${op}@${i}:0x${e.toString(16)}`;
				}
			}
		}
		renderer.flush();
		effect.destroy();

		expect(firstError).toBe("none");
		expect(snapshotAll()).toEqual(before);
		drawTruthSceneAndAssert();
	}, 60000);

	it("enabled-but-unconsumed attribute: 3-of-4 shader roundtrip stays pixel-correct", (ctx) => {
		requireWebGL(ctx);
		// ShaderEffect vertex declares aVertex/aRegion/aColor — quad's 4th
		// attribute (aTextureId, location 3) stays ENABLED but unconsumed:
		// the legality assumption the frozen-VAO design rests on
		const effect = new ShaderEffect(
			renderer,
			"vec4 apply(vec4 color, vec2 uv) { return color; }",
		);
		const tex = solidCanvas(255, 0, 255);
		renderer.save();
		renderer.customShader = effect;
		renderer.drawImage(tex, 0, 0, 16, 16, 4, 4, 16, 16);
		renderer.flush();
		renderer.customShader = undefined;
		renderer.restore();
		expect(gl.getError()).toBe(gl.NO_ERROR);

		drawTruthSceneAndAssert();
		effect.destroy();
	});

	it("drawLight interleaved with sprites keeps the pipeline clean", (ctx) => {
		requireWebGL(ctx);
		const tex = solidCanvas(200, 200, 0);
		const light = new Light2d(20, 20, 12);
		renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
		renderer.drawLight(light);
		renderer.drawImage(tex, 0, 0, 16, 16, 30, 30, 16, 16);
		renderer.flush();
		expect(gl.getError()).toBe(gl.NO_ERROR);
		light.destroy();
		drawTruthSceneAndAssert();
	});

	it("mid-frame context loss (between setBatcher and flush) recovers", async (ctx) => {
		requireWebGL(ctx);
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		const tex = solidCanvas(0, 255, 255);
		// half-bound: batcher switched, vertices pushed, NOT flushed
		renderer.setBatcher("quad");
		renderer.drawImage(tex, 0, 0, 16, 16, 8, 8, 16, 16);

		const restored = new Promise((resolve) => {
			event.once(event.ONCONTEXT_RESTORED, resolve);
		});
		ext.loseContext();
		await tick();
		ext.restoreContext();
		await restored;
		await tick();

		for (const [name, batcher] of renderer.batchers) {
			expect(gl.isVertexArray(batcher.vertexState.handle), name).toBe(true);
		}
		drawTruthSceneAndAssert();
	});

	it("multi-renderer isolation: two live WebGL contexts, no crosstalk", async (ctx) => {
		requireWebGL(ctx);
		const appB = new Application(48, 48, {
			parent: "screen",
			renderer: video.WEBGL,
			failIfMajorPerformanceCaveat: false,
			consoleHeader: false,
		});
		await appB.init();
		const rendererB = appB.renderer;
		const glB = rendererB.gl;
		rendererB.projectionMatrix.ortho(0, 48, 48, 0, -1, 1);
		try {
			expect(glB.getError(), "post-construction B").toBe(glB.NO_ERROR);
			expect(gl.getError(), "post-construction A").toBe(gl.NO_ERROR);
			// each context validates its OWN vertex states...
			for (const [name, batcher] of rendererB.batchers) {
				expect(glB.isVertexArray(batcher.vertexState.handle), `B.${name}`).toBe(
					true,
				);
			}
			// ...and rejects the other context's (container objects are
			// per-context)
			expect(
				glB.isVertexArray(renderer.batchers.get("quad").vertexState.handle),
			).toBe(false);

			// drawing on B must not disturb A's pixel truth
			const texB = solidCanvas(255, 128, 0);
			rendererB.drawImage(texB, 0, 0, 16, 16, 0, 0, 16, 16);
			rendererB.flush();
			expect(glB.getError()).toBe(glB.NO_ERROR);

			drawTruthSceneAndAssert();
		} finally {
			appB.destroy();
		}
	});

	it("custom batcher (no overrides) inherits a working vertex state", async (ctx) => {
		requireWebGL(ctx);
		class InheritingBatcher extends QuadBatcher {}
		const appC = new Application(48, 48, {
			parent: "screen",
			renderer: video.WEBGL,
			failIfMajorPerformanceCaveat: false,
			consoleHeader: false,
			batcher: InheritingBatcher,
		});
		await appC.init();
		const rendererC = appC.renderer;
		const glC = rendererC.gl;
		rendererC.projectionMatrix.ortho(0, 48, 48, 0, -1, 1);
		rendererC.setBatcher("primitive");
		rendererC.setBatcher("quad");
		try {
			const quad = rendererC.batchers.get("quad");
			expect(quad).toBeInstanceOf(InheritingBatcher);
			expect(glC.isVertexArray(quad.vertexState.handle)).toBe(true);

			const tex = solidCanvas(255, 0, 0);
			rendererC.clearColor("#000000ff");
			rendererC.drawImage(tex, 0, 0, 16, 16, 4, 4, 16, 16);
			rendererC.flush();
			expect(glC.getError()).toBe(glC.NO_ERROR);

			const px = new Uint8Array(4);
			glC.readPixels(
				8,
				glC.drawingBufferHeight - 1 - 8,
				1,
				1,
				glC.RGBA,
				glC.UNSIGNED_BYTE,
				px,
			);
			expect(px[0], "custom batcher renders").toBeGreaterThan(200);
		} finally {
			appC.destroy();
		}
	});

	it("custom batcher with a hand-rolled flush (self-bound upload) still renders", async (ctx) => {
		requireWebGL(ctx);
		// a legacy-style custom flush that re-binds its upload target itself
		// — must keep working because bind() preserves the upload-buffer
		// invariant rather than relying on renderer-side rebinds
		class SelfBindingBatcher extends QuadBatcher {
			flush(mode) {
				this.gl.bindBuffer(
					this.gl.ARRAY_BUFFER,
					this.glVertexBuffer ?? this.renderer.vertexBuffer,
				);
				super.flush(mode);
			}
		}
		const appD = new Application(48, 48, {
			parent: "screen",
			renderer: video.WEBGL,
			failIfMajorPerformanceCaveat: false,
			consoleHeader: false,
			batcher: SelfBindingBatcher,
		});
		await appD.init();
		const rendererD = appD.renderer;
		const glD = rendererD.gl;
		rendererD.projectionMatrix.ortho(0, 48, 48, 0, -1, 1);
		rendererD.setBatcher("primitive");
		rendererD.setBatcher("quad");
		try {
			const tex = solidCanvas(0, 255, 0);
			rendererD.clearColor("#000000ff");
			rendererD.drawImage(tex, 0, 0, 16, 16, 4, 4, 16, 16);
			rendererD.flush();
			expect(glD.getError()).toBe(glD.NO_ERROR);

			const px = new Uint8Array(4);
			glD.readPixels(
				8,
				glD.drawingBufferHeight - 1 - 8,
				1,
				1,
				glD.RGBA,
				glD.UNSIGNED_BYTE,
				px,
			);
			expect(px[1], "self-binding batcher renders").toBeGreaterThan(200);
		} finally {
			appD.destroy();
		}
	});
});
