import { vi } from "vitest";
import {
	Application,
	boot,
	type CanvasRenderer,
	type Container,
	type LDtkLayerInstance,
	type LDtkLevelJson,
	type LDtkLoadOptions,
	type LDtkProject,
	type LDtkProjectJson,
	type LDtkTile,
	level,
	loader,
	type Renderable,
	state,
	video,
	type WebGLRenderer,
} from "../../src/index.js";

/** the twelve sample projects that come with LDtk, kept with the examples */
export const SAMPLES = [
	"AutoLayers_1_basic",
	"AutoLayers_2_stamps",
	"AutoLayers_3_Mosaic",
	"AutoLayers_4_Assistant",
	"AutoLayers_5_Advanced",
	"Entities",
	"SeparateLevelFiles",
	"Test_file_for_API_showing_all_features",
	"Typical_2D_platformer_example",
	"Typical_TopDown_example",
	"WorldMap_Free_layout",
	"WorldMap_GridVania_layout",
];

/**
 * where a sample's file is
 * @param file - the file, in the samples' folder
 * @returns its URL
 */
export const sampleURL = (file: string) => {
	return new URL(
		`../../../examples/public/assets/ldtk/${file}`,
		import.meta.url,
	).href;
};

export const WIDTH = 320;
export const HEIGHT = 240;

/**
 * an application to load LDtk projects in
 * @param renderer - the renderer to ask for
 * @returns the application
 */
export async function makeApp(
	renderer: typeof video.CANVAS | typeof video.WEBGL,
): Promise<Application> {
	// no frame of the engine's own: a test draws each one
	vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => {
		return 1;
	});
	vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {
		// nothing to cancel
	});
	boot();
	const app = new Application(WIDTH, HEIGHT, {
		parent: "screen",
		renderer,
		consoleHeader: false,
		antiAlias: false,
		failIfMajorPerformanceCaveat: false,
	});
	await app.init();
	state.change(state.DEFAULT, true);
	return app;
}

/**
 * load every sample, as a game does
 * @returns the projects, by sample name
 */
export async function loadSamples(): Promise<Map<string, LDtkProject>> {
	await loader.preload(
		SAMPLES.map((name) => {
			return { name, type: "ldtk", src: sampleURL(`${name}.ldtk`) };
		}),
		undefined,
		false,
	);
	const projects = new Map<string, LDtkProject>();
	for (const name of SAMPLES) {
		const project = loader.getLDtk(name);
		if (project === null) {
			throw new Error(`${name} was not loaded`);
		}
		projects.set(name, project);
	}
	return projects;
}

/**
 * load a level into the world, as a game does
 * @param app - the application
 * @param id - the level's id
 * @param options - LDtk's own load options
 */
export async function enter(
	app: Application,
	id: string,
	options: LDtkLoadOptions = {},
): Promise<void> {
	await level.load(id, { container: app.world, async: true, ...options });
}

/**
 * draw a frame and read it back
 * @param app - the application
 * @returns the frame's pixels, top row first
 */
export function frame(app: Application): Uint8ClampedArray {
	app.world.update(16);
	app.viewport.update(16);
	app.repaint();
	app.draw();
	const renderer = app.renderer as CanvasRenderer | WebGLRenderer;
	if ("gl" in renderer) {
		const gl = renderer.gl as WebGL2RenderingContext;
		renderer.flush();
		const raw = new Uint8Array(WIDTH * HEIGHT * 4);
		gl.readPixels(0, 0, WIDTH, HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, raw);
		// read from the bottom row up
		const out = new Uint8ClampedArray(raw.length);
		const row = WIDTH * 4;
		for (let y = 0; y < HEIGHT; y++) {
			out.set(
				raw.subarray((HEIGHT - 1 - y) * row, (HEIGHT - y) * row),
				y * row,
			);
		}
		return out;
	}
	const context = renderer.getContext() as CanvasRenderingContext2D;
	return context.getImageData(0, 0, WIDTH, HEIGHT).data;
}

type Picture = HTMLCanvasElement;

/**
 * the room a reference picture keeps around its level: LDtk saves tiles that
 * reach past the level's edges, and they are drawn
 */
export const MARGIN = 64;

/**
 * the tiles a layer draws, as LDtk saves them
 * @param layer - the layer
 * @returns its tiles, in the order LDtk draws them
 */
export const tilesOf = (layer: LDtkLayerInstance): LDtkTile[] => {
	return layer.__type === "Tiles" ? layer.gridTiles : layer.autoLayerTiles;
};

/**
 * A level drawn with the 2D canvas alone, straight from the project file:
 * its background, then each visible layer from the bottom one up, each tile
 * in LDtk's order, mirrored and faded as saved. What the engine has to give.
 * @param project - the project file
 * @param json - the level
 * @param fill - fill the level's area with its background color
 * @returns a canvas of the level's size, with {@link MARGIN} around it
 */
