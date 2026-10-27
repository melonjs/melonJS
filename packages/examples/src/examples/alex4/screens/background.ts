/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import { type Application, ImageLayer, Renderable, Vector2d } from "melonjs";

/** slowly scrolls the viewport so the parallax layers drift by */
class Scroller extends Renderable {
	private x = 0;

	constructor() {
		super(0, 0, 1, 1);
		this.alwaysUpdate = true;
	}

	override update(dt: number) {
		this.x += dt * 0.05;
		this.parentApp?.viewport.moveTo(Math.round(this.x), 0);
		return true;
	}
}

/** the three parallax layers of the levels, used behind the menus */
export function addBackground(app: Application) {
	// a large, wide world so the viewport can keep scrolling
	app.viewport.setBounds(0, 0, 1 << 24, 480);
	app.viewport.moveTo(0, 0);
	const layers: [string, number, number, "repeat" | "repeat-x"][] = [
		["layer1", 0.25, 0, "repeat"],
		["layer2", 0.35, 480 - 384, "repeat-x"],
		["layer3", 0.5, 0, "repeat-x"],
	];
	layers.forEach(([image, ratio, y, repeat], z) => {
		app.world.addChild(
			new ImageLayer(0, y, {
				image,
				ratio: new Vector2d(ratio, 0),
				repeat,
				z,
			}),
			z,
		);
	});
	app.world.addChild(new Scroller(), 5);
}
