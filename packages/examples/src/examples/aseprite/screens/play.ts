import * as me from "melonjs";
import { Paladin } from "../entities/entities";

export let paladin: me.Entity;

export class PlayScreen extends me.Stage {
	/**
	 *  action to perform on state change
	 */
	onResetEvent() {
		paladin = new Paladin();
		me.game.world.addChild(paladin, 2);
	}
}
