/**
 * melonJS — Starsweep: the two layers every screen is drawn in.
 *
 * Space behind, drawn by a second, perspective camera where the renderer
 * can do 3D, and the game in front, drawn by the stage's own 2D camera.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { type Application, type Camera3d, Container } from "melonjs";
import { HEIGHT, WIDTH } from "../config/layout";
import { DeepSpace } from "../fx/DeepSpace";
import { NebulaBackdrop } from "../fx/NebulaBackdrop";
import { setupScreenFx } from "../fx/screenFx";
import { makeSpaceCamera, SPACE_LAYER } from "../fx/spaceCamera";

/**
 * Sets a screen up in two layers.
 *
 * - **Space**, behind: the shader nebula and, when the renderer can do 3D,
 *   the star dust and novas. These are on the space visibility layer, which
 *   only the space camera (a `Camera3d`) draws, and it draws first.
 * - **The game**, in front: a container for everything else, drawn by the
 *   stage's ordinary 2D camera, which leaves the space layer out. Its bloom
 *   is blended over the space (see `setupScreenFx`).
 * @returns the game's container, the nebula (null when the drawn sky should
 * be used instead), and the 3D space (null without a 3D camera)
 */
export const setUpLayers = (app: Application, camera: Camera3d | null) => {
	const world = app.world;
	const game = new Container(0, 0, WIDTH, HEIGHT);
	game.name = "game";
	world.addChild(game, 0);
	setupScreenFx(app, camera);

	let deep: DeepSpace | null = null;
	if (camera) {
		// the world is on both layers, so each camera walks into it
		world.visibilityLayer = 1 | SPACE_LAYER;
		app.viewport.cullMask = ~SPACE_LAYER;
		deep = new DeepSpace(world, camera);
		world.addChild(deep, 0);
	}
	let sky: NebulaBackdrop | null = new NebulaBackdrop(WIDTH, HEIGHT);
	if (!sky.supported) {
		sky = null;
	} else if (camera) {
		// the space camera draws it, as far back as it can see
		sky.visibilityLayer = SPACE_LAYER;
		sky.visibleInAllCameras = true;
		world.addChild(sky, -5000);
	} else {
		world.addChild(sky, -10);
	}
	return { game, sky, deep };
};

/** a stage's settings, with the space camera when the renderer can do 3D */
export const withSpaceCamera = () => {
	const camera = makeSpaceCamera(WIDTH, HEIGHT);
	return { camera, settings: camera ? { cameras: [camera] } : {} };
};
