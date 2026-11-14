/**
 * A child leaving the world hears `onDeactivateEvent` once, as it heard
 * `onActivateEvent` once on the way in.
 *
 * A child of a container hears of its removal by two routes: its own
 * `removeChildNow`, and its container's `onDeactivateEvent`, which forwards to
 * every child. Removing a group took both, one after the other —
 * `removeChildNow(group)` called `group.onDeactivateEvent()`, which told every
 * child, then `group.destroy()` emptied the group through `removeChildNow`,
 * which told each of them again. The same on `world.reset()` (a level load, a
 * state change) for anything nested, and at every level of a deeper tree. A
 * child that pairs the two (a reference count, a listener or a light
 * registered once and released once) was released twice for being added once.
 *
 * A group removed with keepalive and added again is a new activation, so it
 * is told again on its next removal — once.
 */
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "vitest";
import {
	Application,
	boot,
	Container,
	Light2d,
	Renderable,
	state,
	video,
	World,
} from "../src/index.js";

/** a leaf that counts the lifecycle calls it receives */
class Counted extends Renderable {
	constructor() {
		super(0, 0, 8, 8);
		this.activated = 0;
		this.deactivated = 0;
	}
	onActivateEvent() {
		this.activated++;
	}
	onDeactivateEvent() {
		this.deactivated++;
	}
}

/** a container that counts its own lifecycle calls and forwards them */
class CountedGroup extends Container {
	constructor() {
		super(0, 0, 100, 100);
		this.activated = 0;
		this.deactivated = 0;
	}
	onActivateEvent() {
		this.activated++;
		super.onActivateEvent();
	}
	onDeactivateEvent() {
		this.deactivated++;
		super.onDeactivateEvent();
	}
}

/** the next tick, where a deferred `removeChild` runs */
const nextTick = () => {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
};

/** activation counts of every node, as `[activated, deactivated]` */
const counts = (...nodes) => {
	return nodes.map((n) => {
		return [n.activated, n.deactivated];
	});
};

