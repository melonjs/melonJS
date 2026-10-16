import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Application, boot, Renderable, UIPanel, video } from "../src/index.js";

/**
 * A recording renderer.
 *
 * The same approach `progressbar.spec.js` takes, and for the same reason: what
 * matters about a panel is the RECTANGLES it asks for, so capture the calls and
 * assert the geometry rather than reading pixels back.
 * @returns the stub, with every call it received
 */
const makeRecorder = () => {
	const calls = [];
	return {
		calls,
		lineWidth: 1,
		// The real renderers keep ONE current colour, and its alpha IS the
		// global alpha, so `setColor` overwrites the alpha. Modelling that is
		// the point: a panel that forced the cascade back over it would render
		// a deliberately translucent fill as opaque.
		_alpha: 1,
		globalAlpha() {
			return this._alpha;
		},
		setGlobalAlpha(a) {
			this._alpha = a;
			calls.push({ op: "setGlobalAlpha", a });
		},
		setColor(color) {
			calls.push({
				op: "setColor",
				hex: typeof color === "string" ? color : (color.toHex?.() ?? ""),
			});
		},
		fillRect(x, y, width, height) {
			calls.push({ op: "fillRect", x, y, width, height });
		},
		strokeRect(x, y, width, height) {
			calls.push({ op: "strokeRect", x, y, width, height });
		},
		fill(shape) {
			calls.push({
				op: "fill",
				x: shape.pos.x,
				y: shape.pos.y,
				width: shape.width,
				height: shape.height,
				radius: shape.radius,
			});
		},
		stroke(shape) {
			// Snapshotted field by field: ONE RoundRect is reused for the
			// background and the border, so the object read after the draw
			// holds whatever the LAST caller left in it. `lineWidth` too,
			// because the border puts it back before the draw returns.
			calls.push({
				op: "stroke",
				x: shape.pos.x,
				y: shape.pos.y,
				width: shape.width,
				height: shape.height,
				radius: shape.radius,
				lineWidth: this.lineWidth,
			});
		},
		// what `Container.draw` touches on the way to the children
		translate(x, y) {
			calls.push({ op: "translate", x, y });
		},
		clipRect() {},
		clearColor() {},
	};
};

/**
 * Draw a panel and hand back every call it made.
 * @param panel - the panel to draw
 * @param cascade - the inherited global alpha
 * @returns the recorder
 */
const drawn = (panel, cascade = 1) => {
	const r = makeRecorder();
	r._alpha = cascade;
	panel.draw(r);
	return r;
};

