/**
 * Container#update steps a child only while a camera sees it: it asks the
 * stage's cameras in the order they were added, marks the child `inViewport`
 * as soon as one says yes, and skips the update of one that none of them sees.
 *
 * Games add cameras (a minimap, a radar, a split screen) and may override
 * `isVisible` on one, so these cases update a world seen through two cameras,
 * the second of which marks what it sees, and check for each child whether
 * it was stepped and which camera was asked about it.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Camera2d,
	Container,
	Renderable,
	state,
	video,
} from "../src/index.js";

/** a 20 x 20 enemy that counts the frames it was stepped */
class Enemy extends Renderable {
	constructor(name, x, y) {
		super(x, y, 20, 20);
		this.anchorPoint.set(0, 0);
		this.name = name;
		this.steps = 0;
	}
	update(dt) {
		this.steps++;
		return super.update(dt);
	}
}

/** a second camera that marks every renderable it sees, as a radar would */
class Radar extends Camera2d {
	constructor() {
		super(0, 0, 100, 100);
		this.name = "radar";
		this.autoResize = false;
		this.marked = new Set();
	}
	isVisible(obj, floating) {
		const seen = super.isVisible(obj, floating);
		if (seen) {
			this.marked.add(obj.name);
		}
		return seen;
	}
}

describe("a child is updated while any camera sees it", () => {
	let app;
	let stage;
	let camera;

	beforeAll(async () => {
		boot();
		app = new Application(100, 100, {
			parent: "screen",
			renderer: video.CANVAS,
			scale: "1.0",
			consoleHeader: false,
		});
		await app.init();
		stage = state.current();
		camera = stage.cameras.get("default");
	});

	afterEach(() => {
		stage.cameras.delete("radar");
		app.world.reset();
	});

	afterAll(() => {
		return app?.destroy();
	});

	/**
	 * the main camera on world x 0 to 100, a radar on x 50 to 150, and an
	 * enemy seen by both, by each alone, and by neither
	 */
	const scene = () => {
		camera.setBounds(0, 0, 5000, 5000);
		camera.moveTo(0, 0);
		const radar = new Radar();
		radar.setBounds(0, 0, 5000, 5000);
		radar.moveTo(50, 0);
		stage.cameras.set("radar", radar);
		const enemies = {
			both: new Enemy("both", 60, 40),
			main: new Enemy("main", 10, 40),
			radar: new Enemy("radar", 120, 40),
			neither: new Enemy("neither", 400, 400),
		};
		for (const enemy of Object.values(enemies)) {
			app.world.addChild(enemy);
		}
		return { radar, enemies };
	};

	const stepsOf = (enemies) => {
		return Object.fromEntries(
			Object.entries(enemies).map(([name, e]) => {
				return [name, e.steps];
			}),
		);
	};

	it("one seen by either camera is updated, one seen by neither is not", () => {
		const { enemies } = scene();
		app.world.update(16);
		expect(stepsOf(enemies)).toEqual({
			both: 1,
			main: 1,
			radar: 1,
			neither: 0,
		});
		expect(enemies.main.inViewport).toBe(true);
		expect(enemies.radar.inViewport).toBe(true);
		expect(enemies.neither.inViewport).toBe(false);
	});

	it("the first camera that sees a child settles it", () => {
		const { radar } = scene();
		app.world.update(16);
		// the main camera, asked first, saw "both" and "main": the radar is
		// asked only about the others, and of those it sees "radar"
		expect([...radar.marked]).toEqual(["radar"]);
	});

	it("frame after frame, an enemy is stepped only while a camera sees it", () => {
		const { enemies } = scene();
		const walker = enemies.neither;
		// out of view, into the radar's, into the main view, then out again
		const path = [
			[400, 400],
			[120, 40],
			[10, 40],
			[400, 40],
		];
		const stepped = [];
		for (const [x, y] of path) {
			walker.pos.set(x, y, walker.pos.z);
			const before = walker.steps;
			app.world.update(16);
			stepped.push(walker.steps - before);
		}
		expect(stepped).toEqual([0, 1, 1, 0]);
	});

	it("a HUD's children are tested on screen, wherever the cameras look", () => {
		// a floating HUD draws in screen space, so its labels are seen at
		// any camera position, here far from the world origin
		camera.setBounds(0, 0, 5000, 5000);
		camera.moveTo(3000, 3000);
		const hud = new Container(0, 0, 100, 100);
		hud.floating = true;
		const label = new Enemy("label", 10, 10);
		hud.addChild(label);
		app.world.addChild(hud);
		app.world.update(16);
		expect(label.inViewport).toBe(true);
		expect(label.steps).toBe(1);
	});
});
