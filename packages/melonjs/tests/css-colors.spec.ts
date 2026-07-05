import { describe, expect, it } from "vitest";
import { Color } from "../src/index.js";

/**
 * Validates the engine's CSS named-color table against the full CSS Color
 * Module keyword list (147 extended keywords + rebeccapurple).
 *
 * Written failing-first against three table defects found in a code audit:
 * - "darkgray" / "darkgrey" keys were pasted from a spec table WITH their
 *   footnote marker ("darkgray[*]"), so looking either name up missed the
 *   table and fell through parseRGB → parseHex → throw.
 * - silver / aliceblue / burlywood carried single-digit typos in one channel.
 * - cyan, magenta and rebeccapurple were missing entirely (same throw).
 */

// [keyword, spec hex] — the canonical list; expected RGB is derived via
// parseHex so this spec never hand-transcribes channel values.
const CSS_COLOR_KEYWORDS: [string, string][] = [
	["aliceblue", "#F0F8FF"],
	["antiquewhite", "#FAEBD7"],
	["aqua", "#00FFFF"],
	["aquamarine", "#7FFFD4"],
	["azure", "#F0FFFF"],
	["beige", "#F5F5DC"],
	["bisque", "#FFE4C4"],
	["black", "#000000"],
	["blanchedalmond", "#FFEBCD"],
	["blue", "#0000FF"],
	["blueviolet", "#8A2BE2"],
	["brown", "#A52A2A"],
	["burlywood", "#DEB887"],
	["cadetblue", "#5F9EA0"],
	["chartreuse", "#7FFF00"],
	["chocolate", "#D2691E"],
	["coral", "#FF7F50"],
	["cornflowerblue", "#6495ED"],
	["cornsilk", "#FFF8DC"],
	["crimson", "#DC143C"],
	["cyan", "#00FFFF"],
	["darkblue", "#00008B"],
	["darkcyan", "#008B8B"],
	["darkgoldenrod", "#B8860B"],
	["darkgray", "#A9A9A9"],
	["darkgreen", "#006400"],
	["darkgrey", "#A9A9A9"],
	["darkkhaki", "#BDB76B"],
	["darkmagenta", "#8B008B"],
	["darkolivegreen", "#556B2F"],
	["darkorange", "#FF8C00"],
	["darkorchid", "#9932CC"],
	["darkred", "#8B0000"],
	["darksalmon", "#E9967A"],
	["darkseagreen", "#8FBC8F"],
	["darkslateblue", "#483D8B"],
	["darkslategray", "#2F4F4F"],
	["darkslategrey", "#2F4F4F"],
	["darkturquoise", "#00CED1"],
	["darkviolet", "#9400D3"],
	["deeppink", "#FF1493"],
	["deepskyblue", "#00BFFF"],
	["dimgray", "#696969"],
	["dimgrey", "#696969"],
	["dodgerblue", "#1E90FF"],
	["firebrick", "#B22222"],
	["floralwhite", "#FFFAF0"],
	["forestgreen", "#228B22"],
	["fuchsia", "#FF00FF"],
	["gainsboro", "#DCDCDC"],
	["ghostwhite", "#F8F8FF"],
	["gold", "#FFD700"],
	["goldenrod", "#DAA520"],
	["gray", "#808080"],
	["green", "#008000"],
	["greenyellow", "#ADFF2F"],
	["grey", "#808080"],
	["honeydew", "#F0FFF0"],
	["hotpink", "#FF69B4"],
	["indianred", "#CD5C5C"],
	["indigo", "#4B0082"],
	["ivory", "#FFFFF0"],
	["khaki", "#F0E68C"],
	["lavender", "#E6E6FA"],
	["lavenderblush", "#FFF0F5"],
	["lawngreen", "#7CFC00"],
	["lemonchiffon", "#FFFACD"],
	["lightblue", "#ADD8E6"],
	["lightcoral", "#F08080"],
	["lightcyan", "#E0FFFF"],
	["lightgoldenrodyellow", "#FAFAD2"],
	["lightgray", "#D3D3D3"],
	["lightgreen", "#90EE90"],
	["lightgrey", "#D3D3D3"],
	["lightpink", "#FFB6C1"],
	["lightsalmon", "#FFA07A"],
	["lightseagreen", "#20B2AA"],
	["lightskyblue", "#87CEFA"],
	["lightslategray", "#778899"],
	["lightslategrey", "#778899"],
	["lightsteelblue", "#B0C4DE"],
	["lightyellow", "#FFFFE0"],
	["lime", "#00FF00"],
	["limegreen", "#32CD32"],
	["linen", "#FAF0E6"],
	["magenta", "#FF00FF"],
	["maroon", "#800000"],
	["mediumaquamarine", "#66CDAA"],
	["mediumblue", "#0000CD"],
	["mediumorchid", "#BA55D3"],
	["mediumpurple", "#9370DB"],
	["mediumseagreen", "#3CB371"],
	["mediumslateblue", "#7B68EE"],
	["mediumspringgreen", "#00FA9A"],
	["mediumturquoise", "#48D1CC"],
	["mediumvioletred", "#C71585"],
	["midnightblue", "#191970"],
	["mintcream", "#F5FFFA"],
	["mistyrose", "#FFE4E1"],
	["moccasin", "#FFE4B5"],
	["navajowhite", "#FFDEAD"],
	["navy", "#000080"],
	["oldlace", "#FDF5E6"],
	["olive", "#808000"],
	["olivedrab", "#6B8E23"],
	["orange", "#FFA500"],
	["orangered", "#FF4500"],
	["orchid", "#DA70D6"],
	["palegoldenrod", "#EEE8AA"],
	["palegreen", "#98FB98"],
	["paleturquoise", "#AFEEEE"],
	["palevioletred", "#DB7093"],
	["papayawhip", "#FFEFD5"],
	["peachpuff", "#FFDAB9"],
	["peru", "#CD853F"],
	["pink", "#FFC0CB"],
	["plum", "#DDA0DD"],
	["powderblue", "#B0E0E6"],
	["purple", "#800080"],
	["rebeccapurple", "#663399"],
	["red", "#FF0000"],
	["rosybrown", "#BC8F8F"],
	["royalblue", "#4169E1"],
	["saddlebrown", "#8B4513"],
	["salmon", "#FA8072"],
	["sandybrown", "#F4A460"],
	["seagreen", "#2E8B57"],
	["seashell", "#FFF5EE"],
	["sienna", "#A0522D"],
	["silver", "#C0C0C0"],
	["skyblue", "#87CEEB"],
	["slateblue", "#6A5ACD"],
	["slategray", "#708090"],
	["slategrey", "#708090"],
	["snow", "#FFFAFA"],
	["springgreen", "#00FF7F"],
	["steelblue", "#4682B4"],
	["tan", "#D2B48C"],
	["teal", "#008080"],
	["thistle", "#D8BFD8"],
	["tomato", "#FF6347"],
	["turquoise", "#40E0D0"],
	["violet", "#EE82EE"],
	["wheat", "#F5DEB3"],
	["white", "#FFFFFF"],
	["whitesmoke", "#F5F5F5"],
	["yellow", "#FFFF00"],
	["yellowgreen", "#9ACD32"],
];

