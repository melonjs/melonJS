/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import {
	type Application,
	event,
	PixelateTransitionEffect,
	state,
} from "melonjs";
import { FADE_COLOR } from "./constants";

/*---------------------------------------------------------------------

	The screen breaks up into big pixels, changes behind the biggest of
	them, and comes back.

  ---------------------------------------------------------------------	*/

// the biggest blocks, at the middle of a transition (8 pixels of the original)
const BIGGEST = 32;
// how long the screen takes to break up, and as long to come back
const HALF = 300;

let app: Application;
// a change is on its way: the next one waits for it (a second change asked
// for while the screen is covered would leave it covered, melonJS#1787)
let busy = false;

/**
 * every change of screen goes through the pixels, but for the level complete
 * one, which comes straight after the level
 */
export function initTransitions(application: Application) {
	app = application;
	state.transition("pixelate", FADE_COLOR, HALF, BIGGEST);
	state.setTransition(state.READY, false);
}

/** go to another screen, through the pixels */
export function go(stateId: number) {
	// already there: no change, and so nothing would ever clear `busy`
	if (busy || state.isCurrent(stateId)) {
		return;
	}
	busy = true;
	event.once(event.STATE_CHANGE, () => {
		busy = false;
	});
	state.change(stateId);
}

/** do something on the same screen, behind the biggest pixels */
export function pixelate(middle: () => void) {
	if (busy) {
		return;
	}
	busy = true;
	const options = { renderer: app.renderer, size: BIGGEST, duration: HALF };
	const camera = app.viewport;
	const cover = new PixelateTransitionEffect(camera, {
		...options,
		onComplete: () => {
			camera.removeCameraEffect(cover);
			middle();
			// Persistent, and taken away by itself: a level reload resets the
			// camera a frame later (level.load defers it), which drops every
			// other effect. Dropped, it never completed, and `busy` stayed set,
			// so every change of screen after a death was ignored.
			const reveal = new PixelateTransitionEffect(app.viewport, {
				...options,
				direction: "reveal",
				onComplete: () => {
					app.viewport.removeCameraEffect(reveal);
					busy = false;
				},
			});
			reveal.isPersistent = true;
			app.viewport.addCameraEffect(reveal);
		},
	});
	camera.addCameraEffect(cover);
}
