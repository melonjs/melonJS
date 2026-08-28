import { afterAll, beforeAll, describe, it } from "vitest";
import { boot, Mesh, TextureAtlas, WebGLRenderer } from "../src/index.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

/**
 * Benchmark for `WebGLRenderer.drawMesh` introduced alongside issue #1468.
 * Measures per-mesh cost across mesh counts on a synthetic scene to isolate
 * the drawMesh path from world-tree walk / collision / etc.
 *
 * Under the post-#1468 architecture, depth-mode state (DEPTH_TEST + LEQUAL +
 * depthMask + the lazy per-target `clear(DEPTH_BUFFER_BIT)` + BLEND off)
 * lives on `MeshBatcher.bind()` / `unbind()`. A run of consecutive
 * `drawMesh` calls pays the state cost once on mesh-mode enter; the GPU's
 * LEQUAL depth test then resolves inter-mesh occlusion per pixel against
 * the accumulated buffer. So per-mesh cost in a hot loop is dominated by
 * (1) addMesh's CPU geometry walk and (2) the per-call `flush()` →
 * drawElements (CPU command-buffer overhead + GPU rasterization).
 *
 * A future batching pass (queue multiple meshes between flushes) would
 * amortize (2) across the run. This baseline lets that future change be
 * measured directly against today's numbers.
 *
 * Issue #1507 added the second arm of each case: the same draws through the
 * retained path (geometry resident on the GPU, placement by uniform) against
 * the immediate one. Read these as **CPU-side** cost — the run happens under
 * a software rasterizer, and both arms produce the same clip-space geometry,
 * so rasterization load is equal and the difference is the per-frame vertex
 * walk and re-upload that the retained path removes. The reported
 * `drawElements` count is the other half of the story: the immediate path
 * splits a mesh past the 16-bit index ceiling into several chunks, while the
 * retained path draws it whole.
 */
