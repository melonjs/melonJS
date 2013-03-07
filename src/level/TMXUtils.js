/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 * Tile QT 0.7.x format
 * http://www.mapeditor.org/	
 *
 */

(function($) {

	
	/**
	 * a collection of TMX utility Function
	 * @final
	 * @memberOf me
	 * @private
	 */

	me.TMXUtils = (function() {
		// hold public stuff in our singleton
		var api = {};

		/**
		 * Apply TMX Properties to the give object
		 * @private
		 */
		api.applyTMXPropertiesFromXML = function(obj, xmldata) {
			var properties = xmldata.getElementsByTagName(me.TMX_TAG_PROPERTIES)[0];

			if (properties) {
				var oProp = properties.getElementsByTagName(me.TMX_TAG_PROPERTY);

				for ( var i = 0; i < oProp.length; i++) {
					var propname = me.mapReader.TMXParser.getStringAttribute(oProp[i], me.TMX_TAG_NAME);
					var value = me.mapReader.TMXParser.getStringAttribute(oProp[i], me.TMX_TAG_VALUE);
					
					// if value not defined or boolean
					if (!value || value.isBoolean()) {
						value = value ? (value == "true") : true;
					}
					// check if numeric
					else if (value.isNumeric()) {
						value = Number(value);
					}
					// add the new prop to the object prop list
					obj[propname] = value;
							
				}
			}

		};
		
		/**
		 * Apply TMX Properties to the give object
		 * @private
		 */
		api.applyTMXPropertiesFromJSON = function(obj, data) {
			var properties = data[me.TMX_TAG_PROPERTIES];
			if (properties) {
				for(var name in properties){
					var value = properties[name];
					
					// if value not defined or boolean
					if (!value || value.isBoolean()) {
						value = value ? (value == "true") : true;
					}
					// check if numeric
					else if (value.isNumeric()) {
						value = Number(value);
					}
					// add the new prop to the object prop list
					obj[name] = value;
				}
			}
		};
		
		/**
		 * basic function to merge object properties
		 * @private
		 */
		api.mergeProperties = function(dest, src, overwrite) {
			for(var p in src){
				if(overwrite || dest[p]===undefined) dest[p]= src[p];
			}
			return dest;
		};

		
		// return our object
		return api;

	})();

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
