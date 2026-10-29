/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import {
	type Application,
	BlurEffect,
	type Container,
	DropShadowEffect,
	event,
	FlashEffect,
	OutlineEffect,
	ScanlineEffect,
	ShineEffect,
	SwayEffect,
	timer,
	VignetteEffect,
	WaveEffect,
} from "melonjs";

// how far the water ripples to each side, in pixels, and how many rows of
// pixels make one ripple
const RIPPLE = 4;
const RIPPLE_ROWS = 24;

/**
 * A few shaders on top of the original look, made once and shared by
 * everything using them (they do nothing on the Canvas renderer).
 */
export const shaders = {
	// the farthest jungle layer is a little out of focus
	blur: undefined as unknown as BlurEffect,
	// the two jungle layers sway in the breeze, the nearest one a bit faster
	far: undefined as unknown as SwayEffect,
	near: undefined as unknown as SwayEffect,
	// a glint running over the stars and the title
	shine: undefined as unknown as ShineEffect,
	// a dark shadow under the menu text, to read it over the jungle
	shadow: undefined as unknown as DropShadowEffect,
	// the points flying from a pickup into the score: dark (a text tint
	// would darken the outline with them), with a light outline, to read on
	// the light and the dark parts of the jungle alike
	dark: undefined as unknown as FlashEffect,
	outline: undefined as unknown as OutlineEffect,
	// the water of the current level ripples (made for each level: its
	// strength depends on the size of the layer)
	water: undefined as WaveEffect | undefined,
	app: undefined as unknown as Application,

	init(app: Application) {
		this.app = app;
		this.blur = new BlurEffect(app.renderer, { strength: 1.5 });
		this.far = new SwayEffect(app.renderer, {
			strength: 0.012,
			frequency: 1.5,
			speed: 1.1,
		});
		this.near = new SwayEffect(app.renderer, {
			strength: 0.008,
			frequency: 2,
			speed: 1.6,
		});
		this.shine = new ShineEffect(app.renderer, {
			speed: 0.35,
			intensity: 0.4,
		});
		this.shadow = new DropShadowEffect(app.renderer, {
			offsetX: 4,
			offsetY: 4,
			color: [0.05, 0.27, 0],
			opacity: 0.85,
		});
		this.dark = new FlashEffect(app.renderer, {
			// the darkest green of the game (#0c4400), all over
			color: [12 / 255, 68 / 255, 0],
			intensity: 1,
		});
		this.outline = new OutlineEffect(app.renderer, {
			// the lightest green of the game (#deeed2), a pixel of the 24 pixel
			// font wide
			color: [222 / 255, 238 / 255, 210 / 255],
			width: 3,
		});
		for (const effect of [
			this.blur,
			this.far,
			this.near,
			this.shine,
			this.shadow,
			this.dark,
			this.outline,
		]) {
			effect.shared = true;
		}

		// darken the corners a little, like an old screen (a lower strength is
		// lighter, and a bigger size keeps it closer to the corners: it covers the
		// HUD too)
		app.viewport.addPostEffect(
			new VignetteEffect(app.renderer, { strength: 0.1, size: 60 }),
		);
		// and light scanlines: about one per pixel of the original 120 rows
		app.viewport.addPostEffect(
			new ScanlineEffect(app.renderer, { opacity: 0.12 }),
		);

		// not emitted while the game is paused, so the jungle pauses too
		event.on(event.GAME_UPDATE, () => {
			const seconds = timer.getTime() / 1000;
			this.far.setTime(seconds);
			this.near.setTime(seconds);
			this.shine.setTime(seconds);
			if (this.water && !this.water.destroyed) {
				this.water.setTime(seconds);
			}
		});
	},

	/**
	 * bring the jungle of the current screen to life: the far layer out of
	 * focus, the next two swaying, and the water rippling
	 */
	jungle(world: Container) {
		world.getChildByName("layer1")[0]?.addPostEffect(this.blur);
		world.getChildByName("layer2")[0]?.addPostEffect(this.far);
		world.getChildByName("layer3")[0]?.addPostEffect(this.near);
		const water = world.getChildByName("Water")[0];
		this.water = undefined;
		if (water) {
			// its strength is a share of the layer, as wide as the level
			this.water = new WaveEffect(this.app.renderer, {
				amplitude: RIPPLE / water.width,
				frequency: ((water.height / RIPPLE_ROWS) * Math.PI) / 2,
				speed: 3,
			});
			water.addPostEffect(this.water);
		}
	},
};