describe("drawMesh benchmark (baseline for #1468)", () => {
	let renderer;
	let cube;
	let denseMesh;

	beforeAll(async () => {
		boot();
		try {
			renderer = await getWebGLRenderer(800, 600);
		} catch {
			// Headless chromium without --enable-gpu silently falls back to
			// Canvas. The measure helper skips when renderer is not WebGL.
		}

		// Build a tiny synthetic cube: 8 vertices, 12 triangles. Roughly
		// matches the per-primitive complexity of Kenney low-poly assets
		// (the AfterBurner showcase's enemies are 20-50 tris each).
		const verts = new Float32Array([
			-0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5, -0.5,
			-0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
		]);
		const uvs = new Float32Array([
			0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1,
		]);
		// 12 triangles = 36 indices (cube faces, two tris per face)
		// Format: each face = quad → tri1 + tri2
		const idx = new Uint16Array([
			// back face
			0, 1, 2, 0, 2, 3,
			// front face
			4, 6, 5, 4, 7, 6,
			// left face
			0, 3, 7, 0, 7, 4,
			// right face
			1, 5, 6, 1, 6, 2,
			// bottom face
			0, 4, 5, 0, 5, 1,
			// top face
			3, 2, 6, 3, 6, 7,
		]);

		// 4x4 grayscale checker as the mesh texture
		const tex = document.createElement("canvas");
		tex.width = 4;
		tex.height = 4;
		const ctx = tex.getContext("2d");
		ctx.fillStyle = "#888";
		ctx.fillRect(0, 0, 4, 4);
		ctx.fillStyle = "#ccc";
		for (let y = 0; y < 4; y++) {
			for (let x = 0; x < 4; x++) {
				if ((x + y) & 1) {
					ctx.fillRect(x, y, 1, 1);
				}
			}
		}
		const atlas = new TextureAtlas(
			{ framewidth: 4, frameheight: 4, image: tex, name: "bench_tex" },
			tex,
			false, // skip cache so re-runs don't accumulate
		);

		cube = new Mesh(0, 0, {
			vertices: verts,
			uvs,
			indices: idx,
			texture: atlas,
			width: 64,
			height: 64,
		});

		// The cube is 8 vertices, so it measures per-CALL overhead almost
		// exclusively. Issue #1507's actual complaint is high vertex counts,
		// where the immediate path's per-VERTEX CPU walk and re-upload
		// dominate — this mesh is sized to show that.
		// Kept modest on purpose: this runs under a software rasterizer
		// alongside the rest of the suite, and a mesh large enough to stress
		// the driver slows unrelated specs down rather than measuring anything
		// extra. 1 250 quads is already two orders of magnitude past the cube
		// and shows the vertex-bound effect plainly.
		const DENSE_QUADS = 1250; // 5 000 vertices, 7 500 indices
		const dv = new Float32Array(DENSE_QUADS * 4 * 3);
		const du = new Float32Array(DENSE_QUADS * 4 * 2);
		const di = new Uint32Array(DENSE_QUADS * 6);
		for (let q = 0; q < DENSE_QUADS; q++) {
			const base = q * 4;
			for (let c = 0; c < 4; c++) {
				const v = (base + c) * 3;
				dv[v] = (c === 1 || c === 2 ? 1 : -1) * 8;
				dv[v + 1] = (c >= 2 ? 1 : -1) * 8;
				dv[v + 2] = q * 0.001;
			}
			di.set([base, base + 1, base + 2, base, base + 2, base + 3], q * 6);
		}
		denseMesh = new Mesh(0, 0, {
			vertices: dv,
			uvs: du,
			indices: di,
			texture: atlas,
			width: 64,
			height: 64,
		});
	});

	afterAll(() => {
		// hand the shared context back and reset renderer state so the next
		// spec file does not inherit ours
		releaseWebGLRenderer();
	});

	const measure = (label, meshCount, framesToTime, retained = false, mesh) => {
		const target = mesh ?? cube;
		const isWebGL = renderer instanceof WebGLRenderer;
		if (!isWebGL) {
			console.log(`[BENCH] ${label} — skipped, Canvas renderer`);
			return;
		}

		const WARMUP = 10;

		// Passing a model matrix selects the retained path: the geometry is
		// uploaded once and every later call is uniforms + one drawElements.
		// Omitting it keeps the immediate path, which re-walks and re-uploads
		// the mesh on every call — the two arms are what issue #1507 compares.
		const draw = retained
			? () => {
					renderer.drawMesh(target, target._composeModelMatrix());
				}
			: () => {
					renderer.drawMesh(target);
				};

		// warm-up — JIT compile, fill GL caches, and (retained) prime the
		// geometry upload so it isn't charged to the timed run
		for (let f = 0; f < WARMUP; f++) {
			for (let i = 0; i < meshCount; i++) {
				draw();
			}
		}

		if (globalThis.gc) {
			globalThis.gc();
		}

		// timed run
		let drawElementsCalls = 0;
		const origDE = renderer.gl.drawElements.bind(renderer.gl);
		renderer.gl.drawElements = (...a) => {
			drawElementsCalls++;
			return origDE(...a);
		};
		const start = performance.now();
		for (let f = 0; f < framesToTime; f++) {
			for (let i = 0; i < meshCount; i++) {
				draw();
			}
		}
		// A real barrier. `gl.finish()` was here, and it does NOT wait under
		// ANGLE/SwiftShader — verified: a thousand draws queue in 0.3ms and
		// `finish()` returns in 0.3ms, while the rasterization is still to
		// come. So the timings it produced were fiction, AND the work escaped
		// the test: it drained afterwards in Chromium's single shared GPU
		// process, wedging every page for minutes. On CI that stall is
		// visible as ~190 seconds of silence in the middle of a passing run,
		// and it is what killed the browser in the failing ones — the spec
		// named in "Browser connection was closed" was always this file's
		// neighbour in execution order, never this file.
		//
		// A 1x1 readPixels genuinely blocks until the pipeline drains, so the
		// cost lands inside the measurement where it belongs.
		const drain = new Uint8Array(4);
		renderer.gl.readPixels(
			0,
			0,
			1,
			1,
			renderer.gl.RGBA,
			renderer.gl.UNSIGNED_BYTE,
			drain,
		);
		const elapsed = performance.now() - start;
		renderer.gl.drawElements = origDE;

		const drawCalls = meshCount * framesToTime;
		const msPerFrame = elapsed / framesToTime;
		const msPerMesh = elapsed / drawCalls;
		const budgetAt60 = (msPerFrame / 16.667) * 100;

		console.log(
			`[BENCH] ${(retained ? `${label} (retained)` : label).padEnd(32)} ` +
				`${meshCount.toString().padStart(4)} meshes/frame × ${framesToTime} frames = ` +
				`${drawCalls.toString().padStart(6)} drawMesh calls; ` +
				`total ${elapsed.toFixed(1).padStart(7)}ms, ` +
				`per-frame ${msPerFrame.toFixed(3).padStart(6)}ms ` +
				`(${budgetAt60.toFixed(1).padStart(5)}% of 60fps budget), ` +
				`per-mesh ${(msPerMesh * 1000).toFixed(1).padStart(5)}µs, ` +
				`${drawElementsCalls} drawElements`,
		);
	};

	it("baseline cost across mesh counts", (ctx) => {
		// `measure()` below logs and returns when there is no WebGL, which
		// reports as a PASS — a benchmark that never ran then looks exactly
		// like one that did. Decide it once, visibly, up front.
		if (!(renderer instanceof WebGLRenderer)) {
			ctx.skip("Canvas renderer — drawMesh benchmark not applicable");
			return;
		}
		// Skipped on CI, visibly rather than by quietly measuring nothing.
		// The runner is a GPU-less container rasterizing through SwiftShader's
		// Subzero JIT on four shared vCPUs, so these figures describe that
		// environment and not the engine. The work is also heavy enough to
		// starve the shared GPU process for minutes, which is what made the
		// suite flaky. Run it locally to compare against #1507's numbers.
		if (import.meta.env.VITE_CI !== "") {
			ctx.skip("CI — a software-rasterized benchmark measures the runner");
			return;
		}
		// Frame counts chosen so total drawMesh calls stays in the same
		// ballpark (~1500-3000), making per-mesh cost the dominant signal
		// rather than per-frame fixed overhead.
		const cases = [
			["AfterBurner-scale", 15, 200],
			["dense scene", 50, 60],
			["stress (small)", 100, 30],
			["stress (large)", 500, 6],
		];
		for (const [label, meshCount, frames] of cases) {
			measure(label, meshCount, frames, false);
			measure(label, meshCount, frames, true);
		}
		// the vertex-bound case issue #1507 was actually filed about
		measure("5k-vert mesh ×4", 4, 10, false, denseMesh);
		measure("5k-vert mesh ×4", 4, 10, true, denseMesh);
	});
});
