/**
 * melonJS — Sprite + animation basics example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	ColorLayer,
	event,
	game,
	loader,
	Sprite,
	state,
	Vector2d,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";
import galaxyImg from "./assets/galaxy.png";
import monsterImg from "./assets/monster.png";

const resources = [
	{ name: "monster", type: "image", src: monsterImg },
	{ name: "background", type: "image", src: galaxyImg },
];

const createGame = () => {
	// Initialize the video.
	if (
		!video.init(1218, 562, {
			parent: "screen",
			scaleMethod: "flex",
			renderer: video.AUTO,
		})
	) {
		alert("Your browser does not support HTML5 canvas.");
		return;
	}

	// load assets and populate the game world
	loader.preload(resources, () => {
		state.change(state.DEFAULT, true);

		// background sprite (centered, semi-transparent, rotating)
		const bgSprite = new Sprite(
			game.viewport.width / 2,
			game.viewport.height / 2,
			{
				image: "background",
				anchorPoint: new Vector2d(0.5, 0.5),
			},
		);
		bgSprite.alpha = 0.5;

		// left sprite (small, rotating clockwise)
		const leftSprite = new Sprite(
			game.viewport.width / 2 - 125,
			game.viewport.height / 2,
			{
				image: "monster",
				anchorPoint: new Vector2d(0.5, 0.5),
			},
		);
		leftSprite.scale(0.25);

		// right sprite (larger, rotating counter-clockwise)
		const rightSprite = new Sprite(
			game.viewport.width / 2 + 125,
			game.viewport.height / 2,
			{
				image: "monster",
				anchorPoint: new Vector2d(0.5, 0.5),
			},
		);
		rightSprite.scale(0.75);

		// add all children to the game world
		game.world.addChild(new ColorLayer("background", "#202020"));
		game.world.addChild(bgSprite);
		game.world.addChild(leftSprite);
		game.world.addChild(rightSprite);

		// rotate sprites each frame
		event.on(event.GAME_UPDATE, () => {
			bgSprite.rotate(0.0125);
			leftSprite.rotate(0.05);
			rightSprite.rotate(-0.05);
		});
	});
};

export const ExampleSprite = createExampleComponent(createGame);
