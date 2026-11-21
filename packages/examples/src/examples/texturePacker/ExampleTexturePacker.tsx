/**
 * melonJS — TexturePacker atlas + animation demo example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import {
	Application,
	game,
	loader,
	plugin,
	Sprite,
	Stage,
	state,
	TextureAtlas,
} from "melonjs";
import { createExampleComponent } from "../utils";

const base = `${import.meta.env.BASE_URL}assets/texturePacker/img/`;

let texture: TextureAtlas;

/** the walking character: a sprite animated from eight frames of the atlas */
class CapGuy extends Sprite {
	constructor() {
		super(
			50,
			200,
			texture.getAnimationSettings([
				"capguy/walk/0001",
				"capguy/walk/0002",
				"capguy/walk/0003",
				"capguy/walk/0004",
				"capguy/walk/0005",
				"capguy/walk/0006",
				"capguy/walk/0007",
				"capguy/walk/0008",
			]),
		);
		// it walks off one side and back in from the other: keep it
		// updating while it is out of view, or it would stay there
		this.alwaysUpdate = true;
	}

	override update(dt: number) {
		this.pos.x += 0.3 * dt;
		// its position is its centre: gone once half its width past the edge
		if (this.pos.x - this.width / 2 >= game.viewport.width) {
			this.pos.x = -this.width / 2;
		}
		super.update(dt);
		return true;
	}
}

class PlayScreen extends Stage {
	override onResetEvent() {
		const w = game.viewport.width;
		const h = game.viewport.height;

		const background = texture.createSpriteFromName("background") as Sprite;
		background.pos.set(w / 2, h / 2, 1);
		game.world.addChild(background, 1);
		game.world.addChild(new CapGuy(), 2);
	}
}

const createGame = async () => {
	try {
		const app = new Application(800, 400, {
			parent: "screen",
			scale: "auto",
		});
		await app.init();
	} catch {
		alert("Your browser does not support HTML5 canvas.");
		return;
	}

	// register the debug plugin
	plugin.register(DebugPanelPlugin, "debugPanel");

	const resources = [
		{ name: "cityscene", type: "json", src: `${base}cityscene.json` },
		{ name: "cityscene", type: "image", src: `${base}cityscene.png` },
	];

	loader.preload(resources, () => {
		texture = new TextureAtlas(
			loader.getJSON("cityscene"),
			loader.getImage("cityscene"),
		);

		state.set(state.PLAY, new PlayScreen());
		state.change(state.PLAY);
	});
};

export const ExampleTexturePacker = createExampleComponent(createGame);
