import { event } from "melonjs";
import type { CapacitorBackEvent } from "./types.ts";

/** Internal event name used on the melonJS event bus. */
export const BACK_EVENT = "@melonjs/capacitor-plugin:backButton";

// `event.on` / `event.emit` / `event.off` are typed against an
// internal `keyof Events` registry that this plugin can't augment
// from outside. The cast is contained: the BACK_EVENT name is unique
// to this plugin, and the listener signature is enforced by the
// public `onBackButton` / `bindStageBack` APIs.
type BackBus = {
	on(name: string, h: (evt: CapacitorBackEvent) => void): void;
	off(name: string, h: (evt: CapacitorBackEvent) => void): void;
	emit(name: string, evt: CapacitorBackEvent): void;
};
const bus = event as unknown as BackBus;

/**
 * Dispatch a fresh `CapacitorBackEvent` on the engine bus.
 * @returns `true` if any handler called `preventDefault()`, `false` otherwise.
 */
export function emitBackEvent(): boolean {
	const evt: CapacitorBackEvent = {
		defaultPrevented: false,
		preventDefault() {
			(this as { defaultPrevented: boolean }).defaultPrevented = true;
		},
	};
	bus.emit(BACK_EVENT, evt);
	return evt.defaultPrevented;
}

/**
 * Subscribe a global hardware-back handler. Use `bindStageBack()`
 * instead if the handler should only be active while a specific
 * `Stage` is reset.
 * @param handler - called with a `CapacitorBackEvent` on every back press.
 * @returns an unsubscribe function.
 */
export function onBackButton(
	handler: (evt: CapacitorBackEvent) => void,
): () => void {
	bus.on(BACK_EVENT, handler);
	return () => {
		bus.off(BACK_EVENT, handler);
	};
}

/**
 * @internal
 * @param handler - back-button handler to subscribe.
 */
export function subscribeBackHandler(
	handler: (evt: CapacitorBackEvent) => void,
): void {
	bus.on(BACK_EVENT, handler);
}

/**
 * @internal
 * @param handler - back-button handler to unsubscribe.
 */
export function unsubscribeBackHandler(
	handler: (evt: CapacitorBackEvent) => void,
): void {
	bus.off(BACK_EVENT, handler);
}
