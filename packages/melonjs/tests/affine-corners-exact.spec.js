import { describe, expect, it } from "vitest";
import { Bounds, Matrix2d, Matrix3d, Point, Vector3d } from "../src/index.js";
import { transformQuadCorners } from "../src/video/gpu/quadcorners.ts";

// a seeded generator, so a failure can be replayed
let seed = 12345;
const rnd = () => {
	seed = (seed * 16807) % 2147483647;
	return seed / 2147483647;
};
const pick = () => {
	const r = rnd();
	// mostly ordinary values, some awkward ones
	if (r < 0.05) {
		return 0;
	}
	if (r < 0.08) {
		return -0;
	}
	if (r < 0.1) {
		return 0.1;
	}
	return (rnd() - 0.5) * 2000;
};

const affine3d = () => {
	const m = new Matrix3d();
	m.translate(pick(), pick(), pick());
	m.rotate(rnd() * 7);
	m.scale(pick() / 100 || 1, pick() / 100 || 1, 1);
	if (rnd() < 0.3) {
		// a 3D turn, as a Camera3d view has
		m.rotate(rnd() * 7, new Vector3d(rnd(), rnd(), rnd()).normalize());
	}
	return m;
};

const affine2d = () => {
	const m = new Matrix2d();
	m.translate(pick(), pick());
	m.rotate(rnd() * 7);
	m.scale(pick() / 100 || 1, pick() / 100 || 1);
	return m;
};

// what the corners were before: four `apply` calls
const referenceCorners = (m, x, y, w, h, z) => {
	const c = [
		new Vector3d(x, y, z),
		new Vector3d(x + w, y, z),
		new Vector3d(x, y + h, z),
		new Vector3d(x + w, y + h, z),
	];
	if (m && !m.isIdentity()) {
		for (const v of c) {
			m.apply(v);
		}
	}
	return c;
};

// what addFrame did before for a transform: four `addPoint` calls
const referenceFrame = (m, x0, y0, x1, y1) => {
	const b = new Bounds();
	b.clear();
	const p = new Point();
	b.addPoint(p.set(x0, y0), m);
	b.addPoint(p.set(x1, y0), m);
	b.addPoint(p.set(x0, y1), m);
	b.addPoint(p.set(x1, y1), m);
	return [b.min.x, b.min.y, b.max.x, b.max.y];
};

describe("affine fast paths give the same bits as apply", () => {
	it("transformQuadCorners matches four Matrix3d#apply", () => {
		for (let i = 0; i < 20000; i++) {
			const m = affine3d();
			const args = [pick(), pick(), pick(), pick(), pick()];
			const want = referenceCorners(m, ...args);
			const got = transformQuadCorners(m, ...args);
			for (let k = 0; k < 4; k++) {
				expect(Object.is(got[k].x, want[k].x)).toBe(true);
				expect(Object.is(got[k].y, want[k].y)).toBe(true);
				expect(Object.is(got[k].z, want[k].z)).toBe(true);
			}
		}
	});

	it("Bounds#addFrame matches four addPoint, for a Matrix3d and a Matrix2d", () => {
		for (let i = 0; i < 20000; i++) {
			const m = i % 2 === 0 ? affine3d() : affine2d();
			const f = [pick(), pick(), pick(), pick()];
			const want = referenceFrame(m, ...f);
			const b = new Bounds();
			b.clear();
			b.addFrame(...f, m);
			const got = [b.min.x, b.min.y, b.max.x, b.max.y];
			for (let k = 0; k < 4; k++) {
				expect(Object.is(got[k], want[k])).toBe(true);
			}
		}
	});
});
