/**
 * melonJS — Platformer (built-in SAT physics) example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Application,
	event,
	ImageLayer,
	loader,
	type ShaderEffect,
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

/** one turn, the period the phase is wrapped to (see `shaders/sway.ts`) */
const TURN = Math.PI * 2;

/**
 * Sway the background hills in every level the game loads.
 *
 * The maps say nothing about it: when a level is in the world, this looks for
 * the image layer drawing the hills and puts the sway on it. So it follows
 * that layer into any map, whatever the map calls it, without anyone marking
 * it up in Tiled.
 *
 * One effect for every level. It is the preloaded `"sway"` shader asset,
 * compiled behind the loading screen and owned by the loader as a shared
 * instance, so a level being unloaded takes its layer away but not the
 * effect, and the next level reuses it rather than compiling a new one.
 *
 * Call once, after the preload and before the first level loads. Does
 * nothing on the Canvas renderer.
 * @param app - the application whose world the levels load into
 */
export const addBackgroundSway = (app: Application) => {
	const sway = loader.getShader("sway") as ShaderEffect | undefined;
	// The Canvas renderer has no shaders: the asset still loads, as an inert
	// effect, and the hills simply stand still. Nothing is put on the layer
	// and nothing runs per frame, rather than feeding an effect that is never
	// drawn.
	if (sway?.enabled !== true) {
		return;
	}
	sway.setUniform("uStrength", STRENGTH);
	sway.setUniform("uBase", BASE);
	sway.setUniform("uPhase", 0);

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

	event.on(event.GAME_UPDATE, () => {
		sway.setUniform("uPhase", ((timer.getTime() / 1000) * SPEED) % TURN);
	});
};
