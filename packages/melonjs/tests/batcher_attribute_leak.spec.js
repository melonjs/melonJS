import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, video, WebGLRenderer } from "../src/index.js";

/**
 * Regression guard for a GL state-leak between batchers.
 *
 * Each Batcher owns its own vertex attribute layout. `LitQuadBatcher` has
 * 5 attributes at stride 28 (including `aNormalTextureId` at offset 24);
 * `PrimitiveBatcher` has 3 attributes at stride 20.
 *
 * Vertex attribute enable/disable + stride/offset is *global* GL state, not
 * per-program. If batcher A enables a location and batcher B never disables
 * it, B's draw call still validates A's stale stride against B's smaller
 * vertex buffer, surfacing as
 *   INVALID_OPERATION: glDrawArrays: Vertex buffer is not big enough
 *
 * The fix: Batcher.unbind() disables the locations it enabled; the renderer
 * calls it whenever the active batcher changes.
 */
describe("Batcher attribute leak between switches (WebGL)", () => {
	let renderer;
	let gl;
	let isWebGL;

	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.WEBGL,
			failIfMajorPerformanceCaveat: false,
		});
		renderer = video.renderer;
		isWebGL = renderer instanceof WebGLRenderer;
		if (isWebGL) {
			gl = renderer.gl;
		}
	});

	afterAll(() => {
		// hand the world back to the default renderer for any later test files
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});
	});

	// helper: collect the GL locations enabled for the given batcher's
	// current shader (the locations that batcher.bind/useShader just turned on)
	function batcherEnabledLocations(batcher) {
		const set = new Set();
		const shader = batcher.currentShader || batcher.defaultShader;
		for (const attr of batcher.attributes) {
			const loc = shader.getAttribLocation(attr.name);
			if (loc !== -1) {
				set.add(loc);
			}
		}
		return set;
	}

	it("switching from quad → primitive disables quad-only attribute locations", () => {
		if (!isWebGL) {
			return;
		}

		const quad = renderer.setBatcher("quad");
		// force quad through bind() so all its attributes are enabled
		quad.bind();
		const quadLocs = batcherEnabledLocations(quad);

		const primitive = renderer.setBatcher("primitive");
		const primLocs = batcherEnabledLocations(primitive);

		// any location that was enabled by quad but is NOT used by primitive
		// must be disabled now — otherwise its stale stride/offset leaks
		const leaked = [];
		for (const loc of quadLocs) {
			if (primLocs.has(loc)) {
				continue;
			}
			const enabled = gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_ENABLED);
			if (enabled) {
				leaked.push(loc);
			}
		}

		expect(leaked).toEqual([]);
	});

	it("drawing after quad → primitive switch produces no GL error", () => {
		// End-to-end reproducer of the original report: a frame that draws a
		// sprite (quad path) followed by a primitive (line/rect) used to
		// throw INVALID_OPERATION on the primitive draw because quad's
		// aNormalTextureId stayed enabled at stride 28 while the primitive
		// buffer was only stride-20-sized.
		if (!isWebGL) {
			return;
		}

		// drain any pending GL errors from earlier tests
		while (gl.getError() !== gl.NO_ERROR) {
			/* drain */
		}

		const tex = video.createCanvas(16, 16);

		renderer.save();
		renderer.setBatcher("quad");
		renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
		// flush the quad batch so its draw call actually runs
		renderer.currentBatcher.flush();

		// now draw a primitive — this is where the leak used to fire
		renderer.strokeRect(10, 10, 50, 30);
		renderer.currentBatcher.flush();
		renderer.restore();

		expect(gl.getError()).toBe(gl.NO_ERROR);
	});

	it("Batcher.unbind disables exactly the locations bind/useShader enabled", () => {
		// Symmetry test: bind enables N locations, unbind disables those same
		// N locations and no others.
		if (!isWebGL) {
			return;
		}

		const quad = renderer.setBatcher("quad");
		const enabledByQuad = batcherEnabledLocations(quad);

		// snapshot pre-unbind state
		const enabledBefore = new Set();
		for (const loc of enabledByQuad) {
			if (gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_ENABLED)) {
				enabledBefore.add(loc);
			}
		}
		expect(enabledBefore.size).toBe(enabledByQuad.size);

		quad.unbind();

		for (const loc of enabledByQuad) {
			expect(gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_ENABLED)).toBe(
				false,
			);
		}

		// restore for any subsequent tests
		renderer.setBatcher("quad");
	});

	it("switching from litQuad → primitive disables litQuad-only attribute locations", () => {
		// The dispatch path that originally triggered the platformer crash:
		// a normal-mapped sprite drawn through `litQuad` (5 attributes,
		// stride 28) followed by a primitive draw (`primitive`, 3 attribs,
		// stride 20). The lit batcher's `aNormalTextureId` and `aTextureId`
		// must be disabled before the primitive's vertex buffer is uploaded.
		if (!isWebGL) {
			return;
		}

		const lit = renderer.setBatcher("litQuad");
		lit.bind();
		const litLocs = batcherEnabledLocations(lit);

		const primitive = renderer.setBatcher("primitive");
		const primLocs = batcherEnabledLocations(primitive);

		const leaked = [];
		for (const loc of litLocs) {
			if (primLocs.has(loc)) {
				continue;
			}
			if (gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_ENABLED)) {
				leaked.push(loc);
			}
		}
		expect(leaked).toEqual([]);
	});
});

