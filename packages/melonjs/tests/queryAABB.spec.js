import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	Body,
	BuiltinAdapter,
	boot,
	Container,
	Ellipse,
	Rect,
	Renderable,
	video,
	World,
} from "../src/index.js";

/**
 * Coverage for the portable `adapter.queryAABB(rect)` query exposed on
 * BuiltinAdapter (mirrors the MatterAdapter / PlanckAdapter surface).
 * Verifies:
 *  - broadphase walk surfaces the right candidate set
 *  - actual AABB filter (not just same-partition leakage)
 *  - portability-shaped edge cases (empty world, nested containers,
 *    edge-touching query, polygon vs ellipse bounds, kinematic skip)
 */

const makeRectBody = (world, x, y, w, h) => {
	const r = new Renderable(x, y, w, h);
	r.anchorPoint.set(0, 0);
	r.isKinematic = false;
	r.body = new Body(r, [new Rect(0, 0, w, h)]);
	world.addChild(r);
	return r;
};

const makeEllipseBody = (world, cx, cy, rx, ry) => {
	const r = new Renderable(cx - rx, cy - ry, rx * 2, ry * 2);
	r.anchorPoint.set(0, 0);
	r.isKinematic = false;
	r.body = new Body(r, [new Ellipse(rx, ry, rx * 2, ry * 2)]);
	world.addChild(r);
	return r;
};

const rebuildBroadphase = (world) => {
	world.broadphase.clear();
	world.broadphase.insertContainer(world);
};

describe("BuiltinAdapter.queryAABB", () => {
	let adapter;
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
		adapter = new BuiltinAdapter();
		world = new World(0, 0, 800, 600, adapter);
	});

	it("returns an empty array on an empty world", () => {
		rebuildBroadphase(world);
		const hits = adapter.queryAABB(new Rect(0, 0, 800, 600));
		expect(hits).toEqual([]);
	});

	it("returns a body whose bounds are fully inside the query", () => {
		const box = makeRectBody(world, 100, 100, 50, 50);
		rebuildBroadphase(world);

		const hits = adapter.queryAABB(new Rect(80, 80, 100, 100));
		expect(hits).toContain(box);
		expect(hits).toHaveLength(1);
	});

	it("excludes bodies that don't overlap the query rect", () => {
		const inside = makeRectBody(world, 100, 100, 50, 50);
		const outside = makeRectBody(world, 500, 400, 50, 50);
		rebuildBroadphase(world);

		const hits = adapter.queryAABB(new Rect(80, 80, 100, 100));
		expect(hits).toContain(inside);
		expect(hits).not.toContain(outside);
	});

	it("includes a body whose bounds partially overlap the query", () => {
		const box = makeRectBody(world, 100, 100, 60, 60);
		rebuildBroadphase(world);

		// Query overlaps only the lower-right corner of the box.
		const hits = adapter.queryAABB(new Rect(140, 140, 200, 200));
		expect(hits).toContain(box);
	});

	it("includes a body whose edge exactly touches the query (inclusive overlap)", () => {
		const box = makeRectBody(world, 100, 100, 50, 50);
		rebuildBroadphase(world);

		// Box right edge = 150; query left edge = 150. They touch.
		const hits = adapter.queryAABB(new Rect(150, 100, 50, 50));
		expect(hits).toContain(box);
	});

	it("returns every body when the query covers the whole world", () => {
		const a = makeRectBody(world, 50, 50, 30, 30);
		const b = makeRectBody(world, 400, 200, 30, 30);
		const c = makeRectBody(world, 700, 550, 30, 30);
		rebuildBroadphase(world);

		const hits = adapter.queryAABB(new Rect(0, 0, 800, 600));
		expect(hits).toContain(a);
		expect(hits).toContain(b);
		expect(hits).toContain(c);
		expect(hits).toHaveLength(3);
	});

	it("handles ellipse-bodied renderables (filters by AABB of the ellipse)", () => {
		const ball = makeEllipseBody(world, 200, 200, 30, 30);
		rebuildBroadphase(world);

		// Query that overlaps the ellipse's AABB
		expect(adapter.queryAABB(new Rect(180, 180, 60, 60))).toContain(ball);
		// Query entirely outside the ellipse's AABB
		expect(adapter.queryAABB(new Rect(0, 0, 50, 50))).not.toContain(ball);
	});

	it("walks nested containers via insertContainer's recursion", () => {
		const group = new Container(0, 0, 800, 600);
		const box = new Renderable(100, 100, 40, 40);
		box.anchorPoint.set(0, 0);
		box.isKinematic = false;
		box.body = new Body(box, [new Rect(0, 0, 40, 40)]);
		group.addChild(box);
		world.addChild(group);
		rebuildBroadphase(world);

		const hits = adapter.queryAABB(new Rect(90, 90, 80, 80));
		expect(hits).toContain(box);
	});

	it("skips kinematic decorations (no body, marked isKinematic=true)", () => {
		const dynamic = makeRectBody(world, 100, 100, 40, 40);
		// Plain decoration — has bounds but no body, default isKinematic=true.
		// `insertContainer` skips these so they never enter the broadphase
		// and queryAABB shouldn't see them.
		const decoration = new Renderable(120, 120, 40, 40);
		decoration.anchorPoint.set(0, 0);
		world.addChild(decoration);
		rebuildBroadphase(world);

		const hits = adapter.queryAABB(new Rect(80, 80, 100, 100));
		expect(hits).toContain(dynamic);
		expect(hits).not.toContain(decoration);
	});

	it("zero-sized query rect acts as a point query", () => {
		const box = makeRectBody(world, 100, 100, 50, 50);
		rebuildBroadphase(world);

		// Point inside the box → hit.
		expect(adapter.queryAABB(new Rect(120, 120, 0, 0))).toContain(box);
		// Point outside the box → no hit.
		expect(adapter.queryAABB(new Rect(300, 300, 0, 0))).not.toContain(box);
	});

	it("returns a fresh array (not the broadphase scratch) so callers can keep the result", () => {
		makeRectBody(world, 100, 100, 50, 50);
		rebuildBroadphase(world);

		const a = adapter.queryAABB(new Rect(80, 80, 100, 100));
		// A second query in the same frame must not mutate the first result.
		const b = adapter.queryAABB(new Rect(0, 0, 800, 600));
		expect(a).toHaveLength(1);
		expect(b).toHaveLength(1);
		expect(a).not.toBe(b);
	});
});
