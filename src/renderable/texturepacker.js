/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($) {

	/**
	 * a local constant for the -(Math.PI / 2) value
	 * @ignore
	 */
	var nhPI = -(Math.PI / 2);

	/**
	 * A Texture atlas object<br>
	 * Currently support : <br>
	 * - [TexturePacker]{@link http://www.codeandweb.com/texturepacker/} : through JSON export <br>
	 * - [ShoeBox]{@link http://renderhjs.net/shoebox/} : through JSON export using the melonJS setting [file]{@link https://github.com/melonjs/melonJS/raw/master/media/shoebox_JSON_export.sbx}
	 * @class
	 * @extends Object
	 * @memberOf me
	 * @constructor
	 * @param {Object} atlas atlas information. See {@link me.loader#getJSON}
	 * @param {Image} [texture=atlas.meta.image] texture name
	 * @example
	 * // create a texture atlas
	 * texture = new me.TextureAtlas (
	 *    me.loader.getJSON("texture"), 
	 *    me.loader.getImage("texture")
	 * );
	 */
	me.TextureAtlas = Object.extend(
	/** @scope me.TextureAtlas.prototype */
	{
		/**
		 * to identify the atlas format (e.g. texture packer)
		 * @ignore
		 */
		format: null,
		
		/**
		 * the image texture itself
		 * @ignore
		 */
		texture : null,		
		
		/**
		 * the atlas dictionnary
		 * @ignore
		 */
		atlas: null,

		/**
		 * @ignore
		 */
		init : function(atlas, texture) {
			if (atlas && atlas.meta) {
				// Texture Packer
				if (atlas.meta.app.contains("texturepacker")) {
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
				}
				// ShoeBox
				if (atlas.meta.app.contains("ShoeBox")) {
					if (!atlas.meta.exporter || !atlas.meta.exporter.contains("melonJS")) {
						throw "melonjs: ShoeBox requires the JSON exporter : https://github.com/melonjs/melonJS/tree/master/media/shoebox_JSON_export.sbx";
					}
					this.format = "ShoeBox";
					// set the texture
					this.texture = texture;
				}
				// initialize the atlas
				this.atlas = this.initFromTexturePacker(atlas);
			}
			
			// if format not recognized
			if (this.atlas === null) {
				throw "melonjs: texture atlas format not supported";
			}
		},
		
		/**
		 * @ignore
		 */
		initFromTexturePacker : function (data) {
			var atlas = {};
			data.frames.forEach(function(frame) {
				// fix wrongly formatted JSON (e.g. last dummy object in ShoeBox)
				if (frame.hasOwnProperty("filename")) {
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
				}
			});
			return atlas;
		},
		
		/**
		 * return the Atlas texture
		 * @name getTexture
		 * @memberOf me.TextureAtlas
		 * @function
		 * @return {Image}
		 */
		getTexture : function() {
			return this.texture;
		},
		
		/**
		 * return a normalized region/frame information for the specified sprite name
		 * @name getRegion
		 * @memberOf me.TextureAtlas
		 * @function
		 * @param {String} name name of the sprite
		 * @return {Object}
		 */
		getRegion : function(name) {
			var region = this.atlas[name];
			if (region) {
				return {
					name: name, // frame name
					pos: region.source.pos.clone(), // unused for now
					offset: region.frame.pos.clone(),
					width: region.frame.width,
					height: region.frame.height,
					angle : (region.rotated===true) ? nhPI : 0
				};
			}
			return null;
		},
		
		/**
		 * Create a sprite object using the first region found using the specified name
		 * @name createSpriteFromName
		 * @memberOf me.TextureAtlas
		 * @function
		 * @param {String} name name of the sprite
		 * @return {me.SpriteObject}
		 * @example
		 * // create a new texture atlas object under the `game` namespace
		 * game.texture = new me.TextureAtlas(
		 *    me.loader.getJSON("texture"), 
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
			var region = this.getRegion(name);
			if (region) {
				// instantiate a new sprite object
				var sprite = new me.SpriteObject(0,0, this.getTexture(), region.width, region.height);
				// set the sprite offset within the texture
				sprite.offset.setV(region.offset);
				// set angle if defined
				sprite._sourceAngle = region.angle;
				
				/* -> when using anchor positioning, this is not required
				   -> and makes final position wrong...
				if (tex.trimmed===true) {
					// adjust default position
					sprite.pos.add(tex.source.pos);
				}
				*/
				// return our object
				return sprite;
			}
			// throw an error
			throw "melonjs: TextureAtlas - region for " + name + " not found";
		},
		
		/**
		 * Create an animation object using the first region found using all specified names
		 * @name createAnimationFromName
		 * @memberOf me.TextureAtlas
		 * @function
		 * @param {String[]} names list of names for each sprite
		 * @return {me.AnimationSheet}
		 * @example
		 * // create a new texture atlas object under the `game` namespace
		 * game.texture = new me.TextureAtlas(
		 *    me.loader.getJSON("texture"), 
		 *    me.loader.getImage("texture")
		 * );
		 * ...
		 * ...
		 * // create a new animationSheet as renderable for the entity
		 * this.renderable = game.texture.createAnimationFromName([
		 *   "walk0001.png", "walk0002.png", "walk0003.png",
		 *   "walk0004.png", "walk0005.png", "walk0006.png",
		 *   "walk0007.png", "walk0008.png", "walk0009.png",
		 *   "walk0010.png", "walk0011.png"
		 * ]);
		 *
		 * // define an additional basic walking animatin
		 * this.renderable.addAnimation ("simple_walk", [0,2,1]);
		 * // you can also use frame name to define your animation
		 * this.renderable.addAnimation ("speed_walk", ["walk0007.png", "walk0008.png", "walk0009.png", "walk0010.png"]);
		 * // set the default animation
		 * this.renderable.setCurrentAnimation("simple_walk");
		 * // set the renderable position to bottom center
		 * this.anchorPoint.set(0.5, 1.0);		 
		 */
		createAnimationFromName : function(names) {
			var tpAtlas = [], indices = {};
			// iterate through the given names 
			// and create a "normalized" atlas
			for (var i = 0; i < names.length;++i) {
				tpAtlas[i] = this.getRegion(names[i]);
				indices[names[i]] = i;
				if (tpAtlas[i] == null) {
					// throw an error
					throw "melonjs: TextureAtlas - region for " + names[i] + " not found";
				}
			}
			// instantiate a new animation sheet object
			return new me.AnimationSheet(0,0, this.texture, 0, 0, 0, 0, tpAtlas, indices);
		}
	});

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
