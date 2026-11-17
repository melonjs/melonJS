/**
 * The Rapier 3D adapter: loading, units on all three axes, the colliders the
 * 3D shapes become, a body's turn written onto a mesh exactly where the mesh
 * draws, the 3D form of the portable API with the 2D calls still working in
 * the plane of the body, events, queries, joints and lifecycle.
 */

import {
	Application,
	type BodyShape,
	Bounds,
	Box3d,
	boot,
	Capsule3d,
	ConvexHull3d,
	Ellipse,
	Mesh,
	Quaternion,
	Rect,
	Renderable,
	Sphere,
	TriangleMesh3d,
	Vector2d,
	Vector3d,
	video,
	World,
} from "melonjs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Rapier3dAdapter } from "../src/index";

const FRAME_MS = 1000 / 60;

type XYZ = { x: number; y: number; z: number };
type Response = { normal: XYZ; depth: number };
type Hooked = Renderable & {
	onCollisionStart?: (r: Response, other: Renderable) => void;
	onCollisionActive?: (r: Response, other: Renderable) => void;
	onCollisionEnd?: (r: Response, other: Renderable) => void;
	onShapeCollisionStart?: (c: Record<string, unknown>) => void;
};

describe("Rapier3dAdapter: before Rapier is loaded", () => {
	it("is not loaded, and the constructor says how to load it", () => {
		expect(Rapier3dAdapter.loaded).toBe(false);
		expect(() => {
			return new Rapier3dAdapter();
		}).toThrow(/Rapier3dAdapter\.create/);
	});

	it("load() returns one shared promise, and create() waits for it", async () => {
		const first = Rapier3dAdapter.load();
		expect(Rapier3dAdapter.load()).toBe(first);
		const adapter = await Rapier3dAdapter.create({ pixelsPerMeter: 64 });
		expect(Rapier3dAdapter.loaded).toBe(true);
		expect(adapter).toBeInstanceOf(Rapier3dAdapter);
		expect(adapter.pixelsPerMeter).toBe(64);
		expect(adapter.physicLabel).toBe("rapier3d");
		expect(adapter.capabilities.bodies3d).toBe(true);
		expect(adapter.capabilities.raycasts3d).toBe(true);
	});

	it("refuses a scale that is not a positive number", () => {
		for (const pixelsPerMeter of [0, -32, Number.NaN, Infinity]) {
			expect(() => {
				return new Rapier3dAdapter({ pixelsPerMeter });
			}).toThrow(/pixelsPerMeter/);
		}
	});
});

