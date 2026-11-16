/**
 * `Mesh#shadowGroundNormal` keeps a normalized copy of what it is given: on
 * all three axes. It used `Vector3d#scale(1 / length)`, whose `z` defaults to
 * 1, so a normal with a part along Z kept that part unscaled and the shadow
 * was laid on a plane tilted the wrong way.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, Mesh, Vector3d, video } from "../src/index.js";

describe("Mesh#shadowGroundNormal", () => {
	let app;
	beforeAll(async () => {
		boot();
		app = new Application(64, 64, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
	});
	afterAll(() => {
		app?.destroy();
	});

	const mesh = () => {
		return new Mesh(0, 0, {
			vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
			uvs: new Float32Array(6),
			indices: new Uint16Array([0, 1, 2]),
			width: 10,
			height: 10,
			normalize: false,
		});
	};

	const expectUnit = (n, x, y, z) => {
		expect(Math.hypot(n.x, n.y, n.z)).toBeCloseTo(1, 10);
		expect(n.x).toBeCloseTo(x, 10);
		expect(n.y).toBeCloseTo(y, 10);
		expect(n.z).toBeCloseTo(z, 10);
	};

	it("normalizes a normal with a part along Z, from an array", () => {
		const m = mesh();
		m.shadowGroundNormal = [0, -3, 4];
		expectUnit(m.shadowGroundNormal, 0, -0.6, 0.8);
	});

	it("normalizes a normal with a part along Z, from a Vector3d", () => {
		const m = mesh();
		m.shadowGroundNormal = new Vector3d(2, -4, 4);
		expectUnit(m.shadowGroundNormal, 1 / 3, -2 / 3, 2 / 3);
	});

	it("still normalizes one in the XY plane, and keeps its own copy", () => {
		const m = mesh();
		const given = new Vector3d(0, -5, 0);
		m.shadowGroundNormal = given;
		expectUnit(m.shadowGroundNormal, 0, -1, 0);
		given.set(9, 9, 9);
		expectUnit(m.shadowGroundNormal, 0, -1, 0);
	});

	it("falls back to level for a zero normal", () => {
		const m = mesh();
		m.shadowGroundNormal = [0, 0, 0];
		expectUnit(m.shadowGroundNormal, 0, -1, 0);
	});
});
