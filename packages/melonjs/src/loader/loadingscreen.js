import Camera2d from "./../camera/camera2d.ts";
import Renderable from "./../renderable/renderable.js";
import Sprite from "./../renderable/sprite.js";
import Stage from "./../state/stage.ts";
import {
	LOADER_COMPLETE,
	LOADER_PROGRESS,
	off,
	on,
	once,
	VIEWPORT_ONRESIZE,
} from "../system/event.ts";
import { load, unload } from "./loader.js";
import logo_url from "./melonjs_logo.png";

// a basic progress bar object
class ProgressBar extends Renderable {
	/**
	 * @ignore
	 * @internal
	 */
	constructor(x, y, w, h) {
		super(x, y, w, h);

		this.barHeight = h;
		this.anchorPoint.set(0, 0);

		on(LOADER_PROGRESS, this.onProgressUpdate, this);
		on(VIEWPORT_ONRESIZE, this.resize, this);

		this.anchorPoint.set(0, 0);

		// store current progress
		this.progress = 0;
	}

	/**
	 * make sure the screen is refreshed every frame
	 * @ignore
	 * @internal
	 */
	onProgressUpdate(progress) {
		this.progress = ~~(progress * this.width);
		this.isDirty = true;
	}

	/**
	 * draw function
	 * @ignore
	 * @internal
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
	 * @internal
	 */
	onDestroyEvent() {
		off(LOADER_PROGRESS, this.onProgressUpdate, this);
		off(VIEWPORT_ONRESIZE, this.resize, this);
	}
}

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

		// progress bar
		this.progressBar = new ProgressBar(0, height / 2, width, barHeight);
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