describe("Rapier3dAdapter", () => {
	let adapter: Rapier3dAdapter;
	let world: World;

	beforeAll(async () => {
		await Rapier3dAdapter.load();
		boot();
		const app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	beforeEach(() => {
		adapter = new Rapier3dAdapter();
		world = new World(0, 0, 800, 600, adapter);
	});

	// a renderable at (x, y, z) with a body, added at its own depth
	const make = (
		x: number,
		y: number,
		z: number,
		def: Renderable["bodyDef"],
	): Hooked => {
		const r = new Renderable(x, y, 32, 32) as Hooked;
		r.alwaysUpdate = true;
		r.bodyDef = def;
		world.addChild(r, z);
		return r;
	};
	// a 32-pixel cube, one meter at the default scale: 1 kg
	const cube = (x: number, y: number, z: number, extra = {}) => {
		return make(x, y, z, {
			type: "dynamic",
			shapes: [new Box3d(0, 0, 0, 32, 32, 32)],
			...extra,
		});
	};
	const floor = (y: number, extra = {}) => {
		return make(400, y, 0, {
			type: "static",
			shapes: [new Box3d(0, 0, 0, 2000, 40, 2000)],
			...extra,
		});
	};
	const run = (frames: number) => {
		for (let i = 0; i < frames; i++) {
			world.update(FRAME_MS);
		}
	};
	const colliderOf = (r: Renderable, i = 0) => {
		return (r.body as Rapier3dAdapter.Body).collider(i);
	};

	describe("units", () => {
		it("gravity is in pixels per second², pulling down Y", () => {
			const b = cube(100, 0, 50);
			run(60);
			// one second of the default 320 px/s² from rest: about 160px
			expect(b.pos.y).toBeGreaterThan(150);
			expect(b.pos.y).toBeLessThan(170);
			expect(b.depth).toBeCloseTo(50, 3);
			expect(b.pos.x).toBeCloseTo(100, 3);
		});

		it("gravity can pull along Z, and is read every step", () => {
			adapter.gravity.set(0, 0, 320);
			const b = cube(100, 100, 0);
			run(60);
			expect(b.depth).toBeGreaterThan(150);
			expect(b.pos.y).toBeCloseTo(100, 3);
			adapter.gravity.set(0, 0, 0);
			const v = adapter.getVelocity3d(b).z;
			run(10);
			expect(adapter.getVelocity3d(b).z).toBeCloseTo(v, 3);
		});

		it("velocity is in pixels per second on all three axes", () => {
			const b = cube(100, 100, 0, { gravityScale: 0 });
			adapter.setVelocity(b, new Vector3d(60, -30, 120));
			run(60);
			expect(b.pos.x).toBeCloseTo(160, 0);
			expect(b.pos.y).toBeCloseTo(70, 0);
			expect(b.depth).toBeCloseTo(120, 0);
			const v = adapter.getVelocity3d(b);
			expect([v.x, v.y, v.z].map(Math.round)).toEqual([60, -30, 120]);
		});

		it("a Vector2d velocity keeps the depth velocity", () => {
			const b = cube(100, 100, 0, { gravityScale: 0 });
			adapter.setVelocity(b, new Vector3d(0, 0, 90));
			adapter.setVelocity(b, new Vector2d(10, 0));
			expect(adapter.getVelocity3d(b).z).toBeCloseTo(90, 3);
			expect(adapter.getVelocity(b).x).toBeCloseTo(10, 3);
			// and the body handle does the same
			b.body.setVelocity(20, 0);
			expect(adapter.getVelocity3d(b).z).toBeCloseTo(90, 3);
			b.body.setVelocity(20, 0, -5);
			expect(b.body.getVelocity3d?.().z).toBeCloseTo(-5, 3);
		});

		it("maxVelocity caps each axis, z only when given", () => {
			const capped = cube(100, 100, 0, {
				gravityScale: 0,
				maxVelocity: { x: 50, y: 50, z: 50 },
			});
			const open = cube(300, 100, 0, {
				gravityScale: 0,
				maxVelocity: { x: 50, y: 50 },
			});
			for (const r of [capped, open]) {
				adapter.setVelocity(r, new Vector3d(400, -400, 400));
			}
			run(1);
			const c = adapter.getVelocity3d(capped);
			expect([c.x, c.y, c.z].map(Math.round)).toEqual([50, -50, 50]);
			const o = adapter.getVelocity3d(open);
			expect(Math.round(o.x)).toBe(50);
			expect(o.z).toBeGreaterThan(300);
			expect(adapter.getMaxVelocity(open).z).toBe(Infinity);
		});

		it("holds at another scale", () => {
			adapter = new Rapier3dAdapter({ pixelsPerMeter: 64 });
			world = new World(0, 0, 800, 600, adapter);
			const b = cube(100, 100, 10, { gravityScale: 0 });
			adapter.setVelocity(b, new Vector3d(0, 0, 120));
			run(60);
			expect(b.depth).toBeCloseTo(130, 0);
		});
	});

	describe("forces, impulses and torques", () => {
		it("a force acts for one frame, by force / mass", () => {
			const b = cube(100, 100, 0, { gravityScale: 0 });
			adapter.applyForce(b, new Vector3d(0, 0, 100));
			run(1);
			const v = adapter.getVelocity3d(b).z;
			expect(v).toBeCloseTo(100 / 60, 2);
			run(1);
			expect(adapter.getVelocity3d(b).z).toBeCloseTo(v, 6);
		});

		it("a Vector2d force pushes in the plane of the body only", () => {
			const b = cube(100, 100, 0, { gravityScale: 0 });
			adapter.applyForce(b, new Vector2d(100, 0));
			run(1);
			expect(adapter.getVelocity3d(b).z).toBe(0);
			expect(adapter.getVelocity(b).x).toBeGreaterThan(0);
		});

		it("an impulse changes the velocity by impulse / mass, at once", () => {
			const b = cube(100, 100, 0, { gravityScale: 0 });
			adapter.applyImpulse(b, new Vector3d(0, 0, 64));
			expect(adapter.getVelocity3d(b).z).toBeCloseTo(64, 3);
			b.body.applyImpulse(32, 0, 32);
			const v = adapter.getVelocity3d(b);
			expect(v.x).toBeCloseTo(32, 3);
			expect(v.z).toBeCloseTo(96, 3);
		});

		it("an impulse off the centre spins the body; one through it does not", () => {
			const off = cube(100, 100, 0, { gravityScale: 0 });
			const through = cube(300, 100, 0, { gravityScale: 0 });
			// strike the top edge sideways, and the other through its centre
			adapter.applyImpulse(
				off,
				new Vector3d(0, 0, 10),
				new Vector3d(100, 84, 0),
			);
			adapter.applyImpulse(
				through,
				new Vector3d(0, 0, 10),
				new Vector3d(300, 100, 0),
			);
			const w = adapter.getAngularVelocity3d(off);
			expect(Math.abs(w.x)).toBeGreaterThan(0.1);
			const still = adapter.getAngularVelocity3d(through);
			expect(Math.hypot(still.x, still.y, still.z)).toBeCloseTo(0, 6);
		});

		it("a Vector2d point lies in the plane of the body", () => {
			const b = cube(100, 100, 200, { gravityScale: 0 });
			// at the body's own depth, so a push along x through its centre
			// line does not spin it about y
			adapter.applyImpulse(b, new Vector2d(10, 0), new Vector2d(100, 100));
			const w = adapter.getAngularVelocity3d(b);
			expect(Math.hypot(w.x, w.y, w.z)).toBeCloseTo(0, 6);
		});

		it("a torque as a number turns about Z, as a vector about each axis", () => {
			const z = cube(100, 100, 0, { gravityScale: 0 });
			const y = cube(300, 100, 0, { gravityScale: 0 });
			adapter.applyTorque(z, 5);
			adapter.applyTorque(y, new Vector3d(0, 5, 0));
			run(10);
			expect(Math.abs(adapter.getAngle(z))).toBeGreaterThan(0.01);
			const wy = adapter.getAngularVelocity3d(y);
			expect(Math.abs(wy.y)).toBeGreaterThan(0.01);
			expect(Math.abs(wy.z)).toBeCloseTo(0, 6);
		});

		it("fixedRotation keeps the body upright", () => {
			const b = cube(100, 100, 0, { gravityScale: 0, fixedRotation: true });
			adapter.applyTorque(b, new Vector3d(5, 5, 5));
			run(10);
			expect(adapter.getRotation(b).isIdentity()).toBe(true);
		});

		it("setAngularVelocity with a number keeps the spin about X and Y", () => {
			const b = cube(100, 100, 0, { gravityScale: 0 });
			adapter.setAngularVelocity(b, new Vector3d(1, 2, 3));
			adapter.setAngularVelocity(b, 7);
			const w = adapter.getAngularVelocity3d(b);
			expect([w.x, w.y, w.z]).toEqual([1, 2, 7]);
			expect(adapter.getAngularVelocity(b)).toBe(7);
		});
	});

	describe("the colliders a shape becomes", () => {
		const shapesOf = (shapes: BodyShape[], type = "static") => {
			return make(100, 100, 0, {
				type: type as "static" | "dynamic",
				shapes,
			});
		};

		it("each 3D shape is one collider of the matching kind, at its offset", () => {
			const R = adapter.rapier;
			const r = shapesOf([
				new Box3d(10, 0, 0, 32, 64, 16),
				new Sphere(0, 20, 0, 8),
				new Capsule3d(0, 0, 30, 8, 64),
				new ConvexHull3d([0, 0, 0, 32, 0, 0, 0, 32, 0, 0, 0, 32]),
				new TriangleMesh3d([0, 0, 0, 32, 0, 0, 0, 0, 32], [0, 1, 2]),
			]);
			const types = [0, 1, 2, 3, 4].map((i) => {
				return colliderOf(r, i).shape.type;
			});
			expect(types).toEqual([
				R.ShapeType.Cuboid,
				R.ShapeType.Ball,
				R.ShapeType.Capsule,
				R.ShapeType.ConvexPolyhedron,
				R.ShapeType.TriMesh,
			]);
			const box = colliderOf(r, 0).shape as InstanceType<typeof R.Cuboid>;
			expect(box.halfExtents.y).toBeCloseTo(1, 6);
			// offsets are relative to the body, in meters
			expect(colliderOf(r, 0).translation().x).toBeCloseTo((100 + 10) / 32, 5);
			const capsule = colliderOf(r, 2).shape as InstanceType<typeof R.Capsule>;
			expect(capsule.halfHeight).toBeCloseTo(24 / 32, 6);
			expect(capsule.radius).toBeCloseTo(8 / 32, 6);
		});

		it("a 2D shape is refused, with what to use instead, and leaves no body", () => {
			const bodies = adapter.world.bodies.len();
			for (const shape of [new Rect(0, 0, 10, 10), new Ellipse(0, 0, 10, 10)]) {
				const r = new Renderable(0, 0, 10, 10);
				expect(() => {
					adapter.addBody(r, { type: "dynamic", shapes: [shape] });
				}).toThrow(/needs a shape with depth.*Box3d/);
			}
			// refused before anything was made
			expect(adapter.world.bodies.len()).toBe(bodies);
		});

		it("a shape with isActive false makes no collider", () => {
			const off = new Sphere(0, 0, 0, 8);
			off.isActive = false;
			const r = shapesOf([off, new Box3d(0, 0, 0, 8, 8, 8)]);
			expect((r.body as Rapier3dAdapter.Body).numColliders()).toBe(1);
			expect(adapter.getBodyShapes(r)).toHaveLength(1);
		});

		it("points all in one plane still make a collider", () => {
			const flat = new ConvexHull3d([0, 0, 0, 32, 0, 0, 0, 32, 0, 32, 32, 0]);
			const r = shapesOf([flat]);
			expect((r.body as Rapier3dAdapter.Body).numColliders()).toBe(1);
		});

		it("a trigger shape is a sensor, and a body's settings reach every collider", () => {
			const trigger = new Sphere(0, 0, 0, 8);
			trigger.isTrigger = true;
			const r = make(100, 100, 0, {
				type: "static",
				shapes: [trigger, new Box3d(0, 0, 0, 8, 8, 8)],
				friction: 0.7,
				restitution: 0.4,
			});
			expect(colliderOf(r, 0).isSensor()).toBe(true);
			expect(colliderOf(r, 1).isSensor()).toBe(false);
			expect(colliderOf(r, 1).friction()).toBeCloseTo(0.7, 6);
			expect(colliderOf(r, 1).restitution()).toBeCloseTo(0.4, 6);
		});

		it("a fast sphere lands on a flat trimesh floor instead of falling through", () => {
			// a floor of two triangles with no thickness: the built-in physics
			// would need a thick slab for this
			make(400, 300, 0, {
				type: "static",
				shapes: [
					new TriangleMesh3d(
						[-1000, 0, -1000, 1000, 0, -1000, 1000, 0, 1000, -1000, 0, 1000],
						[0, 1, 2, 0, 2, 3],
					),
				],
			});
			const ball = make(400, 0, 0, {
				type: "dynamic",
				shapes: [new Sphere(0, 0, 0, 16)],
			});
			adapter.setVelocity(ball, new Vector3d(0, 900, 0));
			(ball.body as Rapier3dAdapter.Body).enableCcd(true);
			run(180);
			expect(ball.pos.y).toBeGreaterThan(270);
			expect(ball.pos.y).toBeLessThan(290);
			expect(adapter.isGrounded(ball)).toBe(true);
		});

		it("a capsule stands on a floor at its full height", () => {
			floor(400);
			const hero = make(400, 200, 0, {
				type: "dynamic",
				shapes: [new Capsule3d(0, 0, 0, 16, 100)],
				fixedRotation: true,
			});
			run(180);
			// the floor's top is at 380; the capsule's centre 50 above it
			expect(hero.pos.y).toBeCloseTo(330, 0);
		});
	});

	describe("a body's turn on what it draws", () => {
		const triMesh = (settings: Record<string, unknown> = {}) => {
			return new Mesh(0, 0, {
				vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 1]),
				uvs: new Float32Array(6),
				indices: new Uint16Array([0, 1, 2]),
				width: 10,
				height: 10,
				scale: 10,
				normalize: false,
				...settings,
			});
		};

		// where the mesh draws each of its vertices, in the world
		const drawn = (mesh: Mesh) => {
			// internal, so not in the published types
			const m = (
				mesh as Mesh & { _composeModelMatrix(): { val: Float32Array } }
			)._composeModelMatrix().val;
			const v = mesh.originalVertices;
			const out: XYZ[] = [];
			for (let i = 0; i < v.length; i += 3) {
				const [x, y, z] = [v[i], v[i + 1], v[i + 2]];
				out.push({
					x: m[0] * x + m[4] * y + m[8] * z + m[12],
					y: m[1] * x + m[5] * y + m[9] * z + m[13],
					z: m[2] * x + m[6] * y + m[10] * z + m[14],
				});
			}
			return out;
		};

		const expectNear = (a: XYZ, b: XYZ) => {
			expect(a.x).toBeCloseTo(b.x, 3);
			expect(a.y).toBeCloseTo(b.y, 3);
			expect(a.z).toBeCloseTo(b.z, 3);
		};

		for (const rightHanded of [false, true]) {
			it(`a mesh draws where its body is turned to (rightHanded ${rightHanded})`, () => {
				const mesh = triMesh({ rightHanded });
				// a mesh already turned and stretched before it gets a body
				mesh.currentTransform.rotate(0.7, new Vector3d(0, 1, 0));
				mesh.currentTransform.scale(2, 1, 3);
				mesh.pos.set(200, 150);
				mesh.depth = 40;
				const rest = TriangleMesh3d.fromMesh(mesh).vertices;
				mesh.bodyDef = {
					type: "dynamic",
					shapes: [new Box3d(0, 0, 0, 20, 20, 20)],
					gravityScale: 0,
				};
				world.addChild(mesh, 40);
				const q = new Quaternion().rotate(
					1.1,
					new Vector3d(1, 2, -0.5).normalize(),
				);
				adapter.setRotation(mesh, q);
				// moving and spinning, then read where it draws
				adapter.setVelocity(mesh, new Vector3d(30, -20, 10));
				adapter.setAngularVelocity(mesh, new Vector3d(0.5, -1, 2));
				run(30);
				const now = adapter.getRotation(mesh);
				const at = drawn(mesh);
				for (let i = 0; i < at.length; i++) {
					const p = now.apply(
						new Vector3d(rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2]),
					);
					expectNear(at[i], {
						x: mesh.pos.x + p.x,
						y: mesh.pos.y + p.y,
						z: mesh.depth + p.z,
					});
				}
			});
		}

		it("a renderable that is not a mesh turns its transform in engine space", () => {
			const r = new Renderable(100, 100, 32, 32);
			// stretched before it gets its body
			r.currentTransform.scale(2, 2, 2);
			r.bodyDef = {
				type: "dynamic",
				shapes: [new Box3d(0, 0, 0, 32, 32, 32)],
				gravityScale: 0,
			};
			world.addChild(r, 0);
			const q = new Quaternion().rotate(0.5, new Vector3d(0, 0, 1));
			adapter.setRotation(r, q);
			const t = r.currentTransform.val;
			// R · scale(2): the first column is 2 × (cos, sin, 0)
			expect(t[0]).toBeCloseTo(2 * Math.cos(0.5), 6);
			expect(t[1]).toBeCloseTo(2 * Math.sin(0.5), 6);
			expect(t[2]).toBeCloseTo(0, 6);
		});

		it("updateShape keeps the transform the turn is written from", () => {
			const r = cube(100, 100, 0, { gravityScale: 0 });
			const q = new Quaternion().rotate(0.5, new Vector3d(0, 0, 1));
			adapter.setRotation(r, q);
			adapter.setVelocity(r, new Vector3d(5, 6, 7));
			adapter.updateShape(r, [new Sphere(0, 0, 0, 16)]);
			// not turned twice: the transform is still R · identity
			adapter.setRotation(r, adapter.getRotation(r));
			const t = r.currentTransform.val;
			expect(t[0]).toBeCloseTo(Math.cos(0.5), 6);
			expect(t[1]).toBeCloseTo(Math.sin(0.5), 6);
			const v = adapter.getVelocity3d(r);
			expect([v.x, v.y, v.z].map(Math.round)).toEqual([5, 6, 7]);
			expect(colliderOf(r).shape.type).toBe(adapter.rapier.ShapeType.Ball);
		});

		it("a static body turned by setRotation draws turned at once", () => {
			const r = make(100, 100, 0, {
				type: "static",
				shapes: [new Box3d(0, 0, 0, 32, 32, 32)],
			});
			adapter.setRotation(
				r,
				new Quaternion().rotate(Math.PI / 2, new Vector3d(0, 1, 0)),
			);
			// +X turns to -Z about Y
			expect(r.currentTransform.val[2]).toBeCloseTo(-1, 6);
		});
	});

	describe("orientation", () => {
		// a turned body moved to another Rapier 3D adapter by setAdapter: the
		// outgoing one turns it back first, or the new one, which turns a
		// renderable from how it stood, would turn it twice
		const swapKeepsTurn = (turn: Quaternion) => {
			const r = cube(100, 100, 0, { gravityScale: 0 });
			adapter.setRotation(r, turn);
			const drawn = Array.from(r.currentTransform.val);
			world.setAdapter(new Rapier3dAdapter());
			const next = world.adapter as Rapier3dAdapter;
			const after = Array.from(r.currentTransform.val);
			for (let i = 0; i < 16; i++) {
				expect(after[i]).toBeCloseTo(drawn[i], 5);
			}
			const q = next.getRotation(r);
			expect(Math.abs(q.dot(turn))).toBeCloseTo(1, 5);
		};

		it("a tilted body moved to another adapter is drawn as it was, turned once", () => {
			swapKeepsTurn(new Quaternion().rotate(0.6, new Vector3d(1, 0, 0)));
		});

		it("a body turned about Z moved to another adapter is drawn as it was", () => {
			swapKeepsTurn(new Quaternion().rotate(0.7, new Vector3d(0, 0, 1)));
		});

		it("getRotation / setRotation round-trip, a non-unit quaternion normalized", () => {
			const r = cube(100, 100, 0, { gravityScale: 0 });
			adapter.setRotation(r, new Quaternion(0, 0, 2, 2));
			const q = adapter.getRotation(r);
			expect(q.length()).toBeCloseTo(1, 6);
			expect(adapter.getAngle(r)).toBeCloseTo(Math.PI / 2, 5);
			const out = new Quaternion();
			expect(adapter.getRotation(r, out)).toBe(out);
		});

		it("setAngle turns about Z; getAngle reads the turn about Z", () => {
			const r = cube(100, 100, 0, { gravityScale: 0 });
			adapter.setAngle(r, -0.8);
			expect(adapter.getAngle(r)).toBeCloseTo(-0.8, 6);
			expect(r.body.getAngle?.()).toBeCloseTo(-0.8, 6);
			// a turn about X leaves +X in place: no turn about Z
			adapter.setRotation(r, new Quaternion().rotate(1, new Vector3d(1, 0, 0)));
			expect(adapter.getAngle(r)).toBeCloseTo(0, 6);
			// +X pointed straight down Z reads as no turn, not as noise
			adapter.setRotation(
				r,
				new Quaternion().rotate(Math.PI / 2, new Vector3d(0, 1, 0)),
			);
			expect(adapter.getAngle(r)).toBe(0);
		});

		it("a renderable with no body reads as still and upright", () => {
			const loose = new Renderable(0, 0, 1, 1);
			expect(adapter.getRotation(loose).isIdentity()).toBe(true);
			const v = adapter.getVelocity3d(loose);
			expect([v.x, v.y, v.z]).toEqual([0, 0, 0]);
			const w = adapter.getAngularVelocity3d(loose);
			expect([w.x, w.y, w.z]).toEqual([0, 0, 0]);
			expect(adapter.getAngle(loose)).toBe(0);
			// and the setters do nothing rather than throw
			expect(() => {
				adapter.setRotation(loose, new Quaternion());
				adapter.setVelocity(loose, new Vector3d(1, 1, 1));
				adapter.applyTorque(loose, 1);
			}).not.toThrow();
		});
	});

	describe("position", () => {
		it("a Vector3d moves the body in depth; a Vector2d keeps its depth", () => {
			const r = cube(100, 100, 30, { gravityScale: 0 });
			adapter.setPosition(r, new Vector3d(10, 20, -40));
			expect(r.depth).toBe(-40);
			expect((r.body as Rapier3dAdapter.Body).translation().z).toBeCloseTo(
				-40 / 32,
				6,
			);
			adapter.setPosition(r, new Vector2d(50, 60));
			expect(r.depth).toBe(-40);
			run(1);
			expect(r.pos.x).toBeCloseTo(50, 3);
			expect(r.depth).toBeCloseTo(-40, 3);
		});

		it("the body starts at the depth the renderable was added at", () => {
			const r = cube(100, 100, 75, { gravityScale: 0 });
			expect((r.body as Rapier3dAdapter.Body).translation().z).toBeCloseTo(
				75 / 32,
				6,
			);
		});
	});

	describe("collision events", () => {
		it("start, active and end, with a unit 3D normal", () => {
			floor(300);
			const b = cube(400, 200, 0);
			const seen: string[] = [];
			let normal: XYZ | undefined;
			b.onCollisionStart = (r) => {
				seen.push("start");
				normal = { ...r.normal };
			};
			b.onCollisionActive = () => {
				if (seen.at(-1) !== "active") seen.push("active");
			};
			b.onCollisionEnd = () => {
				seen.push("end");
			};
			run(90);
			expect(seen).toEqual(["start", "active"]);
			expect(normal).toBeDefined();
			const n = normal as XYZ;
			expect(Math.hypot(n.x, n.y, n.z)).toBeCloseTo(1, 4);
			// the floor is below: the body is pushed up, against Y
			expect(Math.abs(n.y)).toBeCloseTo(1, 3);
			adapter.setPosition(b, new Vector3d(400, -500, 0));
			run(2);
			expect(seen.at(-1)).toBe("end");
		});

		it("the shape-level hook names both shapes and carries z", () => {
			floor(300);
			const b = cube(400, 200, 0);
			let contact: Record<string, unknown> | undefined;
			b.onShapeCollisionStart = (c) => {
				contact ??= c;
			};
			run(90);
			expect(contact).toBeDefined();
			const c = contact as Record<string, unknown>;
			expect(c.shapeA).toBeInstanceOf(Box3d);
			expect(c.indexShapeA).toBe(0);
			expect(typeof c.normalZ).toBe("number");
			expect(c.isTrigger).toBe(false);
		});

		it("a body removed in a handler stops getting events", () => {
			floor(300);
			const b = cube(400, 200, 0);
			let active = 0;
			b.onCollisionStart = () => {
				world.removeChildNow(b);
			};
			b.onCollisionActive = () => {
				active++;
			};
			expect(() => {
				run(90);
			}).not.toThrow();
			expect(active).toBe(0);
		});

		it("collision types filter pairs, on all 32 bits", () => {
			floor(300, { collisionType: 1 << 20, collisionMask: 1 << 20 });
			const b = cube(400, 200, 0, {
				collisionType: 1 << 21,
				collisionMask: 1 << 21,
			});
			run(90);
			// fell through
			expect(b.pos.y).toBeGreaterThan(400);
		});
	});

	describe("queries", () => {
		it("raycast3d hits the exact shape, with the point, normal and fraction", () => {
			make(400, 300, 100, {
				type: "static",
				shapes: [new Sphere(0, 0, 0, 50)],
			});
			// queries see a body from the first step after it is added
			run(1);
			const hit = adapter.raycast3d(
				new Vector3d(400, 300, -100),
				new Vector3d(400, 300, 300),
			);
			expect(hit).not.toBeNull();
			const h = hit as NonNullable<typeof hit>;
			expect(h.point.z).toBeCloseTo(50, 2);
			expect(h.normal.z).toBeCloseTo(-1, 4);
			expect(h.fraction).toBeCloseTo(150 / 400, 4);
			// past the sphere's side, it misses
			expect(
				adapter.raycast3d(
					new Vector3d(460, 300, -100),
					new Vector3d(460, 300, 300),
				),
			).toBeNull();
			// a zero-length ray hits nothing
			expect(
				adapter.raycast3d(new Vector3d(1, 1, 1), new Vector3d(1, 1, 1)),
			).toBeNull();
		});

		it("raycast3d skips the body it starts inside", () => {
			const inside = make(400, 300, 0, {
				type: "static",
				shapes: [new Sphere(0, 0, 0, 50)],
			});
			const beyond = make(400, 300, 300, {
				type: "static",
				shapes: [new Sphere(0, 0, 0, 20)],
			});
			run(1);
			const hit = adapter.raycast3d(
				new Vector3d(400, 300, 0),
				new Vector3d(400, 300, 400),
			);
			expect(hit?.renderable).toBe(beyond);
			expect(hit?.renderable).not.toBe(inside);
		});

		it("querySphere takes a centre and radius, or a Sphere", () => {
			const near = cube(100, 100, 0, { gravityScale: 0 });
			cube(400, 100, 0, { gravityScale: 0 });
			run(1);
			const loose = adapter.querySphere(new Vector3d(100, 100, 30), 20);
			expect(loose).toEqual([near]);
			expect(adapter.querySphere(new Sphere(100, 100, 0, 1))).toEqual([near]);
			expect(adapter.querySphere(new Vector3d(250, 100, 0), 10)).toEqual([]);
		});

		it("queryAABB finds what lies over a rectangle at any depth", () => {
			const deep = cube(100, 100, 5000, { gravityScale: 0 });
			run(1);
			expect(adapter.queryAABB(new Rect(80, 80, 40, 40))).toEqual([deep]);
		});

		it("setPosition with a coordinate that is not a number leaves the body where it is", () => {
			const r = cube(100, 100, 0, { gravityScale: 0 });
			const other = cube(300, 100, 0, { gravityScale: 0 });
			adapter.setPosition(r, new Vector3d(120, 140, 30));
			const bad = [
				new Vector3d(Number.NaN, 140, 30),
				new Vector3d(120, Infinity, 30),
				new Vector3d(120, 140, Number.NaN),
				new Vector3d(120, 140, -Infinity),
				new Vector2d(Number.NaN, 1),
			];
			for (const p of bad) {
				adapter.setPosition(r, p);
				run(2);
				expect([r.pos.x, r.pos.y, r.depth]).toEqual([120, 140, 30]);
				const t = colliderOf(r).translation();
				expect(Number.isFinite(t.x + t.y + t.z)).toBe(true);
			}
			// and a valid position afterwards still moves it, and only it
			adapter.setPosition(r, new Vector3d(50, 60, 70));
			expect([r.pos.x, r.pos.y, r.depth]).toEqual([50, 60, 70]);
			expect(other.pos.x).toBe(300);
		});

		it("setAngle with an angle that is not a number leaves the body as it is", () => {
			const r = cube(100, 100, 0, { gravityScale: 0 });
			adapter.setAngle(r, 0.4);
			for (const bad of [Number.NaN, Infinity, -Infinity]) {
				adapter.setAngle(r, bad);
				expect(adapter.getAngle(r)).toBeCloseTo(0.4, 6);
				const q = adapter.getRotation(r);
				expect(Number.isFinite(q.x + q.y + q.z + q.w)).toBe(true);
			}
		});

		it("getBodyAABB is the XY footprint as the body is turned now", () => {
			const r = cube(100, 100, 0, { gravityScale: 0 });
			const b = adapter.getBodyAABB(r, new Bounds());
			expect(b?.width).toBeCloseTo(32, 4);
			adapter.setAngle(r, Math.PI / 4);
			const turned = adapter.getBodyAABB(r, new Bounds());
			expect(turned?.width).toBeCloseTo(32 * Math.SQRT2, 3);
			expect(turned?.min.x).toBeCloseTo(-16 * Math.SQRT2, 3);
		});
	});

	describe("joints", () => {
		it("a hinge about Y lets the bodies turn about Y only", () => {
			const post = make(100, 100, 0, {
				type: "static",
				shapes: [new Box3d(0, 0, 0, 8, 8, 8)],
			});
			const door = cube(150, 100, 0, { gravityScale: 0 });
			world.addJoint({
				type: "hinge",
				a: post,
				b: door,
				anchorB: { x: -50, y: 0 },
				axis: { x: 0, y: 1, z: 0 },
			});
			adapter.applyTorque(door, new Vector3d(3, 3, 3));
			run(30);
			const w = adapter.getAngularVelocity3d(door);
			expect(Math.abs(w.y)).toBeGreaterThan(0.01);
			expect(Math.abs(w.x)).toBeLessThan(1e-3);
			expect(Math.abs(w.z)).toBeLessThan(1e-3);
			// the door's edge stays on the post
			const t = (door.body as Rapier3dAdapter.Body).translation();
			expect(Math.hypot(t.x * 32 - 100, t.z * 32)).toBeCloseTo(50, 0);
		});

		it("a rope keeps the bodies within reach, its length defaulted from where they are", () => {
			const anchor = make(400, 100, 0, {
				type: "static",
				shapes: [new Sphere(0, 0, 0, 4)],
			});
			const weight = make(400, 100, 120, {
				type: "dynamic",
				shapes: [new Sphere(0, 0, 0, 8)],
			});
			const def = { type: "rope", a: anchor, b: weight } as const;
			world.addJoint(def);
			// it swings down on the rope, never further than its length
			let lowest = 0;
			for (let i = 0; i < 120; i++) {
				run(1);
				const d = Math.hypot(
					weight.pos.x - 400,
					weight.pos.y - 100,
					weight.depth,
				);
				expect(d).toBeLessThan(121);
				lowest = Math.max(lowest, weight.pos.y);
			}
			expect(lowest).toBeGreaterThan(200);
		});

		it("a weld keeps two bodies as they stood", () => {
			const a = cube(100, 100, 0, { gravityScale: 0 });
			const b = cube(140, 100, 0, { gravityScale: 0 });
			adapter.setRotation(
				b,
				new Quaternion().rotate(0.6, new Vector3d(0, 1, 0)),
			);
			world.addJoint({ type: "weld", a, b });
			adapter.applyImpulse(a, new Vector3d(0, -20, 0));
			adapter.applyTorque(a, new Vector3d(0, 0, 2));
			run(60);
			const qa = adapter.getRotation(a);
			const qb = adapter.getRotation(b);
			// the turn between them stays the 0.6 they were welded at
			const between = qa.clone().invert().multiply(qb);
			expect(Math.abs(between.w)).toBeCloseTo(Math.cos(0.3), 2);
		});

		it("a zero axis is refused", () => {
			const a = cube(100, 100, 0, { gravityScale: 0 });
			const b = cube(140, 100, 0, { gravityScale: 0 });
			expect(() => {
				adapter.addJoint({ type: "slider", a, b, axis: { x: 0, y: 0, z: 0 } });
			}).toThrow(/axis needs a length/);
		});

		it("removing a body removes its joints with it", () => {
			const a = cube(100, 100, 0, { gravityScale: 0 });
			const b = cube(140, 100, 0, { gravityScale: 0 });
			const joint = adapter.addJoint({ type: "weld", a, b });
			world.removeChildNow(b);
			expect(() => {
				adapter.removeJoint(joint);
			}).not.toThrow();
			expect(adapter.world.impulseJoints.len()).toBe(0);
		});
	});

	describe("sleeping", () => {
		/**
		 * Steps until `r` sleeps, or gives up.
		 * @param r - the body's renderable
		 * @param max - the frames to give up after
		 * @returns whether it fell asleep
		 */
		const settle = (r: Renderable, max = 1200): boolean => {
			for (let i = 0; i < max; i++) {
				run(1);
				if (adapter.isSleeping(r)) {
					return true;
				}
			}
			return false;
		};
		// a cube dropped a little way onto the floor, and left to settle
		const rested = () => {
			floor(500);
			const b = cube(400, 440, 0);
			expect(settle(b)).toBe(true);
			return b;
		};

		it("reports the capability", () => {
			expect(adapter.capabilities.sleepingBodies).toBe(true);
		});

		it("is false for a renderable the adapter does not know", () => {
			expect(adapter.isSleeping(new Renderable(0, 0, 8, 8))).toBe(false);
		});

		it("is false for a fixed or a kinematic body, however long they rest", () => {
			const ground = floor(500);
			const k = make(100, 100, 0, {
				type: "kinematic",
				shapes: [new Box3d(0, 0, 0, 32, 32, 32)],
			});
			run(600);
			expect(adapter.isSleeping(ground)).toBe(false);
			expect(adapter.isSleeping(k)).toBe(false);
		});

		it("is false while a body falls", () => {
			floor(500);
			const b = cube(400, 100, 0);
			run(10);
			expect(adapter.isSleeping(b)).toBe(false);
		});

		it("is true once the body has come to rest on the floor", () => {
			const b = rested();
			const y = b.pos.y;
			run(30);
			// asleep, it stays where it came to rest
			expect(b.pos.y).toBe(y);
			expect(adapter.isSleeping(b)).toBe(true);
		});

		it("a velocity along Z wakes the body, which then moves along Z", () => {
			const b = rested();
			const z = b.depth;
			adapter.setVelocity(b, new Vector3d(0, 0, 200));
			expect(adapter.isSleeping(b)).toBe(false);
			run(10);
			expect(b.depth).toBeGreaterThan(z);
		});

		it("an impulse, a force, a position or a rotation wakes it too", () => {
			const wakes: Array<(b: Renderable) => void> = [
				(b) => {
					adapter.applyImpulse(b, new Vector3d(0, 0, 5));
				},
				(b) => {
					adapter.applyForce(b, new Vector3d(50, 0, 0));
				},
				(b) => {
					adapter.setPosition(b, new Vector3d(b.pos.x + 40, b.pos.y, 0));
				},
				(b) => {
					adapter.setRotation(
						b,
						new Quaternion().rotate(0.5, new Vector3d(0, 1, 0)),
					);
				},
			];
			for (const wake of wakes) {
				const b = rested();
				wake(b);
				expect(adapter.isSleeping(b)).toBe(false);
				adapter.removeBody(b);
				world.removeChildNow(b);
			}
		});

		it("is false once the body is removed, or the adapter destroyed", () => {
			const b = rested();
			adapter.removeBody(b);
			expect(adapter.isSleeping(b)).toBe(false);
			const c = cube(200, 440, 0);
			expect(settle(c)).toBe(true);
			adapter.destroy();
			expect(adapter.isSleeping(c)).toBe(false);
		});
	});

	describe("body changes", () => {
		it("a kinematic body ignores gravity and moves by its velocity", () => {
			const k = make(100, 100, 0, {
				type: "kinematic",
				shapes: [new Box3d(0, 0, 0, 32, 32, 32)],
			});
			adapter.setVelocity(k, new Vector3d(0, 0, 60));
			run(60);
			expect(k.pos.y).toBeCloseTo(100, 3);
			expect(k.depth).toBeCloseTo(60, 0);
		});

		it("setMass changes the mass, so the same impulse moves it less", () => {
			const light = cube(100, 100, 0, { gravityScale: 0 });
			const heavy = cube(300, 100, 0, { gravityScale: 0 });
			heavy.body.setMass?.(4);
			for (const r of [light, heavy]) {
				adapter.applyImpulse(r, new Vector3d(0, 0, 40));
			}
			expect(adapter.getVelocity3d(heavy).z).toBeCloseTo(
				adapter.getVelocity3d(light).z / 4,
				3,
			);
		});

		it("a sleeping body is left as it is drawn", () => {
			floor(300);
			const b = cube(400, 250, 0);
			run(240);
			const body = b.body as Rapier3dAdapter.Body;
			expect(body.isSleeping()).toBe(true);
			// nudged on the renderable only: a sleeping body does not undo it
			b.pos.x = 999;
			run(1);
			expect(b.pos.x).toBe(999);
		});
	});

	it("step() outside init() says so, and destroy() is safe twice", () => {
		adapter.destroy();
		expect(() => {
			adapter.destroy();
		}).not.toThrow();
		expect(() => {
			adapter.step(FRAME_MS);
		}).toThrow(/no Rapier world/);
		expect(() => {
			new Rapier3dAdapter().destroy();
		}).not.toThrow();
	});

	it("destroy() frees Rapier's world, and init() builds a new one", () => {
		cube(100, 100, 0);
		const first = adapter.world;
		adapter.destroy();
		adapter.init(world);
		expect(adapter.world).not.toBe(first);
		expect(adapter.world.bodies.len()).toBe(0);
	});
});
