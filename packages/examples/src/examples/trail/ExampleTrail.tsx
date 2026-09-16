/**
 * melonJS — motion-trail effect demo example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	Application,
	ColorLayer,
	loader,
	Sprite,
	Stage,
	state,
	Trail,
	Vector2d,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";
import monsterImg from "./assets/monster.png";

class Monster extends Sprite {
	elapsed: number;
	lastX: number;

	constructor(x: number, y: number) {
		super(x, y, {
			image: "monster",
			anchorPoint: new Vector2d(0.5, 0.5),
		});
		this.scale(0.25);
		this.alwaysUpdate = true;
		this.elapsed = 0;
		this.lastX = x;
	}

	override update(dt: number): boolean {
		this.elapsed += dt;
		const t = this.elapsed / 2000;
		this.pos.x = 609 + Math.sin(t) * 350;
		this.pos.y = 281 + Math.sin(t * 2) * 150;
		this.flipX(this.pos.x > this.lastX);
		this.lastX = this.pos.x;
		return super.update(dt);
	}
}

const createGame = async () => {
	const app = new Application(1218, 562, {
		parent: "screen",
		scale: "auto",
		renderer: video.AUTO,
		backgroundColor: "#101020",
	});
	await app.init();

	await loader.preload([{ name: "monster", type: "image", src: monsterImg }]);

	// The scene lives in a Stage of its own, and the example switches to it
	// once the assets are in. Building it in the preload callback and staying
	// put would leave the game running inside `state.LOADING` — a transitional
	// stage nothing ever destroys, so the loading screen's logo and progress
	// bar would sit on top of the scene for good.
	class TrailScene extends Stage {
		override onResetEvent() {
			app.world.addChild(new ColorLayer("bg", "#101020"), 0);

			const monster = new Monster(609, 281);

			const trail = new Trail({
				target: monster,
				length: 60,
				lifetime: 2000,
				minDistance: 8,
				width: 60,
				widthCurve: [1, 0.95, 0.85, 0.7, 0.5, 0.25, 0],
				gradient: [
					"#ff0000",
					"#ff8800",
					"#ffff00",
					"#00ff00",
					"#0088ff",
					"#8800ff",
					"#8800ff00",
				],
				opacity: 0.8,
				blendMode: "additive",
			});

			app.world.addChild(trail, 1);
			app.world.addChild(monster, 2);
		}
	}

	state.set(state.PLAY, new TrailScene());
	state.change(state.PLAY);
};

export const ExampleTrail = createExampleComponent(createGame);
