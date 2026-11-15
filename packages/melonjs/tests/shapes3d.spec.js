import { beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	Body,
	Box3d,
	boot,
	Capsule3d,
	ConvexHull3d,
	collision,
	Mesh,
	Renderable,
	TriangleMesh3d,
	Vector3d,
	video,
	World,
} from "../src/index.js";

/**
 * The three 3D shapes a 3D physics adapter builds exactly: Capsule3d,
 * TriangleMesh3d and ConvexHull3d. Their own geometry here; what the built-in
 * physics does with them (stands their bounding Box3d in for them) at the end.
 */

let app;
beforeAll(async () => {
	boot();
	app = new Application(320, 240, {
		parent: "screen",
		scale: "auto",
		renderer: video.CANVAS,
	});
	await app.init();
});

describe("Capsule3d", () => {
	it("stands along Y, centred on pos, its height counting both ends", () => {
		const c = new Capsule3d(10, 20, 30, 5, 40);
		expect(c.type).toBe("Capsule3d");
		expect([c.pos.x, c.pos.y, c.pos.z]).toEqual([10, 20, 30]);
		expect(c.radius).toBe(5);
		expect(c.height).toBe(40);
		expect(c.halfSegment).toBe(15);
		const b = c.getBounds();
		expect([b.min.x, b.min.y, b.max.x, b.max.y]).toEqual([5, 0, 15, 40]);
		const b3 = c.getBounds3d();
		expect([b3.min.z, b3.max.z]).toEqual([25, 35]);
	});

	it("is a sphere when shorter than its two ends, never inside out", () => {
		const c = new Capsule3d(0, 0, 0, 10, 4);
		expect(c.height).toBe(20);
		expect(c.halfSegment).toBe(0);
		// negative and non-finite sizes are made safe, not kept
		const n = new Capsule3d(0, 0, 0, -6, -50);
		expect(n.radius).toBe(6);
		expect(n.height).toBe(50);
		const bad = new Capsule3d(0, 0, 0, Number.NaN, Number.POSITIVE_INFINITY);
		expect(bad.radius).toBe(0);
		expect(bad.height).toBe(0);
	});

	it("contains what is within its radius of the axis segment", () => {
		const c = new Capsule3d(0, 0, 0, 5, 40);
		expect(c.contains(0, 0, 0)).toBe(true);
		expect(c.contains(4.9, 14, 0)).toBe(true);
		// in the rounded cap: within 5 of (0, ±15, 0)
		expect(c.contains(0, 19.9, 0)).toBe(true);
		expect(c.contains(4, 19, 0)).toBe(false);
		expect(c.contains(new Vector3d(0, 0, 5.1))).toBe(false);
	});

	it("shifts and clones independently", () => {
		const c = new Capsule3d(0, 0, 0, 5, 20);
		const copy = c.clone();
		c.shift(1, 2, 3);
		c.shift(new Vector3d(1, 1, 1));
		expect([c.pos.x, c.pos.y, c.pos.z]).toEqual([2, 3, 4]);
		expect([copy.pos.x, copy.pos.y, copy.pos.z]).toEqual([0, 0, 0]);
	});

	it("gives the box around it", () => {
		const box = new Capsule3d(1, 2, 3, 5, 40).toBox3d();
		expect(box).toBeInstanceOf(Box3d);
		expect([box.pos.x, box.pos.y, box.pos.z]).toEqual([1, 2, 3]);
		expect([box.width, box.height, box.depth]).toEqual([10, 40, 10]);
	});
});

/** a mesh of one triangle, as a loaded glTF part would be */
const triMesh = (settings = {}) => {
	return new Mesh(0, 0, {
		vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
		uvs: new Float32Array(6),
		indices: new Uint16Array([0, 1, 2]),
		width: 10,
		height: 10,
		scale: 10,
		normalize: false,
		...settings,
	});
};

