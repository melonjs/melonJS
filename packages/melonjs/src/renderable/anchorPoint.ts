/**
 * Shared `settings.anchorPoint` resolution for every renderable that accepts
 * it (Sprite, Entity, Collectable, ImageLayer, Text, BitmapText, Sprite3d).
 * Same normalized convention as {@link Renderable#anchorPoint}: x 0=left →
 * 1=right, y 0=top → 1=bottom.
 */

/**
 * Named anchor-point presets accepted anywhere `settings.anchorPoint` is —
 * self-documenting shorthands for the common `{x, y}` pairs.
 * @ignore
 */
export const ANCHOR_POINT_PRESETS = Object.freeze({
	center: Object.freeze({ x: 0.5, y: 0.5 }),
	top: Object.freeze({ x: 0.5, y: 0 }),
	bottom: Object.freeze({ x: 0.5, y: 1 }),
	left: Object.freeze({ x: 0, y: 0.5 }),
	right: Object.freeze({ x: 1, y: 0.5 }),
	"top-left": Object.freeze({ x: 0, y: 0 }),
	"top-right": Object.freeze({ x: 1, y: 0 }),
	"bottom-left": Object.freeze({ x: 0, y: 1 }),
	"bottom-right": Object.freeze({ x: 1, y: 1 }),
});

/**
 * An anchor value as accepted by `settings.anchorPoint`: a preset name or
 * any object with numeric `x`/`y` (plain object, Vector2d, ObservablePoint).
 * @ignore
 */
export type AnchorPointValue =
	| keyof typeof ANCHOR_POINT_PRESETS
	| { x: number; y: number };

const isAnchorPair = (value: unknown): value is { x: number; y: number } => {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	const pair = value as { x?: unknown; y?: unknown };
	return (
		typeof pair.x === "number" &&
		Number.isFinite(pair.x) &&
		typeof pair.y === "number" &&
		Number.isFinite(pair.y)
	);
};

/**
 * Resolve a `settings.anchorPoint` value — a preset name or an `{x, y}`
 * object — into a fresh `{x, y}` pair (never a shared/frozen object).
 * Values are passed through unclamped: anchors outside 0..1 are legal.
 *
 * Invalid values (unknown preset, malformed object, non-finite numbers) are
 * handled per surface:
 * - with a `fallback` (the legacy 2D classes): logs a console warning and
 *   returns the fallback — full backward compatibility with the historical
 *   silent `set(undefined, undefined)` → `(0, 0)` outcome, nothing that
 *   constructed before can start throwing;
 * - without (new surfaces, e.g. Sprite3d): throws.
 * @ignore
 */
export function resolveAnchorPoint(
	value: unknown,
	owner = "Renderable",
	fallback?: { x: number; y: number },
): { x: number; y: number } {
	if (typeof value === "string") {
		const preset =
			ANCHOR_POINT_PRESETS[value as keyof typeof ANCHOR_POINT_PRESETS];
		if (typeof preset !== "undefined") {
			return { x: preset.x, y: preset.y };
		}
	} else if (isAnchorPair(value)) {
		return { x: value.x, y: value.y };
	}
	if (typeof fallback !== "undefined") {
		console.warn(
			`${owner}: invalid anchorPoint value (expected a preset name — ${Object.keys(
				ANCHOR_POINT_PRESETS,
			).join(", ")} — or an {x, y} object); falling back to (${fallback.x}, ${
				fallback.y
			})`,
		);
		return { x: fallback.x, y: fallback.y };
	}
	throw new Error(
		`${owner}: invalid anchorPoint value (expected a preset name — ${Object.keys(
			ANCHOR_POINT_PRESETS,
		).join(", ")} — or an {x, y} object)`,
	);
}