describe("WebGLRenderer.drawImage lit/unlit dispatch", () => {
	let renderer;
	let isWebGL;

	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.WEBGL,
			failIfMajorPerformanceCaveat: false,
		});
		renderer = video.renderer;
		isWebGL = renderer instanceof WebGLRenderer;
	});

	afterAll(() => {
		// reset state so later tests see a clean renderer
		renderer.activeLightCount = 0;
		renderer.currentNormalMap = null;
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});
	});

	it("unlit sprite (no normalMap, no lights) dispatches to `quad`", () => {
		if (!isWebGL) {
			return;
		}
		renderer.activeLightCount = 0;
		renderer.currentNormalMap = null;
		const tex = video.createCanvas(8, 8);
		renderer.drawImage(tex, 0, 0, 8, 8, 0, 0, 8, 8);
		expect(renderer.currentBatcher).toBe(renderer.batchers.get("quad"));
	});

	it("normal-mapped sprite WITH active lights dispatches to `litQuad`", () => {
		if (!isWebGL) {
			return;
		}
		renderer.activeLightCount = 1;
		const normal = video.createCanvas(8, 8);
		renderer.currentNormalMap = normal;
		const tex = video.createCanvas(8, 8);
		renderer.drawImage(tex, 0, 0, 8, 8, 0, 0, 8, 8);
		expect(renderer.currentBatcher).toBe(renderer.batchers.get("litQuad"));
	});

	it("normal-mapped sprite WITHOUT active lights still uses `quad` (nothing to light)", () => {
		// A sprite with normalMap but no Light2d in the scene has no lit
		// math to run — the unlit batcher renders it identically to a plain
		// sprite, at full texture-unit capacity.
		if (!isWebGL) {
			return;
		}
		renderer.activeLightCount = 0;
		const normal = video.createCanvas(8, 8);
		renderer.currentNormalMap = normal;
		const tex = video.createCanvas(8, 8);
		renderer.drawImage(tex, 0, 0, 8, 8, 0, 0, 8, 8);
		expect(renderer.currentBatcher).toBe(renderer.batchers.get("quad"));
	});

	it("active lights but no normalMap on the sprite still uses `quad` (no normal to sample)", () => {
		if (!isWebGL) {
			return;
		}
		renderer.activeLightCount = 3;
		renderer.currentNormalMap = null;
		const tex = video.createCanvas(8, 8);
		renderer.drawImage(tex, 0, 0, 8, 8, 0, 0, 8, 8);
		expect(renderer.currentBatcher).toBe(renderer.batchers.get("quad"));
	});

	it("`quad` keeps full texture-unit capacity (no halving)", () => {
		// The whole reason for splitting batchers: unlit `quad` is no longer
		// punished for the lit pipeline's paired-sampler layout. Capacity
		// equals `min(maxTextures, 16)`, not `floor(maxTextures / 2)`.
		if (!isWebGL) {
			return;
		}
		const quad = renderer.batchers.get("quad");
		const expected = Math.min(renderer.maxTextures, 16);
		expect(quad.maxBatchTextures).toBe(expected);
	});

	it("`litQuad` halves texture-unit capacity for paired (color, normal) layout", () => {
		if (!isWebGL) {
			return;
		}
		const lit = renderer.batchers.get("litQuad");
		const expected = Math.min(
			Math.max(1, Math.floor(renderer.maxTextures / 2)),
			16,
		);
		expect(lit.maxBatchTextures).toBe(expected);
	});

	it("`setLightUniforms` updates renderer.activeLightCount and forwards to litQuad", () => {
		if (!isWebGL) {
			return;
		}
		const lit = renderer.batchers.get("litQuad");
		// fake two lights with the duck-typed shape `packLights` reads
		const fakeLight = (cx, cy) => {
			return {
				getBounds: () => {
					return { centerX: cx, centerY: cy, width: 30, height: 30 };
				},
				intensity: 1,
				color: { r: 255, g: 255, b: 255 },
				lightHeight: 1.5,
			};
		};
		renderer.setLightUniforms(
			[fakeLight(10, 20), fakeLight(50, 60)],
			{ r: 50, g: 50, b: 50 },
			0,
			0,
		);
		expect(renderer.activeLightCount).toBe(2);
		expect(lit._lightCount).toBe(2);
	});

	it("setLightUniforms tolerates undefined / empty inputs (no throw, count = 0)", () => {
		// Camera2d.draw forwards `stage?._activeLights` — when there's no
		// active stage, both lights and ambient are undefined.
		if (!isWebGL) {
			return;
		}
		expect(() => {
			renderer.setLightUniforms(undefined, undefined, 0, 0);
		}).not.toThrow();
		expect(renderer.activeLightCount).toBe(0);

		expect(() => {
			renderer.setLightUniforms(null, null, 0, 0);
		}).not.toThrow();
		expect(renderer.activeLightCount).toBe(0);

		expect(() => {
			renderer.setLightUniforms([], { r: 0, g: 0, b: 0 }, 0, 0);
		}).not.toThrow();
		expect(renderer.activeLightCount).toBe(0);
	});

	it("setLightUniforms must not leak gl.useProgram out of the active batcher", () => {
		// Real-world reproducer for the bug that broke the platformer:
		// every camera draw calls `renderer.setLightUniforms(...)` even
		// when the scene has no lights. That call writes to litQuad's
		// shader, and `GLShader.setUniform` flips `gl.useProgram` to litQuad's
		// program. If the renderer doesn't restore the active batcher's
		// program before the next draw, quad's 4-attribute vertex data gets
		// fed to litQuad's 5-attribute shader and renders as garbage.
		if (!isWebGL) {
			return;
		}
		const gl = renderer.gl;

		// pin the active batcher to quad (the unlit fast path)
		renderer.setBatcher("quad");
		const quad = renderer.batchers.get("quad");
		const expectedProgram = quad.defaultShader.program;
		expect(gl.getParameter(gl.CURRENT_PROGRAM)).toBe(expectedProgram);

		// simulate Camera2d.draw uploading per-frame light state (no
		// lights — the platformer case)
		renderer.setLightUniforms([], { r: 0, g: 0, b: 0 }, 0, 0);

		// gl.useProgram must still point to quad's program — otherwise the
		// next drawImage will render quad data through litQuad's shader
		expect(gl.getParameter(gl.CURRENT_PROGRAM)).toBe(expectedProgram);

		// belt-and-suspenders: simulate a sprite draw, verify program stays
		const tex = video.createCanvas(8, 8);
		renderer.drawImage(tex, 0, 0, 8, 8, 0, 0, 8, 8);
		expect(renderer.currentBatcher).toBe(quad);
		expect(gl.getParameter(gl.CURRENT_PROGRAM)).toBe(expectedProgram);
	});
});

