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
		first.setRotation(r, new Quaternion().rotate(0.7, AXIS_Z));
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
			.rotate(0.4, AXIS_X)
			.multiply(new Quaternion().rotate(0.3, AXIS_Z));
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
				.rotate(0.3, AXIS_Z)
				.multiply(new Quaternion().rotate(0.4, AXIS_X)),
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
				.rotate(0.3, AXIS_Z)
				.multiply(new Quaternion().rotate(0.4, AXIS_X)),
		);
		const next = new BuiltinAdapter();
		app.world.setAdapter(next);
		expect(next.getAngle(r)).toBeCloseTo(0.3, 10);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(String(warn.mock.calls[0][0])).toMatch(/about Z only/);
	});
	// An adapter that turns a renderable from how it stood when its body was
	// made (Rapier 3D) would turn it twice if handed a renderable still
	// turned: the outgoing adapter turns each turned body back first.
	describe("the outgoing adapter turns a turned body back first", () => {
		it("a tilted body is turned back to unturned, before the new adapter turns it", () => {
			const first = new Tilting();
			app.world.setAdapter(first);
			const r = crate();
			const tilt = new Quaternion().rotate(0.4, AXIS_X);
			first.rotations.set(r, tilt.clone());
			const unturned = [];
			const setRotation = first.setRotation.bind(first);
			first.setRotation = (renderable, q) => {
				unturned.push([renderable, q.clone()]);
				setRotation(renderable, q);
			};
			const next = new Tilting();
			app.world.setAdapter(next);
			expect(unturned).toHaveLength(1);
			expect(unturned[0][0]).toBe(r);
			expect(unturned[0][1].equals(new Quaternion())).toBe(true);
			// and the new adapter turns it to the tilt, once
			const q = next.getRotation(r);
			expect(Math.abs(q.dot(tilt))).toBeCloseTo(1, 10);
		});

		it("a turned body on a 2D adapter is set back to angle 0", () => {
			const first = new Flat();
			app.world.setAdapter(first);
			const r = crate();
			first.setAngle(r, 0.5);
			const angles = vi.spyOn(first, "setAngle");
			app.world.setAdapter(new Flat());
			expect(angles).toHaveBeenCalledWith(r, 0);
		});

		it("an unturned body is left as it is", () => {
			const first = new Flat();
			app.world.setAdapter(first);
			crate();
			const angles = vi.spyOn(first, "setAngle");
			app.world.setAdapter(new Flat());
			expect(angles).not.toHaveBeenCalled();
		});

		it("nothing is turned back for an adapter that cannot turn it again", () => {
			const first = new Flat();
			app.world.setAdapter(first);
			const r = crate();
			first.setAngle(r, 0.5);
			const angles = vi.spyOn(first, "setAngle");
			// a builtin with no way to turn a body: the renderable stays as
			// it looks
			const stiff = new BuiltinAdapter();
			stiff.setAngle = undefined;
			stiff.setRotation = undefined;
			app.world.setAdapter(stiff);
			expect(angles).not.toHaveBeenCalled();
		});
	});
});
