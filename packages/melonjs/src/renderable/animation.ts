/**
 * Normalized options for a played animation, shared by the 2D {@link Sprite}
 * frame-animation path and the 3D {@link Mesh} keyframe-animation path so both
 * accept the same `setCurrentAnimation(name, …)` second argument.
 * @category Animation
 */
export interface AnimationOptions {
	/** called when the animation completes a cycle (each loop, or once if `loop: false`). */
	onComplete?: (() => unknown) | undefined;
	/** name of an animation to switch to when this one finishes. */
	next?: string | undefined;
	/** loop forever (default) or play once and hold the last frame. */
	loop: boolean;
	/** playback rate multiplier (1 = authored speed). */
	speed: number;
	/**
	 * the argument was a bare function — the legacy `Sprite` callback whose
	 * `false` return holds the last frame. Carried so callers can preserve that
	 * exact contract; not part of the public options shape.
	 * @ignore
	 */
	legacyFn?: boolean;
}

/**
 * Normalize the polymorphic second argument of `setCurrentAnimation` into a
 * uniform {@link AnimationOptions}. Accepts:
 * - `undefined` → loop forever
 * - a `string` → the name of the next animation to chain to
 * - a `function` → legacy completion callback (return `false` to hold the last frame)
 * - an options object → `{ onComplete, next, loop, speed }`
 * @param arg - the second argument passed to `setCurrentAnimation`
 * @returns the normalized options
 * @category Animation
 */
export function parseAnimationOptions(
	arg?:
		| string
		| (() => unknown)
		| {
				onComplete?: () => unknown;
				next?: string;
				loop?: boolean;
				speed?: number;
		  }
		// `null` is passed by the internal animation-chain call
		// (`setCurrentAnimation(next, null, true)`), so it must be accepted.
		| null,
): AnimationOptions {
	if (typeof arg === "string") {
		return { next: arg, loop: true, speed: 1 };
	}
	if (typeof arg === "function") {
		return { onComplete: arg, loop: true, speed: 1, legacyFn: true };
	}
	if (arg !== null && typeof arg === "object") {
		return {
			onComplete: arg.onComplete,
			next: arg.next,
			// only an explicit `false` disables looping
			loop: arg.loop !== false,
			speed: typeof arg.speed === "number" ? arg.speed : 1,
		};
	}
	return { loop: true, speed: 1 };
}
