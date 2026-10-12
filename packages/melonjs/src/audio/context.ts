/**
 * The one owner of the page's `AudioContext`.
 *
 * Everything that CREATES, REPLACES, REVIVES or CLOSES the context goes
 * through here. Everything else asks for the current one and uses it.
 *
 * That split is the whole point of this file. The context used to be managed
 * in two places: the backend engine held it and ran its own recovery, while
 * the procedural generators carried a private `_resumeIfSuspended` they
 * called before every beep. One context, two owners, and only one of them
 * kept the books, so the hardware and the engine's own view of it could
 * drift apart with nothing in place to notice.
 *
 * Three rules this file exists to make unbreakable:
 *
 * 1. **The recovery listeners are attached once and read the CURRENT
 *    context.** They used to capture whichever context existed when they
 *    were installed, and the engine replaces its context during unlock (see
 *    `_unlockAudio`'s 44100 swap), so the nets could be left watching an
 *    object nothing used any more. Reading {@link AudioContextOwner.current}
 *    at call time makes that unexpressible.
 * 2. **A deliberate stop and a surprise stop are different events.** The
 *    engine suspends the context on purpose after thirty idle seconds, and a
 *    blanket "resume whenever it is not running" cancels that power saving
 *    forever. A `statechange` therefore only recovers when the engine still
 *    reports itself running; a user gesture or the tab coming back always
 *    does, because the player is plainly here and waiting.
 * 3. **Reviving goes through the engine's bookkeeping, never around it.** A
 *    bare `ctx.resume()` restarts the hardware and nothing else: the
 *    engine's own `state` stays wrong and no "resume" reaches the voices
 *    parked waiting for it, so the sound stays silent with a perfectly
 *    healthy context underneath.
 */

/**
 * What the owner needs from whoever is using the context, so it never has to
 * know what a `Sound` is.
 * @ignore
 * @internal
 */
export interface AudioContextDelegate {
	/**
	 * Whether playback is meant to be live right now.
	 *
	 * Not `ctx.state`: this is the DELEGATE's own view, and the difference
	 * between the two is what separates "the browser stopped us" from "we
	 * stopped ourselves on purpose". Only the delegate can answer it.
	 */
	isRunning(): boolean;
	/**
	 * Resume the context, with whatever bookkeeping that implies.
	 *
	 * Deliberately the delegate's job rather than a `ctx.resume()` here: the
	 * hardware restarting is the easy half, and the half that matters is the
	 * state and the voices waiting on the result, which only the delegate
	 * knows about.
	 */
	resume(): void;
}

/**
 * Holds the context and the rules above.
 * @ignore
 * @internal
 */
export class AudioContextOwner {
	#ctx: AudioContext | null = null;
	#armed = false;
	#delegate: AudioContextDelegate;

	constructor(delegate: AudioContextDelegate) {
		this.#delegate = delegate;
	}

	/** The live context, or `null` before one exists. */
	get current(): AudioContext | null {
		return this.#ctx;
	}

	/**
	 * Adopt a context as the live one and arm the recovery nets.
	 * @param ctx - the context just created by the caller
	 */
	attach(ctx: AudioContext): void {
		this.#ctx = ctx;
		this.#watch(ctx);
		this.#arm();
	}

	/** Forget the context, after the caller has closed it. */
	detach(): void {
		this.#ctx = null;
	}

	/**
	 * Revive playback unless the context AND the delegate agree it is live.
	 *
	 * The caller is saying "a person is interacting right now", which is the
	 * one moment a resume is certain to be permitted and the one moment an
	 * idle suspension should end. Used by the gesture and visibility nets
	 * below, and by the procedural generators before they schedule anything.
	 *
	 * Both sides are asked because neither can answer alone. The context
	 * cannot: the unlock path's scratch resume starts the hardware without
	 * telling the delegate, and a delegate that still believes it is stopped
	 * keeps every voice it parked under a context that is running, which
	 * this gesture is the moment to correct. The delegate cannot either: it
	 * reports running for a context the browser stopped behind its back.
	 */
	requestResume(): void {
		if (!this.#ctx) {
			return;
		}
		if (this.#ctx.state !== "running" || !this.#delegate.isRunning()) {
			this.#delegate.resume();
		}
	}

	/**
	 * Watch one context for stops it did not ask for.
	 *
	 * Per context rather than once, because a replaced context brings its own
	 * event target; the identity check drops events from one the owner has
	 * already moved on from.
	 * @param ctx - the context to watch
	 */
	#watch(ctx: AudioContext): void {
		ctx.addEventListener("statechange", () => {
			if (ctx !== this.#ctx) {
				return;
			}
			// Only when the engine still thinks it is playing. A statechange
			// is also how a deliberate idle suspension announces itself, and
			// answering that with a resume would cancel the power saving
			// every single time it fired.
			if (this.#delegate.isRunning() && ctx.state !== "running") {
				this.#delegate.resume();
			}
		});
	}

	/**
	 * Attach the document-level nets, once for the page.
	 *
	 * They read {@link current} when they fire, so replacing the context
	 * cannot strand them.
	 */
	#arm(): void {
		if (this.#armed || typeof document === "undefined") {
			return;
		}
		this.#armed = true;
		const onUserPresent = () => {
			this.requestResume();
		};
		// Coming back to the tab. A context stopped while the page was hidden
		// fires its statechange THEN, when a resume is refused for being
		// hidden, and returning produces no second event because the state
		// has not changed: it is still suspended. Without this the only
		// recovery trigger had already been spent.
		document.addEventListener("visibilitychange", () => {
			if (!document.hidden) {
				onUserPresent();
			}
		});
		// And any gesture. This is the one a player actually performs, and
		// the reason it has to exist at all is that the unlock listeners are
		// removed once audio is unlocked: without it, someone facing a dead
		// context has nothing left to click.
		for (const type of ["touchstart", "touchend", "click", "keydown"]) {
			document.addEventListener(type, onUserPresent, true);
		}
	}
}
