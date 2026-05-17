/**
 * melonJS — Platformer (built-in SAT physics) example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Polygon, Trigger } from "melonjs";

// 5-pointed star polygon (unit-sized, centered at origin)
const starPoints: [
	{ x: number; y: number },
	{ x: number; y: number },
	{ x: number; y: number },
	...{ x: number; y: number }[],
] = [
	{ x: 0.0, y: -1.0 },
	{ x: 0.224, y: -0.309 },
	{ x: 0.951, y: -0.309 },
	{ x: 0.363, y: 0.118 },
	{ x: 0.588, y: 0.809 },
	{ x: 0.0, y: 0.382 },
	{ x: -0.588, y: 0.809 },
	{ x: -0.363, y: 0.118 },
	{ x: -0.951, y: -0.309 },
	{ x: -0.224, y: -0.309 },
];

/**
 * A custom level trigger that uses a star-shaped mask transition.
 */
type TriggerSettings = ConstructorParameters<typeof Trigger>[2];

export class LevelTrigger extends Trigger {
	constructor(x: number, y: number, settings: TriggerSettings) {
		super(x, y, {
			...settings,
			transition: "mask",
			shape: new Polygon(0, 0, starPoints),
			color: "#000",
			duration: 300,
		});
	}
}
