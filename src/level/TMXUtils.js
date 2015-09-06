/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2015, Olivier Biot, Jason Oster, Aaron McLeod
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
        function setTMXValue(name, value) {
            if (typeof(value) !== "string") {
                // Value is already normalized
                return value;
            }

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
                    throw new me.Error("Unable to parse JSON: " + match);
                }
            }

            // normalize values
            if (name.search(/^(ratio|anchorPoint)$/) === 0) {
                // convert number to vector
                if (typeof(value) === "number") {
                    value = {
                        "x" : value,
                        "y" : value
                    };
                }
            }

            // return the interpreted value
            return value;
        }

        function parseAttributes(obj, elt) {
            // do attributes
            if (elt.attributes && elt.attributes.length > 0) {
                for (var j = 0; j < elt.attributes.length; j++) {
                    var attribute = elt.attributes.item(j);
                    if (typeof(attribute.name) !== "undefined") {
                        // DOM4 (Attr no longer inherit from Node)
                        obj[attribute.name] = attribute.value;
                    } else {
                        // else use the deprecated ones
                        obj[attribute.nodeName] = attribute.nodeValue;
                    }
                }
            }
        }

        /**
         * Normalize TMX format to Tiled JSON format
         * @ignore
         */
        api.normalize = function (obj, item) {
            var nodeName = item.nodeName;

            switch (nodeName) {
                case "data":
                    var data = api.parse(item);
                    var compression = data.compression || "none";

                    switch (data.encoding) {
                        case "csv":
                            obj.data = me.utils.decodeCSV(data.text);
                            break;

                        case "base64":
                            var decoded = me.utils.decodeBase64AsArray(data.text, 4);
                            obj.data = (
                                (compression === "none") ?
                                decoded :
                                me.utils.decompress(decoded, compression)
                            );
                            break;

                        default:
                            throw new me.Error("Unknown layer encoding: " + data.encoding);
                    }
                    break;

                case "imagelayer":
                case "layer":
                case "objectgroup":
                    var layer = api.parse(item);
                    layer.type = (nodeName === "layer" ? "tilelayer" : nodeName);
                    if (layer.image) {
                        layer.image = layer.image.source;
                    }

                    obj.layers = obj.layers || [];
                    obj.layers.push(layer);
                    break;

                case "animation":
                    obj.animation = api.parse(item).frames;
                    break;

                case "frame":
                case "object":
                    var name = nodeName + "s";
                    obj[name] = obj[name] || [];
                    obj[name].push(api.parse(item));
                    break;

                case "tile":
                    var tile = api.parse(item);
                    obj.tiles = obj.tiles || {};
                    obj.tiles[tile.id] = tile;
                    break;

                case "tileset":
                    var tileset = api.parse(item);
                    if (tileset.image) {
                        tileset.imagewidth = tileset.image.width;
                        tileset.imageheight = tileset.image.height;
                        tileset.image = tileset.image.source;
                    }

                    obj.tilesets = obj.tilesets || [];
                    obj.tilesets.push(tileset);
                    break;

                case "polygon":
                case "polyline":
                    obj[nodeName] = [];

                    // Get a point array
                    var points = api.parse(item).points.split(" ");

                    // And normalize them into an array of vectors
                    for (var i = 0, v; i < points.length; i++) {
                        v = points[i].split(",");
                        obj[nodeName].push({
                            "x" : +v[0],
                            "y" : +v[1]
                        });
                    }

                    break;

                case "properties":
                    obj.properties = api.parse(item);
                    break;

                case "property":
                    var property = api.parse(item);
                    obj[property.name] = setTMXValue(property.name, property.value);
                    break;

                default:
                    obj[nodeName] = api.parse(item);
                    break;
            }
        };

        /**
         * Parse a XML TMX object and returns the corresponding javascript object
         * @ignore
         */
        api.parse = function (xml) {
            // Create the return object
            var obj = {};

            var text = "";

            if (xml.nodeType === 1) {
                // do attributes
                parseAttributes(obj, xml);
            }

            // do children
            if (xml.hasChildNodes()) {
                for (var i = 0; i < xml.childNodes.length; i++) {
                    var item = xml.childNodes.item(i);

                    switch (item.nodeType) {
                        case 1:
                            api.normalize(obj, item);
                            break;

                        case 3:
                            text += item.nodeValue.trim();
                            break;
                    }
                }
            }

            if (text) {
                obj.text = text;
            }

            return obj;
        };

        /**
         * Apply TMX Properties to the given object
         * @ignore
         */
        api.applyTMXProperties = function (obj, data) {
            var properties = data.properties;
            if (typeof(properties) !== "undefined") {
                for (var name in properties) {
                    if (properties.hasOwnProperty(name)) {
                        // set the value
                        obj[name] = setTMXValue(name, properties[name]);
                    }
                }
            }
        };

        // return our object
        return api;
    })();
})();
