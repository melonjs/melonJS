import { beforeAll, describe, expect, it } from "vitest";
import { boot, video, WebGLRenderer } from "../src/index.js";

/**
 * Benchmark for WebGL save/restore — measures performance and GC pressure.
 * Simulates 1000 sprites each doing save/translate/setColor/restore per frame,
 * over 60 frames (1 second at 60fps).
 */
describe("WebGL save/restore benchmark", () => {
	let renderer;

	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});
		renderer = video.renderer;
	});

	it("benchmark: 1000 sprites × 60 frames save/restore cycle", () => {
		const isWebGL = renderer instanceof WebGLRenderer;
		if (!isWebGL) {
			console.log("[BENCH] Skipped — Canvas renderer (WebGL not available)");
			return;
		}

		const SPRITES = 1000;
		const FRAMES = 60;
		const WARMUP_FRAMES = 10;

		// warm up — let JIT compile and pools fill
		for (let f = 0; f < WARMUP_FRAMES; f++) {
			for (let i = 0; i < SPRITES; i++) {
				renderer.save();
				renderer.translate(i, i);
				renderer.setColor(
					`rgb(${i % 256}, ${(i * 2) % 256}, ${(i * 3) % 256})`,
				);
				renderer.restore();
			}
		}

		// force GC if available (Chrome)
		if (globalThis.gc) {
			globalThis.gc();
		}

		// snapshot memory before
		const memBefore = performance.memory
			? performance.memory.usedJSHeapSize
			: null;

		// timed run
		const start = performance.now();
		for (let f = 0; f < FRAMES; f++) {
			for (let i = 0; i < SPRITES; i++) {
				renderer.save();
				renderer.translate(i, i);
				renderer.setColor(
					`rgb(${i % 256}, ${(i * 2) % 256}, ${(i * 3) % 256})`,
				);
				renderer.restore();
			}
		}
		const elapsed = performance.now() - start;

		// snapshot memory after
		const memAfter = performance.memory
			? performance.memory.usedJSHeapSize
			: null;

		const totalOps = SPRITES * FRAMES;
		const opsPerMs = totalOps / elapsed;
		const memDelta =
			memBefore !== null
				? ((memAfter - memBefore) / 1048576).toFixed(2)
				: "n/a";

		console.log("╔══════════════════════════════════════════════════╗");
		console.log("║  WebGL save/restore BENCHMARK                   ║");
		console.log("╠══════════════════════════════════════════════════╣");
		console.log(
			`║  Sprites:        ${String(SPRITES).padStart(10)}                 ║`,
		);
		console.log(
			`║  Frames:         ${String(FRAMES).padStart(10)}                 ║`,
		);
		console.log(
			`║  Total ops:      ${String(totalOps).padStart(10)}                 ║`,
		);
		console.log(
			`║  Total time:     ${(elapsed.toFixed(2) + "ms").padStart(10)}                 ║`,
		);
		console.log(
			`║  Ops/ms:         ${opsPerMs.toFixed(1).padStart(10)}                 ║`,
		);
		console.log(
			`║  Per-op avg:     ${(((elapsed / totalOps) * 1000).toFixed(2) + "µs").padStart(10)}                 ║`,
		);
		console.log(
			`║  Heap delta:     ${(memDelta + "MB").padStart(10)}                 ║`,
		);
		console.log("╚══════════════════════════════════════════════════╝");

		// sanity check: it should complete, state should be clean
		expect(elapsed).toBeGreaterThan(0);
		expect(renderer.currentTransform).toBeDefined();
	});
});
