/**
 * melonJS — Platformer (built-in SAT physics) example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { event, level, loader, Polygon, Trigger } from "melonjs";

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
 * A custom level trigger that uses a star-shaped mask transition, and loads
 * the next map's asset bundle on the way (see `resources.ts`): each map's
 * bundle has the map's own name, so the trigger's `to` names both.
 */
type TriggerSettings = ConstructorParameters<typeof Trigger>[2];

export class LevelTrigger extends Trigger {
	/** set once the player has touched it, so the switch runs once */
	private switching = false;

	constructor(x: number, y: number, settings: TriggerSettings) {
		super(x, y, {
			...settings,
			transition: "mask",
			shape: new Polygon(0, 0, starPoints),
			color: "#000",
			duration: 300,
		});
	}

	/**
	 * Load the next map's bundle, then run the usual transition into it, and
	 * once that level is in the world, unload the bundle of the map just left. Images both maps draw stay in memory throughout: the next map's
	 * bundle lists them too, so loading it fetches nothing for them, and
	 * unloading the previous one does not free them.
	 */
	override triggerEvent() {
		const next = this.gotolevel;
		if (next === undefined) {
			// not a level switch this trigger knows how to prepare
			super.triggerEvent();
			return;
		}
		if (this.switching) {
			return;
		}
		this.switching = true;
		const previous = level.getCurrentLevelId();
		// already in memory on the first trip (everything is loaded at boot);
		// on the way back it fetches what unloading freed
		loader
			.load(next)
			.then(() => {
				event.once(event.LEVEL_LOADED, () => {
					if (previous !== undefined && previous !== next) {
						loader.unload(previous);
					}
				});
				super.triggerEvent();
			})
			.catch((error: unknown) => {
				// let the player try again
				this.switching = false;
				console.error(`could not load the "${next}" bundle`, error);
			});
	}
}
