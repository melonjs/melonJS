/**
 * melonJS — Slingshot: the pets waiting their turn on the deck.
 *
 * The first pet starts in the pouch; the others stand in line behind the
 * slingshot, nearest first. The line decides which pet comes next, so the
 * one that leaves the deck is always the one that goes into the pouch.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import type { World } from "melonjs";
import { DECK_TOP, PET_SIZE, PETS, POUCH, QUEUE_GAP } from "../constants";
import { Pet } from "./Pet";

/** the next pet, and where it comes from */
export interface NextPet {
	name: string;
	// where it stood in line, or `null` for the first, already in the pouch
	from: { x: number; y: number } | null;
}

export class PetLine {
	private readonly world: World;
	private readonly waiting: Pet[];
	private first = true;

	/**
	 * Line up every pet but the first on the deck.
	 * @param world - the game world
	 */
	constructor(world: World) {
		this.world = world;
		this.waiting = PETS.slice(1).map((name, i) => {
			const pet = new Pet(
				name,
				POUCH.x - 70 - QUEUE_GAP * i,
				DECK_TOP - PET_SIZE / 2,
			);
			// on the deck, whose top is not the ground their shadows fall on
			pet.castGroundShadow = false;
			world.addChild(pet, POUCH.z);
			return pet;
		});
	}

	/**
	 * Take the next pet: the first, then the front of the line, which leaves
	 * the deck.
	 * @returns which pet it is, and where it stood
	 */
	next(): NextPet {
		if (this.first) {
			this.first = false;
			return { name: PETS[0], from: null };
		}
		const pet = this.waiting.shift();
		if (pet === undefined) {
			throw new Error("no pet left in line");
		}
		// where it stood, read before it leaves: removing it destroys it
		const from = { x: pet.pos.x, y: pet.pos.y };
		const name = pet.name;
		this.world.removeChildNow(pet);
		return { name, from };
	}
}
