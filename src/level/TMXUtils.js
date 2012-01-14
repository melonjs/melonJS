/*
 * MelonJS Game Engine
 * Copyright (C) 2011, Olivier BIOT
 * http://www.melonjs.org
 *
 * TMX Loader
 * Tile QT 0.7.x format
 * http://www.mapeditor.org/	
 */

(function($, undefined) {

	
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
		api.setTMXProperties = function(obj, xmldata) {
			var layer_properties = xmldata.getElementsByTagName(me.TMX_TAG_PROPERTIES)[0];

			if (layer_properties) {
				var oProp = layer_properties.getElementsByTagName(me.TMX_TAG_PROPERTY);

				for ( var i = 0; i < oProp.length; i++) {
					var propname = me.XMLParser.getStringAttribute(oProp[i], me.TMX_TAG_NAME);
					var value = me.XMLParser.getStringAttribute(oProp[i], me.TMX_TAG_VALUE);
					
					// if value not defined or boolean
					if (!value || value.isBoolean()) {
						value = value ? (value == "true") : true;
					}
					// check if numeric
					else if (value.isNumeric()) {
						value = parseInt(value);
					}
					// add the new prop to the object prop list
					obj[propname] = value;
							
				}
			}

		};
		
		// return our object
		return api;

	})();

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
