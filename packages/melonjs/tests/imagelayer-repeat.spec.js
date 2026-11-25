import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	ImageLayer,
	loader,
	state,
	TileMap,
	video,
} from "../src/index.js";
import { copyFrame } from "./helpers/pixels.js";

/**
 * An image layer draws its picture as its `repeat` says: over the whole view,
 * along one axis only, or once. The frames are compared, pixel by pixel, with
 * the same picture painted with a 2D canvas: where the picture is not, the
 * background shows, on every renderer.
 */

const WIDTH = 320;
const HEIGHT = 240;
const BACKGROUND = "#101830";

/** a picture where no two neighbours are of one color, edges included */
const picture = (width, height) => {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const c = canvas.getContext("2d");
	const data = c.createImageData(width, height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const at = (y * width + x) * 4;
			data.data[at] = 60 + ((x * 37) % 180);
			data.data[at + 1] = 60 + ((y * 53) % 180);
			data.data[at + 2] = 60 + (((x + y) * 29) % 180);
			data.data[at + 3] = 255;
		}
	}
	c.putImageData(data, 0, 0);
	return canvas;
};

const SMALL = picture(64, 32);
// larger than the view, both ways
const LARGE = picture(400, 300);

/**
 * what the frame has to be: the picture at a place of the view, repeated as
 * asked, over the background
 */
const reference = (image, repeat, x, y) => {
	const canvas = document.createElement("canvas");
	canvas.width = WIDTH;
	canvas.height = HEIGHT;
	const c = canvas.getContext("2d", { willReadFrequently: true });
	c.fillStyle = BACKGROUND;
	c.fillRect(0, 0, WIDTH, HEIGHT);
	const repeatX = repeat === "repeat" || repeat === "repeat-x";
	const repeatY = repeat === "repeat" || repeat === "repeat-y";
	const along = (start, size, span, repeated) => {
		if (!repeated) {
			return [start];
		}
		const places = [];
		for (
			let at = start - Math.ceil(start / size) * size - size;
			at < span;
			at += size
		) {
			places.push(at);
		}
		return places;
	};
	for (const py of along(y, image.height, HEIGHT, repeatY)) {
		for (const px of along(x, image.width, WIDTH, repeatX)) {
			c.drawImage(image, px, py);
		}
	}
	return c.getImageData(0, 0, WIDTH, HEIGHT).data;
};

/** how two frames differ: the count of pixels, and the first of them */
const difference = (got, expected) => {
	let count = 0;
	let first = "";
	for (let at = 0; at < expected.length; at += 4) {
		if (
			Math.abs(got[at] - expected[at]) > 2 ||
			Math.abs(got[at + 1] - expected[at + 1]) > 2 ||
			Math.abs(got[at + 2] - expected[at + 2]) > 2
		) {
			if (count === 0) {
				const p = at / 4;
				first = `at ${p % WIDTH}, ${Math.floor(p / WIDTH)}: drawn ${[got[at], got[at + 1], got[at + 2]]}, expected ${[expected[at], expected[at + 1], expected[at + 2]]}`;
			}
			count += 1;
		}
	}
	return count === 0
		? "the same"
		: `${count} pixels differ, the first ${first}`;
};

const REPEATS = ["no-repeat", "repeat-x", "repeat-y", "repeat"];

