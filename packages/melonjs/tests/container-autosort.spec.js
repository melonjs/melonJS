/**
 * `Container#autoSort` on an `"x"` or `"y"` sort: the container keeps its
 * children in order every frame, as they move.
 *
 * What has to hold:
 *   - a child that moved is put back in order by the container's next update,
 *     after physics and the children's own updates, and not before
 *   - however it moved, change notification or not (`pos.setMuted`)
 *   - a frame where nothing moved sorts nothing, and leaves the container
 *     clean, so a still scene is not redrawn because of it
 *   - one sort per update, however many children moved; drawing never sorts
 *   - a `"z"` sort is unchanged: a new `depth` still waits for `sort()`
 *   - with `autoSort` off, the order is left alone
 *
 * Order is read as the children array, topmost first (`Container.draw`
 * walks it backwards, so index 0 is drawn last).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	Application,
	boot,
	Container,
	Renderable,
	video,
} from "../src/index.js";

describe("Container#autoSort keeps an x / y sort in order", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	const box = (name, x, y) => {
		const r = new Renderable(x, y, 10, 10);
		r.anchorPoint.set(0, 0);
		r.name = name;
		return r;
	};

	/** a container sorted on `sortOn`, holding `children` at depth 0, sorted */
	const sorted = (sortOn, ...children) => {
		const c = new Container(0, 0, 1000, 1000);
		c.sortOn = sortOn;
		for (const child of children) {
			c.addChild(child, 0);
		}
		c.sortNow();
		// drop the sort `addChild` queued for the next tick, so that nothing
		// sorts behind a test's back
		clearTimeout(c.pendingSort);
		c.pendingSort = null;
		c.isDirty = false;
		return c;
	};

	const topFirst = (c) => {
		return c.getChildren().map((child) => {
			return child.name;
		});
	};

	it("puts a child that moved back in order at the next update, not before", () => {
		const walker = box("walker", 0, 10);
		const c = sorted("y", walker, box("wall", 0, 30));
		expect(topFirst(c)).toEqual(["wall", "walker"]);
		walker.pos.y = 50; // walks in front of the wall
		expect(topFirst(c)).toEqual(["wall", "walker"]);
		c.update(16);
		expect(topFirst(c)).toEqual(["walker", "wall"]);
		walker.pos.y = 10; // and back behind it
		c.update(16);
		expect(topFirst(c)).toEqual(["wall", "walker"]);
	});

	it("does the same along x on an x sort", () => {
		const walker = box("walker", 10, 0);
		const c = sorted("x", walker, box("post", 30, 0));
		walker.pos.x = 50;
		c.update(16);
		expect(topFirst(c)).toEqual(["walker", "post"]);
	});

	it("catches a move made without a change notification", () => {
		// nothing is listening for moves: the order is checked every frame
		const walker = box("walker", 0, 10);
		const c = sorted("y", walker, box("wall", 0, 30));
		walker.pos.setMuted(0, 50, 0);
		c.update(16);
		expect(topFirst(c)).toEqual(["walker", "wall"]);
	});

	it("orders a child that moves in its own update within the same frame", () => {
		const walker = box("walker", 0, 10);
		walker.alwaysUpdate = true;
		walker.update = () => {
			walker.pos.y = 50;
			return true;
		};
		const c = sorted("y", walker, box("wall", 0, 30));
		c.update(16);
		expect(topFirst(c)).toEqual(["walker", "wall"]);
	});

	it("sorts nothing, and leaves the container clean, when nothing moved", () => {
		const c = sorted("y", box("a", 0, 10), box("b", 0, 30), box("c", 0, 20));
		const children = c.getChildren();
		// a still scene: nothing left to redraw from before
		for (const child of children) {
			child.isDirty = false;
		}
		const sort = vi.spyOn(children, "sort");
		c.update(16);
		c.update(16);
		expect(sort).not.toHaveBeenCalled();
		expect(Boolean(c.isDirty)).toBe(false);
		sort.mockRestore();
	});

	it("sorts once per update however many children moved, and marks it for redraw", () => {
		const kids = [box("a", 0, 10), box("b", 0, 20), box("c", 0, 30)];
		const c = sorted("y", ...kids);
		const sort = vi.spyOn(c.getChildren(), "sort");
		kids[0].pos.y = 90;
		kids[1].pos.y = 80;
		kids[2].pos.y = 5;
		c.update(16);
		expect(sort).toHaveBeenCalledTimes(1);
		expect(topFirst(c)).toEqual(["a", "b", "c"]);
		expect(c.isDirty).toBe(true);
		sort.mockRestore();
	});

	it("never sorts when drawing, however many cameras draw it", () => {
		const walker = box("walker", 0, 10);
		const c = sorted("y", walker, box("wall", 0, 30));
		const sort = vi.spyOn(c.getChildren(), "sort");
		walker.pos.y = 50;
		c.draw(app.renderer, app.viewport);
		c.draw(app.renderer, app.viewport);
		expect(sort).not.toHaveBeenCalled();
		sort.mockRestore();
	});

	it("leaves a z sort as it was: a new depth still waits for sort()", () => {
		const a = box("a", 0, 0);
		const b = box("b", 0, 0);
		const c = new Container(0, 0, 1000, 1000);
		c.sortOn = "z";
		c.addChild(a, 1);
		c.addChild(b, 2);
		c.sortNow();
		a.depth = 5;
		c.update(16);
		expect(topFirst(c)).toEqual(["b", "a"]);
		c.sortNow();
		expect(topFirst(c)).toEqual(["a", "b"]);
	});

	it("leaves the order alone with autoSort off", () => {
		const walker = box("walker", 0, 10);
		const c = sorted("y", walker, box("wall", 0, 30));
		c.autoSort = false;
		walker.pos.y = 50;
		c.update(16);
		expect(topFirst(c)).toEqual(["wall", "walker"]);
	});

	it("keeps a nested y-sorted container in order when its parent updates it", () => {
		const walker = box("walker", 0, 10);
		const inner = sorted("y", walker, box("wall", 0, 30));
		inner.alwaysUpdate = true;
		const outer = new Container(0, 0, 1000, 1000);
		outer.addChild(inner, 0);
		walker.pos.y = 50;
		outer.update(16);
		expect(topFirst(inner)).toEqual(["walker", "wall"]);
	});
});
