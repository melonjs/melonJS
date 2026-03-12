import { describe, expect, it } from "vitest";
import { xmlToObject } from "../src/utils/xml.ts";

function xml(str) {
	return new DOMParser().parseFromString(str, "text/xml").documentElement;
}

describe("xmlToObject", () => {
	// --- attributes ---
	describe("attributes", () => {
		it("extracts attributes as string key-value pairs", () => {
			const obj = xmlToObject(xml('<item id="1" name="sword"/>'));
			expect(obj.id).toBe("1");
			expect(obj.name).toBe("sword");
		});

		it("returns empty object for element with no attributes or children", () => {
			const obj = xmlToObject(xml("<empty/>"));
			expect(Object.keys(obj).length).toBe(0);
		});
	});

	// --- text content ---
	describe("text content", () => {
		it("collects text nodes into a text property", () => {
			const obj = xmlToObject(xml("<note>hello world</note>"));
			expect(obj.text).toBe("hello world");
		});

		it("trims whitespace from text nodes", () => {
			const obj = xmlToObject(xml("<note>  padded  </note>"));
			expect(obj.text).toBe("padded");
		});

		it("concatenates multiple text nodes", () => {
			const obj = xmlToObject(xml("<root>hello <child/>world</root>"));
			expect(obj.text).toBe("helloworld");
		});

		it("omits text property when there is no text content", () => {
			const obj = xmlToObject(xml('<root><child a="1"/></root>'));
			expect(obj.text).toBeUndefined();
		});
	});

	// --- default recursive behavior (no normalizer) ---
	describe("default recursion (no normalizer)", () => {
		it("recursively parses child elements using nodeName as key", () => {
			const obj = xmlToObject(
				xml('<root><settings mode="fast" quality="high"/></root>'),
			);
			expect(obj.settings).toBeDefined();
			expect(obj.settings.mode).toBe("fast");
			expect(obj.settings.quality).toBe("high");
		});

		it("handles deeply nested elements", () => {
			const obj = xmlToObject(xml('<a><b><c><d val="deep"/></c></b></a>'));
			expect(obj.b.c.d.val).toBe("deep");
		});

		it("last child wins when siblings share the same nodeName", () => {
			const obj = xmlToObject(xml('<root><item id="1"/><item id="2"/></root>'));
			// without a normalizer, the second <item> overwrites the first
			expect(obj.item.id).toBe("2");
		});

		it("parses child text and attributes together", () => {
			const obj = xmlToObject(xml('<msg type="info">Details here</msg>'));
			expect(obj.type).toBe("info");
			expect(obj.text).toBe("Details here");
		});
	});

	// --- custom normalizer ---
	describe("custom normalizer", () => {
		it("receives obj, item, and parser arguments", () => {
			let called = false;
			xmlToObject(xml("<root><child/></root>"), (obj, item, parser) => {
				called = true;
				expect(obj).toBeDefined();
				expect(item.nodeName).toBe("child");
				expect(typeof parser).toBe("function");
			});
			expect(called).toBe(true);
		});

		it("can collect children into arrays", () => {
			const normalizer = (obj, item, parser) => {
				const name = item.nodeName + "s";
				obj[name] = obj[name] || [];
				obj[name].push(parser(item));
			};
			const obj = xmlToObject(
				xml('<root><item id="1"/><item id="2"/><item id="3"/></root>'),
				normalizer,
			);
			expect(obj.items).toBeDefined();
			expect(obj.items.length).toBe(3);
			expect(obj.items[0].id).toBe("1");
			expect(obj.items[2].id).toBe("3");
		});

		it("parser argument preserves the normalizer for recursive calls", () => {
			const normalizer = (obj, item, parser) => {
				const parsed = parser(item);
				const name = item.nodeName;
				obj[name] = obj[name] || [];
				obj[name].push(parsed);
			};
			const obj = xmlToObject(
				xml(
					"<root>" +
						'<group name="a">' +
						'<group name="nested"/>' +
						"</group>" +
						"</root>",
				),
				normalizer,
			);
			expect(obj.group.length).toBe(1);
			expect(obj.group[0].name).toBe("a");
			// nested group should also go through the normalizer
			expect(obj.group[0].group.length).toBe(1);
			expect(obj.group[0].group[0].name).toBe("nested");
		});

		it("normalizer can transform attributes", () => {
			const normalizer = (obj, item, parser) => {
				const parsed = parser(item);
				// coerce numeric attributes
				if (parsed.x) parsed.x = Number(parsed.x);
				if (parsed.y) parsed.y = Number(parsed.y);
				obj[item.nodeName] = parsed;
			};
			const obj = xmlToObject(
				xml('<root><point x="10" y="20"/></root>'),
				normalizer,
			);
			expect(obj.point.x).toBe(10);
			expect(obj.point.y).toBe(20);
		});

		it("normalizer can ignore certain elements", () => {
			const normalizer = (obj, item, parser) => {
				// skip elements named "ignore"
				if (item.nodeName !== "ignore") {
					obj[item.nodeName] = parser(item);
				}
			};
			const obj = xmlToObject(
				xml('<root><keep val="1"/><ignore val="2"/></root>'),
				normalizer,
			);
			expect(obj.keep).toBeDefined();
			expect(obj.ignore).toBeUndefined();
		});
	});

	// --- Document node (nodeType 9) ---
	describe("Document node input", () => {
		it("handles a Document node without crashing (attributes is null)", () => {
			// DOMParser returns a Document (nodeType 9), not an Element (nodeType 1).
			// Document nodes have attributes === null, so xmlToObject must guard
			// against iterating null. This reproduces the platformer map1.tmx crash.
			const doc = new DOMParser().parseFromString(
				'<map version="1.0"><layer name="bg"/></map>',
				"text/xml",
			);
			// pass the Document itself, not .documentElement
			const obj = xmlToObject(doc);
			// it should still parse the child elements
			expect(obj.map).toBeDefined();
			expect(obj.map.version).toBe("1.0");
		});
	});

	// --- mixed content ---
	describe("mixed content", () => {
		it("handles attributes, children, and text together", () => {
			const obj = xmlToObject(
				xml('<root version="1"><meta author="test"/>Some text</root>'),
			);
			expect(obj.version).toBe("1");
			expect(obj.meta.author).toBe("test");
			expect(obj.text).toBe("Some text");
		});
	});
});
