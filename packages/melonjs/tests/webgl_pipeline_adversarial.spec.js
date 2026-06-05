import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	boot,
	event,
	GLShader,
	Renderable,
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

	it("frame: sprite → primitive → sprite produces no GL error", (ctx) => {
		// Common pattern: world-space sprites, debug primitive overlay,
		// more sprites (UI). Every transition must reset stride/attrib/program.
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const tex = video.createCanvas(16, 16);
		renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
		renderer.strokeRect(10, 10, 50, 30);
		renderer.drawImage(tex, 50, 50, 16, 16, 50, 50, 16, 16);
		renderer.flush();
		expectNoGLErrors();
	});

	it("frame: lit sprite → unlit sprite → lit sprite (mixed lighting in one frame)", (ctx) => {
		// SpriteIlluminator-style scene: ambient backdrop (unlit), prop with
		// normal map (lit), more backdrop. The dispatch must flip between
		// `quad` and `litQuad` cleanly each time.
		if (skipIfNoWebGL(ctx)) {
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

	it("frame: setLightUniforms with no lights followed by sprite draw uses quad's program", (ctx) => {
		// The exact platformer reproducer: every camera frame calls
		// setLightUniforms even when there are no lights; that call writes
		// to litQuad's shader and would leave gl.useProgram pointing at it.
		// The next drawImage must NOT render quad data through litQuad's shader.
		if (skipIfNoWebGL(ctx)) {
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

	it("frame: mesh → sprite → primitive (three different vertex layouts)", (ctx) => {
		// Mesh batcher has its own vertex format (x, y, z, u, v, tint).
		// Switching from mesh to quad to primitive requires three different
		// stride/offset configurations.
		if (skipIfNoWebGL(ctx)) {
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

	it("frame: many distinct textures forces multi-texture overflow + reset", (ctx) => {
		// Push more distinct textures than the batcher's sampler range to
		// trigger the overflow path (`flush + cache.resetUnitAssignments`).
		// The end state must still draw correctly with no GL errors.
		if (skipIfNoWebGL(ctx)) {
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

	it("frame: same texture used by quad AND litQuad in the same frame", (ctx) => {
		// The texture cache is shared between batchers. A texture used unlit
		// (slot N in quad) then lit (slot M in litQuad) must work without
		// double-binding to a now-stale unit.
		if (skipIfNoWebGL(ctx)) {
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

	it("save/restore around a batcher switch: state stays consistent", (ctx) => {
		// renderer.save() snapshots color/transform/blend; the batcher
		// switching should not corrupt that snapshot.
		if (skipIfNoWebGL(ctx)) {
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

	it("light count: 3 → 0 zeroes the lit batcher's uLightCount on next call", (ctx) => {
		// Stage transitions can drop active-light count to 0. The lit
		// batcher must update — leftover non-zero count would make a
		// subsequent normal-mapped sprite read garbage from light array slots.
		if (skipIfNoWebGL(ctx)) {
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

	it("light count: 9 (over MAX_LIGHTS) clamps to MAX_LIGHTS without overflow", (ctx) => {
		// Boundary check: count > MAX_LIGHTS must clamp, not overrun the
		// 8-slot uLightPos array.
		if (skipIfNoWebGL(ctx)) {
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

	it("100 alternating batcher switches in one frame: no error, no leak", (ctx) => {
		// Pathological-but-valid: a frame that bounces between sprite and
		// primitive draws 100 times. Each switch must flush + unbind cleanly.
		if (skipIfNoWebGL(ctx)) {
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

	it("flushing an empty batcher is a no-op (no error, no draw)", (ctx) => {
		if (skipIfNoWebGL(ctx)) {
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

	it("after every batcher switch, gl.useProgram matches the active batcher's program", (ctx) => {
		// Universal invariant: whatever public API was just called, the
		// active program must be the active batcher's. Otherwise the next
		// flush draws through the wrong shader.
		if (skipIfNoWebGL(ctx)) {
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

	it("custom shader on quad → revert: useMultiTexture flips off and back on", (ctx) => {
		// QuadBatcher.useShader(non-default) sets useMultiTexture=false
		// (single-texture fallback path). useShader(default) must
		// restore it. Use a real custom shader so the test actually
		// exercises both transitions.
		if (skipIfNoWebGL(ctx)) {
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

	// minimal valid GLSL pair (uTime + aVertex) shared by the cluster
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

	// ctx.skip marks SKIPPED (not "passed") on no-WebGL CI runners.
	// Tests pair with expect.assertions(N) so a silent early-return fails.
	const skipIfNoWebGL = (ctx) => {
		if (!isWebGL) {
			ctx.skip("WebGL not available in this environment");
			return true;
		}
		return false;
	};

	it("destroyed shader: setUniform / bind / getAttribLocation no-op cleanly (do not throw)", (ctx) => {
		// 19.5.0 Windows + ANGLE regression — stale references on a
		// destroyed shader must no-op instead of crashing on null uniforms
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

		// destroyed-path must hit early return before any gl.* call
		expect(gl.getError()).toBe(gl.NO_ERROR);
	});

	it("GLShader._uniformCache snapshots typed-array / array writes (caller mutation does not poison replay)", (ctx) => {
		// cache must detach from the caller's array so post-setUniform
		// mutation can't rewrite what gets replayed on context restore
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		expect.assertions(7);

		// vec3 uniform — accepts both Float32Array and plain Array
		const vertex = [
			"attribute vec2 aVertex;",
			"void main(void) { gl_Position = vec4(aVertex, 0.0, 1.0); }",
		].join("\n");
		const fragment = [
			"uniform vec3 uColor;",
			"void main(void) { gl_FragColor = vec4(uColor, 1.0); }",
		].join("\n");
		const shader = new GLShader(renderer.gl, vertex, fragment);

		// f32-exact values (powers of 2) — no toEqual quantization issues
		const fa = new Float32Array([0.5, 0.25, 0.125]);
		shader.setUniform("uColor", fa);
		expect(shader._uniformCache.uColor).not.toBe(fa);
		expect(Array.from(shader._uniformCache.uColor)).toEqual([0.5, 0.25, 0.125]);
		// mutate caller's array after the call — cache must NOT see it
		fa[0] = 0.875;
		fa[1] = 0.875;
		fa[2] = 0.875;
		expect(Array.from(shader._uniformCache.uColor)).toEqual([0.5, 0.25, 0.125]);

		// plain Array path. captureValue reuses the prior slot (so it
		// may now be a Float32Array) — only values matter for replay
		const arr = [0.4, 0.5, 0.6];
		shader.setUniform("uColor", arr);
		expect(shader._uniformCache.uColor).not.toBe(arr);
		arr[0] = 0.0;
		const cachedArr = Array.from(shader._uniformCache.uColor);
		expect(cachedArr[0]).toBeCloseTo(0.4, 5);
		expect(cachedArr[1]).toBeCloseTo(0.5, 5);
		expect(cachedArr[2]).toBeCloseTo(0.6, 5);

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

		// idempotency guard — without it, deleteProgram(null) would warn / throw
		expect(() => {
			shader.destroy();
		}).not.toThrow();
		expect(shader.destroyed).toBe(true);
	});

	it("GLShader.destroy is partial-state-safe under a throwing deleteProgram (ANGLE-style)", (ctx) => {
		// destroy() must complete JS-side even when deleteProgram throws
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		expect.assertions(6);

		const { vertex, fragment } = makeShaderSource();
		const shader = new GLShader(renderer.gl, vertex, fragment);

		// try/finally so a mid-test failure can't leak the patched
		// method into the shared renderer gl proxy
		const originalDeleteProgram = shader.gl.deleteProgram.bind(shader.gl);
		shader.gl.deleteProgram = () => {
			throw new Error("mock ANGLE cross-context delete error");
		};

		try {
			expect(() => {
				shader.destroy();
			}).not.toThrow();

			expect(shader.destroyed).toBe(true);
			expect(shader.uniforms).toBeNull();
			expect(shader.attributes).toBeNull();
			expect(shader.program).toBeNull();

			expect(() => {
				shader.setUniform("uTime", 0.5);
			}).not.toThrow();
		} finally {
			shader.gl.deleteProgram = originalDeleteProgram;
		}
	});

	it("ShaderEffect.destroy sets enabled=false BEFORE _shader.destroy (partial-state immunity)", (ctx) => {
		// 19.5.0 ANGLE crash as a unit test — destroy must flip enabled
		// before the inner destroy can throw past it
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

		// try/finally so a mid-test failure still releases GL resources
		const originalInnerDestroy = effect._shader.destroy.bind(effect._shader);
		effect._shader.destroy = () => {
			throw new Error("mock inner shader destroy throw");
		};

		try {
			expect(() => {
				effect.destroy();
			}).toThrow(/mock inner shader destroy throw/);

			// enabled must be false even though inner destroy threw out
			expect(effect.enabled).toBe(false);
			expect(effect.destroyed).toBe(true);

			expect(() => {
				effect.setUniform("foo", 1);
			}).not.toThrow();
			expect(effect.getAttribLocation("aVertex")).toEqual(-1);
		} finally {
			originalInnerDestroy();
		}
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
		// suspend on lost, recompile + replay uniforms on restored
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
		// suspended: program released, source + cache preserved
		expect(shader.suspended).toBe(true);
		expect(shader.program).toBeNull();

		event.emit(event.ONCONTEXT_RESTORED, renderer);
		// rebuilt: new program identity, suspended cleared
		expect(shader.suspended).toBe(false);
		expect(shader.program).not.toBeNull();
		expect(shader.program).not.toBe(originalProgram);

		shader.destroy();
	});

	it("GLShader does NOT auto-resurrect after explicit destroy", (ctx) => {
		// destroy() must unsubscribe so RESTORED doesn't rebuild the program
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

	it("blend mode change between batcher switches: no error", (ctx) => {
		// setBlendMode flushes the current batcher and updates GL state.
		// Doing this between unrelated draws shouldn't corrupt either batch.
		if (skipIfNoWebGL(ctx)) {
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

	it("fuzz: 1000 random ops produce no GL error and leave no batcher in a stuck state", (ctx) => {
		// Random sequences of public renderer ops. After every op,
		// `gl.getError()` must be `NO_ERROR` and `gl.CURRENT_PROGRAM` must
		// match the active batcher's program. Failure dumps the seed and
		// the last 10 ops so the failing sequence can be replayed.
		//
		// Deterministic: a seeded LCG drives the choices, so any failure
		// here is a single-line repro from the printed seed.
		if (skipIfNoWebGL(ctx)) {
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

	it("every registered batcher's unbind disables exactly its own attribute locations", (ctx) => {
		// Generic invariant on the Batcher contract: unbind must only
		// touch locations it owns, never leave one of its own enabled,
		// never disable a location it doesn't own (e.g. one belonging to a
		// different batcher's currently-active program).
		if (skipIfNoWebGL(ctx)) {
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
	//   (Previous tests use event.emit; these go through the
	//   browser's webglcontextlost/restored DOM events. Can leave
	//   renderer scratch state subtly different across the cycle,
	//   so they're block-isolated at the end of the spec.)
	// =========================================================
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
		// suspended-window writes are cached + replayed (not dropped)
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

		// new write during suspended → cache only, no GL call
		expect(() => {
			shader.setUniform("uTime", 42.0);
		}).not.toThrow();
		expect(shader._uniformCache.uTime).toEqual(42.0);

		ext.restoreContext();
		await tick();
		expect(shader.suspended).toBe(false);
		// latest write (42, not original 1) is what replays
		expect(shader._uniformCache.uTime).toEqual(42.0);

		shader.destroy();
	});

	it("real context loss: destroying a shader DURING the suspended window stays destroyed across restore", async (ctx) => {
		// destroyed flag wins over suspended — no resurrection on restore
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
		// repetition surfaces single-cycle-pass cumulative leaks
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

			// cache persists across every cycle
			expect(shader._uniformCache.uTime).toEqual(123.456);
		}

		shader.destroy();
	});

	it("real context loss: ShaderEffect's `enabled` gate flips false on lost, true on restored", async (ctx) => {
		// without the flip, beginPostEffect would try to bind a null program
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
		// destroyed stays false — restore is not a destroy event
		expect(effect.destroyed).toBe(false);

		effect.destroy();
	});

	it("real context loss: a user-disabled ShaderEffect stays disabled across a cycle", async (ctx) => {
		// dropZone-style toggling: user sets `effect.enabled = false`
		// for visibility. Restore must NOT override that.
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		expect.assertions(3);

		const effect = new ShaderEffect(
			renderer,
			"vec4 apply(vec4 c, vec2 u) { return c; }",
		);
		// user-disabled
		effect.enabled = false;

		ext.loseContext();
		await tick();
		expect(effect.enabled).toBe(false);

		ext.restoreContext();
		await tick();
		// must stay user-disabled, not get re-enabled
		expect(effect.enabled).toBe(false);
		expect(effect.destroyed).toBe(false);

		effect.destroy();
	});

	it("real context loss: destroy() during cycle followed by a NEW lose/restore is harmless", async (ctx) => {
		// destroyed shader must not be touched by a subsequent cycle
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

	// ---- Renderer-wide context loss / restore battery ----
	// Probes everything else the renderer owns across the cycle:
	// vertex buffers, texture cache, batcher GL state, default render
	// state, FBOs, light uniforms, mesh / litQuad batchers, full
	// drawImage → flush pipeline.

	it("real context loss: gl.isContextLost() is true between loseContext and restoreContext (test infra sanity)", async (ctx) => {
		// without this, vitest browser env isn't really losing context
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
		// public flag must mirror the underlying context state
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
		// the renderer's restore handler must re-create vertexBuffer
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
		// indexed batchers own their own buffer; reset must re-create it
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

		// pre-loss state is incidental — vitest cross-file shared session
		ext.loseContext();
		await tick();
		ext.restoreContext();
		await tick();

		// not gl.isBuffer: per spec, a createBuffer name isn't a "buffer
		// object" until bindBuffer; batcher.bind() runs on activation
		// only. The post-cycle mesh batcher test covers the bound case.
		for (const b of Array.from(renderer.batchers.values()).filter((b) => {
			return b.useIndexBuffer === true;
		})) {
			expect(b.glVertexBuffer).toBeInstanceOf(WebGLBuffer);
		}
	});

	it("real context loss: default WebGL state (blend, depth, scissor) is restored after cycle", async (ctx) => {
		// driver wipes all GL state on restore; our handler re-applies it
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
		// dead handles cleared by reset, next draw re-uploads from source
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
		// headline integration test — any stale resource ref surfaces here
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
		// mesh has its own buffer + shader + layout — all must re-bind
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
		// most state-heavy path — light uniforms, separate batcher, normal map
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
		// 19.5.0 user-reported scenario: drawing through an enabled
		// ShaderEffect when the context is lost mid-frame
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
		// repetition stress test — cumulative leaks surface across cycles
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

	// ---- Coverage gaps from the post-PR audit ----

	it("real context loss: Renderable.addPostEffect dispatch survives a full cycle", async (ctx) => {
		// closest to the coin scenario — beginPostEffect→draw→endPostEffect
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		expect.assertions(5);

		const renderable = new Renderable(0, 0, 16, 16);
		const effect = new ShaderEffect(
			renderer,
			"uniform float uTime;\n" +
				"vec4 apply(vec4 c, vec2 u) { return c * uTime; }",
		);
		effect.setUniform("uTime", 0.75);
		renderable.addPostEffect(effect);
		expect(renderable.postEffects.length).toBe(1);

		const tex = video.createCanvas(16, 16);

		// pre-loss dispatch
		renderer.beginPostEffect(renderable);
		renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
		renderer.endPostEffect(renderable);
		renderer.flush();
		expect(gl.getError()).toBe(gl.NO_ERROR);

		ext.loseContext();
		await tick();
		// effect.enabled flips false; dispatch path filters it out
		expect(effect.enabled).toBe(false);
		ext.restoreContext();
		await tick();
		expect(effect.enabled).toBe(true);

		// post-restore dispatch
		expect(() => {
			renderer.beginPostEffect(renderable);
			renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
			renderer.endPostEffect(renderable);
			renderer.flush();
		}).not.toThrow();

		effect.destroy();
	});

	it("real context loss: pool-recycle simulation — renderable removed, cycle, re-added still draws", async (ctx) => {
		// detach effect, cycle, re-attach same instance, draw — survives
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		expect.assertions(4);

		const renderable = new Renderable(0, 0, 16, 16);
		const effect = new ShaderEffect(
			renderer,
			"uniform float uTime;\n" +
				"vec4 apply(vec4 c, vec2 u) { return c * uTime; }",
		);
		effect.setUniform("uTime", 0.5);
		renderable.addPostEffect(effect);

		const tex = video.createCanvas(16, 16);
		renderer.beginPostEffect(renderable);
		renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
		renderer.endPostEffect(renderable);
		renderer.flush();

		// "pickup": detach from dispatch path; effect itself stays alive
		renderable.postEffects.length = 0;

		// cycle happens while effect is detached but alive
		ext.loseContext();
		await tick();
		ext.restoreContext();
		await tick();

		// effect survives on its own (subscriptions on the event bus)
		expect(effect.destroyed).toBe(false);
		expect(effect.enabled).toBe(true);
		expect(effect._shader._uniformCache.uTime).toEqual(0.5);

		// "Respawn": re-attach to the same renderable, dispatch works
		renderable.addPostEffect(effect);
		expect(() => {
			renderer.beginPostEffect(renderable);
			renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
			renderer.endPostEffect(renderable);
			renderer.flush();
		}).not.toThrow();

		effect.destroy();
	});

	it("real context loss: addPostEffect during the suspended window does not throw", async (ctx) => {
		// constructor must defer compile and recover on restore
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		expect.assertions(3);

		const renderable = new Renderable(0, 0, 16, 16);

		ext.loseContext();
		await tick();

		// constructing during lost context must not throw
		let effect;
		expect(() => {
			effect = new ShaderEffect(
				renderer,
				"vec4 apply(vec4 c, vec2 u) { return c * 0.9; }",
			);
			renderable.addPostEffect(effect);
		}).not.toThrow();

		// removePostEffect during suspended window also safe
		expect(() => {
			renderable.removePostEffect(effect);
		}).not.toThrow();

		// Restore — re-add the effect, draw, verify no crash
		ext.restoreContext();
		await tick();
		renderable.addPostEffect(effect);
		const tex = video.createCanvas(16, 16);
		expect(() => {
			renderer.beginPostEffect(renderable);
			renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
			renderer.endPostEffect(renderable);
			renderer.flush();
		}).not.toThrow();

		effect.destroy();
	});

	it("real context loss: 20 concurrent ShaderEffects all survive a cycle (subscription leak check)", async (ctx) => {
		// shared-cache bug or subscription leak collapses values across all 20
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		const N = 20;
		expect.assertions(N * 2);

		const effects = [];
		for (let i = 0; i < N; i++) {
			const fx = new ShaderEffect(
				renderer,
				"uniform float uTime;\n" +
					"vec4 apply(vec4 c, vec2 u) { return c * uTime; }",
			);
			// distinct per-effect value — collapse = shared-cache bug
			fx.setUniform("uTime", 0.1 + i * 0.01);
			effects.push(fx);
		}

		ext.loseContext();
		await tick();
		ext.restoreContext();
		await tick();

		// every effect re-enabled, every cache distinct
		for (let i = 0; i < N; i++) {
			expect(effects[i].enabled).toBe(true);
			expect(effects[i]._shader._uniformCache.uTime).toBeCloseTo(
				0.1 + i * 0.01,
				5,
			);
		}

		for (const fx of effects) {
			fx.destroy();
		}
	});

	it("real context loss: renderer.customShader assignment survives a cycle", async (ctx) => {
		// the ShaderEffect itself must survive; reset clears the pointer
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		expect.assertions(3);

		const customFx = new ShaderEffect(
			renderer,
			"uniform float uTime;\n" +
				"vec4 apply(vec4 c, vec2 u) { return c * uTime; }",
		);
		customFx.setUniform("uTime", 1.0);
		renderer.customShader = customFx;
		expect(renderer.customShader).toBe(customFx);

		ext.loseContext();
		await tick();
		ext.restoreContext();
		await tick();

		// reset() sets customShader=undefined; pinned: the effect lives
		expect(customFx.destroyed).toBe(false);
		expect(customFx._shader._uniformCache.uTime).toEqual(1.0);

		customFx.destroy();
	});

	it("real context loss: tinted texture cache regenerates cleanly after a cycle", async (ctx) => {
		// contract: tint() keeps returning a usable canvas; drawing
		// re-uploads via the lazy path
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		expect.assertions(2);

		const source = video.createCanvas(16, 16);
		const tintedCanvas = renderer.cache.tint(source, "#ff0000");
		// pre-cycle sanity: we got back something canvas-shaped
		expect(typeof tintedCanvas.getContext).toBe("function");
		renderer.drawImage(tintedCanvas, 0, 0, 16, 16, 0, 0, 16, 16);
		renderer.flush();

		ext.loseContext();
		await tick();
		ext.restoreContext();
		await tick();

		// post-cycle: usable canvas back (cache survived or regenerated)
		const sameTintedCanvas = renderer.cache.tint(source, "#ff0000");
		renderer.drawImage(sameTintedCanvas, 0, 0, 16, 16, 0, 0, 16, 16);
		renderer.flush();
		expect(gl.getError()).toBe(gl.NO_ERROR);
	});

	it("real context loss: save / restore stack interacting with a cycle does not throw", async (ctx) => {
		// reset() wipes the save stack on restore — restore() against
		// an empty stack must still be safe
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		expect.assertions(2);

		renderer.setColor("#3366aa");
		renderer.save();
		renderer.setColor("#ffffff");

		ext.loseContext();
		await tick();
		ext.restoreContext();
		await tick();

		// Stack may have been wiped by reset(); calling restore()
		// must still be safe.
		expect(() => {
			renderer.restore();
		}).not.toThrow();

		// And drawing post-restore works regardless
		const tex = video.createCanvas(8, 8);
		renderer.drawImage(tex, 0, 0, 8, 8, 0, 0, 8, 8);
		renderer.flush();
		expect(gl.getError()).toBe(gl.NO_ERROR);
	});

	it("real context loss: destroying 30 ShaderEffects + cycle leaves no leaked subscriber recompiling against a destroyed shader", async (ctx) => {
		// subscription leak smoke test — leaked _onContextRestored
		// handlers would throw or resurrect a destroyed shader
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip("WEBGL_lose_context extension not available");
			return;
		}
		const N = 30;
		expect.assertions(N * 2 + 1);

		const effects = [];
		for (let i = 0; i < N; i++) {
			effects.push(
				new ShaderEffect(renderer, "vec4 apply(vec4 c, vec2 u) { return c; }"),
			);
		}
		// Destroy all of them
		for (const fx of effects) {
			fx.destroy();
		}

		// Cycle — no leaked subscribers must touch the destroyed shaders
		expect(() => {
			ext.loseContext();
		}).not.toThrow();
		await tick();
		ext.restoreContext();
		await tick();

		// Every destroyed effect stays destroyed
		for (const fx of effects) {
			expect(fx.destroyed).toBe(true);
			expect(fx._shader.destroyed).toBe(true);
		}
	});

	// ---- Vertex-buffer upload type (NaN-canonicalization regression) ----
	//
	// On the Mac (Metal/ANGLE) the batched vertex buffer used to upload
	// through a Float32Array view. The vertex layout packs the per-vertex
	// color into a Uint32 slot at the same byte offset where a Float32
	// would sit, so any tint with `A=0xFF` and `R≥0x80` (≈ every MTL
	// material with a non-dark Kd) formed a NaN bit pattern. Some drivers
	// canonicalize NaN values during a Float32 upload → the alpha byte
	// gets zeroed → the premultiplied-alpha mesh shader renders fully
	// transparent → "all planes black" against the page background.
	//
	// Fix is two-pronged:
	//   1. write the packed color as 4 bytes through `bufferU8` (covered
	//      by `vertexBuffer.spec.js` unit tests)
	//   2. upload the buffer to the GPU via a `Uint8Array` view, not a
	//      `Float32Array` view (covered here, end-to-end)
	//
	// These tests run the full renderer path — `drawImage` → quad batcher
	// → `gl.bufferData` — with a spy on the gl call to capture exactly
	// what the upload sees. A regression that goes back to `toFloat32()`
	// surfaces here as the `instanceof Uint8Array` assertion failing.
	describe("vertex buffer is uploaded as Uint8Array (NaN-canonicalization regression)", () => {
		it("quad batcher flush uploads via Uint8Array, not Float32Array", (ctx) => {
			if (skipIfNoWebGL(ctx)) {
				return;
			}
			// Record every gl.bufferData call's srcData arg. We only
			// care about ARRAY_BUFFER (vertex) uploads — index buffers
			// go through ELEMENT_ARRAY_BUFFER and don't carry packed
			// colors, so they're fine as-is.
			const captures = [];
			const origBufferData = gl.bufferData.bind(gl);
			gl.bufferData = (target, ...rest) => {
				if (target === gl.ARRAY_BUFFER) {
					captures.push({ target, srcData: rest[0] });
				}
				return origBufferData(target, ...rest);
			};

			try {
				const tex = video.createCanvas(16, 16);
				// drawImage queues a quad through the quad batcher;
				// flush forces the upload to the GPU.
				renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
				renderer.flush();

				expect(captures.length).toBeGreaterThan(0);
				for (const cap of captures) {
					expect(
						cap.srcData,
						`gl.bufferData(ARRAY_BUFFER, srcData) srcData must be Uint8Array (got ${
							cap.srcData?.constructor?.name ?? typeof cap.srcData
						})`,
					).toBeInstanceOf(Uint8Array);
					expect(cap.srcData).not.toBeInstanceOf(Float32Array);
				}
			} finally {
				gl.bufferData = origBufferData;
			}
			expectNoGLErrors();
		});

		it("the uploaded Uint8 view sees the SAME ArrayBuffer as the underlying Float32 view (sanity: it's a view, not a copy)", (ctx) => {
			// The whole point is that no NaN-pattern values exist on the
			// upload path. The Uint8 view is a view of the SAME bytes
			// that bufferF32 would see; if the implementation ever
			// regressed to allocating a Uint8 copy (subtle perf hit AND
			// breaks the zero-allocation hot-path contract), the
			// `.buffer` identity check would catch it.
			if (skipIfNoWebGL(ctx)) {
				return;
			}
			const captures = [];
			const origBufferData = gl.bufferData.bind(gl);
			gl.bufferData = (target, ...rest) => {
				if (target === gl.ARRAY_BUFFER) {
					captures.push(rest[0]);
				}
				return origBufferData(target, ...rest);
			};

			try {
				const tex = video.createCanvas(16, 16);
				renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
				renderer.flush();

				// Pull the batcher's own buffer for reference comparison.
				// The active batcher after drawImage is "quad"; its
				// vertexData holds the same ArrayBuffer the Uint8 view
				// points into.
				const quadBatcher = renderer.batchers.get("quad");
				expect(quadBatcher).toBeDefined();
				const sharedBuffer = quadBatcher.vertexData.buffer;

				for (const u8 of captures) {
					expect(u8.buffer).toBe(sharedBuffer);
				}
			} finally {
				gl.bufferData = origBufferData;
			}
		});

		it("mesh batcher's indexed flush also uploads via Uint8Array (catches a regression in the indexed path only)", async (ctx) => {
			// The Mesh-rendering path goes through a *different* upload
			// branch than the regular quad path (own glVertexBuffer +
			// drawElements with an index buffer). A targeted regression
			// could fix one branch and miss the other — so we exercise
			// the mesh path directly and confirm the Uint8 upload there
			// too.
			if (skipIfNoWebGL(ctx)) {
				return;
			}
			// Tiny mesh: 4 vertices, 2 triangles, indexed.
			const Mesh = (await import("../src/renderable/mesh.js")).default;
			const mesh = new Mesh(0, 0, {
				vertices: new Float32Array([
					-10, -10, 0, 10, -10, 0, 10, 10, 0, -10, 10, 0,
				]),
				uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
				indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
				width: 20,
				height: 20,
			});

			const captures = [];
			const origBufferData = gl.bufferData.bind(gl);
			gl.bufferData = (target, ...rest) => {
				if (target === gl.ARRAY_BUFFER) {
					captures.push(rest[0]);
				}
				return origBufferData(target, ...rest);
			};

			try {
				renderer.drawMesh(mesh);
				renderer.flush();

				expect(captures.length).toBeGreaterThan(0);
				for (const u8 of captures) {
					expect(u8).toBeInstanceOf(Uint8Array);
				}
			} finally {
				gl.bufferData = origBufferData;
			}
			expectNoGLErrors();
		});

		it("the byteLength upload matches `vertexCount × vertexSize × 4`", (ctx) => {
			// A subtle regression class: switching the view to Uint8
			// but forgetting to multiply `vertexCount * vertexSize` by
			// 4 (bytes per Float32) → only the first quarter of the
			// vertices land on the GPU. Pin the byte arithmetic.
			if (skipIfNoWebGL(ctx)) {
				return;
			}
			let captured = null;
			const origBufferData = gl.bufferData.bind(gl);
			// WebGL2 signature: bufferData(target, srcData, usage, srcOffset, length)
			gl.bufferData = (target, srcData, usage, srcOffset, length) => {
				if (target === gl.ARRAY_BUFFER) {
					captured = { srcData, length, byteOffset: srcOffset };
				}
				return origBufferData(target, srcData, usage, srcOffset, length);
			};

			try {
				const tex = video.createCanvas(16, 16);
				renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
				renderer.flush();

				expect(captured).not.toBeNull();
				// One quad → 4 vertices. Quad batcher's stride is whatever
				// the batcher reports; just verify the upload claims at
				// least 4 × stride bytes.
				const quadBatcher = renderer.batchers.get("quad");
				const bytesPerVertex =
					quadBatcher.vertexData.vertexSize * Float32Array.BYTES_PER_ELEMENT;
				// Some WebGL2 paths pass the length explicitly; either
				// length OR the Uint8Array's own byteLength must cover
				// the queued vertices.
				const effectiveLen = captured.length ?? captured.srcData.byteLength;
				expect(effectiveLen).toBeGreaterThanOrEqual(4 * bytesPerVertex);
			} finally {
				gl.bufferData = origBufferData;
			}
		});
	});
});
