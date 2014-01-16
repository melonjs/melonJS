game.PlayScreen = me.ScreenObject.extend({
	/**
	 *  action to perform on state change
	 */
	onResetEvent: function() {
		// set world size
		me.game.viewport.bounds.resize(2000, 2000);

		// add background to the game world
		me.game.world.addChild(new me.ImageLayer("background", 0, 0, "grid", 0, 0));

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

		// enable the keyboard
		me.input.bindKey(me.input.KEY.X, "moveEmitter");
		me.input.bindKey(me.input.KEY.C, "moveViewport");

		// map the left button click on the enter key
		me.input.bindMouse(me.input.mouse.LEFT, me.input.KEY.X);
		me.input.bindMouse(me.input.mouse.MIDDLE, me.input.KEY.C);

		// listen to mouse movement
		var viewport = me.game.viewport;
		var mousepos = me.input.mouse.pos;
		var lastX = mousepos.x, lastY = mousepos.y;
		me.event.subscribe(me.event.MOUSEMOVE, function() {
			if(me.input.isKeyPressed("moveEmitter")) {
				var pos = mousepos;
				if(!game.Emitter.floating) {
					pos = viewport.localToWorld(pos.x, pos.y);
				}
				game.Emitter.pos.setV(pos);
				game.EmitterAux.pos.setV(pos);
			}
			if(me.input.isKeyPressed("moveViewport")) {
				viewport.move(lastX - mousepos.x, lastY - mousepos.y);
			}
			lastX = mousepos.x;
			lastY = mousepos.y;
		});
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
