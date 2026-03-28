import { ellipsePool } from "../../geometries/ellipse.ts";
import { linePool } from "../../geometries/line.ts";
import { pointPool } from "../../geometries/point.ts";
import { polygonPool } from "../../geometries/polygon.ts";
import { roundedRectanglePool } from "../../geometries/roundrect.ts";
import { degToRad } from "./../../math/math.ts";
import { vector2dPool } from "../../math/vector2d.ts";
import Tile from "./TMXTile.js";
import { applyTMXProperties } from "./TMXUtils.js";

/**
 * Detect the shape type from the TMX object settings.
 * Shape markers are mutually exclusive; the first match wins.
 * @param {object} settings - TMX object settings
 * @returns {string} one of "ellipse", "capsule", "point", "polygon", "polyline", "rectangle"
 * @ignore
 */
function detectShape(settings) {
	if (typeof settings.ellipse !== "undefined") {
		return "ellipse";
	}
	if (typeof settings.capsule !== "undefined") {
		return "capsule";
	}
	if (typeof settings.point !== "undefined") {
		return "point";
	}
	if (typeof settings.polygon !== "undefined") {
		return "polygon";
	}
	if (typeof settings.polyline !== "undefined") {
		return "polyline";
	}
	return "rectangle";
}

/**
 * a TMX Object defintion, as defined in Tiled
 * (Object definition is translated into the virtual `me.game.world` using `me.Renderable`)
 * @ignore
 */
export default class TMXObject {
	constructor(map, settings, z) {
		/**
		 * point list in JSON format
		 * @type {object[]}
		 */
		this.points = undefined;

		/**
		 * object name
		 * @type {string}
		 */
		this.name = settings.name;

		/**
		 * object x position
		 * @type {number}
		 */
		this.x = +settings.x;

		/**
		 * object y position
		 * @type {number}
		 */
		this.y = +settings.y;

		/**
		 * object z order
		 * @type {number}
		 */
		this.z = +z;

		/**
		 * object width
		 * @type {number}
		 */
		this.width = +settings.width || 0;

		/**
		 * object height
		 * @type {number}
		 */
		this.height = +settings.height || 0;

		/**
		 * object gid value
		 * when defined the object is a tiled object
		 * @type {number}
		 */
		this.gid = +settings.gid || null;

		/**
		 * tint color
		 * @type {string}
		 */
		this.tintcolor = settings.tintcolor;

		/**
		 * object type
		 * @type {string}
		 * @deprecated since Tiled 1.9
		 * @see {@link https://docs.mapeditor.org/en/stable/reference/tmx-changelog/#tiled-1-9}
		 */
		this.type = settings.type;

		/**
		 * the object class
		 * @type {string}
		 */
		this.class = settings.class ?? settings.type;

		/**
		 * object text
		 * @type {object}
		 * @see {@link http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#text}
		 */
		this.text = undefined;

		/**
		 * The rotation of the object in radians clockwise (defaults to 0)
		 * @type {number}
		 */
		this.rotation = degToRad(+settings.rotation || 0);

		/**
		 * the object opacity (0-1), defaults to 1 (since Tiled 1.12)
		 * @type {number}
		 */
		this.opacity = +(settings.opacity ?? 1);

		/**
		 * whether the object is visible, defaults to true
		 * @type {boolean}
		 */
		this.visible = +(settings.visible ?? 1) !== 0;

		/**
		 * object unique identifier per level (Tiled 0.11.x+)
		 * @type {number}
		 */
		this.id = +settings.id || undefined;

		/**
		 * object orientation (orthogonal or isometric)
		 * @type {string}
		 */
		this.orientation = map.orientation;

		/**
		 * the collision shapes defined for this object
		 * @type {object[]}
		 */
		this.shapes = undefined;

		/**
		 * the detected shape type
		 * @type {string}
		 */
		this.shapeType = "rectangle";

		// detect shape type and store points for polygon/polyline
		if (typeof this.gid === "number") {
			this.setTile(map.tilesets);
		} else {
			this.shapeType = detectShape(settings);
			if (this.shapeType === "polygon" || this.shapeType === "polyline") {
				this.points = settings[this.shapeType];
			}
		}

		// backward-compatible boolean flags
		/** @type {boolean} */
		this.isEllipse = this.shapeType === "ellipse";
		/** @type {boolean} */
		this.isCapsule = this.shapeType === "capsule";
		/** @type {boolean} */
		this.isPoint = this.shapeType === "point";
		/** @type {boolean} */
		this.isPolygon = this.shapeType === "polygon";
		/** @type {boolean} */
		this.isPolyLine = this.shapeType === "polyline";

		// check for text information
		if (typeof settings.text !== "undefined") {
			this.text = settings.text;
			this.text.font = settings.text.fontfamily || "sans-serif";
			this.text.size = settings.text.pixelsize || 16;
			this.text.fillStyle = settings.text.color || "#000000";
			this.text.textAlign = settings.text.halign || "left";
			this.text.textBaseline = settings.text.valign || "top";
			this.text.width = this.width;
			this.text.height = this.height;
			applyTMXProperties(this.text, settings);
		} else {
			applyTMXProperties(this, settings);
			if (!this.shapes) {
				this.shapes = this.parseTMXShapes();
			}
		}

		// Adjust the Position to match Tiled
		if (!map.isEditor) {
			map.getRenderer().adjustPosition(this);
		}
	}

