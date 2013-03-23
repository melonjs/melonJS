
var jsApp = {

	/**
	 * Initialize the application
	 */
	 onload: function() {
		// init the video
		if (!me.video.init('jsapp', 640, 480)) {
			alert("Sorry but your browser does not support html 5 canvas. Please try with another one!");
			return;
		}
		
		// set all ressources to be loaded
		me.loader.onload = this.loaded.bind(this);
		
		// set all ressources to be loaded
		// (for later to load bitmap font)
		me.loader.preload({});
		
		// load everything & display a loading screen
		me.state.change(me.state.LOADING);
	},
	
	/**
	 * callback when everything is loaded
	 */
	loaded: function () {
		// set the "Play/Ingame" Screen Object
		me.state.set(me.state.PLAY, new PlayScreen());
		// switch to PLAY state
		me.state.change(me.state.PLAY);
	}
	
}; // jsApp

/* game initialization */
var PlayScreen = me.ScreenObject.extend( {
	// constructor
	init: function() {
		// pass true to the parent constructor
		// as we draw our progress bar in the draw function
		this.parent(true);
		// arial font 
		this.logo = new me.Font('Arial', 8, 'white');
    },
    
	
	// draw function
	draw : function(context) {
		// clear the screen
		me.video.clearSurface (context, "black");
		
		var y_pos = 0;
		
		// font size test
		for (var i = 8;i<56;i+=8) {
			this.logo.set('Arial', i, 'white');
			y_pos+=this.logo.measureText(context, "DUMMY").height;
			this.logo.draw(context, "Arial Text " +i + "px !" , 5 , y_pos );
		}

		// font baseline test
		this.logo.set('Arial', 14, 'white');
		var baseline = 200;

		// Draw the baseline
		context.beginPath();
		context.moveTo(0, baseline + 0.5);
		context.lineTo(me.video.getWidth(), baseline + 0.5);
		context.strokeStyle = "red";
		context.stroke();

		var baselines = [
			"bottom", "ideographic", "alphabetic", "middle", "hanging", "top"
		];

		var x_pos = 0;

		// font baseline test
		for (var i = 0;i<baselines.length;i++) {
			var text = "Arial " + baselines[i];
			this.logo.textBaseline = baselines[i];
			this.logo.draw(context, text, x_pos, baseline);
			x_pos+=this.logo.measureText(context, text + "   ").width;
		}

		// reset to default baseline
		this.logo.textBaseline = "alphabetic";
		
	}

});

//bootstrap :)
window.onReady(function() {
	jsApp.onload();
});
