/**
 * melonJS — Starsweep: the 3D space behind the station.
 *
 * Star dust streaming past the camera, and novas going off far away,
 * both `ParticleEmitter`s placed in depth and drawn by the space camera
 * (see `spaceCamera.ts`).
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Camera3d,
	type Container,
	math,
	ParticleEmitter,
	Renderable,
} from "melonjs";
import { SPACE_LAYER } from "./spaceCamera";

/** a soft white dot, for the particles to be tinted from */
const softDot = (size = 64) => {
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext("2d");
	if (ctx) {
		const r = size / 2;
		const g = ctx.createRadialGradient(r, r, 0, r, r, r);
		g.addColorStop(0, "rgba(255,255,255,1)");
		g.addColorStop(0.25, "rgba(255,255,255,0.75)");
		g.addColorStop(1, "rgba(255,255,255,0)");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, size, size);
	}
	return canvas;
};

/** where the dust is born, in front of the camera */
const DUST = { near: 900, far: 4200, halfWidth: 1700, halfHeight: 2800 };
/** how far away the novas go off */
const NOVA_DEPTH = 2200;
/** a nova's spawn area, in each axis: tiny, so it bursts from a point */
const NOVA_SIZE = 30;

/**
 * Space, in 3D: star dust streaming past the camera, and novas, spheres of
 * sparks, going off far away, in the level's colours. Both are plain
 * `ParticleEmitter`s placed in depth: `elevation` sends particles along Z,
 * and the `Camera3d` draws them in perspective, so near dust is big and
 * fast and far dust small and slow. The camera drifts a little too, which
 * is what makes the depth read.
 */
export class DeepSpace extends Renderable {
	private readonly dust: ParticleEmitter;
	/** a few, so one can be aimed elsewhere while the last one fades */
	private readonly novas: ParticleEmitter[] = [];
	private colors: string[] = ["#ffffff", "#2ee6d6", "#b8fff6"];
	private time = math.randomFloat(0, 100);
	private next = 0;
	private nextNova = 0;

	constructor(
		private readonly world: Container,
		private readonly camera: Camera3d,
	) {
		super(0, 0, 1, 1);
		this.alwaysUpdate = true;
		this.isPersistent = true;
		// drawn by no camera: this only drives the scene
		this.visibilityLayer = 0;
		camera.setPosition(0, 0, 0);
		const image = softDot();

		const depth = DUST.far - DUST.near;
		// the constructor centres the spawn area on (x, y)
		this.dust = new ParticleEmitter(0, 0, {
			image,
			width: DUST.halfWidth * 2,
			height: DUST.halfHeight * 2,
			depth,
			totalParticles: 500,
			frequency: 20,
			// straight at the camera, give or take
			elevation: -math.ETA,
			elevationVariation: 0.12,
			speed: 3.2,
			speedVariation: 1.6,
			minLife: 9000,
			maxLife: 16000,
			minStartScale: 0.2,
			maxStartScale: 0.55,
			minEndScale: 0.45,
			maxEndScale: 0.9,
			blendMode: "additive",
			// measured from the emitter, which is what puts them at its depth
			referenceSpace: "local",
			onlyInViewport: false,
		});

		for (let i = 0; i < 3; i++) {
			this.novas.push(this.makeNova(image));
		}

		for (const emitter of [this.dust, ...this.novas]) {
			emitter.isPersistent = true;
			emitter.visibilityLayer = SPACE_LAYER;
		}
		world.addChild(this.dust, DUST.near + depth / 2);
		for (const nova of this.novas) {
			world.addChild(nova, NOVA_DEPTH);
		}
		this.dust.streamParticles();
	}

	private makeNova(image: HTMLCanvasElement) {
		return new ParticleEmitter(0, 0, {
			image,
			width: NOVA_SIZE,
			height: NOVA_SIZE,
			depth: NOVA_SIZE,
			totalParticles: 220,
			// every way at once: a sphere
			maxSpread: Math.PI,
			speed: 5,
			speedVariation: 2.5,
			minLife: 1600,
			maxLife: 2800,
			minStartScale: 0.5,
			maxStartScale: 1.1,
			minEndScale: 0,
			maxEndScale: 0.2,
			blendMode: "additive",
			referenceSpace: "local",
			onlyInViewport: false,
		});
	}

	/** take on a level's colours: new dust is born in them */
	setColors(colors: string[]) {
		this.colors = colors;
	}

	/**
	 * a nova far away, somewhere on screen
	 * @param size - 1 for a big one
	 */
	burst(color: string, size = 1) {
		const e = this.novas[this.nextNova];
		this.nextNova = (this.nextNova + 1) % this.novas.length;
		e.settings.tint = color;
		e.settings.speed = 5 * size;
		// somewhere in view at that depth, kept clear of the very edges
		const halfH = Math.tan(this.camera.fov / 2) * NOVA_DEPTH * 0.6;
		const halfW = halfH * (this.camera.width / this.camera.height);
		// the spawn area hangs from the emitter's top left: centre it
		e.pos.x = math.randomFloat(-halfW, halfW) - NOVA_SIZE / 2;
		e.pos.y = math.randomFloat(-halfH, halfH) - NOVA_SIZE / 2;
		e.burstParticles(Math.round(70 + 150 * size));
	}

	/**
	 * A level cleared: fireworks far out in space, in its colours.
	 * @param lit - the level's colour
	 * @param litHi - its lighter colour
	 */
	celebrate(lit: string, litHi: string) {
		this.burst(lit, 1.2);
		this.burst(litHi, 0.8);
	}

	override update(dt: number) {
		this.time += dt / 1000;
		// each new particle takes the tint of the moment: cycle through the
		// colours so the dust is a mix of them
		this.next = (this.next + 1) % this.colors.length;
		this.dust.settings.tint = this.colors[this.next];
		// drift the camera a little, so near and far dust part
		this.camera.yaw = Math.sin(this.time * 0.11) * 0.16;
		this.camera.pitch = Math.sin(this.time * 0.07) * 0.12;
		this.camera.roll = Math.sin(this.time * 0.05) * 0.08;
		return false;
	}

	/** take everything off the world, for good */
	destroy() {
		for (const r of [this.dust, ...this.novas, this]) {
			if (r.ancestor) {
				this.world.removeChild(r);
			}
		}
	}
}
