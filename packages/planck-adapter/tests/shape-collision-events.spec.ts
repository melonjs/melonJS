/**
 * Shape-level collision events (melonjs#1596) on this adapter.
 *
 * The engine's builtin detector enumerates every overlapping SHAPE pair and
 * dispatches `onShapeCollisionStart` / `onShapeCollisionActive` /
 * `onShapeCollisionEnd`. This backend maps one melonJS shape onto one native
 * collider, and the native engine already reports contacts per collider pair,
 * so the enumeration is what it reports natively rather than something layered
 * on top.
 */
import {
	Application,
	boot,
	Rect,
	Renderable,
	Vector2d,
	video,
	World,
} from "melonjs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PlanckAdapter } from "../src/index";

interface Contact {
	shapeA: unknown;
	shapeB: unknown;
	indexShapeA: number;
	indexShapeB: number;
	isTrigger: boolean;
	depth: number;
	normal: { x: number; y: number };
}

describe("PlanckAdapter — shape-level collision events", () => {
	let adapter: PlanckAdapter;

	beforeAll(async () => {
		boot();
		const app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	beforeEach(() => {
		adapter = new PlanckAdapter({ gravity: { x: 0, y: 320 } });
		new World(0, 0, 800, 600, adapter);
	});

	/** settle the simulation for a while */
	const run = (steps = 120) => {
		for (let i = 0; i < steps; i++) {
			adapter.step(16.6667);
			adapter.syncFromPhysics();
		}
	};

	it("reports contacts for a MULTI-shape body, at both levels", () => {
		// Regression: a compound body used to receive no collision events at
		// all on the matter backend, because collisions are reported between
		// compound PARTS and only the parent was registered.
		const pairLevel: string[] = [];
		const shapeLevel: string[] = [];
		class Probe extends Renderable {
			label = "";
			onCollisionStart() {
				pairLevel.push(this.label);
			}
			onShapeCollisionStart(c: Contact) {
				shapeLevel.push(`${this.label}:${c.indexShapeA}->${c.indexShapeB}`);
			}
		}
		const floor = new Probe(100, 200, 400, 20);
		floor.label = "floor";
		adapter.addBody(floor, {
			type: "static",
			shapes: [new Rect(0, 0, 200, 20), new Rect(200, 0, 200, 20)],
		});
		const ball = new Probe(160, 150, 64, 32);
		ball.label = "ball";
		adapter.addBody(ball, {
			type: "dynamic",
			shapes: [new Rect(0, 0, 32, 32), new Rect(32, 0, 32, 32)],
		});
		run();

		expect(pairLevel).toContain("floor");
		expect(pairLevel).toContain("ball");
		// and at least one shape pair was named
		expect(shapeLevel.length).toBeGreaterThan(0);
	});

	it("is receiver-symmetric: shapeA is always your own", () => {
		// collected into arrays rather than nullable locals: TypeScript narrows
		// a `let x: T | null = null` back to `null` when the only assignments
		// live in a class method, so the non-null branch types as `never`
		const fromFloor: Contact[] = [];
		const fromBall: Contact[] = [];
		class Floor extends Renderable {
			onShapeCollisionStart(c: Contact) {
				fromFloor.push({ ...c });
			}
		}
		class Ball extends Renderable {
			onShapeCollisionStart(c: Contact) {
				fromBall.push({ ...c });
			}
		}
		const floor = new Floor(100, 200, 400, 20);
		adapter.addBody(floor, {
			type: "static",
			shapes: [new Rect(0, 0, 400, 20)],
		});
		const ball = new Ball(160, 150, 32, 32);
		adapter.addBody(ball, {
			type: "dynamic",
			shapes: [new Rect(0, 0, 32, 32)],
		});
		run();

		expect(fromFloor.length).toBeGreaterThan(0);
		expect(fromBall.length).toBeGreaterThan(0);
		// each side sees its OWN shape as shapeA, and opposing normals
		expect(fromFloor[0].shapeA).not.toBe(fromBall[0].shapeA);
		expect(fromFloor[0].normal.y).toBeCloseTo(-fromBall[0].normal.y, 5);
	});

	it("flags a contact through a trigger shape", () => {
		const seen: boolean[] = [];
		const trigger = Object.assign(new Rect(0, 0, 400, 20), {
			isTrigger: true,
		});
		class Floor extends Renderable {
			onShapeCollisionStart(c: Contact) {
				seen.push(c.isTrigger);
			}
		}
		const floor = new Floor(100, 200, 400, 20);
		adapter.addBody(floor, { type: "static", shapes: [trigger] });
		const ball = new Renderable(160, 150, 32, 32);
		adapter.addBody(ball, {
			type: "dynamic",
			shapes: [new Rect(0, 0, 32, 32)],
		});
		run();

		expect(seen.length).toBeGreaterThan(0);
		expect(seen.every((t) => t === true)).toBe(true);
	});

	it("costs nothing when nobody subscribes", () => {
		// no handler declared anywhere: stepping must stay clean
		const floor = new Renderable(100, 200, 400, 20);
		adapter.addBody(floor, {
			type: "static",
			shapes: [new Rect(0, 0, 400, 20)],
		});
		const ball = new Renderable(160, 150, 32, 32);
		adapter.addBody(ball, {
			type: "dynamic",
			shapes: [new Rect(0, 0, 32, 32)],
		});
		expect(() => {
			run();
		}).not.toThrow();
	});

	it("fires End when the bodies separate", () => {
		const ended: number[] = [];
		class Probe extends Renderable {
			onShapeCollisionEnd(c: Contact) {
				ended.push(c.depth);
			}
		}
		const floor = new Probe(100, 200, 400, 20);
		adapter.addBody(floor, {
			type: "static",
			shapes: [new Rect(0, 0, 400, 20)],
		});
		const ball = new Probe(160, 150, 32, 32);
		const body = adapter.addBody(ball, {
			type: "dynamic",
			shapes: [new Rect(0, 0, 32, 32)],
		});
		run(60);
		// Lift it clear of the floor. Deliberately a short hop rather than a
		// teleport across the world: a large displacement mid-step sends
		// planck's continuous-collision solver through an unpopulated sweep
		// and it throws inside TimeOfImpact, which is a physics-engine
		// limitation and not what this test is about.
		adapter.setPosition(ball, new Vector2d(160, 60));
		void body;
		run(20);

		expect(ended.length).toBeGreaterThan(0);
		// a separated contact carries identity only
		expect(ended.every((d) => d === 0)).toBe(true);
	});
});
