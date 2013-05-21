game.PlayScreen = me.ScreenObject.extend({
	/**	
	 *  action to perform on state change
	 */
	onResetEvent: function() {	
		// clear the background
		me.game.add(new me.ColorLayer("background", "#000000", 0), 0);
		// add a few squares
		me.game.add(new game.square(10,10),1);
		me.game.add(new game.square(400,300),2);
		me.game.add(new game.square(750,600),1);
		
		// register on the mousemove event using the viewport		
		me.input.registerPointerEvent("mousemove", me.game.viewport, function(event) {
			// publish a "mousemove" message
			me.event.publish("mousemove", [event]);
		});
	},
	
	
	/**	
	 *  action to perform when leaving this screen (state change)
	 */
	onDestroyEvent: function() {
	  me.input.releasePointerEvent("mousemove", me.game.viewport);
	}
});
