import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Container, Renderable } from "../src/index.js";

describe("Container", () => {
	let container;

	beforeEach(() => {
		container = new Container(0, 0, 100, 100, true);
	});

	describe("isAttachedToRoot", () => {
		let secondContainer;
		beforeAll(() => {
			secondContainer = new Container(0, 0, 100, 100);
		});

		it("should return true", () => {
			expect(container.isAttachedToRoot()).toEqual(true);
		});

		it("a new container should not be root", () => {
			expect(secondContainer.isAttachedToRoot()).toEqual(false);
		});

		it("a new container when attached to game world should find root", () => {
			container.addChild(secondContainer);
			expect(secondContainer.isAttachedToRoot()).toEqual(true);
		});
	});

	describe("object absolute position in containers", () => {
		it("should return 50,50 for renderable container", () => {
			const renderable = new Renderable(50, 50, 100, 100);

			expect(container.getAbsolutePosition().x).toEqual(0);
			expect(container.getAbsolutePosition().y).toEqual(0);

			container.addChild(renderable);

			expect(renderable.getAbsolutePosition().x).toEqual(50);
			expect(renderable.getAbsolutePosition().y).toEqual(50);
		});

		it("should return proper position and bounds for object in nested containers", () => {
			const secondContainer = new Container(10, 10, 100, 100);
			const thirdContainer = new Container(10, 10, 100, 100);
			const renderable = new Renderable(50, 50, 100, 100);

			// enable child bounds update
			secondContainer.enableChildBoundsUpdate = true;
			thirdContainer.enableChildBoundsUpdate = true;

			container.addChild(secondContainer);
			secondContainer.addChild(thirdContainer);
			thirdContainer.addChild(renderable);

			const absPos = renderable.getAbsolutePosition();
			expect(absPos.x).toEqual(70);
			expect(absPos.y).toEqual(70);

			const bounds = renderable.getBounds();
			// 20 because default anchor point is (0.5, 0.5)
			expect(bounds.x).toEqual(20);
			expect(bounds.y).toEqual(20);
		});
	});

	describe("Container bounds test", () => {
		it("Container bounds return default assigned size", () => {
			const bounds = container.getBounds();
			expect(bounds.x).toEqual(0);
			expect(bounds.y).toEqual(0);
			expect(bounds.width).toEqual(100);
			expect(bounds.height).toEqual(100);
		});

		it("Container bounds return the union of all child bounds if enabled", () => {
			container.enableChildBoundsUpdate = true;
			container.addChild(new Renderable(50, 50, 100, 100));
			container.addChild(new Renderable(100, 100, 100, 100));

			const bounds = container.getBounds();
			expect(bounds.x).toEqual(0); // because of default 0.5 anchor point
			expect(bounds.y).toEqual(0); // because of default 0.5 anchor point
			expect(bounds.width).toEqual(150); // because of default 0.5 anchor point
			expect(bounds.height).toEqual(150); // because of default 0.5 anchor point
		});
	});

	describe("Container utility function", () => {
		it("forEach iterate through all children", () => {
			let counter = 0;
			container.addChild(new Renderable(50, 50, 100, 100));
			container.addChild(new Renderable(100, 100, 100, 100));
			container.forEach((child) => {
				if (child.ancestor === container) {
					counter++;
				}
			});
			expect(counter).toEqual(2);
		});
		it("onChildChange callback", () => {
			let counter = 0;
			container.onChildChange = function () {
				// just count how many times this one is called
				counter++;
			};
			container.addChild(new Renderable(50, 50, 100, 100));
			container.addChild(new Renderable(100, 100, 100, 100));
			container.removeChildNow(container.getChildAt(0));
			expect(counter).toEqual(3);
		});
	});

	describe("addChildAt", () => {
		it("should add a child at the specified index", () => {
			const child1 = new Renderable(0, 0, 10, 10);
			const child2 = new Renderable(10, 10, 10, 10);
			const child3 = new Renderable(20, 20, 10, 10);
			container.addChild(child1);
			container.addChild(child2);
			container.addChildAt(child3, 1);
			expect(container.getChildAt(1)).toEqual(child3);
		});

		it("should trigger onChildChange with the correct index", () => {
			let receivedIndex = -1;
			const child1 = new Renderable(0, 0, 10, 10);
			const child2 = new Renderable(10, 10, 10, 10);
			container.addChild(child1);
			container.addChild(child2);
			container.onChildChange = function (index) {
				receivedIndex = index;
			};
			const child3 = new Renderable(20, 20, 10, 10);
			container.addChildAt(child3, 0);
			expect(receivedIndex).toEqual(0);
		});

		it("should throw an error for out of bounds index", () => {
			const child1 = new Renderable(0, 0, 10, 10);
			container.addChild(child1);
			const child2 = new Renderable(10, 10, 10, 10);
			expect(() => {
				container.addChildAt(child2, 99);
			}).toThrow();
		});

		it("should set the ancestor on the added child", () => {
			const child1 = new Renderable(0, 0, 10, 10);
			container.addChild(child1);
			const child2 = new Renderable(10, 10, 10, 10);
			container.addChildAt(child2, 0);
			expect(child2.ancestor).toEqual(container);
		});
	});

	describe("swapChildren", () => {
		it("should swap the z-index of two children", () => {
			container.autoSort = false;
			const child1 = new Renderable(0, 0, 10, 10);
			const child2 = new Renderable(10, 10, 10, 10);
			container.addChild(child1);
			container.addChild(child2);
			const z1 = child1.pos.z;
			const z2 = child2.pos.z;
			container.swapChildren(child1, child2);
			expect(child1.pos.z).toEqual(z2);
			expect(child2.pos.z).toEqual(z1);
		});

		it("should swap the positions in the children array", () => {
			container.autoSort = false;
			const child1 = new Renderable(0, 0, 10, 10);
			const child2 = new Renderable(10, 10, 10, 10);
			container.addChild(child1);
			container.addChild(child2);
			const idx1 = container.getChildIndex(child1);
			const idx2 = container.getChildIndex(child2);
			container.swapChildren(child1, child2);
			expect(container.getChildIndex(child1)).toEqual(idx2);
			expect(container.getChildIndex(child2)).toEqual(idx1);
		});

		it("should throw if a child does not belong to the container", () => {
			const child1 = new Renderable(0, 0, 10, 10);
			const orphan = new Renderable(10, 10, 10, 10);
			container.addChild(child1);
			expect(() => {
				container.swapChildren(child1, orphan);
			}).toThrow();
		});
	});

	describe("getChildAt", () => {
		it("should return the child at the given index", () => {
			const child1 = new Renderable(0, 0, 10, 10);
			const child2 = new Renderable(10, 10, 10, 10);
			container.addChild(child1);
			container.addChild(child2);
			expect(container.getChildAt(0)).toBeDefined();
			expect(container.getChildAt(1)).toBeDefined();
		});

		it("should throw for a negative index", () => {
			container.addChild(new Renderable(0, 0, 10, 10));
			expect(() => {
				container.getChildAt(-1);
			}).toThrow();
		});

		it("should throw for an index >= children length", () => {
			container.addChild(new Renderable(0, 0, 10, 10));
			expect(() => {
				container.getChildAt(5);
			}).toThrow();
		});
	});

	describe("getChildIndex", () => {
		it("should return the index of a child in the container", () => {
			container.autoSort = false;
			const child1 = new Renderable(0, 0, 10, 10);
			const child2 = new Renderable(10, 10, 10, 10);
			container.addChild(child1);
			container.addChild(child2);
			expect(container.getChildIndex(child1)).toEqual(0);
			expect(container.getChildIndex(child2)).toEqual(1);
		});

		it("should return -1 for a child not in the container", () => {
			const orphan = new Renderable(0, 0, 10, 10);
			expect(container.getChildIndex(orphan)).toEqual(-1);
		});
	});

	describe("hasChild", () => {
		it("should return true if the container has the child", () => {
			const child = new Renderable(0, 0, 10, 10);
			container.addChild(child);
			expect(container.hasChild(child)).toEqual(true);
		});

		it("should return false if the container does not have the child", () => {
			const orphan = new Renderable(0, 0, 10, 10);
			expect(container.hasChild(orphan)).toEqual(false);
		});

		it("should return false after the child is removed", () => {
			const child = new Renderable(0, 0, 10, 10);
			container.addChild(child);
			container.removeChildNow(child);
			expect(container.hasChild(child)).toEqual(false);
		});
	});

	describe("getChildByProp", () => {
		it("should find children by a string property", () => {
			const child1 = new Renderable(0, 0, 10, 10);
			child1.name = "player";
			const child2 = new Renderable(10, 10, 10, 10);
			child2.name = "enemy";
			container.addChild(child1);
			container.addChild(child2);
			const result = container.getChildByProp("name", "player");
			expect(result.length).toEqual(1);
			expect(result[0]).toEqual(child1);
		});

		it("should find children by a RegExp property", () => {
			const child1 = new Renderable(0, 0, 10, 10);
			child1.name = "redCoin";
			const child2 = new Renderable(10, 10, 10, 10);
			child2.name = "blueCoin";
			const child3 = new Renderable(20, 20, 10, 10);
			child3.name = "gem";
			container.addChild(child1);
			container.addChild(child2);
			container.addChild(child3);
			const result = container.getChildByProp("name", /coin/i);
			expect(result.length).toEqual(2);
		});

		it("should return an empty array when no match is found", () => {
			const child = new Renderable(0, 0, 10, 10);
			child.name = "something";
			container.addChild(child);
			const result = container.getChildByProp("name", "nonexistent");
			expect(result.length).toEqual(0);
		});

		it("should search recursively in nested containers", () => {
			const nested = new Container(0, 0, 50, 50);
			const child = new Renderable(0, 0, 10, 10);
			child.name = "deepChild";
			nested.addChild(child);
			container.addChild(nested);
			const result = container.getChildByProp("name", "deepChild");
			expect(result.length).toEqual(1);
			expect(result[0]).toEqual(child);
		});
	});

	describe("getChildByType", () => {
		it("should return children matching the given class type", () => {
			const child = new Renderable(0, 0, 10, 10);
			const nested = new Container(0, 0, 50, 50);
			container.addChild(child);
			container.addChild(nested);
			const renderables = container.getChildByType(Renderable);
			// Container extends Renderable, so both match
			expect(renderables.length).toBeGreaterThanOrEqual(2);
		});

		it("should return only Container types when filtering by Container", () => {
			const child = new Renderable(0, 0, 10, 10);
			const nested = new Container(0, 0, 50, 50);
			container.addChild(child);
			container.addChild(nested);
			const containers = container.getChildByType(Container);
			expect(containers.length).toEqual(1);
			expect(containers[0]).toEqual(nested);
		});

		it("should search recursively in nested containers", () => {
			const nested = new Container(0, 0, 50, 50);
			const deepChild = new Renderable(0, 0, 10, 10);
			nested.addChild(deepChild);
			container.addChild(nested);
			const renderables = container.getChildByType(Renderable);
			// nested (Renderable), deepChild (Renderable) - both are Renderable instances
			expect(renderables.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe("getChildByProp deep nesting", () => {
		it("should find children across 3 levels of nesting", () => {
			const level1 = new Container(0, 0, 50, 50);
			const level2 = new Container(0, 0, 50, 50);
			const deepChild = new Renderable(0, 0, 10, 10);
			deepChild.name = "deep";
			level2.addChild(deepChild);
			level1.addChild(level2);
			container.addChild(level1);

			const result = container.getChildByProp("name", "deep");
			expect(result.length).toEqual(1);
			expect(result[0]).toEqual(deepChild);
		});

		it("should collect matches from multiple levels", () => {
			const child1 = new Renderable(0, 0, 10, 10);
			child1.name = "coin";
			container.addChild(child1);

			const nested = new Container(0, 0, 50, 50);
			const child2 = new Renderable(0, 0, 10, 10);
			child2.name = "coin";
			nested.addChild(child2);
			container.addChild(nested);

			const deepNested = new Container(0, 0, 50, 50);
			const child3 = new Renderable(0, 0, 10, 10);
			child3.name = "coin";
			deepNested.addChild(child3);
			nested.addChild(deepNested);

			const result = container.getChildByProp("name", "coin");
			expect(result.length).toEqual(3);
			expect(result).toContain(child1);
			expect(result).toContain(child2);
			expect(result).toContain(child3);
		});

		it("should return results in depth-first order", () => {
			const child1 = new Renderable(0, 0, 10, 10);
			child1.name = "item";
			container.addChild(child1);

			const nested = new Container(0, 0, 50, 50);
			const child2 = new Renderable(0, 0, 10, 10);
			child2.name = "item";
			nested.addChild(child2);
			container.addChild(nested);

			const child3 = new Renderable(0, 0, 10, 10);
			child3.name = "item";
			container.addChild(child3);

			const result = container.getChildByProp("name", "item");
			expect(result.length).toEqual(3);
			// depth-first: child1 (level 0), child2 (nested, level 1), child3 (level 0)
			expect(result[0]).toEqual(child1);
			expect(result[1]).toEqual(child2);
			expect(result[2]).toEqual(child3);
		});

		it("should return empty array when nothing matches in deep tree", () => {
			const level1 = new Container(0, 0, 50, 50);
			const level2 = new Container(0, 0, 50, 50);
			const child = new Renderable(0, 0, 10, 10);
			child.name = "exists";
			level2.addChild(child);
			level1.addChild(level2);
			container.addChild(level1);

			const result = container.getChildByProp("name", "nonexistent");
			expect(result.length).toEqual(0);
		});
	});

	describe("getChildByType deep nesting", () => {
		it("should find all Containers across nested levels", () => {
			const level1 = new Container(0, 0, 50, 50);
			const level2 = new Container(0, 0, 50, 50);
			level1.addChild(level2);
			container.addChild(level1);

			const result = container.getChildByType(Container);
			expect(result.length).toEqual(2);
			expect(result).toContain(level1);
			expect(result).toContain(level2);
		});

		it("should collect Renderables from all nesting levels", () => {
			const r1 = new Renderable(0, 0, 10, 10);
			container.addChild(r1);

			const nested = new Container(0, 0, 50, 50);
			const r2 = new Renderable(0, 0, 10, 10);
			nested.addChild(r2);
			container.addChild(nested);

			const deepNested = new Container(0, 0, 50, 50);
			const r3 = new Renderable(0, 0, 10, 10);
			deepNested.addChild(r3);
			nested.addChild(deepNested);

			const result = container.getChildByType(Renderable);
			// r1, nested (is Renderable), r2, deepNested (is Renderable), r3
			expect(result.length).toEqual(5);
			expect(result).toContain(r1);
			expect(result).toContain(r2);
			expect(result).toContain(r3);
		});

		it("should return results in depth-first order", () => {
			const nested = new Container(0, 0, 50, 50);
			const deepNested = new Container(0, 0, 50, 50);
			nested.addChild(deepNested);
			container.addChild(nested);

			const result = container.getChildByType(Container);
			expect(result.length).toEqual(2);
			// depth-first: nested first, then deepNested
			expect(result[0]).toEqual(nested);
			expect(result[1]).toEqual(deepNested);
		});
	});

	describe("getChildByName", () => {
		it("should find children by name", () => {
			const child1 = new Renderable(0, 0, 10, 10);
			child1.name = "hero";
			const child2 = new Renderable(10, 10, 10, 10);
			child2.name = "villain";
			container.addChild(child1);
			container.addChild(child2);
			const result = container.getChildByName("hero");
			expect(result.length).toEqual(1);
			expect(result[0]).toEqual(child1);
		});

		it("should support RegExp matching", () => {
			const child1 = new Renderable(0, 0, 10, 10);
			child1.name = "enemy_01";
			const child2 = new Renderable(10, 10, 10, 10);
			child2.name = "enemy_02";
			container.addChild(child1);
			container.addChild(child2);
			const result = container.getChildByName(/enemy/);
			expect(result.length).toEqual(2);
		});
	});

	describe("getChildren", () => {
		it("should return an empty array for a new container", () => {
			const result = container.getChildren();
			expect(result).toBeInstanceOf(Array);
			expect(result.length).toEqual(0);
		});

		it("should return all children after adding", () => {
			container.addChild(new Renderable(0, 0, 10, 10));
			container.addChild(new Renderable(10, 10, 10, 10));
			container.addChild(new Renderable(20, 20, 10, 10));
			expect(container.getChildren().length).toEqual(3);
		});
	});

	describe("setChildsProperty", () => {
		it("should set the given property on all children", () => {
			const child1 = new Renderable(0, 0, 10, 10);
			const child2 = new Renderable(10, 10, 10, 10);
			container.addChild(child1);
			container.addChild(child2);
			container.setChildsProperty("alpha", 0.5);
			expect(child1.alpha).toEqual(0.5);
			expect(child2.alpha).toEqual(0.5);
		});

		it("should set property recursively when recursive is true", () => {
			const nested = new Container(0, 0, 50, 50);
			const deepChild = new Renderable(0, 0, 10, 10);
			nested.addChild(deepChild);
			container.addChild(nested);
			container.setChildsProperty("alpha", 0.25, true);
			expect(deepChild.alpha).toEqual(0.25);
			expect(nested.alpha).toEqual(0.25);
		});

		it("should not set property recursively when recursive is false", () => {
			const nested = new Container(0, 0, 50, 50);
			const deepChild = new Renderable(0, 0, 10, 10);
			deepChild.alpha = 1.0;
			nested.addChild(deepChild);
			container.addChild(nested);
			container.setChildsProperty("alpha", 0.25, false);
			expect(deepChild.alpha).toEqual(1.0);
			expect(nested.alpha).toEqual(0.25);
		});
	});

	describe("moveUp", () => {
		it("should move the child one step forward in the children array", () => {
			container.autoSort = false;
			const child1 = new Renderable(0, 0, 10, 10);
			const child2 = new Renderable(10, 10, 10, 10);
			const child3 = new Renderable(20, 20, 10, 10);
			container.addChild(child1);
			container.addChild(child2);
			container.addChild(child3);
			const originalIndex = container.getChildIndex(child2);
			container.moveUp(child2);
			expect(container.getChildIndex(child2)).toEqual(originalIndex - 1);
		});

		it("should not move the child if already at the top", () => {
			container.autoSort = false;
			const child1 = new Renderable(0, 0, 10, 10);
			const child2 = new Renderable(10, 10, 10, 10);
			container.addChild(child1);
			container.addChild(child2);
			container.moveUp(child1);
			expect(container.getChildIndex(child1)).toEqual(0);
		});
	});

	describe("moveDown", () => {
		it("should move the child one step backward in the children array", () => {
			container.autoSort = false;
			const child1 = new Renderable(0, 0, 10, 10);
			const child2 = new Renderable(10, 10, 10, 10);
			const child3 = new Renderable(20, 20, 10, 10);
			container.addChild(child1);
			container.addChild(child2);
			container.addChild(child3);
			const originalIndex = container.getChildIndex(child2);
			container.moveDown(child2);
			expect(container.getChildIndex(child2)).toEqual(originalIndex + 1);
		});

		it("should not move the child if already at the bottom", () => {
			container.autoSort = false;
			const child1 = new Renderable(0, 0, 10, 10);
			const child2 = new Renderable(10, 10, 10, 10);
			container.addChild(child1);
			container.addChild(child2);
			container.moveDown(child2);
			expect(container.getChildIndex(child2)).toEqual(1);
		});
	});

	describe("moveToTop", () => {
		it("should move the child to the top of the children array", () => {
			container.autoSort = false;
			const child1 = new Renderable(0, 0, 10, 10);
			const child2 = new Renderable(10, 10, 10, 10);
			const child3 = new Renderable(20, 20, 10, 10);
			container.addChild(child1);
			container.addChild(child2);
			container.addChild(child3);
			container.moveToTop(child3);
			expect(container.getChildIndex(child3)).toEqual(0);
		});

		it("should not change position if already at the top", () => {
			container.autoSort = false;
			const child1 = new Renderable(0, 0, 10, 10);
			const child2 = new Renderable(10, 10, 10, 10);
			container.addChild(child1);
			container.addChild(child2);
			container.moveToTop(child1);
			expect(container.getChildIndex(child1)).toEqual(0);
		});
	});

	describe("moveToBottom", () => {
		it("should move the child to the bottom of the children array", () => {
			container.autoSort = false;
			const child1 = new Renderable(0, 0, 10, 10);
			const child2 = new Renderable(10, 10, 10, 10);
			const child3 = new Renderable(20, 20, 10, 10);
			container.addChild(child1);
			container.addChild(child2);
			container.addChild(child3);
			container.moveToBottom(child1);
			expect(container.getChildIndex(child1)).toEqual(2);
		});

		it("should not change position if already at the bottom", () => {
			container.autoSort = false;
			const child1 = new Renderable(0, 0, 10, 10);
			const child2 = new Renderable(10, 10, 10, 10);
			container.addChild(child1);
			container.addChild(child2);
			container.moveToBottom(child2);
			expect(container.getChildIndex(child2)).toEqual(1);
		});
	});

	describe("sort", () => {
		it("should sort children by z index by default", async () => {
			container.autoSort = false;
			const child1 = new Renderable(0, 0, 10, 10);
			child1.pos.z = 3;
			const child2 = new Renderable(10, 10, 10, 10);
			child2.pos.z = 1;
			const child3 = new Renderable(20, 20, 10, 10);
			child3.pos.z = 2;
			container.getChildren().push(child1, child2, child3);
			container.sort();
			// sort is deferred, wait for it
			await new Promise((resolve) => {
				setTimeout(resolve, 50);
			});
			// default sortOn is "z" and _sortZ sorts b.pos.z - a.pos.z (descending)
			expect(container.getChildAt(0).pos.z).toBeGreaterThanOrEqual(
				container.getChildAt(1).pos.z,
			);
			expect(container.getChildAt(1).pos.z).toBeGreaterThanOrEqual(
				container.getChildAt(2).pos.z,
			);
		});
	});

	describe("sort comparators", () => {
		it("_sortZ should sort descending by z", () => {
			const a = new Renderable(0, 0, 1, 1);
			const b = new Renderable(0, 0, 1, 1);
			a.pos.z = 5;
			b.pos.z = 10;
			expect(container._sortZ(a, b)).toBeGreaterThan(0); // b first
			expect(container._sortZ(b, a)).toBeLessThan(0); // b still first
		});

		it("_sortZ should return 0 for equal z", () => {
			const a = new Renderable(0, 0, 1, 1);
			const b = new Renderable(0, 0, 1, 1);
			a.pos.z = 5;
			b.pos.z = 5;
			expect(container._sortZ(a, b)).toBe(0);
		});

		it("_sortReverseZ should sort ascending by z", () => {
			const a = new Renderable(0, 0, 1, 1);
			const b = new Renderable(0, 0, 1, 1);
			a.pos.z = 5;
			b.pos.z = 10;
			expect(container._sortReverseZ(a, b)).toBeLessThan(0); // a first
			expect(container._sortReverseZ(b, a)).toBeGreaterThan(0); // a still first
		});

		it("_sortX should sort by z first, then by x", () => {
			const a = new Renderable(100, 0, 1, 1);
			const b = new Renderable(200, 0, 1, 1);
			a.pos.z = 5;
			b.pos.z = 5;
			// same z, should sort by x
			expect(container._sortX(a, b)).toBeGreaterThan(0); // b.x > a.x
			// different z, x ignored
			b.pos.z = 10;
			expect(container._sortX(a, b)).toBeGreaterThan(0); // b.z > a.z
		});

		it("_sortY should sort by z first, then by y", () => {
			const a = new Renderable(0, 100, 1, 1);
			const b = new Renderable(0, 200, 1, 1);
			a.pos.z = 5;
			b.pos.z = 5;
			// same z, should sort by y
			expect(container._sortY(a, b)).toBeGreaterThan(0); // b.y > a.y
			// different z, y ignored
			b.pos.z = 10;
			expect(container._sortY(a, b)).toBeGreaterThan(0); // b.z > a.z
		});

		it("sortOn setter should update the cached comparator", () => {
			container.sortOn = "y";
			expect(container._comparator).toBe(container._sortY);
			container.sortOn = "x";
			expect(container._comparator).toBe(container._sortX);
			container.sortOn = "z";
			expect(container._comparator).toBe(container._sortZ);
		});
	});

	describe("enableChildBoundsUpdate", () => {
		it("child bounds should reflect absolute position after being added", () => {
			container.enableChildBoundsUpdate = true;
			const child = new Renderable(50, 50, 20, 20);
			container.addChild(child);

			const bounds = child.getBounds();
			// absPos = (50, 50), anchor offset = (-10, -10)
			// bounds centered at absPos.x + (-10) + 10 = 50, absPos.y + (-10) + 10 = 50
			expect(bounds.x).toEqual(40);
			expect(bounds.y).toEqual(40);
			expect(bounds.width).toEqual(20);
			expect(bounds.height).toEqual(20);
		});

		it("child bounds should update when container position changes", () => {
			container.enableChildBoundsUpdate = true;
			const child = new Renderable(50, 50, 20, 20);
			container.addChild(child);

			// Move container
			container.pos.x = 100;
			container.pos.y = 100;
			container.updateBounds();

			const bounds = child.getBounds();
			// absPos = container(100,100) + child(50,50) = (150, 150)
			// bounds = (150 - 10, 150 - 10, 20, 20) = (140, 140, 20, 20)
			expect(bounds.x).toEqual(140);
			expect(bounds.y).toEqual(140);
			expect(bounds.width).toEqual(20);
			expect(bounds.height).toEqual(20);
		});

		it("container bounds should expand when child moves outward", () => {
			container.enableChildBoundsUpdate = true;
			const child = new Renderable(10, 10, 20, 20);
			container.addChild(child);

			// Move child far out
			child.pos.x = 200;
			child.pos.y = 200;
			container.updateBounds();

			const containerBounds = container.getBounds();
			const childBounds = child.getBounds();

			// Child absPos = (200, 200), bounds = (190, 190, 20, 20)
			expect(childBounds.x).toEqual(190);
			expect(childBounds.y).toEqual(190);

			// Root container frame starts at (0,0,100,100)
			// Union with child bounds (190, 190, 20, 20) => (0, 0) to (210, 210)
			expect(containerBounds.x).toEqual(0);
			expect(containerBounds.y).toEqual(0);
			expect(containerBounds.width).toEqual(210);
			expect(containerBounds.height).toEqual(210);
		});

		it("should update bounds for multiple children at different positions", () => {
			container.enableChildBoundsUpdate = true;
			const child1 = new Renderable(10, 10, 20, 20);
			const child2 = new Renderable(80, 80, 30, 30);
			container.addChild(child1);
			container.addChild(child2);

			const containerBounds = container.getBounds();

			// child1 bounds: absPos=(10,10), anchor=(-10,-10) => (0, 0, 20, 20)
			// child2 bounds: absPos=(80,80), anchor=(-15,-15) => (65, 65, 30, 30)
			// Root container frame: (0, 0, 100, 100)
			// Union: min(0,0,65)=0, max(100,20,95)=100 => (0,0) to (100,100)
			expect(containerBounds.x).toEqual(0);
			expect(containerBounds.y).toEqual(0);
			expect(containerBounds.width).toEqual(100);
			expect(containerBounds.height).toEqual(100);
		});

		it("nested containers should propagate bounds updates", () => {
			container.enableChildBoundsUpdate = true;
			const inner = new Container(30, 30, 50, 50);
			inner.enableChildBoundsUpdate = true;
			const child = new Renderable(20, 20, 10, 10);

			container.addChild(inner);
			inner.addChild(child);

			// child absPos = container(0,0) + inner(30,30) + child(20,20) = (50, 50)
			const childBounds = child.getBounds();
			expect(childBounds.x).toEqual(45); // 50 - 5
			expect(childBounds.y).toEqual(45); // 50 - 5
			expect(childBounds.width).toEqual(10);
			expect(childBounds.height).toEqual(10);
		});

		it("nested container child bounds should update when grandparent moves", () => {
			container.enableChildBoundsUpdate = true;
			const inner = new Container(30, 30, 50, 50);
			inner.enableChildBoundsUpdate = true;
			const child = new Renderable(20, 20, 10, 10);

			container.addChild(inner);
			inner.addChild(child);

			// Move root container
			container.pos.x = 100;
			container.pos.y = 100;
			container.updateBounds();

			// child absPos = container(100,100) + inner(30,30) + child(20,20) = (150, 150)
			const childBounds = child.getBounds();
			expect(childBounds.x).toEqual(145); // 150 - 5
			expect(childBounds.y).toEqual(145); // 150 - 5
		});

		it("nested container child bounds should update when middle container moves", () => {
			container.enableChildBoundsUpdate = true;
			const inner = new Container(30, 30, 50, 50);
			inner.enableChildBoundsUpdate = true;
			const child = new Renderable(20, 20, 10, 10);

			container.addChild(inner);
			inner.addChild(child);

			// Move inner container
			inner.pos.x = 60;
			inner.pos.y = 60;
			container.updateBounds();

			// child absPos = container(0,0) + inner(60,60) + child(20,20) = (80, 80)
			const childBounds = child.getBounds();
			expect(childBounds.x).toEqual(75); // 80 - 5
			expect(childBounds.y).toEqual(75); // 80 - 5
		});

		it("bounds should not include children when enableChildBoundsUpdate is false", () => {
			container.enableChildBoundsUpdate = false;
			const child = new Renderable(200, 200, 50, 50);
			container.addChild(child);
			container.updateBounds();

			const containerBounds = container.getBounds();
			// Should only be the container's own bounds, not expanded by child
			expect(containerBounds.width).toEqual(100);
			expect(containerBounds.height).toEqual(100);
		});

		it("three levels of nesting with position changes", () => {
			container.enableChildBoundsUpdate = true;

			const level1 = new Container(10, 10, 40, 40);
			level1.enableChildBoundsUpdate = true;

			const level2 = new Container(5, 5, 30, 30);
			level2.enableChildBoundsUpdate = true;

			const child = new Renderable(10, 10, 10, 10);

			container.addChild(level1);
			level1.addChild(level2);
			level2.addChild(child);

			// child absPos = (0+10+5+10) = 25, same for y
			let childBounds = child.getBounds();
			expect(childBounds.x).toEqual(20); // 25 - 5
			expect(childBounds.y).toEqual(20); // 25 - 5

			// Move root container by 50
			container.pos.x = 50;
			container.pos.y = 50;
			container.updateBounds();

			childBounds = child.getBounds();
			// child absPos = (50+10+5+10) = 75
			expect(childBounds.x).toEqual(70); // 75 - 5
			expect(childBounds.y).toEqual(70);

			// Also move level1
			level1.pos.x = 20;
			level1.pos.y = 20;
			container.updateBounds();

			childBounds = child.getBounds();
			// child absPos = (50+20+5+10) = 85
			expect(childBounds.x).toEqual(80); // 85 - 5
			expect(childBounds.y).toEqual(80);
		});

		it("child absolute position should match bounds center", () => {
			container.enableChildBoundsUpdate = true;
			const child = new Renderable(40, 60, 20, 30);
			container.addChild(child);

			const absPos = child.getAbsolutePosition();
			const bounds = child.getBounds();

			// absPos = (40, 60)
			expect(absPos.x).toEqual(40);
			expect(absPos.y).toEqual(60);

			// bounds should be centered around absPos minus anchor offset
			// anchor offset = (10, 15), so bounds = (30, 45, 20, 30)
			expect(bounds.x).toEqual(30);
			expect(bounds.y).toEqual(45);
			expect(bounds.x + bounds.width / 2).toEqual(absPos.x);
			expect(bounds.y + bounds.height / 2).toEqual(absPos.y);
		});

		it("moving a child should not affect sibling bounds", () => {
			container.enableChildBoundsUpdate = true;
			const child1 = new Renderable(10, 10, 20, 20);
			const child2 = new Renderable(50, 50, 20, 20);
			container.addChild(child1);
			container.addChild(child2);

			// Move child1 far away
			child1.pos.x = 300;
			container.updateBounds();

			// child2 bounds should remain correct
			const child2Bounds = child2.getBounds();
			// child2 absPos = (50, 50), bounds = (40, 40, 20, 20)
			expect(child2Bounds.x).toEqual(40);
			expect(child2Bounds.y).toEqual(40);
			expect(child2Bounds.width).toEqual(20);
			expect(child2Bounds.height).toEqual(20);
		});

		it("container bounds should shrink back when child moves closer", () => {
			container.enableChildBoundsUpdate = true;
			const child = new Renderable(200, 200, 20, 20);
			container.addChild(child);

			let containerBounds = container.getBounds();
			// Container expands to include child at (200,200)
			const initialWidth = containerBounds.width;

			// Move child back inside container
			child.pos.x = 10;
			child.pos.y = 10;
			container.updateBounds();

			containerBounds = container.getBounds();
			// Container bounds should be smaller now
			expect(containerBounds.width).toBeLessThan(initialWidth);
		});
	});

	describe("removeChild edge cases", () => {
		it("should throw when removing a child that does not belong to the container", () => {
			const orphan = new Renderable(0, 0, 10, 10);
			expect(() => {
				container.removeChild(orphan);
			}).toThrow("Child is not mine.");
		});

		it("removeChildNow should properly clear the ancestor", () => {
			const child = new Renderable(0, 0, 10, 10);
			container.addChild(child);
			expect(child.ancestor).toEqual(container);
			container.removeChildNow(child);
			expect(child.ancestor).toBeUndefined();
		});

		it("removeChildNow should reduce children count", () => {
			const child1 = new Renderable(0, 0, 10, 10);
			const child2 = new Renderable(10, 10, 10, 10);
			container.addChild(child1);
			container.addChild(child2);
			expect(container.getChildren().length).toEqual(2);
			container.removeChildNow(child1);
			expect(container.getChildren().length).toEqual(1);
		});

		it("removeChildNow with keepalive should not destroy the child", () => {
			const child = new Renderable(0, 0, 10, 10);
			let destroyed = false;
			child.destroy = function () {
				destroyed = true;
			};
			container.addChild(child);
			container.removeChildNow(child, true);
			expect(destroyed).toEqual(false);
		});
	});

	describe("floating elements and multi-camera visibility", () => {
		it("floating children should be included in draw loop", () => {
			const floatingChild = new Renderable(0, 0, 10, 10);
			floatingChild.floating = true;
			container.addChild(floatingChild);

			// floating children are always included (inViewport || isFloating)
			const children = container.getChildren();
			const floating = children.filter((c) => {
				return c.floating === true;
			});
			expect(floating.length).toEqual(1);
			expect(floating[0]).toBe(floatingChild);
		});

		it("visibleInAllCameras defaults to false for floating children", () => {
			const floatingChild = new Renderable(0, 0, 10, 10);
			floatingChild.floating = true;
			container.addChild(floatingChild);
			expect(floatingChild.visibleInAllCameras).toEqual(false);
		});

		it("visibleInAllCameras can be set to true", () => {
			const child = new Renderable(0, 0, 10, 10);
			child.floating = true;
			child.visibleInAllCameras = true;
			container.addChild(child);
			expect(child.visibleInAllCameras).toEqual(true);
		});
	});

	describe("default dimensions", () => {
		it("should default to Infinity when no dimensions are provided", () => {
			const c = new Container();
			expect(c.width).toEqual(Infinity);
			expect(c.height).toEqual(Infinity);
		});

		it("should default to (0, 0) position when no position is provided", () => {
			const c = new Container();
			expect(c.pos.x).toEqual(0);
			expect(c.pos.y).toEqual(0);
		});

		it("should use explicit dimensions when provided", () => {
			const c = new Container(10, 20, 200, 150);
			expect(c.pos.x).toEqual(10);
			expect(c.pos.y).toEqual(20);
			expect(c.width).toEqual(200);
			expect(c.height).toEqual(150);
		});

		it("should accept children when dimensions are Infinity", () => {
			const c = new Container();
			const child = new Renderable(50, 50, 32, 32);
			c.addChild(child);
			expect(c.getChildren().length).toEqual(1);
		});

		it("should not clip children when dimensions are Infinity", () => {
			const c = new Container();
			c.clipping = true;
			const farChild = new Renderable(99999, 99999, 10, 10);
			c.addChild(farChild);
			// draw() guards clipRect with bounds.isFinite(), so even with
			// clipping enabled, Infinity bounds prevent actual clipping
			const bounds = c.getBounds();
			expect(bounds.isFinite()).toEqual(false);
			// child bounds should still be valid and reachable
			const childBounds = farChild.getBounds();
			expect(childBounds.isFinite()).toEqual(true);
			expect(childBounds.left).toBeGreaterThan(0);
		});

		it("getBounds() should return valid bounds with Infinity dimensions", () => {
			const c = new Container();
			const bounds = c.getBounds();
			expect(bounds).toBeDefined();
			expect(typeof bounds.width).toEqual("number");
			expect(typeof bounds.height).toEqual("number");
		});

		it("getBounds() should grow to fit children with explicit dimensions", () => {
			const c = new Container(0, 0, 100, 100);
			c.enableChildBoundsUpdate = true;
			const child = new Renderable(10, 20, 50, 60);
			c.addChild(child);
			c.updateBounds();
			const bounds = c.getBounds();
			expect(bounds.width).toBeGreaterThanOrEqual(50);
			expect(bounds.height).toBeGreaterThanOrEqual(60);
		});

		it("getChildByName should work with Infinity-sized container", () => {
			const c = new Container();
			const child = new Renderable(0, 0, 32, 32);
			child.name = "testChild";
			c.addChild(child);
			const found = c.getChildByName("testChild");
			expect(found.length).toEqual(1);
			expect(found[0]).toBe(child);
		});

		it("sort should work with Infinity-sized container", () => {
			const c = new Container();
			c.autoSort = true;
			const child1 = new Renderable(0, 0, 10, 10);
			child1.pos.z = 5;
			const child2 = new Renderable(0, 0, 10, 10);
			child2.pos.z = 1;
			c.addChild(child1);
			c.addChild(child2);
			c.sort();
			expect(c.getChildAt(0).pos.z).toBeLessThanOrEqual(c.getChildAt(1).pos.z);
		});

		it("isFinite() should return false for Infinity-sized container", () => {
			const c = new Container();
			expect(c.isFinite()).toEqual(false);
		});

		it("isFinite() should return true for explicitly-sized container", () => {
			const c = new Container(0, 0, 100, 100);
			expect(c.isFinite()).toEqual(true);
		});

		it("getBounds().isFinite() should return false for Infinity-sized container", () => {
			const c = new Container();
			const bounds = c.getBounds();
			expect(bounds.isFinite()).toEqual(false);
		});

		it("getBounds().isFinite() should return true for explicitly-sized container", () => {
			const c = new Container(0, 0, 200, 150);
			const bounds = c.getBounds();
			expect(bounds.isFinite()).toEqual(true);
		});

		it("updateBounds should not produce NaN for Infinity-sized container", () => {
			const c = new Container();
			c.enableChildBoundsUpdate = true;
			const child = new Renderable(10, 10, 50, 50);
			c.addChild(child);
			const bounds = c.updateBounds();
			expect(Number.isNaN(bounds.width)).toEqual(false);
			expect(Number.isNaN(bounds.height)).toEqual(false);
		});

		it("updateBounds should return finite child bounds for Infinity container", () => {
			const c = new Container();
			c.enableChildBoundsUpdate = true;
			const child = new Renderable(10, 10, 50, 50);
			c.addChild(child);
			const bounds = c.updateBounds();
			expect(bounds.isFinite()).toEqual(true);
			expect(bounds.width).toBeGreaterThanOrEqual(50);
			expect(bounds.height).toBeGreaterThanOrEqual(50);
		});

		it("clipping should be skipped for Infinity-sized container", () => {
			const c = new Container();
			// clipping requires finite bounds — verify the guard condition
			expect(c.clipping).toEqual(false);
			c.clipping = true;
			const bounds = c.getBounds();
			// draw() checks bounds.isFinite() before clipping
			expect(bounds.isFinite()).toEqual(false);
		});

		it("clipping preconditions should be met for finite container", () => {
			const c = new Container(0, 0, 200, 150);
			c.clipping = true;
			const bounds = c.getBounds();
			// all three guard conditions in draw() should pass
			expect(c.root).toEqual(false);
			expect(c.clipping).toEqual(true);
			expect(bounds.isFinite()).toEqual(true);
			expect(bounds.width).toEqual(200);
			expect(bounds.height).toEqual(150);
		});

		it("clipping defaults to false", () => {
			expect(new Container().clipping).toEqual(false);
			expect(new Container(0, 0, 100, 100).clipping).toEqual(false);
		});

		it("nested Infinity containers should not produce NaN bounds", () => {
			const parent = new Container();
			const child = new Container();
			child.enableChildBoundsUpdate = true;
			const renderable = new Renderable(5, 5, 20, 20);
			child.addChild(renderable);
			parent.addChild(child);
			parent.enableChildBoundsUpdate = true;
			const bounds = parent.updateBounds();
			expect(Number.isNaN(bounds.width)).toEqual(false);
			expect(Number.isNaN(bounds.height)).toEqual(false);
		});

		it("anchorPoint should always be (0,0) for containers", () => {
			const infinite = new Container();
			expect(infinite.anchorPoint.x).toEqual(0);
			expect(infinite.anchorPoint.y).toEqual(0);

			const finite = new Container(0, 0, 200, 100);
			expect(finite.anchorPoint.x).toEqual(0);
			expect(finite.anchorPoint.y).toEqual(0);
		});
	});
});
