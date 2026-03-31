import { game } from "../index.js";
import Renderable from "./../renderable/renderable.js";
import Sprite from "./../renderable/sprite.js";
import Stage from "./../state/stage.js";
import {
	eventEmitter,
	LOADER_COMPLETE,
	LOADER_PROGRESS,
	VIEWPORT_ONRESIZE,
} from "../system/event.ts";
import { renderer } from "./../video/video.js";
import { load, unload } from "./loader.js";
import logo_url from "./melonjs_logo.png";

// a basic progress bar object
class ProgressBar extends Renderable {
	/**
	 * @ignore
	 */
	constructor(x, y, w, h) {
		super(x, y, w, h);

		this.barHeight = h;
		this.anchorPoint.set(0, 0);

		eventEmitter.addListener(LOADER_PROGRESS, this.onProgressUpdate, this);
		eventEmitter.addListener(VIEWPORT_ONRESIZE, this.resize, this);

		this.anchorPoint.set(0, 0);

		// store current progress
		this.progress = 0;
	}

	/**
	 * make sure the screen is refreshed every frame
	 * @ignore
	 */
	onProgressUpdate(progress) {
		this.progress = ~~(progress * this.width);
		this.isDirty = true;
	}

	/**
	 * draw function
	 * @ignore
	 */
	draw(renderer, viewport) {
		// draw the progress bar
		renderer.setColor("black");
		renderer.fillRect(
			this.pos.x,
			viewport.centerY,
			renderer.width,
			this.barHeight / 2,
		);

		renderer.setColor("#55aa00");
		renderer.fillRect(
			this.pos.x,
			viewport.centerY,
			this.progress,
			this.barHeight / 2,
		);
	}

	/**
	 * Called by engine before deleting the object
	 * @ignore
	 */
	onDestroyEvent() {
		eventEmitter.removeListener(LOADER_PROGRESS, this.onProgressUpdate);
		eventEmitter.removeListener(VIEWPORT_ONRESIZE, this.resize);
	}
}

/**
 * a default loading screen
 * @ignore
 */
class DefaultLoadingScreen extends Stage {
	/**
	 * @ignore
	 */
	progressBar = null;

	/**
	 * @ignore
	 */
	logoSprite = null;

	/**
	 * whether the cleanup has already run
	 * @ignore
	 */
	#cleanedUp = false;

	/**
	 * call when the loader is resetted
	 * @ignore
	 */
	onResetEvent() {
		const barHeight = 8;

		this.#cleanedUp = false;

		// set a background color
		game.world.backgroundColor.parseCSS("#202020");

		// progress bar
		this.progressBar = new ProgressBar(
			0,
			renderer.height / 2,
			renderer.width,
			barHeight,
		);
		game.world.addChild(this.progressBar, 1);

		// clean up loading screen children when the preloader completes,
		// whether or not a state.change() follows
		eventEmitter.addListenerOnce(LOADER_COMPLETE, this.#cleanup, this);

		// load the melonJS logo
		load({ name: "melonjs_logo", type: "image", src: logo_url }, () => {
			// guard against the logo loading after preload completed
			if (this.#cleanedUp) {
				return;
			}
			// melonJS logo
			this.logoSprite = new Sprite(renderer.width / 2, renderer.height / 2, {
				image: "melonjs_logo",
				framewidth: 256,
				frameheight: 256,
			});
			game.world.addChild(this.logoSprite, 2);
		});
	}

	/**
	 * Remove loading screen children and unload the logo
	 * @ignore
	 */
	#cleanup() {
		this.#cleanedUp = true;

		if (this.progressBar) {
			game.world.removeChild(this.progressBar);
			this.progressBar = null;
		}
		if (this.logoSprite) {
			game.world.removeChild(this.logoSprite);
			this.logoSprite = null;
		}

		// unload the logo image
		unload({ name: "melonjs_logo", type: "image" });
	}

	/**
	 * Called by engine before deleting the object
	 * @ignore
	 */
	onDestroyEvent() {
		// remove the listener in case state.change() is called
		// before the preloader fires LOADER_COMPLETE
		if (!this.#cleanedUp) {
			eventEmitter.removeListener(LOADER_COMPLETE, this.#cleanup);
		}
		this.#cleanup();
	}
}

export default DefaultLoadingScreen;
