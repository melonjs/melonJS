/**
 * melonJS — Jungle Rabbit: shared handles to everything the preloader brought in.
 *
 * `loader.preload` fills the engine's asset cache; this is where a stage picks
 * things back out of it. Two kinds live here:
 *
 * - **Derived** assets, built once by `initAssets()` after the preload
 *   resolves. The palette strip is a canvas, and the renderer's texture cache
 *   is keyed by the image object — so baking a fresh one per stage would
 *   upload a new GPU texture every time the title, the run and the game-over
 *   screen were entered, for twenty pixels that never change.
 * - **Loaded** assets, read straight back out of the loader by name. Those are
 *   already cached, so the lookup is free and a stage can do it whenever.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { loader, type NoiseTexture2d, type ShaderEffect } from "melonjs";
import { bakePalette, type Geometry } from "./props";
import { bakeGround, bakePuff, bakeSun, makeWater } from "./textures";

let palette: HTMLCanvasElement | undefined;
let ground: HTMLCanvasElement | undefined;
let water: NoiseTexture2d | undefined;
let puff: HTMLCanvasElement | undefined;
let sun: HTMLCanvasElement | undefined;
let ripple: ShaderEffect | undefined;
let sunFlare: ShaderEffect | undefined;

/**
 * Build the derived assets. Call once, after `loader.preload` has resolved and
 * before any stage is entered.
 *
 * This is the prewarm: it runs while the loading screen is still up, so the
 * textures every stage samples exist before the first one is entered. Each of
 * these used to be rebuilt on entry — a fresh canvas and a fresh
 * `NoiseTexture2d` per stage, which the renderer keys by object identity and
 * so uploaded as a brand new GPU texture (with its mip chain) every time the
 * title, the run and the game-over screen came up.
 */
export const initAssets = () => {
	palette ??= bakePalette();
	ground ??= bakeGround();
	water ??= makeWater();
	puff ??= bakePuff();
	sun ??= bakeSun();
	if (ripple === undefined) {
		// Preloaded as a "shader" asset, so the compile lands inside the
		// loading screen rather than on the first frame of a run.
		ripple = loader.getShader("ripples") as ShaderEffect;
	}
	if (sunFlare === undefined) {
		sunFlare = loader.getShader("flare") as ShaderEffect;
	}
};

/**
 * The soft dot every particle emitter draws — spray, splash, wake, sparkle.
 * @returns the puff canvas
 */
export const getPuff = () => {
	if (puff === undefined) {
		throw new Error("Jungle Rabbit: initAssets() has not run yet.");
	}
	return puff;
};

/**
 * The sun billboard's texture.
 * @returns the sun canvas
 */
export const getSun = () => {
	if (sun === undefined) {
		throw new Error("Jungle Rabbit: initAssets() has not run yet.");
	}
	return sun;
};

/**
 * The bank/bed texture the terrain tiles sample.
 * @returns the ground canvas
 */
export const getGround = () => {
	if (ground === undefined) {
		throw new Error("Jungle Rabbit: initAssets() has not run yet.");
	}
	return ground;
};

/**
 * The animated river surface. Shared, and deliberately never destroyed by a
 * stage: it outlives all of them, and whichever stage is running drives its
 * `update`.
 * @returns the water noise texture
 */
export const getWater = () => {
	if (water === undefined) {
		throw new Error("Jungle Rabbit: initAssets() has not run yet.");
	}
	return water;
};

/**
 * The palette strip every model samples — one canvas, and therefore one
 * texture, shared by every instanced set in every stage.
 * @returns the palette canvas
 */
export const getPalette = () => {
	if (palette === undefined) {
		throw new Error("Jungle Rabbit: initAssets() has not run yet.");
	}
	return palette;
};

/**
 * Raw geometry for one preloaded model, ready to spread into a `Mesh` or an
 * `InstancedMesh`.
 *
 * Every asset is authored as a single merged primitive with an identity node
 * transform, which is what makes `nodes[0]` the whole model and lets its
 * vertices be used without folding a node matrix in first.
 * @param name - the preloaded asset name
 * @returns vertices, uvs, normals and indices
 */
export const geometry = (name: string): Geometry => {
	const node = loader.getGLTF(name)?.nodes[0];
	if (node === undefined) {
		throw new Error(`Jungle Rabbit: "${name}" did not preload.`);
	}
	return {
		vertices: node.vertices,
		uvs: node.uvs,
		normals: node.normals,
		indices: node.indices,
	};
};

/**
 * The river's travelling crests, hosted on the water mesh.
 *
 * Shared and never destroyed by a stage — `removePostEffect` destroys the
 * effect it removes, and this one outlives every stage that shows water.
 * @returns the shared ripple effect
 */
export const getRipples = () => {
	if (ripple === undefined) {
		throw new Error("Jungle Rabbit: initAssets() has not run yet.");
	}
	return ripple;
};

/**
 * The sun's lens flare, hosted on a screen-filling quad.
 *
 * Shared and never destroyed by a stage, for the same reason as the ripples:
 * `removePostEffect` destroys the effect it removes, and this one outlives
 * every stage that shows a sky.
 * @returns the shared flare effect
 */
export const getFlare = () => {
	if (sunFlare === undefined) {
		throw new Error("Jungle Rabbit: initAssets() has not run yet.");
	}
	return sunFlare;
};
