/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import {
	type Application,
	type Container,
	DropShadowEffect,
	event,
	ShineEffect,
	SwayEffect,
	timer,
	VignetteEffect,
} from "melonjs";

/**
 * A few shaders on top of the original look, made once and shared by
 * everything using them (they do nothing on the Canvas renderer).
 */
export const shaders = {
	// the two jungle layers sway in the breeze, the nearest one a bit faster
	far: undefined as unknown as SwayEffect,
	near: undefined as unknown as SwayEffect,
	// a glint running over the stars and the title
	shine: undefined as unknown as ShineEffect,
	// a dark shadow under the menu text, to read it over the jungle
	shadow: undefined as unknown as DropShadowEffect,

	init(app: Application) {
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
		for (const effect of [this.far, this.near, this.shine, this.shadow]) {
			effect.shared = true;
		}

		// darken the corners a little, like an old screen
		app.viewport.addPostEffect(
			new VignetteEffect(app.renderer, { strength: 0.5, size: 30 }),
		);

		// not emitted while the game is paused, so the jungle pauses too
		event.on(event.GAME_UPDATE, () => {
			const seconds = timer.getTime() / 1000;
			this.far.setTime(seconds);
			this.near.setTime(seconds);
			this.shine.setTime(seconds);
		});
	},

	/** make the jungle layers of the current screen sway */
	sway(world: Container) {
		world.getChildByName("layer2")[0]?.addPostEffect(this.far);
		world.getChildByName("layer3")[0]?.addPostEffect(this.near);
	},
};