describe.each([
	["Canvas", video.CANVAS],
	["WebGL", video.WEBGL],
])("an image layer's repeat (%s)", (label, renderer) => {
	let app;

	const draw = () => {
		app.world.update(16);
		app.viewport.update(16);
		app.repaint();
		app.draw();
		return copyFrame(app.renderer).data;
	};

	beforeAll(async () => {
		boot();
		app = new Application(WIDTH, HEIGHT, {
			parent: "screen",
			renderer,
			consoleHeader: false,
			antiAlias: false,
		});
		await app.init();
		state.change(state.DEFAULT, true);
		app.reset();
		await loader.load({
			name: "picture-small",
			type: "image",
			src: SMALL.toDataURL("image/png"),
		});
		await loader.load({
			name: "picture-large",
			type: "image",
			src: LARGE.toDataURL("image/png"),
		});
	});

	afterAll(() => {
		loader.unloadAll();
		app?.destroy();
	});

	/** an empty world, its background shown, the camera free to go anywhere */
	const clear = () => {
		app.world.reset();
		app.world.pos.set(0, 0);
		app.world.backgroundColor.parseCSS(BACKGROUND);
		app.viewport.setBounds(-4000, -4000, 8000, 8000);
		app.viewport.moveTo(0, 0);
	};

	beforeEach(clear);

	/** an image layer in the world */
	const show = (image, repeat, x = 0, y = 0, extra = {}) => {
		const layer = new ImageLayer(x, y, { image, repeat, z: 1, ...extra });
		app.world.addChild(layer, 1);
		return layer;
	};

	it("uses the renderer asked for", () => {
		expect(app.renderer.type.toLowerCase()).toContain(
			label === "Canvas" ? "canvas" : "webgl",
		);
	});

	describe.each(REPEATS)("%s", (repeat) => {
		it("draws the picture at the view's corner, and the background elsewhere", () => {
			show("picture-small", repeat);
			expect(difference(draw(), reference(SMALL, repeat, 0, 0))).toBe(
				"the same",
			);
		});

		it("draws it where the layer is put", () => {
			show("picture-small", repeat, 24, 16);
			expect(difference(draw(), reference(SMALL, repeat, 24, 16))).toBe(
				"the same",
			);
		});

		it("draws it partly out of the view, on any side", () => {
			for (const [x, y] of [
				[-20, -10],
				[WIDTH - 30, HEIGHT - 12],
				[-40, HEIGHT - 20],
			]) {
				clear();
				show("picture-small", repeat, x, y);
				expect(
					difference(draw(), reference(SMALL, repeat, x, y)),
					`at ${x}, ${y}`,
				).toBe("the same");
			}
		});

		it("follows the camera, at the layer's ratio", () => {
			for (const [ratio, view] of [
				[1, [10, 6]],
				[0.5, [40, 20]],
				[0.25, [-80, 120]],
				[1, [-33, -17]],
			]) {
				clear();
				show("picture-small", repeat, 24, 16, { ratio });
				app.viewport.moveTo(view[0], view[1]);
				expect(
					difference(
						draw(),
						reference(
							SMALL,
							repeat,
							24 - ratio * view[0],
							16 - ratio * view[1],
						),
					),
					`ratio ${ratio}, camera at ${view}`,
				).toBe("the same");
			}
		});

		it("draws all of a picture larger than the view, as the camera goes over it", () => {
			for (const view of [
				[0, 0],
				[60, 40],
				[80, 60],
				[-50, -30],
			]) {
				clear();
				show("picture-large", repeat);
				app.viewport.moveTo(view[0], view[1]);
				expect(
					difference(draw(), reference(LARGE, repeat, -view[0], -view[1])),
					`camera at ${view}`,
				).toBe("the same");
			}
		});
	});

	it("covers only the picture's own pixels when it is not repeated", () => {
		show("picture-small", "no-repeat", 24, 16);
		const frame = draw();
		const clear = reference(SMALL, "no-repeat", -1000, -1000);
		let drawn = 0;
		for (let at = 0; at < frame.length; at += 4) {
			if (
				frame[at] !== clear[at] ||
				frame[at + 1] !== clear[at + 1] ||
				frame[at + 2] !== clear[at + 2]
			) {
				drawn += 1;
			}
		}
		expect(drawn).toBe(SMALL.width * SMALL.height);
	});

	describe("read from a Tiled map", () => {
		let serial = 0;
		const mapOf = (layer) => {
			return new TileMap(`image-layer-map-${serial++}`, {
				type: "map",
				version: "1.10",
				tiledversion: "1.10.2",
				orientation: "orthogonal",
				renderorder: "right-down",
				infinite: false,
				width: 4,
				height: 2,
				tilewidth: 16,
				tileheight: 16,
				tilesets: [],
				layers: [
					{
						type: "imagelayer",
						name: "picture",
						image: "picture-small",
						visible: true,
						opacity: 1,
						...layer,
					},
				],
			});
		};

		it.each([
			[
				"the `repeat` property set to no-repeat",
				{ properties: { repeat: "no-repeat" } },
				"no-repeat",
			],
			["Tiled's repeat x alone", { repeatx: true }, "repeat-x"],
			["Tiled's repeat y alone", { repeaty: true }, "repeat-y"],
			["Tiled's repeat x and y", { repeatx: true, repeaty: true }, "repeat"],
		])("%s", (name, settings, repeat) => {
			mapOf({ offsetx: 24, offsety: 16, ...settings }).addTo(
				app.world,
				true,
				false,
			);
			app.viewport.setBounds(-4000, -4000, 8000, 8000);
			app.viewport.moveTo(10, 6);
			expect(difference(draw(), reference(SMALL, repeat, 14, 10))).toBe(
				"the same",
			);
		});
	});
});
