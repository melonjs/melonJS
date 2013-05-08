/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($) {
		/**
		 * A skeleton object. This works with Spine, an application created by http://esotericsoftware.com/. This object stores the data of each individual bone.
		 * @class
		 * @extends Object
		 * @param {me.TextureAtlas}
		 * @memberOf me
		 * @constructor
		 */
		me.Skeleton = Object.extend(
		/** @scope me.Skeleton.prototype */
		{
		/**
		 * The sprites array, storing sprite objects for the skeleton. One for each image in the texture
		 * @public
		 * @type Array
		 * @name sprites
		 * @memberOf me.Skeleton
		 */
		sprites: [],
		/**
		 * The TextureAtlas object, storing the image data for the spine animation
		 * @public
		 * @type me.TextureAtlas
		 * @name texture
		 * @memberOf me.Skeleton
		 */
		texture: null,
		init: function(texture) {
			this.texture = texture;
			if(texture === null || typeof texture === "undefined") {
				console.error("Texture was null when initializing Skeleton.");
			}

			for(var region in this.texture.atlas) {
				this.sprites.push(texture.createSpriteFromName(region));
			}
		}
	});
})(window);