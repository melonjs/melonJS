/**
 * melonJS — a slingshot game on 3D physics.
 *
 * Pull a pet back in the slingshot and let go: it flies along the dotted arc
 * and crashes into towers of wood and stone, which topple and tumble in three
 * dimensions. Knock out every rival perched on the towers, with a hard hit or
 * a fall to the ground, using the pets you have; pets left over score a bonus.
 *
 * What it shows, and where:
 *
 * - **Everything through the preloader** (`assets.ts`). Rapier's WebAssembly
 *   is an asset type of its own (`loader.setParser`), loaded behind the
 *   loading screen with the models, whose materials bring their own
 *   texture. The wood, stone and grass are painted in code on a
 *   `CanvasRenderTarget` (`meshes/textures.ts`) and preloaded as images too.
 *   The world then switches to Rapier with `world.setAdapter()` (below).
 * - **`@melonjs/rapier3d-adapter`**, with a `Camera3d`. Every block, pet and
 *   rival is a `Mesh` with a `bodyDef`; the adapter writes each body's
 *   position and turn back onto its mesh.
 * - **The 3D shapes.** Blocks are `Box3d` (`entities/towers.ts`), and each
 *   pet and rival the `ConvexHull3d` of its own model, built with
 *   `ConvexHull3d.fromMesh()` (`entities/Pet.ts`, `entities/Rival.ts`).
 * - **The `Vector3d` adapter API** (`entities/Pet.ts`, `game/Round.ts`): the
 *   pet waits in the pouch as a static body, moved with `setPosition` while
 *   it is pulled; letting go launches it with `setStatic(false)`,
 *   `setVelocity` and `setAngularVelocity`. A shot is over once the pet has
 *   come to rest, which the adapter says with `isSleeping()`.
 * - **A press anywhere** (`input/AimArea.ts`), which a phone needs: the whole
 *   screen is one pointer region behind the UI.
 * - **Collision hooks** (`entities/Rival.ts`): a rival's `onCollisionStart`
 *   tells when it lands on the ground or is struck hard (`getVelocity3d`).
 * - **The UI widgets and `Tween`** (`ui/`): the end-of-round card is a
 *   `UIPanel` with a `UITextButton`; tweens fade a rival out, lift the score
 *   it earned, and carry the next pet into the pouch along a path.
 * - **`state.reload()`** for PLAY AGAIN (`ui/EndCard.ts`, `game/PlayStage.ts`):
 *   the stage is built again on a world emptied of the last round.
 * - **A camera that orbits the field** (`camera/OrbitCamera.ts`), eased with
 *   `math.damp`; the slingshot's bands are turned in 3D with a `Quaternion`
 *   (`entities/Slingshot.ts`).
 *
 * The pets are Kenney's Cube Pets (CC0, see `packages/examples/LICENSE.md`).
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import { Rapier3dAdapter } from "@melonjs/rapier3d-adapter";
import { Application, Camera3d, loader, plugin, state, video } from "melonjs";
import { createExampleComponent } from "../utils";
import { registerRapierAssetType, slingshotAssets } from "./assets";
import { GRAVITY } from "./constants";
import { PlayStage } from "./game/PlayStage";

const createGame = async () => {
	let app: Application;
	try {
		app = new Application(1024, 768, {
			parent: "screen",
			renderer: video.AUTO,
			scale: "auto",
			cameraClass: Camera3d,
			antiAlias: true,
		});
		await app.init();
		if (!app.renderer.supportsDepthBuffer) {
			throw new Error("no GPU backend available (Canvas fallback)");
		}
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		globalThis.alert(
			"This example couldn't start: it needs WebGL 2 or WebGPU.\n\n" +
				`Details: ${reason}`,
		);
		throw err;
	}

	plugin.register(DebugPanelPlugin, "debugPanel");

	registerRapierAssetType();
	await loader.preload(slingshotAssets());

	// Rapier is compiled now: the world moves onto it before the first round
	app.world.setAdapter(
		new Rapier3dAdapter({
			gravity: { x: 0, y: GRAVITY, z: 0 },
			pixelsPerMeter: 50,
		}),
	);
	state.set(state.PLAY, new PlayStage());
	state.change(state.PLAY);
};

export const ExampleSlingshot = createExampleComponent(createGame);
