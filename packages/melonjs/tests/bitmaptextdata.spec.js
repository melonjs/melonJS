import { describe, expect, it } from "vitest";
import BitmapTextData from "../src/renderable/text/bitmaptextdata.ts";

/**
 * BitmapTextData parses the AngelCode BMFont format in both its text (.fnt) and
 * XML serialisations. The two carry identical data, so the field/value battery
 * is written once against a format-agnostic font spec and run through BOTH
 * parsers (the XML one being a dependency-free regex parser that also works in
 * Node). Format-specific quirks are covered separately below.
 */

// the eight glyph fields, in the positional order the text (.fnt) parser expects
const CHAR_FIELDS = [
	"id",
	"x",
	"y",
	"width",
	"height",
	"xoffset",
	"yoffset",
	"xadvance",
];

const charToText = (c) => {
	const parts = CHAR_FIELDS.map((f) => {
		return `${f}=${c[f] ?? 0}`;
	});
	return `char ${parts.join(" ")} page=0 chnl=15`;
};

const charToXML = (c) => {
	const parts = CHAR_FIELDS.filter((f) => {
		return c[f] !== undefined;
	}).map((f) => {
		return `${f}="${c[f]}"`;
	});
	return `<char ${parts.join(" ")}/>`;
};

// serialise a format-agnostic font spec to the requested BMFont flavour
const buildFont = (
	format,
	{ padding = "0,0,0,0", chars = [], kernings = [] },
) => {
	if (format === "xml") {
		const charLines = chars
			.map((c) => {
				return `    ${charToXML(c)}`;
			})
			.join("\n");
		let kernBlock = "";
		if (kernings.length > 0) {
			const lines = kernings
				.map((k) => {
					return `    <kerning first="${k.first}" second="${k.second}" amount="${k.amount}"/>`;
				})
				.join("\n");
			kernBlock = `\n  <kernings count="${kernings.length}">\n${lines}\n  </kernings>`;
		}
		const pad = padding ? ` padding="${padding}"` : "";
		return `<?xml version="1.0"?>
<font>
  <info face="t" size="10"${pad}/>
  <common lineHeight="12" base="10" scaleW="64" scaleH="64" pages="1" packed="0"/>
  <pages><page id="0" file="t.png"/></pages>
  <chars count="${chars.length}">
${charLines}
  </chars>${kernBlock}
</font>`;
	}
	// text (.fnt) — padding is mandatory in this flavour
	const lines = [
		`info face="t" size=10 bold=0 italic=0 padding=${padding ?? "0,0,0,0"} spacing=0,0`,
		"common lineHeight=12 base=10 scaleW=64 scaleH=64 pages=1 packed=0",
		'page id=0 file="t.png"',
		`chars count=${chars.length}`,
		...chars.map((c) => {
			return charToText(c);
		}),
	];
	if (kernings.length > 0) {
		lines.push(`kernings count=${kernings.length}`);
		for (const k of kernings) {
			lines.push(
				`kerning first=${k.first} second=${k.second} amount=${k.amount}`,
			);
		}
	}
	return lines.join("\n");
};

// ── shared battery: the SAME assertions through both parsers ──────────────────
for (const format of ["text", "xml"]) {
	describe(`BitmapTextData — ${format} format`, () => {
		const font = (spec) => {
			return new BitmapTextData(buildFont(format, spec));
		};
		const glyphOf = (c) => {
			return font({ chars: [c] }).glyphs[c.id];
		};

		it("parses standard integer fields", () => {
			const g = glyphOf({
				id: 65,
				x: 1,
				y: 2,
				width: 6,
				height: 10,
				xoffset: 3,
				yoffset: 4,
				xadvance: 7,
			});
			expect(g.id).toBe(65);
			expect(g.x).toBe(1);
			expect(g.y).toBe(2);
			expect(g.width).toBe(6);
			expect(g.height).toBe(10);
			expect(g.xoffset).toBe(3);
			expect(g.yoffset).toBe(4);
			expect(g.xadvance).toBe(7);
		});

		it("parses negative offsets (xoffset / yoffset)", () => {
			const g = glyphOf({
				id: 65,
				x: 0,
				y: 0,
				width: 6,
				height: 10,
				xoffset: -3,
				yoffset: -5,
				xadvance: 6,
			});
			expect(g.xoffset).toBe(-3);
			expect(g.yoffset).toBe(-5);
		});

		it("parses zero width / height", () => {
			const g = glyphOf({
				id: 65,
				x: 0,
				y: 0,
				width: 0,
				height: 0,
				xoffset: 0,
				yoffset: 0,
				xadvance: 4,
			});
			expect(g.width).toBe(0);
			expect(g.height).toBe(0);
			expect(g.xadvance).toBe(4);
		});

		it("parses fractional (float) values", () => {
			const g = glyphOf({
				id: 65,
				x: 0.5,
				y: 1.25,
				width: 6,
				height: 10,
				xoffset: 0,
				yoffset: 0,
				xadvance: 6.5,
			});
			expect(g.x).toBeCloseTo(0.5, 6);
			expect(g.y).toBeCloseTo(1.25, 6);
			expect(g.xadvance).toBeCloseTo(6.5, 6);
		});

		it("parses high Unicode code points", () => {
			const g = glyphOf({
				id: 8364, // €
				x: 0,
				y: 0,
				width: 6,
				height: 10,
				xoffset: 0,
				yoffset: 0,
				xadvance: 6,
			});
			expect(g).toBeDefined();
			expect(g.id).toBe(8364);
		});

		it("maps padding to top / left / bottom / right in order", () => {
			const d = font({
				padding: "1,2,3,4",
				chars: [{ id: 65, width: 6, height: 10, xadvance: 6 }],
			});
			expect(d.padTop).toBe(1);
			expect(d.padLeft).toBe(2);
			expect(d.padBottom).toBe(3);
			expect(d.padRight).toBe(4);
		});

		it("stores positive AND negative kerning amounts", () => {
			const d = font({
				chars: [
					{ id: 65, x: 0, y: 0, width: 6, height: 10, xadvance: 6 },
					{ id: 66, x: 6, y: 0, width: 6, height: 10, xadvance: 6 },
				],
				kernings: [
					{ first: 65, second: 66, amount: -2 },
					{ first: 66, second: 65, amount: 3 },
				],
			});
			expect(d.glyphs[65].getKerning(66)).toBe(-2);
			expect(d.glyphs[66].getKerning(65)).toBe(3);
		});

		it("ignores kerning referencing a missing glyph (no throw)", () => {
			expect(() => {
				return font({
					chars: [{ id: 65, width: 6, height: 10, xadvance: 6 }],
					kernings: [{ first: 999, second: 65, amount: -2 }],
				});
			}).not.toThrow();
		});

		it("reads lineHeight and derives capHeight from a cap glyph", () => {
			const d = font({
				chars: [
					{
						id: 66,
						x: 0,
						y: 0,
						width: 6,
						height: 10,
						xoffset: 0,
						yoffset: 0,
						xadvance: 6,
					},
				],
			});
			expect(d.lineHeight).toBe(12);
			// "B" is in the cap-height probe list → capHeight === its height
			expect(d.capHeight).toBe(10);
		});

		it("synthesises a space glyph from the first real glyph's advance", () => {
			const d = font({
				chars: [{ id: 65, width: 6, height: 10, xadvance: 9 }],
			});
			expect(d.glyphs[32]).toBeDefined();
			expect(d.glyphs[32].xadvance).toBe(9);
		});

		it("throws on empty input", () => {
			expect(() => {
				return new BitmapTextData("");
			}).toThrow();
		});
	});
}

