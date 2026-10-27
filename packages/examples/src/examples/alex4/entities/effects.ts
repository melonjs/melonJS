/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import { game, loader, ParticleEmitter, Sprite, Tween } from "melonjs";
import { PALETTE } from "../constants";
import { gameState } from "../gameState";

// draw the effects above the map and the actors
const EFFECT_Z = 20;

/**
 * a little firework of pixels, for broken blocks and shot enemies
 */
export function burst(x: number, y: number, count = 16, color = PALETTE[1]) {
	const emitter = new ParticleEmitter(x - 16, y - 16, {
		width: 32,
		height: 32,
		tint: color,
		textureSize: 4,
		totalParticles: count,
		angle: 0,
		angleVariation: Math.PI * 2,
		speed: 2,
		speedVariation: 2,
		gravity: 0.15,
		minLife: 400,
		maxLife: 1200,
		autoDestroyOnComplete: true,
	});
	game.world.addChild(emitter, EFFECT_Z);
	emitter.burstParticles();
}

/**
 * a puff of dust, when something heavy lands
 */
export function dust(x: number, y: number) {
	const emitter = new ParticleEmitter(x - 32, y - 8, {
		image: loader.getImage("dust") as HTMLImageElement,
		width: 64,
		height: 8,
		totalParticles: 8,
		angle: Math.PI / 2,
		angleVariation: Math.PI / 2,
		speed: 1,
		gravity: 0,
		minLife: 300,
		maxLife: 500,
		autoDestroyOnComplete: true,
	});
	game.world.addChild(emitter, EFFECT_Z);
	emitter.burstParticles();
}

/**
 * a sprite that shows up for a moment, drifting up
 */
export function flash(
	region: string,
	x: number,
	y: number,
	rise = 0,
	duration = 100,
) {
	const sprite = new Sprite(x, y, { image: gameState.atlas, region });
	game.world.addChild(sprite, EFFECT_Z);
	new Tween(sprite.pos)
		.to({ y: y - rise }, { duration })
		.onComplete(() => {
			game.world.removeChild(sprite);
		})
		.start();
}