describe("Container: onDeactivateEvent fires once per activation", () => {
	let app;
	let world;

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

	beforeEach(() => {
		world = new World(0, 0, 800, 600);
	});

	afterEach(() => {
		world.destroy();
	});

	it("removeChildNow of a group tells each child once", () => {
		const group = new Container(0, 0, 100, 100);
		const child = new Counted();
		group.addChild(child);
		world.addChild(group);
		expect(counts(child)).toEqual([[1, 0]]);

		world.removeChildNow(group);
		expect(counts(child)).toEqual([[1, 1]]);
	});

	it("deferred removeChild of a group tells each child once", async () => {
		const group = new Container(0, 0, 100, 100);
		const a = new Counted();
		const b = new Counted();
		group.addChild(a);
		group.addChild(b);
		world.addChild(group);

		world.removeChild(group);
		await nextTick();
		expect(counts(a, b)).toEqual([
			[1, 1],
			[1, 1],
		]);
	});

	it("world.reset tells a nested child once", () => {
		const group = new Container(0, 0, 100, 100);
		const child = new Counted();
		group.addChild(child);
		world.addChild(group);

		world.reset();
		expect(counts(child)).toEqual([[1, 1]]);
	});

	it("tells every level of a deep tree once, on removal and on reset", () => {
		// world > a > b > c > leaf, removed by hand
		const a = new CountedGroup();
		const b = new CountedGroup();
		const c = new CountedGroup();
		const leaf = new Counted();
		c.addChild(leaf);
		b.addChild(c);
		a.addChild(b);
		world.addChild(a);
		expect(counts(a, b, c, leaf)).toEqual([
			[1, 0],
			[1, 0],
			[1, 0],
			[1, 0],
		]);
		world.removeChildNow(a);
		expect(counts(a, b, c, leaf)).toEqual([
			[1, 1],
			[1, 1],
			[1, 1],
			[1, 1],
		]);

		// and the same tree cleared by a reset
		const a2 = new CountedGroup();
		const b2 = new CountedGroup();
		const leaf2 = new Counted();
		b2.addChild(leaf2);
		a2.addChild(b2);
		world.addChild(a2);
		world.reset();
		expect(counts(a2, b2, leaf2)).toEqual([
			[1, 1],
			[1, 1],
			[1, 1],
		]);
	});

	it("removing a child from inside a group in the world tells it once", () => {
		const group = new Container(0, 0, 100, 100);
		const child = new Counted();
		world.addChild(group);
		group.addChild(child);
		expect(counts(child)).toEqual([[1, 0]]);
		group.removeChildNow(child);
		expect(counts(child)).toEqual([[1, 1]]);
		// the group's later removal does not reach it any more
		world.removeChildNow(group);
		expect(counts(child)).toEqual([[1, 1]]);
	});

	it("keepalive, then destroy: the group's children are not told again", () => {
		const group = new CountedGroup();
		const child = new Counted();
		group.addChild(child);
		world.addChild(group);

		world.removeChildNow(group, true);
		expect(counts(group, child)).toEqual([
			[1, 1],
			[1, 1],
		]);
		// already out of the world: emptying it is not a second departure
		group.destroy();
		expect(counts(group, child)).toEqual([
			[1, 1],
			[1, 1],
		]);
	});

	it("keepalive, re-add, remove: activated again and deactivated once again", () => {
		const group = new CountedGroup();
		const inner = new CountedGroup();
		const child = new Counted();
		inner.addChild(child);
		group.addChild(inner);
		world.addChild(group);

		world.removeChildNow(group, true);
		expect(counts(group, inner, child)).toEqual([
			[1, 1],
			[1, 1],
			[1, 1],
		]);

		world.addChild(group);
		expect(counts(group, inner, child)).toEqual([
			[2, 1],
			[2, 1],
			[2, 1],
		]);

		world.removeChildNow(group);
		expect(counts(group, inner, child)).toEqual([
			[2, 2],
			[2, 2],
			[2, 2],
		]);
	});

	it("reparenting between two groups in the world pairs every call", () => {
		const left = new Container(0, 0, 100, 100);
		const right = new Container(0, 0, 100, 100);
		const child = new Counted();
		world.addChild(left);
		world.addChild(right);
		left.addChild(child);

		right.addChild(child);
		expect(counts(child)).toEqual([[2, 1]]);

		world.removeChildNow(left);
		expect(counts(child)).toEqual([[2, 1]]);
		world.removeChildNow(right);
		expect(counts(child)).toEqual([[2, 2]]);
	});

	it("a group that never entered the world tells its children nothing", () => {
		const group = new Container(0, 0, 100, 100);
		const child = new Counted();
		group.addChild(child);
		group.destroy();
		expect(counts(child)).toEqual([[0, 0]]);
	});

	it("a group that removes its own children while deactivating still tells each once", () => {
		// a cleanup override that runs AFTER the forward, then empties itself
		class SelfEmptying extends Container {
			onDeactivateEvent() {
				super.onDeactivateEvent();
				this.removeChildNow(this.getChildren()[0]);
			}
		}
		const group = new SelfEmptying(0, 0, 100, 100);
		const first = new Counted();
		const second = new Counted();
		group.addChild(first);
		group.addChild(second);
		world.addChild(group);

		world.removeChildNow(group);
		expect(counts(first, second)).toEqual([
			[1, 1],
			[1, 1],
		]);
	});

	it("a group whose override does not forward still tells its children once, on teardown", () => {
		class Silent extends Container {
			onDeactivateEvent() {
				// no super: the children are not told here
			}
		}
		const group = new Silent(0, 0, 100, 100);
		const child = new Counted();
		group.addChild(child);
		world.addChild(group);

		world.removeChildNow(group);
		expect(counts(child)).toEqual([[1, 1]]);
	});

	it("a light nested in a group unregisters on removal and registers again on re-add", () => {
		const stage = state.current();
		const group = new Container(0, 0, 100, 100);
		const inner = new Container(0, 0, 100, 100);
		const light = new Light2d(50, 50, 20);
		inner.addChild(light);
		group.addChild(inner);
		app.world.addChild(group);
		expect(stage._activeLights.has(light)).toBe(true);

		app.world.removeChildNow(group, true);
		expect(stage._activeLights.has(light)).toBe(false);

		app.world.addChild(group);
		expect(stage._activeLights.has(light)).toBe(true);

		app.world.removeChildNow(group);
		expect(stage._activeLights.has(light)).toBe(false);
	});
});
