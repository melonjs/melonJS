/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($) {

	/**
	 * A texture atlas object.
	 * @class
	 * @extends Object
	 * @memberOf me
	 * @constructor
	 * @param {Object} texture atlas information
	 */
	me.TextureAtlas = Object.extend(
	/** @scope me.TextureAtlas.prototype */
	{
		// to identify the atlas format (e.g. texture packer)
		format: null,
		
		// the atlas dictionnary
		dict: null,

		/**
		 * @ignore
		 */
		init : function(atlas) {
			if (atlas && atlas.meta && atlas.meta.app.contains("texturepacker")) {
				this.format = "texturepacker";
				this.dict = this.initFromTexturePacker(atlas);
			};
			
			// if format not recognized
			if (this.dict === null) {
				throw "melonjs: texture atlas format not supported";
			}
		},
		
		initFromTexturePacker : function (atlas) {
			var dict = {};
			atlas["frames"].forEach(function(frame) {
				// check if the frame is rotated
				if(frame['rotated']){
					var w = frame['frame']['h'];
					var h = frame['frame']['w'];
				} else {
					var w = frame['frame']['w'];
					var h = frame['frame']['h'];
				}
				
				dict[frame.filename] = {
					rect: new me.Rect(frame['frame']['x'], frame['frame']['y'], w, h),
					spriteSourceSize: new me.Vector2d(frame['spriteSourceSize']['x'],frame['spriteSourceSize']['y']),
					sourceSize: new me.Vector2d(frame['sourceSize']['w'],frame['sourceSize']['h']),
					rotated : frame['rotated']===true
				};
			});
			return dict;
		}
	});

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
