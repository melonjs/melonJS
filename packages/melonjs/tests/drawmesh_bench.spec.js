import { beforeAll, describe, it } from "vitest";
import {
	boot,
	Mesh,
	TextureAtlas,
	video,
	WebGLRenderer,
} from "../src/index.js";

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
 */
describe("drawMesh benchmark (baseline for #1468)", () => {
	let renderer;
	let cube;

	beforeAll(() => {
		boot();
		try {
			video.init(800, 600, {
				parent: "screen",
				scale: "auto",
				renderer: video.WEBGL,
			});
		} catch {
			// Headless chromium without --enable-gpu silently falls back to
			// Canvas. The measure helper skips when renderer is not WebGL.
		}
		renderer = video.renderer;

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
	});

	const measure = (label, meshCount, framesToTime) => {
		const isWebGL = renderer instanceof WebGLRenderer;
		if (!isWebGL) {
			console.log(`[BENCH] ${label} — skipped, Canvas renderer`);
			return;
		}

		const WARMUP = 10;

		// warm-up — JIT compile, fill GL caches
		for (let f = 0; f < WARMUP; f++) {
			for (let i = 0; i < meshCount; i++) {
				renderer.drawMesh(cube);
			}
		}

		if (globalThis.gc) {
			globalThis.gc();
		}

		// timed run
		const start = performance.now();
		for (let f = 0; f < framesToTime; f++) {
			for (let i = 0; i < meshCount; i++) {
				renderer.drawMesh(cube);
			}
		}
		// gl.finish forces the driver to flush all queued GL work — without
		// it, drawElements latency hides under the rAF cadence and the
		// numbers look better than they really are.
		renderer.gl.finish();
		const elapsed = performance.now() - start;

		const drawCalls = meshCount * framesToTime;
		const msPerFrame = elapsed / framesToTime;
		const msPerMesh = elapsed / drawCalls;
		const budgetAt60 = (msPerFrame / 16.667) * 100;

		console.log(
			`[BENCH] ${label.padEnd(20)} ` +
				`${meshCount.toString().padStart(4)} meshes/frame × ${framesToTime} frames = ` +
				`${drawCalls.toString().padStart(6)} drawMesh calls; ` +
				`total ${elapsed.toFixed(1).padStart(7)}ms, ` +
				`per-frame ${msPerFrame.toFixed(3).padStart(6)}ms ` +
				`(${budgetAt60.toFixed(1).padStart(5)}% of 60fps budget), ` +
				`per-mesh ${(msPerMesh * 1000).toFixed(1).padStart(5)}µs`,
		);
	};

	it("baseline cost across mesh counts", () => {
		// Frame counts chosen so total drawMesh calls stays in the same
		// ballpark (~1500-3000), making per-mesh cost the dominant signal
		// rather than per-frame fixed overhead.
		measure("AfterBurner-scale", 15, 200);
		measure("dense scene", 50, 60);
		measure("stress (small)", 100, 30);
		measure("stress (large)", 500, 6);
	});
});
