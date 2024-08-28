import { Renderable, game, math } from "melonjs";
import { MoleEntity } from "./mole";

/**
 * a mole manager (to manage movement, etc..)
 */
export class MoleManager extends Renderable {
	moles: MoleEntity[]; // declare the 'moles' property
	timer: number; // declare the 'timer' property

	constructor() {
		// call the super constructor
		super(0, 0, 10, 10);

		this.moles = [];
		this.timer = 0;

		// add the first row of moles
		for (let i = 0; i < 3; i++) {
			this.moles[i] = new MoleEntity(112 + i * 310, 127 + 40);
			game.world.addChild(this.moles[i], 15);
		}

		// add the 2nd row of moles
		for (let i = 3; i < 6; i++) {
			this.moles[i] = new MoleEntity(112 + (i - 3) * 310, 383 + 40);
			game.world.addChild(this.moles[i], 35);
		}

		// add the 3rd row of moles
		for (let i = 6; i < 9; i++) {
			this.moles[i] = new MoleEntity(112 + (i - 6) * 310, 639 + 40);
			game.world.addChild(this.moles[i], 55);
		}

		this.timer = 0;
	}

	/*
	 * update function
	 */
	override update(dt: number) {
		// every 1/2 seconds display moles randomly
		this.timer += dt;
		if (this.timer >= 500) {
			for (let i = 0; i < 9; i += 3) {
				const hole = math.random(0, 3) + i;
				if (!this.moles[hole].isOut && !this.moles[hole].isVisible) {
					this.moles[hole].display();
				}
			}
			this.timer = 0;
		}
		return false;
	}
}
