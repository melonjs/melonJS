/**
 * melonJS — Jungle Rabbit: every texture in this example is made here.
 *
 * No image assets: the whole scene is baked at boot into canvases and handed
 * to `Sprite3d` / `Mesh` as `image`. The river is the exception — a
 * `NoiseTexture2d`, baked once (`animated: false`); its apparent motion is the
 * UV scroll in `scrollWaterPlane`. Chunky, deliberately low-resolution
 * shapes upscaled with `textureFilter: "nearest"` give the pixel look without
 * anyone opening an art tool.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */

import { Gradient, NoiseTexture2d } from "melonjs";

/** a canvas of the given size, with image smoothing already off */
const bake = (
	w: number,
	h: number,
	draw: (ctx: CanvasRenderingContext2D) => void,
) => {
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d");
	if (ctx === null) {
		// a blank canvas would reach the mesh as an untextured surface and say
		// nothing about why, so refuse here instead
		throw new Error("jungleRabbit: no 2d context — cannot bake textures");
	}
	ctx.imageSmoothingEnabled = false;
	draw(ctx);
	return canvas;
};

/** filled rect helper */
const px = (
	ctx: CanvasRenderingContext2D,
	color: string,
	x: number,
	y: number,
	w: number,
	h: number,
) => {
	ctx.fillStyle = color;
	ctx.fillRect(x, y, w, h);
};

/**
 * The bed and the banks — the solid ground the river lies over.
 *
 * Silt and gravel. It is seen THROUGH the water in the channel and directly on
 * the banks, where the vertex tint takes it green, so it has to read as ground
 * in both places.
 */
export const bakeGround = () => {
	return bake(64, 64, (ctx) => {
		px(ctx, "#b8a06a", 0, 0, 64, 64);
		for (let i = 0; i < 30; i++) {
			px(
				ctx,
				i % 3 === 0 ? "#a68f5c" : "#c4ad78",
				(i * 27 + 5) % 61,
				(i * 19 + 11) % 59,
				3,
				2,
			);
		}
		for (let i = 0; i < 10; i++) {
			px(ctx, "#8f7c50", (i * 23 + 9) % 60, (i * 31 + 3) % 60, 2, 2);
		}
	});
};

/**
 * The river surface: teal simplex noise with downstream current bands and broken white water,
 * tiled along the gorge by the mesh UVs.
 *
 * V runs downstream, so every streak here is drawn vertically — a horizontal
 * one reads as a standing wave across the river and kills the sense of flow.
 * Contrast is deliberately overdone: the lighting multiplies it (~0.85) and
 * the fog multiplies it again, and small differences vanish on a bright
 * surface long before they reach the screen.
 */
export const makeWater = () => {
	// A colour ramp rather than grey noise: the field maps straight to water
	// tones, so no second pass is needed to tint it. Deep in the troughs,
	// bright at the crests, with most of the range in the middle where the
	// river actually sits.
	const ramp = new Gradient("linear", [0, 0, 1, 0]);
	// Alpha, not just colour: the bed shows through the troughs and closes up
	// under the crests. That gradient of transparency is what separates water
	// from a blue floor — a uniform alpha reads as tinted glass. Widening that
	// spread rather than lowering every stop is what reads as depth, but there
	// is a floor on it: the water plane's outer columns rise 60 units to tuck
	// into the bank, and past about 0.6 at the trough that lip shows through
	// the surface as a pale wedge in the near corners.
	ramp.addColorStop(0, "rgba(16,80,98,0.64)");
	ramp.addColorStop(0.42, "rgba(34,120,142,0.72)");
	ramp.addColorStop(0.72, "rgba(80,180,200,0.82)");
	ramp.addColorStop(0.9, "rgba(186,240,250,0.92)");
	ramp.addColorStop(1, "rgba(255,255,255,1)");

	return new NoiseTexture2d({
		// Small on purpose: the mesh UVs repeat it every `WATER_UV` world units,
		// so pixels past a certain point buy nothing but bake time.
		width: 96,
		height: 96,
		type: "simplex",
		seed: 7,
		// three octaves: a swell, a chop, and a fine sparkle on the crests. Two
		// read as a smooth undulation that the eye takes for shading instead.
		octaves: 3,
		frequency: 0.055,
		gain: 0.5,
		// ESSENTIAL: the terrain UVs run to many multiples of 1, so a texture
		// that does not tile cleanly puts a hard seam across the river every
		// `WATER_UV` units.
		seamless: true,
		colorRamp: ramp,
		// Static. The movement comes from the surface DRIFTING past the boat
		// (see `RIVER_FLOW`), not from re-baking the field.
		//
		// Two dead ends are worth recording here. An `animated: true` texture
		// re-bakes correctly — the pixels genuinely change — but the mesh path
		// never picked the new copy up, so the river rendered frozen while
		// every counter said it worked. And a `ShaderEffect` scrolling a static
		// field, which is how the 2D aquarium example does its ripples, cannot
		// host a mesh draw on the WebGPU backend at all: the engine says so
		// itself in `webgpu_renderer.js`, and silently keeps the built-in
		// shading, which renders the surface as its plain texture.
		animated: false,
	});
};

/**
 * The sun: a hot white core inside a warm halo.
 *
 * Drawn additively through the transparent pass, so the halo adds light to the
 * sky rather than compositing a grey disc over it — an opaque mesh cannot do
 * this at all, because the mesh path disables blending.
 */
export const bakeSun = () => {
	return bake(64, 64, (ctx) => {
		const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
		// Warm, not white. The disc is drawn ADDITIVELY over a bright sky, which
		// pushes every channel toward 255 — so a core that starts near-white
		// arrives white and the sun reads as a hole in the sky rather than as a
		// light in it. Holding blue back through the whole ramp is what keeps
		// the yellow once the sky has been added to it.
		g.addColorStop(0, "rgba(255,248,206,1)");
		g.addColorStop(0.3, "rgba(255,228,150,0.88)");
		g.addColorStop(0.6, "rgba(255,198,96,0.38)");
		g.addColorStop(1, "rgba(255,176,74,0)");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 64, 64);
	});
};

/** one soft round puff — the trail and the snow spray are made of these */
export const bakePuff = () => {
	return bake(32, 32, (ctx) => {
		const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
		g.addColorStop(0, "rgba(255,255,255,1)");
		g.addColorStop(0.55, "rgba(255,255,255,0.85)");
		g.addColorStop(1, "rgba(255,255,255,0)");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 32, 32);
	});
};
