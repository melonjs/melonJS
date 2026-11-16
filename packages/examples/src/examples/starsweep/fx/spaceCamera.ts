/**
 * melonJS — Starsweep: the camera that draws the space behind the game.
 *
 * A second, perspective camera, so the star dust and novas of
 * `DeepSpace` are drawn in depth, under everything the game's own 2D
 * camera draws. The two cameras are kept apart by visibility layers.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Camera3d, game } from "melonjs";

/**
 * The visibility layer of the space behind the game. Only the space camera
 * draws it, and the game's own camera leaves it out.
 */
export const SPACE_LAYER = 2;

/**
 * A second camera, a perspective `Camera3d`, that draws only the space
 * behind the game. Give it to a `Stage` with `super({ cameras: [...] })`: a
 * stage's own cameras draw before its default one, so space ends up under
 * everything the game's 2D camera draws.
 *
 * Its eye sits at the origin looking down +Z, deeper into the screen.
 * @returns the camera, or null on a renderer without 3D (Canvas, WebGL 1)
 */
export const makeSpaceCamera = (w: number, h: number) => {
	if (game.renderer?.supportsDepthBuffer !== true) {
		return null;
	}
	const camera = new Camera3d(0, 0, w, h, {
		fov: Math.PI / 3,
		near: 1,
		far: 6000,
	});
	camera.name = "space";
	camera.cullMask = SPACE_LAYER;
	return camera;
};
