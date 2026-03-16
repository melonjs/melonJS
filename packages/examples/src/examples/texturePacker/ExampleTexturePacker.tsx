import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import {
	Entity,
	game,
	loader,
	plugin,
	type Sprite,
	Stage,
	state,
	TextureAtlas,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";

const base = `${import.meta.env.BASE_URL}assets/texturePacker/img/`;

let texture: TextureAtlas;

class CapGuyEntity extends Entity {
	constructor() {
		super(0, 50, { width: 100, height: 300 });
		this.body.setStatic();
		this.renderable = texture.createAnimationFromName([
			"capguy/walk/0001",
			"capguy/walk/0002",
			"capguy/walk/0003",
			"capguy/walk/0004",
			"capguy/walk/0005",
			"capguy/walk/0006",
			"capguy/walk/0007",
			"capguy/walk/0008",
		]);
	}

	override update(dt: number) {
		this.pos.x += 0.3 * dt;
		if (this.pos.x >= game.viewport.width) {
			this.pos.x = 0;
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
		game.world.addChild(new CapGuyEntity(), 2);
	}
}

const createGame = () => {
	if (
		!video.init(800, 400, {
			parent: "screen",
			scale: "auto",
		})
	) {
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
