/**
 * A renderable given a body through its `bodyDef` stops being kinematic, on
 * any adapter.
 *
 * `isKinematic` keeps a renderable out of pointer events and the broadphase.
 * The built-in `Body` constructor clears it, but the other adapters build no
 * `Body`, so under them a renderable with a body stayed kinematic and its
 * pointer handlers never fired. Registration now clears it for every adapter.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Container,
	Rect,
	Renderable,
	Vector2d,
	video,
	World,
} from "../src/index.js";

// an adapter that, like matter or planck, builds no built-in `Body`
const foreignAdapter = () => {
	return {
		physicLabel: "foreign",
		capabilities: {},
		gravity: new Vector2d(0, 0),
		step() {},
		syncFromPhysics() {},
		addBody(renderable) {
			const body = { foreign: true };
			renderable.body = body;
			return body;
		},
		removeBody() {},
	};
};

const withBodyDef = () => {
	const r = new Renderable(0, 0, 16, 16);
	r.bodyDef = { type: "dynamic", shapes: [new Rect(0, 0, 16, 16)] };
	return r;
};

describe("a bodyDef clears isKinematic on every adapter", () => {
	let app;

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

	it("an adapter that builds no Body", () => {
		const world = new World(0, 0, 320, 240, foreignAdapter());
		const r = withBodyDef();
		expect(r.isKinematic).toBe(true);
		world.addChild(r);
		expect(r.body.foreign).toBe(true);
		expect(r.isKinematic).toBe(false);
		world.destroy();
	});

	it("at any depth", () => {
		const world = new World(0, 0, 320, 240, foreignAdapter());
		const r = withBodyDef();
		const group = new Container(0, 0, 320, 240);
		group.addChild(r);
		world.addChild(group);
		expect(r.isKinematic).toBe(false);
		world.destroy();
	});

	it("the built-in adapter, as before", () => {
		const world = new World(0, 0, 320, 240);
		const r = withBodyDef();
		world.addChild(r);
		expect(r.isKinematic).toBe(false);
		world.destroy();
	});

	it("a renderable without a body stays kinematic", () => {
		const world = new World(0, 0, 320, 240, foreignAdapter());
		const r = new Renderable(0, 0, 16, 16);
		world.addChild(r);
		expect(r.isKinematic).toBe(true);
		world.destroy();
	});
});
