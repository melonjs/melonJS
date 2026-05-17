/**
 * melonJS — Light2d multi-light showcase example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	game,
	input,
	Light2d,
	loader,
	ScanlineEffect,
	Sprite,
	Stage,
	state,
	VignetteEffect,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";
import wallpaper from "./assets/pixel-art-16-bit-sega-streets-of-rage-city-wallpaper.jpg";

class PlayScreen extends Stage {
	/**
	 *  action to perform on state change
	 */
	onResetEvent() {
		// background sprite
		const bg_sprite = new Sprite(
			game.viewport.width / 2,
			game.viewport.height / 2,
			{
				image: "background",
				anchorPoint: { x: 0.5, y: 0.5 },
			},
		);
		bg_sprite.scale(2);

		// add to the game world
		game.world.addChild(bg_sprite);

		// Light2d is a first-class world Renderable — add it like any other
		// Renderable. Its onActivateEvent auto-registers it with the stage's
		// ambient-overlay cutout list.
		const whiteLight = new Light2d(
			game.viewport.width / 2,
			game.viewport.height / 2,
			200,
			140,
			"#fff",
			0.7,
		);
		game.world.addChild(whiteLight);

		// second light, fixed position, different color — exercises the
		// multi-light cutout path so multiple holes are punched through the
		// ambient fill simultaneously.
		const orangeLight = new Light2d(
			game.viewport.width * 0.18,
			game.viewport.height * 0.725,
			140,
			100,
			"#ff8a3c",
			0.8,
		);
		game.world.addChild(orangeLight);

		// dark ambient light — anything outside the spot lights' visible areas
		// is darkened by this fill. The cutout pass runs inside the camera's
		// post-effect FBO so the vignette below applies to the lighting too.
		this.ambientLight.parseCSS("#1117");

		// chain TWO post-effects on the viewport to exercise the multi-pass
		// FBO ping-pong (Renderable.postEffects), not the single-shader fast
		// path. Lights MUST render inside that FBO bracket — if they escape
		// it, you'll see the gradients sit on top of the scanlines / past
		// the vignette instead of being darkened with everything else.
		// This is the visual contract `Stage.drawLighting` + the procedural
		// drawLight pipeline have to honor on both Canvas and WebGL.
		const renderer = video.renderer as Parameters<typeof VignetteEffect>[0];
		game.viewport.addPostEffect(new VignetteEffect(renderer));
		game.viewport.addPostEffect(
			new ScanlineEffect(renderer, {
				opacity: 0.18,
				curvature: 0.015,
			}),
		);

		// white light follows the mouse; orange light stays put
		input.registerPointerEvent("pointermove", game.viewport, (event) => {
			whiteLight.centerOn(event.gameX, event.gameY);
		});
	}
}

const createGame = () => {
	video.init(728, 410, {
		parent: "screen",
		scaleMethod: "flex",
		renderer: video.AUTO,
	});

	// set the "Play/Ingame" Screen Object
	state.set(state.PLAY, new PlayScreen());

	loader.preload(
		[
			{
				name: "background",
				type: "image",
				src: wallpaper,
			},
		],
		() => {
			state.change(state.PLAY);
		},
	);
};

export const ExampleLights = createExampleComponent(createGame);
