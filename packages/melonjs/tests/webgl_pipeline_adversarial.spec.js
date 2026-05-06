import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, GLShader, video, WebGLRenderer } from "../src/index.js";

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
});
