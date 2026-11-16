/**
 * `World#setAdapter` builds every body again turned as it stood: by its angle
 * about Z, and, for a body a 3D adapter tilted (a part about X or Y), by its
 * whole rotation on an incoming adapter with `setRotation`. A body turned
 * about Z alone keeps going through `setAngle`, as before, so a 2D swap
 * never reaches `setRotation` (or the builtin's warning about it).
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
	BuiltinAdapter,
	boot,
	Quaternion,
	Rect,
	Renderable,
	Vector3d,
	video,
} from "../src/index.js";
import { resetWarnOnce } from "../src/lang/console.js";

/**
 * A builtin adapter that also holds a full 3D rotation per body, as a 3D
 * adapter does, and records the orientation calls the world makes.
 */
class Tilting extends BuiltinAdapter {
	/** @type {Map<Renderable, Quaternion>} */
	rotations = new Map();
	/** @type {string[]} */
	calls = [];
	getRotation(renderable, out) {
		const q = this.rotations.get(renderable);
		if (q === undefined) {
			return super.getRotation(renderable, out);
		}
		return (out ?? new Quaternion()).copy(q);
	}
	setRotation(renderable, q) {
		this.calls.push("setRotation");
		this.rotations.set(renderable, q.clone());
		super.setRotation(renderable, q);
	}
	setAngle(renderable, angle) {
		this.calls.push("setAngle");
		this.rotations.delete(renderable);
		super.setAngle(renderable, angle);
	}
}

/** a builtin adapter with no 3D orientation at all, as a 2D adapter */
class Flat extends BuiltinAdapter {
	/** @type {string[]} */
	calls = [];
	setAngle(renderable, angle) {
		this.calls.push("setAngle");
		super.setAngle(renderable, angle);
	}
}
Flat.prototype.getRotation = undefined;
Flat.prototype.setRotation = undefined;

const AXIS_X = new Vector3d(1, 0, 0);
const AXIS_Z = new Vector3d(0, 0, 1);

describe("World#setAdapter keeps each body's orientation", () => {
	let app;
	let warn;

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
		resetWarnOnce();
		warn = vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		warn.mockRestore();
		for (const child of [...app.world.getChildren()]) {
			app.world.removeChildNow(child);
		}
		app.world.setAdapter(new BuiltinAdapter());
	});

	const crate = () => {
		const r = new Renderable(100, 100, 32, 32);
		r.bodyDef = { type: "dynamic", shapes: [new Rect(0, 0, 32, 32)] };
		app.world.addChild(r);
		return r;
	};

	it("a 2D angle crosses through setAngle, with no warning", () => {
		const first = new Flat();
		app.world.setAdapter(first);
		const r = crate();
		first.setAngle(r, 0.5);
		const next = new Flat();
		app.world.setAdapter(next);
		expect(next.calls).toEqual(["setAngle"]);
		expect(next.getAngle(r)).toBeCloseTo(0.5, 10);
		expect(warn).not.toHaveBeenCalled();
	});

	it("a turn about Z alone uses setAngle, even between 3D adapters", () => {
		const first = new Tilting();
		app.world.setAdapter(first);
		const r = crate();
		first.setRotation(r, new Quaternion().setFromAxisAngle(AXIS_Z, 0.7));
		const next = new Tilting();
		app.world.setAdapter(next);
		expect(next.calls).toEqual(["setAngle"]);
		expect(next.getAngle(r)).toBeCloseTo(0.7, 10);
		expect(warn).not.toHaveBeenCalled();
	});

	it("an unturned body is not turned at all", () => {
		app.world.setAdapter(new Tilting());
		crate();
		const next = new Tilting();
		app.world.setAdapter(next);
		expect(next.calls).toEqual([]);
	});

	it("a tilted body keeps its whole rotation on an adapter that holds one", () => {
		const first = new Tilting();
		app.world.setAdapter(first);
		const r = crate();
		const tilt = new Quaternion()
			.setFromAxisAngle(AXIS_X, 0.4)
			.multiply(new Quaternion().setFromAxisAngle(AXIS_Z, 0.3));
		first.rotations.set(r, tilt.clone());
		const next = new Tilting();
		app.world.setAdapter(next);
		expect(next.calls).toEqual(["setRotation"]);
		const q = next.getRotation(r);
		// the same orientation (q and -q are one turn)
		expect(Math.abs(q.dot(tilt))).toBeCloseTo(1, 10);
	});

	it("a tilted body keeps its angle about Z on a 2D adapter", () => {
		const first = new Tilting();
		app.world.setAdapter(first);
		const r = crate();
		first.setAngle(r, 0.3);
		first.rotations.set(
			r,
			new Quaternion()
				.setFromAxisAngle(AXIS_Z, 0.3)
				.multiply(new Quaternion().setFromAxisAngle(AXIS_X, 0.4)),
		);
		const next = new Flat();
		app.world.setAdapter(next);
		expect(next.calls).toEqual(["setAngle"]);
		expect(next.getAngle(r)).toBeCloseTo(0.3, 10);
	});

	it("a tilted body moved to the builtin keeps its turn about Z, and says what it drops", () => {
		const first = new Tilting();
		app.world.setAdapter(first);
		const r = crate();
		// about Z first, then a tilt about the body's own X: +X stays at 0.3
		first.rotations.set(
			r,
			new Quaternion()
				.setFromAxisAngle(AXIS_Z, 0.3)
				.multiply(new Quaternion().setFromAxisAngle(AXIS_X, 0.4)),
		);
		const next = new BuiltinAdapter();
		app.world.setAdapter(next);
		expect(next.getAngle(r)).toBeCloseTo(0.3, 10);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(String(warn.mock.calls[0][0])).toMatch(/about Z only/);
	});
});
