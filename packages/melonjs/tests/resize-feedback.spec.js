import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { onresize } from "../src/application/resize.ts";
import { Application, boot, video } from "../src/index.js";

/**
 * Regression spec for #1231 — the canvas slowly grows on every window
 * resize event when the canvas container is nested inside a wrapper with
 * no fixed CSS dimensions.
 *
 * The auto-scale path measures the grandparent's border-box rect. When
 * that ancestor is auto-sized, its rect is derived from the canvas itself
 * plus layout chrome (its padding/border, and the baseline gap of the
 * default `display: inline` canvas) — so every resize pass re-adds that
 * chrome to the canvas size: a monotone growth loop.
 */
describe("Auto-scale resize feedback (#1231)", () => {
	let outer;

	beforeAll(() => {
		boot();
	});

	afterEach(() => {
		if (outer?.parentNode) {
			outer.parentNode.removeChild(outer);
		}
		outer = undefined;
	});

	function makeApp() {
		// wrapper with NO fixed dimensions (auto-sizes around its children)
		// plus padding — the exact layout shape from the issue report
		outer = document.createElement("div");
		outer.style.padding = "8px";
		const inner = document.createElement("div");
		outer.appendChild(inner);
		document.body.appendChild(outer);

		return new Application(100, 30, {
			parent: inner,
			renderer: video.CANVAS,
			scale: "auto",
			consoleHeader: false,
		});
	}

	it("canvas CSS size reaches a fixed point instead of growing per resize", () => {
		const app = makeApp();
		const canvas = app.renderer.getCanvas();

		onresize(app); // settle once
		const w1 = parseFloat(canvas.style.width);
		const h1 = parseFloat(canvas.style.height);

		for (let i = 0; i < 5; i++) {
			onresize(app);
		}

		expect(parseFloat(canvas.style.width)).toBeCloseTo(w1, 1);
		expect(parseFloat(canvas.style.height)).toBeCloseTo(h1, 1);
	});

	it("the engine-inserted canvas defaults to display:block (no baseline gap)", () => {
		const app = makeApp();
		expect(app.renderer.getCanvas().style.display).toBe("block");
	});
});
