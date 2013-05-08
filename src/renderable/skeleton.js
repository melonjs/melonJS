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
		 * @param {String} - name of the texture. Should represent the atlas json file, and the image. skeleton.json and skeleton.png, would make this parameter "skeleton"
		 * @param {String} - name of the JSON data specified in resource loader
		 * @memberOf me
		 * @constructor
		 */
		me.Skeleton = Object.extend(
		/** @scope me.Skeleton.prototype */
		{
		/**
		 * Data storing all the spine information.
		 * @ignore
		 */
		data: {},
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
		init: function(texture, data) {
			if(texture === null || typeof texture === "") {
				console.error("Texture was null when initializing Skeleton.");
			}

			this.texture = new me.TextureAtlas(me.loader.getAtlas(texture), me.loader.getImage(texture));

			if(data === null) {
				console.error("Name of skeleton data not specified");
			}

			this.data = me.loader.getJSON(data);

			for(var region in this.texture.atlas) {
				this.sprites.push(texture.createSpriteFromName(region));
			}
		},

		/**
		 * parses the data property.
		 */
		parseData: function() {
			
		}
	});
})(window);