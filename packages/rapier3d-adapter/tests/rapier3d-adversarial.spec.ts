/**
 * The Rapier 3D adapter under the cases meant to break it: turned bodies in
 * every frame conversion, joints made between bodies that do not stand
 * alike, bodies removed or reshaped in the middle of a collision dispatch,
 * units at other scales, inputs that are not numbers, a renderable with no
 * body, and an adapter destroyed and used again.
 */

import {
	Application,
	type BodyShape,
	Bounds,
	Box3d,
	boot,
	Capsule3d,
	collision,
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
type Response = { a: Renderable; b: Renderable; normal: XYZ; depth: number };
type Hooked = Renderable & {
	onCollisionStart?: (r: Response, other: Renderable) => void;
	onCollisionActive?: (r: Response, other: Renderable) => void;
	onCollisionEnd?: (r: Response, other: Renderable) => void;
	onShapeCollisionStart?: (c: Record<string, unknown>) => void;
	onShapeCollisionEnd?: (c: Record<string, unknown>) => void;
};
type Body = Rapier3dAdapter.Body;
/** the adapter's own records, to check none is left behind */
type Internals = {
	activePairs: Map<string, [number, number]>;
	colliderMap: Map<number, unknown>;
	velocityLimits: Map<Renderable, unknown>;
	bodyMap: Map<Renderable, unknown>;
	overrides: Map<Renderable, unknown>;
};

/**
 * Exactly these renderables, in this order: by identity, not by likeness.
 * @param found - what the query returned
 * @param expected - the renderables it should have
 */
const expectFound = (found: readonly unknown[], ...expected: unknown[]) => {
	expect(found).toHaveLength(expected.length);
	for (const [i, r] of expected.entries()) {
		expect(found[i]).toBe(r);
	}
};

const X = new Vector3d(1, 0, 0);
const Y = new Vector3d(0, 1, 0);
const Z = new Vector3d(0, 0, 1);
const turn = (axis: Vector3d, angle: number) => {
	return new Quaternion().rotate(angle, axis.clone().normalize());
};
/**
 * How alike two turns are: 1 for the same turn, whatever the sign of q.
 * @param a - one turn
 * @param b - the other
 * @returns |a · b|
 */
const alike = (a: Quaternion, b: Quaternion) => {
	return Math.abs(a.dot(b));
};

describe("Rapier3dAdapter, adversarially", () => {
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

	const fresh = (options = {}) => {
		adapter = new Rapier3dAdapter(options);
		world = new World(0, 0, 800, 600, adapter);
	};
	beforeEach(() => {
		fresh();
	});

	const internals = (): Internals => {
		// the records live with the parts of the adapter that keep them
		const parts = adapter as unknown as {
			sim: {
				colliders: Internals["colliderMap"];
				bodies: Internals["bodyMap"];
			};
			contacts: { activePairs: Internals["activePairs"] };
			motion: { limits: Internals["velocityLimits"] };
			overrides: Internals["overrides"];
		};
		return {
			activePairs: parts.contacts.activePairs,
			colliderMap: parts.sim.colliders,
			velocityLimits: parts.motion.limits,
			bodyMap: parts.sim.bodies,
			overrides: parts.overrides,
		};
	};
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
	const cube = (x: number, y: number, z: number, extra = {}) => {
		return make(x, y, z, {
			type: "dynamic",
			shapes: [new Box3d(0, 0, 0, 32, 32, 32)],
			...extra,
		});
	};
	const fixed = (x: number, y: number, z: number, extra = {}) => {
		return make(x, y, z, {
			type: "static",
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
	const bodyOf = (r: Renderable) => {
		return r.body as Body;
	};
	const pose = (r: Renderable) => {
		return {
			x: r.pos.x,
			y: r.pos.y,
			z: r.depth,
			q: adapter.getRotation(r),
		};
	};
	const expectSamePose = (
		r: Renderable,
		was: ReturnType<typeof pose>,
		within = 0.05,
	) => {
		expect(Math.abs(r.pos.x - was.x)).toBeLessThan(within);
		expect(Math.abs(r.pos.y - was.y)).toBeLessThan(within);
		expect(Math.abs(r.depth - was.z)).toBeLessThan(within);
		expect(alike(adapter.getRotation(r), was.q)).toBeGreaterThan(0.99999);
	};

	describe("turns and frames", () => {
		it("setRotation → getRotation round-trips any turn, and a step with no spin keeps it", () => {
			const r = cube(100, 100, 0, { gravityScale: 0 });
			const turns = [
				turn(X, 0.3),
				turn(Y, -2.9),
				turn(Z, Math.PI),
				turn(new Vector3d(1, -2, 0.5), 1.7),
				turn(new Vector3d(-1, -1, -1), 3.1),
				// the same turn as its negative
				new Quaternion(0, 0, -Math.SQRT1_2, -Math.SQRT1_2),
			];
			for (const q of turns) {
				adapter.setRotation(r, q);
				expect(alike(adapter.getRotation(r), q)).toBeCloseTo(1, 5);
				run(3);
				expect(alike(adapter.getRotation(r), q)).toBeCloseTo(1, 5);
				expect(adapter.getRotation(r).length()).toBeCloseTo(1, 5);
			}
		});

		it("a quaternion of no length turns nothing, and leaves no NaN", () => {
			const r = cube(100, 100, 0, { gravityScale: 0 });
			adapter.setRotation(r, new Quaternion(0, 0, 0, 0));
			expect(adapter.getRotation(r).isIdentity()).toBe(true);
			run(2);
			expect(Array.from(r.currentTransform.val).every(Number.isFinite)).toBe(
				true,
			);
			expect(r.pos.x).toBeCloseTo(100, 3);
		});

		it("a renderable that is not a mesh is drawn as R · T₀, its translation turned with it, after tumbling", () => {
			// what a GLTFModel is to the adapter: a transform in engine space
			const r = new Renderable(100, 100, 32, 32);
			r.alwaysUpdate = true;
			r.currentTransform.rotate(0.4, Y);
			r.currentTransform.scale(1.5, 2, 0.5);
			r.currentTransform.translate(5, -3, 2);
			const rest = Float64Array.from(r.currentTransform.val);
			r.bodyDef = {
				type: "dynamic",
				shapes: [new Box3d(0, 0, 0, 32, 32, 32)],
				gravityScale: 0,
			};
			world.addChild(r, 30);
			adapter.setRotation(r, turn(new Vector3d(1, 2, -0.5), 1.1));
			adapter.setVelocity(r, new Vector3d(20, -10, 5));
			adapter.setAngularVelocity(r, new Vector3d(0.5, -1, 2));
			run(45);
			const q = adapter.getRotation(r);
			expect(q.isIdentity()).toBe(false);
			const now = r.currentTransform.val;
			for (let col = 0; col < 4; col++) {
				const o = col * 4;
				const p = q.apply(new Vector3d(rest[o], rest[o + 1], rest[o + 2]));
				expect(now[o]).toBeCloseTo(p.x, 4);
				expect(now[o + 1]).toBeCloseTo(p.y, 4);
				expect(now[o + 2]).toBeCloseTo(p.z, 4);
				expect(now[o + 3]).toBe(rest[o + 3]);
			}
			// and turned back, it is drawn exactly as it was made
			adapter.setRotation(r, new Quaternion());
			for (let i = 0; i < 16; i++) {
				expect(r.currentTransform.val[i]).toBeCloseTo(rest[i], 6);
			}
		});

		for (const rightHanded of [false, true]) {
			it(`a mesh moved off its origin draws where its body is, through updateShape and sleep (rightHanded ${rightHanded})`, () => {
				const mesh = new Mesh(0, 0, {
					vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1, 0]),
					uvs: new Float32Array(8),
					indices: new Uint16Array([0, 1, 2, 1, 2, 3]),
					width: 10,
					height: 10,
					scale: 10,
					normalize: false,
					rightHanded,
				});
				mesh.alwaysUpdate = true;
				mesh.currentTransform.rotate(-0.9, new Vector3d(1, 0, 0));
				mesh.currentTransform.scale(1, 3, 2);
				mesh.currentTransform.translate(0.3, -0.2, 0.5);
				mesh.pos.set(200, 150);
				mesh.depth = -60;
				// where it draws each vertex at rest, relative to its position
				const rest = TriangleMesh3d.fromMesh(mesh).vertices;
				mesh.bodyDef = {
					type: "dynamic",
					shapes: [new Box3d(0, 0, 0, 20, 20, 20)],
					gravityScale: 0,
				};
				world.addChild(mesh, -60);
				const check = () => {
					const m = (
						mesh as Mesh & { _composeModelMatrix(): { val: Float32Array } }
					)._composeModelMatrix().val;
					const v = mesh.originalVertices;
					const q = adapter.getRotation(mesh);
					for (let i = 0; i < v.length; i += 3) {
						const [x, y, z] = [v[i], v[i + 1], v[i + 2]];
						const p = q.apply(new Vector3d(rest[i], rest[i + 1], rest[i + 2]));
						expect(m[0] * x + m[4] * y + m[8] * z + m[12]).toBeCloseTo(
							mesh.pos.x + p.x,
							3,
						);
						expect(m[1] * x + m[5] * y + m[9] * z + m[13]).toBeCloseTo(
							mesh.pos.y + p.y,
							3,
						);
						expect(m[2] * x + m[6] * y + m[10] * z + m[14]).toBeCloseTo(
							mesh.depth + p.z,
							3,
						);
					}
				};
				check();
				adapter.setVelocity(mesh, new Vector3d(-15, 25, 40));
				adapter.setAngularVelocity(mesh, new Vector3d(2, 0.3, -1.4));
				run(40);
				check();
				adapter.updateShape(mesh, [new Sphere(0, 0, 0, 12)]);
				run(20);
				check();
				// asleep, then turned by hand: drawn at once
				bodyOf(mesh).sleep();
				adapter.setRotation(mesh, turn(new Vector3d(0.2, 1, 0.4), -2.2));
				check();
			});
		}

		it("getAngle of a tilted body is the heading of its X axis about Z", () => {
			const r = cube(100, 100, 0, { gravityScale: 0 });
			const heading = turn(Z, 0.9);
			const tilt = turn(X, 0.7);
			const results: number[] = [];
			for (const q of [
				heading.clone().multiply(tilt),
				tilt.clone().multiply(heading),
			]) {
				adapter.setRotation(r, q);
				const x = adapter.getRotation(r).apply(X.clone());
				expect(adapter.getAngle(r)).toBeCloseTo(Math.atan2(x.y, x.x), 5);
				expect(r.body.getAngle?.()).toBeCloseTo(Math.atan2(x.y, x.x), 5);
				results.push(adapter.getAngle(r));
			}
			// tilted about its own X, the heading is the 0.9 it was given;
			// tilted about the world's, a little less
			results.sort();
			expect(results[1]).toBeCloseTo(0.9, 5);
			expect(results[0]).toBeCloseTo(
				Math.atan2(Math.sin(0.9) * Math.cos(0.7), Math.cos(0.9)),
				5,
			);
			// setAngle is the 2D turn: it stands the body up again
			adapter.setAngle(r, 0.25);
			expect(alike(adapter.getRotation(r), turn(Z, 0.25))).toBeCloseTo(1, 6);
		});

		it("getBodyAABB follows a turned body: a sphere keeps its size, a capsule lies down", () => {
			const ball = make(100, 100, 0, {
				type: "dynamic",
				gravityScale: 0,
				shapes: [new Sphere(20, 0, 0, 10)],
			});
			const at = (r: Renderable) => {
				return adapter.getBodyAABB(r, new Bounds()) as Bounds;
			};
			expect(at(ball).min.x).toBeCloseTo(10, 4);
			expect(at(ball).max.x).toBeCloseTo(30, 4);
			adapter.setAngle(ball, Math.PI / 4);
			// its centre swung round to (14.1, 14.1); still 20 across
			expect(at(ball).width).toBeCloseTo(20, 3);
			expect(at(ball).height).toBeCloseTo(20, 3);
			expect(at(ball).min.x).toBeCloseTo(20 * Math.SQRT1_2 - 10, 3);
			expect(at(ball).min.y).toBeCloseTo(20 * Math.SQRT1_2 - 10, 3);

			const pill = make(300, 100, 0, {
				type: "dynamic",
				gravityScale: 0,
				shapes: [new Capsule3d(0, 0, 0, 8, 64)],
			});
			expect(at(pill).width).toBeCloseTo(16, 4);
			expect(at(pill).height).toBeCloseTo(64, 4);
			adapter.setAngle(pill, Math.PI / 2);
			expect(at(pill).width).toBeCloseTo(64, 3);
			expect(at(pill).height).toBeCloseTo(16, 3);
			// pointing into the screen, its footprint is a circle
			adapter.setRotation(pill, turn(X, Math.PI / 2));
			expect(at(pill).width).toBeCloseTo(16, 3);
			expect(at(pill).height).toBeCloseTo(16, 3);
			// half way, it is as tall as a 48px segment at 45° plus its ends
			adapter.setRotation(pill, turn(X, Math.PI / 4));
			expect(at(pill).height).toBeCloseTo(48 * Math.SQRT1_2 + 16, 3);

			const box = cube(500, 100, 0, { gravityScale: 0 });
			adapter.setRotation(box, turn(X, Math.PI / 4));
			expect(at(box).width).toBeCloseTo(32, 3);
			expect(at(box).height).toBeCloseTo(32 * Math.SQRT2, 3);
		});

		it("getBodyAABB has nothing for a body with no collider, or no body", () => {
			const off = new Sphere(0, 0, 0, 8);
			off.isActive = false;
			const r = make(100, 100, 0, { type: "static", shapes: [off] });
			expect(adapter.getBodyAABB(r, new Bounds())).toBeUndefined();
			expect(
				adapter.getBodyAABB(new Renderable(0, 0, 1, 1), new Bounds()),
			).toBeUndefined();
		});
	});

	describe("joints between bodies that do not stand alike", () => {
		// two bodies, each turned its own way, apart on every axis
		const pair = (typeA: "static" | "dynamic" = "dynamic") => {
			const a = make(100, 100, 20, {
				type: typeA,
				gravityScale: 0,
				shapes: [new Box3d(0, 0, 0, 32, 32, 32)],
			});
			const b = cube(160, 130, -30, { gravityScale: 0 });
			adapter.setRotation(a, turn(new Vector3d(1, 1, 0), 0.8));
			adapter.setRotation(b, turn(new Vector3d(0, 1, -2), -1.3));
			return { a, b };
		};

		for (const type of ["hinge", "weld", "slider", "rope"] as const) {
			it(`making a ${type} with default anchors moves nothing`, () => {
				const { a, b } = pair();
				const wasA = pose(a);
				const wasB = pose(b);
				const joint = world.addJoint({ type, a, b });
				run(60);
				expectSamePose(a, wasA);
				expectSamePose(b, wasB);
				const { anchorA, anchorB } = joint.definition as {
					anchorA: XYZ;
					anchorB: XYZ;
				};
				expect(anchorB).toEqual({ x: 0, y: 0, z: 0 });
				if (type === "rope") {
					// a rope joins the two origins, at the length they are apart
					expect(anchorA).toEqual({ x: 0, y: 0, z: 0 });
					expect(joint.definition.maxLength).toBeCloseTo(
						Math.hypot(60, 30, 50),
						3,
					);
				} else {
					// b's origin as a sees it, in pixels
					const seen = wasA.q
						.clone()
						.invert()
						.apply(new Vector3d(60, 30, -50));
					expect(anchorA.x).toBeCloseTo(seen.x, 3);
					expect(anchorA.y).toBeCloseTo(seen.y, 3);
					expect(anchorA.z).toBeCloseTo(seen.z, 3);
				}
			});
		}

		it("a weld holds a hanging body where it was, under gravity", () => {
			const { a, b } = pair("static");
			adapter.setGravityScale(b, 1);
			const was = pose(b);
			world.addJoint({ type: "weld", a, b });
			run(180);
			expectSamePose(b, was, 1.5);
			// and both move as one when the anchor is moved
			adapter.setPosition(a, new Vector3d(100, 100, 120));
			run(120);
			expect(b.depth).toBeGreaterThan(was.z + 90);
		});

		it("a hinge turns about the axis as its first body holds it", () => {
			// a post leaning over: its own Y is not the world's
			const post = fixed(100, 100, 0);
			const lean = turn(Z, 0.5);
			adapter.setRotation(post, lean);
			const door = cube(160, 100, 0, { gravityScale: 0 });
			adapter.setRotation(door, turn(new Vector3d(1, 0, 1), 0.9));
			const was = pose(door);
			world.addJoint({
				type: "hinge",
				a: post,
				b: door,
				axis: { x: 0, y: 1, z: 0 },
			});
			// nothing snaps into line when the joint is made
			run(30);
			expectSamePose(door, was);
			adapter.applyTorque(door, new Vector3d(4, 4, 4));
			run(30);
			const w = adapter.getAngularVelocity3d(door);
			const axis = lean.apply(Y.clone());
			const along = w.x * axis.x + w.y * axis.y + w.z * axis.z;
			expect(Math.abs(along)).toBeGreaterThan(0.01);
			// no spin left over about anything else
			expect(
				Math.hypot(
					w.x - along * axis.x,
					w.y - along * axis.y,
					w.z - along * axis.z,
				),
			).toBeLessThan(1e-3);
		});

		it("a slider follows its first body's axis, and its second keeps its turn", () => {
			// the rail's own X points down the world's Y
			const rail = fixed(100, 100, 0);
			adapter.setRotation(rail, turn(Z, Math.PI / 2));
			const car = cube(100, 160, 0);
			const tilt = turn(X, 0.5);
			adapter.setRotation(car, tilt);
			world.addJoint({ type: "slider", a: rail, b: car });
			run(30);
			// it falls along the rail, and only along it
			expect(car.pos.y).toBeGreaterThan(190);
			expect(car.pos.x).toBeCloseTo(100, 0);
			expect(car.depth).toBeCloseTo(0, 0);
			expect(alike(adapter.getRotation(car), tilt)).toBeGreaterThan(0.9999);
		});

		for (const pixelsPerMeter of [16, 32, 64]) {
			it(`a slider's limits are pixels along its axis, at ${pixelsPerMeter} pixels per meter`, () => {
				fresh({ pixelsPerMeter });
				const shaft = fixed(100, 100, 0);
				const cabin = cube(100, 100, 0);
				world.addJoint({
					type: "slider",
					a: shaft,
					b: cabin,
					axis: { x: 0, y: 2 },
					limits: { min: -10, max: 50 },
				});
				run(180);
				// limits are soft: within a pixel or two
				expect(Math.abs(cabin.pos.y - 150)).toBeLessThan(2);
				expect(cabin.pos.x).toBeCloseTo(100, 1);
				expect(cabin.depth).toBeCloseTo(0, 1);
				// at rest by now, and a change of gravity wakes no one
				adapter.gravity.set(0, -320, 0);
				bodyOf(cabin).wakeUp();
				run(180);
				expect(Math.abs(cabin.pos.y - 90)).toBeLessThan(2);
			});
		}

		it("a rope's length is pixels at another scale, anchors off centre and in depth", () => {
			fresh({ pixelsPerMeter: 50 });
			const hook = fixed(400, 100, 0);
			const weight = make(400, 100, 60, {
				type: "dynamic",
				shapes: [new Sphere(0, 0, 0, 8)],
			});
			world.addJoint({
				type: "rope",
				a: hook,
				b: weight,
				anchorA: { x: 0, y: 0, z: 20 },
				maxLength: 100,
			});
			let furthest = 0;
			for (let i = 0; i < 240; i++) {
				run(1);
				furthest = Math.max(
					furthest,
					Math.hypot(weight.pos.x - 400, weight.pos.y - 100, weight.depth - 20),
				);
			}
			// taut at its length, never past it by more than the solver's slack
			expect(furthest).toBeGreaterThan(97);
			expect(furthest).toBeLessThan(102);
		});

		it("a hinge's limits hold under load", () => {
			const post = fixed(100, 100, 0);
			const arm = cube(160, 100, 0);
			// about Z, as in 2D: gravity swings the arm down until the limit
			world.addJoint({
				type: "hinge",
				a: post,
				b: arm,
				anchorA: { x: 0, y: 0 },
				anchorB: { x: -60, y: 0 },
				limits: { min: -0.3, max: 0.3 },
			});
			run(240);
			expect(Math.abs(adapter.getAngle(arm))).toBeLessThan(0.36);
			expect(Math.abs(adapter.getAngle(arm))).toBeGreaterThan(0.25);
			expect(Math.hypot(arm.pos.x - 100, arm.pos.y - 100)).toBeCloseTo(60, 0);
		});

		it("refuses a joint to a renderable with no body, and an unknown kind", () => {
			const a = cube(100, 100, 0);
			expect(() => {
				adapter.addJoint({
					type: "weld",
					a,
					b: new Renderable(0, 0, 1, 1),
				});
			}).toThrow(/both renderables to have a body/);
			const b = cube(200, 100, 0);
			expect(() => {
				adapter.addJoint({ type: "spring" as "weld", a, b });
			}).toThrow(/unknown joint type "spring"/);
			expect(() => {
				adapter.addJoint({
					type: "hinge",
					a,
					b,
					axis: { x: Number.NaN, y: 0, z: 0 },
				});
			}).toThrow(/axis needs a length/);
			expect(adapter.world.impulseJoints.len()).toBe(0);
		});

		it("a joint is the same Rapier joint after updateShape, and still holds", () => {
			const a = fixed(100, 100, 0);
			const b = cube(160, 100, 0);
			const joint = world.addJoint({ type: "weld", a, b });
			const native = joint.native as { isValid(): boolean };
			adapter.updateShape(b, [new Sphere(0, 0, 0, 16)]);
			adapter.updateShape(a, [new Box3d(0, 0, 0, 8, 8, 8)]);
			expect(joint.native).toBe(native);
			expect(native.isValid()).toBe(true);
			expect(adapter.world.impulseJoints.len()).toBe(1);
			run(120);
			expect(b.pos.y).toBeCloseTo(100, 0);
			// removed once, with either body; twice is safe
			world.removeChildNow(b);
			expect(adapter.world.impulseJoints.len()).toBe(0);
			expect(joint.native).toBeNull();
			expect(() => {
				adapter.removeJoint(native as never);
				world.removeJoint(joint);
			}).not.toThrow();
		});
	});

	describe("units, at any scale", () => {
		for (const pixelsPerMeter of [16, 64, 100]) {
			it(`pixels in and out at ${pixelsPerMeter} pixels per meter`, () => {
				fresh({ pixelsPerMeter });
				// a 32-pixel cube of density 1 weighs its volume in meters
				const mass = (32 / pixelsPerMeter) ** 3;
				const faller = cube(100, 0, 50);
				const b = cube(300, 100, 0, { gravityScale: 0 });
				expect(bodyOf(b).mass()).toBeCloseTo(mass, 4);
				run(60);
				// the same fall in pixels whatever the scale
				expect(faller.pos.y).toBeGreaterThan(150);
				expect(faller.pos.y).toBeLessThan(170);
				// an impulse and a force act on the mass, in pixels
				adapter.applyImpulse(b, new Vector3d(0, 0, 64 * mass));
				expect(adapter.getVelocity3d(b).z).toBeCloseTo(64, 2);
				adapter.setVelocity(b, new Vector3d(0, 0, 0));
				adapter.applyForce(b, new Vector3d(120 * mass, 0, 0));
				run(1);
				expect(adapter.getVelocity(b).x).toBeCloseTo(2, 2);
				// positions
				adapter.setVelocity(b, new Vector3d(0, 0, 0));
				adapter.setPosition(b, new Vector3d(300, 100, 0));
				expect(bodyOf(b).translation().x).toBeCloseTo(300 / pixelsPerMeter, 4);
				// speed caps
				adapter.setMaxVelocity(b, { x: 30, y: 30, z: 30 });
				adapter.setVelocity(b, new Vector3d(500, -500, 500));
				run(1);
				const v = adapter.getVelocity3d(b);
				expect([v.x, v.y, v.z].map(Math.round)).toEqual([30, -30, 30]);
				adapter.setVelocity(b, new Vector3d(0, 0, 0));
				adapter.setPosition(b, new Vector3d(300, 100, 0));
				run(1);
				// queries
				const hit = adapter.raycast3d(
					new Vector3d(300, 100, -200),
					new Vector3d(300, 100, 200),
				);
				expect(hit?.renderable).toBe(b);
				expect(hit?.point.z).toBeCloseTo(-16, 1);
				expect(hit?.fraction).toBeCloseTo(184 / 400, 3);
				expect(hit?.normal.length()).toBeCloseTo(1, 4);
				expectFound(adapter.querySphere(new Vector3d(300, 100, 30), 15), b);
				expectFound(adapter.querySphere(new Vector3d(300, 100, 30), 13));
				// by its own box, to the pixel, though Rapier's is looser
				expectFound(adapter.queryAABB(new Rect(316.5, 90, 5, 5)));
				expectFound(adapter.queryAABB(new Rect(315, 90, 5, 5)), b);
				// the debug bounds
				expect(adapter.getBodyAABB(b, new Bounds())?.width).toBeCloseTo(32, 3);
			});
		}

		it("a force at a point turns the body by r × F over its inertia", () => {
			const b = cube(100, 100, 0, { gravityScale: 0 });
			// 100 px·kg/s² along Z on the top face, half a meter above the
			// centre: τ = −0.5 × 3.125 about X, I = 1/6, for one frame
			adapter.applyForce(b, new Vector3d(0, 0, 100), new Vector3d(100, 84, 0));
			run(1);
			const w = adapter.getAngularVelocity3d(b);
			expect(w.x).toBeCloseTo((-0.5 * 3.125 * 6) / 60, 3);
			expect(w.y).toBeCloseTo(0, 5);
			expect(w.z).toBeCloseTo(0, 5);
			// and only for that frame
			run(1);
			expect(adapter.getAngularVelocity3d(b).x).toBeCloseTo(w.x, 5);
		});

		it("the body handle's force acts in the plane of the body, at its depth", () => {
			const b = cube(100, 100, 250, { gravityScale: 0 });
			// through the centre line, at the body's own depth: no spin
			b.body.applyForce(100, 0, 100, 100);
			run(1);
			const w = adapter.getAngularVelocity3d(b);
			expect(Math.hypot(w.x, w.y, w.z)).toBeCloseTo(0, 6);
			expect(adapter.getVelocity3d(b).x).toBeCloseTo(100 / 60, 2);
			expect(adapter.getVelocity3d(b).z).toBe(0);
			// above the centre, it turns about Z only
			b.body.applyForce(100, 0, 100, 84);
			run(1);
			const turned = adapter.getAngularVelocity3d(b);
			expect(Math.abs(turned.z)).toBeGreaterThan(0.1);
			expect(Math.hypot(turned.x, turned.y)).toBeCloseTo(0, 6);
		});

		it("a force and a torque last one frame, across every sub-step", () => {
			fresh({ subSteps: 4 });
			const b = cube(100, 100, 0, { gravityScale: 0 });
			adapter.applyForce(b, new Vector3d(0, 0, 100));
			b.body.applyTorque?.(1);
			run(1);
			const v = adapter.getVelocity3d(b).z;
			const w = adapter.getAngularVelocity(b);
			// the whole frame's worth, not a quarter of it
			expect(v).toBeCloseTo(100 / 60, 2);
			// a torque is in Rapier's units, N·m: 1 over I = 1/6, for a frame
			expect(w).toBeCloseTo(6 / 60, 3);
			run(3);
			expect(adapter.getVelocity3d(b).z).toBeCloseTo(v, 5);
			expect(adapter.getAngularVelocity(b)).toBeCloseTo(w, 5);
		});

		it("gravity given without a z pulls in the plane; a scale of 0 or −1 on a body is its own", () => {
			fresh({ gravity: { x: 0, y: 640 } });
			expect(adapter.gravity.z).toBe(0);
			const heavy = cube(100, 0, 0);
			const floats = cube(300, 0, 0, { gravityScale: 0 });
			const rises = cube(500, 0, 0);
			adapter.setGravityScale(rises, -1);
			run(60);
			expect(heavy.pos.y).toBeGreaterThan(300);
			expect(heavy.pos.y).toBeLessThan(340);
			expect(floats.pos.y).toBe(0);
			expect(rises.pos.y).toBeCloseTo(-heavy.pos.y, 2);
			rises.body.setGravityScale?.(0);
			const v = adapter.getVelocity(rises).y;
			run(10);
			expect(adapter.getVelocity(rises).y).toBeCloseTo(v, 4);
		});

		it("density is per cubic meter, and frictionAir a damping rate, one value from an {x, y}", () => {
			const b = cube(100, 100, 0, {
				gravityScale: 0,
				density: 3,
				frictionAir: 2,
			});
			expect(bodyOf(b).mass()).toBeCloseTo(3, 4);
			expect(bodyOf(b).linearDamping()).toBe(2);
			expect(bodyOf(b).angularDamping()).toBe(2);
			adapter.setFrictionAir(b, { x: 1, y: 0.5 });
			expect(bodyOf(b).linearDamping()).toBe(0.75);
			adapter.setVelocity(b, new Vector3d(0, 0, 100));
			run(60);
			expect(adapter.getVelocity3d(b).z).toBeLessThan(60);
			expect(adapter.getVelocity3d(b).z).toBeGreaterThan(30);
		});

		it("a cap that is not a number caps nothing; a negative one caps by its size; the definition's is copied", () => {
			const limit = { x: 50, y: 50, z: 50 };
			const b = cube(100, 100, 0, { gravityScale: 0, maxVelocity: limit });
			limit.x = 1;
			adapter.getMaxVelocity(b).y = 1;
			adapter.setVelocity(b, new Vector3d(400, 400, 400));
			run(1);
			expect(adapter.getVelocity(b).x).toBeCloseTo(50, 3);
			expect(adapter.getVelocity(b).y).toBeCloseTo(50, 3);
			adapter.setMaxVelocity(b, { x: Number.NaN, y: -20 });
			adapter.setVelocity(b, new Vector3d(400, 400, 400));
			run(1);
			const v = adapter.getVelocity3d(b);
			expect(v.x).toBeCloseTo(400, 2);
			expect(v.y).toBeCloseTo(20, 3);
			// no z given: no cap along the depth
			expect(v.z).toBeCloseTo(400, 2);
			expect(adapter.getMaxVelocity(b).z).toBe(Infinity);
		});
	});

	describe("updateShape", () => {
		it("keeps the body: its handle, pose, velocities, and all that was set at run time", () => {
			const r = new Renderable(100, 100, 32, 32) as Hooked;
			r.alwaysUpdate = true;
			r.currentTransform.scale(2, 3, 4);
			const rest = Float64Array.from(r.currentTransform.val);
			r.bodyDef = {
				type: "dynamic",
				shapes: [new Box3d(0, 0, 0, 32, 32, 32)],
				gravityScale: 0,
			};
			world.addChild(r, 40);
			const handle = bodyOf(r);
			const q = turn(new Vector3d(1, 2, 3), 0.9);
			adapter.setRotation(r, q);
			adapter.setVelocity(r, new Vector3d(5, 6, 7));
			adapter.setAngularVelocity(r, new Vector3d(0.1, 0.2, 0.3));
			handle.enableCcd(true);
			adapter.setGravityScale(r, 0.5);
			adapter.setFrictionAir(r, 0.25);
			adapter.setMaxVelocity(r, { x: 900, y: 800, z: 700 });
			adapter.setSensor(r, true);
			adapter.setCollisionType(r, 1 << 20);
			r.body.collisionMask = 1 << 21;
			r.body.setBounce?.(0.9);

			const shapes: BodyShape[] = [
				new Sphere(0, 0, 0, 16),
				new Capsule3d(40, 0, 0, 8, 40),
			];
			adapter.updateShape(r, shapes);

			expect(r.body).toBe(handle);
			expect(handle.isValid()).toBe(true);
			expect(adapter.world.bodies.len()).toBe(1);
			expect(handle.numColliders()).toBe(2);
			expect(adapter.getBodyShapes(r)).toEqual(shapes);
			const t = handle.translation();
			expect([t.x * 32, t.y * 32, t.z * 32]).toEqual([100, 100, 40]);
			expect(alike(adapter.getRotation(r), q)).toBeCloseTo(1, 6);
			const v = adapter.getVelocity3d(r);
			expect([v.x, v.y, v.z].map(Math.round)).toEqual([5, 6, 7]);
			const w = adapter.getAngularVelocity3d(r);
			expect(w.x).toBeCloseTo(0.1, 5);
			expect(w.z).toBeCloseTo(0.3, 5);
			expect(handle.isCcdEnabled()).toBe(true);
			expect(handle.gravityScale()).toBe(0.5);
			expect(handle.linearDamping()).toBe(0.25);
			expect(adapter.getMaxVelocity(r)).toEqual({ x: 900, y: 800, z: 700 });
			for (const i of [0, 1]) {
				expect(handle.collider(i).isSensor()).toBe(true);
				expect(handle.collider(i).restitution()).toBeCloseTo(0.9, 6);
			}
			expect(r.body.collisionType).toBe(1 << 20);
			expect(r.body.collisionMask).toBe(1 << 21);
			// the helpers reach the new colliders
			r.body.setSensor?.(false);
			expect(handle.collider(1).isSensor()).toBe(false);
			// and the turn is still written from the transform it was made with
			adapter.setRotation(r, new Quaternion());
			expect(Array.from(r.currentTransform.val)).toEqual(Array.from(rest));
		});

		it("a body made static at run time stays static", () => {
			const r = cube(100, 100, 0);
			adapter.setStatic(r, true);
			adapter.updateShape(r, [new Sphere(0, 0, 0, 16)]);
			expect(bodyOf(r).isFixed()).toBe(true);
			run(30);
			expect(r.pos.y).toBe(100);
		});

		it("a shape it cannot build changes nothing", () => {
			const r = cube(100, 100, 0, { gravityScale: 0 });
			const handle = bodyOf(r);
			const collider = handle.collider(0).handle;
			const shapes = adapter.getBodyShapes(r);
			expect(() => {
				adapter.updateShape(r, [
					new Sphere(0, 0, 0, 4),
					new Rect(0, 0, 10, 10),
				]);
			}).toThrow(/unsupported shape type/);
			expect(r.body).toBe(handle);
			expect(handle.isValid()).toBe(true);
			expect(handle.numColliders()).toBe(1);
			expect(handle.collider(0).handle).toBe(collider);
			expect(adapter.getBodyShapes(r)).toBe(shapes);
			expect(adapter.world.colliders.len()).toBe(1);
			// and it still simulates
			adapter.setVelocity(r, new Vector3d(60, 0, 0));
			run(60);
			expect(r.pos.x).toBeCloseTo(160, 0);
		});

		it("the mass is that of the new shapes at once", () => {
			const r = cube(100, 100, 0, { gravityScale: 0 });
			adapter.updateShape(r, [new Box3d(0, 0, 0, 64, 64, 64)]);
			expect(bodyOf(r).mass()).toBeCloseTo(8, 4);
			adapter.applyImpulse(r, new Vector3d(0, 0, 64));
			expect(adapter.getVelocity3d(r).z).toBeCloseTo(8, 3);
		});

		it("ends the contacts of the old shapes and starts those of the new, and the body stays put", () => {
			const ground = floor(300);
			const b = cube(400, 260, 0);
			const seen: string[] = [];
			ground.onCollisionStart = () => {
				seen.push("start");
			};
			ground.onCollisionEnd = () => {
				seen.push("end");
			};
			run(120);
			expect(seen).toEqual(["start"]);
			adapter.updateShape(b, [new Box3d(0, 0, 0, 32, 32, 32)]);
			expect(seen).toEqual(["start", "end"]);
			run(60);
			expect(seen).toEqual(["start", "end", "start"]);
			expect(b.pos.y).toBeCloseTo(264, 0);
			expect(internals().activePairs.size).toBe(1);
		});

		it("with no shapes, or on a renderable with no body, it is harmless", () => {
			const r = cube(100, 100, 0, { gravityScale: 0 });
			adapter.updateShape(r, []);
			expect(bodyOf(r).numColliders()).toBe(0);
			expectFound(adapter.getBodyShapes(r));
			expect(adapter.getBodyAABB(r, new Bounds())).toBeUndefined();
			run(2);
			adapter.updateShape(r, [new Sphere(0, 0, 0, 8)]);
			expect(bodyOf(r).numColliders()).toBe(1);
			expect(() => {
				adapter.updateShape(new Renderable(0, 0, 1, 1), [
					new Sphere(0, 0, 0, 8),
				]);
			}).not.toThrow();
		});

		it("works from inside a collision hook", () => {
			floor(300);
			const b = cube(400, 250, 0);
			let reshaped = 0;
			b.onCollisionStart = () => {
				if (reshaped++ === 0) {
					adapter.updateShape(b, [new Sphere(0, 0, 0, 16)]);
				}
			};
			expect(() => {
				run(120);
			}).not.toThrow();
			expect(bodyOf(b).collider(0).shape.type).toBe(
				adapter.rapier.ShapeType.Ball,
			);
			// it landed again as a ball, and told so once more
			expect(reshaped).toBe(2);
			expect(b.pos.y).toBeCloseTo(264, 0);
		});
	});

	describe("bodies removed in the middle of a dispatch", () => {
		// two cubes overlapping from the first step, with every hook recorded
		const touching = () => {
			const a = cube(100, 100, 0, { gravityScale: 0 });
			const b = cube(120, 100, 0, { gravityScale: 0 });
			const seen: string[] = [];
			for (const [name, r] of [
				["a", a],
				["b", b],
			] as const) {
				r.onShapeCollisionStart = () => {
					seen.push(`${name}.shapeStart`);
				};
				r.onCollisionStart = () => {
					seen.push(`${name}.start`);
				};
				r.onCollisionActive = () => {
					seen.push(`${name}.active`);
				};
				r.onShapeCollisionEnd = () => {
					seen.push(`${name}.shapeEnd`);
				};
				r.onCollisionEnd = () => {
					seen.push(`${name}.end`);
				};
			}
			return { a, b, seen };
		};
		const of = (seen: string[], name: string) => {
			return seen.filter((s) => {
				return s.startsWith(`${name}.`);
			});
		};
		// every end follows its own start, and nothing follows the end
		const expectBalanced = (events: string[], name: string) => {
			for (const level of ["shapeStart:shapeEnd", "start:end"]) {
				const [start, end] = level.split(":").map((s) => {
					return `${name}.${s}`;
				});
				const starts = events.filter((e) => {
					return e === start;
				}).length;
				const ends = events.filter((e) => {
					return e === end;
				}).length;
				expect(ends).toBeLessThanOrEqual(starts);
				if (ends > 0) {
					expect(events.indexOf(end)).toBeGreaterThan(events.indexOf(start));
				}
			}
			if (events.includes(`${name}.end`)) {
				expect(events.at(-1)).toBe(`${name}.end`);
			}
		};
		const expectNoStalePair = () => {
			for (const [h1, h2] of internals().activePairs.values()) {
				expect(internals().colliderMap.has(h1)).toBe(true);
				expect(internals().colliderMap.has(h2)).toBe(true);
			}
		};

		it("one that removes itself in its start hook: the other hears the start, then the end, once", () => {
			const { a, seen } = touching();
			const start = a.onCollisionStart;
			a.onCollisionStart = (r, other) => {
				start?.(r, other);
				world.removeChildNow(a);
			};
			run(1);
			expectNoStalePair();
			expect(internals().activePairs.size).toBe(0);
			run(3);
			expect(of(seen, "b")).toEqual([
				"b.shapeStart",
				"b.start",
				"b.shapeEnd",
				"b.end",
			]);
			// and so does the one that left
			expect(of(seen, "a")).toEqual([
				"a.shapeStart",
				"a.start",
				"a.shapeEnd",
				"a.end",
			]);
			expect(adapter.world.bodies.len()).toBe(1);
		});

		it("one that removes the other in its start hook: neither hears an end before a start", () => {
			const { a, b, seen } = touching();
			a.onCollisionStart = () => {
				seen.push("a.start");
				world.removeChildNow(b);
			};
			run(4);
			expectBalanced(of(seen, "a"), "a");
			expectBalanced(of(seen, "b"), "b");
			expect(of(seen, "a")).toContain("a.end");
			expect(seen).not.toContain("a.active");
			expect(seen).not.toContain("b.active");
			expect(internals().activePairs.size).toBe(0);
		});

		it("one removed in a shape-level hook", () => {
			const { a, b, seen } = touching();
			b.onShapeCollisionStart = () => {
				seen.push("b.shapeStart");
				world.removeChildNow(a);
			};
			expect(() => {
				run(4);
			}).not.toThrow();
			expectBalanced(of(seen, "a"), "a");
			expectBalanced(of(seen, "b"), "b");
			expect(internals().activePairs.size).toBe(0);
		});

		it("one that removes itself while the contact is active: the other hears the end last, once", () => {
			const { a, seen } = touching();
			let frames = 0;
			a.onCollisionActive = () => {
				seen.push("a.active");
				if (++frames === 3) {
					world.removeChildNow(a);
				}
			};
			run(8);
			const heard = of(seen, "b");
			expectBalanced(heard, "b");
			expect(heard.at(-1)).toBe("b.end");
			expect(
				heard.filter((e) => {
					return e === "b.end";
				}),
			).toHaveLength(1);
			expect(
				heard.filter((e) => {
					return e === "b.active";
				}),
			).toHaveLength(3);
		});

		it("a body taken out with adapter.removeBody, its renderable still in the world, hears its own end", () => {
			const { a, seen } = touching();
			a.onCollisionStart = () => {
				seen.push("a.start");
				adapter.removeBody(a);
			};
			run(3);
			expect(of(seen, "a")).toEqual([
				"a.shapeStart",
				"a.start",
				"a.shapeEnd",
				"a.end",
			]);
			expectBalanced(of(seen, "b"), "b");
			expect(of(seen, "b")).toContain("b.end");
		});

		it("three touching, one removed by the first hook: no pair is left that names a collider long gone", () => {
			const a = cube(100, 100, 0, { gravityScale: 0 });
			const b = cube(120, 100, 0, { gravityScale: 0 });
			const c = cube(80, 100, 0, { gravityScale: 0 });
			const heard = new Map<Renderable, string[]>();
			let removed = false;
			for (const r of [a, b, c]) {
				heard.set(r, []);
				r.onCollisionStart = (_r, other) => {
					heard.get(r)?.push(other === a ? "start a" : "start");
					if (!removed) {
						removed = true;
						world.removeChildNow(a);
					}
				};
				r.onCollisionEnd = (_r, other) => {
					heard.get(r)?.push(other === a ? "end a" : "end");
				};
				r.onCollisionActive = (_r, other) => {
					expect(other).not.toBe(a);
				};
			}
			run(1);
			expectNoStalePair();
			run(3);
			expectNoStalePair();
			for (const r of [b, c]) {
				const events = heard.get(r) as string[];
				// whoever heard of a touching it heard of it leaving, after
				const start = events.indexOf("start a");
				const end = events.indexOf("end a");
				expect(end >= 0).toBe(start >= 0);
				expect(end >= start).toBe(true);
			}
		});

		it("both removed by one hook, and the world goes on", () => {
			const { a, b, seen } = touching();
			const bystander = cube(400, 100, 0, { gravityScale: 0 });
			for (const [name, r] of [
				["a", a],
				["b", b],
			] as const) {
				r.onCollisionStart = () => {
					seen.push(`${name}.start`);
					world.removeChildNow(b);
					world.removeChildNow(a);
				};
			}
			adapter.setVelocity(bystander, new Vector3d(0, 0, 60));
			expect(() => {
				run(60);
			}).not.toThrow();
			expect(seen).not.toContain("a.active");
			// whoever heard the start heard the end, after it
			for (const name of ["a", "b"]) {
				expectBalanced(of(seen, name), name);
				expect(seen.includes(`${name}.end`)).toBe(
					seen.includes(`${name}.start`),
				);
			}
			expect(seen.includes("a.end") || seen.includes("b.end")).toBe(true);
			expect(adapter.world.bodies.len()).toBe(1);
			expect(bystander.depth).toBeCloseTo(60, 0);
			expect(internals().activePairs.size).toBe(0);
			expect(internals().colliderMap.size).toBe(1);
		});

		it("a removal queued with removeChild happens once the frame is over", async () => {
			const { a, seen } = touching();
			a.onCollisionStart = () => {
				seen.push("a.start");
				world.removeChild(a);
			};
			expect(() => {
				run(2);
			}).not.toThrow();
			// removeChild waits for the end of the frame
			await new Promise((resolve) => {
				setTimeout(resolve, 0);
			});
			run(3);
			expectBalanced(of(seen, "b"), "b");
			expect(of(seen, "b").at(-1)).toBe("b.end");
			expect(adapter.world.bodies.len()).toBe(1);
			expect(internals().activePairs.size).toBe(0);
		});
	});

	describe("collision events", () => {
		it("start once, active once a frame whatever the sub-steps, end once, and nothing after", () => {
			fresh({ subSteps: 3 });
			const ground = floor(300);
			const b = cube(400, 250, 0);
			const seen: string[] = [];
			let response: Response | undefined;
			let other: Renderable | undefined;
			b.onCollisionStart = (r, o) => {
				seen.push("start");
				response = r;
				other = o;
			};
			b.onCollisionActive = () => {
				seen.push("active");
			};
			let end: Response | undefined;
			b.onCollisionEnd = (r) => {
				seen.push("end");
				end = r;
			};
			run(60);
			const settled = seen.length;
			run(10);
			expect(seen.slice(settled)).toEqual(new Array(10).fill("active"));
			expect(
				seen.filter((e) => {
					return e === "start";
				}),
			).toHaveLength(1);
			expect(response?.a).toBe(b);
			expect(response?.b).toBe(ground);
			expect(other).toBe(ground);
			// pushed up, off the floor below
			expect(response?.normal.y).toBeCloseTo(-1, 3);
			expect(response?.depth).toBeGreaterThanOrEqual(0);
			adapter.setPosition(b, new Vector3d(400, -500, 0));
			adapter.setVelocity(b, new Vector3d(0, 0, 0));
			run(3);
			expect(seen.at(-1)).toBe("end");
			expect(
				seen.filter((e) => {
					return e === "end";
				}),
			).toHaveLength(1);
			// a zero, not a negative zero
			expect(end?.normal).toEqual({ x: 0, y: 0, z: 0 });
			expect(Object.is(end?.normal.x, 0)).toBe(true);
			expect(end?.depth).toBe(0);
		});

		it("a sensor reports the touch and its end, with no normal, and stops nothing", () => {
			const zone = make(400, 200, 0, {
				type: "static",
				isSensor: true,
				shapes: [new Box3d(0, 0, 0, 200, 40, 200)],
			});
			const b = cube(400, 100, 0);
			const seen: string[] = [];
			let response: Response | undefined;
			zone.onCollisionStart = (r, other) => {
				seen.push("start");
				response = r;
				expect(other).toBe(b);
			};
			zone.onCollisionEnd = () => {
				seen.push("end");
			};
			run(120);
			expect(seen).toEqual(["start", "end"]);
			expect(response?.normal).toEqual({ x: 0, y: 0, z: 0 });
			expect(response?.depth).toBe(0);
			expect(b.pos.y).toBeGreaterThan(400);
		});

		it("a trigger shape among solid ones says so in the shape hook, by its index", () => {
			const trigger = new Sphere(0, -60, 0, 30);
			trigger.isTrigger = true;
			const post = make(400, 300, 0, {
				type: "static",
				shapes: [new Box3d(0, 0, 0, 40, 40, 40), trigger],
			});
			const b = cube(400, 180, 0);
			const contacts: Record<string, unknown>[] = [];
			post.onShapeCollisionStart = (c) => {
				contacts.push(c);
			};
			run(120);
			expect(
				contacts.map((c) => {
					return [c.indexShapeA, c.isTrigger, c.shapeA];
				}),
			).toEqual([
				[1, true, trigger],
				[0, false, expect.any(Box3d)],
			]);
			// it fell through the trigger and stands on the box
			expect(b.pos.y).toBeCloseTo(264, 0);
		});

		it("setSensor at run time lets a resting body through, and back", () => {
			const ground = floor(300);
			const b = cube(400, 250, 0);
			run(120);
			expect(adapter.isGrounded(b)).toBe(true);
			ground.body.setSensor?.();
			// asleep on a floor that is no longer solid: woken to fall
			bodyOf(b).wakeUp();
			run(30);
			expect(b.pos.y).toBeGreaterThan(270);
			adapter.setSensor(ground, false);
			adapter.setPosition(b, new Vector3d(400, 250, 0));
			adapter.setVelocity(b, new Vector3d(0, 0, 0));
			run(120);
			expect(b.pos.y).toBeCloseTo(264, 0);
		});
	});

	describe("collision types and masks, on all 32 bits", () => {
		const ALL = collision.types.ALL_OBJECT;
		const HIGH = 1 << 20;
		const TOP = 1 << 31;
		const cases: [number, number, number, number][] = [
			[1, ALL, 2, ALL],
			[1, 2, 2, 1],
			[1, 4, 2, 1],
			[1, 2, 2, 4],
			[HIGH, ALL, 1, ALL],
			[HIGH, ALL, 1, 0xffff],
			[1, HIGH, HIGH, 1],
			[1, HIGH, HIGH, 2],
			[1, HIGH | 2, 4, ALL],
			[1, HIGH | 2, HIGH, 1],
			[1, HIGH | 2, 2, 1],
			[HIGH, HIGH << 1, HIGH << 1, HIGH],
			[HIGH, HIGH, HIGH << 1, HIGH << 1],
			[TOP, TOP, TOP, TOP],
			[TOP, ALL, 0x8000, 0x8000],
			[0x8000, 0x8000, 0x8000, 0x8000],
			[0, ALL, 1, ALL],
			[1, 0, 1, ALL],
			[HIGH, 0, HIGH, ALL],
		];
		const hex = (n: number) => {
			return `0x${(n >>> 0).toString(16)}`;
		};
		for (const [typeA, maskA, typeB, maskB] of cases) {
			const expected = (maskA & typeB) !== 0 && (maskB & typeA) !== 0;
			it(`${hex(typeA)}/${hex(maskA)} and ${hex(typeB)}/${hex(maskB)} ${expected ? "touch" : "pass through"}`, () => {
				const a = cube(100, 100, 0, {
					gravityScale: 0,
					collisionType: typeA,
					collisionMask: maskA,
				});
				const b = cube(120, 100, 0, { gravityScale: 0 });
				// the other one through the run-time setters
				b.body.collisionType = typeB;
				adapter.setCollisionMask(b, maskB);
				expect(b.body.collisionType).toBe(typeB);
				expect(b.body.collisionMask).toBe(maskB);
				let touched = false;
				a.onCollisionStart = () => {
					touched = true;
				};
				run(3);
				expect(touched).toBe(expected);
				// a solid pair is pushed apart; a filtered one is not
				expect(Math.abs(b.pos.x - a.pos.x) > 20.5).toBe(expected);
			});
		}

		it("a mask changed at run time opens and closes a floor under a body", () => {
			const ground = floor(300, { collisionType: HIGH });
			const b = cube(400, 250, 0, { collisionMask: HIGH });
			run(60);
			expect(b.pos.y).toBeCloseTo(264, 0);
			adapter.setCollisionMask(b, 1);
			bodyOf(b).wakeUp();
			run(30);
			expect(b.pos.y).toBeGreaterThan(270);
			adapter.setCollisionMask(b, HIGH | 1);
			adapter.setPosition(b, new Vector3d(400, 250, 0));
			adapter.setVelocity(b, new Vector3d(0, 0, 0));
			run(60);
			expect(b.pos.y).toBeCloseTo(264, 0);
			void ground;
		});

		it("a shape's own type and mask win over the body's", () => {
			const ghost = new Box3d(0, 0, 0, 32, 32, 32);
			ghost.collisionMask = collision.types.NO_OBJECT;
			const a = make(100, 100, 0, {
				type: "dynamic",
				gravityScale: 0,
				shapes: [ghost],
			});
			const b = cube(120, 100, 0, { gravityScale: 0 });
			let touched = false;
			b.onCollisionStart = () => {
				touched = true;
			};
			run(3);
			expect(touched).toBe(false);
			expect(a.body.collisionMask).toBe(collision.types.NO_OBJECT);
		});
	});

	describe("isGrounded, with Y down", () => {
		it("on a floor, not in the air, not against a wall, not under a ceiling", () => {
			floor(300);
			const standing = cube(400, 250, 0);
			const falling = cube(100, -2000, 0);
			run(120);
			expect(adapter.isGrounded(standing)).toBe(true);
			expect(adapter.isGrounded(falling)).toBe(false);
			expect(adapter.isGrounded(new Renderable(0, 0, 1, 1))).toBe(false);
		});

		it("pressed against a wall is not grounded", () => {
			adapter.gravity.set(0, 0, 0);
			make(200, 100, 0, {
				type: "static",
				shapes: [new Box3d(0, 0, 0, 40, 2000, 2000)],
			});
			const b = cube(150, 100, 0);
			for (let i = 0; i < 60; i++) {
				adapter.applyForce(b, new Vector3d(200, 0, 0));
				run(1);
			}
			expect(b.pos.x).toBeCloseTo(164, 0);
			expect(adapter.isGrounded(b)).toBe(false);
			// nor against one in depth
			adapter.setRotation(b, turn(Y, 0.3));
			expect(adapter.isGrounded(b)).toBe(false);
		});

		it("pressed up against a ceiling is not grounded", () => {
			adapter.gravity.set(0, -320, 0);
			floor(0);
			const b = cube(400, 60, 0);
			run(120);
			expect(b.pos.y).toBeCloseTo(36, 0);
			expect(adapter.isGrounded(b)).toBe(false);
		});

		it("on a slope it can stand on, yes", () => {
			const ramp = make(400, 300, 0, {
				type: "static",
				friction: 1,
				shapes: [new Box3d(0, 0, 0, 600, 40, 600)],
			});
			// a box that keeps upright, so it stands rather than tumbles
			const b = cube(400, 200, 0, { friction: 1, fixedRotation: true });
			// tilted about Z, then in depth, about X
			for (const tilt of [turn(Z, 0.4), turn(X, -0.4)]) {
				adapter.setRotation(ramp, tilt);
				adapter.setRotation(b, tilt);
				adapter.setPosition(b, new Vector3d(400, 200, 0));
				adapter.setVelocity(b, new Vector3d(0, 0, 0));
				run(90);
				expect(adapter.isGrounded(b)).toBe(true);
				// and it is standing there, not sliding off
				expect(adapter.getVelocity3d(b).length()).toBeLessThan(1);
			}
		});

		it("over a sensor, when the sensor is below", () => {
			const below = make(400, 300, 0, {
				type: "static",
				isSensor: true,
				shapes: [new Box3d(0, 0, 0, 200, 40, 200)],
			});
			const b = cube(400, 270, 0, { gravityScale: 0 });
			run(2);
			expect(adapter.isGrounded(b)).toBe(true);
			adapter.setPosition(b, new Vector3d(400, 330, 0));
			run(2);
			expect(adapter.isGrounded(b)).toBe(false);
			void below;
		});
	});

	describe("queries", () => {
		it("raycast3d from inside a body skips it, and finds nothing when nothing else is there", () => {
			const box = cube(400, 300, 0, { gravityScale: 0 });
			run(1);
			expect(
				adapter.raycast3d(new Vector3d(400, 300, 0), new Vector3d(900, 300, 0)),
			).toBeNull();
			// from just outside it, it is hit
			const hit = adapter.raycast3d(
				new Vector3d(300, 300, 0),
				new Vector3d(900, 300, 0),
			);
			expect(hit?.renderable).toBe(box);
			expect(hit?.point.x).toBeCloseTo(384, 1);
			expect(hit?.normal.x).toBeCloseTo(-1, 4);
			// a ray too short to reach it
			expect(
				adapter.raycast3d(new Vector3d(300, 300, 0), new Vector3d(380, 300, 0)),
			).toBeNull();
		});

		it("raycast3d hits a turned body where it is turned to, the nearest first", () => {
			const near = cube(400, 300, 100, { gravityScale: 0 });
			const far = cube(400, 300, 300, { gravityScale: 0 });
			adapter.setRotation(near, turn(Y, Math.PI / 4));
			run(1);
			const hit = adapter.raycast3d(
				new Vector3d(400, 300, -100),
				new Vector3d(400, 300, 500),
			);
			expect(hit?.renderable).toBe(near);
			// its edge points at the ray: half a diagonal from its centre
			expect(hit?.point.z).toBeCloseTo(100 - 16 * Math.SQRT2, 1);
			// and from the other end, the far one
			expect(
				adapter.raycast3d(
					new Vector3d(400, 300, 500),
					new Vector3d(400, 300, -100),
				)?.renderable,
			).toBe(far);
		});

		it("a ray or a sphere that is not a number finds nothing, and throws nothing", () => {
			const b = cube(100, 100, 0, { gravityScale: 0 });
			run(1);
			expect(
				adapter.raycast3d(
					new Vector3d(Number.NaN, 0, 0),
					new Vector3d(100, 100, 0),
				),
			).toBeNull();
			expect(
				adapter.raycast3d(new Vector3d(0, 0, 0), new Vector3d(Infinity, 0, 0)),
			).toBeNull();
			expect(
				adapter.querySphere(new Vector3d(100, 100, 0), Number.NaN),
			).toEqual([]);
			// no radius, none, or less than none: a point
			const at = new Vector3d(100, 100, 0);
			expectFound(adapter.querySphere(at, 0), b);
			expectFound(adapter.querySphere(at, -5), b);
			expectFound(adapter.querySphere(at, undefined), b);
			expectFound(adapter.querySphere(new Vector3d(100, 100, 17), 0));
			// and the world still runs
			run(1);
			expect(b.pos.x).toBe(100);
		});

		it("querySphere tests the exact shape where queryAABB tests its box, each body once", () => {
			const ball = make(100, 100, 0, {
				type: "static",
				shapes: [new Sphere(0, 0, 0, 50), new Sphere(0, 0, 0, 40)],
			});
			run(1);
			// off the corner of its box, outside the ball itself
			expectFound(adapter.querySphere(new Vector3d(140, 140, 40), 5));
			expectFound(adapter.queryAABB(new Rect(138, 138, 4, 4)), ball);
			expectFound(adapter.querySphere(new Vector3d(100, 100, 0), 500), ball);
			expectFound(adapter.queryAABB(new Rect(0, 0, 800, 600)), ball);
			// a rectangle of no size is a point
			expectFound(adapter.queryAABB(new Rect(100, 100, 0, 0)), ball);
			expectFound(adapter.queryAABB(new Rect(151, 100, 0, 0)));
		});

		it("queries on a destroyed adapter find nothing, rather than throw", () => {
			cube(100, 100, 0);
			run(1);
			adapter.destroy();
			expect(
				adapter.raycast3d(new Vector3d(0, 0, 0), new Vector3d(200, 200, 0)),
			).toBeNull();
			expectFound(adapter.querySphere(new Vector3d(100, 100, 0), 50));
			expectFound(adapter.queryAABB(new Rect(0, 0, 800, 600)));
			expect(adapter.isGrounded(new Renderable(0, 0, 1, 1))).toBe(false);
		});
	});

	describe("inputs that are not numbers", () => {
		it("a step of no length, a negative one, NaN or Infinity simulates nothing and breaks nothing", () => {
			const b = cube(100, 100, 0);
			for (const dt of [0, -FRAME_MS, Number.NaN, Infinity, -Infinity]) {
				expect(() => {
					adapter.step(dt);
					adapter.syncFromPhysics();
				}).not.toThrow();
				expect(b.pos.y).toBe(100);
				expect(adapter.getVelocity(b).y).toBe(0);
			}
			run(60);
			expect(b.pos.y).toBeGreaterThan(250);
		});

		it("a velocity or a position that is not a number does not stop the rest of the world", () => {
			const broken = cube(100, 100, 0);
			const lost = cube(300, 100, 0);
			const fine = cube(500, 100, 0);
			expect(() => {
				adapter.setVelocity(broken, new Vector3d(Number.NaN, 0, 0));
				adapter.setPosition(lost, new Vector3d(Infinity, 0, 0));
				adapter.applyImpulse(broken, new Vector3d(0, Number.NaN, 0));
				adapter.applyForce(lost, new Vector3d(Infinity, 0, 0));
				run(60);
			}).not.toThrow();
			expect(fine.pos.y).toBeGreaterThan(250);
			expect(fine.pos.y).toBeLessThan(270);
			expect(fine.pos.x).toBe(500);
			// and they can be taken out
			expect(() => {
				world.removeChildNow(broken);
				world.removeChildNow(lost);
				run(2);
			}).not.toThrow();
			expect(adapter.world.bodies.len()).toBe(1);
		});

		it("refuses options that are not a scale, and floors the sub-steps", () => {
			expect(() => {
				return new Rapier3dAdapter({ pixelsPerMeter: -Infinity });
			}).toThrow(/pixelsPerMeter/);
			fresh({ subSteps: 0.2 });
			const a = cube(100, 0, 0);
			fresh({ subSteps: 2.9 });
			const b = cube(100, 0, 0);
			a.ancestor.update(FRAME_MS);
			run(1);
			// both stepped the frame: one step, and two
			expect(a.pos.y).toBeGreaterThan(0);
			expect(b.pos.y).toBeGreaterThan(0);
			expect(b.pos.y).not.toBe(a.pos.y);
		});
	});

	describe("a renderable with no body", () => {
		it("every call does nothing, or answers as for a body at rest", () => {
			const loose = new Renderable(10, 20, 1, 1);
			const v2 = new Vector2d(1, 2);
			const v3 = new Vector3d(1, 2, 3);
			expect(() => {
				adapter.setVelocity(loose, v3);
				adapter.applyForce(loose, v3, v3);
				adapter.applyImpulse(loose, v2, v2);
				adapter.setAngle(loose, 1);
				adapter.setRotation(loose, turn(X, 1));
				adapter.setAngularVelocity(loose, 3);
				adapter.setAngularVelocity(loose, v3);
				adapter.applyTorque(loose, v3);
				adapter.setStatic(loose, true);
				adapter.setGravityScale(loose, 2);
				adapter.setSensor(loose, true);
				adapter.setFrictionAir(loose, 1);
				adapter.setMaxVelocity(loose, { x: 1, y: 1 });
				adapter.setCollisionType(loose, 2);
				adapter.setCollisionMask(loose, 2);
				adapter.updateShape(loose, []);
				adapter.removeBody(loose);
			}).not.toThrow();
			expect(adapter.getVelocity(loose).equals(new Vector2d(0, 0))).toBe(true);
			expect(adapter.getAngularVelocity(loose)).toBe(0);
			expect(adapter.getMaxVelocity(loose)).toEqual({
				x: Infinity,
				y: Infinity,
				z: Infinity,
			});
			expectFound(adapter.getBodyShapes(loose));
			expect(adapter.isGrounded(loose)).toBe(false);
			// nothing was kept about it
			expect(internals().velocityLimits.size).toBe(0);
			expect(internals().overrides.size).toBe(0);
			expect(loose.currentTransform.isIdentity()).toBe(true);
			// setPosition still places the renderable, as on every adapter
			adapter.setPosition(loose, new Vector3d(7, 8, 9));
			expect([loose.pos.x, loose.pos.y, loose.depth]).toEqual([7, 8, 9]);
			adapter.setPosition(loose, new Vector2d(1, 2));
			expect([loose.pos.x, loose.pos.y, loose.depth]).toEqual([1, 2, 9]);
		});

		it("a handle kept after its body is gone reads as at rest", () => {
			const r = cube(100, 100, 0, { gravityScale: 0 });
			adapter.setVelocity(r, new Vector3d(5, 5, 5));
			const handle = r.body;
			world.removeChildNow(r, true);
			expect(handle.getVelocity().x).toBe(0);
			expect(handle.getVelocity3d?.().z).toBe(0);
			expect(handle.getAngularVelocity?.()).toBe(0);
			expect(handle.getAngle?.()).toBe(0);
			expect(() => {
				handle.setCollisionMask(1);
				handle.setSensor?.(true);
				handle.setStatic(true);
				handle.setGravityScale?.(1);
				handle.setAngle?.(1);
				handle.setAngularVelocity?.(1);
				handle.applyTorque?.(1);
			}).not.toThrow();
		});
	});

	describe("a body made twice, or taken out twice", () => {
		it("a second addBody replaces the first, which is freed", () => {
			const r = cube(100, 100, 0, { gravityScale: 0 });
			const first = bodyOf(r);
			const second = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Sphere(0, 0, 0, 8)],
			});
			expect(second).not.toBe(first);
			expect(first.isValid()).toBe(false);
			expect(r.body).toBe(second);
			expect(adapter.world.bodies.len()).toBe(1);
			expect(adapter.world.colliders.len()).toBe(1);
			expect(internals().colliderMap.size).toBe(1);
		});

		it("an addBody that is refused leaves the body the renderable had", () => {
			const r = cube(100, 100, 0, { gravityScale: 0 });
			const first = bodyOf(r);
			expect(() => {
				adapter.addBody(r, {
					type: "dynamic",
					shapes: [new Rect(0, 0, 1, 1)],
				});
			}).toThrow(/unsupported shape type/);
			expect(first.isValid()).toBe(true);
			expect(r.body).toBe(first);
		});

		it("removeBody twice, and of a renderable never added, is safe", () => {
			const r = cube(100, 100, 0);
			expect(() => {
				adapter.removeBody(r);
				adapter.removeBody(r);
				adapter.removeBody(new Renderable(0, 0, 1, 1));
				run(2);
			}).not.toThrow();
			expect(adapter.world.bodies.len()).toBe(0);
			for (const map of Object.values(internals())) {
				if (map instanceof Map) {
					expect(map.size).toBe(0);
				}
			}
		});
	});

	describe("a body at rest", () => {
		const asleep = () => {
			floor(300);
			const b = cube(400, 250, 0);
			run(240);
			expect(bodyOf(b).isSleeping()).toBe(true);
			return b;
		};

		it("an impulse wakes it, and its renderable follows again", () => {
			const b = asleep();
			adapter.applyImpulse(b, new Vector3d(0, -200, 0));
			expect(bodyOf(b).isSleeping()).toBe(false);
			run(5);
			expect(b.pos.y).toBeLessThan(260);
		});

		it("a velocity, a force and a torque wake it too", () => {
			for (const nudge of [
				(b: Renderable) => {
					adapter.setVelocity(b, new Vector2d(0, -100));
				},
				(b: Renderable) => {
					adapter.applyForce(b, new Vector3d(0, -40000, 0));
				},
				(b: Renderable) => {
					adapter.applyTorque(b, new Vector3d(0, 50, 0));
				},
				(b: Renderable) => {
					adapter.setAngularVelocity(b, 3);
				},
			]) {
				fresh();
				const b = asleep();
				const was = pose(b);
				nudge(b);
				expect(bodyOf(b).isSleeping()).toBe(false);
				run(3);
				const moved =
					Math.abs(b.pos.y - was.y) > 0.5 ||
					alike(adapter.getRotation(b), was.q) < 0.9999;
				expect(moved).toBe(true);
			}
		});

		it("setPosition and setRotation move it and what it draws at once, asleep or static", () => {
			const b = asleep();
			const wall = fixed(100, 100, 0);
			for (const r of [b, wall]) {
				adapter.setPosition(r, new Vector3d(50, 60, 70));
				expect([r.pos.x, r.pos.y, r.depth]).toEqual([50, 60, 70]);
				const t = bodyOf(r).translation();
				expect(t.z * 32).toBeCloseTo(70, 4);
				adapter.setRotation(r, turn(Z, Math.PI / 2));
				// +X drawn pointing down +Y
				expect(r.currentTransform.val[1]).toBeCloseTo(1, 6);
			}
			run(1);
			expect(wall.pos.x).toBe(50);
			expect(wall.currentTransform.val[1]).toBeCloseTo(1, 6);
		});
	});

	describe("destroyed, and used again", () => {
		it("the same adapter, after destroy() and init(), simulates a new world from nothing", () => {
			const old = cube(100, 100, 0);
			adapter.setMaxVelocity(old, { x: 1, y: 1 });
			adapter.setSensor(old, true);
			run(2);
			adapter.destroy();
			for (const record of Object.values(adapter)) {
				if (record instanceof Map || record instanceof Set) {
					expect(record.size).toBe(0);
				}
			}
			adapter.init(world);
			expect(adapter.world.bodies.len()).toBe(0);
			const again = new Renderable(100, 100, 32, 32);
			adapter.addBody(again, {
				type: "dynamic",
				shapes: [new Box3d(0, 0, 0, 32, 32, 32)],
			});
			for (let i = 0; i < 60; i++) {
				adapter.step(FRAME_MS);
				adapter.syncFromPhysics();
			}
			expect(again.pos.y).toBeGreaterThan(250);
			expect(again.pos.y).toBeLessThan(270);
		});

		it("world.setAdapter() to a new one rebuilds the bodies and the joints, and frees the old", () => {
			floor(300);
			const a = fixed(100, 100, 0);
			const b = cube(160, 100, 0);
			const faller = cube(400, 250, 0);
			const joint = world.addJoint({ type: "weld", a, b });
			run(30);
			const old = adapter;
			const oldBody = bodyOf(b);
			const next = new Rapier3dAdapter({ pixelsPerMeter: 64 });
			world.setAdapter(next);
			adapter = next;
			expect(() => {
				old.step(FRAME_MS);
			}).toThrow(/no Rapier world/);
			expect(b.body).not.toBe(oldBody);
			expect(next.world.bodies.len()).toBe(4);
			expect(next.world.impulseJoints.len()).toBe(1);
			expect((joint.native as { isValid(): boolean }).isValid()).toBe(true);
			run(120);
			// welded still, and the cube on the floor still
			expect(b.pos.y).toBeCloseTo(100, 0);
			expect(faller.pos.y).toBeCloseTo(264, 0);
		});

		it("made and destroyed many times over", () => {
			expect(() => {
				for (let i = 0; i < 40; i++) {
					fresh({ subSteps: 2 });
					floor(300);
					const a = cube(400, 250, 0);
					const b = cube(400, 200, 0);
					world.addJoint({ type: "rope", a, b });
					run(3);
					adapter.destroy();
					adapter.destroy();
				}
			}).not.toThrow();
		});
	});

	describe("shapes at their edges", () => {
		it("a triangle mesh gives a dynamic body no mass: it is for static and kinematic bodies", () => {
			const mesh = new TriangleMesh3d([0, 0, 0, 32, 0, 0, 0, 0, 32], [0, 1, 2]);
			const r = make(100, 100, 0, { type: "dynamic", shapes: [mesh] });
			expect(bodyOf(r).mass()).toBe(0);
			// setMass has nothing to scale, and says nothing
			expect(() => {
				r.body.setMass?.(5);
			}).not.toThrow();
			// a kinematic one carries it where it is sent
			const k = make(300, 100, 0, { type: "kinematic", shapes: [mesh] });
			adapter.setVelocity(k, new Vector3d(0, 60, 0));
			run(60);
			expect(k.pos.y).toBeCloseTo(160, 0);
		});

		it("several shapes share one body's mass, and setMass keeps their share", () => {
			const r = make(100, 100, 0, {
				type: "dynamic",
				gravityScale: 0,
				shapes: [
					new Box3d(0, 0, 0, 32, 32, 32),
					new Box3d(64, 0, 0, 32, 32, 32),
				],
			});
			expect(bodyOf(r).mass()).toBeCloseTo(2, 4);
			r.body.setMass?.(10);
			expect(bodyOf(r).mass()).toBeCloseTo(10, 3);
			// the centre of mass is still between the two
			expect(bodyOf(r).localCom().x).toBeCloseTo(1, 4);
		});

		it("a body with no shape at all still moves, and is found by nothing", () => {
			const r = make(100, 100, 0, {
				type: "kinematic",
				shapes: [],
			});
			adapter.setVelocity(r, new Vector3d(60, 0, 0));
			run(60);
			expect(r.pos.x).toBeCloseTo(160, 0);
			expectFound(adapter.queryAABB(new Rect(0, 0, 800, 600)));
			expectFound(adapter.getBodyShapes(r));
		});
	});
});
