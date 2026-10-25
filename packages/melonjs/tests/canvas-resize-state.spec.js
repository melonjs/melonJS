import { beforeAll, describe, expect, it } from "vitest";
import { boot, Color } from "../src/index.js";
import CanvasRenderer from "../src/video/canvas/canvas_renderer.js";

/**
 * Resizing a canvas resets its 2D context to the defaults. The Canvas
 * renderer keeps its drawing state in that context, so a resize used to
 * drop it: image smoothing came back on, which drew an `antiAlias: false`
 * game smoothed, with seams where smoothing took in a tileset's spacing.
 */
describe("CanvasRenderer: a resize keeps the drawing state", () => {
	beforeAll(async () => {
		await boot();
	});

	/**
	 * a 2x1 source: one black texel, one white
	 * @returns {HTMLCanvasElement} the source
	 */
	function blackWhite() {
		const source = document.createElement("canvas");
		source.width = 2;
		source.height = 1;
		const context = source.getContext("2d");
		context.fillStyle = "#000";
		context.fillRect(0, 0, 1, 1);
		context.fillStyle = "#fff";
		context.fillRect(1, 0, 1, 1);
		return source;
	}

	/**
	 * the red channel along the first row after drawing the 2x1 source
	 * stretched to 16 pixels wide
	 * @param {CanvasRenderer} renderer - the renderer to draw with
	 * @returns {number[]} 16 red values
	 */
	function stretched(renderer) {
		renderer.drawImage(blackWhite(), 0, 0, 2, 1, 0, 0, 16, 1);
		const data = renderer.getContext().getImageData(0, 0, 16, 1).data;
		const row = [];
		for (let x = 0; x < 16; x++) {
			row.push(data[x * 4]);
		}
		return row;
	}

	it("antiAlias: false still draws unsmoothed after a resize", () => {
		const renderer = new CanvasRenderer({
			width: 8,
			height: 8,
			antiAlias: false,
		});
		renderer.resize(32, 32);
		expect(renderer.getContext().imageSmoothingEnabled).toBe(false);
		// two flat halves, nothing in between
		const row = stretched(renderer);
		expect(
			row.slice(0, 8).every((red) => {
				return red === 0;
			}),
		).toBe(true);
		expect(
			row.slice(8).every((red) => {
				return red === 255;
			}),
		).toBe(true);
	});

	it("CONTROL: the same draw smoothed blends the two texels", () => {
		const renderer = new CanvasRenderer({
			width: 8,
			height: 8,
			antiAlias: true,
		});
		renderer.resize(32, 32);
		expect(renderer.getContext().imageSmoothingEnabled).toBe(true);
		const row = stretched(renderer);
		expect(
			row.some((red) => {
				return red > 0 && red < 255;
			}),
		).toBe(true);
	});

	it("keeps the blend mode, color and line width, join and dash", () => {
		const renderer = new CanvasRenderer({ width: 8, height: 8 });
		renderer.setBlendMode("multiply");
		renderer.setColor(new Color(255, 0, 0, 1));
		renderer.lineWidth = 5;
		renderer.lineJoin = "bevel";
		renderer.setLineDash([4, 2]);
		renderer.resize(24, 16);
		const context = renderer.getContext();
		expect(context.globalCompositeOperation).toBe("multiply");
		expect(renderer.currentBlendMode).toBe("multiply");
		expect(context.fillStyle).toBe("#ff0000");
		expect(context.strokeStyle).toBe("#ff0000");
		expect(renderer.lineWidth).toBe(5);
		expect(renderer.lineJoin).toBe("bevel");
		expect(context.getLineDash()).toEqual([4, 2]);
	});

	it("keeps a gradient set as the color", () => {
		const renderer = new CanvasRenderer({ width: 8, height: 8 });
		const gradient = renderer.createLinearGradient(0, 0, 8, 0);
		gradient.addColorStop(0, "#ff0000");
		gradient.addColorStop(1, "#0000ff");
		renderer.setColor(gradient);
		renderer.resize(16, 16);
		expect(renderer.renderState.currentGradient).toBe(gradient);
		expect(renderer.getContext().fillStyle).toBeInstanceOf(CanvasGradient);
	});

	it("leaves the context alone when the size does not change", () => {
		const renderer = new CanvasRenderer({ width: 8, height: 8 });
		const canvas = renderer.getCanvas();
		renderer.resize(canvas.width, canvas.height);
		// a context nobody reset keeps what was drawn on it
		renderer.setColor("#00ff00");
		renderer.fillRect(0, 0, 8, 8);
		renderer.resize(canvas.width, canvas.height);
		const data = renderer.getContext().getImageData(4, 4, 1, 1).data;
		expect(Array.from(data)).toEqual([0, 255, 0, 255]);
	});
});
