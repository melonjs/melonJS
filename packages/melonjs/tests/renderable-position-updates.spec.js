import { beforeAll, describe, expect, it, vi } from "vitest";
import {
	Application,
	boot,
	Container,
	Renderable,
	Vector2d,
	video,
} from "../src/index.js";

/**
 * Moving a renderable the ways games do, and what each move does to its
 * bounds.
 *
 * `pos` and `anchorPoint` report every write to their renderable, which runs
 * `updateBounds()`: that is how the bounds keep up with a moving object. These
 * cases move one the ways the examples do (`pos.x =`, `pos.x +=`, `pos.set`,
 * `setPosition`, `add`, `setMuted`, `anchorPoint.set`), inside a container that
 * is itself offset, and check after each move both where the bounds are and
 * how many times they were recomputed: once per write, once per batched call,
 * never for `setMuted`.
 *
 * Each catches a different mistake in how a write is reported: a report that
 * goes missing (the bounds stay behind), one sent before the value is stored
 * (the bounds trail by one move), one sent twice, or one sent per coordinate
 * (a `set` recomputing three or four times).
 */
describe("moving a renderable keeps its bounds up to date", () => {
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

	// a 32 x 16 renderable at (10, 20), centred anchor, in a container at (100, 50)
	const setup = () => {
		const parent = new Container(100, 50, 400, 300);
		const child = new Renderable(10, 20, 32, 16);
		parent.addChild(child);
		child.updateBounds();
		const updates = vi.spyOn(child, "updateBounds");
		return { child, updates };
	};

	// the absolute position, less the anchor offset
	const expectBoundsAt = (child, x, y) => {
		const b = child.getBounds();
		expect(b.left).toBe(100 + x - 32 * child.anchorPoint.x);
		expect(b.top).toBe(50 + y - 16 * child.anchorPoint.y);
		expect(b.width).toBe(32);
		expect(b.height).toBe(16);
	};

	it("a write to one coordinate moves the bounds at once, with one recompute", () => {
		const { child, updates } = setup();

		child.pos.x = 30;
		expect(updates).toHaveBeenCalledTimes(1);
		expectBoundsAt(child, 30, 20);

		child.pos.y = 45;
		expect(updates).toHaveBeenCalledTimes(2);
		expectBoundsAt(child, 30, 45);
	});

	it("moving by a speed every frame keeps the bounds with the object", () => {
		const { child, updates } = setup();

		for (let frame = 1; frame <= 60; frame++) {
			child.pos.x += 2;
			child.pos.y -= 1;
			expectBoundsAt(child, 10 + 2 * frame, 20 - frame);
		}
		expect(updates).toHaveBeenCalledTimes(120);
	});

	it("set, setPosition and add move every coordinate with one recompute", () => {
		const { child, updates } = setup();

		child.pos.set(40, 60, 0);
		expect(updates).toHaveBeenCalledTimes(1);
		expectBoundsAt(child, 40, 60);

		child.setPosition(70, 80);
		expect(updates).toHaveBeenCalledTimes(2);
		expectBoundsAt(child, 70, 80);

		child.pos.add(new Vector2d(5, -5));
		expect(updates).toHaveBeenCalledTimes(3);
		expectBoundsAt(child, 75, 75);
	});

	it("setMuted moves the object without a recompute, until one is asked for", () => {
		const { child, updates } = setup();

		child.pos.setMuted(200, 100, 0);
		expect(updates).not.toHaveBeenCalled();
		expectBoundsAt(child, 10, 20);

		child.updateBounds();
		expectBoundsAt(child, 200, 100);
	});

	it("anchorPoint.set moves the bounds around the same position, with one recompute", () => {
		const { child, updates } = setup();

		child.anchorPoint.set(0, 0);
		expect(updates).toHaveBeenCalledTimes(1);
		expect(child.getBounds().left).toBe(110);
		expect(child.getBounds().top).toBe(70);

		child.anchorPoint.x = 1;
		expect(updates).toHaveBeenCalledTimes(2);
		expect(child.getBounds().left).toBe(78);
	});

	it("an object that moves itself in update() keeps its bounds through the game loop", () => {
		class Walker extends Renderable {
			constructor() {
				super(100, 100, 32, 16);
			}
			update() {
				this.pos.x += 2;
				return true;
			}
		}
		const walker = new Walker();
		app.world.addChild(walker);

		for (let frame = 0; frame < 30; frame++) {
			app.world.update(16);
		}
		expect(walker.pos.x).toBe(160);
		expect(walker.getBounds().left).toBe(160 - 16);
		expect(walker.getBounds().top).toBe(100 - 8);

		app.world.removeChildNow(walker);
	});

	it("an anchorPoint kept after destroy() refuses to be used", () => {
		const renderable = new Renderable(0, 0, 8, 8);
		const anchor = renderable.anchorPoint;
		renderable.destroy();

		expect(() => {
			return anchor.x;
		}).toThrow(TypeError);
		expect(() => {
			anchor.x = 1;
		}).toThrow(TypeError);
		expect(() => {
			anchor.set(1, 1);
		}).toThrow(TypeError);
	});
});
