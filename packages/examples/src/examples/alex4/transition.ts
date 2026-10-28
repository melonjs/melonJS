/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import { type Application, event, PixelateEffect, state, Tween } from "melonjs";

/*---------------------------------------------------------------------

	The screen breaks up into big pixels, changes behind the biggest of
	them, and comes back.

  ---------------------------------------------------------------------	*/

// the biggest blocks, at the middle of a transition (8 pixels of the original)
const BIGGEST = 32;
// how long the screen takes to break up, and as long to come back
const HALF = 300;

let app: Application;
let effect: PixelateEffect;
let busy = false;

/**
 * set the transitions up, once, before any other effect of the camera: the
 * pixels come first, the scanlines and the vignette stay sharp over them. It
 * stays on the camera, at 1 (the screen as it is) between transitions, so
 * that it is ready when one starts.
 */
export function initTransitions(application: Application) {
	app = application;
	effect = new PixelateEffect(app.renderer, { size: 1 });
	app.viewport.addPostEffect(effect);
}

/** the blocks grow (or shrink) from one size to another, then `done` */
function ramp(
	from: number,
	to: number,
	easing: (k: number) => number,
	done: () => void,
) {
	const blocks = { size: from };
	const tween = new Tween(blocks)
		.to({ size: to }, { duration: HALF, easing })
		.onUpdate(() => {
			// in whole pixels of the original, like everything else
			effect.setSize(Math.max(1, Math.round(blocks.size / 4) * 4));
		})
		.onComplete(done);
	// it goes on through the change of screen
	tween.isPersistent = true;
	tween.start();
}

/** break the screen up, then `middle` (false when one is already going) */
function breakUp(middle: () => void) {
	if (busy) {
		return;
	}
	busy = true;
	ramp(1, BIGGEST, Tween.Easing.Quadratic.In, middle);
}

function comeBack() {
	ramp(BIGGEST, 1, Tween.Easing.Quadratic.Out, () => {
		busy = false;
	});
}

/** do something on the same screen, behind the biggest pixels */
export function pixelate(middle: () => void) {
	breakUp(() => {
		middle();
		comeBack();
	});
}

/** go to another screen, through the pixels */
export function go(stateId: number) {
	breakUp(() => {
		// back once the new screen is up (the change waits for the frame end)
		event.once(event.STATE_CHANGE, comeBack);
		state.change(stateId);
	});
}
