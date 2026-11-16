import { Actor } from "./Actor";

/**
 * Bolt, built where the map's `Bolt` object is. The field takes it from the
 * level to draw it with the other characters, and moves it from then on.
 */
export class Bolt extends Actor {
	/**
	 * @param x - the object's x, in the map
	 * @param y - the object's y, in the map
	 */
	constructor(x: number, y: number) {
		super("bolt-idle-down");
		this.place(x, y);
	}
}
