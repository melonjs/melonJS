/**
 * melonJS — Isometric Dungeon example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { ParticleEmitter } from "melonjs";
import { PARTICLES } from "../constants";
import type { Hero } from "../entities/Hero";
import { sparkTexture } from "./chests";

// area around the hero where motes spawn
const MOTES_W = 520;
const MOTES_H = 340;

// dust floating in the air around the hero. Both emitters use world space,
// so particles stay where they spawned when the hero moves
export class Motes extends ParticleEmitter {
	constructor(private readonly hero: Hero) {
		super(hero.feetX - MOTES_W / 2, hero.feetY - MOTES_H * 0.75, {
			image: sparkTexture(),
			width: MOTES_W,
			height: MOTES_H,
			referenceSpace: "world",
			tint: "#ffe6bf",
			totalParticles: 40,
			angle: 0,
			angleVariation: Math.PI,
			speed: 0.12,
			speedVariation: 0.08,
			wind: 0.004,
			minLife: 3500,
			maxLife: 6500,
			minStartScale: 0.15,
			maxStartScale: 0.35,
			minEndScale: 0,
			maxEndScale: 0.05,
			textureAdditive: true,
			frequency: 120,
		});
		this.visibilityLayer = PARTICLES;
		this.streamParticles();
	}

	override update(dt: number) {
		this.setPosition(
			this.hero.feetX - MOTES_W / 2,
			this.hero.feetY - MOTES_H * 0.75,
		);
		return super.update(dt);
	}
}

// small puff of dust, burst on every footstep
export function footDust() {
	const dust = new ParticleEmitter(0, 0, {
		image: sparkTexture(),
		width: 22,
		height: 8,
		referenceSpace: "world",
		tint: "#b9a07a",
		totalParticles: 6,
		angle: Math.PI / 2,
		angleVariation: 1.2,
		speed: 0.45,
		speedVariation: 0.25,
		gravity: 0.008,
		minLife: 350,
		maxLife: 650,
		minStartScale: 0.6,
		maxStartScale: 1.0,
		minEndScale: 0.1,
		maxEndScale: 0.3,
	});
	dust.visibilityLayer = PARTICLES;
	return dust;
}