export function referenceLevel(
	project: LDtkProjectJson,
	json: LDtkLevelJson,
	fill: boolean,
): Picture {
	const canvas = document.createElement("canvas");
	canvas.width = json.pxWid + MARGIN * 2;
	canvas.height = json.pxHei + MARGIN * 2;
	const c = canvas.getContext("2d") as CanvasRenderingContext2D;
	c.imageSmoothingEnabled = false;
	c.translate(MARGIN, MARGIN);
	if (fill) {
		c.fillStyle = json.__bgColor;
		c.fillRect(0, 0, json.pxWid, json.pxHei);
	}
	if (typeof json.bgRelPath === "string" && json.__bgPos) {
		const image = loader.getImage(json.bgRelPath) as CanvasImageSource;
		const [sx, sy, sw, sh] = json.__bgPos.cropRect;
		c.drawImage(
			image,
			sx,
			sy,
			sw,
			sh,
			json.__bgPos.topLeftPx[0],
			json.__bgPos.topLeftPx[1],
			sw * json.__bgPos.scale[0],
			sh * json.__bgPos.scale[1],
		);
	}
	const layers = json.layerInstances ?? [];
	for (let i = layers.length - 1; i >= 0; i--) {
		const layer = layers[i];
		const tileset = project.defs.tilesets.find((def) => {
			return def.uid === layer.__tilesetDefUid;
		});
		if (!layer.visible || tileset === undefined || tileset.relPath === null) {
			continue;
		}
		const image = loader.getImage(tileset.relPath) as CanvasImageSource;
		const size = tileset.tileGridSize;
		for (const tile of tilesOf(layer)) {
			const flipX = (tile.f & 1) !== 0;
			const flipY = (tile.f & 2) !== 0;
			c.save();
			c.globalAlpha = layer.__opacity * (tile.a ?? 1);
			c.translate(
				layer.__pxTotalOffsetX + tile.px[0] + (flipX ? size : 0),
				layer.__pxTotalOffsetY + tile.px[1] + (flipY ? size : 0),
			);
			c.scale(flipX ? -1 : 1, flipY ? -1 : 1);
			c.drawImage(
				image,
				tile.src[0],
				tile.src[1],
				size,
				size,
				0,
				0,
				size,
				size,
			);
			c.restore();
		}
	}
	return canvas;
}

/**
 * what the view shows of pictures placed in the world
 * @param background - the color behind them
 * @param pictures - the pictures, each where it is in the world
 * @param viewX - the view's left edge in the world
 * @param viewY - the view's top edge in the world
 * @returns the view's pixels
 */
export function referenceView(
	background: string,
	pictures: { picture: Picture; x: number; y: number }[],
	viewX: number,
	viewY: number,
): Uint8ClampedArray {
	const canvas = document.createElement("canvas");
	canvas.width = WIDTH;
	canvas.height = HEIGHT;
	const c = canvas.getContext("2d") as CanvasRenderingContext2D;
	c.fillStyle = background;
	c.fillRect(0, 0, WIDTH, HEIGHT);
	for (const { picture, x, y } of pictures) {
		c.drawImage(picture, x - MARGIN - viewX, y - MARGIN - viewY);
	}
	return c.getImageData(0, 0, WIDTH, HEIGHT).data;
}

/**
 * compare two pictures of the view
 * @param actual - what was drawn
 * @param expected - what should have been
 * @param tolerance - the largest difference of a channel that is not counted
 * @returns how many pixels differ, the largest difference, and the first one
 */
export function diff(
	actual: Uint8ClampedArray,
	expected: Uint8ClampedArray,
	tolerance = 0,
) {
	let different = 0;
	let worst = 0;
	let first = "";
	for (let i = 0; i < expected.length; i += 4) {
		const d = Math.max(
			Math.abs(actual[i] - expected[i]),
			Math.abs(actual[i + 1] - expected[i + 1]),
			Math.abs(actual[i + 2] - expected[i + 2]),
		);
		if (d > tolerance) {
			different++;
			if (first === "") {
				const p = i / 4;
				first = `(${String(p % WIDTH)}, ${String(Math.floor(p / WIDTH))}): [${actual.slice(i, i + 3).join(", ")}] against [${expected.slice(i, i + 3).join(", ")}]`;
			}
		}
		worst = Math.max(worst, d);
	}
	return { different, worst, first };
}

/**
 * the objects a level's entities became, as a game finds them: in the
 * container the level was added to, by the name the level gives them, or all
 * of them by the id it gives them (a string, in LDtk; the walls of an
 * IntGrid layer, which have one too, are not counted)
 * @param container - the container the level was added to
 * @param name - an entity identifier, to get only those
 * @returns the objects, in the container's order
 */
export function objectsIn(container: Container, name?: string): Renderable[] {
	return name === undefined
		? container.getChildByProp("id", /./).filter((child) => {
				return !("intGridValue" in child);
			})
		: container.getChildByName(name);
}
