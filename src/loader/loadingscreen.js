/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($) {

	/**
	 * a default loading screen
	 * @memberOf me
	 * @ignore
	 * @constructor
	 */
	me.DefaultLoadingScreen = me.ScreenObject.extend({
		/*---
		
			constructor
			
			---*/
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

			// generated from /src/loader/logo.png
			this.imgLogo = new Image();
			this.imgLogo.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABVCAMAAACIGrFuAAADAFBMVEXu7u7t7e37+/v39/f4+Pjp6en7+/v7+/v////r6+v09PTs7Oz4+Pju7u7f39/19fX39/fs7Oz09PTr6+v6+vrx8fH09PT5+fn6+vrs7Oz5+fnw8PDy8vL////4+Pj6+vqZmZnt7e3z8/Pt7e3x8fHq6ury8vL////t7e34+Pju7u7////u7u7t7e3w8PDz7/P/zP/w8PDw8PD6+vr9/f3r6+vt7e3u7u739/f29vb19fXs7Ozw8PD29vb4+fjr6+u5ubn6+vr7+/v////x8fHw8PD////q6ur7+/ny8vL39/fw8PD29vb////39/fp6en09PTr6+v39/ft7e3////////6+vr6+vrs7Oz4+Pj////39/f29vb8/Pz39/f8/Pz19fXu7u75+fn6+vrw8PD4+Pj8/Pzu7+7s7Ozt7u3+/v7x8fH4+Pj+/v7////t7e34+Pjx8fHs7Ozu7u7v7+/4+Pj5+fnz8/P////u7u719fX////19fX4+Pj39/f29vZAQEDo6Ojv7+/////39/cAAADv7+/v7+/z8/P9/f3z8/Py8vLw8PDy8vLy8vL7+/v29vbr6+v6+vr4+Pjy8vL39/fr6+v////4+Pjz8/Pu7u739/fu7u739/f09PT5+fn9/f39/f3t7e37+/vy8vLw8PAAAAD9/f3r6+vu7u73+Pf+/v729vb5+fn4+Pizs7Pz8/P19fX09PT09PT6+vr9/f37+/v4+Pj8/Pz4+Pjr6+v9/f37+/v5+fnz8/P5+fn7+/v19fX7+/v////////+/v7///+/v7/Gxsbv7+/9/f3w8PDv7+/w8PDz8/P7+/vs7Oz39/f8/Pzj4+P29vb////6+vr////u7u7w8PD9/f3////7+/v////////+/v79/f3v7+/MzMyAgICqqqr////7+/u/v7////////////////8AAADs7Oz19vXy8vLu7+7z8/Px8fH4+Pj29vb19fX39/f5+fn09PTt7e36+vr8/Pz9/f37+/v+/v7////sE5ywAAAA7XRSTlP+4aarSutFgI7oXv9z8RC9hflg+zjXcHde/Hu7yUCJswXAKsUk8T2EVCZaJvzbRUAFQumbZ8zB9GGiSt3dt6znC6itQdPSbO9+yGLUx52G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";
		
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
			// free the Image ressource
			if (this.imgLogo && (typeof(this.imgLogo.dispose) === 'function')) {
				// cocoonJS extension
				this.imgLogo.dispose();
			} 
			delete this.imgLogo;
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

		/*---
		
			draw function
		  ---*/

		draw : function(context) {
			
			// measure the logo size
			var logo1_width = this.logo1.measureText(context, "melon").width;
			var xpos = (me.video.getWidth() - logo1_width - this.logo2.measureText(context, "JS").width) / 2;
			var ypos = (me.video.getHeight() / 2) + (this.logo2.measureText(context, "melon").height);
				
			// clear surface
			me.video.clearSurface(context, "#202020");
			
			// draw the melonJS logo
			context.drawImage(
					this.imgLogo, 
					(me.video.getWidth() - this.imgLogo.width) /2 , 
					(me.video.getHeight()/2) - (this.barHeight/2) - 4 - this.imgLogo.height
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


	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