describe("TriangleMesh3d", () => {
	it("keeps the triangles it is given", () => {
		const t = new TriangleMesh3d([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2]);
		expect(t.type).toBe("TriangleMesh3d");
		expect(t.triangleCount).toBe(1);
		expect(Array.from(t.indices)).toEqual([0, 1, 2]);
		expect(t.vertices).toBeInstanceOf(Float32Array);
	});

	it("takes consecutive triples as triangles when given no indices", () => {
		const t = new TriangleMesh3d(new Array(18).fill(0));
		expect(Array.from(t.indices)).toEqual([0, 1, 2, 3, 4, 5]);
	});

	it("refuses broken geometry rather than building a broken collider", () => {
		expect(() => {
			return new TriangleMesh3d([0, 0, 0, 1]);
		}).toThrow(/triples/);
		expect(() => {
			return new TriangleMesh3d([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1]);
		}).toThrow(/threes/);
		for (const bad of [3, -1, 1.5, Number.NaN]) {
			expect(() => {
				return new TriangleMesh3d([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, bad]);
			}).toThrow(/names no vertex/);
		}
	});

	it("copies its arrays: editing the source later changes nothing", () => {
		const v = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
		const t = new TriangleMesh3d(v, [0, 1, 2]);
		v[3] = 99;
		expect(t.vertices[3]).toBe(1);
		const copy = t.clone();
		copy.vertices[0] = 5;
		expect(t.vertices[0]).toBe(0);
	});

	it("is built from a mesh exactly where the mesh draws it, whatever its placement", () => {
		for (const rightHanded of [false, true]) {
			const mesh = triMesh({ rightHanded });
			mesh.currentTransform.rotate(0.7, new Vector3d(0, 1, 0));
			mesh.currentTransform.scale(2, 1, 3);
			const t = TriangleMesh3d.fromMesh(mesh);
			// the mesh's own model matrix, without its pos, is where it draws
			const m = mesh._composeModelMatrix().val;
			for (let i = 0; i < 3; i++) {
				const vx = mesh.originalVertices[i * 3];
				const vy = mesh.originalVertices[i * 3 + 1];
				const vz = mesh.originalVertices[i * 3 + 2];
				const drawn = [
					m[0] * vx + m[4] * vy + m[8] * vz + m[12] - mesh.pos.x,
					m[1] * vx + m[5] * vy + m[9] * vz + m[13] - mesh.pos.y,
					m[2] * vx + m[6] * vy + m[10] * vz + m[14] - mesh.depth,
				];
				for (let k = 0; k < 3; k++) {
					expect(t.vertices[i * 3 + k]).toBeCloseTo(drawn[k], 4);
				}
			}
		}
	});

	it("measures its bounds, offset by pos, and gives the box around them", () => {
		const t = new TriangleMesh3d([0, 0, 0, 10, 0, 0, 0, 20, 5], [0, 1, 2]);
		t.shift(1, 1, 1);
		const b = t.getBounds3d();
		expect([b.min.x, b.min.y, b.min.z]).toEqual([1, 1, 1]);
		expect([b.max.x, b.max.y, b.max.z]).toEqual([11, 21, 6]);
		const f = t.getBounds();
		expect([f.min.x, f.max.y]).toEqual([1, 21]);
		const box = t.toBox3d();
		expect([box.width, box.height, box.depth]).toEqual([10, 20, 5]);
	});
});

