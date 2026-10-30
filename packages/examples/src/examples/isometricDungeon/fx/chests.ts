/**
 * melonJS — Isometric Dungeon example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Application,
	GlowEffect,
	Light2d,
	ParticleEmitter,
	Tween,
	type Vector2d,
} from "melonjs";
import {
	CHEST_GLOW_COLOR,
	CHEST_GLOW_INTENSITY,
	CHEST_GLOW_RADIUS,
	PARTICLES,
} from "../constants";
import type { Usable } from "../entities/usables";

const GOLD = [1.0, 0.72, 0.18];

let spark: HTMLCanvasElement | undefined;
// soft white dot, tinted by each emitter
export function sparkTexture() {
	if (!spark) {
		spark = document.createElement("canvas");
		spark.width = spark.height = 16;
		const context = spark.getContext("2d");
		if (!context) {
			throw new Error("could not create a 2d context");
		}
		const fill = context.createRadialGradient(8, 8, 0, 8, 8, 8);
		fill.addColorStop(0, "rgba(255, 255, 255, 1)");
		fill.addColorStop(0.35, "rgba(255, 255, 255, 0.8)");
		fill.addColorStop(1, "rgba(255, 255, 255, 0)");
		context.fillStyle = fill;
		context.fillRect(0, 0, 16, 16);
	}
	return spark;
}

export interface ChestFx {
	light: Light2d;
	glow: GlowEffect;
	pulse: Tween;
	sparkles: ParticleEmitter;
}

// a light, a pulsing outline and a few sparks on a closed chest
export function highlightChest(
	app: Application,
	chest: Usable,
	at: Vector2d,
): ChestFx {
	const z = chest.depth;
	const light = new Light2d(
		at.x,
		at.y - 16,
		CHEST_GLOW_RADIUS,
		CHEST_GLOW_RADIUS * 0.6,
		CHEST_GLOW_COLOR,
		CHEST_GLOW_INTENSITY,
	);
	// its soft hole in the darkness shows the chest from afar
	light.softness = 1;
	// below the sprites, like the torch
	app.world.addChild(light, z - 0.5);

	// a shader effect: on the Canvas renderer it does nothing. Its width is in
	// pixels of the chest's art
	const glow = new GlowEffect(app.renderer, {
		color: GOLD,
		width: 4,
		intensity: 0.8,
	});
	chest.sprite.addPostEffect(glow);
	const level = { value: 0.7 };
	const pulse = new Tween(level)
		.to(
			{ value: 1.8 },
			{
				duration: 900,
				easing: Tween.Easing.Sinusoidal.InOut,
				yoyo: true,
				repeat: Infinity,
			},
		)
		.onUpdate(() => {
			glow.setIntensity(level.value);
		})
		.start();

	// emitter position is the top left of the spawn area
	const sparkles = new ParticleEmitter(at.x - 18, at.y - 28, {
		image: sparkTexture(),
		width: 36,
		height: 10,
		tint: "#ffc23a",
		totalParticles: 14,
		angle: Math.PI / 2,
		angleVariation: 0.4,
		speed: 0.6,
		speedVariation: 0.25,
		minLife: 900,
		maxLife: 1600,
		minStartScale: 0.7,
		maxStartScale: 1.2,
		minEndScale: 0,
		maxEndScale: 0.1,
		textureAdditive: true,
		frequency: 110,
		// once stopped, it removes itself when the last spark is gone
		autoDestroyOnComplete: true,
	});
	// lined up with the chest, not with the bottom of the sparks' spawn area,
	// so the hero standing in front of it covers them
	sparkles.sortOffset = chest.pos.y + 1 - sparkles.pos.y;
	sparkles.visibilityLayer = PARTICLES;
	app.world.addChild(sparkles, z);
	sparkles.streamParticles();

	return { light, glow, pulse, sparkles };
}

// remove the highlight, burst some gold and flare the chest light
export function openChest(
	app: Application,
	chest: Usable,
	at: Vector2d,
	fx: ChestFx,
) {
	fx.pulse.stop();
	chest.sprite.removePostEffect(fx.glow);
	fx.sparkles.stopStream();

	const burst = new ParticleEmitter(at.x - 20, at.y - 26, {
		image: sparkTexture(),
		width: 40,
		height: 14,
		tint: "#ffb020",
		totalParticles: 70,
		angle: Math.PI / 2,
		angleVariation: 1.0,
		speed: 3.4,
		speedVariation: 1.2,
		gravity: 0.12,
		minLife: 650,
		maxLife: 1250,
		minStartScale: 1.0,
		maxStartScale: 1.8,
		minEndScale: 0,
		maxEndScale: 0.3,
		textureAdditive: true,
		autoDestroyOnComplete: true,
	});
	burst.sortOffset = chest.pos.y + 1 - burst.pos.y;
	burst.visibilityLayer = PARTICLES;
	app.world.addChild(burst, chest.depth);
	burst.burstParticles();

	const light = fx.light;
	const fade = new Tween(light)
		.to({ intensity: 0 }, { duration: 700 })
		.onComplete(() => {
			app.world.removeChild(light);
		});
	new Tween(light)
		.to({ intensity: 1.3 }, { duration: 140 })
		.chain(fade)
		.start();
}
