import Camera2d from "./../camera/camera2d.ts";
import Sprite from "./../renderable/sprite.js";
import ProgressBar from "./../renderable/ui/progressbar.ts";
import Stage from "./../state/stage.ts";
import {
	LOADER_COMPLETE,
	LOADER_PROGRESS,
	off,
	once,
} from "../system/event.ts";
import { load, unload } from "./loader.js";
import logo_url from "./melonjs_logo.png";

/**
 * a default loading screen
 * @ignore
 * @internal
 */
class DefaultLoadingScreen extends Stage {
	/**
	 * @ignore
	 * @internal
	 */
	progressBar = null;

	/**
	 * @ignore
	 * @internal
	 */
	logoSprite = null;

	/**
	 * reference to the application instance
	 * @ignore
	 * @internal
	 */
	#app = null;

	/**
	 * whether the cleanup has already run
	 * @ignore
	 * @internal
	 */
	#cleanedUp = false;

	/**
	 * whether the preloader has reported done. Latched on LOADER_COMPLETE
	 * and read by the logo's own load callback — NOT a teardown signal.
	 * @ignore
	 * @internal
	 */
	#loadingComplete = false;

	/**
	 * Pin the loading screen to a Camera2d regardless of the
	 * application's `cameraClass` setting. The loader must render
	 * correctly even when the host app opts in to Camera3d globally
	 * — a perspective camera applied to a 2D progress bar would
	 * stretch / clip the bar based on its depth.
	 */
	constructor() {
		super({ cameraClass: Camera2d });
	}

	/**
	 * call when the loader is resetted
	 * @ignore
	 * @internal
	 */
	onResetEvent(app) {
		const barHeight = 8;

		this.#app = app;
		this.#cleanedUp = false;
		this.#loadingComplete = false;

		// set a background color
		app.world.backgroundColor.parseCSS("#202020");

		const { width, height } = app.renderer;

		// The progress bar, which is the public `ProgressBar` renderable: the
		// loading screen is the first consumer of it, and being a consumer
		// rather than carrying a private copy is what keeps the two honest.
		//
		// `barHeight / 2` because the private bar this replaces was built at 8
		// and drew at half that, so the look is preserved exactly.
		this.progressBar = new ProgressBar(0, height / 2, {
			width,
			height: barHeight / 2,
			trackColor: "black",
			fillColor: "#55aa00",
			borderColor: null,
			// Bound rather than driven, and bound BY THE BAR so the listener
			// cannot outlive it. The private bar this replaces hard-coded this
			// same subscription in its own constructor, which is what made it
			// useless to a game; naming the event in the settings keeps the
			// lifetime guarantee and gives the choice back.
			//
			// The bar holds a RATIO rather than a pixel count, which fixes a
			// bug on the way past: the old one multiplied by its width on
			// arrival, so a viewport resize part way through a load left the
			// fill at the old scale until the next asset happened to land.
			bindEvent: LOADER_PROGRESS,
		});
		app.world.addChild(this.progressBar, 1);

		// Latch "the preloader is done" — and ONLY that.
		//
		// This used to tear the screen down here, to fix a real race: the logo
		// image loads asynchronously and, since the promise-based loader, can
		// resolve AFTER the user's own assets do — so the sprite was added to a
		// world that had already moved on, with nobody left to remove it. The
		// latch is what actually fixes that, and the logo's load callback below
		// is where it is read.
		//
		// Removing this screen's children is the STAGE's business, and happens
		// in `onDestroyEvent`. Doing it here left the loading screen blank for
		// the gap between "assets are in" and "the game changed state" — which
		// is as long as the game's own post-preload setup takes — and, worse,
		// meant a `state.transition()` had nothing left to fade over: the logo
		// and bar popped out a beat before the transition that was supposed to
		// carry them.
		once(LOADER_COMPLETE, this.#onLoaderComplete, this);

		// load the melonJS logo. The promise form, like everything else the
		// engine documents — `onResetEvent` cannot await, so the guard below
		// is still what keeps a late logo out of a world that has moved on,
		// but a failed decoration must not take the game's loading screen
		// down with it, and `.catch()` is where that is said.
		load({ name: "melonjs_logo", type: "image", src: logo_url })
			.then(() => {
				// guard against the logo loading after preload completed — see
				// the LOADER_COMPLETE latch above
				if (this.#loadingComplete || this.#cleanedUp) {
					return;
				}
				// melonJS logo
				this.logoSprite = new Sprite(width / 2, height / 2, {
					image: "melonjs_logo",
					framewidth: 256,
					frameheight: 256,
				});
				app.world.addChild(this.logoSprite, 2);
			})
			.catch(() => {
				// the logo is decoration; a game must still be able to load
			});
	}

	/**
	 * The preloader is done. Latched so a late-arriving logo is not added
	 * to a world that is about to be replaced; nothing is torn down here.
	 * @ignore
	 * @internal
	 */
	#onLoaderComplete() {
		this.#loadingComplete = true;
	}

	/**
	 * Remove loading screen children and unload the logo
	 * @ignore
	 * @internal
	 */
	#cleanup() {
		this.#cleanedUp = true;

		// Tolerate the case where the user's preload callback already
		// removed our children — `world.reset()` is a common pattern
		// in user setup code (the benchmark example does this), and
		// it nukes every world child including our progress bar +
		// logo. Calling `removeChild` on a non-child throws "Child is
		// not mine.", which propagates up through the LOADER_COMPLETE
		// emit chain and corrupts downstream state.
		if (this.progressBar) {
			if (this.#app.world.hasChild(this.progressBar)) {
				this.#app.world.removeChild(this.progressBar);
			}
			this.progressBar = null;
		}
		if (this.logoSprite) {
			if (this.#app.world.hasChild(this.logoSprite)) {
				this.#app.world.removeChild(this.logoSprite);
			}
			this.logoSprite = null;
		}

		// unload the logo image
		unload({ name: "melonjs_logo", type: "image" });
	}

	/**
	 * Called by engine before deleting the object
	 * @ignore
	 * @internal
	 */
	onDestroyEvent() {
		// remove the listener in case state.change() is called
		// before the preloader fires LOADER_COMPLETE
		if (!this.#loadingComplete) {
			off(LOADER_COMPLETE, this.#onLoaderComplete, this);
		}
		this.#cleanup();
	}
}

export default DefaultLoadingScreen;
