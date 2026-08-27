import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Container,
	input,
	Renderable,
	video,
} from "../src/index.js";

/**
 * Pointer hit-detection against a shifted world (#1605).
 *
 * `Camera2d.localToWorld` subtracts `world.pos`, so a pointer's
 * `gameWorldX/Y` are LEVEL-LOCAL, while a non-floating renderable's bounds
 * are absolute — they include that same offset. With `world.pos` at zero the
 * two spaces coincide and nothing is wrong; move the world and every
 * non-floating region stops receiving events.
 *
 * Nothing in the engine sets `world.pos` — a game does, to centre a level —
 * so this is not specific to `flex-height`/`flex-width` despite how it was
 * found. Any non-zero world offset reaches it, which is why these tests drive
 * `world.pos` directly rather than through a scale mode.
 *
 * The fix has to hold BOTH directions: a shifted world must hit, and an
 * unshifted one must keep behaving exactly as before. Floating regions are
 * indexed in level-local space and must stay on the old path.
 */
describe("pointer events against a shifted world", () => {
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
		// browsers cap live contexts — a leak surfaces as UNRELATED specs failing
		app?.destroy();
	});

	afterEach(() => {
		app.world.reset();
		app.world.pos.set(0, 0, 0);
		app.world.broadphase.clear();
	});

	/** put a region in the world with the world shifted by `offset` */
	const place = (region, offset = [0, 0], parent = app.world) => {
		parent.addChild(region);
		app.world.pos.set(offset[0], offset[1], 0);
		region.updateBounds(true);
		app.world.broadphase.clear();
		app.world.broadphase.insertContainer(app.world);
		return region;
	};

	/** click at a CANVAS coordinate, returning the pointer the region saw */
	const clickAt = (region, x, y, type = "pointerdown") => {
		let received;
		input.registerPointerEvent(type, region, (pointer) => {
			received = pointer;
		});
		try {
			const canvas = app.renderer.getCanvas();
			const rect = canvas.getBoundingClientRect();
			canvas.dispatchEvent(
				new PointerEvent(type, {
					clientX: rect.left + (x * rect.width) / canvas.width,
					clientY: rect.top + (y * rect.height) / canvas.height,
					pointerId: 1,
					width: 1,
					height: 1,
					isPrimary: true,
					bubbles: true,
				}),
			);
		} finally {
			input.releasePointerEvent(type, region);
		}
		return received;
	};

	const box = (x, y, w = 40, h = 40) => {
		const r = new Renderable(x, y, w, h);
		r.anchorPoint.set(0, 0);
		// a kinematic renderable is skipped by hit detection entirely
		r.isKinematic = false;
		return r;
	};

	// ---- the offsets themselves -------------------------------------------

	it.for([
		{ name: "negative vertical", offset: [0, -60], at: [70, 40] },
		{ name: "negative horizontal", offset: [-60, 0], at: [40, 70] },
		{ name: "both axes", offset: [90, 120], at: [160, 190] },
		{ name: "both axes, negative", offset: [-30, -45], at: [40, 25] },
		{ name: "fractional", offset: [12.5, 7.25], at: [85, 80] },
	])("hits through a $name world offset", ({ offset, at }) => {
		// the box sits at level-local (70, 70); with the world shifted it is
		// drawn at (70 + offset) on screen, so that is where the click goes
		const region = place(box(70, 70), offset);
		expect(clickAt(region, at[0], at[1])).toBeDefined();
	});

	it("still MISSES when the pointer is outside a shifted region", () => {
		// the fix runs a second broadphase query and merges the results — the
		// hazard is that it widens the net and starts reporting hits the
		// pointer is nowhere near
		const region = place(box(70, 70), [90, 120]);
		expect(clickAt(region, 20, 20), "hit far outside").toBeUndefined();
		// just outside the far edge: 70+90+40 = 200
		expect(clickAt(region, 205, 195), "hit past the edge").toBeUndefined();
		// and just inside it, so the test cannot pass by never hitting at all
		expect(clickAt(region, 195, 195), "missed just inside").toBeDefined();
	});

	it("reports level-local world coordinates, not screen ones", () => {
		const region = place(box(70, 70), [90, 120]);
		const pointer = clickAt(region, 160, 190);
		expect(pointer).toBeDefined();
		// `gameWorldX/Y` stay in the space the game reasons in — the offset is
		// an implementation detail of where the level got drawn
		expect(pointer.gameWorldX).toBeCloseTo(70);
		expect(pointer.gameWorldY).toBeCloseTo(70);
	});

	// ---- floating regions take the other path ------------------------------

	it("hits a FLOATING region at its screen position, offset or not", () => {
		// floating regions are indexed in level-local space, so they must NOT
		// be shifted by the world offset — a HUD pinned to the screen stays put
		const hud = box(70, 70);
		hud.floating = true;
		place(hud, [90, 120]);
		expect(
			clickAt(hud, 80, 80),
			"floating region moved with the world",
		).toBeDefined();
		expect(
			clickAt(hud, 160, 190),
			"floating region hit at the shifted spot",
		).toBeUndefined();
	});

	it("treats a child of a floating container as floating", () => {
		// `isFloating` inherits from the ancestor, and the fix branches on it —
		// a child that never set `floating` itself must still take the
		// floating path, or a HUD built as a container of parts breaks
		const hud = new Container(0, 0, 200, 200);
		hud.floating = true;
		const child = box(70, 70);
		hud.addChild(child);
		place(hud, [90, 120]);
		expect(child.isFloating, "isFloating did not inherit").toBe(true);
		expect(clickAt(child, 80, 80)).toBeDefined();
	});

	// ---- composition with the rest of the scene ----------------------------

	it("composes with a nested container that has its own position", () => {
		const group = new Container(30, 40, 300, 300);
		const child = box(20, 10);
		group.addChild(child);
		place(group, [90, 120]);
		// `updateBounds` on the container does NOT recurse — without this the
		// child stays in level-local space and every hit test misses. Worth
		// knowing: it is the same trap the first draft of this spec fell into.
		child.updateBounds(true);
		app.world.broadphase.clear();
		app.world.broadphase.insertContainer(app.world);
		// world 90,120 + group 30,40 + child 20,10 = 140,170
		expect(clickAt(child, 150, 180)).toBeDefined();
		expect(clickAt(child, 100, 130), "hit outside the child").toBeUndefined();
	});

	it("composes with a scrolled camera", () => {
		const region = place(box(200, 200), [90, 120]);
		// `moveTo` clamps against the camera bounds, which default to the
		// viewport — without widening them the scroll silently does nothing
		app.viewport.setBounds(0, 0, 4000, 4000);
		app.viewport.move(50, 30);
		try {
			// camera scroll shifts what is under a screen pixel: the box is at
			// level-local 200,200, drawn at 200+90-50 = 240 / 200+120-30 = 290
			expect(clickAt(region, 250, 300)).toBeDefined();
			expect(
				clickAt(region, 300, 350),
				"hit outside after scroll",
			).toBeUndefined();
		} finally {
			app.viewport.moveTo(0, 0);
			app.viewport.setBounds(0, 0, app.viewport.width, app.viewport.height);
		}
	});

	it("picks the topmost of two overlapping regions", () => {
		// the fix merges two candidate lists and re-sorts them; a lost or
		// duplicated entry shows up as the wrong region winning
		const under = box(70, 70, 80, 80);
		const over = box(70, 70, 80, 80);
		app.world.addChild(under, 1);
		app.world.addChild(over, 5);
		app.world.pos.set(90, 120, 0);
		under.updateBounds(true);
		over.updateBounds(true);
		app.world.broadphase.clear();
		app.world.broadphase.insertContainer(app.world);

		let overHit = false;
		let underHit = false;
		input.registerPointerEvent("pointerdown", over, () => {
			overHit = true;
			return false; // consume it
		});
		input.registerPointerEvent("pointerdown", under, () => {
			underHit = true;
		});
		try {
			const canvas = app.renderer.getCanvas();
			const rect = canvas.getBoundingClientRect();
			canvas.dispatchEvent(
				new PointerEvent("pointerdown", {
					clientX: rect.left + (170 * rect.width) / canvas.width,
					clientY: rect.top + (190 * rect.height) / canvas.height,
					pointerId: 1,
					width: 1,
					height: 1,
					isPrimary: true,
					bubbles: true,
				}),
			);
		} finally {
			input.releasePointerEvent("pointerdown", over);
			input.releasePointerEvent("pointerdown", under);
		}
		expect(overHit, "the topmost region did not receive the event").toBe(true);
		expect(underHit, "the event fell through to the region underneath").toBe(
			false,
		);
	});

	it("works for pointermove too, not just pointerdown", () => {
		// NOT pointerup: a bare pointerup misses even with no world offset at
		// all — it needs a preceding pointerdown to establish the pointer —
		// so asserting on it here would pin unrelated pre-existing behaviour
		const region = place(box(70, 70), [90, 120]);
		expect(clickAt(region, 160, 190, "pointermove")).toBeDefined();
	});

	it("follows the world when the offset changes after registration", () => {
		// a game that recentres its level mid-session must not lose input
		const region = box(70, 70);
		app.world.addChild(region);
		app.world.broadphase.clear();
		app.world.broadphase.insertContainer(app.world);
		expect(clickAt(region, 80, 80), "unshifted hit").toBeDefined();

		app.world.pos.set(90, 120, 0);
		region.updateBounds(true);
		app.world.broadphase.clear();
		app.world.broadphase.insertContainer(app.world);
		expect(clickAt(region, 160, 190), "hit after recentring").toBeDefined();
		expect(
			clickAt(region, 80, 80),
			"still hitting the old spot",
		).toBeUndefined();
	});

	// ---- the unshifted path must be untouched ------------------------------

	it("leaves an unshifted world behaving exactly as before", () => {
		const region = place(box(70, 70));
		expect(app.world.pos.x, "offset leaked between tests").toBe(0);
		expect(clickAt(region, 80, 80)).toBeDefined();
		expect(clickAt(region, 200, 200)).toBeUndefined();
		const pointer = clickAt(region, 80, 80);
		expect(pointer.gameWorldX).toBeCloseTo(80);
		expect(pointer.gameWorldY).toBeCloseTo(80);
	});
});
