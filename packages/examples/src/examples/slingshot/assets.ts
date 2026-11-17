/**
 * melonJS — Slingshot: everything the game preloads.
 *
 * Rapier's WebAssembly, the animal models, the painted textures and the
 * backdrop all go through `loader.preload`, behind the loading screen.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Rapier3dAdapter } from "@melonjs/rapier3d-adapter";
import { loader } from "melonjs";
import { KENNEY_LOGO } from "../kenneyCredit";
import {
	GRASS,
	MESH_BASE,
	PETS,
	PETS_BASE,
	RIVALS,
	STONE,
	WOOD,
} from "./constants";
import { paint } from "./meshes/textures";

// whether the loader has been taught the "rapier3d" asset type yet
let rapierAssetType = false;

/**
 * Teach the loader a "rapier3d" asset type, so that Rapier's WebAssembly
 * downloads and compiles behind the loading screen with everything else.
 * Done once: the example can be started again in the same page.
 */
export const registerRapierAssetType = () => {
	if (rapierAssetType) {
		return;
	}
	rapierAssetType = true;
	loader.setParser("rapier3d", (_asset, onload, onerror) => {
		Rapier3dAdapter.load().then(() => {
			onload();
		}, onerror);
		return 1;
	});
};

/**
 * The list handed to `loader.preload`.
 * @returns every asset the game uses
 */
export const slingshotAssets = () => {
	return [
		{ name: "rapier3d", type: "rapier3d", src: "" },
		// the textures painted in code go through the loader as images too
		...[WOOD, STONE, GRASS].map((name) => {
			return { name, type: "image", src: paint(name).toDataURL() };
		}),
		// the dots of the aiming arc
		{ name: "sphere", type: "obj", src: `${MESH_BASE}sphere.obj` },
		{ name: "backdrop", type: "image", src: `${PETS_BASE}jungle_bg.png` },
		// each animal's model, and its material, which brings its texture
		...[...PETS, ...RIVALS].flatMap((name) => {
			return [
				{ name, type: "obj", src: `${PETS_BASE}${name}.obj` },
				{ name, type: "mtl", src: `${PETS_BASE}${name}.mtl` },
			];
		}),
		KENNEY_LOGO,
	];
};
