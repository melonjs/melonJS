/**
 * melonJS — Platformer (Matter) example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Application,
	event,
	ImageLayer,
	loader,
	SwayEffect,
	timer,
} from "melonjs";

/** the image the hills are drawn from: whichever layer draws it sways */
const HILLS = "background";

/**
 * How far the tip of the tallest pillar travels each way, in widths of the
 * image: the image is 1024 wide, so 0.02 is about 8 pixels at the very top
 * of the tallest one, and less the lower and shorter the pillar.
 */
const STRENGTH = 0.02;

/** the row the pillars stand on in the image, as a fraction of its height */
const BASE = 0.57;

/** radians per second: one full sway about every four seconds */
const SPEED = 1.5;

/**
 * Sway the background hills in every level the game loads.
 *
 * A `SwayEffect` leans the round cactus pillars of the background image from
 * side to side, as if a breeze were going through them: the tips move most,
 * and nothing below `BASE` moves at all, so the hills they stand in stay put
 * while the pillars bend.
 *
 * The maps say nothing about it: when a level is in the world, this looks for
 * the image layer drawing the hills and puts the sway on it. So it follows
 * that layer into any map, whatever the map calls it, without anyone marking
 * it up in Tiled.
 *
 * One effect for every level. It is marked `shared`, so a level being
 * unloaded takes its layer away but not the effect, and the next level puts
 * the same one on its own layer.
 *
 * Call once, after the preload and before the first level loads. Does
 * nothing on the Canvas renderer.
 * @param app - the application whose world the levels load into
 */
export const addBackgroundSway = (app: Application) => {
	const sway = new SwayEffect(app.renderer, {
		strength: STRENGTH,
		anchor: BASE,
		speed: SPEED,
	});
	// The Canvas renderer has no shaders: the effect comes back inert, and the
	// hills simply stand still. Nothing is put on the layer and nothing runs
	// per frame, rather than feeding an effect that is never drawn.
	if (!sway.enabled) {
		return;
	}
	// kept when the layer carrying it is destroyed with its level
	sway.shared = true;

	// every level: the first when play starts, the next through the door at
	// the end of it, and either again after a restart
	event.on(event.LEVEL_LOADED, () => {
		const hills = loader.getImage(HILLS);
		for (const layer of app.world.getChildByType(ImageLayer)) {
			if (
				layer instanceof ImageLayer &&
				layer.image === hills &&
				!layer.postEffects.includes(sway)
			) {
				layer.addPostEffect(sway);
			}
		}
	});

	// the effect wraps the phase itself, so a raw clock is fine here
	event.on(event.GAME_UPDATE, () => {
		sway.setTime(timer.getTime() / 1000);
	});
};
