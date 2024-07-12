import * as me from "melonjs";
import { Paladin } from "./entities";

export let paladin: me.Entity;

export class PlayScreen extends me.Stage {
	onResetEvent() {
		paladin = new Paladin();
		me.game.world.addChild(paladin, 2);
	}
}
