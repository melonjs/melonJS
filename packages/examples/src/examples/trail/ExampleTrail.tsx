import {
	Application,
	ColorLayer,
	event,
	loader,
	Sprite,
	Trail,
	Vector2d,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";
import monsterImg from "./assets/monster.png";

const createGame = () => {
	const app = new Application(1218, 562, {
		parent: "screen",
		scale: "auto",
		renderer: video.AUTO,
		backgroundColor: "#101020",
	});

	loader.preload([{ name: "monster", type: "image", src: monsterImg }], () => {
		app.world.addChild(new ColorLayer("bg", "#101020"), 0);

		// create the monster sprite
		const monster = new Sprite(609, 281, {
			image: "monster",
			anchorPoint: new Vector2d(0.5, 0.5),
		});
		monster.scale(0.25);

		// create a green trail following the monster
		// rainbow trail with width curve and gradient
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

		// move the monster in a figure-eight pattern
		const startTime = globalThis.performance.now();
		let lastX = monster.pos.x;
		event.on(event.GAME_UPDATE, () => {
			const t = (globalThis.performance.now() - startTime) / 2000;
			monster.pos.x = 609 + Math.sin(t) * 350;
			monster.pos.y = 281 + Math.sin(t * 2) * 150;
			// flip sprite based on horizontal direction
			monster.flipX(monster.pos.x > lastX);
			lastX = monster.pos.x;
		});
	});
};

export const ExampleTrail = createExampleComponent(createGame);