describe("ConvexHull3d", () => {
	const tetra = [0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 10];

	it("keeps its points", () => {
		const h = new ConvexHull3d(tetra);
		expect(h.type).toBe("ConvexHull3d");
		expect(h.points.length).toBe(12);
		const b = h.getBounds3d();
		expect([b.max.x, b.max.y, b.max.z]).toEqual([10, 10, 10]);
	});

	it("refuses what cannot be a solid", () => {
		expect(() => {
			return new ConvexHull3d([0, 0, 0, 1]);
		}).toThrow(/triples/);
		expect(() => {
			return new ConvexHull3d([0, 0, 0, 1, 0, 0, 0, 1, 0]);
		}).toThrow(/four points/);
	});

	it("takes its points from a mesh as it draws", () => {
		const mesh = triMesh();
		const h = new ConvexHull3d([
			...TriangleMesh3d.fromMesh(mesh).vertices,
			0,
			0,
			1,
		]);
		const from = TriangleMesh3d.fromMesh(mesh).vertices;
		for (let i = 0; i < 9; i++) {
			expect(h.points[i]).toBeCloseTo(from[i]);
		}
		// a one-triangle mesh is flat: too few points for a hull of its own
		expect(() => {
			return ConvexHull3d.fromMesh(mesh);
		}).toThrow(/four points/);
	});

	it("gives the box around it, and clones independently", () => {
		const h = new ConvexHull3d(tetra);
		const box = h.toBox3d();
		expect([box.pos.x, box.width]).toEqual([5, 10]);
		const copy = h.clone();
		copy.points[0] = 7;
		expect(h.points[0]).toBe(0);
	});
});

describe("the built-in physics and the 3D shapes", () => {
	const holder = () => {
		const r = new Renderable(0, 0, 10, 10);
		r.isKinematic = false;
		return r;
	};

	it("stands each one's bounding Box3d in for it, with its collision settings", () => {
		for (const shape of [
			new Capsule3d(0, 0, 0, 5, 40),
			new TriangleMesh3d([0, 0, 0, 10, 0, 0, 0, 20, 5], [0, 1, 2]),
			new ConvexHull3d([0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 10]),
		]) {
			shape.collisionType = collision.types.ENEMY_OBJECT;
			shape.isTrigger = true;
			const body = new Body(holder(), shape);
			expect(body.shapes.length).toBe(1);
			const box = body.shapes[0];
			expect(box).toBeInstanceOf(Box3d);
			expect(body.hasDepth).toBe(true);
			expect(box.collisionType).toBe(collision.types.ENEMY_OBJECT);
			expect(box.isTrigger).toBe(true);
			const b3 = shape.getBounds3d();
			expect(box.width).toBeCloseTo(b3.max.x - b3.min.x);
			expect(box.depth).toBeCloseTo(b3.max.z - b3.min.z);
		}
	});

	it("a capsule falls onto a triangle-mesh floor and stops on it", () => {
		const world = new World(0, 0, 800, 600);
		world.sortOn = "depth";
		const floor = new Renderable(0, 0, 400, 20);
		floor.anchorPoint.set(0.5, 0.5);
		floor.bodyDef = {
			type: "static",
			shapes: [
				// a slab 20 thick: the stand-in box of a perfectly flat floor
				// would be thin enough for a falling body to step through
				new TriangleMesh3d(
					[
						-200, 0, -200, 200, 0, -200, 200, 0, 200, -200, 0, 200, -200, 20,
						-200, 200, 20, -200, 200, 20, 200, -200, 20, 200,
					],
					[0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7],
				),
			],
		};
		world.addChild(floor, 0);
		floor.pos.set(200, 300, 0);
		const hero = new Renderable(0, 0, 10, 40);
		hero.anchorPoint.set(0.5, 0.5);
		hero.alwaysUpdate = true;
		hero.bodyDef = {
			type: "dynamic",
			shapes: [new Capsule3d(0, 0, 0, 5, 40)],
			maxVelocity: { x: 6, y: 6 },
		};
		world.addChild(hero, 0);
		hero.pos.set(200, 200, 0);
		for (let i = 0; i < 240; i++) {
			world.update(1000 / 60);
		}
		// resting on the floor (y = 300), its centre half its height above it
		expect(hero.pos.y).toBeLessThan(300);
		expect(hero.pos.y).toBeGreaterThan(300 - 40);
	});
});
