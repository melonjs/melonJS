import {
	game,
	input,
	Light2d,
	loader,
	Sprite,
	Stage,
	state,
	TextureAtlas,
	Vector2d,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";
import bg01 from "./assets/background_01.png";
import fg01 from "./assets/foreground_01.png";
import fg01n from "./assets/foreground_01_n.png";
import lightbulbImg from "./assets/lightbulb.png";
import spritesheetJsonUrl from "./assets/spritesheet.json?url";
import spritesheetImg from "./assets/spritesheet.png";
import spritesheetN from "./assets/spritesheet_n.png";

// Faithful conversion of the CodeAndWeb cocos2d-x dynamic-lighting
// example (https://github.com/CodeAndWeb/cocos2d-x-dynamic-lighting-example).
// Demonstrates the SpriteIlluminator workflow:
//
// - A `TextureAtlas` constructed with `{ normalMap }` pairs the
//   character spritesheet with its `*_n.png` companion (TexturePacker's
//   "Pack with same layout" output drops in unchanged).
// - Foreground props use the sidecar form: a raw image + an explicit
//   `settings.normalMap`.
// - The static background is unlit — sprites without a normal map
//   take the renderer's fast path with zero per-pixel cost.
// - A `Light2d` with `illuminationOnly = true` drives the lighting math
//   from the cursor position; a separate `lightbulb.png` sprite is
//   what's actually visible to the user.

const ASSET_W = 1920;

const resources = [
	{ name: "si_bg", type: "image", src: bg01 },
	{ name: "si_fg", type: "image", src: fg01 },
	{ name: "si_fg_n", type: "image", src: fg01n },
	{ name: "si_sheet", type: "image", src: spritesheetImg },
	{ name: "si_sheet_n", type: "image", src: spritesheetN },
	{ name: "si_lightbulb", type: "image", src: lightbulbImg },
	{ name: "si_atlas", type: "json", src: spritesheetJsonUrl },
];

class PlayScreen extends Stage {
	onResetEvent() {
		const vw = game.viewport.width;
		const vh = game.viewport.height;
		// the assets are 1920×1080 but we scale them to fit the viewport
		const scale = vw / ASSET_W;

		// 1. Background tile (no normal map → unlit fast path)
		const bg = new Sprite(vw / 2, vh / 2, {
			image: "si_bg",
			anchorPoint: new Vector2d(0.5, 0.5),
		});
		bg.scale(scale);
		game.world.addChild(bg, 0);

		// 2. Foreground tile (raw image + sidecar normal map). Sits at the
		// same world position as the background but lit by the cursor light.
		const fg = new Sprite(vw / 2, vh / 2, {
			image: "si_fg",
			normalMap: loader.getImage("si_fg_n"),
			anchorPoint: new Vector2d(0.5, 0.5),
		});
		fg.scale(scale);
		game.world.addChild(fg, 1);

		// 3. Animated character from a paired atlas (TexturePacker's
		// "Pack with same layout" produces matching color + normal sheets;
		// our `TextureAtlas({ normalMap })` plumbs both through to the
		// lit sprite pipeline).
		const atlas = new TextureAtlas(
			loader.getJSON("si_atlas"),
			loader.getImage("si_sheet"),
			{ normalMap: loader.getImage("si_sheet_n") },
		);
		const animFrames: string[] = [];
		for (let i = 1; i <= 8; i++) {
			animFrames.push(`character/${String(i).padStart(2, "0")}.png`);
		}
		// `getAnimationSettings([names])` returns a Sprite settings object
		// pre-populated with `atlas` + `atlasIndices` + framewidth/height —
		// it's what `addAnimation(name, [string])` needs to look up frames
		// by their atlas filename.
		const character = new Sprite(vw / 2, vh * 0.6, {
			...atlas.getAnimationSettings(animFrames),
			anchorPoint: new Vector2d(0.5, 0.5),
		});
		character.addAnimation("walk", animFrames, 1000 / 8);
		character.setCurrentAnimation("walk");
		character.scale(scale * 0.7);
		game.world.addChild(character, 2);

		// 4. Lightbulb sprite — the visible cue for the cursor's position.
		// The actual light source is the `Light2d` below; the bulb is just
		// a regular unlit Sprite that follows the mouse.
		const bulb = new Sprite(vw - 100 * scale, 100 * scale, {
			image: "si_lightbulb",
			anchorPoint: new Vector2d(0.5, 0.5),
		});
		bulb.scale(scale);
		game.world.addChild(bulb, 3);

		// 5. Logical light source. `illuminationOnly = true` tells Light2d
		// not to draw its own gradient — only the lighting effect on the
		// normal-mapped foreground + character is visible. Light radius
		// scales with the asset (1000 in the original 1920-wide layout).
		const light = new Light2d(
			bulb.pos.x,
			bulb.pos.y,
			1000 * scale,
			1000 * scale,
			"#ffffff",
			2.0,
		);
		light.illuminationOnly = true;
		game.world.addChild(light);

		// dim ambient floor so the unlit areas of normal-mapped sprites
		// aren't pitch black (cocos2d demo does the same via `u_ambientColor`)
		this.ambientLightingColor.setColor(40, 40, 50);

		// cursor → light position
		input.registerPointerEvent("pointermove", game.viewport, (event) => {
			bulb.pos.x = event.gameX;
			bulb.pos.y = event.gameY;
			light.centerOn(event.gameX, event.gameY);
		});
	}
}

const createGame = () => {
	video.init(1024, 576, {
		parent: "screen",
		scaleMethod: "flex",
		// per-pixel normal-map lighting needs the WebGL renderer
		renderer: video.WEBGL,
	});

	state.set(state.PLAY, new PlayScreen());

	loader.preload(resources, () => {
		state.change(state.PLAY);
	});
};

export const ExampleSpriteIlluminator = createExampleComponent(createGame);