describe("UIPanel", () => {
	describe("placement", () => {
		it("anchors top LEFT, so a panel lands where it was put", () => {
			// Inherited from `Container`, which pins the anchor itself, rather
			// than set here: this asserts the CONTRACT a panel relies on, so
			// it would catch a panel reparented onto `Renderable`, where the
			// default is centred and a screen-sized panel centred on the
			// screen would land in the corner. The behaviour it guards is
			// pinned separately by "fills its rectangle at its own position".
			const panel = new UIPanel(10, 20, { width: 100, height: 40 });
			expect(panel.anchorPoint.x).toBe(0);
			expect(panel.anchorPoint.y).toBe(0);
		});

		it("takes its size from the settings, not from its children", () => {
			// `getBounds()` is what the pointer dispatcher hit-tests, so with
			// child bounds folded in, a label overhanging the edge would make
			// a blocking panel swallow clicks OUTSIDE the rectangle it drew.
			const panel = new UIPanel(0, 0, { width: 100, height: 40 });
			expect(panel.enableChildBoundsUpdate).toBe(false);

			const overhang = new Renderable(0, 0, 400, 400);
			panel.addChild(overhang);
			panel.updateBounds?.(true);
			expect(panel.getBounds().width).toBe(100);
			expect(panel.getBounds().height).toBe(40);
		});

		it("asks for a capture when a post effect is on it", () => {
			// a panel draws with PRIMITIVES, which go through a batcher that
			// never reads `customShader`, so a post effect would silently do
			// nothing on the fast path
			const panel = new UIPanel(0, 0, { width: 10, height: 10 });
			expect(panel.postEffectNeedsCapture).toBe(true);
		});
	});

	describe("background and border", () => {
		it("fills its rectangle at its own position", () => {
			const panel = new UIPanel(10, 20, {
				width: 100,
				height: 40,
				fillColor: "#123456",
			});
			const fills = drawn(panel).calls.filter((c) => {
				return c.op === "fillRect";
			});
			expect(fills).toEqual([
				{ op: "fillRect", x: 10, y: 20, width: 100, height: 40 },
			]);
		});

		it("draws nothing for a null fill", () => {
			const panel = new UIPanel(0, 0, {
				width: 100,
				height: 40,
				fillColor: null,
				borderColor: null,
			});
			const painted = drawn(panel).calls.filter((c) => {
				return c.op === "fillRect" || c.op === "fill";
			});
			expect(painted).toHaveLength(0);
		});

		it("draws a square border as four fills that tile the frame", () => {
			// not `strokeRect`: a stroke is centred on the path, so half of it
			// would fall outside the panel, and the renderers only generate
			// corner joins ABOVE a line width of one
			const panel = new UIPanel(0, 0, {
				width: 100,
				height: 20,
				fillColor: null,
				borderColor: "#fff",
				borderWidth: 2,
			});
			const r = drawn(panel);
			expect(
				r.calls.some((c) => {
					return c.op === "strokeRect";
				}),
			).toBe(false);
			const fills = r.calls.filter((c) => {
				return c.op === "fillRect";
			});
			expect(
				fills.map(({ x, y, width, height }) => {
					return { x, y, width, height };
				}),
			).toEqual([
				{ x: 0, y: 0, width: 100, height: 2 }, // top
				{ x: 0, y: 18, width: 100, height: 2 }, // bottom
				{ x: 0, y: 2, width: 2, height: 16 }, // left
				{ x: 98, y: 2, width: 2, height: 16 }, // right
			]);
		});

		it("covers all four corners exactly once", () => {
			// Once, not twice: `setColor` puts a colour's own alpha into the
			// global alpha, so overlapping pieces would blend twice and a
			// translucent border would come out darker at the corners than
			// along the sides.
			const panel = new UIPanel(0, 0, {
				width: 50,
				height: 20,
				fillColor: null,
				borderColor: "#fff",
				borderWidth: 1,
			});
			const fills = drawn(panel).calls.filter((c) => {
				return c.op === "fillRect";
			});
			const covering = (px, py) => {
				return fills.filter((f) => {
					return (
						px >= f.x && px < f.x + f.width && py >= f.y && py < f.y + f.height
					);
				}).length;
			};
			for (const [px, py] of [
				[0, 0],
				[49, 0],
				[0, 19],
				[49, 19],
			]) {
				expect(covering(px, py)).toBe(1);
			}
		});

		it("insets a rounded border by half its width, so it lands INSIDE", () => {
			const panel = new UIPanel(0, 0, {
				width: 100,
				height: 20,
				fillColor: null,
				borderColor: "#fff",
				borderWidth: 4,
				radius: 6,
			});
			const border = drawn(panel).calls.find((c) => {
				return c.op === "stroke";
			});
			expect(border).toMatchObject({
				x: 2,
				y: 2,
				width: 96,
				height: 16,
				radius: 4,
				lineWidth: 4,
			});
		});

		it("restores the renderer's lineWidth after stroking", () => {
			// `RenderState.save()` does not stack `lineWidth`, so a panel that
			// left it set would make everything stroked after it in the frame
			// as thick as its own border.
			const panel = new UIPanel(0, 0, {
				width: 100,
				height: 20,
				borderColor: "#fff",
				borderWidth: 5,
				radius: 6,
			});
			const r = makeRecorder();
			r.lineWidth = 3;
			panel.draw(r);
			expect(r.lineWidth).toBe(3);
		});

		it("draws the border over the fill", () => {
			const panel = new UIPanel(0, 0, {
				width: 100,
				height: 20,
				fillColor: "#000000",
				borderColor: "#ffffff",
			});
			const colors = drawn(panel)
				.calls.filter((c) => {
					return c.op === "setColor";
				})
				.map((c) => {
					return c.hex.toLowerCase();
				});
			expect(colors).toEqual(["#000000", "#ffffff"]);
		});
	});

	describe("alpha", () => {
		it("multiplies a colour's own alpha into the cascade", () => {
			const panel = new UIPanel(0, 0, {
				width: 100,
				height: 20,
				fillColor: "rgba(0, 0, 0, 0.5)",
				borderColor: null,
			});
			const applied = drawn(panel, 0.5)
				.calls.filter((c) => {
					return c.op === "setGlobalAlpha";
				})
				.map((c) => {
					return c.a;
				});
			// 0.5 asked for, 0.5 inherited
			expect(applied[0]).toBeCloseTo(0.25, 6);
		});

		it("hands the children the cascade, not the fill's alpha", () => {
			// Otherwise a label on a translucent card is faded by the card.
			const panel = new UIPanel(0, 0, {
				width: 100,
				height: 20,
				fillColor: "rgba(0, 0, 0, 0.2)",
				borderColor: null,
			});
			const r = drawn(panel, 0.8);
			const alphas = r.calls.filter((c) => {
				return c.op === "setGlobalAlpha";
			});
			expect(alphas[alphas.length - 1].a).toBeCloseTo(0.8, 6);
			// and it is put back BEFORE the children are reached
			const lastAlpha = r.calls.lastIndexOf(alphas[alphas.length - 1]);
			const toChildren = r.calls.findIndex((c) => {
				return c.op === "translate";
			});
			expect(lastAlpha).toBeLessThan(toChildren);
		});
	});

	describe("bob", () => {
		// `Container.update` reads `state.current().cameras`, so stepping a
		// panel needs a live application where drawing one does not
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

		/**
		 * Step a panel and report where the bob put it.
		 * @param panel - the panel to step
		 * @param dt - milliseconds to advance
		 * @returns the y the panel drew its background at
		 */
		const stepTo = (panel, dt) => {
			panel.update(dt);
			const r = drawn(panel);
			const t = r.calls.find((c) => {
				return c.op === "translate";
			});
			return t === undefined ? 0 : t.y;
		};

		it("is off by default, and costs a still panel no translate", () => {
			const panel = new UIPanel(0, 0, {
				width: 100,
				height: 40,
				fillColor: "#fff",
			});
			expect(panel.bobAmplitude).toBe(0);
			// the ONLY translate a still panel makes is the container's own,
			// which carries its position, so a bob of 0 adds nothing
			const translates = drawn(panel).calls.filter((c) => {
				return c.op === "translate";
			});
			expect(translates).toHaveLength(1);
			expect(translates[0]).toMatchObject({ x: 0, y: 0 });
		});

		it("rises before it sinks", () => {
			// A panel that drops first reads as falling, not floating.
			const panel = new UIPanel(0, 0, {
				width: 100,
				height: 40,
				bobAmplitude: 4,
				bobPeriod: 1000,
			});
			expect(stepTo(panel, 100)).toBeLessThan(0);
		});

		it("reaches the amplitude at a quarter cycle and comes back", () => {
			const panel = new UIPanel(0, 0, {
				width: 100,
				height: 40,
				bobAmplitude: 4,
				bobPeriod: 1000,
			});
			expect(stepTo(panel, 250)).toBeCloseTo(-4, 6); // top
			expect(stepTo(panel, 250)).toBeCloseTo(0, 6); // through the middle
			expect(stepTo(panel, 250)).toBeCloseTo(4, 6); // bottom
			expect(stepTo(panel, 250)).toBeCloseTo(0, 6); // home
		});

		it("takes the children with it", () => {
			// The translate goes in BEFORE the container translates to its own
			// position, so everything inside moves as one.
			const panel = new UIPanel(0, 0, {
				width: 100,
				height: 40,
				fillColor: "#fff",
				bobAmplitude: 4,
				bobPeriod: 1000,
			});
			panel.update(250);
			const translates = drawn(panel).calls.filter((c) => {
				return c.op === "translate";
			});
			expect(translates).toHaveLength(2);
			expect(translates[0].y).toBeCloseTo(-4, 6); // the bob
			expect(translates[1]).toMatchObject({ x: 0, y: 0 }); // to the children
		});

		it("moves the hit area with the bob, and leaves pos alone", () => {
			// The two halves of the bargain this widget settled on. `pos` is
			// the resting place a caller set and must stay readable; the
			// BOUNDS are what the pointer dispatcher hit-tests, so they have
			// to track what is on screen or the panel answers somewhere it is
			// not.
			const panel = new UIPanel(10, 20, {
				width: 100,
				height: 40,
				bobAmplitude: 4,
				bobPeriod: 1000,
			});
			panel.update(250); // the top of the cycle
			expect(panel.pos.y).toBe(20);
			expect(panel.getBounds().top).toBe(16);
			// and the size is still the size
			expect(panel.getBounds().width).toBe(100);
			expect(panel.getBounds().height).toBe(40);
		});

		it("survives a caller moving it while the bob runs", () => {
			// A bob implemented by writing `pos` eats this: the next frame
			// reassigns from its own stale rest value and the write is gone.
			const panel = new UIPanel(10, 20, {
				width: 100,
				height: 40,
				bobAmplitude: 4,
				bobPeriod: 1000,
			});
			panel.update(250);
			panel.pos.y = 300;
			panel.update(16);
			expect(panel.pos.y).toBe(300);
		});

		it("puts the bounds back when the bob is switched off", () => {
			// Otherwise the hit area stays parked wherever the sine stopped.
			const panel = new UIPanel(10, 20, {
				width: 100,
				height: 40,
				bobAmplitude: 4,
				bobPeriod: 1000,
			});
			panel.update(250);
			expect(panel.getBounds().top).toBe(16);
			panel.bobAmplitude = 0;
			panel.update(16);
			expect(panel.getBounds().top).toBe(20);
		});

		it("costs a still panel no bounds work at all", () => {
			// The walk is gated on the OFFSET changing, not on the bob being
			// configured, so a panel without one never pays.
			const panel = new UIPanel(0, 0, { width: 100, height: 40 });
			const spy = vi.spyOn(panel, "updateBounds");
			for (let i = 0; i < 100; i++) {
				panel.update(16);
			}
			expect(spy).not.toHaveBeenCalled();
		});

		it("refuses to divide by a period of zero", () => {
			// NaN here is not a cosmetic bug: one `translate` by NaN writes it
			// into the transform and the GPU clips away every vertex under it,
			// so the panel would silently vanish.
			for (const bobPeriod of [0, -1000]) {
				const panel = new UIPanel(0, 0, {
					width: 100,
					height: 40,
					bobAmplitude: 4,
					bobPeriod,
				});
				const y = stepTo(panel, 250);
				expect(Number.isNaN(y)).toBe(false);
				expect(y).toBe(0);
			}
		});

		it("keeps its clock bounded over a long session", () => {
			const panel = new UIPanel(0, 0, {
				width: 100,
				height: 40,
				bobAmplitude: 4,
				bobPeriod: 1000,
			});
			for (let i = 0; i < 2000; i++) {
				panel.update(16);
			}
			// The CLOCK, not the offset it produces: a sine is bounded
			// whether or not the clock behind it wraps, so asserting on the
			// offset here would pass against a counter climbing for ever.
			expect(panel._bobTime).toBeLessThan(1000);
			expect(panel._bobTime).toBeGreaterThanOrEqual(0);
			expect(Math.abs(stepTo(panel, 16))).toBeLessThanOrEqual(4);
		});

		it("reports itself dirty while it is moving", () => {
			// Otherwise a panel on an otherwise static screen would never be
			// redrawn, and the bob would not be visible at all.
			const still = new UIPanel(0, 0, { width: 10, height: 10 });
			const bobbing = new UIPanel(0, 0, {
				width: 10,
				height: 10,
				bobAmplitude: 4,
			});
			// Cleared first: a renderable is born dirty, because it has not
			// been drawn yet, and `postDraw` is what settles it. What is being
			// asserted is that a bob keeps ASKING to be redrawn where a still
			// panel stops.
			still.isDirty = false;
			bobbing.isDirty = false;
			expect(still.update(16)).toBe(false);
			expect(bobbing.update(16)).toBe(true);
		});
	});

	describe("pointer events", () => {
		it("swallows clicks by default, so a dialog masks the game", () => {
			// returning false is how `UIBaseElement` consumes
			const panel = new UIPanel(0, 0, { width: 10, height: 10 });
			expect(panel.blocking).toBe(true);
			expect(panel.onClick()).toBe(false);
			expect(panel.onRelease()).toBe(false);
			expect(panel.onOver()).toBe(false);
		});

		it("lets them through when told to", () => {
			const panel = new UIPanel(0, 0, {
				width: 10,
				height: 10,
				blocking: false,
			});
			expect(panel.onClick()).toBe(true);
			expect(panel.onRelease()).toBe(true);
			expect(panel.onOver()).toBe(true);
		});

		it("consumes the release as well as the press", () => {
			// Taking the press and leaving the release is half a block: the
			// pointer-up still reaches whatever is under the dialog, so a
			// button there completes an interaction it never began.
			const panel = new UIPanel(0, 0, { width: 10, height: 10 });
			expect(panel.onRelease()).toBe(false);
		});

		it("is not kinematic, so it receives events at all", () => {
			const panel = new UIPanel(0, 0, { width: 10, height: 10 });
			expect(panel.isKinematic).toBe(false);
		});
	});

	describe("teardown", () => {
		it("survives a destroy with a rounded shape borrowed", () => {
			const panel = new UIPanel(0, 0, {
				width: 20,
				height: 20,
				fillColor: "#fff",
				radius: 4,
			});
			drawn(panel);
			expect(() => {
				panel.destroy();
			}).not.toThrow();
			// and again: `destroy` is reached twice when a parent destroys a
			// child it is also removing
			expect(() => {
				panel.onDestroyEvent();
			}).not.toThrow();
		});
	});
});
