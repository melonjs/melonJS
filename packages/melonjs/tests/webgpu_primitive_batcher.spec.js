import "./helpers/webgpu-globals.js";
import { beforeEach, describe, expect, it } from "vitest";
import WebGPUPrimitiveBatcher from "../src/video/webgpu/batchers/primitive_batcher.js";
import { createMockWebGPURenderer } from "./helpers/webgpu-mock-renderer.js";

/**
 * Unit tests for the WebGPU primitive batcher against the mock renderer:
 * topology handling, the emulated line-loop/triangle-fan front ends,
 * thick-line expansion, chunking math, and the lineWidth/frame-globals
 * interplay (a review-fixed bug: the value rides a per-frame uniform slot
 * that clear() rewrites, so the batcher must compare against what the
 * CURRENT slot holds, never a batcher-local cache).
 */
describe("WebGPUPrimitiveBatcher", () => {
	let renderer;
	let batcher;

	// the frozen 24-byte layout, restated so tests can shrink maxVertices
	const LAYOUT = [
		{ name: "aVertex", format: "float32x3", offset: 0 },
		{ name: "aNormal", format: "float32x2", offset: 12 },
		{ name: "aColor", format: "unorm8x4", offset: 20 },
	];

	function makeVerts(points) {
		return points.map(([x, y]) => {
			return { x, y };
		});
	}

	beforeEach(() => {
		renderer = createMockWebGPURenderer();
		batcher = new WebGPUPrimitiveBatcher(renderer);
	});

	it("a lineWidth differing from the current frame slot flushes and pushes a new slot", () => {
		renderer.lineWidth = 5;
		renderer.currentFrameLineWidth = 1;

		batcher.drawVertices(
			"line-list",
			makeVerts([
				[0, 0],
				[10, 0],
			]),
			2,
		);
		expect(renderer.calls.pushFrameGlobals).toBe(1);

		// same width again: the slot already holds 5 — no redundant push
		batcher.drawVertices(
			"line-list",
			makeVerts([
				[0, 0],
				[10, 0],
			]),
			2,
		);
		expect(renderer.calls.pushFrameGlobals).toBe(1);

		// next frame: clear() rewrites the slot with lineWidth = 1 while the
		// renderable still strokes at 5 — the batcher must push again (the
		// original bug drew 1px-wide strokes from frame 2 on)
		renderer.currentFrameLineWidth = 1;
		batcher.drawVertices(
			"line-list",
			makeVerts([
				[0, 0],
				[10, 0],
			]),
			2,
		);
		expect(renderer.calls.pushFrameGlobals).toBe(2);
	});

	it("a topology change flushes the pending vertices under the old topology", () => {
		batcher.drawVertices(
			"triangle-list",
			makeVerts([
				[0, 0],
				[10, 0],
				[0, 10],
			]),
			3,
		);
		expect(renderer.calls.draws).toEqual([]);

		batcher.drawVertices(
			"line-list",
			makeVerts([
				[0, 0],
				[10, 0],
			]),
			2,
		);
		// the triangle batch drained before the topology switched
		expect(renderer.calls.draws).toEqual([3]);
		expect(renderer.calls.pipelineKeys[0]).toContain("|triangle-list|");

		batcher.flush();
		expect(renderer.calls.draws).toEqual([3, 2]);
		expect(renderer.calls.pipelineKeys[1]).toContain("|line-list|");
	});

	it("line-loop draws as a strip with an explicit closing vertex", () => {
		batcher.drawVertices(
			"line-loop",
			makeVerts([
				[0, 0],
				[10, 0],
				[5, 8],
			]),
			3,
		);

		// strips flush at end-of-shape: 3 vertices + the closing duplicate
		expect(renderer.calls.draws).toEqual([4]);
		expect(renderer.calls.pipelineKeys[0]).toContain("|line-strip|");

		// the closing vertex IS the first one (stride = 6 floats)
		const floats = renderer.calls.writes[0].floats;
		expect([floats[18], floats[19]]).toEqual([floats[0], floats[1]]);
	});

	it("triangle-fan re-expands on the CPU into a triangle list", () => {
		batcher.drawVertices(
			"triangle-fan",
			makeVerts([
				[0, 0],
				[10, 0],
				[10, 10],
				[0, 10],
				[-5, 5],
			]),
			5,
		);
		batcher.flush();

		// 5-vertex fan → 3 triangles → 9 vertices
		expect(renderer.calls.draws).toEqual([9]);
		expect(renderer.calls.pipelineKeys[0]).toContain("|triangle-list|");
	});

	it("thick line pairs expand to two triangles with unit normals; zero-length pairs are skipped", () => {
		renderer.lineWidth = 3;
		renderer.currentFrameLineWidth = 3;

		batcher.drawVertices(
			"line-list",
			makeVerts([
				[0, 0],
				[10, 0],
				[5, 5],
				[5, 5],
			]),
			4,
		);
		batcher.flush();

		// one real segment → 6 vertices; the degenerate pair contributes none
		expect(renderer.calls.draws).toEqual([6]);
		// perpendicular unit normal of a horizontal segment is (0, ±1)
		const floats = renderer.calls.writes[0].floats;
		expect([floats[3], floats[4]]).toEqual([-0, 1]);
	});

	it("an over-capacity triangle list splits into chunks on triangle boundaries", () => {
		batcher = new WebGPUPrimitiveBatcher(renderer, {
			shaderKey: "primitive",
			topology: "triangle-list",
			attributes: LAYOUT,
			maxVertices: 8,
		});

		// capacity is maxVertex - 1 = 7 → 6 vertices per chunk (whole triangles)
		const points = Array.from({ length: 12 }, (unused, i) => {
			return [i, i];
		});
		batcher.drawVertices("triangle-list", makeVerts(points), 12);
		batcher.flush();

		expect(renderer.calls.draws).toEqual([6, 6]);
	});

	it("shapes that fill the staging buffer flush between shapes, not mid-shape", () => {
		batcher = new WebGPUPrimitiveBatcher(renderer, {
			shaderKey: "primitive",
			topology: "triangle-list",
			attributes: LAYOUT,
			maxVertices: 8,
		});

		const triangles = makeVerts([
			[0, 0],
			[10, 0],
			[0, 10],
			[10, 10],
			[20, 10],
			[10, 20],
		]);
		batcher.drawVertices("triangle-list", triangles, 6);
		expect(renderer.calls.draws).toEqual([]);

		// 6 pending + 6 more won't fit 8 → the pending batch drains first
		batcher.drawVertices("triangle-list", triangles, 6);
		expect(renderer.calls.draws).toEqual([6]);

		batcher.flush();
		expect(renderer.calls.draws).toEqual([6, 6]);
	});

	it("flushes record one write of exactly the pending bytes and reuse the cached pipeline", () => {
		batcher.drawVertices(
			"point-list",
			makeVerts([
				[1, 2],
				[3, 4],
			]),
			2,
		);
		batcher.flush();
		batcher.drawVertices("point-list", makeVerts([[5, 6]]), 1);
		batcher.flush();

		// 24-byte stride
		expect(
			renderer.calls.writes.map((w) => {
				return w.size;
			}),
		).toEqual([48, 24]);
		expect(renderer.calls.draws).toEqual([2, 1]);
		// same pipeline-state tuple → setPipeline recorded once
		expect(renderer.calls.setPipeline).toBe(1);

		// staging is empty after a flush — a third flush records nothing
		batcher.flush();
		expect(renderer.calls.draws).toEqual([2, 1]);
	});
});
