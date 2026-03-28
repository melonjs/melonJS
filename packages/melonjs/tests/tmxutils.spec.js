import { describe, expect, it } from "vitest";
import {
	applyTMXProperties,
	cacheEmbeddedImage,
	decode,
	parse,
	resolveEmbeddedImage,
	setInflateFunction,
	tiledBlendMode,
} from "../src/level/tiled/TMXUtils.js";
import { imgList } from "../src/loader/cache.js";
import { decodeBase64Image } from "../src/utils/decode.ts";

describe("TMXUtils", () => {
	// ---------------------------------------------------------------
	// decode  (csv / base64 / none / error paths)
	// ---------------------------------------------------------------
	describe("decode", () => {
		// --- CSV encoding (exercises internal decodeCSV) ---
		describe("csv encoding", () => {
			it("decodes a simple CSV string", () => {
				expect(decode("1,2,3", "csv")).toEqual([1, 2, 3]);
			});

			it("handles spaces around values", () => {
				expect(decode("1, 2, 3", "csv")).toEqual([1, 2, 3]);
				expect(decode("  1 ,  2 ,  3  ", "csv")).toEqual([1, 2, 3]);
			});

			it("returns NaN for non-numeric entries", () => {
				const result = decode("1, foo, 3", "csv");
				expect(result[0]).toBe(1);
				expect(result[2]).toBe(3);
				expect(Number.isNaN(result[1])).toBe(true);
			});

			it("handles trailing comma", () => {
				const result = decode("1,2,", "csv");
				expect(result[0]).toBe(1);
				expect(result[1]).toBe(2);
				// trailing comma produces an empty string entry → +"" = 0
				expect(result[2]).toBe(0);
			});
		});

		// --- base64 encoding (exercises internal decodeBase64AsArray) ---
		describe("base64 encoding", () => {
			it("decodes base64 to Uint32Array", () => {
				// Encode 4 bytes [1, 0, 0, 0] (little-endian uint32 = 1)
				// followed by [2, 0, 0, 0] (little-endian uint32 = 2)
				const bytes = new Uint8Array([1, 0, 0, 0, 2, 0, 0, 0]);
				const b64 = btoa(String.fromCharCode(...bytes));
				const result = decode(b64, "base64");
				expect(result).toBeInstanceOf(Uint32Array);
				expect(result[0]).toBe(1);
				expect(result[1]).toBe(2);
			});

			it("ignores whitespace in base64 input", () => {
				const bytes = new Uint8Array([3, 0, 0, 0]);
				const b64 = btoa(String.fromCharCode(...bytes));
				// add newlines/spaces
				const result = decode("  " + b64 + "\n", "base64");
				expect(result[0]).toBe(3);
			});
		});

		// --- none encoding ---
		it("returns data as-is with 'none' encoding", () => {
			const data = [1, 2, 3];
			expect(decode(data, "none")).toBe(data);
		});

		it("defaults to 'none' when encoding is omitted", () => {
			const data = [5, 6];
			expect(decode(data)).toBe(data);
		});

		// --- error paths ---
		it("throws on xml encoding", () => {
			expect(() => {
				return decode("", "xml");
			}).toThrow("XML encoding is deprecated");
		});

		it("throws on unknown encoding", () => {
			expect(() => {
				return decode("", "bogus");
			}).toThrow("Unknown layer encoding");
		});

		// --- compressed base64 ---
		it("calls the inflate function for compressed base64", () => {
			const fakeResult = new Uint32Array([42]);
			setInflateFunction((data, format) => {
				expect(format).toBe("zlib");
				return fakeResult;
			});
			const result = decode("AAAA", "base64", "zlib");
			expect(result).toBe(fakeResult);
			// reset
			setInflateFunction(undefined);
		});

		it("throws when no inflate function is set for compressed data", () => {
			setInflateFunction(undefined);
			expect(() => {
				return decode("AAAA", "base64", "zlib");
			}).toThrow("decompression not supported");
		});
	});

	// ---------------------------------------------------------------
	// parse  (XML → JS object)
	// ---------------------------------------------------------------
	describe("parse", () => {
		function parseXML(str) {
			return new DOMParser().parseFromString(str, "text/xml").documentElement;
		}

		it("parses element attributes", () => {
			const xml = parseXML('<tileset firstgid="1" name="ground"/>');
			const obj = parse(xml);
			expect(obj.firstgid).toBe("1");
			expect(obj.name).toBe("ground");
		});

		it("parses text content", () => {
			const xml = parseXML("<data>1,2,3</data>");
			const obj = parse(xml);
			expect(obj.text).toBe("1,2,3");
		});

		it("parses nested layer element", () => {
			const xml = parseXML(
				"<map>" +
					'<layer name="bg" width="10" height="10">' +
					'<data encoding="csv">1,2</data>' +
					"</layer>" +
					"</map>",
			);
			const obj = parse(xml);
			expect(obj.layers).toBeDefined();
			expect(obj.layers.length).toBe(1);
			expect(obj.layers[0].name).toBe("bg");
			expect(obj.layers[0].type).toBe("tilelayer");
			// data with csv encoding should be decoded
			expect(obj.layers[0].data).toEqual([1, 2]);
			expect(obj.layers[0].encoding).toBe("none");
		});

		it("parses objectgroup layer", () => {
			const xml = parseXML(
				"<map>" +
					'<objectgroup name="objects">' +
					'<object id="1" x="10" y="20"/>' +
					"</objectgroup>" +
					"</map>",
			);
			const obj = parse(xml);
			expect(obj.layers).toBeDefined();
			expect(obj.layers[0].type).toBe("objectgroup");
			expect(obj.layers[0].objects).toBeDefined();
			expect(obj.layers[0].objects[0].id).toBe("1");
		});

		it("parses tileset with image child", () => {
			const xml = parseXML(
				"<map>" +
					'<tileset firstgid="1" name="tiles">' +
					'<image source="tiles.png" width="256" height="256"/>' +
					"</tileset>" +
					"</map>",
			);
			const obj = parse(xml);
			expect(obj.tilesets).toBeDefined();
			expect(obj.tilesets[0].image).toBe("tiles.png");
			expect(obj.tilesets[0].imagewidth).toBe("256");
			expect(obj.tilesets[0].imageheight).toBe("256");
		});

		it("parses properties", () => {
			const xml = parseXML(
				"<map>" +
					"<properties>" +
					'<property name="Author" value="Test"/>' +
					'<property name="Year" value="2024"/>' +
					"</properties>" +
					"</map>",
			);
			const obj = parse(xml);
			expect(obj.properties).toBeDefined();
			expect(obj.properties.Author).toBe("Test");
			// Year is numeric string → setTMXValue converts to number
			expect(obj.properties.Year).toBe(2024);
		});

		it("parses polygon points", () => {
			const xml = parseXML(
				"<object>" + '<polygon points="0,0 32,0 32,32 0,32"/>' + "</object>",
			);
			const obj = parse(xml);
			expect(obj.polygon).toEqual([
				{ x: 0, y: 0 },
				{ x: 32, y: 0 },
				{ x: 32, y: 32 },
				{ x: 0, y: 32 },
			]);
		});

		it("parses polyline points", () => {
			const xml = parseXML(
				"<object>" + '<polyline points="0,0 16,16"/>' + "</object>",
			);
			const obj = parse(xml);
			expect(obj.polyline).toEqual([
				{ x: 0, y: 0 },
				{ x: 16, y: 16 },
			]);
		});

		it("parses tile with image", () => {
			const xml = parseXML(
				"<tileset>" +
					'<tile id="0">' +
					'<image source="tile0.png" width="32" height="32"/>' +
					"</tile>" +
					"</tileset>",
			);
			const obj = parse(xml);
			expect(obj.tiles).toBeDefined();
			expect(obj.tiles["0"].image).toBe("tile0.png");
			expect(obj.tiles["0"].imagewidth).toBe("32");
		});

		it("parses animation frames", () => {
			const xml = parseXML(
				"<tile>" +
					"<animation>" +
					'<frame tileid="0" duration="100"/>' +
					'<frame tileid="1" duration="100"/>' +
					"</animation>" +
					"</tile>",
			);
			const obj = parse(xml);
			expect(obj.animation).toBeDefined();
			expect(obj.animation.length).toBe(2);
			expect(obj.animation[0].tileid).toBe("0");
			expect(obj.animation[0].duration).toBe("100");
		});

		it("parses base64 encoded layer data", () => {
			// encode two tiles: tile id 1 and tile id 2 as little-endian uint32
			const bytes = new Uint8Array([1, 0, 0, 0, 2, 0, 0, 0]);
			const b64 = btoa(String.fromCharCode(...bytes));
			const xml = parseXML(
				"<map>" +
					'<layer name="test" width="2" height="1">' +
					'<data encoding="base64">' +
					b64 +
					"</data>" +
					"</layer>" +
					"</map>",
			);
			const obj = parse(xml);
			expect(obj.layers[0].data[0]).toBe(1);
			expect(obj.layers[0].data[1]).toBe(2);
		});

		it("handles a Document node (as used by the TMX loader)", () => {
			// tmx.js passes the full Document (nodeType 9) to parse(), not documentElement
			const doc = new DOMParser().parseFromString(
				'<map version="1.0">' +
					'<layer name="ground" width="2" height="1">' +
					'<data encoding="csv">5,6</data>' +
					"</layer>" +
					"</map>",
				"text/xml",
			);
			// pass the Document directly, not .documentElement
			const obj = parse(doc);
			expect(obj.map).toBeDefined();
			expect(obj.map.version).toBe("1.0");
			expect(obj.map.layers).toBeDefined();
			expect(obj.map.layers[0].name).toBe("ground");
			expect(obj.map.layers[0].data).toEqual([5, 6]);
		});
	});

	// ---------------------------------------------------------------
	// decode  (JSON layer data path — encoding "none")
	// ---------------------------------------------------------------
	describe("decode for JSON maps", () => {
		it("passes through array data with 'none' encoding (JSON layer data)", () => {
			// In JSON maps, layer data is already a numeric array
			// and encoding is absent or explicitly "none"
			const tileData = [1, 2, 3, 0, 0, 4, 5, 6];
			expect(decode(tileData, "none")).toBe(tileData);
			expect(decode(tileData)).toBe(tileData);
		});
	});

	// ---------------------------------------------------------------
	// applyTMXProperties  (exercises setTMXValue internally)
	// ---------------------------------------------------------------
	describe("applyTMXProperties", () => {
		// --- old JSON format (flat key-value with separate propertytypes) ---
		describe("old JSON format (propertytypes)", () => {
			it("applies string properties", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: { name: "hello" },
					propertytypes: { name: "string" },
				});
				expect(obj.name).toBe("hello");
			});

			it("applies int properties", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: { count: "42" },
					propertytypes: { count: "int" },
				});
				expect(obj.count).toBe(42);
			});

			it("applies float properties", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: { speed: "3.14" },
					propertytypes: { speed: "float" },
				});
				expect(obj.speed).toBeCloseTo(3.14);
			});

			it("applies bool properties", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: { visible: "true", hidden: "false" },
					propertytypes: { visible: "bool", hidden: "bool" },
				});
				expect(obj.visible).toBe(true);
				expect(obj.hidden).toBe(false);
			});
		});

		// --- new JSON format (array of {name, type, value}) ---
		describe("new JSON format (array of {name, type, value})", () => {
			it("applies typed properties from array", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [
						{ name: "hp", type: "int", value: "100" },
						{ name: "label", type: "string", value: "hero" },
					],
				});
				expect(obj.hp).toBe(100);
				expect(obj.label).toBe("hero");
			});

			it("applies bool property with native boolean value", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [{ name: "Waves", type: "bool", value: true }],
				});
				expect(obj.Waves).toBe(true);
			});

			it("applies float property from array", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [{ name: "speed", type: "float", value: "2.5" }],
				});
				expect(obj.speed).toBeCloseTo(2.5);
			});

			it("applies json: anchorPoint from string property", () => {
				// matches real Tiled map format from map1.json
				const obj = {};
				applyTMXProperties(obj, {
					properties: [
						{
							name: "anchorPoint",
							type: "string",
							value: 'json:{"x":0,"y":1}',
						},
						{ name: "ratio", type: "string", value: "0.25" },
						{ name: "repeat", type: "string", value: "repeat-x" },
					],
				});
				expect(obj.anchorPoint).toEqual({ x: 0, y: 1 });
				expect(obj.ratio).toEqual({ x: 0.25, y: 0.25 });
				expect(obj.repeat).toBe("repeat-x");
			});

			it("applies color property from array", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [{ name: "fade", type: "string", value: "#fff" }],
				});
				expect(obj.fade).toBe("#fff");
			});
		});

		// --- setTMXValue special cases (tested through applyTMXProperties) ---
		describe("setTMXValue edge cases", () => {
			it("auto-detects boolean strings without explicit type", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: { flag: "true" },
				});
				expect(obj.flag).toBe(true);
			});

			it("auto-detects numeric strings without explicit type", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: { score: "999" },
				});
				expect(obj.score).toBe(999);
			});

			it("parses json: prefixed values", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: { data: 'json:{"a":1}' },
				});
				expect(obj.data).toEqual({ a: 1 });
			});

			it("throws on invalid json: values", () => {
				expect(() => {
					const obj = {};
					applyTMXProperties(obj, {
						properties: { data: "json:{invalid" },
					});
				}).toThrow("Unable to parse JSON");
			});

			it("evaluates eval: prefixed values", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: { computed: "eval:2+3" },
				});
				expect(obj.computed).toBe(5);
			});

			it("throws on invalid eval: values", () => {
				expect(() => {
					const obj = {};
					applyTMXProperties(obj, {
						properties: { computed: "eval:@@@" },
					});
				}).toThrow("Unable to evaluate");
			});

			it("converts #ARGB color to #RGBA", () => {
				const obj = {};
				// Tiled stores colors as #AARRGGBB, setTMXValue swaps to #RRGGBBAA
				applyTMXProperties(obj, {
					properties: { color: "#FF112233" },
				});
				expect(obj.color).toBe("#112233FF");
			});

			it("converts short #ARGB color to #RGBA", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: { tint: "#Fabc" },
				});
				expect(obj.tint).toBe("#abcF");
			});

			it("converts ratio name to vector", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: { ratio: "0.5" },
				});
				expect(obj.ratio).toEqual({ x: 0.5, y: 0.5 });
			});

			it("converts anchorPoint name to vector", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: { anchorPoint: "0.5" },
				});
				expect(obj.anchorPoint).toEqual({ x: 0.5, y: 0.5 });
			});

			it("returns non-string values as-is", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [{ name: "count", type: "int", value: 42 }],
				});
				expect(obj.count).toBe(42);
			});

			it("treats empty/undefined value as true for untyped properties", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: { flag: "" },
				});
				expect(obj.flag).toBe(true);
			});
		});

		it("does nothing when properties are undefined", () => {
			const obj = { existing: 1 };
			applyTMXProperties(obj, {});
			expect(obj).toEqual({ existing: 1 });
		});
	});

	// ---------------------------------------------------------------
	// setInflateFunction
	// ---------------------------------------------------------------
	describe("setInflateFunction", () => {
		it("sets a custom inflate function used by decode", () => {
			const expected = new Uint32Array([99]);
			setInflateFunction(() => {
				return expected;
			});
			const result = decode("AAAA", "base64", "gzip");
			expect(result).toBe(expected);
			// cleanup
			setInflateFunction(undefined);
		});
	});

	// ---------------------------------------------------------------
	// repeatx/repeaty → repeat string mapping
	// ---------------------------------------------------------------
	describe("repeatx/repeaty to repeat string mapping", () => {
		// Helper: mirrors the logic in readImageLayer
		function deriveRepeat(data) {
			const rx = data.repeatx === true || data.repeatx === "1";
			const ry = data.repeaty === true || data.repeaty === "1";
			let repeat = data.properties?.repeat;
			if (typeof repeat === "undefined" && (rx || ry)) {
				if (rx && ry) {
					repeat = "repeat";
				} else if (rx) {
					repeat = "repeat-x";
				} else {
					repeat = "repeat-y";
				}
			}
			return repeat;
		}

		it("should derive repeat-x from JSON boolean repeatx=true", () => {
			expect(deriveRepeat({ repeatx: true })).toEqual("repeat-x");
		});

		it("should derive repeat-y from JSON boolean repeaty=true", () => {
			expect(deriveRepeat({ repeaty: true })).toEqual("repeat-y");
		});

		it("should derive repeat from both JSON booleans", () => {
			expect(deriveRepeat({ repeatx: true, repeaty: true })).toEqual("repeat");
		});

		it('should derive repeat-x from TMX string repeatx="1"', () => {
			expect(deriveRepeat({ repeatx: "1" })).toEqual("repeat-x");
		});

		it('should derive repeat-y from TMX string repeaty="1"', () => {
			expect(deriveRepeat({ repeaty: "1" })).toEqual("repeat-y");
		});

		it('should derive repeat from both TMX strings "1"', () => {
			expect(deriveRepeat({ repeatx: "1", repeaty: "1" })).toEqual("repeat");
		});

		it("should not derive repeat from false/0 values", () => {
			expect(deriveRepeat({ repeatx: false })).toBeUndefined();
			expect(deriveRepeat({ repeatx: "0" })).toBeUndefined();
			expect(deriveRepeat({})).toBeUndefined();
		});

		it("should prefer legacy repeat property over native attributes", () => {
			expect(
				deriveRepeat({
					repeatx: true,
					repeaty: true,
					properties: { repeat: "repeat-x" },
				}),
			).toEqual("repeat-x");
		});

		it("should use native attributes when legacy property is absent", () => {
			expect(
				deriveRepeat({
					repeatx: true,
					repeaty: true,
					properties: {},
				}),
			).toEqual("repeat");
		});
	});

	// ---------------------------------------------------------------
	// parallax origin offset baking
	// ---------------------------------------------------------------
	describe("parallax origin offset baking", () => {
		// Helper: compute parallax position the way ImageLayer.draw does
		function computeParallaxPos(
			offset,
			ratio,
			camPos,
			anchorPoint,
			boundsW,
			viewportW,
		) {
			const ax = anchorPoint;
			const rx = ratio;
			return ax * (rx - 1) * (boundsW - viewportW) + offset - rx * camPos;
		}

		it("baked offset matches explicit parallax origin (ax=0, ratio=0.5)", () => {
			const layerOffset = 100;
			const ratio = 0.5;
			const parallaxOrigin = 400;
			const bakedOffset = layerOffset + parallaxOrigin * ratio;

			// test at various camera positions
			for (const camX of [0, 200, 400, 800]) {
				const explicit = computeParallaxPos(
					layerOffset,
					ratio,
					camX - parallaxOrigin,
					0,
					2000,
					800,
				);
				const baked = computeParallaxPos(
					bakedOffset,
					ratio,
					camX,
					0,
					2000,
					800,
				);
				expect(baked).toBeCloseTo(explicit);
			}
		});

		it("baked offset matches with anchorPoint=1", () => {
			const layerOffset = 50;
			const ratio = 0.25;
			const parallaxOrigin = 300;
			const bakedOffset = layerOffset + parallaxOrigin * ratio;

			for (const camX of [0, 150, 300, 600]) {
				const explicit = computeParallaxPos(
					layerOffset,
					ratio,
					camX - parallaxOrigin,
					1,
					2000,
					800,
				);
				const baked = computeParallaxPos(
					bakedOffset,
					ratio,
					camX,
					1,
					2000,
					800,
				);
				expect(baked).toBeCloseTo(explicit);
			}
		});

		it("baked offset matches with anchorPoint=0.5", () => {
			const layerOffset = 0;
			const ratio = 0.75;
			const parallaxOrigin = 500;
			const bakedOffset = layerOffset + parallaxOrigin * ratio;

			for (const camX of [0, 250, 500, 1000]) {
				const explicit = computeParallaxPos(
					layerOffset,
					ratio,
					camX - parallaxOrigin,
					0.5,
					1500,
					600,
				);
				const baked = computeParallaxPos(
					bakedOffset,
					ratio,
					camX,
					0.5,
					1500,
					600,
				);
				expect(baked).toBeCloseTo(explicit);
			}
		});

		it("baked offset matches on Y-axis (ax=0, ratio=0.5)", () => {
			const layerOffset = 80;
			const ratio = 0.5;
			const parallaxOrigin = 300;
			const bakedOffset = layerOffset + parallaxOrigin * ratio;

			for (const camY of [0, 150, 300, 600]) {
				const explicit = computeParallaxPos(
					layerOffset,
					ratio,
					camY - parallaxOrigin,
					0,
					1500,
					600,
				);
				const baked = computeParallaxPos(
					bakedOffset,
					ratio,
					camY,
					0,
					1500,
					600,
				);
				expect(baked).toBeCloseTo(explicit);
			}
		});

		it("baked offset matches on Y-axis with anchorPoint=1", () => {
			const layerOffset = 200;
			const ratio = 0.75;
			const parallaxOrigin = 400;
			const bakedOffset = layerOffset + parallaxOrigin * ratio;

			for (const camY of [0, 200, 400, 800]) {
				const explicit = computeParallaxPos(
					layerOffset,
					ratio,
					camY - parallaxOrigin,
					1,
					1500,
					600,
				);
				const baked = computeParallaxPos(
					bakedOffset,
					ratio,
					camY,
					1,
					1500,
					600,
				);
				expect(baked).toBeCloseTo(explicit);
			}
		});

		it("zero parallax origin produces unchanged offset", () => {
			const layerOffset = 100;
			const ratio = 0.5;
			const parallaxOrigin = 0;
			const bakedOffset = layerOffset + parallaxOrigin * ratio;
			expect(bakedOffset).toEqual(layerOffset);
		});

		it("parallax origin with ratio=1 adds full origin value", () => {
			const layerOffset = 50;
			const ratio = 1.0;
			const parallaxOrigin = 200;
			const bakedOffset = layerOffset + parallaxOrigin * ratio;
			expect(bakedOffset).toEqual(250);
		});
	});

	// ---------------------------------------------------------------
	// class-type custom properties
	// ---------------------------------------------------------------
	describe("class-type custom properties", () => {
		it("JSON: class property value is preserved as nested object", () => {
			const obj = {};
			const data = {
				properties: [
					{
						name: "config",
						type: "class",
						propertytype: "EnemyConfig",
						value: { health: 100, speed: 2.5, active: true },
					},
				],
			};
			applyTMXProperties(obj, data);
			expect(obj.config).toEqual({ health: 100, speed: 2.5, active: true });
		});

		it("JSON: class property with empty value", () => {
			const obj = {};
			const data = {
				properties: [
					{
						name: "empty",
						type: "class",
						propertytype: "EmptyType",
						value: {},
					},
				],
			};
			applyTMXProperties(obj, data);
			expect(obj.empty).toEqual({});
		});

		it("JSON: class property alongside scalar properties", () => {
			const obj = {};
			const data = {
				properties: [
					{ name: "name", type: "string", value: "goblin" },
					{
						name: "stats",
						type: "class",
						propertytype: "Stats",
						value: { hp: 50, atk: 10 },
					},
					{ name: "level", type: "int", value: 3 },
				],
			};
			applyTMXProperties(obj, data);
			expect(obj.name).toEqual("goblin");
			expect(obj.stats).toEqual({ hp: 50, atk: 10 });
			expect(obj.level).toEqual(3);
		});

		it("XML: parses class properties with nested <properties>", () => {
			function parseXML(str) {
				return new DOMParser().parseFromString(str, "text/xml").documentElement;
			}

			const xml = parseXML(`
				<properties>
					<property name="config" type="class" propertytype="EnemyConfig">
						<properties>
							<property name="health" type="int" value="100"/>
							<property name="speed" type="float" value="2.5"/>
						</properties>
					</property>
					<property name="emptyClass" type="class" propertytype="EmptyType"/>
				</properties>
			`);
			const obj = parse(xml);
			expect(obj.config).toEqual({ health: 100, speed: 2.5 });
			expect(obj.emptyClass).toEqual({});
		});
	});

	// ---------------------------------------------------------------
	// isCollection flag (Tiled 1.10+)
	// ---------------------------------------------------------------
	describe("isCollection tileset flag", () => {
		// mirrors the logic: tileset.isCollection ?? imageCollection.length > 0
		function resolveIsCollection(flag, imageCount) {
			return flag ?? imageCount > 0;
		}

		it("should use explicit true flag", () => {
			expect(resolveIsCollection(true, 0)).toEqual(true);
		});

		it("should use explicit false flag", () => {
			expect(resolveIsCollection(false, 5)).toEqual(false);
		});

		it("should fall back to image detection when flag is undefined", () => {
			expect(resolveIsCollection(undefined, 3)).toEqual(true);
			expect(resolveIsCollection(undefined, 0)).toEqual(false);
		});

		it("should fall back to image detection when flag is null", () => {
			expect(resolveIsCollection(null, 3)).toEqual(true);
			expect(resolveIsCollection(null, 0)).toEqual(false);
		});
	});

	// ---------------------------------------------------------------
	// per-object opacity and visibility (Tiled 1.12+)
	// ---------------------------------------------------------------
	describe("per-object opacity and visibility", () => {
		// mirrors the parsing logic in TMXObject constructor
		function parseObjectOpacity(settings) {
			return {
				opacity: +(settings.opacity ?? 1),
				visible: +(settings.visible ?? 1) !== 0,
			};
		}

		it("should default opacity to 1 when not specified", () => {
			expect(parseObjectOpacity({}).opacity).toEqual(1);
		});

		it("should read explicit opacity value", () => {
			expect(parseObjectOpacity({ opacity: 0.5 }).opacity).toEqual(0.5);
		});

		it("should read opacity of 0", () => {
			expect(parseObjectOpacity({ opacity: 0 }).opacity).toEqual(0);
		});

		it("should read string opacity from XML", () => {
			expect(parseObjectOpacity({ opacity: "0.75" }).opacity).toEqual(0.75);
		});

		it("should default visible to true when not specified", () => {
			expect(parseObjectOpacity({}).visible).toEqual(true);
		});

		it("should read visible=1 as true", () => {
			expect(parseObjectOpacity({ visible: 1 }).visible).toEqual(true);
		});

		it("should read visible=0 as false", () => {
			expect(parseObjectOpacity({ visible: 0 }).visible).toEqual(false);
		});

		it("should read visible=true as true (JSON)", () => {
			expect(parseObjectOpacity({ visible: true }).visible).toEqual(true);
		});

		it("should read visible=false as false (JSON)", () => {
			expect(parseObjectOpacity({ visible: false }).visible).toEqual(false);
		});

		it("should read visible='1' as true (XML string)", () => {
			expect(parseObjectOpacity({ visible: "1" }).visible).toEqual(true);
		});

		it("should read visible='0' as false (XML string)", () => {
			expect(parseObjectOpacity({ visible: "0" }).visible).toEqual(false);
		});

		it("should handle opacity and visibility together", () => {
			const result = parseObjectOpacity({ opacity: 0.3, visible: 0 });
			expect(result.opacity).toEqual(0.3);
			expect(result.visible).toEqual(false);
		});
	});

	// ---------------------------------------------------------------
	// tiledBlendMode mapping
	// ---------------------------------------------------------------
	describe("tiledBlendMode", () => {
		it("should return 'normal' for undefined", () => {
			expect(tiledBlendMode(undefined)).toEqual("normal");
		});

		it("should return 'normal' for 'normal'", () => {
			expect(tiledBlendMode("normal")).toEqual("normal");
		});

		it("should map 'add' to 'lighter'", () => {
			expect(tiledBlendMode("add")).toEqual("lighter");
		});

		it("should pass through 'multiply'", () => {
			expect(tiledBlendMode("multiply")).toEqual("multiply");
		});

		it("should pass through 'screen'", () => {
			expect(tiledBlendMode("screen")).toEqual("screen");
		});

		it("should pass through 'overlay'", () => {
			expect(tiledBlendMode("overlay")).toEqual("overlay");
		});

		it("should pass through 'darken'", () => {
			expect(tiledBlendMode("darken")).toEqual("darken");
		});

		it("should pass through 'lighten'", () => {
			expect(tiledBlendMode("lighten")).toEqual("lighten");
		});

		it("should pass through advanced modes", () => {
			expect(tiledBlendMode("color-dodge")).toEqual("color-dodge");
			expect(tiledBlendMode("color-burn")).toEqual("color-burn");
			expect(tiledBlendMode("hard-light")).toEqual("hard-light");
			expect(tiledBlendMode("soft-light")).toEqual("soft-light");
			expect(tiledBlendMode("difference")).toEqual("difference");
			expect(tiledBlendMode("exclusion")).toEqual("exclusion");
		});

		it("should pass through unknown modes to the renderer", () => {
			expect(tiledBlendMode("some-future-mode")).toEqual("some-future-mode");
		});
	});

	// ---------------------------------------------------------------
	// Embedded images (Tiled 1.11+)
	// ---------------------------------------------------------------
	describe("embedded images", () => {
		// minimal 1x1 red PNG as base64
		const RED_1x1_PNG =
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==";

		function makeXml(xmlString) {
			return new DOMParser().parseFromString(xmlString, "text/xml")
				.documentElement;
		}

		it("should decode embedded tileset image and cache it in imgList", () => {
			const xml = makeXml(`
				<map>
					<tileset firstgid="1" name="embedded" tilewidth="32" tileheight="32" tilecount="1" columns="1">
						<image format="png" width="1" height="1">
							<data encoding="base64">${RED_1x1_PNG}</data>
						</image>
					</tileset>
				</map>
			`);
			const result = parse(xml);
			const ts = result.tilesets[0];

			// image should be a generated cache key with extension
			expect(ts.image).toMatch(/^__embedded_\d+\.png$/);
			expect(ts.imagewidth).toEqual("1");
			expect(ts.imageheight).toEqual("1");

			// should be cached in imgList
			const basename = ts.image.replace(".png", "");
			expect(imgList[basename]).toBeDefined();
			expect(imgList[basename].src).toContain("data:image/png;base64,");
		});

		it("should decode embedded per-tile image in collection tileset", () => {
			const xml = makeXml(`
				<map>
					<tileset firstgid="1" name="collection" tilewidth="32" tileheight="32" tilecount="1" columns="0">
						<tile id="0">
							<image format="png" width="1" height="1">
								<data encoding="base64">${RED_1x1_PNG}</data>
							</image>
						</tile>
					</tileset>
				</map>
			`);
			const result = parse(xml);
			const ts = result.tilesets[0];

			const tile = ts.tiles["0"];
			expect(tile.image).toMatch(/^__embedded_\d+\.png$/);

			const basename = tile.image.replace(".png", "");
			expect(imgList[basename]).toBeDefined();
		});

		it("should decode embedded image on image layer", () => {
			const xml = makeXml(`
				<map>
					<imagelayer name="bg" offsetx="0" offsety="0">
						<image format="png" width="1" height="1">
							<data encoding="base64">${RED_1x1_PNG}</data>
						</image>
					</imagelayer>
				</map>
			`);
			const result = parse(xml);
			const layer = result.layers[0];

			expect(layer.image).toMatch(/^__embedded_\d+\.png$/);
			expect(layer.type).toEqual("imagelayer");

			const basename = layer.image.replace(".png", "");
			expect(imgList[basename]).toBeDefined();
		});

		it("should still handle external image source normally", () => {
			const xml = makeXml(`
				<map>
					<tileset firstgid="1" name="external" tilewidth="32" tileheight="32">
						<image source="terrain.png" width="128" height="128"/>
					</tileset>
				</map>
			`);
			const result = parse(xml);
			const ts = result.tilesets[0];

			expect(ts.image).toEqual("terrain.png");
			expect(ts.imagewidth).toEqual("128");
			expect(ts.imageheight).toEqual("128");
		});

		it("should generate unique cache keys for multiple embedded images", () => {
			const xml = makeXml(`
				<map>
					<tileset firstgid="1" name="a" tilewidth="32" tileheight="32" tilecount="1" columns="1">
						<image format="png" width="1" height="1">
							<data encoding="base64">${RED_1x1_PNG}</data>
						</image>
					</tileset>
					<tileset firstgid="2" name="b" tilewidth="32" tileheight="32" tilecount="1" columns="1">
						<image format="png" width="1" height="1">
							<data encoding="base64">${RED_1x1_PNG}</data>
						</image>
					</tileset>
				</map>
			`);
			const result = parse(xml);

			expect(result.tilesets[0].image).not.toEqual(result.tilesets[1].image);
		});

		it("should use format attribute for the data URI and cache key extension", () => {
			const xml = makeXml(`
				<map>
					<tileset firstgid="1" name="jpgtileset" tilewidth="32" tileheight="32" tilecount="1" columns="1">
						<image format="jpg" width="1" height="1">
							<data encoding="base64">${RED_1x1_PNG}</data>
						</image>
					</tileset>
				</map>
			`);
			const result = parse(xml);
			const ts = result.tilesets[0];

			// cache key should use the specified format extension
			expect(ts.image).toMatch(/^__embedded_\d+\.jpg$/);
			const basename = ts.image.replace(".jpg", "");
			expect(imgList[basename]).toBeDefined();
			// "jpg" should be normalized to "image/jpeg" MIME type
			expect(imgList[basename].src).toContain("data:image/jpeg;base64,");
		});

		it("should handle image layer with external source", () => {
			const xml = makeXml(`
				<map>
					<imagelayer name="bg">
						<image source="background.png" width="640" height="480"/>
					</imagelayer>
				</map>
			`);
			const result = parse(xml);
			const layer = result.layers[0];

			expect(layer.image).toEqual("background.png");
		});
	});

	// ---------------------------------------------------------------
	// decodeBase64Image utility
	// ---------------------------------------------------------------
	describe("decodeBase64Image", () => {
		const RED_1x1_PNG =
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==";

		it("should return an HTMLImageElement with data URI src", () => {
			const img = decodeBase64Image(RED_1x1_PNG, "png");
			expect(img).toBeInstanceOf(HTMLImageElement);
			expect(img.src).toContain("data:image/png;base64,");
		});

		it("should set width and height when provided", () => {
			const img = decodeBase64Image(RED_1x1_PNG, "png", 32, 64);
			expect(img.width).toEqual(32);
			expect(img.height).toEqual(64);
		});

		it("should build correct data URI for different format strings", () => {
			const jpg = decodeBase64Image(RED_1x1_PNG, "jpg");
			expect(jpg.src).toContain("data:image/jpeg;base64,");

			const webp = decodeBase64Image(RED_1x1_PNG, "webp");
			expect(webp.src).toContain("data:image/webp;base64,");

			const bmp = decodeBase64Image(RED_1x1_PNG, "bmp");
			expect(bmp.src).toContain("data:image/bmp;base64,");
		});

		it("should default format to png", () => {
			const img = decodeBase64Image(RED_1x1_PNG);
			expect(img.src).toContain("data:image/png;base64,");
		});
	});

	// ---------------------------------------------------------------
	// cacheEmbeddedImage / resolveEmbeddedImage helpers
	// ---------------------------------------------------------------
	describe("cacheEmbeddedImage", () => {
		const RED_1x1_PNG =
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==";

		it("should return a filename with extension", () => {
			const name = cacheEmbeddedImage(RED_1x1_PNG, "png");
			expect(name).toMatch(/^__embedded_\d+\.png$/);
		});

		it("should cache the image in imgList", () => {
			const name = cacheEmbeddedImage(RED_1x1_PNG, "jpg");
			const basename = name.replace(".jpg", "");
			expect(imgList[basename]).toBeDefined();
			expect(imgList[basename]).toBeInstanceOf(HTMLImageElement);
		});
	});

	describe("resolveEmbeddedImage", () => {
		const RED_1x1_PNG =
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==";

		it("should resolve imagedata into image filename", () => {
			const data = {
				imagedata: RED_1x1_PNG,
				imageformat: "png",
				imagewidth: 1,
				imageheight: 1,
			};
			resolveEmbeddedImage(data);

			expect(data.image).toMatch(/^__embedded_\d+\.png$/);
			expect(data.imagedata).toBeUndefined();
			expect(data.imageformat).toBeUndefined();
		});

		it("should do nothing when no imagedata present", () => {
			const data = { image: "tileset.png", imagewidth: 64 };
			resolveEmbeddedImage(data);

			expect(data.image).toEqual("tileset.png");
		});

		it("should default format to png", () => {
			const data = { imagedata: RED_1x1_PNG, imagewidth: 1, imageheight: 1 };
			resolveEmbeddedImage(data);

			expect(data.image).toMatch(/\.png$/);
		});

		it("should use specified format", () => {
			const data = {
				imagedata: RED_1x1_PNG,
				imageformat: "webp",
				imagewidth: 1,
				imageheight: 1,
			};
			resolveEmbeddedImage(data);

			expect(data.image).toMatch(/\.webp$/);
			const basename = data.image.replace(".webp", "");
			expect(imgList[basename].src).toContain("data:image/webp;base64,");
		});
	});

	// ---------------------------------------------------------------
	// List/array custom properties (Tiled 1.12+)
	// ---------------------------------------------------------------
	describe("list properties", () => {
		function makeXml(xmlString) {
			return new DOMParser().parseFromString(xmlString, "text/xml")
				.documentElement;
		}

		describe("XML format (via parse)", () => {
			it("should parse a list of strings", () => {
				const xml = makeXml(`
					<map>
						<properties>
							<property name="tags" type="list">
								<item type="string" value="enemy"/>
								<item type="string" value="flying"/>
								<item type="string" value="boss"/>
							</property>
						</properties>
					</map>
				`);
				const result = parse(xml);
				expect(result.properties.tags).toEqual(["enemy", "flying", "boss"]);
			});

			it("should parse a list of ints", () => {
				const xml = makeXml(`
					<map>
						<properties>
							<property name="scores" type="list">
								<item type="int" value="100"/>
								<item type="int" value="200"/>
								<item type="int" value="300"/>
							</property>
						</properties>
					</map>
				`);
				const result = parse(xml);
				expect(result.properties.scores).toEqual([100, 200, 300]);
			});

			it("should parse a list of floats", () => {
				const xml = makeXml(`
					<map>
						<properties>
							<property name="multipliers" type="list">
								<item type="float" value="1.5"/>
								<item type="float" value="2.0"/>
							</property>
						</properties>
					</map>
				`);
				const result = parse(xml);
				expect(result.properties.multipliers).toEqual([1.5, 2.0]);
			});

			it("should parse a list of booleans", () => {
				const xml = makeXml(`
					<map>
						<properties>
							<property name="flags" type="list">
								<item type="bool" value="true"/>
								<item type="bool" value="false"/>
								<item type="bool" value="true"/>
							</property>
						</properties>
					</map>
				`);
				const result = parse(xml);
				expect(result.properties.flags).toEqual([true, false, true]);
			});

			it("should parse an empty list", () => {
				const xml = makeXml(`
					<map>
						<properties>
							<property name="empty" type="list"/>
						</properties>
					</map>
				`);
				const result = parse(xml);
				expect(result.properties.empty).toEqual([]);
			});

			it("should default item type to string when omitted", () => {
				const xml = makeXml(`
					<map>
						<properties>
							<property name="names" type="list">
								<item value="alice"/>
								<item value="bob"/>
							</property>
						</properties>
					</map>
				`);
				const result = parse(xml);
				expect(result.properties.names).toEqual(["alice", "bob"]);
			});

			it("should coexist with scalar properties", () => {
				const xml = makeXml(`
					<map>
						<properties>
							<property name="name" value="level1"/>
							<property name="tags" type="list">
								<item type="string" value="outdoor"/>
							</property>
							<property name="difficulty" type="int" value="3"/>
						</properties>
					</map>
				`);
				const result = parse(xml);
				expect(result.properties.name).toEqual("level1");
				expect(result.properties.tags).toEqual(["outdoor"]);
				expect(result.properties.difficulty).toEqual(3);
			});

			it("should parse list of colors with ARGB→RGBA conversion", () => {
				const xml = makeXml(`
					<map>
						<properties>
							<property name="palette" type="list">
								<item type="color" value="#FF112233"/>
								<item type="color" value="#AABBCCDD"/>
							</property>
						</properties>
					</map>
				`);
				const result = parse(xml);
				expect(result.properties.palette).toEqual(["#112233FF", "#BBCCDDAA"]);
			});
		});

		describe("JSON format (via applyTMXProperties)", () => {
			it("should parse a list of strings", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [
						{
							name: "tags",
							type: "list",
							value: [
								{ type: "string", value: "enemy" },
								{ type: "string", value: "flying" },
							],
						},
					],
				});
				expect(obj.tags).toEqual(["enemy", "flying"]);
			});

			it("should parse a list of ints", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [
						{
							name: "scores",
							type: "list",
							value: [
								{ type: "int", value: 100 },
								{ type: "int", value: 200 },
							],
						},
					],
				});
				expect(obj.scores).toEqual([100, 200]);
			});

			it("should parse a list of floats", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [
						{
							name: "rates",
							type: "list",
							value: [
								{ type: "float", value: 1.5 },
								{ type: "float", value: 2.5 },
							],
						},
					],
				});
				expect(obj.rates).toEqual([1.5, 2.5]);
			});

			it("should parse a list of booleans", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [
						{
							name: "flags",
							type: "list",
							value: [
								{ type: "bool", value: true },
								{ type: "bool", value: false },
							],
						},
					],
				});
				expect(obj.flags).toEqual([true, false]);
			});

			it("should parse an empty list", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [{ name: "empty", type: "list", value: [] }],
				});
				expect(obj.empty).toEqual([]);
			});

			it("should default item type to string", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [
						{
							name: "names",
							type: "list",
							value: [{ value: "alice" }, { value: "bob" }],
						},
					],
				});
				expect(obj.names).toEqual(["alice", "bob"]);
			});

			it("should coexist with scalar properties", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [
						{ name: "name", type: "string", value: "level1" },
						{
							name: "tags",
							type: "list",
							value: [{ type: "string", value: "outdoor" }],
						},
						{ name: "difficulty", type: "int", value: 3 },
					],
				});
				expect(obj.name).toEqual("level1");
				expect(obj.tags).toEqual(["outdoor"]);
				expect(obj.difficulty).toEqual(3);
			});

			it("should handle list with string int values (XML-style)", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [
						{
							name: "ids",
							type: "list",
							value: [
								{ type: "int", value: "10" },
								{ type: "int", value: "20" },
							],
						},
					],
				});
				expect(obj.ids).toEqual([10, 20]);
			});

			it("should parse a single-item list", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [
						{
							name: "solo",
							type: "list",
							value: [{ type: "string", value: "only" }],
						},
					],
				});
				expect(obj.solo).toEqual(["only"]);
			});

			it("should handle multiple list properties on the same element", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [
						{
							name: "names",
							type: "list",
							value: [
								{ type: "string", value: "alice" },
								{ type: "string", value: "bob" },
							],
						},
						{
							name: "scores",
							type: "list",
							value: [
								{ type: "int", value: 10 },
								{ type: "int", value: 20 },
							],
						},
					],
				});
				expect(obj.names).toEqual(["alice", "bob"]);
				expect(obj.scores).toEqual([10, 20]);
			});

			it("should parse list with color items (ARGB→RGBA)", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [
						{
							name: "colors",
							type: "list",
							value: [
								{ type: "color", value: "#FF112233" },
								{ type: "color", value: "#AABBCCDD" },
							],
						},
					],
				});
				expect(obj.colors).toEqual(["#112233FF", "#BBCCDDAA"]);
			});

			it("should parse list with object reference ids", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [
						{
							name: "targets",
							type: "list",
							value: [
								{ type: "object", value: 42 },
								{ type: "object", value: 99 },
							],
						},
					],
				});
				expect(obj.targets).toEqual([42, 99]);
			});

			it("should parse list with file paths", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [
						{
							name: "sounds",
							type: "list",
							value: [
								{ type: "file", value: "sfx/hit.ogg" },
								{ type: "file", value: "sfx/miss.ogg" },
							],
						},
					],
				});
				expect(obj.sounds).toEqual(["sfx/hit.ogg", "sfx/miss.ogg"]);
			});

			it("should handle list alongside class property", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [
						{
							name: "config",
							type: "class",
							value: { speed: 5 },
						},
						{
							name: "tags",
							type: "list",
							value: [{ type: "string", value: "npc" }],
						},
					],
				});
				expect(obj.config).toEqual({ speed: 5 });
				expect(obj.tags).toEqual(["npc"]);
			});
		});

		describe("XML format — additional cases", () => {
			it("should parse a single-item list", () => {
				const xml = makeXml(`
					<map>
						<properties>
							<property name="solo" type="list">
								<item type="int" value="42"/>
							</property>
						</properties>
					</map>
				`);
				const result = parse(xml);
				expect(result.properties.solo).toEqual([42]);
			});

			it("should parse multiple list properties", () => {
				const xml = makeXml(`
					<map>
						<properties>
							<property name="names" type="list">
								<item value="alice"/>
								<item value="bob"/>
							</property>
							<property name="ids" type="list">
								<item type="int" value="1"/>
								<item type="int" value="2"/>
							</property>
						</properties>
					</map>
				`);
				const result = parse(xml);
				expect(result.properties.names).toEqual(["alice", "bob"]);
				expect(result.properties.ids).toEqual([1, 2]);
			});

			it("should parse list alongside class property in XML", () => {
				const xml = makeXml(`
					<map>
						<properties>
							<property name="config" type="class" propertytype="Settings">
								<properties>
									<property name="speed" type="int" value="5"/>
								</properties>
							</property>
							<property name="tags" type="list">
								<item value="outdoor"/>
								<item value="forest"/>
							</property>
						</properties>
					</map>
				`);
				const result = parse(xml);
				expect(result.properties.config).toEqual({ speed: 5 });
				expect(result.properties.tags).toEqual(["outdoor", "forest"]);
			});

			it("should parse list on an object element", () => {
				const xml = makeXml(`
					<map>
						<objectgroup name="objects">
							<object id="1" x="0" y="0" width="32" height="32">
								<properties>
									<property name="waypoints" type="list">
										<item type="int" value="10"/>
										<item type="int" value="20"/>
										<item type="int" value="30"/>
									</property>
								</properties>
							</object>
						</objectgroup>
					</map>
				`);
				const result = parse(xml);
				const obj = result.layers[0].objects[0];
				expect(obj.properties.waypoints).toEqual([10, 20, 30]);
			});

			it("should parse list on a tileset tile", () => {
				const xml = makeXml(`
					<tileset firstgid="1" name="test" tilewidth="32" tileheight="32">
						<tile id="0">
							<properties>
								<property name="frames" type="list">
									<item type="int" value="0"/>
									<item type="int" value="1"/>
									<item type="int" value="2"/>
								</property>
							</properties>
						</tile>
					</tileset>
				`);
				const result = parse(xml);
				expect(result.tiles["0"].properties.frames).toEqual([0, 1, 2]);
			});

			it("should parse list with string bool values", () => {
				const xml = makeXml(`
					<map>
						<properties>
							<property name="switches" type="list">
								<item type="bool" value="true"/>
								<item type="bool" value="false"/>
								<item type="bool" value="true"/>
							</property>
						</properties>
					</map>
				`);
				const result = parse(xml);
				expect(result.properties.switches).toEqual([true, false, true]);
			});
		});

		describe("backward compatibility", () => {
			it("should not affect existing json: prefix arrays", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [
						{
							name: "legacy",
							type: "string",
							value: "json:[1,2,3]",
						},
					],
				});
				expect(obj.legacy).toEqual([1, 2, 3]);
			});

			it("should not affect existing class properties", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [
						{
							name: "config",
							type: "class",
							value: { health: 100, speed: 2.5 },
						},
					],
				});
				expect(obj.config).toEqual({ health: 100, speed: 2.5 });
			});

			it("should not affect existing scalar properties", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [
						{ name: "count", type: "int", value: 42 },
						{ name: "label", type: "string", value: "hello" },
						{ name: "active", type: "bool", value: true },
					],
				});
				expect(obj.count).toEqual(42);
				expect(obj.label).toEqual("hello");
				expect(obj.active).toEqual(true);
			});

			it("should not affect old JSON format flat properties", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: { speed: 10, name: "goblin" },
					propertytypes: { speed: "int", name: "string" },
				});
				expect(obj.speed).toEqual(10);
				expect(obj.name).toEqual("goblin");
			});

			it("should not affect XML properties without list type", () => {
				const xml = makeXml(`
					<map>
						<properties>
							<property name="greeting" value="hello"/>
							<property name="count" type="int" value="5"/>
							<property name="flag" type="bool" value="true"/>
						</properties>
					</map>
				`);
				const result = parse(xml);
				expect(result.properties.greeting).toEqual("hello");
				expect(result.properties.count).toEqual(5);
				expect(result.properties.flag).toEqual(true);
			});

			it("should still pass through native JSON booleans (non-string)", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [
						{ name: "active", type: "bool", value: true },
						{ name: "visible", type: "bool", value: false },
					],
				});
				expect(obj.active).toEqual(true);
				expect(obj.visible).toEqual(false);
			});

			it("should still pass through native JSON numbers (non-string)", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [
						{ name: "speed", type: "int", value: 42 },
						{ name: "rate", type: "float", value: 3.14 },
						{ name: "zero", type: "int", value: 0 },
						{ name: "negative", type: "float", value: -1.5 },
					],
				});
				expect(obj.speed).toEqual(42);
				expect(obj.rate).toEqual(3.14);
				expect(obj.zero).toEqual(0);
				expect(obj.negative).toEqual(-1.5);
			});

			it("should still pass through native JSON null/undefined values", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [{ name: "nothing", type: "string", value: null }],
				});
				expect(obj.nothing).toEqual(null);
			});

			it("should still handle eval: prefix strings", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [{ name: "calc", type: "string", value: "eval:2+3" }],
				});
				expect(obj.calc).toEqual(5);
			});

			it("should still handle color ARGB conversion", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [{ name: "tint", type: "color", value: "#FF00FF00" }],
				});
				expect(obj.tint).toEqual("#00FF00FF");
			});

			it("should still handle ratio property expansion", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [{ name: "ratio", type: "string", value: "0.5" }],
				});
				expect(obj.ratio).toEqual({ x: 0.5, y: 0.5 });
			});

			it("should still handle anchorPoint property expansion", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [{ name: "anchorPoint", type: "string", value: "0.5" }],
				});
				expect(obj.anchorPoint).toEqual({ x: 0.5, y: 0.5 });
			});

			it("should still handle old intermediate JSON format (numeric keys)", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: {
						0: { name: "health", type: "int", value: 100 },
						1: { name: "label", type: "string", value: "goblin" },
					},
				});
				expect(obj.health).toEqual(100);
				expect(obj.label).toEqual("goblin");
			});

			it("should still handle XML class properties with nested members", () => {
				const xml = makeXml(`
					<map>
						<properties>
							<property name="config" type="class" propertytype="Settings">
								<properties>
									<property name="health" type="int" value="100"/>
									<property name="name" value="hero"/>
								</properties>
							</property>
						</properties>
					</map>
				`);
				const result = parse(xml);
				expect(result.properties.config).toEqual({
					health: 100,
					name: "hero",
				});
			});

			it("should still handle empty class property in XML", () => {
				const xml = makeXml(`
					<map>
						<properties>
							<property name="empty" type="class" propertytype="Empty"/>
						</properties>
					</map>
				`);
				const result = parse(xml);
				expect(result.properties.empty).toEqual({});
			});

			it("should still auto-detect numeric strings as numbers", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [{ name: "val", type: "string", value: "42" }],
				});
				expect(obj.val).toEqual(42);
			});

			it("should still auto-detect boolean strings", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [
						{ name: "on", type: "string", value: "true" },
						{ name: "off", type: "string", value: "false" },
					],
				});
				expect(obj.on).toEqual(true);
				expect(obj.off).toEqual(false);
			});

			it("should still handle empty string as true (legacy flag)", () => {
				const obj = {};
				applyTMXProperties(obj, {
					properties: [{ name: "flag", type: "string", value: "" }],
				});
				expect(obj.flag).toEqual(true);
			});
		});
	});

	// ---------------------------------------------------------------
	// Capsule object shape parsing (Tiled 1.12+)
	// ---------------------------------------------------------------
	describe("capsule object parsing", () => {
		function makeXml(xmlString) {
			return new DOMParser().parseFromString(xmlString, "text/xml")
				.documentElement;
		}

		it("should parse capsule marker in XML object", () => {
			const xml = makeXml(`
				<map>
					<objectgroup name="shapes">
						<object id="1" x="10" y="20" width="64" height="32">
							<capsule/>
						</object>
					</objectgroup>
				</map>
			`);
			const result = parse(xml);
			const obj = result.layers[0].objects[0];
			expect(obj.capsule).toBeDefined();
			expect(obj.x).toEqual("10");
			expect(obj.y).toEqual("20");
			expect(obj.width).toEqual("64");
			expect(obj.height).toEqual("32");
		});

		it("should parse capsule with rotation in XML", () => {
			const xml = makeXml(`
				<map>
					<objectgroup name="shapes">
						<object id="1" x="0" y="0" width="100" height="40" rotation="45">
							<capsule/>
						</object>
					</objectgroup>
				</map>
			`);
			const result = parse(xml);
			const obj = result.layers[0].objects[0];
			expect(obj.capsule).toBeDefined();
			expect(obj.rotation).toEqual("45");
		});

		it("should not set capsule flag on regular rectangle object", () => {
			const xml = makeXml(`
				<map>
					<objectgroup name="shapes">
						<object id="1" x="0" y="0" width="64" height="32"/>
					</objectgroup>
				</map>
			`);
			const result = parse(xml);
			const obj = result.layers[0].objects[0];
			expect(obj.capsule).toBeUndefined();
		});

		it("should not set capsule flag on ellipse object", () => {
			const xml = makeXml(`
				<map>
					<objectgroup name="shapes">
						<object id="1" x="0" y="0" width="64" height="32">
							<ellipse/>
						</object>
					</objectgroup>
				</map>
			`);
			const result = parse(xml);
			const obj = result.layers[0].objects[0];
			expect(obj.capsule).toBeUndefined();
			expect(obj.ellipse).toBeDefined();
		});
	});
});
