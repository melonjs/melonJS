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
	 * @ignore
	 */

	me.TMXUtils = (function() {
		
		/**
		 * set and interpret a TMX property value 
		 * @ignore
		 */
		function setTMXValue(value) {
            //console.log(value);
            if (!value || value.isBoolean()) {
				// if value not defined or boolean
				value = value ? (value === "true") : true;
			} else if (value.isNumeric()) {
				// check if numeric
				value = Number(value);
			} else if (value.match(/^json:/i)) {
				// try to parse it
				var match = value.split(/^json:/i)[1];
				try {
					value = JSON.parse(match);
				}
				catch (e) {
					throw "Unable to parse JSON: " + match;
				}
			}
			// return the interpreted value
			return value;
		}
	
		// hold public stuff in our singleton
		var api = {};

		/**
		 * Apply TMX Properties to the give object
		 * @ignore
		 */
		api.applyTMXPropertiesFromXML = function(obj, xmldata) {
			var properties = xmldata.getElementsByTagName(me.TMX_TAG_PROPERTIES)[0];

			if (properties) {
				var oProp = properties.getElementsByTagName(me.TMX_TAG_PROPERTY);

				for ( var i = 0; i < oProp.length; i++) {
					var propname = me.mapReader.TMXParser.getStringAttribute(oProp[i], me.TMX_TAG_NAME);
					var value = me.mapReader.TMXParser.getStringAttribute(oProp[i], me.TMX_TAG_VALUE);
					// set the value
					obj[propname] = setTMXValue(value);
							
				}
			}

		};
		
		/**
		 * Apply TMX Properties to the give object
		 * @ignore
		 */
		api.applyTMXPropertiesFromJSON = function(obj, data) {
			var properties = data[me.TMX_TAG_PROPERTIES];
            if (properties && data[me.TMX_TAG_PROPERTIES]["property"] ) {
                // XML converted format
                data[me.TMX_TAG_PROPERTIES]["property"].forEach(function(property) {
                    // value are already converted in this case
                    obj[property.name] = property.value;
				});
			} else if (properties) { // native json format
				for(var name in properties){
					if (properties.hasOwnProperty(name)) {
						// set the value
						obj[name] = setTMXValue(properties[name]);
					}
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
