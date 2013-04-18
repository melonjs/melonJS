/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($) {

	/**
	 * a local constant for the -(Math.PI / 2) value
	 * @private
	 */
	var nhPI = -(Math.PI / 2);

	/**
	 * A Texture atlas object.
	 * @class
	 * @extends Object
	 * @memberOf me
	 * @constructor
	 * @param {Object} atlas atlas information
	 * @param {Image} [texture] texture (texture name from the atlas will be used if not specified)
	 * @example
	 * // create a texture atlas
	 * texture = new me.TextureAtlas (
	 *    me.loader.getAtlas("texture"), 
	 *    me.loader.getImage("texture")
	 * );
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
				// set the texture
				if (texture===undefined) {
					var name = me.utils.getBasename(atlas.meta.image);
					this.texture = me.loader.getImage(name);
					if (this.texture === null) {
						throw "melonjs: Atlas texture '" + name + "' not found";
					}
				} else {
					this.texture = texture;
				}
				// initialize the atlas
				this.atlas = this.initFromTexturePacker(atlas);
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
			data.frames.forEach(function(frame) {
				atlas[frame.filename] = {
					frame: new me.Rect( 
						new me.Vector2d(frame.frame.x, frame.frame.y),
						frame.frame.w, frame.frame.h
					),
					source: new me.Rect(
						new me.Vector2d(frame.spriteSourceSize.x, frame.spriteSourceSize.y),
						frame.spriteSourceSize.w, frame.spriteSourceSize.h
					),
					// non trimmed size, but since we don't support trimming both value are the same
					//sourceSize: new me.Vector2d(frame.sourceSize.w,frame.sourceSize.h),
					rotated : frame.rotated===true,
					trimmed : frame.trimmed===true
				};
			});
			return atlas;
		},
		
		/**
		 * Create a sprite object using the first region found using the specified name
		 * @param {String} name of the sprite
		 * @return {me.SpriteObject}
		 * @example
		 * // create a new texture atlas object under the `game` namespace
		 * game.texture = new me.TextureAtlas(
		 *    me.loader.getAtlas("texture"), 
		 *    me.loader.getImage("texture")
		 * );
		 * ...
		 * ...
		 * // add the coin sprite as renderable for the entity
		 * this.renderable = game.texture.createSpriteFromName("coin.png");
		 * // set the renderable position to bottom center
		 * this.anchorPoint.set(0.5, 1.0);
		 */
		createSpriteFromName : function(name) {
			var tex = this.atlas[name];
			if (tex) {
				// instantiate a new sprite object
				var sprite = new me.SpriteObject(0,0, this.texture, tex.frame.width, tex.frame.height);
				// set the sprite offset within the texture
				sprite.offset.setV(tex.frame.pos);
				
				/* -> when using anchor positioning, this is not required
				   -> and makes final position wrong...
				if (tex.trimmed===true) {
					// adjust default position
					sprite.pos.add(tex.source.pos);
				}
				*/
				
				// check if we need rotation
				if (tex.rotated===true) {
					sprite._sourceAngle = nhPI;
					// >> sprite pos not correct when rotated ? <<
				}
				// return our object
				return sprite;
			}
			// throw an error
			throw "melonjs: TextureAtlas - region not found";
		},
		
		/**
		 * Create an animation object using the first region found using all specified names
		 * @param {String[]} names names of the sprite
		 * @return {me.AnimationSheet}
		 * @example
		 * // create a new texture atlas object under the `game` namespace
		 * game.texture = new me.TextureAtlas(
		 *    me.loader.getAtlas("texture"), 
		 *    me.loader.getImage("texture")
		 * );
		 * ...
		 * ...
		 * // create a new animationSheet as renderable for the entity
		 * this.renderable = game.texture.createAnimationFromName([
		 *   "walk0001.png", "walk0002.png", "walk0003.png",
		 *   "walk0004.png", "walk0005.png", "walk0006.png",
		 *   "walk0007.png", "walk0008.png", "walk0009.png",
		 *	 "walk0010.png", "walk0011.png"
		 * ]);
		 *
		 * // define an additional basic walking animatin
		 * this.renderable.addAnimation ("walk",  [0,2,1]);
		 * // set as current animation
		 * this.renderable.setCurrentAnimation("walk");
		 * // set the renderable position to bottom center
		 * this.anchorPoint.set(0.5, 1.0);		 
		 */
		createAnimationFromName : function(names) {
			var tpAtlas = [], count = 0;
			// iterate through the given names 
			// and create a "normalized" atlas
			for (var i = 0; i < names.length;++i) {
				var tex = this.atlas[names[i]];
				if (tex) {
					tpAtlas[count++] = {
						pos: tex.source.pos.clone(), // unused for now
						offset: tex.frame.pos.clone(),
						width: tex.frame.width,
						height: tex.frame.height,
						angle : (tex.rotated===true) ? nhPI : 0
					};
				} else {
					// throw an error
					throw "melonjs: TextureAtlas - region for " + names[i] + " not found";
				}
			}
			
			// instantiate a new animation sheet object
			return new me.AnimationSheet(0,0, this.texture, 0, 0, 0, 0, tpAtlas);
		}
	});

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