describe("LitQuadBatcher internal bookkeeping invariants", () => {
	// These tests probe internal state that GL doesn't expose (and that
	// observable invariants like `gl.getError()` won't surface). They guard
	// against silent desync between MaterialBatcher's per-unit bookkeeping
	// (`boundTextures`, `currentTextureUnit`) and the actual GL bind state.
	// A desync doesn't break rendering today (color/normal slot ranges don't
	// overlap) but would silently corrupt any future feature that reads the
	// bookkeeping — e.g. an LRU evict, a debug overlay, or unit re-purposing.
	let renderer;
	let isWebGL;

	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.WEBGL,
			failIfMajorPerformanceCaveat: false,
		});
		renderer = video.renderer;
		isWebGL = renderer instanceof WebGLRenderer;
	});

	afterAll(() => {
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});
	});

	it("cached normal-map rebind updates boundTextures and currentTextureUnit", () => {
		// Original Copilot-reported footgun: the cached branch in
		// `bindNormalMap` was using raw `gl.activeTexture` + `gl.bindTexture`,
		// which set GL state correctly but didn't update MaterialBatcher's
		// `boundTextures[unit]` / `currentTextureUnit`. Switched to
		// `bindTexture2D(cached, unit, false)` so a subsequent color-texture
		// upload at the same unit can correctly skip the rebind (or,
		// conversely, knows the slot is already taken).
		if (!isWebGL) {
			return;
		}
		const lit = renderer.batchers.get("litQuad");
		const normal = video.createCanvas(8, 8);
		const unit = lit.maxBatchTextures; // first paired-normal slot

		// first call: createTexture2D path. Populates boundTextures[unit].
		lit.bindNormalMap(normal, unit);
		const tex = lit.boundTextures[unit];
		expect(tex).toBeDefined();
		expect(lit.normalMapTextures.get(normal)).toBe(tex);

		// simulate the bookkeeping going stale (e.g. another unit took over,
		// the slot was reset, etc.). The cached rebind must restore it.
		lit.boundTextures[unit] = undefined;
		lit.currentTextureUnit = -1;

		// second call: cached path. Must restore boundTextures[unit] and
		// currentTextureUnit, not just GL state.
		lit.bindNormalMap(normal, unit);
		expect(lit.boundTextures[unit]).toBe(tex);
		expect(lit.currentTextureUnit).toBe(unit);
	});

	it("cached rebind to the SAME unit doesn't trigger redundant work", () => {
		// Sanity check: if the bookkeeping already says this unit holds the
		// texture, the cached path should be a true no-op (no flush, no
		// activeTexture, no bindTexture). `bindTexture2D` skips the work
		// when `texture === boundTextures[unit] && unit === currentTextureUnit`.
		if (!isWebGL) {
			return;
		}
		const lit = renderer.batchers.get("litQuad");
		const normal = video.createCanvas(8, 8);
		const unit = lit.maxBatchTextures;

		lit.bindNormalMap(normal, unit);
		const before = {
			tex: lit.boundTextures[unit],
			currentUnit: lit.currentTextureUnit,
		};
		// rebind without disturbing state: no observable change
		lit.bindNormalMap(normal, unit);
		expect(lit.boundTextures[unit]).toBe(before.tex);
		expect(lit.currentTextureUnit).toBe(before.currentUnit);
	});
});
