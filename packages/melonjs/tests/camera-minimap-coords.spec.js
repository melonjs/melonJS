/**
 * Camera2d#worldToLocal and #localToWorld agree with where the camera draws,
 * when the world container is offset.
 *
 * A level smaller than the view is centred by moving the world container
 * (`world.pos`). The default camera draws the world shifted by that, but any
 * other camera (a minimap, a corner view, a zoomed one) cancels it in its
 * draw(). The two conversions applied `world.pos` on every camera, so on a
 * minimap worldToLocal() pointed `world.pos` away from where the point was
 * drawn, and localToWorld() (which also feeds the pointer's gameWorldX/Y)
 * read the wrong place under the cursor.
 *
 * Every case draws a blue square and checks that the pixel worldToLocal()
 * names is the square, and that localToWorld() brings it back.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Camera2d,
	Renderable,
	state,
	Vector2d,
	video,
} from "../src/index.js";

class Square extends Renderable {
	constructor(x, y, size, color) {
		super(x, y, size, size);
		this.anchorPoint.set(0, 0);
		this.color = color;
	}
	draw(renderer) {
		renderer.setColor(this.color);
		renderer.fillRect(this.pos.x, this.pos.y, this.width, this.height);
	}
}

const BLUE = "0,0,255";

describe("Camera2d coordinate conversion with an offset world", () => {
	let app;
	let renderer;
	let stage;
	let camera;

	beforeAll(async () => {
		boot();
		app = new Application(100, 100, {
			parent: "screen",
			renderer: video.CANVAS,
			scale: "1.0",
			antiAlias: false,
			consoleHeader: false,
		});
		await app.init();
		renderer = app.renderer;
		stage = state.current();
		camera = stage.cameras.get("default");
	});

	afterEach(() => {
		stage.cameras.delete("minimap");
		camera.zoom = 1;
		app.world.reset();
		app.world.pos.set(0, 0, 0);
	});

	afterAll(() => {
		return app?.destroy();
	});

	const at = (p) => {
		const d = renderer
			.getContext()
			.getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data;
		return Array.from(d.slice(0, 3)).join();
	};

	/**
	 * draw a 20px square at (10, 10) to (30, 30) in a world offset by
	 * `worldX`, through the main camera and, if given, a minimap
	 */
	const drawScene = ({ worldX = 20, minimap } = {}) => {
		camera.setBounds(0, 0, 1000, 1000);
		camera.moveTo(0, 0);
		let view;
		if (minimap !== undefined) {
			view = new Camera2d(0, 0, 40, 40);
			view.name = "minimap";
			view.autoResize = false;
			view.screenX = 60;
			view.screenY = 0;
			view.zoom = minimap.zoom ?? 1;
			view.setBounds(0, 0, 1000, 1000);
			view.moveTo(minimap.x ?? 0, 0);
			stage.cameras.set("minimap", view);
		}
		app.world.pos.set(worldX, 0, 0);
		app.world.addChild(new Square(10, 10, 20, "#0000ff"), 1);
		app.world.sortNow();
		app.world.update(0);
		app.repaint();
		app.draw();
		return view;
	};

	const CENTRE = [20, 20];

	describe("default camera (unchanged)", () => {
		it("worldToLocal() names a pixel of the square, shifted by world.pos", () => {
			drawScene();
			const p = camera.worldToLocal(...CENTRE, new Vector2d());
			expect({ x: p.x, y: p.y }).toEqual({ x: 40, y: 20 });
			expect(at(p)).toBe(BLUE);
		});

		it("localToWorld() inverts it", () => {
			drawScene();
			const w = camera.localToWorld(40, 20, new Vector2d());
			expect({ x: w.x, y: w.y }).toEqual({ x: 20, y: 20 });
		});
	});

	// [name, minimap settings, where its draw puts the square's centre]
	const MINIMAPS = [
		["a minimap", {}, { x: 80, y: 20 }],
		["a moved minimap", { x: 10 }, { x: 70, y: 20 }],
		["a zoomed-out minimap", { zoom: 0.5 }, { x: 70, y: 10 }],
		["a zoomed-out, moved minimap", { zoom: 0.5, x: 10 }, { x: 65, y: 10 }],
	];

	describe.for(MINIMAPS)("%s", ([, settings, expected]) => {
		it("draws the square where expected", () => {
			drawScene({ minimap: settings });
			expect(at(expected)).toBe(BLUE);
		});

		it("worldToLocal() names the pixel it drew the point at", () => {
			const view = drawScene({ minimap: settings });
			const p = view.worldToLocal(...CENTRE, new Vector2d());
			expect({ x: p.x, y: p.y }).toEqual(expected);
			expect(at(p)).toBe(BLUE);
		});

		it("localToWorld() reads back the point drawn there", () => {
			const view = drawScene({ minimap: settings });
			const w = view.localToWorld(expected.x, expected.y, new Vector2d());
			expect({ x: w.x, y: w.y }).toEqual({ x: 20, y: 20 });
		});

		it("the two are inverse of each other", () => {
			const view = drawScene({ minimap: settings });
			const w = view.localToWorld(63, 7, new Vector2d());
			const p = view.worldToLocal(w.x, w.y, new Vector2d());
			expect(p.x).toBeCloseTo(63, 6);
			expect(p.y).toBeCloseTo(7, 6);
		});
	});

	describe("a zoomed main camera (not a default one either)", () => {
		it("worldToLocal() names the pixel it drew the point at", () => {
			camera.zoom = 2;
			drawScene();
			const p = camera.worldToLocal(...CENTRE, new Vector2d());
			expect({ x: p.x, y: p.y }).toEqual({ x: 40, y: 40 });
			expect(at(p)).toBe(BLUE);
		});

		it("localToWorld() reads back the point drawn there", () => {
			camera.zoom = 2;
			drawScene();
			const w = camera.localToWorld(40, 40, new Vector2d());
			expect({ x: w.x, y: w.y }).toEqual({ x: 20, y: 20 });
		});
	});

	it("without a world offset, every camera is unchanged", () => {
		const view = drawScene({ worldX: 0, minimap: { zoom: 0.5 } });
		const main = camera.worldToLocal(...CENTRE, new Vector2d());
		const mini = view.worldToLocal(...CENTRE, new Vector2d());
		expect([main.x, main.y, mini.x, mini.y]).toEqual([20, 20, 70, 10]);
	});
});
