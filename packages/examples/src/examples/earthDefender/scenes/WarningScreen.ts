/**
 * The photosensitivity notice, between the loading screen and the title.
 *
 * A stage of its own for the usual reason the other two are: entering it
 * builds the panel and leaving it throws the panel away. It is also the
 * shortest-lived screen in the game, and deliberately the dullest one — a
 * notice about flashing imagery that flashes would be a joke at the reader's
 * expense, so there is no nebula behind it, nothing drifting, and the only
 * thing that moves is the prompt breathing slowly at the foot of the card.
 *
 * It earns its place twice over. The notice itself is owed: the bolts, the
 * explosions and the red pulse that closes in as the shield goes are all
 * flashing imagery, and a player who needs to know that needs to know it
 * before the game starts rather than after. And a browser will not let a
 * page make a sound until someone has touched it, so the gesture that
 * dismisses this panel is also the gesture that unlocks the audio context —
 * which is why the title's music now starts on the title rather than
 * whenever the player first happened to click something.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 */
import {
	type Application,
	type Camera2d,
	event,
	input,
	Stage,
	state,
	Tween,
} from "melonjs";
import { Modal, WARNING } from "../ui/menu";

/** how long the prompt takes to go from faint to full, milliseconds */
const PROMPT_BREATH_MS = 900;
/** how faint it gets at the bottom of the breath */
const PROMPT_LOW = 0.35;

/**
 * Every way out, in the words the player reads.
 *
 * Mouse, touch and keyboard all named, because this is the first screen and
 * nothing has established yet which of the three the player is on. Both keys
 * are spelled out rather than left to "a key": only these two work, and a
 * notice whose own prompt is approximate invites the player to hammer at it.
 */
// `A` as well: a gamepad press arrives as a key event through the binding, so
// this screen already accepted one and said nothing about it
const PROMPT = "PRESS ENTER, SPACE, A OR CLICK TO CONTINUE";

export class WarningScreen extends Stage {
	private breath: Tween | undefined;
	/**
	 * The region the tap handler is registered against.
	 *
	 * Kept rather than looked up again on the way out: a stage instantiates
	 * its own camera on first reset, so `app.viewport` at teardown is not
	 * guaranteed to be the object the handler was registered with, and
	 * `releasePointerEvent` matches on identity.
	 */
	private region: Camera2d | undefined;
	/**
	 * Whether the notice has already been dismissed.
	 *
	 * Two of the three ways in can fire more than once for one intention: a
	 * click on the card reaches both the panel's own `onClick` and the
	 * screen-wide handler below, and a key held down repeats. Without this
	 * the second call reached `state.change` again and restarted the
	 * transition the first had already begun.
	 */
	private done = false;

	/**
	 * Raise the notice.
	 * @param app - the application this stage belongs to
	 */
	override onResetEvent(app: Application) {
		this.done = false;
		app.world.backgroundColor.parseCSS("#05060f");

		const panel = new Modal(
			app.renderer.width / 2,
			app.renderer.height / 2,
			"PHOTOSENSITIVITY WARNING",
			WARNING,
			() => {
				this.dismiss();
			},
			// no icons: nothing on this panel is about a rock
			[],
			PROMPT,
		);
		// in front of nothing in particular, but the same depth the title's
		// panels sit at, so the two screens agree about where a card lives
		app.world.addChild(panel, 200);

		// A BREATH, not a blink. The prompt has to say the screen is waiting
		// for something, and the usual answer is to flash it — which on this
		// particular panel would be absurd. Slow, and only down to a third,
		// so it reads as alive without ever going dark.
		this.breath = new Tween(panel.hint)
			.to(
				{ alpha: PROMPT_LOW },
				{
					duration: PROMPT_BREATH_MS,
					easing: Tween.Easing.Sinusoidal.InOut,
					yoyo: true,
					repeat: Number.POSITIVE_INFINITY,
				},
			)
			.start();

		// A tap ANYWHERE, not only on the card. The panel's own `onClick`
		// covers the card, which is where a mouse user aims; a touch user
		// taps wherever their thumb already is.
		this.region = app.viewport;
		input.registerPointerEvent("pointerdown", this.region, this.onTap);

		// THE EVENT, not `isKeyPressed` in `update`.
		//
		// The title menu polls, and is right to: it needs one step per press
		// out of keys the game holds down, and an edge taken against the
		// previous frame is how you get that. This screen needs the opposite
		// — not to miss a press at all — and a poll samples every 16ms, so a
		// press shorter than a frame falls between two samples and the
		// notice simply ignores it. Measured: a 1ms press is missed every
		// time. The event cannot be missed, there is no key held on the way
		// in to confuse it, and `done` below absorbs the auto-repeat.
		event.on(event.KEYDOWN, this.onKey);
	}

	/**
	 * A tap anywhere on the screen.
	 *
	 * Named, so the release below can name it too: releasing by region alone
	 * drops every `pointerdown` callback registered against that region, and
	 * taking only our own back is the narrower promise.
	 * @returns false, so the event carries on to anything else that wants it
	 * @ignore
	 */
	private onTap = () => {
		this.dismiss();
		return false;
	};

	/**
	 * Enter or space, whichever the player reaches for.
	 *
	 * An arrow function so it is the same reference at `off` time, and so
	 * `this` is the screen.
	 * @param action - the bound action, or undefined for an unbound key
	 * @ignore
	 */
	private onKey = (action: string | undefined) => {
		if (action === "menuSelect" || action === "fire") {
			this.dismiss();
		}
	};

	/**
	 * Nothing to simulate; the prompt is a tween and the keys are an event.
	 * @param dt - milliseconds since the last frame
	 * @returns true, so the breathing prompt is redrawn
	 */
	override update(dt: number) {
		super.update(dt);
		return true;
	}

	/** on to the title, once only */
	private dismiss() {
		if (this.done) {
			return;
		}
		this.done = true;
		// NOT forced: the unforced form is what plays the global transition,
		// so the notice irises out the way every other screen change does.
		state.change(state.MENU);
	}

	/**
	 * Take the panel and its handler away with the screen.
	 *
	 * The tween, the key subscription and the pointer registration all
	 * outlive the stage otherwise: a tween subscribes to the game loop on
	 * `start()`, and a subscription or a registered region keeps a reference
	 * to the handler and so to this screen.
	 * @ignore
	 */
	override onDestroyEvent() {
		this.breath?.stop();
		this.breath = undefined;
		event.off(event.KEYDOWN, this.onKey);
		if (this.region !== undefined) {
			input.releasePointerEvent("pointerdown", this.region, this.onTap);
			this.region = undefined;
		}
	}
}
