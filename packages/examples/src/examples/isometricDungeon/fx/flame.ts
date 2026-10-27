/**
 * melonJS — Isometric Dungeon example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { ParticleEmitter } from "melonjs";
import { PARTICLES } from "../constants";

// a flame particle goes from white hot to deep red as it rises. The flame
// is additive, so a darker tint is a dimmer particle: each color carries
// how faint that stage of the flame is
const COLORS = [
	"#b2a57e",
	"#a67f37",
	"#995317",
	"#722a0a",
	"#330d04",
	"#0c0301",
];
const SIZE = 16;

let dot: HTMLCanvasElement | undefined;
// a soft white dot: the emitter tints it
function flameDot() {
	if (!dot) {
		dot = document.createElement("canvas");
		dot.width = SIZE;
		dot.height = SIZE;
		const context = dot.getContext("2d");
		if (!context) {
			throw new Error("could not create a 2d context");
		}
		const half = SIZE / 2;
		const fill = context.createRadialGradient(half, half, 0, half, half, half);
		fill.addColorStop(0, "rgba(255, 255, 255, 1)");
		fill.addColorStop(0.45, "rgba(255, 255, 255, 0.6)");
		fill.addColorStop(1, "rgba(255, 255, 255, 0)");
		context.fillStyle = fill;
		context.fillRect(0, 0, SIZE, SIZE);
	}
	return dot;
}

// a small fire burning at (x, y), streaming as long as it lives
export function torchFlame(x: number, y: number) {
	const width = 5;
	const height = 2;
	const flame = new ParticleEmitter(x - width / 2, y - height / 2, {
		image: flameDot(),
		tintOverLife: COLORS,
		width,
		height,
		totalParticles: 28,
		angle: Math.PI / 2,
		angleVariation: 0.22,
		speed: 0.55,
		speedVariation: 0.15,
		// hot air rises faster and faster
		gravity: -0.018,
		minLife: 380,
		maxLife: 700,
		minStartScale: 0.5,
		maxStartScale: 0.75,
		minEndScale: 0.1,
		maxEndScale: 0.2,
		textureAdditive: true,
		frequency: 16,
	});
	flame.visibilityLayer = PARTICLES;
	flame.streamParticles();
	return flame;
}