// ── XML-only quirks (the text format is positional, so these don't apply) ─────
describe("BitmapTextData — XML-specific parsing", () => {
	const single = (charTag) => {
		return new BitmapTextData(
			`<?xml version="1.0"?><font><common lineHeight="12" base="10"/>` +
				`<chars count="1">${charTag}</chars></font>`,
		).glyphs[65];
	};

	it("is attribute-order independent", () => {
		const g = single(
			'<char xadvance="7" height="10" id="65" yoffset="4" width="6" x="1" xoffset="3" y="2"/>',
		);
		expect(g.x).toBe(1);
		expect(g.y).toBe(2);
		expect(g.xoffset).toBe(3);
		expect(g.yoffset).toBe(4);
		expect(g.xadvance).toBe(7);
	});

	it("tolerates whitespace around '='", () => {
		const g = single(
			'<char id = "65"  x ="1" y= "2" width="6" height="10" xadvance="6"/>',
		);
		expect(g.id).toBe(65);
		expect(g.x).toBe(1);
		expect(g.y).toBe(2);
	});

	it("defaults any missing attribute to 0", () => {
		const g = single('<char id="65" width="6" height="10"/>');
		expect(g.x).toBe(0);
		expect(g.y).toBe(0);
		expect(g.xoffset).toBe(0);
		expect(g.yoffset).toBe(0);
		expect(g.xadvance).toBe(0);
	});

	it("parses explicit-close <char>…</char> tags", () => {
		const g = single(
			'<char id="65" x="0" y="0" width="6" height="10" xadvance="6"></char>',
		);
		expect(g).toBeDefined();
		expect(g.width).toBe(6);
	});

	it("parses attributes spread over multiple lines", () => {
		const g = single(
			'<char id="65"\n  x="0" y="0"\n  width="6" height="10"\n  xadvance="6"/>',
		);
		expect(g).toBeDefined();
		expect(g.width).toBe(6);
	});

	it("ignores irrelevant attributes (page / chnl / letter)", () => {
		const g = single(
			'<char id="65" x="0" y="0" width="6" height="10" xadvance="6" page="0" chnl="15" letter="A"/>',
		);
		expect(g.width).toBe(6);
		expect(g.xadvance).toBe(6);
	});

	it("does NOT mistake the <chars>/<kernings> count wrappers for entries", () => {
		const d = new BitmapTextData(
			`<?xml version="1.0"?><font><common lineHeight="12" base="10"/>` +
				`<chars count="1"><char id="65" width="6" height="10" xadvance="6"/></chars>` +
				`<kernings count="1"><kerning first="65" second="66" amount="-1"/></kernings></font>`,
		);
		// only the single real glyph (65) + the synthesised space (32)
		const ids = Object.keys(d.glyphs)
			.map(Number)
			.sort((a, b) => {
				return a - b;
			});
		expect(ids).toEqual([32, 65]);
	});

	it("defaults all padding to 0 when omitted", () => {
		const d = new BitmapTextData(
			`<?xml version="1.0"?><font><info face="t"/><common lineHeight="12" base="10"/>` +
				`<chars count="1"><char id="65" width="6" height="10" xadvance="6"/></chars></font>`,
		);
		expect(d.padTop).toBe(0);
		expect(d.padLeft).toBe(0);
		expect(d.padBottom).toBe(0);
		expect(d.padRight).toBe(0);
	});

	it("throws when the <common> element is missing", () => {
		expect(() => {
			return new BitmapTextData("<font></font>");
		}).toThrow();
	});
});
