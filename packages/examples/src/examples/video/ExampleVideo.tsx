import { game, loader, Sprite, state, Text, Vector2d, video } from "melonjs";
import { createExampleComponent } from "../utils";
import videoSrc from "./assets/mov_bbb.mp4";

const createGame = () => {
	if (
		!video.init(1218, 562, {
			parent: "screen",
			scaleMethod: "flex",
		})
	) {
		alert("Your browser does not support HTML5 canvas.");
		return;
	}

	loader.setOptions({ crossOrigin: "anonymous" });

	loader.preload(
		[
			{
				name: "bigbunny",
				type: "video",
				src: videoSrc,
				stream: false,
				autoplay: false,
				loop: true,
			},
		],
		() => {
			state.change(state.DEFAULT, true);

			const textMsg = new Text(game.viewport.width / 2, 100, {
				font: "Arial",
				size: 20,
				fillStyle: "white",
				textAlign: "center",
				text: "click the screen to start the video",
			});
			game.world.addChild(textMsg);

			const videoSprite = new Sprite(
				game.viewport.width / 2,
				game.viewport.height / 2,
				{
					image: loader.getVideo("bigbunny"),
					anchorPoint: new Vector2d(0.5, 0.5),
				},
			);
			videoSprite.currentTransform.scale(2);
			videoSprite.onended = () => {
				console.log("video ended !");
			};
			game.world.addChild(videoSprite);
			videoSprite.play();
		},
	);
};

export const ExampleVideo = createExampleComponent(createGame);
