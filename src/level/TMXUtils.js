/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 * Tile QT 0.7.x format
 * http://www.mapeditor.org/
 *
 */
(function () {
    /**
     * a collection of TMX utility Function
     * @final
     * @memberOf me
     * @ignore
     */
    me.TMXUtils = (function () {
        /*
         * PUBLIC
         */

        // hold public stuff in our singleton
        var api = {};

        /**
         * set and interpret a TMX property value
         * @ignore
         */
        function setTMXValue(value) {
            if (!value || value.isBoolean()) {
                // if value not defined or boolean
                value = value ? (value === "true") : true;
            }
            else if (value.isNumeric()) {
                // check if numeric
                value = Number(value);
            }
            else if (value.match(/^json:/i)) {
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

        var parseAttributes = function (obj, elt) {
            // do attributes
            if (elt.attributes && elt.attributes.length > 0) {
                for (var j = 0; j < elt.attributes.length; j++) {
                    var attribute = elt.attributes.item(j);
                    if (typeof(attribute.name) !== "undefined") {
                        // DOM4 (Attr no longer inherit from Node)
                        obj[attribute.name] = setTMXValue(attribute.value);
                    } else {
                        // else use the deprecated ones
                        obj[attribute.nodeName] = setTMXValue(attribute.nodeValue);
                    }
                }
            }
        };

        /**
         * Parse a XML TMX object and returns the corresponding javascript object
         * @ignore
         */
        api.parse = function (xml, draworder) {
            // Create the return object
            var obj = {};

            // temporary cache value for concatenated #text element
            var cacheValue = "";

            // make sure draworder is defined
            // note: `draworder` is a new object property in next coming version of Tiled
            draworder = draworder || 1;

            if (xml.nodeType === 1) {
                // do attributes
                parseAttributes(obj, xml);
            }

            // do children
            if (xml.hasChildNodes()) {
                for (var i = 0; i < xml.childNodes.length; i++) {
                    var item = xml.childNodes.item(i);
                    var nodeName = item.nodeName;

                    if (typeof(obj[nodeName]) === "undefined") {
                        if (item.nodeType === 3) {
                            /* nodeType is "Text"  */
                            var value = item.nodeValue.trim();
                            if (value && value.length > 0) {
                                cacheValue += value;
                            }
                        }
                        else if (item.nodeType === 1) {
                            /* nodeType is "Element" */
                            obj[nodeName] =  me.TMXUtils.parse(item, draworder);
                            obj[nodeName]._draworder = draworder++;
                        }
                    }
                    else {
                        if (Array.isArray(obj[nodeName]) === false) {
                            obj[nodeName] = [obj[nodeName]];
                        }
                        obj[nodeName].push(me.TMXUtils.parse(item, draworder));
                        obj[nodeName][obj[nodeName].length - 1]._draworder = draworder++;
                    }
                }
                // set concatenated string value
                // cheap hack that will only probably work with the TMX format
                if (cacheValue.length > 0) {
                    obj.value = cacheValue;
                    cacheValue = "";
                }
            }
            return obj;
        };

        /**
         * Apply TMX Properties to the given object
         * @ignore
         */
        api.applyTMXProperties = function (obj, data) {
            var properties = data[me.TMX_TAG_PROPERTIES];
            if (typeof(properties) !== "undefined") {
                if (typeof(properties.property) !== "undefined") {
                    // XML converted format
                    var property = properties.property;
                    if (Array.isArray(property) === true) {
                        property.forEach(function (prop) {
                            // value are already converted in this case
                            obj[prop.name] = prop.value;
                        });
                    }
                    else {
                        // value are already converted in this case
                        obj[property.name] = property.value;
                    }
                }
                else {
                    // native json format
                    for (var name in properties) {
                        if (properties.hasOwnProperty(name)) {
                            // set the value
                            obj[name] = setTMXValue(properties[name]);
                        }
                    }
                }
            }
        };

        // return our object
        return api;
    })();
})();
