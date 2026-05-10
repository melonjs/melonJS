import type { Application, Stage } from "melonjs";
import { subscribeBackHandler, unsubscribeBackHandler } from "./back-event.ts";
import type { CapacitorBackEvent } from "./types.ts";

/**
 * Wire a hardware-back handler whose lifetime matches the given
 * `Stage`'s: subscribed immediately (so the handler is active for the
 * current stage activation if called from inside `onResetEvent`),
 * re-subscribed on subsequent `onResetEvent` calls if the stage is
 * destroyed and reset, and unsubscribed in `onDestroyEvent`. Without
 * this helper the user has to manually `event.on(...)` / `event.off(...)`
 * in every stage that wants to intercept back presses.
 * @param stage - the stage whose lifecycle drives the subscription.
 * @param handler - called with a `CapacitorBackEvent` on every back press while the stage is active.
 * @example
 * class PlayStage extends Stage {
 *     onResetEvent() {
 *         bindStageBack(this, (evt) => {
 *             state.change(state.MENU);
 *             evt.preventDefault(); // do not quit
 *         });
 *     }
 * }
 */
export function bindStageBack(
	stage: Stage,
	handler: (evt: CapacitorBackEvent) => void,
): void {
	let bound = false;
	const subscribe = () => {
		if (!bound) {
			subscribeBackHandler(handler);
			bound = true;
		}
	};
	const unsubscribe = () => {
		if (bound) {
			unsubscribeBackHandler(handler);
			bound = false;
		}
	};

	// Subscribe immediately. The typical call site is inside the
	// stage's `onResetEvent`, where the wrapped method below would
	// only fire on the *next* reset — leaving the handler silent for
	// the current stage activation. Subscribing now closes that gap;
	// the wrapper still keeps re-subscriptions idempotent for stages
	// that get destroyed and reset multiple times.
	subscribe();

	const origReset = stage.onResetEvent.bind(stage);
	const origDestroy = stage.onDestroyEvent.bind(stage);
	stage.onResetEvent = function (app: Application, ...args: unknown[]) {
		subscribe();
		origReset(app, ...args);
	};
	stage.onDestroyEvent = function (app: Application) {
		unsubscribe();
		origDestroy(app);
	};
}
