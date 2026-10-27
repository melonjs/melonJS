/**
 * melonJS — Isometric Dungeon example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import type { Container, Vector2d } from "melonjs";
import { Chest, Door, Gate, Usable } from "./usables";

export interface DungeonEvents {
	chest: (opened: number, total: number) => void;
	locked: () => void;
	gate: () => void;
	exit: () => void;
}

// how far the other half of a double door can be: it stands in the next
// cell along the wall, 72 pixels away on screen
const DOUBLE_DOOR = 80;

// the rules: open every chest and the gate to the stairs opens
export class Dungeon {
	readonly usables: Usable[];
	readonly chests: number;
	private opened = 0;

	constructor(
		world: Container,
		readonly events: DungeonEvents,
	) {
		this.usables = world
			.getChildren()
			.filter((child): child is Usable => child instanceof Usable);
		this.chests = this.usables.filter((u) => u instanceof Chest).length;
	}

	// the closest unused thing within `reach` of `at`, of those `accept` takes
	nearest(
		at: Vector2d,
		reach: number,
		accept: (usable: Usable) => boolean = () => true,
	) {
		let best: Usable | undefined;
		let bestDist = reach;
		for (const usable of this.usables) {
			if (usable.used || !accept(usable)) {
				continue;
			}
			const dist = usable.spot.distance(at);
			if (dist < bestDist) {
				best = usable;
				bestDist = dist;
			}
		}
		return best;
	}

	chestOpened() {
		this.opened++;
		this.events.chest(this.opened, this.chests);
		if (this.opened === this.chests) {
			for (const usable of this.usables) {
				if (usable instanceof Gate) {
					usable.open();
				}
			}
			this.events.gate();
		}
	}

	// double doors are two tiles: open the one next to it as well
	openDoorway(door: Door) {
		door.open();
		const other = this.nearest(door.spot, DOUBLE_DOOR, (usable) => {
			return usable instanceof Door && !(usable instanceof Gate);
		});
		other?.open();
	}
}
