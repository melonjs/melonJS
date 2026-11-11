/**
 * `World#setAdapter`: replacing the physics adapter of a running world.
 *
 * The outgoing adapter loses every body the engine registered, at any depth,
 * and is destroyed before the incoming one is initialised; the incoming one
 * then builds every body again from its renderable's `bodyDef`. `world.adapter`
 * is read-only, the `Application` constructor installs its adapter through
 * the same method, and a swap asked for during a physics step waits for the
 * step to end.
 */
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import {
	Application,
	Body,
	BuiltinAdapter,
	boot,
	Container,
	Rect,
	Renderable,
	Vector2d,
	video,
	World,
} from "../src/index.js";

/**
 * A minimal adapter that records what the world asks of it.
 * @param {string} label - its `physicLabel`
 */
const recorder = (label) => {
	return {
		physicLabel: label,
		capabilities: {},
		gravity: new Vector2d(0, 0),
		/** @type {Array<string>} */
		log: [],
		/** @type {Set<Renderable>} */
		held: new Set(),
		world: undefined,
		init(world) {
			this.world = world;
			this.log.push("init");
		},
		destroy() {
			this.log.push("destroy");
			this.held.clear();
		},
		step() {
			this.log.push("step");
		},
		syncFromPhysics() {
			this.log.push("sync");
		},
		addBody(renderable) {
			this.held.add(renderable);
			this.log.push(`add ${renderable.name}`);
			const body = { owner: label };
			renderable.body = body;
			return body;
		},
		removeBody(renderable) {
			if (this.held.delete(renderable)) {
				this.log.push(`remove ${renderable.name}`);
			}
		},
	};
};

/**
 * The names of the renderables an adapter holds a body for, sorted.
 * @param {{ held: Set<Renderable> }} adapter
 */
const names = (adapter) => {
	return [...adapter.held]
		.map((r) => {
			return r.name;
		})
		.sort();
};

const withBodyDef = (name) => {
	const r = new Renderable(0, 0, 16, 16);
	r.name = name;
	r.bodyDef = { type: "dynamic", shapes: [new Rect(0, 0, 16, 16)] };
	return r;
};

