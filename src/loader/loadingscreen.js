/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function(window) {

	/**
	 * a default loading screen
	 * @memberOf me
	 * @ignore
	 * @constructor
	 */
	me.DefaultLoadingScreen = me.ScreenObject.extend({
		// constructor
		init : function() {
			this.parent(true);

			// flag to know if we need to refresh the display
			this.invalidate = false;

			// handle for the susbcribe function
			this.handle = null;
			
		},

		// call when the loader is resetted
		onResetEvent : function() {
			// melonJS logo
			this.logo1 = new me.Font('century gothic', 32, 'white', 'middle');
			this.logo2 = new me.Font('century gothic', 32, '#55aa00', 'middle');
			this.logo2.bold();
			this.logo1.textBaseline = this.logo2.textBaseline = "alphabetic";
		
			// default progress bar height
			this.barHeight = 4;

			// setup a callback
			this.handle = me.event.subscribe(me.event.LOADER_PROGRESS, this.onProgressUpdate.bind(this));

			// load progress in percent
			this.loadPercent = 0;
		},
		
		// destroy object at end of loading
		onDestroyEvent : function() {
			// "nullify" all fonts
			this.logo1 = this.logo2 = null;
			// cancel the callback
			if (this.handle)  {
				me.event.unsubscribe(this.handle);
				this.handle = null;
			}
		},

		// make sure the screen is refreshed every frame 
		onProgressUpdate : function(progress) {
			this.loadPercent = progress;
			this.invalidate = true;
		},

		// make sure the screen is refreshed every frame 
		update : function() {
			if (this.invalidate === true) {
				// clear the flag
				this.invalidate = false;
				// and return true
				return true;
			}
			// else return false
			return false;
		},

		// draw the melonJS logo
		drawLogo : function (context, x, y) {		
		
			context.save();
			
			// translate to destination point
			context.translate(x,y);

			// generated using Illustrator and the Ai2Canvas plugin
			context.beginPath();
			context.moveTo(0.7, 48.9);
			context.bezierCurveTo(10.8, 68.9, 38.4, 75.8, 62.2, 64.5);
			context.bezierCurveTo(86.1, 53.1, 97.2, 27.7, 87.0, 7.7);
			context.lineTo(87.0, 7.7);
			context.bezierCurveTo(89.9, 15.4, 73.9, 30.2, 50.5, 41.4);
			context.bezierCurveTo(27.1, 52.5, 5.2, 55.8, 0.7, 48.9);
			context.lineTo(0.7, 48.9);
			context.lineTo(0.7, 48.9);
			context.closePath();
			context.fillStyle = "rgb(255, 255, 255)";
			context.fill();

			context.beginPath();
			context.moveTo(84.0, 7.0);
			context.bezierCurveTo(87.6, 14.7, 72.5, 30.2, 50.2, 41.6);
			context.bezierCurveTo(27.9, 53.0, 6.9, 55.9, 3.2, 48.2);
			context.bezierCurveTo(-0.5, 40.4, 14.6, 24.9, 36.9, 13.5);
			context.bezierCurveTo(59.2, 2.2, 80.3, -0.8, 84.0, 7.0);
			context.lineTo(84.0, 7.0);
			context.closePath();
			context.lineWidth = 5.3;
			context.strokeStyle = "rgb(255, 255, 255)";
			context.lineJoin = "miter";
			context.miterLimit = 4.0;
			context.stroke();
			
			context.restore();
		},
		
		// draw function
		draw : function(context) {
			
			// measure the logo size
			var logo1_width = this.logo1.measureText(context, "melon").width;
			var xpos = (me.video.getWidth() - logo1_width - this.logo2.measureText(context, "JS").width) / 2;
			var ypos = (me.video.getHeight() / 2) + (this.logo2.measureText(context, "melon").height);
				
			// clear surface
			me.video.clearSurface(context, "#202020");
			
			// logo 100x85
			this.drawLogo( 
					context,
					(me.video.getWidth() - 100) /2 ,  
					(me.video.getHeight()/2) - (this.barHeight/2) - 90
			);
			
			// draw the melonJS string
			this.logo1.draw(context, 'melon', xpos , ypos);
			xpos += logo1_width;
			this.logo2.draw(context, 'JS', xpos, ypos);
			
			// display a progressive loading bar
			var progress = Math.floor(this.loadPercent * me.video.getWidth());

			// draw the progress bar
			context.fillStyle = "black";
			context.fillRect(0, (me.video.getHeight()/2)-(this.barHeight/2), me.video.getWidth(), this.barHeight);
			context.fillStyle = "#55aa00";
			context.fillRect(2, (me.video.getHeight()/2)-(this.barHeight/2), progress, this.barHeight);
		}

	});
	// --- END ---
})(window);
