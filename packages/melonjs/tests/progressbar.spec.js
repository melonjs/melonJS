import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { roundedRectanglePool } from "../src/geometries/roundrect.ts";
import {
	Application,
	boot,
	Color,
	event,
	ProgressBar,
	video,
} from "../src/index.js";
import { colorPool } from "../src/math/color.ts";

/**
 * A recording renderer.
 *
 * The same approach `nineslicesprite.spec.js` takes, and for the same reason:
 * what matters about a bar is the RECTANGLES it asks for, so capture the calls
 * and assert the geometry rather than reading pixels back. There is no shared
 * recorder helper in the suite, so this is a local one.
 * @returns the stub, with every call it received
 */
const makeRecorder = () => {
	const calls = [];
	return {
		calls,
		lineWidth: 1,
		// The real renderers keep ONE current colour, and its alpha IS the
		// global alpha, so `setColor` overwrites the alpha. Modelling that is
		// the whole point: a bar that then forced the cascade back over it
		// would render a deliberately translucent colour as opaque.
		_alpha: 1,
		globalAlpha() {
			return this._alpha;
		},
		setGlobalAlpha(a) {
			this._alpha = a;
			calls.push({ op: "setGlobalAlpha", a });
		},
		setColor(color) {
			// SNAPSHOT it: the bar resolves css strings into one cached
			// `Color` that it reuses, which is safe because both real
			// renderers `copy()` what they are handed — but it does mean a
			// recorder must not hold the reference.
			calls.push({
				op: "setColor",
				color,
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
			// radius snapshotted: the bar reuses ONE RoundRect across the
			// track and the fill, so the object cannot be read afterwards
			calls.push({ op: "fill", shape, radius: shape.radius });
		},
		stroke(shape) {
			calls.push({ op: "stroke", shape });
		},
	};
};

/**
 * Draw a bar and hand back only the rectangles.
 * @param bar - the bar to draw
 * @returns every fillRect/strokeRect it asked for, in order
 */
const rectsOf = (bar) => {
	const r = makeRecorder();
	bar.draw(r);
	return r.calls.filter((c) => {
		return c.op === "fillRect" || c.op === "strokeRect";
	});
};

describe("ProgressBar", () => {
	describe("value and ratio", () => {
		it("starts at min when no value is given", () => {
			const bar = new ProgressBar(0, 0, { width: 100, height: 10 });
			expect(bar.value).toBe(0);
			expect(bar.ratio).toBe(0);
		});

		it("clamps at both ends rather than throwing", () => {
			// the usual source is a health or a timer that has just gone past
			// its own limit, so clamping is the useful behaviour
			const bar = new ProgressBar(0, 0, { width: 100, height: 10 });
			bar.value = 5;
			expect(bar.value).toBe(1);
			bar.value = -5;
			expect(bar.value).toBe(0);
		});

		it("derives ratio against a non-default min and max", () => {
			const bar = new ProgressBar(0, 0, {
				width: 100,
				height: 10,
				min: 20,
				max: 120,
				value: 45,
			});
			expect(bar.ratio).toBeCloseTo(0.25, 6);
		});

		it("reports a zero ratio when min and max are the same", () => {
			// nothing sensible to divide by; the alternative is NaN reaching
			// the fill width
			const bar = new ProgressBar(0, 0, {
				width: 100,
				height: 10,
				min: 7,
				max: 7,
			});
			expect(bar.ratio).toBe(0);
			expect(Number.isNaN(bar.ratio)).toBe(false);
		});

		it("clamps the initial value too", () => {
			const bar = new ProgressBar(0, 0, { width: 100, height: 10, value: 9 });
			expect(bar.value).toBe(1);
		});

		it("setValue chains", () => {
			const bar = new ProgressBar(0, 0, { width: 100, height: 10 });
			expect(bar.setValue(0.5)).toBe(bar);
			expect(bar.value).toBe(0.5);
		});
	});

	describe("onChange", () => {
		it("fires when the value moves, with the value and the ratio", () => {
			const onChange = vi.fn();
			const bar = new ProgressBar(0, 0, {
				width: 100,
				height: 10,
				min: 0,
				max: 200,
				onChange,
			});
			bar.value = 50;
			expect(onChange).toHaveBeenCalledTimes(1);
			expect(onChange).toHaveBeenCalledWith(50, 0.25);
		});

		it("does NOT fire when the value is written but does not move", () => {
			const onChange = vi.fn();
			const bar = new ProgressBar(0, 0, { width: 100, height: 10, onChange });
			bar.value = 0.5;
			bar.value = 0.5;
			expect(onChange).toHaveBeenCalledTimes(1);
		});

		it("does not fire when a write clamps to the value already held", () => {
			const onChange = vi.fn();
			const bar = new ProgressBar(0, 0, {
				width: 100,
				height: 10,
				value: 1,
				onChange,
			});
			bar.value = 99;
			expect(onChange).not.toHaveBeenCalled();
		});

		it("marks the bar dirty on a real change", () => {
			const bar = new ProgressBar(0, 0, { width: 100, height: 10 });
			bar.isDirty = false;
			bar.value = 0.3;
			expect(bar.isDirty).toBe(true);
		});
	});

	describe("fill geometry", () => {
		it("grows the fill along x, proportional to the ratio", () => {
			const bar = new ProgressBar(10, 20, {
				width: 200,
				height: 16,
				value: 0.25,
				fillColor: "#fff",
			});
			const [fill] = rectsOf(bar);
			expect(fill).toMatchObject({ x: 10, y: 20, width: 50, height: 16 });
		});

		it("insets the fill by the padding, on every side", () => {
			const bar = new ProgressBar(10, 20, {
				width: 200,
				height: 16,
				value: 1,
				padding: 3,
			});
			const [fill] = rectsOf(bar);
			expect(fill).toMatchObject({
				x: 13,
				y: 23,
				width: 194,
				height: 10,
			});
		});

		it("pins the far edge when filling right to left", () => {
			const bar = new ProgressBar(0, 0, {
				width: 100,
				height: 10,
				value: 0.25,
				direction: "right-to-left",
			});
			const [fill] = rectsOf(bar);
			// 25 wide, hard against the right edge
			expect(fill.width).toBe(25);
			expect(fill.x).toBe(75);
		});

		it("fills downward for top-to-bottom", () => {
			const bar = new ProgressBar(0, 0, {
				width: 100,
				height: 40,
				value: 0.5,
				direction: "top-to-bottom",
			});
			const [fill] = rectsOf(bar);
			expect(fill).toMatchObject({ x: 0, y: 0, width: 100, height: 20 });
		});

		it("pins the bottom edge for bottom-to-top", () => {
			const bar = new ProgressBar(0, 0, {
				width: 100,
				height: 40,
				value: 0.5,
				direction: "bottom-to-top",
			});
			const [fill] = rectsOf(bar);
			expect(fill.height).toBe(20);
			expect(fill.y).toBe(20);
		});

		it("draws no fill at all at zero", () => {
			const bar = new ProgressBar(0, 0, { width: 100, height: 10, value: 0 });
			expect(rectsOf(bar)).toHaveLength(0);
		});

		it("draws no fill when the padding swallows the bar", () => {
			// a 4px bar with 3px of padding per side has nothing left
			const bar = new ProgressBar(0, 0, {
				width: 100,
				height: 4,
				value: 1,
				padding: 3,
			});
			expect(rectsOf(bar)).toHaveLength(0);
		});
	});

	describe("track, border and draw order", () => {
		it("draws the track behind the fill, full size", () => {
			const bar = new ProgressBar(5, 5, {
				width: 100,
				height: 10,
				value: 0.5,
				trackColor: "black",
			});
			const rects = rectsOf(bar);
			expect(rects).toHaveLength(2);
			// track first, at full width; fill second, at half
			expect(rects[0]).toMatchObject({ x: 5, y: 5, width: 100, height: 10 });
			expect(rects[1]).toMatchObject({ width: 50 });
		});

		it("leaves the track out entirely when it is null", () => {
			const bar = new ProgressBar(0, 0, {
				width: 100,
				height: 10,
				value: 0.5,
				trackColor: null,
			});
			// a hollow bar is one rectangle, the fill
			expect(rectsOf(bar)).toHaveLength(1);
		});

		it("draws a square border as four rects, fully INSIDE the bar", () => {
			// not `strokeRect`: a stroke is centred on the path, so half of it
			// falls outside the bar's own rectangle, and at a line width of 1
			// the backend adds no corner joins and drops a corner pixel
			const bar = new ProgressBar(10, 20, {
				width: 100,
				height: 40,
				value: 0,
				borderColor: "#fff",
				borderWidth: 2,
			});
			const rects = rectsOf(bar);
			expect(
				rects.every((r) => {
					return r.op === "fillRect";
				}),
			).toBe(true);
			expect(rects).toHaveLength(4);
			const [top, bottom, left, right] = rects;
			expect(top).toMatchObject({ x: 10, y: 20, width: 100, height: 2 });
			expect(bottom).toMatchObject({ x: 10, y: 58, width: 100, height: 2 });
			expect(left).toMatchObject({ x: 10, y: 22, width: 2, height: 36 });
			expect(right).toMatchObject({ x: 108, y: 22, width: 2, height: 36 });
			// every edge inside the bar's own rectangle
			for (const r of rects) {
				expect(r.x).toBeGreaterThanOrEqual(10);
				expect(r.y).toBeGreaterThanOrEqual(20);
				expect(r.x + r.width).toBeLessThanOrEqual(110);
				expect(r.y + r.height).toBeLessThanOrEqual(60);
			}
		});

		it("covers all four corners, which a 1px stroke does not", () => {
			// the reported defect: the top-left corner pixel went missing
			const bar = new ProgressBar(0, 0, {
				width: 50,
				height: 20,
				value: 0,
				borderColor: "#fff",
				borderWidth: 1,
			});
			const rects = rectsOf(bar);
			const covers = (px, py) => {
				return rects.some((r) => {
					return (
						px >= r.x && px < r.x + r.width && py >= r.y && py < r.y + r.height
					);
				});
			};
			expect(covers(0, 0)).toBe(true); // top-left
			expect(covers(49, 0)).toBe(true); // top-right
			expect(covers(0, 19)).toBe(true); // bottom-left
			expect(covers(49, 19)).toBe(true); // bottom-right
		});

		it("still strokes when the bar is rounded, since arcs have no rect form", () => {
			const bar = new ProgressBar(0, 0, {
				width: 100,
				height: 20,
				value: 0,
				radius: 6,
				borderColor: "#fff",
			});
			const r = makeRecorder();
			bar.draw(r);
			expect(
				r.calls.some((c) => {
					return c.op === "stroke";
				}),
			).toBe(true);
		});

		it("draws the border LAST, over the track and the fill", () => {
			const bar = new ProgressBar(0, 0, {
				width: 100,
				height: 10,
				value: 0.5,
				trackColor: "black",
				fillColor: "#4a8fd4",
				borderColor: "#fff",
				borderWidth: 1,
			});
			const r = makeRecorder();
			bar.draw(r);
			const colors = r.calls
				.filter((c) => {
					return c.op === "setColor";
				})
				.map((c) => {
					return c.hex.toLowerCase();
				});
			expect(colors).toEqual(["#000000", "#4a8fd4", "#ffffff"]);
		});

		it("restores the renderer's lineWidth after stroking", () => {
			const bar = new ProgressBar(0, 0, {
				width: 100,
				height: 10,
				borderColor: "#fff",
				borderWidth: 7,
			});
			const r = makeRecorder();
			r.lineWidth = 3;
			bar.draw(r);
			expect(r.lineWidth).toBe(3);
		});

		it("multiplies the colour's own alpha into the cascade", () => {
			// `setColor` overwrites the global alpha with the colour's, so a
			// bar that then forced the cascaded value back would render a
			// deliberately translucent track as solid
			const bar = new ProgressBar(0, 0, {
				width: 100,
				height: 10,
				value: 1,
				trackColor: "rgba(0, 0, 0, 0.2)",
			});
			const r = makeRecorder();
			r._alpha = 0.5; // what a half-faded parent cascaded down
			bar.draw(r);
			const applied = r.calls
				.filter((c) => {
					return c.op === "setGlobalAlpha";
				})
				.map((c) => {
					return c.a;
				});
			// 0.2 from the colour, 0.5 from the cascade
			expect(applied[0]).toBeCloseTo(0.1, 6);
		});

		it("does not leak one colour's alpha into the next", () => {
			// a renderer holds one current colour, so a six digit hex does not
			// reset its alpha. Reading the alpha back after `setColor` to
			// compute the next one therefore carried the track's transparency
			// into the fill, and every bar with a translucent track rendered
			// washed out.
			const bar = new ProgressBar(0, 0, {
				width: 100,
				height: 10,
				value: 1,
				trackColor: "rgba(0, 0, 0, 0.2)", // translucent
				fillColor: "#4a8fd4", // fully opaque
				borderColor: "rgba(255, 255, 255, 0.5)",
			});
			const r = makeRecorder();
			bar.draw(r);
			const applied = r.calls
				.filter((c) => {
					return c.op === "setGlobalAlpha";
				})
				.map((c) => {
					return c.a;
				});
			expect(applied[0]).toBeCloseTo(0.2, 6); // track
			expect(applied[1]).toBeCloseTo(1, 6); // fill, NOT 0.2
			expect(applied[2]).toBeCloseTo(0.5, 6); // border
		});

		it("re-applies the alpha after every setColor, not just the first", () => {
			// one `setGlobalAlpha` per `setColor`, or the second shape inherits
			// the first colour's alpha
			const bar = new ProgressBar(0, 0, {
				width: 100,
				height: 10,
				value: 0.5,
				trackColor: "black",
				borderColor: "#fff",
			});
			const r = makeRecorder();
			r._alpha = 0.4;
			bar.draw(r);
			const colors = r.calls.filter((c) => {
				return c.op === "setColor";
			}).length;
			const alphas = r.calls.filter((c) => {
				return c.op === "setGlobalAlpha";
			});
			expect(colors).toBe(3);
			expect(alphas).toHaveLength(3);
			// opaque colours, so each one lands back on the cascade itself
			for (const a of alphas) {
				expect(a.a).toBeCloseTo(0.4, 6);
			}
		});

		it("reads fillColor at draw time, so a mutated Color animates it", () => {
			// this is what lets a caller drive the colour from the value
			// without the bar knowing any rule about it
			const live = new Color().parseCSS("#ff0000");
			const bar = new ProgressBar(0, 0, {
				width: 100,
				height: 10,
				value: 1,
				fillColor: live,
			});
			let r = makeRecorder();
			bar.draw(r);
			expect(
				r.calls.find((c) => {
					return c.op === "setColor";
				}).color.r,
			).toBe(255);

			live.parseCSS("#0000ff");
			r = makeRecorder();
			bar.draw(r);
			const used = r.calls.find((c) => {
				return c.op === "setColor";
			}).color;
			expect(used.r).toBe(0);
			expect(used.b).toBe(255);
		});
	});

	describe("rounded corners", () => {
		it("goes through the shape path instead of fillRect", () => {
			// `fillRoundRect` lives on the concrete renderers, so the portable
			// route is the shape dispatch
			const bar = new ProgressBar(0, 0, {
				width: 100,
				height: 20,
				value: 1,
				radius: 6,
			});
			const r = makeRecorder();
			bar.draw(r);
			expect(
				r.calls.some((c) => {
					return c.op === "fill";
				}),
			).toBe(true);
			expect(
				r.calls.some((c) => {
					return c.op === "fillRect";
				}),
			).toBe(false);
		});

		it("gives the fill a tighter radius, so it is concentric with the track", () => {
			// a shape inset by `padding` has to lose `padding` from its corner
			// radius too, or it reads as proportionally rounder than the thing
			// it sits inside
			const bar = new ProgressBar(0, 0, {
				width: 100,
				height: 20,
				value: 1,
				radius: 6,
				padding: 2,
				trackColor: "black",
			});
			const r = makeRecorder();
			bar.draw(r);
			const radii = r.calls
				.filter((c) => {
					return c.op === "fill";
				})
				.map((c) => {
					return c.radius;
				});
			expect(radii[0]).toBe(6); // the track, at the bar's own radius
			expect(radii[1]).toBe(4); // the fill, tighter by the padding
		});

		it("never gives the fill a negative radius", () => {
			// padding deeper than the radius would otherwise go through zero
			const bar = new ProgressBar(0, 0, {
				width: 100,
				height: 40,
				value: 1,
				radius: 2,
				padding: 8,
			});
			const r = makeRecorder();
			bar.draw(r);
			const fill = r.calls.find((c) => {
				return c.op === "fill" || c.op === "fillRect";
			});
			// falls back to a square fill rather than an inverted curve
			expect(fill.op).toBe("fillRect");
		});

		it("reuses one RoundRect across draws rather than allocating", () => {
			const bar = new ProgressBar(0, 0, {
				width: 100,
				height: 20,
				value: 1,
				radius: 6,
				trackColor: "black",
			});
			const r = makeRecorder();
			bar.draw(r);
			const shapes = r.calls
				.filter((c) => {
					return c.op === "fill";
				})
				.map((c) => {
					return c.shape;
				});
			expect(shapes).toHaveLength(2);
			expect(shapes[0]).toBe(shapes[1]);
		});
	});

	describe("bindEvent", () => {
		it("takes its value from the event it was bound to", () => {
			const bar = new ProgressBar(0, 0, {
				width: 100,
				height: 10,
				bindEvent: event.LOADER_PROGRESS,
			});
			event.emit(event.LOADER_PROGRESS, 0.42, null);
			expect(bar.value).toBeCloseTo(0.42, 6);
			bar.destroy();
		});

		it("STOPS listening once destroyed", () => {
			// the whole reason the subscription lives on the bar rather than
			// on whoever made it: a listener that outlives its target goes on
			// writing into a renderable whose `pos` has already been released,
			// which is a TypeError somewhere far from the cause
			const bar = new ProgressBar(0, 0, {
				width: 100,
				height: 10,
				bindEvent: event.LOADER_PROGRESS,
			});
			event.emit(event.LOADER_PROGRESS, 0.5, null);
			expect(bar.value).toBe(0.5);

			bar.destroy();
			expect(() => {
				event.emit(event.LOADER_PROGRESS, 0.9, null);
			}).not.toThrow();
			expect(bar.value).toBe(0.5);
		});

		it("is inert when no event was named", () => {
			const bar = new ProgressBar(0, 0, { width: 100, height: 10 });
			event.emit(event.LOADER_PROGRESS, 0.7, null);
			expect(bar.value).toBe(0);
			bar.destroy();
		});

		it("still reports through onChange when driven by an event", () => {
			const onChange = vi.fn();
			const bar = new ProgressBar(0, 0, {
				width: 100,
				height: 10,
				bindEvent: event.LOADER_PROGRESS,
				onChange,
			});
			event.emit(event.LOADER_PROGRESS, 0.25, null);
			expect(onChange).toHaveBeenCalledWith(0.25, 0.25);
			bar.destroy();
		});
	});

	describe("the optional label", () => {
		// a label is a `Text`, and `Text` resolves a renderer at construction,
		// so these need a live application where the geometry tests do not
		let app;
		let bar;
		beforeAll(async () => {
			boot();
			app = new Application(800, 600, {
				parent: "screen",
				scale: "auto",
				renderer: video.CANVAS,
			});
			await app.init();
			bar = new ProgressBar(0, 0, {
				width: 100,
				height: 20,
				min: 0,
				max: 50,
				value: 25,
				showLabel: true,
			});
		});

		afterAll(() => {
			app?.destroy();
		});

		it("defaults to a rounded percentage", () => {
			expect(bar.label._text.join("\n")).toBe("50%");
		});

		it("follows the value", () => {
			bar.value = 10;
			expect(bar.label._text.join("\n")).toBe("20%");
		});

		it("sizes itself from the bar's height, as a whole number", () => {
			// 24 * 0.7 is 16.799999999999997, and a fractional size renders
			// softer than a whole one as well as reading back oddly
			const bar = new ProgressBar(0, 0, {
				width: 100,
				height: 24,
				showLabel: true,
			});
			expect(bar.label.fontSize).toBe(17);
			expect(bar.label.font).toBe("17px sans-serif");
		});

		it("never goes below 8, however short the bar", () => {
			const tiny = new ProgressBar(0, 0, {
				width: 100,
				height: 4,
				showLabel: true,
			});
			expect(tiny.label.fontSize).toBe(8);
		});

		it("uses an explicit fontSize exactly as given", () => {
			const bar = new ProgressBar(0, 0, {
				width: 100,
				height: 24,
				showLabel: true,
				fontSize: 11.5,
			});
			expect(bar.label.fontSize).toBe(11.5);
		});

		it("is absent unless asked for", () => {
			const plain = new ProgressBar(0, 0, { width: 10, height: 10 });
			expect(plain.label).toBeUndefined();
		});

		it("takes a custom format, given the value and the ratio", () => {
			const hp = new ProgressBar(0, 0, {
				width: 100,
				height: 20,
				min: 0,
				max: 120,
				value: 90,
				showLabel: true,
				labelFormat: (v, ratio) => {
					return `${v} of 120 (${Math.round(ratio * 100)}%)`;
				},
			});
			expect(hp.label._text.join("\n")).toBe("90 of 120 (75%)");
		});
	});

	// A bar borrows a scratch Color and, when it is rounded, a RoundRect, and
	// holds both for its lifetime rather than fetching one per draw. Holding
	// them is only correct if it also gives them back.
	describe("pooled borrowings", () => {
		it("gives its scratch colour back on destroy", () => {
			// two go out, not one: `Renderable` borrows its own `tint` as well,
			// so what is asserted is the round trip rather than the count
			const before = colorPool.used();
			const bar = new ProgressBar(0, 0, { width: 40, height: 8 });
			expect(colorPool.used()).toBeGreaterThan(before);
			bar.draw(makeRecorder());
			bar.destroy();
			expect(colorPool.used()).toBe(before);
		});

		it("gives its rounded path back on destroy", () => {
			const bar = new ProgressBar(0, 0, {
				width: 40,
				height: 8,
				radius: 3,
				value: 0.5,
			});
			const before = roundedRectanglePool.used();
			bar.draw(makeRecorder());
			expect(roundedRectanglePool.used()).toBe(before + 1);
			bar.destroy();
			expect(roundedRectanglePool.used()).toBe(before);
		});

		it("borrows no shape at all when it is square", () => {
			const bar = new ProgressBar(0, 0, { width: 40, height: 8, value: 0.5 });
			const before = roundedRectanglePool.used();
			bar.draw(makeRecorder());
			expect(roundedRectanglePool.used()).toBe(before);
			bar.destroy();
		});

		it("borrows one shape however many frames it draws", () => {
			const bar = new ProgressBar(0, 0, {
				width: 40,
				height: 8,
				radius: 3,
				value: 0.5,
			});
			const before = roundedRectanglePool.used();
			for (let i = 0; i < 10; i++) {
				bar.value = i / 10;
				bar.draw(makeRecorder());
			}
			expect(roundedRectanglePool.used()).toBe(before + 1);
			bar.destroy();
			expect(roundedRectanglePool.used()).toBe(before);
		});
	});
});
