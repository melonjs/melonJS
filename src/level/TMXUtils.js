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
        /*--- PUBLIC ---*/
        // hold public stuff in our singleton
        var api = {};
        
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
    
        var parseAttributes = function(obj, elt) {
            // do attributes
            if (elt.attributes && elt.attributes.length > 0) {
                for (var j = 0; j < elt.attributes.length; j++) {
                    var attribute = elt.attributes.item(j);
                    obj[attribute.nodeName] = setTMXValue(attribute.nodeValue);
                }
            }    
        };


         /**
         * Parse a XML TMX object and returns the corresponding javascript object
         * @ignore
         */
        api.parse = function (xml) {
            
            // Create the return object
            var obj = {};
            
            // element
            if (xml.nodeType === 1 ) { 
                // do attributes
                parseAttributes (obj, xml);
            } else if (xml.nodeType === 3) {
                // text node
                obj = xml.nodeValue.trim();
            }

            // do children
            if (xml.hasChildNodes()) {
                for(var i = 0; i < xml.childNodes.length; i++) {
                    var item = xml.childNodes.item(i);
                    var nodeName = item.nodeName;
                    
                    if (typeof(obj[nodeName]) === "undefined") {
                        if (nodeName === '#text') {
                            /* ignore empty text nodes */
                            continue;
                        } else if (item.childNodes.length === 1 && item.firstChild.nodeName === '#text'){
                            // TODO :  manage multi node value for data element
                            /*
                            // Merge all childNodes[].nodeValue into a single one
                            var nodeValue = '';
                            for ( var i = 0, len = data.childNodes.length; i < len; i++) {
                                nodeValue += data.childNodes[i].nodeValue;
                            }
                            */
                            obj[nodeName] = item.firstChild.nodeValue.trim();
                            // apply attributes on the parent object since this is a text node
                            parseAttributes (obj, item);
                        } else {
                            obj[nodeName] =  me.TMXUtils.parse(item);
                        }
                    } else {
                        if (typeof(obj[nodeName].push) === "undefined") {
                            var old = obj[nodeName];
                            
                            obj[nodeName] = [];
                            
                            obj[nodeName].push(old);
                        }
                        obj[nodeName].push(me.TMXUtils.parse(item));
                    }
                }
            }
            return obj;
        };
        
        /**
         * Apply TMX Properties to the give object
         * @ignore
         */
        api.applyTMXPropertiesFromJSON = function(obj, data) {
            var properties = data[me.TMX_TAG_PROPERTIES];
            if (properties && data[me.TMX_TAG_PROPERTIES]["property"] ) {
                // XML converted format
                var property = data[me.TMX_TAG_PROPERTIES]["property"];
                if (Array.isArray(property) === true) {
                    property.forEach(function(prop) {
                        // value are already converted in this case
                        obj[prop.name] = prop.value;
                    });
                } else {
                    // value are already converted in this case
                    obj[property.name] = property.value;
                }
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

})(window);
