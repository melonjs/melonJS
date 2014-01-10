game.PlayScreen = me.ScreenObject.extend({
	/**
	 *  action to perform on state change
	 */
	onResetEvent: function() {
		// add background to the game world
		me.game.world.addChild(new me.ColorLayer("background", "#4D4D4D"), 0);

		// create a new emitter at viewport center bottom
		game.Emitter = new me.ParticleEmitter(me.game.viewport.getWidth() / 2, me.game.viewport.getHeight() - 50, me.loader.getImage("explosion"));

		// set the emiter z order
		game.Emitter.z = 11;

		// add the emitter to the game world
		me.game.world.addChild(game.Emitter);

		// create a secondary emitter at viewport center bottom
		game.EmitterAux = new me.ParticleEmitter(me.game.viewport.getWidth() / 2, me.game.viewport.getHeight() - 50, me.loader.getImage("explosion"));

		// set the secondary emiter z order
		game.EmitterAux.z = 10;

		// add the secondary emitter to the game world
		me.game.world.addChild(game.EmitterAux);

		// start the default emitter example
		game.changeEmitter();
	},

	/**
	 *  action to perform when leaving this screen (state change)
	 */
	onDestroyEvent: function() {
		// remove the emitters from the game world
		me.game.world.removeChild(game.Emitter);
		me.game.world.removeChild(game.EmitterAux);
	}
});
