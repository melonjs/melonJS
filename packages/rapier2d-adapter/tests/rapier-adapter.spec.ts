/**
 * What the Rapier adapter does that the cross-adapter spec (in the planck
 * package) does not already pin on every backend: loading its WebAssembly,
 * 32-bit collision filtering over Rapier's 16-bit groups, the colliders a
 * shape becomes, forces across sub-steps, sensors, the event lifecycle, and
 * the queries.
 */

import {
	Application,
	type BodyShape,
	Box3d,
	boot,
	collision,
	Ellipse,
	Line,
	Point,
	Polygon,
	Rect,
	Renderable,
	RoundRect,
	Sphere,
	Vector2d,
	video,
	World,
} from "melonjs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { RapierAdapter } from "../src/index";

const FRAME_MS = 1000 / 60;

type XY = { x: number; y: number };
type Hooked = Renderable & {
	onCollisionStart?: (r: Response, other: Renderable) => void;
	onCollisionActive?: (r: Response, other: Renderable) => void;
	onCollisionEnd?: (r: Response, other: Renderable) => void;
};
type Response = { normal: XY; depth: number };

describe("RapierAdapter: before Rapier is loaded", () => {
	it("is not loaded, and the constructor says how to load it", () => {
		expect(RapierAdapter.loaded).toBe(false);
		expect(() => {
			return new RapierAdapter();
		}).toThrow(/RapierAdapter\.create/);
	});

	it("load() returns one shared promise, and create() waits for it", async () => {
		const first = RapierAdapter.load();
		expect(RapierAdapter.load()).toBe(first);
		const adapter = await RapierAdapter.create({ pixelsPerMeter: 64 });
		expect(RapierAdapter.loaded).toBe(true);
		expect(adapter).toBeInstanceOf(RapierAdapter);
		expect(adapter.pixelsPerMeter).toBe(64);
		expect(adapter.physicLabel).toBe("rapier");
	});
});

