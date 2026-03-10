import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	Body,
	boot,
	collision,
	Ellipse,
	Line,
	Rect,
	Renderable,
	video,
	World,
} from "../src/index.js";

describe("QuadTree & Collision Detection", () => {
	let world;

	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});
	});

	beforeEach(() => {
		world = new World(0, 0, 800, 600);
	});

	describe("QuadTree retrieve", () => {
		it("should return an array of candidates", () => {
			// insert items into broadphase via world
			const r1 = new Renderable(10, 10, 20, 20);
			r1.anchorPoint.set(0, 0);
			r1.isKinematic = false;
			world.broadphase.insert(r1);

			const r2 = new Renderable(50, 50, 20, 20);
			r2.anchorPoint.set(0, 0);
			r2.isKinematic = false;
			world.broadphase.insert(r2);

			const results = world.broadphase.retrieve(r1);
			expect(Array.isArray(results)).toEqual(true);
			expect(results.length).toBeGreaterThanOrEqual(1);
		});

		it("should return all objects when they share the same quadrant", () => {
			// all items in top-left quadrant
			const items = [];
			for (let i = 0; i < 3; i++) {
				const r = new Renderable(10 + i * 10, 10, 15, 15);
				r.anchorPoint.set(0, 0);
				r.isKinematic = false;
				world.broadphase.insert(r);
				items.push(r);
			}

			const results = world.broadphase.retrieve(items[0]);
			// all 3 should be retrievable
			for (const item of items) {
				expect(results).toContain(item);
			}
		});

		it("should handle splitting when max_objects is exceeded", () => {
			// use a small max_objects to force splitting
			world.broadphase.max_objects = 2;

			const items = [];
			// insert items in different quadrants
			const positions = [
				[10, 10], // top-left
				[500, 10], // top-right
				[10, 400], // bottom-left
				[500, 400], // bottom-right
				[200, 200], // center (spans quadrants)
			];

			for (const [x, y] of positions) {
				const r = new Renderable(x, y, 15, 15);
				r.anchorPoint.set(0, 0);
				r.isKinematic = false;
				world.broadphase.insert(r);
				items.push(r);
			}

			// retrieve for each item - should always include itself
			for (const item of items) {
				const results = world.broadphase.retrieve(item);
				expect(results).toContain(item);
			}
		});

		it("should return a fresh array on each call (no shared state)", () => {
			const r1 = new Renderable(10, 10, 20, 20);
			r1.anchorPoint.set(0, 0);
			r1.isKinematic = false;
			world.broadphase.insert(r1);

			const results1 = world.broadphase.retrieve(r1);
			const results2 = world.broadphase.retrieve(r1);
			// should be separate array instances
			expect(results1).not.toBe(results2);
			// but same content
			expect(results1.length).toEqual(results2.length);
		});

		it("should support the sorting function parameter", () => {
			const items = [];
			for (let i = 0; i < 3; i++) {
				const r = new Renderable(10 + i * 30, 10, 15, 15);
				r.anchorPoint.set(0, 0);
				r.isKinematic = false;
				r.pos.z = 3 - i; // reverse z-order
				world.broadphase.insert(r);
				items.push(r);
			}

			const results = world.broadphase.retrieve(items[0], (a, b) => {
				return a.pos.z - b.pos.z;
			});
			// should be sorted by z ascending
			for (let i = 1; i < results.length; i++) {
				expect(results[i].pos.z).toBeGreaterThanOrEqual(results[i - 1].pos.z);
			}
		});

		it("should not modify the internal objects array", () => {
			const r1 = new Renderable(10, 10, 20, 20);
			r1.anchorPoint.set(0, 0);
			r1.isKinematic = false;
			world.broadphase.insert(r1);

			const internalLength = world.broadphase.objects.length;
			const results = world.broadphase.retrieve(r1);
			// pushing to results should not affect internal state
			results.push("extra");
			expect(world.broadphase.objects.length).toEqual(internalLength);
		});
	});

	describe("QuadTree insert with redistribution", () => {
		it("should redistribute objects to subnodes after split", () => {
			world.broadphase.max_objects = 2;

			// insert 3 items to force a split
			const r1 = new Renderable(10, 10, 15, 15);
			r1.anchorPoint.set(0, 0);
			r1.isKinematic = false;

			const r2 = new Renderable(500, 10, 15, 15);
			r2.anchorPoint.set(0, 0);
			r2.isKinematic = false;

			const r3 = new Renderable(10, 400, 15, 15);
			r3.anchorPoint.set(0, 0);
			r3.isKinematic = false;

			world.broadphase.insert(r1);
			world.broadphase.insert(r2);
			world.broadphase.insert(r3);

			// after split, subnodes should exist
			expect(world.broadphase.nodes.length).toEqual(4);

			// all items should still be retrievable
			expect(world.broadphase.retrieve(r1)).toContain(r1);
			expect(world.broadphase.retrieve(r2)).toContain(r2);
			expect(world.broadphase.retrieve(r3)).toContain(r3);
		});

		it("should keep items at parent when they span quadrants", () => {
			world.broadphase.max_objects = 2;

			// item spanning the center
			const spanning = new Renderable(350, 250, 100, 100);
			spanning.anchorPoint.set(0, 0);
			spanning.isKinematic = false;

			const r1 = new Renderable(10, 10, 15, 15);
			r1.anchorPoint.set(0, 0);
			r1.isKinematic = false;

			const r2 = new Renderable(500, 10, 15, 15);
			r2.anchorPoint.set(0, 0);
			r2.isKinematic = false;

			world.broadphase.insert(spanning);
			world.broadphase.insert(r1);
			world.broadphase.insert(r2);

			// spanning item should be in root objects (not redistributed)
			expect(world.broadphase.objects).toContain(spanning);
		});
	});

	describe("QuadTree insert redistribution integrity", () => {
		it("objects array should only contain items that span quadrants after split", () => {
			world.broadphase.max_objects = 2;

			// items that fit cleanly into separate quadrants
			const topLeft = new Renderable(10, 10, 15, 15);
			topLeft.anchorPoint.set(0, 0);
			topLeft.isKinematic = false;
			topLeft.name = "topLeft";

			const topRight = new Renderable(500, 10, 15, 15);
			topRight.anchorPoint.set(0, 0);
			topRight.isKinematic = false;
			topRight.name = "topRight";

			const bottomLeft = new Renderable(10, 400, 15, 15);
			bottomLeft.anchorPoint.set(0, 0);
			bottomLeft.isKinematic = false;
			bottomLeft.name = "bottomLeft";

			// item that spans the center (won't fit in any quadrant)
			const spanning = new Renderable(350, 250, 100, 100);
			spanning.anchorPoint.set(0, 0);
			spanning.isKinematic = false;
			spanning.name = "spanning";

			world.broadphase.insert(topLeft);
			world.broadphase.insert(topRight);
			// this triggers split, topLeft and topRight go to subnodes
			world.broadphase.insert(spanning);

			// spanning should remain in root objects (can't fit in a subnode)
			expect(world.broadphase.objects).toContain(spanning);
			// topLeft and topRight should have been redistributed to subnodes
			expect(world.broadphase.objects).not.toContain(topLeft);
			expect(world.broadphase.objects).not.toContain(topRight);
			// root objects should only have the spanning item
			expect(world.broadphase.objects.length).toEqual(1);
		});

		it("all items retrievable after multiple splits", () => {
			world.broadphase.max_objects = 2;

			const items = [];
			const positions = [
				[10, 10],
				[500, 10],
				[10, 400],
				[500, 400],
				[200, 100],
				[600, 100],
				[100, 500],
				[600, 500],
			];

			for (const [x, y] of positions) {
				const r = new Renderable(x, y, 15, 15);
				r.anchorPoint.set(0, 0);
				r.isKinematic = false;
				world.broadphase.insert(r);
				items.push(r);
			}

			// every item should still be retrievable
			for (const item of items) {
				const results = world.broadphase.retrieve(item);
				expect(results).toContain(item);
			}
		});

		it("objects array length should be correct after split with mixed items", () => {
			world.broadphase.max_objects = 2;

			// two spanning items + one that fits in a quadrant
			const span1 = new Renderable(350, 250, 100, 100);
			span1.anchorPoint.set(0, 0);
			span1.isKinematic = false;

			const span2 = new Renderable(380, 270, 50, 50);
			span2.anchorPoint.set(0, 0);
			span2.isKinematic = false;

			const corner = new Renderable(10, 10, 15, 15);
			corner.anchorPoint.set(0, 0);
			corner.isKinematic = false;

			world.broadphase.insert(span1);
			world.broadphase.insert(span2);
			world.broadphase.insert(corner);

			// corner should be redistributed, both spanning items remain
			expect(world.broadphase.objects).toContain(span1);
			expect(world.broadphase.objects).toContain(span2);
			expect(world.broadphase.objects).not.toContain(corner);
			expect(world.broadphase.objects.length).toEqual(2);
		});
	});

	describe("QuadTree clear and rebuild", () => {
		it("should clear all objects and subnodes", () => {
			world.broadphase.max_objects = 2;

			for (let i = 0; i < 5; i++) {
				const r = new Renderable(i * 100, i * 100, 15, 15);
				r.anchorPoint.set(0, 0);
				r.isKinematic = false;
				world.broadphase.insert(r);
			}

			world.broadphase.clear();
			expect(world.broadphase.objects.length).toEqual(0);
			expect(world.broadphase.nodes.length).toEqual(0);
		});

		it("should work correctly after clear and re-insert", () => {
			const r1 = new Renderable(10, 10, 20, 20);
			r1.anchorPoint.set(0, 0);
			r1.isKinematic = false;
			world.broadphase.insert(r1);

			world.broadphase.clear();

			const r2 = new Renderable(50, 50, 20, 20);
			r2.anchorPoint.set(0, 0);
			r2.isKinematic = false;
			world.broadphase.insert(r2);

			const results = world.broadphase.retrieve(r2);
			expect(results).toContain(r2);
			expect(results).not.toContain(r1);
		});
	});

	describe("Collision Detector (SAT lookup)", () => {
		it("should detect collision between two overlapping Polygon-shaped bodies", () => {
			const r1 = new Renderable(0, 0, 32, 32);
			r1.anchorPoint.set(0, 0);
			world.addChild(r1);
			const body1 = new Body(r1, new Rect(0, 0, 32, 32));

			const r2 = new Renderable(16, 16, 32, 32);
			r2.anchorPoint.set(0, 0);
			world.addChild(r2);
			const body2 = new Body(r2, new Rect(0, 0, 32, 32));

			// Rect shapes are converted to Polygon, so this tests PolygonPolygon
			const result = world.detector.collides(body1, body2);
			expect(result).toEqual(true);
		});

		it("should not detect collision between two non-overlapping bodies", () => {
			const r1 = new Renderable(0, 0, 32, 32);
			r1.anchorPoint.set(0, 0);
			world.addChild(r1);
			const body1 = new Body(r1, new Rect(0, 0, 32, 32));

			const r2 = new Renderable(200, 200, 32, 32);
			r2.anchorPoint.set(0, 0);
			world.addChild(r2);
			const body2 = new Body(r2, new Rect(0, 0, 32, 32));

			const result = world.detector.collides(body1, body2);
			expect(result).toEqual(false);
		});

		it("should detect collision between Ellipse-shaped bodies", () => {
			const r1 = new Renderable(0, 0, 32, 32);
			r1.anchorPoint.set(0, 0);
			world.addChild(r1);
			const body1 = new Body(r1, new Ellipse(16, 16, 32, 32));

			const r2 = new Renderable(10, 10, 32, 32);
			r2.anchorPoint.set(0, 0);
			world.addChild(r2);
			const body2 = new Body(r2, new Ellipse(16, 16, 32, 32));

			// This tests EllipseEllipse
			const result = world.detector.collides(body1, body2);
			expect(result).toEqual(true);
		});

		it("should detect collision between Polygon and Ellipse bodies", () => {
			const r1 = new Renderable(0, 0, 32, 32);
			r1.anchorPoint.set(0, 0);
			world.addChild(r1);
			const body1 = new Body(r1, new Rect(0, 0, 32, 32));

			const r2 = new Renderable(10, 10, 32, 32);
			r2.anchorPoint.set(0, 0);
			world.addChild(r2);
			const body2 = new Body(r2, new Ellipse(16, 16, 32, 32));

			// This tests PolygonEllipse
			const result = world.detector.collides(body1, body2);
			expect(result).toEqual(true);
		});

		it("should detect collision between Ellipse and Polygon bodies", () => {
			const r1 = new Renderable(0, 0, 32, 32);
			r1.anchorPoint.set(0, 0);
			world.addChild(r1);
			const body1 = new Body(r1, new Ellipse(16, 16, 32, 32));

			const r2 = new Renderable(10, 10, 32, 32);
			r2.anchorPoint.set(0, 0);
			world.addChild(r2);
			const body2 = new Body(r2, new Rect(0, 0, 32, 32));

			// This tests EllipsePolygon
			const result = world.detector.collides(body1, body2);
			expect(result).toEqual(true);
		});

		it("should set correct shape indices on collision response", () => {
			const r1 = new Renderable(0, 0, 32, 32);
			r1.anchorPoint.set(0, 0);
			world.addChild(r1);
			const body1 = new Body(r1, new Rect(0, 0, 32, 32));

			const r2 = new Renderable(16, 16, 32, 32);
			r2.anchorPoint.set(0, 0);
			world.addChild(r2);
			const body2 = new Body(r2, new Rect(0, 0, 32, 32));

			world.detector.collides(body1, body2);
			expect(world.detector.response.indexShapeA).toEqual(0);
			expect(world.detector.response.indexShapeB).toEqual(0);
		});
	});

	describe("Detector shouldCollide", () => {
		it("should return true for two valid collidable objects", () => {
			const r1 = new Renderable(0, 0, 32, 32);
			const body1 = new Body(r1, new Rect(0, 0, 32, 32));
			r1.body = body1;

			const r2 = new Renderable(10, 10, 32, 32);
			const body2 = new Body(r2, new Rect(0, 0, 32, 32));
			r2.body = body2;

			expect(world.detector.shouldCollide(r1, r2)).toEqual(true);
		});

		it("should return false for the same object", () => {
			const r1 = new Renderable(0, 0, 32, 32);
			const body1 = new Body(r1, new Rect(0, 0, 32, 32));
			r1.body = body1;

			expect(world.detector.shouldCollide(r1, r1)).toEqual(false);
		});

		it("should return false for kinematic objects", () => {
			const r1 = new Renderable(0, 0, 32, 32);
			const body1 = new Body(r1, new Rect(0, 0, 32, 32));
			r1.body = body1;

			const r2 = new Renderable(10, 10, 32, 32);
			const body2 = new Body(r2, new Rect(0, 0, 32, 32));
			r2.body = body2;
			r2.isKinematic = true;

			expect(world.detector.shouldCollide(r1, r2)).toEqual(false);
		});

		it("should return false when both bodies are static", () => {
			const r1 = new Renderable(0, 0, 32, 32);
			const body1 = new Body(r1, new Rect(0, 0, 32, 32));
			body1.setStatic(true);
			r1.body = body1;

			const r2 = new Renderable(10, 10, 32, 32);
			const body2 = new Body(r2, new Rect(0, 0, 32, 32));
			body2.setStatic(true);
			r2.body = body2;

			expect(world.detector.shouldCollide(r1, r2)).toEqual(false);
		});

		it("should respect collision masks", () => {
			const r1 = new Renderable(0, 0, 32, 32);
			const body1 = new Body(r1, new Rect(0, 0, 32, 32));
			body1.setCollisionMask(collision.types.PLAYER_OBJECT);
			body1.collisionType = collision.types.ENEMY_OBJECT;
			r1.body = body1;

			const r2 = new Renderable(10, 10, 32, 32);
			const body2 = new Body(r2, new Rect(0, 0, 32, 32));
			body2.collisionType = collision.types.WORLD_SHAPE;
			r2.body = body2;

			// r1 only collides with PLAYER_OBJECT, r2 is WORLD_SHAPE
			expect(world.detector.shouldCollide(r1, r2)).toEqual(false);
		});
	});

	describe("Detector multi-shape collision resolution", () => {
		it("should resolve collisions with multi-shape bodies (polyline junctions)", () => {
			// body with two line segments forming an L-shape junction
			const wall = new Renderable(0, 0, 200, 200);
			wall.anchorPoint.set(0, 0);
			world.addChild(wall);
			const wallBody = new Body(wall);
			// horizontal segment
			wallBody.addShape(
				new Line(0, 0, [
					{ x: 0, y: 100 },
					{ x: 100, y: 100 },
				]),
			);
			// vertical segment
			wallBody.addShape(
				new Line(0, 0, [
					{ x: 100, y: 0 },
					{ x: 100, y: 100 },
				]),
			);
			wallBody.setStatic(true);
			wall.body = wallBody;

			// object overlapping the junction corner
			const obj = new Renderable(90, 90, 20, 20);
			obj.anchorPoint.set(0, 0);
			world.addChild(obj);
			const objBody = new Body(obj, new Rect(0, 0, 20, 20));
			obj.body = objBody;

			const result = world.detector.collides(objBody, wallBody);
			expect(result).toEqual(true);
		});

		it("should not enter extra passes for single-shape bodies", () => {
			const r1 = new Renderable(0, 0, 32, 32);
			r1.anchorPoint.set(0, 0);
			world.addChild(r1);
			const body1 = new Body(r1, new Rect(0, 0, 32, 32));

			const r2 = new Renderable(16, 16, 32, 32);
			r2.anchorPoint.set(0, 0);
			world.addChild(r2);
			const body2 = new Body(r2, new Rect(0, 0, 32, 32));
			body2.setStatic(true);

			// single-shape collision should work normally
			const result = world.detector.collides(body1, body2);
			expect(result).toEqual(true);
		});

		it("collisions() should resolve overlap with a multi-shape static body", () => {
			const wall = new Renderable(0, 0, 200, 200);
			wall.anchorPoint.set(0, 0);
			world.addChild(wall);
			const wallBody = new Body(wall);
			wallBody.addShape(
				new Line(0, 0, [
					{ x: 0, y: 100 },
					{ x: 100, y: 100 },
				]),
			);
			wallBody.addShape(
				new Line(0, 0, [
					{ x: 100, y: 0 },
					{ x: 100, y: 100 },
				]),
			);
			wallBody.setStatic(true);
			wall.body = wallBody;

			const obj = new Renderable(90, 90, 20, 20);
			obj.anchorPoint.set(0, 0);
			world.addChild(obj);
			const objBody = new Body(obj, new Rect(0, 0, 20, 20));
			obj.body = objBody;

			// insert into broadphase
			world.broadphase.insert(wall);
			world.broadphase.insert(obj);

			const hadCollision = world.detector.collisions(obj);
			expect(hadCollision).toEqual(true);
		});
	});

	describe("World.step with for...of", () => {
		it("should skip static bodies", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.alwaysUpdate = true;
			const body = new Body(r, new Rect(0, 0, 32, 32));
			body.setStatic(true);
			body.force.set(0, 0);
			r.body = body;

			world.addBody(body);
			world.step(16);
			// static body should not have force applied
			expect(body.force.x).toEqual(0);
			expect(body.force.y).toEqual(0);
		});

		it("should skip bodies with no ancestor", () => {
			const r = new Renderable(0, 0, 32, 32);
			const body = new Body(r, new Rect(0, 0, 32, 32));
			world.addBody(body);

			// remove ancestor to simulate destroyed object
			body.ancestor = undefined;

			// should not crash
			expect(() => {
				return world.step(16);
			}).not.toThrow();
		});
	});
});
