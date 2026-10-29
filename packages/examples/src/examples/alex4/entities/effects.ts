/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import {
	BitmapText,
	type Camera2d,
	type Container,
	type GlyphEffect,
	loader,
	ParticleEmitter,
	Sprite,
	Tween,
} from "melonjs";
import { PALETTE } from "../constants";
import { gameState } from "../gameState";
import { shaders } from "../shaders";

// draw the effects above the map and the actors
const EFFECT_Z = 20;

/**
 * how long the game holds still on an impact, in ms (state.freeze: a
 * hit-stop, the music goes on)
 */
export const HIT_STOP = { stomp: 60, hit: 90, knockout: 160 };

/**
 * how hard and how long the screen shakes on an impact: the view moves by up
 * to half the strength, in screen pixels (4 to an original one), and only up
 * and down for what lands
 */
const SHAKE = {
	stomp: [6, 100, false],
	shatter: [8, 120, false],
	crusher: [12, 250, true],
	hurt: [12, 200, false],
	hit: [16, 250, false],
	die: [20, 350, false],
	pounder: [24, 400, true],
	knockout: [24, 500, false],
} as const;

// the screen holds still for whoever asked their system for less motion
const calm = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");

/** shake the screen for an impact (a stronger one takes over a weaker) */
export function shake(viewport: Camera2d, impact: keyof typeof SHAKE) {
	if (calm?.matches) {
		return;
	}
	const [strength, duration, vertical] = SHAKE[impact];
	const axis = vertical ? viewport.AXIS.VERTICAL : viewport.AXIS.BOTH;
	viewport.shake(strength, duration, axis, undefined, strength >= 12);
}

/**
 * a little firework of pixels, for broken blocks and shot enemies
 */
export function burst(
	world: Container,
	x: number,
	y: number,
	count = 16,
	color = PALETTE[1],
) {
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
	world.addChild(emitter, EFFECT_Z);
	emitter.burstParticles();
}

/**
 * a sparkle of pixels, when something is picked up: they fly out, fading from
 * the lightest color of the palette to the darkest
 */
export function sparkle(world: Container, x: number, y: number) {
	const emitter = new ParticleEmitter(x - 16, y - 16, {
		width: 32,
		height: 32,
		textureSize: 4,
		tintOverLife: [PALETTE[3], PALETTE[2], PALETTE[1]],
		totalParticles: 14,
		angle: Math.PI / 2,
		angleVariation: Math.PI,
		speed: 2.5,
		speedVariation: 1.5,
		gravity: 0.05,
		minLife: 250,
		maxLife: 550,
		autoDestroyOnComplete: true,
	});
	world.addChild(emitter, EFFECT_Z);
	emitter.burstParticles();
}

/**
 * a puff of dust, when something heavy lands
 */
export function dust(world: Container, x: number, y: number) {
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
	world.addChild(emitter, EFFECT_Z);
	emitter.burstParticles();
}

/**
 * a sprite that shows up for a moment, drifting up
 */
export function flash(
	world: Container,
	region: string,
	x: number,
	y: number,
	rise = 0,
	duration = 100,
) {
	const sprite = new Sprite(x, y, { image: gameState.atlas, region });
	world.addChild(sprite, EFFECT_Z);
	new Tween(sprite.pos)
		.to({ y: y - rise }, { duration })
		.onComplete(() => {
			world.removeChild(sprite);
		})
		.start();
}

/**
 * the points just won, rising from where they were won and fading away:
 * "+10" for a cherry, "+100" for a star. At 24 pixels, each pixel of the
 * font a whole 3 of the screen, in the darkest green over a light shadow, so
 * that it reads on any part of the jungle
 */
export function points(world: Container, x: number, y: number, value: number) {
	const text = new BitmapText(x, y, {
		font: "atascii32",
		size: 0.75,
		textAlign: "center",
		text: `+${value}`,
	});
	text.addPostEffect(shaders.dark);
	text.addPostEffect(shaders.lightShadow);
	world.addChild(text, EFFECT_Z);
	new Tween(text.pos)
		.to({ y: y - 48 }, { duration: 700, easing: Tween.Easing.Quadratic.Out })
		.start();
	const fade = { alpha: 1 };
	new Tween(fade)
		.to({ alpha: 0 }, { duration: 300, delay: 400 })
		.onUpdate(() => text.setOpacity(fade.alpha))
		.onComplete(() => {
			world.removeChild(text);
		})
		.start();
}

/**
 * the smoke the original left behind the dying spike truck: a puff every
 * frame, left where it was made, playing the 8 frames of the smoke over its
 * life. Move the emitter along, and stop it with stopStream().
 */
export function smoke(world: Container, x: number, y: number) {
	const emitter = new ParticleEmitter(x, y, {
		image: loader.getImage("smoke") as HTMLImageElement,
		framewidth: 64,
		frameheight: 64,
		// where the puffs come out, from the emitter's top left
		width: 64,
		height: 64,
		// a puff stays where it was made, while the truck goes on
		referenceSpace: "world",
		frequency: 16,
		maxParticles: 1,
		// 8 frames of 40ms, as in the original
		minLife: 320,
		maxLife: 320,
		speed: 0,
		speedVariation: 0,
		minEndScale: 1,
		maxEndScale: 1,
		onlyInViewport: false,
		autoDestroyOnComplete: true,
	});
	world.addChild(emitter, EFFECT_Z);
	emitter.streamParticles();
	return emitter;
}

/**
 * A wave running along a title, for BitmapText#glyphEffect: it moves the
 * glyphs inside the text batch, with no new layout. Its phase comes from where
 * a glyph is, not from its index, so the wave keeps one length whatever the
 * line spells, and it moves by whole pixels of the original (4 of ours), like
 * everything else on the screen.
 */
export const wave: GlyphEffect = (out, ctx) => {
	out.offsetY = Math.round(Math.sin(ctx.time * 0.005 + ctx.x * 0.02) * 2) * 4;
};
