/**
 * The adapter interface after its 3D additions, checked by the compiler
 * (`pnpm -F melonjs test:types` type-checks this file): an adapter written
 * against the 2D interface, taking `Vector2d` only and knowing nothing of
 * `Quaternion` or the 3D readers, still implements `PhysicsAdapter`; and a 3D
 * one may narrow nothing and add the optional members.
 */

import { describe, expect, it } from "vitest";
import {
	type AdapterCapabilities,
	type BodyDefinition,
	type BodyShape,
	type Bounds,
	Capsule3d,
	ConvexHull3d,
	type PhysicsAdapter,
	type PhysicsBody,
	Quaternion,
	type Rect,
	Renderable,
	TriangleMesh3d,
	Vector2d,
	Vector3d,
} from "../src/index.js";

/** a body handle as a 2D adapter had it: no `z` anywhere */
class Body2d implements PhysicsBody {
	collisionType = 0;
	collisionMask = 0;
	vel = new Vector2d();
	setVelocity(x: number, y: number): void {
		this.vel.set(x, y);
	}
	getVelocity(out: Vector2d = new Vector2d()): Vector2d {
		return out.copy(this.vel);
	}
	applyForce(_x: number, _y: number): void {}
	applyImpulse(x: number, y: number): void {
		this.vel.set(this.vel.x + x, this.vel.y + y);
	}
	setStatic(): void {}
	setCollisionMask(mask: number): void {
		this.collisionMask = mask;
	}
}

/**
 * A 2D adapter exactly as one was written before the interface took a
 * `Vector3d`: every vector parameter is a `Vector2d`, `gravity` is a
 * `Vector2d`, `capabilities` has no `bodies3d`, angular velocity is a number.
 */
class Adapter2d implements PhysicsAdapter {
	readonly capabilities: AdapterCapabilities = {
		constraints: false,
		continuousCollisionDetection: false,
		sleepingBodies: false,
		raycasts: false,
		raycasts3d: false,
		velocityLimit: false,
		isGrounded: false,
	};
	gravity = new Vector2d(0, 1);
	bodies = new Map<Renderable, Body2d>();
	omega = 0;

	private of(renderable: Renderable): Body2d {
		const body = this.bodies.get(renderable);
		if (body === undefined) {
			throw new Error("no body");
		}
		return body;
	}
	step(): void {}
	syncFromPhysics(): void {}
	addBody(renderable: Renderable, _def: BodyDefinition): PhysicsBody {
		const body = new Body2d();
		this.bodies.set(renderable, body);
		return body;
	}
	removeBody(renderable: Renderable): void {
		this.bodies.delete(renderable);
	}
	getVelocity(renderable: Renderable, out?: Vector2d): Vector2d {
		return this.of(renderable).getVelocity(out);
	}
	setVelocity(renderable: Renderable, v: Vector2d): void {
		this.of(renderable).setVelocity(v.x, v.y);
	}
	applyForce(_renderable: Renderable, _force: Vector2d, _point?: Vector2d) {}
	applyImpulse(renderable: Renderable, impulse: Vector2d): void {
		this.of(renderable).applyImpulse(impulse.x, impulse.y);
	}
	setPosition(renderable: Renderable, p: Vector2d): void {
		renderable.pos.x = p.x;
		renderable.pos.y = p.y;
	}
	setAngularVelocity(_renderable: Renderable, omega: number): void {
		this.omega = omega;
	}
	setStatic(): void {}
	setGravityScale(): void {}
	setFrictionAir(): void {}
	setMaxVelocity(): void {}
	setCollisionType(): void {}
	setCollisionMask(): void {}
	queryAABB(_rect: Rect): Renderable[] {
		return [];
	}
	getBodyAABB(_renderable: Renderable, out: Bounds): Bounds | undefined {
		return out;
	}
	getBodyShapes(): readonly BodyShape[] {
		return [];
	}
}

describe("PhysicsAdapter, as a 2D adapter implements it", () => {
	it("an adapter that only knows Vector2d is still a PhysicsAdapter", () => {
		const adapter: PhysicsAdapter = new Adapter2d();
		const r = new Renderable(0, 0, 8, 8);
		const body = adapter.addBody(r, { type: "dynamic", shapes: [] });

		// the calls a 2D game makes
		adapter.setVelocity(r, new Vector2d(3, 4));
		adapter.applyImpulse(r, new Vector2d(1, 1));
		adapter.setPosition(r, new Vector2d(5, 6));
		expect(adapter.getVelocity(r).x).toBe(4);
		expect(r.pos.x).toBe(5);

		// portable 3D code on it: a Vector3d's x and y are read, z is not,
		// and every 3D reader is absent rather than wrong
		adapter.setVelocity(r, new Vector3d(7, 8, 9));
		const v = adapter.getVelocity(r);
		expect([v.x, v.y]).toEqual([7, 8]);
		expect(adapter.capabilities.bodies3d).toBeUndefined();
		expect(adapter.getVelocity3d?.(r)).toBeUndefined();
		expect(adapter.getRotation?.(r)).toBeUndefined();
		expect(adapter.getAngularVelocity3d?.(r)).toBeUndefined();
		expect(adapter.setRotation?.(r, new Quaternion())).toBeUndefined();
		const fallback = adapter.getVelocity3d?.(r) ?? new Vector3d();
		expect(fallback.z).toBe(0);

		// the handle: two arguments as before, a third ignored
		body.setVelocity(1, 2);
		body.setVelocity(1, 2, 3);
		body.applyImpulse(1, 1, 1);
		expect(body.getVelocity3d?.()).toBeUndefined();
		expect(body.getVelocity().y).toBe(3);
	});

	it("gravity reads as a vector with x and y on either kind", () => {
		const adapter: PhysicsAdapter = new Adapter2d();
		// what a 2D game does with it compiles and runs unchanged
		adapter.gravity.set(0, 9);
		adapter.gravity.y += 1;
		expect(adapter.gravity.y).toBe(10);
		// and a Vector3d may be given to an adapter that takes one
		adapter.gravity = new Vector3d(0, 1, 2);
		expect("z" in adapter.gravity ? adapter.gravity.z : 0).toBe(2);
	});

	it("the 3D shapes are body shapes, in a definition anyone can write", () => {
		const shapes: BodyShape[] = [
			new Capsule3d(0, 0, 0, 5, 40),
			new ConvexHull3d([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]),
			new TriangleMesh3d([0, 0, 0, 1, 0, 0, 0, 1, 0]),
		];
		const def: BodyDefinition = { type: "static", shapes };
		expect(def.shapes.length).toBe(3);
		// each one narrows by its type tag, with its own members
		for (const shape of shapes) {
			if (shape instanceof Capsule3d) {
				expect(shape.halfSegment).toBe(15);
			} else if (shape instanceof TriangleMesh3d) {
				expect(shape.triangleCount).toBe(1);
			} else if (shape instanceof ConvexHull3d) {
				expect(shape.points.length).toBe(12);
			}
		}
	});
});
