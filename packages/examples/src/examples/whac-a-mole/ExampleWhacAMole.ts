import { audio, loader, save, state, video } from "melonjs";
import { createExampleComponent } from "../utils";
import { data } from "./data";
import { PlayScreen } from "./play";
import { resources } from "./resources";

const createGame = () => {
	// Initialize the video.
	if (!video.init(1024, 768, { parent: "screen", scale: "auto" })) {
		alert("Your browser does not support HTML5 canvas.");
		return;
	}

	// initialize the "sound engine"
	audio.init("mp3,ogg");

	// add a new hiscore key if not yet defined
	save.add({ hiscore: 0 });

	// set the local hiscore value
	data.hiscore = save.hiscore as number;

	// set all ressources to be loaded
	loader.preload(resources, () => {
		// set the "Play/Ingame" Screen Object
		state.set(state.PLAY, new PlayScreen());

		// set a fade transition effect
		state.transition("fade", "#000000", 250);

		// start the game
		state.change(state.PLAY);
	});
};

export const ExampleWhacAMole = createExampleComponent(createGame);
