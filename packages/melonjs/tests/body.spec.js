import { beforeEach, describe, expect, it } from "vitest";
import {
	Body,
	collision,
	Ellipse,
	Polygon,
	Rect,
	Renderable,
} from "../src/index.js";

describe("Physics : Body", () => {
	describe("Constructor", () => {
		it("should create a body with a Rect shape", () => {
			const parent = new Renderable(0, 0, 32, 64);
			const shape = new Rect(0, 0, 32, 64);
			const body = new Body(parent, shape);
			expect(body.shapes.length).toEqual(1);
			expect(body.ancestor).toEqual(parent);
		});

		it("should create a body with an Ellipse shape", () => {
			const parent = new Renderable(0, 0, 32, 64);
			const shape = new Ellipse(16, 32, 32, 64);
			const body = new Body(parent, shape);
			expect(body.shapes.length).toEqual(1);
		});

		it("should create a body with a Polygon shape", () => {
			const parent = new Renderable(0, 0, 32, 64);
			const shape = new Polygon(0, 0, [
				{ x: 0, y: 0 },
				{ x: 32, y: 0 },
				{ x: 32, y: 64 },
				{ x: 0, y: 64 },
			]);
			const body = new Body(parent, shape);
			expect(body.shapes.length).toEqual(1);
		});

		it("should create a body with an array of shapes", () => {
			const parent = new Renderable(0, 0, 64, 64);
			const shapes = [new Rect(0, 0, 32, 32), new Rect(32, 0, 32, 32)];
			const body = new Body(parent, shapes);
			expect(body.shapes.length).toEqual(2);
		});

		it("should create a body with no initial shape", () => {
			const parent = new Renderable(0, 0, 32, 64);
			const body = new Body(parent);
			expect(body.shapes.length).toEqual(0);
		});

		it("should have correct default property values", () => {
			const parent = new Renderable(0, 0, 32, 64);
			const body = new Body(parent);
			expect(body.vel.x).toEqual(0);
			expect(body.vel.y).toEqual(0);
			expect(body.force.x).toEqual(0);
			expect(body.force.y).toEqual(0);
			expect(body.friction.x).toEqual(0);
			expect(body.friction.y).toEqual(0);
			expect(body.mass).toEqual(1);
			expect(body.bounce).toEqual(0);
			expect(body.gravityScale).toEqual(1.0);
			expect(body.ignoreGravity).toEqual(false);
			expect(body.isStatic).toEqual(false);
			expect(body.falling).toEqual(false);
			expect(body.jumping).toEqual(false);
			expect(body.maxVel.x).toEqual(490);
			expect(body.maxVel.y).toEqual(490);
		});

		it("should set ancestor.isKinematic to false", () => {
			const parent = new Renderable(0, 0, 32, 64);
			parent.isKinematic = true;
			// eslint-disable-next-line no-new
			new Body(parent);
			expect(parent.isKinematic).toEqual(false);
		});

		it("should set the onBodyUpdate callback when provided", () => {
			const parent = new Renderable(0, 0, 32, 64);
			let callbackCalled = false;
			const callback = () => {
				callbackCalled = true;
			};
			// eslint-disable-next-line no-new
			new Body(parent, new Rect(0, 0, 10, 10), callback);
			expect(callbackCalled).toEqual(true);
		});
	});

	describe("addShape / removeShape / removeShapeAt / getShape", () => {
		let parent;
		let body;

		beforeEach(() => {
			parent = new Renderable(0, 0, 64, 64);
			body = new Body(parent);
		});

		it("addShape should add a Rect and return the new length", () => {
			const result = body.addShape(new Rect(0, 0, 32, 32));
			expect(result).toEqual(1);
			expect(body.shapes.length).toEqual(1);
		});

		it("addShape should add an Ellipse and return the new length", () => {
			const result = body.addShape(new Ellipse(16, 16, 32, 32));
			expect(result).toEqual(1);
			expect(body.shapes.length).toEqual(1);
		});

		it("addShape should add a Polygon and return the new length", () => {
			const poly = new Polygon(0, 0, [
				{ x: 0, y: 0 },
				{ x: 32, y: 0 },
				{ x: 16, y: 32 },
			]);
			const result = body.addShape(poly);
			expect(result).toEqual(1);
		});

		it("addShape should add multiple shapes", () => {
			body.addShape(new Rect(0, 0, 16, 16));
			body.addShape(new Rect(16, 0, 16, 16));
			body.addShape(new Rect(0, 16, 16, 16));
			expect(body.shapes.length).toEqual(3);
		});

		it("getShape should return the shape at the given index", () => {
			const poly = new Polygon(0, 0, [
				{ x: 0, y: 0 },
				{ x: 32, y: 0 },
				{ x: 32, y: 32 },
				{ x: 0, y: 32 },
			]);
			body.addShape(new Rect(0, 0, 16, 16));
			body.addShape(poly);
			expect(body.getShape(1)).toEqual(poly);
		});

		it("getShape with no argument should return the first shape", () => {
			body.addShape(new Rect(0, 0, 16, 16));
			body.addShape(new Rect(16, 0, 16, 16));
			const shape = body.getShape();
			expect(shape).toEqual(body.shapes[0]);
		});

		it("removeShapeAt should remove shape at the given index", () => {
			body.addShape(new Rect(0, 0, 16, 16));
			body.addShape(new Rect(16, 0, 16, 16));
			expect(body.shapes.length).toEqual(2);
			const remaining = body.removeShapeAt(1);
			expect(remaining).toEqual(1);
			expect(body.shapes.length).toEqual(1);
		});

		it("removeShape should remove a specific shape instance", () => {
			const poly = new Polygon(0, 0, [
				{ x: 0, y: 0 },
				{ x: 20, y: 0 },
				{ x: 20, y: 20 },
				{ x: 0, y: 20 },
			]);
			body.addShape(new Rect(0, 0, 16, 16));
			body.addShape(poly);
			expect(body.shapes.length).toEqual(2);
			const remaining = body.removeShape(poly);
			expect(remaining).toEqual(1);
		});

		it("removeShapeAt should update the bounds", () => {
			body.addShape(new Rect(0, 0, 16, 16));
			const boundsWithOne = body.getBounds();
			expect(boundsWithOne.width).toEqual(16);
			expect(boundsWithOne.height).toEqual(16);

			body.addShape(new Rect(0, 0, 32, 32));
			const boundsWithTwo = body.getBounds();
			expect(boundsWithTwo.width).toEqual(32);
			expect(boundsWithTwo.height).toEqual(32);

			body.removeShapeAt(1);
			const boundsAfter = body.getBounds();
			expect(boundsAfter.width).toEqual(16);
			expect(boundsAfter.height).toEqual(16);
		});
	});

	describe("getBounds", () => {
		it("should return correct bounds for a single Rect shape", () => {
			const parent = new Renderable(0, 0, 32, 64);
			const shape = new Rect(10, 10, 32, 64);
			const body = new Body(parent, shape);
			const bounds = body.getBounds();
			expect(bounds.left).toEqual(10);
			expect(bounds.top).toEqual(10);
			expect(bounds.width).toEqual(32);
			expect(bounds.height).toEqual(64);
		});

		it("should return correct bounds for a single Ellipse shape", () => {
			const parent = new Renderable(0, 0, 32, 32);
			const shape = new Ellipse(16, 16, 32, 32);
			const body = new Body(parent, shape);
			const bounds = body.getBounds();
			expect(bounds.width).toEqual(32);
			expect(bounds.height).toEqual(32);
		});

		it("should return correct bounds after adding multiple shapes", () => {
			const parent = new Renderable(0, 0, 64, 64);
			const body = new Body(parent);
			body.addShape(new Rect(0, 0, 20, 20));
			body.addShape(new Rect(0, 0, 50, 50));
			const bounds = body.getBounds();
			expect(bounds.left).toEqual(0);
			expect(bounds.top).toEqual(0);
			expect(bounds.width).toEqual(50);
			expect(bounds.height).toEqual(50);
		});

		it("should recalculate bounds after removing a shape", () => {
			const parent = new Renderable(0, 0, 64, 64);
			const body = new Body(parent);
			body.addShape(new Rect(0, 0, 10, 10));
			body.addShape(new Rect(0, 0, 60, 60));
			expect(body.getBounds().width).toEqual(60);
			body.removeShapeAt(1);
			expect(body.getBounds().width).toEqual(10);
		});
	});

	describe("setStatic", () => {
		it("should set the body as static when called with no arguments", () => {
			const parent = new Renderable(0, 0, 32, 64);
			const body = new Body(parent);
			body.setStatic();
			expect(body.isStatic).toEqual(true);
		});

		it("should set the body as static when called with true", () => {
			const parent = new Renderable(0, 0, 32, 64);
			const body = new Body(parent);
			body.setStatic(true);
			expect(body.isStatic).toEqual(true);
		});

		it("should set the body as non-static when called with false", () => {
			const parent = new Renderable(0, 0, 32, 64);
			const body = new Body(parent);
			body.setStatic(true);
			expect(body.isStatic).toEqual(true);
			body.setStatic(false);
			expect(body.isStatic).toEqual(false);
		});
	});

	describe("setMaxVelocity", () => {
		it("should set the maximum velocity", () => {
			const parent = new Renderable(0, 0, 32, 64);
			const body = new Body(parent);
			body.setMaxVelocity(100, 200);
			expect(body.maxVel.x).toEqual(100);
			expect(body.maxVel.y).toEqual(200);
		});

		it("should override the default max velocity", () => {
			const parent = new Renderable(0, 0, 32, 64);
			const body = new Body(parent);
			expect(body.maxVel.x).toEqual(490);
			expect(body.maxVel.y).toEqual(490);
			body.setMaxVelocity(5, 15);
			expect(body.maxVel.x).toEqual(5);
			expect(body.maxVel.y).toEqual(15);
		});
	});

	describe("setFriction", () => {
		it("should set the friction values", () => {
			const parent = new Renderable(0, 0, 32, 64);
			const body = new Body(parent);
			body.setFriction(0.5, 0.3);
			expect(body.friction.x).toEqual(0.5);
			expect(body.friction.y).toEqual(0.3);
		});

		it("should default to 0 when called with no arguments", () => {
			const parent = new Renderable(0, 0, 32, 64);
			const body = new Body(parent);
			body.setFriction(0.5, 0.3);
			body.setFriction();
			expect(body.friction.x).toEqual(0);
			expect(body.friction.y).toEqual(0);
		});
	});

	describe("setCollisionMask", () => {
		it("should default to ALL_OBJECT", () => {
			const parent = new Renderable(0, 0, 32, 64);
			const body = new Body(parent);
			expect(body.collisionMask).toEqual(collision.types.ALL_OBJECT);
		});

		it("should set a custom collision mask", () => {
			const parent = new Renderable(0, 0, 32, 64);
			const body = new Body(parent);
			body.setCollisionMask(
				collision.types.PLAYER_OBJECT | collision.types.ENEMY_OBJECT,
			);
			expect(body.collisionMask).toEqual(
				collision.types.PLAYER_OBJECT | collision.types.ENEMY_OBJECT,
			);
		});

		it("should reset to ALL_OBJECT when called with no arguments", () => {
			const parent = new Renderable(0, 0, 32, 64);
			const body = new Body(parent);
			body.setCollisionMask(collision.types.NO_OBJECT);
			expect(body.collisionMask).toEqual(collision.types.NO_OBJECT);
			body.setCollisionMask();
			expect(body.collisionMask).toEqual(collision.types.ALL_OBJECT);
		});

		it("should set NO_OBJECT mask to disable collisions", () => {
			const parent = new Renderable(0, 0, 32, 64);
			const body = new Body(parent);
			body.setCollisionMask(collision.types.NO_OBJECT);
			expect(body.collisionMask).toEqual(collision.types.NO_OBJECT);
		});
	});

	describe("setCollisionType", () => {
		it("should default to ENEMY_OBJECT", () => {
			const parent = new Renderable(0, 0, 32, 64);
			const body = new Body(parent);
			expect(body.collisionType).toEqual(collision.types.ENEMY_OBJECT);
		});

		it("should set a collision type by key name", () => {
			const parent = new Renderable(0, 0, 32, 64);
			const body = new Body(parent);
			body.setCollisionType("PLAYER_OBJECT");
			expect(body.collisionType).toEqual(collision.types.PLAYER_OBJECT);
		});

		it("should set collision type directly via property", () => {
			const parent = new Renderable(0, 0, 32, 64);
			const body = new Body(parent);
			body.collisionType = collision.types.PLAYER_OBJECT;
			expect(body.collisionType).toEqual(collision.types.PLAYER_OBJECT);
		});

		it("should set a collision type by numeric value", () => {
			const parent = new Renderable(0, 0, 32, 64);
			const body = new Body(parent);
			body.setCollisionType(collision.types.PLAYER_OBJECT);
			expect(body.collisionType).toEqual(collision.types.PLAYER_OBJECT);
		});

		it("should throw for an invalid type", () => {
			const parent = new Renderable(0, 0, 32, 64);
			const body = new Body(parent);
			expect(() => {
				return body.setCollisionType("INVALID_TYPE");
			}).toThrow();
			expect(() => {
				return body.setCollisionType(true);
			}).toThrow();
		});
	});

	describe("contains", () => {
		let body;

		beforeEach(() => {
			const parent = new Renderable(0, 0, 32, 64);
			body = new Body(parent, new Rect(0, 0, 32, 64));
		});

		it("should return true for a point inside the body", () => {
			expect(body.contains(16, 32)).toEqual(true);
		});

		it("should return false for a point outside the body", () => {
			expect(body.contains(100, 100)).toEqual(false);
		});

		it("should return true for a point at the origin of the shape", () => {
			expect(body.contains(1, 1)).toEqual(true);
		});

		it("should return false for negative coordinates outside bounds", () => {
			expect(body.contains(-5, -5)).toEqual(false);
		});

		it("should accept a vector-like object as argument", () => {
			expect(body.contains({ x: 16, y: 32 })).toEqual(true);
			expect(body.contains({ x: 100, y: 100 })).toEqual(false);
		});
	});

	describe("forEach", () => {
		it("should iterate over all shapes", () => {
			const parent = new Renderable(0, 0, 64, 64);
			const body = new Body(parent);
			body.addShape(new Rect(0, 0, 16, 16));
			body.addShape(new Rect(16, 0, 16, 16));
			body.addShape(new Rect(32, 0, 16, 16));

			let count = 0;
			body.forEach(() => {
				count++;
			});
			expect(count).toEqual(3);
		});

		it("should provide shape, index, and array arguments", () => {
			const parent = new Renderable(0, 0, 64, 64);
			const body = new Body(parent);
			body.addShape(new Rect(0, 0, 16, 16));
			body.addShape(new Rect(16, 0, 16, 16));

			const indices = [];
			body.forEach((shape, index, array) => {
				indices.push(index);
				expect(shape).toEqual(array[index]);
			});
			expect(indices).toEqual([0, 1]);
		});

		it("should use the provided thisArg", () => {
			const parent = new Renderable(0, 0, 32, 32);
			const body = new Body(parent, new Rect(0, 0, 16, 16));

			const context = { value: 42 };
			body.forEach(function () {
				expect(this.value).toEqual(42);
			}, context);
		});

		it("should throw if callback is not a function", () => {
			const parent = new Renderable(0, 0, 32, 32);
			const body = new Body(parent, new Rect(0, 0, 16, 16));
			expect(() => {
				return body.forEach("not a function");
			}).toThrow();
		});
	});

	describe("rotate", () => {
		it("should return the body for method chaining", () => {
			const parent = new Renderable(0, 0, 32, 64);
			const body = new Body(parent, new Rect(0, 0, 32, 64));
			const result = body.rotate(Math.PI / 4);
			expect(result).toEqual(body);
		});

		it("should not modify the body when angle is 0", () => {
			const parent = new Renderable(0, 0, 32, 64);
			const body = new Body(parent, new Rect(0, 0, 32, 64));
			const widthBefore = body.getBounds().width;
			const heightBefore = body.getBounds().height;
			body.rotate(0);
			expect(body.getBounds().width).toEqual(widthBefore);
			expect(body.getBounds().height).toEqual(heightBefore);
		});

		it("should update bounds after rotation", () => {
			const parent = new Renderable(0, 0, 32, 64);
			const body = new Body(parent, new Rect(0, 0, 32, 64));
			const widthBefore = body.getBounds().width;
			const heightBefore = body.getBounds().height;
			body.rotate(Math.PI / 2);
			const boundsAfter = body.getBounds();
			// after 90 degree rotation, width and height should approximately swap
			expect(Math.abs(boundsAfter.width - heightBefore)).toBeLessThan(1);
			expect(Math.abs(boundsAfter.height - widthBefore)).toBeLessThan(1);
		});
	});

	describe("respondToCollision", () => {
		it("should move ancestor out of overlap", () => {
			const parent = new Renderable(50, 50, 32, 32);
			parent.anchorPoint.set(0, 0);
			const body = new Body(parent, new Rect(0, 0, 32, 32));
			parent.body = body;

			const response = {
				overlapV: { x: 5, y: 0 },
				overlapN: { x: 1, y: 0 },
			};
			body.respondToCollision(response);
			expect(parent.pos.x).toEqual(45);
			expect(parent.pos.y).toEqual(50);
		});

		it("should cancel velocity component along collision normal", () => {
			const parent = new Renderable(0, 0, 32, 32);
			parent.anchorPoint.set(0, 0);
			const body = new Body(parent, new Rect(0, 0, 32, 32));
			parent.body = body;

			body.vel.set(3, 4);
			const response = {
				overlapV: { x: 1, y: 0 },
				overlapN: { x: 1, y: 0 },
			};
			body.respondToCollision(response);
			// x velocity into the normal should be cancelled
			expect(body.vel.x).toBeCloseTo(0);
			// y velocity (tangent) should be preserved
			expect(body.vel.y).toBeCloseTo(4);
		});

		it("should not cancel velocity when moving away from normal", () => {
			const parent = new Renderable(0, 0, 32, 32);
			parent.anchorPoint.set(0, 0);
			const body = new Body(parent, new Rect(0, 0, 32, 32));
			parent.body = body;

			// velocity pointing away from the collision normal
			body.vel.set(-3, 0);
			const response = {
				overlapV: { x: 1, y: 0 },
				overlapN: { x: 1, y: 0 },
			};
			body.respondToCollision(response);
			// velocity should be unchanged (already moving away)
			expect(body.vel.x).toBeCloseTo(-3);
		});

		it("should reflect velocity when bounce > 0", () => {
			const parent = new Renderable(0, 0, 32, 32);
			parent.anchorPoint.set(0, 0);
			const body = new Body(parent, new Rect(0, 0, 32, 32));
			parent.body = body;
			body.bounce = 1;

			body.vel.set(5, 0);
			const response = {
				overlapV: { x: 2, y: 0 },
				overlapN: { x: 1, y: 0 },
			};
			body.respondToCollision(response);
			// full bounce should reverse velocity along normal
			expect(body.vel.x).toBeCloseTo(-5);
		});

		it("should apply full overlap when other body is static", () => {
			const parentA = new Renderable(50, 50, 32, 32);
			parentA.anchorPoint.set(0, 0);
			const bodyA = new Body(parentA, new Rect(0, 0, 32, 32));
			parentA.body = bodyA;

			const parentB = new Renderable(40, 50, 32, 32);
			parentB.anchorPoint.set(0, 0);
			const bodyB = new Body(parentB, new Rect(0, 0, 32, 32));
			parentB.body = bodyB;
			bodyB.setStatic(true);

			const response = {
				a: parentA,
				b: parentB,
				overlapV: { x: 10, y: 0 },
				overlapN: { x: 1, y: 0 },
			};
			bodyA.respondToCollision(response);
			// static other → full overlap applied (ratio = 1)
			expect(parentA.pos.x).toBeCloseTo(40);
		});

		it("should split overlap proportionally when both bodies are dynamic with equal mass", () => {
			const parentA = new Renderable(50, 50, 32, 32);
			parentA.anchorPoint.set(0, 0);
			const bodyA = new Body(parentA, new Rect(0, 0, 32, 32));
			parentA.body = bodyA;
			bodyA.mass = 1;

			const parentB = new Renderable(40, 50, 32, 32);
			parentB.anchorPoint.set(0, 0);
			const bodyB = new Body(parentB, new Rect(0, 0, 32, 32));
			parentB.body = bodyB;
			bodyB.mass = 1;

			const response = {
				a: parentA,
				b: parentB,
				overlapV: { x: 10, y: 0 },
				overlapN: { x: 1, y: 0 },
			};
			bodyA.respondToCollision(response);
			// equal mass → ratio = 0.5, move half the overlap
			expect(parentA.pos.x).toBeCloseTo(45);
		});

		it("should move lighter body more than heavier body", () => {
			const parentA = new Renderable(50, 50, 32, 32);
			parentA.anchorPoint.set(0, 0);
			const bodyA = new Body(parentA, new Rect(0, 0, 32, 32));
			parentA.body = bodyA;
			bodyA.mass = 1;

			const parentB = new Renderable(40, 50, 32, 32);
			parentB.anchorPoint.set(0, 0);
			const bodyB = new Body(parentB, new Rect(0, 0, 32, 32));
			parentB.body = bodyB;
			bodyB.mass = 3;

			const response = {
				a: parentA,
				b: parentB,
				overlapV: { x: 10, y: 0 },
				overlapN: { x: 1, y: 0 },
			};
			// bodyA (mass 1) vs bodyB (mass 3): ratio = 3/(1+3) = 0.75
			bodyA.respondToCollision(response);
			expect(parentA.pos.x).toBeCloseTo(42.5);

			// bodyB responds: ratio = 1/(1+3) = 0.25
			const responseB = {
				a: parentB,
				b: parentA,
				overlapV: { x: -10, y: 0 },
				overlapN: { x: -1, y: 0 },
			};
			bodyB.respondToCollision(responseB);
			expect(parentB.pos.x).toBeCloseTo(42.5);
		});

		it("should scale velocity response by mass ratio for dynamic bodies", () => {
			const parentA = new Renderable(0, 0, 32, 32);
			parentA.anchorPoint.set(0, 0);
			const bodyA = new Body(parentA, new Rect(0, 0, 32, 32));
			parentA.body = bodyA;
			bodyA.mass = 1;

			const parentB = new Renderable(0, 0, 32, 32);
			parentB.anchorPoint.set(0, 0);
			const bodyB = new Body(parentB, new Rect(0, 0, 32, 32));
			parentB.body = bodyB;
			bodyB.mass = 3;

			bodyA.vel.set(8, 0);
			const response = {
				a: parentA,
				b: parentB,
				overlapV: { x: 2, y: 0 },
				overlapN: { x: 1, y: 0 },
			};
			// ratio = 3/4 = 0.75
			bodyA.respondToCollision(response);
			// vel.x = 8 - 8 * 0.75 = 2
			expect(bodyA.vel.x).toBeCloseTo(2);
		});

		it("should use 50/50 split when both dynamic bodies have zero mass", () => {
			const parentA = new Renderable(50, 50, 32, 32);
			parentA.anchorPoint.set(0, 0);
			const bodyA = new Body(parentA, new Rect(0, 0, 32, 32));
			parentA.body = bodyA;
			bodyA.mass = 0;

			const parentB = new Renderable(40, 50, 32, 32);
			parentB.anchorPoint.set(0, 0);
			const bodyB = new Body(parentB, new Rect(0, 0, 32, 32));
			parentB.body = bodyB;
			bodyB.mass = 0;

			const response = {
				a: parentA,
				b: parentB,
				overlapV: { x: 10, y: 0 },
				overlapN: { x: 1, y: 0 },
			};
			bodyA.respondToCollision(response);
			// zero mass fallback → ratio = 0.5, move half the overlap
			expect(parentA.pos.x).toBeCloseTo(45);
		});

		it("should handle diagonal collision normals", () => {
			const parent = new Renderable(0, 0, 32, 32);
			parent.anchorPoint.set(0, 0);
			const body = new Body(parent, new Rect(0, 0, 32, 32));
			parent.body = body;

			body.vel.set(4, 4);
			const n = 1 / Math.sqrt(2);
			const response = {
				overlapV: { x: 1, y: 1 },
				overlapN: { x: n, y: n },
			};
			body.respondToCollision(response);
			// velocity projected onto the diagonal normal should be removed
			// projVel = 4*n + 4*n = 8*n ≈ 5.66
			// vel.x = 4 - projVel*n ≈ 4 - 4 = 0
			expect(body.vel.x).toBeCloseTo(0);
			expect(body.vel.y).toBeCloseTo(0);
		});
	});

	describe("vel, force, mass, bounce, gravityScale, ignoreGravity properties", () => {
		let body;

		beforeEach(() => {
			const parent = new Renderable(0, 0, 32, 64);
			body = new Body(parent);
		});

		it("vel should be settable", () => {
			body.vel.set(5, 10);
			expect(body.vel.x).toEqual(5);
			expect(body.vel.y).toEqual(10);
		});

		it("force should be settable", () => {
			body.force.set(2, 3);
			expect(body.force.x).toEqual(2);
			expect(body.force.y).toEqual(3);
		});

		it("mass should be settable", () => {
			body.mass = 5;
			expect(body.mass).toEqual(5);
		});

		it("bounce should be settable between 0 and 1", () => {
			body.bounce = 0;
			expect(body.bounce).toEqual(0);
			body.bounce = 0.5;
			expect(body.bounce).toEqual(0.5);
			body.bounce = 1;
			expect(body.bounce).toEqual(1);
		});

		it("gravityScale should be settable", () => {
			body.gravityScale = 0;
			expect(body.gravityScale).toEqual(0);
			body.gravityScale = 2.0;
			expect(body.gravityScale).toEqual(2.0);
		});

		it("ignoreGravity should be settable", () => {
			expect(body.ignoreGravity).toEqual(false);
			body.ignoreGravity = true;
			expect(body.ignoreGravity).toEqual(true);
		});
	});
});