describe("RapierAdapter", () => {
	let adapter: RapierAdapter;
	let world: World;

	beforeAll(async () => {
		await RapierAdapter.load();
		boot();
		const app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	beforeEach(() => {
		adapter = new RapierAdapter();
		world = new World(0, 0, 800, 600, adapter);
	});

	// anchored at its top-left corner, so `pos` is the corner of its body
	const make = (
		x: number,
		y: number,
		w: number,
		h: number,
		def: Renderable["bodyDef"],
	): Hooked => {
		const r = new Renderable(x, y, w, h) as Hooked;
		r.anchorPoint.set(0, 0);
		r.alwaysUpdate = true;
		r.bodyDef = def;
		world.addChild(r);
		return r;
	};
	const wall = (x: number, y: number, w: number, h: number, extra = {}) => {
		return make(x, y, w, h, {
			type: "static",
			shapes: [new Rect(0, 0, w, h)],
			...extra,
		});
	};
	const box = (x: number, y: number, extra = {}) => {
		return make(x, y, 32, 32, {
			type: "dynamic",
			shapes: [new Rect(0, 0, 32, 32)],
			fixedRotation: true,
			...extra,
		});
	};
	const run = (frames: number) => {
		for (let i = 0; i < frames; i++) {
			world.update(FRAME_MS);
		}
	};

	describe("units", () => {
		it("gravity is in pixels per second²", () => {
			const b = box(100, 0);
			run(60);
			// one second of the default 320 px/s² from rest: about 160px
			expect(b.pos.y).toBeGreaterThan(150);
			expect(b.pos.y).toBeLessThan(170);
		});

		it("velocity is in pixels per second", () => {
			const b = box(100, 100, { gravityScale: 0 });
			adapter.setVelocity(b, new Vector2d(120, 0));
			run(60);
			expect(b.pos.x).toBeCloseTo(220, 0);
			expect(adapter.getVelocity(b).x).toBeCloseTo(120, 3);
		});

		it("maxVelocity caps the speed, in pixels per second", () => {
			const b = box(100, 100, {
				gravityScale: 0,
				maxVelocity: { x: 50, y: 50 },
			});
			adapter.setVelocity(b, new Vector2d(400, 0));
			run(1);
			expect(adapter.getVelocity(b).x).toBeCloseTo(50, 3);
		});
	});

	describe("forces", () => {
		const deltaV = (subSteps: number) => {
			adapter = new RapierAdapter({ subSteps });
			world = new World(0, 0, 800, 600, adapter);
			const b = box(100, 100, { gravityScale: 0 });
			adapter.applyForce(b, new Vector2d(100, 0));
			run(1);
			const v = adapter.getVelocity(b).x;
			// and the force is gone the next frame
			run(1);
			expect(adapter.getVelocity(b).x).toBeCloseTo(v, 6);
			return v;
		};

		it("act for the whole frame, however many sub-steps it has", () => {
			const one = deltaV(1);
			expect(one).toBeGreaterThan(0);
			expect(deltaV(4)).toBeCloseTo(one, 4);
		});

		it("accelerate a body by force / mass, in px/s²", () => {
			// a 32x32 box at density 1 is 1 m², so 1 kg
			const v = deltaV(1);
			expect(v).toBeCloseTo(100 / 60, 2);
		});
	});

	describe("collision filtering, on 32 bits", () => {
		// each case in a world of its own
		const fallsThrough = (floor: object, faller: object) => {
			adapter = new RapierAdapter();
			world = new World(0, 0, 800, 600, adapter);
			wall(0, 300, 800, 20, floor);
			const b = box(384, 200, faller);
			run(90);
			return b.pos.y > 320;
		};

		it("low types and masks filter natively", () => {
			const { PLAYER_OBJECT, ENEMY_OBJECT, WORLD_SHAPE } = collision.types;
			expect(
				fallsThrough(
					{ collisionType: WORLD_SHAPE },
					{ collisionType: PLAYER_OBJECT, collisionMask: ENEMY_OBJECT },
				),
			).toBe(true);
			expect(
				fallsThrough(
					{ collisionType: WORLD_SHAPE },
					{ collisionType: PLAYER_OBJECT, collisionMask: WORLD_SHAPE },
				),
			).toBe(false);
		});

		it("a type from bit 16 up collides only where the masks allow it", () => {
			const HIGH = collision.types.USER << 12;
			expect(fallsThrough({}, { collisionType: HIGH })).toBe(false);
			expect(
				fallsThrough(
					{ collisionMask: collision.types.PLAYER_OBJECT },
					{ collisionType: HIGH },
				),
			).toBe(true);
		});

		it("a mask of high bits only reaches a high type, and nothing else", () => {
			const HIGH = collision.types.USER << 12;
			expect(
				fallsThrough(
					{ collisionType: HIGH },
					{ collisionType: collision.types.PLAYER_OBJECT, collisionMask: HIGH },
				),
			).toBe(false);
			expect(
				fallsThrough(
					{ collisionType: collision.types.WORLD_SHAPE },
					{ collisionType: collision.types.PLAYER_OBJECT, collisionMask: HIGH },
				),
			).toBe(true);
		});

		it("collisionType and collisionMask on the body read and write the filter", () => {
			const b = box(100, 100);
			const body = b.body as RapierAdapter.Body;
			expect(body.collisionType).toBe(collision.types.PLAYER_OBJECT);
			expect(body.collisionMask).toBe(collision.types.ALL_OBJECT);
			body.collisionType = collision.types.ENEMY_OBJECT;
			adapter.setCollisionMask(b, collision.types.WORLD_SHAPE);
			expect(body.collisionType).toBe(collision.types.ENEMY_OBJECT);
			expect(body.collisionMask).toBe(collision.types.WORLD_SHAPE);
		});
	});

	describe("the colliders a shape becomes", () => {
		const shapesOf = (shapes: BodyShape[], type = "static") => {
			const r = make(100, 100, 100, 100, {
				type: type as "static" | "dynamic",
				shapes,
			});
			return adapter.getBodyShapes(r);
		};

		it("a Rect is a box, an Ellipse a circle of the average radius", () => {
			const [rect] = shapesOf([new Rect(0, 0, 40, 20)]);
			expect(rect).toBeInstanceOf(Polygon);
			expect(rect.getBounds().width).toBeCloseTo(40, 3);
			expect(rect.getBounds().height).toBeCloseTo(20, 3);
			const [circle] = shapesOf([new Ellipse(20, 20, 40, 20)]);
			expect(circle).toBeInstanceOf(Ellipse);
			expect((circle as Ellipse).radiusV.x).toBeCloseTo(15, 3);
		});

		it("a Line is an exact segment on a static body, a thin quad on a dynamic one", () => {
			const [segment] = shapesOf([
				new Line(0, 0, [new Vector2d(0, 0), new Vector2d(60, 0)]),
			]);
			expect(segment).toBeInstanceOf(Line);
			const [quad] = shapesOf(
				[new Line(0, 0, [new Vector2d(0, 0), new Vector2d(60, 0)])],
				"dynamic",
			);
			expect(quad).not.toBeInstanceOf(Line);
			expect((quad as Polygon).points.length).toBe(4);
			expect(quad.getBounds().height).toBeCloseTo(2, 3);
		});

		it("a concave Polygon is its triangles, so it is simulated exactly", () => {
			// an L of six points, open at the top right: four triangles
			const l = new Polygon(0, 0, [
				new Vector2d(0, 0),
				new Vector2d(20, 0),
				new Vector2d(20, 40),
				new Vector2d(60, 40),
				new Vector2d(60, 60),
				new Vector2d(0, 60),
			]);
			const shapes = shapesOf([l]);
			expect(shapes.length).toBe(4);
			// a box dropped into the notch of the L comes to rest there,
			// where a hull would have held it up at the top
			const floor = make(300, 300, 60, 60, { type: "static", shapes: [l] });
			const b = make(332, 200, 20, 20, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 20, 20)],
				fixedRotation: true,
			});
			run(120);
			expect(b.pos.y + 20).toBeGreaterThan(floor.pos.y + 35);
		});

		it("a RoundRect keeps all its points, as one convex collider", () => {
			const [round] = shapesOf([new RoundRect(0, 0, 80, 40, 10)]);
			expect((round as Polygon).points.length).toBe(36);
			expect(round.getBounds().width).toBeCloseTo(80, 0);
		});

		it("a Point, a Box3d and a Sphere are refused, with the reason", () => {
			expect(() => {
				shapesOf([new Point(0, 0) as never]);
			}).toThrow(/no area/);
			expect(() => {
				shapesOf([new Box3d(0, 0, 0, 10, 10, 10)]);
			}).toThrow(/builtin adapter/);
			expect(() => {
				shapesOf([new Sphere(0, 0, 0, 10)]);
			}).toThrow(/builtin adapter/);
		});

		it("shapes are reported at the body's current pose", () => {
			const r = make(100, 100, 40, 40, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 40, 40)],
				gravityScale: 0,
			});
			adapter.setAngle(r, Math.PI / 4);
			run(1);
			const [shape] = adapter.getBodyShapes(r);
			// a 40px square on its corner is 40·√2 wide
			expect(shape.getBounds().width).toBeCloseTo(40 * Math.SQRT2, 1);
		});
	});

	describe("collision events", () => {
		it("start once, active while touching, end once, with normal and depth", () => {
			wall(0, 300, 800, 20);
			const b = box(384, 200);
			const log: string[] = [];
			let landing: Response | undefined;
			b.onCollisionStart = (r) => {
				log.push("start");
				landing = { normal: { ...r.normal }, depth: r.depth };
			};
			b.onCollisionActive = () => {
				if (log.at(-1) !== "active") log.push("active");
			};
			b.onCollisionEnd = () => {
				log.push("end");
			};
			run(90);
			expect(landing?.normal.y).toBeCloseTo(-1, 3);
			expect(landing?.depth).toBeGreaterThanOrEqual(0);
			adapter.setVelocity(b, new Vector2d(0, -600));
			run(10);
			expect(log).toEqual(["start", "active", "end"]);
		});

		it("a partner hears the end when the other body is removed", () => {
			const floor = wall(0, 300, 800, 20);
			const b = box(384, 200);
			let ended = 0;
			b.onCollisionEnd = () => {
				ended++;
			};
			run(90);
			world.removeChildNow(floor);
			expect(ended).toBe(1);
			run(5);
			expect(ended).toBe(1);
		});

		it("a sensor reports contacts, pushes nothing, and has no normal", () => {
			const zone = wall(300, 250, 200, 100, { isSensor: true });
			const b = box(384, 100);
			let response: Response | undefined;
			b.onCollisionStart = (r) => {
				response = { normal: { ...r.normal }, depth: r.depth };
			};
			run(120);
			expect(response).toEqual({ normal: { x: 0, y: 0 }, depth: 0 });
			// fell through the zone
			expect(b.pos.y).toBeGreaterThan(zone.pos.y + 100);
		});
	});

	describe("isGrounded", () => {
		it("on a floor, not in the air, not against a wall", () => {
			wall(0, 300, 800, 20);
			wall(500, 0, 20, 300);
			const b = box(200, 100);
			expect(adapter.isGrounded(b)).toBe(false);
			run(90);
			expect(adapter.isGrounded(b)).toBe(true);
			// pushed against the wall, off the floor
			const side = box(470, 50, { gravityScale: 0 });
			adapter.setVelocity(side, new Vector2d(300, 0));
			run(10);
			expect(adapter.isGrounded(side)).toBe(false);
		});

		it("on a sensor, when the sensor's centre is below", () => {
			wall(0, 300, 800, 40, { isSensor: true });
			const b = box(200, 290, { gravityScale: 0 });
			run(1);
			expect(adapter.isGrounded(b)).toBe(true);
		});
	});

	describe("queries", () => {
		it("raycast finds the first body, its surface and normal", () => {
			const target = wall(400, 280, 40, 40);
			run(1);
			const hit = adapter.raycast(
				new Vector2d(100, 300),
				new Vector2d(700, 300),
			);
			expect(hit?.renderable).toBe(target);
			expect(hit?.point.x).toBeCloseTo(400, 1);
			expect(hit?.normal.x).toBeCloseTo(-1, 3);
			expect(hit?.fraction).toBeCloseTo(0.5, 2);
		});

		it("raycast skips a body the ray starts inside", () => {
			const self = wall(80, 280, 40, 40);
			const target = wall(400, 280, 40, 40);
			run(1);
			const hit = adapter.raycast(
				new Vector2d(100, 300),
				new Vector2d(700, 300),
			);
			expect(hit?.renderable).not.toBe(self);
			expect(hit?.renderable).toBe(target);
		});

		it("queryAABB returns each body overlapping the rectangle once", () => {
			const a = make(100, 100, 40, 40, {
				type: "static",
				shapes: [new Rect(0, 0, 20, 40), new Rect(20, 0, 20, 40)],
			});
			wall(600, 100, 40, 40);
			run(1);
			expect(adapter.queryAABB(new Rect(90, 90, 100, 100))).toEqual([a]);
		});
	});

	describe("body changes", () => {
		it("a kinematic body ignores gravity and moves by its velocity", () => {
			const k = make(100, 100, 32, 32, {
				type: "kinematic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			adapter.setVelocity(k, new Vector2d(60, 0));
			run(60);
			expect(k.pos.y).toBeCloseTo(100, 3);
			expect(k.pos.x).toBeCloseTo(160, 0);
		});

		it("setStatic stops a body, and lets it go again", () => {
			const b = box(100, 100);
			adapter.setStatic(b, true);
			run(30);
			expect(b.pos.y).toBeCloseTo(100, 3);
			adapter.setStatic(b, false);
			run(30);
			expect(b.pos.y).toBeGreaterThan(110);
		});

		it("updateShape rebuilds the body and keeps its velocity", () => {
			const b = box(100, 100, { gravityScale: 0 });
			adapter.setVelocity(b, new Vector2d(90, 0));
			adapter.updateShape(b, [new Rect(0, 0, 32, 64)]);
			expect(adapter.getVelocity(b).x).toBeCloseTo(90, 3);
			expect(adapter.getBodyShapes(b)[0].getBounds().height).toBeCloseTo(64, 3);
		});

		it("a body rotates unless fixedRotation is set", () => {
			const free = box(100, 100, { gravityScale: 0, fixedRotation: false });
			const fixed = box(300, 100, { gravityScale: 0 });
			for (const r of [free, fixed]) {
				adapter.applyTorque(r, 5);
			}
			run(10);
			expect(Math.abs(adapter.getAngle(free))).toBeGreaterThan(0.01);
			expect(adapter.getAngle(fixed)).toBeCloseTo(0, 6);
		});

		it("setMass changes the mass, so the same impulse moves it less", () => {
			const light = box(100, 100, { gravityScale: 0 });
			const heavy = box(300, 100, { gravityScale: 0 });
			(heavy.body as RapierAdapter.Body).setMass?.(4);
			for (const r of [light, heavy]) {
				adapter.applyImpulse(r, new Vector2d(40, 0));
			}
			expect(adapter.getVelocity(heavy).x).toBeCloseTo(
				adapter.getVelocity(light).x / 4,
				3,
			);
		});
	});

	it("destroy() frees Rapier's world, and init() builds a new one", () => {
		box(100, 100);
		const first = adapter.world;
		adapter.destroy();
		adapter.init(world);
		expect(adapter.world).not.toBe(first);
		expect(adapter.world.bodies.len()).toBe(0);
	});
});
