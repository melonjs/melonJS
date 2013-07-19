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
			
			// generated from /src/loader/logo.png
			this.imgLogo = new Image();
			this.imgLogo.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABKCAYAAABEr1FoAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAN1wAADdcBQiibeAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAdjSURBVHic7d17jFxlGcfxz253W7pApVtLq3RBpAhSlW2lWkK1WkugEMVqrRbENgreohIQRVHR4q1KjFqDxmBio0HxQrQaLzQk1ogaQ0CsGrwWr62Vq6ZG2g1d//jt2G27l9ndM3NmdvpNJjt79uw5z7zPed/3ub3vtPX39zvCkMzAmejF49E2wqtCG/bhJ9iKx0a7SdsRBYATsBDPQNfAsX/hnoHX/WO4VieW4TzswS347XAnt6oCpkkjLZUG+yt+ju34T4H3mYmLcSLeI73jIFpJASdjJU7Co9iGO9BXp3tfhSuwf/AfJrsCTscaHIsd+C7+XJIsvXg+Pj74YEc5stSUbrwc8/EbfFLG87K5B2vRblAvmCw9oAMXyJj+ML6KP5Yq0dCsElm/VjnQ7Ap4Gl4mH+r7MqY38gdaIvPA2sqBZh2CzpUJdTs+LJNqMzBVfIu5+AcZj5qFTrxKxvSpeCs2a57GJ6bvI3hd5UAz9IDjcBmeiC/hC+WKMyGOx1nyWTbQ2ArowevFvb8J95UrzoSZhznSk0/CAvy6ERUwE2/EXnwMD5UrTmG8VEzjChdoMAVMlyf+WNyIB8sVp1COF6dw4aBjK3FDIyigA+vl6fiM8jzVWvJ28YQHsxTTylbAapyDz+NzJctSK86VHrDkkOOd6ClLAcvEgfo6rixJhnpwlJjOq4f5+7x6K6Abb5O4yJvqfO8yuB5PF0UMRV17wMU4Ax8RZ2Sy8w4xN88c4Zx59fCEn4xP4C94t9Zo/MvEzl8zynk17QEdYs9PFSvgsGzQJOVFeC5eWcW5NZsDFuMSMSuHzYdOQs7GKyQfUQ09RYej28Sq+a80fivxHLwBL5GcczU8UGQPmI33ik1/V4HXbQZW4SIZfqptfDimKAUsGxDgWvy7oGs2C5fLmL8WU8b4v7smqoB2ics/LFn/VuNaCS+vGuf//30iCpiD6/BZyUy1Eh3iz/Ri+QSus3O8CujFOlwj1V+txGxslMjmwlHOHY1x9YAVEkC7SmMnwGvB8/BaiWT2FHC9MfeAtVKouqGAmzcTlbluiVg6RRkvY1LAFdiNTxV082ZhLj4ooYVnF3ztqoagdnnif4jbCxag0VkhZuZy6flFs7MaT/ij+LJUD7cKXWJgLMb5Dl4DUBQPYs5oPeAabNFajX8+Xi1Vd0+t4X2+g8dGUsA6CaT9uIZCNBJzJFx+qqQRax2q38Lws/l5Ekb+Zo2FaATapCjgQjGv59bhno/iNoZWQMXB2FgHQcrmdMlczZfGrxe3G1iJc6gCHidx/KvrKEwZzBCz+iy8AEfX+f5bKm8OtYKuxyY8UGeB6sVUKf5aLhPsU0qQYb/Uhu7m4B6wBH8wORu/XYoCLpL1Ws8sUZafGWh8DiigU4aeN5chUY1ZiUvlqVtWsiykFur/VIagK/E9WVM1WXiWDDdPEI+27CpA8uSfYtBS2IpQc0yexl8iFQk9yplgR+IDDlmH3IFFmj+H2y5RygvlYVomlk4jsUOSVwfRIU7XjXUXpximS+3l2dLwy8XSaUSuM8Si8A55UpotkT4br5EQcY8kxWsRMCuK7bK86jA6ZCVKs1BJiJwodvyicsWpmncaJnvYCJbBaPQ4sPK9W4abeaVKNDZ+JFskDEmH4Uuny6RLKswWyXAz3+ELHJqBfgnpD0sHduFJ+FPt5RmRKVLet0IikrMG3h9TplATZAN+OtIJbf39/UfhBkNspVIH5koC5NSB912ShTqlznLUgm9L6GPElGPFE14syYhL1LbOp0PG8GWyHHWmjOtL5YmfLPxOPPFRd2mpTMJ3Stpxi+x3drOJe8bt8mT3ysqYqdLY7ThNFNEMRsBY2SOlilVtkTM4HD0N94oi7pfh6F5Zob4LO/FPBzaia5cGnSUVA7Mk7nKy2OQzBn4eLatkeh3Yj20ysxq3VnvyofmANfjKwPs9sq3XL6Qhp4vF1Ce+Q2flGvJ0T5PG7pZwb/c4P0Azs1Fs/qoZqizlG3hxURK1EFsl9D0mQ2YoBXSL63xCMXK1BHfghcaxAHGo0ouHJJxbb5O0WblVyljGtfpzuNqXbXjf+ORpKTbJvDnuTaNGKj56vyTpj3A4/bLif8LOazW1oe+STM4Rwj6pGryliItVu0z1aglXtDqPiJO1ragLjmWd8Ftkw7xWZYfEdn5V5EXHUoC6SRYit9qypH34kFRLF9r4jG/j1vX4tHjGk50fyH4XNasYGU8J9mbJxd5WrCgNxW7xhZarcbnOeGvg75M4/lqDyuwmAfulQuQ0iQjXnCI26zhOFi1frrErE0bjTpnj6lojVeRuKedI4dGCoi5YB/rwLdkYdqsSDIyit6vpFCdlvfoueBgrv5ddGjdLjqM0arl9/XypWrtUkv5ls1cCZzcp0JGaKPX4/oA2yQGvk2xRPasc+mSHxpvxRQ24DXK9v8ChS+LmiyRPvEB6RxGT9178EnfLRHrXwO8NvVddI3yDRpeUGVYUcoYsHZoiT3CfNGLfEK+/SUPfLV5qPb4RqVD+B1k5h7o/5mLtAAAAAElFTkSuQmCC";
		
			this.barHeight = 6;
		},

		// call when the loader is resetted
		onResetEvent : function() {
			// melonJS logo
			this.logo1 = new me.Font('century gothic', 32, 'white', 'middle');
			this.logo2 = new me.Font('century gothic', 32, '#55aa00', 'middle');
			this.logo2.bold();
			this.logo1.textBaseline = this.logo2.textBaseline = "alphabetic";

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

		/*---
		
			draw function
		  ---*/

		draw : function(context) {
			
			// measure the logo size
			var logo1_width = this.logo1.measureText(context, "melon").width;
			var xpos = (me.video.getWidth() - logo1_width - this.logo2.measureText(context, "JS").width) / 2;
			var ypos = (me.video.getHeight() / 2) + (this.logo2.measureText(context, "melon").height);
				
			// clear surface
			me.video.clearSurface(context, "#333333");
			
			// draw the melonJS logo
			context.drawImage(this.imgLogo, (me.video.getWidth() - this.imgLogo.width) /2 , (me.video.getHeight()/2) - (this.barHeight/2) - 8 - this.imgLogo.height);
			
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
			context.fillRect(2, (me.video.getHeight()/2)-(this.barHeight/2), progress, 6);
		}

	});


	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
