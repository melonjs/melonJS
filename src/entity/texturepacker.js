/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($) {

	/**
	 * A Texture atlas object.
	 * @class
	 * @extends Object
	 * @memberOf me
	 * @constructor
	 * @param {Object} texture atlas information
	 * @example
	 * // create a texture atlas
	 * texture = new me.TextureAtlas (me.loader.getAtlas("texture") me.loader.getImage("texture"));
	 */
	me.TextureAtlas = Object.extend(
	/** @scope me.TextureAtlas.prototype */
	{
		// to identify the atlas format (e.g. texture packer)
		format: null,
		
		// the image texture itself
		texture : null,		
		
		// the atlas dictionnary
		atlas: null,

		/**
		 * @ignore
		 */
		init : function(atlas, texture) {
			if (atlas && atlas.meta && atlas.meta.app.contains("texturepacker")) {
				this.format = "texturepacker";
				this.atlas = this.initFromTexturePacker(atlas);
				this.texture = texture;
			};
			
			// if format not recognized
			if (this.atlas === null) {
				throw "melonjs: texture atlas format not supported";
			}
		},
		
		/**
		 * @private
		 */
		initFromTexturePacker : function (data) {
			var atlas = {};
			data['frames'].forEach(function(frame) {
				// check if the frame is trimmed
				if (frame['trimmed']===true) {
					// TODO, throw an error for now
					throw "melonjs: texturepacker - trim option not supported";
				}
				
				// check if the frame is rotated
				if(frame['rotated']===true){
					var w = frame['frame']['h'];
					var h = frame['frame']['w'];
				} else {
					var w = frame['frame']['w'];
					var h = frame['frame']['h'];
				}
				
				atlas[frame.filename] = {
					frame: new me.Rect( 
						new me.Vector2d(frame['frame']['x'], frame['frame']['y']), w, h
					),
					sourceSize: new me.Rect(
						new me.Vector2d(frame['spriteSourceSize']['x'], frame['spriteSourceSize']['y']), 
						frame['spriteSourceSize']['w'], frame['spriteSourceSize']['h']
					),
					//sourceSize: new me.Vector2d(frame['sourceSize']['w'],frame['sourceSize']['h']),
					rotated : frame['rotated']===true,
					trimmed : frame['trimmed']===true
				};
			});
			return atlas;
		},
		
		/**
		 * @return create a sprite object using the first region found using the specified name
		 * @param {String} name of the sprite
		 * @return me.SpriteObject
		 */
		createSpriteFromName : function(name) {
			var tex = this.atlas[name];
			if (tex) {
				// instantiate a new sprite object
				var sprite = new me.SpriteObject(0,0, this.texture, tex.frame.width, tex.frame.height);
				// set the sprite offset within the texture
				sprite.offset.setV(tex.frame.pos);
				
				// adjust final position
				sprite.pos.setV(tex.sourceSize.pos);
				
				// check if we need rotation
				if (tex.rotated===true) {
					sprite.angle = (-90).degToRad();
					// >> sprite pos not correct when rotated ? <<
				}
				// return our object
				return sprite;
			}
			// throw an error
			throw "melonjs: TextureAtlas - region not found";
		},
		
		/**
		 * @return create an animation object using the first region found using all specified names
		 * @param {String[]} name names of the sprite
		 * @return me.AnimationSheet
		 */
		createAnimationFromName : function(name) {
			//i'm not sure this one will stay as it
			// keep it for now while define the API
			// require futher change to animationSheet
		}
	});

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