describe("World#setAdapter", () => {
	let app;
	/** @type {World} */
	let world;
	let top;
	let inner;
	let deep;

	beforeAll(async () => {
		boot();
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
			consoleHeader: false,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	beforeEach(() => {
		world = new World(0, 0, 320, 240);
		// one body at the top, one in a group, one in a group in a group
		top = withBodyDef("top");
		inner = withBodyDef("inner");
		deep = withBodyDef("deep");
		const group = new Container(0, 0, 320, 240);
		const subgroup = new Container(0, 0, 320, 240);
		subgroup.addChild(deep);
		group.addChild(inner);
		group.addChild(subgroup);
		world.addChild(top);
		world.addChild(group);
	});

	afterEach(() => {
		world.destroy();
	});

	it("world.adapter is read-only", () => {
		const before = world.adapter;
		expect(() => {
			world.adapter = recorder("other");
		}).toThrow(TypeError);
		expect(world.adapter).toBe(before);
	});

	it("moves every body, at any depth, to the new adapter", () => {
		const first = recorder("first");
		const second = recorder("second");
		world.setAdapter(first);
		expect(names(first)).toEqual(["deep", "inner", "top"]);

		world.setAdapter(second);
		expect(world.adapter).toBe(second);
		expect(world.physic).toBe("second");
		// the old simulation lost all three, then was destroyed
		expect(first.log.slice(-4).sort()).toEqual([
			"destroy",
			"remove deep",
			"remove inner",
			"remove top",
		]);
		expect(first.log.at(-1)).toBe("destroy");
		// the new one was initialised before it built any body
		expect(second.log[0]).toBe("init");
		expect(second.world).toBe(world);
		expect(names(second)).toEqual(["deep", "inner", "top"]);
		expect(deep.body.owner).toBe("second");
	});

	it("a body removed after the swap leaves the new adapter", () => {
		const first = recorder("first");
		const second = recorder("second");
		world.setAdapter(first);
		world.setAdapter(second);
		first.log.length = 0;
		world.removeChildNow(top);
		expect(second.held.has(top)).toBe(false);
		expect(second.log).toContain("remove top");
		expect(first.log).toEqual([]);
	});

	it("swaps back to the built-in adapter with fresh bodies", () => {
		const builtin = world.adapter;
		world.setAdapter(recorder("other"));
		expect(builtin.bodies.size).toBe(0);

		const next = new BuiltinAdapter();
		world.setAdapter(next);
		expect(world.physic).toBe("builtin");
		expect(next.bodies.size).toBe(3);
		for (const r of [top, inner, deep]) {
			expect(r.body).toBeInstanceOf(Body);
			expect(next.bodies.has(r.body)).toBe(true);
		}
	});

	it("an adapter reused after it was swapped out works again", () => {
		const first = recorder("first");
		const second = recorder("second");
		world.setAdapter(first);
		world.setAdapter(second);
		world.setAdapter(first);
		expect(world.adapter).toBe(first);
		expect(first.held.size).toBe(3);
		expect(second.held.size).toBe(0);
	});

	it("a switch after start-up names the new adapter in the console", () => {
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		try {
			// a running game with the console header on
			world.app = { isInitialized: true, settings: { consoleHeader: true } };
			world.setAdapter(recorder("second"));
			expect(spy).toHaveBeenCalledWith("physics: second");
		} finally {
			spy.mockRestore();
		}
	});

	it("an adapter package introduces itself once, then physics names the active one", () => {
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		try {
			world.app = { isInitialized: true, settings: { consoleHeader: true } };
			const named = () => {
				return Object.assign(recorder("named"), {
					name: "@test/named-adapter",
					version: "1.2.3",
					url: "https://example.com/named",
				});
			};
			world.setAdapter(named());
			world.setAdapter(recorder("other"));
			world.setAdapter(named());
			const lines = spy.mock.calls.map((args) => {
				return args.join(" ");
			});
			expect(lines).toEqual([
				"@test/named-adapter 1.2.3 | https://example.com/named",
				"physics: named",
				"physics: other",
				"physics: named",
			]);
		} finally {
			spy.mockRestore();
		}
	});

	it("but not before start-up, nor with the console header off", () => {
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		try {
			// before `app.init()`: the start-up banner names the adapter then
			world.app = { isInitialized: false, settings: { consoleHeader: true } };
			world.setAdapter(recorder("second"));
			world.app = { isInitialized: true, settings: { consoleHeader: false } };
			world.setAdapter(recorder("third"));
			expect(spy).not.toHaveBeenCalled();
		} finally {
			spy.mockRestore();
		}
	});

	it("setting the active adapter again does nothing", () => {
		const first = recorder("first");
		world.setAdapter(first);
		first.log.length = 0;
		world.setAdapter(first);
		expect(first.log).toEqual([]);
	});

	it("a swap asked for during a step happens once the step ends", () => {
		const first = recorder("first");
		const second = recorder("second");
		world.setAdapter(first);
		let during;
		first.step = function () {
			this.log.push("step");
			world.setAdapter(second);
			during = world.adapter;
		};
		first.log.length = 0;
		world.step(16);
		// still the stepping adapter inside the step, and it finished it
		expect(during).toBe(first);
		expect(first.log[0]).toBe("step");
		expect(first.log[1]).toBe("sync");
		expect(first.log.at(-1)).toBe("destroy");
		// then the swap
		expect(world.adapter).toBe(second);
		expect(second.held.size).toBe(3);
		expect(second.log).not.toContain("step");
	});

	it("the World constructor installs its adapter through setAdapter", () => {
		const spy = vi.spyOn(World.prototype, "setAdapter");
		try {
			const custom = recorder("custom");
			const w = new World(0, 0, 100, 100, custom);
			expect(spy).toHaveBeenCalledWith(custom);
			expect(w.adapter).toBe(custom);
			expect(w.physic).toBe("custom");
			expect(custom.log).toEqual(["init"]);
			w.destroy();
		} finally {
			spy.mockRestore();
		}
	});

	it("the Application constructor installs its physic adapter through setAdapter", () => {
		const spy = vi.spyOn(World.prototype, "setAdapter");
		const custom = recorder("custom");
		let other;
		try {
			other = new Application(64, 64, {
				parent: "screen",
				renderer: video.CANVAS,
				consoleHeader: false,
				physic: custom,
			});
			expect(spy).toHaveBeenCalledWith(custom);
			expect(other.world.adapter).toBe(custom);
			expect(other.world.physic).toBe("custom");
			expect(custom.log).toEqual(["init"]);
		} finally {
			spy.mockRestore();
			other?.destroy();
		}
	});
});
