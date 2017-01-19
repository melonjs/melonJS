/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
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
        function setTMXValue(name, type, value) {
            var match;

            if (typeof(value) !== "string") {
                // Value is already normalized (e.g. with JSON maps)
                return value;
            }

            switch (type) {

                case "int" :
                case "float" :
                    value = Number(value);
                    break;

                case "bool" :
                    value = (value === "true");
                    break;

                default :
                    // try to parse it anyway
                    if (!value || value.isBoolean()) {
                        // if value not defined or boolean
                        value = value ? (value === "true") : true;
                    }
                    else if (value.isNumeric()) {
                        // check if numeric
                        value = Number(value);
                    }
                    else if (value.search(/^json:/i) === 0) {
                        // try to parse it
                        match = value.split(/^json:/i)[1];
                        try {
                            value = JSON.parse(match);
                        }
                        catch (e) {
                            throw new me.Error("Unable to parse JSON: " + match);
                        }
                    }
                    else if (value.search(/^eval:/i) === 0) {
                        // try to evaluate it
                        match = value.split(/^eval:/i)[1];
                        try {
                            // eslint-disable-next-line
                            value = eval(match);
                        }
                        catch (e) {
                            throw new me.Error("Unable to evaluate: " + match);
                        }
                    }
                    else if (
                        ((match = value.match(/^#([\da-fA-F])([\da-fA-F]{3})$/))) ||
                        ((match = value.match(/^#([\da-fA-F]{2})([\da-fA-F]{6})$/)))
                    ) {
                        value = "#" + match[2] + match[1];
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
        * Decode the given data
        * @ignore
        */
        api.decode = function (data, encoding, compression) {
            compression = compression || "none";
            encoding = encoding || "none";

            switch (encoding) {
                case "csv":
                    return me.utils.decodeCSV(data);

                case "base64":
                    var decoded = me.utils.decodeBase64AsArray(data, 4);
                    return (
                        (compression === "none") ?
                        decoded :
                        me.utils.decompress(decoded, compression)
                    );

                case "none":
                    return data;

                case "xml":
                    throw new me.Error("XML encoding is deprecated, use base64 instead");

                default:
                    throw new me.Error("Unknown layer encoding: " + encoding);
            }
        };

        /**
         * Normalize TMX format to Tiled JSON format
         * @ignore
         */
        api.normalize = function (obj, item) {
            var nodeName = item.nodeName;

            switch (nodeName) {
                case "data":
                    var data = api.parse(item);
                    // When no encoding is given, the tiles are stored as individual XML tile elements.
                    data.encoding = data.encoding || "xml";
                    obj.data = api.decode(data.text, data.encoding, data.compression);
                    obj.encoding = "none";
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
                    obj[property.name] = setTMXValue(
                        property.name,
                        // in XML type is undefined for "string" values
                        property.type || "string",
                        property.value
                    );
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
            var types = data.propertytypes;
            if (typeof(properties) !== "undefined") {
                for (var name in properties) {
                    if (properties.hasOwnProperty(name)) {
                        var type = "string";
                        if (typeof(types) !== "undefined") {
                            type = types[name];
                        }
                        // set the value
                        obj[name] = setTMXValue(name, type, properties[name]);
                    }
                }
            }
        };

        // return our object
        return api;
    })();
})();
