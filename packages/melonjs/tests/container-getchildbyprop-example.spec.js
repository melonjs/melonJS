/**
 * The `Container#getChildByProp` TSDoc example.
 *
 * The example searched by depth with `getChildByProp("z", 10)`, which can never
 * match: a renderable has no `z` property (its depth is `pos.z`, read through
 * `depth`). It now reads `getChildByProp("depth", 10)`; these pin both the
 * example and why the old one found nothing.
 */
import { describe, expect, it } from "vitest";
import { Container, Renderable } from "../src/index.js";

describe("Container#getChildByProp documented example", () => {
	it('getChildByProp("depth", 10) finds the child added at z 10, at any depth', () => {
		const outer = new Container(0, 0, 100, 100);
		const inner = new Container(0, 0, 100, 100);
		const near = new Renderable(0, 0, 10, 10);
		const deep = new Renderable(0, 0, 10, 10);
		const other = new Renderable(0, 0, 10, 10);
		outer.addChild(near, 10);
		outer.addChild(other, 3);
		inner.addChild(deep, 10);
		outer.addChild(inner, 4);
		const found = outer.getChildByProp("depth", 10);
		expect(found).toContain(near);
		expect(found).toContain(deep);
		expect(found).not.toContain(other);
	});

	it('"z" is not a renderable property, so it matches nothing', () => {
		const c = new Container(0, 0, 100, 100);
		const r = new Renderable(0, 0, 10, 10);
		c.addChild(r, 10);
		expect(r.z).toBeUndefined();
		expect(c.getChildByProp("z", 10)).toEqual([]);
	});
});