	/**
	 * set the object image (for Tiled Object)
	 * @ignore
	 */
	setTile(tilesets) {
		const tileset = tilesets.getTilesetByGid(this.gid);

		if (tileset.isCollection === false) {
			this.width = this.framewidth = tileset.tilewidth;
			this.height = this.frameheight = tileset.tileheight;
		}

		this.tile = new Tile(this.x, this.y, this.gid, tileset);
	}

	/**
	 * parses the TMX shape definition and returns a corresponding array of shape objects
	 * @private
	 * @returns {Polygon[]|Line[]|Ellipse[]|RoundRect[]} an array of shape objects
	 */
	parseTMXShapes() {
		const shapes = [];

		switch (this.shapeType) {
			case "ellipse":
				shapes.push(
					ellipsePool
						.get(this.width / 2, this.height / 2, this.width, this.height)
						.rotate(this.rotation),
				);
				break;

			case "capsule": {
				const radius = Math.min(this.width, this.height) / 2;
				shapes.push(
					roundedRectanglePool
						.get(0, 0, this.width, this.height, radius)
						.rotate(this.rotation),
				);
				break;
			}

			case "point":
				shapes.push(pointPool.get(this.x, this.y));
				break;

			case "polygon": {
				const polygon = polygonPool.get(0, 0, this.points);
				const isConvex = polygon.isConvex();

				if (isConvex === true) {
					shapes.push(polygon.rotate(this.rotation));
				} else if (isConvex === false) {
					// decompose concave polygon into convex triangles
					console.warn(
						"melonJS: concave collision polygon detected, decomposing into convex triangles",
					);
					const indices = polygon.getIndices();
					const pts = polygon.points;
					for (let t = 0; t < indices.length; t += 3) {
						shapes.push(
							polygonPool
								.get(0, 0, [
									vector2dPool.get(pts[indices[t]].x, pts[indices[t]].y),
									vector2dPool.get(
										pts[indices[t + 1]].x,
										pts[indices[t + 1]].y,
									),
									vector2dPool.get(
										pts[indices[t + 2]].x,
										pts[indices[t + 2]].y,
									),
								])
								.rotate(this.rotation),
						);
					}
					polygonPool.release(polygon);
				} else {
					console.warn("melonJS: invalid polygon definition, skipping");
					polygonPool.release(polygon);
				}
				break;
			}

			case "polyline": {
				const p = this.points;
				for (let i = 0, len = p.length - 1; i < len; i++) {
					let p1 = vector2dPool.get(p[i].x, p[i].y);
					let p2 = vector2dPool.get(p[i + 1].x, p[i + 1].y);
					if (this.rotation !== 0) {
						p1 = p1.rotate(this.rotation);
						p2 = p2.rotate(this.rotation);
					}
					shapes.push(linePool.get(0, 0, [p1, p2]));
				}
				break;
			}

			default:
				// rectangle — returns a polygon
				shapes.push(
					polygonPool
						.get(0, 0, [
							vector2dPool.get(),
							vector2dPool.get(this.width, 0),
							vector2dPool.get(this.width, this.height),
							vector2dPool.get(0, this.height),
						])
						.rotate(this.rotation),
				);
				break;
		}

		// Apply isometric projection
		if (this.orientation === "isometric") {
			for (let i = 0; i < shapes.length; i++) {
				if (typeof shapes[i].toIso === "function") {
					shapes[i].toIso();
				}
			}
		}

		return shapes;
	}

	/**
	 * getObjectPropertyByName
	 * @ignore
	 */
	getObjectPropertyByName(name) {
		return this[name];
	}
}
