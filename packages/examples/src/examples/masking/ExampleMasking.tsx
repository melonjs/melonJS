/**
 * melonJS — renderer mask region demo example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	Ellipse,
	event,
	game,
	loader,
	Polygon,
	RoundRect,
	Sprite,
	Text,
	VignetteEffect,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";
import bgImage from "./assets/psycool.jpg";

const createGame = () => {
	if (
		!video.init(1218, 768, {
			parent: "screen",
			scaleMethod: "fit",
			renderer: video.AUTO,
			preferWebGL1: false,
		})
	) {
		alert("Your browser does not support HTML5 canvas.");
		return;
	}

	loader.load({ name: "background", type: "image", src: bgImage }, () => {
		// apply subtle vignette post-process effect on the camera
		game.viewport.shader = new VignetteEffect(video.renderer);
		const bg_sprite1 = new Sprite(
			game.viewport.width / 2,
			game.viewport.height / 2,
			{
				image: "background",
				anchorPoint: { x: 0.5, y: 0.5 },
			},
		);
		bg_sprite1.mask = new RoundRect(
			-game.viewport.width / 2,
			-game.viewport.height / 2,
			game.viewport.width,
			game.viewport.height,
			20,
		);

		const bg_sprite2 = new Sprite(
			game.viewport.width / 2,
			game.viewport.height / 2,
			{
				image: "background",
				anchorPoint: { x: 0.5, y: 0.5 },
			},
		);
		bg_sprite2.alpha = 0.9;
		bg_sprite2.tint.setColor(128, 255, 255);
		bg_sprite2.mask = new Ellipse(0, 0, 640, 640);
		bg_sprite2.blendMode = "screen";

		const bg_sprite3 = new Sprite(
			game.viewport.width / 2,
			game.viewport.height / 2,
			{
				image: "background",
				anchorPoint: { x: 0.5, y: 0.5 },
			},
		);
		bg_sprite3.alpha = 0.9;
		bg_sprite3.tint.setColor(255, 0, 255);
		bg_sprite3.mask = new Polygon(0, -240, [
			{ x: 0, y: 0 },
			{ x: 14, y: 30 },
			{ x: 47, y: 35 },
			{ x: 23, y: 57 },
			{ x: 44, y: 90 },
			{ x: 0, y: 62 },
			{ x: -44, y: 90 },
			{ x: -23, y: 57 },
			{ x: -47, y: 35 },
			{ x: -14, y: 30 },
		]);
		bg_sprite3.mask.scale(5.0);
		bg_sprite3.blendMode = "normal";

		const text = new Text(game.viewport.width / 2, game.viewport.height / 2, {
			text: "this is rendered using only one single image !",
			font: "Arial",
			size: 14,
			fillStyle: "white",
			textAlign: "center",
			textBaseline: "middle",
		});

		game.world.reset();
		game.world.addChild(bg_sprite1);
		game.world.addChild(bg_sprite2);
		game.world.addChild(bg_sprite3);
		game.world.addChild(text);

		event.on(event.GAME_UPDATE, () => {
			bg_sprite1.rotate(0.0125);
			bg_sprite2.rotate(-0.0125);
			bg_sprite3.rotate(0.0125);
		});
	});
};

export const ExampleMasking = createExampleComponent(createGame);
