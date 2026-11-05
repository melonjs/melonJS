/**
 * `Container#enableChildBoundsUpdate` follows children that move.
 *
 * The flag is documented as re-measuring the container from its children
 * whenever their bounds change, every update. It only did so when a child
 * was added or removed: a child that moved afterwards left the container's
 * bounds where the child had started, and the camera, which culls by those
 * bounds, stopped drawing the group — and stopped updating it, so nothing
 * inside it ever moved it back on screen.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Container,
	Renderable,
	video,
} from "../src/index.js";

/** a leaf with its anchor at the top left, so its bounds start at its pos */
const makeChild = (x, y) => {
	const child = new Renderable(x, y, 10, 10);
	child.anchorPoint.set(0, 0);
	return child;
};

/** a leaf that walks by `step` on every update */
class Walker extends Renderable {
	constructor(x, y, step) {
		super(x, y, 10, 10);
		this.anchorPoint.set(0, 0);
		this.step = step;
		this.alwaysUpdate = true;
	}
	update(dt) {
		this.pos.x += this.step;
		super.update(dt);
		return true;
	}
}

describe("Container.enableChildBoundsUpdate follows moving children", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	it("re-measures on update after a child is moved", () => {
		const group = new Container();
		group.enableChildBoundsUpdate = true;
		app.world.addChild(group);
		const child = makeChild(2000, 2000);
		group.addChild(child);
		expect(group.getBounds().left).toEqual(2000);

		// the child is carried on screen (physics, a tween, game code)
		child.pos.set(50, 60, child.pos.z);
		group.update(16);

		const b = group.getBounds();
		expect(b.left).toEqual(50);
		expect(b.top).toEqual(60);
		expect(b.right).toEqual(60);
		expect(b.bottom).toEqual(70);
		expect(app.viewport.isVisible(group)).toEqual(true);
		app.world.removeChildNow(group);
	});

	it("includes the moves the children make in their own update", () => {
		const group = new Container();
		group.enableChildBoundsUpdate = true;
		app.world.addChild(group);
		const walker = new Walker(10, 10, 5);
		group.addChild(walker);
		group.addChild(makeChild(0, 0));

		group.update(16);
		group.update(16);
		// 10 + 2 steps of 5, plus its width
		expect(group.getBounds().right).toEqual(30);
		expect(group.getBounds().left).toEqual(0);
		app.world.removeChildNow(group);
	});

	it("a culled group whose children come back into view is drawn and updated again", () => {
		const group = new Container();
		group.enableChildBoundsUpdate = true;
		app.world.addChild(group);
		const walker = new Walker(5000, 50, 0);
		group.addChild(walker);

		// off screen: culled, so its own update does not run
		app.world.update(16);
		expect(group.inViewport).toEqual(false);

		// moved back by something outside the group's update
		walker.pos.x = 50;
		app.world.update(16);
		expect(group.inViewport).toEqual(true);
		expect(walker.inViewport).toEqual(true);
		app.world.removeChildNow(group);
	});

	it("nested groups both follow a grandchild", () => {
		const outer = new Container();
		const inner = new Container();
		outer.enableChildBoundsUpdate = true;
		inner.enableChildBoundsUpdate = true;
		app.world.addChild(outer);
		outer.addChild(inner);
		const child = makeChild(3000, 3000);
		inner.addChild(child);
		inner.alwaysUpdate = true;
		expect(inner.getBounds().left).toEqual(3000);

		child.pos.set(20, 30, child.pos.z);
		outer.update(16);
		expect(inner.getBounds().left).toEqual(20);
		expect(outer.getBounds().left).toEqual(20);
		expect(outer.getBounds().top).toEqual(30);
		app.world.removeChildNow(outer);
	});

	it("a sized group keeps its own rectangle and grows to a child outside it", () => {
		const group = new Container(0, 0, 100, 100);
		group.enableChildBoundsUpdate = true;
		app.world.addChild(group);
		const child = makeChild(10, 10);
		group.addChild(child);
		expect(group.getBounds().right).toEqual(100);

		child.pos.set(150, 10, child.pos.z);
		group.update(16);
		expect(group.getBounds().left).toEqual(0);
		expect(group.getBounds().right).toEqual(160);
		app.world.removeChildNow(group);
	});

	it("left off, a group is not re-measured", () => {
		const group = new Container(0, 0, 100, 100);
		app.world.addChild(group);
		const child = makeChild(10, 10);
		group.addChild(child);
		child.pos.set(500, 10, child.pos.z);
		group.update(16);
		expect(group.getBounds().right).toEqual(100);
		app.world.removeChildNow(group);
	});
});