describe("CSS named colors (full keyword table)", () => {
	it("parses every CSS color keyword to its spec value", () => {
		const wrong: string[] = [];
		for (const [name, hex] of CSS_COLOR_KEYWORDS) {
			const expected = new Color().parseHex(hex as `#${string}`);
			let actual: Color;
			try {
				actual = new Color().parseCSS(name);
			} catch {
				wrong.push(`${name}: throws (missing from the table)`);
				continue;
			}
			if (
				actual.r !== expected.r ||
				actual.g !== expected.g ||
				actual.b !== expected.b
			) {
				wrong.push(
					`${name}: got rgb(${actual.r},${actual.g},${actual.b}), expected rgb(${expected.r},${expected.g},${expected.b}) (${hex})`,
				);
			}
		}
		expect(wrong).toEqual([]);
	});

	it('parses "darkgray" and "darkgrey" (keys carried a pasted "[*]" footnote marker)', () => {
		for (const name of ["darkgray", "darkgrey"]) {
			const c = new Color().parseCSS(name);
			expect([c.r, c.g, c.b]).toEqual([169, 169, 169]);
		}
	});

	it("silver / aliceblue / burlywood match the spec (single-digit channel typos)", () => {
		const c1 = new Color().parseCSS("silver");
		expect([c1.r, c1.g, c1.b]).toEqual([192, 192, 192]);
		const c2 = new Color().parseCSS("aliceblue");
		expect([c2.r, c2.g, c2.b]).toEqual([240, 248, 255]);
		const c3 = new Color().parseCSS("burlywood");
		expect([c3.r, c3.g, c3.b]).toEqual([222, 184, 135]);
	});

	it('supports "cyan", "magenta" and "rebeccapurple"', () => {
		const cyan = new Color().parseCSS("cyan");
		expect([cyan.r, cyan.g, cyan.b]).toEqual([0, 255, 255]);
		const magenta = new Color().parseCSS("magenta");
		expect([magenta.r, magenta.g, magenta.b]).toEqual([255, 0, 255]);
		const rebecca = new Color().parseCSS("rebeccapurple");
		expect([rebecca.r, rebecca.g, rebecca.b]).toEqual([102, 51, 153]);
	});
});
