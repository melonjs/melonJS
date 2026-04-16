import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	Body,
	boot,
	Container,
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
			renderer: video.CANVAS,
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

	describe("QuadTree getIndex", () => {
		it("should return 1 (top-left) for items in the top-left quadrant", () => {
			// world is 800x600, midpoint is (400, 300)
			world.broadphase.split();
			const r = new Renderable(10, 10, 15, 15);
			r.anchorPoint.set(0, 0);
			r.isKinematic = false;
			expect(world.broadphase.getIndex(r)).toEqual(1);
		});

		it("should return 0 (top-right) for items in the top-right quadrant", () => {
			world.broadphase.split();
			const r = new Renderable(500, 10, 15, 15);
			r.anchorPoint.set(0, 0);
			r.isKinematic = false;
			expect(world.broadphase.getIndex(r)).toEqual(0);
		});

		it("should return 2 (bottom-left) for items in the bottom-left quadrant", () => {
			world.broadphase.split();
			const r = new Renderable(10, 400, 15, 15);
			r.anchorPoint.set(0, 0);
			r.isKinematic = false;
			expect(world.broadphase.getIndex(r)).toEqual(2);
		});

		it("should return 3 (bottom-right) for items in the bottom-right quadrant", () => {
			world.broadphase.split();
			const r = new Renderable(500, 400, 15, 15);
			r.anchorPoint.set(0, 0);
			r.isKinematic = false;
			expect(world.broadphase.getIndex(r)).toEqual(3);
		});

		it("should return -1 for items spanning the vertical midpoint", () => {
			world.broadphase.split();
			// item straddles x=400
			const r = new Renderable(390, 10, 20, 15);
			r.anchorPoint.set(0, 0);
			r.isKinematic = false;
			expect(world.broadphase.getIndex(r)).toEqual(-1);
		});

		it("should return -1 for items spanning the horizontal midpoint", () => {
			world.broadphase.split();
			// item straddles y=300
			const r = new Renderable(10, 290, 15, 20);
			r.anchorPoint.set(0, 0);
			r.isKinematic = false;
			expect(world.broadphase.getIndex(r)).toEqual(-1);
		});

		it("should return -1 for items on the exact midpoint", () => {
			world.broadphase.split();
			// item sitting exactly at the midpoint boundary
			const r = new Renderable(400, 300, 15, 15);
			r.anchorPoint.set(0, 0);
			r.isKinematic = false;
			expect(world.broadphase.getIndex(r)).toEqual(-1);
		});

		it("should use bounds position (not item.left) for quadrant assignment", () => {
			world.broadphase.split();
			// place a renderable at pos (500, 10) with default anchor (0.5, 0.5)
			// and size 100x100. With anchor 0.5:
			//   bounds.left = 500 - 100*0.5 = 450 (right of midpoint 400)
			//   bounds.top = 10 - 100*0.5 = -40 (above midpoint 300)
			// so bounds place it in the top-right quadrant (index 0)
			const r = new Renderable(500, 10, 100, 100);
			r.anchorPoint.set(0.5, 0.5);
			r.isKinematic = false;

			// verify that item.left (pos.x) differs from bounds.left
			const bounds = r.getBounds();
			expect(r.left).toEqual(500);
			expect(bounds.left).toEqual(450);

			expect(world.broadphase.getIndex(r)).toEqual(0);
		});

		it("should correctly assign quadrant for items with non-zero anchor points", () => {
			world.broadphase.max_objects = 2;

			// renderable at pos(100, 100), size 50x50, anchor(0.5, 0.5)
			// bounds.left = 100 - 25 = 75, bounds.top = 100 - 25 = 75
			// clearly in top-left quadrant (midpoint is 400, 300)
			const r1 = new Renderable(100, 100, 50, 50);
			r1.anchorPoint.set(0.5, 0.5);
			r1.isKinematic = false;

			// renderable at pos(600, 100), size 50x50, anchor(0.5, 0.5)
			// bounds.left = 600 - 25 = 575, bounds.top = 100 - 25 = 75
			// clearly in top-right quadrant
			const r2 = new Renderable(600, 100, 50, 50);
			r2.anchorPoint.set(0.5, 0.5);
			r2.isKinematic = false;

			// renderable at pos(100, 500), size 50x50, anchor(0.5, 0.5)
			// bounds.left = 75, bounds.top = 475
			// clearly in bottom-left quadrant
			const r3 = new Renderable(100, 500, 50, 50);
			r3.anchorPoint.set(0.5, 0.5);
			r3.isKinematic = false;

			world.broadphase.insert(r1);
			world.broadphase.insert(r2);
			world.broadphase.insert(r3);

			// should have split
			expect(world.broadphase.nodes.length).toEqual(4);

			// all items should be retrievable via their bounds position
			expect(world.broadphase.retrieve(r1)).toContain(r1);
			expect(world.broadphase.retrieve(r2)).toContain(r2);
			expect(world.broadphase.retrieve(r3)).toContain(r3);

			// r1 and r2 should NOT appear together (different quadrants)
			const r1Results = world.broadphase.retrieve(r1);
			expect(r1Results).not.toContain(r2);
		});

		it("should handle anchor point that shifts item across the midpoint", () => {
			world.broadphase.split();
			// pos is (410, 10), size 30x30, anchor(0, 0)
			// bounds.left = 410 (right of midpoint 400) → top-right
			const r1 = new Renderable(410, 10, 30, 30);
			r1.anchorPoint.set(0, 0);
			r1.isKinematic = false;
			expect(world.broadphase.getIndex(r1)).toEqual(0);

			// same pos (410, 10), size 30x30, but anchor(1, 0)
			// bounds.left = 410 - 30 = 380 (left of midpoint 400)
			// bounds.right = 410 (right of midpoint 400) → spans midpoint = -1
			const r2 = new Renderable(410, 10, 30, 30);
			r2.anchorPoint.set(1, 0);
			r2.isKinematic = false;
			expect(world.broadphase.getIndex(r2)).toEqual(-1);
		});
	});

	describe("QuadTree max_levels", () => {
		it("should not split beyond max_levels", () => {
			world.broadphase.max_objects = 1;
			world.broadphase.max_levels = 2;

			// insert many items in the same quadrant to try to force deep splits
			const items = [];
			for (let i = 0; i < 10; i++) {
				const r = new Renderable(10 + i, 10 + i, 5, 5);
				r.anchorPoint.set(0, 0);
				r.isKinematic = false;
				world.broadphase.insert(r);
				items.push(r);
			}

			// verify max depth: walk the tree and check no node exceeds level 2
			const checkMaxLevel = (node, maxLevel) => {
				expect(node.level).toBeLessThanOrEqual(maxLevel);
				for (const child of node.nodes) {
					checkMaxLevel(child, maxLevel);
				}
			};
			checkMaxLevel(world.broadphase, 2);

			// all items should still be retrievable
			for (const item of items) {
				expect(world.broadphase.retrieve(item)).toContain(item);
			}
		});
	});

	describe("QuadTree insertContainer", () => {
		it("should insert non-kinematic children from a container", () => {
			const container = new Container(0, 0, 800, 600);
			container.name = "testContainer";

			const r1 = new Renderable(10, 10, 20, 20);
			r1.anchorPoint.set(0, 0);
			r1.isKinematic = false;

			const r2 = new Renderable(500, 400, 20, 20);
			r2.anchorPoint.set(0, 0);
			r2.isKinematic = false;

			container.addChild(r1);
			container.addChild(r2);

			world.broadphase.insertContainer(container);

			expect(world.broadphase.retrieve(r1)).toContain(r1);
			expect(world.broadphase.retrieve(r2)).toContain(r2);
		});

		it("should skip kinematic children", () => {
			const container = new Container(0, 0, 800, 600);
			container.name = "testContainer";

			const r1 = new Renderable(10, 10, 20, 20);
			r1.anchorPoint.set(0, 0);
			r1.isKinematic = true;

			const r2 = new Renderable(500, 400, 20, 20);
			r2.anchorPoint.set(0, 0);
			r2.isKinematic = false;

			container.addChild(r1);
			container.addChild(r2);

			world.broadphase.insertContainer(container);

			const results = world.broadphase.retrieve(r2);
			expect(results).toContain(r2);
			expect(results).not.toContain(r1);
		});

		it("should recursively insert nested containers", () => {
			const outer = new Container(0, 0, 800, 600);
			outer.name = "outer";
			const inner = new Container(0, 0, 400, 300);
			inner.name = "inner";

			const r1 = new Renderable(10, 10, 20, 20);
			r1.anchorPoint.set(0, 0);
			r1.isKinematic = false;

			inner.addChild(r1);
			outer.addChild(inner);

			world.broadphase.insertContainer(outer);

			// both the container and the renderable should be inserted
			expect(world.broadphase.retrieve(r1)).toContain(r1);
			expect(world.broadphase.retrieve(inner)).toContain(inner);
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

	describe("QuadTree remove", () => {
		it("should remove an object from root level", () => {
			const r1 = new Renderable(10, 10, 20, 20);
			r1.anchorPoint.set(0, 0);
			r1.isKinematic = false;
			world.broadphase.insert(r1);

			expect(world.broadphase.objects).toContain(r1);
			const result = world.broadphase.remove(r1);
			expect(result).toEqual(true);
			expect(world.broadphase.objects).not.toContain(r1);
		});

		it("should return false when removing an object not in the tree", () => {
			const r1 = new Renderable(10, 10, 20, 20);
			r1.anchorPoint.set(0, 0);
			r1.isKinematic = false;
			// not inserted
			const result = world.broadphase.remove(r1);
			expect(result).toEqual(false);
		});

		it("should return false for objects without getBounds", () => {
			const result = world.broadphase.remove({ x: 0, y: 0 });
			expect(result).toEqual(false);
		});

		it("should remove an object from a subnode after split", () => {
			world.broadphase.max_objects = 2;

			// items in distinct quadrants to force split
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

			world.broadphase.insert(topLeft);
			world.broadphase.insert(topRight);
			world.broadphase.insert(bottomLeft);

			// should have split
			expect(world.broadphase.nodes.length).toEqual(4);

			// remove topLeft from its subnode (index 1 = top-left quadrant)
			const result = world.broadphase.remove(topLeft);
			expect(result).toEqual(true);

			// topLeft should no longer be retrievable
			const results = world.broadphase.retrieve(topLeft);
			expect(results).not.toContain(topLeft);

			// other items should still be retrievable
			expect(world.broadphase.retrieve(topRight)).toContain(topRight);
			expect(world.broadphase.retrieve(bottomLeft)).toContain(bottomLeft);
		});

		it("should not corrupt spatial layout when pruning a subnode", () => {
			world.broadphase.max_objects = 2;

			const topLeft = new Renderable(10, 10, 15, 15);
			topLeft.anchorPoint.set(0, 0);
			topLeft.isKinematic = false;

			const topRight = new Renderable(500, 10, 15, 15);
			topRight.anchorPoint.set(0, 0);
			topRight.isKinematic = false;

			const bottomLeft = new Renderable(10, 400, 15, 15);
			bottomLeft.anchorPoint.set(0, 0);
			bottomLeft.isKinematic = false;

			const bottomRight = new Renderable(500, 400, 15, 15);
			bottomRight.anchorPoint.set(0, 0);
			bottomRight.isKinematic = false;

			world.broadphase.insert(topLeft);
			world.broadphase.insert(topRight);
			world.broadphase.insert(bottomLeft);
			world.broadphase.insert(bottomRight);

			expect(world.broadphase.nodes.length).toEqual(4);

			// subnodes are: 0=TR, 1=TL, 2=BL, 3=BR
			// removing topLeft should not shift the indices of other subnodes
			world.broadphase.remove(topLeft);

			// after removal, nodes should still be 4 (indices must remain stable)
			// or if pruned, the remaining items must still be retrievable in correct quadrants
			expect(world.broadphase.retrieve(topRight)).toContain(topRight);
			expect(world.broadphase.retrieve(bottomLeft)).toContain(bottomLeft);
			expect(world.broadphase.retrieve(bottomRight)).toContain(bottomRight);

			// inserting a new item in the same quadrant should still work
			const newTopLeft = new Renderable(20, 20, 15, 15);
			newTopLeft.anchorPoint.set(0, 0);
			newTopLeft.isKinematic = false;
			world.broadphase.insert(newTopLeft);
			expect(world.broadphase.retrieve(newTopLeft)).toContain(newTopLeft);
		});
	});

	describe("QuadTree hasChildren and isPrunable", () => {
		it("isPrunable should return true for empty node", () => {
			expect(world.broadphase.isPrunable()).toEqual(true);
		});

		it("isPrunable should return false when node has objects", () => {
			const r1 = new Renderable(10, 10, 20, 20);
			r1.anchorPoint.set(0, 0);
			r1.isKinematic = false;
			world.broadphase.insert(r1);

			expect(world.broadphase.isPrunable()).toEqual(false);
		});

		it("hasChildren should return false for node without subnodes", () => {
			expect(world.broadphase.hasChildren()).toEqual(false);
		});

		it("hasChildren should return true when subnodes have objects", () => {
			world.broadphase.max_objects = 2;

			const topLeft = new Renderable(10, 10, 15, 15);
			topLeft.anchorPoint.set(0, 0);
			topLeft.isKinematic = false;

			const topRight = new Renderable(500, 10, 15, 15);
			topRight.anchorPoint.set(0, 0);
			topRight.isKinematic = false;

			const bottomLeft = new Renderable(10, 400, 15, 15);
			bottomLeft.anchorPoint.set(0, 0);
			bottomLeft.isKinematic = false;

			world.broadphase.insert(topLeft);
			world.broadphase.insert(topRight);
			world.broadphase.insert(bottomLeft);

			// should have split and subnodes should have objects
			expect(world.broadphase.nodes.length).toEqual(4);
			expect(world.broadphase.hasChildren()).toEqual(true);
		});

		it("hasChildren should detect subnodes that have their own subnodes", () => {
			world.broadphase.max_objects = 2;
			world.broadphase.max_levels = 4;

			// force a first-level split
			const r1 = new Renderable(10, 10, 15, 15);
			r1.anchorPoint.set(0, 0);
			r1.isKinematic = false;

			const r2 = new Renderable(100, 10, 15, 15);
			r2.anchorPoint.set(0, 0);
			r2.isKinematic = false;

			const r3 = new Renderable(10, 100, 15, 15);
			r3.anchorPoint.set(0, 0);
			r3.isKinematic = false;

			world.broadphase.insert(r1);
			world.broadphase.insert(r2);
			world.broadphase.insert(r3);

			expect(world.broadphase.nodes.length).toEqual(4);

			// force a second-level split in one of the subnodes (top-left = index 1)
			const topLeftNode = world.broadphase.nodes[1];
			// insert more items within the top-left quadrant bounds to trigger nested split
			const sub1 = new Renderable(10, 10, 5, 5);
			sub1.anchorPoint.set(0, 0);
			sub1.isKinematic = false;

			const sub2 = new Renderable(100, 10, 5, 5);
			sub2.anchorPoint.set(0, 0);
			sub2.isKinematic = false;

			const sub3 = new Renderable(10, 100, 5, 5);
			sub3.anchorPoint.set(0, 0);
			sub3.isKinematic = false;

			topLeftNode.insert(sub1);
			topLeftNode.insert(sub2);
			topLeftNode.insert(sub3);

			// the top-left subnode should now have its own subnodes
			expect(topLeftNode.nodes.length).toEqual(4);

			// even if we clear the direct objects of topLeftNode,
			// hasChildren should still return true because subnodes have content
			topLeftNode.objects.length = 0;
			expect(world.broadphase.hasChildren()).toEqual(true);
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
