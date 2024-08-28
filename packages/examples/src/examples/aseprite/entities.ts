import * as me from "melonjs";

export class Paladin extends me.Entity {
	constructor() {
		// call the super constructor
		super(160, 250, { width: 100, height: 100 });

		// just manually change the guy position
		this.body.setStatic();

		const textureAtlas = new me.TextureAtlas(
			me.loader.getJSON("paladin"),
			me.loader.getImage("paladin"),
		);

		// create a new sprite with all animations from the paladin atlas
		this.renderable = textureAtlas.createAnimationFromName();
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		(this.renderable as me.Sprite).setCurrentAnimation("run front");

		this.anchorPoint.set(0.5, 0.0);
		this.renderable.scale(4);
	}
}
