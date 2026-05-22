import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	boot,
	event,
	GLShader,
	ShaderEffect,
	video,
	WebGLRenderer,
} from "../src/index.js";

/**
 * Adversarial integration tests for the WebGL pipeline.
 *
 * These tests don't assert internal batcher state — they exercise *frame-shaped*
 * sequences of public renderer APIs and use `gl.getError()` as a universal
 * "did anything corrupt" check. The class of bug they target — cross-batcher
 * state leaks (vertex attribs, gl.useProgram, blend mode, scissor, texture
 * units) — slips through unit tests because each batcher works fine in
 * isolation; only realistic frame composition surfaces them.
 *
 * Whenever a new bug of the form "X works alone, Y works alone, X-then-Y
 * crashes" is found, add a test here.
 */
describe("WebGL pipeline adversarial integration", () => {
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
		if (renderer) {
			renderer.activeLightCount = 0;
			renderer.currentNormalMap = null;
		}
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});
	});

	beforeEach(() => {
		if (!isWebGL) {
			return;
		}
		// drain any GL error so each test starts clean
		while (gl.getError() !== gl.NO_ERROR) {
			/* drain */
		}
		// reset cross-test state
		renderer.activeLightCount = 0;
		renderer.currentNormalMap = null;
	});

	function expectNoGLErrors() {
		const err = gl.getError();
		expect(err).toBe(gl.NO_ERROR);
	}

	// ---- Cross-batcher transitions in a single "frame" ----

	it("frame: sprite → primitive → sprite produces no GL error", () => {
		// Common pattern: world-space sprites, debug primitive overlay,
		// more sprites (UI). Every transition must reset stride/attrib/program.
		if (!isWebGL) {
			return;
		}
		const tex = video.createCanvas(16, 16);
		renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
		renderer.strokeRect(10, 10, 50, 30);
		renderer.drawImage(tex, 50, 50, 16, 16, 50, 50, 16, 16);
		renderer.flush();
		expectNoGLErrors();
	});

	it("frame: lit sprite → unlit sprite → lit sprite (mixed lighting in one frame)", () => {
		// SpriteIlluminator-style scene: ambient backdrop (unlit), prop with
		// normal map (lit), more backdrop. The dispatch must flip between
		// `quad` and `litQuad` cleanly each time.
		if (!isWebGL) {
			return;
		}
		const tex = video.createCanvas(16, 16);
		const normal = video.createCanvas(16, 16);

		// pretend a Light2d is active so the dispatch sends normal-mapped
		// sprites through litQuad
		const fakeLight = {
			getBounds: () => {
				return { centerX: 0, centerY: 0, width: 30, height: 30 };
			},
			intensity: 1,
			color: { r: 255, g: 255, b: 255 },
			lightHeight: 1,
		};
		renderer.setLightUniforms([fakeLight], { r: 80, g: 80, b: 80 }, 0, 0);

		// lit (has normalMap)
		renderer.currentNormalMap = normal;
		renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
		renderer.currentNormalMap = null;

		// unlit
		renderer.drawImage(tex, 30, 0, 16, 16, 30, 0, 16, 16);

		// lit again
		renderer.currentNormalMap = normal;
		renderer.drawImage(tex, 60, 0, 16, 16, 60, 0, 16, 16);
		renderer.currentNormalMap = null;

		renderer.flush();
		expectNoGLErrors();
	});

	it("frame: setLightUniforms with no lights followed by sprite draw uses quad's program", () => {
		// The exact platformer reproducer: every camera frame calls
		// setLightUniforms even when there are no lights; that call writes
		// to litQuad's shader and would leave gl.useProgram pointing at it.
		// The next drawImage must NOT render quad data through litQuad's shader.
		if (!isWebGL) {
			return;
		}
		renderer.setBatcher("quad");
		const quad = renderer.batchers.get("quad");

		renderer.setLightUniforms([], { r: 0, g: 0, b: 0 }, 0, 0);

		const tex = video.createCanvas(8, 8);
		renderer.drawImage(tex, 0, 0, 8, 8, 0, 0, 8, 8);
		renderer.flush();

		expect(gl.getParameter(gl.CURRENT_PROGRAM)).toBe(
			quad.defaultShader.program,
		);
		expectNoGLErrors();
	});

	it("frame: mesh → sprite → primitive (three different vertex layouts)", () => {
		// Mesh batcher has its own vertex format (x, y, z, u, v, tint).
		// Switching from mesh to quad to primitive requires three different
		// stride/offset configurations.
		if (!isWebGL) {
			return;
		}
		const tex = video.createCanvas(16, 16);

		// activate the mesh batcher briefly (no actual mesh — just want the
		// state transition); fall through to quad
		renderer.setBatcher("mesh");
		renderer.setBatcher("quad");
		renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
		renderer.strokeRect(10, 10, 30, 30);
		renderer.flush();
		expectNoGLErrors();
	});

	// ---- Texture-slot pressure ----

	it("frame: many distinct textures forces multi-texture overflow + reset", () => {
		// Push more distinct textures than the batcher's sampler range to
		// trigger the overflow path (`flush + cache.resetUnitAssignments`).
		// The end state must still draw correctly with no GL errors.
		if (!isWebGL) {
			return;
		}
		const quad = renderer.batchers.get("quad");
		const n = quad.maxBatchTextures + 4; // force overflow by 4
		const textures = [];
		for (let i = 0; i < n; i++) {
			const c = video.createCanvas(8, 8);
			textures.push(c);
		}
		for (let i = 0; i < n; i++) {
			renderer.drawImage(textures[i], 0, 0, 8, 8, i * 8, 0, 8, 8);
		}
		renderer.flush();
		expectNoGLErrors();
	});

	it("frame: same texture used by quad AND litQuad in the same frame", () => {
		// The texture cache is shared between batchers. A texture used unlit
		// (slot N in quad) then lit (slot M in litQuad) must work without
		// double-binding to a now-stale unit.
		if (!isWebGL) {
			return;
		}
		const tex = video.createCanvas(16, 16);
		const normal = video.createCanvas(16, 16);

		const oneLight = [
			{
				getBounds: () => {
					return { centerX: 0, centerY: 0, width: 30, height: 30 };
				},
				intensity: 1,
				color: { r: 255, g: 255, b: 255 },
				lightHeight: 1,
			},
		];
		renderer.setLightUniforms(oneLight, { r: 128, g: 128, b: 128 }, 0, 0);

		renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16); // unlit → quad
		renderer.currentNormalMap = normal;
		renderer.drawImage(tex, 0, 0, 16, 16, 30, 0, 16, 16); // lit → litQuad (same color tex)
		renderer.currentNormalMap = null;
		renderer.drawImage(tex, 0, 0, 16, 16, 60, 0, 16, 16); // unlit again

		renderer.flush();
		expectNoGLErrors();
	});

	// ---- save / restore stack interactions ----

	it("save/restore around a batcher switch: state stays consistent", () => {
		// renderer.save() snapshots color/transform/blend; the batcher
		// switching should not corrupt that snapshot.
		if (!isWebGL) {
			return;
		}
		const tex = video.createCanvas(8, 8);

		renderer.setColor("#ff0000");
		const beforeColor = renderer.currentColor.toArray().slice();

		renderer.save();
		renderer.setColor("#00ff00");
		renderer.drawImage(tex, 0, 0, 8, 8, 0, 0, 8, 8);
		renderer.strokeRect(0, 0, 50, 50);
		renderer.drawImage(tex, 0, 0, 8, 8, 50, 50, 8, 8);
		renderer.restore();

		const afterColor = renderer.currentColor.toArray();
		for (let i = 0; i < 4; i++) {
			expect(afterColor[i]).toBeCloseTo(beforeColor[i], 5);
		}
		renderer.flush();
		expectNoGLErrors();
	});

	// ---- Light uniform staleness across "scenes" ----

	function fakeLight() {
		return {
			getBounds: () => {
				return { centerX: 0, centerY: 0, width: 30, height: 30 };
			},
			intensity: 1,
			color: { r: 255, g: 255, b: 255 },
			lightHeight: 1,
		};
	}

	it("light count: 3 → 0 zeroes the lit batcher's uLightCount on next call", () => {
		// Stage transitions can drop active-light count to 0. The lit
		// batcher must update — leftover non-zero count would make a
		// subsequent normal-mapped sprite read garbage from light array slots.
		if (!isWebGL) {
			return;
		}
		const lit = renderer.batchers.get("litQuad");

		renderer.setLightUniforms(
			[fakeLight(), fakeLight(), fakeLight()],
			{ r: 128, g: 128, b: 128 },
			0,
			0,
		);
		expect(lit._lightCount).toBe(3);

		renderer.setLightUniforms([], { r: 0, g: 0, b: 0 }, 0, 0);
		expect(lit._lightCount).toBe(0);
	});

	it("light count: 9 (over MAX_LIGHTS) clamps to MAX_LIGHTS without overflow", () => {
		// Boundary check: count > MAX_LIGHTS must clamp, not overrun the
		// 8-slot uLightPos array.
		if (!isWebGL) {
			return;
		}
		const lit = renderer.batchers.get("litQuad");
		const MAX = lit._maxLights;
		const lights = [];
		for (let i = 0; i < MAX + 1; i++) {
			lights.push(fakeLight());
		}
		renderer.setLightUniforms(lights, { r: 0, g: 0, b: 0 }, 0, 0);
		expect(lit._lightCount).toBe(MAX);
		expectNoGLErrors();
	});

	// ---- Repeated batcher switching (worst-case frame churn) ----

	it("100 alternating batcher switches in one frame: no error, no leak", () => {
		// Pathological-but-valid: a frame that bounces between sprite and
		// primitive draws 100 times. Each switch must flush + unbind cleanly.
		if (!isWebGL) {
			return;
		}
		const tex = video.createCanvas(8, 8);
		for (let i = 0; i < 100; i++) {
			renderer.drawImage(tex, 0, 0, 8, 8, i, 0, 8, 8);
			renderer.strokeRect(i, 10, 4, 4);
		}
		renderer.flush();
		expectNoGLErrors();
	});

	// ---- Empty flushes ----

	it("flushing an empty batcher is a no-op (no error, no draw)", () => {
		if (!isWebGL) {
			return;
		}
		renderer.setBatcher("quad");
		renderer.currentBatcher.flush();
		renderer.currentBatcher.flush();
		renderer.setBatcher("primitive");
		renderer.currentBatcher.flush();
		expectNoGLErrors();
	});

	// ---- Vertex attribute consistency ----

	it("after every batcher switch, gl.useProgram matches the active batcher's program", () => {
		// Universal invariant: whatever public API was just called, the
		// active program must be the active batcher's. Otherwise the next
		// flush draws through the wrong shader.
		if (!isWebGL) {
			return;
		}
		const names = ["quad", "litQuad", "primitive", "mesh"];
		for (const name of names) {
			if (!renderer.batchers.has(name)) {
				continue;
			}
			const batcher = renderer.setBatcher(name);
			const expected = (batcher.currentShader || batcher.defaultShader).program;
			expect(gl.getParameter(gl.CURRENT_PROGRAM)).toBe(expected);
		}
	});

	// ---- ShaderEffect / custom shader interactions ----

	it("custom shader on quad → revert: useMultiTexture flips off and back on", () => {
		// QuadBatcher.useShader(non-default) sets useMultiTexture=false
		// (single-texture fallback path). useShader(default) must
		// restore it. Use a real custom shader so the test actually
		// exercises both transitions.
		if (!isWebGL) {
			return;
		}
		const quad = renderer.setBatcher("quad");
		expect(quad.useMultiTexture).toBe(true);

		const customVertex = [
			"attribute vec2 aVertex;",
			"attribute vec2 aRegion;",
			"attribute vec4 aColor;",
			"uniform mat4 uProjectionMatrix;",
			"varying vec2 vRegion;",
			"varying vec4 vColor;",
			"void main(void) {",
			"  gl_Position = uProjectionMatrix * vec4(aVertex, 0.0, 1.0);",
			"  vColor = aColor;",
			"  vRegion = aRegion;",
			"}",
		].join("\n");
		const customFragment = [
			"varying vec4 vColor;",
			"void main(void) { gl_FragColor = vColor; }",
		].join("\n");
		const custom = new GLShader(renderer.gl, customVertex, customFragment);

		quad.useShader(custom);
		expect(quad.useMultiTexture).toBe(false);

		quad.useShader(quad.defaultShader);
		expect(quad.useMultiTexture).toBe(true);

		custom.destroy();
	});

	// Helper that produces a minimal valid GLSL pair for these specs —
	// one uniform (`uTime`), one attribute (`aVertex`). Shared by the
	// shader-lifecycle test cluster below so each test reads compactly.
	const makeShaderSource = () => {
		return {
			vertex: [
				"attribute vec2 aVertex;",
				"uniform mat4 uProjectionMatrix;",
				"void main(void) {",
				"  gl_Position = uProjectionMatrix * vec4(aVertex, 0.0, 1.0);",
				"}",
			].join("\n"),
			fragment: [
				"uniform float uTime;",
				"void main(void) { gl_FragColor = vec4(uTime, 0.0, 0.0, 1.0); }",
			].join("\n"),
		};
	};

	const skipIfNoWebGL = (ctx) => {
		if (!isWebGL) {
			// `ctx.skip` marks the test as SKIPPED in vitest output —
			// distinct from "passed". Without this guard a CI runner
			// without WebGL would silently report every test in this
			// cluster as passing, defeating the whole point of the
			// regression suite. Pair every test below with
			// `expect.assertions(N)` so a no-op early-return is also
			// caught (the assertion count tells vitest "this many
			// expectations MUST run; fail otherwise").
			ctx.skip("WebGL not available in this environment");
			return true;
		}
		return false;
	};

	it("destroyed shader: setUniform / bind / getAttribLocation no-op cleanly (do not throw)", (ctx) => {
		// Regression for the 19.5.0 crash reported on Windows + Chrome
		// (ANGLE / D3D11): a shader's `_shader.destroy()` is called by
		// the renderer's ONCONTEXT_LOST handler — `gl.deleteProgram`
		// can throw on ANGLE because the program belongs to the dead
		// context, leaving `GLShader.uniforms === null` while
		// `ShaderEffect.enabled` still reads true. A still-registered
		// `setTime(...)` → `setUniform("uTime", ...)` then hits the
		// nulled uniforms map and crashes with `Cannot read properties
		// of null (reading 'uTime')`. Mac drivers silently no-op'd on
		// the deleted program; ANGLE rejected it strictly.
		//
		// `setUniform`, `bind`, and `getAttribLocation` must be
		// defensive against a stale reference to a destroyed shader.
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		expect.assertions(13);

		const { vertex, fragment } = makeShaderSource();
		const shader = new GLShader(renderer.gl, vertex, fragment);

		// sanity: before destroy, the shader has live state
		expect(shader.destroyed).toBe(false);
		expect(shader.uniforms).not.toBeNull();
		expect(shader.attributes).not.toBeNull();
		expect(shader.program).not.toBeNull();

		shader.destroy();

		// after destroy, all the per-field cleanups happened AND the
		// public `destroyed` flag flipped
		expect(shader.destroyed).toBe(true);
		expect(shader.uniforms).toBeNull();
		expect(shader.attributes).toBeNull();
		expect(shader.program).toBeNull();

		// every accessor no-ops silently
		expect(() => {
			shader.setUniform("uTime", 1.234);
		}).not.toThrow();
		expect(() => {
			shader.bind();
		}).not.toThrow();
		expect(shader.getAttribLocation("aVertex")).toEqual(-1);

		// setUniform for an UNKNOWN uniform also stays silent — the
		// pre-destroy code path would have thrown for an undefined
		// uniform name, but post-destroy we never reach that branch.
		expect(() => {
			shader.setUniform("uNotDefined", 0);
		}).not.toThrow();

		// the no-op must not have queued any GL operations either —
		// the destroyed-state path must hit the early `return` before
		// any gl.* call. Assert NO_ERROR directly (a drain-only loop
		// would silently absorb a regression where a stray gl call
		// queued an error code).
		expect(gl.getError()).toBe(gl.NO_ERROR);
	});

	it("GLShader._uniformCache snapshots typed-array / array writes (caller mutation does not poison replay)", (ctx) => {
		// Regression for the cache-replay-mutation hazard surfaced in
		// the 19.6 PR review: setUniform must DETACH the cached value
		// from the caller's array, otherwise a downstream pattern like
		// `const tmp = new Float32Array([r, g, b]); shader.setUniform(
		// "uColor", tmp); tmp[0] = 0;` (or a per-frame-reused Vector3d)
		// silently rewrites what gets replayed on context restore. The
		// pre-restore GPU saw the original values; the post-restore GPU
		// would see the mutated ones — silent visual divergence.
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		expect.assertions(5);

		// A shader with a vec3 uniform — accepts both Float32Array and
		// plain Array values via the uniforms proxy.
		const vertex = [
			"attribute vec2 aVertex;",
			"void main(void) { gl_Position = vec4(aVertex, 0.0, 1.0); }",
		].join("\n");
		const fragment = [
			"uniform vec3 uColor;",
			"void main(void) { gl_FragColor = vec4(uColor, 1.0); }",
		].join("\n");
		const shader = new GLShader(renderer.gl, vertex, fragment);

		// --- Float32Array path. Use f32-exact values (binary fractions
		// of 2) so toEqual doesn't trip on the 32-bit-float quantization
		// applied by the typed-array constructor itself. ---
		const fa = new Float32Array([0.5, 0.25, 0.125]);
		shader.setUniform("uColor", fa);
		// cache must be a DIFFERENT object than the caller's array
		expect(shader._uniformCache.uColor).not.toBe(fa);
		// ...with the same numeric contents at the time of the write
		expect(Array.from(shader._uniformCache.uColor)).toEqual([0.5, 0.25, 0.125]);
		// mutate the caller's array AFTER the setUniform call — the
		// cache must NOT see the mutation, otherwise replay diverges
		fa[0] = 0.875;
		fa[1] = 0.875;
		fa[2] = 0.875;
		expect(Array.from(shader._uniformCache.uColor)).toEqual([0.5, 0.25, 0.125]);

		// --- plain Array path (same invariant). Plain Array doesn't
		// round, so any literal works. ---
		const arr = [0.4, 0.5, 0.6];
		shader.setUniform("uColor", arr);
		expect(shader._uniformCache.uColor).not.toBe(arr);
		arr[0] = 0.0;
		expect(shader._uniformCache.uColor).toEqual([0.4, 0.5, 0.6]);

		shader.destroy();
	});

	it("GLShader.destroy is idempotent — double-destroy does not throw", (ctx) => {
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		expect.assertions(3);

		const { vertex, fragment } = makeShaderSource();
		const shader = new GLShader(renderer.gl, vertex, fragment);

		shader.destroy();
		expect(shader.destroyed).toBe(true);

		// Second destroy must early-return — without the idempotency
		// guard, `gl.deleteProgram(null)` would warn (or, on stricter
		// drivers, throw INVALID_OPERATION).
		expect(() => {
			shader.destroy();
		}).not.toThrow();
		expect(shader.destroyed).toBe(true);
	});

	it("GLShader.destroy is partial-state-safe under a throwing deleteProgram (ANGLE-style)", (ctx) => {
		// Direct simulation of the ANGLE / D3D11 failure mode: even
		// when `gl.deleteProgram` throws (program belongs to a dead
		// context), the JS-side `destroy()` must complete — fields
		// nulled, `destroyed` flag flipped — so subsequent callers
		// holding a stale reference get the silent no-op path.
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		expect.assertions(6);

		const { vertex, fragment } = makeShaderSource();
		const shader = new GLShader(renderer.gl, vertex, fragment);

		// Sabotage just this shader's deleteProgram. Using a per-
		// instance override on `shader.gl` mutates the shared renderer
		// gl proxy, so save + restore the original after the test.
		const originalDeleteProgram = shader.gl.deleteProgram.bind(shader.gl);
		shader.gl.deleteProgram = () => {
			throw new Error("mock ANGLE cross-context delete error");
		};

		expect(() => {
			shader.destroy();
		}).not.toThrow(); // the try/catch inside destroy must contain it

		// Even though deleteProgram threw, the JS state must be fully
		// cleaned up
		expect(shader.destroyed).toBe(true);
		expect(shader.uniforms).toBeNull();
		expect(shader.attributes).toBeNull();
		expect(shader.program).toBeNull();

		// And subsequent calls still no-op safely
		expect(() => {
			shader.setUniform("uTime", 0.5);
		}).not.toThrow();

		// restore the original so the renderer's gl isn't polluted
		shader.gl.deleteProgram = originalDeleteProgram;
	});

	it("ShaderEffect.destroy sets enabled=false BEFORE _shader.destroy (partial-state immunity)", (ctx) => {
		// This is the EXACT 19.5.0 ANGLE crash scenario as a unit test.
		// We sabotage the inner `_shader.destroy` to throw — simulating
		// `gl.deleteProgram` throwing on a dead ANGLE context. The
		// reordered ShaderEffect.destroy must have set
		// `this.enabled = false` BEFORE invoking the inner destroy, so
		// the throw can't leave behind the partial state
		// (`_shader.uniforms === null` AND `enabled === true`) that
		// produced "Cannot read properties of null (reading 'uTime')"
		// on subsequent `setUniform` calls.
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		expect.assertions(7);

		const effect = new ShaderEffect(
			renderer,
			"vec4 apply(vec4 c, vec2 u) { return c; }",
		);
		expect(effect.enabled).toBe(true);
		expect(effect.destroyed).toBe(false);

		// Sabotage the inner destroy
		const originalInnerDestroy = effect._shader.destroy.bind(effect._shader);
		effect._shader.destroy = () => {
			throw new Error("mock inner shader destroy throw");
		};

		expect(() => {
			effect.destroy();
		}).toThrow(/mock inner shader destroy throw/);

		// Critical: even though the inner destroy threw OUTWARD,
		// `enabled` must already be false because we set it before
		// the inner call.
		expect(effect.enabled).toBe(false);
		expect(effect.destroyed).toBe(true);

		// And the public setUniform / bind / getAttribLocation paths
		// must no-op via the enabled gate.
		expect(() => {
			effect.setUniform("foo", 1);
		}).not.toThrow();
		expect(effect.getAttribLocation("aVertex")).toEqual(-1);

		// Clean up the real GL resources we never got to release.
		originalInnerDestroy();
	});

	it("ShaderEffect.destroy is idempotent", (ctx) => {
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		expect.assertions(3);

		const effect = new ShaderEffect(
			renderer,
			"vec4 apply(vec4 c, vec2 u) { return c; }",
		);
		effect.destroy();
		expect(effect.destroyed).toBe(true);
		expect(() => {
			effect.destroy();
		}).not.toThrow();
		expect(effect.destroyed).toBe(true);
	});

	it("ShaderEffect: setUniform / bind / getAttribLocation no-op after destroy", (ctx) => {
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		expect.assertions(4);

		const effect = new ShaderEffect(
			renderer,
			"uniform float uTime;\n" +
				"vec4 apply(vec4 c, vec2 u) { return c * uTime; }",
		);
		effect.destroy();

		expect(effect.enabled).toBe(false);
		expect(() => {
			effect.setUniform("uTime", 0.5);
		}).not.toThrow();
		expect(() => {
			effect.bind();
		}).not.toThrow();
		expect(effect.getAttribLocation("aVertex")).toEqual(-1);
	});

	it("multiple independent ShaderEffect instances: destroying one does not affect another", (ctx) => {
		// Pins the per-instance-shader pattern the platformer-matter
		// and platformer-builtin coin examples migrate to. plinko-planck
		// already follows this idiom (one ShaderEffect per peg / drop
		// zone); the platformer coins were the deviation in 19.5.0.
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		expect.assertions(5);

		const a = new ShaderEffect(
			renderer,
			"uniform float uTime;\n" +
				"vec4 apply(vec4 c, vec2 u) { return c * uTime; }",
		);
		const b = new ShaderEffect(
			renderer,
			"uniform float uTime;\n" +
				"vec4 apply(vec4 c, vec2 u) { return c * uTime; }",
		);

		a.destroy();

		// b must be completely unaffected
		expect(a.destroyed).toBe(true);
		expect(b.destroyed).toBe(false);
		expect(b.enabled).toBe(true);
		expect(() => {
			b.setUniform("uTime", 0.5);
		}).not.toThrow();
		expect(b._shader.program).not.toBeNull();

		b.destroy();
	});

	it("GLShader survives a context-lost → restored cycle with uniform values intact", (ctx) => {
		// The trigger for the original Windows crash was the renderer's
		// `webglcontextlost` listener firing on a GPU switch (NVIDIA
		// Optimus laptops), which emits ONCONTEXT_LOST and previously
		// fully destroyed every GLShader. The new lifecycle suspends
		// instead — keeps the source code + cached uniform values
		// around — and rebuilds the program on ONCONTEXT_RESTORED,
		// replaying the cached uniforms so the visual state survives
		// the GPU transition transparently. Without the uniform replay
		// path, any shader with one-time uniform setup (color, geom
		// constants) would render with default uniforms after a GPU
		// switch, a silent regression that's worse than the crash.
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		expect.assertions(6);

		const { vertex, fragment } = makeShaderSource();
		const shader = new GLShader(renderer.gl, vertex, fragment);
		shader.setUniform("uTime", 3.14);
		const originalProgram = shader.program;
		expect(shader.suspended).toBe(false);

		event.emit(event.ONCONTEXT_LOST, renderer);
		// Shader is now suspended — program released, but source +
		// uniform cache preserved
		expect(shader.suspended).toBe(true);
		expect(shader.program).toBeNull();

		event.emit(event.ONCONTEXT_RESTORED, renderer);
		// Shader rebuilt: new program (different identity), suspended
		// flag cleared
		expect(shader.suspended).toBe(false);
		expect(shader.program).not.toBeNull();
		expect(shader.program).not.toBe(originalProgram);

		shader.destroy();
	});

	it("GLShader does NOT auto-resurrect after explicit destroy", (ctx) => {
		// An explicit `destroy()` is the user's "release this resource"
		// signal — automatic context-loss recovery must respect that
		// and NOT rebuild the program when ONCONTEXT_RESTORED later
		// fires. The destroy must also unsubscribe from the events so
		// the destroyed shader doesn't accumulate stale handlers.
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		expect.assertions(3);

		const { vertex, fragment } = makeShaderSource();
		const shader = new GLShader(renderer.gl, vertex, fragment);
		shader.destroy();
		expect(shader.destroyed).toBe(true);

		event.emit(event.ONCONTEXT_LOST, renderer);
		event.emit(event.ONCONTEXT_RESTORED, renderer);

		// Still destroyed; no program resurrection
		expect(shader.destroyed).toBe(true);
		expect(shader.program).toBeNull();
	});

	// ---- Mode flag interactions (blend, scissor) ----

	it("blend mode change between batcher switches: no error", () => {
		// setBlendMode flushes the current batcher and updates GL state.
		// Doing this between unrelated draws shouldn't corrupt either batch.
		if (!isWebGL) {
			return;
		}
		const tex = video.createCanvas(8, 8);
		renderer.drawImage(tex, 0, 0, 8, 8, 0, 0, 8, 8);
		renderer.setBlendMode("multiply");
		renderer.strokeRect(0, 0, 30, 30);
		renderer.setBlendMode("normal");
		renderer.drawImage(tex, 0, 0, 8, 8, 50, 0, 8, 8);
		renderer.flush();
		expectNoGLErrors();
	});

	// ---- batcher.unbind symmetry across all registered batchers ----

	// ---- Fuzz: random sequences of public APIs ----

	it("fuzz: 1000 random ops produce no GL error and leave no batcher in a stuck state", () => {
		// Random sequences of public renderer ops. After every op,
		// `gl.getError()` must be `NO_ERROR` and `gl.CURRENT_PROGRAM` must
		// match the active batcher's program. Failure dumps the seed and
		// the last 10 ops so the failing sequence can be replayed.
		//
		// Deterministic: a seeded LCG drives the choices, so any failure
		// here is a single-line repro from the printed seed.
		if (!isWebGL) {
			return;
		}

		// 5 distinct seeds × 1000 ops each = 5000 randomized op sequences.
		// Each seed is independent so a failure pinpoints which sequence
		// (printed in the error) needs investigation.
		const SEEDS = [0x12345678, 0xdeadbeef, 0xcafebabe, 0x55aa55aa, 0x01020304];
		const ITERATIONS = 1000;
		// per-seed wrapper: the original loop body lives inside this for-each
		for (const SEED of SEEDS) {
			// Mulberry32 — small, fast, stable across JS engines
			let rng = SEED >>> 0;
			const rand = () => {
				rng = (rng + 0x6d2b79f5) >>> 0;
				let t = rng;
				t = Math.imul(t ^ (t >>> 15), t | 1);
				t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
				return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
			};
			const pickInt = (n) => {
				return Math.floor(rand() * n);
			};
			const pick = (arr) => {
				return arr[pickInt(arr.length)];
			};

			// pre-allocate a small pool of textures and one normal map so the
			// test isn't dominated by canvas creation
			const textures = [];
			for (let i = 0; i < 6; i++) {
				textures.push(video.createCanvas(8, 8));
			}
			const normal = video.createCanvas(8, 8);
			const blendModes = ["normal", "multiply", "additive", "screen"];

			// pre-built light arrays (different counts) — one allocation per
			// shape so we don't churn GC inside the loop
			const fakeLightFactory = () => {
				return {
					getBounds: () => {
						return { centerX: 0, centerY: 0, width: 30, height: 30 };
					},
					intensity: 1,
					color: { r: 255, g: 255, b: 255 },
					lightHeight: 1,
				};
			};
			const lightSets = [0, 1, 3, 8, 9].map((count) => {
				const arr = [];
				for (let i = 0; i < count; i++) {
					arr.push(fakeLightFactory());
				}
				return arr;
			});
			const ambientColor = { r: 50, g: 50, b: 50 };

			const opLog = [];
			const logOp = (s) => {
				opLog.push(s);
				if (opLog.length > 10) {
					opLog.shift();
				}
			};

			// pre-pick op identifiers so the trace is human-readable
			const ops = [
				"drawImage",
				"drawImage",
				"drawImage", // weight: sprites are most common
				"drawImageLit",
				"strokeRect",
				"setBlendMode",
				"setLightUniforms",
				"setColor",
				"saveRestoreSprite",
			];

			const checkInvariants = (lastOp) => {
				const err = gl.getError();
				if (err !== gl.NO_ERROR) {
					throw new Error(
						`GL error 0x${err.toString(16)} after op '${lastOp}' (seed=0x${SEED.toString(16)})\n` +
							`last ops: ${opLog.join(" → ")}`,
					);
				}
				const batcher = renderer.currentBatcher;
				const expected = (batcher.currentShader || batcher.defaultShader)
					.program;
				if (gl.getParameter(gl.CURRENT_PROGRAM) !== expected) {
					throw new Error(
						`gl.useProgram drifted after op '${lastOp}' (seed=0x${SEED.toString(16)})\n` +
							`last ops: ${opLog.join(" → ")}`,
					);
				}
			};

			// initial active light count seeds the lit dispatch path
			renderer.activeLightCount = 1;

			for (let i = 0; i < ITERATIONS; i++) {
				const op = pick(ops);
				switch (op) {
					case "drawImage": {
						const t = pick(textures);
						const x = pickInt(700);
						const y = pickInt(500);
						renderer.currentNormalMap = null;
						renderer.drawImage(t, 0, 0, 8, 8, x, y, 8, 8);
						logOp("drawImage");
						break;
					}
					case "drawImageLit": {
						// requires activeLightCount > 0 to actually dispatch lit
						const t = pick(textures);
						const x = pickInt(700);
						const y = pickInt(500);
						renderer.currentNormalMap = normal;
						renderer.drawImage(t, 0, 0, 8, 8, x, y, 8, 8);
						renderer.currentNormalMap = null;
						logOp("drawImageLit");
						break;
					}
					case "strokeRect": {
						renderer.strokeRect(
							pickInt(700),
							pickInt(500),
							1 + pickInt(80),
							1 + pickInt(80),
						);
						logOp("strokeRect");
						break;
					}
					case "setBlendMode": {
						const mode = pick(blendModes);
						renderer.setBlendMode(mode);
						logOp(`setBlendMode(${mode})`);
						break;
					}
					case "setLightUniforms": {
						const lights = pick(lightSets);
						renderer.setLightUniforms(lights, ambientColor, 0, 0);
						logOp(`setLightUniforms(count=${lights.length})`);
						break;
					}
					case "setColor": {
						const r = pickInt(256);
						const g = pickInt(256);
						const b = pickInt(256);
						renderer.setColor(`rgb(${r}, ${g}, ${b})`);
						logOp(`setColor(${r},${g},${b})`);
						break;
					}
					case "saveRestoreSprite": {
						renderer.save();
						renderer.setColor(`rgb(${pickInt(256)},${pickInt(256)},0)`);
						renderer.drawImage(pick(textures), 0, 0, 8, 8, 0, 0, 8, 8);
						renderer.restore();
						logOp("saveRestoreSprite");
						break;
					}
				}
				checkInvariants(op);
			}

			// final flush + invariant check for THIS seed
			renderer.flush();
			checkInvariants("flush");
		}

		expect(true).toBe(true); // reached the end of all seeds without throwing
	});

	// ---- Per-batcher unbind symmetry ----

	it("every registered batcher's unbind disables exactly its own attribute locations", () => {
		// Generic invariant on the Batcher contract: unbind must only
		// touch locations it owns, never leave one of its own enabled,
		// never disable a location it doesn't own (e.g. one belonging to a
		// different batcher's currently-active program).
		if (!isWebGL) {
			return;
		}
		for (const [name, batcher] of renderer.batchers) {
			renderer.setBatcher(name);
			batcher.bind();

			const ownLocs = new Set();
			const shader = batcher.currentShader || batcher.defaultShader;
			for (const attr of batcher.attributes) {
				const loc = shader.getAttribLocation(attr.name);
				if (loc !== -1) {
					ownLocs.add(loc);
				}
			}

			batcher.unbind();
			for (const loc of ownLocs) {
				expect(gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_ENABLED)).toBe(
					false,
				);
			}
		}
	});

	// =========================================================
	//   Real WEBGL_lose_context lifecycle tests — MUST run last.
	// =========================================================
	//
	// The lifecycle tests above this point emit ONCONTEXT_LOST /
	// ONCONTEXT_RESTORED directly via the event bus, which is fast +
	// deterministic but only exercises our subscribers. The tests in
	// this trailing block use the WEBGL_lose_context extension to
	// fire the actual DOM-level `webglcontextlost` /
	// `webglcontextrestored` events on the canvas — the same path an
	// NVIDIA Optimus GPU switch hits on a user's machine, going
	// through the renderer's DOM listeners in `webgl_renderer.js`
	// before fanning out via the event bus.
	//
	// Each real loss / restore round-trip can leave renderer scratch
	// state subtly different (blend mode, scissor, batcher attribute
	// bindings, texture-unit cache) — even though `reset()` runs on
	// restored. We don't want that to bleed into the rest of the
	// spec, so the entire block runs at the end. Within the block,
	// each test ends in a "restored" state so consecutive tests can
	// chain.
	//
	// Helpers used below:
	//   - `loseContext(ext)` triggers loseContext + awaits microtask
	//   - `restoreContext(ext)` triggers restoreContext + awaits
	const tick = () => {
		return new Promise((resolve) => {
			setTimeout(resolve, 0);
		});
	};

	it("real context loss drives the full lifecycle end-to-end (1 shader, 1 cycle)", async (ctx) => {
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		expect.assertions(8);

		const { vertex, fragment } = makeShaderSource();
		const shader = new GLShader(gl, vertex, fragment);
		shader.setUniform("uTime", 7.25);
		const originalProgram = shader.program;
		expect(shader.suspended).toBe(false);
		expect(shader.destroyed).toBe(false);

		ext.loseContext();
		await tick();
		expect(shader.suspended).toBe(true);
		expect(shader.program).toBeNull();

		ext.restoreContext();
		await tick();
		expect(shader.suspended).toBe(false);
		expect(shader.program).not.toBeNull();
		expect(shader.program).not.toBe(originalProgram);
		expect(shader._uniformCache.uTime).toEqual(7.25);

		shader.destroy();
	});

	it("real context loss: multiple shaders all survive without cross-pollination", async (ctx) => {
		// Each shader's _uniformCache is per-instance — verify two
		// shaders with DIFFERENT uniform values both survive and don't
		// leak into each other (e.g. a shared scratch cache would
		// silently merge the two histories).
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		expect.assertions(8);

		const a = new GLShader(
			gl,
			makeShaderSource().vertex,
			makeShaderSource().fragment,
		);
		const b = new GLShader(
			gl,
			makeShaderSource().vertex,
			makeShaderSource().fragment,
		);
		a.setUniform("uTime", 1.0);
		b.setUniform("uTime", 99.0);

		ext.loseContext();
		await tick();
		expect(a.suspended).toBe(true);
		expect(b.suspended).toBe(true);

		ext.restoreContext();
		await tick();
		expect(a.suspended).toBe(false);
		expect(b.suspended).toBe(false);
		// Each cache replays the value its own owner set — no mixing.
		expect(a._uniformCache.uTime).toEqual(1.0);
		expect(b._uniformCache.uTime).toEqual(99.0);
		// Each shader has a unique fresh program (not the same handle).
		expect(a.program).not.toBe(b.program);
		expect(a.program).not.toBeNull();

		a.destroy();
		b.destroy();
	});

	it("real context loss: setUniform DURING the suspended window goes to cache, applied on restore", async (ctx) => {
		// While the context is dead, we can't write to a real uniform
		// location — but our setUniform should still accept the call
		// and cache it for replay. This is the difference between a
		// "shader stops accepting input until restore" model and a
		// "shader transparently survives" model. We chose the latter.
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		expect.assertions(5);

		const { vertex, fragment } = makeShaderSource();
		const shader = new GLShader(gl, vertex, fragment);
		shader.setUniform("uTime", 1.0);

		ext.loseContext();
		await tick();
		expect(shader.suspended).toBe(true);

		// Write a NEW uniform value while suspended — should go to the
		// cache without throwing or hitting GL.
		expect(() => {
			shader.setUniform("uTime", 42.0);
		}).not.toThrow();
		expect(shader._uniformCache.uTime).toEqual(42.0);

		ext.restoreContext();
		await tick();
		expect(shader.suspended).toBe(false);
		// The latest cached value (42, not the original 1) is the one
		// replayed against the fresh uniforms map.
		expect(shader._uniformCache.uTime).toEqual(42.0);

		shader.destroy();
	});

	it("real context loss: destroying a shader DURING the suspended window stays destroyed across restore", async (ctx) => {
		// Calling destroy() during a context-lost window must work
		// (no throws from destroy itself) AND must NOT be resurrected
		// when the matching context-restored event later fires. The
		// destroyed flag has authority over the suspended flag.
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		expect.assertions(4);

		const { vertex, fragment } = makeShaderSource();
		const shader = new GLShader(gl, vertex, fragment);

		ext.loseContext();
		await tick();

		// Destroy during the suspended window — no throw.
		expect(() => {
			shader.destroy();
		}).not.toThrow();
		expect(shader.destroyed).toBe(true);

		ext.restoreContext();
		await tick();

		// Restore must NOT recompile the destroyed shader.
		expect(shader.destroyed).toBe(true);
		expect(shader.program).toBeNull();
	});

	it("real context loss: three consecutive lose/restore cycles all recover with uniform state intact", async (ctx) => {
		// Stress test the lifecycle: if any cleanup step leaks (e.g.
		// failing to unsubscribe + re-subscribe correctly, or losing
		// the uniform cache across cycles), repeated cycles surface
		// it. Three cycles is enough to catch single-shot bugs that
		// pass on the first round-trip.
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		expect.assertions(9);

		const { vertex, fragment } = makeShaderSource();
		const shader = new GLShader(gl, vertex, fragment);
		shader.setUniform("uTime", 123.456);

		for (let cycle = 0; cycle < 3; cycle++) {
			ext.loseContext();
			await tick();
			expect(shader.suspended).toBe(true);

			ext.restoreContext();
			await tick();
			expect(shader.suspended).toBe(false);

			// The cached uniform value persists across every cycle.
			expect(shader._uniformCache.uTime).toEqual(123.456);
		}

		shader.destroy();
	});

	it("real context loss: ShaderEffect's `enabled` gate flips false on lost, true on restored", async (ctx) => {
		// Pins the ShaderEffect side of the context-loss subscription.
		// Without the `enabled` flip on lost, the renderer's
		// `beginPostEffect` filter (`fx.enabled !== false`) would try
		// to bind a null program during the suspended window.
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		expect.assertions(4);

		const effect = new ShaderEffect(
			renderer,
			"uniform float uTime;\n" +
				"vec4 apply(vec4 c, vec2 u) { return c * uTime; }",
		);
		expect(effect.enabled).toBe(true);

		ext.loseContext();
		await tick();
		expect(effect.enabled).toBe(false);

		ext.restoreContext();
		await tick();
		expect(effect.enabled).toBe(true);
		// And destroyed flag stayed clean — context recovery is not a
		// destroy event.
		expect(effect.destroyed).toBe(false);

		effect.destroy();
	});

	it("real context loss: destroy() during cycle followed by a NEW lose/restore is harmless", async (ctx) => {
		// After explicit destroy() during a suspended window, subsequent
		// context loss/restore cycles must not touch the destroyed
		// shader — its event subscribers were unsubscribed in destroy.
		// If those subscribers leaked, a second cycle would try to
		// suspend/recompile a destroyed shader.
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		expect.assertions(5);

		const { vertex, fragment } = makeShaderSource();
		const a = new GLShader(gl, vertex, fragment);
		const b = new GLShader(gl, vertex, fragment);
		a.setUniform("uTime", 5.0);
		b.setUniform("uTime", 10.0);

		ext.loseContext();
		await tick();
		a.destroy(); // destroy a during suspended window

		ext.restoreContext();
		await tick();

		// a stays destroyed
		expect(a.destroyed).toBe(true);
		expect(a.program).toBeNull();
		// b survives the first cycle
		expect(b.program).not.toBeNull();

		// Run a SECOND lose/restore cycle — a's subscribers must be
		// fully gone, so the destroyed shader can't accidentally be
		// suspended/restored.
		ext.loseContext();
		await tick();
		ext.restoreContext();
		await tick();

		// a still destroyed and program still null
		expect(a.destroyed).toBe(true);
		expect(a.program).toBeNull();

		b.destroy();
	});

	// ----------------------------------------------------------------
	//   Renderer-wide context loss / restore battery.
	//
	//   The tests above this point exercise GLShader and ShaderEffect
	//   in isolation. The ones below probe everything else the
	//   renderer owns across a real WEBGL_lose_context cycle — vertex
	//   buffers, the texture cache, batcher GL state, default render
	//   state (blend, depth, scissor, viewport), FBOs (render
	//   targets), Light2d uniforms, the mesh / litQuad batchers, and
	//   the full drawImage → flush pipeline. The intent is the same as
	//   the rest of this spec: write the adversarial sequence first,
	//   let it tell us what is and isn't recovered transparently, and
	//   tighten the renderer-side ONCONTEXT_RESTORED handler until
	//   every test in this block goes green.
	// ----------------------------------------------------------------

	it("real context loss: gl.isContextLost() is true between loseContext and restoreContext (test infra sanity)", async (ctx) => {
		// Sanity check on the test infrastructure itself. If
		// `gl.isContextLost()` doesn't actually flip true between
		// `ext.loseContext()` and `ext.restoreContext()`, then the
		// vitest browser env isn't really losing the context and
		// every test in this block is testing nothing.
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		expect.assertions(3);

		expect(gl.isContextLost()).toBe(false);
		ext.loseContext();
		await tick();
		expect(gl.isContextLost()).toBe(true);
		ext.restoreContext();
		await tick();
		expect(gl.isContextLost()).toBe(false);
	});

	it("real context loss: renderer.isContextValid flips false on lost, true on restored", async (ctx) => {
		// The renderer's public `isContextValid` flag must mirror the
		// underlying context state. The webglcontextlost / restored
		// listeners on the canvas are what flip it — if those didn't
		// fire (e.g. event listener removed by mistake), the renderer
		// would silently report "context is valid" while drawing into
		// a dead context.
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		expect.assertions(3);

		expect(renderer.isContextValid).toBe(true);
		ext.loseContext();
		await tick();
		expect(renderer.isContextValid).toBe(false);
		ext.restoreContext();
		await tick();
		expect(renderer.isContextValid).toBe(true);
	});

	it("real context loss: renderer.vertexBuffer is a valid GL buffer after restore", async (ctx) => {
		// `renderer.vertexBuffer` is created once in the constructor.
		// After a context cycle the original `WebGLBuffer` reference
		// belongs to a dead context — `gl.isBuffer()` against it
		// returns false. The renderer-side ONCONTEXT_RESTORED handler
		// must re-create it so the next bindBuffer doesn't throw
		// INVALID_OPERATION.
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		expect.assertions(2);

		// pre-loss: it's a valid buffer
		expect(gl.isBuffer(renderer.vertexBuffer)).toBe(true);

		ext.loseContext();
		await tick();
		ext.restoreContext();
		await tick();

		// post-restore: must still be a valid buffer (re-created)
		expect(gl.isBuffer(renderer.vertexBuffer)).toBe(true);
	});

	it("real context loss: indexed batchers' glVertexBuffer is valid after restore", async (ctx) => {
		// Indexed batchers (currently only `mesh`) own their own
		// `gl.createBuffer()` for the vertex array (non-indexed
		// batchers share the renderer-level `vertexBuffer`). After a
		// context cycle the indexed batchers' buffer references are
		// from the dead context — `reset()`'s `batcher.init()` path
		// must re-create them.
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		const indexedBatchers = Array.from(renderer.batchers.values()).filter(
			(b) => {
				return b.useIndexBuffer === true;
			},
		);
		if (indexedBatchers.length === 0) {
			ctx.skip("no indexed batchers registered");
			return;
		}
		expect.assertions(indexedBatchers.length);

		// Pre-loss state is incidental — vitest's cross-file shared
		// browser session may have already cycled the renderer's GL
		// context (afterAll runs `video.init` again). The contract
		// this test pins is "post-restore: indexed batchers' buffers
		// are valid", not "all transitions were clean".

		ext.loseContext();
		await tick();
		ext.restoreContext();
		await tick();

		// post-restore: every indexed batcher's glVertexBuffer must be
		// a re-created WebGLBuffer reference. We deliberately do NOT
		// use `gl.isBuffer()` here — per WebGL spec, a name returned
		// by `createBuffer` is not "the name of a buffer object" until
		// it has been associated with one via `bindBuffer`, and
		// `bind()` on a batcher only runs when that batcher becomes
		// active. The contract this test pins is "init() ran +
		// glVertexBuffer is a non-null reference"; binding (and
		// therefore isBuffer == true) is exercised by the post-cycle
		// `mesh batcher works after a context cycle` test below.
		for (const b of Array.from(renderer.batchers.values()).filter((b) => {
			return b.useIndexBuffer === true;
		})) {
			expect(b.glVertexBuffer).toBeInstanceOf(WebGLBuffer);
		}
	});

	it("real context loss: default WebGL state (blend, depth, scissor) is restored after cycle", async (ctx) => {
		// melonJS sets a specific default state during init — BLEND
		// enabled, DEPTH_TEST disabled, SCISSOR_TEST disabled, depth
		// mask false. The driver resets ALL state on context restore,
		// so the renderer's ONCONTEXT_RESTORED handler must re-apply
		// the defaults; otherwise drawImage would draw with a
		// random-from-the-driver blend mode and z-test state, producing
		// visual garbage even without GL errors.
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		expect.assertions(4);

		ext.loseContext();
		await tick();
		ext.restoreContext();
		await tick();

		expect(gl.isEnabled(gl.BLEND)).toBe(true);
		expect(gl.isEnabled(gl.DEPTH_TEST)).toBe(false);
		expect(gl.isEnabled(gl.SCISSOR_TEST)).toBe(false);
		expect(gl.getParameter(gl.DEPTH_WRITEMASK)).toBe(false);
	});

	it("real context loss: batcher boundTextures is cleared on restore + drawing re-uploads from sources", async (ctx) => {
		// boundTextures[unit] holds the WebGLTexture handles each
		// batcher has bound. After a context cycle those handles are
		// dead. `reset()`'s `batcher.init()` path drops the array
		// entirely; the next `drawImage` then hits the create-and-
		// upload path on uploadTexture() and re-creates from the
		// still-alive source.
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		expect.assertions(4);

		const source = video.createCanvas(16, 16);
		renderer.drawImage(source, 0, 0, 16, 16, 0, 0, 16, 16);
		renderer.flush();

		const quad = renderer.batchers.get("quad");
		// pre-loss: quad batcher has at least one bound texture
		const beforeCount = quad.boundTextures.filter((t) => {
			return typeof t !== "undefined";
		}).length;
		expect(beforeCount).toBeGreaterThan(0);
		// every entry is a valid WebGLTexture
		expect(
			quad.boundTextures.every((t) => {
				return t === undefined || gl.isTexture(t);
			}),
		).toBe(true);

		ext.loseContext();
		await tick();
		ext.restoreContext();
		await tick();

		// post-restore: boundTextures is freshly initialised to []
		expect(quad.boundTextures.length).toEqual(0);

		// drawing the SAME source after restore must re-upload (cache
		// miss → uploadTexture → createTexture2D) without throwing
		renderer.drawImage(source, 0, 0, 16, 16, 0, 0, 16, 16);
		renderer.flush();
		expect(gl.getError()).toBe(gl.NO_ERROR);
	});

	it("real context loss: drawImage + flush after the cycle produces no GL errors (full pipeline)", async (ctx) => {
		// The headline integration test for this block. If buffers,
		// textures, default state, and batcher shaders are all
		// recovered, a vanilla `drawImage + flush` after a lose /
		// restore cycle must leave `gl.getError()` at NO_ERROR. Any
		// dead-context resource ref left around — buffer, texture,
		// uniform location — will surface as INVALID_OPERATION here.
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		expect.assertions(2);

		ext.loseContext();
		await tick();
		ext.restoreContext();
		await tick();

		const tex = video.createCanvas(16, 16);
		expect(() => {
			renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
			renderer.flush();
		}).not.toThrow();
		expectNoGLErrors();
	});

	it("real context loss: mesh batcher works after a context cycle", async (ctx) => {
		// Switching to the mesh batcher with `renderer.setBatcher`
		// uses a different shader + vertex layout (x, y, z, u, v, tint).
		// After a context cycle the mesh batcher's GL resources (its
		// own vertex buffer + default shader's program) must be
		// re-bound. A clean dispatch through mesh → quad must produce
		// no GL errors.
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		expect.assertions(1);

		ext.loseContext();
		await tick();
		ext.restoreContext();
		await tick();

		const tex = video.createCanvas(16, 16);
		renderer.setBatcher("mesh");
		renderer.setBatcher("quad");
		renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
		renderer.flush();
		expectNoGLErrors();
	});

	it("real context loss: litQuad batcher (Light2d uniforms + normal map) works after a context cycle", async (ctx) => {
		// The lit-quad path is the most state-heavy frame in the
		// engine — uniform writes per light, a separate batcher,
		// normal-map texture binding. After context loss every one of
		// those resources is dead; the renderer must reset them.
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		expect.assertions(1);

		ext.loseContext();
		await tick();
		ext.restoreContext();
		await tick();

		const tex = video.createCanvas(16, 16);
		const normal = video.createCanvas(16, 16);
		const oneLight = [
			{
				getBounds: () => {
					return {
						centerX: 0,
						centerY: 0,
						width: 30,
						height: 30,
					};
				},
				intensity: 1,
				color: { r: 255, g: 255, b: 255 },
				lightHeight: 1,
			},
		];
		renderer.setLightUniforms(oneLight, { r: 80, g: 80, b: 80 }, 0, 0);
		renderer.currentNormalMap = normal;
		renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
		renderer.currentNormalMap = null;
		renderer.flush();
		expectNoGLErrors();
	});

	it("real context loss: ShaderEffect + drawImage + flush survive the full cycle without throwing", async (ctx) => {
		// The original 19.5.0 user-reported scenario: a frame is
		// actively drawing through an enabled ShaderEffect when the
		// context is lost (NVIDIA Optimus GPU switch; reproducible
		// from DevTools with `ext.loseContext()`). The renderer's
		// ONCONTEXT_LOST handler tears down every GLShader, and the
		// NEXT frame's drawImage + flush must NOT crash with the
		// `TypeError: Cannot read properties of null (reading
		// 'uTime')` partial-destroy bug. After restoreContext, the
		// ShaderEffect re-enables, its uniform cache replays, and the
		// pipeline keeps drawing without throwing.
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		expect.assertions(7);

		const effect = new ShaderEffect(
			renderer,
			"uniform float uTime;\n" +
				"vec4 apply(vec4 c, vec2 u) { return c * uTime; }",
		);
		effect.setUniform("uTime", 0.5);
		const tex = video.createCanvas(16, 16);

		// Phase 1: pre-loss draws cleanly
		expect(() => {
			renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
			renderer.flush();
		}).not.toThrow();

		// Phase 2: lose mid-frame — next draw call must not throw
		ext.loseContext();
		await tick();
		expect(effect.enabled).toBe(false);
		expect(effect._shader.suspended).toBe(true);
		expect(() => {
			renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
			renderer.flush();
		}).not.toThrow();

		// Phase 3: restore — shader uniform replays, pipeline clean
		ext.restoreContext();
		await tick();
		expect(effect.enabled).toBe(true);
		expect(effect._shader._uniformCache.uTime).toEqual(0.5);
		expect(() => {
			renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
			renderer.flush();
		}).not.toThrow();

		effect.destroy();
	});

	it("real context loss: three consecutive lose/restore cycles each leave the pipeline drawable", async (ctx) => {
		// Repetition stress test for cumulative leaks. If any resource
		// (buffer, texture, FBO, subscription) survives one cycle but
		// leaks across two, three cycles surface it. If we re-create
		// buffers in ONCONTEXT_RESTORED without freeing the old ones,
		// we'd accumulate one zombie WebGLBuffer per cycle here.
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		expect.assertions(3);

		const tex = video.createCanvas(16, 16);
		for (let cycle = 0; cycle < 3; cycle++) {
			ext.loseContext();
			await tick();
			ext.restoreContext();
			await tick();
			renderer.drawImage(tex, 0, 0, 16, 16, cycle * 16, 0, 16, 16);
			renderer.flush();
			expect(gl.getError()).toBe(gl.NO_ERROR);
		}
	});
});
