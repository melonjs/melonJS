/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import { type Application, ImageLayer, Tween, Vector2d } from "melonjs";

/**
 * add the jungle parallax layers behind a menu screen, slowly scrolling
 */
export function addParallaxBackground(app: Application) {
	app.world.addChild(
		new ImageLayer(0, 0, { image: "layer1", ratio: new Vector2d(0.25, 0) }),
		1,
	);
	app.world.addChild(
		new ImageLayer(0, 0, {
			image: "layer2",
			ratio: new Vector2d(0.35, 0),
			repeat: "repeat-x",
		}),
		2,
	);
	app.world.addChild(
		new ImageLayer(0, 0, {
			image: "layer3",
			ratio: new Vector2d(0.5, 0),
			repeat: "repeat-x",
		}),
		3,
	);

	// move the camera around a huge world to scroll the layers
	app.viewport.setBounds(0, 0, 1e7, app.viewport.height);
	app.viewport.moveTo(0, 0);
	new Tween(app.viewport.pos).to({ x: 1e6 }, { duration: 2e7 }).start();
}
