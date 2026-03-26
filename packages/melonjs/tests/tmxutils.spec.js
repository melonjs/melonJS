import { describe, expect, it } from "vitest";
import {
	applyTMXProperties,
	decode,
	parse,
	setInflateFunction,
} from "../src/level/tiled/TMXUtils.js";

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
});
