import type { Application, Stage } from "melonjs";
import { subscribeBackHandler, unsubscribeBackHandler } from "./back-event.ts";
import type { CapacitorBackEvent } from "./types.ts";

interface StageBinding {
	/** the currently-bound handler (or null when none) */
	handler: ((evt: CapacitorBackEvent) => void) | null;
	/** whether `handler` is currently subscribed on the engine bus */
	bound: boolean;
}

// Per-stage binding registry. Keyed by Stage identity so the entry
// is GC'd along with the stage. `bindStageBack` wraps each stage's
// `onResetEvent` / `onDestroyEvent` exactly once; subsequent calls
// replace the bound handler in place rather than re-wrapping (which
// would stack closures and leak across destroy/reset cycles).
const stageBindings = new WeakMap<Stage, StageBinding>();

/**
 * Wire a hardware-back handler whose lifetime matches the given
 * `Stage`'s. The handler is subscribed immediately (so it's active
 * for the current stage activation when this is called from inside
 * `onResetEvent`) and unsubscribed in `onDestroyEvent`. Idempotent
 * across destroy/reset cycles: each stage carries at most one
 * back-button handler at a time, and re-calling `bindStageBack` on
 * the same stage replaces the previous handler.
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
	let entry = stageBindings.get(stage);

	if (entry === undefined) {
		// First call for this stage: install method wrappers exactly
		// once, then store the binding entry. Subsequent calls reuse
		// the wrappers and just swap `entry.handler`.
		const fresh: StageBinding = { handler: null, bound: false };
		entry = fresh;
		stageBindings.set(stage, fresh);

		const origReset = stage.onResetEvent.bind(stage);
		const origDestroy = stage.onDestroyEvent.bind(stage);
		stage.onResetEvent = function (app: Application, ...args: unknown[]) {
			if (fresh.handler !== null && !fresh.bound) {
				subscribeBackHandler(fresh.handler);
				fresh.bound = true;
			}
			origReset(app, ...args);
		};
		stage.onDestroyEvent = function (app: Application) {
			if (fresh.handler !== null && fresh.bound) {
				unsubscribeBackHandler(fresh.handler);
				fresh.bound = false;
			}
			origDestroy(app);
		};
	}

	// Replace the previously-bound handler (if any) with the new one.
	if (entry.handler !== handler) {
		if (entry.bound && entry.handler !== null) {
			unsubscribeBackHandler(entry.handler);
			entry.bound = false;
		}
		entry.handler = handler;
	}

	// Subscribe eagerly so the handler is active for the current stage
	// activation — the typical call site is inside `onResetEvent`,
	// which already passed the wrapper's subscribe step by the time
	// this code runs.
	if (!entry.bound) {
		subscribeBackHandler(entry.handler);
		entry.bound = true;
	}
}
